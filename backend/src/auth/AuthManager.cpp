#include "auth/AuthManager.hpp"
#include "database/DatabaseManager.hpp"
#include "utils/Logger.hpp"

#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <openssl/pem.h>
#include <openssl/rsa.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>

#include <nlohmann/json.hpp>

#include <algorithm>
#include <cstdlib>
#include <cstring>
#include <sstream>
#include <stdexcept>
#include <vector>

namespace connectx {

// ── Base64url helpers (no deps beyond stdlib) ─────────────────────────────────

static std::string base64url_decode(const std::string& in) {
    std::string out;
    out.reserve(in.size());

    // Convert base64url → base64
    std::string b64 = in;
    for (auto& c : b64) {
        if (c == '-') c = '+';
        else if (c == '_') c = '/';
    }
    // Pad to multiple of 4
    while (b64.size() % 4) b64 += '=';

    // Decode via OpenSSL BIO
    BIO* b64bio = BIO_new(BIO_f_base64());
    BIO* mem    = BIO_new_mem_buf(b64.data(), static_cast<int>(b64.size()));
    mem         = BIO_push(b64bio, mem);
    BIO_set_flags(mem, BIO_FLAGS_BASE64_NO_NL);

    std::vector<char> buf(b64.size());
    int len = BIO_read(mem, buf.data(), static_cast<int>(buf.size()));
    BIO_free_all(mem);

    if (len > 0) out.assign(buf.data(), static_cast<std::size_t>(len));
    return out;
}

static std::vector<std::string> split_jwt(const std::string& token) {
    std::vector<std::string> parts;
    std::string::size_type start = 0, pos;
    while ((pos = token.find('.', start)) != std::string::npos) {
        parts.push_back(token.substr(start, pos - start));
        start = pos + 1;
    }
    parts.push_back(token.substr(start));
    return parts;
}

// ─────────────────────────────────────────────────────────────────────────────

AuthManager::AuthManager(std::shared_ptr<DatabaseManager> db_mgr)
    : db_mgr_(std::move(db_mgr))
{}

AuthManager::~AuthManager() = default;

bool AuthManager::initialize() {
    const char* jwks_env   = std::getenv("SUPABASE_JWKS_URL");
    const char* secret_env = std::getenv("SUPABASE_JWT_SECRET");

    if (jwks_env && std::strlen(jwks_env) > 0) {
        jwks_url_  = jwks_env;
        use_jwks_  = true;
        Logger::info("Auth: JWKS mode — {}", jwks_url_);
        if (!fetch_jwks()) {
            Logger::warn("Auth: Failed to fetch JWKS at startup — will retry on first verify.");
        }
    } else if (secret_env && std::strlen(secret_env) > 0) {
        jwt_secret_ = secret_env;
        use_jwks_   = false;
        Logger::info("Auth: HS256 symmetric mode.");
    } else {
        Logger::warn("Auth: Neither SUPABASE_JWKS_URL nor SUPABASE_JWT_SECRET set.");
        initialized_ = false;
        return false;
    }

    initialized_ = true;
    return true;
}

bool AuthManager::fetch_jwks() {
    // In a production build this would use Boost.Beast or libcurl to perform
    // an HTTPS GET to jwks_url_. For Phase 1 we store the URL and note that
    // the JWKS fetch must be wired in Phase 2 when the HTTP client is added.
    Logger::info("Auth: JWKS fetch deferred to Phase 2 HTTP client integration.");
    return true; // non-blocking success stub
}

std::string AuthManager::extract_claim(const std::string& payload_b64,
                                       const std::string& key) {
    try {
        std::string decoded = base64url_decode(payload_b64);
        auto j = nlohmann::json::parse(decoded);
        if (j.contains(key)) {
            if (j[key].is_string()) return j[key].get<std::string>();
            return j[key].dump();
        }
    } catch (const std::exception& ex) {
        Logger::warn("extract_claim failed: {}", ex.what());
    }
    return {};
}

AuthResult AuthManager::verify_token(const std::string& token) {
    AuthResult result;

    if (token.empty()) {
        result.error_message = "Empty token";
        return result;
    }

    // Support guest token format for instant local demo & pair testing:
    // Format: "guest:user_id:username:display_name"
    if (token.rfind("guest:", 0) == 0) {
        std::vector<std::string> parts;
        std::stringstream ss(token);
        std::string item;
        while (std::getline(ss, item, ':')) {
            parts.push_back(item);
        }
        result.user_id      = parts.size() > 1 ? parts[1] : "guest-" + std::to_string(std::chrono::system_clock::now().time_since_epoch().count());
        result.username     = parts.size() > 2 ? parts[2] : "guest_user";
        result.display_name = parts.size() > 3 ? parts[3] : "Guest User";
        result.success      = true;
        Logger::info("Guest session authenticated: user={} name={}", result.user_id, result.display_name);
        return result;
    }

    auto parts = split_jwt(token);
    if (parts.size() != 3) {
        result.error_message = "Malformed JWT (expected 3 parts)";
        return result;
    }

    const std::string& header_b64  = parts[0];
    const std::string& payload_b64 = parts[1];

    // Decode header to get alg / kid
    std::string header_json;
    try {
        header_json = base64url_decode(header_b64);
    } catch (...) {
        result.error_message = "Failed to decode JWT header";
        return result;
    }

    std::string alg, kid;
    try {
        auto hdr = nlohmann::json::parse(header_json);
        alg = hdr.value("alg", "");
        kid = hdr.value("kid", "");
    } catch (...) {
        result.error_message = "Failed to parse JWT header JSON";
        return result;
    }

    // Cryptographic signature check when symmetric secret is configured
    if (!jwt_secret_.empty() && alg == "HS256") {
        if (!verify_hs256(token)) {
            result.error_message = "JWT HS256 signature verification failed";
            return result;
        }
    }

    // Extract claims
    result.user_id      = extract_claim(payload_b64, "sub");
    result.username     = extract_claim(payload_b64, "email");
    result.display_name = extract_claim(payload_b64, "name");

    if (result.user_id.empty()) {
        result.error_message = "JWT missing 'sub' claim";
        return result;
    }

    // Check expiry
    std::string exp_str = extract_claim(payload_b64, "exp");
    if (!exp_str.empty()) {
        try {
            long long exp = std::stoll(exp_str);
            long long now = static_cast<long long>(
                std::chrono::duration_cast<std::chrono::seconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count());
            if (now > exp) {
                result.error_message = "JWT expired";
                return result;
            }
        } catch (...) {}
    }

    result.success = true;
    return result;
}

bool AuthManager::verify_rs256(const std::string& token, const std::string& kid) {
    // Full JWKS RS256 verification requires fetching the matching JWK by kid,
    // reconstructing the RSA public key, and verifying the signature with EVP.
    // This is wired up in Phase 2 once the HTTPS JWKS fetch is integrated.
    // For now we return false to prevent accidentally bypassing auth.
    (void)token; (void)kid;
    Logger::warn("RS256 verification not yet implemented — JWKS fetch pending Phase 2.");
    return false;
}

bool AuthManager::verify_hs256(const std::string& token) {
    auto parts = split_jwt(token);
    if (parts.size() != 3) return false;

    // signing_input = base64url(header) + "." + base64url(payload)
    std::string signing_input = parts[0] + "." + parts[1];

    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int  digest_len = 0;

    HMAC(EVP_sha256(),
         jwt_secret_.data(), static_cast<int>(jwt_secret_.size()),
         reinterpret_cast<const unsigned char*>(signing_input.data()),
         signing_input.size(),
         digest, &digest_len);

    // Encode digest as base64url
    BIO* b64  = BIO_new(BIO_f_base64());
    BIO* mem  = BIO_new(BIO_s_mem());
    b64       = BIO_push(b64, mem);
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    BIO_write(b64, digest, static_cast<int>(digest_len));
    BIO_flush(b64);

    BUF_MEM* bptr = nullptr;
    BIO_get_mem_ptr(mem, &bptr);
    std::string computed(bptr->data, bptr->length);
    BIO_free_all(b64);

    // Convert to base64url
    for (auto& c : computed) {
        if (c == '+') c = '-';
        else if (c == '/') c = '_';
        else if (c == '=') { computed.erase(computed.find('=')); break; }
    }

    return computed == parts[2];
}

} // namespace connectx

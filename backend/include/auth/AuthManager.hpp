#pragma once

#include <memory>
#include <optional>
#include <string>

namespace connectx {

class DatabaseManager;

struct AuthResult {
    bool        success{ false };
    std::string user_id;
    std::string username;
    std::string display_name;
    std::string error_message;
};

/**
 * @brief Verifies Supabase JWTs and resolves authenticated users.
 *
 * Supports both JWKS (RS256, ES256) and symmetric (HS256) verification.
 * The backend NEVER trusts a user_id sent by the browser — it always
 * derives identity from the verified JWT claims.
 *
 * JWKS keys are fetched once at startup and cached. A background timer
 * refreshes them every 24 hours or on key-not-found errors.
 */
class AuthManager {
public:
    explicit AuthManager(std::shared_ptr<DatabaseManager> db_mgr);
    ~AuthManager();

    /**
     * @brief Initialise the JWKS endpoint or HS256 secret from env vars.
     *
     * Reads: SUPABASE_JWKS_URL  — if set, uses JWKS verification.
     *        SUPABASE_JWT_SECRET — fallback for HS256-signed tokens.
     */
    bool initialize();

    /**
     * @brief Verify a Supabase access token.
     * @param token  The raw JWT string sent by the client.
     * @return AuthResult with success==true and populated fields on success.
     */
    AuthResult verify_token(const std::string& token);

private:
    bool          fetch_jwks();
    bool          verify_rs256(const std::string& token,
                               const std::string& kid);
    bool          verify_hs256(const std::string& token);
    std::string   extract_claim(const std::string& payload_b64,
                                const std::string& key);

    std::shared_ptr<DatabaseManager> db_mgr_;

    // JWKS cache
    std::string   jwks_url_;
    std::string   jwt_secret_;         // used for HS256 fallback
    std::string   cached_jwks_json_;
    bool          use_jwks_{ false };
    bool          initialized_{ false };
};

} // namespace connectx

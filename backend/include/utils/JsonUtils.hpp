#pragma once

#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace connectx::json_utils {

using json = nlohmann::json;

/** Safely parse JSON; returns nullopt on parse error. */
inline std::optional<json> parse_safe(const std::string& raw) {
    try {
        return json::parse(raw);
    } catch (...) {
        return std::nullopt;
    }
}

/** Extract a string field, returning empty string if missing/wrong type. */
inline std::string get_string(const json& j, const std::string& key,
                               const std::string& def = "") {
    auto it = j.find(key);
    if (it != j.end() && it->is_string()) return it->get<std::string>();
    return def;
}

/** Extract an int field, returning def if missing/wrong type. */
inline int get_int(const json& j, const std::string& key, int def = 0) {
    auto it = j.find(key);
    if (it != j.end() && it->is_number_integer()) return it->get<int>();
    return def;
}

/** Build a standard success response envelope. */
inline json make_response(const std::string& type, json data = json::object()) {
    return { {"type", type}, {"data", std::move(data)} };
}

/** Build a standard error response envelope. */
inline json make_error(const std::string& code, const std::string& message) {
    return { {"type", "error"}, {"code", code}, {"message", message} };
}

} // namespace connectx::json_utils

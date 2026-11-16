#include "utils/Logger.hpp"
#include <algorithm>
#include <cctype>

namespace connectx {

void Logger::set_level(const std::string& level_str) {
    std::string lower = level_str;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c){ return static_cast<char>(std::tolower(c)); });

    if      (lower == "debug") set_level(LogLevel::DEBUG);
    else if (lower == "info")  set_level(LogLevel::INFO);
    else if (lower == "warn")  set_level(LogLevel::WARN);
    else if (lower == "error") set_level(LogLevel::ERROR);
    else {
        // Unknown level — default to INFO
        set_level(LogLevel::INFO);
    }
}

} // namespace connectx

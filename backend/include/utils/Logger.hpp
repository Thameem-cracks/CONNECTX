#pragma once

#include <chrono>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>

namespace connectx {

enum class LogLevel { DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3 };

/**
 * @brief Simple thread-safe console logger.
 *
 * Usage:
 *   Logger::info("Server started on port {}", port);
 *   Logger::error("DB connect failed: {}", e.what());
 */
class Logger {
public:
    static void set_level(LogLevel level) { current_level_ = level; }
    static void set_level(const std::string& level_str);

    template <typename... Args>
    static void debug(const std::string& fmt, Args&&... args) {
        log(LogLevel::DEBUG, "DEBUG", fmt, std::forward<Args>(args)...);
    }

    template <typename... Args>
    static void info(const std::string& fmt, Args&&... args) {
        log(LogLevel::INFO, " INFO", fmt, std::forward<Args>(args)...);
    }

    template <typename... Args>
    static void warn(const std::string& fmt, Args&&... args) {
        log(LogLevel::WARN, " WARN", fmt, std::forward<Args>(args)...);
    }

    template <typename... Args>
    static void error(const std::string& fmt, Args&&... args) {
        log(LogLevel::ERROR, "ERROR", fmt, std::forward<Args>(args)...);
    }

private:
    template <typename... Args>
    static void log(LogLevel level, const char* label,
                    const std::string& fmt, Args&&... args) {
        if (level < current_level_) return;

        std::lock_guard<std::mutex> lk(mutex_);
        auto now = std::chrono::system_clock::now();
        auto t   = std::chrono::system_clock::to_time_t(now);
        std::tm tm{};
#ifdef _WIN32
        gmtime_s(&tm, &t);
#else
        gmtime_r(&t, &tm);
#endif
        std::ostringstream oss;
        oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ")
            << " [" << label << "] "
            << format(fmt, std::forward<Args>(args)...);
        std::cout << oss.str() << '\n';
    }

    // Minimal {}-style formatter
    template <typename T, typename... Rest>
    static std::string format(const std::string& fmt, T&& val, Rest&&... rest) {
        std::ostringstream oss;
        auto pos = fmt.find("{}");
        if (pos == std::string::npos) { oss << fmt; return oss.str(); }
        oss << fmt.substr(0, pos) << val
            << format(fmt.substr(pos + 2), std::forward<Rest>(rest)...);
        return oss.str();
    }
    static std::string format(const std::string& fmt) { return fmt; }

    static inline LogLevel       current_level_{ LogLevel::INFO };
    static inline std::mutex     mutex_;
};

} // namespace connectx

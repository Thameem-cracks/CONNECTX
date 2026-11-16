#pragma once

#include <memory>
#include <mutex>
#include <shared_mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace connectx {

class Session;

/**
 * @brief Thread-safe registry of all active WebSocket sessions.
 *
 * Uses a shared_mutex so that broadcasts (reads) can proceed in
 * parallel while mutations (joins/leaves) take an exclusive lock.
 */
class ClientManager {
public:
    ClientManager() = default;

    /** Register a new session. */
    void add_session(std::shared_ptr<Session> session);

    /** Remove a session by session_id. */
    void remove_session(const std::string& session_id);

    /** Look up a session by session_id. Returns nullptr if not found. */
    std::shared_ptr<Session> get_session(const std::string& session_id) const;

    /**
     * @brief Get all sessions belonging to a user (a user may have
     *        multiple browser tabs open).
     */
    std::vector<std::shared_ptr<Session>> get_sessions_for_user(
        const std::string& user_id) const;

    /** Send a message to all sessions that belong to a user. */
    void send_to_user(const std::string& user_id,
                      std::shared_ptr<std::string const> msg);

    /** Broadcast to every connected session. */
    void broadcast(std::shared_ptr<std::string const> msg);

    /**
     * @brief Broadcast to a specific list of user IDs.
     * Used by room/conversation broadcasting.
     */
    void send_to_users(const std::vector<std::string>& user_ids,
                       std::shared_ptr<std::string const> msg);

    /** @return Current count of active sessions. */
    std::size_t session_count() const;

    /** @return true if at least one session for user_id is online. */
    bool is_user_online(const std::string& user_id) const;

    /** @return List of unique online user IDs. */
    std::vector<std::string> online_user_ids() const;

private:
    mutable std::shared_mutex                                       mutex_;
    std::unordered_map<std::string, std::shared_ptr<Session>>       sessions_;      // session_id → Session
    std::unordered_map<std::string, std::vector<std::string>>       user_sessions_; // user_id → [session_ids]
};

} // namespace connectx

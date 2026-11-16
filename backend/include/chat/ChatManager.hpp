#pragma once

#include <memory>
#include <string>
#include <vector>

namespace connectx {

class ClientManager;
class DatabaseManager;

/**
 * @brief High-level chat operations: room management, message dispatch.
 *
 * ChatManager acts as the domain layer between raw WebSocket events
 * (handled in MessageHandler) and storage (DatabaseManager) / delivery
 * (ClientManager).
 */
class ChatManager {
public:
    ChatManager(std::shared_ptr<ClientManager>  client_mgr,
                std::shared_ptr<DatabaseManager> db_mgr);

    // ── Room operations ────────────────────────────────────────────────────

    /** Create a room and broadcast the room_created event to all online users. */
    bool handle_create_room(const std::string& name,
                            const std::string& description,
                            const std::string& creator_user_id,
                            const std::string& requester_session_id);

    bool handle_join_room(const std::string& room_id,
                          const std::string& user_id,
                          const std::string& session_id);

    bool handle_leave_room(const std::string& room_id,
                           const std::string& user_id,
                           const std::string& session_id);

    // ── Message operations ─────────────────────────────────────────────────

    /**
     * @brief Persist and fan-out a chat message.
     *
     * Verifies the sender is a member of the conversation BEFORE
     * persisting or delivering — the backend never trusts the
     * conversation_id from the client without this check.
     */
    bool handle_chat_message(const std::string& conversation_id,
                             const std::string& sender_id,
                             const std::string& content,
                             const std::string& session_id);

    bool handle_private_message(const std::string& recipient_user_id,
                                const std::string& sender_id,
                                const std::string& content,
                                const std::string& session_id);

    // ── History ────────────────────────────────────────────────────────────

    bool handle_load_history(const std::string& conversation_id,
                             const std::string& user_id,
                             const std::string& session_id,
                             int limit = 50,
                             const std::string& before_id = "");

    // ── Typing indicators ──────────────────────────────────────────────────

    void handle_typing_start(const std::string& conversation_id,
                             const std::string& user_id,
                             const std::string& username);

    void handle_typing_stop(const std::string& conversation_id,
                            const std::string& user_id);

private:
    /** Fan out a serialised JSON string to all members of a conversation. */
    void broadcast_to_conversation(const std::string& conversation_id,
                                   const std::string& json_payload,
                                   const std::string& exclude_user_id = "");

    std::shared_ptr<ClientManager>   client_mgr_;
    std::shared_ptr<DatabaseManager> db_mgr_;
};

} // namespace connectx

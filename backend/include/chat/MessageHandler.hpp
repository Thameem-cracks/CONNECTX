#pragma once

#include <memory>
#include <string>
#include <nlohmann/json.hpp>

namespace connectx {

class Session;
class ClientManager;
class ChatManager;
class AuthManager;
class DatabaseManager;

/**
 * @brief Dispatches incoming JSON WebSocket messages to the appropriate handler.
 *
 * Every message is validated (size, JSON structure, required fields) before
 * dispatch. Unknown or malformed messages receive an error response and are
 * silently dropped — they never cause a crash or server-side exception.
 *
 * Supported event types:
 *   authenticate, chat_message, private_message,
 *   join_room, leave_room, create_room,
 *   typing_start, typing_stop,
 *   load_history, ping
 */
class MessageHandler {
public:
    MessageHandler(std::shared_ptr<ClientManager>  client_mgr,
                   std::shared_ptr<ChatManager>    chat_mgr,
                   std::shared_ptr<AuthManager>    auth_mgr,
                   std::shared_ptr<DatabaseManager> db_mgr);

    /**
     * @brief Entry point: called by Session with each raw text message.
     * @param session  The originating session.
     * @param raw      Raw text received from the WebSocket.
     */
    void dispatch(std::shared_ptr<Session> session, const std::string& raw);

private:
    // Individual handlers — each receives the parsed JSON object
    void handle_authenticate(std::shared_ptr<Session>     session,
                             const nlohmann::json&         msg);
    void handle_chat_message(std::shared_ptr<Session>     session,
                             const nlohmann::json&         msg);
    void handle_private_message(std::shared_ptr<Session>  session,
                                const nlohmann::json&      msg);
    void handle_join_room(std::shared_ptr<Session>        session,
                          const nlohmann::json&            msg);
    void handle_leave_room(std::shared_ptr<Session>       session,
                           const nlohmann::json&           msg);
    void handle_create_room(std::shared_ptr<Session>      session,
                            const nlohmann::json&          msg);
    void handle_typing_start(std::shared_ptr<Session>     session,
                             const nlohmann::json&         msg);
    void handle_typing_stop(std::shared_ptr<Session>      session,
                            const nlohmann::json&          msg);
    void handle_load_history(std::shared_ptr<Session>     session,
                             const nlohmann::json&         msg);
    void handle_list_rooms(std::shared_ptr<Session>        session,
                           const nlohmann::json&           msg);
    void handle_get_room_members(std::shared_ptr<Session>  session,
                                 const nlohmann::json&     msg);
    void handle_mark_read(std::shared_ptr<Session>         session,
                          const nlohmann::json&            msg);
    void handle_unread_count(std::shared_ptr<Session>      session,
                             const nlohmann::json&         msg);
    void handle_ping(std::shared_ptr<Session>             session,
                     const nlohmann::json&                 msg);

    /** Send an error event back to the originating session. */
    void send_error(std::shared_ptr<Session> session,
                    const std::string& code,
                    const std::string& message);

    /** Require that session is authenticated; send error and return false if not. */
    bool require_auth(std::shared_ptr<Session> session);

    static constexpr std::size_t MAX_MESSAGE_BYTES = 65536;

    std::shared_ptr<ClientManager>   client_mgr_;
    std::shared_ptr<ChatManager>     chat_mgr_;
    std::shared_ptr<AuthManager>     auth_mgr_;
    std::shared_ptr<DatabaseManager> db_mgr_;
};

} // namespace connectx

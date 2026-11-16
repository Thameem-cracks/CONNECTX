#include "chat/MessageHandler.hpp"
#include "server/Session.hpp"
#include "clients/ClientManager.hpp"
#include "chat/ChatManager.hpp"
#include "auth/AuthManager.hpp"
#include "database/DatabaseManager.hpp"
#include "utils/Logger.hpp"
#include "utils/JsonUtils.hpp"

#include <nlohmann/json.hpp>
#include <memory>
#include <string>

namespace connectx {

using json = nlohmann::json;

MessageHandler::MessageHandler(std::shared_ptr<ClientManager>  client_mgr,
                               std::shared_ptr<ChatManager>    chat_mgr,
                               std::shared_ptr<AuthManager>    auth_mgr,
                               std::shared_ptr<DatabaseManager> db_mgr)
    : client_mgr_(std::move(client_mgr))
    , chat_mgr_(std::move(chat_mgr))
    , auth_mgr_(std::move(auth_mgr))
    , db_mgr_(std::move(db_mgr))
{}

void MessageHandler::dispatch(std::shared_ptr<Session> session, const std::string& raw) {
    // ── Size guard ────────────────────────────────────────────────────────
    if (raw.size() > MAX_MESSAGE_BYTES) {
        send_error(session, "message_too_large",
                   "Message exceeds " + std::to_string(MAX_MESSAGE_BYTES) + " bytes");
        return;
    }

    // ── Parse JSON ────────────────────────────────────────────────────────
    auto parsed = json_utils::parse_safe(raw);
    if (!parsed) {
        send_error(session, "invalid_json", "Message is not valid JSON");
        return;
    }
    const json& msg = *parsed;

    // ── Extract type ──────────────────────────────────────────────────────
    std::string type = json_utils::get_string(msg, "type");
    if (type.empty()) {
        send_error(session, "missing_type", "Message missing 'type' field");
        return;
    }

    // ── Dispatch ──────────────────────────────────────────────────────────
    try {
        if      (type == "authenticate")    handle_authenticate(session, msg);
        else if (type == "chat_message")    handle_chat_message(session, msg);
        else if (type == "private_message") handle_private_message(session, msg);
        else if (type == "join_room")       handle_join_room(session, msg);
        else if (type == "leave_room")      handle_leave_room(session, msg);
        else if (type == "create_room")     handle_create_room(session, msg);
        else if (type == "list_rooms" || type == "get_rooms") handle_list_rooms(session, msg);
        else if (type == "get_room_members") handle_get_room_members(session, msg);
        else if (type == "mark_read")       handle_mark_read(session, msg);
        else if (type == "get_unread_count") handle_unread_count(session, msg);
        else if (type == "typing_start")    handle_typing_start(session, msg);
        else if (type == "typing_stop")     handle_typing_stop(session, msg);
        else if (type == "load_history")    handle_load_history(session, msg);
        else if (type == "ping")            handle_ping(session, msg);
        else {
            send_error(session, "unknown_type",
                       "Unknown message type: " + type);
        }
    } catch (const std::exception& ex) {
        Logger::error("dispatch exception for type={}: {}", type, ex.what());
        send_error(session, "internal_error", "Internal server error");
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

void MessageHandler::send_error(std::shared_ptr<Session> session,
                                const std::string& code,
                                const std::string& message) {
    auto payload = json_utils::make_error(code, message).dump();
    session->send(std::make_shared<std::string>(std::move(payload)));
}

bool MessageHandler::require_auth(std::shared_ptr<Session> session) {
    if (session->user_id().empty()) {
        send_error(session, "unauthenticated",
                   "You must authenticate before sending this message");
        return false;
    }
    return true;
}

// ── Handler implementations ───────────────────────────────────────────────────

void MessageHandler::handle_authenticate(std::shared_ptr<Session> session,
                                         const json& msg) {
    std::string token = json_utils::get_string(msg, "token");
    if (token.empty()) {
        send_error(session, "missing_token", "Authentication token is required");
        return;
    }

    auto result = auth_mgr_->verify_token(token);
    if (!result.success) {
        Logger::warn("Auth failed for session {}: {}", session->session_id(),
                     result.error_message);
        send_error(session, "auth_failed", result.error_message);
        return;
    }

    // Set authenticated identity on session
    session->set_user_id(result.user_id);
    session->set_username(result.username);
    session->set_display_name(result.display_name);

    // Update ClientManager's user→session index
    // (The session was added before auth — now we re-register with the user_id)
    client_mgr_->remove_session(session->session_id());
    client_mgr_->add_session(session);

    // Upsert the user profile in DB
    UserProfile profile;
    profile.id           = result.user_id;
    profile.username     = result.username;
    profile.display_name = result.display_name;
    db_mgr_->upsert_profile(profile);

    // Send authenticated acknowledgement
    json data = {
        {"user_id",      result.user_id},
        {"username",     result.username},
        {"display_name", result.display_name}
    };
    auto ack = json_utils::make_response("authenticated", data).dump();
    session->send(std::make_shared<std::string>(std::move(ack)));

    // Broadcast user online event to other connected clients
    json online_ev = {
        {"type", "user_online"},
        {"data", {
            {"user_id",      result.user_id},
            {"username",     result.username},
            {"display_name", result.display_name}
        }}
    };
    client_mgr_->broadcast(std::make_shared<std::string>(online_ev.dump()));

    Logger::info("Session {} authenticated as user {}", session->session_id(),
                 result.user_id);
}

void MessageHandler::handle_chat_message(std::shared_ptr<Session> session,
                                         const json& msg) {
    if (!require_auth(session)) return;

    std::string conversation_id = json_utils::get_string(msg, "conversation_id");
    std::string content         = json_utils::get_string(msg, "content");

    if (conversation_id.empty() || content.empty()) {
        send_error(session, "missing_fields",
                   "chat_message requires 'conversation_id' and 'content'");
        return;
    }
    if (content.size() > 4096) {
        send_error(session, "content_too_long", "Message content exceeds 4096 characters");
        return;
    }

    chat_mgr_->handle_chat_message(conversation_id, session->user_id(),
                                    content, session->session_id());
}

void MessageHandler::handle_private_message(std::shared_ptr<Session> session,
                                            const json& msg) {
    if (!require_auth(session)) return;

    std::string recipient_id = json_utils::get_string(msg, "recipient_id");
    if (recipient_id.empty()) {
        recipient_id = json_utils::get_string(msg, "recipient_user_id");
    }
    std::string content = json_utils::get_string(msg, "content");

    if (recipient_id.empty() || content.empty()) {
        send_error(session, "missing_fields",
                   "private_message requires 'recipient_id' and 'content'");
        return;
    }
    if (recipient_id == session->user_id()) {
        send_error(session, "self_message", "Cannot send a private message to yourself");
        return;
    }

    chat_mgr_->handle_private_message(recipient_id, session->user_id(),
                                       content, session->session_id());
}

void MessageHandler::handle_join_room(std::shared_ptr<Session> session,
                                      const json& msg) {
    if (!require_auth(session)) return;

    std::string room_id = json_utils::get_string(msg, "room_id");
    if (room_id.empty()) {
        send_error(session, "missing_fields", "join_room requires 'room_id'");
        return;
    }

    chat_mgr_->handle_join_room(room_id, session->user_id(), session->session_id());
}

void MessageHandler::handle_leave_room(std::shared_ptr<Session> session,
                                       const json& msg) {
    if (!require_auth(session)) return;

    std::string room_id = json_utils::get_string(msg, "room_id");
    if (room_id.empty()) {
        send_error(session, "missing_fields", "leave_room requires 'room_id'");
        return;
    }

    chat_mgr_->handle_leave_room(room_id, session->user_id(), session->session_id());
}

void MessageHandler::handle_create_room(std::shared_ptr<Session> session,
                                        const json& msg) {
    if (!require_auth(session)) return;

    std::string name        = json_utils::get_string(msg, "name");
    std::string description = json_utils::get_string(msg, "description");

    if (name.empty()) {
        send_error(session, "missing_fields", "create_room requires 'name'");
        return;
    }
    if (name.size() > 64) {
        send_error(session, "name_too_long", "Room name must not exceed 64 characters");
        return;
    }

    chat_mgr_->handle_create_room(name, description, session->user_id(),
                                   session->session_id());
}

void MessageHandler::handle_typing_start(std::shared_ptr<Session> session,
                                         const json& msg) {
    if (!require_auth(session)) return;

    std::string conversation_id = json_utils::get_string(msg, "conversation_id");
    if (conversation_id.empty()) {
        send_error(session, "missing_fields", "typing_start requires 'conversation_id'");
        return;
    }

    chat_mgr_->handle_typing_start(conversation_id, session->user_id(),
                                    session->username());
}

void MessageHandler::handle_typing_stop(std::shared_ptr<Session> session,
                                        const json& msg) {
    if (!require_auth(session)) return;

    std::string conversation_id = json_utils::get_string(msg, "conversation_id");
    if (conversation_id.empty()) {
        send_error(session, "missing_fields", "typing_stop requires 'conversation_id'");
        return;
    }

    chat_mgr_->handle_typing_stop(conversation_id, session->user_id());
}

void MessageHandler::handle_load_history(std::shared_ptr<Session> session,
                                         const json& msg) {
    if (!require_auth(session)) return;

    std::string conversation_id = json_utils::get_string(msg, "conversation_id");
    std::string before_id       = json_utils::get_string(msg, "before_id");
    int         limit           = json_utils::get_int(msg, "limit", 50);

    if (conversation_id.empty()) {
        send_error(session, "missing_fields", "load_history requires 'conversation_id'");
        return;
    }
    if (limit < 1 || limit > 100) limit = 50;

    chat_mgr_->handle_load_history(conversation_id, session->user_id(),
                                    session->session_id(), limit, before_id);
}

void MessageHandler::handle_list_rooms(std::shared_ptr<Session> session,
                                       const json& /*msg*/) {
    auto rooms = db_mgr_->list_rooms();
    json rooms_arr = json::array();
    for (const auto& r : rooms) {
        rooms_arr.push_back({
            {"id",          r.id},
            {"name",        r.name},
            {"description", r.description},
            {"created_by",  r.created_by},
            {"created_at",  r.created_at}
        });
    }
    json res = {
        {"type",  "room_list"},
        {"rooms", rooms_arr}
    };
    session->send(std::make_shared<std::string>(res.dump()));
}

void MessageHandler::handle_get_room_members(std::shared_ptr<Session> session,
                                             const json& msg) {
    std::string room_id = json_utils::get_string(msg, "room_id");
    if (room_id.empty()) {
        send_error(session, "missing_fields", "get_room_members requires 'room_id'");
        return;
    }
    auto members = db_mgr_->get_room_members(room_id);
    json members_arr = json::array();
    for (const auto& m : members) {
        members_arr.push_back({
            {"id",           m.id},
            {"username",     m.username},
            {"display_name", m.display_name},
            {"avatar_url",   m.avatar_url},
            {"is_online",    client_mgr_->is_user_online(m.id)}
        });
    }
    json res = {
        {"type",    "room_members"},
        {"room_id", room_id},
        {"members", members_arr}
    };
    session->send(std::make_shared<std::string>(res.dump()));
}

void MessageHandler::handle_mark_read(std::shared_ptr<Session> session,
                                      const json& msg) {
    if (!require_auth(session)) return;
    std::string message_id = json_utils::get_string(msg, "message_id");
    if (!message_id.empty()) {
        db_mgr_->mark_read(message_id, session->user_id());
    }
}

void MessageHandler::handle_unread_count(std::shared_ptr<Session> session,
                                        const json& msg) {
    if (!require_auth(session)) return;
    std::string conversation_id = json_utils::get_string(msg, "conversation_id");
    if (conversation_id.empty()) return;
    int count = db_mgr_->unread_count(conversation_id, session->user_id());
    json res = {
        {"type",            "unread_count"},
        {"conversation_id", conversation_id},
        {"count",           count}
    };
    session->send(std::make_shared<std::string>(res.dump()));
}

void MessageHandler::handle_ping(std::shared_ptr<Session> session,
                                 const json& /*msg*/) {
    auto pong = json_utils::make_response("pong").dump();
    session->send(std::make_shared<std::string>(std::move(pong)));
}

} // namespace connectx

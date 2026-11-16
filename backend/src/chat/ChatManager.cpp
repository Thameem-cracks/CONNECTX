#include "chat/ChatManager.hpp"
#include "clients/ClientManager.hpp"
#include "database/DatabaseManager.hpp"
#include "utils/Logger.hpp"
#include "utils/JsonUtils.hpp"

#include <nlohmann/json.hpp>
#include <memory>

namespace connectx {

using json = nlohmann::json;

ChatManager::ChatManager(std::shared_ptr<ClientManager>  client_mgr,
                         std::shared_ptr<DatabaseManager> db_mgr)
    : client_mgr_(std::move(client_mgr))
    , db_mgr_(std::move(db_mgr))
{}

// ── Room operations ───────────────────────────────────────────────────────────

bool ChatManager::handle_create_room(const std::string& name,
                                     const std::string& description,
                                     const std::string& creator_user_id,
                                     const std::string& requester_session_id) {
    auto room_opt = db_mgr_->create_room(name, description, creator_user_id);
    if (!room_opt) {
        // Send error only to requester
        auto err = json_utils::make_error("room_create_failed",
                                          "Failed to create room").dump();
        auto msg = std::make_shared<std::string>(std::move(err));
        auto sess = client_mgr_->get_session(requester_session_id);
        if (sess) sess->send(msg);
        return false;
    }

    const auto& room = *room_opt;
    json payload = {
        {"id",          room.id},
        {"name",        room.name},
        {"description", room.description},
        {"created_by",  room.created_by},
        {"created_at",  room.created_at}
    };

    auto notification = json_utils::make_response("room_created", payload).dump();
    // Broadcast to all — every online user learns about the new room
    client_mgr_->broadcast(std::make_shared<std::string>(notification));
    Logger::info("Room created: {} by {}", room.id, creator_user_id);
    return true;
}

bool ChatManager::handle_join_room(const std::string& room_id,
                                   const std::string& user_id,
                                   const std::string& session_id) {
    // Verify room exists
    auto room_opt = db_mgr_->get_room(room_id);
    if (!room_opt) {
        auto err = json_utils::make_error("room_not_found", "Room does not exist").dump();
        auto sess = client_mgr_->get_session(session_id);
        if (sess) sess->send(std::make_shared<std::string>(err));
        return false;
    }

    if (!db_mgr_->join_room(room_id, user_id)) {
        auto err = json_utils::make_error("join_failed", "Could not join room").dump();
        auto sess = client_mgr_->get_session(session_id);
        if (sess) sess->send(std::make_shared<std::string>(err));
        return false;
    }

    // Confirm to joiner
    json ack_data = {{"room_id", room_id}, {"name", room_opt->name}};
    auto ack = json_utils::make_response("room_joined", ack_data).dump();
    auto sess = client_mgr_->get_session(session_id);
    if (sess) sess->send(std::make_shared<std::string>(ack));

    // Notify existing room members
    json notify_data = {{"room_id", room_id}, {"user_id", user_id}};
    auto notify = json_utils::make_response("user_joined_room", notify_data).dump();
    broadcast_to_conversation(room_id, notify, user_id);
    Logger::info("User {} joined room {}", user_id, room_id);
    return true;
}

bool ChatManager::handle_leave_room(const std::string& room_id,
                                    const std::string& user_id,
                                    const std::string& session_id) {
    if (!db_mgr_->leave_room(room_id, user_id)) {
        auto err = json_utils::make_error("leave_failed", "Could not leave room").dump();
        auto sess = client_mgr_->get_session(session_id);
        if (sess) sess->send(std::make_shared<std::string>(err));
        return false;
    }

    // Confirm to leaver
    json ack_data = {{"room_id", room_id}};
    auto ack = json_utils::make_response("room_left", ack_data).dump();
    auto sess = client_mgr_->get_session(session_id);
    if (sess) sess->send(std::make_shared<std::string>(ack));

    // Notify remaining members
    json notify_data = {{"room_id", room_id}, {"user_id", user_id}};
    auto notify = json_utils::make_response("user_left_room", notify_data).dump();
    broadcast_to_conversation(room_id, notify, user_id);
    Logger::info("User {} left room {}", user_id, room_id);
    return true;
}

// ── Message operations ────────────────────────────────────────────────────────

bool ChatManager::handle_chat_message(const std::string& conversation_id,
                                      const std::string& sender_id,
                                      const std::string& content,
                                      const std::string& session_id) {
    // Authorization: verify membership before persisting
    if (!db_mgr_->is_conversation_member(conversation_id, sender_id)) {
        auto err = json_utils::make_error("not_member",
                                          "You are not a member of this conversation").dump();
        auto sess = client_mgr_->get_session(session_id);
        if (sess) sess->send(std::make_shared<std::string>(err));
        return false;
    }

    auto msg_opt = db_mgr_->save_message(conversation_id, sender_id, content);
    if (!msg_opt) {
        auto err = json_utils::make_error("save_failed", "Failed to persist message").dump();
        auto sess = client_mgr_->get_session(session_id);
        if (sess) sess->send(std::make_shared<std::string>(err));
        return false;
    }

    const auto& msg = *msg_opt;
    json payload = {
        {"id",              msg.id},
        {"conversation_id", msg.conversation_id},
        {"sender_id",       msg.sender_id},
        {"sender_username", msg.sender_username},
        {"sender_display",  msg.sender_display_name},
        {"content",         msg.content},
        {"created_at",      msg.created_at}
    };
    auto notification = json_utils::make_response("new_message", payload).dump();
    broadcast_to_conversation(conversation_id, notification);
    Logger::debug("Message {} saved in conversation {}", msg.id, conversation_id);
    return true;
}

bool ChatManager::handle_private_message(const std::string& recipient_user_id,
                                         const std::string& sender_id,
                                         const std::string& content,
                                         const std::string& session_id) {
    auto conv_opt = db_mgr_->get_or_create_direct_conversation(sender_id, recipient_user_id);
    if (!conv_opt) {
        auto err = json_utils::make_error("conv_failed",
                                          "Failed to establish direct conversation").dump();
        auto sess = client_mgr_->get_session(session_id);
        if (sess) sess->send(std::make_shared<std::string>(err));
        return false;
    }
    return handle_chat_message(conv_opt->id, sender_id, content, session_id);
}

// ── History ───────────────────────────────────────────────────────────────────

bool ChatManager::handle_load_history(const std::string& conversation_id,
                                      const std::string& user_id,
                                      const std::string& session_id,
                                      int limit,
                                      const std::string& before_id) {
    if (!db_mgr_->is_conversation_member(conversation_id, user_id)) {
        auto err = json_utils::make_error("not_member",
                                          "You are not a member of this conversation").dump();
        auto sess = client_mgr_->get_session(session_id);
        if (sess) sess->send(std::make_shared<std::string>(err));
        return false;
    }

    auto messages = db_mgr_->get_messages(conversation_id, limit, before_id);
    json msgs_arr = json::array();
    for (const auto& m : messages) {
        msgs_arr.push_back({
            {"id",              m.id},
            {"conversation_id", m.conversation_id},
            {"sender_id",       m.sender_id},
            {"sender_username", m.sender_username},
            {"sender_display",  m.sender_display_name},
            {"content",         m.content},
            {"created_at",      m.created_at}
        });
    }

    json data = {
        {"conversation_id", conversation_id},
        {"messages",        msgs_arr},
        {"has_more",        (int)messages.size() == limit}
    };
    auto response = json_utils::make_response("history", data).dump();
    auto sess = client_mgr_->get_session(session_id);
    if (sess) sess->send(std::make_shared<std::string>(response));
    return true;
}

// ── Typing indicators ─────────────────────────────────────────────────────────

void ChatManager::handle_typing_start(const std::string& conversation_id,
                                      const std::string& user_id,
                                      const std::string& username) {
    json payload = {
        {"conversation_id", conversation_id},
        {"user_id",         user_id},
        {"username",        username}
    };
    auto notification = json_utils::make_response("typing_start", payload).dump();
    broadcast_to_conversation(conversation_id, notification, user_id);
}

void ChatManager::handle_typing_stop(const std::string& conversation_id,
                                     const std::string& user_id) {
    json payload = {
        {"conversation_id", conversation_id},
        {"user_id",         user_id}
    };
    auto notification = json_utils::make_response("typing_stop", payload).dump();
    broadcast_to_conversation(conversation_id, notification, user_id);
}

// ── Private helpers ───────────────────────────────────────────────────────────

void ChatManager::broadcast_to_conversation(const std::string& conversation_id,
                                            const std::string& json_payload,
                                            const std::string& exclude_user_id) {
    // Resolve conversation members from DB
    auto members = db_mgr_->get_room_members(conversation_id);  // works for rooms
    if (members.empty()) {
        // For direct conversations, fetch member list differently
        // (Phase 2 will add get_conversation_members to DatabaseManager)
        Logger::debug("broadcast_to_conversation: member resolution pending Phase 2 for DMs.");
    }

    auto msg_ptr = std::make_shared<std::string>(json_payload);
    for (const auto& member : members) {
        if (member.id == exclude_user_id) continue;
        client_mgr_->send_to_user(member.id, msg_ptr);
    }
}

} // namespace connectx

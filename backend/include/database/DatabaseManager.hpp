#pragma once

#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>

namespace pqxx { class connection; }

namespace connectx {

struct UserProfile {
    std::string id;
    std::string username;
    std::string display_name;
    std::string avatar_url;
    std::string created_at;
};

struct Message {
    std::string id;
    std::string conversation_id;
    std::string sender_id;
    std::string content;
    std::string created_at;
    // Populated by joins
    std::string sender_username;
    std::string sender_display_name;
};

struct ChatRoom {
    std::string id;
    std::string name;
    std::string description;
    std::string created_by;
    std::string created_at;
};

struct Conversation {
    std::string id;
    std::string type;   // "room" | "direct"
    std::string created_at;
};

/**
 * @brief Thread-safe database access layer.
 *
 * Uses libpqxx parameterized queries against Supabase PostgreSQL when DATABASE_URL
 * is available. Transparently falls back to an in-memory concurrent store when running
 * in standalone/local demo mode without a live database connection.
 */
class DatabaseManager {
public:
    DatabaseManager();
    ~DatabaseManager();

    /** Connect using the DATABASE_URL environment variable. */
    bool connect();

    bool is_connected() const;

    // ── Users / Profiles ───────────────────────────────────────────────────

    std::optional<UserProfile> get_profile(const std::string& user_id);
    bool                       upsert_profile(const UserProfile& profile);
    std::optional<UserProfile> get_profile_by_username(const std::string& username);
    std::vector<UserProfile>   search_users(const std::string& query, int limit = 20);

    // ── Rooms ──────────────────────────────────────────────────────────────

    std::optional<ChatRoom>    create_room(const std::string& name,
                                           const std::string& description,
                                           const std::string& created_by);
    std::vector<ChatRoom>      list_rooms();
    std::optional<ChatRoom>    get_room(const std::string& room_id);

    bool join_room(const std::string& room_id, const std::string& user_id);
    bool leave_room(const std::string& room_id, const std::string& user_id);
    bool is_room_member(const std::string& room_id, const std::string& user_id);
    std::vector<UserProfile> get_room_members(const std::string& room_id);

    // ── Conversations (direct / room) ──────────────────────────────────────

    std::optional<Conversation> get_or_create_direct_conversation(
        const std::string& user_id_a, const std::string& user_id_b);
    bool is_conversation_member(const std::string& conversation_id,
                                const std::string& user_id);
    std::vector<Conversation> get_conversations_for_user(const std::string& user_id);

    // ── Messages ───────────────────────────────────────────────────────────

    std::optional<Message> save_message(const std::string& conversation_id,
                                        const std::string& sender_id,
                                        const std::string& content);
    std::vector<Message>   get_messages(const std::string& conversation_id,
                                        int limit = 50,
                                        const std::string& before_id = "");

    bool mark_read(const std::string& message_id, const std::string& user_id);
    int  unread_count(const std::string& conversation_id,
                      const std::string& user_id);

private:
    std::string              connection_string_;
    std::unique_ptr<pqxx::connection> conn_;
    mutable std::mutex       mutex_;

    std::unique_ptr<pqxx::connection> make_connection();

    // In-memory fallback structures
    std::unordered_map<std::string, UserProfile>                   mem_profiles_;
    std::unordered_map<std::string, ChatRoom>                      mem_rooms_;
    std::unordered_map<std::string, std::unordered_set<std::string>> mem_room_members_; // room_id -> user_ids
    std::unordered_map<std::string, Conversation>                  mem_conversations_;
    std::unordered_map<std::string, std::unordered_set<std::string>> mem_conv_members_; // conv_id -> user_ids
    std::unordered_map<std::string, std::vector<Message>>          mem_messages_;     // conv_id -> messages
    std::unordered_map<std::string, std::unordered_set<std::string>> mem_reads_;        // msg_id -> user_ids who read

    void init_default_data();
};

} // namespace connectx

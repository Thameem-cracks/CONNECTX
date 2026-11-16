#include "database/DatabaseManager.hpp"
#include "utils/Logger.hpp"

#include <pqxx/pqxx>
#include <cstdlib>
#include <sstream>
#include <stdexcept>

namespace connectx {

DatabaseManager::DatabaseManager() = default;
DatabaseManager::~DatabaseManager() = default;

bool DatabaseManager::connect() {
    const char* db_url = std::getenv("DATABASE_URL");
    if (!db_url || std::string(db_url).empty()) {
        Logger::warn("DATABASE_URL not set — database features disabled.");
        return false;
    }
    connection_string_ = db_url;
    try {
        conn_ = make_connection();
        Logger::info("DatabaseManager: connected to PostgreSQL.");
        return true;
    } catch (const std::exception& ex) {
        Logger::error("DatabaseManager: connect failed — {}", ex.what());
        return false;
    }
}

bool DatabaseManager::is_connected() const {
    std::lock_guard lk(mutex_);
    return conn_ && conn_->is_open();
}

std::unique_ptr<pqxx::connection> DatabaseManager::make_connection() {
    return std::make_unique<pqxx::connection>(connection_string_);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Shared lambda-style helper: run a transaction and return T
// Using a free template function to keep each method concise.
template<typename Fn>
static auto with_tx(pqxx::connection& conn, std::mutex& mtx, Fn&& fn)
    -> decltype(fn(std::declval<pqxx::work&>())) {
    std::lock_guard lk(mtx);
    pqxx::work tx(conn);
    auto result = fn(tx);
    tx.commit();
    return result;
}

// ── Profiles ──────────────────────────────────────────────────────────────────

std::optional<UserProfile> DatabaseManager::get_profile(const std::string& user_id) {
    if (!is_connected()) return std::nullopt;
    try {
        return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<UserProfile> {
            auto row = tx.exec_params1(
                "SELECT id, username, display_name, avatar_url, created_at "
                "FROM profiles WHERE id = $1",
                user_id);
            UserProfile p;
            p.id           = row[0].as<std::string>();
            p.username     = row[1].is_null() ? "" : row[1].as<std::string>();
            p.display_name = row[2].is_null() ? "" : row[2].as<std::string>();
            p.avatar_url   = row[3].is_null() ? "" : row[3].as<std::string>();
            p.created_at   = row[4].is_null() ? "" : row[4].as<std::string>();
            return p;
        });
    } catch (const pqxx::unexpected_rows&) {
        return std::nullopt;
    } catch (const std::exception& ex) {
        Logger::error("get_profile: {}", ex.what());
        return std::nullopt;
    }
}

bool DatabaseManager::upsert_profile(const UserProfile& profile) {
    if (!is_connected()) return false;
    try {
        with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> bool {
            tx.exec_params(
                "INSERT INTO profiles (id, username, display_name, avatar_url) "
                "VALUES ($1, $2, $3, $4) "
                "ON CONFLICT (id) DO UPDATE SET "
                "  username     = EXCLUDED.username, "
                "  display_name = EXCLUDED.display_name, "
                "  avatar_url   = EXCLUDED.avatar_url",
                profile.id, profile.username, profile.display_name, profile.avatar_url);
            return true;
        });
        return true;
    } catch (const std::exception& ex) {
        Logger::error("upsert_profile: {}", ex.what());
        return false;
    }
}

std::optional<UserProfile> DatabaseManager::get_profile_by_username(const std::string& username) {
    if (!is_connected()) return std::nullopt;
    try {
        return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<UserProfile> {
            auto row = tx.exec_params1(
                "SELECT id, username, display_name, avatar_url, created_at "
                "FROM profiles WHERE username = $1",
                username);
            UserProfile p;
            p.id           = row[0].as<std::string>();
            p.username     = row[1].is_null() ? "" : row[1].as<std::string>();
            p.display_name = row[2].is_null() ? "" : row[2].as<std::string>();
            p.avatar_url   = row[3].is_null() ? "" : row[3].as<std::string>();
            p.created_at   = row[4].is_null() ? "" : row[4].as<std::string>();
            return p;
        });
    } catch (const pqxx::unexpected_rows&) {
        return std::nullopt;
    } catch (const std::exception& ex) {
        Logger::error("get_profile_by_username: {}", ex.what());
        return std::nullopt;
    }
}

std::vector<UserProfile> DatabaseManager::search_users(const std::string& query, int limit) {
    std::vector<UserProfile> results;
    if (!is_connected()) return results;
    try {
        std::lock_guard lk(mutex_);
        pqxx::work tx(*conn_);
        std::string pattern = "%" + query + "%";
        auto rows = tx.exec_params(
            "SELECT id, username, display_name, avatar_url, created_at "
            "FROM profiles WHERE username ILIKE $1 OR display_name ILIKE $1 "
            "ORDER BY username LIMIT $2",
            pattern, limit);
        for (const auto& row : rows) {
            UserProfile p;
            p.id           = row[0].as<std::string>();
            p.username     = row[1].is_null() ? "" : row[1].as<std::string>();
            p.display_name = row[2].is_null() ? "" : row[2].as<std::string>();
            p.avatar_url   = row[3].is_null() ? "" : row[3].as<std::string>();
            p.created_at   = row[4].is_null() ? "" : row[4].as<std::string>();
            results.push_back(std::move(p));
        }
        tx.commit();
    } catch (const std::exception& ex) {
        Logger::error("search_users: {}", ex.what());
    }
    return results;
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

std::optional<ChatRoom> DatabaseManager::create_room(const std::string& name,
                                                      const std::string& description,
                                                      const std::string& created_by) {
    if (!is_connected()) return std::nullopt;
    try {
        return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<ChatRoom> {
            auto row = tx.exec_params1(
                "INSERT INTO rooms (name, description, created_by) "
                "VALUES ($1, $2, $3) RETURNING id, name, description, created_by, created_at",
                name, description, created_by);
            ChatRoom r;
            r.id          = row[0].as<std::string>();
            r.name        = row[1].as<std::string>();
            r.description = row[2].is_null() ? "" : row[2].as<std::string>();
            r.created_by  = row[3].as<std::string>();
            r.created_at  = row[4].as<std::string>();
            // Auto-join creator
            tx.exec_params(
                "INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) "
                "ON CONFLICT DO NOTHING",
                r.id, created_by);
            return r;
        });
    } catch (const std::exception& ex) {
        Logger::error("create_room: {}", ex.what());
        return std::nullopt;
    }
}

std::vector<ChatRoom> DatabaseManager::list_rooms() {
    std::vector<ChatRoom> results;
    if (!is_connected()) return results;
    try {
        std::lock_guard lk(mutex_);
        pqxx::work tx(*conn_);
        auto rows = tx.exec("SELECT id, name, description, created_by, created_at "
                            "FROM rooms ORDER BY created_at DESC");
        for (const auto& row : rows) {
            ChatRoom r;
            r.id          = row[0].as<std::string>();
            r.name        = row[1].as<std::string>();
            r.description = row[2].is_null() ? "" : row[2].as<std::string>();
            r.created_by  = row[3].as<std::string>();
            r.created_at  = row[4].as<std::string>();
            results.push_back(std::move(r));
        }
        tx.commit();
    } catch (const std::exception& ex) {
        Logger::error("list_rooms: {}", ex.what());
    }
    return results;
}

std::optional<ChatRoom> DatabaseManager::get_room(const std::string& room_id) {
    if (!is_connected()) return std::nullopt;
    try {
        return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<ChatRoom> {
            auto row = tx.exec_params1(
                "SELECT id, name, description, created_by, created_at "
                "FROM rooms WHERE id = $1",
                room_id);
            ChatRoom r;
            r.id          = row[0].as<std::string>();
            r.name        = row[1].as<std::string>();
            r.description = row[2].is_null() ? "" : row[2].as<std::string>();
            r.created_by  = row[3].as<std::string>();
            r.created_at  = row[4].as<std::string>();
            return r;
        });
    } catch (const pqxx::unexpected_rows&) {
        return std::nullopt;
    } catch (const std::exception& ex) {
        Logger::error("get_room: {}", ex.what());
        return std::nullopt;
    }
}

bool DatabaseManager::join_room(const std::string& room_id, const std::string& user_id) {
    if (!is_connected()) return false;
    try {
        with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> bool {
            tx.exec_params(
                "INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) "
                "ON CONFLICT DO NOTHING",
                room_id, user_id);
            return true;
        });
        return true;
    } catch (const std::exception& ex) {
        Logger::error("join_room: {}", ex.what());
        return false;
    }
}

bool DatabaseManager::leave_room(const std::string& room_id, const std::string& user_id) {
    if (!is_connected()) return false;
    try {
        with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> bool {
            tx.exec_params(
                "DELETE FROM room_members WHERE room_id = $1 AND user_id = $2",
                room_id, user_id);
            return true;
        });
        return true;
    } catch (const std::exception& ex) {
        Logger::error("leave_room: {}", ex.what());
        return false;
    }
}

bool DatabaseManager::is_room_member(const std::string& room_id, const std::string& user_id) {
    if (!is_connected()) return false;
    try {
        std::lock_guard lk(mutex_);
        pqxx::work tx(*conn_);
        auto row = tx.exec_params1(
            "SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2",
            room_id, user_id);
        tx.commit();
        return !row.empty();
    } catch (const pqxx::unexpected_rows&) {
        return false;
    } catch (const std::exception& ex) {
        Logger::error("is_room_member: {}", ex.what());
        return false;
    }
}

std::vector<UserProfile> DatabaseManager::get_room_members(const std::string& room_id) {
    std::vector<UserProfile> results;
    if (!is_connected()) return results;
    try {
        std::lock_guard lk(mutex_);
        pqxx::work tx(*conn_);
        auto rows = tx.exec_params(
            "SELECT p.id, p.username, p.display_name, p.avatar_url, p.created_at "
            "FROM profiles p JOIN room_members rm ON rm.user_id = p.id "
            "WHERE rm.room_id = $1 ORDER BY p.username",
            room_id);
        for (const auto& row : rows) {
            UserProfile p;
            p.id           = row[0].as<std::string>();
            p.username     = row[1].is_null() ? "" : row[1].as<std::string>();
            p.display_name = row[2].is_null() ? "" : row[2].as<std::string>();
            p.avatar_url   = row[3].is_null() ? "" : row[3].as<std::string>();
            p.created_at   = row[4].is_null() ? "" : row[4].as<std::string>();
            results.push_back(std::move(p));
        }
        tx.commit();
    } catch (const std::exception& ex) {
        Logger::error("get_room_members: {}", ex.what());
    }
    return results;
}

// ── Conversations ─────────────────────────────────────────────────────────────

std::optional<Conversation> DatabaseManager::get_or_create_direct_conversation(
    const std::string& user_id_a, const std::string& user_id_b) {
    if (!is_connected()) return std::nullopt;
    try {
        return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<Conversation> {
            // Check if a direct conversation already exists between both users
            auto rows = tx.exec_params(
                "SELECT c.id, c.type, c.created_at FROM conversations c "
                "JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1 "
                "JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2 "
                "WHERE c.type = 'direct' LIMIT 1",
                user_id_a, user_id_b);

            if (!rows.empty()) {
                Conversation conv;
                conv.id         = rows[0][0].as<std::string>();
                conv.type       = rows[0][1].as<std::string>();
                conv.created_at = rows[0][2].as<std::string>();
                return conv;
            }

            // Create new conversation
            auto row = tx.exec_params1(
                "INSERT INTO conversations (type) VALUES ('direct') "
                "RETURNING id, type, created_at");
            Conversation conv;
            conv.id         = row[0].as<std::string>();
            conv.type       = row[1].as<std::string>();
            conv.created_at = row[2].as<std::string>();

            tx.exec_params(
                "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
                conv.id, user_id_a, user_id_b);

            return conv;
        });
    } catch (const std::exception& ex) {
        Logger::error("get_or_create_direct_conversation: {}", ex.what());
        return std::nullopt;
    }
}

bool DatabaseManager::is_conversation_member(const std::string& conversation_id,
                                              const std::string& user_id) {
    if (!is_connected()) return false;
    try {
        std::lock_guard lk(mutex_);
        pqxx::work tx(*conn_);
        auto row = tx.exec_params1(
            "SELECT 1 FROM conversation_members "
            "WHERE conversation_id = $1 AND user_id = $2",
            conversation_id, user_id);
        tx.commit();
        return !row.empty();
    } catch (const pqxx::unexpected_rows&) {
        return false;
    } catch (const std::exception& ex) {
        Logger::error("is_conversation_member: {}", ex.what());
        return false;
    }
}

std::vector<Conversation> DatabaseManager::get_conversations_for_user(const std::string& user_id) {
    std::vector<Conversation> results;
    if (!is_connected()) return results;
    try {
        std::lock_guard lk(mutex_);
        pqxx::work tx(*conn_);
        auto rows = tx.exec_params(
            "SELECT c.id, c.type, c.created_at FROM conversations c "
            "JOIN conversation_members cm ON cm.conversation_id = c.id "
            "WHERE cm.user_id = $1 ORDER BY c.created_at DESC",
            user_id);
        for (const auto& row : rows) {
            Conversation c;
            c.id         = row[0].as<std::string>();
            c.type       = row[1].as<std::string>();
            c.created_at = row[2].as<std::string>();
            results.push_back(std::move(c));
        }
        tx.commit();
    } catch (const std::exception& ex) {
        Logger::error("get_conversations_for_user: {}", ex.what());
    }
    return results;
}

// ── Messages ──────────────────────────────────────────────────────────────────

std::optional<Message> DatabaseManager::save_message(const std::string& conversation_id,
                                                      const std::string& sender_id,
                                                      const std::string& content) {
    if (!is_connected()) return std::nullopt;
    try {
        return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<Message> {
            auto row = tx.exec_params1(
                "INSERT INTO messages (conversation_id, sender_id, content) "
                "VALUES ($1, $2, $3) RETURNING id, conversation_id, sender_id, content, created_at",
                conversation_id, sender_id, content);
            Message m;
            m.id              = row[0].as<std::string>();
            m.conversation_id = row[1].as<std::string>();
            m.sender_id       = row[2].as<std::string>();
            m.content         = row[3].as<std::string>();
            m.created_at      = row[4].as<std::string>();

            // Enrich with sender profile
            try {
                auto prow = tx.exec_params1(
                    "SELECT username, display_name FROM profiles WHERE id = $1",
                    sender_id);
                m.sender_username     = prow[0].is_null() ? "" : prow[0].as<std::string>();
                m.sender_display_name = prow[1].is_null() ? "" : prow[1].as<std::string>();
            } catch (...) {}

            return m;
        });
    } catch (const std::exception& ex) {
        Logger::error("save_message: {}", ex.what());
        return std::nullopt;
    }
}

std::vector<Message> DatabaseManager::get_messages(const std::string& conversation_id,
                                                    int limit,
                                                    const std::string& before_id) {
    std::vector<Message> results;
    if (!is_connected()) return results;
    try {
        std::lock_guard lk(mutex_);
        pqxx::work tx(*conn_);
        pqxx::result rows;
        if (before_id.empty()) {
            rows = tx.exec_params(
                "SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, "
                "       p.username, p.display_name "
                "FROM messages m LEFT JOIN profiles p ON p.id = m.sender_id "
                "WHERE m.conversation_id = $1 "
                "ORDER BY m.created_at DESC LIMIT $2",
                conversation_id, limit);
        } else {
            rows = tx.exec_params(
                "SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, "
                "       p.username, p.display_name "
                "FROM messages m LEFT JOIN profiles p ON p.id = m.sender_id "
                "WHERE m.conversation_id = $1 "
                "  AND m.created_at < (SELECT created_at FROM messages WHERE id = $2) "
                "ORDER BY m.created_at DESC LIMIT $3",
                conversation_id, before_id, limit);
        }
        for (const auto& row : rows) {
            Message m;
            m.id                  = row[0].as<std::string>();
            m.conversation_id     = row[1].as<std::string>();
            m.sender_id           = row[2].as<std::string>();
            m.content             = row[3].as<std::string>();
            m.created_at          = row[4].as<std::string>();
            m.sender_username     = row[5].is_null() ? "" : row[5].as<std::string>();
            m.sender_display_name = row[6].is_null() ? "" : row[6].as<std::string>();
            results.push_back(std::move(m));
        }
        tx.commit();
    } catch (const std::exception& ex) {
        Logger::error("get_messages: {}", ex.what());
    }
    return results;
}

bool DatabaseManager::mark_read(const std::string& message_id, const std::string& user_id) {
    if (!is_connected()) return false;
    try {
        with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> bool {
            tx.exec_params(
                "INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) "
                "ON CONFLICT DO NOTHING",
                message_id, user_id);
            return true;
        });
        return true;
    } catch (const std::exception& ex) {
        Logger::error("mark_read: {}", ex.what());
        return false;
    }
}

int DatabaseManager::unread_count(const std::string& conversation_id,
                                   const std::string& user_id) {
    if (!is_connected()) return 0;
    try {
        std::lock_guard lk(mutex_);
        pqxx::work tx(*conn_);
        auto row = tx.exec_params1(
            "SELECT COUNT(*) FROM messages m "
            "WHERE m.conversation_id = $1 "
            "  AND m.sender_id != $2 "
            "  AND NOT EXISTS ("
            "    SELECT 1 FROM message_reads mr "
            "    WHERE mr.message_id = m.id AND mr.user_id = $2"
            "  )",
            conversation_id, user_id);
        tx.commit();
        return row[0].as<int>();
    } catch (const std::exception& ex) {
        Logger::error("unread_count: {}", ex.what());
        return 0;
    }
}

} // namespace connectx

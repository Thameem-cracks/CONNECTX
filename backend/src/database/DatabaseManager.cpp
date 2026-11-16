#include "database/DatabaseManager.hpp"
#include "utils/Logger.hpp"

#include <pqxx/pqxx>
#include <cstdlib>
#include <sstream>
#include <stdexcept>
#include <chrono>
#include <iomanip>
#include <algorithm>

namespace connectx {

static std::string current_iso_time() {
    auto now = std::chrono::system_clock::now();
    auto t   = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
#ifdef _WIN32
    gmtime_s(&tm, &t);
#else
    gmtime_r(&t, &tm);
#endif
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

static std::string generate_id() {
    static uint64_t counter = 1000;
    auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    return "id-" + std::to_string(now) + "-" + std::to_string(++counter);
}

DatabaseManager::DatabaseManager() {
    init_default_data();
}

DatabaseManager::~DatabaseManager() = default;

void DatabaseManager::init_default_data() {
    std::lock_guard lk(mutex_);

    // Seed default public rooms
    ChatRoom r1{"general", "general", "General discussion for everyone on ConnectX", "system", current_iso_time()};
    ChatRoom r2{"tech-talk", "tech-talk", "C++ socket programming, Boost.Asio & networking", "system", current_iso_time()};
    ChatRoom r3{"announcements", "announcements", "System news and server updates", "system", current_iso_time()};

    mem_rooms_[r1.id] = r1;
    mem_rooms_[r2.id] = r2;
    mem_rooms_[r3.id] = r3;

    // Seed default conversations for these rooms
    mem_conversations_[r1.id] = Conversation{r1.id, "room", r1.created_at};
    mem_conversations_[r2.id] = Conversation{r2.id, "room", r2.created_at};
    mem_conversations_[r3.id] = Conversation{r3.id, "room", r3.created_at};
}

bool DatabaseManager::connect() {
    const char* db_url = std::getenv("DATABASE_URL");
    if (!db_url || std::string(db_url).empty()) {
        Logger::info("DATABASE_URL not set — running with in-memory persistence store.");
        return false;
    }
    connection_string_ = db_url;
    try {
        conn_ = make_connection();
        Logger::info("DatabaseManager: successfully connected to Supabase PostgreSQL.");
        return true;
    } catch (const std::exception& ex) {
        Logger::warn("DatabaseManager: PostgreSQL connect failed ({}) — using in-memory fallback.", ex.what());
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
    if (is_connected()) {
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
        } catch (...) {}
    }

    // In-memory fallback
    std::lock_guard lk(mutex_);
    auto it = mem_profiles_.find(user_id);
    if (it != mem_profiles_.end()) return it->second;
    return std::nullopt;
}

bool DatabaseManager::upsert_profile(const UserProfile& profile) {
    if (is_connected()) {
        try {
            with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> bool {
                tx.exec_params(
                    "INSERT INTO profiles (id, username, display_name, avatar_url) "
                    "VALUES ($1, $2, $3, $4) "
                    "ON CONFLICT (id) DO UPDATE SET "
                    "  username     = EXCLUDED.username, "
                    "  display_name = EXCLUDED.display_name, "
                    "  avatar_url   = EXCLUDED.avatar_url, "
                    "  updated_at   = NOW()",
                    profile.id, profile.username, profile.display_name, profile.avatar_url);
                return true;
            });
        } catch (const std::exception& ex) {
            Logger::warn("upsert_profile PG error: {}", ex.what());
        }
    }

    std::lock_guard lk(mutex_);
    mem_profiles_[profile.id] = profile;
    return true;
}

std::optional<UserProfile> DatabaseManager::get_profile_by_username(const std::string& username) {
    if (is_connected()) {
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
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    for (const auto& [id, p] : mem_profiles_) {
        if (p.username == username) return p;
    }
    return std::nullopt;
}

std::vector<UserProfile> DatabaseManager::search_users(const std::string& query, int limit) {
    std::vector<UserProfile> results;
    if (is_connected()) {
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
            return results;
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    for (const auto& [id, p] : mem_profiles_) {
        if (query.empty() || p.username.find(query) != std::string::npos ||
            p.display_name.find(query) != std::string::npos) {
            results.push_back(p);
            if ((int)results.size() >= limit) break;
        }
    }
    return results;
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

std::optional<ChatRoom> DatabaseManager::create_room(const std::string& name,
                                                      const std::string& description,
                                                      const std::string& created_by) {
    if (is_connected()) {
        try {
            return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<ChatRoom> {
                auto row = tx.exec_params1(
                    "INSERT INTO chat_rooms (name, description, created_by) "
                    "VALUES ($1, $2, $3) RETURNING id, name, description, created_by, created_at",
                    name, description, created_by.empty() ? nullptr : created_by.c_str());
                ChatRoom r;
                r.id          = row[0].as<std::string>();
                r.name        = row[1].as<std::string>();
                r.description = row[2].is_null() ? "" : row[2].as<std::string>();
                r.created_by  = row[3].is_null() ? "" : row[3].as<std::string>();
                r.created_at  = row[4].as<std::string>();

                // Auto-join creator if user provided
                if (!created_by.empty()) {
                    tx.exec_params(
                        "INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) "
                        "ON CONFLICT DO NOTHING",
                        r.id, created_by);
                }
                return r;
            });
        } catch (const std::exception& ex) {
            Logger::warn("create_room PG error: {}", ex.what());
        }
    }

    std::lock_guard lk(mutex_);
    std::string rid = name;
    std::replace(rid.begin(), rid.end(), ' ', '-');
    std::transform(rid.begin(), rid.end(), rid.begin(), ::tolower);
    if (mem_rooms_.find(rid) != mem_rooms_.end()) {
        rid = generate_id();
    }

    ChatRoom r{rid, name, description, created_by, current_iso_time()};
    mem_rooms_[r.id] = r;
    mem_conversations_[r.id] = Conversation{r.id, "room", r.created_at};
    if (!created_by.empty()) {
        mem_room_members_[r.id].insert(created_by);
        mem_conv_members_[r.id].insert(created_by);
    }
    return r;
}

std::vector<ChatRoom> DatabaseManager::list_rooms() {
    std::vector<ChatRoom> results;
    if (is_connected()) {
        try {
            std::lock_guard lk(mutex_);
            pqxx::work tx(*conn_);
            auto rows = tx.exec("SELECT id, name, description, created_by, created_at "
                                "FROM chat_rooms ORDER BY created_at DESC");
            for (const auto& row : rows) {
                ChatRoom r;
                r.id          = row[0].as<std::string>();
                r.name        = row[1].as<std::string>();
                r.description = row[2].is_null() ? "" : row[2].as<std::string>();
                r.created_by  = row[3].is_null() ? "" : row[3].as<std::string>();
                r.created_at  = row[4].as<std::string>();
                results.push_back(std::move(r));
            }
            tx.commit();
            return results;
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    for (const auto& [id, r] : mem_rooms_) {
        results.push_back(r);
    }
    return results;
}

std::optional<ChatRoom> DatabaseManager::get_room(const std::string& room_id) {
    if (is_connected()) {
        try {
            return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<ChatRoom> {
                auto row = tx.exec_params1(
                    "SELECT id, name, description, created_by, created_at "
                    "FROM chat_rooms WHERE id = $1",
                    room_id);
                ChatRoom r;
                r.id          = row[0].as<std::string>();
                r.name        = row[1].as<std::string>();
                r.description = row[2].is_null() ? "" : row[2].as<std::string>();
                r.created_by  = row[3].is_null() ? "" : row[3].as<std::string>();
                r.created_at  = row[4].as<std::string>();
                return r;
            });
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    auto it = mem_rooms_.find(room_id);
    if (it != mem_rooms_.end()) return it->second;
    return std::nullopt;
}

bool DatabaseManager::join_room(const std::string& room_id, const std::string& user_id) {
    if (is_connected()) {
        try {
            with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> bool {
                tx.exec_params(
                    "INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) "
                    "ON CONFLICT DO NOTHING",
                    room_id, user_id);
                return true;
            });
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    mem_room_members_[room_id].insert(user_id);
    mem_conv_members_[room_id].insert(user_id);
    return true;
}

bool DatabaseManager::leave_room(const std::string& room_id, const std::string& user_id) {
    if (is_connected()) {
        try {
            with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> bool {
                tx.exec_params(
                    "DELETE FROM room_members WHERE room_id = $1 AND user_id = $2",
                    room_id, user_id);
                return true;
            });
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    mem_room_members_[room_id].erase(user_id);
    mem_conv_members_[room_id].erase(user_id);
    return true;
}

bool DatabaseManager::is_room_member(const std::string& room_id, const std::string& user_id) {
    // Default public rooms are open to all authenticated users
    if (room_id == "general" || room_id == "tech-talk" || room_id == "announcements") {
        return true;
    }

    if (is_connected()) {
        try {
            std::lock_guard lk(mutex_);
            pqxx::work tx(*conn_);
            auto row = tx.exec_params1(
                "SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2",
                room_id, user_id);
            tx.commit();
            return !row.empty();
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    auto it = mem_room_members_.find(room_id);
    if (it != mem_room_members_.end()) {
        return it->second.find(user_id) != it->second.end();
    }
    return true; // allow open participation in in-memory mode
}

std::vector<UserProfile> DatabaseManager::get_room_members(const std::string& room_id) {
    std::vector<UserProfile> results;
    if (is_connected()) {
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
            return results;
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    auto it = mem_room_members_.find(room_id);
    if (it != mem_room_members_.end()) {
        for (const auto& uid : it->second) {
            auto pit = mem_profiles_.find(uid);
            if (pit != mem_profiles_.end()) {
                results.push_back(pit->second);
            } else {
                results.push_back(UserProfile{uid, uid, uid, "", current_iso_time()});
            }
        }
    }
    return results;
}

// ── Conversations ─────────────────────────────────────────────────────────────

std::optional<Conversation> DatabaseManager::get_or_create_direct_conversation(
    const std::string& user_id_a, const std::string& user_id_b) {
    if (is_connected()) {
        try {
            return with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> std::optional<Conversation> {
                auto rows = tx.exec_params(
                    "SELECT c.id, c.conversation_type, c.created_at FROM conversations c "
                    "JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1 "
                    "JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2 "
                    "WHERE c.conversation_type = 'direct' LIMIT 1",
                    user_id_a, user_id_b);

                if (!rows.empty()) {
                    Conversation conv;
                    conv.id         = rows[0][0].as<std::string>();
                    conv.type       = rows[0][1].as<std::string>();
                    conv.created_at = rows[0][2].as<std::string>();
                    return conv;
                }

                auto row = tx.exec_params1(
                    "INSERT INTO conversations (conversation_type) VALUES ('direct') "
                    "RETURNING id, conversation_type, created_at");
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
            Logger::warn("direct conv PG error: {}", ex.what());
        }
    }

    std::lock_guard lk(mutex_);
    std::string cid = "dm-" + (user_id_a < user_id_b ? user_id_a + "-" + user_id_b : user_id_b + "-" + user_id_a);
    auto it = mem_conversations_.find(cid);
    if (it != mem_conversations_.end()) return it->second;

    Conversation c{cid, "direct", current_iso_time()};
    mem_conversations_[cid] = c;
    mem_conv_members_[cid].insert(user_id_a);
    mem_conv_members_[cid].insert(user_id_b);
    return c;
}

bool DatabaseManager::is_conversation_member(const std::string& conversation_id,
                                              const std::string& user_id) {
    if (conversation_id == "general" || conversation_id == "tech-talk" || conversation_id == "announcements") {
        return true;
    }

    if (is_connected()) {
        try {
            std::lock_guard lk(mutex_);
            pqxx::work tx(*conn_);
            auto row = tx.exec_params1(
                "SELECT 1 FROM conversation_members "
                "WHERE conversation_id = $1 AND user_id = $2",
                conversation_id, user_id);
            tx.commit();
            return !row.empty();
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    auto it = mem_conv_members_.find(conversation_id);
    if (it != mem_conv_members_.end()) {
        return it->second.find(user_id) != it->second.end();
    }
    return true;
}

std::vector<Conversation> DatabaseManager::get_conversations_for_user(const std::string& user_id) {
    std::vector<Conversation> results;
    if (is_connected()) {
        try {
            std::lock_guard lk(mutex_);
            pqxx::work tx(*conn_);
            auto rows = tx.exec_params(
                "SELECT c.id, c.conversation_type, c.created_at FROM conversations c "
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
            return results;
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    for (const auto& [cid, c] : mem_conversations_) {
        results.push_back(c);
    }
    return results;
}

// ── Messages ──────────────────────────────────────────────────────────────────

std::optional<Message> DatabaseManager::save_message(const std::string& conversation_id,
                                                      const std::string& sender_id,
                                                      const std::string& content) {
    std::string sender_username, sender_display;
    {
        std::lock_guard lk(mutex_);
        auto it = mem_profiles_.find(sender_id);
        if (it != mem_profiles_.end()) {
            sender_username = it->second.username;
            sender_display  = it->second.display_name;
        }
    }

    if (is_connected()) {
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

                try {
                    auto prow = tx.exec_params1(
                        "SELECT username, display_name FROM profiles WHERE id = $1",
                        sender_id);
                    m.sender_username     = prow[0].is_null() ? "" : prow[0].as<std::string>();
                    m.sender_display_name = prow[1].is_null() ? "" : prow[1].as<std::string>();
                } catch (...) {
                    m.sender_username     = sender_username;
                    m.sender_display_name = sender_display;
                }
                return m;
            });
        } catch (const std::exception& ex) {
            Logger::warn("save_message PG error: {}", ex.what());
        }
    }

    std::lock_guard lk(mutex_);
    Message m;
    m.id                  = generate_id();
    m.conversation_id     = conversation_id;
    m.sender_id           = sender_id;
    m.content             = content;
    m.created_at          = current_iso_time();
    m.sender_username     = sender_username.empty() ? sender_id : sender_username;
    m.sender_display_name = sender_display.empty() ? m.sender_username : sender_display;

    mem_messages_[conversation_id].push_back(m);
    return m;
}

std::vector<Message> DatabaseManager::get_messages(const std::string& conversation_id,
                                                    int limit,
                                                    const std::string& before_id) {
    std::vector<Message> results;
    if (is_connected()) {
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
                    "ORDER BY m.created_at ASC LIMIT $2",
                    conversation_id, limit);
            } else {
                rows = tx.exec_params(
                    "SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at, "
                    "       p.username, p.display_name "
                    "FROM messages m LEFT JOIN profiles p ON p.id = m.sender_id "
                    "WHERE m.conversation_id = $1 "
                    "  AND m.created_at < (SELECT created_at FROM messages WHERE id = $2) "
                    "ORDER BY m.created_at ASC LIMIT $3",
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
            return results;
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    auto it = mem_messages_.find(conversation_id);
    if (it != mem_messages_.end()) {
        const auto& list = it->second;
        if ((int)list.size() <= limit) {
            results = list;
        } else {
            results.assign(list.end() - limit, list.end());
        }
    }
    return results;
}

bool DatabaseManager::mark_read(const std::string& message_id, const std::string& user_id) {
    if (is_connected()) {
        try {
            with_tx(*conn_, mutex_, [&](pqxx::work& tx) -> bool {
                tx.exec_params(
                    "INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) "
                    "ON CONFLICT DO NOTHING",
                    message_id, user_id);
                return true;
            });
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    mem_reads_[message_id].insert(user_id);
    return true;
}

int DatabaseManager::unread_count(const std::string& conversation_id,
                                   const std::string& user_id) {
    if (is_connected()) {
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
        } catch (...) {}
    }

    std::lock_guard lk(mutex_);
    int count = 0;
    auto it = mem_messages_.find(conversation_id);
    if (it != mem_messages_.end()) {
        for (const auto& m : it->second) {
            if (m.sender_id != user_id) {
                auto rit = mem_reads_.find(m.id);
                if (rit == mem_reads_.end() || rit->second.find(user_id) == rit->second.end()) {
                    count++;
                }
            }
        }
    }
    return count;
}

} // namespace connectx

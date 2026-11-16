#include "clients/ClientManager.hpp"
#include "server/Session.hpp"
#include "utils/Logger.hpp"

#include <shared_mutex>
#include <algorithm>

namespace connectx {

void ClientManager::add_session(std::shared_ptr<Session> session) {
    std::unique_lock lk(mutex_);
    const auto& sid = session->session_id();
    sessions_[sid] = session;
    // user_id may be empty until authentication
    if (!session->user_id().empty()) {
        user_sessions_[session->user_id()].push_back(sid);
    }
    Logger::debug("Session added: {} (total={})", sid, sessions_.size());
}

void ClientManager::remove_session(const std::string& session_id) {
    std::unique_lock lk(mutex_);
    auto it = sessions_.find(session_id);
    if (it == sessions_.end()) return;

    const std::string uid = it->second->user_id();
    sessions_.erase(it);

    if (!uid.empty()) {
        auto& vec = user_sessions_[uid];
        vec.erase(std::remove(vec.begin(), vec.end(), session_id), vec.end());
        if (vec.empty()) user_sessions_.erase(uid);
    }
    Logger::debug("Session removed: {} (total={})", session_id, sessions_.size());
}

std::shared_ptr<Session> ClientManager::get_session(const std::string& session_id) const {
    std::shared_lock lk(mutex_);
    auto it = sessions_.find(session_id);
    return it != sessions_.end() ? it->second : nullptr;
}

std::vector<std::shared_ptr<Session>>
ClientManager::get_sessions_for_user(const std::string& user_id) const {
    std::shared_lock lk(mutex_);
    std::vector<std::shared_ptr<Session>> result;
    auto it = user_sessions_.find(user_id);
    if (it == user_sessions_.end()) return result;
    for (const auto& sid : it->second) {
        auto s = sessions_.find(sid);
        if (s != sessions_.end()) result.push_back(s->second);
    }
    return result;
}

void ClientManager::send_to_user(const std::string& user_id,
                                 std::shared_ptr<std::string const> msg) {
    auto sessions = get_sessions_for_user(user_id);
    for (auto& s : sessions) s->send(msg);
}

void ClientManager::broadcast(std::shared_ptr<std::string const> msg) {
    std::shared_lock lk(mutex_);
    for (auto& [_, s] : sessions_) s->send(msg);
}

void ClientManager::send_to_users(const std::vector<std::string>& user_ids,
                                  std::shared_ptr<std::string const> msg) {
    for (const auto& uid : user_ids) send_to_user(uid, msg);
}

std::size_t ClientManager::session_count() const {
    std::shared_lock lk(mutex_);
    return sessions_.size();
}

bool ClientManager::is_user_online(const std::string& user_id) const {
    std::shared_lock lk(mutex_);
    auto it = user_sessions_.find(user_id);
    return it != user_sessions_.end() && !it->second.empty();
}

std::vector<std::string> ClientManager::online_user_ids() const {
    std::shared_lock lk(mutex_);
    std::vector<std::string> result;
    result.reserve(user_sessions_.size());
    for (const auto& [uid, sids] : user_sessions_) {
        if (!sids.empty()) result.push_back(uid);
    }
    return result;
}

} // namespace connectx

#include "server/WebSocketServer.hpp"
#include "server/Session.hpp"
#include "clients/ClientManager.hpp"
#include "chat/ChatManager.hpp"
#include "chat/MessageHandler.hpp"
#include "auth/AuthManager.hpp"
#include "database/DatabaseManager.hpp"
#include "utils/Logger.hpp"

#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/version.hpp>
#include <nlohmann/json.hpp>
#include <thread>
#include <sstream>

namespace connectx {

WebSocketServer::WebSocketServer(unsigned short port, unsigned int thread_count)
    : port_(port)
    , thread_count_(thread_count)
    , ioc_(static_cast<int>(thread_count))
    , acceptor_(ioc_)
    , signals_(ioc_, SIGINT, SIGTERM)
{
    // Set up the acceptor
    tcp::endpoint endpoint(asio::ip::make_address("0.0.0.0"), port_);
    beast::error_code ec;

    acceptor_.open(endpoint.protocol(), ec);
    if (ec) throw std::runtime_error("acceptor open: " + ec.message());

    acceptor_.set_option(asio::socket_base::reuse_address(true), ec);
    if (ec) throw std::runtime_error("acceptor set_option: " + ec.message());

    acceptor_.bind(endpoint, ec);
    if (ec) throw std::runtime_error("acceptor bind: " + ec.message());

    acceptor_.listen(asio::socket_base::max_listen_connections, ec);
    if (ec) throw std::runtime_error("acceptor listen: " + ec.message());
}

WebSocketServer::~WebSocketServer() {
    stop();
}

void WebSocketServer::run() {
    // ── Initialise subsystems ─────────────────────────────────────────────
    db_mgr_      = std::make_shared<DatabaseManager>();
    auth_mgr_    = std::make_shared<AuthManager>(db_mgr_);
    client_mgr_  = std::make_shared<ClientManager>();
    chat_mgr_    = std::make_shared<ChatManager>(client_mgr_, db_mgr_);
    msg_handler_ = std::make_shared<MessageHandler>(client_mgr_, chat_mgr_,
                                                     auth_mgr_, db_mgr_);

    // Connect to database (non-fatal if unavailable at startup)
    if (db_mgr_->connect()) {
        Logger::info("Database connected.");
    } else {
        Logger::warn("Database unavailable – messages will NOT be persisted.");
    }

    // Initialise JWT verifier
    if (!auth_mgr_->initialize()) {
        Logger::warn("Auth not fully configured – authentication will fail.");
    }

    // ── Signal handler ────────────────────────────────────────────────────
    signals_.async_wait([this](beast::error_code, int /*sig*/) {
        Logger::info("Shutdown signal received.");
        stop();
    });

    // ── Start accepting ───────────────────────────────────────────────────
    do_accept();
    Logger::info("Listening on 0.0.0.0:{}", port_);

    // ── Spawn IO worker threads ───────────────────────────────────────────
    workers_.reserve(thread_count_);
    for (unsigned int i = 0; i < thread_count_; ++i) {
        workers_.emplace_back([this] { ioc_.run(); });
    }

    // Block calling thread until io_context stops
    for (auto& t : workers_) {
        if (t.joinable()) t.join();
    }
}

void WebSocketServer::stop() {
    beast::error_code ec;
    acceptor_.close(ec);
    ioc_.stop();
}

void WebSocketServer::do_accept() {
    acceptor_.async_accept(
        asio::make_strand(ioc_),
        beast::bind_front_handler(&WebSocketServer::on_accept, this));
}

void WebSocketServer::on_accept(beast::error_code ec, tcp::socket socket) {
    if (ec) {
        if (ec != asio::error::operation_aborted)
            Logger::error("Accept error: {}", ec.message());
        return;
    }
    Logger::debug("New TCP connection from {}",
                  socket.remote_endpoint().address().to_string());

    // Each session is self-managing via shared_ptr
    auto session = std::make_shared<Session>(
        std::move(socket), client_mgr_, msg_handler_);
    session->start();

    // Continue accepting
    do_accept();
}

} // namespace connectx

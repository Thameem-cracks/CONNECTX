#include "server/Session.hpp"
#include "clients/ClientManager.hpp"
#include "chat/MessageHandler.hpp"
#include "database/DatabaseManager.hpp"
#include "utils/Logger.hpp"

#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>
#include <nlohmann/json.hpp>
#include <sstream>

namespace connectx {

static std::string generate_session_id() {
    boost::uuids::random_generator gen;
    return boost::uuids::to_string(gen());
}

Session::Session(tcp::socket                       socket,
                 std::shared_ptr<ClientManager>    client_mgr,
                 std::shared_ptr<MessageHandler>   msg_handler,
                 std::shared_ptr<DatabaseManager>  db_mgr)
    : ws_(std::move(socket))
    , strand_(asio::make_strand(ws_.get_executor()))
    , client_mgr_(std::move(client_mgr))
    , msg_handler_(std::move(msg_handler))
    , db_mgr_(std::move(db_mgr))
    , session_id_(generate_session_id())
{}

void Session::start() {
    do_http_read();
}

void Session::do_http_read() {
    http_req_ = {};
    http::async_read(
        ws_.next_layer(),
        read_buf_,
        http_req_,
        asio::bind_executor(strand_,
            beast::bind_front_handler(&Session::on_http_read, shared_from_this())));
}

void Session::on_http_read(beast::error_code ec, std::size_t bytes_transferred) {
    boost::ignore_unused(bytes_transferred);

    if (ec == http::error::end_of_stream || ec == asio::error::eof ||
        ec == asio::error::connection_reset) {
        beast::error_code shut_ec;
        ws_.next_layer().socket().shutdown(tcp::socket::shutdown_both, shut_ec);
        return;
    }
    if (ec) {
        Logger::debug("HTTP read error [{}]: {}", session_id_, ec.message());
        return;
    }

    // Check if this is a WebSocket upgrade request
    if (ws::is_upgrade(http_req_)) {
        ws_.set_option(ws::stream_base::timeout::suggested(beast::role_type::server));
        ws_.set_option(ws::stream_base::decorator([](ws::response_type& res) {
            res.set(http::field::server, "ConnectX/1.0 (C++ Boost.Beast)");
            res.set(http::field::access_control_allow_origin, "*");
        }));

        ws_.async_accept(
            http_req_,
            asio::bind_executor(strand_,
                beast::bind_front_handler(&Session::on_accept, shared_from_this())));
        return;
    }

    // Standard HTTP request (e.g. GET /health)
    handle_http_request();
}

void Session::handle_http_request() {
    auto target = std::string(http_req_.target());
    auto version = http_req_.version();
    bool keep_alive = http_req_.keep_alive();

    http::response<http::string_body> res;
    res.version(version);
    res.set(http::field::server, "ConnectX/1.0 (C++ Boost.Beast)");
    res.set(http::field::content_type, "application/json");
    res.set(http::field::access_control_allow_origin, "*");
    res.set(http::field::access_control_allow_methods, "GET, POST, OPTIONS");
    res.set(http::field::access_control_allow_headers, "Content-Type, Authorization");

    if (http_req_.method() == http::verb::options) {
        res.result(http::status::no_content);
        res.keep_alive(keep_alive);
        res.prepare_payload();
    } else if (target == "/health" || target == "/healthz") {
        res.result(http::status::ok);
        res.keep_alive(keep_alive);

        nlohmann::json health_json = {
            {"status", "healthy"},
            {"service", "ConnectX"},
            {"backend", "C++17 Boost.Asio / Boost.Beast"},
            {"connected_clients", client_mgr_->session_count()},
            {"database_connected", db_mgr_ ? db_mgr_->is_connected() : false}
        };
        res.body() = health_json.dump();
        res.prepare_payload();
    } else {
        res.result(http::status::ok);
        res.keep_alive(false);

        nlohmann::json info_json = {
            {"service", "ConnectX Real-Time Chat Engine"},
            {"version", "1.0.0"},
            {"protocol", "WebSocket RFC 6455"},
            {"health_endpoint", "/health"},
            {"websocket_path", "/ws"}
        };
        res.body() = info_json.dump();
        res.prepare_payload();
    }

    auto sp = std::make_shared<http::response<http::string_body>>(std::move(res));
    http::async_write(
        ws_.next_layer(),
        *sp,
        asio::bind_executor(strand_,
            [self = shared_from_this(), sp](beast::error_code ec, std::size_t) {
                if (ec) Logger::debug("HTTP response error: {}", ec.message());
                beast::error_code shut_ec;
                self->ws_.next_layer().socket().shutdown(tcp::socket::shutdown_both, shut_ec);
            }));
}

void Session::on_accept(beast::error_code ec) {
    if (ec) {
        Logger::error("WS accept error [{}]: {}", session_id_, ec.message());
        return;
    }
    Logger::info("WebSocket connection established: session={}", session_id_);
    client_mgr_->add_session(shared_from_this());
    do_read();
}

void Session::do_read() {
    ws_.async_read(
        read_buf_,
        asio::bind_executor(strand_,
            beast::bind_front_handler(&Session::on_read, shared_from_this())));
}

void Session::on_read(beast::error_code ec, std::size_t bytes) {
    if (ec == ws::error::closed || ec == asio::error::eof ||
        ec == asio::error::connection_reset) {
        on_close(ec);
        return;
    }
    if (ec) {
        Logger::warn("Read error [{}]: {}", session_id_, ec.message());
        on_close(ec);
        return;
    }

    std::string text = beast::buffers_to_string(read_buf_.data());
    read_buf_.consume(bytes);

    // Dispatch JSON event
    msg_handler_->dispatch(shared_from_this(), text);

    do_read();
}

void Session::send(std::shared_ptr<std::string const> msg) {
    asio::post(strand_, [self = shared_from_this(), msg = std::move(msg)]() mutable {
        self->write_queue_.push(std::move(msg));
        if (!self->writing_) self->do_write();
    });
}

void Session::do_write() {
    if (write_queue_.empty()) {
        writing_ = false;
        return;
    }
    writing_ = true;
    auto msg = write_queue_.front();
    write_queue_.pop();

    ws_.async_write(
        asio::buffer(*msg),
        asio::bind_executor(strand_,
            beast::bind_front_handler(&Session::on_write, shared_from_this())));
}

void Session::on_write(beast::error_code ec, std::size_t /*bytes*/) {
    if (ec) {
        Logger::warn("Write error [{}]: {}", session_id_, ec.message());
        on_close(ec);
        return;
    }
    do_write();
}

void Session::on_close(beast::error_code /*ec*/) {
    Logger::info("Session closed: session={} user={}",
                 session_id_, user_id_.empty() ? "<unauthenticated>" : user_id_);

    std::string leaving_user = user_id_;
    client_mgr_->remove_session(session_id_);

    // If this user has no other active sessions, broadcast user_offline event
    if (!leaving_user.empty() && !client_mgr_->is_user_online(leaving_user)) {
        nlohmann::json offline_event = {
            {"type", "user_offline"},
            {"data", {
                {"user_id", leaving_user}
            }}
        };
        client_mgr_->broadcast(std::make_shared<std::string>(offline_event.dump()));
    }
}

} // namespace connectx

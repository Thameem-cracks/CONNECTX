#include "server/Session.hpp"
#include "clients/ClientManager.hpp"
#include "chat/MessageHandler.hpp"
#include "utils/Logger.hpp"

#include <boost/beast/core.hpp>
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

Session::Session(tcp::socket                     socket,
                 std::shared_ptr<ClientManager>  client_mgr,
                 std::shared_ptr<MessageHandler> msg_handler)
    : ws_(std::move(socket))
    , strand_(asio::make_strand(ws_.get_executor()))
    , client_mgr_(std::move(client_mgr))
    , msg_handler_(std::move(msg_handler))
    , session_id_(generate_session_id())
{}

void Session::start() {
    ws_.set_option(ws::stream_base::timeout::suggested(beast::role_type::server));
    ws_.set_option(ws::stream_base::decorator([](ws::response_type& res) {
        res.set(http::field::server, "ConnectX/1.0");
    }));

    ws_.async_accept(
        asio::bind_executor(strand_,
            beast::bind_front_handler(&Session::on_accept, shared_from_this())));
}

void Session::on_accept(beast::error_code ec) {
    if (ec) {
        Logger::error("WS accept error [{}]: {}", session_id_, ec.message());
        return;
    }
    Logger::debug("WebSocket accepted: session={}", session_id_);
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

    // Extract text message
    std::string text = beast::buffers_to_string(read_buf_.data());
    read_buf_.consume(bytes);

    // Hand off to message handler (may be called from any strand worker)
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
    if (write_queue_.empty()) { writing_ = false; return; }
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
    Logger::debug("Session closing: session={} user={}", session_id_,
                  user_id_.empty() ? "<unauthenticated>" : user_id_);
    client_mgr_->remove_session(session_id_);
}

} // namespace connectx

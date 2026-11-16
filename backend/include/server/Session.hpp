#pragma once

#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <boost/beast/websocket.hpp>
#include <memory>
#include <queue>
#include <string>
#include <mutex>

namespace connectx {

namespace asio  = boost::asio;
namespace beast = boost::beast;
namespace ws    = beast::websocket;
using tcp       = asio::ip::tcp;

class ClientManager;
class MessageHandler;

/**
 * @brief Represents one connected WebSocket client session.
 *
 * Each Session owns its websocket stream and a strand that serialises
 * all async operations on it. Outgoing messages are queued; a single
 * write chain drains the queue so writes never overlap.
 *
 * Sessions are reference-counted (shared_ptr) and self-destroy when
 * the connection closes.
 */
class Session : public std::enable_shared_from_this<Session> {
public:
    Session(tcp::socket                       socket,
            std::shared_ptr<ClientManager>    client_mgr,
            std::shared_ptr<MessageHandler>   msg_handler);

    /** Start the WebSocket handshake then enter the read loop. */
    void start();

    /**
     * @brief Enqueue a message for async send.
     * Thread-safe; may be called from any thread.
     */
    void send(std::shared_ptr<std::string const> msg);

    /** @return The authenticated user ID (empty if not yet authenticated). */
    const std::string& user_id()       const { return user_id_; }
    const std::string& username()      const { return username_; }
    const std::string& display_name()  const { return display_name_; }

    void set_user_id(std::string id)       { user_id_      = std::move(id); }
    void set_username(std::string u)       { username_     = std::move(u); }
    void set_display_name(std::string dn)  { display_name_ = std::move(dn); }

    /** Unique session identifier (not the user id). */
    const std::string& session_id() const  { return session_id_; }

private:
    // WebSocket handshake
    void on_accept(beast::error_code ec);

    // Read pipeline
    void do_read();
    void on_read(beast::error_code ec, std::size_t bytes);

    // Write pipeline
    void do_write();
    void on_write(beast::error_code ec, std::size_t bytes);

    // Connection teardown
    void on_close(beast::error_code ec);

    ws::stream<beast::tcp_stream>           ws_;
    asio::strand<asio::io_context::executor_type> strand_;
    beast::flat_buffer                      read_buf_;

    std::mutex                              write_mutex_;
    std::queue<std::shared_ptr<std::string const>> write_queue_;
    bool                                    writing_{ false };

    std::shared_ptr<ClientManager>          client_mgr_;
    std::shared_ptr<MessageHandler>         msg_handler_;

    std::string session_id_;
    std::string user_id_;
    std::string username_;
    std::string display_name_;
};

} // namespace connectx

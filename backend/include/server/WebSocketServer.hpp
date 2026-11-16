#pragma once

#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <boost/beast/websocket.hpp>
#include <memory>
#include <string>
#include <thread>
#include <vector>

namespace connectx {

namespace asio  = boost::asio;
namespace beast = boost::beast;
namespace http  = beast::http;
namespace ws    = beast::websocket;
using tcp       = asio::ip::tcp;

class ClientManager;
class ChatManager;
class AuthManager;
class DatabaseManager;
class MessageHandler;

/**
 * @brief The main WebSocket + HTTP server.
 *
 * Uses a single io_context shared across a thread pool.
 * All WebSocket sessions run on strands derived from that context,
 * giving strand-based serialisation for per-session state and
 * mutex-based protection for shared structures in ClientManager.
 */
class WebSocketServer {
public:
    /**
     * @param port         TCP port to listen on (from $PORT env var).
     * @param thread_count Number of io_context worker threads.
     */
    WebSocketServer(unsigned short port, unsigned int thread_count = 0);
    ~WebSocketServer();

    /** Start accepting connections. Blocks until stop() is called. */
    void run();

    /** Signal graceful shutdown (safe to call from a signal handler). */
    void stop();

private:
    // Accept loop
    void do_accept();
    void on_accept(beast::error_code ec, tcp::socket socket);

    // HTTP requests that arrive before WebSocket upgrade
    void handle_http_request(tcp::socket socket);

    unsigned short                          port_;
    unsigned int                            thread_count_;
    asio::io_context                        ioc_;
    tcp::acceptor                           acceptor_;
    asio::signal_set                        signals_;
    std::vector<std::thread>                workers_;

    // Shared subsystems — constructed in WebSocketServer::run()
    std::shared_ptr<ClientManager>          client_mgr_;
    std::shared_ptr<ChatManager>            chat_mgr_;
    std::shared_ptr<AuthManager>            auth_mgr_;
    std::shared_ptr<DatabaseManager>        db_mgr_;
    std::shared_ptr<MessageHandler>         msg_handler_;
};

} // namespace connectx

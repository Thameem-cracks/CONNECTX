/**
 * ConnectX Backend – main.cpp
 *
 * Entry point. Reads configuration from environment variables,
 * initialises all subsystems, and starts the WebSocket server.
 *
 * Environment variables (see .env.example):
 *   PORT                 – TCP port (default: 8080)
 *   DATABASE_URL         – libpqxx connection string
 *   SUPABASE_URL         – Supabase project URL
 *   SUPABASE_JWKS_URL    – JWKS endpoint for RS256 JWT verification
 *   SUPABASE_JWT_SECRET  – HS256 secret (fallback if JWKS not set)
 *   LOG_LEVEL            – debug | info | warn | error (default: info)
 */

#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>

#include "server/WebSocketServer.hpp"
#include "utils/Logger.hpp"

int main() {
    // ── Read environment ──────────────────────────────────────────────────
    const char* port_env = std::getenv("PORT");
    unsigned short port  = port_env ? static_cast<unsigned short>(std::stoul(port_env))
                                    : 8080;

    const char* log_env  = std::getenv("LOG_LEVEL");
    if (log_env) connectx::Logger::set_level(std::string(log_env));

    connectx::Logger::info("============================================");
    connectx::Logger::info(" ConnectX – Real-Time C++ WebSocket Server  ");
    connectx::Logger::info("============================================");
    connectx::Logger::info("Port      : {}", port);
    connectx::Logger::info("Log level : {}", log_env ? log_env : "info");

    // ── Hardware concurrency ──────────────────────────────────────────────
    unsigned int threads = std::thread::hardware_concurrency();
    if (threads == 0) threads = 4;
    connectx::Logger::info("IO threads: {}", threads);

    // ── Launch server ─────────────────────────────────────────────────────
    try {
        connectx::WebSocketServer server(port, threads);
        server.run(); // blocks until SIGINT / SIGTERM
    } catch (const std::exception& ex) {
        connectx::Logger::error("Fatal: {}", ex.what());
        return EXIT_FAILURE;
    }

    connectx::Logger::info("ConnectX stopped cleanly.");
    return EXIT_SUCCESS;
}

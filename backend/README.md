# ConnectX Backend

A high-performance, real-time WebSocket chat server written in modern C++17 using **Boost.Beast** (Asio + WebSocket), **libpqxx** (PostgreSQL), **OpenSSL** (JWT), and **nlohmann/json**.

## Architecture

```
src/
├── main.cpp                    # Entry point, reads env vars, launches server
├── server/
│   ├── WebSocketServer.cpp     # io_context thread pool, acceptor, subsystem wiring
│   └── Session.cpp             # Per-connection strand, read/write queues
├── clients/
│   └── ClientManager.cpp       # Thread-safe session registry, fan-out helpers
├── auth/
│   └── AuthManager.cpp         # Supabase JWT verification (HS256 / RS256 JWKS)
├── database/
│   └── DatabaseManager.cpp     # libpqxx wrappers, all parameterised queries
├── chat/
│   ├── ChatManager.cpp         # Domain logic: rooms, messages, typing
│   └── MessageHandler.cpp      # JSON dispatch router
└── utils/
    ├── Logger.cpp               # Thread-safe console logger
    └── JsonUtils.hpp            # Header-only JSON helpers
```

## Prerequisites

| Dependency       | Minimum version | Install (Ubuntu 22.04)              |
|------------------|-----------------|--------------------------------------|
| CMake            | 3.20            | `apt install cmake`                  |
| GCC / Clang      | C++17           | `apt install build-essential`        |
| Boost            | 1.81            | `apt install libboost-all-dev`       |
| OpenSSL          | 3.x             | `apt install libssl-dev`             |
| libpqxx          | 7.x             | `apt install libpqxx-dev`            |
| nlohmann/json    | 3.11            | `apt install nlohmann-json3-dev`     |

## Build

```bash
# From the backend/ directory
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel $(nproc)
./build/bin/connectx
```

### Build with tests

```bash
cmake -S . -B build -DBUILD_TESTS=ON
cmake --build build
ctest --test-dir build
```

### Docker

```bash
# From the repo root
docker compose up --build
```

## Configuration

Copy `../.env.example` to `.env` and fill in values. The server reads:

| Variable              | Default | Description                                |
|-----------------------|---------|--------------------------------------------|
| `PORT`                | `8080`  | TCP listen port                            |
| `DATABASE_URL`        | –       | libpqxx connection string                  |
| `SUPABASE_URL`        | –       | Supabase project URL                       |
| `SUPABASE_JWKS_URL`   | –       | JWKS endpoint (RS256 JWT, recommended)     |
| `SUPABASE_JWT_SECRET` | –       | HS256 symmetric secret (fallback)          |
| `LOG_LEVEL`           | `info`  | `debug` / `info` / `warn` / `error`       |
| `MAX_CLIENTS`         | `1000`  | (Phase 2) max concurrent connections       |

## WebSocket Protocol

Connect to `ws://host:port/ws`, then send JSON frames:

### Client → Server

```jsonc
// Authenticate (must be first message)
{ "type": "authenticate", "token": "<supabase_access_token>" }

// Send a message to a room/conversation
{ "type": "chat_message", "conversation_id": "<uuid>", "content": "Hello!" }

// Send a direct message
{ "type": "private_message", "recipient_id": "<user_uuid>", "content": "Hey" }

// Join / leave a room
{ "type": "join_room",  "room_id": "<uuid>" }
{ "type": "leave_room", "room_id": "<uuid>" }

// Create a room
{ "type": "create_room", "name": "general", "description": "Main channel" }

// Load message history (cursor-based pagination)
{ "type": "load_history", "conversation_id": "<uuid>", "limit": 50, "before_id": "<msg_uuid>" }

// Typing indicators
{ "type": "typing_start", "conversation_id": "<uuid>" }
{ "type": "typing_stop",  "conversation_id": "<uuid>" }

// Keep-alive
{ "type": "ping" }
```

### Server → Client

```jsonc
// Success response envelope
{ "type": "<event_name>", "data": { ... } }

// Error envelope
{ "type": "error", "code": "<code>", "message": "<human readable>" }

// Example: authenticated
{ "type": "authenticated", "data": { "user_id": "...", "username": "...", "display_name": "..." } }

// Example: new_message broadcast
{ "type": "new_message", "data": { "id": "...", "conversation_id": "...", "sender_id": "...", "content": "...", "created_at": "..." } }
```

## Health Check

`GET http://localhost:8080/health` → `200 OK` with body `{"status":"ok"}`.

## Security Notes

- **JWT claims only**: The backend never trusts a `user_id` sent by the browser. Identity is always derived from the verified JWT `sub` claim.
- **Parameterised queries**: All DB queries use libpqxx parameterised statements — no string concatenation into SQL.
- **Membership checks**: Every chat message is rejected unless the backend confirms (via DB) the sender belongs to the conversation.
- **RLS**: Supabase Row-Level Security is enabled on all tables as a defence-in-depth layer.

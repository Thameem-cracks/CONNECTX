# ConnectX Architecture

## Overview

ConnectX is a real-time multi-client chat application where the browser communicates directly through WebSockets with a high-performance **C++ backend** built on Boost.Asio and Boost.Beast. The backend manages all TCP connections, authorises every action, persists data to Supabase PostgreSQL, and broadcasts messages to connected clients.

## Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Client Browser (SPA)                            │
│  HTML5 + CSS3 + Vanilla JavaScript (Vite)                              │
│  ┌────────────┐        ┌───────────────────────────────────────────┐   │
│  │  Supabase  │        │   WebSocket Service (services/ws.js)      │   │
│  │  Auth SDK  │        │   – auto-reconnect, auth handshake, dedup │   │
│  └─────┬──────┘        └─────────────────────┬─────────────────────┘   │
└────────┼─────────────────────────────────────┼─────────────────────────┘
         │ HTTPS (Supabase Auth API)           │ WSS / WS
         ▼                                     ▼
┌──────────────────┐            ┌────────────────────────────────────────┐
│  Supabase Auth   │            │   ConnectX C++ Backend (Boost.Asio)    │
│  (JWT issuance)  │            │                                        │
└──────────────────┘            │  WebSocketServer                       │
                                │    ├── io_context + thread pool        │
                                │    ├── tcp::acceptor                   │
                                │    └── Session (per connection strand) │
                                │                                        │
                                │  MessageHandler ──→ JSON dispatcher    │
                                │  AuthManager   ──→ verify Supabase JWT │
                                │  ChatManager   ──→ room/message logic  │
                                │  ClientManager ──→ registry & fanout   │
                                │  DatabaseManager ─→ libpqxx client     │
                                └───────────────────┬────────────────────┘
                                                    │ PostgreSQL wire protocol
                                                    ▼
                                ┌────────────────────────────────────────┐
                                │        Supabase PostgreSQL DB          │
                                │  profiles, chat_rooms, room_members    │
                                │  conversations, conversation_members   │
                                │  messages, message_reads               │
                                └────────────────────────────────────────┘
```

## Concurrency Model

The backend uses **Boost.Asio with a multi-threaded `io_context`**:

1. A single `boost::asio::io_context` is driven by a thread pool sized to `std::thread::hardware_concurrency()`.
2. Each `Session` is bound to an `asio::strand<executor_type>`, ensuring that asynchronous read and write operations for that session are executed sequentially without data races.
3. Outgoing WebSocket frames are placed in an internal thread-safe queue per session, draining asynchronously.
4. `ClientManager` holds session registries protected by a `std::shared_mutex` (shared locks for fast concurrent broadcasts, exclusive locks for session register/deregister).
5. `DatabaseManager` synchronizes PostgreSQL connection transactions safely via mutex locks.

## Message Protocol

All communication between the frontend and the C++ backend uses JSON text frames over WebSocket.

### Client-to-Server Events

| Type | Required Fields | Description |
|---|---|---|
| `authenticate` | `token` | Supabase JWT token for backend verification |
| `chat_message` | `conversation_id`, `content` | Send message to a room or group |
| `private_message` | `recipient_user_id`, `content` | Send one-on-one direct message |
| `join_room` | `room_id` | Join a chat room |
| `leave_room` | `room_id` | Leave a chat room |
| `create_room` | `name`, `description` | Create a new room |
| `typing_start` | `conversation_id` | Broadcast typing status |
| `typing_stop` | `conversation_id` | Clear typing status |
| `load_history` | `conversation_id`, `limit`, `before_id` | Retrieve historical messages |
| `ping` | — | Connection keepalive |

### Server-to-Client Events

| Type | Description |
|---|---|
| `authenticated` | Session identity confirmed with user profile info |
| `authentication_error` | Token validation or parsing error |
| `message_received` | New room or channel message |
| `private_message` | New private DM received |
| `room_created` | Room creation broadcast |
| `room_updated` | Participant joined/left room |
| `history_loaded` | Array of historical messages |
| `typing_start` / `typing_stop` | Peer typing notifications |
| `user_online` / `user_offline` | Real-time presence updates |
| `error` | Error payload (`code`, `message`) |
| `pong` | Heartbeat acknowledgement |

## Security Model

- **Zero-Trust Identity**: The C++ backend never accepts a sender identity from client JSON. The identity is derived solely from verified Supabase JWT claims (`sub`).
- **Authorization Enforcement**: Before dispatching or recording any message, membership in the requested `conversation_id` or `room_id` is verified.
- **SQL Injection Prevention**: Parameterized queries are used across all SQL statements via libpqxx.
- **Payload Guardrails**: Maximum WebSocket frame payload limit enforced (64 KB).
- **Environment Isolation**: No secrets in frontend code; Supabase Service keys are never shipped to client.

# ConnectX API Specification

## 1. Network Transport

- **Protocol**: WebSocket (RFC 6455)
- **Local Endpoint**: `ws://localhost:8080/ws`
- **Production Endpoint**: `wss://<render-service-name>.onrender.com/ws`
- **Format**: JSON text frames UTF-8

## 2. Authentication Flow

```
Client                                                  ConnectX C++ Backend
  │                                                               │
  │─── GET /ws (WebSocket Upgrade) ──────────────────────────────►│
  │◄── 101 Switching Protocols ───────────────────────────────────│
  │                                                               │
  │─── {"type":"authenticate","token":"<SUPABASE_JWT>"} ─────────►│
  │                                                               │ (Decode claims,
  │                                                               │  verify signature,
  │                                                               │  query user profile)
  │◄── {"type":"authenticated","user":{...}} ─────────────────────│
  │                                                               │
  │─── {"type":"chat_message", ...} ─────────────────────────────►│
```

## 3. WebSocket Event Payloads

### Authenticate
```json
// Client -> Server
{
  "type": "authenticate",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Server -> Client (Success)
{
  "type": "authenticated",
  "user": {
    "id": "c6204c8f-3bf6-4ef3-bda7-111111111111",
    "username": "alex_dev",
    "display_name": "Alex Developer"
  }
}

// Server -> Client (Failure)
{
  "type": "authentication_error",
  "message": "Token expired or invalid"
}
```

### Chat Message (Room)
```json
// Client -> Server
{
  "type": "chat_message",
  "conversation_id": "7a353dcf-bb2e-40b9-8354-222222222222",
  "content": "Hello team, real-time message via C++ backend!"
}

// Server -> Room Members
{
  "type": "message_received",
  "conversation_id": "7a353dcf-bb2e-40b9-8354-222222222222",
  "message": {
    "id": "e8d7f7e9-a3b4-4b5c-9c7a-333333333333",
    "sender_id": "c6204c8f-3bf6-4ef3-bda7-111111111111",
    "content": "Hello team, real-time message via C++ backend!",
    "created_at": "2026-11-16T13:40:00Z"
  }
}
```

### Private Message (DM)
```json
// Client -> Server
{
  "type": "private_message",
  "recipient_user_id": "b1111111-2222-3333-4444-555555555555",
  "content": "Hey, checking in on the networking demo!"
}

// Server -> Both Participants
{
  "type": "private_message",
  "conversation_id": "4b6118b8-656d-495d-93d3-444444444444",
  "message": {
    "id": "f9e8d7c6-b5a4-4321-9876-555555555555",
    "sender_id": "c6204c8f-3bf6-4ef3-bda7-111111111111",
    "content": "Hey, checking in on the networking demo!",
    "created_at": "2026-11-16T13:40:05Z"
  }
}
```

### Room Management
```json
// Create Room
{
  "type": "create_room",
  "name": "Networking Lab",
  "description": "Discussion on C++ socket architecture"
}

// Join Room
{
  "type": "join_room",
  "room_id": "7a353dcf-bb2e-40b9-8354-222222222222"
}

// Leave Room
{
  "type": "leave_room",
  "room_id": "7a353dcf-bb2e-40b9-8354-222222222222"
}
```

### Typing Indicators
```json
// Client -> Server
{ "type": "typing_start", "conversation_id": "7a353dcf-bb2e-40b9-8354-222222222222" }
{ "type": "typing_stop",  "conversation_id": "7a353dcf-bb2e-40b9-8354-222222222222" }

// Server -> Other Participants
{
  "type": "typing_start",
  "conversation_id": "7a353dcf-bb2e-40b9-8354-222222222222",
  "user_id": "c6204c8f-3bf6-4ef3-bda7-111111111111",
  "username": "alex_dev"
}
```

### Presence & Keepalive
```json
// User Online Event (Broadcast)
{ "type": "user_online",  "user_id": "c6204c8f-3bf6-4ef3-bda7-111111111111" }

// User Offline Event (Broadcast)
{ "type": "user_offline", "user_id": "c6204c8f-3bf6-4ef3-bda7-111111111111" }

// Heartbeat
{ "type": "ping" }
{ "type": "pong" }
```

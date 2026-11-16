"""Dependency-free local WebSocket chat server for ConnectX development."""
import base64, hashlib, json, os, socket, struct, threading, time, uuid

HOST, PORT = "0.0.0.0", 8080
clients = {}
HISTORY_FILE = os.path.join(os.path.dirname(__file__), "local_chat_history.json")
try:
    with open(HISTORY_FILE, "r", encoding="utf-8") as stream: history = json.load(stream)
except (OSError, ValueError):
    history = {}
lock = threading.RLock()

def frame(text):
    data = text.encode()
    length = len(data)
    head = bytearray([0x81])
    if length < 126: head.append(length)
    elif length < 65536: head.append(126); head.extend(struct.pack("!H", length))
    else: head.append(127); head.extend(struct.pack("!Q", length))
    return bytes(head) + data

def send(sock, payload):
    try: sock.sendall(frame(json.dumps(payload, separators=(",", ":"))))
    except OSError: pass

def broadcast(payload, exclude=None):
    packet = frame(json.dumps(payload, separators=(",", ":")))
    with lock:
        for sock in list(clients):
            if sock is exclude: continue
            try: sock.sendall(packet)
            except OSError: clients.pop(sock, None)

def read_frame(sock):
    head = sock.recv(2)
    if len(head) < 2: return None
    length, masked = head[1] & 127, head[1] & 128
    if length == 126: length = struct.unpack("!H", sock.recv(2))[0]
    elif length == 127: length = struct.unpack("!Q", sock.recv(8))[0]
    if length > 1024 * 1024: return None
    mask = sock.recv(4) if masked else b""
    data = bytearray()
    while len(data) < length:
        chunk = sock.recv(length - len(data))
        if not chunk: return None
        data.extend(chunk)
    if masked:
        for i in range(length): data[i] ^= mask[i % 4]
    return bytes(data).decode(errors="replace")

def client(sock, address):
    user = None
    try:
        request = b""
        while b"\r\n\r\n" not in request: request += sock.recv(4096)
        key = next((line.split(":", 1)[1].strip() for line in request.decode(errors="ignore").split("\r\n") if line.lower().startswith("sec-websocket-key:")), None)
        if not key: return
        accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
        sock.sendall(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n").encode())
        with lock: clients[sock] = None
        while True:
            raw = read_frame(sock)
            if raw is None: break
            msg = json.loads(raw)
            kind = msg.get("type")
            if kind == "ping": send(sock, {"type": "pong"})
            elif kind == "authenticate":
                token = msg.get("token", "")
                parts = token.split(":", 3)
                username = parts[2] if len(parts) > 2 else "guest"
                display = parts[3] if len(parts) > 3 else username
                user = {"user_id": parts[1] if len(parts) > 1 else "guest-" + uuid.uuid4().hex[:8], "username": username, "display_name": display}
                with lock: clients[sock] = user
                send(sock, {"type": "authenticated", "data": user})
                broadcast({"type": "user_online", "data": user}, sock)
            elif kind == "load_history":
                conversation_id = msg.get("conversation_id", "general")
                with lock: messages = list(history.get(conversation_id, []))
                send(sock, {"type": "history", "data": {"conversation_id": conversation_id, "messages": messages, "has_more": False}})
            elif kind == "list_rooms":
                send(sock, {"type": "room_list", "rooms": [{"id": "general", "name": "general", "description": "General discussion for everyone on ConnectX"}]})
            elif kind == "get_room_members":
                with lock: members = [u for u in clients.values() if u]
                send(sock, {"type": "room_members", "room_id": msg.get("room_id", "general"), "members": [{"id": u["user_id"], "username": u["username"], "display_name": u["display_name"], "is_online": True} for u in members]})
            elif kind in ("chat_message", "private_message") and user and msg.get("content", "").strip():
                target = msg.get("conversation_id", "general")
                payload = {"id": "msg-" + uuid.uuid4().hex, "conversation_id": target, "sender_id": user["user_id"], "sender_username": user["username"], "sender_display": user["display_name"], "content": msg["content"].strip(), "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                with lock:
                    history.setdefault(target, []).append(payload)
                    try:
                        with open(HISTORY_FILE, "w", encoding="utf-8") as stream: json.dump(history, stream)
                    except OSError: pass
                # The sender already renders an optimistic copy in the UI.
                broadcast({"type": "new_message", **payload}, sock)
    except (OSError, ValueError, json.JSONDecodeError): pass
    finally:
        with lock: clients.pop(sock, None)
        if user: broadcast({"type": "user_offline", "data": {"user_id": user["user_id"], "username": user["username"], "display_name": user["display_name"]}})
        try: sock.close()
        except OSError: pass

def main():
    server = socket.socket(); server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); server.bind((HOST, PORT)); server.listen(100)
    print(f"ConnectX local chat server listening on ws://localhost:{PORT}/ws", flush=True)
    while True:
        sock, address = server.accept(); threading.Thread(target=client, args=(sock, address), daemon=True).start()

if __name__ == "__main__": main()

# ConnectX – Real-Time C++ WebSocket Chat Application

> A networking-focused, multi-client, real-time messaging web platform engineered with a **C++ TCP socket & WebSocket backend (Boost.Asio / Boost.Beast)**, Supabase PostgreSQL persistence, and a modern vanilla JavaScript single-page frontend.

---

## 🌟 Overview & Key Highlights

ConnectX was designed to demonstrate real-time computer networking, multithreaded server architecture, and low-latency client-server synchronization using genuine C++ network programming rather than high-level scripting runtime wrappers.

- ⚡ **True C++ Networking Backend**: Boost.Asio asynchronous I/O and Boost.Beast WebSocket server with a dedicated thread pool and strand-based serialization.
- 💬 **Real-Time Multi-Client Communication**: Low-latency bidirectional messaging between multiple concurrent users without page reloading.
- 👥 **Group Chat Rooms & Channels**: Create, join, and broadcast messages across isolated room namespaces.
- 🔒 **Private Direct Messaging**: Authenticated user-to-user private chat conversations.
- 🟢 **Accurate Connection Presence Tracking**: Live online/offline presence backed directly by TCP connection lifecycle events.
- ✍️ **Typing Indicators**: Real-time typing notification events.
- 📜 **Persistent Chat Storage**: Supabase PostgreSQL persistence using parameterized SQL queries via `libpqxx`.
- 🔐 **Zero-Trust JWT Verification**: Token claims validated on the C++ backend; browser-supplied sender identities are never trusted.
- 📱 **Responsive Dark-Themed UI**: Modern Discord/Slack-inspired interface built with HTML5, CSS3, and Vite.
- 🐳 **Containerized & Deploy-Ready**: Multi-stage Docker build ready for Render deployment, and static build configured for Vercel.

---

## 🛠 Technology Stack

### Backend
- **Language**: C++17
- **Networking & Transport**: Boost.Asio, Boost.Beast (HTTP/WebSocket)
- **Concurrency**: `std::thread` worker pool + `boost::asio::strand` per connection
- **Database Client**: `libpqxx` (PostgreSQL client library for C++)
- **JSON Processing**: `nlohmann/json`
- **Crypto & Security**: OpenSSL (SHA256, HMAC, TLS)
- **Build System**: CMake (v3.20+) & Ninja

### Frontend
- **Markup & Styling**: HTML5, modern CSS3 variables & flexbox/grid layout
- **Logic**: Vanilla JavaScript (ES6+ Modules)
- **Bundler & Dev Server**: Vite
- **Icons**: Lucide Icons
- **Auth Client**: `@supabase/supabase-js`

### Database & Deployment
- **Database**: Supabase PostgreSQL with Row Level Security (RLS) policies
- **Backend Deployment**: Render (Docker web service)
- **Frontend Deployment**: Vercel

---

## 📁 Project Structure

```
ConnectX/
├── backend/                  C++ WebSocket server
│   ├── CMakeLists.txt        CMake build definition
│   ├── Dockerfile            Multi-stage Ubuntu build & runtime container
│   ├── include/              C++ header files
│   │   ├── auth/             AuthManager (JWT verification)
│   │   ├── chat/             ChatManager & MessageHandler
│   │   ├── clients/          ClientManager (thread-safe session registry)
│   │   ├── database/         DatabaseManager (PostgreSQL libpqxx client)
│   │   ├── server/           WebSocketServer & Session
│   │   └── utils/            Logger & JsonUtils
│   └── src/                  C++ implementation files
│       ├── main.cpp          Server entry point
│       ├── auth/
│       ├── chat/
│       ├── clients/
│       ├── database/
│       ├── server/
│       └── utils/
│
├── frontend/                 Vite Single-Page Application
│   ├── package.json          Frontend dependencies & scripts
│   ├── vite.config.js        Vite bundler configuration
│   ├── index.html            App entry HTML
│   ├── public/               Static assets & favicon
│   └── src/
│       ├── main.js           Router & app bootstrap
│       ├── auth/             Supabase auth & session handling
│       ├── pages/            Landing, Login, Register, Chat, Settings
│       ├── services/         WebSocket client service (auto-reconnect, ping)
│       ├── styles/           Global CSS variables & components
│       └── utils/            Formatters & toast notifications
│
├── database/                 Database schema & SQL migrations
│   ├── migrations/           Numbered migrations (001_initial, 002_rls, 003_triggers)
│   ├── schema.sql            Full PostgreSQL reference schema
│   └── seed.sql              Initial seed data
│
├── docs/                     Detailed project documentation
│   ├── architecture.md       Full architectural and concurrency model
│   ├── api.md                WebSocket JSON message specification
│   └── deployment.md         Step-by-step deployment to Render, Vercel & Supabase
│
├── .env.example              Template for backend & frontend environment variables
├── docker-compose.yml        Docker orchestration for local backend
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started (Phase 1 Local Setup)

### Prerequisites
- **Node.js**: v20 or higher (verified on v24)
- **Docker / Docker Desktop**: For running the C++ backend container locally (or native CMake + Boost + OpenSSL + libpqxx)

### 1. Configure Environment Variables
Copy `.env.example` to `.env` at the project root and in `frontend/`:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Fill in your Supabase credentials when ready (or test in local offline mode).

### 2. Run Frontend
Navigate to the frontend directory and install dependencies:
```bash
cd frontend
npm install
npm run dev
```
The frontend will start at **http://localhost:5173**.

### 3. Build & Run C++ Backend with Docker
```bash
# From project root:
docker-compose up --build
```
The backend binds to `0.0.0.0:8080`.

---

## 🧪 Testing Backend Health & Sockets

Test WebSocket connection using `wscat` or your browser:
```bash
npx wscat -c ws://localhost:8080/ws
```
Send a ping heartbeat:
```json
{"type":"ping"}
```
Expect response:
```json
{"type":"pong"}
```

---

## 📚 Documentation
- [Architecture & Concurrency Guide](docs/architecture.md)
- [WebSocket API Protocol Specification](docs/api.md)
- [Deployment Guide (Render / Vercel / Supabase)](docs/deployment.md)

---

## 📋 Development Roadmap

- [x] **Phase 1**: Initial structure, complete C++ server architecture, frontend scaffold, documentation, and build verification.
- [ ] **Phase 2**: Full UI/UX design implementation, responsive layouts, components, and client-side page routing.
- [ ] **Phase 3**: C++ WebSocket server networking implementation, thread management, and multi-client broadcast testing.
- [ ] **Phase 4**: Frontend ↔ C++ Backend WebSocket integration and message dispatch.
- [ ] **Phase 5**: Supabase PostgreSQL database integration via libpqxx and persistent message history.
- [ ] **Phase 6**: Supabase JWT authentication verification, rooms, private DMs, presence, and typing indicators.
- [ ] **Phase 7**: Security hardening, input validation, rate limiting, and stress testing.
- [ ] **Phase 8**: Production Docker deployment to Render and frontend deployment to Vercel.

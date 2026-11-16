/**
 * Main Chat Dashboard.
 *
 * Layout:
 *   [Left Sidebar] [Main Chat Area] [Right Sidebar (collapsible)]
 */

import { signOut, getSession }  from '../auth/session.js';
import { wsService }            from '../services/websocket.js';
import { formatTimestamp, escapeHtml, getInitials, linkify } from '../utils/format.js';
import { showToast }            from '../utils/toast.js';

let currentConversationId = null;
let currentUser = null;
let typingTimer  = null;
const typingUsers = new Map();

export async function renderChat(container) {
  const session = await getSession();
  currentUser = session?.user || { id: 'guest', email: 'guest@connectx.local' };

  container.innerHTML = `
<div class="chat-layout">

  <!-- ── Left Sidebar ───────────────────────────────────────── -->
  <aside class="sidebar-left" id="sidebar-left">
    <div class="sidebar-brand">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="url(#chatGrad)"/>
        <defs><linearGradient id="chatGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6366F1"/><stop offset="1" stop-color="#8B5CF6"/>
        </linearGradient></defs>
        <text x="16" y="22" font-family="Inter,sans-serif" font-size="14" font-weight="700"
              fill="white" text-anchor="middle">CX</text>
      </svg>
      <span>ConnectX</span>
    </div>

    <!-- Connection status -->
    <div class="connection-status" id="conn-status">
      <span class="status-dot offline" id="conn-dot"></span>
      <span id="conn-label">Connecting…</span>
    </div>

    <!-- Search -->
    <div class="sidebar-search">
      <input class="input" id="search-input" type="search" placeholder="Search conversations…" />
    </div>

    <!-- Direct Messages -->
    <div class="sidebar-section">
      <div class="sidebar-section__header">
        <span>Direct Messages</span>
        <button class="btn btn-icon btn-ghost" title="New DM" id="new-dm-btn">+</button>
      </div>
      <div class="sidebar-list" id="dm-list">
        <div class="sidebar-empty">No direct messages yet</div>
      </div>
    </div>

    <!-- Rooms -->
    <div class="sidebar-section">
      <div class="sidebar-section__header">
        <span>Chat Rooms</span>
        <button class="btn btn-icon btn-ghost" title="Create room" id="create-room-btn">+</button>
      </div>
      <div class="sidebar-list" id="room-list">
        <div class="sidebar-item" data-room-id="general-room">
          <span class="sidebar-item__icon">#</span>
          <span>general</span>
        </div>
        <div class="sidebar-item" data-room-id="tech-talk-room">
          <span class="sidebar-item__icon">#</span>
          <span>tech-talk</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="avatar" id="user-avatar">${getInitials(currentUser.user_metadata?.full_name || currentUser.email)}</div>
        <div class="sidebar-user__info">
          <div class="sidebar-user__name" id="user-display-name">${currentUser.user_metadata?.full_name || currentUser.email || 'User'}</div>
          <div class="sidebar-user__status">
            <span class="status-dot online"></span> Online
          </div>
        </div>
      </div>
      <div class="sidebar-actions">
        <button class="btn btn-icon btn-ghost" title="Settings" id="settings-nav-btn">⚙</button>
        <button class="btn btn-icon btn-ghost" title="Logout" id="logout-btn">↩</button>
      </div>
    </div>
  </aside>

  <!-- ── Main Chat Area ──────────────────────────────────────── -->
  <main class="chat-main" id="chat-main">
    <div class="chat-empty-state" id="chat-empty">
      <div class="chat-empty__icon">💬</div>
      <h2>Select a conversation</h2>
      <p>Choose a room or direct message from the sidebar to start chatting.</p>
    </div>

    <!-- Active conversation -->
    <div class="chat-conversation" id="chat-conversation" style="display:none;">
      <div class="chat-header">
        <div class="chat-header__info">
          <span class="chat-header__name" id="conv-name">—</span>
          <span class="chat-header__desc" id="conv-desc"></span>
        </div>
        <div class="chat-header__actions">
          <span class="chat-header__count" id="conv-count"></span>
          <button class="btn btn-icon btn-ghost hide-mobile" id="toggle-right-sidebar" title="Toggle members">👥</button>
        </div>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="messages-load-more" id="load-more" style="display:none;">
          <button class="btn btn-secondary btn-sm" id="load-more-btn">Load older messages</button>
        </div>
      </div>

      <!-- Typing indicator -->
      <div class="typing-indicator" id="typing-indicator" style="display:none;">
        <span class="typing-dots"><span></span><span></span><span></span></span>
        <span id="typing-label"></span>
      </div>

      <div class="chat-input-area">
        <div class="chat-input-wrapper">
          <textarea
            id="chat-input"
            class="chat-input"
            placeholder="Type your message…"
            rows="1"
            maxlength="65536"
          ></textarea>
          <button class="btn btn-primary btn-icon" id="send-btn" title="Send (Enter)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </main>

  <!-- ── Right Sidebar ───────────────────────────────────────── -->
  <aside class="sidebar-right" id="sidebar-right">
    <div class="sidebar-right__header">
      <span>Room Members</span>
      <button class="btn btn-icon btn-ghost" id="close-right-sidebar">✕</button>
    </div>
    <div class="sidebar-right__content" id="members-list">
      <div class="sidebar-empty">Select a room</div>
    </div>
  </aside>

</div>
`;

  injectChatStyles();
  bindChatEvents();

  // Connect WebSocket
  wsService.connect();
  setupWebSocketHandlers();
}

function bindChatEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    wsService.disconnect();
    await signOut();
  });

  document.getElementById('settings-nav-btn')?.addEventListener('click', () => {
    window.location.hash = '#/settings';
  });

  document.getElementById('toggle-right-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar-right')?.classList.toggle('open');
  });

  document.getElementById('close-right-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar-right')?.classList.remove('open');
  });

  // Room clicks
  document.querySelectorAll('.sidebar-item[data-room-id]').forEach(item => {
    item.addEventListener('click', () => {
      const roomId = item.dataset.roomId;
      const roomName = item.querySelector('span:last-child')?.textContent || roomId;
      openConversation(roomId, '#' + roomName, 'Real-time conversation powered by C++ WebSocket backend');
    });
  });

  const sendBtn   = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');

  sendBtn?.addEventListener('click', sendMessage);

  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatInput?.addEventListener('input', () => {
    autoResizeTextarea(chatInput);
    if (!currentConversationId) return;
    wsService.send({ type: 'typing_start', conversation_id: currentConversationId });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      wsService.send({ type: 'typing_stop', conversation_id: currentConversationId });
    }, 1500);
  });

  document.getElementById('create-room-btn')?.addEventListener('click', () => {
    const name = prompt('Room name:');
    if (name?.trim()) {
      const desc = prompt('Room description (optional):') || '';
      wsService.send({ type: 'create_room', name: name.trim(), description: desc });
    }
  });
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content || !currentConversationId) return;

  wsService.send({
    type: 'chat_message',
    conversation_id: currentConversationId,
    content,
  });

  // Optimistic local echo for immediate responsiveness
  appendMessage({
    id: 'local-' + Date.now(),
    sender_id: currentUser?.id,
    sender_display_name: currentUser?.user_metadata?.full_name || currentUser?.email || 'You',
    content,
    created_at: new Date().toISOString()
  }, currentConversationId);

  input.value = '';
  input.style.height = 'auto';
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function setupWebSocketHandlers() {
  wsService.on('status', ({ status }) => {
    const dot   = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    if (!dot || !label) return;
    dot.className = `status-dot ${status === 'connected' ? 'online' : 'offline'}`;
    label.textContent = {
      connecting:   'Connecting…',
      connected:    'Connected (C++ Backend)',
      reconnecting: 'Reconnecting…',
      error:        'Connection error',
      disconnected: 'Disconnected',
    }[status] || status;
  });

  wsService.on('authenticated', (msg) => {
    if (msg.user) {
      const nameEl = document.getElementById('user-display-name');
      if (nameEl) nameEl.textContent = msg.user.display_name || msg.user.username || 'User';
    }
  });

  wsService.on('message_received', (msg) => {
    appendMessage(msg.message, msg.conversation_id);
  });

  wsService.on('private_message', (msg) => {
    appendMessage(msg.message, msg.conversation_id);
  });

  wsService.on('room_created', (msg) => {
    addRoomToSidebar(msg.room);
    showToast(`Room "${msg.room.name}" created`, 'success');
  });

  wsService.on('typing_start', (msg) => {
    if (msg.conversation_id !== currentConversationId) return;
    typingUsers.set(msg.user_id, msg.username);
    updateTypingIndicator();
  });

  wsService.on('typing_stop', (msg) => {
    typingUsers.delete(msg.user_id);
    updateTypingIndicator();
  });

  wsService.on('error', (msg) => {
    showToast(msg.message || 'Server error', 'error');
  });
}

function appendMessage(message, convId) {
  if (convId !== currentConversationId) return;
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'message';
  if (message.id) div.dataset.id = message.id;

  const isOwn = message.sender_id === currentUser?.id;
  if (isOwn) div.classList.add('message--own');

  const senderName = message.sender_display_name || message.sender_username || (isOwn ? 'You' : 'User');

  div.innerHTML = `
    <div class="message__avatar">${getInitials(senderName)}</div>
    <div class="message__body">
      <div class="message__meta">
        <span class="message__author">${escapeHtml(senderName)}</span>
        <span class="message__time">${formatTimestamp(message.created_at)}</span>
      </div>
      <div class="message__content">${linkify(escapeHtml(message.content))}</div>
    </div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addRoomToSidebar(room) {
  const list = document.getElementById('room-list');
  if (!list) return;

  const item = document.createElement('div');
  item.className = 'sidebar-item';
  item.dataset.roomId = room.id;
  item.innerHTML = `<span class="sidebar-item__icon">#</span><span>${escapeHtml(room.name)}</span>`;
  item.addEventListener('click', () => openConversation(room.id, '#' + room.name, room.description || ''));
  list.appendChild(item);
}

function openConversation(id, name, desc) {
  currentConversationId = id;

  const emptyState = document.getElementById('chat-empty');
  const convArea = document.getElementById('chat-conversation');
  if (emptyState) emptyState.style.display = 'none';
  if (convArea) convArea.style.display = 'flex';

  const nameEl = document.getElementById('conv-name');
  const descEl = document.getElementById('conv-desc');
  if (nameEl) nameEl.textContent = name;
  if (descEl) descEl.textContent = desc;

  const msgContainer = document.getElementById('chat-messages');
  if (msgContainer) msgContainer.innerHTML = '';

  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.roomId === id);
  });

  wsService.send({ type: 'load_history', conversation_id: id, limit: 50 });
}

function updateTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  const label     = document.getElementById('typing-label');
  if (!indicator || !label) return;
  if (typingUsers.size === 0) { indicator.style.display = 'none'; return; }
  const names = [...typingUsers.values()].slice(0, 3).join(', ');
  label.textContent = `${names} ${typingUsers.size === 1 ? 'is' : 'are'} typing…`;
  indicator.style.display = 'flex';
}

function injectChatStyles() {
  const id = 'chat-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.chat-layout {
  display: grid;
  grid-template-columns: 260px 1fr 0px;
  grid-template-rows: 100vh;
  overflow: hidden;
  transition: grid-template-columns var(--transition);
}
.chat-layout:has(#sidebar-right.open) {
  grid-template-columns: 260px 1fr 240px;
}

.sidebar-left {
  display: flex; flex-direction: column;
  background: var(--color-sidebar);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}
.sidebar-brand {
  display: flex; align-items: center; gap: 10px;
  padding: 16px;
  font-size: 17px; font-weight: 700;
  border-bottom: 1px solid var(--color-border);
}
.connection-status {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px;
  font-size: 12px; color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  background: rgba(0,0,0,0.15);
}
.sidebar-search { padding: 10px 12px; }
.sidebar-search .input { font-size: 13px; padding: 8px 12px; }
.sidebar-section { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.sidebar-section__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px 4px;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .5px;
  color: var(--color-text-dim);
}
.sidebar-list { flex: 1; overflow-y: auto; padding: 4px 8px; }
.sidebar-empty { padding: 12px; color: var(--color-text-dim); font-size: 13px; text-align: center; }
.sidebar-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: var(--radius-sm);
  font-size: 14px; color: var(--color-text-muted);
  cursor: pointer; transition: background var(--transition), color var(--transition);
}
.sidebar-item:hover, .sidebar-item.active {
  background: var(--color-card-hover); color: var(--color-text);
}
.sidebar-item.active { background: rgba(99,102,241,.18); color: var(--color-accent); font-weight: 500; }
.sidebar-item__icon { color: var(--color-text-dim); font-weight: 700; }
.sidebar-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px; border-top: 1px solid var(--color-border);
  margin-top: auto;
}
.sidebar-user { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-2));
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.sidebar-user__name { font-size: 13px; font-weight: 600; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-user__status { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-text-muted); }
.sidebar-actions { display: flex; gap: 4px; }

.chat-main { display: flex; flex-direction: column; overflow: hidden; }
.chat-empty-state {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  color: var(--color-text-muted); text-align: center; padding: 24px;
}
.chat-empty__icon { font-size: 64px; }
.chat-conversation { display: flex; flex-direction: column; height: 100%; }
.chat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-sidebar);
}
.chat-header__info { display: flex; flex-direction: column; gap: 2px; }
.chat-header__name { font-size: 16px; font-weight: 600; }
.chat-header__desc { font-size: 12px; color: var(--color-text-muted); }
.chat-header__actions { display: flex; align-items: center; gap: 10px; }
.chat-header__count { font-size: 12px; color: var(--color-text-dim); }

.chat-messages {
  flex: 1; overflow-y: auto;
  padding: 16px 20px;
  display: flex; flex-direction: column; gap: 8px;
}

.message {
  display: flex; gap: 10px; padding: 4px 0;
  animation: msgIn .15s ease;
}
@keyframes msgIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: none; } }
.message__avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg,var(--color-accent),var(--color-accent-2));
  display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff; }
.message__body { flex: 1; }
.message__meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
.message__author { font-size: 13px; font-weight: 600; }
.message__time { font-size: 11px; color: var(--color-text-dim); }
.message__content {
  font-size: 14px; color: var(--color-text); line-height: 1.6;
  word-break: break-word; white-space: pre-wrap;
}
.message--own .message__avatar {
  order: 2; background: linear-gradient(135deg,var(--color-accent-2),var(--color-accent));
}
.message--own .message__body { order: 1; text-align: right; }
.message--own .message__meta { justify-content: flex-end; }

.typing-indicator {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 20px; font-size: 12px; color: var(--color-text-muted);
  min-height: 28px;
}
.typing-dots { display: flex; gap: 3px; }
.typing-dots span {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-text-dim);
  animation: typingBounce 1.2s infinite ease-in-out;
}
.typing-dots span:nth-child(2) { animation-delay: .2s; }
.typing-dots span:nth-child(3) { animation-delay: .4s; }
@keyframes typingBounce { 0%,80%,100% { transform: scale(0.6); } 40% { transform: scale(1); } }

.chat-input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  background: var(--color-sidebar);
}
.chat-input-wrapper { display: flex; align-items: flex-end; gap: 8px; }
.chat-input {
  flex: 1; resize: none; overflow-y: auto;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text); font-family: var(--font-sans);
  font-size: 14px; line-height: 1.5;
  outline: none; padding: 10px 14px;
  transition: border-color var(--transition), box-shadow var(--transition);
  max-height: 160px;
}
.chat-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(99,102,241,.18);
}

.sidebar-right {
  background: var(--color-sidebar);
  border-left: 1px solid var(--color-border);
  display: flex; flex-direction: column;
  overflow: hidden;
  transition: width var(--transition);
  width: 0;
}
.sidebar-right.open { width: 240px; }
.sidebar-right__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px; font-weight: 600;
}
.sidebar-right__content { overflow-y: auto; padding: 12px; flex: 1; }

@media (max-width: 768px) {
  .chat-layout { grid-template-columns: 1fr; }
  .sidebar-left { display: none; }
  .sidebar-right { display: none; }
}
  `;
  document.head.appendChild(style);
}

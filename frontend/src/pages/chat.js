/**
 * ConnectX Main Chat Dashboard — Complete Claymorphic Single-Page Application
 * 75% White / Cloud palette with 25% Violet / Slate contrast
 */

import { signOut, getSession } from '../auth/session.js';
import { wsService }           from '../services/websocket.js';
import { formatTimestamp, escapeHtml, getInitials, linkify } from '../utils/format.js';
import { showToast }           from '../utils/toast.js';
import { icons }               from '../utils/icons.js';

// Application State
let currentUser = null;
let currentConversation = {
  id: 'general',
  name: 'general',
  type: 'room',
  description: 'General discussion for everyone on ConnectX C++ server',
  members: []
};

let typingTimer = null;
const typingUsers = new Map();

// Mock initial rooms & demo members
const rooms = [
  { id: 'general', name: 'general', description: 'General discussion for everyone on ConnectX' },
  { id: 'tech-talk', name: 'tech-talk', description: 'C++ socket programming, Boost.Asio & networking' },
  { id: 'announcements', name: 'announcements', description: 'System news and server updates' }
];

const directMessages = [
  { id: 'dm-alex', username: 'alex_dev', name: 'Alex Developer', status: 'online' },
  { id: 'dm-sarah', username: 'sarah_cpp', name: 'Sarah Engineer', status: 'offline' }
];

const sampleMembers = [
  { id: 'u1', name: 'Alex Developer', username: 'alex_dev', role: 'Maintainer', online: true },
  { id: 'u2', name: 'Sarah Engineer', username: 'sarah_cpp', role: 'Member', online: false },
  { id: 'u3', name: 'Networking Bot', username: 'boost_daemon', role: 'Bot', online: true }
];

export async function renderChat(container) {
  const session = await getSession();
  currentUser = session?.user || {
    id: 'guest-' + Math.floor(Math.random() * 8999 + 1000),
    email: 'guest@connectx.local',
    user_metadata: { full_name: 'Guest Developer', username: 'guest_dev' }
  };

  container.innerHTML = `
<div class="chat-viewport">
  <div class="chat-window-clay clay-card-floating">

    <!-- ── Left Sidebar (Navigation, Channels, DMs) ────────────────────────── -->
    <aside class="sidebar-left" id="sidebar-left">
      <!-- Brand & Status -->
      <div class="sidebar-brand">
        <div class="brand-left">
          ${icons.logo(32)}
          <span class="brand-title">Connect<span class="brand-x">X</span></span>
        </div>
        <button class="btn btn-icon btn-ghost hide-desktop" id="close-left-sidebar" title="Close menu">
          ${icons.close}
        </button>
      </div>

      <!-- Live Connection Pill -->
      <div class="conn-pill" id="conn-pill">
        <span class="status-dot connecting" id="conn-dot"></span>
        <span class="conn-text" id="conn-label">Connecting to C++ backend…</span>
      </div>

      <!-- Search Box -->
      <div class="sidebar-search-box">
        <span class="search-icon">${icons.search}</span>
        <input class="input" id="search-input" type="search" placeholder="Search conversations…" />
      </div>

      <div class="sidebar-scrollable">
        <!-- Chat Rooms Section -->
        <div class="channel-section">
          <div class="channel-section__head">
            <span>Rooms</span>
            <button class="btn btn-icon btn-ghost btn-mini" id="create-room-btn" title="Create room">
              ${icons.plus}
            </button>
          </div>
          <div class="channel-list" id="room-list">
            ${rooms.map(r => `
              <div class="channel-item ${r.id === currentConversation.id ? 'active' : ''}" data-type="room" data-id="${r.id}" data-name="${escapeHtml(r.name)}" data-desc="${escapeHtml(r.description)}">
                <span class="channel-icon">${icons.hash}</span>
                <span class="channel-label">${escapeHtml(r.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Direct Messages Section -->
        <div class="channel-section" style="margin-top: 14px;">
          <div class="channel-section__head">
            <span>Direct Messages</span>
            <button class="btn btn-icon btn-ghost btn-mini" id="new-dm-btn" title="New message">
              ${icons.plus}
            </button>
          </div>
          <div class="channel-list" id="dm-list">
            ${directMessages.map(dm => `
              <div class="channel-item" data-type="dm" data-id="${dm.id}" data-name="${escapeHtml(dm.name)}" data-desc="Direct conversation with @${escapeHtml(dm.username)}">
                <div class="channel-avatar">
                  ${getInitials(dm.name)}
                  <span class="status-dot ${dm.status} mini-dot"></span>
                </div>
                <span class="channel-label">${escapeHtml(dm.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- User Profile Card in Sidebar Footer -->
      <div class="sidebar-footer">
        <div class="user-pill clay-card" id="my-profile-pill" title="Click to view profile">
          <div class="user-avatar-clay">
            ${getInitials(currentUser.user_metadata?.full_name || currentUser.email)}
            <span class="status-dot online my-status-dot"></span>
          </div>
          <div class="user-info">
            <span class="user-name">${escapeHtml(currentUser.user_metadata?.full_name || currentUser.email)}</span>
            <span class="user-handle">@${escapeHtml(currentUser.user_metadata?.username || 'user')}</span>
          </div>
        </div>
        <div class="sidebar-quick-actions">
          <button class="btn btn-icon btn-secondary" id="open-settings-btn" title="Settings">
            ${icons.settings}
          </button>
          <button class="btn btn-icon btn-secondary" id="logout-btn" title="Logout">
            ${icons.logout}
          </button>
        </div>
      </div>
    </aside>

    <!-- ── Main Chat Conversation Area ────────────────────────────────────── -->
    <main class="chat-main" id="chat-main">
      <!-- Conversation Header -->
      <header class="chat-header">
        <div class="header-left">
          <button class="btn btn-icon btn-secondary hide-desktop" id="open-left-sidebar" title="Open navigation">
            ${icons.messageSquare}
          </button>
          <div class="header-titles">
            <div class="header-name-row">
              <span class="header-prefix" id="conv-prefix">#</span>
              <h2 class="header-name" id="conv-name">general</h2>
              <span class="clay-badge clay-badge-accent" id="conv-badge" style="font-size: 11px;">Public Room</span>
            </div>
            <p class="header-desc" id="conv-desc">General discussion for everyone on ConnectX</p>
          </div>
        </div>

        <div class="header-right">
          <button class="btn btn-secondary btn-sm" id="toggle-members-btn" title="Toggle participant members">
            ${icons.users}
            <span class="hide-mobile" id="members-count-badge">3 Members</span>
          </button>
        </div>
      </header>

      <!-- Message History Scroll Area -->
      <div class="messages-container" id="messages-container">
        <!-- Welcoming Clay Banner -->
        <div class="chat-welcome-banner clay-card">
          <div class="welcome-icon">${icons.radio}</div>
          <h3>Welcome to #${escapeHtml(currentConversation.name)}!</h3>
          <p>This room is powered by the ConnectX multithreaded C++ TCP WebSocket server. Messages persist to Supabase PostgreSQL.</p>
        </div>

        <!-- Sample initial messages -->
        <div class="message-bubble received">
          <div class="msg-avatar">${getInitials('Alex Developer')}</div>
          <div class="msg-content-wrapper">
            <div class="msg-meta">
              <span class="msg-author">Alex Developer</span>
              <span class="msg-role-tag">Maintainer</span>
              <span class="msg-timestamp">${formatTimestamp(new Date(Date.now() - 3600000).toISOString())}</span>
            </div>
            <div class="msg-bubble-clay">
              Welcome to ConnectX! The C++ backend server is accepting connections over TCP sockets.
            </div>
          </div>
        </div>

        <div class="message-bubble received">
          <div class="msg-avatar" style="background: linear-gradient(135deg, #10B981, #059669);">${getInitials('Networking Bot')}</div>
          <div class="msg-content-wrapper">
            <div class="msg-meta">
              <span class="msg-author">Networking Bot</span>
              <span class="msg-role-tag bot">Bot</span>
              <span class="msg-timestamp">${formatTimestamp(new Date(Date.now() - 1800000).toISOString())}</span>
            </div>
            <div class="msg-bubble-clay">
              Boost.Beast WebSocket stream active. Keepalive ping/pong interval: 25s.
            </div>
          </div>
        </div>
      </div>

      <!-- Typing Indicator -->
      <div class="typing-bar" id="typing-bar" style="display: none;">
        <div class="typing-indicator-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="typing-label" id="typing-label">Alex Developer is typing…</span>
      </div>

      <!-- Emoji Quick Tray (Collapsible) -->
      <div class="emoji-tray" id="emoji-tray" style="display: none;">
        <button class="emoji-btn" data-emoji="😀">😀</button>
        <button class="emoji-btn" data-emoji="🚀">🚀</button>
        <button class="emoji-btn" data-emoji="🔥">🔥</button>
        <button class="emoji-btn" data-emoji="👍">👍</button>
        <button class="emoji-btn" data-emoji="❤️">❤️</button>
        <button class="emoji-btn" data-emoji="⚡">⚡</button>
        <button class="emoji-btn" data-emoji="🎉">🎉</button>
        <button class="emoji-btn" data-emoji="💻">💻</button>
      </div>

      <!-- Message Input Bar -->
      <div class="chat-input-bar">
        <div class="chat-input-clay-shell">
          <button class="btn btn-icon btn-ghost input-emoji-btn" id="toggle-emoji-btn" title="Add emoji">
            ${icons.smile}
          </button>
          <textarea
            id="message-textarea"
            class="chat-textarea"
            placeholder="Type your message to #${escapeHtml(currentConversation.name)}… (Enter to send)"
            rows="1"
            maxlength="65536"
          ></textarea>
          <button class="btn btn-primary btn-icon send-clay-btn" id="send-message-btn" title="Send (Enter)">
            ${icons.send}
          </button>
        </div>
      </div>
    </main>

    <!-- ── Right Sidebar (Room Members & Presence) ─────────────────────────── -->
    <aside class="sidebar-right open" id="sidebar-right">
      <div class="sidebar-right__head">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${icons.users}
          <span style="font-weight: 700; font-size: 14px;">Room Members</span>
        </div>
        <button class="btn btn-icon btn-ghost btn-mini" id="close-right-sidebar" title="Hide members">
          ${icons.close}
        </button>
      </div>

      <div class="members-search-box">
        <input class="input" id="members-filter" type="search" placeholder="Filter members…" style="font-size: 12px; padding: 8px 12px;" />
      </div>

      <div class="members-sections-scroll" id="members-list-content">
        <!-- Online Members -->
        <div class="members-category">
          <span class="members-category__title">Online — 2</span>
          <div class="member-item" data-member="alex">
            <div class="member-avatar">
              ${getInitials('Alex Developer')}
              <span class="status-dot online mini-dot"></span>
            </div>
            <div class="member-details">
              <span class="member-name">Alex Developer</span>
              <span class="member-tag">Maintainer</span>
            </div>
          </div>
          <div class="member-item" data-member="bot">
            <div class="member-avatar" style="background: linear-gradient(135deg, #10B981, #059669);">
              ${getInitials('Networking Bot')}
              <span class="status-dot online mini-dot"></span>
            </div>
            <div class="member-details">
              <span class="member-name">Networking Bot</span>
              <span class="member-tag">Automated</span>
            </div>
          </div>
        </div>

        <!-- Offline Members -->
        <div class="members-category" style="margin-top: 16px;">
          <span class="members-category__title">Offline — 1</span>
          <div class="member-item offline" data-member="sarah">
            <div class="member-avatar" style="opacity: 0.7;">
              ${getInitials('Sarah Engineer')}
              <span class="status-dot offline mini-dot"></span>
            </div>
            <div class="member-details">
              <span class="member-name">Sarah Engineer</span>
              <span class="member-tag">Member</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

  </div>
</div>

<!-- Modal Container (Dynamically populated) -->
<div id="modal-root"></div>
`;

  injectChatClayStyles();
  attachChatEventListeners();

  // Connect to C++ WebSocket backend
  wsService.connect();
  setupWebSocketSubscriptions();
}

function attachChatEventListeners() {
  // Mobile Left Sidebar Toggle
  document.getElementById('open-left-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar-left')?.classList.add('mobile-open');
  });
  document.getElementById('close-left-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar-left')?.classList.remove('mobile-open');
  });

  // Right Sidebar Toggle
  document.getElementById('toggle-members-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar-right')?.classList.toggle('open');
  });
  document.getElementById('close-right-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar-right')?.classList.remove('open');
  });

  // Settings & Logout
  document.getElementById('open-settings-btn')?.addEventListener('click', () => {
    window.location.hash = '#/settings';
  });
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    wsService.disconnect();
    await signOut();
  });

  // User Profile Modal on user pill click
  document.getElementById('my-profile-pill')?.addEventListener('click', openUserProfileModal);

  // Create Room Modal
  document.getElementById('create-room-btn')?.addEventListener('click', openCreateRoomModal);

  // New DM Modal
  document.getElementById('new-dm-btn')?.addEventListener('click', openNewDmModal);

  // Channel Item clicks (Rooms and DMs)
  setupChannelClickHandlers();

  // Sending Messages
  const sendBtn   = document.getElementById('send-message-btn');
  const textarea  = document.getElementById('message-textarea');

  sendBtn?.addEventListener('click', handleSendMessage);

  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Auto-resize textarea & emit typing indicator
  textarea?.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';

    if (currentConversation.id) {
      wsService.send({ type: 'typing_start', conversation_id: currentConversation.id });
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        wsService.send({ type: 'typing_stop', conversation_id: currentConversation.id });
      }, 1500);
    }
  });

  // Emoji Tray
  const emojiBtn  = document.getElementById('toggle-emoji-btn');
  const emojiTray = document.getElementById('emoji-tray');

  emojiBtn?.addEventListener('click', () => {
    const isVisible = emojiTray.style.display !== 'none';
    emojiTray.style.display = isVisible ? 'none' : 'flex';
  });

  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      if (textarea && emoji) {
        textarea.value += emoji;
        textarea.focus();
      }
      emojiTray.style.display = 'none';
    });
  });

  // Search in conversation list
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.channel-item').forEach(item => {
      const name = item.dataset.name?.toLowerCase() || '';
      item.style.display = name.includes(query) ? 'flex' : 'none';
    });
  });

  // Member filter
  document.getElementById('members-filter')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.member-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query) ? 'flex' : 'none';
    });
  });
}

function setupChannelClickHandlers() {
  document.querySelectorAll('.channel-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.channel-item').forEach(c => c.classList.remove('active'));
      item.classList.add('active');

      const id = item.dataset.id;
      const name = item.dataset.name;
      const type = item.dataset.type;
      const desc = item.dataset.desc;

      switchConversation(id, name, type, desc);

      // On mobile, close left sidebar on selection
      document.getElementById('sidebar-left')?.classList.remove('mobile-open');
    });
  });
}

function switchConversation(id, name, type, desc) {
  currentConversation = { id, name, type, description: desc };

  const prefixEl = document.getElementById('conv-prefix');
  const nameEl   = document.getElementById('conv-name');
  const descEl   = document.getElementById('conv-desc');
  const badgeEl  = document.getElementById('conv-badge');
  const txtarea  = document.getElementById('message-textarea');

  if (prefixEl) prefixEl.textContent = type === 'room' ? '#' : '@';
  if (nameEl)   nameEl.textContent = name;
  if (descEl)   descEl.textContent = desc;
  if (badgeEl)  badgeEl.textContent = type === 'room' ? 'Public Room' : 'Direct Message';
  if (txtarea)  txtarea.placeholder = `Type your message to ${type === 'room' ? '#' : '@'}${name}…`;

  // Clear messages and load history
  const container = document.getElementById('messages-container');
  if (container) {
    container.innerHTML = `
      <div class="chat-welcome-banner clay-card">
        <div class="welcome-icon">${type === 'room' ? icons.hash : icons.users}</div>
        <h3>${type === 'room' ? 'Start of #' + escapeHtml(name) : 'Direct message with ' + escapeHtml(name)}</h3>
        <p>${escapeHtml(desc)}</p>
      </div>
    `;
  }

  // Request history from C++ server
  wsService.send({ type: 'load_history', conversation_id: id, limit: 50 });
}

function handleSendMessage() {
  const textarea = document.getElementById('message-textarea');
  if (!textarea) return;
  const content = textarea.value.trim();
  if (!content) return;

  const payload = {
    type: currentConversation.type === 'dm' ? 'private_message' : 'chat_message',
    conversation_id: currentConversation.id,
    content
  };

  if (currentConversation.type === 'dm') {
    payload.recipient_user_id = currentConversation.id;
  }

  // Send via WebSocket to C++ Backend
  wsService.send(payload);

  // Optimistic UI Append for zero lag
  appendMessageBubble({
    id: 'local-' + Date.now(),
    sender_id: currentUser?.id,
    sender_name: currentUser?.user_metadata?.full_name || currentUser?.email || 'You',
    content,
    created_at: new Date().toISOString(),
    isOwn: true
  });

  textarea.value = '';
  textarea.style.height = 'auto';
  textarea.focus();
}

function appendMessageBubble(msg) {
  const container = document.getElementById('messages-container');
  if (!container) return;

  const isOwn = msg.isOwn || msg.sender_id === currentUser?.id;
  const senderName = isOwn ? 'You' : (msg.sender_name || msg.sender_username || 'User');

  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${isOwn ? 'sent' : 'received'}`;
  if (msg.id) bubble.dataset.id = msg.id;

  bubble.innerHTML = `
    ${!isOwn ? `<div class="msg-avatar">${getInitials(senderName)}</div>` : ''}
    <div class="msg-content-wrapper">
      <div class="msg-meta" style="${isOwn ? 'justify-content: flex-end;' : ''}">
        <span class="msg-author">${escapeHtml(senderName)}</span>
        <span class="msg-timestamp">${formatTimestamp(msg.created_at)}</span>
      </div>
      <div class="msg-bubble-clay ${isOwn ? 'own' : ''}">
        ${linkify(escapeHtml(msg.content))}
      </div>
    </div>
    ${isOwn ? `<div class="msg-avatar own">${getInitials(senderName)}</div>` : ''}
  `;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function setupWebSocketSubscriptions() {
  // Connection status pill updates
  wsService.on('status', ({ status }) => {
    const dot   = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    const pill  = document.getElementById('conn-pill');
    if (!dot || !label) return;

    dot.className = `status-dot ${status === 'connected' ? 'online' : status === 'connecting' || status === 'reconnecting' ? 'connecting' : 'offline'}`;
    label.textContent = {
      connecting:   'Connecting to C++ socket…',
      connected:    'Connected (C++ WebSocket)',
      reconnecting: 'Reconnecting to server…',
      error:        'Socket connection error',
      disconnected: 'Disconnected',
    }[status] || status;

    if (pill) {
      pill.style.background = status === 'connected' ? 'var(--color-success-light)' : 'var(--clay-surface-subtle)';
    }
  });

  // Incoming Messages
  wsService.on('message_received', (evt) => {
    if (evt.conversation_id === currentConversation.id && evt.message) {
      appendMessageBubble({
        ...evt.message,
        isOwn: evt.message.sender_id === currentUser?.id
      });
    }
  });

  wsService.on('private_message', (evt) => {
    if (evt.conversation_id === currentConversation.id && evt.message) {
      appendMessageBubble({
        ...evt.message,
        isOwn: evt.message.sender_id === currentUser?.id
      });
    }
  });

  // Typing notifications
  wsService.on('typing_start', (evt) => {
    if (evt.conversation_id === currentConversation.id) {
      typingUsers.set(evt.user_id, evt.username);
      updateTypingBar();
    }
  });

  wsService.on('typing_stop', (evt) => {
    if (evt.conversation_id === currentConversation.id) {
      typingUsers.delete(evt.user_id);
      updateTypingBar();
    }
  });

  // Room creation broadcast
  wsService.on('room_created', (evt) => {
    if (evt.room) {
      addRoomItemToSidebar(evt.room);
      showToast(`New room #${evt.room.name} created!`, 'success');
    }
  });
}

function updateTypingBar() {
  const bar   = document.getElementById('typing-bar');
  const label = document.getElementById('typing-label');
  if (!bar || !label) return;

  if (typingUsers.size === 0) {
    bar.style.display = 'none';
  } else {
    const names = Array.from(typingUsers.values()).slice(0, 3).join(', ');
    label.textContent = `${names} ${typingUsers.size === 1 ? 'is' : 'are'} typing…`;
    bar.style.display = 'flex';
  }
}

function addRoomItemToSidebar(room) {
  const list = document.getElementById('room-list');
  if (!list) return;

  const item = document.createElement('div');
  item.className = 'channel-item';
  item.dataset.type = 'room';
  item.dataset.id = room.id;
  item.dataset.name = room.name;
  item.dataset.desc = room.description || '';

  item.innerHTML = `
    <span class="channel-icon">${icons.hash}</span>
    <span class="channel-label">${escapeHtml(room.name)}</span>
  `;

  list.appendChild(item);
  setupChannelClickHandlers();
}

/* ─── Clay Modals ──────────────────────────────────────────────────────────── */
function openCreateRoomModal() {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="clay-modal-overlay" id="modal-overlay">
      <div class="clay-modal">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="font-size: 20px; font-weight: 800; color: var(--text-primary);">Create Chat Room</h3>
          <button class="btn btn-icon btn-ghost btn-mini" id="modal-close-btn">${icons.close}</button>
        </div>
        <form id="create-room-form">
          <div class="input-group" style="margin-bottom: 16px;">
            <label for="new-room-name">Room Name</label>
            <input class="input" id="new-room-name" type="text" placeholder="e.g. dev-discussion" required />
          </div>
          <div class="input-group" style="margin-bottom: 24px;">
            <label for="new-room-desc">Description</label>
            <input class="input" id="new-room-desc" type="text" placeholder="What is this room about?" />
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="modal-submit-btn">Create Room</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);

  document.getElementById('create-room-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-room-name')?.value.trim();
    const desc = document.getElementById('new-room-desc')?.value.trim() || '';
    if (!name) return;

    wsService.send({ type: 'create_room', name, description: desc });
    addRoomItemToSidebar({ id: name.toLowerCase().replace(/\s+/g, '-'), name, description: desc });
    showToast(`Room #${name} created!`, 'success');
    closeModal();
  });
}

function openNewDmModal() {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="clay-modal-overlay">
      <div class="clay-modal">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="font-size: 20px; font-weight: 800; color: var(--text-primary);">New Direct Message</h3>
          <button class="btn btn-icon btn-ghost btn-mini" id="dm-modal-close">${icons.close}</button>
        </div>
        <div class="input-group" style="margin-bottom: 16px;">
          <label>Find User by Username</label>
          <input class="input" id="dm-user-search" type="text" placeholder="Type username..." />
        </div>
        <div class="dm-candidate-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
          <div class="member-item" data-username="alex_dev" data-name="Alex Developer" style="cursor: pointer;">
            <div class="member-avatar">${getInitials('Alex Developer')}</div>
            <div class="member-details">
              <span class="member-name">Alex Developer</span>
              <span class="member-tag">@alex_dev</span>
            </div>
          </div>
          <div class="member-item" data-username="sarah_cpp" data-name="Sarah Engineer" style="cursor: pointer; margin-top: 8px;">
            <div class="member-avatar">${getInitials('Sarah Engineer')}</div>
            <div class="member-details">
              <span class="member-name">Sarah Engineer</span>
              <span class="member-tag">@sarah_cpp</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  document.getElementById('dm-modal-close')?.addEventListener('click', closeModal);

  document.querySelectorAll('.dm-candidate-list .member-item').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.name;
      const uname = el.dataset.username;
      switchConversation('dm-' + uname, name, 'dm', `Direct conversation with @${uname}`);
      closeModal();
    });
  });
}

function openUserProfileModal() {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  const name = currentUser.user_metadata?.full_name || currentUser.email;
  const username = currentUser.user_metadata?.username || 'user';

  modalRoot.innerHTML = `
    <div class="clay-modal-overlay">
      <div class="clay-modal" style="text-align: center;">
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-icon btn-ghost btn-mini" id="profile-modal-close">${icons.close}</button>
        </div>
        <div style="
          width: 72px; height: 72px; border-radius: 50%;
          background: var(--color-accent-gradient);
          color: #FFF; font-size: 26px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          margin: -10px auto 16px;
          box-shadow: 4px 6px 16px rgba(99,102,241,0.35);
        ">
          ${getInitials(name)}
        </div>
        <h3 style="font-size: 22px; font-weight: 800; color: var(--text-primary);">${escapeHtml(name)}</h3>
        <p style="color: var(--color-accent); font-weight: 600; font-size: 14px; margin-bottom: 20px;">@${escapeHtml(username)}</p>

        <div class="clay-card" style="padding: 16px; text-align: left; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
            <span style="color: var(--text-muted);">Connection:</span>
            <span class="clay-badge clay-badge-success">TCP Socket Connected</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
            <span style="color: var(--text-muted);">Backend Engine:</span>
            <span style="font-weight: 600;">C++17 Boost.Asio</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span style="color: var(--text-muted);">Email:</span>
            <span style="font-weight: 600; font-family: var(--font-mono); font-size: 12px;">${escapeHtml(currentUser.email)}</span>
          </div>
        </div>

        <button class="btn btn-primary" id="profile-edit-btn" style="width: 100%;">
          ${icons.settings} Open Full Settings
        </button>
      </div>
    </div>
  `;

  document.getElementById('profile-modal-close')?.addEventListener('click', () => { modalRoot.innerHTML = ''; });
  document.getElementById('profile-edit-btn')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
    window.location.hash = '#/settings';
  });
}

function injectChatClayStyles() {
  const id = 'chat-clay-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.chat-viewport {
  width: 100vw;
  height: 100vh;
  padding: 16px;
  background: var(--clay-bg);
  display: flex;
  box-sizing: border-box;
  overflow: hidden;
}

.chat-window-clay {
  width: 100%;
  height: 100%;
  padding: 0;
  display: grid;
  grid-template-columns: 280px 1fr 260px;
  overflow: hidden;
  border-radius: var(--radius-xl);
  transition: grid-template-columns var(--transition);
}

.chat-window-clay:not(:has(#sidebar-right.open)) {
  grid-template-columns: 280px 1fr 0px;
}

/* ─── Left Sidebar ───────────────────────── */
.sidebar-left {
  background: var(--clay-surface-subtle);
  border-right: 1px solid var(--clay-border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-brand {
  padding: 20px 20px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-title {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.conn-pill {
  margin: 0 16px 12px;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  background: var(--clay-surface);
  box-shadow: var(--clay-shadow-sm);
  border: 1px solid var(--clay-border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.sidebar-search-box {
  padding: 0 16px 12px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 28px;
  top: 10px;
  color: var(--text-dim);
  pointer-events: none;
}

.sidebar-search-box .input {
  padding-left: 36px;
  font-size: 13px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.sidebar-scrollable {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
}

.channel-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.btn-mini {
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 8px;
}

.channel-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.channel-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition);
  border: 1px solid transparent;
}

.channel-item:hover {
  background: #FFFFFF;
  color: var(--color-accent);
  box-shadow: var(--clay-shadow-sm);
  border-color: var(--clay-border);
}

.channel-item.active {
  background: #FFFFFF;
  color: var(--color-accent);
  box-shadow: var(--clay-shadow-sm);
  border-color: var(--clay-border);
}

.channel-icon {
  color: var(--text-dim);
  display: flex;
  align-items: center;
}

.channel-avatar {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--color-accent-gradient);
  color: #FFF;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.mini-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
}

.sidebar-footer {
  padding: 14px 16px;
  background: var(--clay-surface);
  border-top: 1px solid var(--clay-border-subtle);
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-pill {
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: transform var(--transition);
}
.user-pill:hover { transform: translateY(-2px); }

.user-avatar-clay {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--color-accent-gradient);
  color: #FFF;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 2px 3px 8px rgba(99,102,241,0.3);
  flex-shrink: 0;
}

.my-status-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
}

.user-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-handle {
  font-size: 11px;
  color: var(--text-muted);
}

.sidebar-quick-actions {
  display: flex;
  gap: 6px;
}

/* ─── Chat Main ──────────────────────────── */
.chat-main {
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  overflow: hidden;
}

.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--clay-border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-prefix {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-dim);
}

.header-name {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.header-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-welcome-banner {
  text-align: center;
  padding: 24px;
  margin-bottom: 12px;
  background: var(--clay-surface-subtle);
}

.welcome-icon {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: var(--color-accent-light);
  color: var(--color-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.message-bubble {
  display: flex;
  gap: 12px;
  max-width: 80%;
  animation: bubblePop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.message-bubble.sent {
  align-self: flex-end;
  justify-content: flex-end;
}

@keyframes bubblePop {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.msg-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.msg-author {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.msg-role-tag {
  font-size: 10px;
  font-weight: 700;
  background: var(--color-accent-light);
  color: var(--color-accent);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
}
.msg-role-tag.bot {
  background: var(--color-success-light);
  color: #065F46;
}

.msg-timestamp {
  font-size: 11px;
  color: var(--text-dim);
}

.msg-bubble-clay {
  background: #FFFFFF;
  border-radius: 18px 18px 18px 4px;
  padding: 12px 18px;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
  box-shadow: 3px 6px 16px rgba(160, 174, 200, 0.22),
              inset 1px 1px 2px #FFFFFF;
  border: 1px solid var(--clay-border);
  word-break: break-word;
  white-space: pre-wrap;
}

.msg-bubble-clay.own {
  background: var(--color-accent-gradient);
  color: #FFFFFF;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 3px 6px 16px rgba(99, 102, 241, 0.35),
              inset 1px 1px 2px rgba(255, 255, 255, 0.4);
}

.typing-bar {
  padding: 6px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

.typing-indicator-dots {
  display: flex;
  gap: 3px;
}

.typing-indicator-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: typingBounce 1.2s infinite ease-in-out;
}
.typing-indicator-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1.1); opacity: 1; }
}

.emoji-tray {
  padding: 8px 24px;
  display: flex;
  gap: 8px;
  background: var(--clay-surface-subtle);
  border-top: 1px solid var(--clay-border-subtle);
}

.emoji-btn {
  background: #FFFFFF;
  border: 1px solid var(--clay-border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: 18px;
  cursor: pointer;
  box-shadow: var(--clay-shadow-sm);
  transition: transform var(--transition);
}
.emoji-btn:hover { transform: scale(1.15); }

.chat-input-bar {
  padding: 16px 24px;
  background: #FFFFFF;
  border-top: 1px solid var(--clay-border-subtle);
}

.chat-input-clay-shell {
  background: var(--clay-inset);
  border-radius: var(--radius-lg);
  border: 1px solid var(--clay-border-subtle);
  box-shadow: var(--clay-shadow-inset);
  padding: 8px 12px;
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.chat-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  max-height: 140px;
  padding: 6px 0;
}
.chat-textarea::placeholder { color: var(--text-dim); }

.send-clay-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  flex-shrink: 0;
}

/* ─── Right Sidebar ──────────────────────── */
.sidebar-right {
  background: var(--clay-surface-subtle);
  border-left: 1px solid var(--clay-border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width var(--transition);
  width: 260px;
}

.sidebar-right:not(.open) {
  width: 0;
  display: none;
}

.sidebar-right__head {
  padding: 20px 18px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.members-search-box {
  padding: 0 16px 12px;
}

.members-sections-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.members-category__title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-dim);
  display: block;
  margin-bottom: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  transition: background var(--transition);
}
.member-item:hover {
  background: #FFFFFF;
  box-shadow: var(--clay-shadow-sm);
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--color-accent-gradient);
  color: #FFF;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.member-details {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.member-tag {
  font-size: 11px;
  color: var(--text-muted);
}

/* ─── Mobile Responsive ──────────────────── */
@media (max-width: 900px) {
  .chat-viewport { padding: 0; }
  .chat-window-clay {
    border-radius: 0;
    grid-template-columns: 1fr;
  }
  .sidebar-left {
    position: fixed;
    top: 0; left: -320px;
    width: 300px;
    height: 100%;
    z-index: 1000;
    transition: left var(--transition);
    box-shadow: var(--clay-shadow-floating);
  }
  .sidebar-left.mobile-open {
    left: 0;
  }
  .sidebar-right {
    position: fixed;
    top: 0; right: 0;
    width: 280px;
    height: 100%;
    z-index: 1000;
    box-shadow: var(--clay-shadow-floating);
  }
}
  `;
  document.head.appendChild(style);
}

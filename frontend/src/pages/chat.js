/**
 * ConnectX Main Chat Dashboard — Fully Functional Claymorphic SPA
 * 75% White / Cloud palette with 25% Violet / Slate contrast
 * Fully wired to C++ Boost.Beast WebSocket Backend
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
  description: 'General discussion for everyone on ConnectX C++ server'
};

let activeRooms = [
  { id: 'general', name: 'general', description: 'General discussion for everyone on ConnectX' },
  { id: 'tech-talk', name: 'tech-talk', description: 'C++ socket programming, Boost.Asio & networking' },
  { id: 'announcements', name: 'announcements', description: 'System news and server updates' }
];

let directMessages = new Map(); // id -> { id, username, name, isOnline, unreadCount }
let roomMembers = new Map();    // userId -> { id, username, display_name, isOnline }
let unreadCounts = new Map();   // convId -> count
let typingTimer = null;
const typingUsers = new Map();  // userId -> username

export async function renderChat(container) {
  const session = await getSession();
  currentUser = session?.user || {
    id: 'guest_' + Math.floor(Math.random() * 8999 + 1000),
    email: 'guest@connectx.local',
    user_metadata: { full_name: 'Guest Developer', username: 'guest_user' }
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
            ${renderRoomListHtml()}
          </div>
        </div>

        <!-- Direct Messages Section -->
        <div class="channel-section" style="margin-top: 14px;">
          <div class="channel-section__head">
            <span>Direct Messages</span>
            <button class="btn btn-icon btn-ghost btn-mini" id="new-dm-btn" title="New direct message">
              ${icons.plus}
            </button>
          </div>
          <div class="channel-list" id="dm-list">
            ${renderDmListHtml()}
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
              <h2 class="header-name" id="conv-name">${escapeHtml(currentConversation.name)}</h2>
              <span class="clay-badge clay-badge-accent" id="conv-badge" style="font-size: 11px;">Public Room</span>
            </div>
            <p class="header-desc" id="conv-desc">${escapeHtml(currentConversation.description)}</p>
          </div>
        </div>

        <div class="header-right">
          <button class="btn btn-secondary btn-sm" id="toggle-members-btn" title="Toggle participant members">
            ${icons.users}
            <span class="hide-mobile" id="members-count-badge">Members</span>
          </button>
        </div>
      </header>

      <!-- Message History Scroll Area -->
      <div class="messages-container" id="messages-container">
        <!-- Welcoming Clay Banner -->
        <div class="chat-welcome-banner clay-card" id="welcome-banner">
          <div class="welcome-icon">${icons.radio}</div>
          <h3>Welcome to #${escapeHtml(currentConversation.name)}!</h3>
          <p>Powered by the ConnectX C++ TCP WebSocket backend. Messages persist in Supabase PostgreSQL.</p>
        </div>
        <!-- Real messages load here dynamically from C++ server -->
      </div>

      <!-- Typing Indicator -->
      <div class="typing-bar" id="typing-bar" style="display: none;">
        <div class="typing-indicator-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="typing-label" id="typing-label">Someone is typing…</span>
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
        ${renderMembersListHtml()}
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

  // Load initial history and rooms
  setTimeout(() => {
    wsService.send({ type: 'list_rooms' });
    wsService.send({ type: 'load_history', conversation_id: currentConversation.id, limit: 50 });
    wsService.send({ type: 'get_room_members', room_id: currentConversation.id });
  }, 250);
}

function renderRoomListHtml() {
  return activeRooms.map(r => {
    const isActive = r.id === currentConversation.id;
    const unread = unreadCounts.get(r.id) || 0;
    return `
      <div class="channel-item ${isActive ? 'active' : ''}" data-type="room" data-id="${r.id}" data-name="${escapeHtml(r.name)}" data-desc="${escapeHtml(r.description || '')}">
        <span class="channel-icon">${icons.hash}</span>
        <span class="channel-label">${escapeHtml(r.name)}</span>
        ${unread > 0 ? `<span class="clay-unread-badge">${unread}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderDmListHtml() {
  if (directMessages.size === 0) {
    return `<div style="padding: 10px 14px; font-size: 12px; color: var(--text-dim);">No direct messages yet. Click + to start one!</div>`;
  }
  let html = '';
  directMessages.forEach((dm) => {
    const isActive = dm.id === currentConversation.id;
    const unread = unreadCounts.get(dm.id) || 0;
    html += `
      <div class="channel-item ${isActive ? 'active' : ''}" data-type="dm" data-id="${dm.id}" data-name="${escapeHtml(dm.name)}" data-desc="Direct conversation with @${escapeHtml(dm.username)}">
        <div class="channel-avatar">
          ${getInitials(dm.name)}
          <span class="status-dot ${dm.isOnline ? 'online' : 'offline'} mini-dot"></span>
        </div>
        <span class="channel-label">${escapeHtml(dm.name)}</span>
        ${unread > 0 ? `<span class="clay-unread-badge">${unread}</span>` : ''}
      </div>
    `;
  });
  return html;
}

function renderMembersListHtml() {
  // Always include current user
  const allMembers = new Map(roomMembers);
  if (currentUser) {
    const curName = currentUser.user_metadata?.full_name || currentUser.email;
    const curUname = currentUser.user_metadata?.username || 'me';
    allMembers.set(currentUser.id, {
      id: currentUser.id,
      username: curUname,
      display_name: curName + ' (You)',
      isOnline: true
    });
  }

  const onlineList = [];
  const offlineList = [];

  allMembers.forEach(m => {
    if (m.isOnline) onlineList.push(m);
    else offlineList.push(m);
  });

  return `
    <div class="members-category">
      <span class="members-category__title">Online — ${onlineList.length}</span>
      ${onlineList.map(m => `
        <div class="member-item" data-uid="${m.id}" data-name="${escapeHtml(m.display_name)}" data-username="${escapeHtml(m.username)}" style="cursor: pointer;">
          <div class="member-avatar">
            ${getInitials(m.display_name)}
            <span class="status-dot online mini-dot"></span>
          </div>
          <div class="member-details">
            <span class="member-name">${escapeHtml(m.display_name)}</span>
            <span class="member-tag">@${escapeHtml(m.username)}</span>
          </div>
        </div>
      `).join('')}
    </div>

    ${offlineList.length > 0 ? `
      <div class="members-category" style="margin-top: 16px;">
        <span class="members-category__title">Offline — ${offlineList.length}</span>
        ${offlineList.map(m => `
          <div class="member-item offline" data-uid="${m.id}" data-name="${escapeHtml(m.display_name)}" data-username="${escapeHtml(m.username)}" style="cursor: pointer;">
            <div class="member-avatar" style="opacity: 0.7;">
              ${getInitials(m.display_name)}
              <span class="status-dot offline mini-dot"></span>
            </div>
            <div class="member-details">
              <span class="member-name">${escapeHtml(m.display_name)}</span>
              <span class="member-tag">@${escapeHtml(m.username)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
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

  // Channel Item clicks
  setupChannelClickHandlers();

  // Member Item clicks to start direct message
  setupMemberClickHandlers();

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

      // Clear unread count for this conversation
      unreadCounts.set(id, 0);
      const unreadBadge = item.querySelector('.clay-unread-badge');
      if (unreadBadge) unreadBadge.remove();

      switchConversation(id, name, type, desc);

      // On mobile, close left sidebar on selection
      document.getElementById('sidebar-left')?.classList.remove('mobile-open');
    });
  });
}

function setupMemberClickHandlers() {
  document.querySelectorAll('.member-item').forEach(item => {
    item.addEventListener('click', () => {
      const targetUid = item.dataset.uid;
      const targetName = item.dataset.name;
      const targetUname = item.dataset.username;

      if (!targetUid || targetUid === currentUser?.id) return;

      const dmId = 'dm-' + (currentUser.id < targetUid ? currentUser.id + '-' + targetUid : targetUid + '-' + currentUser.id);

      // Add to directMessages map
      directMessages.set(dmId, {
        id: dmId,
        targetUid,
        username: targetUname,
        name: targetName,
        isOnline: true
      });

      // Update dm list
      const dmListEl = document.getElementById('dm-list');
      if (dmListEl) {
        dmListEl.innerHTML = renderDmListHtml();
        setupChannelClickHandlers();
      }

      switchConversation(dmId, targetName, 'dm', `Direct conversation with @${targetUname}`);
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

  // Render welcome banner
  const container = document.getElementById('messages-container');
  if (container) {
    container.innerHTML = `
      <div class="chat-welcome-banner clay-card">
        <div class="welcome-icon">${type === 'room' ? icons.hash : icons.users}</div>
        <h3>${type === 'room' ? 'Start of #' + escapeHtml(name) : 'Direct conversation with ' + escapeHtml(name)}</h3>
        <p>${escapeHtml(desc)}</p>
      </div>
    `;
  }

  // Request history from C++ server
  wsService.send({ type: 'load_history', conversation_id: id, limit: 50 });

  // If room, request room members
  if (type === 'room') {
    wsService.send({ type: 'get_room_members', room_id: id });
  }
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
    // If DM, check target UID
    const dmInfo = directMessages.get(currentConversation.id);
    if (dmInfo?.targetUid) {
      payload.recipient_id = dmInfo.targetUid;
      payload.recipient_user_id = dmInfo.targetUid;
    }
  }

  // Send via WebSocket to C++ Backend
  wsService.send(payload);

  // Optimistic UI Append for zero lag
  appendMessageBubble({
    id: 'local-' + Date.now(),
    conversation_id: currentConversation.id,
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
  const senderName = isOwn ? 'You' : (msg.sender_display || msg.sender_display_name || msg.sender_name || msg.sender_username || 'User');

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

    if (status === 'connected') {
      wsService.send({ type: 'list_rooms' });
      wsService.send({ type: 'load_history', conversation_id: currentConversation.id, limit: 50 });
      wsService.send({ type: 'get_room_members', room_id: currentConversation.id });
    }
  });

  // Authenticated confirmation from C++
  wsService.on('authenticated', (msg) => {
    const u = msg.data || msg.user;
    if (u) {
      console.log('[ConnectX] Authenticated on C++ server as:', u.user_id || u.id);
    }
    wsService.send({ type: 'list_rooms' });
  });

  // Incoming Messages (Both new_message and message_received envelopes)
  const onIncomingMessage = (msgData, convId) => {
    if (!msgData) return;
    const cid = convId || msgData.conversation_id;

    if (cid === currentConversation.id) {
      // Avoid duplicate append if already in DOM from optimistic render
      if (msgData.id && document.querySelector(`.message-bubble[data-id="${msgData.id}"]`)) return;
      appendMessageBubble({
        ...msgData,
        isOwn: msgData.sender_id === currentUser?.id
      });
      // Mark read
      if (msgData.id) {
        wsService.send({ type: 'mark_read', message_id: msgData.id });
      }
    } else {
      // Increment unread count for inactive conversation
      const current = unreadCounts.get(cid) || 0;
      unreadCounts.set(cid, current + 1);

      // Add to DM list if it was a private message
      if (cid && cid.startsWith('dm-') && !directMessages.has(cid)) {
        directMessages.set(cid, {
          id: cid,
          username: msgData.sender_username || 'user',
          name: msgData.sender_display || msgData.sender_username || 'User',
          isOnline: true
        });
      }

      // Re-render channel items
      const roomListEl = document.getElementById('room-list');
      const dmListEl = document.getElementById('dm-list');
      if (roomListEl) roomListEl.innerHTML = renderRoomListHtml();
      if (dmListEl) dmListEl.innerHTML = renderDmListHtml();
      setupChannelClickHandlers();

      showToast(`New message in ${cid.startsWith('dm-') ? '@' + (msgData.sender_display || 'User') : '#' + cid}: "${msgData.content.slice(0, 32)}..."`, 'info');
    }
  };

  wsService.on('new_message', (evt) => {
    const msg = evt.data || evt.message || evt;
    onIncomingMessage(msg, evt.conversation_id || msg.conversation_id);
  });

  wsService.on('message_received', (evt) => {
    const msg = evt.data || evt.message || evt;
    onIncomingMessage(msg, evt.conversation_id || msg.conversation_id);
  });

  wsService.on('private_message', (evt) => {
    const msg = evt.data || evt.message || evt;
    onIncomingMessage(msg, evt.conversation_id || msg.conversation_id);
  });

  // History payload loaded from PostgreSQL / C++
  wsService.on('history', (evt) => {
    const data = evt.data || evt;
    if (data.conversation_id === currentConversation.id && Array.isArray(data.messages)) {
      const container = document.getElementById('messages-container');
      if (container) {
        // Keep welcome banner
        container.innerHTML = `
          <div class="chat-welcome-banner clay-card">
            <div class="welcome-icon">${currentConversation.type === 'room' ? icons.hash : icons.users}</div>
            <h3>${currentConversation.type === 'room' ? 'Start of #' + escapeHtml(currentConversation.name) : 'Direct conversation with ' + escapeHtml(currentConversation.name)}</h3>
            <p>${escapeHtml(currentConversation.description)}</p>
          </div>
        `;
        data.messages.forEach(m => {
          appendMessageBubble({
            ...m,
            isOwn: m.sender_id === currentUser?.id
          });
        });
      }
    }
  });

  // Room list loaded from C++ server
  wsService.on('room_list', (evt) => {
    const list = evt.rooms || evt.data?.rooms;
    if (Array.isArray(list) && list.length > 0) {
      activeRooms = list;
      const roomListEl = document.getElementById('room-list');
      if (roomListEl) {
        roomListEl.innerHTML = renderRoomListHtml();
        setupChannelClickHandlers();
      }
    }
  });

  // Room members loaded from C++ server
  wsService.on('room_members', (evt) => {
    const members = evt.members || evt.data?.members;
    if (Array.isArray(members)) {
      roomMembers.clear();
      members.forEach(m => {
        roomMembers.set(m.id, {
          id: m.id,
          username: m.username || m.id,
          display_name: m.display_name || m.username || 'User',
          isOnline: m.is_online !== undefined ? m.is_online : true
        });
      });
      const membersContentEl = document.getElementById('members-list-content');
      if (membersContentEl) {
        membersContentEl.innerHTML = renderMembersListHtml();
        setupMemberClickHandlers();
      }
      const countBadge = document.getElementById('members-count-badge');
      if (countBadge) {
        countBadge.textContent = `${roomMembers.size + 1} Members`;
      }
    }
  });

  // Live User Presence events
  wsService.on('user_online', (evt) => {
    const u = evt.data || evt;
    if (u.user_id && u.user_id !== currentUser?.id) {
      roomMembers.set(u.user_id, {
        id: u.user_id,
        username: u.username || u.user_id,
        display_name: u.display_name || u.username || 'User',
        isOnline: true
      });
      const membersContentEl = document.getElementById('members-list-content');
      if (membersContentEl) {
        membersContentEl.innerHTML = renderMembersListHtml();
        setupMemberClickHandlers();
      }
    }
  });

  wsService.on('user_offline', (evt) => {
    const u = evt.data || evt;
    if (u.user_id && roomMembers.has(u.user_id)) {
      const existing = roomMembers.get(u.user_id);
      existing.isOnline = false;
      const membersContentEl = document.getElementById('members-list-content');
      if (membersContentEl) {
        membersContentEl.innerHTML = renderMembersListHtml();
        setupMemberClickHandlers();
      }
    }
  });

  // Typing notifications
  wsService.on('typing_start', (evt) => {
    const data = evt.data || evt;
    if (data.conversation_id === currentConversation.id && data.user_id !== currentUser?.id) {
      typingUsers.set(data.user_id, data.username || 'Someone');
      updateTypingBar();
    }
  });

  wsService.on('typing_stop', (evt) => {
    const data = evt.data || evt;
    if (data.conversation_id === currentConversation.id) {
      typingUsers.delete(data.user_id);
      updateTypingBar();
    }
  });

  // Room creation broadcast
  wsService.on('room_created', (evt) => {
    const room = evt.room || evt.data;
    if (room && room.name) {
      if (!activeRooms.some(r => r.id === room.id)) {
        activeRooms.push(room);
        const roomListEl = document.getElementById('room-list');
        if (roomListEl) {
          roomListEl.innerHTML = renderRoomListHtml();
          setupChannelClickHandlers();
        }
      }
      showToast(`New room #${room.name} created!`, 'success');
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
            <input class="input" id="new-room-name" type="text" placeholder="e.g. distributed-systems" required />
          </div>
          <div class="input-group" style="margin-bottom: 24px;">
            <label for="new-room-desc">Description</label>
            <input class="input" id="new-room-desc" type="text" placeholder="What is this channel about?" />
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
          <label>Enter Recipient Username or User ID</label>
          <input class="input" id="dm-user-search" type="text" placeholder="e.g. alex_dev or user id..." />
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="dm-modal-cancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="dm-modal-start">Start Chat</button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  document.getElementById('dm-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('dm-modal-cancel')?.addEventListener('click', closeModal);

  document.getElementById('dm-modal-start')?.addEventListener('click', () => {
    const inputVal = document.getElementById('dm-user-search')?.value.trim();
    if (!inputVal) return;

    const targetUid = inputVal;
    const dmId = 'dm-' + (currentUser.id < targetUid ? currentUser.id + '-' + targetUid : targetUid + '-' + currentUser.id);

    directMessages.set(dmId, {
      id: dmId,
      targetUid,
      username: targetUid,
      name: targetUid,
      isOnline: true
    });

    const dmListEl = document.getElementById('dm-list');
    if (dmListEl) {
      dmListEl.innerHTML = renderDmListHtml();
      setupChannelClickHandlers();
    }

    switchConversation(dmId, targetUid, 'dm', `Direct conversation with @${targetUid}`);
    closeModal();
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
  position: relative;
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

.clay-unread-badge {
  margin-left: auto;
  background: var(--color-accent);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  box-shadow: 1px 2px 5px rgba(99, 102, 241, 0.4);
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

/**
 * ConnectX Settings Page — Claymorphic Design
 */

import { getSession, signOut, supabase } from '../auth/session.js';
import { showToast }                      from '../utils/toast.js';
import { icons }                          from '../utils/icons.js';
import { getInitials, escapeHtml }        from '../utils/format.js';

export async function renderSettings(container) {
  const session = await getSession();
  const user = session?.user || {
    id: 'guest',
    email: 'guest@connectx.local',
    user_metadata: { full_name: 'Guest Developer', username: 'guest_dev' }
  };

  container.innerHTML = `
<div class="settings-viewport">
  <div class="settings-card-clay clay-card-floating">

    <!-- Settings Sidebar Nav -->
    <aside class="settings-sidebar">
      <div class="settings-header">
        <a href="#/chat" class="back-pill-btn">
          ← Back to Chat
        </a>
      </div>

      <div class="settings-profile-summary">
        <div class="settings-avatar-clay">
          ${getInitials(user.user_metadata?.full_name || user.email)}
        </div>
        <strong style="font-size: 15px;">${escapeHtml(user.user_metadata?.full_name || 'User')}</strong>
        <span style="font-size: 12px; color: var(--color-accent); font-weight: 600;">@${escapeHtml(user.user_metadata?.username || 'user')}</span>
      </div>

      <nav class="settings-nav-list">
        <button class="settings-nav-btn active" data-tab="profile">
          ${icons.users} Profile &amp; Account
        </button>
        <button class="settings-nav-btn" data-tab="appearance">
          ${icons.smile} Claymorphism Theme
        </button>
        <button class="settings-nav-btn" data-tab="notifications">
          <span style="font-size: 16px;">🔔</span> Notifications
        </button>
        <button class="settings-nav-btn" data-tab="telemetry">
          ${icons.cpu} C++ Backend Info
        </button>
      </nav>

      <div class="settings-sidebar-bottom">
        <button class="btn btn-danger btn-sm" id="settings-logout-btn" style="width: 100%;">
          ${icons.logout} Sign Out
        </button>
      </div>
    </aside>

    <!-- Settings Content Area -->
    <main class="settings-content">

      <!-- Profile Tab -->
      <section class="settings-tab-pane active" id="tab-profile">
        <div class="tab-pane-header">
          <h2>Profile Settings</h2>
          <p>Manage your public identity on the ConnectX real-time network</p>
        </div>

        <form id="settings-profile-form" class="clay-card settings-box">
          <div class="input-group">
            <label for="prof-display-name">Display Name</label>
            <input
              id="prof-display-name"
              class="input"
              type="text"
              value="${escapeHtml(user.user_metadata?.full_name || '')}"
              placeholder="Your full name"
            />
          </div>

          <div class="input-group">
            <label for="prof-username">Username</label>
            <input
              id="prof-username"
              class="input"
              type="text"
              value="${escapeHtml(user.user_metadata?.username || '')}"
              placeholder="username"
            />
          </div>

          <div class="input-group">
            <label for="prof-email">Email Address (Read-only)</label>
            <input
              id="prof-email"
              class="input"
              type="email"
              value="${escapeHtml(user.email || '')}"
              disabled
              style="opacity: 0.7; cursor: not-allowed;"
            />
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
            <button type="submit" class="btn btn-primary" id="save-prof-btn">
              Save Changes
            </button>
          </div>
        </form>
      </section>

      <!-- Appearance Tab -->
      <section class="settings-tab-pane" id="tab-appearance" style="display: none;">
        <div class="tab-pane-header">
          <h2>Claymorphism Design System</h2>
          <p>ConnectX uses a tactile, 75% white cloud-clay aesthetic</p>
        </div>

        <div class="clay-card settings-box">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <div>
              <strong style="font-size: 15px; display: block;">75% White Cloud Clay (Active)</strong>
              <span style="font-size: 13px; color: var(--text-muted);">Pillowy embossing, soft bevels, and multi-layered ambient shadows</span>
            </div>
            <span class="clay-badge clay-badge-accent">Default Theme</span>
          </div>

          <div class="palette-swatches" style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div class="swatch-pill" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #1E293B;">
              <strong>75%</strong>
              <span>White Clay</span>
            </div>
            <div class="swatch-pill" style="background: linear-gradient(135deg, #6366F1, #8B5CF6); color: #FFF;">
              <strong>15%</strong>
              <span>Electric Indigo</span>
            </div>
            <div class="swatch-pill" style="background: #1E293B; color: #FFF;">
              <strong>10%</strong>
              <span>Deep Slate</span>
            </div>
          </div>

          <div class="clay-preview-widget clay-card" style="background: var(--clay-surface-subtle); padding: 18px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-weight: 700; font-size: 14px;">Interactive Clay Component</span>
              <button class="btn btn-primary btn-sm">Tactile Button</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Notifications Tab -->
      <section class="settings-tab-pane" id="tab-notifications" style="display: none;">
        <div class="tab-pane-header">
          <h2>Notification Preferences</h2>
          <p>Configure how and when ConnectX alerts you about new messages</p>
        </div>

        <div class="clay-card settings-box">
          <label class="clay-checkbox-label" style="margin-bottom: 16px;">
            <input type="checkbox" id="pref-sound" checked />
            <div>
              <strong style="display: block; font-size: 14px;">In-App Audio Chimes</strong>
              <span style="font-size: 12px; color: var(--text-muted);">Play soft audio notification when receiving a new message</span>
            </div>
          </label>

          <label class="clay-checkbox-label" style="margin-bottom: 16px;">
            <input type="checkbox" id="pref-typing" checked />
            <div>
              <strong style="display: block; font-size: 14px;">Typing Indicators</strong>
              <span style="font-size: 12px; color: var(--text-muted);">Show live typing notifications in active channels</span>
            </div>
          </label>

          <label class="clay-checkbox-label">
            <input type="checkbox" id="pref-unread" checked />
            <div>
              <strong style="display: block; font-size: 14px;">Unread Counters</strong>
              <span style="font-size: 12px; color: var(--text-muted);">Display unread badges on inactive rooms and direct messages</span>
            </div>
          </label>
        </div>
      </section>

      <!-- C++ Telemetry Tab -->
      <section class="settings-tab-pane" id="tab-telemetry" style="display: none;">
        <div class="tab-pane-header">
          <h2>C++ Networking Backend Info</h2>
          <p>Live architectural specs of the ConnectX server</p>
        </div>

        <div class="clay-card settings-box">
          <div class="telemetry-grid">
            <div class="telemetry-item">
              <span class="telemetry-label">Backend Language</span>
              <strong class="telemetry-val">C++17 (ISO Standard)</strong>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">Socket Library</span>
              <strong class="telemetry-val">Boost.Asio 1.74+</strong>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">WebSocket Stream</span>
              <strong class="telemetry-val">Boost.Beast</strong>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">Database Client</span>
              <strong class="telemetry-val">libpqxx (PostgreSQL)</strong>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">Concurrency Model</span>
              <strong class="telemetry-val">std::thread Pool + Strands</strong>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-label">JSON Serialization</span>
              <strong class="telemetry-val">nlohmann/json</strong>
            </div>
          </div>

          <div style="margin-top: 20px; padding: 14px; background: var(--clay-surface-subtle); border-radius: var(--radius-md); font-size: 13px; color: var(--text-secondary);">
            ⚡ <strong>Networking Note:</strong> Boost.Beast handles RFC 6455 framing and connection upgrades directly above native TCP sockets. All session I/O runs serialized on dedicated executor strands.
          </div>
        </div>
      </section>

    </main>
  </div>
</div>
`;

  injectSettingsClayStyles();
  attachSettingsEvents();
}

function attachSettingsEvents() {
  // Tab switching
  document.querySelectorAll('.settings-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-tab-pane').forEach(p => p.style.display = 'none');

      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const targetPane = document.getElementById(`tab-${tabId}`);
      if (targetPane) targetPane.style.display = 'block';
    });
  });

  // Logout
  document.getElementById('settings-logout-btn')?.addEventListener('click', async () => {
    await signOut();
  });

  // Save profile
  document.getElementById('settings-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-prof-btn');
    const dispName = document.getElementById('prof-display-name')?.value.trim();
    const userName = document.getElementById('prof-username')?.value.trim();

    if (!dispName) {
      showToast('Display name cannot be empty.', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving…';

    if (supabase) {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: dispName, username: userName }
      });
      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast('Profile updated successfully!', 'success');
      }
    } else {
      showToast('Profile saved in local demo mode!', 'success');
    }

    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Changes';
  });
}

function injectSettingsClayStyles() {
  const id = 'settings-clay-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.settings-viewport {
  width: 100vw;
  min-height: 100vh;
  padding: 32px 20px;
  background: var(--clay-bg);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  box-sizing: border-box;
}

.settings-card-clay {
  width: 100%;
  max-width: 960px;
  background: var(--clay-surface);
  border-radius: var(--radius-xl);
  display: grid;
  grid-template-columns: 280px 1fr;
  overflow: hidden;
  padding: 0;
}

.settings-sidebar {
  background: var(--clay-surface-subtle);
  border-right: 1px solid var(--clay-border-subtle);
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.back-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  background: var(--clay-surface);
  box-shadow: var(--clay-shadow-sm);
  border: 1px solid var(--clay-border);
  transition: all var(--transition);
}
.back-pill-btn:hover {
  color: var(--color-accent);
  transform: translateX(-2px);
}

.settings-profile-summary {
  text-align: center;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.settings-avatar-clay {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: var(--color-accent-gradient);
  color: #FFF;
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 3px 5px 14px rgba(99,102,241,0.35);
  margin-bottom: 6px;
}

.settings-nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.settings-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition);
}
.settings-nav-btn:hover {
  background: #FFFFFF;
  color: var(--color-accent);
  box-shadow: var(--clay-shadow-sm);
  border-color: var(--clay-border);
}
.settings-nav-btn.active {
  background: #FFFFFF;
  color: var(--color-accent);
  box-shadow: var(--clay-shadow-sm);
  border-color: var(--clay-border);
}

.settings-sidebar-bottom {
  padding-top: 12px;
  border-top: 1px solid var(--clay-border-subtle);
}

.settings-content {
  padding: 36px 32px;
  overflow-y: auto;
}

.tab-pane-header {
  margin-bottom: 24px;
}

.tab-pane-header h2 {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.tab-pane-header p {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 4px;
}

.settings-box {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.palette-swatches .swatch-pill {
  flex: 1;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  box-shadow: var(--clay-shadow-sm);
  font-size: 13px;
}

.telemetry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}

.telemetry-item {
  background: var(--clay-surface-subtle);
  border: 1px solid var(--clay-border);
  box-shadow: var(--clay-shadow-sm);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
}

.telemetry-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.telemetry-val {
  font-size: 14px;
  color: var(--text-primary);
  margin-top: 4px;
}

@media (max-width: 768px) {
  .settings-card-clay { grid-template-columns: 1fr; }
  .settings-sidebar { border-right: none; border-bottom: 1px solid var(--clay-border-subtle); }
  .settings-content { padding: 24px 18px; }
}
  `;
  document.head.appendChild(style);
}

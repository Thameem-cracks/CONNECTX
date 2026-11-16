/**
 * Settings page.
 */
import { getSession, signOut, supabase } from '../auth/session.js';
import { showToast }                      from '../utils/toast.js';

export async function renderSettings(container) {
  const session = await getSession();
  const user = session?.user || { email: 'user@connectx.local', user_metadata: {} };

  container.innerHTML = `
<div class="settings-wrapper">
  <div class="settings-layout">
    <aside class="settings-nav">
      <a href="#/chat" class="settings-back">← Back to Chat</a>
      <nav>
        <a class="settings-nav-item active" data-section="profile">Profile</a>
        <a class="settings-nav-item" data-section="appearance">Appearance</a>
        <a class="settings-nav-item" data-section="notifications">Notifications</a>
        <a class="settings-nav-item danger" id="settings-logout">Logout</a>
      </nav>
    </aside>

    <main class="settings-main">
      <!-- Profile Section -->
      <section id="section-profile" class="settings-section">
        <h2>Profile Information</h2>
        <div class="settings-card card">
          <div class="input-group">
            <label>Display Name</label>
            <input class="input" id="s-display-name" type="text" value="${user.user_metadata?.full_name || ''}" placeholder="Your display name" />
          </div>
          <div class="input-group">
            <label>Email (Read-only)</label>
            <input class="input" type="email" value="${user.email || ''}" disabled />
          </div>
          <div class="input-group">
            <label>Username</label>
            <input class="input" id="s-username" type="text" value="${user.user_metadata?.username || ''}" placeholder="username" />
          </div>
          <button class="btn btn-primary" id="save-profile-btn">Save Profile Changes</button>
          <span class="error-msg" id="profile-err"></span>
        </div>
      </section>

      <!-- Appearance Section -->
      <section id="section-appearance" class="settings-section" style="display:none;">
        <h2>Appearance & Theme</h2>
        <div class="settings-card card">
          <p style="color:var(--color-text-muted);">Current Theme: <strong>Dark Slate (#0B0F19)</strong></p>
          <p style="font-size:13px;color:var(--color-text-dim);">ConnectX uses a customized dark palette engineered for low eye strain during long chat sessions.</p>
        </div>
      </section>

      <!-- Notifications Section -->
      <section id="section-notifications" class="settings-section" style="display:none;">
        <h2>Notification Preferences</h2>
        <div class="settings-card card">
          <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;">
            <input type="checkbox" checked /> In-app real-time message notification sounds
          </label>
          <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-top:10px;">
            <input type="checkbox" checked /> Unread message count badges
          </label>
        </div>
      </section>
    </main>
  </div>
</div>
`;

  injectSettingsStyles();

  document.querySelectorAll('.settings-nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.style.display = 'none');
      item.classList.add('active');
      const target = document.getElementById(`section-${item.dataset.section}`);
      if (target) target.style.display = 'block';
    });
  });

  document.getElementById('settings-logout')?.addEventListener('click', async () => {
    await signOut();
  });

  document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    const btn  = document.getElementById('save-profile-btn');
    const name = document.getElementById('s-display-name').value.trim();
    const user = document.getElementById('s-username').value.trim();
    const err  = document.getElementById('profile-err');
    err.textContent = '';

    if (!name) { err.textContent = 'Display name required.'; return; }

    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';

    if (supabase) {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name, username: user },
      });
      if (error) { err.textContent = error.message; }
      else { showToast('Profile updated!', 'success'); }
    } else {
      showToast('Profile saved locally (offline mode)', 'success');
    }

    btn.disabled  = false;
    btn.innerHTML = 'Save Profile Changes';
  });
}

function injectSettingsStyles() {
  const id = 'settings-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.settings-wrapper { min-height: 100vh; padding: 32px 24px; }
.settings-layout { display: grid; grid-template-columns: 220px 1fr; gap: 32px; max-width: 900px; margin: 0 auto; }
.settings-nav { display: flex; flex-direction: column; gap: 4px; }
.settings-back { display: block; padding: 8px 12px; color: var(--color-text-muted); font-size: 14px; margin-bottom: 12px; text-decoration: none; }
.settings-back:hover { color: var(--color-accent); }
.settings-nav-item {
  display: block; padding: 10px 14px; border-radius: var(--radius-sm);
  font-size: 14px; color: var(--color-text-muted); cursor: pointer;
  transition: background var(--transition), color var(--transition);
}
.settings-nav-item:hover, .settings-nav-item.active {
  background: var(--color-card); color: var(--color-text);
}
.settings-nav-item.danger { color: var(--color-error); margin-top: 8px; }
.settings-main h2 { font-size: 22px; font-weight: 700; margin-bottom: 20px; }
.settings-card { display: flex; flex-direction: column; gap: 16px; }

@media (max-width: 600px) {
  .settings-layout { grid-template-columns: 1fr; }
  .settings-nav { flex-direction: row; flex-wrap: wrap; }
}
  `;
  document.head.appendChild(style);
}

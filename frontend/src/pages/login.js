/**
 * ConnectX Login Page — Claymorphic Design
 */

import { signIn }    from '../auth/session.js';
import { showToast } from '../utils/toast.js';
import { icons }     from '../utils/icons.js';

export function renderLogin(container) {
  container.innerHTML = `
<div class="auth-viewport">
  <div class="auth-clay-container clay-card-floating">
    <!-- Brand Header -->
    <div class="auth-header">
      <a href="#/" class="auth-logo-link">
        ${icons.logo(48)}
      </a>
      <h1 class="auth-title">Welcome to ConnectX</h1>
      <p class="auth-subtitle">Choose a username to join the chat</p>
    </div>

    <!-- Login Form -->
    <form id="login-form" class="auth-form" novalidate>
      <div class="input-group">
        <label for="email">Username</label>
        <input
          id="email"
          class="input"
          type="text"
          placeholder="e.g. alex"
          autocomplete="nickname"
          required
        />
        <span class="error-msg" id="email-err"></span>
      </div>

      <div class="input-group">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <label for="password">Password <span style="font-weight: 400; color: var(--text-muted);">(optional locally)</span></label>
          <a href="#/login" id="forgot-link" style="font-size: 12px; color: var(--color-accent); font-weight: 600; text-decoration: none;">Forgot password?</a>
        </div>
        <input
          id="password"
          class="input"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
          required
        />
        <span class="error-msg" id="pass-err"></span>
      </div>

      <div class="auth-remember">
        <label class="clay-checkbox-label">
          <input type="checkbox" id="remember-me" checked />
          <span>Keep me signed in</span>
        </label>
      </div>

      <button type="submit" class="btn btn-primary btn-lg" id="login-btn" style="width: 100%;">
        Sign In to ConnectX
      </button>

      <span class="error-msg form-general-err" id="form-err"></span>
    </form>

    <div class="auth-divider">
      <span>or</span>
    </div>

    <div class="auth-demo-box">
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Want to test immediately without Supabase Auth?</p>
      <a href="#/chat" class="btn btn-secondary btn-sm" style="width: 100%;">
        ⚡ Enter as Guest Demo User
      </a>
    </div>

    <!-- Switch to register -->
    <div class="auth-footer">
      <span>Don't have an account?</span>
      <a href="#/register" class="auth-switch-link">Create an account</a>
    </div>
  </div>
</div>
`;

  injectAuthClayStyles();

  const form     = document.getElementById('login-form');
  const emailEl  = document.getElementById('email');
  const passEl   = document.getElementById('password');
  const btn      = document.getElementById('login-btn');
  const formErr  = document.getElementById('form-err');
  const forgotEl = document.getElementById('forgot-link');

  forgotEl?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Password reset link has been dispatched to your email.', 'info');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('email-err').textContent = '';
    document.getElementById('pass-err').textContent  = '';
    formErr.textContent = '';

    const email    = emailEl.value.trim();
    const password = passEl.value;
    let valid = true;

    if (!email || !/^[a-zA-Z0-9_.-]{2,32}$/.test(email.split('@')[0])) {
      document.getElementById('email-err').textContent = 'Use 2–32 letters, numbers, dots, dashes, or underscores.';
      emailEl.classList.add('error');
      valid = false;
    } else {
      emailEl.classList.remove('error');
    }

    if (password && password.length < 6) {
      document.getElementById('pass-err').textContent = 'Password must be at least 6 characters when provided.';
      passEl.classList.add('error');
      valid = false;
    } else {
      passEl.classList.remove('error');
    }

    if (!valid) return;

    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Authenticating…';

    const loginEmail = email.includes('@') ? email : `${email}@connectx.local`;
    const { session, error } = await signIn(loginEmail, password || 'local-demo');

    btn.disabled  = false;
    btn.innerHTML = 'Sign In to ConnectX';

    if (error) {
      formErr.textContent = error.message || 'Sign in failed. Verify your credentials.';
      return;
    }

    if (session) {
      showToast('Welcome back to ConnectX!', 'success');
      window.location.hash = '#/chat';
    }
  });
}

function injectAuthClayStyles() {
  const id = 'auth-clay-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.auth-viewport {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  background: var(--clay-bg);
}

.auth-clay-container {
  width: 100%;
  max-width: 440px;
  background: var(--clay-surface);
  border-radius: var(--radius-xl);
  padding: 38px 32px;
}

.auth-header {
  text-align: center;
  margin-bottom: 28px;
}

.auth-logo-link {
  display: inline-block;
  margin-bottom: 12px;
  transition: transform var(--transition);
}
.auth-logo-link:hover { transform: scale(1.05); }

.auth-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.auth-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.auth-remember {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.clay-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.clay-checkbox-label input[type="checkbox"] {
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.form-general-err {
  text-align: center;
  display: block;
}

.auth-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 20px 0 16px;
  color: var(--text-dim);
  font-size: 13px;
}
.auth-divider::before, .auth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--clay-border-subtle);
}
.auth-divider span { padding: 0 10px; }

.auth-demo-box {
  background: var(--clay-surface-subtle);
  border-radius: var(--radius-md);
  padding: 14px;
  border: 1px solid var(--clay-border);
  box-shadow: var(--clay-shadow-sm);
  text-align: center;
}

.auth-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
  display: flex;
  justify-content: center;
  gap: 6px;
}

.auth-switch-link {
  color: var(--color-accent);
  font-weight: 600;
  text-decoration: none;
}
.auth-switch-link:hover { text-decoration: underline; }
  `;
  document.head.appendChild(style);
}

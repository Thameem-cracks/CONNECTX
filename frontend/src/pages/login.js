/**
 * Login page.
 */
import { signIn }    from '../auth/session.js';
import { showToast } from '../utils/toast.js';

export function renderLogin(container) {
  container.innerHTML = `
<div class="auth-wrapper">
  <div class="auth-card card">
    <div class="auth-brand">
      <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="url(#loginGrad)"/>
        <defs><linearGradient id="loginGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6366F1"/><stop offset="1" stop-color="#8B5CF6"/>
        </linearGradient></defs>
        <text x="16" y="22" font-family="Inter,sans-serif" font-size="14" font-weight="700"
              fill="white" text-anchor="middle">CX</text>
      </svg>
      <h1>Sign in to ConnectX</h1>
    </div>

    <form id="login-form" novalidate>
      <div class="input-group">
        <label for="email">Email</label>
        <input id="email" class="input" type="email" placeholder="you@example.com" autocomplete="email" required />
        <span class="error-msg" id="email-err"></span>
      </div>
      <div class="input-group">
        <label for="password">Password</label>
        <input id="password" class="input" type="password" placeholder="••••••••" autocomplete="current-password" required />
        <span class="error-msg" id="pass-err"></span>
      </div>
      <div class="auth-options">
        <label class="checkbox-label">
          <input type="checkbox" id="remember" /> Remember me
        </label>
        <a href="#/forgot-password" class="text-link">Forgot password?</a>
      </div>
      <button type="submit" class="btn btn-primary" id="login-btn" style="width:100%;justify-content:center;">
        Sign In
      </button>
      <span class="error-msg" id="form-err" style="display:block;text-align:center;"></span>
    </form>

    <p class="auth-footer-link">
      Don't have an account? <a href="#/register">Create one</a>
    </p>
  </div>
</div>
`;

  injectAuthStyles();

  const form    = document.getElementById('login-form');
  const emailEl = document.getElementById('email');
  const passEl  = document.getElementById('password');
  const btn     = document.getElementById('login-btn');
  const formErr = document.getElementById('form-err');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('email-err').textContent = '';
    document.getElementById('pass-err').textContent  = '';
    formErr.textContent = '';

    const email    = emailEl.value.trim();
    const password = passEl.value;
    let valid = true;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('email-err').textContent = 'Please enter a valid email.';
      valid = false;
    }
    if (!password || password.length < 6) {
      document.getElementById('pass-err').textContent = 'Password must be at least 6 characters.';
      valid = false;
    }
    if (!valid) return;

    btn.disabled     = true;
    btn.innerHTML    = '<span class="spinner"></span> Signing in…';

    const { session, error } = await signIn(email, password);

    btn.disabled  = false;
    btn.innerHTML = 'Sign In';

    if (error) {
      formErr.textContent = error.message || 'Sign in failed. Please check your credentials.';
      return;
    }
    if (session) {
      showToast('Welcome back!', 'success');
      window.location.hash = '#/chat';
    }
  });
}

function injectAuthStyles() {
  const id = 'auth-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.auth-wrapper {
  min-height: 100vh; display: flex;
  align-items: center; justify-content: center;
  padding: 24px;
}
.auth-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 20px; }
.auth-brand {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  text-align: center;
}
.auth-brand h1 { font-size: 22px; font-weight: 700; }
.auth-options {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: var(--color-text-muted);
}
.checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.text-link { color: var(--color-accent); font-size: 13px; }
.auth-footer-link { text-align: center; font-size: 14px; color: var(--color-text-muted); }
form { display: flex; flex-direction: column; gap: 16px; }
  `;
  document.head.appendChild(style);
}

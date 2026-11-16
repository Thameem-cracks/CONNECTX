/**
 * Registration page.
 */
import { signUp }    from '../auth/session.js';
import { showToast } from '../utils/toast.js';

export function renderRegister(container) {
  container.innerHTML = `
<div class="auth-wrapper">
  <div class="auth-card card">
    <div class="auth-brand">
      <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="url(#regGrad)"/>
        <defs><linearGradient id="regGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stop-color="#6366F1"/><stop offset="1" stop-color="#8B5CF6"/>
        </linearGradient></defs>
        <text x="16" y="22" font-family="Inter,sans-serif" font-size="14" font-weight="700"
              fill="white" text-anchor="middle">CX</text>
      </svg>
      <h1>Create your account</h1>
      <p style="color:var(--color-text-muted);font-size:14px;">Join ConnectX and start collaborating</p>
    </div>

    <form id="register-form" novalidate>
      <div class="input-group">
        <label for="full-name">Full Name</label>
        <input id="full-name" class="input" type="text" placeholder="Jane Doe" required />
        <span class="error-msg" id="name-err"></span>
      </div>
      <div class="input-group">
        <label for="username">Username</label>
        <input id="username" class="input" type="text" placeholder="jane_doe" required />
        <span class="error-msg" id="user-err"></span>
      </div>
      <div class="input-group">
        <label for="reg-email">Email</label>
        <input id="reg-email" class="input" type="email" placeholder="you@example.com" required />
        <span class="error-msg" id="email-err"></span>
      </div>
      <div class="input-group">
        <label for="reg-password">Password</label>
        <input id="reg-password" class="input" type="password" placeholder="Min. 8 characters" required />
        <span class="error-msg" id="pass-err"></span>
      </div>
      <div class="input-group">
        <label for="confirm-password">Confirm Password</label>
        <input id="confirm-password" class="input" type="password" placeholder="Repeat password" required />
        <span class="error-msg" id="confirm-err"></span>
      </div>

      <button type="submit" class="btn btn-primary" id="register-btn" style="width:100%;justify-content:center;">
        Create Account
      </button>
      <span class="error-msg" id="form-err" style="display:block;text-align:center;"></span>
    </form>

    <p class="auth-footer-link">
      Already have an account? <a href="#/login">Sign in</a>
    </p>
  </div>
</div>
`;

  const form     = document.getElementById('register-form');
  const btn      = document.getElementById('register-btn');
  const formErr  = document.getElementById('form-err');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['name-err','user-err','email-err','pass-err','confirm-err'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    formErr.textContent = '';

    const fullName    = document.getElementById('full-name').value.trim();
    const username    = document.getElementById('username').value.trim();
    const email       = document.getElementById('reg-email').value.trim();
    const password    = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    let valid = true;

    if (!fullName || fullName.length < 2) {
      document.getElementById('name-err').textContent = 'Full name must be at least 2 characters.';
      valid = false;
    }
    if (!username || !/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      document.getElementById('user-err').textContent = 'Username: 3-32 chars, letters/numbers/underscores only.';
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('email-err').textContent = 'Please enter a valid email.';
      valid = false;
    }
    if (!password || password.length < 8) {
      document.getElementById('pass-err').textContent = 'Password must be at least 8 characters.';
      valid = false;
    }
    if (password !== confirmPass) {
      document.getElementById('confirm-err').textContent = 'Passwords do not match.';
      valid = false;
    }
    if (!valid) return;

    btn.disabled  = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account…';

    const { session, error } = await signUp(email, password, {
      full_name: fullName,
      username,
    });

    btn.disabled  = false;
    btn.innerHTML = 'Create Account';

    if (error) {
      formErr.textContent = error.message || 'Registration failed. Please try again.';
      return;
    }

    showToast('Account created! Please sign in.', 'success', 5000);
    window.location.hash = '#/login';
  });
}

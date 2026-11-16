/**
 * ConnectX Registration Page — Claymorphic Design
 */

import { signUp }    from '../auth/session.js';
import { showToast } from '../utils/toast.js';
import { icons }     from '../utils/icons.js';

export function renderRegister(container) {
  container.innerHTML = `
<div class="auth-viewport">
  <div class="auth-clay-container clay-card-floating" style="max-width: 480px;">
    <!-- Brand Header -->
    <div class="auth-header">
      <a href="#/" class="auth-logo-link">
        ${icons.logo(48)}
      </a>
      <h1 class="auth-title">Create ConnectX Account</h1>
      <p class="auth-subtitle">Join the real-time C++ WebSocket messaging network</p>
    </div>

    <!-- Registration Form -->
    <form id="register-form" class="auth-form" novalidate>
      <div class="input-group">
        <label for="full-name">Full Name</label>
        <input
          id="full-name"
          class="input"
          type="text"
          placeholder="Jane Doe"
          required
        />
        <span class="error-msg" id="name-err"></span>
      </div>

      <div class="input-group">
        <label for="username">Username</label>
        <input
          id="username"
          class="input"
          type="text"
          placeholder="janedoe"
          autocomplete="username"
          required
        />
        <span class="error-msg" id="user-err"></span>
      </div>

      <div class="input-group">
        <label for="reg-email">Email Address</label>
        <input
          id="reg-email"
          class="input"
          type="email"
          placeholder="jane@example.com"
          autocomplete="email"
          required
        />
        <span class="error-msg" id="email-err"></span>
      </div>

      <div class="input-group">
        <label for="reg-password">Password</label>
        <input
          id="reg-password"
          class="input"
          type="password"
          placeholder="At least 8 characters"
          autocomplete="new-password"
          required
        />
        <span class="error-msg" id="pass-err"></span>
      </div>

      <div class="input-group">
        <label for="confirm-password">Confirm Password</label>
        <input
          id="confirm-password"
          class="input"
          type="password"
          placeholder="Re-enter your password"
          autocomplete="new-password"
          required
        />
        <span class="error-msg" id="confirm-err"></span>
      </div>

      <button type="submit" class="btn btn-primary btn-lg" id="register-btn" style="width: 100%;">
        Create Free Account
      </button>

      <span class="error-msg form-general-err" id="form-err"></span>
    </form>

    <div class="auth-footer">
      <span>Already have an account?</span>
      <a href="#/login" class="auth-switch-link">Sign in instead</a>
    </div>
  </div>
</div>
`;

  const form     = document.getElementById('register-form');
  const btn      = document.getElementById('register-btn');
  const formErr  = document.getElementById('form-err');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['name-err', 'user-err', 'email-err', 'pass-err', 'confirm-err'].forEach(id => {
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
      document.getElementById('user-err').textContent = 'Username must be 3-32 characters, letters, numbers, underscores.';
      valid = false;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('email-err').textContent = 'Please enter a valid email address.';
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
    btn.innerHTML = '<span class="spinner"></span> Creating Account…';

    const { session, error } = await signUp(email, password, {
      full_name: fullName,
      username,
    });

    btn.disabled  = false;
    btn.innerHTML = 'Create Free Account';

    if (error) {
      formErr.textContent = error.message || 'Registration failed. Try again.';
      return;
    }

    showToast('Account registered successfully! Please sign in.', 'success');
    window.location.hash = '#/login';
  });
}

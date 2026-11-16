import { getSession } from '../auth/session.js';
import { icons } from '../utils/icons.js';

export async function renderLanding(container) {
  const session = await getSession();
  container.innerHTML = `
    <main class="landing-page simple-landing">
      <div class="simple-landing-card clay-card-floating">
        <div class="simple-brand">${icons.logo(42)}<span>Connect<span class="brand-x">X</span></span></div>
        <h1>Your conversations, all in one place.</h1>
        <p>Chat with your team, keep conversations organized, and stay connected.</p>
        <div class="simple-landing-actions">
          ${session ? '<a href="#/chat" class="btn btn-primary btn-lg">Open Chat</a>' : '<a href="#/login" class="btn btn-secondary btn-lg">Sign In</a><a href="#/register" class="btn btn-primary btn-lg">Create Account</a>'}
        </div>
      </div>
    </main>`;
  injectLandingStyles();
}

function injectLandingStyles() {
  const id = 'landing-clay-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .simple-landing { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--clay-bg); }
    .simple-landing-card { width: min(560px, 100%); padding: 56px 42px; text-align: center; }
    .simple-brand { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 28px; font-weight: 800; margin-bottom: 34px; }
    .simple-landing h1 { margin: 0 auto 14px; max-width: 460px; font-size: clamp(2.1rem, 5vw, 3.4rem); line-height: 1.1; letter-spacing: -1px; color: var(--text-primary); }
    .simple-landing p { margin: 0 auto 32px; max-width: 420px; color: var(--text-secondary); font-size: 17px; line-height: 1.6; }
    .simple-landing-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
    @media (max-width: 520px) { .simple-landing-card { padding: 40px 24px; } }
  `;
  document.head.appendChild(style);
}

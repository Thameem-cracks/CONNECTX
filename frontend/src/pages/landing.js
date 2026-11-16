/**
 * Landing page renderer.
 */
import { getSession } from '../auth/session.js';

export async function renderLanding(container) {
  const session = await getSession();

  container.innerHTML = `
<nav class="landing-nav">
  <div class="landing-nav__brand">
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="url(#navGrad)"/>
      <defs><linearGradient id="navGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#6366F1"/><stop offset="1" stop-color="#8B5CF6"/>
      </linearGradient></defs>
      <text x="16" y="22" font-family="Inter,sans-serif" font-size="14" font-weight="700"
            fill="white" text-anchor="middle">CX</text>
    </svg>
    <span>ConnectX</span>
  </div>
  <div class="landing-nav__links">
    ${session
      ? `<a href="#/chat" class="btn btn-primary btn-sm">Open App</a>`
      : `
        <a href="#/login"    class="btn btn-ghost    btn-sm">Sign In</a>
        <a href="#/register" class="btn btn-primary  btn-sm">Get Started</a>
      `}
  </div>
</nav>

<section class="hero">
  <div class="hero__tag badge badge-accent">⚡ Powered by C++ &amp; WebSockets</div>
  <h1 class="hero__heading">Connect.<br>Communicate.<br><span class="gradient-text">Collaborate.</span></h1>
  <p class="hero__sub">
    ConnectX is a real-time messaging platform built on a genuine C++ TCP networking backend —
    demonstrating how socket programming, multithreading and modern web technologies
    can power a full production chat application.
  </p>
  <div class="hero__cta">
    <a href="#/register" class="btn btn-primary btn-lg">Get Started Free</a>
    <a href="#/login"    class="btn btn-secondary btn-lg">Sign In</a>
  </div>
</section>

<section class="features">
  <h2 class="section-title">Everything you need to chat, collaborate and connect.</h2>
  <div class="features__grid">
    ${features.map(f => `
    <div class="feature-card">
      <div class="feature-card__icon">${f.icon}</div>
      <h3>${f.title}</h3>
      <p>${f.desc}</p>
    </div>`).join('')}
  </div>
</section>

<section class="tech-stack">
  <h2 class="section-title">Built on proven technology</h2>
  <div class="tech-grid">
    ${techItems.map(t => `
    <div class="tech-item">
      <div class="tech-item__label">${t.label}</div>
      <div class="tech-item__name">${t.name}</div>
    </div>`).join('')}
  </div>
</section>

<footer class="landing-footer">
  <span>© 2026 ConnectX — A real-time C++ WebSocket chat platform</span>
</footer>
`;

  injectLandingStyles();
}

const features = [
  { icon: '⚡', title: 'Real-Time Messaging',    desc: 'Messages delivered instantly via WebSockets with no page refresh.' },
  { icon: '👥', title: 'Group Chat Rooms',       desc: 'Create and join rooms. Broadcast messages to all members.' },
  { icon: '🔒', title: 'Private Conversations', desc: 'End-to-end authorized DMs visible only to participants.' },
  { icon: '🟢', title: 'Live Online Status',    desc: 'Know who is online in real time, tracked by TCP connection state.' },
  { icon: '📜', title: 'Message History',       desc: 'Persistent chat history stored in PostgreSQL, paginated on demand.' },
  { icon: '🔧', title: 'C++ Backend',           desc: 'Boost.Asio + Boost.Beast thread-pool server handling concurrent TCP sessions.' },
];

const techItems = [
  { label: 'Backend',   name: 'C++17 / Boost.Asio / Boost.Beast' },
  { label: 'Frontend',  name: 'HTML5 / CSS3 / JavaScript (Vite)' },
  { label: 'Transport', name: 'WebSockets / TCP Sockets' },
  { label: 'Database',  name: 'Supabase PostgreSQL / libpqxx' },
  { label: 'Auth',      name: 'Supabase Auth / JWT (JWKS)' },
  { label: 'Deploy',    name: 'Render (C++) / Vercel (Frontend)' },
];

function injectLandingStyles() {
  const id = 'landing-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.landing-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 48px;
  position: sticky; top: 0; z-index: 100;
  background: rgba(11,15,25,.85); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}
.landing-nav__brand {
  display: flex; align-items: center; gap: 10px;
  font-size: 20px; font-weight: 700; color: var(--color-text);
}
.landing-nav__links { display: flex; gap: 10px; align-items: center; }

.hero {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; padding: 100px 24px 80px;
  gap: 20px;
}
.hero__heading {
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  font-weight: 800; line-height: 1.1; letter-spacing: -1px;
}
.gradient-text {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-2));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.hero__sub { max-width: 600px; color: var(--color-text-muted); font-size: 18px; line-height: 1.7; }
.hero__cta { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }

.features { padding: 80px 48px; }
.section-title { text-align: center; font-size: 2rem; font-weight: 700; margin-bottom: 48px; }
.features__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
.feature-card {
  background: var(--color-card); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); padding: 24px;
  transition: transform var(--transition), box-shadow var(--transition);
}
.feature-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
.feature-card__icon { font-size: 32px; margin-bottom: 12px; }
.feature-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.feature-card p { color: var(--color-text-muted); font-size: 14px; line-height: 1.6; }

.tech-stack { padding: 80px 48px; background: var(--color-sidebar); }
.tech-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.tech-item {
  background: var(--color-card); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); padding: 16px;
}
.tech-item__label { font-size: 11px; font-weight: 600; color: var(--color-accent); text-transform: uppercase; letter-spacing: .5px; }
.tech-item__name  { font-size: 14px; font-weight: 500; margin-top: 4px; }

.landing-footer {
  text-align: center; padding: 24px;
  color: var(--color-text-dim); font-size: 13px;
  border-top: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .landing-nav { padding: 14px 20px; }
  .features, .tech-stack { padding: 48px 20px; }
  .section-title { font-size: 1.5rem; }
}
  `;
  document.head.appendChild(style);
}

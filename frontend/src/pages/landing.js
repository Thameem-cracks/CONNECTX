/**
 * ConnectX Landing Page — Premium Claymorphic Design
 * 75% White / Cloud palette with 25% vibrant Violet & Slate contrast
 */

import { getSession } from '../auth/session.js';
import { icons } from '../utils/icons.js';

export async function renderLanding(container) {
  const session = await getSession();

  container.innerHTML = `
<div class="landing-page">
  <!-- Navigation Header -->
  <header class="clay-nav">
    <div class="clay-nav__container">
      <div class="clay-nav__brand">
        ${icons.logo(36)}
        <span class="brand-text">Connect<span class="brand-x">X</span></span>
        <span class="clay-badge clay-badge-accent" style="margin-left: 8px;">C++ Backend</span>
      </div>

      <nav class="clay-nav__links">
        <a href="#features" class="nav-link">Features</a>
        <a href="#architecture" class="nav-link">Architecture</a>
        <a href="#tech" class="nav-link">Tech Stack</a>
      </nav>

      <div class="clay-nav__cta">
        ${session ? `
          <a href="#/chat" class="btn btn-primary btn-sm">
            ${icons.messageSquare} Open Chat
          </a>
        ` : `
          <a href="#/login" class="btn btn-secondary btn-sm">Sign In</a>
          <a href="#/register" class="btn btn-primary btn-sm">Get Started</a>
        `}
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="hero-section">
    <div class="hero-content">
      <div class="clay-badge clay-badge-accent hero-badge">
        <span>⚡ Boost.Asio &amp; Boost.Beast TCP Engine</span>
      </div>

      <h1 class="hero-title">
        Connect. Communicate.<br/>
        <span class="hero-gradient">Collaborate in Real-Time.</span>
      </h1>

      <p class="hero-subtitle">
        ConnectX is a modern, high-performance web messaging platform built on a genuine
        <strong>C++ TCP socket &amp; WebSocket server</strong>. Experience instant delivery,
        multithreaded room broadcasting, and persistent database storage.
      </p>

      <div class="hero-actions">
        <a href="#/register" class="btn btn-primary btn-lg">
          Launch ConnectX Free
        </a>
        <a href="#/chat" class="btn btn-secondary btn-lg">
          Try Live Demo
        </a>
      </div>

      <!-- Claymorphic Live Interactive Demo Card Preview -->
      <div class="clay-preview-card clay-card-floating">
        <div class="preview-header">
          <div class="preview-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="preview-title">
            <span class="status-dot online"></span>
            <strong>#general</strong> — Boost.Asio Worker Pool Active
          </div>
          <div class="clay-badge clay-badge-success" style="font-size: 11px;">
            100% C++ TCP Sockets
          </div>
        </div>

        <div class="preview-body">
          <div class="preview-msg left">
            <div class="msg-avatar">AD</div>
            <div class="msg-clay-bubble">
              <span class="msg-sender">Alex Developer</span>
              <p>Hey everyone! The C++ backend just processed 10,000 WebSocket frames concurrently using io_context worker strands! 🚀</p>
              <span class="msg-time">12:00 PM</span>
            </div>
          </div>

          <div class="preview-msg right">
            <div class="msg-clay-bubble own">
              <p>Amazing! Low latency and true TCP socket multithreading right in the browser.</p>
              <span class="msg-time">12:01 PM</span>
            </div>
            <div class="msg-avatar own">ME</div>
          </div>

          <div class="preview-input-mock">
            <span class="mock-placeholder">Type your message to the C++ server…</span>
            <span class="mock-send-btn">${icons.send}</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Core Features Section -->
  <section id="features" class="features-section">
    <div class="section-header">
      <span class="clay-badge clay-badge-accent">Core Capabilities</span>
      <h2>Engineered for High Throughput &amp; Elegance</h2>
      <p>A fusion of modern C++ network architecture and tactile claymorphic UI design.</p>
    </div>

    <div class="features-grid">
      <div class="clay-feature-card clay-card">
        <div class="feature-icon-wrapper accent">
          ${icons.radio}
        </div>
        <h3>Real-Time WebSockets</h3>
        <p>Bidirectional sub-millisecond messaging powered by Boost.Beast WebSocket streams running on asynchronous strands.</p>
      </div>

      <div class="clay-feature-card clay-card">
        <div class="feature-icon-wrapper violet">
          ${icons.cpu}
        </div>
        <h3>Multithreaded C++ Core</h3>
        <p>A thread pool sized to hardware concurrency handles connection management, payload validation, and fan-out broadcasting without blocking.</p>
      </div>

      <div class="clay-feature-card clay-card">
        <div class="feature-icon-wrapper emerald">
          ${icons.users}
        </div>
        <h3>Rooms &amp; Direct Messaging</h3>
        <p>Join group channels or start private end-to-end authorized conversations with instant peer delivery.</p>
      </div>

      <div class="clay-feature-card clay-card">
        <div class="feature-icon-wrapper amber">
          ${icons.database}
        </div>
        <h3>PostgreSQL Persistence</h3>
        <p>Complete chat history, membership logs, and message reads persisted in Supabase PostgreSQL via libpqxx parameterized SQL.</p>
      </div>

      <div class="clay-feature-card clay-card">
        <div class="feature-icon-wrapper rose">
          ${icons.shield}
        </div>
        <h3>Zero-Trust Security</h3>
        <p>All client events are strictly authenticated via Supabase JWTs. Sender identity is never trusted from frontend payloads.</p>
      </div>

      <div class="clay-feature-card clay-card">
        <div class="feature-icon-wrapper sky">
          ${icons.smile}
        </div>
        <h3>Real Presence &amp; Typing</h3>
        <p>Live user online/offline status dynamically synced with active TCP socket connections, complete with typing indicators.</p>
      </div>
    </div>
  </section>

  <!-- Technical Highlight Section -->
  <section id="architecture" class="tech-section">
    <div class="tech-card clay-card-floating">
      <div class="tech-card__text">
        <span class="clay-badge clay-badge-accent">Under the Hood</span>
        <h2>How ConnectX Connects the Web to C++</h2>
        <p>
          Unlike conventional chat applications that rely entirely on JavaScript runtimes, ConnectX runs an asynchronous
          C++17 daemon. The client establishes a WebSocket connection which is upgraded and managed via Boost.Asio.
        </p>
        <div class="tech-stats">
          <div class="stat-pill">
            <strong>C++17</strong>
            <span>Standard</span>
          </div>
          <div class="stat-pill">
            <strong>Boost.Asio</strong>
            <span>Network Engine</span>
          </div>
          <div class="stat-pill">
            <strong>libpqxx</strong>
            <span>PostgreSQL Wire</span>
          </div>
          <div class="stat-pill">
            <strong>Docker</strong>
            <span>Containerized</span>
          </div>
        </div>
      </div>
      <div class="tech-card__code">
        <div class="code-box">
          <pre><code>// ConnectX Session accept strand
void Session::start() {
  ws_.set_option(
    ws::stream_base::timeout::suggested(
      beast::role_type::server));
  ws_.async_accept(
    asio::bind_executor(strand_,
      beast::bind_front_handler(
        &amp;Session::on_accept,
        shared_from_this())));
}</code></pre>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="clay-footer">
    <div class="footer-container">
      <div class="footer-brand">
        ${icons.logo(28)}
        <strong>ConnectX</strong>
        <span>— Real-Time C++ Networking Demonstration</span>
      </div>
      <div class="footer-links">
        <a href="#/chat">Live Chat</a>
        <a href="#/login">Login</a>
        <a href="#/register">Register</a>
        <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
  </footer>
</div>
`;

  injectLandingStyles();
}

function injectLandingStyles() {
  const id = 'landing-clay-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.landing-page {
  background: var(--clay-bg);
  min-height: 100vh;
}

/* ─── Clay Nav ───────────────────────────── */
.clay-nav {
  position: sticky;
  top: 16px;
  z-index: 100;
  padding: 0 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.clay-nav__container {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-xl);
  box-shadow: var(--clay-shadow-card);
  border: 1px solid var(--clay-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
}

.clay-nav__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-text {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.brand-x {
  color: var(--color-accent);
}

.clay-nav__links {
  display: flex;
  gap: 24px;
}

.nav-link {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  transition: color var(--transition);
}
.nav-link:hover { color: var(--color-accent); }

.clay-nav__cta {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* ─── Hero ───────────────────────────────── */
.hero-section {
  padding: 60px 24px 80px;
  max-width: 1100px;
  margin: 0 auto;
  text-align: center;
}

.hero-badge {
  margin-bottom: 20px;
}

.hero-title {
  font-size: clamp(2.6rem, 5.5vw, 4.2rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -1.5px;
  color: var(--text-primary);
  margin-bottom: 20px;
}

.hero-gradient {
  background: var(--color-accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  max-width: 680px;
  margin: 0 auto 32px;
  font-size: 18px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 60px;
}

/* ─── Preview Clay Card ──────────────────── */
.clay-preview-card {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  text-align: left;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  margin-bottom: 20px;
}

.preview-dots {
  display: flex;
  gap: 6px;
}

.preview-dots .dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  box-shadow: inset 1px 1px 2px rgba(0,0,0,0.15);
}
.dot.red { background: #EF4444; }
.dot.yellow { background: #F59E0B; }
.dot.green { background: #10B981; }

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.preview-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-msg {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.preview-msg.right {
  justify-content: flex-end;
}

.msg-avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--color-accent-gradient);
  color: #FFF;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 4px 10px rgba(99,102,241,0.3);
  flex-shrink: 0;
}

.msg-avatar.own {
  background: linear-gradient(135deg, #10B981, #059669);
  box-shadow: 2px 4px 10px rgba(16,185,129,0.3);
}

.msg-clay-bubble {
  background: #FFFFFF;
  border-radius: 18px 18px 18px 4px;
  padding: 12px 18px;
  max-width: 70%;
  box-shadow: 3px 6px 16px rgba(160, 174, 200, 0.25),
              inset 1px 1px 2px #FFFFFF;
  border: 1px solid var(--clay-border);
}

.msg-clay-bubble.own {
  background: var(--color-accent-gradient);
  color: #FFFFFF;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 3px 6px 16px rgba(99, 102, 241, 0.35),
              inset 1px 1px 2px rgba(255,255,255,0.4);
}

.msg-sender {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent);
  display: block;
  margin-bottom: 4px;
}

.msg-time {
  font-size: 11px;
  opacity: 0.65;
  display: block;
  margin-top: 4px;
  text-align: right;
}

.preview-input-mock {
  background: var(--clay-inset);
  border-radius: var(--radius-md);
  box-shadow: var(--clay-shadow-inset);
  border: 1px solid var(--clay-border-subtle);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.mock-placeholder {
  color: var(--text-dim);
  font-size: 13px;
}

.mock-send-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--color-accent-gradient);
  color: #FFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 3px 8px rgba(99,102,241,0.3);
}

/* ─── Features Grid ──────────────────────── */
.features-section {
  padding: 80px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: 50px;
}

.section-header h2 {
  font-size: clamp(2rem, 3.5vw, 2.8rem);
  font-weight: 800;
  letter-spacing: -0.5px;
  margin: 12px 0 8px;
  color: var(--text-primary);
}

.section-header p {
  color: var(--text-secondary);
  font-size: 16px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.clay-feature-card {
  transition: transform var(--transition), box-shadow var(--transition);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.clay-feature-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--clay-shadow-floating);
}

.feature-icon-wrapper {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 3px 5px 12px rgba(0,0,0,0.08),
              inset 1px 1px 2px rgba(255,255,255,0.7);
}

.feature-icon-wrapper.accent  { background: #EEF2FF; color: #4F46E5; }
.feature-icon-wrapper.violet  { background: #F3E8FF; color: #7C3AED; }
.feature-icon-wrapper.emerald { background: #ECFDF5; color: #059669; }
.feature-icon-wrapper.amber   { background: #FEF3C7; color: #D97706; }
.feature-icon-wrapper.rose    { background: #FFE4E6; color: #E11D48; }
.feature-icon-wrapper.sky     { background: #E0F2FE; color: #0284C7; }

.clay-feature-card h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.clay-feature-card p {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

/* ─── Tech Section ───────────────────────── */
.tech-section {
  padding: 40px 24px 80px;
  max-width: 1100px;
  margin: 0 auto;
}

.tech-card {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 36px;
  align-items: center;
}

.tech-card__text h2 {
  font-size: 26px;
  font-weight: 800;
  margin: 12px 0;
  color: var(--text-primary);
}

.tech-card__text p {
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.7;
  margin-bottom: 24px;
}

.tech-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-pill {
  background: var(--clay-surface-subtle);
  border-radius: var(--radius-md);
  padding: 10px 18px;
  box-shadow: var(--clay-shadow-sm);
  border: 1px solid var(--clay-border);
  display: flex;
  flex-direction: column;
}

.stat-pill strong { font-size: 15px; color: var(--color-accent); }
.stat-pill span { font-size: 12px; color: var(--text-muted); }

.code-box {
  background: #1E293B;
  color: #F8FAFC;
  padding: 20px;
  border-radius: var(--radius-lg);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  box-shadow: 6px 8px 24px rgba(15, 23, 42, 0.25);
  overflow-x: auto;
}

/* ─── Footer ─────────────────────────────── */
.clay-footer {
  background: var(--clay-surface);
  border-top: 1px solid var(--clay-border);
  padding: 32px 24px;
}

.footer-container {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-secondary);
}

.footer-links {
  display: flex;
  gap: 20px;
}

.footer-links a {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}
.footer-links a:hover { color: var(--color-accent); }

@media (max-width: 768px) {
  .clay-nav__links { display: none; }
  .tech-card { grid-template-columns: 1fr; }
  .hero-section { padding: 40px 16px; }
  .features-grid { grid-template-columns: 1fr; }
}
  `;
  document.head.appendChild(style);
}

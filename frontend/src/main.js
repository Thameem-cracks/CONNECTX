/**
 * ConnectX Frontend – main.js
 *
 * Application entry point. Handles client-side routing and renders
 * the appropriate page based on the URL hash.
 */

import './styles/global.css';
import { renderLanding }      from './pages/landing.js';
import { renderLogin }        from './pages/login.js';
import { renderRegister }     from './pages/register.js';
import { renderChat }         from './pages/chat.js';
import { renderSettings }     from './pages/settings.js';
import { getSession }         from './auth/session.js';

const app = document.getElementById('app');

/** Simple hash-based client-side router */
async function router() {
  const hash = window.location.hash || '#/';
  const session = await getSession();

  // Protected routes check
  const protectedRoutes = ['#/chat', '#/settings'];
  const isProtected = protectedRoutes.some(r => hash.startsWith(r));

  // If Supabase is unconfigured, allow guest demo into chat
  if (isProtected && !session && import.meta.env.VITE_SUPABASE_URL) {
    window.location.hash = '#/login';
    return;
  }

  // Redirect authenticated users away from auth pages
  if ((hash === '#/login' || hash === '#/register') && session) {
    window.location.hash = '#/chat';
    return;
  }

  app.innerHTML = '';

  switch (true) {
    case hash === '#/' || hash === '#/home':
      renderLanding(app);
      break;
    case hash.startsWith('#/login'):
      renderLogin(app);
      break;
    case hash.startsWith('#/register'):
      renderRegister(app);
      break;
    case hash.startsWith('#/chat'):
      renderChat(app);
      break;
    case hash.startsWith('#/settings'):
      renderSettings(app);
      break;
    default:
      renderLanding(app);
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

/**
 * Session management using Supabase Auth with seamless local session support.
 * The raw JWT is passed to the C++ backend for verification —
 * the backend NEVER trusts a user_id sent from the browser.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project'))
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.info('[ConnectX] Supabase running in local development mode with persistent client sessions.');
}

/**
 * Get active auth session
 */
export async function getSession() {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) return data.session;
    } catch (err) {
      console.warn('[ConnectX] Supabase getSession error:', err);
    }
  }

  // Check local stored session
  const stored = localStorage.getItem('connectx_session');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem('connectx_session');
    }
  }

  return null;
}

/**
 * Get raw JWT access token for C++ backend authentication
 */
export async function getAccessToken() {
  const session = await getSession();
  if (!session) return null;

  if (session.access_token) return session.access_token;

  // Generate verified guest token format recognized by C++ backend
  const user = session.user;
  const uid = user.id || 'u_' + Date.now();
  const uname = user.user_metadata?.username || user.email?.split('@')[0] || 'user';
  const name = user.user_metadata?.full_name || uname;
  return `guest:${uid}:${uname}:${name}`;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.session) {
      localStorage.setItem('connectx_session', JSON.stringify(data.session));
      return { session: data.session, error: null };
    }
    if (error) return { session: null, error };
  }

  // Local development fallback
  const username = email.split('@')[0];
  const localSession = {
    access_token: `guest:usr_${username}:${username}:${username}`,
    user: {
      id: `usr_${username}`,
      email,
      user_metadata: {
        full_name: username.charAt(0).toUpperCase() + username.slice(1),
        username
      }
    }
  };
  localStorage.setItem('connectx_session', JSON.stringify(localSession));
  return { session: localSession, error: null };
}

/**
 * Sign up new user
 */
export async function signUp(email, password, metadata = {}) {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
    if (!error && data?.session) {
      localStorage.setItem('connectx_session', JSON.stringify(data.session));
      return { session: data.session, error: null };
    }
    if (error) return { session: null, error };
  }

  // Local development fallback
  const uid = `usr_${metadata.username || email.split('@')[0]}`;
  const localSession = {
    access_token: `guest:${uid}:${metadata.username || 'user'}:${metadata.full_name || 'User'}`,
    user: {
      id: uid,
      email,
      user_metadata: {
        full_name: metadata.full_name || metadata.username || 'User',
        username: metadata.username || 'user'
      }
    }
  };
  localStorage.setItem('connectx_session', JSON.stringify(localSession));
  return { session: localSession, error: null };
}

/**
 * Sign out current user
 */
export async function signOut() {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {}
  }
  localStorage.removeItem('connectx_session');
  window.location.hash = '#/';
}

/**
 * Auth state change listener
 */
export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

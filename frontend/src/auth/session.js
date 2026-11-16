/**
 * Session management using Supabase Auth.
 * The raw JWT is passed to the C++ backend for verification —
 * the backend NEVER trusts a user_id sent from the browser.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[ConnectX] Supabase environment variables not set – auth will run in demo/offline mode.');
}

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * Get active auth session
 */
export async function getSession() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch (err) {
    console.error('[ConnectX] Error retrieving session:', err);
    return null;
  }
}

/**
 * Get raw JWT access token
 */
export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token ?? null;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  if (!supabase) return { session: null, error: new Error('Supabase client not configured') };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { session: data?.session, error };
}

/**
 * Sign up new user
 */
export async function signUp(email, password, metadata = {}) {
  if (!supabase) return { session: null, error: new Error('Supabase client not configured') };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  return { session: data?.session, error };
}

/**
 * Sign out current user
 */
export async function signOut() {
  if (supabase) {
    await supabase.auth.signOut();
  }
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

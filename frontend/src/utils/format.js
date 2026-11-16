/**
 * Formatting utilities for the ConnectX UI.
 */

/**
 * Format a UTC ISO timestamp into a human-readable local time.
 */
export function formatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now  = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday)     return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`;
}

/**
 * Returns initials from a display name (up to 2 chars).
 */
export function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

/**
 * Escape HTML to safely insert user content into innerHTML.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Linkify URLs in a plain-text message.
 */
export function linkify(text) {
  if (!text) return '';
  return text.replace(
    /(https?:\/\/[^\s<>"']+)/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

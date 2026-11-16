/**
 * ConnectX Claymorphic Toast notification system
 */

function getToastContainer() {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Display a tactile clay toast
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 * @param {number} duration
 */
export function showToast(message, type = 'info', duration = 3800) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `clay-toast ${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span style="
      width: 24px; height: 24px; border-radius: 50%;
      background: ${type === 'success' ? 'var(--color-success-light)' : type === 'error' ? 'var(--color-error-light)' : 'var(--color-accent-light)'};
      color: ${type === 'success' ? 'var(--color-success)' : type === 'error' ? 'var(--color-error)' : 'var(--color-accent)'};
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 13px; flex-shrink: 0;
      box-shadow: inset 1px 1px 2px rgba(0,0,0,0.1);
    ">${iconMap[type] || 'ℹ'}</span>
    <span style="flex: 1; line-height: 1.4;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%) scale(0.9)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

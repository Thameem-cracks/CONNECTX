/**
 * Toast notification utility.
 */

function getContainer() {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Display a toast notification
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 * @param {number} duration
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = getContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

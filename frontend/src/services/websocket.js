/**
 * ConnectX WebSocket Service
 *
 * Manages the WebSocket connection to the C++ Boost.Beast backend.
 * Features:
 *   - Automatic reconnection with exponential backoff
 *   - Authentication handshake
 *   - Event-based message dispatch
 *   - Duplicate message prevention (via msg id deduplication)
 *   - Graceful keepalive ping/pong
 */

import { getAccessToken } from '../auth/session.js';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();   // event type -> Set<fn>
    this.reconnectDelay = 1000;
    this.reconnecting = false;
    this.closed = false;
    this.pingTimer = null;
    this.seenIds = new Set();     // dedup received message IDs
  }

  /** Connect (or reconnect) to the C++ backend */
  async connect() {
    this.closed = false;
    await this._connect();
  }

  async _connect() {
    const token = await getAccessToken();

    this._emit('status', { status: 'connecting' });

    try {
      this.ws = new WebSocket(WS_URL);
    } catch (e) {
      console.warn('[WS] Socket instantiation failed:', e);
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = async () => {
      console.log('[WS] Connected to ConnectX C++ backend');
      this.reconnectDelay = 1000;
      this.reconnecting = false;
      this._emit('status', { status: 'connected' });

      // Send auth handshake if token available
      if (token) {
        this.send({ type: 'authenticate', token });
      }

      // Start ping keepalive
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        this.send({ type: 'ping' });
      }, PING_INTERVAL_MS);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const msgId = msg.data?.id || msg.message?.id || msg.id;
        if (msgId) {
          if (this.seenIds.has(msgId)) return;
          this.seenIds.add(msgId);
          if (this.seenIds.size > 1000) {
            const arr = Array.from(this.seenIds);
            this.seenIds = new Set(arr.slice(-500));
          }
        }
        this._emit(msg.type, msg);
      } catch (e) {
        console.error('[WS] Failed to parse incoming JSON frame:', e);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[WS] Socket event error:', err);
      this._emit('status', { status: 'error' });
    };

    this.ws.onclose = () => {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
      if (this.closed) return;
      console.warn('[WS] Connection closed, reconnecting in', this.reconnectDelay, 'ms');
      this._emit('status', { status: 'reconnecting' });
      this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (this.reconnecting || this.closed) return;
    this.reconnecting = true;
    setTimeout(() => {
      this.reconnecting = false;
      this._connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  /** Trigger authentication on an already-open connection */
  async reauthenticate() {
    const token = await getAccessToken();
    if (token && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'authenticate', token });
    }
  }

  /** Send a JSON payload to the C++ server */
  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.warn('[WS] Socket not open. Dropped message type:', payload.type);
    }
  }

  /** Register an event listener */
  on(type, fn) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type)?.delete(fn);
  }

  /** Emit event to listeners */
  _emit(type, data) {
    this.listeners.get(type)?.forEach(fn => fn(data));
    this.listeners.get('*')?.forEach(fn => fn({ type, ...data }));
  }

  /** Close the WebSocket cleanly */
  disconnect() {
    this.closed = true;
    clearInterval(this.pingTimer);
    if (this.ws) {
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }
  }
}

export const wsService = new WebSocketService();

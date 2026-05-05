/**
 * API client for FutureAssist AI backend.
 * Render.com deployment version - uses relative URLs.
 */

// In production, frontend is served from the same origin as the API.
// API routes are all under /api/, so we use a relative path.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// WebSocket: derive from current page location
function getWebSocketURL() {
  if (import.meta.env.VITE_CONVERSATION_WS_URL) {
    return import.meta.env.VITE_CONVERSATION_WS_URL;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/chat`;
}

// ─── Token management (JWT access + refresh rotation) ───

const ACCESS_KEY  = "futureassist_access_token";
const REFRESH_KEY = "futureassist_refresh_token";

function safeRead(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeWrite(k, v) { try { localStorage.setItem(k, v); } catch {} }
function safeRemove(k) { try { localStorage.removeItem(k); } catch {} }

export const tokens = {
  getAccess:  () => safeRead(ACCESS_KEY),
  getRefresh: () => safeRead(REFRESH_KEY),
  set: (access, refresh) => {
    safeWrite(ACCESS_KEY, access);
    safeWrite(REFRESH_KEY, refresh);
  },
  clear: () => {
    safeRemove(ACCESS_KEY);
    safeRemove(REFRESH_KEY);
  },
};

let _refreshing = null;  // single-flight refresh promise

async function tryRefresh() {
  if (_refreshing) return _refreshing;
  const rt = tokens.getRefresh();
  if (!rt) return null;
  _refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) {
        tokens.clear();
        return null;
      }
      const j = await res.json();
      tokens.set(j.access_token, j.refresh_token);
      return j.access_token;
    } catch {
      return null;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

// ─── REST API ───

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const buildHeaders = () => {
    const h = { "Content-Type": "application/json", ...options.headers };
    const access = tokens.getAccess();
    if (access && !h.Authorization) h.Authorization = `Bearer ${access}`;
    return h;
  };

  let response = await fetch(url, { ...options, headers: buildHeaders() });

  // 401 → try one refresh + retry
  if (response.status === 401 && tokens.getRefresh() && !options._retried) {
    const newAccess = await tryRefresh();
    if (newAccess) {
      response = await fetch(url, {
        ...options,
        headers: { ...buildHeaders(), Authorization: `Bearer ${newAccess}` },
        _retried: true,
      });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Users (legacy passwordless endpoint kept for backward compat)
  createUser: (data) => request("/users/", { method: "POST", body: JSON.stringify(data) }),
  getUser: (id) => request(`/users/${id}`),
  loginUser: (data) => request("/users/login", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // ─── Auth (P0/P1/P2) ───
  authRegister: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  authLogin: (data)    => request("/auth/login",    { method: "POST", body: JSON.stringify(data) }),
  authMe: ()           => request("/auth/me"),
  authLogout: () => {
    const rt = tokens.getRefresh();
    return request("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: rt || "" }) })
      .finally(() => tokens.clear());
  },
  authVerifyEmail: (token) =>
    request("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  authPasswordResetRequest: (email) =>
    request("/auth/password-reset", { method: "POST", body: JSON.stringify({ email }) }),
  authPasswordResetConfirm: (token, new_password) =>
    request("/auth/password-reset/confirm", {
      method: "POST", body: JSON.stringify({ token, new_password }),
    }),
  // MFA
  authMfaSetup:   ()         => request("/auth/mfa/setup",   { method: "POST" }),
  authMfaVerify:  (code)     => request("/auth/mfa/verify",  { method: "POST", body: JSON.stringify({ code }) }),
  authMfaDisable: (code)     => request("/auth/mfa/disable", { method: "POST", body: JSON.stringify({ code }) }),
  authMfaChallenge: (mfa_challenge_token, code) =>
    request("/auth/mfa/challenge", {
      method: "POST", body: JSON.stringify({ mfa_challenge_token, code }),
    }),

  // User conversations
  getUserConversations: (userId, page = 1) => request(`/users/${userId}/conversations?page=${page}`),
  getUserConversationDetail: (userId, convId) => request(`/users/${userId}/conversations/${convId}`),

  // Sessions
  createSession: (data) => request("/chat/session", { method: "POST", body: JSON.stringify(data) }),
  getSession: (id) => request(`/chat/session/${id}`),
  getUserSessions: (userId) => request(`/chat/sessions/user/${userId}`),

  // Chat (REST fallback)
  sendMessage: (data) => request("/chat/coach", { method: "POST", body: JSON.stringify(data) }),

  // Survey
  getQuestions: (category = null) => {
    const params = category ? `?category=${category}` : "";
    return request(`/survey/questions${params}`);
  },
  submitSurvey: (data) => request("/survey/life_ability", { method: "POST", body: JSON.stringify(data) }),
  getSurveyHistory: (userId) => request(`/survey/history/${userId}`),

  // Metrics
  logMetrics: (data) => request("/metrics/log", { method: "POST", body: JSON.stringify(data) }),
  getUserMetrics: (userId) => request(`/metrics/user/${userId}`),
  getWellbeing: (userId) => request(`/metrics/wellbeing/${userId}`),

  // Consent
  manageConsent: (data) => request("/consent/", { method: "POST", body: JSON.stringify(data) }),
  getConsentStatus: (userId) => request(`/consent/status/${userId}`),

  // Public Sites
  getPublicSites: (topic = null) => {
    const params = topic ? `?topic=${encodeURIComponent(topic)}` : "";
    return request(`/public-sites/${params}`);
  },
  getTopics: () => request("/public-sites/topics"),

  // Life Ability 5要素スコア履歴（Phase 2 API）
  getLifeAbilityHistory: (userId) => request(`/survey/life-ability/${userId}`),

  // Health
  healthCheck: () => request("/health"),

  // Points & Companion
  getUserPoints: (userId) => request(`/points/${userId}`),
  getCompanion: (userId) => request(`/companion/${userId}`),
  feedCompanion: (userId) => request(`/companion/${userId}/feed`, { method: "POST" }),
  renameCompanion: (userId, name) =>
    request(`/companion/${userId}/rename`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
};

// ─── WebSocket ───

export function createChatWebSocket(handlers = {}) {
  const wsURL = getWebSocketURL();
  const ws = new WebSocket(wsURL);

  ws.onopen = () => {
    console.log("WebSocket connected to", wsURL);
    handlers.onOpen?.();
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      const { type, payload } = message;

      switch (type) {
        case "session_initialized":
          handlers.onSessionInit?.(payload);
          break;
        case "session_resumed":
          handlers.onSessionResumed?.(payload);
          break;
        case "assistant_message":
          handlers.onMessage?.(payload);
          break;
        case "typing":
          handlers.onTyping?.(payload.is_typing);
          break;
        case "session_ended":
          handlers.onSessionEnd?.(payload);
          break;
        case "error":
          handlers.onError?.(payload.message);
          break;
      }
    } catch (err) {
      console.error("WebSocket message parse error:", err);
    }
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected");
    handlers.onClose?.();
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
    handlers.onError?.("Connection error");
  };

  return {
    initSession: (userId, topic, sessionId = null) => {
      ws.send(JSON.stringify({
        type: "init_session",
        payload: { user_id: userId, topic, session_id: sessionId },
      }));
    },
    resumeSession: (userId, conversationId) => {
      ws.send(JSON.stringify({
        type: "resume_session",
        payload: { user_id: userId, conversation_id: conversationId },
      }));
    },
    sendMessage: (text) => {
      ws.send(JSON.stringify({
        type: "user_message",
        payload: { text },
      }));
    },
    endSession: () => {
      ws.send(JSON.stringify({ type: "end_session", payload: {} }));
    },
    close: () => ws.close(),
  };
}

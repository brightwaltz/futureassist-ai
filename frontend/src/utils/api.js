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

// ─── REST API ───

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Users
  createUser: (data) => request("/users/", { method: "POST", body: JSON.stringify(data) }),
  getUser: (id) => request(`/users/${id}`),

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

  // Health
  healthCheck: () => request("/health"),
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

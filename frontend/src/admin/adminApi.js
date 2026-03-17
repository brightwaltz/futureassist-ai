const STORAGE_KEY = "futureassist_admin_creds";

function getCredentials() {
  const creds = sessionStorage.getItem(STORAGE_KEY);
  if (!creds) return null;
  try {
    return JSON.parse(creds);
  } catch {
    return null;
  }
}

function getAuthHeader() {
  const creds = getCredentials();
  if (!creds) return {};
  return {
    Authorization: `Basic ${btoa(`${creds.username}:${creds.password}`)}`,
  };
}

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeader(),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.href = "/admin";
    throw new Error("Unauthorized");
  }
  return res;
}

export async function login(username, password) {
  const res = await fetch("/api/admin/default/stats", {
    headers: {
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    },
  });
  if (!res.ok) {
    throw new Error("認証に失敗しました");
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ username, password }));
  return true;
}

export async function getStats(slug = "default") {
  const res = await adminFetch(`/api/admin/${slug}/stats`);
  if (!res.ok) throw new Error("統計の取得に失敗しました");
  return res.json();
}

export async function getConversations(slug = "default", params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page);
  if (params.page_size) query.set("page_size", params.page_size);
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);
  if (params.topic) query.set("topic", params.topic);
  if (params.channel) query.set("channel", params.channel);
  const qs = query.toString();
  const res = await adminFetch(`/api/admin/${slug}/conversations${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("会話の取得に失敗しました");
  return res.json();
}

export async function getConversation(slug = "default", id) {
  const res = await adminFetch(`/api/admin/${slug}/conversations/${id}`);
  if (!res.ok) throw new Error("会話詳細の取得に失敗しました");
  return res.json();
}

export async function getSurveyStats(slug = "default") {
  const res = await adminFetch(`/api/admin/${slug}/surveys/stats`);
  if (!res.ok) throw new Error("アンケート統計の取得に失敗しました");
  return res.json();
}

export async function exportSurveys(slug = "default") {
  const res = await adminFetch(`/api/admin/${slug}/surveys/export`);
  if (!res.ok) throw new Error("エクスポートに失敗しました");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `surveys_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function logout() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.location.href = "/admin";
}

export function isLoggedIn() {
  return getCredentials() !== null;
}

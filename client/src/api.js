const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("scopeops_token");
}
function setToken(token) {
  localStorage.setItem("scopeops_token", token);
}
function clearToken() {
  localStorage.removeItem("scopeops_token");
}
function getStoredUser() {
  const u = localStorage.getItem("scopeops_user");
  return u ? JSON.parse(u) : null;
}
function setStoredUser(user) {
  localStorage.setItem("scopeops_user", JSON.stringify(user));
}
function clearStoredUser() {
  localStorage.removeItem("scopeops_user");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 401 && !path.startsWith("/auth/")) {
    clearToken();
    clearStoredUser();
    throw new Error("Sessão expirada.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro desconhecido.");
  return data;
}

const api = {
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
  clearStoredUser,

  // Auth
  async register(email, password) {
    const data = await request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
    setToken(data.token);
    setStoredUser({ email: data.email, role: data.role });
    return data;
  },
  async login(email, password) {
    const data = await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setToken(data.token);
    setStoredUser({ email: data.email, role: data.role });
    return data;
  },
  logout() {
    clearToken();
    clearStoredUser();
  },

  // Sessions
  async getSessions() { return request("/sessions"); },
  async createSession(featureName, steps) { return request("/sessions", { method: "POST", body: JSON.stringify({ featureName, steps }) }); },
  async updateSession(id, steps) { return request("/sessions/" + id, { method: "PUT", body: JSON.stringify({ steps }) }); },
  async deleteSession(id) { return request("/sessions/" + id, { method: "DELETE" }); },

  // Agents
  async getAgents() { return request("/agents"); },
  async saveAgents(configs) { return request("/agents", { method: "PUT", body: JSON.stringify(configs) }); },

  // KB
  async getKB(agentKey) { return request("/kb/" + agentKey); },
  async getKBContent(agentKey, id) { return request("/kb/" + agentKey + "/" + id + "/content"); },
  async uploadKB(agentKey, file, content, contentType) {
    const form = new FormData();
    form.append("file", file);
    if (content) { form.append("content", content); form.append("contentType", contentType || "text"); }
    return request("/kb/" + agentKey, { method: "POST", body: form });
  },
  async deleteKB(agentKey, id) { return request("/kb/" + agentKey + "/" + id, { method: "DELETE" }); },

  // Users
  async getUsers() { return request("/users"); },
  async setUserRole(email, role) { return request("/users/" + encodeURIComponent(email) + "/role", { method: "PUT", body: JSON.stringify({ role }) }); },

  // Claude proxy
  async callClaude({ system, userText, kbItems, fileParts }) {
    const data = await request("/claude", { method: "POST", body: JSON.stringify({ system, userText, kbItems, fileParts }) });
    return data.text;
  },
};

export default api;

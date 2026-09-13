const BASE = "/api";

function authHeaders() {
  const token = localStorage.getItem("uztt_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  if (!res.ok) {
    let msg = "Xatolik yuz berdi";
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  get(path) {
    return fetch(BASE + path, { headers: { ...authHeaders() } }).then(handle);
  },
  post(path, body) {
    return fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body || {}),
    }).then(handle);
  },
  put(path, body) {
    return fetch(BASE + path, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body || {}),
    }).then(handle);
  },
  del(path) {
    return fetch(BASE + path, { method: "DELETE", headers: { ...authHeaders() } }).then(handle);
  },
};

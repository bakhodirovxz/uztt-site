import { useEffect, useState } from "react";
import { api } from "../api";

export default function AdminNews() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", category: "Umumiy", status: "published" });
  const [error, setError] = useState(null);

  function refresh() {
    api.get("/news/admin/all").then(setList).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/news", form);
      setForm({ title: "", body: "", category: "Umumiy", status: "published" });
      refresh();
    } catch (err) { setError(err.message); }
  }

  async function toggleStatus(n) {
    await api.put(`/news/${n.id}`, { status: n.status === "published" ? "draft" : "published" });
    refresh();
  }

  async function remove(n) {
    if (!confirm(`"${n.title}" o'chirilsinmi?`)) return;
    await api.del(`/news/${n.id}`);
    refresh();
  }

  return (
    <div className="container page">
      <h1 className="section-title">Yangiliklarni boshqarish</h1>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Yangi yangilik</h3>
        <form onSubmit={onCreate}>
          <div className="field"><label>Sarlavha</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="field"><label>Kategoriya</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div className="field"><label>Matn</label><textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></div>
          {error && <p style={{ color: "var(--accent)" }}>{error}</p>}
          <button className="btn btn-primary" type="submit">Qo'shish va nashr etish</button>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Sarlavha</th><th>Holat</th><th></th></tr></thead>
          <tbody>
            {list.map((n) => (
              <tr key={n.id}>
                <td>{n.title}</td>
                <td><span className={`badge ${n.status === "published" ? "badge-finished" : "badge-scheduled"}`}>{n.status === "published" ? "Nashr etilgan" : "Qoralama"}</span></td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline" onClick={() => toggleStatus(n)}>{n.status === "published" ? "Yashirish" : "Nashr etish"}</button>
                  <button className="btn btn-outline" onClick={() => remove(n)}>O'chirish</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

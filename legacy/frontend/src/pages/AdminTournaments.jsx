import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function AdminTournaments() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    name: "", location: "", format: "Yakka eleminatsiya",
    levelName: "Viloyat chempionati", levelCoefficient: 1.5,
    ageCategory: "SENIOR", gender: "MIXED", status: "scheduled",
  });
  const [error, setError] = useState(null);

  function refresh() { api.get("/tournaments").then(setList).catch((e) => setError(e.message)); }
  useEffect(refresh, []);

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    try {
      const now = Date.now();
      await api.post("/tournaments", { ...form, startDate: now, endDate: now + 2 * 24 * 3600 * 1000 });
      refresh();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="container page">
      <h1 className="section-title">Musobaqalarni boshqarish</h1>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Yangi musobaqa</h3>
        <form onSubmit={onCreate}>
          <div className="field"><label>Nomi</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="field"><label>Joyi</label><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="field">
            <label>Musobaqa darajasi</label>
            <select value={form.levelName} onChange={(e) => {
              const map = { "Respublika chempionati": 3.0, "Respublika kubogi": 2.5, "Viloyat chempionati": 1.5, "Klublararo turnir": 1.0 };
              setForm({ ...form, levelName: e.target.value, levelCoefficient: map[e.target.value] });
            }}>
              <option>Respublika chempionati</option>
              <option>Respublika kubogi</option>
              <option>Viloyat chempionati</option>
              <option>Klublararo turnir</option>
            </select>
          </div>
          {error && <p style={{ color: "var(--accent)" }}>{error}</p>}
          <button className="btn btn-primary" type="submit">Yaratish</button>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Nomi</th><th>Daraja</th><th>Holat</th><th></th></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.levelName}</td>
                <td><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                <td><Link className="btn btn-outline" to={`/admin/musobaqalar/${t.id}`}>Boshqarish</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

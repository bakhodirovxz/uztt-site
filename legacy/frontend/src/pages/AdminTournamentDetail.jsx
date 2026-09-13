import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

export default function AdminTournamentDetail() {
  const { id } = useParams();
  const [t, setT] = useState(null);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({ stage: "final", tableNumber: 1, player1Id: "", player2Id: "", scheduledTime: "" });
  const [error, setError] = useState(null);

  function refresh() { api.get(`/tournaments/${id}`).then(setT).catch((e) => setError(e.message)); }
  useEffect(refresh, [id]);
  useEffect(() => { api.get("/players").then(setPlayers).catch(() => {}); }, []);

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    if (form.player1Id === form.player2Id) { setError("Ikkita har xil o'yinchi tanlang"); return; }
    try {
      const scheduledTime = form.scheduledTime ? new Date(form.scheduledTime).getTime() : Date.now();
      await api.post("/matches", { ...form, tournamentId: id, tableNumber: Number(form.tableNumber), scheduledTime });
      refresh();
    } catch (err) { setError(err.message); }
  }

  if (!t) return <div className="container page">Yuklanmoqda...</div>;

  return (
    <div className="container page">
      <Link to="/admin/musobaqalar">&larr; Musobaqalarga qaytish</Link>
      <h1 style={{ marginTop: 10 }}>{t.name}</h1>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Yangi o'yin qo'shish</h3>
        <form onSubmit={onCreate}>
          <div className="field">
            <label>Bosqich</label>
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              <option value="round1">1/8 final</option>
              <option value="quarterfinal">Chorak final</option>
              <option value="semifinal">Yarim final</option>
              <option value="final">Final</option>
            </select>
          </div>
          <div className="field"><label>Stol raqami</label><input type="number" value={form.tableNumber} onChange={(e) => setForm({ ...form, tableNumber: e.target.value })} /></div>
          <div className="field"><label>Boshlanish vaqti</label><input type="datetime-local" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} /></div>
          <div className="field">
            <label>1-o'yinchi</label>
            <select value={form.player1Id} onChange={(e) => setForm({ ...form, player1Id: e.target.value })} required>
              <option value="">Tanlang</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div className="field">
            <label>2-o'yinchi</label>
            <select value={form.player2Id} onChange={(e) => setForm({ ...form, player2Id: e.target.value })} required>
              <option value="">Tanlang</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          {error && <p style={{ color: "var(--accent)" }}>{error}</p>}
          <button className="btn btn-primary" type="submit">Qo'shish</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Bosqich</th><th>Stol</th><th>O'yin</th><th>Holat</th><th>Overlay havolasi</th></tr></thead>
          <tbody>
            {t.matches.map((m) => (
              <tr key={m.id}>
                <td>{m.stage}</td>
                <td>{m.tableNumber}</td>
                <td>{m.player1Name} vs {m.player2Name}</td>
                <td><span className={`badge badge-${m.status}`}>{m.status}</span></td>
                <td><code style={{ fontSize: 11 }}>/overlay/{m.overlayToken}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

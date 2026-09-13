import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

export default function PlayerDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);

  useEffect(() => { api.get(`/players/${id}`).then(setP).catch(() => {}); }, [id]);

  if (!p) return <div className="container page">Yuklanmoqda...</div>;

  return (
    <div className="container page">
      <Link to="/oyinchilar">&larr; O'yinchilarga qaytish</Link>
      <h1 style={{ marginTop: 10 }}>{p.fullName}</h1>
      <p style={{ color: "#666" }}>{p.region} · {p.club} · Litsenziya: {p.licenseNumber}</p>
      <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: "#666" }}>Joriy reyting balli</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: "var(--navy)" }}>{p.rankingPoints}</div>
      </div>
      <h2 className="section-title">O'yinlar</h2>
      <div className="card">
        <table>
          <thead><tr><th>Bosqich</th><th>Hisob</th><th>Holat</th></tr></thead>
          <tbody>
            {p.matches.map((m) => (
              <tr key={m.id}>
                <td>{m.stage}</td>
                <td>{m.sets.map((s) => `${s.p1}-${s.p2}`).join(", ") || "—"}</td>
                <td>{m.status}</td>
              </tr>
            ))}
            {p.matches.length === 0 && <tr><td colSpan={3}>Hozircha o'yinlar yo'q</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

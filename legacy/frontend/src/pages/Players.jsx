import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [gender, setGender] = useState("");

  useEffect(() => {
    api.get(`/players${gender ? `?gender=${gender}` : ""}`).then(setPlayers).catch(() => {});
  }, [gender]);

  return (
    <div className="container page">
      <h1 className="section-title">O'yinchilar</h1>
      <div className="field" style={{ maxWidth: 240 }}>
        <label>Jinsi bo'yicha filtr</label>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Barchasi</option>
          <option value="MALE">Erkaklar</option>
          <option value="FEMALE">Ayollar</option>
        </select>
      </div>
      <div className="grid grid-3">
        {players.map((p) => (
          <Link to={`/oyinchilar/${p.id}`} key={p.id} className="card">
            <h3 style={{ margin: "0 0 6px" }}>{p.fullName}</h3>
            <p style={{ color: "#666", fontSize: 14 }}>{p.region} · {p.club}</p>
            <p style={{ marginTop: 8, fontWeight: 700, color: "var(--accent)" }}>{p.rankingPoints} ball</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

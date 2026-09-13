import { useEffect, useState } from "react";
import { api } from "../api";

export default function Rankings() {
  const [gender, setGender] = useState("MALE");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get(`/rankings?gender=${gender}`).then(setRows).catch(() => {});
  }, [gender]);

  return (
    <div className="container page">
      <h1 className="section-title">Reytinglar</h1>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button className={`btn ${gender === "MALE" ? "btn-primary" : "btn-outline"}`} onClick={() => setGender("MALE")}>Erkaklar</button>
        <button className={`btn ${gender === "FEMALE" ? "btn-primary" : "btn-outline"}`} onClick={() => setGender("FEMALE")}>Ayollar</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>#</th><th>Ism</th><th>Viloyat</th><th>Ball</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}><td>{r.rank}</td><td>{r.fullName}</td><td>{r.region}</td><td>{r.rankingPoints}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

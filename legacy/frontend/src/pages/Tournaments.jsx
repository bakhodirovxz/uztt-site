import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Tournaments() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/tournaments").then(setItems).catch(() => {}); }, []);
  return (
    <div className="container page">
      <h1 className="section-title">Musobaqalar</h1>
      <div className="grid grid-2">
        {items.map((t) => (
          <Link to={`/musobaqalar/${t.id}`} key={t.id} className="card">
            <span className={`badge badge-${t.status}`}>{t.status === "live" ? "Jonli" : t.status === "finished" ? "Yakunlangan" : "Rejalashtirilgan"}</span>
            <h3 style={{ margin: "10px 0 6px" }}>{t.name}</h3>
            <p style={{ color: "#666", fontSize: 14 }}>{t.location} · {t.format}</p>
          </Link>
        ))}
        {items.length === 0 && <p>Hozircha musobaqalar yo'q.</p>}
      </div>
    </div>
  );
}

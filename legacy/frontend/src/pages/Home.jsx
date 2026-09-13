import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Home() {
  const [news, setNews] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [rankings, setRankings] = useState([]);

  useEffect(() => {
    api.get("/news").then((d) => setNews(d.slice(0, 3))).catch(() => {});
    api.get("/tournaments").then((d) => setTournaments(d.slice(0, 3))).catch(() => {});
    api.get("/rankings").then((d) => setRankings(d.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div>
      <div className="hero">
        <h1>O'zbekiston Stol Tennisi Federatsiyasi</h1>
        <p>Yangiliklar, musobaqalar, o'yinchilar reytingi va jonli natijalar — bir joyda.</p>
      </div>
      <div className="container page">
        <h2 className="section-title">So'nggi yangiliklar</h2>
        <div className="grid grid-3" style={{ marginBottom: 40 }}>
          {news.map((n) => (
            <Link to={`/yangiliklar/${n.slug}`} key={n.id} className="card">
              <span className="badge badge-scheduled">{n.category}</span>
              <h3 style={{ margin: "10px 0 6px" }}>{n.title}</h3>
              <p style={{ color: "#666", fontSize: 14 }}>{n.body.slice(0, 90)}...</p>
            </Link>
          ))}
          {news.length === 0 && <p>Hozircha yangiliklar yo'q.</p>}
        </div>

        <h2 className="section-title">Musobaqalar</h2>
        <div className="grid grid-3" style={{ marginBottom: 40 }}>
          {tournaments.map((t) => (
            <Link to={`/musobaqalar/${t.id}`} key={t.id} className="card">
              <span className={`badge badge-${t.status}`}>{t.status === "live" ? "Jonli" : t.status === "finished" ? "Yakunlangan" : "Rejalashtirilgan"}</span>
              <h3 style={{ margin: "10px 0 6px" }}>{t.name}</h3>
              <p style={{ color: "#666", fontSize: 14 }}>{t.location}</p>
            </Link>
          ))}
          {tournaments.length === 0 && <p>Hozircha musobaqalar yo'q.</p>}
        </div>

        <h2 className="section-title">TOP-5 reyting</h2>
        <div className="card">
          <table>
            <thead><tr><th>#</th><th>Ism</th><th>Viloyat</th><th>Ball</th></tr></thead>
            <tbody>
              {rankings.map((r) => (
                <tr key={r.id}><td>{r.rank}</td><td>{r.fullName}</td><td>{r.region}</td><td>{r.rankingPoints}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

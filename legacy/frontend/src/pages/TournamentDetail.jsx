import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { getSocket } from "../socket";

function MatchRow({ m }) {
  const [live, setLive] = useState(m);
  const socket = useRef(null);

  useEffect(() => {
    setLive(m);
    if (m.status === "finished") return;
    const s = getSocket();
    socket.current = s;
    s.emit("join", m.id);
    const handler = (data) => { if (data.id === m.id) setLive(data); };
    s.on("score:update", handler);
    return () => { s.off("score:update", handler); s.emit("leave", m.id); };
  }, [m.id, m.status]);

  const statusLabel = live.status === "live" ? "Jonli" : live.status === "finished" ? "Yakunlangan" : "Rejalashtirilgan";

  return (
    <tr>
      <td>{live.stage}</td>
      <td>Stol {live.tableNumber}</td>
      <td>{live.player1Name} vs {live.player2Name}</td>
      <td>
        {live.status === "scheduled" ? "—" : (
          <>
            {live.player1SetsWon}-{live.player2SetsWon}
            {live.status === "live" && <> ({live.currentSet.p1}:{live.currentSet.p2})</>}
          </>
        )}
      </td>
      <td><span className={`badge badge-${live.status}`}>{statusLabel}</span></td>
    </tr>
  );
}

export default function TournamentDetail() {
  const { id } = useParams();
  const [t, setT] = useState(null);

  useEffect(() => { api.get(`/tournaments/${id}`).then(setT).catch(() => {}); }, [id]);

  if (!t) return <div className="container page">Yuklanmoqda...</div>;

  return (
    <div className="container page">
      <Link to="/musobaqalar">&larr; Musobaqalarga qaytish</Link>
      <h1 style={{ marginTop: 10 }}>{t.name}</h1>
      <p style={{ color: "#666" }}>{t.location} · {t.format} · {t.levelName}</p>
      <div className="card" style={{ marginTop: 20 }}>
        <table>
          <thead><tr><th>Bosqich</th><th>Stol</th><th>O'yin</th><th>Hisob</th><th>Holat</th></tr></thead>
          <tbody>
            {t.matches.map((m) => <MatchRow key={m.id} m={m} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

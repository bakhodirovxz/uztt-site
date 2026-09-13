import { useEffect, useState } from "react";
import { api } from "../api";
import { getSocket } from "../socket";

function ScoreScreen({ match, onBack, onChanged }) {
  const [m, setM] = useState(match);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getSocket();
    s.emit("join", match.id);
    const handler = (data) => { if (data.id === match.id) setM(data); };
    s.on("score:update", handler);
    return () => { s.off("score:update", handler); s.emit("leave", match.id); };
  }, [match.id]);

  async function point(player) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api.post(`/matches/${m.id}/point`, { player });
      setM(updated);
      onChanged(updated);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  async function undo() {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api.post(`/matches/${m.id}/undo`, {});
      setM(updated);
      onChanged(updated);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  return (
    <div className="score-screen">
      <button className="btn btn-outline" onClick={onBack} style={{ marginBottom: 20 }}>&larr; O'yinlar ro'yxatiga qaytish</button>
      <h2>{m.stage} · Stol {m.tableNumber}</h2>
      <p style={{ color: "#666" }}>Setlar: {m.player1SetsWon} - {m.player2SetsWon} {m.status === "finished" && "· O'YIN YAKUNLANDI"}</p>
      <div className="score-row">
        <div className="player-box">
          <h3>{m.player1Name}</h3>
          <div className="set-score">{m.currentSet.p1}</div>
          <button className="point-btn p1" disabled={m.status === "finished" || busy} onClick={() => point(1)}>+1</button>
        </div>
        <div style={{ fontSize: 24, color: "#999" }}>VS</div>
        <div className="player-box">
          <h3>{m.player2Name}</h3>
          <div className="set-score">{m.currentSet.p2}</div>
          <button className="point-btn p2" disabled={m.status === "finished" || busy} onClick={() => point(2)}>+1</button>
        </div>
      </div>
      <button className="btn btn-outline" onClick={undo} disabled={busy || (m.history || []).length === 0}>Bekor qilish (undo)</button>
      {m.sets.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <strong>Tugagan setlar:</strong> {m.sets.map((s, i) => <span key={i} style={{ marginLeft: 10 }}>{s.p1}-{s.p2}</span>)}
        </div>
      )}
      <div style={{ marginTop: 24, fontSize: 13, color: "#888" }}>
        Efir uchun overlay havolasi: <code>/overlay/{m.overlayToken}</code>
      </div>
    </div>
  );
}

export default function RefereeLive() {
  const [matches, setMatches] = useState([]);
  const [active, setActive] = useState(null);

  function refresh() {
    api.get("/matches").then((all) => {
      setMatches(all.filter((m) => m.status !== "finished"));
    }).catch(() => {});
  }
  useEffect(refresh, []);

  if (active) {
    return <div className="container page"><ScoreScreen match={active} onBack={() => { setActive(null); refresh(); }} onChanged={setActive} /></div>;
  }

  return (
    <div className="container page">
      <h1 className="section-title">Hakam paneli — jonli o'yinlar</h1>
      <div className="grid grid-2">
        {matches.map((m) => (
          <div key={m.id} className="card">
            <span className={`badge badge-${m.status}`}>{m.status === "live" ? "Jonli" : "Rejalashtirilgan"}</span>
            <h3 style={{ margin: "10px 0 6px" }}>{m.player1Name} vs {m.player2Name}</h3>
            <p style={{ color: "#666", fontSize: 14 }}>{m.stage} · Stol {m.tableNumber}</p>
            <button className="btn btn-primary" onClick={() => setActive(m)}>Ochko kiritishni boshlash</button>
          </div>
        ))}
        {matches.length === 0 && <p>Hozircha faol o'yinlar yo'q.</p>}
      </div>
    </div>
  );
}

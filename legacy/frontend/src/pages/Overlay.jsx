import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSocket } from "../socket";

export default function Overlay() {
  const { token } = useParams();
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.style.background = "transparent";
    fetch(`/api/matches/overlay/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setM(data);
        const s = getSocket();
        s.emit("join", data.id);
        s.on("score:update", (upd) => { if (upd.id === data.id) setM(upd); });
      });
    return () => { document.body.style.background = ""; };
  }, [token]);

  if (error) return <div style={overlayStyles.wrap}><div style={overlayStyles.error}>Overlay xatosi: {error}</div></div>;
  if (!m) return null;

  return (
    <div style={overlayStyles.wrap}>
      <div style={overlayStyles.bar}>
        <div style={overlayStyles.stage}>{m.stage?.toUpperCase()}</div>
        <div style={overlayStyles.row}>
          <PlayerBlock name={m.player1Name} sets={m.player1SetsWon} points={m.currentSet.p1} align="left" />
          <div style={overlayStyles.vs}>{m.status === "finished" ? "YAKUNLANDI" : "VS"}</div>
          <PlayerBlock name={m.player2Name} sets={m.player2SetsWon} points={m.currentSet.p2} align="right" />
        </div>
      </div>
    </div>
  );
}

function PlayerBlock({ name, sets, points, align }) {
  return (
    <div style={{ ...overlayStyles.player, textAlign: align }}>
      <div style={overlayStyles.name}>{name}</div>
      <div style={overlayStyles.numbers}>
        <span style={overlayStyles.sets}>{sets}</span>
        <span style={overlayStyles.points}>{points}</span>
      </div>
    </div>
  );
}

const overlayStyles = {
  wrap: { background: "transparent", width: "100vw", height: "100vh", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "Arial, sans-serif" },
  bar: { background: "rgba(15,21,45,0.85)", borderTop: "4px solid #c8102e", color: "white", width: "900px", marginBottom: "40px", borderRadius: "10px", padding: "14px 24px", boxShadow: "0 6px 24px rgba(0,0,0,0.4)" },
  stage: { fontSize: "13px", letterSpacing: "2px", opacity: 0.7, textAlign: "center", marginBottom: "6px" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  player: { flex: 1 },
  name: { fontSize: "22px", fontWeight: 700 },
  numbers: { display: "flex", gap: "10px", alignItems: "baseline", marginTop: "4px" },
  sets: { fontSize: "20px", fontWeight: 700, background: "#c8102e", padding: "2px 10px", borderRadius: "6px" },
  points: { fontSize: "36px", fontWeight: 800 },
  vs: { fontSize: "14px", opacity: 0.6, width: "80px", textAlign: "center" },
  error: { color: "white", background: "rgba(200,16,46,0.85)", padding: "10px 20px", borderRadius: "8px" },
};

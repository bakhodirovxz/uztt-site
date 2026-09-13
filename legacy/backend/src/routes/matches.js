const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function withPlayerNames(match) {
  const p1 = db.find("players", (p) => p.id === match.player1Id);
  const p2 = db.find("players", (p) => p.id === match.player2Id);
  return {
    ...match,
    player1Name: p1 ? p1.fullName : "Noma'lum",
    player2Name: p2 ? p2.fullName : "Noma'lum",
  };
}

function emitScore(req, match) {
  const io = req.app.get("io");
  io.to(`match:${match.id}`).emit("score:update", withPlayerNames(match));
}

router.get("/", (req, res) => {
  res.json(db.all("matches").map(withPlayerNames));
});

router.get("/live", (req, res) => {
  res.json(db.filter("matches", (m) => m.status === "live").map(withPlayerNames));
});

router.get("/:id", (req, res) => {
  const m = db.find("matches", (m) => m.id === req.params.id);
  if (!m) return res.status(404).json({ error: "O'yin topilmadi" });
  res.json(withPlayerNames(m));
});

// Faqat ko'rsatish uchun ochiq overlay ma'lumoti (token orqali, login talab qilinmaydi)
router.get("/overlay/:token", (req, res) => {
  const m = db.find("matches", (m) => m.overlayToken === req.params.token);
  if (!m) return res.status(404).json({ error: "Overlay topilmadi" });
  res.json(withPlayerNames(m));
});

router.post("/", requireAuth(["admin"]), (req, res) => {
  const m = {
    id: uuid(),
    overlayToken: uuid(),
    bestOf: 5,
    currentSet: { p1: 0, p2: 0 },
    sets: [],
    player1SetsWon: 0,
    player2SetsWon: 0,
    status: "scheduled",
    winnerId: null,
    history: [],
    ...req.body,
  };
  db.insert("matches", m);
  res.status(201).json(withPlayerNames(m));
});

router.put("/:id", requireAuth(["admin"]), (req, res) => {
  const updated = db.update("matches", req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "O'yin topilmadi" });
  res.json(withPlayerNames(updated));
});

// Hakam / admin: ochko qo'shish
router.post("/:id/point", requireAuth(["admin", "referee"]), (req, res) => {
  const match = db.find("matches", (m) => m.id === req.params.id);
  if (!match) return res.status(404).json({ error: "O'yin topilmadi" });
  if (match.status === "finished") return res.status(400).json({ error: "O'yin allaqachon yakunlangan" });

  const { player } = req.body || {}; // 1 yoki 2
  if (player !== 1 && player !== 2) return res.status(400).json({ error: "player 1 yoki 2 bo'lishi kerak" });

  // undo uchun tarixga saqlab qo'yamiz (oxirgi 50 ta holat)
  const snapshot = JSON.parse(
    JSON.stringify({
      currentSet: match.currentSet,
      sets: match.sets,
      player1SetsWon: match.player1SetsWon,
      player2SetsWon: match.player2SetsWon,
      status: match.status,
      winnerId: match.winnerId,
    })
  );
  match.history = [...(match.history || []), snapshot].slice(-50);

  if (match.status === "scheduled") match.status = "live";

  const key = player === 1 ? "p1" : "p2";
  match.currentSet = { ...match.currentSet, [key]: match.currentSet[key] + 1 };

  const { p1, p2 } = match.currentSet;
  const setWon = (p1 >= 11 || p2 >= 11) && Math.abs(p1 - p2) >= 2;

  if (setWon) {
    match.sets = [...match.sets, { p1, p2 }];
    if (p1 > p2) match.player1SetsWon += 1;
    else match.player2SetsWon += 1;
    match.currentSet = { p1: 0, p2: 0 };

    const setsToWin = Math.ceil(match.bestOf / 2);
    if (match.player1SetsWon >= setsToWin || match.player2SetsWon >= setsToWin) {
      match.status = "finished";
      match.winnerId = match.player1SetsWon > match.player2SetsWon ? match.player1Id : match.player2Id;
      awardRankingPoints(match);
    }
  }

  const updated = db.update("matches", match.id, match);
  emitScore(req, updated);
  res.json(withPlayerNames(updated));
});

// Hakam / admin: oxirgi harakatni bekor qilish
router.post("/:id/undo", requireAuth(["admin", "referee"]), (req, res) => {
  const match = db.find("matches", (m) => m.id === req.params.id);
  if (!match) return res.status(404).json({ error: "O'yin topilmadi" });
  const history = match.history || [];
  if (history.length === 0) return res.status(400).json({ error: "Bekor qilinadigan harakat yo'q" });
  const last = history[history.length - 1];
  const updated = db.update("matches", match.id, { ...last, history: history.slice(0, -1) });
  emitScore(req, updated);
  res.json(withPlayerNames(updated));
});

function awardRankingPoints(match) {
  const tournament = db.find("tournaments", (t) => t.id === match.tournamentId);
  const coefficient = tournament ? tournament.levelCoefficient || 1 : 1;
  // Soddalashtirilgan namuna: g'olibga bosqich ballari asosida ball beriladi (TZ 6-bo'lim).
  const stageBase = { final: 700, semifinal: 450, quarterfinal: 250, round1: 120 };
  const base = stageBase[match.stage] || 100;
  const points = Math.round(base * coefficient);
  const winner = db.find("players", (p) => p.id === match.winnerId);
  if (winner) {
    db.update("players", winner.id, { rankingPoints: (winner.rankingPoints || 0) + points });
  }
}

module.exports = router;

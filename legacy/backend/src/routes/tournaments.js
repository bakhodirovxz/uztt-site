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

router.get("/", (req, res) => {
  res.json(db.all("tournaments").sort((a, b) => b.startDate - a.startDate));
});

router.get("/:id", (req, res) => {
  const t = db.find("tournaments", (t) => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: "Musobaqa topilmadi" });
  const matches = db
    .filter("matches", (m) => m.tournamentId === t.id)
    .map(withPlayerNames)
    .sort((a, b) => a.scheduledTime - b.scheduledTime);
  res.json({ ...t, matches });
});

router.post("/", requireAuth(["admin"]), (req, res) => {
  const t = { id: uuid(), status: "scheduled", createdAt: Date.now(), ...req.body };
  db.insert("tournaments", t);
  res.status(201).json(t);
});

router.put("/:id", requireAuth(["admin"]), (req, res) => {
  const updated = db.update("tournaments", req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Musobaqa topilmadi" });
  res.json(updated);
});

module.exports = router;

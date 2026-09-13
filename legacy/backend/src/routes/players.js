const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const { gender, region } = req.query;
  let players = db.all("players");
  if (gender) players = players.filter((p) => p.gender === gender);
  if (region) players = players.filter((p) => p.region === region);
  res.json(players);
});

router.get("/:id", (req, res) => {
  const player = db.find("players", (p) => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: "O'yinchi topilmadi" });
  const matches = db
    .filter("matches", (m) => m.player1Id === player.id || m.player2Id === player.id)
    .map((m) => ({ ...m }));
  res.json({ ...player, matches });
});

router.post("/", requireAuth(["admin"]), (req, res) => {
  const p = { id: uuid(), rankingPoints: 0, ...req.body, createdAt: Date.now() };
  db.insert("players", p);
  res.status(201).json(p);
});

router.put("/:id", requireAuth(["admin"]), (req, res) => {
  const updated = db.update("players", req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "O'yinchi topilmadi" });
  res.json(updated);
});

router.delete("/:id", requireAuth(["admin"]), (req, res) => {
  const ok = db.remove("players", req.params.id);
  res.json({ ok });
});

module.exports = router;

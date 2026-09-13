const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const { gender, ageCategory } = req.query;
  let players = db.all("players");
  if (gender) players = players.filter((p) => p.gender === gender);
  if (ageCategory) players = players.filter((p) => p.ageCategory === ageCategory);
  players = [...players].sort((a, b) => (b.rankingPoints || 0) - (a.rankingPoints || 0));
  res.json(players.map((p, i) => ({ rank: i + 1, ...p })));
});

module.exports = router;

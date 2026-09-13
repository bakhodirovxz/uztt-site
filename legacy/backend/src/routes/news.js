const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яёʻʼ\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

const router = express.Router();

router.get("/", (req, res) => {
  const items = db
    .all("news")
    .filter((n) => n.status === "published")
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(items);
});

router.get("/:slug", (req, res) => {
  const item = db.find("news", (n) => n.slug === req.params.slug);
  if (!item) return res.status(404).json({ error: "Yangilik topilmadi" });
  res.json(item);
});

router.get("/admin/all", requireAuth(["admin"]), (req, res) => {
  res.json(db.all("news").sort((a, b) => b.createdAt - a.createdAt));
});

router.post("/", requireAuth(["admin"]), (req, res) => {
  const { title, body, category, status } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "Sarlavha va matn shart" });
  const item = {
    id: uuid(),
    title,
    body,
    category: category || "Umumiy",
    status: status || "draft",
    slug: slugify(title) + "-" + Date.now().toString(36),
    createdAt: Date.now(),
  };
  db.insert("news", item);
  res.status(201).json(item);
});

router.put("/:id", requireAuth(["admin"]), (req, res) => {
  const updated = db.update("news", req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Yangilik topilmadi" });
  res.json(updated);
});

router.delete("/:id", requireAuth(["admin"]), (req, res) => {
  const ok = db.remove("news", req.params.id);
  res.json({ ok });
});

module.exports = router;

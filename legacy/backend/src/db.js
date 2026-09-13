// Oddiy fayl-asoslangan (JSON) ma'lumotlar do'koni.
// MVP maqsadida ishlatiladi - production'da PostgreSQL bilan almashtiriladi (TZ 7-bo'lim).
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const COLLECTIONS = [
  "users",
  "players",
  "tournaments",
  "matches",
  "rankingPointsTable",
  "news",
];

function emptyState() {
  const state = {};
  for (const c of COLLECTIONS) state[c] = [];
  return state;
}

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyState(), null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

let state = load();
let writeQueued = false;

function persist() {
  if (writeQueued) return;
  writeQueued = true;
  setImmediate(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
    writeQueued = false;
  });
}

const db = {
  all(collection) {
    return state[collection] || [];
  },
  find(collection, predicate) {
    return (state[collection] || []).find(predicate);
  },
  filter(collection, predicate) {
    return (state[collection] || []).filter(predicate);
  },
  insert(collection, record) {
    state[collection].push(record);
    persist();
    return record;
  },
  update(collection, id, patch) {
    const idx = state[collection].findIndex((r) => r.id === id);
    if (idx === -1) return null;
    state[collection][idx] = { ...state[collection][idx], ...patch };
    persist();
    return state[collection][idx];
  },
  remove(collection, id) {
    const before = state[collection].length;
    state[collection] = state[collection].filter((r) => r.id !== id);
    persist();
    return state[collection].length < before;
  },
  reset() {
    state = emptyState();
    persist();
  },
};

module.exports = db;

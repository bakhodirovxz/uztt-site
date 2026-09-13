const { v4: uuid } = require("uuid");
const bcrypt = require("bcryptjs");
const db = require("./db");

db.reset();

// --- Foydalanuvchilar ---
const admin = {
  id: uuid(),
  ism: "Bosh Administrator",
  email: "admin@uztt.uz",
  passwordHash: bcrypt.hashSync("admin123", 8),
  role: "admin",
};
const referee = {
  id: uuid(),
  ism: "Hakam Aliyev",
  email: "hakam1@uztt.uz",
  passwordHash: bcrypt.hashSync("hakam123", 8),
  role: "referee",
};
db.insert("users", admin);
db.insert("users", referee);

// --- O'yinchilar ---
const regions = ["Toshkent", "Samarqand", "Farg'ona", "Andijon", "Buxoro", "Namangan"];
const menNames = [
  "Jasur Rahimov", "Sardor Yusupov", "Bekzod Qodirov", "Otabek Nazarov",
  "Sherzod Tursunov", "Diyorbek Ergashev",
];
const womenNames = [
  "Madina Karimova", "Nilufar Xolova", "Zarina Yusupova", "Kamola Ismoilova",
  "Sevara Rashidova", "Gulnoza Aminova",
];

function makePlayers(names, gender) {
  return names.map((fullName, i) => ({
    id: uuid(),
    fullName,
    gender,
    ageCategory: "SENIOR",
    region: regions[i % regions.length],
    club: `"${regions[i % regions.length]}" STT klubi`,
    licenseNumber: `UZTT-${gender === "MALE" ? "M" : "F"}-${1000 + i}`,
    rankingPoints: Math.floor(Math.random() * 400) + 100,
    photoUrl: null,
  }));
}

const men = makePlayers(menNames, "MALE");
const women = makePlayers(womenNames, "FEMALE");
[...men, ...women].forEach((p) => db.insert("players", p));

// --- Reyting ball jadvali (namuna, TZ 6-bo'lim) ---
[
  { id: uuid(), level: "Respublika chempionati", coefficient: 3.0 },
  { id: uuid(), level: "Respublika kubogi", coefficient: 2.5 },
  { id: uuid(), level: "Viloyat chempionati", coefficient: 1.5 },
  { id: uuid(), level: "Klublararo turnir", coefficient: 1.0 },
].forEach((r) => db.insert("rankingPointsTable", r));

// --- Musobaqa ---
const now = Date.now();
const tournament = {
  id: uuid(),
  name: "Respublika Chempionati 2026",
  levelName: "Respublika chempionati",
  levelCoefficient: 3.0,
  location: "Toshkent, Universal Sport Majmuasi",
  ageCategory: "SENIOR",
  gender: "MIXED",
  format: "Yakka eleminatsiya",
  startDate: now,
  endDate: now + 3 * 24 * 3600 * 1000,
  status: "live",
  createdAt: now,
};
db.insert("tournaments", tournament);

function match(overrides) {
  return {
    id: uuid(),
    tournamentId: tournament.id,
    overlayToken: uuid(),
    bestOf: 5,
    currentSet: { p1: 0, p2: 0 },
    sets: [],
    player1SetsWon: 0,
    player2SetsWon: 0,
    status: "scheduled",
    winnerId: null,
    history: [],
    ...overrides,
  };
}

// 1-o'yin: hozir jonli boshlanadigan demo o'yin (1-stol)
const liveMatch = match({
  stage: "semifinal",
  tableNumber: 1,
  scheduledTime: now,
  player1Id: men[0].id,
  player2Id: men[1].id,
  status: "scheduled",
});

// 2-o'yin: kelajakda rejalashtirilgan
const upcomingMatch = match({
  stage: "semifinal",
  tableNumber: 2,
  scheduledTime: now + 30 * 60 * 1000,
  player1Id: women[0].id,
  player2Id: women[1].id,
});

// 3-o'yin: yakunlangan (namuna natija bilan)
const finishedMatch = match({
  stage: "quarterfinal",
  tableNumber: 1,
  scheduledTime: now - 3 * 3600 * 1000,
  player1Id: men[2].id,
  player2Id: men[3].id,
  status: "finished",
  sets: [{ p1: 11, p2: 7 }, { p1: 9, p2: 11 }, { p1: 11, p2: 6 }],
  player1SetsWon: 2,
  player2SetsWon: 1,
  winnerId: men[2].id,
});

[liveMatch, upcomingMatch, finishedMatch].forEach((m) => db.insert("matches", m));

// --- Yangiliklar ---
[
  {
    id: uuid(),
    title: "Respublika Chempionati 2026 start oldi",
    slug: "respublika-chempionati-2026-start-oldi",
    body: "Bugundan boshlab Toshkent shahridagi Universal Sport Majmuasida Respublika Chempionati 2026 o'z ishini boshladi. Musobaqada mamlakatimizning barcha viloyatlaridan eng kuchli o'yinchilar ishtirok etmoqda.",
    category: "Musobaqalar",
    status: "published",
    createdAt: now,
  },
  {
    id: uuid(),
    title: "Federatsiya yangi hakamlar guruhini tayyorladi",
    slug: "federatsiya-yangi-hakamlar-guruhini-tayyorladi",
    body: "O'zbekiston Stol Tennisi Federatsiyasi navbatdagi hakamlar tayyorlash kursini muvaffaqiyatli yakunladi. Yangi hakamlar mamlakat bo'ylab musobaqalarda faoliyat yuritishadi.",
    category: "Federatsiya",
    status: "published",
    createdAt: now - 5 * 24 * 3600 * 1000,
  },
  {
    id: uuid(),
    title: "Yosh o'yinchilar uchun mahalliy turnir e'lon qilindi",
    slug: "yosh-oyinchilar-uchun-mahalliy-turnir-elon-qilindi",
    body: "Yosh avlod stol tennischilarini qo'llab-quvvatlash maqsadida navbatdagi U15 toifasidagi turnir tashkil etilmoqda.",
    category: "Yoshlar",
    status: "published",
    createdAt: now - 10 * 24 * 3600 * 1000,
  },
].forEach((n) => db.insert("news", n));

console.log("Demo ma'lumotlar muvaffaqiyatli yuklandi.");
console.log("Admin: admin@uztt.uz / admin123");
console.log("Hakam: hakam1@uztt.uz / hakam123");
console.log("Jonli demo o'yin ID:", liveMatch.id, "| Overlay token:", liveMatch.overlayToken);

const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const playerRoutes = require("./routes/players");
const tournamentRoutes = require("./routes/tournaments");
const matchRoutes = require("./routes/matches");
const rankingRoutes = require("./routes/rankings");
const newsRoutes = require("./routes/news");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/players", playerRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/rankings", rankingRoutes);
app.use("/api/news", newsRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, time: Date.now() }));

// Frontend production build bo'lsa, statik fayl sifatida beramiz
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) next();
  });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set("io", io);

io.on("connection", (socket) => {
  socket.on("join", (matchId) => {
    socket.join(`match:${matchId}`);
  });
  socket.on("leave", (matchId) => {
    socket.leave(`match:${matchId}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`O'zbekiston Stol Tennisi Federatsiyasi backend ${PORT}-portda ishga tushdi`);
});

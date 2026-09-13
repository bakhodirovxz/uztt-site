import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import NewsList from "./pages/NewsList";
import NewsDetail from "./pages/NewsDetail";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";
import Rankings from "./pages/Rankings";
import About from "./pages/About";
import Contact from "./pages/Contact";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminNews from "./pages/AdminNews";
import AdminTournaments from "./pages/AdminTournaments";
import AdminTournamentDetail from "./pages/AdminTournamentDetail";
import RefereeLive from "./pages/RefereeLive";
import Overlay from "./pages/Overlay";
import NotFound from "./pages/NotFound";

function PublicLayout({ children }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/overlay/:token" element={<Overlay />} />

      <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/yangiliklar" element={<PublicLayout><NewsList /></PublicLayout>} />
      <Route path="/yangiliklar/:slug" element={<PublicLayout><NewsDetail /></PublicLayout>} />
      <Route path="/musobaqalar" element={<PublicLayout><Tournaments /></PublicLayout>} />
      <Route path="/musobaqalar/:id" element={<PublicLayout><TournamentDetail /></PublicLayout>} />
      <Route path="/oyinchilar" element={<PublicLayout><Players /></PublicLayout>} />
      <Route path="/oyinchilar/:id" element={<PublicLayout><PlayerDetail /></PublicLayout>} />
      <Route path="/reyting" element={<PublicLayout><Rankings /></PublicLayout>} />
      <Route path="/federatsiya" element={<PublicLayout><About /></PublicLayout>} />
      <Route path="/aloqa" element={<PublicLayout><Contact /></PublicLayout>} />
      <Route path="/kirish" element={<PublicLayout><AdminLogin /></PublicLayout>} />

      <Route path="/hakam" element={<PublicLayout><ProtectedRoute roles={["admin", "referee"]}><RefereeLive /></ProtectedRoute></PublicLayout>} />

      <Route path="/admin" element={<PublicLayout><ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute></PublicLayout>} />
      <Route path="/admin/yangiliklar" element={<PublicLayout><ProtectedRoute roles={["admin"]}><AdminNews /></ProtectedRoute></PublicLayout>} />
      <Route path="/admin/musobaqalar" element={<PublicLayout><ProtectedRoute roles={["admin"]}><AdminTournaments /></ProtectedRoute></PublicLayout>} />
      <Route path="/admin/musobaqalar/:id" element={<PublicLayout><ProtectedRoute roles={["admin"]}><AdminTournamentDetail /></ProtectedRoute></PublicLayout>} />

      <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
    </Routes>
  );
}

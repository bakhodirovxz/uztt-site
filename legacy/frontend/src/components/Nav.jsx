import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="nav-brand">O'ZBEKISTON STOL TENNISI FEDERATSIYASI</NavLink>
        <div className="nav-links">
          <NavLink to="/">Bosh sahifa</NavLink>
          <NavLink to="/yangiliklar">Yangiliklar</NavLink>
          <NavLink to="/musobaqalar">Musobaqalar</NavLink>
          <NavLink to="/oyinchilar">O'yinchilar</NavLink>
          <NavLink to="/reyting">Reyting</NavLink>
          <NavLink to="/federatsiya">Federatsiya</NavLink>
          {user ? (
            <>
              {(user.role === "admin" || user.role === "referee") && (
                <NavLink to="/hakam">Hakam paneli</NavLink>
              )}
              {user.role === "admin" && <NavLink to="/admin">Boshqaruv</NavLink>}
              <a onClick={() => { logout(); navigate("/"); }} style={{ cursor: "pointer" }}>Chiqish ({user.ism})</a>
            </>
          ) : (
            <NavLink to="/kirish">Kirish</NavLink>
          )}
        </div>
      </div>
    </div>
  );
}

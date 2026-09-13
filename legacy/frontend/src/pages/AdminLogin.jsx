import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@uztt.uz");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const user = await login(email, password);
      if (user.role === "admin") navigate("/admin");
      else navigate("/hakam");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container page" style={{ maxWidth: 420 }}>
      <h1 className="section-title">Tizimga kirish</h1>
      <div className="card">
        <form onSubmit={onSubmit}>
          <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label>Parol</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p style={{ color: "var(--accent)" }}>{error}</p>}
          <button className="btn btn-primary" type="submit">Kirish</button>
        </form>
        <p style={{ fontSize: 12, color: "#888", marginTop: 16 }}>
          Demo: admin@uztt.uz / admin123 (Bosh administrator)<br />
          Demo: hakam1@uztt.uz / hakam123 (Hakam)
        </p>
      </div>
    </div>
  );
}

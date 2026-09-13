import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="container page">
      <h1>404 — Sahifa topilmadi</h1>
      <Link to="/">Bosh sahifaga qaytish</Link>
    </div>
  );
}

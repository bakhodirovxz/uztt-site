import { Link } from "react-router-dom";

export default function AdminDashboard() {
  return (
    <div className="container page">
      <h1 className="section-title">Boshqaruv paneli</h1>
      <div className="grid grid-3">
        <Link to="/admin/yangiliklar" className="card"><h3>Yangiliklar</h3><p style={{ color: "#666" }}>Yaratish, tahrirlash, nashr etish</p></Link>
        <Link to="/admin/musobaqalar" className="card"><h3>Musobaqalar</h3><p style={{ color: "#666" }}>Musobaqa va o'yinlar yaratish</p></Link>
        <Link to="/hakam" className="card"><h3>Hakam / jonli ochko</h3><p style={{ color: "#666" }}>Jonli o'yinlarni boshqarish</p></Link>
      </div>
    </div>
  );
}

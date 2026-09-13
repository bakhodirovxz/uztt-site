import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function NewsList() {
  const [news, setNews] = useState([]);
  useEffect(() => { api.get("/news").then(setNews).catch(() => {}); }, []);
  return (
    <div className="container page">
      <h1 className="section-title">Yangiliklar</h1>
      <div className="grid grid-3">
        {news.map((n) => (
          <Link to={`/yangiliklar/${n.slug}`} key={n.id} className="card">
            <span className="badge badge-scheduled">{n.category}</span>
            <h3 style={{ margin: "10px 0 6px" }}>{n.title}</h3>
            <p style={{ color: "#666", fontSize: 14 }}>{n.body.slice(0, 100)}...</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

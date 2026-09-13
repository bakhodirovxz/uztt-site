import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

export default function NewsDetail() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/news/${slug}`).then(setItem).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <div className="container page">Xatolik: {error}</div>;
  if (!item) return <div className="container page">Yuklanmoqda...</div>;

  return (
    <div className="container page">
      <Link to="/yangiliklar">&larr; Yangiliklarga qaytish</Link>
      <span className="badge badge-scheduled" style={{ display: "block", width: "fit-content", margin: "16px 0" }}>{item.category}</span>
      <h1>{item.title}</h1>
      <p style={{ lineHeight: 1.7, fontSize: 16 }}>{item.body}</p>
    </div>
  );
}

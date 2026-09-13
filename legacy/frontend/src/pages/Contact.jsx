import { useState } from "react";

export default function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <div className="container page">
      <h1 className="section-title">Aloqa</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        {sent ? (
          <p>Xabaringiz uchun rahmat! (MVP: xabar hozircha faqat namoyish uchun, backend'ga yuborilmaydi)</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
            <div className="field"><label>Ism</label><input required /></div>
            <div className="field"><label>Email</label><input type="email" required /></div>
            <div className="field"><label>Xabar</label><textarea rows={4} required /></div>
            <button className="btn btn-primary" type="submit">Yuborish</button>
          </form>
        )}
      </div>
    </div>
  );
}

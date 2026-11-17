import { useCallback, useEffect, useRef, useState } from "react";
import "./carousel.css";

// Carrousel horizontal : défilement tactile (aimantation) + flèches + points. Aucune librairie.
export default function Carousel({ label, items, renderItem, dark = false }) {
  const track = useRef(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const per = Math.max(1, Math.round(el.clientWidth / (el.firstElementChild?.getBoundingClientRect().width || el.clientWidth)));
    setPages(Math.max(1, Math.ceil(items.length / per)));
    const step = el.scrollWidth / items.length;
    setPage(Math.min(Math.max(0, Math.round(el.scrollLeft / (step * per))), Math.max(0, Math.ceil(items.length / per) - 1)));
  }, [items.length]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const move = (dir) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: "smooth" });
  const goto = (index) => { const el = track.current; if (el) el.scrollTo({ left: (el.scrollWidth / pages) * index, behavior: "smooth" }); };

  return (
    <div className={`rv-carousel${dark ? " rv-dark" : ""}`} role="region" aria-roledescription="carrousel" aria-label={label}>
      <button type="button" className="rv-car-btn prev" onClick={() => move(-1)} aria-label="Précédent">‹</button>
      <div className="rv-car-track" ref={track} onScroll={measure} tabIndex={0}>
        {items.map((item, index) => <div className="rv-car-slide" key={item.src || index}>{renderItem(item, index)}</div>)}
      </div>
      <button type="button" className="rv-car-btn next" onClick={() => move(1)} aria-label="Suivant">›</button>
      {pages > 1 && <div className="rv-car-dots">{Array.from({ length: pages }, (_, i) => <button type="button" key={i} className={i === page ? "on" : ""} onClick={() => goto(i)} aria-label={`Page ${i + 1} sur ${pages}`} />)}</div>}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { asset } from "./base.js";

// Bannière d'accueil : une photo représentative par catégorie, défilement automatique toutes les 2,5 s.
export const HERO_DELAY_MS = 4000;                  // temps minimum pendant lequel une photo reste nette et visible
export const HERO_SLIDES = [
  { src: asset("/hero/0.jpg"), label: "Chaud · Frais · RAVITO" },
  { src: asset("/hero/1.jpg"), label: "Burgers et wraps" },
  { src: asset("/hero/2.jpg"), label: "Brochettes" },
  { src: asset("/hero/3.jpg"), label: "Poissons et poulets braisés" },
  { src: asset("/hero/4.jpg"), label: "Viandes grillées" },
  { src: asset("/hero/5.jpg"), label: "Salades gourmandes" },
  { src: asset("/hero/6.jpg"), label: "Spaghettis" },
  { src: asset("/hero/7.jpg"), label: "Ailes de poulet" },
  { src: asset("/hero/8.jpg"), label: "Riz et plats mijotés" },
  { src: asset("/hero/9.jpg"), label: "Accompagnements" },
];

const reducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

export default function HeroSlides() {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(2);          // photos déjà demandées (la courante + les 2 suivantes à l'avance)
  const [ready, setReady] = useState({});             // i -> "ok" | "fail" : téléchargée ET décodée (donc nette)
  const shownAt = useRef(0);                          // instant où la photo courante est devenue visible

  // Une photo n'apparaît qu'une fois entièrement chargée et décodée, jamais à moitié floue.
  const markReady = (i, status) => setReady((r) => (r[i] ? r : { ...r, [i]: status }));
  const onLoad = (i) => (event) => {
    const img = event.currentTarget;
    // Sur de vieux Safari (iPhone 6/7), decode() peut ne jamais répondre : on n'attend pas plus de 1,5 s.
    const decoded = img.decode ? img.decode() : Promise.resolve();
    Promise.race([decoded, new Promise((resolve) => window.setTimeout(resolve, 1500))]).then(() => markReady(i, "ok"), () => markReady(i, "ok"));
  };

  useEffect(() => { setMounted((n) => Math.max(n, Math.min(HERO_SLIDES.length, index + 3))); }, [index]);
  useEffect(() => { if (ready[index] === "ok") shownAt.current = Date.now(); }, [index, ready[index]]);   // le décompte commence quand elle est visible

  useEffect(() => {
    if (reducedMotion()) return undefined;
    const tick = setInterval(() => {
      if (document.hidden || ready[index] !== "ok") return;                         // rien tant que la photo courante n'est pas nette
      if (Date.now() - shownAt.current < HERO_DELAY_MS) return;                      // au moins HERO_DELAY_MS bien visible
      for (let step = 1; step < HERO_SLIDES.length; step += 1) {
        const next = (index + step) % HERO_SLIDES.length;
        if (ready[next] === "ok") { setIndex(next); return; }                        // on passe à la prochaine photo prête
        if (ready[next] !== "fail") return;                                          // pas encore prête : on attend, sans jamais montrer du flou
      }
    }, 250);
    return () => clearInterval(tick);
  }, [index, ready]);

  const go = (i) => { setMounted((n) => Math.max(n, Math.min(HERO_SLIDES.length, i + 2))); setIndex(i); shownAt.current = Date.now(); };
  const shown = ready[index] === "ok";
  return (
    <>
      <div className="hero-photo" aria-hidden="true">
        {HERO_SLIDES.slice(0, mounted).map((slide, i) => (
          <img key={slide.src} src={slide.src} alt="" decoding="async" fetchPriority={i <= 1 ? "high" : "low"}
            ref={(node) => { if (node && node.complete && node.naturalWidth > 0 && !ready[i]) onLoad(i)({ currentTarget: node }); }}
            onLoad={onLoad(i)} onError={() => markReady(i, "fail")} className={i === index && shown ? "on" : ""} />
        ))}
      </div>
      <div className="hero-caption" aria-hidden="true">{shown ? HERO_SLIDES[index].label : ""}</div>
      <div className="hero-dots" role="group" aria-label="Photos de plats">
        {HERO_SLIDES.map((slide, i) => <button type="button" key={slide.src} className={i === index ? "on" : ""} onClick={() => go(i)} aria-label={`Photo ${i + 1} sur ${HERO_SLIDES.length} : ${slide.label}`} aria-current={i === index} />)}
      </div>
    </>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import "./tour.css";

// Guide de première visite : petites étiquettes flottantes, une étape à la fois.
// Une seule fois par appareil (mémorisé dans le navigateur) ; "Passer" l'arrête définitivement.
const RESTART_EVENT = "ravito:tour-restart";
export const restartTour = () => window.dispatchEvent(new Event(RESTART_EVENT));
const memory = new Set();                       // repli si le stockage du navigateur est indisponible
const isDone = (key) => { try { return localStorage.getItem(key) === "1"; } catch { return memory.has(key); } };
const markDone = (key) => { memory.add(key); try { localStorage.setItem(key, "1"); } catch { /* repli mémoire */ } };
const clearDone = (key) => { memory.delete(key); try { localStorage.removeItem(key); } catch { /* repli mémoire */ } };

const find = (selector) => {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// steps : [{ target?: "css selector", title, text, before?: () => void, advanceOnClick?: boolean }]
export default function Tour({ steps, storageKey, ready = true, delay = 700 }) {
  const [index, setIndex] = useState(-1);          // -1 = pas démarré
  const [rect, setRect] = useState(null);
  const [active, setActive] = useState(false);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef(null);
  const navRef = useRef(0);                   // la dernière navigation l'emporte (clics rapides)
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const finish = useCallback(() => { navRef.current += 1; markDone(storageKey); setActive(false); setIndex(-1); setRect(null); }, [storageKey]);

  // Cherche l'étape suivante dont la cible existe (les étapes sans cible sont des messages centrés).
  const go = useCallback(async (from, dir = 1) => {
    const nav = ++navRef.current;
    let i = from;
    for (;;) {
      const step = stepsRef.current[i];
      if (!step) return finish();
      if (step.before) { try { step.before(); } catch { /* sans incidence */ } }
      if (!step.target) { setIndex(i); return; }
      let el = null;
      const tries = Math.ceil((step.wait ?? 1200) / 150);
      for (let n = 0; n <= tries && !el; n += 1) { el = find(step.target); if (!el && n < tries) await sleep(150); }
      if (nav !== navRef.current) return;
      if (el) { el.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "smooth" }); setIndex(i); return; }
      i += dir;
      if (i < 0) return finish();
    }
  }, [finish]);

  useEffect(() => {
    if (!ready || isDone(storageKey)) return undefined;
    const timer = setTimeout(() => { setActive(true); go(0); }, delay);
    return () => clearTimeout(timer);
  }, [ready, storageKey, delay, go]);

  useEffect(() => {
    const restart = () => { clearDone(storageKey); setActive(true); go(0); };
    window.addEventListener(RESTART_EVENT, restart);
    return () => window.removeEventListener(RESTART_EVENT, restart);
  }, [storageKey, go]);

  const step = active && index >= 0 ? steps[index] : null;

  // Suit la cible quand la page défile, change de taille ou se met à jour.
  useEffect(() => {
    if (!step) return undefined;
    const update = () => {
      setSize({ w: window.innerWidth, h: window.innerHeight });
      const el = find(step.target);
      setRect(el ? el.getBoundingClientRect().toJSON() : null);
    };
    update();
    const timer = setInterval(update, 250);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { clearInterval(timer); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [step]);

  useEffect(() => {
    if (!step) return undefined;
    const onKey = (event) => { if (event.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, finish]);

  // Si la personne clique sur le vrai bouton montré, on passe à la suite.
  useEffect(() => {
    if (!step?.target || !step.advanceOnClick) return undefined;
    const el = find(step.target);
    if (!el) return undefined;
    const onClick = () => setTimeout(() => go(index + 1), 450);
    el.addEventListener("click", onClick, { once: true });
    return () => el.removeEventListener("click", onClick);
  }, [step, index, go]);

  if (!step) return null;
  const last = index === steps.length - 1;
  const cardW = Math.min(300, size.w - 24);
  const cardH = cardRef.current?.offsetHeight || 150;
  let left = (size.w - cardW) / 2, top = (size.h - cardH) / 2, arrow = null;
  if (rect) {
    const below = rect.bottom + 14 + cardH <= size.h - 8;
    top = below ? rect.bottom + 14 : Math.max(8, rect.top - 14 - cardH);
    left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), size.w - cardW - 12);
    arrow = { x: Math.min(Math.max(18, rect.left + rect.width / 2 - left), cardW - 18), up: below };
  }
  return (
    <div className="tour-layer" role="dialog" aria-label="Guide de découverte">
      {rect && <div className="tour-ring" style={{ left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 }} />}
      <div ref={cardRef} className="tour-card" style={{ left, top, width: cardW }} aria-live="polite">
        {arrow && <span className={`tour-arrow ${arrow.up ? "up" : "down"}`} style={{ left: arrow.x }} />}
        <div className="tour-count">Étape {index + 1} sur {steps.length}</div>
        <b>{step.title}</b>
        <p>{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={finish}>Passer le guide</button>
          <span>
            {index > 0 && <button type="button" className="tour-back" onClick={() => go(index - 1, -1)}>Retour</button>}
            <button type="button" className="tour-next" onClick={() => (last ? finish() : go(index + 1))}>{last ? "C'est parti !" : "Suivant"}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

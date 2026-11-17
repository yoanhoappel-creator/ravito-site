// Paiement du panier : la commande n'est créée par le serveur qu'une fois le paiement accepté (Airtel Money / Moov Money).
// Le montant est calculé par le serveur ; rien n'est validé sur la foi du navigateur.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { fetchProof } from "./antibot.js";
import { asset } from "./base.js";
import { startCartPayment, checkSubscriptionPayment } from "./subscriber.js";

const fmt = (n) => `${Math.round(n || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ")} FCFA`;
const KEY = "ravito-cart-payment";
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v?.reference && v?.token && v?.trackingToken ? v : null; } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
export const hasPendingCartPayment = () => Boolean(load());
const clear = () => { try { localStorage.removeItem(KEY); } catch { /* stockage indisponible */ } };
const POLL_MS = 3000, MAX_MS = 4 * 60 * 1000;
const randomToken = () => { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

// Notification système (si le client l'a autorisée) : utile quand la page est en arrière-plan pendant la confirmation.
export function notifyHere(title, body) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (navigator.serviceWorker?.ready) navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: asset("/icons/ravito-public-192.png"), tag: "ravito-paiement" })).catch(() => {});
    else new Notification(title, { body });
  } catch { /* notification facultative */ }
}

export const OPERATORS = [
  { key: "airtel", label: "Airtel Money", logo: asset("/payment/airtel-money.png"), cls: "op-airtel" },
  { key: "moov", label: "Moov Money", logo: asset("/payment/moov-money.png"), cls: "op-moov" },
];

/**
 * formRef : le formulaire du panier (validé avant de payer) · buildRequest() → { restaurantId, customer, items } ·
 * snapshot() → ce qu'il faut pour afficher le bon de commande après paiement · onPaid(status, payment) · total : montant estimé affiché.
 */
export default function CartPayment({ formRef, buildRequest, snapshot, total, defaultPhone, onPaid, onRefused }) {
  const [operateur, setOperateur] = useState("");
  const [phone, setPhone] = useState(defaultPhone || "");
  const [phase, setPhase] = useState(() => (load() ? "waiting" : "choose"));   // choose | waiting
  const [error, setError] = useState("");
  const timer = useRef(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(timer.current); }; }, []);
  useEffect(() => { if (!phone && defaultPhone) setPhone(defaultPhone); }, [defaultPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  async function poll(payment, started = Date.now()) {
    try {
      const status = await checkSubscriptionPayment(payment.reference, payment.token);
      if (!alive.current) return;
      if (status.status === "paid" && status.order) { clear(); onPaid?.(status, payment); return; }
      if (["failed", "review", "expired"].includes(status.status)) {
        clear(); setPhase("choose");
        const message = status.message || "Paiement refusé. Ta commande n'a pas été envoyée.";
        setError(message); onRefused?.(message);
        return;
      }
    } catch (e) { if (e.status === 404) { clear(); if (alive.current) setPhase("choose"); return; } }
    if (Date.now() - started > MAX_MS) {
      clear();
      if (alive.current) { const message = "Paiement non confirmé. Ta commande n'a pas été envoyée : réessaie."; setPhase("choose"); setError(message); onRefused?.(message); }
      return;
    }
    timer.current = window.setTimeout(() => poll(payment, started), POLL_MS);
  }
  useEffect(() => { const stored = load(); if (stored) poll(stored); /* reprise après rechargement */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setError("");
    if (formRef?.current && !formRef.current.reportValidity()) return;
    if (!operateur) return setError("Choisis Airtel Money ou Moov Money pour payer.");
    if (phone.replace(/\D/g, "").length < 8) return setError("Écris le numéro qui paie.");
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch { /* facultatif */ }
    setPhase("waiting");
    try {
      const trackingToken = randomToken();
      const send = async (proof) => startCartPayment({ ...buildRequest(), operateur, msisdn: phone, trackingToken, proof, website: "" });
      let proof = await fetchProof();
      if (!proof) throw new Error("Vérification anti-robot impossible. Recharge la page et réessaie.");
      let response;
      try { response = await send(proof); }
      catch (e) { if (!/instant|expir/i.test(e.message)) throw e; await new Promise((r) => window.setTimeout(r, 4000)); proof = await fetchProof(); await new Promise((r) => window.setTimeout(r, 3500)); response = await send(proof); }
      let payment = response.token ? { reference: response.reference, token: response.token, trackingToken, snapshot: snapshot() } : load();
      if (!payment || payment.reference !== response.reference) throw new Error("Une demande de paiement est déjà en cours. Confirme-la sur ton téléphone.");
      save(payment); poll(payment);
    } catch (e) { setError(e.message); setPhase("choose"); }
  }

  if (phase === "waiting") return (
    <div className="order-pay pay-wait" role="status">
      <Loader2 className="spin" size={26} /><h4>Confirme sur ton téléphone</h4>
      <p>Une demande de <b>{fmt(total)}</b> arrive. Valide-la avec ton code secret : ta commande part dès que le paiement est accepté.</p>
      <small>Ne ferme pas cette page : elle se met à jour toute seule.</small>
    </div>
  );
  return (
    <div className="order-pay" data-tour="order-pay">
      <h4>Paiement</h4>
      <div className="op-grid" role="group" aria-label="Mode de paiement">
        {OPERATORS.map((o) => (
          <button type="button" key={o.key} className={`op-btn ${o.cls}${operateur === o.key ? " on" : ""}`} onClick={() => setOperateur(o.key)} aria-pressed={operateur === o.key} aria-label={o.label}>
            <img className="op-img" src={o.logo} alt={o.label} width="120" height="56" loading="eager" />
            {operateur === o.key && <Check className="op-check" size={16} />}
          </button>
        ))}
      </div>
      {operateur && <label>Numéro {OPERATORS.find((o) => o.key === operateur).label} qui paie
        <input type="tel" inputMode="tel" autoComplete="tel" maxLength={24} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 12 34 56" /></label>}
      <p className="pay-hint">Tu recevras un message de confirmation sur ce numéro. Rien n'est débité sans ton accord, et la commande n'est envoyée au restaurant qu'une fois le paiement accepté.</p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="checkout-button" type="button" onClick={start}>Payer {fmt(total)} et valider<span aria-hidden="true"> →</span></button>
    </div>
  );
}

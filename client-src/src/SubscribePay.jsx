// Abonnement payé en ligne : choix de la formule, confirmation sur le téléphone (Airtel Money / Moov Money), activation automatique.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Smartphone } from "lucide-react";
import { fetchProof } from "./antibot.js";
import { loadPayment, savePayment, clearPayment, startSubscriptionPayment, checkSubscriptionPayment, fetchSubscription, saveCreds } from "./subscriber.js";

const fmt = (n) => `${Math.round(n || 0).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ")} F`;
const OPERATORS = [{ key: "airtel", label: "Airtel Money" }, { key: "moov", label: "Moov Money" }];
const POLL_MS = 3000;

export default function SubscribePay({ plans, onActivated }) {
  const keys = Object.keys(plans || {}).filter((k) => plans[k]?.prix?.mois > 0);
  const [formule, setFormule] = useState(keys.includes("basique") ? "basique" : keys[0]);
  const [periodicite, setPeriodicite] = useState("mois");
  const [operateur, setOperateur] = useState("airtel");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [phase, setPhase] = useState("form");               // form | waiting | done
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const proofRef = useRef(null);
  const timer = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(timer.current); }; }, []);

  const plan = plans?.[formule];
  const price = plan?.prix?.[periodicite] || 0;
  const saving = plan ? 4 * (plan.prix?.semaine || 0) - (plan.prix?.mois || 0) : 0;

  async function poll(payment, started = Date.now()) {
    try {
      const status = await checkSubscriptionPayment(payment.reference, payment.token);
      if (!alive.current) return;
      if (status.status === "paid" && status.subscription?.code) {
        clearPayment();
        const creds = { telephone: payment.telephone || telephone, code: status.subscription.code };
        saveCreds(creds);
        setResult(status.subscription); setPhase("done");
        try { onActivated(creds, await fetchSubscription(creds.telephone, creds.code)); } catch { /* le code reste affiché */ }
        return;
      }
      if (["failed", "review", "expired"].includes(status.status)) {
        if (status.status === "failed") clearPayment();
        setError(status.message || "Le paiement n'a pas abouti."); setPhase(status.status === "failed" ? "form" : "form"); return;
      }
    } catch (e) { if (e.status === 404) { clearPayment(); setError("Ce paiement est introuvable."); setPhase("form"); return; } }
    if (Date.now() - started > 4 * 60 * 1000) { setError("Aucune confirmation reçue. Si ton compte a été débité, écris-nous sur WhatsApp : nous activons ton abonnement."); setPhase("form"); return; }
    timer.current = window.setTimeout(() => poll(payment, started), POLL_MS);
  }

  // Paiement commencé avant un rechargement de la page : on reprend la surveillance.
  useEffect(() => { const pending = loadPayment(); if (pending) { setPhase("waiting"); poll(pending); } }, []);       // eslint-disable-line react-hooks/exhaustive-deps
  // Épreuve anti-robot préparée pendant que le client remplit le formulaire.
  useEffect(() => { if (phase === "form" && !proofRef.current) proofRef.current = fetchProof().catch(() => null); }, [phase]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (nom.trim().length < 2) return setError("Écris ton nom.");
    if (telephone.replace(/\D/g, "").length < 8) return setError("Écris le numéro de téléphone qui paie.");
    setPhase("waiting");
    try {
      let proof = await (proofRef.current || fetchProof()); proofRef.current = null;
      if (!proof) throw new Error("Vérification anti-robot impossible. Recharge la page et réessaie.");
      const body = (p) => ({ nom: nom.trim(), telephone, msisdn: telephone, formule, periodicite, operateur, proof: p, website: "" });
      let response;
      try { response = await startSubscriptionPayment(body(proof)); }
      catch (e) { if (!/seconde|expir/i.test(e.message)) throw e; await new Promise((r) => window.setTimeout(r, 3500)); response = await startSubscriptionPayment(body(await fetchProof())); }
      let payment = response.token ? { reference: response.reference, token: response.token, telephone } : null;
      if (!payment) { const stored = loadPayment(); if (stored?.reference === response.reference) payment = stored; }
      if (!payment) throw new Error("Une demande de paiement est déjà en cours pour ce numéro. Confirme-la sur ton téléphone.");
      savePayment(payment);
      poll(payment);
    } catch (e) { proofRef.current = null; setError(e.message); setPhase("form"); }
  }

  if (!keys.length) return null;
  if (phase === "done") return <div className="pay-done" role="status"><div className="success-mark"><Check size={26} /></div><h3>Abonnement activé !</h3><p>Ton code d'abonnement :</p><div className="sub-code">{result?.code}</div><p className="sub-help">Il est enregistré sur ce téléphone. Garde-le pour toi.</p></div>;
  if (phase === "waiting") return <div className="pay-wait" role="status"><Loader2 className="spin" size={30} /><h3>Confirme sur ton téléphone</h3><p>Une demande de paiement de <b>{fmt(price)}</b> arrive par {OPERATORS.find((o) => o.key === operateur)?.label}. Compose ton code secret pour la valider.</p><small>On t'affiche ton code dès que c'est confirmé, sans rien faire de plus.</small></div>;

  return (
    <form className="pay-form" onSubmit={submit}>
      <h3>Je m'abonne</h3>
      <p className="privacy-note">Paiement par Airtel Money ou Moov Money. Ton abonnement s'active tout seul, sans capture d'écran.</p>
      <div className="pay-plans" role="group" aria-label="Formule">{keys.map((k) => <button type="button" key={k} className={formule === k ? "on" : ""} onClick={() => setFormule(k)} aria-pressed={formule === k}><b>{plans[k].nom}</b><small>{fmt(plans[k].prix.mois)} / mois</small></button>)}</div>
      <div className="pay-period" role="group" aria-label="Durée">
        <button type="button" className={periodicite === "mois" ? "on" : ""} onClick={() => setPeriodicite("mois")} aria-pressed={periodicite === "mois"}>Mensuel<small>{fmt(plan?.prix?.mois)} · recommandé</small></button>
        <button type="button" className={periodicite === "semaine" ? "on" : ""} onClick={() => setPeriodicite("semaine")} aria-pressed={periodicite === "semaine"}>Pour essayer<small>{fmt(plan?.prix?.semaine)} · 1 semaine</small></button>
      </div>
      <p className="pay-hint">{periodicite === "mois" ? `Un seul paiement, rien à renouveler chaque semaine${saving > 0 ? `, et ${fmt(saving)} de moins que 4 semaines` : ""}.` : "Tu testes une semaine. Si ça ne te plaît pas, tu ne renouvelles pas, c'est tout."}</p>
      <label>Ton nom<input required autoComplete="name" maxLength={80} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Aïcha Ndong" /></label>
      <div className="pay-ops" role="group" aria-label="Opérateur">{OPERATORS.map((o) => <button type="button" key={o.key} className={operateur === o.key ? "on" : ""} onClick={() => setOperateur(o.key)} aria-pressed={operateur === o.key}><Smartphone size={15} /> {o.label}</button>)}</div>
      <label>Numéro qui paie<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={24} value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="07 12 34 56" /></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }} />
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="checkout-button" type="submit">Payer {fmt(price)}</button>
    </form>
  );
}

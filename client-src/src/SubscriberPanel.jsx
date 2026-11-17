import { useEffect, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { QrImage, qrPayload } from "./qr.jsx";
import SubscribePay from "./SubscribePay.jsx";
import { fetchSubscription, saveCreds, clearSaved, pushStatus, enableCustomerPush, disableCustomerPush, resyncCustomerPush } from "./subscriber.js";

const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const GUIDE_KEY = "ravito-sub-guide-seen";
const guideSeen = () => { try { return localStorage.getItem(GUIDE_KEY) === "1"; } catch { return true; } };
const markGuideSeen = () => { try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* stockage indisponible */ } };
const PUSH_TEXT = {
  on: "Notifications activées sur cet appareil.",
  off: "Active les notifications pour suivre ta commande.",
  denied: "Notifications bloquées : autorise-les dans les réglages du téléphone.",
  "needs-install": "Sur iPhone : ajoute RAVITO à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis rouvre l'application.",
  unsupported: "Les notifications ne sont pas disponibles sur ce navigateur.",
};

// saved : { telephone, code } enregistré sur l'appareil ; view : dernière situation connue (serveur).
export default function SubscriberPanel({ saved, view, offline, plans, payEnabled, onClose, onLogin, onLogout, onOrder }) {
  const [telephone, setTelephone] = useState(saved?.telephone || "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [push, setPush] = useState("off");
  const [pushBusy, setPushBusy] = useState(false);
  const [firstGuide] = useState(() => !guideSeen());

  useEffect(() => { pushStatus().then(setPush).catch(() => {}); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const login = async (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const subscription = await fetchSubscription(telephone, code);
      const creds = { telephone: telephone.trim(), code: code.trim().toUpperCase() };
      saveCreds(creds);
      onLogin(creds, subscription);
      setCode("");
      resyncCustomerPush(creds, { welcome: true }).catch(() => {});
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const togglePush = async () => {
    setPushBusy(true); setError("");
    try {
      if (push === "on") await disableCustomerPush(); else await enableCustomerPush(saved);
      setPush(await pushStatus());
    } catch (e) { setError(e.message); }
    finally { setPushBusy(false); }
  };
  const logout = async () => {
    clearSaved(); onLogout();                               // déconnexion immédiate…
    disableCustomerPush().catch(() => {});                  // …puis arrêt des notifications en arrière-plan
  };

  const active = view?.status === "active";
  const showForm = !saved || view?.status === "expired";
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="cart-drawer sub-panel" role="dialog" aria-modal="true" aria-label="Mon abonnement">
        <div className="drawer-head"><div><span className="eyebrow dark-eyebrow">ESPACE ABONNÉ</span><h2>Mon abonnement</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={18} /></button></div>

        {saved && view && (
          <div className="sub-card">
            <div className="sub-line"><b>{view.formuleNom || view.formule}</b><span>· {view.periodicite === "mois" ? "mensuel" : "hebdomadaire"}</span><em className={active ? "ok" : "ko"}>{active ? "Actif" : "Expiré"}</em></div>
            <div className="sub-dates">{active ? `Valable jusqu'au ${fmtDate(view.dateFin)}` : `Terminé le ${fmtDate(view.dateFin)}`}{view.nom ? ` · ${view.nom}` : ""}</div>
            {active && <>
              <div className="sub-qr"><QrImage value={qrPayload(saved.code.toUpperCase())} size={210} /></div>
              <div className="sub-code">{saved.code.toUpperCase()}</div>
              <p className="sub-help">Montre ce QR à ton livreur à la livraison. Si le scan ne marche pas, donne-lui ce code.</p>
              <details className="sub-guide" open={firstGuide} onToggle={markGuideSeen}>
                <summary>Comment utiliser mon abonnement ?</summary>
                <ol>
                  <li><b>Ton code</b> : c'est le code qui commence par « RV- », reçu par WhatsApp à l'activation. Tu l'entres une seule fois sur ce téléphone, avec ton numéro. Il s'affiche aussi en dessous du QR.</li>
                  <li><b>Commander</b> : touche « Commander avec mon abonnement », choisis un restaurant et un plat inclus dans ta formule. Un repas par jour, du lundi au vendredi, sans rien payer de plus.</li>
                  <li><b>À la livraison</b> : montre le QR ci-dessus au livreur pour qu'il le scanne. Si le scan échoue, donne-lui le code écrit sous le QR.</li>
                  <li><b>Suivi</b> : active les notifications pour être prévenu à chaque étape (prise en charge, prête, en route). Tu peux aussi voir l'avancement sur ton bon de commande.</li>
                  <li><b>Fin de l'abonnement</b> : à la date indiquée, il se termine. Écris-nous sur WhatsApp pour le renouveler et recevoir un nouveau code.</li>
                  <li><b>Garde ton code pour toi</b> : il donne accès à ton abonnement.</li>
                </ol>
              </details>
              <button className="checkout-button" onClick={onOrder}>Commander avec mon abonnement <ArrowRight size={16} /></button>
              <div className="sub-push"><p>{PUSH_TEXT[push]}</p>
                {(push === "on" || push === "off") && <button className="text-button" onClick={togglePush} disabled={pushBusy}>{pushBusy ? "…" : push === "on" ? "Désactiver les notifications" : "Activer les notifications"}</button>}
              </div>
            </>}
            {offline && <p className="sub-help">Hors connexion : dernière situation connue affichée.</p>}
          </div>
        )}

        {showForm && payEnabled && <SubscribePay plans={plans} onActivated={(creds, subscription) => { onLogin(creds, subscription); resyncCustomerPush(creds, { welcome: true }).catch(() => {}); }} />}
        {showForm && payEnabled && <p className="pay-or">— ou —</p>}
        {showForm && (
          <form className="checkout-form" onSubmit={login}>
            <h3>{saved ? "Ton abonnement est terminé" : payEnabled ? "J'ai déjà un code" : "Accède à ton abonnement"}</h3>
            <p className="privacy-note">{saved ? "Entre le code de ton nouvel abonnement reçu de RAVITO." : "Entre ton numéro et le code d'abonnement reçu de RAVITO (message WhatsApp). Tu n'auras à le faire qu'une fois sur cet appareil."}</p>
            <label>Ton téléphone<input required type="tel" autoComplete="tel" maxLength={24} value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="07 00 00 00" /></label>
            <label>Code d'abonnement<input required autoCapitalize="characters" autoCorrect="off" spellCheck="false" maxLength={40} value={code} onChange={(e) => setCode(e.target.value)} placeholder="RV-…" style={{ fontFamily: "monospace" }} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="checkout-button" disabled={busy}>{busy ? "Vérification…" : "Accéder à mon abonnement"}<Check size={17} /></button>
          </form>
        )}
        {!showForm && error && <div className="form-error" role="alert">{error}</div>}

        {saved && <button className="text-button sub-logout" onClick={logout}>Me déconnecter de mon abonnement</button>}
      </aside>
    </div>
  );
}

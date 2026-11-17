// Bouton « Partager ma position » : fortement conseillé, le livreur trouve l'adresse sans appeler le client.
import { useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { getPosition } from "./location.js";

/** value : { lat, lng, accuracy } | null · onChange(position | null) peut être asynchrone (envoi au serveur) et lever une erreur. */
export default function ShareLocation({ value, onChange, title = "Partage ta position" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function share() {
    setError(""); setBusy(true);
    try { await onChange(await getPosition()); } catch (e) { setError(e.message || "Position indisponible."); } finally { setBusy(false); }
  }
  async function remove() { setError(""); setBusy(true); try { await onChange(null); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return (
    <div className={`share-loc${value ? " done" : ""}`} data-tour="share-location">
      {value ? (
        <>
          <div className="share-loc-ok"><Check size={17} /><span><b>Position enregistrée</b>{value.accuracy ? ` · précision d’environ ${Math.round(value.accuracy)} m` : ""}</span></div>
          <p>Seul ton livreur la voit, pendant ta livraison. Elle est effacée dès que tu es livré.</p>
          <div className="share-loc-actions">
            <button type="button" className="text-button" onClick={share} disabled={busy}>{busy ? "Mise à jour…" : "Mettre à jour"}</button>
            <button type="button" className="text-button" onClick={remove} disabled={busy}>Retirer</button>
          </div>
        </>
      ) : (
        <>
          <b className="share-loc-title">📍 {title}</b>
          <p><b>Fortement conseillé</b> : ton livreur te trouve du premier coup, sans avoir besoin de t’appeler. Seul lui la voit, et elle est effacée dès la livraison.</p>
          <button type="button" className="share-loc-btn" onClick={share} disabled={busy}>
            {busy ? <><Loader2 className="spin" size={16} /> Localisation en cours…</> : <><MapPin size={16} /> Partager ma position</>}
          </button>
        </>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}

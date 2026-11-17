// Position GPS du client (partagée volontairement) et liens d'itinéraire pour le livreur.
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Ton téléphone ne permet pas de partager la position depuis cette page."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1
        ? "Position refusée. Autorise la localisation pour ce site dans les réglages de ton téléphone, puis réessaie."
        : e.code === 3 ? "Position introuvable : active le GPS et réessaie près d’une fenêtre ou à l’extérieur."
        : "Position indisponible. Active le GPS et réessaie.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

import { apiUrl } from "./base.js";

export async function sendOrderPosition(orderId, token, position) {
  const response = await fetch(apiUrl("/api/public/order-position"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, token, position }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Enregistrement impossible. Réessaie.");
  return data;
}

// Un lien « itinéraire jusqu'au client » qui s'ouvre dans Google Maps ou Plans (Apple).
export const googleRouteUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
export const appleRouteUrl = (p) => `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=d`;
export const isAppleDevice = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent || "");

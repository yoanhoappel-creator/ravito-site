// Point d'entrée de la version CLIENT hébergée à part (GitHub Pages) : la vitrine s'affiche tout de suite,
// pendant que le serveur RAVITO (Render, offre gratuite) se réveille. L'espace équipe n'est pas inclus.
import { API_BASE, BASE } from "./base.js";
// Réveil du serveur dès l'ouverture (réponse ignorée : on veut seulement le sortir de veille).
try { if (API_BASE) fetch(`${API_BASE}/api/health`, { mode: "no-cors", cache: "no-store" }).catch(() => {}); } catch { /* sans importance */ }

import React from "react";
import { createRoot } from "react-dom/client";
import PublicStore from "./PublicStore.jsx";
import "./client.css";
import "./ad-theme.css";

document.title = "RAVITO — Repas et livraison à Port-Gentil";
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register(`${BASE}service-worker.js`, { scope: BASE }).catch(() => {}), { once: true });
}
createRoot(document.getElementById("root")).render(<React.StrictMode><PublicStore /></React.StrictMode>);

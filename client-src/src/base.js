// Adresses de base : sur le serveur Render tout est à la racine (rien ne change).
// Dans la version statique hébergée sur GitHub Pages, les fichiers sont sous un sous-dossier (BASE_URL)
// et les appels vont vers le serveur RAVITO (VITE_API_BASE).
const env = import.meta.env || {};
const rawBase = env.BASE_URL || "/";
export const BASE = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
export const API_BASE = String(env.VITE_API_BASE || "").replace(/\/+$/, "");
export const apiUrl = (path) => (typeof path === "string" && path.startsWith("/api/") ? `${API_BASE}${path}` : path);
export const asset = (path) => (typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? `${BASE}${path.slice(1)}` : path);

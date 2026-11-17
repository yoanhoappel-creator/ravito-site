// Règles de la commande guidée par l'assistant. Ce sont les MÊMES règles que le formulaire du site
// (nom, téléphone, adresse, un seul restaurant, abonné = un seul repas de sa formule).

export const TIER = { basique: 1, intermediaire: 2, premium: 3 };
export const allowedNiveaux = (formule) => Object.keys(TIER).filter((key) => TIER[key] <= (TIER[formule] || 1));
export const dishesForFormula = (menu, formule) => (menu || []).filter((dish) => allowedNiveaux(formule).includes(dish.niveau || "basique"));

export const SPECIAL_REQUESTS = ["Sans piment", "Avec piment", "Sans oignon", "Avec oignon", "Sans mayonnaise", "Sans aromate"];
export const WATER_CHOICES = ["Petite bouteille", "Grande bouteille", "Eau gazeuse"];
export const DRINK_CHOICES = ["Jus de bissap", "Jus de gingembre", "Jus d'orange", "Jus d'ananas"];

// Quelles boissons demander selon la formule : intermédiaire = eau ; premium = jus + eau ; basique = aucune.
export function drinkPlan(formule, formulesInfo) {
  const info = formulesInfo?.[formule];
  if (!info || !info.boissons) return [];
  return formule === "premium" ? ["boisson", "eau"] : ["eau"];
}

export const isOrderRequest = (text) => {
  const t = String(text || "").toLowerCase();
  if (/\bcomment\b|\?$/.test(t) && !/je (veux|voudrais)/.test(t)) return false;
  return /\b(je (veux|voudrais|prends|prendrai|prendrais)|j['’]aimerais|j['’]en veux|commander|passer (une )?commande|une commande)\b/.test(t);
};

export const validName = (v) => String(v || "").trim().length >= 2;
export const validPhone = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 7 && d.length <= 15; };
export const validAddress = (v) => String(v || "").trim().length >= 4;

export function composeNote({ requests = [], text = "", drink = {} } = {}) {
  const parts = [];
  const asks = [...requests, String(text || "").trim()].filter(Boolean);
  if (asks.length) parts.push(`Demandes : ${asks.join(", ")}`);
  if (drink.boisson) parts.push(`Boisson : ${drink.boisson}`);
  if (drink.eau) parts.push(`Eau : ${drink.eau}`);
  return parts.join(" · ").slice(0, 300);
}

export const summarizeCart = (lines) => lines.map(({ dish, quantity }) => `${quantity} × ${dish.nomPlat}`).join(", ");

// Touche une demande : on la retire si elle y est déjà ; « Sans piment » et « Avec piment » (idem oignon) s'excluent.
export function toggleRequest(list, value) {
  if (list.includes(value)) return list.filter((r) => r !== value);
  const topic = /piment/i.test(value) ? /piment/i : /oignon/i.test(value) ? /oignon/i : null;
  return [...list.filter((r) => !(topic && topic.test(r))), value];
}

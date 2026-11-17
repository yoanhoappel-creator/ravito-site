// Espace abonné (vitrine) : les identifiants restent sur l'appareil jusqu'à ce que le client
// se déconnecte lui-même. Le serveur revérifie à chaque ouverture.
import { pushSupported, pushStatus, readyOrNull } from "./push.js";
import { apiUrl } from "./base.js";

const KEY = "ravito-subscriber";
export const loadSaved = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v?.telephone && v?.code ? v : null; } catch { return null; } };
export const saveCreds = (value) => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* stockage indisponible */ } };
export const clearSaved = () => { try { localStorage.removeItem(KEY); } catch { /* stockage indisponible */ } };

async function post(path, body) {
  const response = await fetch(apiUrl(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || "Le service est momentanément indisponible."); error.status = response.status; throw error; }
  return data;
}
// Paiement d'abonnement en ligne : le jeton secret reste sur l'appareil, il permet de retrouver son code même après un rechargement.
const PAY_KEY = "ravito-sub-payment";
export const loadPayment = () => { try { const v = JSON.parse(localStorage.getItem(PAY_KEY) || "null"); return v?.reference && v?.token ? v : null; } catch { return null; } };
export const savePayment = (value) => { try { localStorage.setItem(PAY_KEY, JSON.stringify(value)); } catch { /* stockage indisponible */ } };
export const clearPayment = () => { try { localStorage.removeItem(PAY_KEY); } catch { /* stockage indisponible */ } };
export const startSubscriptionPayment = (body) => post("/api/public/subscribe/pay", body);
export const startCartPayment = (body) => post("/api/public/orders/pay", body);
export const checkSubscriptionPayment = (reference, token) => post("/api/public/subscribe/status", { reference, token });
export const fetchSubscription = (telephone, code) => post("/api/public/subscription", { telephone, code }).then((d) => d.subscription);

const toBytes = (value) => {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
};
export { pushSupported, pushStatus };

// À appeler depuis un clic (obligatoire sur iPhone).
export async function enableCustomerPush({ telephone, code }) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications refusées. Autorise-les dans les réglages du téléphone pour RAVITO.");
  const registration = await readyOrNull();
  if (!registration) throw new Error("Notifications indisponibles pour le moment. Réessaie dans un instant.");
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { publicKey } = await (await fetch(apiUrl("/api/public/push-key"))).json();
    if (!publicKey) throw new Error("Notifications indisponibles pour le moment.");
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) });
  }
  await post("/api/public/subscription/push", { telephone, code, subscription: subscription.toJSON(), welcome: true });
}
// Réenregistre silencieusement un appareil déjà autorisé (après un nouveau code, par exemple).
export async function resyncCustomerPush(creds, { welcome = false } = {}) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const registration = await readyOrNull();
  const subscription = registration && await registration.pushManager.getSubscription();
  if (subscription) await post("/api/public/subscription/push", { ...creds, subscription: subscription.toJSON(), welcome });
}
export async function disableCustomerPush() {
  if (!pushSupported()) return;
  const registration = await readyOrNull();
  const subscription = registration && await registration.pushManager.getSubscription();
  if (!subscription) return;
  try { await post("/api/public/subscription/unsubscribe", { endpoint: subscription.endpoint }); } finally { await subscription.unsubscribe(); }
}

// Habitudes de l'abonné (dernier restaurant, plat habituel, préférences de boisson).
export const fetchHabits = (telephone, code) => post("/api/public/subscription/habits", { telephone, code }).then((d) => d.habits);

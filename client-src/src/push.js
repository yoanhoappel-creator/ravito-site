// Côté application : abonnement aux notifications push.
const toBytes = (value) => {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { credentials: "same-origin", headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Le serveur est momentanément indisponible.");
  return data;
}

// navigator.serviceWorker.ready ne se résout jamais si aucun service worker n'est actif : on n'attend pas plus de 3 s.
export const readyOrNull = () => Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(() => resolve(null), 3000))]);
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

// "unsupported" | "needs-install" | "denied" | "off" | "on"
export async function pushStatus() {
  if (!pushSupported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  try {
    const registration = await readyOrNull();
    return registration && (await registration.pushManager.getSubscription()) ? "on" : "off";
  } catch { return "off"; }
}

// Après une connexion explicite : le prochain enregistrement demande une notification de bienvenue.
let welcomeNext = false;
export const markWelcome = () => { welcomeNext = true; };
const takeWelcome = () => { const value = welcomeNext; welcomeNext = false; return value; };

async function subscribeAndSave(welcome = false) {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { publicKey } = await api("/push/key");
    if (!publicKey) throw new Error("Notifications indisponibles pour le moment.");
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) });
  }
  await api("/push/subscribe", { method: "POST", body: JSON.stringify({ subscription: subscription.toJSON(), welcome }) });
}

// Choix volontaire de l'utilisateur (bouton cloche) : on ne réactive pas tout seul après un rechargement.
const OPT_OUT_KEY = "ravito_push_opt_out";
const optedOut = () => { try { return localStorage.getItem(OPT_OUT_KEY) === "1"; } catch { return false; } };
const setOptOut = (value) => { try { value ? localStorage.setItem(OPT_OUT_KEY, "1") : localStorage.removeItem(OPT_OUT_KEY); } catch { /* stockage indisponible */ } };

// À appeler depuis un clic (obligatoire sur iPhone).
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications refusées. Autorise-les dans les réglages du téléphone pour RAVITO.");
  await subscribeAndSave(true);
  setOptOut(false);
}

// Après une nouvelle connexion : réenregistre silencieusement l'abonnement déjà autorisé.
export async function resyncPush() {
  if (pushSupported() && Notification.permission === "granted" && !optedOut()) await subscribeAndSave(takeWelcome());
}

export async function disablePush({ remember = false } = {}) {
  if (remember) setOptOut(true);
  if (!pushSupported()) return;
  const registration = await readyOrNull();
  const subscription = registration && await registration.pushManager.getSubscription();
  if (!subscription) return;
  try { await api("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: subscription.endpoint }) }); } finally { await subscription.unsubscribe(); }
}

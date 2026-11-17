import { showTeamButton } from "./team-install.js";
import { useEffect, useMemo, useRef, useState } from "react";
import Assistant from "./Assistant.jsx";
import Tour from "./Tour.jsx";
import Carousel from "./Carousel.jsx";
import HeroSlides from "./HeroSlides.jsx";
import { MENU_LIBRARY, ILLUSTRATION_NOTE } from "./menu-library.js";
// Petites vignettes d'ambiance sous l'accroche : elles disent au premier coup d'œil que c'est un site de repas.
const HERO_TASTES = [asset("/menu-library/52-burger-bacon-bleu.jpg"), asset("/menu-library/55-riz-rouge-poulet-roti.jpg"), asset("/menu-library/54-salade-composee.jpg"), asset("/menu-library/56-poisson-braise-frites.jpg"), asset("/menu-library/57-poulet-petits-pois.jpg")];
import { allowedNiveaux } from "./order-flow.js";
import { alternativesFor, ratingLabel, busyWarning } from "./assistant-logic.js";
import { ArrowRight, Check, ChevronRight, Clock3, MapPin, Minus, Plus, QrCode, Search, ShoppingBag, Utensils, X } from "lucide-react";
import SubscriberPanel from "./SubscriberPanel.jsx";
import CartPayment, { notifyHere, hasPendingCartPayment } from "./CartPayment.jsx";
import ShareLocation from "./ShareLocation.jsx";
import { sendOrderPosition } from "./location.js";
import { fetchProof } from "./antibot.js";
import { loadSaved, fetchSubscription, resyncCustomerPush } from "./subscriber.js";
import { apiUrl, asset, BASE } from "./base.js";
const formatXaf = (value) => `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} FCFA`;

async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Le service de commande n’est pas disponible pour le moment.");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Une erreur est survenue. Réessaie.");
  return data;
}

// Animation du logo pendant le réveil du serveur (offre gratuite) : le message change au fil de l'attente.
const WAKING_MESSAGES = ["On allume les fourneaux…", "On prépare la carte du jour…", "Les livreurs enfilent leur casque…", "Encore quelques secondes, ça arrive !"];
function WakingSplash() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [setTimeout(() => setStep(1), 8000), setTimeout(() => setStep(2), 20000), setTimeout(() => setStep(3), 36000)];
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="waking-splash" role="status" aria-live="polite">
      <div className="waking-logo"><span className="waking-ring" aria-hidden="true" /><span className="waking-ring waking-ring-2" aria-hidden="true" /><img src={asset("/icons/ravito-public-192.png")} alt="" width="84" height="84" /></div>
      <p className="waking-msg" key={step}>{WAKING_MESSAGES[step]}</p>
      <div className="waking-bar" aria-hidden="true"><span /></div>
    </div>
  );
}

// Les photos de plats viennent du serveur : adresse complète quand l'application est hébergée à part.
const withApiImages = (data) => (data && Array.isArray(data.restaurants) ? { ...data, restaurants: data.restaurants.map((r) => ({ ...r, menu: (r.menu || []).map((item) => (item.image ? { ...item, image: apiUrl(item.image) } : item)) })) } : data);

// staffEntry : fourni seulement dans l'espace équipe (/equipe/), pour passer de la vitrine à la connexion.
// Le panier s'ouvre tout seul quand on ajoute un plat : le guide suit ce vrai parcours.
const clientTour = (closeCart) => [
  { title: "Bienvenue chez RAVITO 👋", text: "Je te montre en quelques étapes comment commander. Tu peux arrêter quand tu veux avec « Passer le guide »." },
  { target: '[data-tour="search"]', title: "Cherche ce qui te fait envie", text: "Écris le nom d'un plat ou d'un restaurant, la liste se met à jour toute seule." },
  { target: '[data-tour="filters"]', title: "Ou choisis un restaurant", text: "Touche le nom d'un restaurant pour ne voir que ses plats." },
  { target: '[data-tour="dish-add"]', advanceOnClick: true, title: "Ajoute ton premier plat", text: "Touche le bouton + pour mettre ce plat dans ton panier. Rien n'est envoyé tout de suite, tu peux essayer sans crainte." },
  { target: '[data-tour="cart-lines"]', wait: 400, title: "Voici ton panier", text: "Tes plats et leur prix. Avec + et − tu changes les quantités." },
  { target: '[data-tour="checkout-form"]', wait: 400, title: "Dis-nous où te livrer", text: "Remplis ton nom, ton téléphone et ton adresse. Un petit détail pour le restaurant est possible, mais facultatif." },
  { target: '[data-tour="send-order"]', wait: 400, title: "Envoie ta demande", text: "Le restaurant confirme ta commande, puis tu la suis ici, étape par étape, avec une notification à chaque avancée." },
  { target: '[data-tour="cart"]', before: closeCart, title: "Ton panier, à tout moment", text: "Retrouve ici ce que tu as choisi, ou le suivi de ta commande en cours." },
  { target: '[data-tour="sub"]', title: "Tu as un abonnement ?", text: "Entre ton numéro et ton code pour retrouver ton abonnement et ton QR de livraison, et commander ton repas du jour sans rien payer au restaurant." },
  { target: '[data-tour="assistant"]', title: "Une question ? Je suis là", text: "L'assistant te répond à tout moment : menus, livraison, suivi de commande. Tu peux aussi y revoir ce guide." },
];

// Étapes de la commande, vues par le client.
const ORDER_STEPS = ["Reçue", "Confirmée", "En préparation", "Prête", "En livraison", "Livrée"];
const STEP_OF = { "À confirmer": 0, "Payée": 0, "Confirmée": 1, "En préparation": 2, "Prête": 3, "Livreur assigné": 3, "En livraison": 4, "Livrée": 5 };
function OrderSteps({ status }) {
  if (status === "Annulée" || status === "Incident") return <p className="order-steps-stop" role="status">{status === "Annulée" ? "Cette commande a été annulée." : "Un incident a été signalé : RAVITO te contacte."}</p>;
  const current = STEP_OF[status] ?? 0;
  return <ol className="order-steps" aria-label="Avancement de la commande">{ORDER_STEPS.map((label, index) => <li key={label} className={index < current ? "done" : index === current ? "now" : ""} aria-current={index === current ? "step" : undefined}><i>{index < current ? "✓" : index + 1}</i><span>{label}</span></li>)}</ol>;
}

export default function PublicStore({ staffEntry } = {}) {
  const [catalog, setCatalog] = useState(null);
  const [problem, setProblem] = useState("");
  const [waking, setWaking] = useState(false);
  const [query, setQuery] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("Tous");
  const [cart, setCart] = useState({});
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState({ nom: "", telephone: "", adresse: "", heure: "", note: "" });
  const [sending, setSending] = useState(false);
  const [order, setOrder] = useState(null);
  const [tracker, setTracker] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ravito-order-tracker") || "null"); } catch { return null; }
  });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [ratingPick, setRatingPick] = useState(0);
  const [ratingSending, setRatingSending] = useState(false);
  const [ratingError, setRatingError] = useState("");
  // Espace abonné : les identifiants restent sur l'appareil jusqu'à la déconnexion volontaire du client.
  const [saved, setSaved] = useState(() => loadSaved());
  const [subView, setSubView] = useState(() => loadSaved()?.view || null);
  const [subOffline, setSubOffline] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [useSub, setUseSub] = useState(true);
  const [position, setPosition] = useState(null);          // position GPS partagée dans le panier (facultative, fortement conseillée)
  const [orderPos, setOrderPos] = useState(undefined);     // position envoyée après la commande (undefined = selon la commande)
  const proofRef = useRef(null);

  useEffect(() => {
    document.title = "RAVITO — Repas et livraison à Port-Gentil";
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.content = "index, follow";
    // Le serveur gratuit peut dormir : on réessaie en douceur (et on l'explique) au lieu d'afficher une erreur.
    let stop = false;
    const started = Date.now();
    const wakeTimer = setTimeout(() => { if (!stop) setWaking(true); }, 4000);
    (async () => {
      while (!stop) {
        const controller = new AbortController();
        const abort = setTimeout(() => controller.abort(), 20000);
        try {
          const data = await api("/api/public/catalog", { signal: controller.signal });
          clearTimeout(abort);
          if (stop) return;
          setCatalog(withApiImages(data)); setWaking(false);
          return;
        } catch (error) {
          clearTimeout(abort);
          if (stop) return;
          if (Date.now() - started > 120000) { setWaking(false); setProblem("Le service de commande met du temps à répondre. Réessaie dans un instant."); return; }
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    })();
    return () => { stop = true; clearTimeout(wakeTimer); };
  }, []);
  // Arrivée depuis le site vitrine : les informations du client sont déjà remplies (elles voyagent après le #, jamais vers un serveur).
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    const hash = window.location.hash || "";
    try {
      if (hash === "#abo") { setSubOpen(true); }
      else if (hash.startsWith("#cmd=")) {
        const json = decodeURIComponent(escape(atob(hash.slice(5).replace(/-/g, "+").replace(/_/g, "/"))));
        const data = JSON.parse(json);
        const clean = (value, max) => String(value || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
        const m = clean(data.heure, 30).match(/^(\d{1,2})\s*(?:h|:)\s*(\d{2})?$/i);
        const heure = m && Number(m[1]) < 24 && Number(m[2] || 0) < 60 ? `${String(m[1]).padStart(2, "0")}:${m[2] || "00"}` : "";
        const note = [clean(data.note, 260), !heure && clean(data.heure, 30) ? `Heure souhaitée : ${clean(data.heure, 30)}` : ""].filter(Boolean).join(" · ");
        setForm((f) => ({ ...f, nom: clean(data.nom, 80) || f.nom, telephone: clean(data.tel, 24) || f.telephone, adresse: clean(data.adresse, 180) || f.adresse, heure, note }));
        setPrefilled(true);
        window.setTimeout(() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }), 400);
      }
    } catch { /* lien invalide : on ignore, le client remplit à la main */ }
    if (hash.startsWith("#cmd=") || hash === "#abo") window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    if (!saved) return undefined;
    let cancelled = false;
    fetchSubscription(saved.telephone, saved.code).then((view) => {
      if (cancelled) return;
      setSubView(view); setSubOffline(false);
      try { localStorage.setItem("ravito-subscriber", JSON.stringify({ ...saved, view })); } catch { /* stockage indisponible */ }
      if (view.status === "active") resyncCustomerPush(saved).catch(() => {});
      setForm((f) => ({ ...f, nom: f.nom || view.nom || "", telephone: f.telephone || saved.telephone }));
    }).catch((error) => {
      if (cancelled) return;
      if (error.status === 404) setSubView(null);        // code inconnu : on garde l'appareil, le client peut saisir un nouveau code
      else setSubOffline(true);                            // hors connexion : on garde la dernière situation connue
    });
    return () => { cancelled = true; };
  }, [saved?.telephone, saved?.code]);
  useEffect(() => {
    if (!drawer || order || !cartLines.length || proofRef.current) return;
    proofRef.current = fetchProof().catch(() => null);      // épreuve anti-robot préparée pendant que le client remplit le formulaire
  }, [drawer, order, cart]);
  useEffect(() => {
    if (!tracker) return undefined;
    try { localStorage.setItem("ravito-order-tracker", JSON.stringify(tracker)); } catch { /* Browser storage can be disabled. */ }
  }, [tracker]);
  useEffect(() => {
    if (!tracker || ["Livrée", "Annulée", "Incident"].includes(tracker.status)) return undefined;
    let cancelled = false;
    const check = async () => {
      try {
        const result = await api("/api/public/order-status", { method: "POST", body: JSON.stringify({ orderId: tracker.id, token: tracker.token }) });
        if (!cancelled) setTracker((current) => current?.id === tracker.id ? { ...current, ...result.order } : current);
      } catch { /* Keep the last known status and retry on the next interval. */ }
    };
    check();
    const interval = window.setInterval(check, 15000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [tracker?.id, tracker?.token, tracker?.status]);
  useEffect(() => {
    if (!drawer) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => { if (event.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [drawer]);

  const restaurants = catalog?.restaurants || [];
  const covered = Boolean(saved && subView?.status === "active" && useSub);     // abonné actif qui utilise son abonnement
  const tierName = covered ? (catalog?.formules?.[subView.formule]?.nom || subView.formuleNom || "") : "";
  const allDishes = useMemo(() => restaurants.flatMap((restaurant) => (restaurant.menu || []).map((dish) => ({ ...dish, restaurant }))), [restaurants]);
  const filters = useMemo(() => ["Tous", ...new Set(restaurants.map((r) => r.nom))], [restaurants]);
  const visibleDishes = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    return allDishes.filter((dish) => (!covered || allowedNiveaux(subView.formule).includes(dish.niveau || "basique"))      // l'abonné ne voit que le menu de sa formule
      && (restaurantFilter === "Tous" || dish.restaurant.nom === restaurantFilter)
      && (!q || `${dish.nomPlat} ${dish.description || ""} ${dish.restaurant.nom}`.toLocaleLowerCase("fr").includes(q)));
  }, [allDishes, query, restaurantFilter, covered, subView?.formule]);
  const formRef = useRef(null);
  useEffect(() => { if (hasPendingCartPayment()) setDrawer(true); }, []);
  const cartLines = useMemo(() => Object.entries(cart).map(([id, quantity]) => ({
    dish: allDishes.find((item) => item.id === id), quantity,
  })).filter((line) => line.dish && line.quantity > 0), [allDishes, cart]);
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const foodTotal = cartLines.reduce((sum, line) => sum + line.dish.prix * line.quantity, 0);
  const cartRestaurant = cartLines[0]?.dish.restaurant;
  // Panier non validé : il se vide tout seul après 90 min sans aucune activité (sauf paiement ou envoi en cours).
  const lastActive = useRef(Date.now());
  const [cartExpired, setCartExpired] = useState(false);
  useEffect(() => {
    const bump = () => { lastActive.current = Date.now(); };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, bump));
  }, []);
  useEffect(() => { lastActive.current = Date.now(); if (cartCount > 0) setCartExpired(false); }, [cart]);
  useEffect(() => {
    if (!cartCount || order || sending) return undefined;
    const check = () => {
      if (Date.now() - lastActive.current < 90 * 60 * 1000 || hasPendingCartPayment()) return;
      setCart({}); setDrawer(false); setCartExpired(true);
    };
    const timer = setInterval(check, 60 * 1000);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [cartCount, order, sending]);
  const deliveryFee = Number(catalog?.fraisLivraison ?? 1000);
  const total = foodTotal + deliveryFee;
  // Abonné : le repas du jour est inclus (un seul plat, ou le même plat en plusieurs exemplaires : le premier est inclus). Tout le reste est payant.
  const mealUsed = Boolean(subView?.mealUsedToday);
  const includedLine = covered && !mealUsed && cartLines.length === 1 && cartCount === 1 ? cartLines[0] : null;
  const includedAmount = includedLine ? includedLine.dish.prix : 0;
  const blockedMessage = covered && !mealUsed && cartCount > 1 ? "Commande d’abord ton repas inclus dans l’abonnement : un seul plat. Tu pourras ensuite passer une commande normale, payante, avec sa livraison." : "";
  const extrasDishes = foodTotal - includedAmount;
  const deliveryDue = includedLine ? 0 : deliveryFee;                    // livraison incluse avec le repas de l'abonnement
  const amountDue = includedLine && extrasDishes <= 0 ? 0 : extrasDishes + deliveryDue;
  const payRequired = Boolean(catalog?.paiementAuto) && amountDue > 0;      // paiement en ligne obligatoire dès qu'il y a quelque chose à payer
  const subExtrasOnly = covered && mealUsed;                              // repas du jour déjà commandé : tout est payant

  const setQuantity = (id, next) => setCart((current) => {
    const updated = { ...current };
    if (next <= 0) delete updated[id]; else updated[id] = Math.min(20, next);
    return updated;
  });

  const addToCart = (dish, openDrawer = true) => {
    const existingRestaurant = cartLines[0]?.dish.restaurant.id;
    if (existingRestaurant && existingRestaurant !== dish.restaurant.id) {
      setProblem("Tu peux commander auprès d’un seul restaurant à la fois. Termine ou vide d’abord ton panier.");
      window.setTimeout(() => setProblem(""), 4000);
      return false;
    }
    setQuantity(dish.id, (cart[dish.id] || 0) + 1);
    if (openDrawer) setDrawer(true);
    return true;
  };

  // Restaurant du panier très sollicité : on propose les autres restaurants disponibles (mieux notés / moins chargés d'abord).
  const alternatives = useMemo(() => (cartRestaurant?.busy ? alternativesFor(restaurants, cartRestaurant.id) : []), [restaurants, cartRestaurant]);
  const switchTo = (restaurant) => {
    setCart({}); setDrawer(false); setQuery(""); setRestaurantFilter(restaurant.nom);
    window.setTimeout(() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const submitRating = async () => {
    if (!tracker || !ratingPick) return;
    setRatingSending(true); setRatingError("");
    try {
      await api("/api/public/order-rating", { method: "POST", body: JSON.stringify({ orderId: tracker.id, token: tracker.token, stars: ratingPick }) });
      setTracker((current) => current?.id === tracker.id ? { ...current, rated: ratingPick } : current);
    } catch (error) {
      if (/déjà noté/i.test(error.message)) setTracker((current) => current?.id === tracker.id ? { ...current, rated: ratingPick } : current);
      else setRatingError(error.message);
    } finally { setRatingSending(false); }
  };

  // Envoi d'une commande au serveur (formulaire du panier ET assistant : exactement la même route et les mêmes contrôles).
  const placeOrderFor = async ({ restaurant, lines, customer, coveredOrder, preferences, openDrawer = true }) => {
    let proof = await (proofRef.current || fetchProof());
    proofRef.current = null;                                  // une épreuve ne sert qu'une fois
    if (!proof) throw new Error("Vérification anti-robot impossible. Recharge la page et réessaie.");
    const body = (p) => JSON.stringify({
      restaurantId: restaurant.id, customer, items: lines.map(({ dish, quantity }) => ({ menuId: dish.id, quantity })), proof: p, ...(position ? { position } : {}),
      ...(coveredOrder ? { subscriber: { telephone: saved.telephone, code: saved.code }, ...(preferences ? { preferences } : {}) } : {}),
    });
    let result;
    try { result = await api("/api/public/orders", { method: "POST", body: body(proof) }); }
    catch (error) {
      if (!/un instant/i.test(error.message)) throw error;   // épreuve trop récente : on patiente quelques secondes puis on réessaie une fois
      await new Promise((resolve) => window.setTimeout(resolve, 4000));
      proof = await fetchProof();
      await new Promise((resolve) => window.setTimeout(resolve, 3500));
      result = await api("/api/public/orders", { method: "POST", body: body(proof) });
    }
    const recap = { lignes: lines.map(({ dish, quantity }) => ({ nom: dish.nomPlat, quantite: quantity, prix: dish.prix })), livraison: deliveryFee, covered: Boolean(result.order.covered), heure: String(customer.heure || ""), inclus: result.order.covered ? [catalog?.formules?.[saved?.view?.formule || subView?.formule]?.boissonsLabel, "Livraison incluse"].filter(Boolean) : [] };
    const savedTracker = { ...result.order, id: result.order.id, token: result.trackingToken, recap };
    setTracker(savedTracker); setOrderPos(undefined); setPosition(null); refreshSubView();
    if (openDrawer) { setOrder(savedTracker); setDrawer(true); }
    try { localStorage.setItem("ravito-customer", JSON.stringify({ nom: customer.nom, telephone: customer.telephone, adresse: customer.adresse })); } catch { /* stockage indisponible */ }
    return savedTracker;
  };

  const refreshSubView = () => { if (saved) fetchSubscription(saved.telephone, saved.code).then((view) => setSubView(view)).catch(() => {}); };   // met à jour « repas du jour déjà commandé »
  const paymentRequest = () => ({ restaurantId: cartRestaurant.id, customer: form, items: cartLines.map(({ dish, quantity }) => ({ menuId: dish.id, quantity })), ...(covered ? { subscriber: { telephone: saved.telephone, code: saved.code } } : {}), ...(position ? { position } : {}) });
  const paymentSnapshot = () => ({ lignes: cartLines.map(({ dish, quantity }) => ({ nom: dish.nomPlat, quantite: quantity, prix: dish.prix })), livraison: deliveryDue, includedAmount, hasPosition: Boolean(position), heure: String(form.heure || ""), customer: { nom: form.nom, telephone: form.telephone, adresse: form.adresse } });
  // Paiement accepté : le serveur vient de créer la commande, déjà payée. On affiche le bon de commande et on prévient le client.
  const finishPaidOrder = (status, payment) => {
    const snap = payment.snapshot || {};
    const recap = { lignes: snap.lignes || [], livraison: snap.livraison ?? deliveryFee, covered: false, includedAmount: snap.includedAmount || 0, heure: snap.heure || "", inclus: [] };
    const savedTracker = { ...status.order, nom: snap.customer?.nom || "", covered: false, paidOnline: true, hasPosition: Boolean(snap.hasPosition), token: payment.trackingToken, recap };
    setTracker(savedTracker); setOrder(savedTracker); setDrawer(true); setCart({}); setProblem(""); setOrderPos(undefined); setPosition(null); refreshSubView();
    try { localStorage.setItem("ravito-customer", JSON.stringify(snap.customer || {})); } catch { /* stockage indisponible */ }
    notifyHere("Paiement accepté ✅", `Ta commande ${status.order.reference} chez ${status.order.restaurant} est acceptée.`);
  };
  const paymentRefused = (message) => { notifyHere("Paiement refusé", message); };
  // Depuis l'assistant : le panier est rempli et le client paie dans le panier.
  const checkoutFromAssistant = ({ lines, customer }) => {
    setCart(Object.fromEntries(lines.map(({ dish, quantity }) => [dish.id, quantity])));
    setForm((f) => ({ ...f, ...customer }));
    setDrawer(true);
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (payRequired) return;                 // le paiement valide la commande (voir CartPayment) : pas d'envoi sans paiement
    if (!cartRestaurant || !cartLines.length) return;
    if (blockedMessage) { setProblem(blockedMessage); return; }
    setSending(true);
    try {
      await placeOrderFor({ restaurant: cartRestaurant, lines: cartLines, customer: form, coveredOrder: covered });
      setCart({});
    } catch (error) { setProblem(error.message); proofRef.current = null; }
    finally { setSending(false); }
  };

  const refreshOrderStatus = async () => {
    if (!tracker) return;
    setCheckingStatus(true);
    try {
      const result = await api("/api/public/order-status", { method: "POST", body: JSON.stringify({ orderId: tracker.id, token: tracker.token }) });
      setTracker((current) => current?.id === tracker.id ? { ...current, ...result.order } : current);
    } catch (error) { setProblem(error.message); }
    finally { setCheckingStatus(false); }
  };

  // En-tête qui se resserre au défilement, avec une fine barre de progression (décoratif, sans effet sur la commande).
  useEffect(() => {
    const header = document.querySelector(".public-header");
    if (!header) return undefined;
    let waiting = false;
    const update = () => {
      waiting = false;
      const y = window.scrollY || 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header.classList.toggle("is-scrolled", y > 24);
      header.style.setProperty("--rv-progress", max > 0 ? Math.min(1, y / max).toFixed(4) : "0");
    };
    const onScroll = () => { if (!waiting) { waiting = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  // Reflet lumineux qui suit le curseur sur les cartes de plats (ordinateur seulement).
  const spotlight = (event) => {
    const card = event.target.closest?.(".dish-card");
    if (!card || event.pointerType === "touch") return;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - box.left}px`);
    card.style.setProperty("--my", `${event.clientY - box.top}px`);
  };

  return (
    <div className="ravito-public">
      {staffEntry && <div className="staff-entry-bar"><span>Équipe RAVITO : restaurants, livreurs, administration</span><button onClick={staffEntry}>Se connecter</button></div>}
      <header className="public-header">
        <a className="public-brand" href={BASE} aria-label="RAVITO accueil">
          <img className="brand-logo" src={asset("/icons/ravito-public-192.png")} alt="" width="40" height="40" decoding="async" /><span>RAVIT<span className="brand-o">O</span><span className="brand-dot">.</span></span>
        </a>
        <div className="header-location"><MapPin size={16} /><span>Port-Gentil, Gabon</span></div>
        <div className="cart-header-actions">
          <button data-tour="sub" className={`sub-trigger ${subView?.status === "active" ? "on" : ""}`} onClick={() => setSubOpen(true)} aria-label="Mon abonnement"><QrCode size={17} /><span>{saved ? "Mon abonnement" : "Abonné ?"}</span></button>
          <button data-tour="cart" className="cart-trigger" onClick={() => setDrawer(true)} aria-label={`Ouvrir le panier, ${cartCount} article(s)`}>
            <ShoppingBag size={18} /><span>Mon panier</span>{cartCount > 0 && <b>{cartCount}</b>}
          </button>
        </div>
      </header>

      <main>
        {cartExpired && !cartCount && <section className="prefill-banner" role="status"><b>Ton panier a été vidé.</b><span>Il était resté 1 h 30 sans validation. Choisis un plat pour commencer une nouvelle commande.</span></section>}
        {prefilled && !order && <section className="prefill-banner" role="status"><b>Tes informations sont déjà enregistrées.</b><span>Choisis ton plat ci-dessous, ajoute-le au panier : ton bon de commande est prêt à envoyer.</span></section>}
        {tracker && !order && <section className="tracking-banner"><span>Commande {tracker.reference} · {tracker.status}</span><button onClick={() => { setOrder(tracker); setDrawer(true); }}>Suivre ma commande <ArrowRight size={15} /></button></section>}
        <section className="public-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> BONJOUR PORT-GENTIL</div>
            <h1>Le bon repas,<br /><span>au bon endroit.</span></h1>
            <p>Découvre les plats de nos restaurants partenaires et fais-toi livrer simplement.</p>
            <a className="hero-cta" href="#menu">Découvrir les plats <ArrowRight size={17} /></a>
            <div className="hero-note"><Clock3 size={15} /> Commande confirmée par le restaurant partenaire</div>
            <div className="hero-tastes" aria-hidden="true">{HERO_TASTES.map((src) => <img key={src} src={src} alt="" width="38" height="38" loading="lazy" decoding="async" />)}<span>Des plats frais, chaque jour</span></div>
          </div>
          <HeroSlides />
        </section>

        <section className="benefit-row" aria-label="Les avantages Ravito">
          <div><span>01</span><strong>Les bons restaurants</strong><small>Des partenaires près de toi</small></div>
          <div><span>02</span><strong>Commande facile</strong><small>Quelques clics suffisent</small></div>
          <div><span>03</span><strong>Livraison à domicile</strong><small>On s’occupe du trajet</small></div>
        </section>

        <section className="menu-section" id="menu">
          <div className="section-heading">
            <div><div className="eyebrow dark-eyebrow">LA SÉLECTION DU JOUR</div><h2>Qu’est-ce qui te ferait plaisir&nbsp;?</h2></div>
            <label className="search-box" data-tour="search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Un plat, un restaurant…" aria-label="Rechercher un plat ou restaurant" /></label>
          </div>
          <div className="filter-row" data-tour="filters" role="group" aria-label="Filtrer par restaurant">
            {filters.map((name) => <button key={name} className={`filter-chip ${restaurantFilter === name ? "active" : ""}`} onClick={() => setRestaurantFilter(name)}>{name}</button>)}
          </div>

          {covered && <p className="tier-note">✨ Tu vois le menu de ta formule <b>{tierName}</b>. Ton abonnement couvre un repas par commande.</p>}
          {waking && !catalog && !problem && <WakingSplash />}
          {!catalog && !problem && <div className="dish-grid dish-skeletons" role="status" aria-live="polite"><span className="sr-only">On prépare la carte du jour…</span>{[0, 1, 2].map((i) => <div className="dish-card skeleton" key={i} aria-hidden="true"><div className="dish-image" /><div className="dish-info"><i /><i /><i /></div></div>)}</div>}
          {problem && <div className="inline-message" role="status">{problem}<button onClick={() => setProblem("")} aria-label="Fermer"><X size={16} /></button></div>}
          {catalog && visibleDishes.length > 0 && <div className="dish-grid" onPointerMove={spotlight}>{visibleDishes.map((dish, dishIndex) => {
            const qty = cart[dish.id] || 0;
            return <article className="dish-card" key={dish.id}>
              <div className="dish-image">
                {dish.image ? <img src={dish.image} alt={dish.nomPlat} loading="lazy" /> : <div className="dish-placeholder"><Utensils size={30} /><span>RAVITO</span></div>}
                <span className="dish-restaurant"><span className="dish-restaurant-name">{dish.restaurant.nom}</span>{ratingLabel(dish.restaurant) ? <span className="dish-restaurant-rating">{ratingLabel(dish.restaurant)}</span> : null}</span>
                {dish.restaurant.busy && <span className="dish-busy">Très sollicité</span>}
                <div className="dish-overlay"><h3>{dish.nomPlat}</h3></div>
              </div>
              <div className="dish-info"><div><p>{dish.description || "Préparé avec soin par notre partenaire."}</p></div>
                <div className="dish-buy" data-tour={dishIndex === 0 ? "dish-add" : undefined}><strong>{Math.round(Number(dish.prix) || 0).toLocaleString("fr-FR")}<small> FCFA</small></strong>{qty ? <div className="quantity-control"><button onClick={() => setQuantity(dish.id, qty - 1)} aria-label="Retirer un plat"><Minus size={14} /></button><b>{qty}</b><button onClick={() => setQuantity(dish.id, qty + 1)} aria-label="Ajouter un plat"><Plus size={14} /></button></div> : <button className="add-button" onClick={() => addToCart(dish)} aria-label={`Ajouter ${dish.nomPlat} au panier`}><Plus size={18} /></button>}</div>
              </div>
            </article>;
          })}</div>}
          {catalog && visibleDishes.length === 0 && <div className="empty-menu">
            <div className="empty-plate">🍽️</div><h3>{query ? "Aucun plat trouvé" : "La carte du jour arrive bientôt"}</h3>
            <p>{query ? "Essaie un autre mot ou choisis un autre restaurant." : "Nos restaurants partenaires préparent leurs menus. Reviens bientôt découvrir la sélection."}</p>
            {query && <button className="text-button" onClick={() => setQuery("")}>Effacer la recherche <ChevronRight size={15} /></button>}
          </div>}
        </section>

        <section className="gallery-section menu-section" aria-label="Idées de plats">
          <div className="section-heading"><div><div className="eyebrow dark-eyebrow">POUR SE METTRE L’EAU À LA BOUCHE</div><h2>Des idées de plats à découvrir</h2><p className="gallery-note">{ILLUSTRATION_NOTE}</p></div></div>
          {MENU_LIBRARY.map((group) => <div className="gallery-group" key={group.id}>
            <h3>{group.titre}</h3>
            <Carousel label={group.titre} items={group.items} renderItem={(item) => <figure className="gallery-card"><img src={item.src} alt={item.nom} loading="lazy" decoding="async" /><figcaption><strong>{item.nom}</strong><span>{item.description}</span></figcaption></figure>} />
          </div>)}
        </section>

      </main>

      <Tour storageKey="ravito-tour-client" ready={!!catalog} steps={clientTour(() => setDrawer(false))} />
      <Assistant catalog={catalog} restaurants={restaurants} tracker={tracker} deliveryFee={deliveryFee}
        subscriber={covered && !mealUsed ? { telephone: saved.telephone, code: saved.code, nom: subView.nom, formule: subView.formule, formuleNom: tierName } : null}
        prepareProof={() => { if (!proofRef.current) proofRef.current = fetchProof().catch(() => null); }} onPlaceOrder={placeOrderFor} payRequired={Boolean(catalog?.paiementAuto) && (!covered || mealUsed)} onCheckout={checkoutFromAssistant}
        onAddDish={(dish) => addToCart(dish, false)} onOpenCart={() => { setOrder(null); setDrawer(true); }} onOpenTracking={() => { if (tracker) { setOrder(tracker); setDrawer(true); } }} />
      {staffEntry && <div className="staff-entry-foot"><button onClick={staffEntry}>Accès équipe · Se connecter</button></div>}
      <footer className="public-footer">
        <div className="footer-brand">
          <a className="public-brand" href={BASE} aria-label="RAVITO accueil"><img className="brand-logo" src={asset("/icons/ravito-public-192.png")} alt="" width="40" height="40" loading="lazy" decoding="async" /><span>RAVIT<span className="brand-o">O</span><span className="brand-dot">.</span></span></a>
          <p>Le goût du coin, livré chez toi.</p>
        </div>
        <div className="footer-pay" role="group" aria-label="Moyens de paiement">
          <small>Paiement Mobile Money</small>
          <span className="pay-tile"><img src={asset("/payment/airtel-money.png")} alt="Airtel Money" height="26" loading="lazy" decoding="async" /></span>
          <span className="pay-tile pay-moov"><img src={asset("/payment/moov-money.png")} alt="Moov Money" height="26" loading="lazy" decoding="async" /></span>
        </div>
        <div className="footer-links">
          <a href="https://yoanhoappel-creator.github.io/ravito-site/" target="_blank" rel="noreferrer">En savoir plus sur RAVITO <ArrowRight size={14} /></a>
          {showTeamButton() && <a className="team-access" href="/equipe/">Accès équipe <ArrowRight size={14} /></a>}
        </div>
        <small className="footer-legal">© {new Date().getFullYear()} RAVITO · Port-Gentil, Gabon</small>
      </footer>

      {subOpen && <SubscriberPanel saved={saved} view={subView} offline={subOffline} plans={catalog?.formules} payEnabled={Boolean(catalog?.paiementAuto)} onClose={() => setSubOpen(false)}
        onLogin={(creds, view) => { setSaved(creds); setSubView(view); setSubOffline(false); setForm((f) => ({ ...f, nom: f.nom || view.nom || "", telephone: creds.telephone })); }}
        onLogout={() => { setSaved(null); setSubView(null); setSubOpen(false); }}
        onOrder={() => { setUseSub(true); setSubOpen(false); window.setTimeout(() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }), 60); }} />}
      {cartCount > 0 && <button className="mobile-cart-bar" onClick={() => setDrawer(true)}><span><ShoppingBag size={18} /> Voir mon panier ({cartCount})</span><b>{formatXaf(foodTotal)}</b></button>}
      {drawer && <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawer(false); }}>
        <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-label="Mon panier">
          <div className="drawer-head"><div><span className="eyebrow dark-eyebrow">TA COMMANDE</span><h2 id="cart-title">{order ? "Commande reçue" : "Mon panier"}</h2></div><button className="icon-button" onClick={() => setDrawer(false)} aria-label="Fermer"><X /></button></div>
          {order ? <div className="order-success"><div className="success-mark"><Check size={29} /></div><h3>{order.nom ? `Merci ${order.nom} !` : "Suivi de commande"}</h3><p>Commande chez <b>{order.restaurant}</b></p><div className="order-reference"><span>NUMÉRO DE COMMANDE</span><strong>{order.reference}</strong></div>{order.recap?.lignes?.length > 0 && <div className="order-recap"><span>BON DE COMMANDE</span>{order.recap.lignes.map((line, index) => <div key={index}><span>{line.quantite} × {line.nom}</span><b>{formatXaf(line.prix * line.quantite)}</b></div>)}{order.covered ? <>{(order.recap.inclus || []).map((label) => <div key={label}><span>{label}</span><b>Inclus</b></div>)}<div className="recap-total"><span>Couvert par ton abonnement</span><b>0 FCFA</b></div></> : <>{order.recap.includedAmount > 0 && <div><span>Repas inclus (abonnement)</span><b>− {formatXaf(order.recap.includedAmount)}</b></div>}<div><span>Livraison</span><b>{order.recap.livraison > 0 ? formatXaf(order.recap.livraison) : "Incluse"}</b></div><div className="recap-total"><span>{order.paidOnline ? "Total payé" : "Total estimé"}</span><b>{formatXaf(order.total)}</b></div></>}</div>}<OrderSteps status={tracker?.status || order.status || "À confirmer"} />{!["Livrée", "Annulée", "Incident"].includes(tracker?.status || order.status) && <ShareLocation title="Partage ta position pour ta livraison" value={orderPos === undefined ? (order.hasPosition ? { lat: 0, lng: 0, accuracy: null } : null) : orderPos} onChange={async (p) => { await sendOrderPosition(order.id, tracker?.token || order.token, p); setOrderPos(p); }} />}{order.recap?.heure && <p className="order-time">Heure souhaitée : <b>{order.recap.heure}</b></p>}<p className="order-status"><span>État de la commande</span><b>{tracker?.status || order.status || "À confirmer"}</b></p><button className="text-button status-refresh" onClick={refreshOrderStatus} disabled={checkingStatus}>{checkingStatus ? "Vérification…" : "Actualiser le statut"} <ArrowRight size={15} /></button>{(tracker?.status || order.status) === "Livrée" && <div className="rate-box">{tracker?.rated ? <p>Merci pour ta note : <b className="stars-done">{"★".repeat(tracker.rated)}{"☆".repeat(5 - tracker.rated)}</b></p> : <><span>Comment était ta commande ?</span><div className="stars" role="group" aria-label="Ta note de 1 à 5 étoiles">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={n <= ratingPick ? "on" : ""} onClick={() => setRatingPick(n)} aria-label={`${n} étoile${n > 1 ? "s" : ""}`} aria-pressed={n === ratingPick}>★</button>)}</div>{ratingError && <div className="form-error" role="alert">{ratingError}</div>}<button className="text-button" disabled={!ratingPick || ratingSending} onClick={submitRating}>{ratingSending ? "Envoi…" : "Envoyer ma note"} <ArrowRight size={15} /></button></>}</div>}{order.paidOnline && <div className="order-paid" role="status"><Check size={17} /><span><b>Paiement accepté</b> · {formatXaf(order.total)}. Ta commande est acceptée et transmise au restaurant.</span></div>}
<p className="payment-note">{order.covered ? <>Repas couvert par ton abonnement.<br />Garde ton QR prêt pour le livreur.</> : order.paidOnline ? <>Merci, ton paiement est enregistré.<br />Garde cette page pour suivre ta commande.</> : <>Total estimé : <b>{formatXaf(order.total)}</b><br />Paiement par Airtel Money ou Moov Money uniquement : envoie la capture d’écran du dépôt sur WhatsApp pour valider ta commande.</>}</p><button className="checkout-button" onClick={() => { setOrder(null); setDrawer(false); }}>Continuer ma visite <ArrowRight size={16} /></button></div> : <>
            {cartLines.length === 0 && hasPendingCartPayment() ? <CartPayment formRef={formRef} buildRequest={paymentRequest} snapshot={paymentSnapshot} total={0} defaultPhone="" onPaid={finishPaidOrder} onRefused={paymentRefused} /> : cartLines.length === 0 ? <div className="drawer-empty"><ShoppingBag size={28} /><p>Ton panier est vide pour l’instant.</p><button className="text-button" onClick={() => setDrawer(false)}>Découvrir la carte <ArrowRight size={15} /></button></div> : <>
              {cartRestaurant && <div className="cart-from"><MapPin size={15} /> Commande chez <b>{cartRestaurant.nom}</b></div>}
              {cartRestaurant?.busy && <div className="busy-notice" role="status"><b>{busyWarning(cartRestaurant)}</b>
                {alternatives.length > 0 && <><span>Autres restaurants disponibles :</span><div>{alternatives.map((item) => <button key={item.id} onClick={() => switchTo(item)}>{item.nom}{ratingLabel(item) ? ` · ${ratingLabel(item)}` : ""}</button>)}</div></>}
                <small>Tu peux aussi commander ici : le restaurant confirmera ta commande.</small></div>}
              <div className="cart-lines" data-tour="cart-lines">{cartLines.map(({ dish, quantity }) => <div className="cart-line" key={dish.id}><div><strong>{dish.nomPlat}</strong><span>{formatXaf(dish.prix)} / plat</span></div><div className="quantity-control"><button onClick={() => setQuantity(dish.id, quantity - 1)} aria-label="Retirer un plat"><Minus size={14} /></button><b>{quantity}</b><button onClick={() => setQuantity(dish.id, quantity + 1)} aria-label="Ajouter un plat"><Plus size={14} /></button></div><strong>{formatXaf(dish.prix * quantity)}</strong></div>)}</div>
              {covered && <div className="busy-notice" role="status">{subExtrasOnly ? <><b>Ton repas inclus d’aujourd’hui est déjà commandé</b><small>Les plats que tu ajoutes maintenant sont payants, livraison comprise.</small></> : <><b>Ton premier plat est inclus dans ton abonnement {subView.formuleNom}</b><small>Un seul plat, livraison comprise, rien à payer. Après l’avoir commandé, tu pourras passer une commande normale (payante, avec sa livraison).</small></>}{blockedMessage && <small role="alert"><b>{blockedMessage}</b></small>}</div>}
              <div className="cart-totals"><div><span>Plats</span><b>{formatXaf(foodTotal)}</b></div>{includedAmount > 0 && <div><span>Repas inclus dans ton abonnement</span><b>− {formatXaf(includedAmount)}</b></div>}<div><span>Livraison estimée</span><b>{includedLine ? "Incluse" : formatXaf(deliveryFee)}</b></div><div className="grand-total"><span>{amountDue > 0 ? "À payer" : "À payer maintenant"}</span><b>{formatXaf(amountDue)}</b></div></div>
              <form className="checkout-form" data-tour="checkout-form" ref={formRef} onSubmit={submitOrder}><h3>Où livrer ta commande&nbsp;?</h3>
                {saved && subView?.status === "active" && <label className="sub-use"><input type="checkbox" checked={useSub} onChange={(e) => setUseSub(e.target.checked)} /><span>Utiliser mon abonnement ({subView.formuleNom}) — 1 repas couvert</span></label>}
                <label>Ton nom<input required autoComplete="name" maxLength={80} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom et prénom" /></label>
                <label>Ton téléphone<input required type="tel" autoComplete="tel" maxLength={24} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="07 00 00 00" /></label>
                <label>Adresse de livraison<input required autoComplete="street-address" maxLength={180} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} placeholder="Quartier, rue, repère…" /></label>
                <ShareLocation value={position} onChange={setPosition} title="Partage ta position (livraison plus précise)" />
                <label>Heure de livraison souhaitée <span className="optional">(facultatif)</span><input type="time" value={form.heure} onChange={(e) => setForm({ ...form, heure: e.target.value })} /></label>
                <p className="time-note">⏱️ Pour être livré à l’heure choisie, <b>commande au moins 1 heure à l’avance</b> : le restaurant a besoin de ce temps pour préparer ta commande. Laisse vide pour être livré dès que possible.</p>
                <label>Un détail pour le restaurant <span className="optional">(facultatif)</span><textarea maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Précision sur le plat ou la livraison" rows={2} /></label>
                <p className="privacy-note">Tes coordonnées sont utilisées uniquement pour préparer et livrer cette commande.</p>
                {problem && <div className="form-error" role="alert">{problem}</div>}
                {payRequired
                  ? <CartPayment formRef={formRef} buildRequest={paymentRequest} snapshot={paymentSnapshot} total={total} defaultPhone={form.telephone} onPaid={finishPaidOrder} onRefused={paymentRefused} />
                  : <><button className="checkout-button" data-tour="send-order" disabled={sending}>{sending ? "Envoi en cours…" : "Envoyer ma demande"}<ArrowRight size={17} /></button>
                    <p className="confirm-note">Ta commande ne sera définitive qu’après confirmation du restaurant.</p></>}
              </form>
            </>}
          </>}
        </aside>
      </div>}
    </div>
  );
}
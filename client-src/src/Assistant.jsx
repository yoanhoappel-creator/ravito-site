import { useEffect, useMemo, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { restartTour } from "./Tour.jsx";
import { detectIntent, alternativesFor, ratingLabel, replyText, busyWarning, PAYMENT_RULE } from "./assistant-logic.js";
import { SPECIAL_REQUESTS, WATER_CHOICES, DRINK_CHOICES, dishesForFormula, drinkPlan, isOrderRequest, validName, validPhone, validAddress, composeNote, toggleRequest } from "./order-flow.js";
import { fetchHabits } from "./subscriber.js";

import { apiUrl } from "./base.js";
const AI_URL = apiUrl("/api/ravito-ai");
const LOCAL_INTENTS = ["menus", "track", "guide", "suggest", "payment"];   // ces demandes ont des boutons d'action : on les garde en local
const formatXaf = (value) => `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} FCFA`;
const firstName = (nom) => String(nom || "").trim().split(/\s+/)[0];
const savedCustomer = () => { try { const v = JSON.parse(localStorage.getItem("ravito-customer") || "null"); return v && typeof v === "object" ? v : null; } catch { return null; } };

// Assistant V2 : questions libres (vraie IA gratuite via le serveur RAVITO, avec repli pré-écrit) + commande guidée.
// La commande guidée suit EXACTEMENT les règles du formulaire du site : restaurant → plats → demandes spéciales
// → (boissons de la formule) → nom → téléphone → adresse → récapitulatif → envoi au restaurant choisi.
export default function Assistant({ catalog, restaurants, tracker, deliveryFee, subscriber, prepareProof, onPlaceOrder, payRequired, onCheckout, onAddDish, onOpenCart, onOpenTracking }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [flow, setFlowState] = useState(null);
  const flowRef = useRef(null);
  const habitsRef = useRef(null);
  const idRef = useRef(0);
  const endRef = useRef(null);
  const contact = catalog?.contact || null;
  const formules = catalog?.formules || {};
  const available = restaurants.filter((restaurant) => (restaurant.menu || []).length > 0);
  const setFlow = (value) => { const next = typeof value === "function" ? value(flowRef.current) : value; flowRef.current = next; setFlowState(next); return next; };

  const push = (message) => setMessages((list) => [...list, { id: ++idRef.current, ...message }]);
  const mainOptions = () => [
    { type: "flow", label: "Commander avec l'assistant" },
    { type: "menus", label: "Voir les menus du jour" },
    { type: "intent", intent: "suggest", label: "Je ne sais pas quoi commander" },
    { type: "intent", intent: "delivery", label: "Livraison et prix" },
    { type: "intent", intent: "payment", label: "Comment payer" },
    { type: "intent", intent: "how", label: "Comment commander" },
    { type: "intent", intent: "track", label: "Suivre ma commande" },
    { type: "tour", label: "Revoir le guide" },
    ...(contact ? [{ type: "intent", intent: "team", label: "Parler à l'équipe" }] : []),
  ];
  const restaurantOption = (restaurant, type = "restaurant") => ({ type, id: restaurant.id, label: [restaurant.nom, ratingLabel(restaurant), restaurant.busy ? "Très sollicité" : null].filter(Boolean).join(" · ") });
  const tierMenu = (restaurant) => (subscriber ? dishesForFormula(restaurant.menu, subscriber.formule) : restaurant.menu || []);
  const orderableRestaurants = () => available.filter((restaurant) => tierMenu(restaurant).length > 0);
  const cancelOption = { type: "fl-cancel", label: "Annuler la commande" };

  // ---------- Ouverture : salutation (personnalisée pour un abonné) ----------
  useEffect(() => {
    if (!open || messages.length > 0) return undefined;
    let cancelled = false;
    (async () => {
      let habits = null;
      if (subscriber) { try { habits = await Promise.race([fetchHabits(subscriber.telephone, subscriber.code), new Promise((resolve) => window.setTimeout(() => resolve(null), 2500))]); } catch { habits = null; } }
      if (cancelled) return;
      habitsRef.current = habits;
      if (!subscriber) { push({ from: "bot", text: "Bonjour et bienvenue ! 👋 Moi c'est l'assistant RAVITO. Je peux prendre ta commande, répondre à tes questions sur le site et l'application, ou te guider. Que puis-je faire pour toi ?", options: mainOptions() }); return; }
      const hello = `Bonjour ${firstName(subscriber.nom) || ""} ! 👋`.replace("  ", " ");
      if (habits?.orderedToday) { push({ from: "bot", text: `${hello} Ton repas d'aujourd'hui est déjà commandé, bon appétit d'avance ! 😋 Je peux aussi te renseigner sur autre chose.`, options: mainOptions().filter((o) => o.type !== "flow") }); return; }
      const previous = new Set((habits?.last || []).map((l) => l.menuNom));
      const fresh = available.flatMap((r) => tierMenu(r).map((d) => ({ ...d, restaurant: r }))).filter((d) => !previous.has(d.nomPlat)).slice(0, 2);
      const tryOptions = fresh.map((d) => ({ type: "try-dish", id: d.id, label: `Essayer : ${d.nomPlat}` }));
      if (habits?.habitual?.available) {
        push({ from: "bot", text: `${hello} Tu manges quoi aujourd'hui ? Comme d'habitude (${habits.habitual.menuNom}${habits.habitual.restaurantNom ? ` chez ${habits.habitual.restaurantNom}` : ""}) ou tu changes ?`, options: [{ type: "preorder", label: `Comme d'habitude : ${habits.habitual.menuNom}` }, { type: "flow", fresh: true, label: "Je change de plat" }, ...tryOptions, ...mainOptions().filter((o) => o.type !== "flow").slice(0, 3)] });
      } else {
        push({ from: "bot", text: `${hello} Tu manges quoi aujourd'hui ? Je peux t'aider à commander ton repas en quelques touches${tryOptions.length ? ", ou tu peux changer un peu avec une idée du jour" : ""} 😊`, options: [{ type: "flow", label: "Commander mon repas" }, ...tryOptions, ...mainOptions().filter((o) => o.type !== "flow").slice(0, 3)] });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [messages, open, typing]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // ---------- Navigation classique (menus, questions) ----------
  const showMenus = () => push({
    from: "bot", text: replyText("menus", { restaurantCount: available.length }),
    options: available.length ? [...available].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).map((r) => restaurantOption(r)) : mainOptions(),
  });
  const showRestaurant = (id, force = false) => {
    const restaurant = restaurants.find((item) => item.id === id);
    if (!restaurant) return;
    if (restaurant.busy && !force) {
      const alternatives = alternativesFor(restaurants, restaurant.id);
      push({ from: "bot", text: `${busyWarning(restaurant)} ${alternatives.length ? "Je te propose d'autres restaurants disponibles, ou tu peux commander ici quand même, comme tu préfères." : "Tu peux commander ici quand même, comme tu préfères."}`, options: [...alternatives.map((r) => restaurantOption(r)), { type: "force", id: restaurant.id, label: `Commander chez ${restaurant.nom} quand même` }] });
      return;
    }
    push({ from: "bot", text: `Voici les plats de ${restaurant.nom} aujourd'hui, bon appétit d'avance ! 😋`, dishes: tierMenu(restaurant).map((dish) => ({ ...dish, restaurant })), options: [{ type: "menus", label: "Voir un autre restaurant" }, { type: "flow", label: "Commander avec l'assistant" }, { type: "cart", label: "Voir mon panier" }] });
  };
  const answer = (intent) => {
    if (intent === "menus") return showMenus();
    if (intent === "suggest") {
      const sug = catalog?.suggestions || {};
      const seen = new Set(), picks = [];
      for (const entry of [...(sug.populaires || []), ...(sug.mieuxNotes || [])]) {
        const restaurant = restaurants.find((r) => r.id === entry.restaurantId);
        const dish = restaurant && tierMenu(restaurant).find((d) => d.id === entry.id);
        if (dish && !seen.has(dish.id)) { seen.add(dish.id); picks.push({ ...dish, restaurant }); }
      }
      return push({ from: "bot", text: replyText("suggest", { suggestions: sug }), dishes: picks, options: [{ type: "flow", label: "Commander avec l'assistant" }, { type: "menus", label: "Voir tous les menus" }] });
    }
    const options = intent === "guide" ? [{ type: "tour", label: "Lancer le guide" }, { type: "main", label: "Autre question" }]
      : intent === "team" && contact ? [{ href: `https://wa.me/${contact}`, label: "Écrire sur WhatsApp" }, { type: "main", label: "Autre question" }]
      : intent === "track" && tracker ? [{ type: "track", label: "Voir le détail de ma commande" }, { type: "main", label: "Autre question" }]
      : mainOptions();
    return push({ from: "bot", text: replyText(intent, { deliveryFee, tracker, contact, restaurantCount: available.length, payment: catalog?.paiement, paiementAuto: Boolean(catalog?.paiementAuto), suggestions: catalog?.suggestions }), options });
  };
  const localReply = (value) => {
    const intent = detectIntent(value);
    if (intent) answer(intent); else push({ from: "bot", text: replyText(null), options: mainOptions() });
  };

  // ---------- Commande guidée ----------
  const cartLines = (f) => Object.entries(f.lines).map(([id, quantity]) => ({ dish: (restaurants.find((r) => r.id === f.restaurantId)?.menu || []).find((d) => d.id === id), quantity })).filter((l) => l.dish);
  const plan = () => (subscriber ? drinkPlan(subscriber.formule, formules) : []);

  const askRestaurant = (f) => {
    const list = orderableRestaurants();
    if (!list.length) { setFlow(null); push({ from: "bot", text: subscriber ? "Aucun plat de ta formule n'est disponible pour le moment, repasse un peu plus tard ! 😊" : "La carte du jour arrive bientôt : nos restaurants préparent leurs menus. Repasse nous voir dans un moment ! 😊", options: mainOptions() }); return; }
    const lastId = habitsRef.current?.lastRestaurantId;
    const sorted = [...list].sort((a, b) => (a.id === lastId ? -1 : b.id === lastId ? 1 : (a.rank ?? 999) - (b.rank ?? 999)));
    setFlow({ ...f, step: "restaurant" });
    push({ from: "bot", text: subscriber ? "On commence ! Dans quel restaurant veux-tu ton repas aujourd'hui ?" : "C'est parti ! 😊 D'abord, dans quel restaurant veux-tu commander ?", options: [...sorted.map((r) => restaurantOption(r, "fl-restaurant")).map((o, i) => (sorted[i].id === lastId && subscriber ? { ...o, label: `${o.label} · comme d'habitude` } : o)), cancelOption] });
  };
  const askDishes = (f, intro) => {
    const restaurant = restaurants.find((r) => r.id === f.restaurantId);
    const previous = new Set((habitsRef.current?.last || []).map((l) => l.menuNom));
    const dishes = [...tierMenu(restaurant)].sort((a, b) => Number(previous.has(a.nomPlat)) - Number(previous.has(b.nomPlat)));   // les nouveautés d'abord
    setFlow({ ...f, step: "dishes" });
    push({
      from: "bot",
      text: intro || (subscriber ? `Voici le menu de ta formule ${subscriber.formuleNom || ""} chez ${restaurant.nom}. Ton abonnement couvre un repas par commande. Pour changer un peu, regarde d'abord les plats que tu n'as pas encore goûtés 😉` : `Voici les plats de ${restaurant.nom}. Choisis ceux que tu veux : tu peux en ajouter plusieurs.`),
      dishes: dishes.map((dish) => ({ ...dish, restaurant, flowDish: true, seen: previous.has(dish.nomPlat) })), options: [cancelOption],
    });
  };
  const askRequests = (f) => {
    setFlow({ ...f, step: "requests" });
    const habit = f.habitNote;
    push({ from: "bot", kind: "requests", text: "Une demande spécifique pour le restaurant ? Par exemple sans piment, avec ou sans oignon, sans mayonnaise, sans aromate… Touche ce qui convient (tu peux en choisir plusieurs) ou écris ta demande, puis continue.", habitNote: habit });
  };
  const askDrink = (f, queue) => {
    const [field] = queue;
    const label = formules[subscriber.formule]?.boissonsLabel || "";
    const prefs = habitsRef.current?.prefs;
    setFlow({ ...f, step: "drink", drinkQueue: queue });
    const choices = field === "boisson" ? DRINK_CHOICES : WATER_CHOICES;
    const ask = field === "boisson" ? `Ta formule ${subscriber.formuleNom || ""} comprend une boisson${label ? ` (${label.toLowerCase()})` : ""}. Laquelle préfères-tu ? Touche un choix ou écris le tien.` : `Et pour l'eau, quelle bouteille préfères-tu ? Touche un choix ou écris le tien.`;
    const remembered = prefs?.[field];
    push({ from: "bot", text: ask, options: [...(remembered ? [{ type: "fl-drink", field, value: remembered, label: `Comme d'habitude : ${remembered}` }] : []), ...choices.map((value) => ({ type: "fl-drink", field, value, label: value })), cancelOption] });
  };
  const askName = (f) => {
    prepareProof?.();                                   // l'épreuve anti-robot se prépare pendant que le client répond
    const saved = savedCustomer();
    const known = { nom: f.customer.nom || subscriber?.nom || saved?.nom || "", telephone: f.customer.telephone || subscriber?.telephone || saved?.telephone || "", adresse: f.customer.adresse || habitsRef.current?.last?.[0]?.adresse || saved?.adresse || "" };
    if (validName(known.nom) && validPhone(known.telephone)) {
      setFlow({ ...f, step: "identity", customer: known });
      push({ from: "bot", text: `Je t'enregistre au nom de ${known.nom} (${known.telephone}), c'est bien ça ?`, options: [{ type: "fl-identity-ok", label: "Oui, c'est moi" }, { type: "fl-identity-no", label: "Non, autre nom" }, cancelOption] });
      return;
    }
    setFlow({ ...f, step: "nom" });
    push({ from: "bot", text: "Presque fini ! 😊 Quel est ton nom ?", options: [cancelOption] });
  };
  const askPhone = (f) => { setFlow({ ...f, step: "telephone" }); push({ from: "bot", text: "Et ton numéro de téléphone, pour que le restaurant et le livreur puissent te joindre ?", options: [cancelOption] }); };
  const askAddress = (f) => {
    const addr = f.customer.adresse;
    setFlow({ ...f, step: "adresse" });
    push({ from: "bot", text: "Où doit-on te livrer ? Écris l'adresse : bureau ou maison, avec le quartier et un repère.", options: [...(validAddress(addr) ? [{ type: "fl-address-ok", label: `Même adresse : ${addr}`.slice(0, 70) }] : []), cancelOption] });
  };
  const noteFor = (f) => (f.noteOverride ?? composeNote({ requests: f.requests, text: f.reqText, drink: f.drink }));
  const recap = (f) => {
    const restaurant = restaurants.find((r) => r.id === f.restaurantId);
    const lines = cartLines(f);
    const foodTotal = lines.reduce((sum, l) => sum + l.dish.prix * l.quantity, 0);
    const note = noteFor(f);
    const detail = [
      `Restaurant : ${restaurant?.nom}`,
      ...lines.map((l) => `${l.quantity} × ${l.dish.nomPlat} (${formatXaf(l.dish.prix)})`),
      note ? `Demandes : ${note.replace(/^Demandes : /, "")}` : "Aucune demande spéciale",
      `Livraison : ${f.customer.adresse}`, `Contact : ${f.customer.nom}, ${f.customer.telephone}`,
      subscriber ? `Paiement : couvert par ton abonnement ${subscriber.formuleNom || ""}` : `Total : ${formatXaf(foodTotal + deliveryFee)} (dont ${formatXaf(deliveryFee)} de livraison). Paiement par Airtel Money ou Moov Money uniquement, avec capture d'écran envoyée sur WhatsApp`,
    ].join("\n");
    setFlow({ ...f, step: "recap" });
    push({ from: "bot", text: `Voilà ton récapitulatif :\n${detail}\nTu valides ?`, pre: true, options: [{ type: "fl-confirm", label: "Valider ma commande" }, { type: "fl-edit-req", label: "Modifier mes demandes" }, { type: "fl-edit-dish", label: "Changer de plat" }, cancelOption] });
  };
  const afterRequests = (f) => { const queue = plan(); if (queue.length) askDrink(f, queue); else askName(f); };

  const startFlow = (opts = {}) => {
    if (flowRef.current && !opts.restart) { push({ from: "bot", text: "On est déjà en train de préparer ta commande 😊 Réponds à ma dernière question, ou annule-la." , options: [cancelOption] }); return; }
    const f = { step: "restaurant", restaurantId: null, lines: {}, requests: [], reqText: "", drink: {}, drinkQueue: [], customer: { nom: "", telephone: "", adresse: "" } };
    askRestaurant(f);
  };
  const startPreorder = () => {
    const habit = habitsRef.current?.habitual; const last = habitsRef.current?.last?.[0];
    if (!habit?.available || !habit.menuId) return startFlow();
    const restaurant = restaurants.find((r) => r.id === habit.restaurantId);
    if (!restaurant) return startFlow();
    const f = { step: "recap", restaurantId: restaurant.id, lines: { [habit.menuId]: 1 }, requests: [], reqText: "", noteOverride: habit.note || "", habitNote: habit.note, drink: habitsRef.current?.prefs ? { boisson: habitsRef.current.prefs.boisson, eau: habitsRef.current.prefs.eau } : {}, drinkQueue: [], customer: { nom: subscriber.nom || "", telephone: subscriber.telephone, adresse: habit.adresse || last?.adresse || "" } };
    prepareProof?.();
    if (!validAddress(f.customer.adresse)) return askAddress({ ...f, step: "adresse" });
    recap(f);
  };
  const tryDish = (id) => {
    for (const r of available) { const dish = (r.menu || []).find((d) => d.id === id); if (dish) { const f = { step: "dishes", restaurantId: r.id, lines: { [id]: 1 }, requests: [], reqText: "", drink: {}, drinkQueue: [], customer: { nom: "", telephone: "", adresse: "" } }; push({ from: "bot", text: `Bon choix ! ${dish.nomPlat} chez ${r.nom} 😋` }); return askRequests(f); } }
  };

  const flowAddDish = (dish) => {
    const f = flowRef.current;
    if (!f || f.step !== "dishes") { push({ from: "bot", text: "Cette étape est déjà passée. Utilise les boutons de ma dernière question, ou annule et recommence 😊", options: [cancelOption] }); return; }
    if (subscriber) { const next = { ...f, lines: { [dish.id]: 1 } }; setFlow(next); push({ from: "bot", text: `Super choix ! 😊 ${dish.nomPlat}.` }); return askRequests(next); }
    const lines = { ...f.lines, [dish.id]: Math.min(20, (f.lines[dish.id] || 0) + 1) };
    const next = { ...f, lines };
    setFlow(next);
    const list = cartLines(next); const total = list.reduce((s, l) => s + l.dish.prix * l.quantity, 0);
    push({ from: "bot", text: `Ajouté ! 😊 Dans ta commande : ${list.map((l) => `${l.quantity} × ${l.dish.nomPlat}`).join(", ")} (${formatXaf(total)} de plats). Tu veux autre chose ?`, options: [{ type: "fl-next", label: "C'est tout, continuer" }, { type: "fl-more", label: "Ajouter un autre plat" }, cancelOption] });
  };

  const confirmOrder = async () => {
    const f = flowRef.current; if (!f || f.step !== "recap") return;
    const restaurant = restaurants.find((r) => r.id === f.restaurantId);
    if (payRequired && !subscriber) {   // paiement obligatoire : l'assistant prépare le panier, le client paie dedans (la commande part après le paiement)
      const note = noteFor(f);
      onCheckout({ restaurant, lines: cartLines(f), customer: { ...f.customer, note } });
      setFlow(null);
      push({ from: "bot", text: `C'est prêt ! 🛒 J'ai rempli ton panier chez ${restaurant.nom}. Pour valider, choisis Airtel Money ou Moov Money tout en bas du panier : ta commande est envoyée au restaurant dès que le paiement est accepté.`, options: [{ type: "cart", label: "Ouvrir mon panier" }] });
      return;
    }
    setFlow({ ...f, step: "sending" }); setTyping(true);
    try {
      const note = noteFor(f);
      const result = await onPlaceOrder({ restaurant, lines: cartLines(f), customer: { ...f.customer, note }, coveredOrder: Boolean(subscriber), preferences: subscriber ? { boisson: f.drink?.boisson, eau: f.drink?.eau, remarques: [...f.requests, f.reqText].filter(Boolean).join(", ") } : undefined, openDrawer: false });
      setFlow(null);
      push({ from: "bot", text: `Ta commande est envoyée ! 🎉 Référence ${result.reference}. ${restaurant.nom} va la confirmer, et tu seras prévenu à chaque étape. ${subscriber ? "J'ai retenu tes préférences pour la prochaine fois." : PAYMENT_RULE}`.trim(), options: [{ type: "track", label: "Suivre ma commande" }, { type: "main", label: "Autre question" }] });
    } catch (error) {
      setFlow({ ...f, step: "recap" });
      push({ from: "bot", text: `Oups, ça n'a pas pu partir : ${error.message}`, options: [{ type: "fl-confirm", label: "Réessayer" }, cancelOption] });
    } finally { setTyping(false); }
  };

  const act = (option) => {
    const f = flowRef.current;
    if (option.type === "req") { setFlow({ ...f, requests: toggleRequest(f.requests, option.value) }); return; }
    push({ from: "user", text: option.label });
    if (option.type === "menus") showMenus();
    else if (option.type === "intent") answer(option.intent);
    else if (option.type === "restaurant") showRestaurant(option.id);
    else if (option.type === "force") showRestaurant(option.id, true);
    else if (option.type === "main") push({ from: "bot", text: "Avec plaisir ! Que veux-tu faire ?", options: mainOptions() });
    else if (option.type === "cart") { setOpen(false); onOpenCart(); }
    else if (option.type === "track") { setOpen(false); onOpenTracking(); }
    else if (option.type === "tour") { setOpen(false); window.setTimeout(restartTour, 250); }
    else if (option.type === "flow") startFlow();
    else if (option.type === "preorder") startPreorder();
    else if (option.type === "try-dish") tryDish(option.id);
    else if (option.type === "fl-cancel") { setFlow(null); push({ from: "bot", text: "C'est annulé, aucun souci ! Je reste là si tu changes d'avis 😊", options: mainOptions() }); }
    else if (option.type === "fl-restaurant" || option.type === "fl-force") {
      const restaurant = restaurants.find((r) => r.id === option.id);
      if (restaurant?.busy && option.type !== "fl-force") {
        const alternatives = alternativesFor(restaurants, restaurant.id).filter((r) => orderableRestaurants().some((o) => o.id === r.id));
        push({ from: "bot", text: `${busyWarning(restaurant)} ${alternatives.length ? "Je te propose d'autres restaurants, ou tu peux commander ici quand même." : "Tu peux commander ici quand même, comme tu préfères."}`, options: [...alternatives.map((r) => restaurantOption(r, "fl-restaurant")), { type: "fl-force", id: restaurant.id, label: `Commander chez ${restaurant.nom} quand même` }, cancelOption] });
      } else askDishes({ ...f, restaurantId: option.id });
    }
    else if (option.type === "fl-more") askDishes(f, "D'accord, voici de nouveau la carte :");
    else if (option.type === "fl-next") askRequests(f);
    else if (option.type === "fl-reqdone") afterRequests({ ...f, noteOverride: undefined });
    else if (option.type === "fl-reqhabit") afterRequests(f);
    else if (option.type === "fl-drink") {
      const drink = { ...f.drink, [option.field]: option.value }; const queue = f.drinkQueue.slice(1);
      const next = { ...f, drink, drinkQueue: queue };
      if (queue.length) askDrink(next, queue); else askName(next);
    }
    else if (option.type === "fl-identity-ok") askAddress(f);
    else if (option.type === "fl-identity-no") { setFlow({ ...f, step: "nom", customer: { nom: "", telephone: "", adresse: f.customer.adresse } }); push({ from: "bot", text: "D'accord ! Quel est ton nom ?", options: [cancelOption] }); }
    else if (option.type === "fl-address-ok") recap(f);
    else if (option.type === "fl-confirm") confirmOrder();
    else if (option.type === "fl-edit-req") askRequests({ ...f, noteOverride: undefined });
    else if (option.type === "fl-edit-dish") askDishes({ ...f, lines: {} });
  };

  const addDish = (dish) => {
    if (dish.flowDish) return flowAddDish(dish);
    if (onAddDish(dish)) push({ from: "bot", text: `Super choix ! 😊 ${dish.nomPlat} est dans ton panier. Tu veux autre chose ?`, options: [{ type: "cart", label: "Voir mon panier et commander" }, { type: "restaurant", id: dish.restaurant.id, label: "Choisir un autre plat" }] });
    else push({ from: "bot", text: "Oh, ton panier contient déjà des plats d'un autre restaurant. Pour ne pas tout mélanger, termine d'abord cette commande ou vide ton panier, puis on recommence ensemble !", options: [{ type: "cart", label: "Voir mon panier" }] });
  };

  // Réponse écrite pendant la commande guidée
  const flowText = (value) => {
    const f = flowRef.current;
    if (/^(annuler|stop|laisse tomber)$/i.test(value)) return act(cancelOption);
    if (f.step === "requests") { const next = { ...f, reqText: [f.reqText, value].filter(Boolean).join(", ").slice(0, 150) }; setFlow(next); push({ from: "bot", text: `C'est noté : « ${value} ». Autre chose, ou on continue ?`, kind: "requests", habitNote: null }); return; }
    if (f.step === "drink") { const field = f.drinkQueue[0]; return act({ type: "fl-drink", field, value: value.slice(0, 40), label: value }); }
    if (f.step === "nom") { if (!validName(value)) return push({ from: "bot", text: "Vérifie ton nom : il faut au moins 2 lettres 😊", options: [cancelOption] }); return askPhone({ ...f, customer: { ...f.customer, nom: value.slice(0, 80) } }); }
    if (f.step === "telephone") { if (!validPhone(value)) return push({ from: "bot", text: "Ce numéro ne semble pas valide : il faut entre 7 et 15 chiffres (par exemple 077 12 34 56).", options: [cancelOption] }); return askAddress({ ...f, customer: { ...f.customer, telephone: value.slice(0, 24) } }); }
    if (f.step === "adresse") { if (!validAddress(value)) return push({ from: "bot", text: "J'ai besoin d'une adresse un peu plus précise (quartier, bureau ou maison, un repère) 😊", options: [cancelOption] }); return recap({ ...f, customer: { ...f.customer, adresse: value.slice(0, 180) } }); }
    if (f.step === "sending") return push({ from: "bot", text: "J'envoie ta commande, un petit instant ⏳" });
    push({ from: "bot", text: "Touche une des options de ma dernière question, ou écris « annuler » pour arrêter 😊", options: [cancelOption] });
  };

  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim().slice(0, 200);
    if (!value || typing) return;
    setText("");
    push({ from: "user", text: value });
    if (flowRef.current) return flowText(value);
    if (isOrderRequest(value) && !/\b(wa|whatsapp)\b/i.test(value)) { push({ from: "bot", text: "Avec plaisir, je m'occupe de ta commande étape par étape 😊" }); return startFlow(); }
    const intent = detectIntent(value);
    if (intent && LOCAL_INTENTS.includes(intent)) return localReply(value);
    const history = messages.filter((m) => m.ai).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })).slice(-6);
    setTyping(true);
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch(AI_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: value, history, ...(subscriber ? { prenom: firstName(subscriber.nom) } : {}) }), signal: controller.signal });
      window.clearTimeout(timer);
      const data = response.ok ? await response.json() : null;
      setMessages((list) => list.map((m, i) => (i === list.length - 1 && m.from === "user" ? { ...m, ai: true } : m)));
      if (!data || data.offline || !data.reply) localReply(value);
      else push({ from: "bot", ai: true, text: data.reply, options: data.whatsapp ? [{ href: data.whatsapp, label: "Envoyer ma commande sur WhatsApp" }, { type: "main", label: "Autre question" }] : mainOptions() });
    } catch { localReply(value); }
    finally { setTyping(false); }
  };

  if (!open) return <button className="assistant-fab" data-tour="assistant" onClick={() => setOpen(true)} aria-label="Ouvrir l'assistant RAVITO"><b aria-hidden="true">✦</b><span>Assistant</span></button>;

  const lastBot = [...messages].reverse().find((message) => message.from === "bot");
  return (
    <section className="assistant-panel" role="dialog" aria-label="Assistant RAVITO">
      <div className="assistant-head"><div><b>Assistant RAVITO</b><small>Assistant IA · tes messages sont traités par un service externe, n'y mets pas de mot de passe</small></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Fermer l'assistant"><X size={16} /></button></div>
      <div className="assistant-body" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`bubble ${message.from}`}>
            <p style={message.pre ? { whiteSpace: "pre-line" } : undefined}>{message.text}</p>
            {message.dishes && <div className="bubble-dishes">{message.dishes.map((dish) => (
              <div className="bubble-dish" key={dish.id}><div><strong>{dish.nomPlat}</strong><small>{formatXaf(dish.prix)}{dish.flowDish && subscriber && !dish.seen ? " · nouveau 😉" : ""}</small></div><button onClick={() => addDish(dish)}>Ajouter</button></div>
            ))}</div>}
            {message === lastBot && message.kind === "requests" && flow?.step === "requests" && <div className="bubble-options">
              {SPECIAL_REQUESTS.map((r) => <button key={r} className={flow.requests.includes(r) ? "picked" : ""} aria-pressed={flow.requests.includes(r)} onClick={() => act({ type: "req", value: r })}>{flow.requests.includes(r) ? "✓ " : ""}{r}</button>)}
              {message.habitNote ? <button onClick={() => act({ type: "fl-reqhabit", label: "Mes demandes habituelles" })}>Comme d'habitude : {message.habitNote.slice(0, 40)}</button> : null}
              <button className="primary" onClick={() => act({ type: "fl-reqdone", label: flow.requests.length || flow.reqText ? "C'est bon, continuer" : "Aucune demande, continuer" })}>{flow.requests.length || flow.reqText ? "C'est bon, continuer" : "Aucune demande, continuer"}</button>
              <button onClick={() => act(cancelOption)}>Annuler la commande</button>
            </div>}
            {message === lastBot && message.options && <div className="bubble-options">{message.options.map((option) => option.href
              ? <a key={option.label} href={option.href}>{option.label}</a>
              : <button key={`${option.type}-${option.id || option.intent || option.value || option.label}`} onClick={() => act(option)}>{option.label}</button>)}</div>}
          </div>
        ))}
        {typing && <div className="bubble bot typing" aria-label="L'assistant est en train d'écrire"><p>en train d'écrire<span className="dots"><i>.</i><i>.</i><i>.</i></span></p></div>}
        <div ref={endRef} />
      </div>
      <form className="assistant-form" onSubmit={submit}><input value={text} onChange={(event) => setText(event.target.value)} maxLength={200} placeholder={flow ? "Écris ta réponse ici…" : "Écris ta question, même toute simple…"} aria-label="Ta question" /><button aria-label="Envoyer"><Send size={16} /></button></form>
    </section>
  );
}

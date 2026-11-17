// Logique de l'assistant guidé : aucune IA payante, des réponses fiables tirées des vraies données du catalogue.
const normalize = (text) => String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function detectIntent(text) {
  const t = normalize(text);
  if (!t.trim()) return null;
  const has = (...words) => words.some((word) => t.includes(word));
  if (has("guide", "visite guidee", "tutoriel", "decouvrir le site")) return "guide";
  if (has("sais pas", "sait pas", "suggere", "suggest", "conseil", "idee", "populaire", "plus commande", "quoi commander", "quoi manger", "choisir pour moi", "hesite")) return "suggest";
  if (has("suivi", "suivre", "ou est", "ma commande", "statut", "etat")) return "track";
  if (has("livraison", "livrer", "frais", "delai", "combien de temps")) return "delivery";
  if (has("paie", "paye", "payer", "regler", "reglement", "mobile money", "airtel", "moov", "moov", "moov money", "cash", "espece", "carte bancaire", "visa", "capture", "depot", "verser")) return "payment";
  if (has("note", "avis", "etoile", "meilleur", "bien note")) return "rating";
  if (has("comment", "commander", "passer commande", "aide")) return "how";
  if (has("menu", "plat", "carte", "manger", "repas", "restaurant", "faim")) return "menus";
  if (has("equipe", "contact", "parler", "whatsapp", "humain", "telephone", "appeler")) return "team";
  if (has("bonjour", "salut", "bonsoir", "hello", "coucou")) return "hello";
  return null;
}

// Alternatives proposées quand un restaurant est très sollicité : disponibles, pas sollicités, les mieux classés d'abord (rank vient du serveur).
export function alternativesFor(restaurants, currentId, limit = 3) {
  return (restaurants || [])
    .filter((r) => r.id !== currentId && !r.busy && (r.menu || []).length > 0)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || String(a.nom).localeCompare(String(b.nom), "fr"))
    .slice(0, limit);
}

export function ratingLabel(restaurant) {
  const rating = restaurant?.rating;
  return rating ? `★ ${String(rating.average).replace(".", ",")} (${rating.count})` : null;
}

const money = (value) => `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} FCFA`;

export const PAYMENT_RULE = "Pour tout dépôt, envoie la capture d'écran du paiement sur WhatsApp à l'équipe RAVITO : c'est elle qui valide ton abonnement ou ta commande.";
export function paymentText(payment, online = false) {
  if (online) return "On paie en ligne, directement dans ton panier : tu choisis Airtel Money ou Moov Money, tu confirmes avec ton code secret sur ton téléphone, et ta commande est envoyée au restaurant dès que le paiement est accepté. Si le paiement est refusé, rien n'est envoyé. Pas de carte bancaire et pas de paiement au restaurant.";
  const num = (n) => (n ? ` (${n})` : "");
  const hasNumber = payment && (payment.airtelMoney || payment.moovMoney);
  return `On paie uniquement par Airtel Money${num(payment?.airtelMoney)} ou Moov Money${num(payment?.moovMoney)} : pas de carte bancaire et pas de paiement au restaurant. ${hasNumber ? "" : "L'équipe te donne le numéro sur WhatsApp. "}${PAYMENT_RULE}`;
}
export function suggestText(s) {
  const pop = (s?.populaires || [])[0], top = (s?.mieuxNotes || [])[0];
  if (!pop && !top) return "Pas de souci, je t'aide à choisir ! 😊 Je n'ai pas encore assez de commandes pour te citer les plats stars, mais voici les plats du jour : dis-moi ce qui te tente.";
  const parts = [];
  if (pop) parts.push(`le plus commandé : ${pop.nomPlat} (${pop.restaurantNom})`);
  if (top) parts.push(`le mieux noté : ${top.nomPlat} (${top.restaurantNom}, ${String(top.note).replace(".", ",")}/5)`);
  return `Pas de souci, je t'aide à choisir ! 😊 Aujourd'hui, ${parts.join(" ; ")}. Touche un plat pour l'ajouter, ou je te guide pour commander.`;
}

// Retourne le texte de réponse pour une intention. ctx : { deliveryFee, tracker, contact, restaurantCount }
export function replyText(intent, ctx = {}) {
  switch (intent) {
    case "hello": return "Coucou, et bienvenue chez RAVITO ! 😊 Je suis là pour t'aider : voir les menus du jour, commander ou suivre ta commande. Dis-moi ce qui te ferait plaisir !";
    case "delivery": return `Bonne question ! La livraison est estimée à ${money(ctx.deliveryFee ?? 1000)} par commande. Pas de mauvaise surprise : le total exact s'affiche dans ton panier avant l'envoi de ta demande.`;
    case "how": return "Avec plaisir, c'est très simple 😊 1) Choisis un restaurant et tes plats. 2) Vérifie ton panier. 3) Indique ton nom, ton téléphone et ton adresse. 4) Le restaurant confirme ta commande. Tu ne risques rien : ta commande n'est définitive qu'après sa confirmation, et tu peux la suivre ici à tout moment.";
    case "payment": return paymentText(ctx.payment, Boolean(ctx.paiementAuto));
    case "suggest": return suggestText(ctx.suggestions);
    case "rating": return "Les notes viennent des clients, après leur livraison. La moyenne d'un restaurant apparaît à partir de 3 notes, et quand un restaurant est très sollicité, je te propose en priorité les mieux notés. 😊";
    case "track": return ctx.tracker ? `Voilà des nouvelles ! Ta commande ${ctx.tracker.reference} : ${ctx.tracker.status}. On s'occupe de toi 😊` : "Je ne vois pas de commande en cours sur cet appareil, mais ce n'est pas grave ! Tu peux en passer une depuis les menus du jour, et je t'accompagne si tu veux.";
    case "team": return ctx.contact ? "Bien sûr ! Notre équipe sera ravie de t'aider : tu peux lui écrire sur WhatsApp avec le bouton ci-dessous." : "Je n'ai pas de contact direct à te donner pour le moment, désolé ! Mais je reste là pour t'aider.";
    case "menus": return ctx.restaurantCount ? "Avec plaisir ! Voici les restaurants qui ont un menu aujourd'hui :" : "La carte du jour arrive bientôt : nos restaurants préparent leurs menus. Repasse nous voir dans un moment, ça vaut le coup ! 😊";
    case "guide": return "Avec plaisir, c'est reparti pour la petite visite guidée ! 🎈";
    default: return "Oups, je n'ai pas bien compris, mais ce n'est pas grave ! 😊 Choisis une option ci-dessous ou reformule en quelques mots, je ferai de mon mieux.";
  }
}

export function busyWarning(restaurant) {
  return `${restaurant.nom} est très sollicité en ce moment : la préparation peut prendre un peu plus de temps que d'habitude.`;
}

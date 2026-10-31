/* RAVITO Assistant V2 — site vitrine.
   • Questions libres : IA gratuite via le serveur RAVITO ; si le serveur ne répond pas, réponses pré-écrites (V1).
   • Commande guidée : suit l'ordre du formulaire du site (type → nom → téléphone → formule ou restaurant+plat → adresse → heure
     → demandes spéciales), remplit le VRAI formulaire, puis ouvre WhatsApp avec le message prêt. */
(function () {
  "use strict";
  var API = "https://ravito-staff-app.onrender.com/api/ravito-ai";
  var CATALOG = "https://ravito-staff-app.onrender.com/api/public/catalog";
  var WHATSAPP = "24176564683";
  var history = [];
  var busy = false;
  var flow = null;          // commande guidée en cours
  var suggestions = null, paiement = null;
  var catalog = null;       // restaurants du jour (facultatif)
  var catalogTried = false;

  var REQUESTS = ["Sans piment", "Avec piment", "Sans oignon", "Avec oignon", "Sans mayonnaise", "Sans aromate"];
  var WATER = ["Petite bouteille", "Grande bouteille", "Eau gazeuse"];
  var JUICE = ["Jus de bissap", "Jus de gingembre", "Jus d'orange", "Jus d'ananas"];

  var css = "\
.rva-fab{position:fixed;right:18px;bottom:86px;z-index:75;display:flex;align-items:center;gap:8px;border:1px solid #FF7A00;border-radius:99px;background:#08080A;color:#fff;padding:12px 16px;font:800 13px/1 'DM Sans',system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px #0008}\
.rva-fab b{color:#FF7A00;font-size:16px}\
.rva-panel{position:fixed;right:16px;bottom:16px;z-index:80;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 32px));background:#101014;border:1px solid #26262E;border-radius:20px;box-shadow:0 25px 70px #000a;display:none;flex-direction:column;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;color:#fff}\
.rva-panel.open{display:flex}\
.rva-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:13px 15px;background:#08080A;border-bottom:2px solid #FF7A00}\
.rva-head b{display:block;font-size:14px}.rva-head small{color:#A8A49B;font-size:10px;line-height:1.35;display:block;margin-top:2px}\
.rva-x{border:0;background:#1b1b22;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;flex:none}\
.rva-body{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}\
.rva-m{max-width:88%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.5;overflow-wrap:anywhere;white-space:pre-line}\
.rva-m.bot{align-self:flex-start;background:#1a1a21;border:1px solid #26262E}\
.rva-m.user{align-self:flex-end;background:linear-gradient(100deg,#FFC400,#FF7A00);color:#111;font-weight:600}\
.rva-m.typing{color:#A8A49B;font-style:italic}.rva-m.typing i{font-style:normal;animation:rvaD 1.2s infinite;opacity:.2}.rva-m.typing i:nth-child(2){animation-delay:.2s}.rva-m.typing i:nth-child(3){animation-delay:.4s}\
@keyframes rvaD{40%{opacity:1}}\
.rva-opts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}\
.rva-opts button,.rva-opts a{border:1px solid #FF7A00;background:transparent;color:#FFC400;border-radius:99px;padding:7px 12px;font:700 12px 'DM Sans',system-ui,sans-serif;cursor:pointer;text-decoration:none}\
.rva-opts button.picked{background:#FF7A00;color:#111}.rva-opts button.primary{background:linear-gradient(100deg,#FFC400,#FF7A00);color:#111;border:0}\
.rva-opts a.wa,.rva-opts button.wa{background:#25D366;border-color:#25D366;color:#06210f}\
.rva-form{display:flex;gap:8px;padding:10px;border-top:1px solid #26262E;background:#0c0c10}\
.rva-form input{flex:1;min-width:0;border:1px solid #2c2c35;background:#16161c;color:#fff;border-radius:99px;padding:10px 14px;font:500 16px 'DM Sans',system-ui,sans-serif;outline-color:#FF7A00}\
.rva-form button{width:40px;height:40px;border:0;border-radius:50%;background:linear-gradient(100deg,#FFC400,#FF7A00);color:#111;font-size:16px;font-weight:800;cursor:pointer}\
@media(max-width:600px){.rva-panel{left:0;right:0;bottom:0;width:100%;height:78vh;border-radius:20px 20px 0 0}}";

  // ---------- réponses pré-écrites (mode hors-ligne = V1) ----------
  var PAY_RULE = "Pour tout dépôt, envoie la capture d'écran du paiement sur WhatsApp à l'équipe RAVITO : c'est elle qui valide ton abonnement ou ta commande.";
  function payText() {
    var a = paiement && paiement.airtelMoney, m = paiement && paiement.moovMoney;
    return "On paie uniquement par Airtel Money" + (a ? " (" + a + ")" : "") + " ou Moov Money" + (m ? " (" + m + ")" : "") + " : pas de carte bancaire et pas de paiement au restaurant. " + (a || m ? "" : "L'équipe te donne le numéro sur WhatsApp. ") + PAY_RULE;
  }
  function suggestReply() {
    var p = suggestions && suggestions.populaires && suggestions.populaires[0], n = suggestions && suggestions.mieuxNotes && suggestions.mieuxNotes[0], parts = [];
    if (p) parts.push("le plus commandé : " + p.nomPlat + " (" + p.restaurantNom + ")");
    if (n) parts.push("le mieux noté : " + n.nomPlat + " (" + n.restaurantNom + ", " + String(n.note).replace(".", ",") + "/5)");
    return parts.length ? "Pas de souci, je t'aide à choisir ! 😊 Aujourd'hui, " + parts.join(" ; ") + ". Je te guide pour commander ?" : "Pas de souci ! Je n'ai pas encore assez de commandes pour te citer les plats stars : touche « Commander avec l'assistant » et je te montre les plats du jour.";
  }
  function offlineReply(text) {
    var t = text.toLowerCase();
    if (/paie|payer|paiement|airtel|mobi|moov|carte bancaire|esp[eè]ce|d[eé]p[oô]t|capture/.test(t)) return payText();
    if (/sais pas|sait pas|sugg[eè]re|conseil|id[eé]e|populaire|quoi (manger|commander)|h[eé]site/.test(t)) return suggestReply();
    if (/abonn|formule|semaine|mois|basique|premium|interm/.test(t)) return "3 formules, 5 repas du lundi au vendredi, livraison incluse : Basique 10 000 FCFA/sem (40 000/mois), Intermédiaire 14 500 FCFA/sem (55 000/mois, eau incluse), Premium 23 000 FCFA/sem (88 000/mois, eau et jus inclus). Laquelle te tente ?";
    if (/prix|tarif|co[uû]t|livraison|combien/.test(t)) return "Sans abonnement : prix du plat + 1 000 FCFA de livraison. Avec un abonnement, la livraison est incluse ! 😉";
    if (/bonjour|salut|hello|coucou|bonsoir/.test(t)) return "Salut ! 👋 Je peux préparer ta commande étape par étape, ou répondre à tes questions.";
    return "Je peux préparer ta commande étape par étape : touche « Commander avec l'assistant » 🔥";
  }
  function isOrderRequest(text) {
    var t = String(text || "").toLowerCase();
    if (/\bcomment\b|\?$/.test(t) && !/je (veux|voudrais)/.test(t)) return false;
    return /\b(je (veux|voudrais|prends|prendrai|prendrais|m'abonne)|j['’]aimerais|j['’]en veux|commander|passer (une )?commande|une commande|m'abonner)\b/.test(t);
  }
  function waLink(summary) { return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(summary); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function validName(v) { return String(v || "").trim().length >= 2; }
  function validPhone(v) { var d = String(v || "").replace(/\D/g, ""); return d.length >= 7 && d.length <= 15; }
  function validAddress(v) { return String(v || "").trim().length >= 4; }
  function toggle(list, value) {
    var i = list.indexOf(value); if (i >= 0) { var c = list.slice(); c.splice(i, 1); return c; }
    var topic = /piment/i.test(value) ? /piment/i : /oignon/i.test(value) ? /oignon/i : null;
    return list.filter(function (r) { return !(topic && topic.test(r)); }).concat([value]);
  }
  function loadCatalog() {
    if (catalogTried) return; catalogTried = true;
    try {
      fetch(CATALOG).then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
        .then(function (d) { if (d && d.restaurants) catalog = d.restaurants.filter(function (r) { return r.menu && r.menu.length; }); if (d) { suggestions = d.suggestions || null; paiement = d.paiement || null; } })
        .catch(function () { catalog = null; });
    } catch (e) { catalog = null; }
  }
  function saved() { try { return JSON.parse(localStorage.getItem("ravito-client") || "null") || {}; } catch (e) { return {}; } }

  function init() {
    if (document.getElementById("rva-root")) return;
    var style = el("style"); style.textContent = css; document.head.appendChild(style);
    var root = el("div"); root.id = "rva-root";
    var fab = el("button", "rva-fab"); fab.type = "button"; fab.setAttribute("aria-label", "Ouvrir l'assistant RAVITO");
    fab.innerHTML = "<b>✦</b><span>Assistant</span>";
    var panel = el("section", "rva-panel"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Assistant RAVITO");
    var head = el("div", "rva-head"), hl = el("div");
    hl.appendChild(el("b", "", "RAVITO Assistant"));
    hl.appendChild(el("small", "", "Assistant IA · tes messages sont traités par un service externe, n'y mets ni mot de passe ni code."));
    var x = el("button", "rva-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Fermer");
    head.appendChild(hl); head.appendChild(x);
    var body = el("div", "rva-body"); body.setAttribute("aria-live", "polite");
    var form = el("form", "rva-form"), input = el("input"), send = el("button", "", "➤");
    input.type = "text"; input.maxLength = 300; input.placeholder = "Écris ta question ou ta réponse…"; input.setAttribute("aria-label", "Ton message");
    send.type = "submit"; send.setAttribute("aria-label", "Envoyer");
    form.appendChild(input); form.appendChild(send);
    panel.appendChild(head); panel.appendChild(body); panel.appendChild(form);
    root.appendChild(fab); root.appendChild(panel); document.body.appendChild(root);

    function scroll() { body.scrollTop = body.scrollHeight; }
    function add(who, text, opts) {
      var m = el("div", "rva-m " + who); m.appendChild(el("span", "", text));
      if (opts && opts.length) { var o = el("div", "rva-opts"); opts.forEach(function (op) { o.appendChild(op); }); m.appendChild(o); }
      body.appendChild(m); scroll(); return m;
    }
    function btn(label, fn, cls) { var b = el("button", cls || "", label); b.type = "button"; b.addEventListener("click", function () { b.blur(); fn(); }); return b; }
    function say(label) { add("user", label); }
    function cancelBtn() { return btn("Annuler la commande", function () { say("Annuler la commande"); flow = null; add("bot", "C'est annulé, aucun souci ! 😊", mainOptions()); }); }

    function mainOptions() {
      return [
        btn("Commander avec l'assistant", function () { say("Commander avec l'assistant"); startFlow(); }, "primary"),
        btn("Voir les formules", function () { ask("Voir les formules"); }),
        btn("Je ne sais pas quoi commander", function () { ask("Je ne sais pas quoi commander"); }),
        btn("Prix de la livraison", function () { ask("Prix de la livraison"); }),
        btn("Comment payer", function () { ask("Comment payer ?"); }),
        btn("Revoir le guide", function () { say("Revoir le guide"); close(); if (window.RavitoGuide) setTimeout(window.RavitoGuide.restart, 250); })
      ];
    }
    function greet() { add("bot", "Salut ! 👋 Je suis RAVITO Assistant. Je prépare ta commande étape par étape (je remplis le formulaire pour toi), et je réponds à tes questions sur le site et l'application.", mainOptions()); }
    function open() { panel.classList.add("open"); fab.style.display = "none"; loadCatalog(); if (!body.children.length) greet(); setTimeout(function () { if (!/iPhone|iPad|Android/.test(navigator.userAgent)) input.focus(); }, 50); }
    function close() { panel.classList.remove("open"); fab.style.display = ""; }
    fab.addEventListener("click", open); x.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    window.RavitoAssistant = { open: open };

    // ---------- commande guidée (ordre du formulaire du site) ----------
    function startFlow() {
      if (flow) { add("bot", "On est déjà en train de préparer ta commande 😊 Réponds à ma dernière question, ou annule-la.", [cancelBtn()]); return; }
      var me = saved();
      flow = { step: "mode", mode: "abo", nom: me.nom || "", tel: me.tel || "", plan: "", formule: "", periode: "", restaurant: "", plats: [], platText: "", adresse: me.adresse || "", heure: "", requests: [], reqText: "", drink: {}, drinkQueue: [] };
      add("bot", "C'est parti ! 😊 Tu veux t'abonner (5 repas par semaine, livraison incluse) ou commander un repas à l'unité ?", [
        btn("Je m'abonne", function () { say("Je m'abonne"); flow.mode = "abo"; askName(); }),
        btn("Commande à l'unité", function () { say("Commande à l'unité"); flow.mode = "carte"; askName(); }),
        cancelBtn()]);
    }
    function askName() {
      flow.step = "nom";
      if (validName(flow.nom) && validPhone(flow.tel)) {
        flow.step = "identity";
        add("bot", "Je t'enregistre au nom de " + flow.nom + " (" + flow.tel + "), c'est bien ça ?", [
          btn("Oui, c'est moi", function () { say("Oui, c'est moi"); afterIdentity(); }),
          btn("Non, autre nom", function () { say("Non, autre nom"); flow.nom = ""; flow.tel = ""; flow.step = "nom"; add("bot", "D'accord ! Quel est ton nom ?", [cancelBtn()]); }),
          cancelBtn()]);
        return;
      }
      add("bot", "Super ! Quel est ton nom ?", [cancelBtn()]);
    }
    function askPhone() { flow.step = "tel"; add("bot", "Et ton numéro de téléphone, pour que l'équipe puisse te joindre ?", [cancelBtn()]); }
    function afterIdentity() { if (flow.mode === "abo") askPlan(); else askRestaurant(); }

    function planValue(formule, periode) {
      var sel = document.getElementById("plan"); if (!sel) return formule + " — " + periode;
      for (var i = 0; i < sel.options.length; i++) { var v = sel.options[i].value; if (v.indexOf(formule) === 0 && v.indexOf(periode) !== -1) return v; }
      return formule + " — " + periode;
    }
    function askPlan() {
      flow.step = "plan";
      add("bot", "Quelle formule te tente ?\n• Basique : l'essentiel, 10 000 FCFA/sem\n• Intermédiaire : eau incluse, 14 500 FCFA/sem\n• Premium : eau + jus, tout le catalogue, 23 000 FCFA/sem", ["Basique", "Intermédiaire", "Premium"].map(function (f) {
        return btn(f, function () { say(f); flow.formule = f; askPeriod(); });
      }).concat([cancelBtn()]));
    }
    function askPeriod() {
      flow.step = "periode";
      add("bot", "À la semaine ou au mois ?", [
        btn("À la semaine", function () { say("À la semaine"); flow.periode = "semaine"; afterPlan(); }),
        btn("Au mois", function () { say("Au mois"); flow.periode = "mois"; afterPlan(); }), cancelBtn()]);
    }
    function afterPlan() {
      flow.plan = planValue(flow.formule, flow.periode);
      flow.drinkQueue = flow.formule === "Premium" ? ["boisson", "eau"] : flow.formule === "Intermédiaire" ? ["eau"] : [];
      askDrink();
    }
    function askDrink() {
      if (!flow.drinkQueue.length) return askAddress();
      flow.step = "drink";
      var f = flow.drinkQueue[0], choices = f === "boisson" ? JUICE : WATER;
      add("bot", f === "boisson" ? "Ta formule " + flow.formule + " comprend une boisson. Laquelle préfères-tu ? Touche un choix ou écris le tien." : "Et pour l'eau, quelle bouteille préfères-tu ? Touche un choix ou écris le tien.",
        choices.map(function (c) { return btn(c, function () { say(c); setDrink(c); }); }).concat([cancelBtn()]));
    }
    function setDrink(v) { flow.drink[flow.drinkQueue[0]] = String(v).slice(0, 40); flow.drinkQueue.shift(); askDrink(); }

    function askRestaurant() {
      flow.step = "restaurant";
      if (catalog && catalog.length) {
        add("bot", "Dans quel restaurant veux-tu commander ?", catalog.map(function (r) { return btn(r.nom, function () { say(r.nom); flow.restaurant = r.nom; askDish(r); }); }).concat([cancelBtn()]));
      } else add("bot", "Dans quel restaurant veux-tu commander ? Écris son nom.", [cancelBtn()]);
    }
    function askDish(r) {
      flow.step = "plat";
      add("bot", "Voici les plats de " + r.nom + " aujourd'hui. Touche ceux que tu veux (tu peux en ajouter plusieurs), puis continue. Tu peux aussi écrire ta demande.",
        r.menu.map(function (d) { return btn(d.nomPlat + " · " + String(d.prix).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA", function () { flow.plats.push(d.nomPlat); add("bot", "Ajouté ! Dans ta commande : " + flow.plats.join(", ") + ". Autre chose ?", [btn("C'est tout, continuer", function () { say("C'est tout, continuer"); askAddress(); }, "primary"), cancelBtn()]); }); }).concat([cancelBtn()]));
    }
    function askAddress() {
      flow.step = "adresse";
      var opts = [];
      if (validAddress(flow.adresse)) opts.push(btn(("Même adresse : " + flow.adresse).slice(0, 60), function () { say("Même adresse"); askTime(); }));
      add("bot", "Où doit-on te livrer ? Écris le quartier, un repère, bureau ou maison.", opts.concat([cancelBtn()]));
    }
    function askTime() {
      flow.step = "heure";
      add("bot", "À quelle heure souhaites-tu être livré ? (par exemple 12h30)", [btn("Peu importe", function () { say("Peu importe"); flow.heure = ""; askRequests(); }), cancelBtn()]);
    }
    function askRequests() {
      flow.step = "requests";
      var m = add("bot", "Une demande spécifique ? Par exemple sans piment, avec ou sans oignon, sans mayonnaise, sans aromate… Touche ce qui convient (plusieurs possibles) ou écris ta demande, puis continue.");
      drawRequests(m);
    }
    function drawRequests(m) {
      var old = m.querySelector(".rva-opts"); if (old) old.remove();
      var o = el("div", "rva-opts");
      REQUESTS.forEach(function (r) { var on = flow.requests.indexOf(r) >= 0; var b = btn((on ? "✓ " : "") + r, function () { flow.requests = toggle(flow.requests, r); drawRequests(m); }, on ? "picked" : ""); o.appendChild(b); });
      o.appendChild(btn(flow.requests.length || flow.reqText ? "C'est bon, continuer" : "Aucune demande, continuer", function () { say(flow.requests.length || flow.reqText ? "C'est bon, continuer" : "Aucune demande"); recap(); }, "primary"));
      o.appendChild(cancelBtn()); m.appendChild(o); scroll();
    }
    function noteText() {
      var parts = [], asks = flow.requests.concat(flow.reqText ? [flow.reqText] : []);
      if (asks.length) parts.push(asks.join(", "));
      if (flow.drink.boisson) parts.push("Boisson : " + flow.drink.boisson);
      if (flow.drink.eau) parts.push("Eau : " + flow.drink.eau);
      return parts.join(" · ").slice(0, 300);
    }
    function platsText() { var t = flow.plats.join(", "); if (flow.platText) t = (t ? t + ", " : "") + flow.platText; return flow.restaurant ? (t ? t + " — chez " + flow.restaurant : "chez " + flow.restaurant) : t; }
    function recap() {
      flow.step = "recap";
      var L = [flow.mode === "abo" ? "Abonnement : " + flow.plan : "Commande chez " + (flow.restaurant || "?") + " : " + (platsText() || "(à préciser)")];
      L.push("Nom : " + flow.nom, "Téléphone : " + flow.tel, "Livraison : " + flow.adresse);
      if (flow.heure) L.push("Heure souhaitée : " + flow.heure);
      L.push(noteText() ? "Demandes : " + noteText() : "Aucune demande spéciale");
      add("bot", "Voilà ton récapitulatif :\n" + L.join("\n") + "\nJe remplis le formulaire du site et j'ouvre WhatsApp avec ton message prêt. Paiement : Airtel Money ou Moov Money uniquement, et n'oublie pas d'envoyer la capture d'écran du dépôt sur WhatsApp pour valider. On y va ?", [
        btn("Envoyer sur WhatsApp", function () { say("Envoyer sur WhatsApp"); submitFlow(); }, "wa"),
        btn("Modifier mes demandes", function () { say("Modifier mes demandes"); askRequests(); }),
        cancelBtn()]);
    }
    function setField(id, value) { var f = document.getElementById(id); if (!f) return; f.value = value; f.dispatchEvent(new Event("input", { bubbles: true })); f.dispatchEvent(new Event("change", { bubbles: true })); }
    function submitFlow() {
      var f = flow;
      var seg = document.querySelector('#seg button[data-mode="' + f.mode + '"]'); if (seg) seg.click();
      setField("nom", f.nom); setField("tel", f.tel); setField("adresse", f.adresse); setField("heure", f.heure); setField("note", noteText());
      if (f.mode === "abo") setField("plan", f.plan); else setField("plat", platsText());
      var sendBtn = document.getElementById("send");
      flow = null;
      if (sendBtn) sendBtn.click();
      else window.location.assign(waLink("Bonjour RAVITO, " + (f.mode === "abo" ? "je souhaite m'abonner : " + f.plan : "je souhaite commander : " + platsText()) + "\nNom : " + f.nom + "\nTéléphone : " + f.tel + "\nLivraison : " + f.adresse));
      add("bot", "Je t'ouvre WhatsApp 📲 Si rien ne s'ouvre, le formulaire plus bas est rempli : il te suffit d'appuyer sur « Envoyer sur WhatsApp ». " + PAY_RULE, mainOptions());
    }

    // Réponse écrite pendant la commande guidée
    function flowText(v) {
      if (/^(annuler|stop|laisse tomber)$/i.test(v)) { flow = null; return add("bot", "C'est annulé, aucun souci ! 😊", mainOptions()); }
      var s = flow.step;
      if (s === "nom") { if (!validName(v)) return add("bot", "Vérifie ton nom : il faut au moins 2 lettres 😊", [cancelBtn()]); flow.nom = v.slice(0, 80); return askPhone(); }
      if (s === "tel") { if (!validPhone(v)) return add("bot", "Ce numéro ne semble pas valide : il faut entre 7 et 15 chiffres (par exemple 077 12 34 56).", [cancelBtn()]); flow.tel = v.slice(0, 24); return afterIdentity(); }
      if (s === "restaurant") { flow.restaurant = v.slice(0, 80); var r = (catalog || []).filter(function (c) { return c.nom.toLowerCase() === v.toLowerCase(); })[0]; return r ? askDish(r) : (flow.step = "plat", add("bot", "Et que veux-tu commander chez " + flow.restaurant + " ? Écris ton plat.", [cancelBtn()])); }
      if (s === "plat") { flow.platText = (flow.platText ? flow.platText + ", " : "") + v.slice(0, 150); return add("bot", "Noté : « " + v + " ». Autre chose ?", [btn("C'est tout, continuer", function () { say("C'est tout, continuer"); askAddress(); }, "primary"), cancelBtn()]); }
      if (s === "drink") return setDrink(v);
      if (s === "adresse") { if (!validAddress(v)) return add("bot", "J'ai besoin d'une adresse un peu plus précise (quartier, bureau ou maison, un repère) 😊", [cancelBtn()]); flow.adresse = v.slice(0, 180); return askTime(); }
      if (s === "heure") { flow.heure = v.slice(0, 20); return askRequests(); }
      if (s === "requests") { flow.reqText = (flow.reqText ? flow.reqText + ", " : "") + v.slice(0, 100); var last = body.querySelectorAll(".rva-m.bot"); var m = last[last.length - 1]; return add("bot", "C'est noté : « " + v + " ». Autre chose, ou on continue ?", [btn("C'est bon, continuer", function () { say("C'est bon, continuer"); recap(); }, "primary"), cancelBtn()]); }
      add("bot", "Touche une des options de ma dernière question, ou écris « annuler » pour arrêter 😊", [cancelBtn()]);
    }

    // ---------- questions libres : IA, avec repli hors-ligne ----------
    function ask(text) {
      text = String(text || "").trim().slice(0, 300);
      if (!text || busy) return;
      add("user", text);
      if (flow) return flowText(text);
      if (isOrderRequest(text) && !/whatsapp/i.test(text)) { add("bot", "Avec plaisir, je m'occupe de ta commande étape par étape 😊"); return startFlow(); }
      busy = true;
      var typing = add("bot typing", "en train d'écrire");
      var dots = el("span", "", ""); dots.innerHTML = "<i>.</i><i>.</i><i>.</i>"; typing.firstChild.appendChild(dots);
      var past = history.slice(-6);
      var done = function (reply, wa) {
        typing.remove(); busy = false;
        history.push({ role: "user", content: text }); history.push({ role: "assistant", content: reply });
        var o = []; if (wa) { var a = el("a", "wa", "Envoyer ma commande sur WhatsApp"); a.href = wa; a.target = "_blank"; a.rel = "noopener"; o.push(a); }
        o.push(btn("Commander avec l'assistant", function () { say("Commander avec l'assistant"); startFlow(); }));
        add("bot", reply, o);
      };
      var offline = function () { typing.remove(); busy = false; history.push({ role: "user", content: text }); var r = offlineReply(text); history.push({ role: "assistant", content: r }); add("bot", r, mainOptions()); };
      var ctl = typeof AbortController === "function" ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
      fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: past }), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error("http"); return r.json(); })
        .then(function (d) { if (!d || d.offline || !d.reply) return offline(); done(d.reply, d.whatsapp); })
        .catch(function () { clearTimeout(timer); offline(); });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; ask(v); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

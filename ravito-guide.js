/* Guide de première visite du site RAVITO : petites étiquettes flottantes, une étape à la fois.
   Une seule fois par appareil ; « Passer le guide » l'arrête. Relançable : window.RavitoGuide.restart() */
(function () {
  "use strict";
  var KEY = "ravito-site-guide-v1";
  var memory = false;
  function isDone() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return memory; } }
  function markDone() { memory = true; try { localStorage.setItem(KEY, "1"); } catch (e) { /* repli mémoire */ } }
  function clearDone() { memory = false; try { localStorage.removeItem(KEY); } catch (e) { /* repli mémoire */ } }

  var STEPS = [
    { title: "Bienvenue chez RAVITO ! 👋", text: "Petit tour du site en quelques étapes, pour t'expliquer à quoi sert chaque bouton. Tu peux l'arrêter à tout moment avec « Passer le guide »." },
    { target: ".navcta", title: "Le bouton Commander", text: "Il t'emmène directement au formulaire de commande, où que tu sois sur la page." },
    { target: ".hero .btn-p", title: "Voir les formules", text: "Découvre nos 3 formules d'abonnement : 5 repas par semaine, du lundi au vendredi, livraison incluse." },
    { target: "#menus .btn-p", title: "Les menus du jour", text: "Ce bouton ouvre l'application RAVITO : tu y vois les plats d'aujourd'hui, tu les commandes et tu suis ta livraison." },
    { target: "#formules .plans", title: "Choisis ta formule", text: "Basique pour l'essentiel, Intermédiaire avec l'eau incluse, Premium avec eau et jus et tout le catalogue. Prix à la semaine ou au mois." },
    { target: "#formules .pick", title: "Choisir une formule", text: "Ce bouton pré-remplit le formulaire avec la formule que tu as choisie : tu n'as plus qu'à donner tes coordonnées." },
    { target: "#seg", title: "Abonnement ou commande à l'unité ?", text: "« Je m'abonne » = 5 repas par semaine. « Commande à l'unité » = un repas au prix du restaurant, plus 1 000 FCFA de livraison." },
    { target: "#nom", title: "Tes coordonnées", text: "Ton nom, ton téléphone, puis le lieu de livraison (quartier, repère, bureau ou maison) et l'heure souhaitée.", scrollTo: "#commander .order" },
    { target: "#note", title: "Tes demandes spéciales", text: "Sans piment, sans oignon, avec oignon, sans mayonnaise, sans aromate… Écris-le ici, le restaurant en tiendra compte." },
    { target: "#send", title: "Envoyer sur WhatsApp", text: "Ça ouvre WhatsApp avec ton message déjà écrit : tu n'as plus qu'à l'envoyer. L'équipe RAVITO te répond pour confirmer." },
    { target: "#fab", title: "Une question ?", text: "Ce bouton vert te met en relation directe avec l'équipe RAVITO sur WhatsApp." },
    { target: ".rva-fab", title: "L'assistant RAVITO", text: "Pose-lui tes questions, ou laisse-le préparer ta commande étape par étape : il remplit le formulaire pour toi." },
    { target: "#faq", title: "Les questions fréquentes", text: "Paiement, livraison, abonnement : les réponses rapides sont ici. Bon appétit ! 🍽️" }
  ];

  var css = "\
.rvg-ring{position:fixed;z-index:9990;border-radius:14px;border:2px solid #FF7A00;box-shadow:0 0 0 9999px rgba(0,0,0,.62),0 0 22px rgba(255,122,0,.55);pointer-events:none;transition:all .25s ease}\
.rvg-card{position:fixed;z-index:9991;left:50%;transform:translateX(-50%);width:min(380px,calc(100vw - 24px));background:#101014;color:#fff;border:1px solid #26262E;border-top:3px solid #FF7A00;border-radius:16px;padding:15px 16px 13px;box-shadow:0 18px 60px #000c;font-family:'DM Sans',system-ui,sans-serif}\
.rvg-card.bottom{bottom:max(12px,env(safe-area-inset-bottom))}.rvg-card.top{top:76px}.rvg-card.mid{top:50%;transform:translate(-50%,-50%)}\
.rvg-card b{display:block;font-size:15px;margin-bottom:5px}.rvg-card p{margin:0 0 12px;font-size:13px;line-height:1.5;color:#d9d6cc}\
.rvg-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.rvg-count{font-size:11px;color:#A8A49B}\
.rvg-skip{border:0;background:transparent;color:#A8A49B;font:600 12px 'DM Sans',system-ui,sans-serif;cursor:pointer;padding:8px 4px;text-decoration:underline}\
.rvg-next{border:0;border-radius:99px;background:linear-gradient(100deg,#FFC400,#FF7A00);color:#111;font:800 13px 'DM Sans',system-ui,sans-serif;padding:10px 18px;cursor:pointer}\
.rvg-back{border:1px solid #3a3a44;border-radius:99px;background:transparent;color:#fff;font:700 12px 'DM Sans',system-ui,sans-serif;padding:9px 13px;cursor:pointer;margin-right:6px}";

  var ring, card, idx = -1, active = false, timer = null, token = 0;

  function visible(sel) {
    var el = sel ? document.querySelector(sel) : null;
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? el : null;
  }
  function build() {
    if (ring) return;
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    ring = document.createElement("div"); ring.className = "rvg-ring"; ring.style.display = "none";
    card = document.createElement("div"); card.className = "rvg-card bottom"; card.setAttribute("role", "dialog"); card.setAttribute("aria-live", "polite"); card.style.display = "none";
    document.body.appendChild(ring); document.body.appendChild(card);
  }
  function isFixed(el) { for (var e = el; e && e !== document.body; e = e.parentElement) { if (getComputedStyle(e).position === "fixed" || getComputedStyle(e).position === "sticky") return true; } return false; }

  function show(i, dir) {
    var my = ++token;
    while (STEPS[i] && STEPS[i].target && !visible(STEPS[i].target)) i += dir;      // cible absente : on saute
    if (i < 0) i = 0;
    if (!STEPS[i]) return finish();
    idx = i; var step = STEPS[i], el = step.target ? visible(step.target) : null;
    if (el && !isFixed(el)) {
      var r = el.getBoundingClientRect(), vh = window.innerHeight;
      var wanted = Math.max(0, window.pageYOffset + r.top - vh * 0.3);
      try { window.scrollTo({ top: wanted, behavior: "instant" }); } catch (e) { window.scrollTo(0, wanted); }   // « instant » : la page a un défilement doux qui retarderait le cadre
    }
    setTimeout(function () { if (my === token) render(); }, 80);
    setTimeout(function () { if (my === token) tick(); }, 450);
  }
  function render() {
    var step = STEPS[idx]; if (!step) return;
    var el = step.target ? visible(step.target) : null;
    card.innerHTML = "";
    var t = document.createElement("b"); t.textContent = step.title;
    var p = document.createElement("p"); p.textContent = step.text;
    var row = document.createElement("div"); row.className = "rvg-row";
    var left = document.createElement("div");
    var skip = document.createElement("button"); skip.className = "rvg-skip"; skip.type = "button"; skip.textContent = "Passer le guide"; skip.onclick = finish;
    var count = document.createElement("span"); count.className = "rvg-count"; count.textContent = (idx + 1) + " / " + STEPS.length;
    left.appendChild(skip); left.appendChild(count);
    var right = document.createElement("div");
    if (idx > 0) { var back = document.createElement("button"); back.className = "rvg-back"; back.type = "button"; back.textContent = "Retour"; back.onclick = function () { show(idx - 1, -1); }; right.appendChild(back); }
    var next = document.createElement("button"); next.className = "rvg-next"; next.type = "button"; next.textContent = idx === STEPS.length - 1 ? "C'est compris !" : "Suivant";
    next.onclick = function () { if (idx === STEPS.length - 1) finish(); else show(idx + 1, 1); };
    right.appendChild(next); row.appendChild(left); row.appendChild(right);
    card.appendChild(t); card.appendChild(p); card.appendChild(row);
    card.style.display = "block";
    place(el);
    next.focus({ preventScroll: true });
  }
  function place(el) {
    if (!el) { ring.style.display = "none"; card.className = "rvg-card mid"; return; }
    var r = el.getBoundingClientRect(), vh = window.innerHeight, pad = 6;
    ring.style.display = "block";
    ring.style.left = (r.left - pad) + "px"; ring.style.top = (r.top - pad) + "px";
    ring.style.width = (r.width + pad * 2) + "px"; ring.style.height = (r.height + pad * 2) + "px";
    var center = r.top + r.height / 2;
    card.className = "rvg-card " + (center > vh * 0.5 ? "top" : "bottom");
  }
  function tick() { if (!active) return; var s = STEPS[idx]; if (s && s.target) place(visible(s.target)); }
  function start() {
    build(); active = true; idx = -1;
    if (!timer) { timer = setInterval(tick, 250); window.addEventListener("resize", tick); window.addEventListener("scroll", tick, true); }
    show(0, 1);
  }
  function finish() {
    token++; active = false; markDone();
    if (ring) ring.style.display = "none"; if (card) card.style.display = "none";
    if (timer) { clearInterval(timer); timer = null; window.removeEventListener("resize", tick); window.removeEventListener("scroll", tick, true); }
  }
  document.addEventListener("keydown", function (e) { if (active && e.key === "Escape") finish(); });

  window.RavitoGuide = { restart: function () { clearDone(); window.scrollTo(0, 0); setTimeout(start, 80); } };
  function boot() { if (!isDone()) setTimeout(function () { if (!isDone()) start(); }, 1800); }   // laisse le temps à l'assistant d'apparaître
  if (document.readyState === "complete") boot(); else window.addEventListener("load", boot);
})();

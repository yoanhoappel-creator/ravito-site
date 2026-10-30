/* RAVITO Assistant V2 — vitrine. IA gratuite via le serveur RAVITO ; repli hors-ligne (V1) si le serveur ne répond pas. */
(function () {
  "use strict";
  var API = "https://ravito-staff-app.onrender.com/api/ravito-ai";
  var WHATSAPP = "24176564683";
  var history = [];
  var busy = false;

  var css = "\
.rva-fab{position:fixed;left:16px;bottom:18px;z-index:75;display:flex;align-items:center;gap:8px;border:1px solid #FF7A00;border-radius:99px;background:#08080A;color:#fff;padding:12px 16px;font:800 13px/1 'DM Sans',system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 30px #0008}\
.rva-fab b{color:#FF7A00;font-size:16px}\
.rva-panel{position:fixed;left:16px;bottom:16px;z-index:80;width:min(380px,calc(100vw - 32px));height:min(540px,calc(100vh - 32px));background:#101014;border:1px solid #26262E;border-radius:20px;box-shadow:0 25px 70px #000a;display:none;flex-direction:column;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;color:#fff}\
.rva-panel.open{display:flex}\
.rva-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:13px 15px;background:#08080A;border-bottom:2px solid #FF7A00}\
.rva-head b{display:block;font-size:14px}.rva-head small{color:#A8A49B;font-size:10px;line-height:1.35;display:block;margin-top:2px}\
.rva-x{border:0;background:#1b1b22;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;flex:none}\
.rva-body{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}\
.rva-m{max-width:88%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.5;word-wrap:break-word}\
.rva-m.bot{align-self:flex-start;background:#1a1a21;border:1px solid #26262E}\
.rva-m.user{align-self:flex-end;background:linear-gradient(100deg,#FFC400,#FF7A00);color:#111;font-weight:600}\
.rva-m.typing{color:#A8A49B;font-style:italic}.rva-m.typing i{font-style:normal;animation:rvaD 1.2s infinite;opacity:.2}.rva-m.typing i:nth-child(2){animation-delay:.2s}.rva-m.typing i:nth-child(3){animation-delay:.4s}\
@keyframes rvaD{40%{opacity:1}}\
.rva-opts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}\
.rva-opts button,.rva-opts a{border:1px solid #FF7A00;background:transparent;color:#FFC400;border-radius:99px;padding:6px 11px;font:700 11.5px 'DM Sans',system-ui,sans-serif;cursor:pointer;text-decoration:none}\
.rva-opts a.wa{background:#25D366;border-color:#25D366;color:#06210f}\
.rva-form{display:flex;gap:8px;padding:10px;border-top:1px solid #26262E;background:#0c0c10}\
.rva-form input{flex:1;min-width:0;border:1px solid #2c2c35;background:#16161c;color:#fff;border-radius:99px;padding:10px 14px;font:500 13px 'DM Sans',system-ui,sans-serif;outline-color:#FF7A00}\
.rva-form button{width:40px;height:40px;border:0;border-radius:50%;background:linear-gradient(100deg,#FFC400,#FF7A00);color:#111;font-size:16px;font-weight:800;cursor:pointer}\
@media(max-width:600px){.rva-fab{bottom:84px}.rva-panel{left:0;right:0;bottom:0;width:100%;height:78vh;border-radius:20px 20px 0 0}}";

  // Réponses pré-écrites (mode hors-ligne = V1). Prix = ceux affichés sur le site.
  function offlineReply(text) {
    var t = text.toLowerCase();
    if (/abonn|formule|semaine|mois|basique|premium|interm/.test(t)) return "3 formules, 5 repas du lundi au vendredi, livraison incluse : Basique 10 000 FCFA/sem (40 000/mois), Intermédiaire 14 500 FCFA/sem (55 000/mois), Premium 23 000 FCFA/sem (88 000/mois). Laquelle te tente ?";
    if (/prix|tarif|co[uû]t|livraison|combien/.test(t)) return "Sans abonnement : prix du plat + 1 000 FCFA de livraison. Avec un abonnement, la livraison est incluse ! 😉";
    if (/bonjour|salut|hello|coucou|bonsoir/.test(t)) return "Salut ! Dis-moi ton plat et ton adresse, je m'en occupe 🔥";
    return "Dis-moi ton plat, ton adresse (bureau ou maison) et l'heure, je prépare ta commande sur WhatsApp 🔥";
  }

  function waLink(summary) { return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(summary); }
  function userSummary() {
    var u = history.filter(function (m) { return m.role === "user"; }).map(function (m) { return m.content; }).join(" | ");
    return "Commande RAVITO : " + u;
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

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
    input.type = "text"; input.maxLength = 300; input.placeholder = "Ex : un alloco au bureau à 12h"; input.setAttribute("aria-label", "Ton message");
    send.type = "submit"; send.setAttribute("aria-label", "Envoyer");
    form.appendChild(input); form.appendChild(send);
    panel.appendChild(head); panel.appendChild(body); panel.appendChild(form);
    root.appendChild(fab); root.appendChild(panel); document.body.appendChild(root);

    function add(who, text, opts) {
      var m = el("div", "rva-m " + who); m.appendChild(el("span", "", text));
      if (opts) { var o = el("div", "rva-opts"); opts.forEach(function (op) { o.appendChild(op); }); m.appendChild(o); }
      body.appendChild(m); body.scrollTop = body.scrollHeight; return m;
    }
    function waButton(url) { var a = el("a", "wa", "Envoyer ma commande sur WhatsApp"); a.href = url; a.target = "_blank"; a.rel = "noopener"; return a; }
    function quick(label) { var b = el("button", "", label); b.type = "button"; b.addEventListener("click", function () { ask(label); }); return b; }

    function greet() {
      add("bot", "Salut ! 👋 Je suis RAVITO Assistant. Dis-moi ton plat, ton adresse (bureau ou maison) et l'heure : je m'occupe du reste.", [quick("Voir les formules"), quick("Prix de la livraison")]);
    }
    function open() { panel.classList.add("open"); fab.style.display = "none"; if (!body.children.length) greet(); setTimeout(function () { input.focus(); }, 50); }
    function close() { panel.classList.remove("open"); fab.style.display = ""; }
    fab.addEventListener("click", open); x.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    function ask(text) {
      text = String(text || "").trim().slice(0, 300);
      if (!text || busy) return;
      busy = true;
      add("user", text);
      var typing = add("bot typing", "en train d'écrire");
      var dots = el("span", "", ""); dots.innerHTML = "<i>.</i><i>.</i><i>.</i>"; typing.firstChild.appendChild(dots);
      var past = history.slice(-6);
      var done = function (reply, wa) {
        typing.remove(); busy = false;
        history.push({ role: "user", content: text });
        history.push({ role: "assistant", content: reply });
        add("bot", reply, wa ? [waButton(wa)] : null);
      };
      var offline = function () { typing.remove(); busy = false; history.push({ role: "user", content: text }); var r = offlineReply(text); history.push({ role: "assistant", content: r }); add("bot", r, /whatsapp/i.test(r) ? [waButton(waLink(userSummary()))] : null); };
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

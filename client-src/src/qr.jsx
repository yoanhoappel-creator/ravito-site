import { useEffect, useMemo, useRef, useState } from "react";
import qrcode from "./vendor/qrcode.js";

export const QR_PREFIX = "RAVITO:";
export const qrPayload = (code) => QR_PREFIX + code;

/* Vrai QR code scannable (noir sur blanc, marge réglementaire de 4 modules). */
export function QrImage({ value, size = 200 }) {
  const { count, dark } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(String(value));
    qr.make();
    const n = qr.getModuleCount();
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push([c, r]);
    return { count: n, dark: cells };
  }, [value]);
  const margin = 4, total = count + margin * 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} role="img" aria-label="QR code de l'abonnement" shapeRendering="crispEdges" style={{ borderRadius: 10, background: "#fff", display: "block" }}>
      <rect width={total} height={total} fill="#fff" />
      {dark.map(([x, y]) => <rect key={`${x}-${y}`} x={x + margin} y={y + margin} width="1" height="1" fill="#000" />)}
    </svg>
  );
}

/* Lecteur de QR par la caméra (BarcodeDetector si le navigateur l'a, sinon jsQR),
   avec saisie manuelle du code en secours. onCode(texte, "scan"|"manuel") renvoie
   un message d'erreur (texte) ou null si le code est accepté. */
export function QrScanner({ onCode, onClose, C, FD }) {
  const videoRef = useRef(null);
  const busyRef = useRef(false);      // vérification en cours
  const pauseRef = useRef(false);     // courte pause du scan après un refus
  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");

  async function submit(text, method) {
    if (busyRef.current) return;
    busyRef.current = true; setMessage("Vérification…");
    try {
      const error = await onCode(text, method);
      if (error) { setMessage(error); pauseRef.current = true; setTimeout(() => { pauseRef.current = false; }, 1800); }
      else onClose();
    } catch { setMessage("Vérification impossible, réessaie."); pauseRef.current = true; setTimeout(() => { pauseRef.current = false; }, 1800); }
    finally { busyRef.current = false; }
  }

  useEffect(() => {
    let stopped = false, stream = null, timer = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCameraError("La caméra n'est pas disponible ici. Saisis le code à la main."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch { setCameraError("Caméra refusée ou indisponible. Autorise-la dans le navigateur ou saisis le code à la main."); return; }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const detector = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("./vendor/jsqr.js")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const tick = async () => {
        if (stopped) return;
        if (!busyRef.current && !pauseRef.current && video.readyState >= 2 && video.videoWidth) {
          let text = "";
          try {
            if (detector) { const found = await detector.detect(video); text = found[0]?.rawValue || ""; }
            else {
              const scale = Math.min(1, 640 / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data || "";
            }
          } catch { /* image illisible : on réessaie */ }
          if (text) await submit(text, "scan");
        }
        timer = setTimeout(tick, 250);
      };
      tick();
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Scanner le QR du client" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16 }}>
        <div style={{ fontFamily: FD, fontSize: 16, color: C.ink }}>Scanner le QR du client</div>
        {cameraError
          ? <div style={{ marginTop: 12, fontSize: 12.5, color: "#FF8A7A", lineHeight: 1.5 }}>{cameraError}</div>
          : <video ref={videoRef} playsInline muted style={{ marginTop: 12, width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 14, background: "#000" }} />}
        {message && <div role="status" style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: message === "Vérification…" ? C.muted : "#FF8A7A" }}>{message}</div>}
        <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) submit(manual, "manuel"); }} style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="ou saisis le code (QR-…)" autoCapitalize="characters" autoCorrect="off" spellCheck="false"
            style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#0A0A0C", color: C.ink, fontSize: 14, fontFamily: "monospace" }} />
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: C.y, color: "#111", fontWeight: 800, cursor: "pointer" }}>OK</button>
        </form>
        <button type="button" onClick={onClose} style={{ marginTop: 12, width: "100%", padding: "11px", borderRadius: 999, border: `1.5px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, cursor: "pointer" }}>Fermer</button>
      </div>
    </div>
  );
}

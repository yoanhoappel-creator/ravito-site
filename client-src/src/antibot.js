// Contrôle anti-robot gratuit : le téléphone résout une petite épreuve (quelques secondes
// de calcul, invisible pour le client) avant d'envoyer une commande. Voir server/antibot.js.
import { apiUrl } from "./base.js";
const enc = new TextEncoder();

function zeroBits(bytes) {
  let count = 0;
  for (const byte of bytes) { if (byte === 0) { count += 8; continue; } count += Math.clz32(byte) - 24; break; }
  return count;
}

export async function solveChallenge({ nonce, bits }) {
  if (!globalThis.crypto?.subtle) throw new Error("Ton navigateur ne permet pas d'envoyer la commande en sécurité.");
  const BATCH = 256;
  for (let start = 0; start < 20_000_000; start += BATCH) {
    const hashes = await Promise.all(Array.from({ length: BATCH }, (_, i) => crypto.subtle.digest("SHA-256", enc.encode(`${nonce}.${start + i}`))));
    for (let i = 0; i < BATCH; i++) if (zeroBits(new Uint8Array(hashes[i])) >= bits) return start + i;
  }
  throw new Error("Vérification impossible, réessaie.");
}

export async function fetchProof() {
  const response = await fetch(apiUrl("/api/public/challenge"), { cache: "no-store" });
  if (!response.ok) throw new Error("Service momentanément indisponible. Réessaie.");
  const challenge = await response.json();
  return { ...challenge, counter: await solveChallenge(challenge) };
}

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, rmSync, existsSync } from "node:fs";

// Adresse du serveur RAVITO (Render) appelé par l'application client.
process.env.VITE_API_BASE ??= "https://ravito-staff-app.onrender.com";

// Construit l'application client dans client-src/dist ; le workflow la copie ensuite dans /app (publié par GitHub Pages).
export default defineConfig({
  base: "/ravito-site/app/",
  plugins: [react(), {
    name: "client-finalize",
    closeBundle() {
      const out = "dist";
      if (existsSync(`${out}/client.html`)) { copyFileSync(`${out}/client.html`, `${out}/index.html`); rmSync(`${out}/client.html`); }
      if (existsSync(`${out}/client.webmanifest`)) { copyFileSync(`${out}/client.webmanifest`, `${out}/manifest.webmanifest`); rmSync(`${out}/client.webmanifest`); }
    },
  }],
  build: { outDir: "dist", emptyOutDir: true, rollupOptions: { input: "client.html" } },
});

// Le bouton « Accès équipe » de l'application client n'existe que dans l'application INSTALLÉE depuis le lien équipe.
// Dans un navigateur, ou pour un client qui installe l'application depuis le site, il n'apparaît jamais.
export const TEAM_INSTALL_KEY = "ravito-team-install";

export const isStandalone = () => {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; } catch { return false; }
};

// Appelé au démarrage : ouvrir l'espace équipe DEPUIS l'application installée mémorise cette installation.
export function markTeamInstall(isStaffRoute) {
  try { if (isStaffRoute && isStandalone()) localStorage.setItem(TEAM_INSTALL_KEY, "1"); } catch { /* stockage indisponible */ }
}

export function showTeamButton() {
  try { return isStandalone() && localStorage.getItem(TEAM_INSTALL_KEY) === "1"; } catch { return false; }
}

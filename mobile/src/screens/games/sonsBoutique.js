// ════════════════════════════════════════════════════════════════════
//  SONS DE LA BOUTIQUE (27/09) — page qui tourne, achat
// ════════════════════════════════════════════════════════════════════
// Sons SYNTHÉTISÉS pour le projet (assets/sons/, aucun droit tiers).
// ⚠️ expo-audio (~57.0.3, version d'Expo Go 57) est chargé À LA DEMANDE, dans
// un try/catch : si le module natif manquait ou différait, le jeu continue
// SANS son au lieu de planter (un module natif a déjà causé l'écran blanc :
// voir index.js). Le require reste STATIQUE (Metro doit l'embarquer).
// Réglage « Sons » des Paramètres (SettingsContext : sons).
const SONS = {
  page: require('../../../assets/sons/page.wav'),
  achat: require('../../../assets/sons/achat.wav'),
};
const VOLUME = { page: 0.55, achat: 0.7 };

let audio; // undefined : pas encore essayé ; null : indisponible
function moduleAudio() {
  if (audio === undefined) {
    try { audio = require('expo-audio'); } catch (e) { audio = null; }
  }
  return audio;
}

const lecteurs = {};
export function jouerSon(nom, actif = true) {
  if (!actif || !SONS[nom]) return;
  try {
    const A = moduleAudio();
    if (!A || typeof A.createAudioPlayer !== 'function') return;
    let p = lecteurs[nom];
    if (!p) { p = A.createAudioPlayer(SONS[nom]); p.volume = VOLUME[nom]; lecteurs[nom] = p; }
    const r = p.seekTo(0);
    if (r && typeof r.catch === 'function') r.catch(() => {});
    p.play();
  } catch (e) {
    // Jamais bloquant : un son raté ne doit rien casser.
  }
}

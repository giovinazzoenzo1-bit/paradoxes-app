// ════════════════════════════════════════════════════════════════════
//  SONS DE LA BOUTIQUE (27/09) — page qui tourne, achat
// ════════════════════════════════════════════════════════════════════
// Sons SYNTHÉTISÉS pour le projet (assets/sons/, aucun droit tiers).
// ⚠️⚠️ VÉRIFIER LE MODULE NATIF AVANT DE CHARGER expo-audio (rapport du 02/10 :
// plantage FATAL « Cannot find native module 'ExpoAudio' » sur l'appli construite
// app.paradox.mobile, Android, construite AVANT l'ajout du son). expo-audio
// appelle requireNativeModule('ExpoAudio') dès son chargement ; et un module
// chargé À LA DEMANDE passe par guardedLoadModule de Metro, qui déclare toute
// erreur FATALE (reportFatalError) — un try/catch autour du require ne la voit
// JAMAIS (vérifié dans metro-runtime 0.84.5). Donc : requireOptionalNativeModule
// (renvoie null, ne lève pas) et expo-audio chargé SEULEMENT si le module natif
// existe. Contrôle : auditModulesNatifsProteges. Le require reste statique
// (Metro doit l'embarquer).
// Réglage « Sons » des Paramètres (SettingsContext : sons).
import { requireOptionalNativeModule } from 'expo-modules-core';

const SONS = {
  page: require('../../../assets/sons/page.wav'),
  achat: require('../../../assets/sons/achat.wav'),
};
const VOLUME = { page: 0.55, achat: 0.7 };

let audio; // undefined : pas encore essayé ; null : indisponible
function moduleAudio() {
  if (audio === undefined) {
    let natif = null;
    try { natif = requireOptionalNativeModule('ExpoAudio'); } catch (e) { natif = null; }
    audio = natif ? require('expo-audio') : null;
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

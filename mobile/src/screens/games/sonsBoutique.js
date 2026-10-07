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

// 07/10 : les 29 sons d'ElevenLabs « Sound Effects » (plan Starter : licence commerciale à
// vie), traités : silences coupés, volume perçu harmonisé, micro-fondus, MP3 mono 96 kb/s
// (350 Ko en tout). « page » et « achat » remplacent les 2 sons synthétisés du 27/09.
const SONS = {
  'impact-normal': require('../../../assets/sons/impact-normal.mp3'),
  'impact-parfait': require('../../../assets/sons/impact-parfait.mp3'),
  'rate': require('../../../assets/sons/rate.mp3'),
  'jauge-parfait': require('../../../assets/sons/jauge-parfait.mp3'),
  'sort-soin': require('../../../assets/sons/sort-soin.mp3'),
  'sort-bouclier': require('../../../assets/sons/sort-bouclier.mp3'),
  'sort-attaque': require('../../../assets/sons/sort-attaque.mp3'),
  'special': require('../../../assets/sons/special.mp3'),
  'ko': require('../../../assets/sons/ko.mp3'),
  'victoire': require('../../../assets/sons/victoire.mp3'),
  'defaite': require('../../../assets/sons/defaite.mp3'),
  'etoile': require('../../../assets/sons/etoile.mp3'),
  'feu': require('../../../assets/sons/feu.mp3'),
  'eau': require('../../../assets/sons/eau.mp3'),
  'terre': require('../../../assets/sons/terre.mp3'),
  'air': require('../../../assets/sons/air.mp3'),
  'foudre': require('../../../assets/sons/foudre.mp3'),
  'lumiere': require('../../../assets/sons/lumiere.mp3'),
  'tenebres': require('../../../assets/sons/tenebres.mp3'),
  'magie': require('../../../assets/sons/magie.mp3'),
  'bouton': require('../../../assets/sons/bouton.mp3'),
  'fenetre': require('../../../assets/sons/fenetre.mp3'),
  'page': require('../../../assets/sons/page.mp3'),
  'achat': require('../../../assets/sons/achat.mp3'),
  'recompense': require('../../../assets/sons/recompense.mp3'),
  'niveau': require('../../../assets/sons/niveau.mp3'),
  'evolution': require('../../../assets/sons/evolution.mp3'),
  'eclosion': require('../../../assets/sons/eclosion.mp3'),
  'refus': require('../../../assets/sons/refus.mp3'),
};
const VOLUME_DEFAUT = 0.8;
const VOLUME = {
  page: 0.6, achat: 0.75, bouton: 0.5, fenetre: 0.55, refus: 0.6, rate: 0.6, 'jauge-parfait': 0.75, etoile: 0.7,
  feu: 0.6, eau: 0.6, terre: 0.6, air: 0.6, foudre: 0.6, lumiere: 0.6, tenebres: 0.6, magie: 0.6, // sous le choc
};
// Le son de l'élément d'un attaquant (joué à l'impact, PAR-DESSUS le choc).
export const SON_ELEMENT = { Feu: 'feu', Eau: 'eau', Terre: 'terre', Air: 'air', Foudre: 'foudre', 'Lumière': 'lumiere', 'Ténèbres': 'tenebres', Magie: 'magie' };

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
    if (!p) { p = A.createAudioPlayer(SONS[nom]); p.volume = VOLUME[nom] != null ? VOLUME[nom] : VOLUME_DEFAUT; lecteurs[nom] = p; }
    const r = p.seekTo(0);
    if (r && typeof r.catch === 'function') r.catch(() => {});
    p.play();
  } catch (e) {
    // Jamais bloquant : un son raté ne doit rien casser.
  }
}

// Un son qui ne peut pas revenir avant `intervalleMs` (ex. le coup critique de l'œuf, avec
// l'autoclicker à 6,7 touchers par seconde).
const derniereFois = {};
export function jouerSonLimite(nom, actif = true, intervalleMs = 1500) {
  const t = Date.now();
  if (derniereFois[nom] && t - derniereFois[nom] < intervalleMs) return;
  derniereFois[nom] = t;
  jouerSon(nom, actif);
}

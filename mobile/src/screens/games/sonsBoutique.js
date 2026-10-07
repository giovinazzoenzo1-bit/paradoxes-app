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
  // Lot 4 (07/10) : boss et Gardien, cris des créatures, Ascension, runes, spécial prêt, élixir, énergie, coup critique.
  'ascension': require('../../../assets/sons/ascension.mp3'),
  'boss-apparition': require('../../../assets/sons/boss-apparition.mp3'),
  'boss-vaincu': require('../../../assets/sons/boss-vaincu.mp3'),
  'creature-feu': require('../../../assets/sons/creature-feu.mp3'),
  'creature-eau': require('../../../assets/sons/creature-eau.mp3'),
  'creature-terre': require('../../../assets/sons/creature-terre.mp3'),
  'creature-air': require('../../../assets/sons/creature-air.mp3'),
  'creature-foudre': require('../../../assets/sons/creature-foudre.mp3'),
  'creature-lumiere': require('../../../assets/sons/creature-lumiere.mp3'),
  'creature-tenebres': require('../../../assets/sons/creature-tenebres.mp3'),
  'creature-magie': require('../../../assets/sons/creature-magie.mp3'),
  'crit': require('../../../assets/sons/crit.mp3'),
  'elixir': require('../../../assets/sons/elixir.mp3'),
  'energie': require('../../../assets/sons/energie.mp3'),
  'rune-fusion': require('../../../assets/sons/rune-fusion.mp3'),
  'rune-tirage': require('../../../assets/sons/rune-tirage.mp3'),
  'special-pret': require('../../../assets/sons/special-pret.mp3'),
  // Lot 5 (07/10) : étoile dorée, bulle au gland doré, défi validé, hors ligne, vidéo, rune équipée, offrande, coup sur le Boss, retour.
  'etoile-doree-apparition': require('../../../assets/sons/etoile-doree-apparition.mp3'),
  'etoile-doree-recolte': require('../../../assets/sons/etoile-doree-recolte.mp3'),
  'bulle-apparition': require('../../../assets/sons/bulle-apparition.mp3'),
  'bulle-eclatee': require('../../../assets/sons/bulle-eclatee.mp3'),
  'defi-valide': require('../../../assets/sons/defi-valide.mp3'),
  'hors-ligne': require('../../../assets/sons/hors-ligne.mp3'),
  'video-acceleration': require('../../../assets/sons/video-acceleration.mp3'),
  'rune-equipee': require('../../../assets/sons/rune-equipee.mp3'),
  'offrande': require('../../../assets/sons/offrande.mp3'),
  'boss-coup': require('../../../assets/sons/boss-coup.mp3'),
  'retour': require('../../../assets/sons/retour.mp3'),
};
const VOLUME_DEFAUT = 0.8;
const VOLUME = {
  page: 0.6, achat: 0.75, bouton: 0.5, fenetre: 0.55, refus: 0.6, rate: 0.6, 'jauge-parfait': 0.75, etoile: 0.7,
  feu: 0.6, eau: 0.6, terre: 0.6, air: 0.6, foudre: 0.6, lumiere: 0.6, tenebres: 0.6, magie: 0.6, // sous le choc
  crit: 0.35, // discret : il peut revenir souvent (bridé par jouerSonLimite)
  'creature-feu': 0.7, 'creature-eau': 0.7, 'creature-terre': 0.7, 'creature-air': 0.7, 'creature-foudre': 0.7, 'creature-lumiere': 0.7, 'creature-tenebres': 0.7, 'creature-magie': 0.7,
  ascension: 0.9, 'boss-apparition': 0.85,
  'boss-coup': 0.45, retour: 0.5, // fréquents ou d'interface : plus discrets
};
// Le cri d'une créature selon son élément (toucher sur le deck, ouverture de sa fiche).
export const SON_CREATURE = { Feu: 'creature-feu', Eau: 'creature-eau', Terre: 'creature-terre', Air: 'creature-air', Foudre: 'creature-foudre', 'Lumière': 'creature-lumiere', 'Ténèbres': 'creature-tenebres', Magie: 'creature-magie' };
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

// Le même accès PROTÉGÉ, pour la musique (musique.js) — 07/10.
export function audioDisponible() { return moduleAudio(); }

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

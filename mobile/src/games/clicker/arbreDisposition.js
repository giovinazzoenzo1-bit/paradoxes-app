// Extension .js explicite : exigée par Node (outils d'audit), acceptée par Metro.
import { UPGRADE_ITEMS, AUTOCLICKERS } from './clickerLogic.js';

// ════════════════════════════════════════════════════════════════════
//  DISPOSITION DE L'ARBRE DE LA BOUTIQUE — source UNIQUE (27/09)
// ════════════════════════════════════════════════════════════════════
// Lue par l'arbre (screens/games/ArbreBoutique.js) ET par le contrôle
// auditArbreSansChevauchement (tools/audit-quetes.js).
//
// 4e version, 8 DÉPARTS (validée par l'auteur) : deux longues échelles
// faisaient « deux cordes, pas un arbre ». L'arbre s'appuie sur la
// structure RÉELLE du jeu : en haut PUISSANCE DE TAP (le seul vrai
// enchaînement : Pacte + 10 améliorations, en tronc qui monte), CRITIQUES
// (Faveur → Dégâts critiques, avec leurs reliques en rameaux), FORCE DES
// CRÉATURES (reliques de tap) ; Griffes / Offrande sur les côtés ; en bas
// les auto-clics en 3 RACINES selon leur palier (champ `tier` des données),
// PASSIF (Sanctuaire → Veilleur → reliques de production), RELIQUES
// D'AUTO-CLICS. Les 20 reliques sont DANS l'arbre (verrouillées sans leur
// créature) ; le panneau Reliques séparé disparaît. Économie inchangée.
// Positions : recherche, la plus compacte sans AUCUNE collision.
//
// Recherche (27/09) : 0 collision, toile 2342 × 3590. Paramètres : {"R0": 270, "zx": 110, "pasTap": 150, "titre": 110, "titreCourt": 100, "titreBas": 190, "aCrit": -45, "rCrit": 330, "pasCrit": 250, "brinF": 60, "brinC": 35, "pasBrin": 260, "aForce": -135, "rForce": 330, "pasForce": 220, "rCote": 300, "aPassif": 150, "rPassif": 380, "pasPassif": 230, "eventail": 40, "rEventail": 360, "rAuto": 420, "pasAuto": 210, "aAuto": [118, 90, 62], "aRelAuto": 30, "rRelAuto": 400, "pasRelAuto": 210, "titreCritDx": 200, "titreCritDy": 40, "evCentre": 180}

export const TOILE_L = 2342;
export const TOILE_H = 3590;
// Dézoom « à fond » : l'arbre entier tient dans l'écran.
export const ZOOM_MIN = 0.16; // l'arbre remplit juste la largeur (390 / 2342 ≈ 0,167)
export const ZOOM_MAX = 3;       // « encore plus zoomer » (retour de l'auteur)
export const ZOOM_DEPART = 0.55; // à l'ouverture : le cœur de l'arbre visible
// Zoom où les textes sont à leur taille de base ; en dessous ils grossissent
// (compensation) jusqu'à ZOOM_COMPENSATION_MIN, puis tout rétrécit ensemble
// (vue d'ensemble) — aucun nouveau chevauchement possible.
export const ZOOM_TEXTE_REF = 0.78;
export const ZOOM_COMPENSATION_MIN = 0.6;

// Étiquettes : nom (1-2 lignes) + ligne de GAIN + pastille de prix.
export const ETIQUETTE = { largeur: 160, police: 12.5, interligne: 15, gainPolice: 10.5, gainInterligne: 13, pastilleH: 26, marge: 4, titrePolice: 17 };
export const COMPENSATION_MAX = 1.8;

// Familles lues dans les DONNÉES du jeu (source unique pour l'arbre ET
// l'audit) : reliques par type d'effet (ordre des données), auto-clics par
// palier (triés par prix de base — dans un palier, c'est aussi l'ordre des
// prix réels).
export const FAMILLES_RELIQUES = ['tapFlat', 'critChancePct', 'critMultPct', 'coinPct', 'autoClickerPct'];
export function reliquesParFamille() {
  const r = {};
  FAMILLES_RELIQUES.forEach((f) => { r[f] = UPGRADE_ITEMS.filter((i) => i.effect && i.effect.type === f); });
  return r;
}
export const PALIERS_AUTO = [1, 2, 3];
export function autoClicsParPalier() {
  const r = {};
  PALIERS_AUTO.forEach((t) => { r[t] = AUTOCLICKERS.filter((c) => c.tier === t).sort((a, b) => a.baseCost - b.baseCost); });
  return r;
}

export const CENTRE = { x: 1078, y: 2030 };
export const POS = {
  griffes: [778, 2030],
  offrande: [1378, 2030],
  pacte: [1078, 1760],
  faveur: [1312, 1797],
  critDamage: [1488, 1620],
  sanctuaire: [749, 2220],
  veilleur: [550, 2335],
};
// Tronc « Puissance de tap » : l'amélioration i (ordre de TAP_UPGRADES).
export const CHAINE_TAP = [[968, 1610], [1188, 1460], [968, 1310], [1188, 1160], [968, 1010], [1188, 860], [968, 710], [1188, 560], [968, 410], [1188, 260]];
// Reliques par famille (la relique i de reliquesParFamille()[famille]).
export const RELIQUES_POS = {
  tapFlat: [[845, 1797], [689, 1641], [534, 1486], [378, 1330]],
  critChancePct: [[1563, 1864], [1814, 1931], [2065, 1999]],
  critMultPct: [[1534, 1364], [1579, 1108], [1624, 852]],
  coinPct: [[487, 2690], [274, 2566], [190, 2335], [274, 2104], [487, 1980]],
  autoClickerPct: [[1425, 2230], [1607, 2335], [1788, 2440], [1970, 2545], [2152, 2650]],
};
// Racines d'auto-clics par palier (l'auto-clic i de autoClicsParPalier()[palier]).
export const RACINES_AUTO = {
  1: [[881, 2401], [783, 2586], [684, 2772], [585, 2957], [487, 3143]],
  2: [[1078, 2450], [1078, 2660], [1078, 2870], [1078, 3080], [1078, 3290]],
  3: [[1275, 2401], [1374, 2586], [1473, 2772], [1571, 2957], [1670, 3143]],
};
// Titres de branche, peints sur la carte.
export const TITRES = [
  { texte: "PUISSANCE DE TAP", x: 1078, y: 150 },
  { texte: "CRITIQUES", x: 1688, y: 1660 },
  { texte: "FORCE DES CRÉATURES", x: 378, y: 1220 },
  { texte: "PASSIF", x: 550, y: 2880 },
  { texte: "AUTO-CLICS", x: 1078, y: 2350 },
  { texte: "RELIQUES D'AUTO-CLICS", x: 2152, y: 2840 },
];

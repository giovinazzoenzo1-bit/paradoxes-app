// ════════════════════════════════════════════════════════════════════
//  DISPOSITION DE L'ARBRE DE LA BOUTIQUE — source UNIQUE (27/09)
// ════════════════════════════════════════════════════════════════════
// Lue par l'arbre (screens/games/ArbreBoutique.js) ET par le contrôle
// auditArbreSansChevauchement (tools/audit-quetes.js). Aucune dépendance à
// l'affichage : lisible par les outils.
//
// 2e version, LOGIQUE (retour de l'auteur, 27/09) : chaque branche = un thème
// et une dépendance réelle du jeu.
// - Ramure : Pacte → « PUISSANCE DE TAP » (les 10 améliorations en UNE chaîne :
//   chacune s'ouvre au niveau 5 de la précédente — tapUpgradeUnlocked) ; et
//   « CRITIQUES » : Faveur des Esprits (chance) → Dégâts critiques (force).
// - Racines : « AUTO-CLICS » (les 15 en une chaîne, par prix) ; « PASSIF » :
//   Sanctuaire → Veilleur ; Reliques à gauche. Griffes / Offrande de part et
//   d'autre de l'Ascension.
// Écartements trouvés par recherche : la plus compacte sans AUCUNE collision
// (nœuds, noms, gains, prix, titres) au zoom de référence comme dézoomé.

export const TOILE_L = 1220;
export const TOILE_H = 4215;
export const ZOOM_MIN = 0.5;     // vue d'ensemble
export const ZOOM_MAX = 3;       // « encore plus zoomer » (retour de l'auteur)
// À l'ouverture : tout le cœur de l'arbre visible — vérifié au banc.
export const ZOOM_DEPART = 0.6;
// Zoom où les textes sont à leur taille de base ; en dessous ils grossissent
// (compensation) pour rester lisibles. SÉPARÉ du zoom d'ouverture : baisser
// l'ouverture ne doit pas rapetisser les textes.
export const ZOOM_TEXTE_REF = 0.78;

// Étiquettes : nom (1-2 lignes) + ligne de GAIN + pastille de prix ; textes
// compensés au zoom, de ×1 (à ZOOM_TEXTE_REF et au-delà) à
// ×ZOOM_TEXTE_REF / ZOOM_MIN (dézoomé au maximum).
export const ETIQUETTE = { largeur: 160, police: 12.5, interligne: 15, gainPolice: 10.5, gainInterligne: 13, pastilleH: 26, marge: 4, titrePolice: 17 };
export const COMPENSATION_MAX = 1.8;

export const CENTRE = { x: 590, y: 1855 };
export const POS = {
  griffes: [330, 1825],
  offrande: [850, 1825],
  reliques: [170, 2155],
  pacte: [590, 1555],
  faveur: [810, 1355],
  critDamage: [990, 1175],
  sanctuaire: [1010, 2155],
  veilleur: [1050, 2385],
};
// Chaîne « Puissance de tap » : l'amélioration i (ordre de TAP_UPGRADES).
export const CHAINE_TAP = [
  [440, 1365],
  [190, 1240],
  [440, 1115],
  [190, 990],
  [440, 865],
  [190, 740],
  [440, 615],
  [190, 490],
  [440, 365],
  [190, 240],
];
// Chaîne « Auto-clics » : l'auto-clic i (triés par prix de base).
export const CHAINE_AUTO = [
  [465, 2185],
  [715, 2310],
  [465, 2435],
  [715, 2560],
  [465, 2685],
  [715, 2810],
  [465, 2935],
  [715, 3060],
  [465, 3185],
  [715, 3310],
  [465, 3435],
  [715, 3560],
  [465, 3685],
  [715, 3810],
  [465, 3935],
];
// Titres de branche, peints sur la carte.
export const TITRES = [
  { texte: 'PUISSANCE DE TAP', x: 315, y: 130 },
  { texte: 'CRITIQUES', x: 900, y: 1065 },
  { texte: 'AUTO-CLICS', x: 590, y: 2075 },
  { texte: 'PASSIF', x: 1030, y: 2045 },
];

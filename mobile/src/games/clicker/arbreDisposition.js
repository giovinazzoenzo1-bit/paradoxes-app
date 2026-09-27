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
//
// 3e version, COURONNES (27/09) : l'auteur préférait son image de référence
// (éléments en arcs autour de l'Ascension) aux longues chaînes. Même logique
// de déblocage (chaque élément relié à son précédent), mais la chaîne
// SERPENTE de couronne en couronne : en haut 3 / 5 / 5 (Poigne, PACTE au
// sommet, Faveur ; Gantelet … Dégâts critiques au bout, dans le prolongement
// de Faveur ; puis les 5 dernières), en bas des couronnes qui s'élargissent
// (4 / 5 / 6 auto-clics). Rayons calculés pour l'espace des étiquettes ;
// recherche : la plus compacte sans collision (1712 × 2401, contre 4215 de haut).

export const TOILE_L = 1712;
export const TOILE_H = 2401;
// Dézoom « à fond » (demande de l'auteur) : l'arbre entier tient dans l'écran
// (390 / 1712 ≈ 0,23 en largeur ; marge pour un arbre plus large).
export const ZOOM_MIN = 0.18;
// La compensation des textes S'ARRÊTE ici : en dessous, tout rétrécit
// ensemble (vue d'ensemble) — aucun nouveau chevauchement possible, l'audit
// reste valable (il teste la compensation maximale, atteinte à ce zoom).
export const ZOOM_COMPENSATION_MIN = 0.5;
export const ZOOM_MAX = 3;       // « encore plus zoomer » (retour de l'auteur)
// À l'ouverture : tout le cœur de l'arbre visible — vérifié au banc.
export const ZOOM_DEPART = 0.6;
// Zoom où les textes sont à leur taille de base ; en dessous ils grossissent
// (compensation) pour rester lisibles. SÉPARÉ du zoom d'ouverture : baisser
// l'ouverture ne doit pas rapetisser les textes.
export const ZOOM_TEXTE_REF = 0.78;

// Étiquettes : nom (1-2 lignes) + ligne de GAIN + pastille de prix ; textes
// compensés au zoom, de ×1 (à ZOOM_TEXTE_REF et au-delà) à
// ×ZOOM_TEXTE_REF / ZOOM_COMPENSATION_MIN (plafond de la compensation).
export const ETIQUETTE = { largeur: 160, police: 12.5, interligne: 15, gainPolice: 10.5, gainInterligne: 13, pastilleH: 26, marge: 4, titrePolice: 17 };
export const COMPENSATION_MAX = 1.8;

export const CENTRE = { x: 856, y: 1168 };
export const POS = {
  griffes: [556, 1168],
  offrande: [1156, 1168],
  reliques: [296, 1208],
  pacte: [856, 824],
  faveur: [1099, 924],
  critDamage: [1342, 681],
  sanctuaire: [1416, 1208],
  veilleur: [1416, 1428],
};
// Chaîne « Puissance de tap » : l'amélioration i (ordre de TAP_UPGRADES).
export const CHAINE_TAP = [
  [613, 924],
  [370, 681],
  [593, 532],
  [856, 480],
  [1119, 532],
  [1497, 526],
  [1203, 329],
  [856, 260],
  [508, 329],
  [214, 526],
];
// Chaîne « Auto-clics » : l'auto-clic i (triés par prix de base).
export const CHAINE_AUTO = [
  [491, 1532],
  [722, 1666],
  [989, 1666],
  [1220, 1532],
  [1376, 1688],
  [1137, 1847],
  [856, 1903],
  [574, 1847],
  [336, 1688],
  [180, 1843],
  [422, 2019],
  [706, 2111],
  [1005, 2111],
  [1290, 2019],
  [1532, 1843],
];
// Titres de branche, peints sur la carte.
export const TITRES = [
  { texte: 'DÉGÂTS DES TAPS', x: 856, y: 150 },
  { texte: 'AUTO-CLICS', x: 856, y: 1588 },
  { texte: 'PASSIF', x: 1416, y: 1108 },
];

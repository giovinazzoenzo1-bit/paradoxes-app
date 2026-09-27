// ════════════════════════════════════════════════════════════════════
//  DISPOSITION DE L'ARBRE DE LA BOUTIQUE — source UNIQUE (27/09)
// ════════════════════════════════════════════════════════════════════
// Lue par l'arbre (screens/games/ArbreBoutique.js) ET par le contrôle
// auditArbreSansChevauchement (tools/audit-quetes.js). Aucune dépendance à
// l'affichage : lisible par les outils.
//
// Retour de l'auteur : « attention au chevauchement, éloigne les items ».
// MESURÉ : l'ancienne disposition avait 28 collisions au zoom d'ouverture et
// 41 dézoomée. Celle-ci = l'ancienne écartée de ×1,4 en largeur et ×2,05 en
// hauteur (plus petite hauteur sans collision, recherche exhaustive), Griffes
// et Offrande ramenées à ±200 du centre (visibles à l'ouverture) : 0 collision
// au zoom d'ouverture comme dézoomé au maximum, noms réels, tout visible.

export const TOILE_L = 1056;
export const TOILE_H = 3287;
export const ZOOM_MIN = 0.5;     // vue d'ensemble
export const ZOOM_MAX = 1.7;
// À l'ouverture : tout le cœur de l'arbre visible (Pacte, Faveur, Dégâts
// critiques, Griffes, Offrande, Reliques, Sanctuaire, Veilleur) — vérifié au banc.
export const ZOOM_DEPART = 0.6;
// Zoom où les textes sont à leur taille de base ; en dessous ils grossissent
// (compensation) pour rester lisibles. SÉPARÉ du zoom d'ouverture : baisser
// l'ouverture ne doit pas rapetisser les textes.
export const ZOOM_TEXTE_REF = 0.78;

// Étiquettes (nom + prix) : textes compensés au zoom, de ×1 (à ZOOM_TEXTE_REF
// et au-delà) à ×ZOOM_TEXTE_REF / ZOOM_MIN (dézoomé au maximum).
export const ETIQUETTE = { largeur: 160, police: 12.5, interligne: 15, pastilleH: 26, marge: 4 };
export const COMPENSATION_MAX = 1.8;

export const CENTRE = { x: 528, y: 1551 };
export const POS = {
  griffes: [328, 1571],
  offrande: [728, 1571],
  reliques: [528, 1910],
  pacte: [528, 1186],
  faveur: [374, 1049],
  critDamage: [682, 1049],
  sanctuaire: [343, 1992],
  veilleur: [713, 1992],
};
// Chaînes : l'élément i va sur la chaîne i % n, à la profondeur ⌊i / n⌋ —
// plus c'est loin du tronc, plus c'est cher.
export const CHAINES_TAP = [
  [[304, 854], [223, 670], [167, 485], [150, 301], [198, 120]],
  [[752, 854], [833, 670], [889, 485], [906, 301], [858, 120]],
];
export const CHAINES_AUTO = [
  [[528, 2187], [528, 2391], [528, 2597], [528, 2801], [528, 3007]],
  [[321, 2219], [251, 2424], [200, 2629], [172, 2834], [164, 3027]],
  [[735, 2219], [805, 2424], [856, 2629], [884, 2834], [892, 3027]],
];

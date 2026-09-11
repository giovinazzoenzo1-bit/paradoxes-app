// Thèmes visuels par ÉLÉMENT de créature (11/09).
//
// Chaque élément peut habiller l'écran de profil : fond, cadre de
// panneau, emplacement de rune, bouton. Un élément sans thème retombe
// automatiquement sur l'apparence actuelle (panneaux unis) — les 7
// éléments non encore illustrés continuent donc de s'afficher
// normalement, rien ne casse.
//
// Les `require` sont écrits EN DUR : Metro résout les chemins à la
// compilation, un chemin construit à l'exécution échoue en silence.
// (Même contrainte que pour CreatureArt.js.)
//
// ⚠️ Seuls le FOND change vraiment d'un élément à l'autre. Le cadre,
// le bouton et l'emplacement de rune sont en pierre neutre et peuvent
// être PARTAGÉS par tous les éléments : ça évite de générer 8 jeux
// complets alors qu'un seul suffit visuellement.
const NEUTRAL = {
  panelFrame: require('../../../assets/themes/feu/panel-frame.png'),
  runeSlot: require('../../../assets/themes/feu/rune-slot.png'),
  button: require('../../../assets/themes/feu/button.png'),
};

const THEMES = {
  Feu: {
    background: require('../../../assets/themes/feu/bg.jpg'),
    ...NEUTRAL,
  },
};

export function elementTheme(element) {
  return THEMES[element] || null;
}

export function hasElementTheme(element) {
  return !!THEMES[element];
}

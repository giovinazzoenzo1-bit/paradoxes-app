// Cadres de carte de créature, un par ÉLÉMENT (12/09).
//
// `require` écrits EN DUR : Metro résout les chemins à la compilation,
// un chemin construit à l'exécution échoue en silence (même contrainte
// que CreatureArt.js et elementThemes.js).
//
// Un élément sans cadre retombe sur `null` et l'écran garde sa carte
// unie : rien ne casse tant que la série est incomplète.
//
// Bordure MESURÉE sur l'image : 13% en largeur, 10% en hauteur. C'est ce
// qui dicte les marges du contenu posé dedans — voir THEME_FRAMES.md
// pour le principe (contenu d'abord, cadre autour).
export const CARD_FRAME_BORDER_X = 0.13;
export const CARD_FRAME_BORDER_Y = 0.10;

const FRAMES = {
  Feu: require('../../../assets/adventure/frames/feu.png'),
  Eau: require('../../../assets/adventure/frames/eau.png'),
  Air: require('../../../assets/adventure/frames/air.png'),
  Terre: require('../../../assets/adventure/frames/terre.png'),
  Foudre: require('../../../assets/adventure/frames/foudre.png'),
  'Lumière': require('../../../assets/adventure/frames/lumiere.png'),
  Magie: require('../../../assets/adventure/frames/magie.png'),
  'Ténèbres': require('../../../assets/adventure/frames/tenebres.png'),
};

export function cardFrameForElement(element) {
  return FRAMES[element] || null;
}

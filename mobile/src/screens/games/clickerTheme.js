// Palette partagée entre ClickerScreen et AdventureScreen (et tout futur
// écran du même jeu). Fichier séparé pour éviter tout import circulaire
// entre écrans qui ont besoin les uns des autres. Style "Juicy" : fond
// très sombre et profond (bleu abysse) pour que les éléments d'action en
// néon ressortent instantanément et guident l'œil.
export const COLORS = {
  bg: '#07051a',
  panel: '#171331',
  panelLight: '#221c47',
  border: '#332c5e',
  text: '#f5f3ff',
  muted: '#9088b8',
  action: '#f5c542',
  good: '#00ffa3',
  neonPink: '#ff2d95',
  neonCyan: '#00e5ff',
};

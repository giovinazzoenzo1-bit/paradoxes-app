// Palette partagée entre ClickerScreen, AdventureScreen, CombatScreen,
// DeckPicker et ProgresScreen. Fichier séparé pour éviter tout import
// circulaire entre écrans qui ont besoin les uns des autres.
//
// Style repris de la maquette fournie (03/09) : bleu nuit profond,
// panneaux bleu acier, contours cyan lumineux, accent doré. Le doré
// reste la couleur d'ACTION (pièces, boutons, œuf) — le cyan structure
// (bordures, cadres, libellés secondaires).
//
// Modifier ce fichier repeint les 5 écrans d'un coup : c'est
// exactement pourquoi la palette est centralisée ici plutôt que
// dupliquée écran par écran.
export const COLORS = {
  bg: '#08131f',          // bleu nuit très profond (fond d'écran)
  panel: '#0e2337',       // panneaux
  panelLight: '#153048',  // panneaux en surbrillance
  border: '#2a6f96',      // contours cyan sombre
  text: '#eaf6ff',        // texte principal, blanc bleuté
  muted: '#8fb4cc',       // texte secondaire
  action: '#f6c343',      // accent doré (inchangé : couleur d'action)
  good: '#00ffa3',
  neonPink: '#ff2d95',
  neonCyan: '#5bc8f0',    // cyan lumineux des contours de la maquette
};

// Dégradé de fond, du plus clair en haut au plus sombre en bas — repris
// de la maquette. Utilisé par les écrans qui posent un LinearGradient
// plein écran.
export const BG_GRADIENT = ['#12314d', '#0b1e30', '#08131f'];

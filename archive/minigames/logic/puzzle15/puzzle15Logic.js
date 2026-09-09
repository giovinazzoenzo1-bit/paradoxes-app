// Logique pure du Puzzle 15 (taquin) — port fidèle depuis index.html (PWA),
// fonctions p15New (mélange par mouvements valides) / p15Neighbors /
// p15GradientColor / p15Tap (déplacement simple, tuile adjacente
// uniquement — le PWA ne fait PAS de glissement en bloc multi-tuiles
// malgré la mention dans le cahier des charges ; le PWA fait foi). Aucune
// dépendance UI.

export function neighbors(idx, n) {
  const r = Math.floor(idx / n);
  const c = idx % n;
  const nb = [];
  if (r > 0) nb.push(idx - n);
  if (r < n - 1) nb.push(idx + n);
  if (c > 0) nb.push(idx - 1);
  if (c < n - 1) nb.push(idx + 1);
  return nb;
}

// Génère une grille mélangée mais garantie résoluble : part de l'état
// résolu et applique une longue séquence de mouvements valides.
export function generateTiles(n) {
  const total = n * n;
  const tiles = Array.from({ length: total - 1 }, (_, i) => i + 1);
  tiles.push(0);
  let emptyIdx = total - 1;
  const shuffleMoves = Math.max(200, total * 30);
  for (let i = 0; i < shuffleMoves; i++) {
    const nb = neighbors(emptyIdx, n);
    const swapIdx = nb[Math.floor(Math.random() * nb.length)];
    [tiles[emptyIdx], tiles[swapIdx]] = [tiles[swapIdx], tiles[emptyIdx]];
    emptyIdx = swapIdx;
  }
  return tiles;
}

// Dégradé #0ebeff -> #ff42b3 selon le numéro de la tuile
export function gradientColor(value, maxValue) {
  const c1 = [0x0e, 0xbe, 0xff];
  const c2 = [0xff, 0x42, 0xb3];
  const t = maxValue > 1 ? (value - 1) / (maxValue - 1) : 0;
  const rgb = c1.map((c, i) => Math.round(c + (c2[i] - c) * t));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// Tente de déplacer la tuile à l'index i vers la case vide, si adjacente.
// Retourne { tiles, moved } — ne mute pas le tableau d'entrée.
export function tap(tiles, i, n) {
  const emptyIdx = tiles.indexOf(0);
  if (!neighbors(emptyIdx, n).includes(i)) return { tiles, moved: false };
  const newTiles = [...tiles];
  [newTiles[emptyIdx], newTiles[i]] = [newTiles[i], newTiles[emptyIdx]];
  return { tiles: newTiles, moved: true };
}

export function isSolved(tiles, n) {
  const total = n * n;
  return tiles.slice(0, total - 1).every((v, idx) => v === idx + 1) && tiles[total - 1] === 0;
}

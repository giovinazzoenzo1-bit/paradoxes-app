// Logique pure du 2048 — port fidèle depuis index.html (PWA), fonctions
// g2048SlideRow / g2048Move / g2048AddTile / g2048CanMove. Aucune dépendance
// UI. La grille est un tableau 4x4 de nombres (0 = case vide).

export const SIZE = 4;

export function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

// Ajoute une tuile (90% de 2, 10% de 4) sur une case vide aléatoire.
// Mute le tableau passé (comme le PWA) et le retourne pour confort d'usage.
export function addTile(grid) {
  const empty = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return grid;
}

// Tasse et fusionne une ligne vers la gauche. Retourne {row, scoreGained}.
function slideRow(row) {
  let arr = row.filter((v) => v !== 0);
  let scoreGained = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      scoreGained += arr[i];
      arr.splice(i + 1, 1);
    }
  }
  while (arr.length < SIZE) arr.push(0);
  return { row: arr, scoreGained };
}

// Applique un mouvement ('left'|'right'|'up'|'down') sur la grille.
// Retourne { grid, scoreGained, moved } — ne mute PAS la grille d'entrée.
export function move(grid, dir) {
  let newGrid = cloneGrid(grid);
  let scoreGained = 0;

  if (dir === 'left') {
    newGrid = newGrid.map((row) => {
      const { row: r, scoreGained: s } = slideRow(row);
      scoreGained += s;
      return r;
    });
  } else if (dir === 'right') {
    newGrid = newGrid.map((row) => {
      const { row: r, scoreGained: s } = slideRow([...row].reverse());
      scoreGained += s;
      return r.reverse();
    });
  } else if (dir === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const col = [0, 1, 2, 3].map((r) => newGrid[r][c]);
      const { row: newCol, scoreGained: s } = slideRow(col);
      scoreGained += s;
      for (let r = 0; r < SIZE; r++) newGrid[r][c] = newCol[r];
    }
  } else if (dir === 'down') {
    for (let c = 0; c < SIZE; c++) {
      const col = [3, 2, 1, 0].map((r) => newGrid[r][c]);
      const { row: newCol, scoreGained: s } = slideRow(col);
      scoreGained += s;
      for (let r = 0; r < SIZE; r++) newGrid[3 - r][c] = newCol[r];
    }
  }

  const moved = JSON.stringify(newGrid) !== JSON.stringify(grid);
  return { grid: newGrid, scoreGained, moved };
}

export function canMove(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

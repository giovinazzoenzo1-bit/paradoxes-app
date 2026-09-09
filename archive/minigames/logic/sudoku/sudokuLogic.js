// Logique pure du Sudoku — port fidèle depuis index.html (PWA) : génération
// d'une grille résolue par backtracking, retrait de cases avec vérification
// de solution unique (comptage de solutions avec limite), détection des
// conflits ligne/colonne/bloc. Aucune dépendance UI.

export const DIFFICULTIES = { facile: 40, moyen: 32, difficile: 26 };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function boxIndex(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

export function generateSolved() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  const rowsMask = Array(9).fill(0);
  const colsMask = Array(9).fill(0);
  const boxMask = Array(9).fill(0);

  function backtrack(pos) {
    if (pos === 81) return true;
    const r = Math.floor(pos / 9);
    const c = pos % 9;
    const b = boxIndex(r, c);
    const used = rowsMask[r] | colsMask[c] | boxMask[b];
    const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).filter((d) => !(used & (1 << d)));
    for (const d of candidates) {
      grid[r][c] = d;
      rowsMask[r] |= 1 << d;
      colsMask[c] |= 1 << d;
      boxMask[b] |= 1 << d;
      if (backtrack(pos + 1)) return true;
      grid[r][c] = 0;
      rowsMask[r] &= ~(1 << d);
      colsMask[c] &= ~(1 << d);
      boxMask[b] &= ~(1 << d);
    }
    return false;
  }
  backtrack(0);
  return grid;
}

// Compte les solutions (jusqu'à 'limit') via heuristique MRV (case la plus
// contrainte en premier) — nécessaire pour garantir une solution unique.
export function countSolutions(grid, limit) {
  const rowsMask = Array(9).fill(0);
  const colsMask = Array(9).fill(0);
  const boxMask = Array(9).fill(0);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = grid[r][c];
      if (v) {
        const b = boxIndex(r, c);
        rowsMask[r] |= 1 << v;
        colsMask[c] |= 1 << v;
        boxMask[b] |= 1 << v;
      }
    }
  }
  let count = 0;

  function findBestCell() {
    let best = null;
    let bestCount = 10;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const b = boxIndex(r, c);
          const used = rowsMask[r] | colsMask[c] | boxMask[b];
          let cnt = 0;
          for (let d = 1; d <= 9; d++) if (!(used & (1 << d))) cnt++;
          if (cnt < bestCount) {
            bestCount = cnt;
            best = { r, c, used };
            if (cnt === 0) return best;
          }
        }
      }
    }
    return best;
  }

  function backtrack() {
    const cell = findBestCell();
    if (!cell) {
      count++;
      return count >= limit;
    }
    const { r, c, used } = cell;
    const b = boxIndex(r, c);
    for (let d = 1; d <= 9; d++) {
      if (used & (1 << d)) continue;
      grid[r][c] = d;
      rowsMask[r] |= 1 << d;
      colsMask[c] |= 1 << d;
      boxMask[b] |= 1 << d;
      if (backtrack()) return true;
      grid[r][c] = 0;
      rowsMask[r] &= ~(1 << d);
      colsMask[c] &= ~(1 << d);
      boxMask[b] &= ~(1 << d);
    }
    return false;
  }
  backtrack();
  return count;
}

export function generatePuzzle(targetClues) {
  const solved = generateSolved();
  const puzzle = solved.map((row) => [...row]);
  const cells = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) cells.push([r, c]);
  const order = shuffle(cells);
  let clues = 81;
  for (const [r, c] of order) {
    if (clues <= targetClues) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    const gridCopy = puzzle.map((row) => [...row]);
    const solutions = countSolutions(gridCopy, 2);
    if (solutions === 1) {
      clues--;
    } else {
      puzzle[r][c] = backup;
    }
  }
  return { puzzle, solution: solved };
}

export function conflicts(grid) {
  const bad = Array.from({ length: 9 }, () => Array(9).fill(false));
  for (let r = 0; r < 9; r++) {
    const seen = {};
    for (let c = 0; c < 9; c++) {
      const v = grid[r][c];
      if (!v) continue;
      if (seen[v] !== undefined) {
        bad[r][c] = true;
        bad[r][seen[v]] = true;
      } else seen[v] = c;
    }
  }
  for (let c = 0; c < 9; c++) {
    const seen = {};
    for (let r = 0; r < 9; r++) {
      const v = grid[r][c];
      if (!v) continue;
      if (seen[v] !== undefined) {
        bad[r][c] = true;
        bad[seen[v]][c] = true;
      } else seen[v] = r;
    }
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = {};
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          const v = grid[r][c];
          if (!v) continue;
          if (seen[v] !== undefined) {
            const [pr, pc] = seen[v];
            bad[r][c] = true;
            bad[pr][pc] = true;
          } else seen[v] = [r, c];
        }
      }
    }
  }
  return bad;
}

export function checkCompletions(grid, r, c) {
  let completed = false;
  if (grid[r].every((v) => v !== 0)) completed = true;
  if (grid.every((row) => row[c] !== 0)) completed = true;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  let boxFull = true;
  for (let rr = br; rr < br + 3; rr++) for (let cc = bc; cc < bc + 3; cc++) if (grid[rr][cc] === 0) boxFull = false;
  if (boxFull) completed = true;
  return completed;
}

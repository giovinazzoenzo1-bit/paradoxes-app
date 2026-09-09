// Logique pure du Puissance 4 — port fidèle depuis index.html (PWA),
// fonctions p4FindDropRow / p4ValidCols / p4CheckWinAt / p4FindWinningCol /
// p4MoveEnablesOpponentWin / p4BotPickCol. Aucune dépendance UI.

export const ROWS = 6;
export const COLS = 7;

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

export function findDropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

export function validCols(board) {
  const cols = [];
  for (let c = 0; c < COLS; c++) {
    if (findDropRow(board, c) !== -1) cols.push(c);
  }
  return cols;
}

export function checkWinAt(board, row, col, player) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (const [dr, dc] of directions) {
    let count = 1;
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
      count++;
      r -= dr;
      c -= dc;
    }
    if (count >= 4) return true;
  }
  return false;
}

function findWinningCol(board, player) {
  for (const c of validCols(board)) {
    const r = findDropRow(board, c);
    board[r][c] = player;
    const win = checkWinAt(board, r, c, player);
    board[r][c] = 0;
    if (win) return c;
  }
  return null;
}

function randomCol(board) {
  const cols = validCols(board);
  return cols[Math.floor(Math.random() * cols.length)];
}

function moveEnablesOpponentWin(board, col, opponent, botPlayer) {
  const r = findDropRow(board, col);
  if (r === -1) return false;
  board[r][col] = botPlayer;
  let enables = false;
  const rAbove = r - 1;
  if (rAbove >= 0 && board[rAbove][col] === 0) {
    board[rAbove][col] = opponent;
    if (checkWinAt(board, rAbove, col, opponent)) enables = true;
    board[rAbove][col] = 0;
  }
  board[r][col] = 0;
  return enables;
}

// Facile : 20% de colonnes aléatoires, sinon coup gagnant, sinon blocage,
// sinon colonne "sûre" au hasard (n'offre pas de victoire immédiate au coup
// suivant). Normal : coup gagnant, sinon blocage, sinon colonnes centrales
// (statistiquement les plus fortes) parmi les plus sûres.
export function botPickCol(board, difficulty) {
  const bot = 2;
  const human = 1;
  if (difficulty === 'facile') {
    if (Math.random() < 0.2) return randomCol(board);
    const w = findWinningCol(board, bot);
    if (w !== null) return w;
    const b = findWinningCol(board, human);
    if (b !== null) return b;
    const cols = validCols(board);
    const safeCols = cols.filter((c) => !moveEnablesOpponentWin(board, c, human, bot));
    const pool = safeCols.length > 0 ? safeCols : cols;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const w = findWinningCol(board, bot);
  if (w !== null) return w;
  const b = findWinningCol(board, human);
  if (b !== null) return b;
  const cols = validCols(board);
  const center = Math.floor(COLS / 2);
  cols.sort((a, b2) => Math.abs(a - center) - Math.abs(b2 - center));
  const safeCols = cols.filter((c) => !moveEnablesOpponentWin(board, c, human, bot));
  const pool = safeCols.length > 0 ? safeCols : cols;
  const topN = pool.slice(0, Math.min(3, pool.length));
  return topN[Math.floor(Math.random() * topN.length)];
}

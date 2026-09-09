// Logique pure du Morpion — port fidèle depuis index.html (PWA), fonctions
// morpionFindWinningMove / morpionCheckWinnerOnBoard / morpionMinimax /
// morpionMinimaxBestMove / morpionBotPickMove. Aucune dépendance UI ici,
// testable indépendamment de React Native.

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function findWinningMove(board, player) {
  for (const line of LINES) {
    const vals = line.map((idx) => board[idx]);
    const countP = vals.filter((v) => v === player).length;
    const countEmpty = vals.filter((v) => v === '').length;
    if (countP === 2 && countEmpty === 1) return line[vals.indexOf('')];
  }
  return null;
}

export function checkWinnerOnBoard(board, player) {
  return LINES.some((line) => line.every((idx) => board[idx] === player));
}

export function findWinLine(board, player) {
  return LINES.find((line) => line.every((idx) => board[idx] === player)) || null;
}

function minimax(board, playerToMove, bot, human, depth) {
  if (checkWinnerOnBoard(board, bot)) return 10 - depth;
  if (checkWinnerOnBoard(board, human)) return depth - 10;
  const emptyIdx = board.map((v, i) => (v === '' ? i : null)).filter((i) => i !== null);
  if (emptyIdx.length === 0) return 0;
  let best = playerToMove === bot ? -Infinity : Infinity;
  for (const i of emptyIdx) {
    board[i] = playerToMove;
    const score = minimax(board, playerToMove === bot ? human : bot, bot, human, depth + 1);
    board[i] = '';
    best = playerToMove === bot ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

function minimaxBestMove(board, bot, human) {
  const b = [...board];
  const emptyIdx = b.map((v, i) => (v === '' ? i : null)).filter((i) => i !== null);
  let bestScore = -Infinity;
  let bestMove = emptyIdx[0];
  for (const i of emptyIdx) {
    b[i] = bot;
    const score = minimax(b, human, bot, human, 0);
    b[i] = '';
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return bestMove;
}

// Facile : 50% aléatoire, sinon coup gagnant s'il existe (sinon aléatoire).
// Normal : coup gagnant s'il existe, sinon bloque le coup gagnant du joueur, sinon aléatoire.
// Expert (règle classique uniquement) : Minimax exhaustif, imbattable. En règle Anti-nul on
// retombe sur l'heuristique Normal (le plateau n'a pas d'état terminal "plein" stable).
export function botPickMove(board, difficulty, rule) {
  const empty = board.map((v, i) => (v === '' ? i : null)).filter((i) => i !== null);
  if (empty.length === 0) return null;
  const bot = 'O';
  const human = 'X';
  const randomMove = () => empty[Math.floor(Math.random() * empty.length)];

  if (difficulty === 'expert' && rule === 'classic') {
    return minimaxBestMove(board, bot, human);
  }
  if (difficulty === 'facile') {
    if (Math.random() < 0.5) return randomMove();
    const winMove = findWinningMove(board, bot);
    return winMove !== null ? winMove : randomMove();
  }
  const winMove = findWinningMove(board, bot);
  if (winMove !== null) return winMove;
  const blockMove = findWinningMove(board, human);
  if (blockMove !== null) return blockMove;
  return randomMove();
}

// Logique pure de Nuts and Bolts (tri par couleur) — port fidèle depuis
// index.html (PWA) : configuration progressive sur 50 niveaux, mélange
// vraiment aléatoire (pas par coups légaux, sinon les tiges restent
// mono-couleur — bug corrigé dans le PWA, à ne pas réintroduire),
// vérification de solvabilité par recherche best-first (min-heap +
// heuristique de segments), déplacement en paquet de même couleur. Aucune
// dépendance UI.

export const ALL_COLORS = ['#ef6461', '#f5b942', '#4fd1c5', '#5f9dc9', '#b85fc9', '#8fc95f', '#ff8fa3', '#e08a3c', '#a0522d'];
export const TOTAL_LEVELS = 50;
export const CAPACITY = 4;

export function configForLevel(level) {
  if (level <= 5) {
    const t = {
      1: { colors: 3, emptyRods: 2 },
      2: { colors: 4, emptyRods: 2 },
      3: { colors: 4, emptyRods: 1 },
      4: { colors: 5, emptyRods: 2 },
      5: { colors: 5, emptyRods: 1 },
    };
    return t[level];
  }
  const tiers = [
    { colors: 6, start: 6, end: 14 },
    { colors: 7, start: 15, end: 23 },
    { colors: 8, start: 24, end: 33 },
    { colors: 9, start: 34, end: 50 },
  ];
  const tier = tiers.find((t) => level >= t.start && level <= t.end);
  const span = tier.end - tier.start;
  const pos = level - tier.start;
  const emptyRods = pos < span / 3 ? 3 : pos < (span / 3) * 2 ? 2 : 1;
  return { colors: tier.colors, emptyRods };
}

export function timeThreshold(level, baseSeconds, growthPerLevel) {
  return Math.round(baseSeconds + level * growthPerLevel);
}

function randomShuffle(colors, emptyRods) {
  const stacks = colors.map((c) => Array(CAPACITY).fill(c));
  let allNuts = stacks.flat();
  for (let i = allNuts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allNuts[i], allNuts[j]] = [allNuts[j], allNuts[i]];
  }
  const rods = [];
  for (let i = 0; i < colors.length; i++) rods.push(allNuts.splice(0, CAPACITY));
  for (let i = 0; i < emptyRods; i++) rods.push([]);
  return rods;
}

export function isWon(state) {
  return state.every((rod) => rod.length === 0 || (rod.length === CAPACITY && rod.every((c) => c === rod[0])));
}

function heuristic(state) {
  let segments = 0;
  for (const rod of state) {
    let prev = null;
    for (const c of rod) {
      if (c !== prev) segments++;
      prev = c;
    }
  }
  return segments;
}

function heapPush(heap, item) {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p].h <= heap[i].h) break;
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let i = 0;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < heap.length && heap[l].h < heap[smallest].h) smallest = l;
      if (r < heap.length && heap[r].h < heap[smallest].h) smallest = r;
      if (smallest === i) break;
      [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
      i = smallest;
    }
  }
  return top;
}

function solveExists(startRods, nodeBudget) {
  if (isWon(startRods)) return true;
  const canon = (state) => state.map((r) => r.join(',')).sort().join('|');
  const visited = new Set([canon(startRods)]);
  const heap = [];
  heapPush(heap, { state: startRods, h: heuristic(startRods) });
  let explored = 0;
  while (heap.length) {
    const { state } = heapPop(heap);
    explored++;
    if (explored > nodeBudget) return false;
    for (let i = 0; i < state.length; i++) {
      if (state[i].length === 0) continue;
      const moving = state[i][state[i].length - 1];
      for (let j = 0; j < state.length; j++) {
        if (i === j) continue;
        const to = state[j];
        if (to.length < CAPACITY && (to.length === 0 || to[to.length - 1] === moving)) {
          const newState = state.map((r, k) => (k === i ? r.slice(0, -1) : k === j ? r.concat([moving]) : r));
          if (isWon(newState)) return true;
          const key = canon(newState);
          if (!visited.has(key)) {
            visited.add(key);
            heapPush(heap, { state: newState, h: heuristic(newState) });
          }
        }
      }
    }
  }
  return false;
}

export function generateSolvableRods(colors, emptyRods) {
  const MAX_ATTEMPTS = 300;
  const NODE_BUDGET = 60000;
  let lastTry = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rods = randomShuffle(colors, emptyRods);
    lastTry = rods;
    if (solveExists(rods, NODE_BUDGET)) return rods;
  }
  return lastTry; // filet de sécurité, quasi jamais atteint en pratique
}

// Tente un déplacement de la tige `from` vers `to`. Retourne { rods, moved }
// — ne mute pas le tableau d'entrée.
export function move(rods, fromIdx, toIdx) {
  const from = rods[fromIdx];
  const to = rods[toIdx];
  if (from.length === 0) return { rods, moved: false };
  const moving = from[from.length - 1];
  if (!(to.length === 0 || to[to.length - 1] === moving)) return { rods, moved: false };

  let runLength = 0;
  for (let k = from.length - 1; k >= 0 && from[k] === moving; k--) runLength++;
  const spaceAvailable = CAPACITY - to.length;
  const moveCount = Math.min(runLength, spaceAvailable);
  if (moveCount <= 0) return { rods, moved: false };

  const newRods = rods.map((r) => [...r]);
  for (let k = 0; k < moveCount; k++) {
    newRods[toIdx].push(newRods[fromIdx].pop());
  }
  return { rods: newRods, moved: true };
}

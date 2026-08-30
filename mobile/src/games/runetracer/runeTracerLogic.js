// Traceur de Runes — nouveau jeu, inspiré du principe "trace la forme
// affichée, elle disparaît, reproduis-la le plus fidèlement possible,
// score = % de similarité" vu dans un jeu tiers (Hoora/Spell Tracer).
// Noms et univers volontairement ORIGINAUX (pas de sorts Harry Potter,
// protégés par le droit d'auteur) — 10 "runes" géométriques génériques
// avec des noms inventés pour ce jeu. Toute la logique ici est pure
// (aucune dépendance UI), testable en isolation.

// Chaque forme est une liste de points normalisés dans un carré [0,1]x[0,1].
function circlePoints(n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: 0.5 + Math.cos(a) * 0.38, y: 0.5 + Math.sin(a) * 0.38 });
  }
  return pts;
}
function trianglePoints() {
  const a = { x: 0.5, y: 0.1 };
  const b = { x: 0.88, y: 0.85 };
  const c = { x: 0.12, y: 0.85 };
  return [a, b, c, a];
}
function squarePoints() {
  const m = 0.12;
  return [
    { x: m, y: m },
    { x: 1 - m, y: m },
    { x: 1 - m, y: 1 - m },
    { x: m, y: 1 - m },
    { x: m, y: m },
  ];
}
function starPoints() {
  const pts = [];
  const spikes = 5;
  const outerR = 0.42;
  const innerR = 0.18;
  for (let i = 0; i <= spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r });
  }
  return pts;
}
function wavePoints(n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: 0.1 + t * 0.8, y: 0.5 + Math.sin(t * Math.PI * 2.5) * 0.28 });
  }
  return pts;
}
function zigzagPoints() {
  return [
    { x: 0.15, y: 0.2 },
    { x: 0.5, y: 0.45 },
    { x: 0.15, y: 0.65 },
    { x: 0.5, y: 0.9 },
    { x: 0.85, y: 0.55 },
  ];
}
function spiralPoints(n = 60) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI * 4.2;
    const r = 0.05 + t * 0.38;
    pts.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r });
  }
  return pts;
}
function infinityPoints(n = 60) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const scale = 0.36 / (1 + Math.sin(t) * Math.sin(t));
    pts.push({ x: 0.5 + Math.cos(t) * scale, y: 0.5 + Math.sin(t) * Math.cos(t) * scale });
  }
  return pts;
}
function crossPoints() {
  return [
    { x: 0.5, y: 0.12 },
    { x: 0.5, y: 0.88 },
    { x: 0.5, y: 0.5 },
    { x: 0.15, y: 0.5 },
    { x: 0.85, y: 0.5 },
  ];
}
function diamondPoints() {
  return [
    { x: 0.5, y: 0.08 },
    { x: 0.9, y: 0.5 },
    { x: 0.5, y: 0.92 },
    { x: 0.1, y: 0.5 },
    { x: 0.5, y: 0.08 },
  ];
}

export const RUNES = [
  { id: 'halo', name: 'Halo', desc: 'Cercle de garde', difficulty: 'DÉBUTANT', points: circlePoints(), closed: true },
  { id: 'flamme', name: 'Flamme', desc: 'Pointe ascendante', difficulty: 'DÉBUTANT', points: trianglePoints(), closed: true },
  { id: 'bastion', name: 'Bastion', desc: "Rempart d'angles droits", difficulty: 'DÉBUTANT', points: squarePoints(), closed: true },
  { id: 'croisee', name: 'Croisée', desc: 'Intersection simple', difficulty: 'DÉBUTANT', points: crossPoints(), closed: false },
  { id: 'joyau', name: 'Joyau', desc: 'Facettes en losange', difficulty: 'INTERMÉDIAIRE', points: diamondPoints(), closed: true },
  { id: 'maree', name: 'Marée', desc: 'Ondulation continue', difficulty: 'INTERMÉDIAIRE', points: wavePoints(), closed: false },
  { id: 'eclair', name: 'Éclair', desc: 'Angles vifs enchaînés', difficulty: 'INTERMÉDIAIRE', points: zigzagPoints(), closed: false },
  { id: 'etincelle', name: 'Étincelle', desc: 'Pointes multiples', difficulty: 'AVANCÉ', points: starPoints(), closed: true },
  { id: 'eternite', name: 'Éternité', desc: 'Boucle sans fin', difficulty: 'AVANCÉ', points: infinityPoints(), closed: true },
  { id: 'tourbillon', name: 'Tourbillon', desc: 'Spirale resserrée', difficulty: 'AVANCÉ', points: spiralPoints(), closed: false },
];

function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

// Rééchantillonne un tracé en N points espacés uniformément le long de sa
// longueur (indépendant du nombre de points d'origine ou de la vitesse du
// doigt) — nécessaire pour comparer deux tracés point à point.
export function resample(points, n) {
  if (points.length < 2) return Array(n).fill(points[0] || { x: 0, y: 0 });
  const total = pathLength(points);
  if (total < 1e-6) return Array(n).fill(points[0]);
  const step = total / (n - 1);
  const result = [points[0]];
  let prevDist = 0;
  let i = 1;
  let segStart = points[0];
  for (let k = 1; k < n; k++) {
    const targetDist = k * step;
    while (i < points.length && prevDist + Math.hypot(points[i].x - segStart.x, points[i].y - segStart.y) < targetDist) {
      prevDist += Math.hypot(points[i].x - segStart.x, points[i].y - segStart.y);
      segStart = points[i];
      i++;
    }
    if (i >= points.length) {
      result.push(points[points.length - 1]);
      continue;
    }
    const segLen = Math.hypot(points[i].x - segStart.x, points[i].y - segStart.y);
    const remain = targetDist - prevDist;
    const t = segLen < 1e-9 ? 0 : remain / segLen;
    result.push({ x: segStart.x + (points[i].x - segStart.x) * t, y: segStart.y + (points[i].y - segStart.y) * t });
  }
  return result;
}

function boundingDiag(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY) || 1;
}

const SAMPLE_N = 96; // densité d'échantillonnage — augmentée de 48 à 96 pour réduire le bruit
// de discrétisation résiduel qui pénalisait injustement les formes fermées bien tracées mais
// démarrées à un autre point de la boucle (voir scoreTrace ci-dessous)
const SCORE_K = 700; // légèrement réduit après l'augmentation de résolution (voir tests)

function rotateArray(arr, k) {
  const n = arr.length;
  const shift = ((k % n) + n) % n;
  return arr.slice(shift).concat(arr.slice(0, shift));
}

function avgDist(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return sum / a.length;
}

// Compare le tracé du joueur (userPoints, mêmes coordonnées normalisées
// [0,1] que la forme de référence) à la forme de référence.
// - Essaie les 2 sens de parcours (le joueur peut tracer dans l'ordre
//   inverse).
// - Pour les formes FERMÉES (cercle, étoile, infini...), essaie aussi
//   plusieurs points de départ le long de la boucle : rien n'oblige le
//   joueur à commencer exactement où la forme de référence "commence"
//   (bug corrigé — un tracé par ailleurs parfait, mais démarré à un autre
//   endroit de la boucle, pouvait scorer 0% car chaque point du tracé
//   était comparé au mauvais point de référence).
// Retourne un entier 0-100.
export function scoreTrace(shapePoints, userPoints, isClosed) {
  if (!userPoints || userPoints.length < 2) return 0;
  const ref = resample(shapePoints, SAMPLE_N);
  const usr = resample(userPoints, SAMPLE_N);
  const usrRev = [...usr].reverse();
  const diag = boundingDiag(shapePoints);

  let best = Infinity;
  if (isClosed) {
    for (let off = 0; off < SAMPLE_N; off++) {
      best = Math.min(best, avgDist(ref, rotateArray(usr, off)), avgDist(ref, rotateArray(usrRev, off)));
    }
  } else {
    best = Math.min(avgDist(ref, usr), avgDist(ref, usrRev));
  }

  const normalized = best / diag;
  const score = Math.round(Math.max(0, Math.min(100, 100 - normalized * SCORE_K)));
  return score;
}

export function ratingForScore(score) {
  if (score >= 90) return 'PARFAIT';
  if (score >= 75) return 'TRÈS BIEN';
  if (score >= 60) return 'BIEN';
  if (score >= 40) return 'APPROXIMATIF';
  return 'RATÉ';
}

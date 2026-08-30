// Traceur de Runes — nouveau jeu, inspiré du principe "trace la forme
// affichée, elle disparaît, reproduis-la le plus fidèlement possible,
// score = % de similarité" vu dans un jeu tiers (Hoora/Spell Tracer).
// Noms et univers volontairement ORIGINAUX (pas de sorts Harry Potter,
// protégés par le droit d'auteur) — 10 "runes" géométriques génériques
// avec des noms inventés pour ce jeu. Toute la logique ici est pure
// (aucune dépendance UI), testable en isolation.

// Chaque forme est une liste de points normalisés dans un carré [0,1]x[0,1].
// Tailles réduites (retour utilisateur : formes trop grandes/complexes) et
// aucune forme n'exige de lever le doigt en cours de route — le jeu ne
// gère qu'un seul trait continu par rune (la croix d'origine, qui
// nécessitait 2 traits séparés, a été retirée pour cette raison : lever le
// doigt entre les deux traits validait la manche prématurément avec la
// moitié de la forme seulement).

// Ajoute des points intermédiaires le long de chaque segment d'un tracé
// polygonal (mêmes sommets, même forme géométrique — juste plus de points
// pour la décrire). Nécessaire car les formes à très peu de sommets
// (triangle, carré, losange, éclair) se comportaient différemment des
// formes à courbe (cercle, étoile) dans les tests de calibration, les
// rendant injustement plus dures à bien noter.
function densify(points, pointsPerSegment = 12) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    for (let k = 1; k <= pointsPerSegment; k++) {
      const t = k / pointsPerSegment;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function circlePoints(n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: 0.5 + Math.cos(a) * 0.32, y: 0.5 + Math.sin(a) * 0.32 });
  }
  return pts;
}
function trianglePoints() {
  const a = { x: 0.5, y: 0.16 };
  const b = { x: 0.82, y: 0.78 };
  const c = { x: 0.18, y: 0.78 };
  return densify([a, b, c, a]);
}
function squarePoints() {
  const m = 0.18;
  return densify([
    { x: m, y: m },
    { x: 1 - m, y: m },
    { x: 1 - m, y: 1 - m },
    { x: m, y: 1 - m },
    { x: m, y: m },
  ]);
}
function starPoints() {
  const pts = [];
  const spikes = 5;
  const outerR = 0.33;
  const innerR = 0.14;
  for (let i = 0; i <= spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r });
  }
  return densify(pts, 5);
}
function wavePoints(n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: 0.1 + t * 0.8, y: 0.5 + Math.sin(t * Math.PI * 2.5) * 0.24 });
  }
  return pts;
}
function zigzagPoints() {
  return densify([
    { x: 0.2, y: 0.25 },
    { x: 0.5, y: 0.46 },
    { x: 0.2, y: 0.62 },
    { x: 0.5, y: 0.85 },
    { x: 0.8, y: 0.55 },
  ]);
}
function spiralPoints(n = 60) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI * 3.0;
    const r = 0.05 + t * 0.3;
    pts.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r });
  }
  return pts;
}
function infinityPoints(n = 60) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const scale = 0.3 / (1 + Math.sin(t) * Math.sin(t));
    pts.push({ x: 0.5 + Math.cos(t) * scale, y: 0.5 + Math.sin(t) * Math.cos(t) * scale });
  }
  return pts;
}
// Remplace l'ancienne "Croisée" (croix, 2 traits nécessaires — incompatible
// avec un tracé en un seul geste). Arc simple, un seul trait, débutant.
function crescentPoints(n = 30) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -Math.PI * 0.62 + t * Math.PI * 1.24;
    pts.push({ x: 0.5 + Math.cos(a) * 0.32, y: 0.5 + Math.sin(a) * 0.32 });
  }
  return pts;
}
function diamondPoints() {
  return densify([
    { x: 0.5, y: 0.14 },
    { x: 0.86, y: 0.5 },
    { x: 0.5, y: 0.86 },
    { x: 0.14, y: 0.5 },
    { x: 0.5, y: 0.14 },
  ]);
}

export const RUNES = [
  { id: 'halo', name: 'Halo', desc: 'Cercle de garde', difficulty: 'DÉBUTANT', points: circlePoints(), closed: true },
  { id: 'flamme', name: 'Flamme', desc: 'Pointe ascendante', difficulty: 'DÉBUTANT', points: trianglePoints(), closed: true },
  { id: 'bastion', name: 'Bastion', desc: "Rempart d'angles droits", difficulty: 'DÉBUTANT', points: squarePoints(), closed: true },
  { id: 'croissant', name: 'Croissant', desc: 'Arc lunaire', difficulty: 'DÉBUTANT', points: crescentPoints(), closed: false },
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

// ---- Nouveau système de score : COUVERTURE BIDIRECTIONNELLE (remplace
// l'ancien système "distance moyenne + recherche de décalage") ----
// Principe (décidé avec l'utilisateur après plusieurs tests) : on ne
// mesure plus une distance moyenne globale, mais littéralement "quel %
// du tracé affiché est recouvert par le tracé du joueur, AU MÊME
// ENDROIT" — la position compte pleinement, aucun recentrage. Avantage
// direct : plus besoin de deviner un sens de parcours ou un point de
// départ (les anciens problèmes des formes fermées disparaissent tout
// seuls, une couverture ne dépend pas de l'ordre des points).
//
// Pour éviter qu'un gribouillis dense sur tout l'écran ne score 100% par
// hasard (il finirait par "recouvrir" tous les points de la référence),
// la couverture est mesurée dans les DEUX sens :
//   - covRef : quelle fraction des points de la RÉFÉRENCE a un point du
//     JOUEUR à proximité (le joueur a-t-il bien parcouru toute la forme ?)
//   - covUser : quelle fraction des points du JOUEUR a un point de la
//     RÉFÉRENCE à proximité (le joueur n'est-il pas sorti du tracé,
//     n'a-t-il pas griffonné à côté ?)
// Score = moyenne des deux. Un gribouillage couvrirait bien covRef, mais
// s'effondrerait sur covUser (plein de points du joueur loin de la
// référence) — les deux dérives possibles sont donc couvertes.
const SAMPLE_N = 120;
const TOLERANCE = 0.045; // rayon de tolérance minimal, en unités normalisées [0,1] — "minim" comme demandé

function coverageFraction(fromPoints, toPoints, tolerance) {
  let covered = 0;
  for (const p of fromPoints) {
    let minD = Infinity;
    for (const q of toPoints) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < minD) minD = d;
      if (minD <= tolerance) break; // sortie anticipée, pas besoin d'aller plus loin
    }
    if (minD <= tolerance) covered++;
  }
  return covered / fromPoints.length;
}

// Compare le tracé du joueur (userPoints, mêmes coordonnées normalisées
// [0,1] que la forme de référence, AUCUN recentrage) à la forme de
// référence. Retourne un entier 0-100.
export function scoreTrace(shapePoints, userPoints) {
  if (!userPoints || userPoints.length < 2) return 0;
  const ref = resample(shapePoints, SAMPLE_N);
  const usr = resample(userPoints, SAMPLE_N);

  const covRef = coverageFraction(ref, usr, TOLERANCE);
  const covUser = coverageFraction(usr, ref, TOLERANCE);

  // Le MINIMUM des deux (pas la moyenne) : un tracé qui ne fait que la
  // moitié de la forme doit être nettement pénalisé, pas "sauvé" par une
  // bonne couverture dans l'autre sens. Testé : avec la moyenne, un tracé
  // à moitié fait notait ~76% (trop généreux) ; avec le minimum, ~52%.
  const score = Math.round(Math.min(covRef, covUser) * 100);
  return Math.max(0, Math.min(100, score));
}

export function ratingForScore(score) {
  if (score >= 90) return 'PARFAIT';
  if (score >= 75) return 'TRÈS BIEN';
  if (score >= 60) return 'BIEN';
  if (score >= 40) return 'APPROXIMATIF';
  return 'RATÉ';
}

// Moteur physique du billard — remplace Matter.js (utilisé dans le PWA) par
// une implémentation maison en JS pur, pour éviter d'introduire une nouvelle
// dépendance native dans le projet mobile (voir historique de crash lié aux
// modules natifs, documenté dans PROJECT_STATE.md). Les CONSTANTES
// (restitution, friction, sous-étapes) sont IDENTIQUES au PWA pour un
// ressenti de jeu équivalent — seule la méthode de résolution des
// collisions change (collision cercle-cercle élastique à masse égale +
// réflexion cercle-mur, au lieu d'un vrai moteur de corps rigides).

export const TABLE_W = 900;
export const TABLE_H = 450;
export const BALL_R = 18;
export const REST_WALL = 0.8;
export const REST_BALL = 0.95;
export const FRICTION_AIR = 0.018;
export const SUBSTEPS = 8;
export const POCKET_R = 32;
export const POCKET_R_SIDE = 24;
export const MAX_POWER = 45;

export const POCKETS = [
  { x: 0, y: 0, r: POCKET_R },
  { x: TABLE_W / 2, y: 0, r: POCKET_R_SIDE },
  { x: TABLE_W, y: 0, r: POCKET_R },
  { x: 0, y: TABLE_H, r: POCKET_R },
  { x: TABLE_W / 2, y: TABLE_H, r: POCKET_R_SIDE },
  { x: TABLE_W, y: TABLE_H, r: POCKET_R },
];

export const BALL_DEFS = [
  { id: 0, group: 'cue', color: '#f4f1ea' },
  { id: 1, group: 'solid', color: '#f5b942' },
  { id: 2, group: 'solid', color: '#5f9dc9' },
  { id: 3, group: 'solid', color: '#ef6461' },
  { id: 4, group: 'solid', color: '#b85fc9' },
  { id: 5, group: 'solid', color: '#e08a3c' },
  { id: 6, group: 'solid', color: '#8fc95f' },
  { id: 7, group: 'solid', color: '#a0522d' },
  { id: 8, group: 'eight', color: '#161616' },
  { id: 9, group: 'stripe', color: '#f5b942' },
  { id: 10, group: 'stripe', color: '#5f9dc9' },
  { id: 11, group: 'stripe', color: '#ef6461' },
  { id: 12, group: 'stripe', color: '#b85fc9' },
  { id: 13, group: 'stripe', color: '#e08a3c' },
  { id: 14, group: 'stripe', color: '#8fc95f' },
  { id: 15, group: 'stripe', color: '#a0522d' },
];

function resolveWallCollision(ball) {
  let bounced = false;
  if (ball.pos.x < BALL_R) {
    ball.pos.x = BALL_R;
    if (ball.vel.x < 0) {
      ball.vel.x = -ball.vel.x * REST_WALL;
      bounced = true;
    }
  } else if (ball.pos.x > TABLE_W - BALL_R) {
    ball.pos.x = TABLE_W - BALL_R;
    if (ball.vel.x > 0) {
      ball.vel.x = -ball.vel.x * REST_WALL;
      bounced = true;
    }
  }
  if (ball.pos.y < BALL_R) {
    ball.pos.y = BALL_R;
    if (ball.vel.y < 0) {
      ball.vel.y = -ball.vel.y * REST_WALL;
      bounced = true;
    }
  } else if (ball.pos.y > TABLE_H - BALL_R) {
    ball.pos.y = TABLE_H - BALL_R;
    if (ball.vel.y > 0) {
      ball.vel.y = -ball.vel.y * REST_WALL;
      bounced = true;
    }
  }
  return bounced;
}

// Collision élastique cercle-cercle, masses égales. Retourne true si contact.
function resolveBallCollision(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= BALL_R * 2 || dist < 1e-6) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  // Sépare les billes pour éviter qu'elles ne restent collées
  const overlap = BALL_R * 2 - dist;
  a.pos.x -= (nx * overlap) / 2;
  a.pos.y -= (ny * overlap) / 2;
  b.pos.x += (nx * overlap) / 2;
  b.pos.y += (ny * overlap) / 2;

  const rvx = a.vel.x - b.vel.x;
  const rvy = a.vel.y - b.vel.y;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal < 0) return true; // s'éloignent déjà

  const j = ((1 + REST_BALL) * velAlongNormal) / 2;
  a.vel.x -= j * nx;
  a.vel.y -= j * ny;
  b.vel.x += j * nx;
  b.vel.y += j * ny;
  return true;
}

// Avance la simulation d'une frame (SUBSTEPS sous-étapes). Mute directement
// les billes non empochées (pos/vel). Retourne les infos de collision de la
// frame : { ballBallContacts: Set<pairKey>, railContacts: Set<ballId> } pour
// que l'appelant puisse dériver firstContactGroup / railAfterContact.
export function stepPhysics(balls, events) {
  // Vitesse exprimée en "pixels par sous-étape" (pas en px/s) — cohérent avec
  // le calibrage de MAX_POWER (45) repris tel quel du PWA, qui définissait
  // déjà sa puissance dans les unités internes de Matter.js à pas fixe.
  const active = balls.filter((b) => !b.pocketed);
  for (let s = 0; s < SUBSTEPS; s++) {
    for (const ball of active) {
      ball.pos.x += ball.vel.x;
      ball.pos.y += ball.vel.y;
    }
    for (const ball of active) {
      const bounced = resolveWallCollision(ball);
      if (bounced && events) {
        events.railContacts.add(ball.id);
        // Bug corrigé : ce booléen n'était jamais mis à jour (seul le Set
        // railContacts l'était), donc railAfterContact restait toujours
        // false et TOUT tir qui n'empochait rien était compté comme une
        // faute "aucune bande touchée", même quand une bande était bien
        // touchée après contact — cause de la fausse faute remontée.
        if (events.firstContactGroup) events.railAfterContact = true;
      }
    }
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const contact = resolveBallCollision(active[i], active[j]);
        if (contact && events) {
          const key = [active[i].id, active[j].id].sort((x, y) => x - y).join('-');
          events.ballBallContacts.add(key);
          if (!events.firstContactGroup) {
            if (active[i].id === 0) events.firstContactGroup = active[j].group;
            else if (active[j].id === 0) events.firstContactGroup = active[i].group;
          }
        }
      }
    }
    for (const ball of active) {
      ball.vel.x *= 1 - FRICTION_AIR;
      ball.vel.y *= 1 - FRICTION_AIR;
    }
  }
}

export function checkPockets(balls, shotFacts) {
  for (const ball of balls) {
    if (ball.pocketed) continue;
    for (const p of POCKETS) {
      if (Math.hypot(ball.pos.x - p.x, ball.pos.y - p.y) < p.r) {
        ball.pocketed = true;
        ball.vel = { x: 0, y: 0 };
        if (ball.id === 0) shotFacts.cueScratched = true;
        else shotFacts.pocketedBalls.push({ id: ball.id, group: ball.group });
        break;
      }
    }
  }
}

export function allStopped(balls) {
  return balls.every((b) => b.pocketed || (Math.abs(b.vel.x) < 0.02 && Math.abs(b.vel.y) < 0.02));
}

export function rackPositions(footX, midY) {
  const positions = [];
  const rowGap = BALL_R * 2 + 0.6;
  const colGap = BALL_R * 1.75;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      positions.push({ x: footX + row * colGap, y: midY - (row * rowGap) / 2 + i * rowGap });
    }
  }
  return positions;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function setupRack() {
  const positions = rackPositions(TABLE_W * 0.72, TABLE_H / 2);
  const eightIndex = 4;
  const others = shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
  const numbers = new Array(15);
  numbers[eightIndex] = 8;
  let oi = 0;
  for (let i = 0; i < 15; i++) {
    if (i !== eightIndex) {
      numbers[i] = others[oi];
      oi++;
    }
  }
  const cueX = TABLE_W * 0.25;
  const cueY = TABLE_H / 2;
  const balls = [{ id: 0, group: 'cue', color: '#f4f1ea', pos: { x: cueX, y: cueY }, vel: { x: 0, y: 0 }, pocketed: false }];
  for (let i = 0; i < 15; i++) {
    const def = BALL_DEFS.find((d) => d.id === numbers[i]);
    balls.push({ id: numbers[i], group: def.group, color: def.color, pos: { ...positions[i] }, vel: { x: 0, y: 0 }, pocketed: false });
  }
  return balls;
}

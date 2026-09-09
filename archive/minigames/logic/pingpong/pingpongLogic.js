// Ping-pong — logique et physique pure, transliterée fidèlement depuis
// index.html (PWA, section "PING-PONG 2D"). Contrairement au billard, le
// PWA lui-même reste en PORTRAIT pour ce jeu ("plus de verrouillage
// d'orientation : ça tient dans l'écran du téléphone tel quel") — donc pas
// besoin ici de mode paysage, de zones sûres spéciales, ni de barre de
// navigation masquée. Vue de dessus, raquettes rondes qui suivent le doigt
// directement (pas de "viser puis tirer" comme au billard). Aucune
// dépendance UI dans ce fichier.

export const BASE_W = 300;
export const BASE_H = 460;

export const DIFFS = {
  facile: { label: 'FACILE', botSpeed: 0.62, botError: 0.16, botPowerMin: 0.35, botPowerMax: 0.75 },
  moyen: { label: 'MOYEN', botSpeed: 0.82, botError: 0.09, botPowerMin: 0.5, botPowerMax: 0.95 },
  difficile: { label: 'DIFFICILE', botSpeed: 1.05, botError: 0.03, botPowerMin: 0.7, botPowerMax: 1.15 },
};

export const WIN_SCORE = 7;
export const BASE_SPEED_FACTOR = 0.62;
export const MAX_SPEED_FACTOR = 1.55;
export const SPEED_GROWTH = 1.045;
export const TRAIL_LEN = 10;
export const BOUNCE_VZ0 = 900;
export const GRAVITY = 2600;

export function paddleRadius(w) {
  return w * 0.135;
}
export function ballRadius(w) {
  return w * 0.04;
}

export function makeBall(w, h) {
  return { x: w / 2, y: h / 2, vx: 0, vy: 0, r: ballRadius(w), z: 0, vz: 0, bounced: false };
}
export function makePaddle(w, h, isPlayer) {
  const r = paddleRadius(w);
  return { x: w / 2, y: isPlayer ? h - r * 1.15 : r * 1.15, r, vx: 0, vy: 0 };
}

export function clampPaddle(p, w, overhang) {
  p.x = Math.max(-overhang, Math.min(w + overhang, p.x));
}

// Sert la balle. towardOpp=true -> va vers le haut (l'adversaire), sinon
// vers le bas (le joueur). Retourne le nouveau lastHitter et targetZone.
export function serve(ball, w, h, towardOpp) {
  ball.x = w / 2;
  ball.y = h / 2;
  const speed = h * BASE_SPEED_FACTOR;
  ball.vx = (Math.random() - 0.5) * speed * 0.3;
  ball.vy = towardOpp ? -speed : speed;
  ball.z = 0;
  ball.vz = BOUNCE_VZ0 * (h / 700);
  ball.bounced = false;
  const lastHitter = towardOpp ? 'player' : 'opp';
  return { lastHitter, targetZone: lastHitter === 'player' ? 'top' : 'bottom' };
}

// Avance la balle d'un pas dt. Retourne { bouncedInBounds } (true si le
// rebond au sol vient de se produire DANS la table, pour que l'appelant
// mette à jour targetBounced selon la zone).
export function stepBall(ball, dt, w, h) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  let bounced = null;
  if (!ball.bounced) {
    const g = GRAVITY * (h / 700);
    ball.vz -= g * dt;
    ball.z += ball.vz * dt;
    if (ball.z <= 0) {
      ball.z = 0;
      ball.vz = 0;
      ball.bounced = true;
      const withinTable = ball.x >= 0 && ball.x <= w;
      const zone = ball.y < h / 2 ? 'top' : 'bottom';
      bounced = { withinTable, zone, x: ball.x, y: ball.y };
    }
  }
  return bounced;
}

export function tryPaddleHit(paddle, ball, isPlayer) {
  const dx = ball.x - paddle.x;
  const dy = ball.y - paddle.y;
  const dist = Math.hypot(dx, dy);
  const movingToward = isPlayer ? ball.vy > 0 : ball.vy < 0;
  if (!movingToward) return false;
  if (dist > paddle.r + ball.r) return false;
  return true;
}

// Dévie la balle après un impact de raquette. diffCfg requis seulement si
// !isPlayer (paramètres de puissance du bot selon la difficulté).
export function deflect(paddle, ball, isPlayer, w, h, diffCfg) {
  const dx = ball.x - paddle.x;
  const dy = ball.y - paddle.y;
  const dist = Math.hypot(dx, dy);
  const nx = dist > 0.01 ? dx / dist : 0;
  const ny = dist > 0.01 ? dy / dist : isPlayer ? -1 : 1;
  ball.x = paddle.x + nx * (paddle.r + ball.r);
  ball.y = paddle.y + ny * (paddle.r + ball.r);
  ball.z = 0;
  ball.vz = BOUNCE_VZ0 * (h / 700);
  ball.bounced = false;

  const curSpeed = Math.hypot(ball.vx, ball.vy);
  const baseSpeed = Math.min(curSpeed * SPEED_GROWTH, h * MAX_SPEED_FACTOR);
  const paddleSpeed = Math.hypot(paddle.vx, paddle.vy);
  const powerRef = w * 4.2;
  let powerBoost = Math.max(0, Math.min(1, paddleSpeed / powerRef));
  if (!isPlayer) {
    powerBoost = diffCfg.botPowerMin + Math.random() * (diffCfg.botPowerMax - diffCfg.botPowerMin);
  }
  const outSpeed = baseSpeed * (0.72 + powerBoost * 0.65);

  const offset = Math.max(-1, Math.min(1, dx / (paddle.r + ball.r)));
  const spin = isPlayer ? paddle.vx / powerRef : (Math.random() - 0.5) * 0.6;
  const angle = offset * 0.85 + spin * 0.35;
  const dirY = isPlayer ? -1 : 1;
  ball.vx = angle * outSpeed;
  ball.vy = dirY * Math.sqrt(Math.max(0.15, 1 - Math.min(0.9, Math.abs(angle)))) * outSpeed;

  return { powerBoost };
}

export function checkScore(ball, w, h, targetBounced, lastHitter) {
  const outBottom = ball.y - ball.r > h;
  const outTop = ball.y + ball.r < 0;
  if (!outBottom && !outTop) return null;
  if (targetBounced) return lastHitter;
  return lastHitter === 'player' ? 'opp' : 'player';
}

export function checkWin(a, b) {
  if (a >= WIN_SCORE && a - b >= 2) return 'player';
  if (b >= WIN_SCORE && b - a >= 2) return 'opp';
  return null;
}

// IA du bot : suit la balle en X avec une erreur sinusoïdale (selon la
// difficulté), et avance/recule en Y pour intercepter tôt puis se replacer.
export function botUpdate(opp, ball, dt, cfg, w, h) {
  const maxSpeedX = w * 1.6 * cfg.botSpeed;
  const error = Math.sin(performance.now() * 0.003 + ball.x) * cfg.botError * w;
  const targetX = ball.x + error;
  const diffX = targetX - opp.x;
  const moveX = Math.max(-maxSpeedX * dt, Math.min(maxSpeedX * dt, diffX));
  opp.vx = moveX / Math.max(dt, 0.0001);
  opp.x += moveX;

  const baseY = opp.r * 1.15;
  const netY = h / 2 - opp.r * 1.05;
  let targetY = baseY;
  if (ball.y < h / 2 && ball.vy < 0) {
    const d = Math.max(0, Math.min(1, ball.y / (h / 2)));
    const peak = 4 * d * (1 - d);
    targetY = baseY + (netY - baseY) * 0.55 * peak;
  }
  const maxSpeedY = h * 0.9 * cfg.botSpeed;
  const diffY = targetY - opp.y;
  const moveY = Math.max(-maxSpeedY * dt, Math.min(maxSpeedY * dt, diffY));
  opp.vy = moveY / Math.max(dt, 0.0001);
  opp.y += moveY;
  opp.y = Math.max(baseY, Math.min(netY, opp.y));
}

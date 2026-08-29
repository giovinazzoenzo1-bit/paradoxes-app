// Règles du 8-ball, IA du bot ("ghost ball"), aperçu de trajectoire et
// transformations de coordonnées (table tournée en "paysage" dans un écran
// portrait) — transliterées fidèlement depuis index.html (bilEvaluateShot,
// bilBotPickShot, bilComputeAimPreview, bilGameToCanvas/bilCanvasToGame).
// Aucune dépendance UI ici.

import { TABLE_W, TABLE_H, BALL_R, POCKETS, MAX_POWER } from './billiardPhysics';

export function evaluateShot(playerGroup, groupsAssigned, shotFacts) {
  const result = { foul: false, reason: null, gameOver: false, winner: null, assignGroup: null, continueTurn: false };
  const eightPocketed = shotFacts.pocketedBalls.some((b) => b.group === 'eight');
  const ownGroup = groupsAssigned ? playerGroup : null;
  const ownRemain = shotFacts.ownGroupBallsRemainingBeforeShot;

  if (eightPocketed) {
    const groupWasCleared = groupsAssigned && ownRemain === 0;
    const otherFoul =
      shotFacts.cueScratched ||
      !shotFacts.firstContactGroup ||
      (groupsAssigned && shotFacts.firstContactGroup !== 'eight' && shotFacts.firstContactGroup !== ownGroup && ownRemain > 0);
    if (!groupWasCleared || otherFoul) {
      result.gameOver = true;
      result.winner = 'opponent';
      result.reason = 'Bille 8 rentrée hors-jeu';
      return result;
    }
    result.gameOver = true;
    result.winner = 'player';
    result.reason = 'Bille 8 rentrée légalement';
    return result;
  }
  if (shotFacts.cueScratched) {
    result.foul = true;
    result.reason = 'Bille blanche empochée';
    return result;
  }
  if (!shotFacts.firstContactGroup) {
    result.foul = true;
    result.reason = 'Aucune bille touchée';
    return result;
  }
  if (!groupsAssigned && shotFacts.firstContactGroup !== 'eight') {
    result.assignGroup = shotFacts.firstContactGroup;
  }
  const effectiveOwnGroup = result.assignGroup || ownGroup;
  if (groupsAssigned && shotFacts.firstContactGroup !== effectiveOwnGroup && shotFacts.firstContactGroup !== 'eight') {
    result.foul = true;
    result.reason = 'Mauvais groupe touché en premier';
    return result;
  }
  if (shotFacts.firstContactGroup === 'eight' && groupsAssigned && ownRemain > 0) {
    result.foul = true;
    result.reason = "Bille 8 touchée avant d'avoir vidé son groupe";
    return result;
  }
  if (shotFacts.pocketedBalls.length === 0 && !shotFacts.railAfterContact) {
    result.foul = true;
    result.reason = 'Aucune bande touchée après contact';
    return result;
  }
  result.continueTurn = shotFacts.pocketedBalls.some((b) => b.group === effectiveOwnGroup);
  return result;
}

export function computeAimPreview(balls, cue, dirX, dirY) {
  let x = cue.pos.x;
  let y = cue.pos.y;
  const step = 2;
  for (let d = 0; d < 1400; d += step) {
    x += dirX * step;
    y += dirY * step;
    if (x < BALL_R || x > TABLE_W - BALL_R || y < BALL_R || y > TABLE_H - BALL_R) {
      return { end: { x, y } };
    }
    for (const ball of balls) {
      if (ball === cue || ball.pocketed) continue;
      if (Math.hypot(ball.pos.x - x, ball.pos.y - y) <= BALL_R * 2) {
        const nx = x - ball.pos.x;
        const ny = y - ball.pos.y;
        const ndist = Math.hypot(nx, ny) || 1;
        const contact = { x: ball.pos.x + (nx / ndist) * BALL_R * 2, y: ball.pos.y + (ny / ndist) * BALL_R * 2 };
        const tx = ball.pos.x - contact.x;
        const ty = ball.pos.y - contact.y;
        const tlen = Math.hypot(tx, ty) || 1;
        return { end: contact, targetBall: ball, targetDir: { x: tx / tlen, y: ty / tlen } };
      }
    }
  }
  return { end: { x, y } };
}

export function botPickShot(balls, playerGroup) {
  const cue = balls[0];
  const group = playerGroup;
  let candidates = balls.filter((b) => !b.pocketed && b.id !== 0 && (group ? b.group === group : b.group !== 'eight'));
  if (group && candidates.length === 0) {
    candidates = balls.filter((b) => !b.pocketed && b.group === 'eight');
  }
  if (candidates.length === 0) {
    candidates = balls.filter((b) => !b.pocketed && b.id !== 0);
  }
  let best = null;
  for (const ball of candidates) {
    for (const pocket of POCKETS) {
      const toPocket = { x: pocket.x - ball.pos.x, y: pocket.y - ball.pos.y };
      const distToPocket = Math.hypot(toPocket.x, toPocket.y);
      if (distToPocket < 1) continue;
      const dirToPocket = { x: toPocket.x / distToPocket, y: toPocket.y / distToPocket };
      const contact = { x: ball.pos.x - dirToPocket.x * BALL_R * 2, y: ball.pos.y - dirToPocket.y * BALL_R * 2 };
      const toContact = { x: contact.x - cue.pos.x, y: contact.y - cue.pos.y };
      const distToContact = Math.hypot(toContact.x, toContact.y);
      if (distToContact < 1) continue;
      const dirToContact = { x: toContact.x / distToContact, y: toContact.y / distToContact };
      const cutAngle = Math.acos(Math.max(-1, Math.min(1, dirToContact.x * dirToPocket.x + dirToContact.y * dirToPocket.y)));
      if (cutAngle > Math.PI * 0.42) continue;
      const score = -distToContact * 0.6 - distToPocket * 0.4 - cutAngle * 260;
      if (!best || score > best.score) best = { dirToContact, score };
    }
  }
  if (best) {
    const errA = (Math.random() - 0.5) * 0.09;
    const c = Math.cos(errA);
    const s = Math.sin(errA);
    return {
      dir: { x: best.dirToContact.x * c - best.dirToContact.y * s, y: best.dirToContact.x * s + best.dirToContact.y * c },
      power: MAX_POWER * (0.55 + Math.random() * 0.25),
    };
  }
  let nearest = null;
  let nd = Infinity;
  for (const b of candidates) {
    const d = Math.hypot(b.pos.x - cue.pos.x, b.pos.y - cue.pos.y);
    if (d < nd) {
      nd = d;
      nearest = b;
    }
  }
  if (nearest) {
    const dx = nearest.pos.x - cue.pos.x;
    const dy = nearest.pos.y - cue.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    return { dir: { x: dx / d, y: dy / d }, power: MAX_POWER * 0.5 };
  }
  return { dir: { x: 1, y: 0 }, power: MAX_POWER * 0.4 };
}

export function botPlaceCuePos(balls) {
  for (let tries = 0; tries < 40; tries++) {
    const x = BALL_R * 2 + Math.random() * (TABLE_W - BALL_R * 4);
    const y = BALL_R * 2 + Math.random() * (TABLE_H - BALL_R * 4);
    const overlapping = balls.some((b) => !b.pocketed && b.id !== 0 && Math.hypot(b.pos.x - x, b.pos.y - y) < BALL_R * 2.4);
    if (!overlapping) return { x, y };
  }
  return { x: TABLE_W / 2, y: TABLE_H / 2 };
}

export function isValidCuePlacement(balls, pos) {
  const valid = pos.x > BALL_R && pos.x < TABLE_W - BALL_R && pos.y > BALL_R && pos.y < TABLE_H - BALL_R;
  const overlapping = balls.some((b) => !b.pocketed && b.id !== 0 && Math.hypot(b.pos.x - pos.x, b.pos.y - pos.y) < BALL_R * 2);
  return valid && !overlapping;
}

export function gameToScreen(gx, gy, scale, screenW, screenH, rotated) {
  if (rotated) {
    return { x: -scale * (gy - TABLE_H / 2) + screenW / 2, y: scale * (gx - TABLE_W / 2) + screenH / 2 };
  }
  return { x: scale * (gx - TABLE_W / 2) + screenW / 2, y: scale * (gy - TABLE_H / 2) + screenH / 2 };
}

export function screenToGame(cx, cy, scale, screenW, screenH, rotated) {
  if (rotated) {
    return { x: (cy - screenH / 2) / scale + TABLE_W / 2, y: -(cx - screenW / 2) / scale + TABLE_H / 2 };
  }
  return { x: (cx - screenW / 2) / scale + TABLE_W / 2, y: (cy - screenH / 2) / scale + TABLE_H / 2 };
}

// Logique pure du Flappy Bird — port fidèle depuis index.html (PWA) :
// physique par delta-temps (gravité, impulsion de saut), génération de
// tuyaux, détection de collision. Aucune dépendance UI. Toutes les
// constantes de position sont paramétrables (width/height) pour permettre
// une mise à l'échelle selon la taille d'écran côté RN, en conservant les
// mêmes ratios que le PWA (base 300×400).

export const BASE_WIDTH = 300;
export const BASE_HEIGHT = 400;
export const GRAVITY = 1400; // px/s²
export const FLAP_VELOCITY = -420; // px/s
export const PIPE_SPEED = 140; // px/s
export const PIPE_GAP = 130;
export const PIPE_WIDTH = 52;
export const PIPE_INTERVAL = 1500; // ms
export const BIRD_X = 70;
export const BIRD_RADIUS = 14;

export function spawnPipe(width, height, pipeGap) {
  const margin = 40;
  const gapY = margin + Math.random() * (height - 2 * margin - pipeGap);
  return { x: width, gapY, passed: false };
}

// Avance la simulation d'un pas dt (secondes). Retourne le nouvel état.
// Ne mute pas les entrées.
export function step(state, dt, dims) {
  const { width, height, pipeWidth, pipeGap, pipeSpeed, gravity, birdX, birdRadius } = dims;
  let birdVY = state.birdVY + gravity * dt;
  let birdY = state.birdY + birdVY * dt;

  let spawnTimer = state.spawnTimer + dt * 1000;
  let pipes = state.pipes.map((p) => ({ ...p, x: p.x - pipeSpeed * dt }));
  if (spawnTimer > PIPE_INTERVAL) {
    spawnTimer = 0;
    pipes = [...pipes, spawnPipe(width, height, pipeGap)];
  }
  pipes = pipes.filter((p) => p.x + pipeWidth > 0);

  let scoreGained = 0;
  pipes = pipes.map((p) => {
    if (!p.passed && p.x + pipeWidth < birdX) {
      scoreGained++;
      return { ...p, passed: true };
    }
    return p;
  });

  const collided = checkCollision({ birdY, pipes }, dims);

  return { birdY, birdVY, pipes, spawnTimer, scoreGained, collided };
}

export function checkCollision(state, dims) {
  const { height, pipeWidth, pipeGap, birdX, birdRadius } = dims;
  const { birdY, pipes } = state;
  if (birdY - birdRadius < 0 || birdY + birdRadius > height) return true;
  for (const p of pipes) {
    if (birdX + birdRadius > p.x && birdX - birdRadius < p.x + pipeWidth) {
      if (birdY - birdRadius < p.gapY || birdY + birdRadius > p.gapY + pipeGap) return true;
    }
  }
  return false;
}

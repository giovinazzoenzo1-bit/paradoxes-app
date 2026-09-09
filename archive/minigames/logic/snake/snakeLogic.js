// Logique pure du Snake — port fidèle depuis index.html (PWA). Grille 14×14,
// tick toutes les 160ms (géré côté écran), palette Game Boy DMG. Aucune
// dépendance UI ici.

export const GRID_SIZE = 14;

export const OPPOSITES = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function initialBody() {
  return [
    { x: 7, y: 7 },
    { x: 6, y: 7 },
    { x: 5, y: 7 },
  ];
}

export function placeFood(body) {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
  } while (body.some((s) => s.x === pos.x && s.y === pos.y));
  return pos;
}

// Avance le serpent d'un pas. Retourne { body, ate, dead }. Ne mute pas
// le tableau d'entrée.
export function tick(body, dir, food) {
  const head = { ...body[0] };
  if (dir === 'up') head.y--;
  if (dir === 'down') head.y++;
  if (dir === 'left') head.x--;
  if (dir === 'right') head.x++;

  const dead =
    head.x < 0 ||
    head.x >= GRID_SIZE ||
    head.y < 0 ||
    head.y >= GRID_SIZE ||
    body.some((s) => s.x === head.x && s.y === head.y);

  if (dead) return { body, ate: false, dead: true };

  const ate = head.x === food.x && head.y === food.y;
  const newBody = [head, ...body];
  if (!ate) newBody.pop();
  return { body: newBody, ate, dead: false };
}

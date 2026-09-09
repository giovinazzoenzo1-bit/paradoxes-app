// Logique pure du Memory — port fidèle depuis index.html (PWA) : bancs
// d'emojis, mélange Fisher-Yates, génération de grille. Aucune dépendance UI.

export const ICONS_THEMED = ['🚪', '🎂', '👦', '📅', '📊', '🪙', '🎰', '🎲', '🐢', '📦', '🚌', '🚗'];

export const ICONS_LARGE = [
  '🦁', '🐘', '🐧', '🦊', '🐢', '🧙', '🧛', '🦸', '👽', '🏴‍☠️', '⚽', '🍕', '🎸', '🚗', '🎈', '👑',
  '🧑‍🚀', '🥷', '🧟', '🤖', '🍦', '🌵', '🦄', '🐉', '🎃', '🕵️', '🧑‍🍳', '🎤', '⛄', '🦖', '🍔', '🎁',
  '🌈', '⭐', '🔥', '💎', '🎯', '🎨', '🎧', '📷', '🚀', '⚡', '🌙', '☀️', '🍉', '🍩', '🎮', '🏆',
  '🐬', '🦋', '🐝', '🍄', '🌸', '🍀', '🎺', '🥁', '🛸', '🧸', '🪁', '🍇', '🍓', '🥝', '🌮', '🍜',
  '🎬', '📚', '✏️', '🖍️', '🧲', '🔮', '💡', '🧦', '🥊', '🏓', '🚲', '⛵', '🏰', '🗿', '🎏', '🧵',
  '🪅', '🧃', '🍭', '🍫', '🥨', '🌻', '🍁', '🐙', '🐳', '🦕', '🦉', '🐿️', '🦔', '🐌', '🐞', '🦂',
  '🕷️', '🦀', '🐚', '🌊',
];

export const DIFFICULTIES = [
  { size: 4, label: 'Facile 4×4', emoji: '🟩' },
  { size: 6, label: 'Moyen 6×6', emoji: '🟨' },
  { size: 10, label: 'Difficile 10×10', emoji: '🟧' },
  { size: 14, label: 'Expert 14×14', emoji: '🟥' },
];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Génère un jeu de cartes mélangées pour une taille de grille donnée.
export function generateCards(size) {
  const pairsNeeded = (size * size) / 2;
  const bank = size === 4 ? ICONS_THEMED : ICONS_LARGE;
  const chosen = shuffle(bank).slice(0, pairsNeeded);
  return shuffle([...chosen, ...chosen]).map((icon) => ({ icon, flipped: false, matched: false }));
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

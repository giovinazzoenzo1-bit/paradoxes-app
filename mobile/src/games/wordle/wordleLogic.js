// Logique pure du Wordle — port depuis index.html (PWA), avec UNE correction
// délibérée : le PWA évalue chaque lettre avec un algorithme naïf qui ne
// décrémente pas les occurrences disponibles du mot cible (wordleEvalCell),
// ce qui donne un résultat FAUX quand une lettre est en double dans la
// proposition (ex: cible "PORTE", proposition "ERREUR" — le E devrait être
// vert une fois et gris/jaune l'autre fois, pas vert les deux fois). C'est
// un bug du PWA, pas un choix de design à reproduire — corrigé ici avec le
// vrai algorithme deux passes (vert d'abord en décrémentant le stock, puis
// jaune/gris), celui décrit dans le cahier des charges Drive (Enzo).
// Reste du comportement fidèle au PWA : mots choisis au hasard dans
// wordleBank, pas de mode Daily/Illimité séparé (un seul mode), pas de
// power-ups (indice, scanner — jamais vraiment câblés dans le PWA malgré
// la fonction wordleWatchAdForHint qui existe mais n'est appelée par aucun
// bouton), pas de classement/partage social.

export const WORD_BANK = [
  'TABLE', 'CHIEN', 'PORTE', 'LIVRE', 'PLAGE', 'FLEUR', 'MONDE', 'SOUPE', 'JAUNE', 'VERRE',
  'NOEUD', 'TEMPS', 'PAIRE', 'FORCE', 'GRAND', 'ROUGE', 'SALLE', 'FOYER', 'GLACE', 'RIVES',
];

export const KEYBOARD_ROWS = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['ENTER', 'W', 'X', 'C', 'V', 'B', 'N', 'BACK'],
];

export function pickTarget() {
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}

// Évalue une proposition de 5 lettres contre le mot cible. Retourne un
// tableau de 5 statuts ('correct'|'present'|'absent') — algorithme correct
// à deux passes (gère les lettres en double comme le vrai Wordle).
export function evaluateGuess(guess, target) {
  const result = Array(5).fill('absent');
  const stock = {};
  for (const ch of target) stock[ch] = (stock[ch] || 0) + 1;

  // Passe 1 : lettres bien placées
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
      stock[guess[i]]--;
    }
  }
  // Passe 2 : lettres mal placées, dans la limite du stock restant
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (stock[ch] > 0) {
      result[i] = 'present';
      stock[ch]--;
    }
  }
  return result;
}

// Met à jour l'état des touches du clavier selon la priorité correct > present > absent.
export function updateKeyboardStates(prevStates, guess, evaluation) {
  const next = { ...prevStates };
  const priority = { correct: 3, present: 2, absent: 1 };
  for (let i = 0; i < 5; i++) {
    const letter = guess[i];
    const status = evaluation[i];
    const current = next[letter];
    if (!current || priority[status] > priority[current]) {
      next[letter] = status;
    }
  }
  return next;
}

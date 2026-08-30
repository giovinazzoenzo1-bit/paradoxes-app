// Clicker de Créatures — nouveau jeu (pas un port du PWA), premier jeu du
// menu. Thème choisi avec l'utilisateur : créatures à collectionner et
// faire évoluer (esprit gacha/collection), pour viser un public 10-25 ans.
// Roster ENTIÈREMENT ORIGINAL — aucune créature, aucun nom, ne reprend
// Pokémon ou toute autre franchise protégée par le droit d'auteur ; seul
// le PRINCIPE générique (élément, 3 stades d'évolution, rareté) est repris,
// ce qui n'est pas protégeable en soi. Toute la logique ici est pure
// (aucune dépendance UI), testable en isolation.

// Chaque créature a 3 stades (base, évolution 1 à niveau 5, évolution 2 à
// niveau 15). baseIncome = pièces/seconde à niveau 1 du stade de base.
export const CREATURES = [
  { id: 'braisillon', family: 'Feu', rarity: 'commun', baseIncome: 0.15, stages: [
    { name: 'Braisillon', emoji: '🦎' }, { name: 'Brasegriffe', emoji: '🐲' }, { name: 'Infernouve', emoji: '🐉' },
  ]},
  { id: 'gouttelin', family: 'Eau', rarity: 'commun', baseIncome: 0.15, stages: [
    { name: 'Gouttelin', emoji: '🐸' }, { name: 'Marégouffre', emoji: '🐙' }, { name: 'Abyssaline', emoji: '🦑' },
  ]},
  { id: 'bourgeonin', family: 'Plante', rarity: 'commun', baseIncome: 0.15, stages: [
    { name: 'Bourgeonin', emoji: '🌱' }, { name: 'Ronceval', emoji: '🌿' }, { name: 'Florengarde', emoji: '🌺' },
  ]},
  { id: 'cailloutin', family: 'Roche', rarity: 'commun', baseIncome: 0.15, stages: [
    { name: 'Cailloutin', emoji: '🪨' }, { name: 'Rocheval', emoji: '🗿' }, { name: 'Titanroc', emoji: '⛰️' },
  ]},
  { id: 'etincelot', family: 'Foudre', rarity: 'rare', baseIncome: 0.4, stages: [
    { name: 'Étincelot', emoji: '🐹' }, { name: 'Foudrepic', emoji: '🦔' }, { name: 'Fulgurionne', emoji: '⚡' },
  ]},
  { id: 'brisillon', family: 'Vent', rarity: 'rare', baseIncome: 0.4, stages: [
    { name: 'Brisillon', emoji: '🐦' }, { name: 'Tourbillan', emoji: '🦅' }, { name: 'Zéphyrion', emoji: '🕊️' },
  ]},
  { id: 'frimouss', family: 'Glace', rarity: 'rare', baseIncome: 0.4, stages: [
    { name: 'Frimouss', emoji: '🐧' }, { name: 'Glacœur', emoji: '❄️' }, { name: 'Cristalys', emoji: '🧊' },
  ]},
  { id: 'ombrelin', family: 'Ombre', rarity: 'epique', baseIncome: 1.0, stages: [
    { name: 'Ombrelin', emoji: '🦇' }, { name: 'Nocturval', emoji: '🦉' }, { name: 'Ténébrume', emoji: '🐺' },
  ]},
  { id: 'lumeret', family: 'Lumière', rarity: 'epique', baseIncome: 1.0, stages: [
    { name: 'Lumeret', emoji: '✨' }, { name: 'Radianloup', emoji: '🦁' }, { name: 'Solarion', emoji: '☀️' },
  ]},
  { id: 'gemmion', family: 'Cristal', rarity: 'legendaire', baseIncome: 2.5, stages: [
    { name: 'Gemmion', emoji: '💎' }, { name: 'Prismatis', emoji: '🔮' }, { name: 'Éclatoile', emoji: '⭐' },
  ]},
];

export const RARITY_WEIGHTS = { commun: 60, rare: 25, epique: 12, legendaire: 3 };
export const RARITY_LABEL = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
export const RARITY_COLOR = { commun: '#9088b8', rare: '#3ec6f0', epique: '#b96bff', legendaire: '#f5c542' };

export const EVOLUTION_LEVELS = [1, 5, 15]; // niveau à partir duquel chaque stade s'active

export function stageForLevel(level) {
  if (level >= EVOLUTION_LEVELS[2]) return 2;
  if (level >= EVOLUTION_LEVELS[1]) return 1;
  return 0;
}

// Revenu passif (pièces/seconde) d'une créature possédée, selon son niveau
// et son stade d'évolution (le stade multiplie le revenu de base).
const STAGE_MULTIPLIER = [1, 2.2, 5];
export function incomeForCreature(creature, level) {
  const stage = stageForLevel(level);
  const levelBonus = 1 + (level - 1) * 0.12;
  return creature.baseIncome * STAGE_MULTIPLIER[stage] * levelBonus;
}

// Coût (en pièces) pour faire passer une créature possédée du niveau
// `level` à `level+1`.
export function levelUpCost(creature, level) {
  const rarityFactor = { commun: 1, rare: 1.6, epique: 2.6, legendaire: 4.2 }[creature.rarity];
  return Math.round(8 * Math.pow(level, 1.35) * rarityFactor);
}

// Coût d'une invocation (gacha), croissant avec le nombre de créatures
// déjà possédées (chaque nouvelle créature est un peu plus chère).
export function summonCost(ownedCount) {
  return Math.round(15 * Math.pow(1.13, ownedCount));
}

// Coût pour augmenter la puissance de tap (pièces gagnées par appui).
export function tapPowerCost(currentTapPower) {
  return Math.round(20 * Math.pow(1.55, currentTapPower - 1));
}

// Tire une créature au hasard selon les poids de rareté.
export function rollCreature() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let chosenRarity = 'commun';
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    if (r < weight) {
      chosenRarity = rarity;
      break;
    }
    r -= weight;
  }
  const pool = CREATURES.filter((c) => c.rarity === chosenRarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Revenu passif total (pièces/seconde) de toute la collection possédée.
// ownedCreatures : [{ id, level }]
export function totalPassiveIncome(ownedCreatures) {
  let sum = 0;
  for (const owned of ownedCreatures) {
    const creature = CREATURES.find((c) => c.id === owned.id);
    if (creature) sum += incomeForCreature(creature, owned.level);
  }
  return sum;
}

// Gains hors-ligne, plafonnés pour éviter les abus (4h max comptabilisées).
const OFFLINE_CAP_SECONDS = 4 * 3600;
export function offlineEarnings(ownedCreatures, secondsElapsed) {
  const capped = Math.max(0, Math.min(secondsElapsed, OFFLINE_CAP_SECONDS));
  return Math.floor(totalPassiveIncome(ownedCreatures) * capped);
}

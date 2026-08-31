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
// DEPUIS LA REFONTE : les créatures ne produisent plus de pièces
// automatiquement (seule la boutique d'auto-clics le fait désormais).
// Fonction gardée (le calcul niveau/stade reste utile comme base pour de
// futures stats de combat) mais plus appelée pour la génération de pièces.
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

// ---- Apparitions de créatures sur le bouton de tap ("le cookie") ----
// Toutes les SPAWN_INTERVAL_SEC secondes, une créature apparaît
// brièvement (SPAWN_VISIBLE_SEC) ; si le joueur tape dessus à temps, son
// pouvoir s'active. Non tapée à temps = disparaît sans effet.
export const SPAWN_INTERVAL_SEC = 60; // 1 minute (était 3 minutes)
export const SPAWN_VISIBLE_SEC = 4;

// La RARETÉ détermine l'intensité (multiplicateur de tap + durée) — garde
// une progression simple et lisible, peu importe la créature. Chaque
// CRÉATURE a en plus son propre effet secondaire thématique (son élément),
// donc 10 pouvoirs vraiment distincts plutôt que 4 pouvoirs partagés par
// palier de rareté. 3 familles d'effet secondaire, pour rester
// implémentable simplement :
//  - coins_burst : bonus de pièces immédiat à l'activation
//  - passive_boost : multiplie le revenu passif pendant la durée du pouvoir
//  - discount_next : réduit le coût du prochain achat (tap/invocation/nourrir)
const RARITY_TAP_MULTIPLIER = { commun: 2, rare: 3, epique: 5, legendaire: 10 };
const RARITY_DURATION_SEC = { commun: 10, rare: 10, epique: 15, legendaire: 15 };

export const CREATURE_POWERS = {
  braisillon: { name: 'Éruption', effectType: 'coins_burst', effectValue: 8 },
  gouttelin: { name: 'Flux Montant', effectType: 'passive_boost', effectValue: 2 },
  bourgeonin: { name: 'Éclosion Généreuse', effectType: 'discount_next', effectValue: 0.2 },
  cailloutin: { name: 'Fondation', effectType: 'coins_burst', effectValue: 8 },
  etincelot: { name: 'Décharge', effectType: 'coins_burst', effectValue: 12 },
  brisillon: { name: 'Bourrasque', effectType: 'passive_boost', effectValue: 2.5 },
  frimouss: { name: 'Conservation', effectType: 'discount_next', effectValue: 0.25 },
  ombrelin: { name: 'Éclipse', effectType: 'coins_burst', effectValue: 25 },
  lumeret: { name: 'Rayonnement', effectType: 'passive_boost', effectValue: 3 },
  gemmion: { name: 'Résonance Cristalline', effectType: 'coins_burst', effectValue: 75 },
};

// Calcule le pouvoir déclenché en tapant une créature apparue. Le bonus de
// pièces (coins_burst) est proportionnel à la puissance de tap actuelle du
// joueur (pas un montant fixe qui deviendrait négligeable en fin de partie).
export function powerForCreature(creature, tapPower) {
  const cfg = CREATURE_POWERS[creature.id];
  const tapMultiplier = RARITY_TAP_MULTIPLIER[creature.rarity];
  const durationSec = RARITY_DURATION_SEC[creature.rarity];
  return {
    name: cfg.name,
    creatureId: creature.id,
    rarity: creature.rarity,
    tapMultiplier,
    durationSec,
    effectType: cfg.effectType,
    effectValue: cfg.effectValue,
    bonusCoins: cfg.effectType === 'coins_burst' ? Math.round(cfg.effectValue * tapPower) : 0,
  };
}

// Détermine si une nouvelle créature doit apparaître, selon le temps
// écoulé depuis la dernière apparition (en millisecondes, via Date.now()
// ou performance.now() — peu importe l'unité tant qu'elle est cohérente
// entre les deux appels).
export function shouldSpawn(lastSpawnMs, nowMs) {
  return nowMs - lastSpawnMs >= SPAWN_INTERVAL_SEC * 1000;
}

// Tire une créature au hasard, mais UNIQUEMENT parmi celles placées dans
// le deck (3 emplacements, potentiellement vides = null) — remplace
// l'ancien tirage sur les 10 créatures (l'ancien système, pondéré par
// rareté, faisait qu'un joueur pouvait tester longtemps sans jamais voir
// certaines créatures, perçu comme un bug). Retourne null si le deck est
// entièrement vide (aucune apparition possible tant que rien n'y est mis).
export function pickFromDeck(deckIds) {
  const validIds = (deckIds || []).filter(Boolean);
  if (validIds.length === 0) return null;
  const id = validIds[Math.floor(Math.random() * validIds.length)];
  return CREATURES.find((c) => c.id === id) || null;
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
// Prend directement un taux de pièces/s (calculé par l'appelant) plutôt
// que la liste de créatures — les créatures ne produisent plus de revenu
// passif automatique, seuls les générateurs de la boutique d'auto-clics
// en produisent maintenant.
const OFFLINE_CAP_SECONDS = 4 * 3600;
export function offlineEarnings(incomePerSecond, secondsElapsed) {
  const capped = Math.max(0, Math.min(secondsElapsed, OFFLINE_CAP_SECONDS));
  return Math.floor(incomePerSecond * capped);
}

// ---- Faveur des Esprits (coups critiques) ----
// Chance de coup critique à chaque tap, qui grandit avec le niveau
// (achetable), plafonnée pour rester un bonus ponctuel et pas la norme.
// Le multiplicateur du coup grandit lui aussi légèrement avec le niveau.
export function critChance(level) {
  return Math.min(0.3, level * 0.025); // +2.5%/niveau, plafonné à 30%
}
export function critMultiplier(level) {
  return Math.min(10, 5 + level * 0.25); // x5 de base, jusqu'à x10 au niveau max
}
export function critUpgradeCost(level) {
  return Math.round(25 * Math.pow(1.5, level));
}
export function rollCrit(level) {
  return Math.random() < critChance(level);
}

// ---- Transe (combo) ----
// Taper vite et sans interruption fait monter un multiplicateur ; une
// pause plus longue que TRANSE_WINDOW_MS entre deux taps le fait retomber.
export const TRANSE_WINDOW_MS = 1200;
export const TRANSE_STEP = 0.04;
export const TRANSE_MAX_MULTIPLIER = 3;
export function transeMultiplier(comboCount) {
  return Math.min(TRANSE_MAX_MULTIPLIER, 1 + comboCount * TRANSE_STEP);
}
export function transeStillActive(lastTapMs, nowMs) {
  return nowMs - lastTapMs <= TRANSE_WINDOW_MS;
}

// ---- Cible dorée ----
// Apparaît par surprise à intervalle aléatoire (pas fixe, pour garder
// l'effet de surprise), visible brièvement ; tap dessus = gros bonus
// ponctuel proportionnel à la progression du joueur.
export const GOLDEN_MIN_INTERVAL_SEC = 45;
export const GOLDEN_MAX_INTERVAL_SEC = 90;
export const GOLDEN_VISIBLE_SEC = 3;
export function nextGoldenDelaySec() {
  return GOLDEN_MIN_INTERVAL_SEC + Math.random() * (GOLDEN_MAX_INTERVAL_SEC - GOLDEN_MIN_INTERVAL_SEC);
}
export function goldenBonus(tapPower) {
  return Math.round(tapPower * 40);
}

// ---- Familier (auto-clic) ----
// Un compagnon tape pour le joueur en continu — traduit en revenu/s
// supplémentaire proportionnel à la puissance de tap actuelle (pas un
// montant fixe qui deviendrait négligeable en fin de partie).
export function familiarIncome(level, tapPower) {
  return level * tapPower * 0.5;
}
export function familiarUpgradeCost(level) {
  return Math.round(40 * Math.pow(1.6, level));
}

// ---- Sanctuaire (boost global %) ----
// Multiplicateur global appliqué à TOUTE la production (tap ET revenu
// passif), pas juste au tap comme Pacte.
export function sanctuaryMultiplier(level) {
  return 1 + level * 0.05;
}
export function sanctuaryUpgradeCost(level) {
  return Math.round(60 * Math.pow(1.7, level));
}

// ---- Veilleur (gains hors-ligne) ----
export function veilleurOfflineMultiplier(level) {
  return 1 + level * 0.15;
}
export function veilleurUpgradeCost(level) {
  return Math.round(50 * Math.pow(1.6, level));
}

// ---- Ascension (prestige) ----
// Réinitialise la progression contre un bonus PERMANENT (essence), qui
// persiste à travers les résets suivants. Le gain d'essence dépend du
// total de pièces gagnées sur toute la partie (pas juste le solde
// actuel, qui peut avoir été dépensé) — récompense la progression
// globale, pas la thésaurisation.
export const ASCENSION_MIN_LIFETIME_EARNED = 50000; // seuil avant de pouvoir ascensionner
export function ascensionEssenceGain(totalCoinsEarnedLifetime) {
  if (totalCoinsEarnedLifetime < ASCENSION_MIN_LIFETIME_EARNED) return 0;
  return Math.floor(Math.sqrt(totalCoinsEarnedLifetime / 10000));
}
export function essenceBonusMultiplier(essence) {
  return 1 + essence * 0.02; // +2% de production permanente par point d'essence
}

// ---- Rituel (bouton "fausse pub" — pas de vrai SDK pour l'instant) ----
export const RITUAL_COOLDOWN_SEC = 180; // 3 minutes entre 2 utilisations
export function ritualReward(tapPower, passiveIncome) {
  return Math.round(tapPower * 100 + passiveIncome * 120);
}
export function ritualReady(lastUsedMs, nowMs) {
  return nowMs - lastUsedMs >= RITUAL_COOLDOWN_SEC * 1000;
}

// ---- Offrande (dépenser les pièces partagées appCoins de l'appli) ----
export const OFFRANDE_APPCOINS_COST = 10;
export function offrandeReward(tapPower) {
  return Math.round(tapPower * 15);
}

// ---- Système de quêtes + œuf à 4 paliers ----
// Première passe volontairement limitée aux quêtes réalisables DANS le
// clicker (internes + compétence/timing) — les quêtes liées aux autres
// jeux de l'appli (ex: "gagner 5 fois à Puissance 4") demandent une
// couche de stats partagées entre jeux qui n'existe pas encore ; à
// construire séparément avant de les ajouter à ce pool.
export const QUEST_POOL = [
  { id: 'combo25', desc: 'Atteins un multiplicateur de Transe x2,5' },
  { id: 'summon10', desc: 'Invoque 10 créatures' },
  { id: 'crit20', desc: 'Obtiens 20 coups critiques' },
  { id: 'golden3', desc: 'Touche 3 fois la cible dorée' },
  { id: 'earn5000', desc: 'Cumule 5 000 pièces gagnées au total' },
  { id: 'evolve1', desc: "Fais évoluer une créature jusqu'au stade final" },
  { id: 'feed10', desc: "Nourris une créature jusqu'au niveau 10" },
  { id: 'pacte5', desc: 'Fais monter Pacte au niveau 6' },
];

// Tire 4 quêtes au hasard dans le pool (sans répéter celles données en
// exclusion, pour varier d'un cycle d'œuf à l'autre).
export function pickQuestSet(excludeIds = []) {
  const pool = QUEST_POOL.filter((q) => !excludeIds.includes(q.id));
  const source = pool.length >= 4 ? pool : QUEST_POOL; // si pas assez pour exclure, retire du pool complet
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4).map((q) => q.id);
}

export function questLabel(questId) {
  return QUEST_POOL.find((q) => q.id === questId)?.desc || '';
}

// Progression 0-1 d'une quête donnée, à partir des stats du joueur.
// stats attendu : { maxCombo, totalSummons, totalCrits, goldenClaimed,
// totalEarned, maxCreatureLevel, tapPower }
export function questProgress(questId, stats) {
  switch (questId) {
    case 'combo25': return Math.min(1, stats.maxCombo / 2.5);
    case 'summon10': return Math.min(1, stats.totalSummons / 10);
    case 'crit20': return Math.min(1, stats.totalCrits / 20);
    case 'golden3': return Math.min(1, stats.goldenClaimed / 3);
    case 'earn5000': return Math.min(1, stats.totalEarned / 5000);
    case 'evolve1': return Math.min(1, stats.maxCreatureLevel / 15);
    case 'feed10': return Math.min(1, stats.maxCreatureLevel / 10);
    case 'pacte5': return Math.min(1, Math.max(0, stats.tapPower - 1) / 5);
    default: return 0;
  }
}
export function questComplete(questId, stats) {
  return questProgress(questId, stats) >= 1;
}

export const EGG_STAGES = [
  { name: 'Œuf endormi', desc: 'Immobile, terne' },
  { name: 'Œuf frémissant', desc: 'Petits tremblements' },
  { name: 'Œuf fissuré', desc: 'Fissures visibles' },
  { name: 'Œuf lumineux', desc: 'Lueur qui pulse' },
  { name: 'Œuf prêt à éclore', desc: 'Vibre fort, prêt !' },
];
// Nombre de quêtes validées (0-4) -> palier visuel (0-4).
export function eggStageForCompletedCount(completedCount) {
  return Math.max(0, Math.min(4, completedCount));
}

export const HATCH_TAPS_REQUIRED = 500;
export const CAPTURE_TAPS_REQUIRED = 200;

// ---- Boutique d'auto-clics ----
// Remplace l'ancien "Familier" (un seul niveau) par un vrai menu boutique
// à plusieurs générateurs, façon jeu incrémental classique : chaque
// palier a son propre coût et son propre revenu, achetable plusieurs
// fois (le coût grimpe à chaque achat du MÊME palier). Nécessaire suite
// à la décision de retirer le revenu passif automatique des créatures —
// c'est maintenant la seule source de revenu passif du jeu.
export const AUTOCLICKERS = [
  { id: 'esprit', name: 'Esprit Frappeur', emoji: '👻', baseCost: 15, baseIncome: 0.1 },
  { id: 'main', name: 'Main Spectrale', emoji: '🖐️', baseCost: 100, baseIncome: 1 },
  { id: 'automate', name: 'Automate Runique', emoji: '⚙️', baseCost: 1100, baseIncome: 8 },
  { id: 'colonie', name: 'Colonie de Familiers', emoji: '🦊', baseCost: 12000, baseIncome: 47 },
  { id: 'titan', name: 'Titan Mécanique', emoji: '🗿', baseCost: 130000, baseIncome: 260 },
];

// Coût pour acheter UNE unité de plus d'un générateur donné, sachant
// combien on en possède déjà (le coût grimpe à chaque achat du même palier).
export function autoClickerCost(clicker, ownedCount) {
  return Math.round(clicker.baseCost * Math.pow(1.15, ownedCount));
}

// Revenu total/s de tous les générateurs possédés.
// ownedAutoClickers : { esprit: 3, main: 1, ... }
export function totalAutoClickIncome(ownedAutoClickers) {
  let sum = 0;
  for (const clicker of AUTOCLICKERS) {
    const count = ownedAutoClickers[clicker.id] || 0;
    sum += count * clicker.baseIncome;
  }
  return sum;
}

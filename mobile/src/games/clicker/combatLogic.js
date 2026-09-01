// Logique pure du mode Aventure / Combat — voir mobile/ADVENTURE_MODE.md
// pour le design complet. Aucun écran ne dépend encore de ce fichier :
// c'est l'étape 1 du plan de construction (fonctions testables d'abord).
import { CREATURES } from './clickerLogic';

// ---- Stats de combat par rareté ----
// Base différente des pièces/tap : ici on veut un vrai sentiment de
// progression (PV, Attaque), pas un revenu passif.
export const RARITY_BASE_STATS = {
  commun: { hp: 80, attack: 12 },
  rare: { hp: 120, attack: 18 },
  epique: { hp: 180, attack: 28 },
  legendaire: { hp: 280, attack: 45 },
};

// Stats de combat d'une créature possédée par le joueur, selon sa
// rareté et son niveau ACTUEL (celui qu'on monte déjà en la nourrissant
// dans le clicker classique — ça lui donne enfin une 2e utilité).
export function combatStatsForCreature(creature, level) {
  const base = RARITY_BASE_STATS[creature.rarity];
  const levelMult = 1 + (level - 1) * 0.08;
  return {
    hp: Math.round(base.hp * levelMult),
    attack: Math.round(base.attack * levelMult),
  };
}

// ---- Chapitres / niveaux ----
export const LEVELS_PER_CHAPTER = 10;

export function chapterForLevel(levelNumber) {
  return Math.ceil(levelNumber / LEVELS_PER_CHAPTER);
}
// Position du niveau DANS son chapitre (1 à 10).
export function levelIndexInChapter(levelNumber) {
  return ((levelNumber - 1) % LEVELS_PER_CHAPTER) + 1;
}

// Choix de l'adversaire pour un niveau donné — déterministe (pas
// aléatoire), pour que le même niveau donne toujours le même adversaire
// d'une tentative à l'autre. Cycle sur les 10 créatures existantes (pas
// de nouveau roster pour l'instant, voir ADVENTURE_MODE.md).
export function opponentForLevel(levelNumber) {
  const idx = (levelNumber - 1) % CREATURES.length;
  return CREATURES[idx];
}

// Stats de l'adversaire pour un niveau donné — grossissent avec le
// numéro de niveau (pas avec un "niveau nourri" comme le joueur, ça n'a
// pas de sens pour une IA). Croissance volontairement un peu plus
// marquée que celle du joueur pour garder un vrai défi à mesure qu'on
// monte les chapitres.
export function opponentStatsForLevel(levelNumber) {
  const creature = opponentForLevel(levelNumber);
  const base = RARITY_BASE_STATS[creature.rarity];
  const growth = 1 + (levelNumber - 1) * 0.15;
  return {
    hp: Math.round(base.hp * growth),
    attack: Math.round(base.attack * growth),
  };
}

// ---- Défi de tap (attaque du joueur) ----
export const TAP_CHALLENGE_COUNT = 50;
export const TAP_CHALLENGE_TIME_LIMIT_SEC = 12; // fenêtre pour compléter les 50 taps
export const TAP_CHALLENGE_FAST_THRESHOLD_SEC = 4; // en dessous = multiplicateur max
export const TAP_CHALLENGE_MIN_MULTIPLIER = 1; // complété mais lentement
export const TAP_CHALLENGE_MAX_MULTIPLIER = 2.5; // complété très vite
export const TAP_CHALLENGE_INCOMPLETE_MULTIPLIER = 0.5; // pas fini à temps, attaque affaiblie

// Multiplicateur de dégâts selon le temps mis pour les 50 taps.
// - Pas complété dans le temps imparti -> multiplicateur réduit fixe
//   (l'attaque part quand même, juste affaiblie, jamais annulée).
// - Complété en moins de TAP_CHALLENGE_FAST_THRESHOLD_SEC -> multiplicateur max.
// - Complété pile à la limite -> multiplicateur min.
// - Entre les deux -> interpolation linéaire.
export function damageMultiplierForTime(elapsedSec, completed) {
  if (!completed) return TAP_CHALLENGE_INCOMPLETE_MULTIPLIER;
  if (elapsedSec <= TAP_CHALLENGE_FAST_THRESHOLD_SEC) return TAP_CHALLENGE_MAX_MULTIPLIER;
  if (elapsedSec >= TAP_CHALLENGE_TIME_LIMIT_SEC) return TAP_CHALLENGE_MIN_MULTIPLIER;
  const t =
    (elapsedSec - TAP_CHALLENGE_FAST_THRESHOLD_SEC) /
    (TAP_CHALLENGE_TIME_LIMIT_SEC - TAP_CHALLENGE_FAST_THRESHOLD_SEC);
  return TAP_CHALLENGE_MAX_MULTIPLIER - t * (TAP_CHALLENGE_MAX_MULTIPLIER - TAP_CHALLENGE_MIN_MULTIPLIER);
}

// ---- Résolution d'un tour ----
export function computePlayerDamage(attackerAttack, multiplier) {
  return Math.max(1, Math.round(attackerAttack * multiplier));
}

// Un tour complet : le joueur attaque (dégâts déjà calculés en amont via
// computePlayerDamage), puis si l'adversaire survit, il riposte
// automatiquement. Retourne les nouveaux PV des deux côtés + l'issue.
export function resolveRound(playerHp, opponentHp, opponentAttack, playerDamage) {
  const newOpponentHp = Math.max(0, opponentHp - playerDamage);
  if (newOpponentHp <= 0) {
    return { playerHp, opponentHp: 0, dmgToOpponent: playerDamage, dmgToPlayer: 0, outcome: 'win' };
  }
  const dmgToPlayer = Math.max(1, Math.round(opponentAttack));
  const newPlayerHp = Math.max(0, playerHp - dmgToPlayer);
  return {
    playerHp: newPlayerHp,
    opponentHp: newOpponentHp,
    dmgToOpponent: playerDamage,
    dmgToPlayer,
    outcome: newPlayerHp <= 0 ? 'lose' : 'ongoing',
  };
}

// ---- Récompense (ressource "Griffes", nom provisoire) ----
export function griffesReward(levelNumber) {
  return 5 + Math.floor(levelNumber * 1.5);
}

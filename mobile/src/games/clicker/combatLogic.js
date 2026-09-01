// Logique pure du mode Aventure / Combat — voir mobile/ADVENTURE_MODE.md
// pour le design complet. Aucun écran ne dépend encore de ce fichier :
// c'est l'étape 1 du plan de construction (fonctions testables d'abord).
import { CREATURES } from './clickerLogic';

// ---- Stats de combat par rareté ----
// Recalibré (29/08) à partir d'un exemple réel produit par le
// générateur Gemini de l'utilisateur : Solarion (Épique, Attaquant,
// PV95/ATQ38). En retirant le modificateur de type Attaquant (x0,8 PV /
// x1,3 ATQ), on obtient la base "équilibrée" épique ≈ PV119/ATQ29, qui
// sert d'ancrage à toute la progression ci-dessous (ratio géométrique
// ~x2,28 PV / ~x2,13 ATQ par palier, en partant de commun=PV10/ATQ3
// comme précisé dans le prompt Gemini). "mythique" défini mais pas
// encore utilisé par aucune créature.
export const RARITY_BASE_STATS = {
  commun: { hp: 10, attack: 3, clickSpeed: 1.0, endurance: 60 },
  peu_commun: { hp: 23, attack: 6, clickSpeed: 1.2, endurance: 75 },
  rare: { hp: 52, attack: 14, clickSpeed: 1.4, endurance: 95 },
  epique: { hp: 119, attack: 29, clickSpeed: 1.8, endurance: 120 },
  legendaire: { hp: 272, attack: 62, clickSpeed: 2.2, endurance: 150 },
  mythique: { hp: 620, attack: 132, clickSpeed: 2.8, endurance: 190 },
};

// Stats de combat d'une créature possédée par le joueur, selon sa
// rareté et son niveau ACTUEL (celui qu'on monte déjà en la nourrissant
// dans le clicker classique — ça lui donne enfin une 2e utilité).
// Si la créature a ses propres stats de base (fournies par Gemini —
// champs baseHp/baseAttack/baseClickSpeed/baseEndurance), on les utilise
// TELLES QUELLES plutôt que la formule par rareté — Gemini connaît déjà
// le rôle de la créature au moment de choisir ses chiffres, pas la peine
// d'appliquer un multiplicateur de type par-dessus (risque de double
// application). Repli sur la formule uniquement pour les créatures qui
// n'ont pas encore été régénérées par Gemini.
export function combatStatsForCreature(creature, level) {
  const base = creature.baseHp != null
    ? { hp: creature.baseHp, attack: creature.baseAttack, clickSpeed: creature.baseClickSpeed, endurance: creature.baseEndurance }
    : RARITY_BASE_STATS[creature.rarity];
  const levelMult = 1 + (level - 1) * 0.08;
  return {
    hp: Math.round(base.hp * levelMult),
    attack: Math.round(base.attack * levelMult),
    // La vitesse de clic ne monte PAS avec le niveau (sinon le défi de
    // tap deviendrait trivial en fin de partie) — seule l'endurance suit
    // la même progression que PV/Attaque.
    clickSpeed: base.clickSpeed,
    endurance: Math.round(base.endurance * levelMult),
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
  const base = creature.baseHp != null
    ? { hp: creature.baseHp, attack: creature.baseAttack, clickSpeed: creature.baseClickSpeed, endurance: creature.baseEndurance }
    : RARITY_BASE_STATS[creature.rarity];
  const growth = 1 + (levelNumber - 1) * 0.15;
  return {
    hp: Math.round(base.hp * growth),
    attack: Math.round(base.attack * growth),
    clickSpeed: base.clickSpeed,
    endurance: Math.round(base.endurance * growth),
  };
}

// ---- Défi de tap (attaque du joueur) ----
// 25 pour l'instant (au lieu de 50) — demande explicite pour la phase de
// développement, plus rapide à tester en boucle. À remonter à 50 si
// besoin une fois l'équilibrage validé.
export const TAP_CHALLENGE_COUNT = 25;
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

// ---- Évolution par palier (créatures au format Gemini, SANS changement
// de nom — contrairement aux 10 créatures d'origine qui ont 3 noms/
// dessins distincts par stade). Contrairement au niveau (qui monte en
// nourrissant avec des pièces), l'évolution est un choix DÉLIBÉRÉ du
// joueur, débloqué par le niveau ET payé en Griffes gagnées au combat
// (et plus tard via certaines quêtes) — pas automatique.
export const EVOLUTION_LEVEL_REQUIREMENT = [0, 25, 50]; // niveau requis pour le palier 1, 2
export const EVOLUTION_STAT_MULTIPLIER = [1.0, 1.3, 1.7]; // boost de PV/ATQ/Endurance par palier
export const EVOLUTION_GRIFFES_COST = [0, 40, 100]; // coût en Griffes pour débloquer le palier

export function canEvolve(currentTier, ownedLevel) {
  const nextTier = currentTier + 1;
  if (nextTier > 2) return false;
  return ownedLevel >= EVOLUTION_LEVEL_REQUIREMENT[nextTier];
}
export function evolutionCost(currentTier) {
  const nextTier = currentTier + 1;
  return nextTier > 2 ? null : EVOLUTION_GRIFFES_COST[nextTier];
}

// ---- Type de monstre (Attaquant / Soutien / Tank) ----
// Chaque créature a maintenant, en plus de sa rareté, un TYPE de combat
// qui modifie ses stats de base : le Tank encaisse plus mais frappe
// moins fort, l'Attaquant l'inverse, le Soutien reste équilibré (sa
// valeur est censée venir de ses compétences, pas de stats brutes).
export const MONSTER_TYPES = {
  attaquant: { label: 'Attaquant', hpMult: 0.8, attackMult: 1.3 },
  soutien: { label: 'Soutien', hpMult: 1.0, attackMult: 0.95 },
  tank: { label: 'Tank', hpMult: 1.4, attackMult: 0.75 },
};

// Version de combatStatsForCreature qui applique EN PLUS le modificateur
// du type — remplace l'ancienne fonction dans les nouveaux usages (le
// choix du type se fait maintenant par créature, pas par rareté seule).
export function combatStatsForCreatureTyped(creature, level, evolutionTier = 0) {
  const base = combatStatsForCreature(creature, level);
  // Le multiplicateur de type ne s'applique QUE pour les créatures qui
  // suivent encore la formule par rareté — les créatures avec des stats
  // Gemini explicites (baseHp défini) ont déjà leur rôle pris en compte
  // par Gemini au moment de choisir les chiffres, l'appliquer ici
  // reviendrait à le compter deux fois.
  const typeMod = creature.baseHp != null ? { hpMult: 1, attackMult: 1 } : (MONSTER_TYPES[creature.combatType] || MONSTER_TYPES.attaquant);
  const evoMult = EVOLUTION_STAT_MULTIPLIER[evolutionTier] || 1;
  return {
    hp: Math.round(base.hp * typeMod.hpMult * evoMult),
    attack: Math.round(base.attack * typeMod.attackMult * evoMult),
    // La vitesse de clic n'est jamais boostée par l'évolution — le défi
    // de tap ne doit pas devenir plus dur à réussir en évoluant, seule
    // la PUISSANCE des attaques doit grandir.
    clickSpeed: base.clickSpeed,
    endurance: Math.round(base.endurance * evoMult),
  };
}

// Même chose pour l'adversaire IA (stats déjà mises à l'échelle par
// niveau via opponentStatsForLevel, puis modifiées par le type).
export function opponentStatsForLevelTyped(levelNumber) {
  const base = opponentStatsForLevel(levelNumber);
  const creature = opponentForLevel(levelNumber);
  const typeMod = creature.baseHp != null ? { hpMult: 1, attackMult: 1 } : (MONSTER_TYPES[creature.combatType] || MONSTER_TYPES.attaquant);
  return {
    hp: Math.round(base.hp * typeMod.hpMult),
    attack: Math.round(base.attack * typeMod.attackMult),
    clickSpeed: base.clickSpeed,
    endurance: base.endurance,
  };
}

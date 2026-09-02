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
// Croissance des PV/Attaque par niveau — linéaire (+8%/niveau) jusqu'au
// niveau 50, puis ralentie (+2%/niveau) au-delà. Sans ce ralentissement,
// une seule créature beaucoup nourrie grandirait sans limite (×8,9 à
// niveau 100, ×16,9 à niveau 200...), largement plus vite que la
// progression des adversaires en Aventure (liée au niveau de CHAPITRE,
// pas au niveau de la créature) — un grind extrême pouvait tout
// déséquilibrer. Le seuil de 50 reprend un repère déjà existant dans le
// jeu (2e palier d'évolution).
export function levelMultiplier(level) {
  if (level <= 50) return 1 + (level - 1) * 0.08;
  const atFifty = 1 + 49 * 0.08; // = 4,92 — valeur exacte au niveau 50
  return atFifty + (level - 50) * 0.02;
}

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
  const levelMult = levelMultiplier(level);
  return {
    hp: Math.round(base.hp * levelMult),
    attack: Math.round(base.attack * levelMult),
    // La vitesse de clic ne monte PAS avec le niveau (sinon le défi de
    // tap deviendrait trivial en fin de partie) — seule l'endurance suit
    // la même progression que PV/Attaque.
    //
    // TOUJOURS dérivée de la rareté (RARITY_BASE_STATS), jamais de la
    // valeur donnée par Gemini pour cette créature précise : Gemini a
    // systématiquement renvoyé "1" pour cette stat sur les 26 créatures
    // intégrées jusqu'ici (contrairement à PV/ATQ/Endurance qui varient
    // vraiment), la rendant plate et sans intérêt. La progression par
    // rareté (1,0 → 1,2 → 1,4 → 1,8 → 2,2 → 2,8) est déjà cohérente et
    // logique, on s'y appuie systématiquement à la place.
    clickSpeed: RARITY_BASE_STATS[creature.rarity].clickSpeed,
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

// Score de puissance approximatif d'une créature (PV+ATQ de base) — sert
// UNIQUEMENT à ordonner les adversaires du plus faible au plus fort, pas
// utilisé pour le combat réel (qui utilise toujours les vraies stats
// mises à l'échelle par niveau/évolution/type).
function powerScore(creature) {
  const base = creature.baseHp != null
    ? { hp: creature.baseHp, attack: creature.baseAttack }
    : RARITY_BASE_STATS[creature.rarity];
  return base.hp + base.attack;
}

// Roster trié une seule fois au chargement du module (30/08) — les
// adversaires apparaissent maintenant du plus faible au plus fort à
// mesure qu'on avance dans les niveaux, au lieu de suivre l'ordre
// arbitraire de définition dans CREATURES.
const CREATURES_BY_POWER = [...CREATURES].sort((a, b) => powerScore(a) - powerScore(b));

// Choix de l'adversaire pour un niveau donné — déterministe (pas
// aléatoire), pour que le même niveau donne toujours le même adversaire
// d'une tentative à l'autre. Cycle sur le roster TRIÉ PAR PUISSANCE
// (voir CREATURES_BY_POWER) : le niveau 1 tombe sur la créature la plus
// faible, le niveau 26 sur la plus forte, puis ça reboucle (mais les
// stats continuent de grossir avec le niveau via opponentStatsForLevel,
// donc même une créature "faible" qui revient plus tard reste un vrai défi).
export function opponentForLevel(levelNumber) {
  const idx = (levelNumber - 1) % CREATURES_BY_POWER.length;
  return CREATURES_BY_POWER[idx];
}

// Taille de l'équipe adverse selon le CHAPITRE (pas le niveau brut) — 1
// adversaire au chapitre 1, 2 au chapitre 2, 3 à partir du chapitre 3.
// Reprend le même repère que le reste du système (LEVELS_PER_CHAPTER),
// pas un seuil arbitraire inventé à part.
export function opponentTeamSize(levelNumber) {
  const chapter = chapterForLevel(levelNumber);
  if (chapter <= 1) return 1;
  if (chapter === 2) return 2;
  return 3;
}

// Équipe adverse complète pour un niveau donné — plusieurs créatures
// DIFFÉRENTES (pas 3x la même), toujours déterministe. Le décalage (+9,
// +18) pris dans le roster trié par puissance pour varier les membres
// sans avoir besoin d'un vrai tirage aléatoire.
export function opponentTeamForLevel(levelNumber) {
  const size = opponentTeamSize(levelNumber);
  const team = [];
  for (let i = 0; i < size; i++) {
    const idx = (levelNumber - 1 + i * 9) % CREATURES_BY_POWER.length;
    team.push(CREATURES_BY_POWER[idx]);
  }
  return team;
}

// Qui attaque en premier — 1 chance sur 2 que ce soit l'adversaire,
// comme demandé. Fonction séparée (plutôt qu'un Math.random() en ligne
// dans l'écran) pour rester testable.
export function opponentGoesFirst() {
  return Math.random() < 0.5;
}

// Stats de l'adversaire pour un niveau donné — grossissent avec le
// numéro de niveau (pas avec un "niveau nourri" comme le joueur, ça n'a
// pas de sens pour une IA). Croissance volontairement un peu plus
// marquée que celle du joueur pour garder un vrai défi à mesure qu'on
// monte les chapitres.
// Stats d'une créature adverse ARBITRAIRE à un niveau donné — extrait de
// opponentStatsForLevel pour pouvoir calculer les stats de PLUSIEURS
// adversaires différents au même niveau (équipe adverse à partir du
// chapitre 2), pas seulement l'unique adversaire renvoyé par
// opponentForLevel. opponentStatsForLevel devient un simple cas
// particulier de cette fonction plus générale.
// Budget de puissance (PV+ATQ combinés) PUR par niveau — indépendant de
// la créature précisément piochée à ce niveau. Sans ça (ancienne
// version : dégâts dérivés directement des stats de base de la
// créature), la difficulté pouvait RECULER : le cycle des 26 créatures
// repart du début après le niveau 26, et si une créature "faible" (PV+ATQ
// de base ~13) réapparaît à un niveau élevé, sa croissance par niveau ne
// suffit pas toujours à dépasser une créature "forte" (~220) apparue à un
// niveau plus bas — repéré par un vrai test (niveau 70 plus faible que
// niveau 60). Calibré pour retomber presque exactement sur les stats
// réelles de Solarion/Solstral aux niveaux où ils apparaissaient déjà,
// donc aucun changement perceptible en tout début de partie.
function opponentPowerBudget(levelNumber) {
  return 13 * Math.pow(1.062, levelNumber - 1);
}

export function statsForOpponentCreature(creature, levelNumber) {
  const base = creature.baseHp != null
    ? { hp: creature.baseHp, attack: creature.baseAttack, clickSpeed: creature.baseClickSpeed, endurance: creature.baseEndurance }
    : RARITY_BASE_STATS[creature.rarity];
  const growth = 1 + (levelNumber - 1) * 0.15;

  // PV/ATQ viennent du budget de puissance PUR (garantit une croissance
  // strictement monotone), réparti selon le PROFIL propre de la
  // créature (une créature à dominante PV dans son propre roster reste
  // relativement plus "tanky" qu'ATQ une fois remise à l'échelle) —
  // garde la saveur de chaque créature sans dépendre de sa magnitude
  // absolue, qui variait trop d'une créature à l'autre pour rester
  // cohérente une fois le cycle des 26 créatures repris depuis le début.
  const budget = opponentPowerBudget(levelNumber);
  const hpRatio = base.hp / Math.max(1, base.hp + base.attack);

  return {
    hp: Math.max(1, Math.round(budget * hpRatio)),
    attack: Math.max(1, Math.round(budget * (1 - hpRatio))),
    // Voir combatStatsForCreature : toujours dérivée de la rareté, jamais
    // de la valeur Gemini (systématiquement 1, donc plate/inutile).
    clickSpeed: RARITY_BASE_STATS[creature.rarity].clickSpeed,
    endurance: Math.round(base.endurance * growth),
  };
}

// Cas particulier : stats de l'UNIQUE adversaire renvoyé par
// opponentForLevel (gardé pour compatibilité, les niveaux à équipe
// adverse multiple utilisent statsForOpponentCreature directement).
export function opponentStatsForLevel(levelNumber) {
  return statsForOpponentCreature(opponentForLevel(levelNumber), levelNumber);
}

// Version typée (avec modificateur de rôle) pour une créature adverse
// arbitraire — même règle que côté joueur : pas de multiplicateur de
// type pour les créatures Gemini (déjà pris en compte par Gemini lui-même).
export function statsForOpponentCreatureTyped(creature, levelNumber) {
  const base = statsForOpponentCreature(creature, levelNumber);
  const typeMod = creature.baseHp != null ? { hpMult: 1, attackMult: 1 } : (MONSTER_TYPES[creature.combatType] || MONSTER_TYPES.attaquant);
  return {
    hp: Math.round(base.hp * typeMod.hpMult),
    attack: Math.round(base.attack * typeMod.attackMult),
    clickSpeed: base.clickSpeed,
    endurance: base.endurance,
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

// Nombre de taps RÉELLEMENT requis pour la créature active, réduit selon
// sa vitesse de clic (1,0 à 2,8 selon la rareté) — "réduit le temps réel
// nécessaire" comme demandé : moins de taps à faire = fini plus vite en
// temps réel, PAS une fenêtre de temps raccourcie (qui deviendrait vite
// physiquement impossible à haute vitesse). Plancher à 10 taps pour que
// le mini-jeu garde un minimum de sens même pour un Mythique (2,8 → 9
// arrondi, mais plafonné à 10) — pas de créature "quasi gratuite".
export const TAP_CHALLENGE_MIN_COUNT = 10;
export function effectiveTapCount(clickSpeed) {
  return Math.max(TAP_CHALLENGE_MIN_COUNT, Math.round(TAP_CHALLENGE_COUNT / clickSpeed));
}

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

// ---- Mise à l'échelle des dégâts par la stat ATQ (30/08) ----
// Chaque compétence a ses propres dégâts fixes (donnés par Gemini), mais
// ils doivent grandir avec le niveau et l'évolution de la créature —
// sinon nourrir/faire évoluer une créature n'a AUCUN effet sur ses
// dégâts réels en combat (seule l'attaque de base gratuite utilisait
// l'ATQ jusqu'ici). Le ratio ATQ actuel / ATQ de base sert de facteur
// d'échelle appliqué à CHAQUE compétence, en plus (pas à la place) du
// multiplicateur de vitesse de tap déjà existant.
//
// Stable par construction : au niveau 1 sans évolution, ratio = 1 →
// comportement identique à avant ce changement pour toute créature
// existante. Le ratio grandit ensuite avec `levelMultiplier` (déjà
// plafonné à rendements décroissants après le niveau 50) et le
// multiplicateur d'évolution — aucune nouvelle courbe à équilibrer,
// on réutilise les garde-fous déjà en place.
export function baseAttackFor(creature) {
  return creature.baseAttack != null ? creature.baseAttack : RARITY_BASE_STATS[creature.rarity].attack;
}

export function attackRatio(creature, currentAttack) {
  const base = baseAttackFor(creature);
  return base > 0 ? currentAttack / base : 1;
}

// Dégâts d'une compétence, mis à l'échelle par le ratio ATQ actuel/ATQ de
// base — à appliquer sur les VRAIES compétences (skill.damage), jamais
// sur l'attaque de base gratuite (déjà dérivée directement de l'ATQ
// actuel, l'appliquer ici la compterait deux fois).
export function scaledSkillDamage(skill, creature, currentAttack) {
  return skill.damage * attackRatio(creature, currentAttack);
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
// ---- Runes (30/08) — table validée avec l'utilisateur avant implémentation ----
// 4 types, 5 paliers chacun, progression à rendements légèrement
// décroissants (même logique que le plafond de croissance de l'ATQ par
// niveau) pour qu'un palier 5 reste fort sans devenir abusé.
export const RUNE_BONUS_TABLE = {
  force: [0.04, 0.08, 0.13, 0.19, 0.27], // % bonus ATQ
  vitalite: [0.05, 0.10, 0.16, 0.23, 0.32], // % bonus PV
  endurance: [0.06, 0.12, 0.19, 0.27, 0.37], // % bonus Endurance max
  celerite: [0.10, 0.20, 0.35, 0.50, 0.70], // bonus ADDITIF sur le plafond du multiplicateur de dégâts (x2,5 de base)
};

// Additionne les bonus de TOUTES les runes équipées (jusqu'à 3) sur une
// créature — plusieurs runes du même type s'additionnent simplement
// entre elles (pas de rendements décroissants supplémentaires entre
// runes, seulement au sein de la progression de palier d'UNE rune).
export function runeBonuses(equippedRunes) {
  const totals = { atkPct: 0, hpPct: 0, endurancePct: 0, dmgMultBonus: 0 };
  (equippedRunes || []).forEach((r) => {
    if (!r) return;
    const table = RUNE_BONUS_TABLE[r.type];
    if (!table) return;
    const val = table[Math.max(0, Math.min(4, r.level - 1))];
    if (r.type === 'force') totals.atkPct += val;
    else if (r.type === 'vitalite') totals.hpPct += val;
    else if (r.type === 'endurance') totals.endurancePct += val;
    else if (r.type === 'celerite') totals.dmgMultBonus += val;
  });
  return totals;
}

export function combatStatsForCreatureTyped(creature, level, evolutionTier = 0, equippedRunes = []) {
  const base = combatStatsForCreature(creature, level);
  // Le multiplicateur de type ne s'applique QUE pour les créatures qui
  // suivent encore la formule par rareté — les créatures avec des stats
  // Gemini explicites (baseHp défini) ont déjà leur rôle pris en compte
  // par Gemini au moment de choisir les chiffres, l'appliquer ici
  // reviendrait à le compter deux fois.
  const typeMod = creature.baseHp != null ? { hpMult: 1, attackMult: 1 } : (MONSTER_TYPES[creature.combatType] || MONSTER_TYPES.attaquant);
  const evoMult = EVOLUTION_STAT_MULTIPLIER[evolutionTier] || 1;
  // 4e paramètre optionnel, défaut [] — un appel existant sans runes
  // (partout ailleurs dans le code pour l'instant) donne des bonus nuls
  // et reproduit EXACTEMENT le comportement d'avant, aucune régression.
  const bonus = runeBonuses(equippedRunes);
  return {
    hp: Math.round(base.hp * typeMod.hpMult * evoMult * (1 + bonus.hpPct)),
    attack: Math.round(base.attack * typeMod.attackMult * evoMult * (1 + bonus.atkPct)),
    // La vitesse de clic n'est jamais boostée par l'évolution — le défi
    // de tap ne doit pas devenir plus dur à réussir en évoluant, seule
    // la PUISSANCE des attaques doit grandir.
    clickSpeed: base.clickSpeed,
    endurance: Math.round(base.endurance * evoMult * (1 + bonus.endurancePct)),
    // Exposé pour que CombatScreen l'ajoute au plafond du multiplicateur
    // de vitesse de tap (Rune de Célérité) — pas une vraie "stat" au
    // sens PV/ATQ/Endurance, juste transporté avec le reste.
    dmgMultBonus: bonus.dmgMultBonus,
  };
}

// Même chose pour l'adversaire IA (stats déjà mises à l'échelle par
// niveau via opponentStatsForLevel, puis modifiées par le type).
export function opponentStatsForLevelTyped(levelNumber) {
  return statsForOpponentCreatureTyped(opponentForLevel(levelNumber), levelNumber);
}

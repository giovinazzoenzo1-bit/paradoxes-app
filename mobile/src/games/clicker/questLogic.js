// Défis (quêtes) et paliers de l'œuf.
//
// Extrait de `clickerLogic.js` le 14/09 : ces ~700 lignes n'avaient rien
// à faire dans le fichier de logique du clicker, et s'y perdaient.
//
// Dépendance à SENS UNIQUE : ce fichier importe clickerLogic, jamais
// l'inverse. Vérifié : aucun symbole d'ici n'est utilisé par
// clickerLogic, donc pas de cycle d'imports.
// Moteur des défis : cibles, progression, validation, tirage.
// Les DÉFINITIONS vivent dans `questDefs.js`.
import { EGG_STAGES, QUEST_SEQUENCE, QUEST_POOL } from './questDefs';
import { fmtQ, qtyQ, roundQuestTarget, describeAdventureLevel } from './questFormat';
import { questBudget, estimatedIncomePerSecond, ascensionCoinMultiplier, ASCENSION_COIN_TARGET_RATE } from './questBudget';

// Ré-exportés pour que les écrans continuent d'importer depuis ici.
export { EGG_STAGES, QUEST_SEQUENCE, QUEST_POOL };
export { fmtQ, qtyQ, describeAdventureLevel, roundQuestTarget };
export { questBudget, estimatedIncomePerSecond, ascensionCoinMultiplier, ASCENSION_COIN_TARGET_RATE };

import {
  AUTOCLICKERS,
  SANCTUARY_MAX_LEVEL,
  UPGRADE_ITEMS,
  VEILLEUR_MAX_LEVEL,
  autoClickerCost,
  TAP_UPGRADES,
  tapUpgradeCost,
  coreUpgradeUnlocked,
  critChance,
  critUpgradeCost,
  normalizeTapUpgrades,
  normalizeUpgradeLevels,
  sanctuaryUpgradeCost,
  summonCost,
  tapPowerCost,
  upgradeItemCost,
  veilleurUpgradeCost,
} from './clickerLogic';


// Tous les défis scriptés à plat, pour que questProgress/questDetail les
// retrouvent par id exactement comme ceux du pool dynamique.
export const SEQUENCE_QUESTS = QUEST_SEQUENCE.flat();

// ---- RÉPÉTITION de la séquence (15/09) ----
//
// La séquence scriptée compte 10 cycles. Au-delà, on la REJOUE en
// montant la difficulté : le joueur retrouve des défis connus, mais plus
// exigeants. Nombre de défis illimité, sans en écrire de nouveaux.
//
// ⚠️ Deux familles, deux progressions — c'est le point décisif :
//   - les COMPTES (cibles dorées, critiques, pouvoirs, invocations…) se
//     MULTIPLIENT : demander 2× plus de clics coûte 2× plus de temps ;
//   - les NIVEAUX (Pacte, Sanctuaire, auto-clics, améliorations)
//     s'ADDITIONNENT : leur coût DOUBLE à chaque niveau, donc multiplier
//     le NIVEAU multiplie le coût de façon astronomique.
//
// Mesuré : multiplier aussi les niveaux faisait passer la 2e passe de
// 17,5 h à **4266 h**. Avec la séparation, elle passe à 23 h — soit
// ×1,32, une vraie montée sans mur.
//
// Les montants en PIÈCES ne sont pas touchés : ils se calibrent déjà sur
// la production, elle-même indexée sur les Ascensions (×1,45).
export const REPEAT_COUNT_RATE = 1.5;   // multiplicateur des comptes
export const REPEAT_LEVEL_STEP = 2;     // niveaux ajoutés par passe

const METRIQUES_NIVEAU = [
  'tapPower', 'sanctuaryLevel', 'veilleurLevel', 'critLevel',
  'maxCreatureLevel', 'maxEvolutionTier', 'advLevelReached',
];

export function metricIsLevel(metric) {
  if (!metric) return false;
  return METRIQUES_NIVEAU.includes(metric)
    || metric.startsWith('upgrade:') || metric.startsWith('auto:') || metric.startsWith('tapUpgrade:');
}

// Combien de fois la séquence a déjà été parcourue. 0 au premier passage.
// ⚠️ Une ASCENSION compte comme une PASSE.
//
// Elle remet l'économie à zéro : le joueur refait exactement le même
// parcours, il doit donc affronter le même cran de difficulté qu'une
// répétition de séquence.
//
// Sans ça, les défis revenaient À L'IDENTIQUE après une Ascension
// (« Pacte niveau 5 », « obtiens 450 pièces ») : le ×1,45 par Ascension
// multipliait un budget reparti de ZÉRO, et 1,45 × presque rien reste
// presque rien.
export function effectiveTier(index, ascensionCount) {
  return repeatTier(index) + Math.max(0, Math.floor(ascensionCount || 0));
}

export function repeatTier(index) {
  // Longueur lue sur le tableau : `SEQUENCE_LENGTH` est déclaré plus
  // bas et un `const` n'est pas utilisable avant sa ligne.
  return Math.max(0, Math.floor((index || 0) / Math.max(1, QUEST_SEQUENCE.length)));
}

// Applique la progression de répétition à une cible FIXE.
export function applyRepeatTier(quest, target, index, ascensionCount = 0) {
  const tier = effectiveTier(index, ascensionCount);
  if (!tier || !quest) return target;
  if (metricIsLevel(quest.metric)) return target + REPEAT_LEVEL_STEP * tier;
  return Math.max(1, Math.round(target * Math.pow(REPEAT_COUNT_RATE, tier)));
}

export function sequenceCycle(index) {
  if (!QUEST_SEQUENCE.length) return null;
  // ⚠️ On REBOUCLE au lieu de renvoyer `null` : la séquence se rejoue
  // indéfiniment, la difficulté montant d'un cran à chaque tour.
  return QUEST_SEQUENCE[(index || 0) % QUEST_SEQUENCE.length];
}
export const SEQUENCE_LENGTH = QUEST_SEQUENCE.length;

// ---- Défis de l'œuf (refonte 02/09) ----
//
// Un défi ne stocke plus une cible chiffrée mais un **temps de farm**
// (`effortMin`). La cible réelle est calculée au tirage à partir du
// revenu du joueur, puis figée — voir `resolveQuestTarget()` plus bas.
//
// Pourquoi : une cible en dur n'est juste qu'à un instant précis de la
// partie. « Aie 30M de pièces » est un mur au début et un défi déjà
// validé trois heures plus tard. Une version précédente découpait la
// partie en 6 phases pour limiter le problème, mais à l'intérieur d'une
// même phase le revenu varie déjà d'un facteur 100 — l'approximation
// restait grossière. Avec `effortMin`, un défi coûte le même temps de
// jeu à toutes les échelles, et les phases deviennent inutiles.
//
// Champs :
//   id         identifiant stable, JAMAIS renommé (il vit dans les sauvegardes)
//   icon       pastille de la barre de défi
//   label(t)   FONCTION qui construit le texte depuis la cible résolue,
//              pour qu'un libellé ne puisse pas mentir sur l'objectif
//   metric     quoi mesurer (voir readMetric)
//   effortMin  minutes de farm visées
//   target     cible FIXE, pour les défis de rythme d'action (nombre de
//              taps, de combats) que le temps ne convertit pas en pièces
//   mode       'absolute' = état atteint ici et maintenant
//              'delta'    = progression DEPUIS le tirage
//   available  (optionnel) le défi a-t-il un sens pour ce joueur
//   step/minStep  pas minimum pour les métriques non monétaires
//
// Le mode n'est pas cosmétique. `delta` sert aux compteurs qui ne
// redescendent jamais (invocations, critiques, combats) : sans lui, un
// vétéran validerait le défi à l'instant du tirage. `absolute` sert aux
// états que le joueur possède ou non (niveau d'un Pacte, pièces en
// réserve, générateurs achetés) — les avoir déjà EST la preuve de
// progression.

// « 290 milliards DE pièces » mais « 100 000 pièces » : dès que le
// nombre est écrit en mots, le français impose la préposition.
// Les noms de générateurs sont au singulier dans AUTOCLICKERS
// (« Automate Runique ») : un défi en demande toujours plusieurs. Seul
// le groupe AVANT une préposition s'accorde — « Colonie de Familiers »
// donne « Colonies de Familiers », pas « Colonies des Familiers ».
const PLURAL_STOP = ['de', 'du', 'des', 'la', 'le', 'les', "d'"];
const pluralQ = (name) => {
  const words = name.split(' ');
  const stopAt = words.findIndex((w) => PLURAL_STOP.includes(w.toLowerCase()));
  const limit = stopAt === -1 ? words.length : stopAt;
  return words
    .map((w, i) => (i < limit && !/[sx]$/i.test(w) ? `${w}s` : w))
    .join(' ');
};


// Lit une métrique dans l'objet de stats. Les métriques paramétrées
// (`upgrade:<id>`, `auto:<id>`) sont résolues ici plutôt que d'exiger
// une entrée à plat par amélioration — sinon ajouter une amélioration
// obligerait à toucher aussi la couche de stats.
// Retrouve un défi par id, qu'il vienne de la séquence scriptée ou du
// pool dynamique. Toutes les fonctions publiques passent par ici, donc
// les deux systèmes se lisent exactement pareil côté écran.
export function findQuest(questId) {
  return SEQUENCE_QUESTS.find((q) => q.id === questId) || QUEST_POOL.find((q) => q.id === questId) || null;
}

function readMetric(metric, stats) {
  if (!stats) return 0;
  if (metric.startsWith('upgrade:')) {
    const levels = normalizeUpgradeLevels(stats.upgradeLevels);
    return levels[metric.slice(8)] || 0;
  }
  if (metric.startsWith('auto:')) {
    return (stats.autoClickers || {})[metric.slice(5)] || 0;
  }
  if (metric.startsWith('tapUpgrade:')) {
    return normalizeTapUpgrades(stats.tapUpgrades)[metric.slice(11)] || 0;
  }
  const v = stats[metric];
  return Number.isFinite(v) ? v : 0;
}

// ---- Cibles dynamiques : « X minutes de jeu » plutôt qu'un nombre ----
//
// Le problème que ça résout : une cible écrite en dur ne peut être juste
// qu'à un seul moment de la partie. « Aie 30M de pièces » est un mur
// infranchissable au début et un défi déjà validé trois heures plus
// tard. Les phases de progression (QUEST_TIER_THRESHOLDS) limitaient les
// dégâts en ne proposant que des défis de la bonne tranche, mais restent
// une approximation grossière : à l'intérieur d'une même phase, le
// revenu du joueur varie déjà d'un facteur 100.
//
// La cible est donc calculée AU MOMENT DU TIRAGE à partir du revenu réel
// du joueur, puis FIGÉE pour toute la durée du défi (persistée dans la
// sauvegarde, voir `questTargets` dans ClickerScreen.js). Un défi coûte
// désormais un temps de jeu — « environ 25 minutes de farm » — quelle
// que soit la phase, et ce temps reste honnête à toutes les échelles.
//
// Figer la cible est indispensable : recalculée à chaque rendu, elle
// monterait en même temps que le revenu du joueur et le défi
// s'éloignerait à mesure qu'il progresse, sans jamais se terminer.


// ---- Surcoût des défis en PIÈCES après une Ascension ----
//
// Une Ascension multiplie la production par 1,30, et comme le budget
// dérive de la production, les cibles en pièces montaient déjà de 30 %
// par Ascension — donc à effort CONSTANT pour le joueur.
//
// Décision : elles doivent monter de **45 %**, pour que chaque Ascension
// resserre un peu la vis plutôt que d'être neutre.
//
// ⚠️ La production apportant déjà ×1,30, on ajoute seulement le
// COMPLÉMENT : 1,45 / 1,30 = 1,1154 par Ascension. Appliquer 1,45 tel
// quel donnerait 1,30 × 1,45 = ×1,885, soit bien plus que voulu.
//
// ⚠️ Ne concerne QUE les cibles dérivées du budget en pièces. Les défis
// de RYTHME (cible dorée, critiques, pouvoirs, invocations) gardent leur
// propre progression — leur rythme ne dépend pas de la production.



// Combien de niveaux supplémentaires ce budget permet-il d'acheter, en
// suivant la VRAIE fonction de coût du jeu ? C'est ce qui rend un défi
// « monte Griffe de Braisillon » aussi honnête qu'un défi en pièces :
// on ne devine pas, on additionne les coûts réels jusqu'à épuisement.
//
// Le garde-fou `MAX_LEVEL_SCAN` évite une boucle sans fin si une
// fonction de coût renvoyait 0 ou NaN.
const MAX_LEVEL_SCAN = 500;
function levelsAffordable(costFn, currentLevel, budget) {
  let spent = 0;
  let level = currentLevel;
  for (let i = 0; i < MAX_LEVEL_SCAN; i++) {
    const cost = costFn(level);
    if (!Number.isFinite(cost) || cost <= 0) break;
    if (spent + cost > budget) break;
    spent += cost;
    level += 1;
  }
  return level;
}

// Revenu passif atteint si tout le budget partait dans le générateur le
// plus rentable que le joueur peut s'offrir. Sert de cible aux défis
// « atteins X pièces/seconde ».
function passiveIncomeAfterBudget(stats, budget) {
  const current = Math.max(0, readMetric('passiveIncome', stats));
  const owned = stats.autoClickers || {};
  let bestGain = 0;
  for (const clicker of AUTOCLICKERS) {
    const have = owned[clicker.id] || 0;
    const reachable = levelsAffordable((n) => autoClickerCost(clicker, n), have, budget);
    const gain = (reachable - have) * clicker.baseIncome;
    if (gain > bestGain) bestGain = gain;
  }
  return current + bestGain;
}


// Résout la cible d'un défi pour un joueur donné. `effortMin` = durée de
// farm visée. Le résultat est toujours strictement supérieur à l'état
// actuel du joueur : sinon le défi naîtrait déjà validé.
// Métriques d'ACTION : leur rythme ne dépend pas de la production, donc
// le budget en pièces ne les calibre pas. Elles gardent une cible fixe,
// mais celle-ci monte avec les ASCENSIONS — un joueur qui a prestigé
// plusieurs fois doit être davantage sollicité, sinon ces défis
// deviennent des formalités à côté de ses défis en pièces (eux montent
// de 30 % par Ascension via la production).
//
// +20 % par Ascension, PLAFONNÉ à ×3 : au-delà, un défi d'action
// deviendrait plus long que la session entière.
export const ACTION_ASCENSION_STEP = 1.2;
export const ACTION_ASCENSION_CAP = 3;
const METRIQUES_RYTHME = [
  'goldenClaimed', 'totalCrits', 'powerActivated', 'totalSummons', 'maxCombo',
];

export function ascensionActionMultiplier(ascensionCount) {
  const n = Math.max(0, ascensionCount || 0);
  return Math.min(ACTION_ASCENSION_CAP, Math.pow(ACTION_ASCENSION_STEP, n));
}

export function resolveQuestTarget(quest, stats) {
  if (!quest) return 1;
  if (quest.target) {
    const brute = METRIQUES_RYTHME.includes(quest.metric)
      // Seules les métriques de RYTHME suivent les Ascensions.
      ? roundQuestTarget(quest.target * ascensionActionMultiplier(stats && stats.ascension))
      : quest.target;
    // ⚠️ INVARIANT : un défi doit TOUJOURS demander plus que ce que le
    // joueur a déjà. Une cible fixe sortait d'ici sans passer par le
    // plancher appliqué plus bas aux cibles calculées : elle pouvait
    // donc afficher un niveau DÉJÀ ATTEINT, que le joueur lisait comme
    // un défi cassé.
    if (quest.mode !== 'absolute') return brute;
    const dejaLa = readMetric(quest.metric, stats);
    return Math.max(brute, dejaLa + Math.max(quest.minStep || 1, Math.ceil(dejaLa * 0.15)));
  }
  const minutes = quest.effortMin || 15;
  // ⚠️ LE PLANCHER D'ASCENSION A ÉTÉ SUPPRIMÉ — il traitait un symptôme.
  //
  // Il valait `ascensionThreshold(asc - 1) × 0,05 × (minutes / 30)` et
  // servait à relever des cibles qui s'effondraient après une Ascension.
  // Mais la vraie cause était dans `estimatedIncomePerSecond`, qui ne
  // voyait pas le revenu de TAP : or juste après une Ascension le passif
  // vaut zéro et le tap est la SEULE source de revenu.
  //
  // Le plancher avait en plus son propre défaut : le seuil d'Ascension
  // DOUBLE à chaque fois alors que la production ne monte que de 30 %.
  // Le même défi passait donc de 48 min à la 1re Ascension à 174 min à la
  // 4e — une divergence sans fin, pas un écart ponctuel.
  //
  // Avec un budget qui voit le tap, les cibles montent de 45 % par
  // Ascension (intention affichée) et le temps reste stable : mesuré
  // 30 / 33 / 37 / 42 / 46 min de la 0e à la 4e Ascension. Ne pas le
  // réintroduire sans remesurer cette courbe.
  const budget = questBudget(stats, minutes);
  const now = readMetric(quest.metric, stats);
  const metric = quest.metric;
  let raw;

  if (metric === 'totalEarned') {
    raw = budget;
  } else if (metric === 'coins') {
    // Épargner demande de ne PAS tout réinvestir : on vise une fraction
    // de la production de la période, pas sa totalité.
    //
    // ⚠️ Ancré sur la PRODUCTION SEULE, plus sur les pièces en poche.
    //
    // L'ancienne formule prenait `max(budget × 0,6 ; pièces × 1,5)` : le
    // second terme dominait dès qu'on avait épargné, si bien que
    // DÉPENSER ses pièces faisait BAISSER la cible du tirage suivant.
    // Cas réel signalé : même défi à 80 000 puis à 30 000 dix minutes
    // plus tard, sans Ascension — le joueur avait simplement acheté
    // entre les deux.
    //
    // Le plancher « plus que l'acquis » appliqué plus bas suffit à
    // empêcher un défi déjà accompli ; inutile de faire dépendre la
    // cible elle-même du porte-monnaie.
    raw = budget * 0.6;
  } else if (metric === 'passiveIncome') {
    raw = Math.max(passiveIncomeAfterBudget(stats, budget), now * 1.25);
  } else if (metric === 'tapPower') {
    raw = levelsAffordable((lv) => tapPowerCost(lv), Math.max(1, now), budget);
  } else if (metric === 'sanctuaryLevel') {
    // Plafonné : viser au-delà du niveau max rendrait le défi infaisable.
    raw = Math.min(SANCTUARY_MAX_LEVEL, levelsAffordable((lv) => sanctuaryUpgradeCost(lv), now, budget));
  } else if (metric === 'veilleurLevel') {
    raw = Math.min(VEILLEUR_MAX_LEVEL, levelsAffordable((lv) => veilleurUpgradeCost(lv), now, budget));
  } else if (metric === 'critLevel') {
    raw = levelsAffordable((lv) => critUpgradeCost(lv), now, budget);
  } else if (metric.startsWith('upgrade:')) {
    const item = UPGRADE_ITEMS.find((u) => u.id === metric.slice(8));
    raw = item ? levelsAffordable((lv) => upgradeItemCost(item, lv), now, budget) : now + 1;
  } else if (metric.startsWith('auto:')) {
    const clicker = AUTOCLICKERS.find((c) => c.id === metric.slice(5));
    raw = clicker ? levelsAffordable((n) => autoClickerCost(clicker, n), now, budget) : now + 1;
  } else if (metric.startsWith('tapUpgrade:')) {
    // ⚠️ Cette branche MANQUAIT : les paliers de tap tombaient dans le
    // cas générique « avance d'un pas », donc leur cible ne regardait
    // pas le budget. Écrire `effortMin` sur un de ces défis n'avait
    // aucun effet — et leurs cibles fixes ont périmé dès que le prix des
    // paliers a changé (recalage du 17/09).
    const palier = TAP_UPGRADES.find((t) => t.id === metric.slice(11));
    raw = palier ? levelsAffordable((lv) => tapUpgradeCost(palier, lv), now, budget) : now + 1;
  } else if (metric === 'autoTotal') {
    // Combien d'unités de PLUS le budget achète, en le dépensant sur le
    // générateur qui en rend le plus — c'est ce qu'un joueur ferait pour
    // faire grimper ce compteur au moins cher.
    const owned = stats.autoClickers || {};
    let bestCount = 0;
    for (const clicker of AUTOCLICKERS) {
      const have = owned[clicker.id] || 0;
      const reachable = levelsAffordable((n) => autoClickerCost(clicker, n), have, budget);
      if (reachable - have > bestCount) bestCount = reachable - have;
    }
    raw = now + bestCount;
  } else {
    // Métriques non monétaires (créatures possédées, niveau nourri,
    // essence) : le temps ne s'y convertit pas en pièces, on avance donc
    // d'un pas relatif à l'état actuel.
    raw = now + (quest.step || 1);
  }

  const rounded = roundQuestTarget(raw);
  // Un défi doit toujours demander un vrai pas en avant, même si le
  // budget calculé était trop faible pour acheter quoi que ce soit.
  //
  // Ce plancher ne vaut QUE pour les défis 'absolute'. Sur un défi
  // 'delta', `now` est un cumul de toute la partie : le borner par
  // `now + 1` donnait « gagne 162 001 pièces » à un joueur qui en avait
  // déjà gagné 162 000 — soit un défi validé à l'instant du tirage.
  if (quest.mode === 'delta') return Math.max(rounded, quest.minStep || 1);
  // Le pas minimum est aussi RELATIF à l'existant : sur un compteur déjà
  // haut, « +1 » donne un défi affiché à 98% dès le tirage. On exige au
  // moins 15% de progression pour que la barre parte d'un état crédible.
  const floor = now + Math.max(quest.minStep || 1, Math.ceil(now * 0.15));
  const target = Math.max(rounded, floor);
  // Le plancher relatif pourrait repasser au-dessus d'un plafond dur.
  if (metric === 'sanctuaryLevel') return Math.min(SANCTUARY_MAX_LEVEL, target);
  if (metric === 'veilleurLevel') return Math.min(VEILLEUR_MAX_LEVEL, target);
  return target;
}

// Progression 0-1 d'un défi. `targets` = cibles figées au tirage
// (objet id -> valeur). Si une cible manque, on la recalcule à la volée
// depuis les stats — ce n'est qu'un repli pour les sauvegardes d'avant
// les cibles dynamiques, jamais le chemin normal.
// ⚠️ Métriques d'ACTION RARE : elles se comptent depuis le début du
// CYCLE, pas depuis le moment où le défi devient courant.
//
// Bug réel : « Équipe 3 runes » ne se validait pas pour un joueur qui
// avait déjà équipé ses 3 runes plus tôt dans le cycle. Le compteur
// repartait de zéro, et comme ses 3 emplacements étaient pleins il ne
// POUVAIT PLUS en équiper — défi infaisable sans deviner qu'il fallait
// déséquiper puis rééquiper.
//
// Ces actions sont rares, coûteuses et délibérées : le joueur qui les a
// faites pendant le cycle a fait le travail, ça doit compter. Les
// métriques d'ACCUMULATION (pièces gagnées, critiques, cibles dorées)
// gardent leur référence par défi, sinon elles se valideraient toutes
// seules — le joueur en accumule en permanence.
export const CYCLE_SCOPED_METRICS = [
  'runeBought', 'runeEquipped', 'runeFused', 'ascension', 'offering',
];

export function metricScopedToCycle(metric) {
  return CYCLE_SCOPED_METRICS.includes(metric);
}

export function questProgress(questId, stats, baseline = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return 0;
  // ⚠️ Une cible FIXE (`q.target`) prime TOUJOURS sur la valeur
  // sauvegardée. Les cibles sont figées au tirage du cycle : après un
  // changement d'équilibrage, une partie en cours gardait l'ANCIENNE
  // valeur alors que le libellé, lui, est recalculé. Le défi affichait
  // « 100 000 pièces » tout en en exigeant 140 000 — bug signalé.
  // Seules les cibles CALCULÉES (effort en minutes) doivent rester
  // figées, sinon elles bougeraient au fil de la partie.
  // ⚠️ GARDE-FOU : la cible se résout sur les MÊMES arguments que le
  // libellé (`stats`), jamais sur la référence.
  //
  // Avant, la progression la calculait sur la RÉFÉRENCE et le libellé
  // sur l'état COURANT. Sur un défi indexé sur les Ascensions, les deux
  // divergeaient : mesuré, le texte annonçait 15 et ça validait à 10.
  const target = effectiveQuestTarget(questId, stats, targets);
  if (!target) return 0;
  const now = readMetric(q.metric, stats);
  const base = readMetric(q.metric, baseline);
  if (q.mode === 'delta') {
    return Math.max(0, Math.min(1, Math.max(0, now - base) / target));
  }
  // Mode 'absolute' : progression = valeur RÉELLE / cible.
  //
  // Une version précédente normalisait depuis l'état au tirage, pour
  // qu'un défi « possède 58 Colosses » proposé à qui en a déjà 50 ne
  // s'affiche pas à 86% d'emblée. Mais le compteur affichait alors un
  // nombre FAUX : un joueur avec 46 700 pièces en banque lisait
  // « 28,0K/100,0K ». Sur un défi « aie X pièces », le joueur vérifie
  // le chiffre dans sa barre du haut — il doit correspondre.
  // Une barre qui démarre haut est un moindre mal face à un compteur
  // qui ment.
  return Math.max(0, Math.min(1, now / target));
}

export function questComplete(questId, stats, baseline = {}, targets = {}) {
  return questProgress(questId, stats, baseline, targets) >= 1;
}

// Libellé d'un défi, construit à partir de la cible RÉSOLUE — il ne peut
// donc pas mentir sur ce qui est demandé. C'est le piège tombé deux fois
// avec les libellés figés : changer une cible sans régénérer le texte.
// ⚠️ RÉSOLVEUR UNIQUE de la cible d'un défi.
//
// Trois endroits la calculaient, et pas dans le même ordre : le libellé
// privilégiait la cible SAUVEGARDÉE, la progression celle de la
// DÉFINITION. Résultat : « Monte Pacte au niveau 7 » qui se validait au
// niveau 5 — le texte et la condition ne parlaient pas de la même chose.
//
// Ordre unique et définitif :
//   1. cible FIXE de la définition (`q.target`) — fait autorité, c'est
//      elle qui suit les changements d'équilibrage ;
//   2. cible SAUVEGARDÉE au tirage (défis calibrés par effort) ;
//   3. calcul à la volée, en dernier recours.
export function effectiveQuestTarget(questId, stats = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return 1;
  // ⚠️ La cible FIGÉE au tirage fait autorité, y compris pour les défis
  // à cible fixe.
  //
  // `resolveQuestTarget` applique un plancher « plus que l'acquis » —
  // indispensable AU TIRAGE pour qu'un défi ne naisse pas déjà accompli.
  // Mais l'appeler à chaque évaluation faisait FUIR la cible : « équipe
  // 2 runes » en réclamait 3 dès qu'on en avait 2.
  //
  // Le plancher n'agit donc qu'une fois, au tirage ; ensuite on relit la
  // valeur enregistrée.
  if (targets[questId]) return targets[questId];
  if (q.target && METRIQUES_RYTHME.includes(q.metric)) {
    return roundQuestTarget(q.target * ascensionActionMultiplier(stats && stats.ascension));
  }
  if (q.target) return q.target;
  return resolveQuestTarget(q, stats);
}

// Cibles manquantes d'un cycle DÉJÀ tiré.
//
// ⚠️ Les parties commencées avant que les cibles soient figées au tirage
// n'en ont aucune d'enregistrée : elles se recalculent à chaque rendu et
// suivent l'état du joueur. Après une Ascension, qui remet le Pacte à
// zéro, la cible retombait à un niveau déjà franchi.
//
// On les fige une bonne fois, sur l'état courant.
export function freezeMissingTargets(activeIds, stats = {}, targets = {}) {
  let change = false;
  const suivant = { ...targets };
  (activeIds || []).forEach((id) => {
    if (suivant[id]) return;
    const q = findQuest(id);
    if (!q) return;
    suivant[id] = q.target || resolveQuestTarget(q, stats);
    change = true;
  });
  return change ? suivant : null;
}

// ---- GARDE-FOU : cohérence des défis ----
//
// Un défi est fait de morceaux INDÉPENDANTS (métrique, cible, mode,
// libellé) et rien n'obligeait qu'ils soient d'accord. Une métrique mal
// orthographiée ou jamais publiée renvoie 0 EN SILENCE : le défi ne
// progresse jamais et rien ne le signale.
//
// `validateQuests` confronte chaque défi à la liste des métriques
// réellement publiées par le jeu. À lancer dans l'audit après tout
// changement.
export function validateQuests(publishedMetrics = []) {
  const connues = new Set(publishedMetrics);
  const problemes = [];
  const tous = [...QUEST_SEQUENCE.flat(), ...QUEST_POOL];
  tous.forEach((q) => {
    const m = q.metric || '';
    // ⚠️ Les métriques COMPOSÉES étaient IGNORÉES par ce contrôle.
    //
    // C'est ce qui a laissé passer « Monte Poigne Ancienne au niveau 5 » :
    // sa métrique `tapUpgrade:tap1` lit le champ `tapUpgrades`, qui
    // n'était pas publié — la valeur valait 0 pour toujours et le défi
    // ne pouvait jamais progresser.
    //
    // On vérifie donc le CHAMP SUPPORT de chaque préfixe.
    const CHAMPS_SUPPORT = {
      'upgrade:': 'upgradeLevels',
      'auto:': 'autoClickers',
      'tapUpgrade:': 'tapUpgrades',
    };
    const prefixe = Object.keys(CHAMPS_SUPPORT).find((pre) => m.startsWith(pre));
    if (prefixe) {
      const champ = CHAMPS_SUPPORT[prefixe];
      if (!connues.has(champ)) {
        problemes.push({ id: q.id, type: 'champ support non publié', detail: `${m} → ${champ}` });
      }
    } else if (m.includes(':')) {
      problemes.push({ id: q.id, type: 'préfixe de métrique inconnu', detail: m });
    } else if (!connues.has(m)) {
      problemes.push({ id: q.id, type: 'métrique jamais publiée', detail: m });
    }
    // Trois façons LÉGITIMES de définir une cible : valeur fixe, budget
    // d'effort en minutes, ou pas d'avancement (`step`, pour « monte de
    // N de plus qu'actuellement »).
    if (!q.target && !q.effortMin && !q.step) {
      problemes.push({ id: q.id, type: 'aucune cible définissable', detail: '' });
    }
    if (q.target && q.effortMin) {
      problemes.push({ id: q.id, type: 'cible ET effort déclarés', detail: '' });
    }
    if (typeof q.label !== 'function') {
      problemes.push({ id: q.id, type: 'libellé manquant', detail: '' });
    }
    if (!['absolute', 'delta'].includes(q.mode)) {
      problemes.push({ id: q.id, type: 'mode inconnu', detail: String(q.mode) });
    }
  });
  const ids = tous.map((q) => q.id);
  ids.forEach((id, i) => {
    if (ids.indexOf(id) !== i) problemes.push({ id, type: 'identifiant en double', detail: '' });
  });
  return problemes;
}

// Décrit un niveau d'Aventure ABSOLU sous la forme « chapitre C,
// niveau L ».
//
// ⚠️ Calculé, jamais écrit en dur. Les libellés d'Aventure contenaient
// leur chapitre et leur niveau dans le texte : après un changement de
// cible, le texte annonçait « chapitre 2, niveau 10 » pendant que la
// barre comptait sur 25 (l'ancienne cible, figée dans la sauvegarde).
// Le joueur voyait un défi et une jauge qui ne parlaient pas du même
// objectif.

export function questLabel(questId, target, stats = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return '';
  // `target` explicite prioritaire pour les appels qui en fournissent un,
  // sinon on passe par le résolveur commun.
  const t = target || effectiveQuestTarget(questId, stats, targets);
  return q.label(t || 1);
}

export function questDetail(questId, stats, baseline = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return { icon: '🎯', label: '', progress: 0, target: 1, current: 0, done: false };
  // Même règle qu'au-dessus : une cible fixe vient de la définition.
  const target = effectiveQuestTarget(questId, stats, targets);
  const progress = questProgress(questId, stats, baseline, { ...targets, [questId]: target });
  return {
    icon: q.icon,
    label: q.label(target),
    progress,
    target,
    current: Math.min(target, Math.floor(progress * target + 1e-9)),
    done: progress >= 1,
  };
}


// Point d'entrée unique pour obtenir le prochain jeu de défis.
//
// Tant que la séquence de démarrage n'est pas épuisée, on sert le cycle
// scripté à l'index courant (cibles fixes, mêmes défis pour tous, dans
// un ordre pensé pour enseigner les mécaniques). Ensuite seulement, on
// bascule sur le pool dynamique dont les cibles suivent le revenu.
//
// `index` est l'avancement dans la séquence, persisté par l'écran. Il
// n'est PAS remis à zéro par une Ascension : la séquence est un fil de
// découverte, on ne rejoue pas le tutoriel à chaque prestige.
// Un défi est-il DÉJÀ accompli au moment où on le propose ?
//
// Seul le mode 'absolute' est concerné : il compare la valeur actuelle à
// la cible, donc un joueur qui a déjà dépassé la cible voit le défi se
// valider tout seul, sans jamais l'avoir vu. Le mode 'delta' part
// toujours de zéro (il mesure depuis l'instantané du tirage), il ne peut
// pas être accompli d'avance.
//
// Cas réel signalé : « Reste en Transe x2,5 pendant 42 secondes » sur
// `maxTranseHoldSec`, qui est un RECORD à vie. Une joueuse ayant tenu
// une longue Transe plus tôt n'a jamais vu ce défi apparaître.
// Métriques de type RECORD : elles sont remises à zéro au tirage du
// cycle par ClickerScreen, donc elles ne sont JAMAIS déjà accomplies.
// Les exclure ici est essentiel : sans ça, le défi de Transe serait
// REMPLACÉ alors qu'il suffit de le remettre à zéro pour le rendre
// jouable — on perdrait un défi au lieu de le réparer.
const RESET_ON_DRAW_METRICS = ['maxTranseHoldSec', 'maxCombo'];

// La créature dont dépend une amélioration est-elle possédée ?
//
// ⚠️ Depuis que les améliorations sont réservées aux créatures
// possédées, un défi « monte l'objet X » devient IMPOSSIBLE sans elle —
// et comme l'œuf attend que tous les défis du cycle soient validés, il
// resterait bloqué à jamais. Cas réel : « Monte Griffe de Braisillon au
// niveau 5 » proposé à un joueur qui n'a pas Pyrosile.
export function upgradeCreatureOwned(metric, stats = {}) {
  if (!metric || !metric.startsWith('upgrade:')) return true;
  const item = UPGRADE_ITEMS.find((u) => u.id === metric.slice(8));
  if (!item || !item.creatureId) return true;
  return (stats.ownedIds || []).includes(item.creatureId);
}

// Un défi est-il RÉALISABLE dans l'état actuel ? Réunit sa condition
// propre (`available`) et la possession de la créature requise.
export function questFeasible(quest, stats = {}) {
  if (!quest) return false;
  if (!upgradeCreatureOwned(quest.metric, stats)) return false;
  if (typeof quest.available === 'function' && !quest.available(stats)) return false;
  return true;
}

export function questAlreadyDone(quest, stats = {}) {
  if (!quest || quest.mode !== 'absolute') return false;
  if (RESET_ON_DRAW_METRICS.includes(quest.metric)) return false;
  const acquis = readMetric(quest.metric, stats);
  if (quest.target) return acquis >= quest.target;
  // ⚠️ Les cibles CALCULÉES doivent être testées elles aussi.
  //
  // Le test exigeait `quest.target`, donc il ignorait les 20 défis
  // convertis en `effortMin`. En temps normal `resolveQuestTarget`
  // garantit une cible supérieure à l'acquis — SAUF sur une métrique
  // PLAFONNÉE (Sanctuaire et Veilleur, bornés à 10) : un joueur déjà au
  // plafond recevait `seq_veilleur10` avec une cible de 10 alors qu'il
  // était à 10, donc un défi accompli d'emblée qui disparaissait sans
  // avoir été vu. Mesuré : 36 cas sur 11 400 tirages.
  return acquis >= resolveQuestTarget(quest, stats);
}

export function nextQuestSet(index, excludeIds = [], stats = {}) {
  const cycle = sequenceCycle(index);
  if (cycle) {
    // Les défis déjà accomplis sont REMPLACÉS par des défis du pool
    // dynamique, dont la cible est calculée à partir de l'état courant
    // et se situe donc forcément devant le joueur.
    //
    // Pourquoi remplacer plutôt que relever la cible du défi scripté :
    // les libellés de la séquence contiennent leur nombre EN DUR
    // (« ...pendant 42 secondes »). Changer la cible sans le texte
    // donnerait un défi qui ment sur son propre objectif.
    // ⚠️ On écarte les défis déjà faits ET les IRRÉALISABLES (créature
    // manquante). Sans ce second filtre, un défi impossible entrait dans
    // le cycle et bloquait l'éclosion définitivement.
    const kept = cycle.filter((q) => !questAlreadyDone(q, stats) && questFeasible(q, stats));
    // ⚠️ La cible est FIGÉE ici, au tirage. Pour les défis calibrés par
    // EFFORT (`effortMin`), `q.target` est `undefined` : sans ce calcul,
    // la cible était recalculée à CHAQUE RENDU sur l'état courant, et
    // elle FUYAIT devant le joueur.
    //
    // Cas réels signalés : « Monte Pacte » dont la cible montait à mesure
    // qu'on montait le Pacte (production en hausse ⇒ budget en hausse),
    // et « Obtiens N pièces » qui se validait aussitôt après une
    // Ascension (production repartie de zéro ⇒ budget minuscule).
    const targets = {};
    kept.forEach((q) => {
      const brute = q.target || resolveQuestTarget(q, stats);
      // La répétition ne touche que les cibles FIXES : les cibles
      // calculées suivent déjà la production, elle-même indexée sur les
      // Ascensions.
      targets[q.id] = q.target ? applyRepeatTier(q, brute, index, stats && stats.ascension) : brute;
    });
    const ids = kept.map((q) => q.id);

    const missing = cycle.length - kept.length;
    if (missing > 0) {
      const sub = pickQuestSet([...excludeIds, ...ids], stats);
      sub.ids.slice(0, missing).forEach((id) => {
        ids.push(id);
        targets[id] = sub.targets[id];
      });
    }
    return { ids, targets, fromSequence: true };
  }
  return { ...pickQuestSet(excludeIds, stats), fromSequence: false };
}

export const QUEST_SET_SIZE = 4;

// Index (0-based) du cycle qui introduit les Runes.
//
// ⚠️ Le tirage offert se déduit de CET index, pas de la liste des défis
// actifs. Cette liste est SAUVEGARDÉE au tirage du cycle : un joueur
// arrivé au cycle 5 avant l'ajout du défi garde une liste qui ne le
// contient pas, et la condition « le défi est actif » restait fausse à
// jamais. La progression, elle, est fiable.
export const RUNE_CYCLE_INDEX = 4;

// Rune OFFERTE au joueur quand le défi qui introduit les Runes arrive.
//
// ⚠️ La clé vit ICI et pas dans un écran : le Clicker la dépose,
// l'Aventure l'encaisse. La déclarer dans l'un des deux créait un CYCLE
// d'imports (chacun important l'autre), exactement le piège évité en
// extrayant ce fichier. `questLogic` est déjà importé par les deux, dans
// un seul sens.
export const PENDING_FREE_RUNE_KEY = 'adventure:pendingFreeRune:v1';

// Tire 4 défis et résout leurs cibles d'un coup. Retourne
// `{ ids, targets }` — les deux doivent être persistés ENSEMBLE : des
// ids sans leurs cibles feraient recalculer des objectifs différents au
// prochain chargement.
//
// Un défi n'est éligible que si sa métrique a du sens pour ce joueur
// (`available`) : proposer « possède 30 Étoiles Filantes » à quelqu'un
// qui n'a pas encore les moyens du premier générateur donnerait un défi
// techniquement résoluble mais absurde.
export function pickQuestSet(excludeIds = [], stats = {}) {
  // `questAlreadyDone` en plus de `available` : un défi du pool à cible
  // FIXE peut lui aussi être déjà accompli, et se validerait sans que le
  // joueur le voie.
  const eligible = QUEST_POOL.filter((q) => questFeasible(q, stats)).filter(
    (q) => (!q.available || q.available(stats)) && !questAlreadyDone(q, stats)
  );
  let pool = eligible.filter((q) => !excludeIds.includes(q.id));
  if (pool.length < QUEST_SET_SIZE) pool = eligible;
  if (pool.length < QUEST_SET_SIZE) pool = QUEST_POOL;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  // Un seul défi par métrique dans un même jeu : sans ce filtre, le
  // tirage sortait « atteins 130 000/s » ET « atteins 170 000/s » côte à
  // côte, ce qui donne l'impression d'un bug plutôt que d'un choix.
  // Un jeu de 4 défis doit être VARIÉ : une seule métrique par défi, et
  // au plus 2 défis d'une même famille. Sans la contrainte de famille,
  // le tirage sortait quatre « monte telle amélioration au niveau X »
  // d'affilée, ou deux paliers du même objectif côte à côte — ce qui
  // ressemble à un bug plus qu'à un choix.
  const chosen = [];
  const usedMetrics = new Set();
  const familyCount = {};
  const MAX_PER_FAMILY = 2;
  for (const q of shuffled) {
    if (chosen.length >= QUEST_SET_SIZE) break;
    if (usedMetrics.has(q.metric)) continue;
    const fam = q.family || 'autre';
    if ((familyCount[fam] || 0) >= MAX_PER_FAMILY) continue;
    usedMetrics.add(q.metric);
    familyCount[fam] = (familyCount[fam] || 0) + 1;
    chosen.push(q);
  }
  // Repli : si la contrainte d'unicité empêche d'atteindre 4 défis
  // (joueur très en début de partie, peu de métriques disponibles), on
  // complète sans elle plutôt que de rendre un jeu incomplet.
  for (const q of shuffled) {
    if (chosen.length >= QUEST_SET_SIZE) break;
    if (!chosen.includes(q)) chosen.push(q);
  }
  const targets = {};
  chosen.forEach((q) => {
    targets[q.id] = resolveQuestTarget(q, stats);
  });
  return { ids: chosen.map((q) => q.id), targets };
}

// Nombre de quêtes validées (0-4) -> palier visuel (0-4).
// Math.min/Math.max laissent passer NaN : l'appelant indexerait alors
// EGG_STAGES[NaN] (undefined) et planterait sur `.name`. Le garde-fou
// coûte une ligne, le crash coûterait un écran blanc.
export function eggStageForCompletedCount(completedCount) {
  if (!Number.isFinite(completedCount)) return 0;
  return Math.max(0, Math.min(4, Math.floor(completedCount)));
}


// (L'ancienne « note d'ordre » qui obligeait ce bloc à vivre en fin de
// fichier n'a plus lieu d'être : `AUTOCLICKERS` arrive maintenant par un
// import ES, donc clickerLogic est entièrement évalué avant ce fichier.)

// Défis visant une amélioration ou un générateur PRÉCIS, générés depuis
// les tableaux existants plutôt qu'écrits à la main : ajouter une
// amélioration au jeu ajoute automatiquement son défi, et aucun libellé
// ne peut se désynchroniser d'un renommage.
UPGRADE_ITEMS.forEach((item) => {
  QUEST_POOL.push({
    id: `up_${item.id}`,
    family: 'upgrade',
    icon: item.emoji,
    metric: `upgrade:${item.id}`,
    effortMin: 30,
    mode: 'absolute',
    available: (s) => {
      const lvl = normalizeUpgradeLevels(s.upgradeLevels)[item.id] || 0;
      return lvl > 0 || upgradeItemCost(item, 0) <= questBudget(s, 30);
    },
    label: (t) => `Monte ${item.name} au niveau ${t}`,
  });
});

AUTOCLICKERS.forEach((clicker) => {
  QUEST_POOL.push({
    id: `ac_${clicker.id}`,
    family: 'autoclicker',
    icon: clicker.emoji,
    metric: `auto:${clicker.id}`,
    effortMin: 30,
    mode: 'absolute',
    available: (s) => {
      const have = (s.autoClickers || {})[clicker.id] || 0;
      return have > 0 || autoClickerCost(clicker, 0) <= questBudget(s, 30);
    },
    label: (t) => `Possède ${fmtQ(t)} ${pluralQ(clicker.name)}`,
  });
});

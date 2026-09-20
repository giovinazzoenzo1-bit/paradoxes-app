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
import { DEFIS_ECRITS } from './defisEcrits';
import { EGG_STAGES, QUEST_SEQUENCE, QUEST_POOL, QUEST_DEFS_VERSION, echelleGroupe, PAS_AVENTURE_PAR_GROUPE } from './questDefs';
import { fmtQ, qtyQ, roundQuestTarget, describeAdventureLevel } from './questFormat';
import { questBudget, estimatedIncomePerSecond, ascensionCoinMultiplier, ASCENSION_COIN_TARGET_RATE } from './questBudget';

// Ré-exportés pour que les écrans continuent d'importer depuis ici.
export { EGG_STAGES, QUEST_SEQUENCE, QUEST_POOL, QUEST_DEFS_VERSION, echelleGroupe };
export { fmtQ, qtyQ, describeAdventureLevel, roundQuestTarget };
export { questBudget, estimatedIncomePerSecond, ascensionCoinMultiplier, ASCENSION_COIN_TARGET_RATE };

import {
  AUTOCLICKERS,
  SANCTUARY_MAX_LEVEL,
  UPGRADE_ITEMS,
  VEILLEUR_MAX_LEVEL,
  ascensionThreshold,
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
// ⚠️⚠️ NEUTRALISÉ le 19/09 — c'était une QUATRIÈME échelle, invisible.
//
// Cette fonction gonflait les cibles fixes à chaque tour de séquence, en
// plus de l'échelle de groupe (`ECHELLES_GROUPE`) déjà appliquée par
// `resolveQuestTarget`. Les deux se multipliaient en silence.
//
// Conséquences mesurées : « Reste en Transe pendant 641 secondes » —
// dix minutes de Transe ininterrompue — alors que ce défi déclare
// `target: 25, cap: 45` et que `resolveQuestTarget` rend bien 25. Le
// plafond était contourné, parce que le gonflement arrivait APRÈS lui.
//
// Elle date d'avant les échelles de groupe, quand la difficulté ne
// montait nulle part ailleurs. Aujourd'hui elle fait double emploi.
//
// ⚠️ On la neutralise sans la supprimer : elle est exportée et utilisée
// ailleurs. Elle rend la cible telle quelle, et l'échelle de groupe
// reste le SEUL endroit où une cible monte.
export function applyRepeatTier(quest, target) {
  return target;
}

// ⚠️⚠️ LES DÉFIS VIENNENT DU FICHIER ÉCRIT, plus des modèles.
//
// `DEFIS_ECRITS` contient les 252 défis un par un, dans l'ordre : 42
// œufs, sept par Ascension. L'index d'un œuf est donc
// `ascension * 7 + rang dans le groupe`, et il n'y a plus rien à
// résoudre — ni cible, ni article, ni ordre.
//
// ⚠️ Au-delà du 42e œuf, on REJOUE LA DERNIÈRE ASCENSION écrite plutôt
// que de reboucler au début : un joueur arrivé là a une production sans
// rapport avec celle du premier groupe, et lui redonner « obtiens 750
// pièces » serait absurde.
export const OEUFS_PAR_ASCENSION = 7;

export function sequenceCycle(index) {
  if (!DEFIS_ECRITS.length) return null;
  const i = Math.max(0, index || 0);
  if (i < DEFIS_ECRITS.length) return DEFIS_ECRITS[i];
  const dernierGroupe = DEFIS_ECRITS.length - OEUFS_PAR_ASCENSION;
  return DEFIS_ECRITS[dernierGroupe + (i % OEUFS_PAR_ASCENSION)];
}
export const SEQUENCE_LENGTH = OEUFS_PAR_ASCENSION;

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
// ⚠️ Les défis ÉCRITS d'abord : ce sont eux que le jeu distribue. Les
// modèles et le pool restent consultables pour les sauvegardes d'avant
// la bascule, dont les identifiants n'existent plus dans le fichier.
const DEFIS_ECRITS_PLAT = DEFIS_ECRITS.flat();

export function findQuest(questId) {
  return DEFIS_ECRITS_PLAT.find((q) => q.id === questId)
    || SEQUENCE_QUESTS.find((q) => q.id === questId)
    || QUEST_POOL.find((q) => q.id === questId) || null;
}

// ⚠️ Tous les défis écrits sont SCRIPTÉS : aucun ne se remplace.
const IDS_ECRITS = new Set(DEFIS_ECRITS_PLAT.map((q) => q.id));

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
    const reachable = levelsAffordable((n) => autoClickerCost(clicker, n, stats && stats.ascension), have, budget);
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

// ⚠️ Métriques REMISES À ZÉRO au tirage du cycle : ce sont des RECORDS
// de performance (tenir une Transe, un combo), pas des cumuls. Le jeu
// les repart de zéro quand le défi est distribué, donc le plancher
// « toujours au-dessus de l'acquis » n'a aucun sens pour elles — il
// produisait une cible sous l'acquis dès que le joueur avait un vieux
// record, et le défi naissait accompli.
//
// ⚠️ Déclaré ICI et plus bas dans le fichier : `resolveQuestTarget` en a
// besoin, et une const déclarée après ne serait pas encore initialisée.
const RESET_ON_DRAW_METRICS = ['maxTranseHoldSec', 'maxCombo'];

// ⚠️⚠️ LA MÉTRIQUE D'UN DÉFI PEUT DÉPENDRE DU GROUPE.
//
// Le schéma des 6 œufs est le même à chaque Ascension, mais l'auteur
// veut que 4 articles de boutique se découvrent PAR Ascension : Poigne +
// Gantelet + Automate + Colonie à A1, Sceau + Main du Colosse + Titan +
// Golem à A2, etc. Un défi doit donc viser un article différent selon le
// numéro d'Ascension.
//
// ⚠️ Passer par ici PARTOUT où l'on lit `quest.metric`. Lire le champ
// brut renverrait `undefined` pour ces défis — ils viseraient le vide.
export function metriqueDuDefi(quest, stats) {
  if (!quest) return null;
  if (quest.metriqueParGroupe) {
    const groupe = Math.max(0, Math.floor((stats && stats.ascension) || 0));
    return quest.metriqueParGroupe(groupe) || quest.metric || null;
  }
  return quest.metric;
}

// ⚠️⚠️ CALCULATEUR D'ACHATS — plafond par article et par groupe.
//
// Problème signalé par l'auteur le 20/09 : « si un joueur a tryhard les
// niveaux d'Esprit Frappeur et qu'un défi lui demande d'en racheter 5,
// il ne pourra peut-être pas — 3 millions de pièces à l'Ascension 0,
// c'est impossible ».
//
// Le prix d'un générateur monte de 25 % par exemplaire : au 20e, il
// coûte 87 fois le premier. Un défi en mode DELTA demandant « achète 5
// de plus » devient donc infaisable pour un joueur en avance, alors
// qu'il est trivial pour un joueur en retard. C'est l'inverse de ce
// qu'on veut.
//
// LA RÈGLE : on sait à l'avance combien d'exemplaires le GROUPE ENTIER
// demandera — c'est la somme des cibles de ses défis visant cet article.
// Si le joueur en possède déjà autant, le défi ne réclame plus qu'UN
// exemplaire. Il n'est jamais puni d'avoir investi.
//
// ⚠️ Cette adaptation au joueur est VOULUE, comme celle du défi de
// créature. Elle est bornée : elle ne peut que RÉDUIRE la demande,
// jamais l'augmenter. Un joueur en retard voit donc toujours la cible
// annoncée dans le document.
export function plafondAchatsGroupe(metric, stats) {
  // ⚠️ On somme les défis ÉCRITS du GROUPE du joueur, pas les anciens
  // modèles. Après la bascule, `QUEST_SEQUENCE` ne décrit plus ce que le
  // joueur reçoit : le plafond calculé dessus était faux, et le
  // calculateur ne protégeait plus personne.
  const groupe = Math.max(0, Math.floor((stats && stats.ascension) || 0));
  const debut = Math.min(groupe, Math.floor(DEFIS_ECRITS.length / OEUFS_PAR_ASCENSION) - 1)
    * OEUFS_PAR_ASCENSION;
  let total = 0;
  for (let e = 0; e < OEUFS_PAR_ASCENSION; e++) {
    (DEFIS_ECRITS[debut + e] || []).forEach((q) => {
      if (q.mode !== 'delta' || q.metric !== metric) return;
      total += q.target || 0;
    });
  }
  return total;
}

export function resolveQuestTarget(quest, stats) {
  if (!quest) return 1;
  if (quest.target) {
    // ⚠️⚠️ UNE CIBLE FIXE MONTE PAR GROUPE, PAS PAR JOUEUR.
    //
    // Jusqu'au 19/09, 68 % des défis calculaient leur cible sur le
    // porte-monnaie du joueur au tirage. Trois conséquences, toutes
    // signalées par l'auteur :
    //
    //  1. UN JOUEUR QUI PAYE N'ÉTAIT PAS PLUS AVANCÉ — il achète des
    //     pièces, son état monte, ses défis deviennent plus durs. Le
    //     système annulait lui-même l'avantage acheté.
    //  2. Deux joueurs au même endroit voyaient deux jeux différents.
    //  3. C'était la cause commune de la moitié des bugs : défis nés
    //     accomplis, cibles sous l'acquis, « atteins 4 pièces par
    //     seconde » au démarrage, deux réserves d'affilée.
    //
    // La cible vaut désormais `target` x l'échelle de son GROUPE, et le
    // groupe est le nombre d'Ascensions : déterministe, identique pour
    // tous, lisible dans le fichier des défis. `echelle` nomme la loi à
    // appliquer (voir ECHELLES_GROUPE dans questDefs.js) ; sans elle, la
    // cible ne bouge jamais.
    //
    // ⚠️ L'objection de 2026-09-02 (commit 1ff5930) était qu'une cible
    // fixe périme. Elle ne tient plus : on a un simulateur d'économie et
    // onze contrôles, donc on peut écrire une cible fixe ET la vérifier.
    const groupe = Math.max(0, Math.floor((stats && stats.ascension) || 0));
    // ⚠️ L'Aventure AVANCE au lieu d'être multipliée : la campagne se
    // poursuit d'un groupe à l'autre, les niveaux ne repartent pas de
    // zéro après une Ascension.
    const brute = quest.metric === 'advLevelReached'
      ? quest.target + PAS_AVENTURE_PAR_GROUPE * groupe
      : quest.echelle
        ? roundQuestTarget(quest.target * echelleGroupe(quest.echelle, groupe))
      : METRIQUES_RYTHME.includes(quest.metric)
        // Repli historique : les métriques de RYTHME suivaient déjà les
        // Ascensions avant l'introduction des échelles nommées.
        ? roundQuestTarget(quest.target * ascensionActionMultiplier(groupe))
        : quest.target;
    // ⚠️ INVARIANT : un défi doit TOUJOURS demander plus que ce que le
    // joueur a déjà. Une cible fixe sortait d'ici sans passer par le
    // plancher appliqué plus bas aux cibles calculées : elle pouvait
    // donc afficher un niveau DÉJÀ ATTEINT, que le joueur lisait comme
    // un défi cassé.
    // ⚠️⚠️ CALCULATEUR D'ACHATS, appliqué AVANT la sortie des défis en
    // mode delta — c'est cette ligne-là qui rendait le plafond inopérant
    // quand je l'avais placé plus bas : un défi d'achat est en mode
    // delta, donc il sortait de la fonction avant d'être plafonné.
    // ⚠️⚠️ UNE CIBLE ÉCRITE NE SE RECALCULE PAS.
    //
    // Les défis de `defisEcrits.js` portent leur cible FINALE, déjà mise
    // à l'échelle au moment de la génération. Le moteur leur appliquait
    // encore `ascensionActionMultiplier` sur les métriques de rythme :
    // la cible était donc mise à l'échelle DEUX FOIS, et le document
    // remis à l'auteur ne correspondait plus au jeu sur 35 défis.
    //
    // ⚠️ C'est exactement le défaut que la bascule devait supprimer. Il
    // a survécu parce qu'on a changé la SOURCE des défis sans retirer le
    // recalcul qui s'appliquait par-dessus.
    const mAchat = metriqueDuDefi(quest, stats) || '';
    // ⚠️ L'ORDRE COMPTE : plafonner d'abord, figer ensuite.
    //
    // Placé AVANT, le `fige` court-circuitait le calculateur d'achats —
    // un joueur en avance se voyait de nouveau réclamer l'impossible.
    // « Cible finale » veut dire « ne pas remettre d'échelle », pas
    // « ne rien adapter » : la réduction pour un joueur en avance reste
    // légitime, puisqu'elle ne peut que DIMINUER la demande.
    if (quest.fige && !mAchat.startsWith('auto:')
      && !mAchat.startsWith('tapUpgrade:')) return quest.target;
    if (quest.mode === 'delta'
      && (mAchat.startsWith('auto:') || mAchat.startsWith('tapUpgrade:'))) {
      const plafond = plafondAchatsGroupe(mAchat, stats);
      const restant = Math.max(1, plafond - readMetric(mAchat, stats));
      return Math.min(brute, restant);
    }
    if (quest.mode !== 'absolute') return brute;
    // Record remis à zéro au tirage : la cible est la cible, point.
    if (RESET_ON_DRAW_METRICS.includes(quest.metric)) {
      return quest.cap ? Math.min(brute, quest.cap) : brute;
    }
    // ⚠️⚠️ AUCUN PLANCHER SUR UNE CIBLE FIXE. La cible EST la cible.
    //
    // Il restait ici un « toujours au moins 1 de plus que ce que le
    // joueur a déjà ». C'était la DERNIÈRE pièce du système qui adapte
    // les défis au joueur — celui qu'on a passé la journée à retirer.
    //
    // Preuve fournie par l'auteur : « Monte une créature au niveau 15 »
    // s'affichait NIVEAU 128 chez lui, parce qu'il avait une créature au
    // 127. Le défi suivait son état au lieu d'être celui du document.
    //
    // Conséquence acceptée : un joueur très en avance peut voir un défi
    // déjà rempli à sa distribution. C'est un défi offert, pas une
    // panne — et c'est infiniment préférable à une cible qui fuit devant
    // lui. Le document de référence dit 15, le jeu dit 15.
    //
    // ⚠️ Ne vaut QUE pour les cibles fixes (`quest.target`). Le reste de
    // la fonction, plus bas, traite les cibles calculées, qui ont encore
    // besoin d'un plancher pour ne pas sortir sous l'acquis.
    const monte = brute;
    // ⚠️⚠️ PLAFOND — sans lui, une cible ABSOLUE s'emballe sans fin.
    //
    // Le plancher « toujours +15 % au-dessus de ce que le joueur a déjà »
    // se recompose à chaque passage de la séquence : la tenue de Transe
    // passait de 25 s à 56, puis 60, puis 641 SECONDES au 4e groupe —
    // dix minutes de Transe ininterrompue, impossible et absurde.
    //
    // Les métriques de PERFORMANCE (tenir une Transe, un combo) ont un
    // maximum humain : elles doivent déclarer leur plafond. Les
    // métriques de PROGRESSION (niveaux, pièces) n'en ont pas et n'en
    // déclarent donc pas.
    // ⚠️ SEULE EXCEPTION : un défi qui déclare `minStep` demande
    // explicitement qu'il reste toujours quelque chose à faire. C'est le
    // cas du défi de taps, où l'auteur a voulu « s'il a déjà tapé 600
    // fois, il lui en reste 200 ». Personne d'autre ne l'utilise.
    const avecReste = quest.minStep
      ? Math.max(brute, readMetric(metriqueDuDefi(quest, stats), stats) + quest.minStep)
      : monte;
    // ⚠️ Le plafond suit la même échelle que la cible : figé, il
    // écraserait la montée dès le 2e groupe.
    // ⚠️ `capAbsolu` : un plafond qui NE suit PAS l'échelle de groupe.
    //
    // `cap` est mis à l'échelle comme la cible — indispensable pour la
    // tenue de Transe, dont la difficulté doit monter. Mais un défi de
    // générateur a besoin de l'inverse : quel que soit le groupe,
    // personne n'empile 60 exemplaires du même générateur, il monte de
    // palier. Mesuré : les 45 derniers exemplaires coûtaient 128 470
    // minutes à eux seuls, parce que le prix monte de 25 % par unité.
    if (quest.capAbsolu) return Math.min(avecReste, quest.capAbsolu);
    if (!quest.cap) return avecReste;
    const plafond = quest.echelle
      ? Math.round(quest.cap * echelleGroupe(quest.echelle, groupe))
      : quest.cap;
    return Math.min(avecReste, plafond);
  }
  // ⚠️⚠️ DEUX FAÇONS D'EXPRIMER L'EFFORT D'UN DÉFI — préférer `partAsc`.
  //
  // `effortMin` dit « ce que je gagne en N minutes À REVENU GELÉ ». Le
  // défaut : acheter du Pacte ou un générateur AUGMENTE le revenu, donc
  // pour les défis d'ACHAT le chiffre déclaré ment. Mesuré : viser
  // « Pacte 8 » demandait `effortMin: 64` alors qu'un joueur qui
  // réinvestit y arrive en 12 MINUTES réelles.
  //
  // `partAsc` dit « ce défi consomme X % du chemin vers la prochaine
  // Ascension ». C'est la grandeur qui décrit vraiment l'effort, et elle
  // se met à l'échelle toute seule : le barème des seuils porte déjà la
  // rampe +15 % par Ascension, donc une part constante donne une
  // difficulté qui monte exactement comme prévu, sans multiplicateur.
  //
  // ⚠️ `partAsc` est prioritaire quand les deux sont présents.
  //
  // ⚠️ `partAsc` est BORNÉ par ce que le joueur peut réellement produire.
  //
  // Sans cette borne, une part constante DIVERGE sur les métriques dont
  // le coût double par niveau. Mesuré sur le Pacte, part 5 % : la cible
  // monte de ~1,6 niveau par Ascension (le seuil est multiplié par ~3)
  // alors que la production REPART DE ZÉRO à chaque Ascension. Temps
  // réel mesuré : 12 · 26 · 35 · 87 · 225 minutes. Toutes les parts
  // divergent, seule l'échelle change.
  //
  // La part dit l'AMBITION du défi, la borne dit ce qui est
  // ATTEIGNABLE : on prend le plus petit des deux.
  // ⚠️ 45 et non 90 : mesuré, à 90 la borne laissait passer des défis à
  // 139 minutes après la 4e Ascension. `questBudget` porte en plus le
  // multiplicateur de pièces d'Ascension (~x1,55 à la 4e), donc la
  // fenêtre réelle vaut toujours plus que le chiffre écrit ici.
  // Balayage : 90 -> 3 alertes, 60 -> 2, 45 -> 0.
  const PART_PLAFOND_MIN = 45;
  // ⚠️⚠️ PAS DE PLAFOND DE PRODUCTION SUR UNE PART DU SEUIL.
  //
  // Le budget était borné par ce que le joueur produit AU MOMENT DU
  // TIRAGE. Or le tirage suit immédiatement l'Ascension, quand sa
  // production vient d'être remise à zéro : le plafond s'appliquait donc
  // toujours, et la cible retombait sur son plancher.
  //
  // Signalé le 19/09 : à l'Ascension 5, « Obtiens 750 pièces » — la
  // valeur du tout premier œuf du jeu — alors que le seuil du groupe est
  // à 12,2 milliards.
  //
  // Une part du seuil décrit le chemin vers l'Ascension, pas un effort
  // instantané : le joueur PRODUIRA pendant le groupe, c'est tout
  // l'objet du défi. Le plafond reste pour les défis exprimés en minutes
  // d'effort, où il garde son sens.
  const budget = quest.partAsc
    ? quest.partAsc * ascensionThreshold(Math.max(0, Math.floor((stats && stats.ascension) || 0)))
    : questBudget(stats, quest.effortMin || 15);
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
  const metric = metriqueDuDefi(quest, stats);
  const now = readMetric(metric, stats);
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
    raw = clicker ? levelsAffordable((n) => autoClickerCost(clicker, n, stats && stats.ascension), now, budget) : now + 1;
  } else if (metric.startsWith('tapUpgrade:')) {
    // ⚠️ Cette branche MANQUAIT : les paliers de tap tombaient dans le
    // cas générique « avance d'un pas », donc leur cible ne regardait
    // pas le budget. Écrire `effortMin` sur un de ces défis n'avait
    // aucun effet — et leurs cibles fixes ont périmé dès que le prix des
    // paliers a changé (recalage du 17/09).
    const palier = TAP_UPGRADES.find((t) => t.id === metric.slice(11));
    raw = palier ? levelsAffordable((lv) => tapUpgradeCost(palier, lv, stats && stats.ascension), now, budget) : now + 1;
  } else if (metric === 'autoTotal') {
    // Combien d'unités de PLUS le budget achète, en le dépensant sur le
    // générateur qui en rend le plus — c'est ce qu'un joueur ferait pour
    // faire grimper ce compteur au moins cher.
    const owned = stats.autoClickers || {};
    let bestCount = 0;
    for (const clicker of AUTOCLICKERS) {
      const have = owned[clicker.id] || 0;
      const reachable = levelsAffordable((n) => autoClickerCost(clicker, n, stats && stats.ascension), have, budget);
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
  // ⚠️ UN PAS DÉCLARÉ EST UN PAS EXACT — le plancher relatif ne s'y
  // applique pas.
  //
  // Le plancher « au moins +15 % » existe pour les cibles CALCULÉES, qui
  // peuvent sortir trop basses. Sur un défi à `step` explicite il
  // écrasait le pas voulu : la campagne d'Aventure avançait de +5
  // niveaux jusqu'au chapitre 4, puis +6, +7, +8, +9, +10 — parce que
  // 15 % du niveau atteint dépassait 5. Elle cessait alors de se lire
  // comme une suite, ce qui est exactement ce qu'on lui demande.
  // ⚠️ PAS d'arrondi sur un pas déclaré : il déforme le pas.
  //
  // `roundQuestTarget` arrondit aux dizaines ou aux cinquantaines selon
  // l'ordre de grandeur. Mesuré sur « +5 au-dessus de ta meilleure
  // créature » : à 127 il rendait 130 (+3), à 340 il rendait 350 (+10).
  // Un pas déclaré doit être EXACTEMENT ce pas, sinon le défi ne dit
  // plus ce qu'il annonce.
  if (quest.step) return now + quest.step;
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
  const m = metriqueDuDefi(q, stats);
  const now = readMetric(m, stats);
  const base = readMetric(m, baseline);
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
  // ⚠️ SANS cible figée, on RÉSOUT — on ne renvoie jamais `q.target` brut.
  //
  // Le brut ignore l'échelle du groupe et le plancher « plus que
  // l'acquis ». Mesuré sur 14 600 tirages : 4 438 défis ressortaient
  // avec une cible SOUS ce que le joueur avait déjà, donc nés accomplis.
  // Un défi d'Aventure écrit `target: 5` renvoyait 5 à un joueur au
  // niveau 40.
  //
  // Le plancher ne « fuit » pas pour autant : il n'agit qu'ici, quand la
  // cible n'a pas encore été figée. Dès le tirage enregistré, c'est la
  // valeur figée qui fait autorité — c'est la ligne au-dessus.
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
    // ⚠️ Pas de `stats` ici : ce contrôle inspecte les DÉFINITIONS, hors
    // partie. Pour un défi dont la métrique dépend du groupe, on vérifie
    // TOUS les groupes — sinon le contrôle ne verrait que le premier.
    const metriques = q.metriqueParGroupe
      ? [0, 1, 2, 3, 4, 5, 6].map((g) => q.metriqueParGroupe(g)).filter(Boolean)
      : [q.metric];
    metriques.forEach((m) => {
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
    });
    // QUATRE façons LÉGITIMES de définir une cible : valeur fixe, part du
    // seuil d'Ascension (`partAsc`, à préférer), budget d'effort en
    // minutes, ou pas d'avancement (`step`).
    if (!q.target && !q.effortMin && !q.partAsc && !q.step) {
      problemes.push({ id: q.id, type: 'aucune cible définissable', detail: '' });
    }
    if (q.target && (q.effortMin || q.partAsc)) {
      problemes.push({ id: q.id, type: 'cible ET effort déclarés', detail: '' });
    }
    // ⚠️ Les deux écritures d'effort ensemble : `partAsc` gagnerait en
    // silence et `effortMin` deviendrait un commentaire trompeur.
    if (q.effortMin && q.partAsc) {
      problemes.push({ id: q.id, type: 'effortMin ET partAsc déclarés', detail: '' });
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
  // ⚠️ Le libellé reçoit la métrique RÉSOLUE en 2e argument : les défis
  // dont l'article change selon le groupe doivent pouvoir le NOMMER.
  // Sans ça ils afficheraient « Possède 10 » sans dire quoi.
  return q.label(t || 1, metriqueDuDefi(q, stats));
}

export function questDetail(questId, stats, baseline = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return { icon: '🎯', label: '', progress: 0, target: 1, current: 0, done: false };
  // Même règle qu'au-dessus : une cible fixe vient de la définition.
  const target = effectiveQuestTarget(questId, stats, targets);
  const progress = questProgress(questId, stats, baseline, { ...targets, [questId]: target });
  return {
    icon: q.icon,
    // ⚠️ La métrique RÉSOLUE doit être passée ici aussi. Sans elle, un
    // défi dont l'article dépend du groupe affichait « Possède 14 un
    // article » — le libellé ne savait pas quoi nommer. Signalé le 19/09.
    //
    // ⚠️ `questLabel` le faisait déjà ; c'est `questDetail`, l'autre
    // chemin d'affichage, qui l'avait manqué. Toute nouvelle fonction
    // qui construit un libellé doit passer `metriqueDuDefi(q, stats)`.
    label: q.label(target, metriqueDuDefi(q, stats)),
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
  if (!upgradeCreatureOwned(metriqueDuDefi(quest, stats), stats)) return false;
  if (typeof quest.available === 'function' && !quest.available(stats)) return false;
  return true;
}

export function questAlreadyDone(quest, stats = {}) {
  if (!quest || quest.mode !== 'absolute') return false;
  if (RESET_ON_DRAW_METRICS.includes(quest.metric)) return false;
  const acquis = readMetric(metriqueDuDefi(quest, stats), stats);
  // ⚠️ On compare à la cible RÉSOLUE, jamais à `quest.target` brut.
  //
  // Le brut ignore l'échelle du groupe ET le plancher « toujours
  // au-dessus de l'acquis ». Un défi d'Aventure écrit `target: 5`
  // ressortait « déjà accompli » pour un joueur au niveau 15, alors que
  // sa cible résolue valait 18 : il était écarté du tirage et remplacé
  // par un défi du pool. Mesuré au 2e groupe : 8 défis du schéma sur 6
  // œufs partaient ainsi.
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

// ⚠️⚠️ JAMAIS DEUX DÉFIS D'ACHAT D'AFFILÉE — règle de l'auteur du 20/09.
//
// Deux achats consécutifs enchaînent deux fois le même geste : ouvrir la
// boutique, dépenser. Les alterner avec un défi d'Aventure, de clic ou
// de mise de côté donne du rythme.
//
// ⚠️ La règle vaut aussi ENTRE DEUX ŒUFS : le dernier défi d'un œuf et
// le premier du suivant ne peuvent pas être tous deux des achats.
export const METRIQUES_ACHAT = ['tapPower', 'critLevel', 'critDamageLevel',
  'sanctuaryLevel', 'veilleurLevel'];

export function estDefiAchat(quest, stats) {
  const m = metriqueDuDefi(quest, stats) || '';
  return m.startsWith('auto:') || m.startsWith('tapUpgrade:')
    || METRIQUES_ACHAT.includes(m);
}

// Réordonne un œuf pour qu'aucun achat n'en suive un autre.
export function alternerAchats(cycle, stats, dernierEtaitAchat = false) {
  const achats = cycle.filter((q) => estDefiAchat(q, stats));
  const autres = cycle.filter((q) => !estDefiAchat(q, stats));
  // ⚠️ Le TOUT PREMIER défi du jeu doit être celui des pièces, pas un
  // achat : le joueur n'a rien à dépenser en arrivant. L'auteur, le
  // 20/09 : « pour le premier défi il faut mettre celui à 750, et
  // deuxième le Pacte ».
  if (!dernierEtaitAchat && autres.length && autres[0].metric === 'totalEarned') {
    const sortie = [autres.shift()];
    let prec = false;
    while (achats.length || autres.length) {
      if (!prec && achats.length) { sortie.push(achats.shift()); prec = true; } else if (autres.length) { sortie.push(autres.shift()); prec = false; } else { sortie.push(achats.shift()); prec = true; }
    }
    return sortie;
  }
  // ⚠️ Pas assez de défis « autres » pour séparer : on rend l'œuf tel
  // quel plutôt que de produire un ordre faux en silence.
  if (achats.length > autres.length + (dernierEtaitAchat ? 0 : 1)) return cycle;
  const sortie = [];
  let prec = dernierEtaitAchat;
  while (achats.length || autres.length) {
    if (!prec && achats.length) { sortie.push(achats.shift()); prec = true; } else if (autres.length) { sortie.push(autres.shift()); prec = false; } else { sortie.push(achats.shift()); prec = true; }
  }
  return sortie;
}

export function nextQuestSet(index, excludeIds = [], stats = {}) {
  // ⚠️ L'œuf est réordonné pour alterner achats et autres défis. On
  // regarde le dernier défi de l'œuf PRÉCÉDENT, la règle valant aussi
  // d'un œuf à l'autre.
  // ⚠️⚠️ PLUS AUCUN RÉARRANGEMENT. L'ordre est celui du fichier écrit.
  //
  // `alternerAchats` réordonnait l'œuf au tirage pour séparer les défis
  // d'achat. Ce n'est plus nécessaire : le fichier a été généré APRÈS
  // cette alternance, donc l'ordre y est déjà bon — et le recalculer
  // faisait diverger le jeu de ce qui est écrit, exactement le défaut
  // qu'on vient de supprimer.
  //
  // La fonction reste exportée : elle sert à REGÉNÉRER le fichier quand
  // on en modifie l'ordre, pas à le corriger à l'exécution.
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
    // ⚠️⚠️ LA SÉQUENCE NE SUBSTITUE PLUS JAMAIS.
    //
    // Avant, un défi du schéma écarté (pas encore débloqué, ou jugé déjà
    // accompli) était remplacé par un défi du POOL. Trois conséquences,
    // toutes signalées par l'auteur, build à jour :
    //
    //  - il voyait « Pacte niveau 6 » revenir après les Mains Spectrales,
    //    et « atteins 4 pièces par seconde » : des défis du pool, jamais
    //    demandés, aux cibles CALCULÉES sur son porte-monnaie — le
    //    système qu'on venait justement d'abandonner ;
    //  - les défis du schéma qu'il attendait (Faveur, Aventure) ne
    //    s'affichaient pas ;
    //  - la liste du jeu ne correspondait donc jamais au document de
    //    référence, quoi qu'on règle dans les défis eux-mêmes.
    //
    // Les 31 défis du schéma SONT les défis. Le pool ne sert plus qu'aux
    // cycles situés au-delà de la séquence écrite.
    //
    // ⚠️ Sans danger de blocage : chaque prérequis du schéma est un défi
    // ANTÉRIEUR du même schéma (Pacte -> Faveur -> Dégâts critiques ->
    // Sanctuaire -> Veilleur), et les défis se jouent dans l'ordre. Un
    // défi pas encore déblocable le devient en avançant.
    const kept = cycle.slice();
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
      // ⚠️ TOUJOURS passer par `resolveQuestTarget`, même pour une cible
      // fixe. Prendre `q.target` brut ici ignorait l'échelle du groupe
      // ET le plancher « plus que l'acquis » : mesuré sur 14 600
      // tirages, 4 438 défis étaient figés SOUS ce que le joueur avait
      // déjà, donc nés accomplis. C'est le tirage qui fige, donc c'est
      // ici que la résolution doit avoir lieu — nulle part ailleurs.
      // ⚠️ Un défi à PAS RELATIF (`step`) n'est pas figé ici : il se
      // résout quand il devient le défi COURANT, des défis plus tard.
      // Le figer au tirage donnait « monte une créature au niveau 5 » à
      // un joueur qui en avait une au 127, parce qu'au moment du tirage
      // il n'en possédait aucune.
      if (q.step) return;
      const brute = resolveQuestTarget(q, stats);
      // La répétition ne touche que les cibles FIXES : les cibles
      // calculées suivent déjà la production, elle-même indexée sur les
      // Ascensions.
      // ⚠️ UNE CIBLE FIGÉE NE PASSE PAS PAR `applyRepeatTier`.
      //
      // Troisième couche de mise à l'échelle trouvée sur le même
      // chemin : `resolveQuestTarget`, puis le multiplicateur de rythme,
      // puis celle-ci. Chacune était légitime quand les défis venaient
      // de modèles ; toutes sont fausses sur une cible déjà finale.
      //
      // ⚠️ Chercher UN recalcul et s'arrêter au premier trouvé ne suffit
      // pas : il faut suivre le chemin complet d'une cible, du fichier
      // jusqu'à l'affichage.
      targets[q.id] = q.fige ? q.target
        : (q.target ? applyRepeatTier(q, brute, index, stats && stats.ascension) : brute);
    });
    const ids = kept.map((q) => q.id);

    // ⚠️ LE BLOC DE REMPLACEMENT A ÉTÉ SUPPRIMÉ, PAS DÉSACTIVÉ.
    //
    // Depuis que `kept` vaut tout le cycle, il ne pouvait plus
    // s'exécuter. Le garder revenait à laisser dans le code un chemin
    // capable de glisser un défi du pool dans un œuf de la séquence —
    // exactement le bug qu'on vient de passer la journée à traquer, en
    // sommeil, prêt à se réveiller au premier changement de `kept`.
    //
    // Du code mort qui peut casser une garantie n'est pas du code mort :
    // c'est un piège avec un délai.
    // ⚠️⚠️ L'ASCENSION EST TOUJOURS LE DERNIER DÉFI DE L'ŒUF.
    //
    // Signalé trois fois par l'auteur. Le défi d'Ascension était bien
    // dans le cycle, en 5e position — mais les REMPLAÇANTS des défis non
    // débloqués sont ajoutés À LA FIN, donc ils passaient après lui. Le
    // joueur voyait « Fais ta 1re Ascension » puis « Possède 4 Mains
    // Spectrales », ce qui donne l'impression que le groupe continue
    // après l'Ascension alors qu'elle le CLÔT.
    //
    // Ordre imposé ici et pas dans les données : un remplaçant tiré au
    // sort ne peut pas savoir où il doit s'insérer.
    {
      const iAsc = ids.findIndex((id) => {
        const q = findQuest(id);
        return q && q.metric === 'ascension';
      });
      if (iAsc >= 0 && iAsc !== ids.length - 1) {
        const [asc] = ids.splice(iAsc, 1);
        ids.push(asc);
      }
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
// ⚠️⚠️ LA FAMILLE SE DÉDUIT DE LA MÉTRIQUE — ne pas la déclarer à la main.
//
// Trois métriques différentes racontent la MÊME chose au joueur :
// `totalEarned` (« gagne N pièces »), `coins` (« mets N de côté ») et
// `passiveIncome` (« atteins N par seconde »). Elles étaient dans trois
// familles distinctes, donc rien n'empêchait un œuf d'en contenir deux.
// Résultat signalé par l'auteur : « Constitue un trésor de 180 000 »
// suivi de « Gagne 41 000 » — deux défis qui se lisent pareil, et dont
// le second paraît absurde après le premier.
//
// Une seule famille ÉCONOMIE, et au plus UN défi d'économie par œuf.
export function familleDe(metric) {
  const m = metric || '';
  if (['totalEarned', 'coins', 'passiveIncome'].includes(m)) return 'economie';
  if (['advLevelReached', 'battleWon', 'threeStarLevel'].includes(m)) return 'aventure';
  if (['goldenClaimed', 'totalCrits', 'powerActivated', 'maxCombo',
    'maxTranseHoldSec', 'totalTaps'].includes(m)) return 'rythme';
  if (['runeBought', 'runeFused', 'runesEquipped', 'runeEquipped'].includes(m)) return 'runes';
  if (['maxCreatureLevel', 'maxEvolutionTier', 'ownedCount', 'deckCount'].includes(m)) return 'creatures';
  if (m === 'ascension') return 'ascension';
  if (m === 'offering') return 'offrande';
  return 'boutique';
}

// Combien de défis d'une même famille un œuf tolère. L'économie est
// limitée à UN : c'est la famille dont les défis se ressemblent le plus.
// ⚠️ Les familles dont les défis se LISENT pareil sont plafonnées à UN.
// « Achète une rune » + « Achète 2 runes en Aventure » dans le même œuf,
// c'est le même défi deux fois. Idem pour les créatures (« monte au
// niveau N » / « nourris jusqu'au niveau N ») et pour l'économie.
// L'aventure tolère 2 : « atteindre un niveau » et « gagner des
// combats » sont deux gestes différents. La boutique aussi : deux
// améliorations distinctes se distinguent par leur nom.
const MAX_PAR_FAMILLE = {
  economie: 1, runes: 1, creatures: 1, offrande: 1, ascension: 1,
  // ⚠️ La boutique passe à 3 et le rythme à 3 : les œufs comptent
  // désormais SIX défis au lieu de cinq, et les défis d'achat sont
  // scindés en deux étapes réparties dans des œufs différents. À deux
  // par œuf, il devenait impossible de les placer.
  aventure: 2, rythme: 3, boutique: 3,
};
const MAX_PAR_FAMILLE_DEFAUT = 2;

// ⚠️ Exposé pour que les outils lisent CETTE table au lieu d'en
// recopier une. Une copie ne suit pas les changements : relever le
// plafond ici ne changeait rien au contrôle, qui refusait toujours.
export function plafondFamille(famille) {
  return MAX_PAR_FAMILLE[famille] || MAX_PAR_FAMILLE_DEFAUT;
}

// ⚠️⚠️ POINT DE VÉRITÉ UNIQUE : « ce défi peut-il être remplacé ? »
//
// Le jeu comptait TROIS endroits capables de retirer un défi de l'œuf :
// au tirage, au chargement de la sauvegarde, et en continu pendant la
// partie. Chacun avait sa propre condition, écrite à la main. Résultat :
// supprimer la substitution au tirage n'a rien changé chez l'auteur,
// parce que les deux autres continuaient — et il a vu un défi de l'œuf 1
// prendre la place de la Faveur des Esprits sous ses yeux.
//
// Une seule règle, ici : un défi de la SÉQUENCE n'est jamais remplacé.
// Sa précondition est toujours un défi ANTÉRIEUR du même schéma, donc
// elle finit par être remplie — il n'y a rien à réparer, juste à
// avancer. Seuls les défis du POOL peuvent devenir irréalisables pour de
// bon, et c'est pour eux que le mécanisme existe.
//
// ⚠️ TOUT code qui retire un défi d'un œuf DOIT passer par ici. Écrire
// sa propre condition, c'est recréer le bug — et le contrôle
// `auditSubstitutions` refuse justement toute exception.
export function peutEtreRemplace(questId) {
  if (IDS_ECRITS.has(questId)) return false;
  return !SEQUENCE_QUESTS.some((q) => q.id === questId);
}

export function pickQuestSet(excludeIds = [], stats = {}, dejaPris = {}) {
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
  // ⚠️ On repart des métriques et familles DÉJÀ dans l'œuf, pas d'un
  // compteur vierge. Les remplaçants comblent les trous du schéma : sans
  // ça, un œuf dont le défi de Sanctuaire n'est pas encore débloqué
  // recevait un second défi d'ÉCONOMIE à côté de celui du schéma.
  const usedMetrics = new Set(dejaPris.metriques || []);
  const familyCount = { ...(dejaPris.familles || {}) };
  const plafond = (fam) => (MAX_PAR_FAMILLE[fam] || MAX_PAR_FAMILLE_DEFAUT);
  for (const q of shuffled) {
    if (chosen.length >= QUEST_SET_SIZE) break;
    if (usedMetrics.has(q.metric)) continue;
    const fam = familleDe(q.metric);
    if ((familyCount[fam] || 0) >= plafond(fam)) continue;
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
// ⚠️⚠️ LES DÉFIS D'OBJET DE CRÉATURE SONT SUPPRIMÉS — ils étaient
// IMPOSSIBLES, et le renommage de l'objet n'y changeait rien.
//
// Ils étaient générés ici pour les 20 objets, avec un `available` qui ne
// testait QUE le prix :
//
//     available: (s) => lvl > 0 || upgradeItemCost(item, 0) <= questBudget(s, 30)
//
// Il ne vérifiait JAMAIS que le joueur possède la créature de l'objet.
// Or la boutique verrouille le bouton (« Nécessite <créature> ») tant
// qu'elle n'est pas dans la collection. Le défi pouvait donc être tiré
// pour un joueur qui n'aura peut-être jamais cette créature, et il
// BLOQUAIT SON ŒUF DÉFINITIVEMENT.
//
// C'est la panne signalée trois fois par l'auteur sur « Griffe de
// Braisillon ». J'avais d'abord cru à un problème de nom : le nom était
// bien faux, mais ce n'était pas la cause.
//
// Décision : supprimer la famille plutôt que d'ajouter le test
// d'appartenance. Un défi qui dépend de posséder UNE créature précise
// parmi 26 reste fragile même corrigé — il dépend d'un tirage que le
// joueur ne contrôle pas. Les défis de boutique passent désormais par ce
// que TOUT joueur peut acheter : le Pacte, les paliers de tap, les
// générateurs, le Sanctuaire et le Veilleur.

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
      return have > 0 || autoClickerCost(clicker, 0, s && s.ascension) <= questBudget(s, 30);
    },
    label: (t) => `Possède ${fmtQ(t)} ${pluralQ(clicker.name)}`,
  });
});

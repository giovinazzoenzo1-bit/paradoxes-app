// Budget d'effort : combien de pièces un joueur produit en N minutes.
//
// ⚠️ Vit ICI et pas dans le moteur : trois conditions d'apparition de
// `questDefs.js` en ont besoin. Si cette fonction restait dans
// `questLogic.js`, les données importeraient le moteur et le moteur les
// données — cycle d'imports.
import {
  ascensionSpeedMultiplier,
  essenceBonusMultiplier,
  sanctuaryMultiplier,
  tapDamage,
  upgradeBonuses,
} from './clickerLogic';

// Une Ascension multiplie la production par 1,30 ; les cibles en pièces
// doivent monter de 45 %. La production apportant déjà 1,30, on n'ajoute
// que le complément.
export const ASCENSION_COIN_TARGET_RATE = 1.45;
const ASCENSION_COIN_EXTRA = ASCENSION_COIN_TARGET_RATE / 1.30;

export function ascensionCoinMultiplier(ascensionCount) {
  const n = Math.max(0, ascensionCount || 0);
  return Math.pow(ASCENSION_COIN_EXTRA, n);
}

// ⚠️ Cadence d'un joueur qui tape À LA MAIN.
//
// ⚠️⚠️ NE JAMAIS CALER CETTE VALEUR SUR UN AUTOCLICKER. L'autoclicker de
// l'auteur ne sert qu'à TESTER le jeu plus vite ; ce n'est pas un joueur.
// L'avoir pris pour référence (6,7/s, soit 150 ms) rendait tout défi en
// pièces 1,67x plus long pour un vrai joueur — une difficulté imposée à
// tout le monde à cause d'un outil de test. Erreur commise le 17/09,
// corrigée le jour même.
//
// 4 taps/s est déjà un rythme soutenu à la main, et c'est la valeur du
// modèle de joueur de `mobile/tools/audit-quetes.js` : les deux doivent
// rester ÉGALES, sinon l'audit mesure un joueur que le budget ne vise
// pas. Le changer redimensionne TOUTES les cibles en pièces du jeu.
export const HUMAN_TAPS_PER_SEC = 4;

// Revenu estimé par seconde, toutes sources confondues.
//
// ⚠️ CETTE FONCTION EST LA CAUSE RÉELLE DU BUG DES DÉFIS D'APRÈS
// ASCENSION. Elle valait auparavant `passiveIncome + tapPower * 0,5`,
// c'est-à-dire :
//   - `tapPower` est un NIVEAU, pas des dégâts (piège déjà documenté) ;
//   - aucune cadence de tap — le joueur était supposé taper 1 fois par
//     seconde, au lieu des 6,7 de la référence ;
//   - aucun multiplicateur global, alors que `gainCoins` applique au tap
//     exactement les mêmes qu'au passif (Sanctuaire, essence, Ascension,
//     bonus de pièces).
//
// Résultat : le revenu de TAP était sous-estimé d'un facteur ~13. En
// temps normal le passif masquait l'erreur. Mais juste après une
// Ascension le passif vaut ZÉRO et tout le revenu vient du tap : le
// budget s'effondrait alors à presque rien, et un PLANCHER adossé au
// seuil d'Ascension avait été ajouté pour compenser. Ce plancher doublant
// à chaque Ascension pendant que la production ne croît que de 30 %, le
// défi qui suit une Ascension s'allongeait indéfiniment — 48 min, puis
// 74, 113, 174 pour le même défi à la 4e Ascension.
//
// Avec un revenu de tap correctement estimé, les cibles montent de 45 %
// par Ascension (l'intention affichée) et le plancher devient inutile.
export function estimatedIncomePerSecond(stats) {
  const passive = Math.max(0, (stats && stats.passiveIncome) || 0);
  const level = Math.max(1, (stats && stats.tapPower) || 1);
  // Mêmes multiplicateurs que `gainCoins` dans ClickerScreen : un seul
  // des deux qui dérive et le budget cesse de décrire le jeu réel.
  const globalMult =
    sanctuaryMultiplier((stats && stats.sanctuaryLevel) || 0) *
    essenceBonusMultiplier((stats && stats.essence) || 0) *
    ascensionSpeedMultiplier((stats && stats.ascension) || 0) *
    (1 + upgradeBonuses((stats && stats.upgradeLevels) || {}).coinPct);
  return passive + tapDamage(level) * HUMAN_TAPS_PER_SEC * globalMult;
}

export function questBudget(stats, minutes) {
  return estimatedIncomePerSecond(stats) * 60 * Math.max(1, minutes)
    * ascensionCoinMultiplier(stats && stats.ascension);
}

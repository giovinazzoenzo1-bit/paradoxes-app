// Budget d'effort : combien de pièces un joueur produit en N minutes.
//
// ⚠️ Vit ICI et pas dans le moteur : trois conditions d'apparition de
// `questDefs.js` en ont besoin. Si cette fonction restait dans
// `questLogic.js`, les données importeraient le moteur et le moteur les
// données — cycle d'imports.
import { ascensionSpeedMultiplier } from './clickerLogic';

// Une Ascension multiplie la production par 1,30 ; les cibles en pièces
// doivent monter de 45 %. La production apportant déjà 1,30, on n'ajoute
// que le complément.
export const ASCENSION_COIN_TARGET_RATE = 1.45;
const ASCENSION_COIN_EXTRA = ASCENSION_COIN_TARGET_RATE / 1.30;

export function ascensionCoinMultiplier(ascensionCount) {
  const n = Math.max(0, ascensionCount || 0);
  return Math.pow(ASCENSION_COIN_EXTRA, n);
}

// Revenu estimé par seconde, toutes sources confondues.
export function estimatedIncomePerSecond(stats) {
  const passive = Math.max(0, (stats && stats.passiveIncome) || 0);
  const perTap = Math.max(1, (stats && stats.tapPower) || 1);
  return passive + perTap * 0.5;
}

export function questBudget(stats, minutes) {
  return estimatedIncomePerSecond(stats) * 60 * Math.max(1, minutes)
    * ascensionCoinMultiplier(stats && stats.ascension);
}

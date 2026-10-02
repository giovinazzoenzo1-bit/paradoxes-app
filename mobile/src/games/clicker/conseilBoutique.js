// ════════════════════════════════════════════════════════════════════
//  ACHAT CONSEILLÉ DE LA BOUTIQUE (27/09) — fonctions PURES, testables
// ════════════════════════════════════════════════════════════════════
// L'étoile « Conseillé » du Grimoire désigne l'achat abordable qui rapporte le
// plus de pièces PAR PIÈCE dépensée. Pour ne pas mentir, le revenu est calculé
// avec les FORMULES DU JEU (ClickerScreen : handleTap / gainCoins /
// passiveRate), au rythme de référence du projet (autoclicker à 150 ms) :
//   tap = (tapDamage + bonus fixes des reliques + bonus des améliorations)
//         × Transe (plafond ×3, atteint en 50 taps) × espérance critique
//   × multiplicateurs de gain (Sanctuaire, Essence, Ascension, reliques %)
//   + revenu passif (passiveRate).
// Arrondis et pouvoirs temporaires ignorés (sans effet sur le classement).
// Contrôle : auditConseilBoutique.
import {
  tapDamage, tapUpgradeBonus, upgradeBonuses, critChance, critMultiplier, transeMultiplier,
  sanctuaryMultiplier, essenceBonusMultiplier, ascensionSpeedMultiplier, passiveRate,
} from './clickerLogic.js';

export const TAPS_PAR_SECONDE_REF = 1000 / 150;
const SERIE_SOUTENUE = 1e6; // au rythme de référence, la Transe est au plafond

export function revenuParSeconde(e) {
  const ub = upgradeBonuses(e.upgradeLevels || {});
  const p = Math.min(1, critChance(e.critLevel || 0) + (ub.critChancePct || 0));
  const critM = critMultiplier(e.critDamageLevel || 0) * (1 + (ub.critMultPct || 0));
  const tapFixe = tapDamage(e.tapPower || 1) + (ub.tapFlat || 0) + tapUpgradeBonus(e.tapUpgrades || {});
  const parTap = tapFixe * transeMultiplier(SERIE_SOUTENUE) * ((1 - p) + p * critM);
  const gain = sanctuaryMultiplier(e.sanctuaryLevel || 0) * essenceBonusMultiplier(e.essence || 0)
    * ascensionSpeedMultiplier(e.ascensionCount || 0) * (1 + (ub.coinPct || 0));
  const passif = passiveRate({
    autoClickers: e.autoClickers || {}, upgradeLevels: e.upgradeLevels || {}, sanctuaryLevel: e.sanctuaryLevel || 0,
    essence: e.essence || 0, ascensionCount: e.ascensionCount || 0, powerBoost: 1,
  });
  return TAPS_PAR_SECONDE_REF * parTap * gain + passif;
}

// État après UN niveau de plus. `delta` : { tapPower: 1 } | { critLevel: 1 } |
// { critDamageLevel: 1 } | { sanctuaryLevel: 1 } | { tapUpgrades: id } |
// { autoClickers: id } | { upgradeLevels: id }.
export function etatApres(e, delta) {
  const n = { ...e };
  for (const [cle, v] of Object.entries(delta || {})) {
    if (typeof v === 'number') n[cle] = (e[cle] || 0) + v;
    else n[cle] = { ...(e[cle] || {}), [v]: ((e[cle] || {})[v] || 0) + 1 };
  }
  return n;
}

// Pièces par seconde gagnées par pièce dépensée (0 si inconnu).
export function rendement(e, delta, prix) {
  if (!delta || !Number.isFinite(prix) || prix <= 0) return 0;
  return Math.max(0, revenuParSeconde(etatApres(e, delta)) - revenuParSeconde(e)) / prix;
}

// candidats : [{ id, delta, prix }] (les achats ABORDABLES) → id conseillé ou null.
export function meilleurAchat(e, candidats) {
  let meilleur = null; let score = 0;
  for (const c of candidats || []) {
    const r = rendement(e, c.delta, c.prix);
    if (r > score) { score = r; meilleur = c.id; }
  }
  return meilleur;
}

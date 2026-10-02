// ════════════════════════════════════════════════════════════════════
//  FAMILLES DE LA BOUTIQUE (02/10) — reliques par effet, auto-clics par palier
// ════════════════════════════════════════════════════════════════════
// Déplacées de l'ancienne disposition de l'arbre (abandonné) : lues par les
// chapitres du Grimoire et par le modèle des éléments. Fonctions PURES.
import { UPGRADE_ITEMS, AUTOCLICKERS } from './clickerLogic.js';

// Familles lues dans les DONNÉES du jeu (source unique pour l'arbre ET
// l'audit) : reliques par type d'effet (ordre des données), auto-clics par
// palier (triés par prix de base — dans un palier, c'est aussi l'ordre des
// prix réels).
export const FAMILLES_RELIQUES = ['tapFlat', 'critChancePct', 'critMultPct', 'coinPct', 'autoClickerPct'];
export function reliquesParFamille() {
  const r = {};
  FAMILLES_RELIQUES.forEach((f) => { r[f] = UPGRADE_ITEMS.filter((i) => i.effect && i.effect.type === f); });
  return r;
}
export const PALIERS_AUTO = [1, 2, 3];
export function autoClicsParPalier() {
  const r = {};
  PALIERS_AUTO.forEach((t) => { r[t] = AUTOCLICKERS.filter((c) => c.tier === t).sort((a, b) => a.baseCost - b.baseCost); });
  return r;
}

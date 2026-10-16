// ════════════════════════════════════════════════════════════════════
//  CALCULATEUR DE DÉFIS EN JEU (18/10) — cahier des charges de l'auteur :
//  CLICKER_ADVENTURE_STATE.md, bloc « 📋 CAHIER DES CHARGES COMPLET ».
// ════════════════════════════════════════════════════════════════════
// À l'apparition d'un défi (= fin du précédent), sa cible est calculée sur la PHOTO du joueur, puis figée :
//   budget = pièces en poche (sauf les pièces PROTÉGÉES : Offrande) + production de référence × temps visé ;
//   achats : autant de niveaux que le budget en paie, au prix réel, niveau par niveau (prérequis compris) ;
//   cible dorée / pouvoirs : temps visé ÷ rythme d'apparition ; taps et critiques : 7 taps/s RÉELS.
// Fonctions PURES : l'écran (ClickerScreen) et les outils de mesure appellent les mêmes.
import { DEFIS_ECRITS } from './defisEcrits';
import { coutNiveauAchat } from './questLogic';
import { valeurTap, revenuPassif } from './conseilBoutique';
import {
  CREATURES, powerForCreature, rechargePouvoirMs, AUTOCLICKERS, autoClickerCost, TAP_UPGRADES,
  tapUpgradeUnlocked, critChance, upgradeBonuses, GOLDEN_MIN_INTERVAL_SEC, GOLDEN_MAX_INTERVAL_SEC,
} from './clickerLogic';

// ---- Joueur de référence (décisions de l'auteur, 18/10) ----------------
export const TAPS_REF = 7;            // rythme FIXE (le joueur rapide va plus vite : le talent reste récompensé)
export const TRANSE_MOYENNE = 2.47;   // 60 % des taps en Transe (rapport de l'auteur) → multiplicateur moyen
export const DELAI_POUVOIR_SEC = 5;   // un pouvoir prêt est activé ~5 s plus tard

// Temps visé par défi, en secondes de jeu actif (auteur, 18/10, 2e réglage : « l'œuf 1 était trop long ; l'œuf 3 doit
// avoir le temps qu'avait l'œuf 1, et les œufs 1 et 2 nettement moins ») : 2 min à l'œuf 1, 3,5 min à l'œuf 2, 5 min
// dès l'œuf 3, puis +0,75 min tous les 3 œufs (6, 9, 12…) → 14 min à l'œuf 40.
export function tempsViseOeuf(oeuf) {
  const n = Math.max(1, Math.floor(Number(oeuf) || 1));
  if (n === 1) return 120;
  if (n === 2) return 210;
  return 300 + 45 * Math.floor((n - 3) / 3);
}

// Œuf (1…40) de chaque défi écrit.
const OEUF_DU_DEFI = {};
DEFIS_ECRITS.forEach((oeuf, k) => oeuf.forEach((q) => { OEUF_DU_DEFI[q.id] = k + 1; }));
export const oeufDuDefi = (id) => OEUF_DU_DEFI[id] || 0;

// ---- Pouvoirs des créatures : % du revenu, par créature ------------------
// (multiplicateur − 1) × durée ÷ (recharge + délai) : commune +22 %, peu commune +24 %, rare +23 %, épique +48 %,
// légendaire +81 %, mythique +93 % ; « remise » (Ventis, Glyphon) 0 %. Les créatures « passif » ajoutent aussi au passif.
export function bonusCreature(id) {
  const c = CREATURES.find((x) => x.id === id);
  if (!c) return { tap: 0, passif: 0, parSec: 0 };
  const p = powerForCreature(c, 1);
  const cycle = rechargePouvoirMs(c) / 1000 + DELAI_POUVOIR_SEC;
  if (!p || !(cycle > 0)) return { tap: 0, passif: 0, parSec: 0 };
  if (p.effectType === 'discount_next') return { tap: 0, passif: 0, parSec: 1 / cycle };
  return {
    tap: Math.max(0, (p.tapMultiplier - 1) * p.durationSec / cycle),
    passif: p.effectType === 'passive_boost' ? Math.max(0, (p.effectValue - 1) * p.durationSec / cycle) : 0,
    parSec: 1 / cycle,
  };
}
// Les 3 MEILLEURES créatures possédées (anti-triche : pas le deck du moment).
export function bonusPouvoirs(ids) {
  const vus = new Set();
  const liste = (ids || []).filter((id) => !vus.has(id) && vus.add(id)).map(bonusCreature)
    .sort((a, b) => (b.tap - a.tap) || (b.passif - a.passif)).slice(0, 3);
  return liste.reduce((t, b) => ({ tap: t.tap + b.tap, passif: t.passif + b.passif, parSec: t.parSec + b.parSec }),
    { tap: 0, passif: 0, parSec: 0 });
}

// État d'économie lu sur la photo des défis (mêmes champs que conseilBoutique).
function etatDe(stats) {
  const s = stats || {};
  return {
    tapPower: s.tapPower || 1, critLevel: s.critLevel || 0, critDamageLevel: s.critDamageLevel || 0,
    upgradeLevels: s.upgradeLevels || {}, tapUpgrades: { ...(s.tapUpgrades || {}) }, autoClickers: { ...(s.autoClickers || {}) },
    sanctuaryLevel: s.sanctuaryLevel || 0, essence: s.essence || 0, ascensionCount: s.ascension || 0,
  };
}
// Production de référence, en pièces par seconde.
export function productionReference(stats, idsCreatures) {
  const e = etatDe(stats);
  const b = bonusPouvoirs(idsCreatures);
  return TAPS_REF * valeurTap(e) * TRANSE_MOYENNE * (1 + b.tap) + revenuPassif(e) * (1 + b.passif);
}

// ---- Quels défis sont calculés -----------------------------------------
const estAchat = (m) => m === 'tapPower' || m === 'critLevel' || m === 'critDamageLevel'
  || (typeof m === 'string' && (m.startsWith('auto:') || m.startsWith('tapUpgrade:')));
const AUTRES = ['totalEarned', 'coins', 'passiveIncome', 'goldenClaimed', 'powerActivated', 'totalTaps', 'totalCrits'];
export const estCalcule = (q) => !!q && (estAchat(q.metric) || AUTRES.includes(q.metric))
  && (q.mode === 'delta' || q.mode === 'absolute');

// Arrondi VERS LE HAUT à 2 chiffres significatifs (jamais en dessous du calcul).
export function joliHaut(x) {
  const v = Math.max(1, Number(x) || 1);
  if (v < 100) return Math.ceil(v);
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.ceil(v / p) * p;
}

const niveauDe = (m, e) => {
  if (m.startsWith('auto:')) return e.autoClickers[m.slice(5)] || 0;
  if (m.startsWith('tapUpgrade:')) return e.tapUpgrades[m.slice(11)] || 0;
  return e[m] || 0;
};
// Niveau au-delà duquel la Faveur ne sert plus (chance de critique plafonnée).
function plafondFaveur(e) {
  const ub = upgradeBonuses(e.upgradeLevels);
  let l = 0;
  while (l < 500 && critChance(l + 1) + (ub.critChancePct || 0) > critChance(l) + (ub.critChancePct || 0)) l += 1;
  return l;
}
// Combien de niveaux le budget paie (prérequis d'un palier verrouillé payés d'abord).
function niveauxPayables(m, e, asc, budget) {
  let reste = budget;
  if (m.startsWith('tapUpgrade:')) {
    const idx = TAP_UPGRADES.findIndex((u) => u.id === m.slice(11));
    // Les paliers se débloquent dans l'ordre : le 1er demande un niveau de Pacte, le suivant le palier d'avant.
    for (let g = 0; idx >= 0 && g < 400 && !tapUpgradeUnlocked(idx, e.tapPower, e.tapUpgrades); g++) {
      let k = 0;
      while (k <= idx && tapUpgradeUnlocked(k, e.tapPower, e.tapUpgrades)) k += 1; // 1er palier verrouillé
      if (k === 0) { reste -= coutNiveauAchat('tapPower', e.tapPower, asc); e.tapPower += 1; }
      else { const id = TAP_UPGRADES[k - 1].id; reste -= coutNiveauAchat('tapUpgrade:' + id, e.tapUpgrades[id] || 0, asc); e.tapUpgrades[id] = (e.tapUpgrades[id] || 0) + 1; }
    }
  }
  let n = 0;
  let niveau = niveauDe(m, e);
  for (; n < 500; n++) {
    const c = coutNiveauAchat(m, niveau, asc);
    if (!(c > 0) || c > reste) break;
    reste -= c; niveau += 1;
  }
  if (m === 'critLevel') n = Math.min(n, Math.max(1, plafondFaveur(e) - niveauDe(m, e)));
  return Math.max(1, n);
}
// Revenu passif atteint en dépensant le budget au meilleur rapport passif / prix.
function passifAtteint(e, asc, budget) {
  let reste = budget;
  let p = revenuPassif(e);
  for (let g = 0; g < 600; g++) {
    let best = null;
    AUTOCLICKERS.forEach((a) => {
      const n = e.autoClickers[a.id] || 0;
      const cout = autoClickerCost(a, n, asc);
      if (!(cout > 0) || cout > reste) return;
      const p1 = revenuPassif({ ...e, autoClickers: { ...e.autoClickers, [a.id]: n + 1 } });
      const score = (p1 - p) / cout;
      if (score > 0 && (!best || score > best.score)) best = { id: a.id, cout, p1, score };
    });
    if (!best) break;
    reste -= best.cout; e.autoClickers[best.id] = (e.autoClickers[best.id] || 0) + 1; p = best.p1;
  }
  return p;
}

// ---- LA CIBLE --------------------------------------------------------------
// ctx : { oeuf, creatures: ids possédés, protegees: pièces protégées (déjà bornées à la poche) }.
// Rend un entier ≥ 1, ou null (défi non calculé : l'écran garde sa règle d'avant).
export function cibleCalculee(q, stats, ctx) {
  try {
    if (!estCalcule(q)) return null;
    const s = stats || {};
    const c = ctx || {};
    const m = q.metric;
    const asc = s.ascension || 0;
    const tau = tempsViseOeuf(c.oeuf || oeufDuDefi(q.id) || 1);
    const prod = productionReference(s, c.creatures);
    const poche = Math.max(0, (s.coins || 0) - Math.max(0, c.protegees || 0));
    const budget = poche + prod * tau;
    let cible = null;
    if (estAchat(m) && q.mode === 'delta') cible = niveauxPayables(m, etatDe(s), asc, budget);
    else if (m === 'totalEarned' && q.mode === 'delta') cible = joliHaut(prod * tau);
    else if (m === 'coins' && q.mode === 'absolute') cible = joliHaut((s.coins || 0) + prod * tau);
    else if (m === 'passiveIncome' && q.mode === 'absolute') {
      const actuel = revenuPassif(etatDe(s));
      cible = joliHaut(Math.max(actuel + 1, passifAtteint(etatDe(s), asc, budget)));
    } else if (m === 'goldenClaimed' && q.mode === 'delta') {
      const a = GOLDEN_MIN_INTERVAL_SEC, b = GOLDEN_MAX_INTERVAL_SEC, moy = (a + b) / 2;
      const premier = ((a * a + a * b + b * b) / 3) / (2 * moy); // attente moyenne de la 1re cible (35 s)
      cible = Math.max(1, 1 + Math.round((tau - premier) / moy));
    } else if (m === 'powerActivated' && q.mode === 'delta') {
      const r = bonusPouvoirs(c.creatures).parSec;
      cible = r > 0 ? Math.max(1, Math.round(tau * r)) : null;
    } else if (m === 'totalTaps' && q.mode === 'absolute') {
      cible = Math.ceil(((s.totalTaps || 0) + TAPS_REF * tau) / 100) * 100;
    } else if (m === 'totalCrits' && q.mode === 'delta') {
      const ub = upgradeBonuses(s.upgradeLevels || {});
      const p = Math.min(1, critChance(s.critLevel || 0) + (ub.critChancePct || 0));
      cible = p > 0 ? Math.max(1, Math.round(TAPS_REF * tau * p)) : null;
    }
    if (cible === null) return null;
    cible = Math.floor(cible);
    // Jamais née accomplie : une cible ABSOLUE dépasse toujours l'acquis.
    if (q.mode === 'absolute') {
      const acquis = m === 'coins' ? (s.coins || 0) : m === 'totalTaps' ? (s.totalTaps || 0) : revenuPassif(etatDe(s));
      if (cible <= acquis) cible = Math.floor(acquis) + 1;
    }
    return Number.isInteger(cible) && cible >= 1 ? cible : null;
  } catch (e) {
    return null;
  }
}

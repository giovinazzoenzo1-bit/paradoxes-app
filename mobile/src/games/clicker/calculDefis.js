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
  PALIER_TAP_ASCENSION, GENERATEUR_ASCENSION, chanceLegendaire,
} from './clickerLogic';

// ---- Joueur de référence (décisions de l'auteur, 18/10) ----------------
export const TAPS_REF = 7;            // rythme de DÉPART (joueur qui n'a pas encore 500 taps mesurés) et du joueur de référence
// ⚠️⚠️ RYTHME DU JOUEUR (décision de l'auteur : « que les défis durent le même temps pour tous », lents, rapides et autoclicks).
// Avant, le rythme était FIXE (7 taps/s) — MESURÉ : 50 h de jeu à 4 taps/s, 31 h à 7, 20,7 h à 16,5 ; le joueur lent
// abandonne, l'autoclick fonce. Désormais la photo du défi porte `tapsParSec`, le rythme MESURÉ du joueur (moyenne des 500
// derniers taps, pauses de plus de 1,2 s exclues) : il MONTE tout de suite, il DESCEND d'au plus 10 % par fenêtre de 500 taps
// (taper lentement exprès pour avoir de petites cibles coûte plus qu'il ne rapporte), jamais sous 4 taps/s. La cible reste
// FIGÉE à l'apparition du défi. Les seuils d'Ascension sont calculés au plancher (4 taps/s) : personne ne farme à la fin.
export const RYTHME_FENETRE_TAPS = 500;
export const RYTHME_PLANCHER = 4;
export const RYTHME_PLAFOND = 60;      // garde-fou (aucun humain ; un autoclick plus rapide reste à 60)
export const RYTHME_BAISSE_MAX = 0.10;
export function majRythme(actuel, taps, secondes) {
  const a = Number.isFinite(actuel) && actuel > 0 ? actuel : TAPS_REF;
  if (!(taps > 0) || !(secondes > 0)) return a;
  const mesure = Math.min(RYTHME_PLAFOND, taps / secondes);
  const nouveau = mesure >= a ? mesure : Math.max(mesure, a * (1 - RYTHME_BAISSE_MAX));
  return Math.max(RYTHME_PLANCHER, Math.round(nouveau * 100) / 100);
}
export function rythmeDe(stats) {
  const v = Number(stats && stats.tapsParSec);
  return Number.isFinite(v) && v > 0 ? Math.min(RYTHME_PLAFOND, Math.max(RYTHME_PLANCHER, v)) : TAPS_REF;
}
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
    legendaires: s.legendaires || {}, // 17/10 : critique légendaire + Sanctuaire légendaire dans la production de référence
  };
}
// Production de référence, en pièces par seconde.
export function productionReference(stats, idsCreatures) {
  const e = etatDe(stats);
  const b = bonusPouvoirs(idsCreatures);
  return rythmeDe(stats) * valeurTap(e) * TRANSE_MOYENNE * (1 + b.tap) + revenuPassif(e) * (1 + b.passif);
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

// Cible ABSOLUE arrondie vers le haut, mais au pas qui ne dépasse pas 10 % du GAIN demandé (jamais en dessous du calcul).
// ⚠️ 17/10 — MESURÉ : aux A4-A5, le passif ne pèse que 0,4 % de la production ; un défi « Atteins X pièces par seconde » ne
// demandait que +1 % de passif (635 855 → 641 833) et l'arrondi à 2 chiffres (650 000) en exigeait le DOUBLE, au-delà du budget :
// 161 min au lieu de 12,5. Même piège que les taps « au total » (ceaee8c). Les jolis nombres restent quand ils coûtent ≤ 10 %.
export function arrondiGain(vise, acquis) {
  const gain = Math.max(1, vise - acquis);
  const joli = joliHaut(vise);
  if (joli - vise <= 0.1 * gain) return joli;
  const pas = Math.max(1, Math.pow(10, Math.floor(Math.log10(0.1 * gain))));
  return Math.ceil(vise / pas) * pas;
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
// Prix d'UN niveau de plus, prérequis compris (un palier verrouillé demande d'abord le Pacte ou le palier d'avant).
function coutUnNiveau(m, e0, asc) {
  const e = { ...e0, tapUpgrades: { ...(e0.tapUpgrades || {}) }, autoClickers: { ...(e0.autoClickers || {}) } };
  let cout = 0;
  if (m.startsWith('tapUpgrade:')) {
    const idx = TAP_UPGRADES.findIndex((u) => u.id === m.slice(11));
    if (idx < 0) return Infinity;
    for (let g = 0; g < 400 && !tapUpgradeUnlocked(idx, e.tapPower, e.tapUpgrades); g++) {
      let k = 0;
      while (k <= idx && tapUpgradeUnlocked(k, e.tapPower, e.tapUpgrades)) k += 1;
      if (k === 0) { cout += coutNiveauAchat('tapPower', e.tapPower, asc); e.tapPower += 1; }
      else { const id = TAP_UPGRADES[k - 1].id; cout += coutNiveauAchat('tapUpgrade:' + id, e.tapUpgrades[id] || 0, asc); e.tapUpgrades[id] = (e.tapUpgrades[id] || 0) + 1; }
    }
  }
  return cout + coutNiveauAchat(m, niveauDe(m, e), asc);
}
// ⚠️⚠️ 17/10 — BASCULE (règle de l'auteur : « le calculateur est fait pour ne pas bloquer le joueur ; si la demande est trop
// grosse, il faut basculer sur un objet plus petit, qui demande le bon temps de farm »). MESURÉ avant : en fin d'Ascension,
// un niveau de palier (×2,5 par niveau) dépassait seul le budget → « Achète 1 niveau » en 22 à 31 min au lieu de 9 à 14.
// Si UN niveau de l'objet écrit coûte plus que le budget du défi, le défi vise un autre objet : même famille de la même
// Ascension d'abord (palier ↔ palier, générateur ↔ générateur), puis l'autre famille, puis l'Ascension d'avant, puis le
// Pacte — le PLUS CHER dont un niveau tient dans le budget (le plus proche de la demande). Décidé à l'apparition et FIGÉ
// dans la photo du défi (ClickerScreen : questBaselines[id].objetBascule → stats.objetsDefis → metriqueDuDefi).
export function basculeAchat(q, stats, ctx) {
  try {
    if (!q || q.mode !== 'delta' || q.metriqueParGroupe) return null;
    const m = q.metric || '';
    if (!m.startsWith('auto:') && !m.startsWith('tapUpgrade:')) return null;
    const s = stats || {};
    const c = ctx || {};
    const asc = s.ascension || 0;
    const tau = tempsViseOeuf(c.oeuf || oeufDuDefi(q.id) || 1);
    const poche = Math.max(0, (s.coins || 0) - Math.max(0, c.protegees || 0));
    const budget = poche + productionReference(s, c.creatures) * tau;
    const e = etatDe(s);
    if (coutUnNiveau(m, e, asc) <= budget) return null;
    const objets = (a, famille) => (famille === 'tap'
      ? TAP_UPGRADES.filter((u) => PALIER_TAP_ASCENSION[u.id] === a).map((u) => 'tapUpgrade:' + u.id)
      : AUTOCLICKERS.filter((g) => GENERATEUR_ASCENSION[g.id] === a).map((g) => 'auto:' + g.id));
    const fam = m.startsWith('auto:') ? 'auto' : 'tap';
    const autre = fam === 'auto' ? 'tap' : 'auto';
    const rangs = [objets(asc, fam), objets(asc, autre), objets(asc - 1, fam), objets(asc - 1, autre), ['tapPower']];
    for (const rang of rangs) {
      const ok = rang.filter((x) => x !== m).map((x) => ({ x, c: coutUnNiveau(x, e, asc) }))
        .filter((o) => o.c > 0 && o.c <= budget).sort((u, v) => v.c - u.c);
      if (ok.length) return ok[0].x;
    }
    return null;
  } catch (e) {
    return null;
  }
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
    const m = c.objet || q.metric; // objet de BASCULE (basculeAchat) s'il y en a un
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
      cible = arrondiGain(Math.max(actuel + 1, passifAtteint(etatDe(s), asc, budget)), actuel);
    } else if (m === 'goldenClaimed' && q.mode === 'delta') {
      const a = GOLDEN_MIN_INTERVAL_SEC, b = GOLDEN_MAX_INTERVAL_SEC, moy = (a + b) / 2;
      const premier = ((a * a + a * b + b * b) / 3) / (2 * moy); // attente moyenne de la 1re cible (35 s)
      cible = Math.max(1, 1 + Math.round((tau - premier) / moy));
    } else if (m === 'powerActivated' && q.mode === 'delta') {
      const r = bonusPouvoirs(c.creatures).parSec;
      cible = r > 0 ? Math.max(1, Math.round(tau * r)) : null;
    } else if (m === 'totalTaps' && q.mode === 'absolute') {
      cible = Math.ceil(((s.totalTaps || 0) + rythmeDe(s) * tau) / 100) * 100;
    } else if (m === 'totalCrits' && q.mode === 'delta') {
      const ub = upgradeBonuses(s.upgradeLevels || {});
      const pN = Math.min(1, critChance(s.critLevel || 0) + (ub.critChancePct || 0));
      // 17/10 : un critique LÉGENDAIRE compte aussi (tirage à part : un tap est compté s'il est l'un OU l'autre).
      const pL = chanceLegendaire((s.legendaires || {}).faveurV2);
      const p = pN + pL - pN * pL;
      cible = p > 0 ? Math.max(1, Math.round(rythmeDe(s) * tau * p)) : null;
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

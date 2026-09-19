'use strict';
// ════════════════════════════════════════════════════════════════════
//  TABLEAU DE BORD DE L'ÉQUILIBRAGE
// ════════════════════════════════════════════════════════════════════
//
// Un seul tableau où les trois boutons se voient ENSEMBLE :
//   - le BONUS d'Ascension  -> à quelle vitesse on gagne
//   - le SEUIL d'Ascension  -> combien il faut pour ascensionner
//   - les PRIX de la boutique -> ce qu'on peut acheter
//
// ⚠️ Ces trois-là ne peuvent pas bouger séparément. Monter le bonus sans
// monter le seuil vide le groupe de sa durée ; laisser les prix suivre
// leur propre courbe rend la boutique inatteignable. Ce fichier existe
// pour que l'erreur devienne visible au lieu d'être déduite.
const A = require('/home/claude/paradoxes-app/mobile/tools/audit-quetes.js');
const C = A.C;

const AUTO = C.AUTOCLICKERS;
const TAP = C.TAP_UPGRADES;
const N = 8;              // Ascensions montrées
const TAPS = 4;           // joueur à la main

// ---- Les trois barèmes, en un seul endroit -------------------------
// Bonus : la formule de l'auteur, cumulative. A1 x2, A2 x3, A3 x4...
function bonusPropose(a) { let c = 1; for (let i = 1; i <= a; i++) c *= (i + 1); return c; }
function bonusActuel(a) { return C.ascensionSpeedMultiplier(a); }

// Les 4 articles découverts à chaque Ascension : 2 paliers de tap,
// 2 générateurs. A0 ouvre les deux premiers générateurs.
function articles(a) {
  if (a === 0) return { tap: [], auto: [AUTO[0], AUTO[1]] };
  return {
    tap: [TAP[(a - 1) * 2], TAP[(a - 1) * 2 + 1]].filter(Boolean),
    auto: [AUTO[a * 2], AUTO[a * 2 + 1]].filter(Boolean),
  };
}
const prixArticles = (a) => {
  const { tap, auto } = articles(a);
  return tap.reduce((s, t) => s + C.tapUpgradeCost(t, 0), 0)
    + auto.reduce((s, x) => s + C.autoClickerCost(x, 0), 0);
};

const fr = (x) => {
  if (!isFinite(x)) return '∞';
  if (x >= 1e15) return (x / 1e15).toFixed(1) + ' Qa';
  if (x >= 1e12) return (x / 1e12).toFixed(1) + ' T';
  if (x >= 1e9) return (x / 1e9).toFixed(1) + ' Md';
  if (x >= 1e6) return (x / 1e6).toFixed(1) + ' M';
  if (x >= 1e3) return Math.round(x / 1e3) + ' k';
  return String(Math.round(x));
};
const pct = (x) => (x >= 100 ? Math.round(x) + ' %' : x.toFixed(1) + ' %');

// ---- 1. L'état ACTUEL ----------------------------------------------
console.log('\n' + '═'.repeat(78));
console.log(' 1. AUJOURD\'HUI — ce que donne le jeu tel qu\'il est');
console.log('═'.repeat(78));
console.log(' A    bonus     seuil        4 articles     part du seuil   verdict');
for (let a = 0; a < N; a++) {
  const b = bonusActuel(a);
  const s = C.ascensionThreshold(a);
  const p = prixArticles(a);
  const part = 100 * p / s;
  const ok = part <= 80 ? '✅ achetable' : part <= 200 ? '🟨 très cher' : '🟥 impossible';
  console.log(' ' + String(a).padEnd(4) + ('x' + b.toFixed(1)).padStart(8)
    + fr(s).padStart(11) + fr(p).padStart(15) + pct(part).padStart(15) + '   ' + ok);
}

// ---- 2. Avec la formule de l'auteur, seuils INCHANGÉS ---------------
console.log('\n' + '═'.repeat(78));
console.log(' 2. TA FORMULE (x2, x3, x4...) SANS toucher aux seuils');
console.log('═'.repeat(78));
console.log(' A    ton bonus    seuil       durée du groupe    verdict');
const DUREE_REF = [8.1, 9.1, 11.5, 19.6, 19.6, 19.6, 19.6, 19.6];
for (let a = 0; a < N; a++) {
  const b = bonusPropose(a);
  const duree = DUREE_REF[a] * bonusActuel(a) / b;
  const ok = duree >= 6 ? '✅ tient' : duree >= 2 ? '🟨 court' : '🟥 s\'effondre';
  console.log(' ' + String(a).padEnd(4) + ('x' + fr(b)).padStart(10)
    + fr(C.ascensionThreshold(a)).padStart(12)
    + (duree >= 1 ? duree.toFixed(1) + ' h' : Math.round(duree * 60) + ' min').padStart(16)
    + '     ' + ok);
}

// ---- 3. Ta formule AVEC les seuils remontés en face -----------------
console.log('\n' + '═'.repeat(78));
console.log(' 3. TA FORMULE + seuils remontés pour garder la durée');
console.log('═'.repeat(78));
console.log('    Règle : le seuil monte autant que le bonus, donc la durée');
console.log('    d\'un groupe reste celle d\'aujourd\'hui.\n');
console.log(' A    ton bonus    seuil nécessaire   4 articles      prix à viser');
const seuilsProposes = [];
for (let a = 0; a < N; a++) {
  const s = C.ascensionThreshold(a) * bonusPropose(a) / bonusActuel(a);
  seuilsProposes.push(s);
  console.log(' ' + String(a).padEnd(4) + ('x' + fr(bonusPropose(a))).padStart(10)
    + fr(s).padStart(18) + fr(prixArticles(a)).padStart(15)
    + fr(s * 0.8).padStart(16));
}

// ---- 4. Les prix à écrire ------------------------------------------
console.log('\n' + '═'.repeat(78));
console.log(' 4. LES PRIX À ÉCRIRE — pour que 4 articles = 80 % du seuil');
console.log('═'.repeat(78));
console.log(' A    article                    prix actuel      prix proposé    x');
for (let a = 0; a < N; a++) {
  const { tap, auto } = articles(a);
  const budget = seuilsProposes[a] * 0.8;
  // Réparti : un palier de tap coûte la moitié d'un générateur.
  const parts = tap.length * 1 + auto.length * 2;
  [...tap.map((t) => ['tap', t]), ...auto.map((x) => ['auto', x])].forEach(([type, item]) => {
    const actuel = type === 'tap' ? C.tapUpgradeCost(item, 0) : C.autoClickerCost(item, 0);
    const propose = budget * (type === 'tap' ? 1 : 2) / parts;
    console.log(' ' + String(a).padEnd(4) + item.name.padEnd(26)
      + fr(actuel).padStart(13) + fr(propose).padStart(16)
      + ('x' + (propose / actuel).toFixed(2)).padStart(9));
  });
}
console.log('\n' + '═'.repeat(78));
console.log(' LECTURE : colonne « x » sous 1 = le prix BAISSE, au-dessus = il monte.');
console.log('═'.repeat(78) + '\n');

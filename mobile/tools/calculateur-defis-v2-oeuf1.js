// CALCULATEUR v2 — TEST sur l'œuf 1 (hors du jeu). Rejoue l'économie du joueur défi après défi : pièces/tap (Pacte × critiques),
// 4 taps/s, achats du défi faits dès qu'ils sont payables. Cherche la cible qui donne le temps visé τ par défi.
process.chdir('/home/claude/paradoxes-app/mobile/tools');
const C = require('/home/claude/paradoxes-app/mobile/tools/audit-quetes.js').C;
const TAPS_S = 4, TAU = Number(process.env.TAU || 216); // τ = 29 min par œuf (A0 actuelle) ÷ 8 défis ≈ 3,6 min
const ITEMS = { pacte: { k: 'L', prix: (s) => C.tapPowerCost(s.L) }, faveur: { k: 'F', prix: (s) => C.critUpgradeCost(s.F) }, degats: { k: 'G', prix: (s) => C.critDamageUpgradeCost(s.G) } };
const parTap = (s) => s.L * C.TAP_DAMAGE_PER_LEVEL * (1 + C.critChance(s.F) * (C.critMultiplier(s.G) - 1));
function jouer(s, d, n) { // renvoie [secondes, nouvel état] pour le défi d avec la cible n
  s = { ...s }; let t = 0;
  if (d.type === 'achat') { const it = ITEMS[d.item]; for (let i = 0; i < n;) { const p = it.prix(s); if (s.coins >= p) { s.coins -= p; s[it.k]++; i++; } else { s.coins += parTap(s); t += 1 / TAPS_S; } } }
  else if (d.type === 'gagner') { let g = 0; while (g < n) { const x = parTap(s); g += x; s.coins += x; t += 1 / TAPS_S; } }
  else if (d.type === 'cote') { while (s.coins < n) { s.coins += parTap(s); t += 1 / TAPS_S; } }
  else if (d.type === 'crit') t = n / (TAPS_S * C.critChance(s.F)), s.coins += parTap(s) * TAPS_S * t;
  else if (d.type === 'doree') t = n * (C.GOLDEN_MIN_INTERVAL_SEC + C.GOLDEN_MAX_INTERVAL_SEC) / 2, s.coins += parTap(s) * TAPS_S * t;
  else t = null;
  return [t, s];
}
const DEFIS = [{ n: 1, txt: 'Obtiens 750 pièces', type: 'gagner', c: 750 }, { n: 2, txt: 'Achète 6 niveaux de Pacte', type: 'achat', item: 'pacte', c: 6 },
  { n: 3, txt: 'Reste en Transe x2,5 pendant 30 s', type: 'record', c: 30 }, { n: 4, txt: 'Achète 7 niveaux de Faveur des Esprits', type: 'achat', item: 'faveur', c: 7 },
  { n: 5, txt: 'Touche 2 fois la cible dorée', type: 'doree', c: 2 }, { n: 6, txt: 'Achète 4 niveaux de Dégâts critiques', type: 'achat', item: 'degats', c: 4 },
  { n: 7, txt: 'Obtiens 20 coups critiques', type: 'crit', c: 20 }, { n: 8, txt: 'Mets 12 000 pièces de côté', type: 'cote', c: 12000 }];
const joli = (x) => (x >= 100 ? Number(x.toPrecision(2)) : Math.max(1, Math.round(x)));
let sA = { coins: 0, L: 1, F: 0, G: 0 }, sV = { ...sA }; const lignes = [];
for (const d of DEFIS) {
  const ecoA = { tap: parTap(sA) }; const [tA, nA] = jouer(sA, d, d.c);
  let cible = d.c;
  if (d.type === 'achat') { let best = 1, e = Infinity; for (let k = 1; k <= 30; k++) { const [t] = jouer(sV, d, k); if (Math.abs(t - TAU) < e) { e = Math.abs(t - TAU); best = k; } if (t > 3 * TAU) break; } cible = best; }
  else if (d.type === 'gagner') cible = joli(TAU * TAPS_S * parTap(sV));
  else if (d.type === 'cote') cible = joli(sV.coins + TAU * TAPS_S * parTap(sV));
  else if (d.type === 'crit') cible = joli(TAU * TAPS_S * C.critChance(sV.F));
  else if (d.type === 'doree') cible = Math.max(1, Math.round(TAU / ((C.GOLDEN_MIN_INTERVAL_SEC + C.GOLDEN_MAX_INTERVAL_SEC) / 2)));
  const ecoV = { tap: parTap(sV) }; const [tV, nV] = jouer(sV, d, cible);
  lignes.push({ ...d, tA, cible, tV, tapA: ecoA.tap, tapV: ecoV.tap }); sA = nA; sV = nV;
}
const mn = (t) => (t == null ? '—' : t < 60 ? Math.round(t) + ' s' : (t / 60).toFixed(1).replace('.', ',') + ' min');
for (const l of lignes) console.log(`${l.n} | ${l.txt} | ${mn(l.tA)} | ${l.cible} | ${mn(l.tV)} | ${l.tapA.toFixed(1)}→${l.tapV.toFixed(1)} pièces/tap`);
console.log('total œuf 1 : aujourd’hui', mn(lignes.reduce((t, l) => t + (l.tA || 0), 0)), '· v2', mn(lignes.reduce((t, l) => t + (l.tV || 0), 0)));

// ════════════════════════════════════════════════════════════════════
//  SEUILS D'ASCENSION DÉDUITS DE LA CHAÎNE (17/10) — HORS DU JEU, ne modifie rien
// ════════════════════════════════════════════════════════════════════
// Règle de l'auteur (18/10) : seuil = pièces gagnées en fin de chaîne de défis ÷ 0,9, calé sur un deck
// MALCHANCEUX (10e centile des suites d'œufs). Joueur = celui du calculateur du jeu (calculateur-defis-v23.js
// réaligné). POINT FIXE : le plancher « avant l'heure » (CHANTIER_ECONOMIE 2.2) lit le seuil, qui change les
// achats, donc les pièces gagnées → itérations amorties.
//
// Lancement : NODE_PATH=<babel> node mobile/tools/mesure-seuils.js [--json sortie.json]   (DECKS=20 ITER=4)
'use strict';
const path = require('path');
const fs = require('fs');
const T = require(path.join(__dirname, 'calculateur-defis-v23.js'));
const A = require(path.join(__dirname, 'audit-quetes.js'));
const C = A.C;

const N = Number(process.env.DECKS || 20);
const ITER = Number(process.env.ITER || 4);
const CENTILE = 0.1; // deck malchanceux
// Marge (décision de l'auteur, 17/10 : « + 10 min » au lieu de « ÷ 0,9 ») : le deck malchanceux farme 10 min de sa production
// de fin de chaîne. MESURÉ avec ÷ 0,9 : aux A4-A5 tous les decks se valent (même trio en tête) → TOUT le monde farmait 35 à 59 min.
const MARGE_SEC = Number(process.env.MARGE_MIN || 10) * 60;
// PORTE=1 (avec TAPS=4) : calcule la PORTE de l'Ascension du joueur LENT (clickerLogic.PORTE_ASCENSION_PART) SANS toucher
// l'échelle des prix (ascensionThreshold) : une seule passe, prix de référence. Afficher : part = porte ÷ ascensionThreshold.
const PORTE = process.env.PORTE === '1';
const suites = Array.from({ length: N }, (_, k) => T.suiteCreatures(20261018 + 7919 * k));
const poserDeck = (k) => { T.IDS.splice(0, T.IDS.length, ...suites[k]); };
const centile = (xs, p) => { const s = xs.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mediane = (xs) => centile(xs, 0.5);

function mesurer() {
  const origine = C.ASCENSION_THRESHOLDS.slice();
  const lignes = [];
  try {
    let vies = suites.map(() => T.etatVieInitial());
    for (let a = 0; a < 6; a++) {
      const aj = C.ajustementAscension(a);
      const actuel = C.ascensionThreshold(a);
      let seuil = actuel;
      const suivi = [];
      for (let it = 0; it < (PORTE ? 1 : ITER); it++) {
        if (!PORTE) C.ASCENSION_THRESHOLDS[a] = seuil / aj;
        const gagnes = vies.map((v, k) => { poserDeck(k); const J = T.jouer(a, v, null, {}).J; return J.gagneChaine + MARGE_SEC * J.prodFin; });
        const cible = centile(gagnes, CENTILE);
        suivi.push(cible);
        seuil = PORTE || it === ITER - 1 ? cible : Math.sqrt(seuil * cible); // amorti : sinon le point fixe oscille
      }
      if (!PORTE) C.ASCENSION_THRESHOLDS[a] = seuil / aj;
      const runs = vies.map((v, k) => { poserDeck(k); return T.jouer(a, v, null, {}); });
      vies = runs.map((r) => r.V);
      const actifs = runs.map((r) => r.J.resultats.reduce((t, x) => t + x.actif, 0) / 3600);
      const fermes = runs.map((r) => { const x = r.J.resultats.find((y) => y.m === 'ascension'); return x ? x.actif / 60 : 0; });
      const enAvance = {};
      runs.forEach((r) => {
        const s = r.sim.etat;
        C.TAP_UPGRADES.forEach((u) => { if (((s.tapUpgrades || {})[u.id] || 0) > 0 && C.PALIER_TAP_ASCENSION[u.id] > a) enAvance[u.name] = (enAvance[u.name] || 0) + 1; });
        C.AUTOCLICKERS.forEach((g) => { if (((s.autoClickers || {})[g.id] || 0) > 0 && C.GENERATEUR_ASCENSION[g.id] > a) enAvance[g.name] = (enAvance[g.name] || 0) + 1; });
      });
      const farm = {};
      [0.5, 0.75, 1].forEach((f) => {
        const mins = runs.map((r) => {
          const fin = r.J.resultats.reduce((t, x) => t + x.actif, 0); const j = r.sim.jalons.filter((x) => x.t <= f * fin).pop();
          return j && j.production > 0 ? seuil / j.production / 60 : Infinity;
        });
        farm[f] = mediane(mins); // minutes de production pour 100 % du seuil (× la part voulue)
      });
      lignes.push({ a, actuel, seuil, farm, rapport: seuil / actuel, suivi, actifMedianH: mediane(actifs),
        fermeMaxMin: Math.max(...fermes), fermeMedianMin: mediane(fermes), enAvance, decks: N });
    }
  } finally {
    origine.forEach((x, k) => { C.ASCENSION_THRESHOLDS[k] = x; });
  }
  return lignes;
}

module.exports = { mesurer };

if (require.main === module) {
  const t0 = Date.now();
  const L = mesurer();
  const i = process.argv.indexOf('--json');
  if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(L));
  const f = (x) => (x >= 1e12 ? (x / 1e12).toFixed(1) + ' T' : x >= 1e9 ? (x / 1e9).toFixed(1) + ' Md' : (x / 1e6).toFixed(1) + ' M');
  L.forEach((l) => {
    const av = Object.entries(l.enAvance).map(([n, c]) => `${n} (${c}/${l.decks})`).join(', ') || 'rien';
    console.log(`A${l.a} · seuil ${f(l.actuel)} → ${f(l.seuil)} (×${l.rapport.toFixed(1)}) · itérations ${l.suivi.map(f).join(' → ')}`);
    console.log(`   1 % du seuil = ${(l.farm[0.5] / 100).toFixed(1)} min de production à mi-chaîne, ${(l.farm[0.75] / 100).toFixed(1)} min aux 3/4, ${(l.farm[1] / 100).toFixed(1)} min en fin`);
    console.log(`   actif médian ${l.actifMedianH.toFixed(2)} h · attente du seuil : médiane ${l.fermeMedianMin.toFixed(1)} min, pire ${l.fermeMaxMin.toFixed(1)} min · avant l'heure : ${av}`);
  });
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// ════════════════════════════════════════════════════════════════════
//  MESURE DE L'ÉCONOMIE PAR ASCENSION (17/10) — HORS DU JEU, ne modifie rien
// ════════════════════════════════════════════════════════════════════
// Chantier `mobile/CHANTIER_ECONOMIE.md`, étape 1 : « mesurer au simulateur (outil v2.3 réaligné sur
// calculDefis) ce que le joueur achète à chaque Ascension, la durée des groupes, la taille des cibles ».
// Joueur = celui du calculateur du jeu (7 taps/s, Transe 2,47, critiques, pouvoirs des 3 meilleures
// créatures), qui fait les défis dans l'ordre ; chaque cible passe par calculDefis.cibleCalculee.
//
// Lancement : NODE_PATH=<babel> node mobile/tools/mesure-economie.js [--json sortie.json]
//   GRAINE_DECK=<n> : autre suite d'œufs (créatures du joueur).
'use strict';
const path = require('path');
const fs = require('fs');
const T = require(path.join(__dirname, 'calculateur-defis-v23.js'));
const A = require(path.join(__dirname, 'audit-quetes.js'));
const C = A.C;
const CD = A.load('calculDefis');

const ACHAT = (m) => m === 'tapPower' || m === 'critLevel' || m === 'critDamageLevel'
  || m.startsWith('auto:') || m.startsWith('tapUpgrade:');

function mesurer() {
  let vie = T.etatVieInitial();
  const groupes = [];
  for (let a = 0; a < 6; a++) {
    const r = T.jouer(a, vie, null, {});
    vie = r.V;
    const L = r.J.resultats;
    const s = r.sim.etat;
    const seuil = C.ascensionThreshold(a);
    const actif = L.reduce((t, x) => t + x.actif, 0);
    const attente = L.reduce((t, x) => t + x.attente, 0);
    const asc = L.find((x) => x.m === 'ascension');
    // Défis calculés : temps réel (sans les 8 s de lecture) contre le temps visé.
    const calc = L.filter((x) => CD.estCalcule({ metric: x.m, mode: x.mode })).map((x) => {
      const tau = CD.tempsViseOeuf(x.oeuf);
      return { id: x.id, label: x.label, oeuf: x.oeuf, tau, reel: Math.max(0, x.actif - T.HYP.secParDefi) };
    });
    const horsCadre = calc.filter((x) => x.reel < 0.8 * x.tau || x.reel > 1.2 * x.tau);
    // Objets possédés à la fin, et ceux d'une Ascension FUTURE (« avant l'heure »).
    const paliers = C.TAP_UPGRADES.map((u) => ({ id: u.id, nom: u.name, n: (s.tapUpgrades || {})[u.id] || 0,
      asc: C.PALIER_TAP_ASCENSION[u.id] })).filter((x) => x.n > 0);
    const gens = C.AUTOCLICKERS.map((g) => ({ id: g.id, nom: g.name, n: (s.autoClickers || {})[g.id] || 0,
      asc: C.GENERATEUR_ASCENSION[g.id] })).filter((x) => x.n > 0);
    const enAvance = [...paliers, ...gens].filter((x) => x.asc !== undefined && x.asc > a);
    // Taille des défis : achats (coût total) et pièces, en part du seuil.
    const tailles = L.filter((x) => ACHAT(x.m) || x.m === 'totalEarned' || x.m === 'coins').map((x) => ({
      label: x.label, oeuf: x.oeuf, part: (ACHAT(x.m) ? x.cout : x.cible) / seuil,
    }));
    groupes.push({
      a, seuil, actifH: actif / 3600, attenteH: attente / 3600, tAscMin: asc ? asc.actif / 60 : null,
      gagneFin: s.totalEarned, ratioFin: s.totalEarned / seuil, pacte: s.tapPower,
      paliers, gens, enAvance, horsCadre, nCalc: calc.length, tailles, bloque: r.J.bloqueA,
    });
  }
  return { ids: T.IDS.slice(0, 40), groupes };
}

module.exports = { mesurer };

if (require.main === module) {
  const t0 = Date.now();
  const R = mesurer();
  const i = process.argv.indexOf('--json');
  if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(R));
  const f = (x) => (x >= 1e9 ? (x / 1e9).toFixed(1) + ' Md' : x >= 1e6 ? (x / 1e6).toFixed(1) + ' M' : Math.round(x / 1e3) + ' k');
  const p = (x) => (100 * x).toFixed(x < 0.1 ? 1 : 0) + ' %';
  R.groupes.forEach((g) => {
    console.log(`A${g.a} · seuil ${f(g.seuil)} · actif ${g.actifH.toFixed(2)} h + énergie ${g.attenteH.toFixed(1)} h · défi d'Ascension ${g.tAscMin === null ? '?' : g.tAscMin.toFixed(1) + ' min'} · gagné en fin de chaîne ${p(g.ratioFin)} du seuil${g.bloque ? ' · BLOQUÉ au défi ' + g.bloque.i : ''}`);
    console.log(`   Pacte ${g.pacte} · paliers ${g.paliers.map((x) => x.nom.split(' ')[0] + ' ' + x.n + '(A' + x.asc + ')').join(', ')}`);
    console.log(`   générateurs ${g.gens.map((x) => x.nom.split(' ')[0] + ' ' + x.n + '(A' + x.asc + ')').join(', ')}`);
    console.log(`   avant l'heure : ${g.enAvance.length ? g.enAvance.map((x) => x.nom + ' ' + x.n).join(', ') : 'rien'}`);
    console.log(`   défis calculés hors ±20 % du temps visé : ${g.horsCadre.length} / ${g.nCalc}${g.horsCadre.length ? ' — ' + g.horsCadre.slice(0, 4).map((x) => `œuf ${x.oeuf} « ${x.label} » ${(x.reel / 60).toFixed(1)}/${(x.tau / 60).toFixed(1)} min`).join(' ; ') : ''}`);
    if (g.a === 1 || g.a === 2) {
      const t = g.tailles.slice().sort((x, y) => y.part - x.part);
      console.log(`   plus gros défis (part du seuil) : ${t.slice(0, 5).map((x) => `« ${x.label} » ${p(x.part)}`).join(' ; ')}`);
    }
  });
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

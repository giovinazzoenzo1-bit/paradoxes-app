'use strict';
// ════════════════════════════════════════════════════════════════════
//  CALIBRER L'AVENTURE SUR LE PARCOURS DU JOUEUR GRATUIT (26/09)
// ════════════════════════════════════════════════════════════════════
//
//   NODE_PATH=<dossier avec @babel/core> node mobile/tools/calibrer-parcours.js [joueurs] [essais]
//
// Décision de l'auteur : le joueur gratuit gagne 6 combats sur 10. MESURÉ
// avant : l'ancienne table (calée sur « 2 rares + 1 épique ») BLOQUAIT les
// joueurs gratuits simulés au niveau 2 (22 sur 30) et au niveau 7 (7 sur
// 30), même avec le filet à −40 %.
//
// Méthode : une POPULATION de joueurs gratuits (le même joueur pas à pas que
// le simulateur : vrais œufs, naissance au niveau 1, Griffes réglage A, runes,
// énergie) avance niveau par niveau. À chaque niveau : chacun se prépare,
// puis on cherche (dichotomie, côté FACILE) le multiplicateur des ennemis où
// la population gagne 6 fois sur 10 ; on note la puissance MÉDIANE de leurs
// decks (la future « puissance conseillée ») ; puis chacun joue vraiment le
// niveau (énergie, filet). La table couvre les 140 niveaux du parcours.
const P = require('./simulateur-parcours.js');
const A = require('./audit-quetes.js');
const K = A.load('combatLogic');
const L = A.load('clickerLogic');
// Décision de l'auteur (26/09, après son test réel) : option A — on vise les
// 10 % les PLUS malchanceux (6 victoires sur 10), et non plus le 30e rang.
// Test : Caraploof (commune, tank) perdait dès le début ; le simulateur joue
// aussi mieux qu'un humain (sorts au bon moment).
const CENTILE = 0.10;

// ---- CHAPITRE 1 = APPRENTISSAGE (26/09, décision de l'auteur) ----
// Test réel : Caraploof niveau 1 perdait le niveau 1 ; niveau 14, elle
// perdait encore le niveau 3 (4 fois sur 5). Pour les niveaux 1 à 10, le
// multiplicateur ne dépasse JAMAIS celui où CHAQUE 1re créature possible
// (raretés du 1er œuf, LUES dans le jeu) gagne, au niveau qu'un débutant
// atteint avec ses seules Griffes de 1res victoires (ni packs, ni quêtes, ni
// calendrier) : 9 fois sur 10 au niveau 1 (créature niveau 1 : il ne sait
// pas encore l'améliorer), 8 fois sur 10 ensuite.
const APPRENTISSAGE = { niveaux: 10, cibleNiveau1: 0.9, cible: 0.8, combats: 60 };
function premieresCreatures() {
  const max = L.ORDRE_RARETES.indexOf(L.rareteMaxPourOeuf(0));
  return A.C.CREATURES.filter((c) => { const r = L.ORDRE_RARETES.indexOf(c.rarity); return r >= 0 && r <= max; });
}
function niveauDebutant(l, creature) {
  let griffes = 0;
  for (let i = 1; i < l; i++) griffes += K.griffesReward(i);
  let niv = 1;
  while (niv < 200 && L.levelUpCost(creature, niv) <= griffes) { griffes -= L.levelUpCost(creature, niv); niv++; }
  return niv;
}
// Le PIRE taux de victoire parmi les 1res créatures possibles (hasard fixé :
// deux appels identiques donnent le même résultat).
function tauxDebutant(l, k, combats = APPRENTISSAGE.combats) {
  let pire = 1, qui = null;
  premieresCreatures().forEach((c, ci) => {
    let s = (l * 7919 + ci * 104729) >>> 0;
    const alea = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
    const adv = K.opponentTeamForLevel(l).map((o) => ({ creature: o, stats: K.statsForOpponentCreatureTyped(o, l, k) }));
    const moi = [{ creature: c, stats: K.combatStatsForCreatureTyped(c, niveauDebutant(l, c), 0, []) }];
    let g = 0;
    for (let e = 0; e < combats; e++) if (K.simulerCombat(moi, adv, { alea, politique: K.choixJoueur }).gagne) g++;
    if (g / combats < pire) { pire = g / combats; qui = c.id; }
  });
  return { pire, qui };
}
function plafondsApprentissage() {
  const plafonds = [];
  for (let l = 1; l <= APPRENTISSAGE.niveaux; l++) {
    const cible = l === 1 ? APPRENTISSAGE.cibleNiveau1 : APPRENTISSAGE.cible;
    let lo = Math.log(0.01), hi = Math.log(80);
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (tauxDebutant(l, Math.exp(mid)).pire >= cible) lo = mid; else hi = mid; }
    plafonds.push(Math.floor(Math.exp(lo) * 100) / 100);
  }
  return plafonds;
}

function calibrer(nJoueurs = 40, essais = 8, cible = 0.6, R = P.REGLAGES, centile = CENTILE) {
  const joueurs = Array.from({ length: nJoueurs }, (_, i) => P.nouveauJoueur(5000 + i * 104729, R));
  const table = [], puissances = [], bloques = [];
  const plafonds = plafondsApprentissage();
  for (let a = 0; a < 6; a++) {
    const stats = joueurs.map((j) => j.nouvelleAsc(a));
    for (let l = (a ? R.finsAventure[a - 1] : 0) + 1; l <= R.finsAventure[a]; l++) {
      const actifs = joueurs.filter((j) => !j.bloque);
      actifs.forEach((j) => j.preparer(l, a));
      const decks = actifs.map((j) => j.joueurs());
      // Décision de l'auteur (26/09, option 2) : on vise le joueur UN PEU
      // MALCHANCEUX — le 30e centile gagne 6 fois sur 10. La moyenne
      // cachait des murs : combats presque sans hasard, chance aux œufs.
      const taux = (k) => {
        const parJoueur = actifs.map((j, i) => { const adv = j.adversaires(l, k); let g = 0;
          for (let e = 0; e < essais; e++) if (K.simulerCombat(decks[i], adv, { alea: j.alea, politique: K.choixJoueur }).gagne) g++; return g / essais; }).sort((x, y) => x - y);
        return parJoueur[Math.floor(parJoueur.length * centile)];
      };
      // Chapitre 1 : jamais plus dur que l'apprentissage (plafond).
      let hi = l <= plafonds.length ? Math.log(plafonds[l - 1]) : Math.log(80);
      let lo = Math.min(Math.log(0.05), hi - 1);
      for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (taux(Math.exp(mid)) > cible) lo = mid; else hi = mid; }
      const k = Math.round(Math.exp(lo) * 100) / 100;
      table.push(k);
      const pw = actifs.map((j) => K.puissanceDeck(j.trio().map((p) => ({ creature: p.c, ownedLevel: p.niv, evolutionTier: p.evo, equippedRunes: [] })))).sort((x, y) => x - y);
      puissances.push(pw[Math.floor(pw.length * centile)]); // la puissance du joueur visé = la « puissance conseillée »
      actifs.forEach((j) => { j.jouer(l, k, stats[joueurs.indexOf(j)]); if (j.bloque) bloques.push(l); });
    }
    joueurs.forEach((j, i) => { if (!j.parAsc[a]) j.finAscension(a, stats[i]); });
  }
  return { table, puissances, bloques, plafonds };
}
module.exports = { calibrer, plafondsApprentissage, tauxDebutant, niveauDebutant, premieresCreatures, APPRENTISSAGE };

if (require.main === module) {
  const n = Number(process.argv[2]) || 40, e = Number(process.argv[3]) || 8;
  const t0 = Date.now();
  const r = calibrer(n, e);
  console.log('table (niveaux 1 à ' + r.table.length + ') : ' + r.table.join(', '));
  console.log('puissance médiane des joueurs gratuits : ' + r.puissances.filter((_, i) => i % 5 === 0 || i < 3).join(', '));
  console.log('bloqués pendant le calibrage : ' + (r.bloques.length ? r.bloques.join(', ') : 'aucun'));
  console.log('(' + n + ' joueurs × ' + e + ' essais, ' + Math.round((Date.now() - t0) / 1000) + ' s)');
}

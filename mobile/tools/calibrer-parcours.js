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
// le simulateur : vrais œufs, naissance à 80 %, Griffes réglage A, runes,
// énergie) avance niveau par niveau. À chaque niveau : chacun se prépare,
// puis on cherche (dichotomie, côté FACILE) le multiplicateur des ennemis où
// la population gagne 6 fois sur 10 ; on note la puissance MÉDIANE de leurs
// decks (la future « puissance conseillée ») ; puis chacun joue vraiment le
// niveau (énergie, filet). La table couvre les 140 niveaux du parcours.
const P = require('./simulateur-parcours.js');
const A = require('./audit-quetes.js');
const K = A.load('combatLogic');
const CENTILE = 0.30;

function calibrer(nJoueurs = 40, essais = 8, cible = 0.6, R = P.REGLAGES) {
  const joueurs = Array.from({ length: nJoueurs }, (_, i) => P.nouveauJoueur(5000 + i * 104729, R));
  const table = [], puissances = [], bloques = [];
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
        return parJoueur[Math.floor(parJoueur.length * CENTILE)];
      };
      let lo = Math.log(0.05), hi = Math.log(80);
      for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (taux(Math.exp(mid)) > cible) lo = mid; else hi = mid; }
      const k = Math.round(Math.exp(lo) * 100) / 100;
      table.push(k);
      const pw = actifs.map((j) => K.puissanceDeck(j.trio().map((p) => ({ creature: p.c, ownedLevel: p.niv, evolutionTier: p.evo, equippedRunes: [] })))).sort((x, y) => x - y);
      puissances.push(pw[Math.floor(pw.length * CENTILE)]); // la puissance du joueur visé = la « puissance conseillée »
      actifs.forEach((j) => { j.jouer(l, k, stats[joueurs.indexOf(j)]); if (j.bloque) bloques.push(l); });
    }
    joueurs.forEach((j, i) => { if (!j.parAsc[a]) j.finAscension(a, stats[i]); });
  }
  return { table, puissances, bloques };
}
module.exports = { calibrer };

if (require.main === module) {
  const n = Number(process.argv[2]) || 40, e = Number(process.argv[3]) || 8;
  const t0 = Date.now();
  const r = calibrer(n, e);
  console.log('table (niveaux 1 à ' + r.table.length + ') : ' + r.table.join(', '));
  console.log('puissance médiane des joueurs gratuits : ' + r.puissances.filter((_, i) => i % 5 === 0 || i < 3).join(', '));
  console.log('bloqués pendant le calibrage : ' + (r.bloques.length ? r.bloques.join(', ') : 'aucun'));
  console.log('(' + n + ' joueurs × ' + e + ' essais, ' + Math.round((Date.now() - t0) / 1000) + ' s)');
}

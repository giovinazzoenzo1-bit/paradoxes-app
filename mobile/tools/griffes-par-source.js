'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  GRIFFES DU COMBAT, PAR SOURCE ET PAR CHAPITRE (10/10, demande de l'auteur)
// ═══════════════════════════════════════════════════════════════════════════
//   NODE_PATH=<babel> node mobile/tools/griffes-par-source.js
// « Calcule à part le cumul des succès et défis en rapport avec le combat, comme ça on pourra ajuster au fur et à
// mesure. » Tout vient des fonctions DU JEU (primes, défis, succès, coût d'un niveau). Seules les 3 hypothèses
// ci-dessous sont supposées : les changer, relancer.
const HYPOTHESES = {
  etapesParJour: 5,      // étapes gagnées par jour de jeu
  etoilesParEtape: 2.5,  // étoiles gagnées par étape (données de l'auteur : 2,7 au chapitre 1)
  partTroisEtoiles: 0.6, // part des étapes terminées à 3 étoiles (données de l'auteur : 70 % au chapitre 1)
};
const A = require('./audit-quetes.js');
const K = A.load('combatLogic'); const L = A.load('clickerLogic'); const D = A.load('dailyLogic');

// Défis et succès LIÉS AU COMBAT (lus dans le jeu).
const COMBAT = new Set(['battleWon', 'starsEarned', 'threeStarLevel']);
const jour = D.DAILY_QUEST_POOL.filter((q) => COMBAT.has(q.event));
const semaine = D.WEEKLY_QUEST_POOL.filter((q) => COMBAT.has(q.event));
const pJour = 3 / D.DAILY_QUEST_POOL.length, pSemaine = 6 / D.WEEKLY_QUEST_POOL.length; // chances d'être tiré
const succes = D.ACHIEVEMENTS.filter((a) => ['advLevelReached', 'starsEarned', 'threeStarLevel'].includes(a.stat));
const valeurStat = (stat, etape) => (stat === 'advLevelReached' ? etape : stat === 'starsEarned' ? etape * HYPOTHESES.etoilesParEtape : etape * HYPOTHESES.partTroisEtoiles);

let decksModele = null; // 16/10 : chargé au 1er besoin (le modèle d'économie charge lui-même beaucoup de choses)
function DECKS_MODELE() { if (!decksModele) decksModele = require('./calculateur-griffes.js').calculer(200, 'actif'); return decksModele; }
function bloc(de, a) {
  const r = { primes: 0, succes: 0, defisJour: 0, defisSemaine: 0 };
  for (let l = de; l <= a; l++) {
    // 16/10 (règle de l'auteur) : la prime suit la meilleure créature — deck du modèle d'économie à cette étape.
    r.primes += K.primeVictoire(l, (DECKS_MODELE()[l - 1] || {}).deck || []);
    // Succès : chaque palier franchi pendant cette étape rapporte sa récompense (fixe).
    for (const s of succes) s.tiers.forEach((t, i) => { if (valeurStat(s.stat, l - 1) < t && valeurStat(s.stat, l) >= t) r.succes += D.ACHIEVEMENT_TIER_REWARDS[i]; });
    // Défis (récompense × facteur de l'étape) : par étape = 1 / étapes par jour d'un jour de défis.
    const parJour = 1 / HYPOTHESES.etapesParJour;
    jour.forEach((q) => { const faisable = q.event === 'battleWon' ? HYPOTHESES.etapesParJour >= q.target : true; if (faisable) r.defisJour += parJour * pJour * K.recompenseQuete(q.reward, l); });
    semaine.forEach((q) => { const parSemaine = HYPOTHESES.etapesParJour * 7;
      const faisable = q.event === 'battleWon' ? parSemaine >= q.target : q.event === 'starsEarned' ? parSemaine * HYPOTHESES.etoilesParEtape >= q.target : parSemaine * HYPOTHESES.partTroisEtoiles >= q.target;
      if (faisable) r.defisSemaine += (parJour / 7) * pSemaine * K.recompenseQuete(q.reward, l); });
  }
  const milieu = Math.round((de + a) / 2), taille = K.opponentTeamSize(milieu);
  const coutEquipe = taille * L.levelUpCost(A.C.CREATURES[0], milieu); // 1 niveau pour CHAQUE créature de l'équipe
  const total = r.primes + r.succes + r.defisJour + r.defisSemaine;
  return { de, a, ...r, total, niveaux: total / coutEquipe, niveauxPrimes: r.primes / coutEquipe, etapes: a - de + 1 };
}
const blocs = [[1, 10], [11, 20], [21, 25], [26, 60], [61, 101], [102, 144], [145, 185], [186, 227]].map(([de, a]) => bloc(de, a));
module.exports = { HYPOTHESES, bloc, blocs };
if (require.main === module) {
  const f = (x) => Math.round(x).toLocaleString('fr-FR');
  console.log('Hypothèses : ' + HYPOTHESES.etapesParJour + ' étapes par jour · ' + HYPOTHESES.etoilesParEtape + ' étoiles par étape · ' + Math.round(100 * HYPOTHESES.partTroisEtoiles) + ' % à 3 étoiles');
  blocs.forEach((b) => console.log('Étapes ' + b.de + '-' + b.a + ' : primes ' + f(b.primes) + ' · succès ' + f(b.succes) + ' · défis du jour ' + f(b.defisJour) + ' · défis de la semaine ' + f(b.defisSemaine)
    + ' → total ' + f(b.total) + ' · paie ' + (b.niveaux / b.etapes).toFixed(2) + ' niveau par créature et par étape (primes seules : ' + (b.niveauxPrimes / b.etapes).toFixed(2) + ')'));
}

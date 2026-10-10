'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  QUAND UN JOUEUR SE RETROUVE-T-IL BLOQUÉ ? (10/10, demande de l'auteur)
// ═══════════════════════════════════════════════════════════════════════════
//   NODE_PATH=<babel> node mobile/tools/blocage-griffes.js [aventure|tout] [joueurs]
// « aventure » : SEULEMENT les primes de victoire de l'Aventure (rien d'autre, pas de runes).
// « tout »     : + défis (quêtes du jour / semaine, modèle du simulateur), succès, calendrier (270 par semaine, dont
//                les 40 du jour 1), 4 packs de Griffes par Ascension (boutique), récompenses d'Ascension, 3 runes.
// « Bloqué » = le joueur MÉDIAN a besoin du coup de pouce du jeu (3 défaites de suite ou plus) pour passer l'étape.
// Le joueur simulé est celui du calibrage (simulateur-parcours) : il dépense ses Griffes à chaque victoire.
const P = require('./simulateur-parcours.js');
const A = require('./audit-quetes.js');
const L = A.load('clickerLogic'); const D = A.load('dailyLogic');
const scenario = process.argv[2] || 'aventure', N = Number(process.argv[3]) || 40;
const calendrierParSemaine = [1, 2, 3, 4, 5, 6, 7].reduce((t, j) => { const r = D.calendarRewardForStreak(j); return t + (r && r.type === 'griffes' ? r.amount : 0); }, 0);
const R = scenario === 'aventure'
  ? { ...P.REGLAGES, quetesDuJour: () => 0, succesParAsc: [0, 0, 0, 0, 0, 0], packsParAsc: 0, runesParAsc: 0 }
  : { ...P.REGLAGES, quetesDuJour: (niv) => P.REGLAGES.quetesDuJour(niv) + calendrierParSemaine / 7, packsParAsc: L.GRIFFES_PIECES_MAX_PAR_ASCENSION, taillePack: (a) => L.taillePackGriffes(a) };
const parEtape = {}; const parAsc = [0, 1, 2, 3, 4, 5].map(() => []);
for (let i = 0; i < N; i++) {
  const j = P.nouveauJoueur(1000 + i * 7919, R);
  if (scenario === 'tout') j.griffes += 40; // calendrier, jour 1 (avant le 1er combat)
  for (let a = 0; a < 6 && !j.bloque; a++) {
    const s = j.nouvelleAsc(a);
    for (let l = (a ? R.finsAventure[a - 1] : 0) + 1; l <= R.finsAventure[a] && !j.bloque; l++) {
      j.preparer(l, a); const c0 = s.combats; j.jouer(l, 1, s);
      (parEtape[l] = parEtape[l] || []).push(s.combats - c0);
    }
    const g = j.griffes; j.finAscension(a, s); if (scenario === 'aventure') j.griffes = g; // pas de récompense d'Ascension
    parAsc[a].push(s);
  }
}
const med = (v) => v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)];
const etapes = Object.keys(parEtape).map(Number).sort((x, y) => x - y);
const premier = etapes.find((l) => med(parEtape[l]) >= 4);
const lignes = [0, 1, 2, 3, 4, 5].map((a) => {
  const v = parAsc[a].filter(Boolean); if (!v.length) return null;
  const debut = a ? R.finsAventure[a - 1] + 1 : 1, fin = R.finsAventure[a];
  const et = etapes.filter((l) => l >= debut && l <= fin);
  return { a, debut, fin, victoires: med(v.map((s) => 10 * s.victoires / Math.max(1, s.combats))), aide: et.filter((l) => med(parEtape[l]) >= 4).length / Math.max(1, et.length),
    ecart: -med(v.map((s) => s.retard)), bloques: v.filter((s) => s.bloque).length };
}).filter(Boolean);
module.exports = { scenario, premier, lignes };
if (require.main === module) {
  console.log('Scénario « ' + scenario + ' » (' + N + ' joueurs) — 1re étape où le joueur médian est bloqué sans aide : ' + (premier || 'jamais'));
  lignes.forEach((x) => console.log('A' + x.a + ' (étapes ' + x.debut + '-' + x.fin + ') : ' + x.victoires.toFixed(1) + ' victoires sur 10 · bloqué sans aide sur ' + Math.round(100 * x.aide) + ' % des étapes · équipe ' + (x.ecart >= 0 ? '+' : '') + Math.round(x.ecart) + ' niv. par rapport à l\'étape · vraiment bloqués : ' + x.bloques));
}

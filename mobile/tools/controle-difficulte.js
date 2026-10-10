// Contrôle de la difficulté de l'Exploration (10/10) : victoires sur 10 du joueur MÉDIAN et du 10e rang,
// jours et bloqués par Ascension, sur 40 parties complètes. Usage : node controle-difficulte.js <racine du dépôt> [graine]
// Victoires sur 10 du joueur MÉDIAN (et 10e rang), par Ascension, sur 40 parties complètes.
const P = require(process.argv[2] + '/mobile/tools/simulateur-parcours.js');
const tous = []; const base = Number(process.argv[3]) || 1000; for (let j = 0; j < 40; j++) tous.push(P.parcoursJoueur(base + j * 7919));
const q = (v, x) => v.slice().sort((a, b) => a - b)[Math.floor(v.length * x)];
const lignes = [];
for (let a = 0; a < 6; a++) {
  const v = tous.map((p) => p[a]).filter(Boolean);
  const r = v.map((s) => 10 * s.victoires / Math.max(1, s.combats));
  lignes.push('A' + a + ' : médian ' + q(r, 0.5).toFixed(1) + ' · 10e rang ' + q(r, 0.1).toFixed(1) + ' · jours ' + q(v.map((s) => s.jours), 0.5).toFixed(1) + ' · bloqués ' + v.filter((s) => s.bloque).length);
}
console.log(lignes.join('\n'));

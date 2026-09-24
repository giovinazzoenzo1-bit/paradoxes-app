// ⚠️ CET OUTIL N'A PLUS DE LOGIQUE PROPRE. Il appelle `simulerGroupe`
// de `audit-quetes.js`, exactement comme les contrôles.
//
// POURQUOI. Il avait sa propre simulation et donnait 2,9 h là où le
// contrôle disait 9,4 h pour le même groupe. J'ai cherché le défaut dans
// l'équilibrage du jeu pendant plusieurs passes alors qu'il était dans
// mes instruments : l'un ignorait les paliers de tap, l'autre les
// achetait sans vérifier qu'ils sont VERROUILLÉS tant que le Pacte n'est
// pas au niveau 10.
//
// Deux instruments qui ne partagent pas leur état ne peuvent pas être
// comparés. Il n'y en a donc plus qu'un.
const A = require(require('path').join(__dirname, 'audit-quetes.js'));
const TAPS = Number(process.env.TAPS || 4);
let cumul = 0;
for (let a = 0; a < 10; a++) {
  const r = A.simulerGroupe(a, TAPS);
  cumul += r.heures;
  console.log('  A' + a + '  ' + r.heures.toFixed(1).padStart(6) + ' h   cumul '
    + cumul.toFixed(1).padStart(7) + ' h  (' + (cumul / 24).toFixed(1) + ' jours a 24h/24)');
}

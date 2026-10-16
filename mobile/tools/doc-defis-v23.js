// Génère le document « Défis des œufs : temps réels et cibles v2.3 » (HTML → Google Doc) depuis
// calculateur-defis-v23.json. Lancement : NODE_PATH=<babel> node mobile/tools/doc-defis-v23.js > doc.html
'use strict';
const path = require('path');
const A = require(path.join(__dirname, 'audit-quetes.js'));
const D = A.load('defisEcrits');
const R = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'calculateur-defis-v23.json'), 'utf8'));
const tous = D.DEFIS_ECRITS.flat();
const nb = (x) => Number(x).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
const duree = (x) => (!isFinite(x) ? 'bloqué' : x < 60 ? Math.round(x) + ' s' : x < 3600 ? (x / 60).toFixed(1).replace('.', ',') + ' min' : (x / 3600).toFixed(1).replace('.', ',') + ' h');
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Légende du document « Défis Paradox — œuf par œuf » de l'auteur : 🔴 achat · 🟢 Aventure / créatures · ⚪ Clicker.
const VERT = ['advLevelReached', 'battleWon', 'threeStarLevel', 'maxCreatureLevel', 'runeBought', 'powerActivated'];
const typeDe = (m) => (VERT.includes(m) ? '🟢' : (m === 'tapPower' || m === 'critLevel' || m === 'critDamageLevel'
  || m === 'sanctuaryLevel' || m === 'veilleurLevel' || m.startsWith('auto:') || m.startsWith('tapUpgrade:')) ? '🔴' : '⚪');
// Créature de chaque œuf : lue dans DEFIS_PARADOX.md (« ### ŒUF 1  →  Pyrosile »), généré par generer-doc.py.
const CREATURE = {};
require('fs').readFileSync(path.join(__dirname, '../DEFIS_PARADOX.md'), 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^### ŒUF (\d+)\s+→\s+(.+)$/); if (m) CREATURE[Number(m[1])] = m[2].trim();
});
const td = (t, gras) => `<td>${gras ? '<b>' + esc(t) + '</b>' : esc(t)}</td>`;
let h = '<html><head><meta charset="utf-8"></head><body>';
h += '<h1>Défis des œufs : temps réels et cibles v2.3</h1>';
{
  const auj = R.aujourdhui.flat(), tous23 = R.v23.map((v) => v.lignes).flat();
  const inst = auj.filter((x) => x.actif <= 15).length;
  const abus = R.aujourdhui.reduce((t, L, a) => t + L.filter((x) => x.actif > 3 * R.v23[a].tau).length, 0);
  const rap = []; for (let a = 2; a < 6; a++) R.v23[a].lignes.forEach((x, i) => { const y = R.aujourdhui[a][i]; if (['coins', 'totalEarned'].includes(x.m) && !x.note) rap.push(x.ecriteV23 / y.ecrite); });
  rap.sort((u, w) => u - w);
  const R2 = { min: '×' + nb(Math.round(rap[0])), max: '×' + nb(Number(rap[rap.length - 1].toPrecision(1))) };
  const hA = (L) => (L.reduce((t, x) => t + x.actif, 0) / 3600).toFixed(0);
  h += `<h2>Conclusion</h2><p>Pour un joueur à 7 taps/s, les défis de pièces et d'achats ne freinent presque plus rien : <b>${inst} défis sur ${auj.length} durent 15 s ou moins</b>. À l'inverse, <b>${abus} défis prennent plus de 3 fois le temps visé</b>, surtout la cible dorée (40 à 64 touches, jusqu'à 1,2 h) et quelques « Achète 1 niveau » d'un palier déjà monté. La durée du jeu (${hA(auj)} h actives aujourd'hui) est tenue par la cible dorée, les pouvoirs et l'énergie de l'Aventure.</p>`;
  h += `<p><b>Recommandation :</b> recaler d'abord la cible dorée et les pouvoirs (gros écarts, sans effet sur l'économie), remesurer, puis recalculer seuils et prix avant de toucher aux pièces et aux achats des Ascensions 2 à 5, où les cibles v2.3 en pièces sont ${R2.min} à ${R2.max} : l'économie croît de façon exponentielle quand un groupe dure plus longtemps que son seuil. « Plancher du jeu » : la règle d'apparition (+20 % de revenu/s, +5 min de production) dépasse déjà le temps visé ; avec plus de générateurs, le +20 % devient un mur (A2 : jusqu'à 2,3 h). Rien n'est appliqué au jeu.</p>`;
  h += '<h2>Méthode</h2>';
}
h += `<p>Calculateur v2.3, hors du jeu (rien n'est modifié). Chaque défi est chronométré dans la boucle de <b>simulerGroupe</b> : le joueur de référence (celui des 32 h, achats au meilleur rapport) fait les défis dans l'ordre, à <b>7 taps/s</b>, avec la <b>Transe</b> (60 % des taps, ×${R.TRANSE.moyen.toFixed(2).replace('.', ',')} en moyenne), ses <b>critiques</b> réels et les <b>pouvoirs</b> de son deck (tirage des œufs du jeu). Cibles résolues par la fonction du jeu (règle du total, +20 % de passif, +5 min de production…). Temps = jeu ACTIF ; l'attente d'énergie de l'Aventure (hors ligne) est comptée à part.</p>`;
h += `<p>Temps visé par défi (décision A, durées gardées : 32 h) = durée actuelle de l'Ascension ÷ œufs ÷ 8. Recalés : pièces, de côté, revenu/s, taps, critiques, cible dorée, pouvoirs, achats. Inchangés (=) : Aventure, records (Transe, taps d'affilée), Ascension, Sanctuaire, Veilleur, Offrande, cibles de 1, œuf 1 (tutoriel). En gras : la nouvelle cible.</p>`;
h += '<p>Légende (document « œuf par œuf ») : 🔴 achat · 🟢 Aventure et créatures · ⚪ Clicker.</p>';
h += '<table border="1"><tr><th>Ascension</th><th>Visé par défi</th><th>Aujourd\'hui (actif)</th><th>v2.3 (actif)</th><th>Défis instantanés</th><th>Attente d\'énergie</th></tr>';
for (let a = 0; a < 6; a++) {
  const auj = R.aujourdhui[a], v = R.v23[a];
  const s = (L, k) => L.reduce((t, x) => t + x[k], 0);
  h += '<tr>' + td('A' + a) + td(duree(v.tau)) + td(duree(s(auj, 'actif'))) + td(duree(s(v.lignes, 'actif')))
    + td(auj.filter((x) => x.actif <= 15).length + ' / ' + auj.length) + td(duree(s(auj, 'attente'))) + '</tr>';
}
h += '</table>';
let n = 0;
for (let a = 0; a < 6; a++) {
  h += `<h2>Après ${a} Ascension${a > 1 ? 's' : ''}</h2><table border="1"><tr><th>N°</th><th>Défi actuel</th><th>Temps aujourd'hui</th><th>Cible v2.3</th><th>Temps v2.3</th></tr>`;
  let oeuf = null;
  R.aujourdhui[a].forEach((x, i) => {
    n += 1;
    const q = tous[n - 1];
    const y = R.v23[a].lignes[i] || {};
    if (x.oeuf !== oeuf) { oeuf = x.oeuf; h += `<tr><td colspan="5"><b>Œuf ${oeuf}${CREATURE[oeuf] ? ' → ' + CREATURE[oeuf] : ''}</b></td></tr>`; }
    const change = y.ecriteV23 !== undefined && y.ecriteV23 !== q.target;
    const attente = x.attente > 1 ? ` (+${duree(x.attente)} d'énergie)` : '';
    const attV = y.attente > 1 ? ` (+${duree(y.attente)})` : '';
    h += '<tr>' + td(n) + td(typeDe(q.metric) + ' ' + q.label(q.target)) + td(duree(x.actif) + attente)
      + td(change ? nb(y.ecriteV23) : y.note ? '= (plancher du jeu)' : '=', change) + td(y.actif !== undefined ? duree(y.actif) + attV : '—') + '</tr>';
  });
  h += '</table>';
}
h += `<h2>Hypothèses (toutes dans mobile/tools/calculateur-defis-v23.js)</h2><ul>`;
h += `<li>7 taps/s, Transe 60 % des taps (ton rapport : ~60 % à 8,1 taps/s), 8 s par défi pour lire, valider, ouvrir le menu (calé sur ton œuf 1 : 5,8 min ici, 6,3 min mesurés).</li>`;
h += `<li>Pouvoirs activés ~5 s après être prêts, un seul à la fois ; deck = 3 créatures les plus rares (Monte-Carlo de ${R.HYP.joueursMC} parties).</li>`;
h += `<li>Aventure : combat de 55 s sans taper, victoire selon le cran de l'étape (95/85/70/60/45 %), énergie 7 (+1 toutes les 20 min) ; sans énergie, le joueur part et revient (hors ligne).</li>`;
h += `<li>Cible dorée : 1re après 35 s en moyenne, puis toutes les 67,5 s. Boss de tap : 3 Diamants toutes les 20 min de jeu.</li>`;
h += `<li>Ignorés (moins de 3 % du revenu) : bonus de pièces des pouvoirs, cible dorée en pièces, remise des pouvoirs « remise ».</li></ul>`;
h += '</body></html>';
process.stdout.write(h);

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
const td = (t, gras) => `<td>${gras ? '<b>' + esc(t) + '</b>' : esc(t)}</td>`;
let h = '<html><head><meta charset="utf-8"></head><body>';
h += '<h1>Défis des œufs : temps réels et cibles v2.3</h1>';
h += `<p>Calculateur v2.3, hors du jeu (rien n'est modifié). Chaque défi est chronométré dans la boucle de <b>simulerGroupe</b> : le joueur de référence (celui des 32 h, achats au meilleur rapport) fait les défis dans l'ordre, à <b>7 taps/s</b>, avec la <b>Transe</b> (60 % des taps, ×${R.TRANSE.moyen.toFixed(2).replace('.', ',')} en moyenne), ses <b>critiques</b> réels et les <b>pouvoirs</b> de son deck (tirage des œufs du jeu). Cibles résolues par la fonction du jeu (règle du total, +20 % de passif, +5 min de production…). Temps = jeu ACTIF ; l'attente d'énergie de l'Aventure (hors ligne) est comptée à part.</p>`;
h += `<p>Temps visé par défi (décision A, durées gardées : 32 h) = durée actuelle de l'Ascension ÷ œufs ÷ 8. Recalés : pièces, de côté, revenu/s, taps, critiques, cible dorée, pouvoirs, achats. Inchangés (=) : Aventure, records (Transe, taps d'affilée), Ascension, Sanctuaire, Veilleur, Offrande, cibles de 1, œuf 1 (tutoriel). En gras : la nouvelle cible.</p>`;
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
    if (x.oeuf !== oeuf) { oeuf = x.oeuf; h += `<tr><td colspan="5"><b>Œuf ${oeuf}</b></td></tr>`; }
    const change = y.ecriteV23 !== undefined && y.ecriteV23 !== q.target;
    const attente = x.attente > 1 ? ` (+${duree(x.attente)} d'énergie)` : '';
    const attV = y.attente > 1 ? ` (+${duree(y.attente)})` : '';
    h += '<tr>' + td(n) + td(q.label(q.target)) + td(duree(x.actif) + attente)
      + td(change ? nb(y.ecriteV23) : '=', change) + td(y.actif !== undefined ? duree(y.actif) + attV : '—') + '</tr>';
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

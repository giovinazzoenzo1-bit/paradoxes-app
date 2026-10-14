// Compile TOUT le code (jeu + outils) avec Babel, comme le rituel l'exige avant chaque publication.
// Lancer depuis la RACINE du dépôt : NODE_PATH=/home/claude/babel-env/node_modules node mobile/tools/compiler-tout.js
// Attendu : « compilation : 73 fichiers, 0 en erreur » (le nombre suit le projet). Outil de Claude — jamais importé par l'appli.
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');
const fichiers = [];
(function parcourir(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) parcourir(p);
    else if (p.endsWith('.js')) fichiers.push(p);
  }
})('mobile/src');
['mobile/App.js', 'mobile/index.js'].forEach((f) => fichiers.push(f));
fs.readdirSync('mobile/tools').filter((f) => f.endsWith('.js')).forEach((f) => fichiers.push('mobile/tools/' + f));
let enErreur = 0;
for (const f of fichiers) {
  try {
    babel.transformSync(fs.readFileSync(f, 'utf8'), { filename: f, presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-react'] });
  } catch (e) {
    enErreur++;
    console.log('ERREUR ' + f + ' ' + e.message.split('\n')[0]);
  }
}
console.log('compilation : ' + fichiers.length + ' fichiers, ' + enErreur + ' en erreur');
if (enErreur) process.exit(1);

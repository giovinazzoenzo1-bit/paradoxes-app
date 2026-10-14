// VÉRIFICATEUR DE PORTÉE (11/10) — liste chaque nom UTILISÉ sans être DÉCLARÉ dans le code du jeu.
// Né du plantage « Property 'poudre' doesn't exist » : la fin de combat (dans ChapterMapScreen) lisait `poudre`, qui
// n'existait que dans le composant parent. La compilation ne voit PAS ce genre d'erreur (le code est valide) ; seul le
// téléphone plantait, à la fin de CHAQUE combat. Ici : analyse des portées par Babel, comme le moteur JavaScript.
//
//   NODE_PATH=… node mobile/tools/verifier-portee.js      → liste, code 1 s'il y a un nom inconnu
const fs = require('fs'), path = require('path');
const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;

const GLOBAUX = new Set(('console Math Date JSON Promise Object Array Number String Boolean Symbol Set Map WeakMap WeakSet Error ' +
  'TypeError RangeError SyntaxError ReferenceError parseInt parseFloat isNaN isFinite setTimeout clearTimeout setInterval ' +
  'clearInterval requestAnimationFrame cancelAnimationFrame global globalThis window undefined NaN Infinity require module ' +
  'exports __DEV__ process fetch Intl encodeURIComponent decodeURIComponent encodeURI decodeURI performance queueMicrotask ' +
  'Reflect Proxy arguments alert navigator ErrorUtils HermesInternal Buffer atob btoa URL URLSearchParams AbortController ' +
  'TextEncoder TextDecoder structuredClone Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array Float32Array ' +
  'Float64Array ArrayBuffer DataView BigInt eval __filename __dirname setImmediate clearImmediate FormData Headers Request ' +
  'Response Blob FileReader XMLHttpRequest WebSocket Event EventTarget crypto document location history localStorage ' +
  'sessionStorage Image Audio AggregateError FinalizationRegistry WeakRef Atomics SharedArrayBuffer escape unescape').split(' '));

function fichiers(racine) {
  const l = [];
  (function w(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else if (p.endsWith('.js')) l.push(p); } })(path.join(racine, 'src'));
  ['App.js', 'index.js'].forEach((f) => { const p = path.join(racine, f); if (fs.existsSync(p)) l.push(p); });
  return l;
}

function inconnus(fichier) {
  const code = fs.readFileSync(fichier, 'utf8');
  const ast = babel.parseSync(code, { filename: fichier, presets: ['@babel/preset-react'], babelrc: false, configFile: false });
  const trouves = [];
  traverse(ast, {
    ReferencedIdentifier(p) {
      const n = p.node.name;
      if (p.isJSXIdentifier() && /^[a-z]/.test(n)) return; // balise HTML (aucune ici, par prudence)
      // 12/10 — ZONE MORTE : une constante (const / let) lue AVANT sa déclaration, dans la MÊME fonction (exécutée au même
      // moment, ex. la liste de dépendances d'un useEffect au rendu) → « Cannot access … before initialization » : écran blanc,
      // alors que tout compile. Vécu évité de justesse : `owned.length` dans les dépendances d'un effet, `owned` déclaré
      // 40 lignes plus bas (ClickerScreen, indice de maîtrise du Gardien).
      const b = p.scope.getBinding(n);
      if (b && (b.kind === 'const' || b.kind === 'let') && b.path.node && p.node.start < b.path.node.start
        && p.getFunctionParent() === b.path.getFunctionParent() && !p.findParent((x) => x === b.path)) {
        trouves.push({ nom: n, ligne: p.node.loc ? p.node.loc.start.line : '?', zoneMorte: true });
        return;
      }
      if (p.scope.hasBinding(n, true) || GLOBAUX.has(n)) return;
      trouves.push({ nom: n, ligne: p.node.loc ? p.node.loc.start.line : '?' });
    },
  });
  return trouves;
}

// 16/10 — COMMENTAIRE AVALEUR : « // » posé AU MILIEU d'une ligne de code en transforme TOUTE LA FIN en commentaire.
// Vécu : la case d'un ennemi (« actif: false, // … ») avait perdu ses PV, PV max, K.O. et élite → PV des ennemis invisibles ;
// tout compilait. Repère : le code avant « // » se termine par une virgule (la liste continue) et le commentaire contient
// des « clé: valeur » qui ressemblent à du code.
function commentairesAvaleurs(fichier) {
  const trouves = [];
  fs.readFileSync(fichier, 'utf8').split('\n').forEach((l, n) => {
    const k = l.indexOf(' // '); if (k < 0) return;
    const avant = l.slice(0, k), apres = l.slice(k + 4);
    if ((avant.match(/'/g) || []).length % 2 || (avant.match(/`/g) || []).length % 2 || (avant.match(/"/g) || []).length % 2) return; // dans une chaîne
    if (!/,\s*$/.test(avant)) return;
    if (/\b[a-zA-Z_]+:\s*[a-zA-Z_('`\[{0-9][^,]*,\s*[a-zA-Z_]+[:,]/.test(apres) || /\b(hp|hpMax|ko|onPress|style|key|nom|niveau)\s*:/.test(apres)) trouves.push(n + 1);
  });
  return trouves;
}
function verifier(racine = path.join(__dirname, '..')) {
  const pb = [];
  for (const f of fichiers(racine)) for (const n of commentairesAvaleurs(f)) pb.push(`${path.relative(racine, f)}:${n} — un commentaire « // » au milieu de la ligne AVALE la suite du code`);
  // 16/10 : AUSSI dans les OUTILS (vécu le jour même : le modèle d'économie avait perdu « cumul.shop += p; griffes += p; } »).
  const outils = [];
  (function w(d) { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { if (f === 'node_modules' || f === 'out') continue; const p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else if (p.endsWith('.js')) outils.push(p); } })(path.join(racine, 'tools'));
  for (const f of outils) for (const n of commentairesAvaleurs(f)) pb.push(`${path.relative(racine, f)}:${n} — un commentaire « // » au milieu de la ligne AVALE la suite du code`);
  for (const f of fichiers(racine)) for (const x of inconnus(f)) pb.push(`${path.relative(racine, f)}:${x.ligne} — « ${x.nom} » ${x.zoneMorte ? 'utilisé AVANT sa déclaration (zone morte : écran blanc au rendu)' : 'utilisé sans être déclaré'}`);
  return pb;
}

if (require.main === module) {
  const pb = verifier();
  console.log(pb.length ? pb.join('\n') : 'portée : aucun nom inconnu');
  if (pb.length) process.exit(1);
}
module.exports = { verifier, inconnus };

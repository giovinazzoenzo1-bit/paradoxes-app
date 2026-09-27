// Banc de capture : les VRAIS écrans du jeu, en web, à la taille d'un téléphone.
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const NATIFS = path.join(ICI, 'stubs/natifs.js');
const doublures = /^(expo-status-bar|react-native-safe-area-context|expo-screen-orientation|expo-navigation-bar|@expo\/vector-icons.*|@react-native-async-storage\/async-storage|lottie-react-native)$/;
const plugin = {
  name: 'paradox',
  setup(b) {
    b.onResolve({ filter: /^react-native$/ }, () => ({ path: path.join(ICI, 'node_modules/react-native-web/dist/cjs/index.js') }));
    b.onResolve({ filter: doublures }, () => ({ path: NATIFS }));
    b.onLoad({ filter: /\.(png|jpe?g)$/ }, (a) => ({
      contents: 'module.exports = { uri: "data:image/' + (a.path.endsWith('png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(a.path).toString('base64') + '" };',
      loader: 'js',
    }));
    // CombatResultScreen n'est pas exporté par l'appli : on l'expose ICI, à la volée.
    b.onLoad({ filter: /CombatScreen\.js$/ }, (a) => ({ contents: fs.readFileSync(a.path, 'utf8') + '\nexport { CombatResultScreen };\n', loader: 'jsx' }));
  },
};
await esbuild.build({
  entryPoints: [path.join(ICI, process.argv[2] || 'scenes/resultat.jsx')],
  bundle: true, outfile: path.join(ICI, 'out/bundle.js'), format: 'iife', plugins: [plugin],
  loader: { '.js': 'jsx' }, nodePaths: [path.join(ICI, 'node_modules')],
  resolveExtensions: ['.web.js', '.js', '.jsx', '.json'],
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"', global: 'window' },
  logLevel: 'error',
});
fs.writeFileSync(path.join(ICI, 'out/index.html'), '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000;font-family:Roboto,Arial,sans-serif}#root{display:flex;width:100vw;height:100vh}</style></head><body><div id="root"></div><script src="bundle.js"></script></body></html>');
console.log('assemblage OK');

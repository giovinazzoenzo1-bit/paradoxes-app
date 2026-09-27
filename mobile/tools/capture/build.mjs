// Banc de capture : les VRAIS écrans du jeu, en web, à la taille d'un téléphone.
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const exiger = createRequire(import.meta.url);
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
    // Le code de l'appli passe par la MÊME transformation que Metro sur le
    // téléphone (const/let → var) : sans elle, une lecture anticipée
    // inoffensive sur l'appareil (« Cannot access 'view' before
    // initialization ») bloquait le rendu web du menu principal.
    const babel = exiger('@babel/core');
    const commeMetro = (code, fichier) => babel.transformSync(code, {
      filename: fichier, babelrc: false, configFile: false,
      presets: [[exiger.resolve('@babel/preset-react'), { runtime: 'classic' }]],
      plugins: [exiger.resolve('@babel/plugin-transform-block-scoping')],
    }).code;
    // CombatResultScreen n'est pas exporté par l'appli : on l'expose ICI, à la volée.
    b.onLoad({ filter: /\/src\/.*\.js$/ }, (a) => {
      let code = fs.readFileSync(a.path, 'utf8');
      // FIDÈLE AU TÉLÉPHONE (SDK 57) : `pointerEvents` écrit en PROPRIÉTÉ y est
      // IGNORÉ (seul le style compte — commit 5defa31). Le navigateur, lui,
      // l'appliquait : le banc validait une correction qui, sur l'appareil,
      // aurait bloqué TOUS les taps (27/09). On retire donc la propriété ici.
      code = code.replace(/\s+pointerEvents="[a-z-]+"/g, '');
      if (a.path.endsWith('CombatScreen.js')) code += '\nexport { CombatResultScreen };\n';
      // Composants internes du menu, exposés pour les scènes du banc.
      if (a.path.endsWith('ClickerScreen.js')) code += '\nexport { DeckRow, ChallengeBar, TapEffect, styles as __stylesClicker };\n';
      // EMULE_TOUCHER=1 : le navigateur ne donne pas la position du doigt
      // (locationX/Y) au jeu, le téléphone OUI. On l'imite pour la zone de
      // l'œuf (tap sur la zone elle-même : origine = tapTouch, décalé de 13) —
      // UNIQUEMENT dans le banc, le code de l'appli n'est pas modifié.
      if (process.env.EMULE_TOUCHER === '1' && a.path.endsWith('ClickerScreen.js')) {
        const avant = code;
        code = code.replace('const x = evt.nativeEvent.locationX || 60;', 'const x = (evt.nativeEvent.pageX - 13) || 60;')
          .replace('const y = evt.nativeEvent.locationY || 60;', 'const y = (evt.nativeEvent.pageY - TAP_ZONE_TOP) || 60;');
        if (code === avant) throw new Error('EMULE_TOUCHER : lignes du tap introuvables');
      }
      return { contents: commeMetro(code, a.path), loader: 'js' };
    });
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

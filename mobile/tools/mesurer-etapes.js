// FORCE RÉELLE DE CHAQUE ÉTAPE (11/10) — pour le système de difficulté par fenêtres : la puissance affichée ne voit ni les
// sorts ni les effets d'équipe (zone, provocation, soins) ; on mesure donc, une fois pour toutes, chaque composition d'étape en
// vrais combats (6 équipes types, joueur normal 60 ms), placée là où la formule prédit 50 %, et on en tire un facteur :
// f > 1 = l'étape est plus dure que sa puissance ne le dit. Résultat : combatLogic.FACTEUR_ETAPE.
//   node mobile/tools/mesurer-etapes.js 1 30   (par morceaux : < 300 s par commande) → /tmp/facteurs-etapes.json (cumulé)
const fs = require('fs');
const A = require('./audit-quetes.js'); const K = A.load('combatLogic'); const C = A.C;
const PENTE = { '1v1': 9.157, '2v1': 12.888, '2v2': 10.542, '3v3': 18.379 }; // régressions logistiques du 11/10
const PANEL = [['bouldog', 'voltix', 'ombrillon'], ['pyrosile', 'caraploof', 'ventis'], ['glyphon', 'luxorbe', 'bouldog'],
  ['fournax', 'aquamira', 'zephyrion'], ['terracroc', 'brontobloc', 'malefix'], ['ventis', 'pyrosile', 'luxorbe']];
const g = (id) => C.CREATURES.find((c) => c.id === id);
const DECKS = require('./calculateur-griffes.js').calculer(120, 'actif').map((x) => x.deck);
function mesurer(n, combatsParEquipe = 40) {
  const compo = K.equipeEnnemie(n).map((m) => ({ creature: m.creature, evolutionTier: m.evolutionTier }));
  const nbE = compo.length, nbJ = Math.max(nbE, n <= 10 ? Math.min(2, 3) : nbE), cle = `${nbJ}v${nbE}`;
  // Niveau du deck = celui du CALCULATEUR DE GRIFFES à cette étape (profil actif) — mesurer à « 10 + 2 × étape » (niveau 90 à
  // l'étape 40) faussait les étapes avancées : les sorts en % des PV ne pèsent pas pareil (MESURÉ : 10 points d'écart).
  const deckCalc = DECKS[Math.max(0, n - 2)] || DECKS[DECKS.length - 1];
  const evo = compo[0].evolutionTier || 0, niv = Math.max(1, Math.round(deckCalc.reduce((t, x) => t + x, 0) / deckCalc.length));
  let v = 0, t = 0;
  for (const ids of PANEL) {
    const membres = ids.slice(0, nbJ).map((id) => ({ creature: g(id), ownedLevel: niv, evolutionTier: evo, equippedRunes: [] }));
    const P = K.puissanceAffichee(membres);
    const L = K.niveauPourDifficulte(n, P, 4, nbJ, { sansFacteur: true }); // là où la formule seule prédit 50 %
    const eq = membres.map((m) => ({ creature: m.creature, stats: K.combatStatsForCreatureTyped(m.creature, niv, evo, []) }));
    const EE = compo.map((m) => ({ creature: m.creature, stats: K.combatStatsForCreatureTyped(m.creature, L, m.evolutionTier, []) }));
    let s = (n * 7919 + ids.join('').length) >>> 0; const alea = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
    for (let i = 0; i < combatsParEquipe; i++) { t++; if (K.simulerCombat(eq, EE, { alea, politique: K.choixJoueur, erreurMs: 60 }).gagne) v++; }
  }
  const w = Math.min(0.97, Math.max(0.03, v / t));
  return +Math.exp((0 - Math.log(w / (1 - w))) / (PENTE[cle] || PENTE['3v3'])).toFixed(3); // logit(50 %) = 0
}
if (require.main === module) {
  const F = '/tmp/facteurs-etapes.json';
  const res = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};
  for (let n = Number(process.argv[2]); n <= Number(process.argv[3]); n++) res[n] = mesurer(n);
  fs.writeFileSync(F, JSON.stringify(res));
  console.log('étapes mesurées : ' + Object.keys(res).length + ' · ' + Object.entries(res).filter(([n]) => n >= Number(process.argv[2]) && n <= Number(process.argv[3])).map(([n, f]) => n + ':' + f).join(' '));
}
module.exports = { mesurer };

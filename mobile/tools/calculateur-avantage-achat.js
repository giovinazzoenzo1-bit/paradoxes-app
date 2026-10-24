// CALCULATEUR DE L'AVANTAGE DES GRIFFES PAYÉES (22/10, règles de l'auteur) — « si un joueur paie des Griffes, l'Aventure doit
// être plus facile pendant un nombre de combats proportionnel au prix ».
// Règle du jeu (combatLogic.photoFenetre, options.griffesPayees) : les Griffes ACHETÉES restent hors de la photo de la fenêtre
// pendant 3 combats par euro (5 au moins, 300 au plus au total) ; ensuite moitié à la fenêtre suivante, tout à celle d'après ;
// PLAFONNÉ à 90 % de victoires (22/10, choix de l'auteur).
// Ce calculateur NE TOUCHE PAS AU JEU : il lit ses fonctions (photo, coût des niveaux, dépense équitable, pentes mesurées) et
// donne, pour chaque pack et à plusieurs moments du jeu, la chance de victoire au 1er essai SANS achat (= la cible du jeu,
// l'achat serait absorbé) et AVEC l'avantage, avec la courbe du jeu (même calcul que « chance si tu dépenses tes Griffes »).
//
//   node mobile/tools/calculateur-avantage-achat.js
const path = require('path');
const A = require(path.join(__dirname, 'audit-quetes.js'));
const C = A.load('combatLogic'); const K = A.load('clickerLogic');
const babel = require('@babel/core'); const fs = require('fs');
const code = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/games/clicker/achats.js'), 'utf8'),
  { presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]], filename: 'achats.js' }).code;
const M = { exports: {} };
new Function('require', 'module', 'exports', code)((m) => (/clickerLogic/.test(m) ? K : { __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }), M, M.exports);
const ACH = M.exports;

// Moments du jeu : étape d'Aventure → niveau du deck du joueur GRATUIT normal (calculateur de Griffes, profil normal, 22/10).
const MOMENTS = [[11, 17], [21, 26], [31, 33], [41, 41]];
const PACKS = ['griffes_3', 'pack_gardien', 'pack_progression', 'griffes_18', 'pack_ascension', 'griffes_40', 'griffes_90'];
const DECK = K.CREATURES.filter((c) => c.rarity === 'rare').slice(0, 3);
const logit = (p) => Math.log(p / (1 - p)); const sig = (z) => 1 / (1 + Math.exp(-z));

function chanceMoyenne(debut, deckReel, deckRef) {
  // Les 5 étapes de la fenêtre : la photo a calé les ennemis sur `deckRef` pour la cible de chaque cran ; le joueur se bat avec
  // `deckReel`. Écart de puissance → écart de chance par la pente MESURÉE de la configuration (comme l'écran).
  let s = 0;
  for (let n = debut; n < debut + C.TAILLE_FENETRE; n++) {
    const nbJ = Math.max(1, Math.min(deckReel.length, C.combattantsPourEtape(n)));
    const nbE = C.opponentTeamForLevel(n).length;
    const cible = C.cibleDifficulte(n, C.difficulteEtape(n, 0));
    const pente = C.penteDifficulte(nbJ, nbE);
    const pReel = C.puissanceAffichee(deckReel.slice(0, nbJ));
    // Le PLAFOND du jeu (22/10 : 90 %) : la même fonction que la photo.
    const pRef = C.puissanceAvantagePlafonnee(pReel, C.puissanceAffichee(deckRef.slice(0, nbJ)), cible, pente);
    s += sig(logit(cible) + pente * Math.log(pReel / pRef));
  }
  return s / C.TAILLE_FENETRE;
}
const pc = (x) => `${Math.round(x * 100)} %`;
console.log('Avantage des Griffes payées — victoires au 1er essai, moyenne d\'une fenêtre de 5 étapes (joueur normal)\n');
for (const [etape, niv] of MOMENTS) {
  const deck = DECK.map((creature) => ({ creature, ownedLevel: niv, evolutionTier: niv >= 25 ? 1 : 0, equippedRunes: [] }));
  const debut = C.debutFenetre(C.fenetreDe(etape));
  const sans = chanceMoyenne(debut, deck, deck);
  console.log(`— Étape ${etape} (deck niveau ${niv}) · sans achat : ${pc(sans)} —`);
  console.log('pack | prix | Griffes | combats | pendant l\'avantage | 1re fenêtre du retour (½) | ensuite');
  for (const id of PACKS) {
    const p = ACH.produit(id);
    const g = ACH.contenuReel(id, { creature: DECK[0], niveau: niv, passifParSec: 0 }).griffes || 0;
    const apres = C.deckApresEffortEquitable(deck, g, Infinity, { evolutions: true }).membres; // le joueur dépense tout de suite
    const ref = C.deckSansGriffesPayees(apres, g); // ce que voit la photo pendant l'avantage
    const refMoitie = C.deckSansGriffesPayees(apres, Math.round(g / 2));
    console.log(`${p.titre} | ${p.prix} | ${g} | ${ACH.combatsPourPrix(ACH.prixEnEuros(p))} | ${pc(chanceMoyenne(debut, apres, ref))} | ${pc(chanceMoyenne(debut, apres, refMoitie))} | ${pc(chanceMoyenne(debut, apres, apres))}`);
  }
  console.log('');
}

'use strict';
// ════════════════════════════════════════════════════════════════════
//  LE JEU DIT-IL LA MÊME CHOSE QUE LE DOCUMENT ?
// ════════════════════════════════════════════════════════════════════
//
// Demandé par l'auteur après la soirée du 19/09, où le jeu et le
// document ont divergé sept fois de suite.
//
// ⚠️ On ne compare PAS le document au moteur — ça reviendrait à
// comparer un texte à lui-même, puisqu'il en est issu. On rejoue le
// chemin de l'ÉCRAN : tirage initial au groupe 0, rattrapage quand le
// nombre d'Ascensions devient connu, nouveau tirage à chaque Ascension,
// et éclosion d'œuf en œuf. C'est ce chemin-là qui a menti.
const fs = require('fs');
const A = require('/home/claude/paradoxes-app/mobile/tools/audit-quetes.js');
const { Q, C } = A;

const DOC = process.argv[2] || '/mnt/user-data/outputs/defis-paradox.md';

// ---- Le document, lu tel que l'auteur le lit -----------------------
// ⚠️ Les nombres sont écrits avec une espace INSÉCABLE ÉTROITE (U+202F)
// par `toLocaleString('fr-FR')`, que le générateur du document a
// convertie en espace ordinaire. Sans normalisation, 35 défis
// PARFAITEMENT identiques ressortaient comme des écarts — et un
// vérificateur qui crie au loup sur des cas justes ne sera pas lu.
const normalise = (t) => (t || '')
  .replace(/[\u202f\u00a0\u2009]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function lireDocument() {
  const lignes = fs.readFileSync(DOC, 'utf8').split('\n');
  const parDefi = {};
  lignes.forEach((l) => {
    const m = l.match(/^\*\*(\d+)\.\*\*\s+(.*)$/);
    if (!m) return;
    // On retire l'emoji de tête pour ne comparer que le texte.
    parDefi[Number(m[1])] = normalise(m[2].replace(/^\S+\s+/, ''));
  });
  return parDefi;
}

// ---- Le chemin de l'écran, rejoué ---------------------------------
function etatJoueur(ascension) {
  return {
    ascension,
    tapPower: 1, coins: 0, totalEarned: 0, passiveIncome: 0,
    sanctuaryLevel: 0, veilleurLevel: 0, critLevel: 0, critDamageLevel: 0,
    autoClickers: {}, upgradeLevels: {}, tapUpgrades: {}, essence: 0,
    ownedCount: 0, creaturesAVenir: 0, deckCount: 0,
    advLevelReached: 0, maxCreatureLevel: 0, totalTaps: 0,
    totalCrits: 0, goldenClaimed: 0, maxTranseHoldSec: 0, maxCombo: 0,
    powerActivated: 0, offering: 0, runeBought: 0, runeFused: 0,
    threeStarLevel: 0, battleWon: 0, totalSummons: 0,
  };
}

// Ce que l'écran affiche pour l'œuf `index`, avec `asc` Ascensions.
function defisAffiches(index, asc) {
  const stats = etatJoueur(asc);
  // ⚠️ VARIANTE DE JOUEUR. L'auteur a demandé plusieurs passages : une
  // cible qui dépend de l'état du joueur se verrait ici, et pas sur un
  // seul profil. Les trois profils doivent donner le MÊME document.
  const profil = Number(process.env.PROFIL || 0);
  if (profil >= 1) {
    stats.tapPower = 18; stats.coins = 5e6; stats.totalEarned = 2e7;
    stats.autoClickers = { esprit: 14, main: 9, automate: 5 };
    stats.sanctuaryLevel = 30; stats.critLevel = 9; stats.critDamageLevel = 11;
    stats.totalTaps = 40000; stats.goldenClaimed = 60; stats.powerActivated = 30;
  }
  if (profil >= 2) {
    stats.tapPower = 40; stats.coins = 9e11; stats.totalEarned = 4e12;
    stats.autoClickers = { esprit: 40, main: 30, automate: 25, colonie: 18, titan: 12 };
    stats.sanctuaryLevel = 50; stats.veilleurLevel = 50;
    stats.critLevel = 25; stats.critDamageLevel = 25;
    stats.totalTaps = 900000; stats.goldenClaimed = 500; stats.powerActivated = 400;
    stats.maxTranseHoldSec = 300; stats.battleWon = 200; stats.totalCrits = 9000;
  }
  // Les défis d'Aventure demandent une créature à venir.
  stats.ownedCount = Math.min(index, C.CREATURES.length);
  stats.creaturesAVenir = stats.ownedCount + 1;
  stats.deckCount = Math.min(3, stats.ownedCount);
  // L'état monte avec les œufs déjà faits, comme en jeu.
  stats.advLevelReached = 10 + asc * 15;
  stats.maxCreatureLevel = 1 + index;
  const set = Q.nextQuestSet(index, [], stats);
  return set.ids.map((id) => {
    const q = Q.findQuest(id);
    const cible = Q.effectiveQuestTarget(id, stats, set.targets || {});
    const texte = q.label(cible, Q.metriqueDuDefi(q, stats)) || '';
    // ⚠️ Le défi à PAS RELATIF affiche un nombre qui dépend du joueur ;
    // le document en donne la RÈGLE. Les comparer littéralement serait
    // faux — on compare la règle.
    // ⚠️ Restreint à la CRÉATURE : le défi d'Ascension porte lui aussi
    // un pas relatif, et le confondre avec celui-ci faisait ressortir
    // six faux écarts.
    if (q.step && q.metric === 'maxCreatureLevel') return 'Monte une créature +5 niveaux au-dessus de ta meilleure';
    return normalise(texte);
  });
}

// ---- Comparaison ---------------------------------------------------
const doc = lireDocument();
const nbDefis = Object.keys(doc).length;
if (!nbDefis) {
  console.log('\n  ⚠️ Document introuvable ou vide : ' + DOC + '\n');
  process.exit(1);
}

const ecarts = [];
let numero = 0;
const NB_OEUFS = Math.ceil(nbDefis / 5) + 6;
for (let index = 0; index < NB_OEUFS; index++) {
  const asc = Math.floor(index / Q.QUEST_SEQUENCE.length);
  const affiches = defisAffiches(index, asc);
  affiches.forEach((texte) => {
    numero += 1;
    const attendu = doc[numero];
    if (attendu === undefined) return;
    if (attendu !== texte) {
      ecarts.push({ n: numero, oeuf: index + 1, asc, doc: attendu, jeu: texte });
    }
  });
}

console.log('\n' + '═'.repeat(76));
console.log('  DOCUMENT vs CHEMIN DE L\'ÉCRAN — ' + numero + ' défis comparés');
console.log('═'.repeat(76));
if (!ecarts.length) {
  console.log('\n  ✅ AUCUN ÉCART. Chaque défi du jeu correspond au document.\n');
} else {
  console.log('\n  ❌ ' + ecarts.length + ' écart(s) sur ' + numero + ' :\n');
  ecarts.slice(0, 15).forEach((e) => {
    console.log('   défi ' + String(e.n).padStart(3) + ' (œuf ' + e.oeuf + ', A' + e.asc + ')');
    console.log('      document : ' + e.doc);
    console.log('      jeu      : ' + e.jeu);
  });
  if (ecarts.length > 15) console.log('\n   … et ' + (ecarts.length - 15) + ' autres');
  console.log('');
}

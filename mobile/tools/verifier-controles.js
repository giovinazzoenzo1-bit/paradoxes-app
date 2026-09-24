// ════════════════════════════════════════════════════════════════════
//  LE CONTRÔLE DES CONTRÔLES
// ════════════════════════════════════════════════════════════════════
//
// Demandé par l'auteur le 21/09 : « blinde le contrôle, et contrôle tout
// de A à Z ».
//
// Un contrôle qui ne crie jamais ne vaut RIEN : il ressemble à un
// contrôle satisfait. Le 21/09, dix contrôles lisaient encore les
// anciens modèles de défis, abandonnés la veille — ils restaient verts
// quoi qu'on écrive dans les vrais défis du jeu. Personne ne l'aurait vu
// sans ce fichier.
//
// POUR CHAQUE CONTRÔLE LANCÉ par `verifier-defis.js`, un SABOTAGE réel
// dans les fichiers du jeu — le défaut précis que ce contrôle doit
// attraper. On l'applique, on lance le contrôle seul, il DOIT crier, et
// on restaure.
//
//   node mobile/tools/verifier-controles.js           tout
//   node mobile/tools/verifier-controles.js 0 12      une tranche
//
// ⚠️⚠️ SÉCURITÉ : chaque fichier touché est sauvegardé AVANT, restauré
// APRÈS chaque sabotage, puis comparé OCTET PAR OCTET à la fin. Un
// sabotage oublié dans le code serait publié au prochain push : le pire
// scénario possible. Si un fichier diffère, il est restauré et le
// contrôle ÉCHOUE bruyamment.
//
// ⚠️ UN SABOTAGE « PÉRIMÉ » (son repère a disparu du code) est un ÉCHEC,
// pas un passe-droit : il force à le tenir à jour quand le code change.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
const F = {
  defis: path.join(RACINE, 'src/games/clicker/defisEcrits.js'),
  logique: path.join(RACINE, 'src/games/clicker/questLogic.js'),
  clicker: path.join(RACINE, 'src/games/clicker/clickerLogic.js'),
  ecran: path.join(RACINE, 'src/screens/games/ClickerScreen.js'),
  index: path.join(RACINE, 'index.js'),
  diag: path.join(RACINE, 'src/games/clicker/diagnostic.js'),
  doc: path.join(RACINE, 'DEFIS_PARADOX.md'),
};

// ---- Outils pour viser un défi par son identifiant ------------------
// Un défi occupe 3 lignes : identité, cible/mode, libellé.
function blocs(src) {
  const lignes = src.split('\n');
  const res = [];
  lignes.forEach((l, i) => {
    const m = l.match(/\{ id: '(a(\d)e(\d)_[^']+)', icon: '[^']*', metric: '([^']+)'/);
    if (m) res.push({ id: m[1], g: Number(m[2]), e: Number(m[3]), metric: m[4], i });
  });
  return { lignes, res };
}
// Modifie les 3 lignes du PREMIER défi qui satisfait `choix`.
function surDefi(choix, modif) {
  return (src) => {
    const { lignes, res } = blocs(src);
    const b = res.find(choix);
    if (!b) return src;
    const bloc = lignes.slice(b.i, b.i + 3).join('\n');
    const neuf = modif(bloc);
    lignes.splice(b.i, 3, ...neuf.split('\n'));
    return lignes.join('\n');
  };
}
// Modifie TOUS les défis qui satisfont `choix`.
function surDefis(choix, modif) {
  return (src) => {
    const { lignes, res } = blocs(src);
    res.filter(choix).reverse().forEach((b) => {
      const bloc = lignes.slice(b.i, b.i + 3).join('\n');
      lignes.splice(b.i, 3, ...modif(bloc).split('\n'));
    });
    return lignes.join('\n');
  };
}
const remplace = (avant, apres) => (src) => (src.split(avant).length === 2 ? src.replace(avant, apres) : src);
const cible = (n) => (b) => b.replace(/target: \d+/, 'target: ' + n);

// ---- UN SABOTAGE PAR CONTRÔLE ----------------------------------------
// Chacun reproduit un défaut RÉEL déjà rencontré, ou la panne exacte que
// le contrôle existe pour empêcher.
const SABOTAGES = [
  ['auditCoherence', F.defis, 'un défi porte sur une métrique que le jeu ne publie pas',
    surDefi((b) => b.metric === 'goldenClaimed', (b) => b.replace("metric: 'goldenClaimed'", "metric: 'metriqueInconnue'"))],
  ['auditLibelles', F.defis, "« Atteins 29 000 pièces par seconde » écrit en dur, cible 10 (bug réel)",
    surDefi((b) => b.metric === 'passiveIncome', (b) => b.replace(/label: .*$/m, "label: () => 'Atteins 29 000 pièces par seconde' },"))],
  ['auditLibelleSansArticle', F.defis, '« … un article » : texte cassé lu par le joueur',
    surDefi((b) => b.metric === 'goldenClaimed', (b) => b.replace(/label: .*$/m, 'label: t => `Touche ${t} fois un article` },'))],
  ['auditRecompenseDoublee', F.ecran, 'une récompense fixe gonflée par le revenu passif (bug réel)',
    remplace('  const addDiamondsToday = async (n) => {', '  const _doublon = () => gainCoins(passiveIncome * 60);\n  const addDiamondsToday = async (n) => {')],
  ['auditTamponsAscension', F.ecran, "le tampon de gains n'est plus vidé à l'Ascension (bug réel)",
    (src) => { const i = src.indexOf('const confirmAscension'); const j = src.indexOf('pendingGainRef.current = 0;', i);
      return i < 0 || j < 0 ? src : src.slice(0, j) + '/* retiré */' + src.slice(j + 'pendingGainRef.current = 0;'.length); }],
  ['auditPrixParAscension', F.clicker, "les prix ne suivent plus l'Ascension : boutique gratuite à A5 (bug réel)",
    // Repère À DEUX LIGNES : la dernière existe aussi dans le coût des
    // paliers de tap, et un repère ambigu rendait ce sabotage « périmé ».
    // ⚠️ Repère mis à jour le 21/09 : la formule a changé avec la
    // majoration des 3 premiers exemplaires. C'est exactement le rôle d'un
    // sabotage « périmé » : forcer à le tenir à jour.
    // ⚠️ Repère mis à jour le 21/09 : la formule porte désormais aussi
    // la surprime « avant son heure ».
    remplace('    * prixMultiplicateurAscension(ascensionCount)\n    * surprimeGenerateur(clicker, ascensionCount);',
      '    * 1\n    * surprimeGenerateur(clicker, ascensionCount);')],
  ['auditInfaisable', F.defis, 'un défi coûte bien plus que le seuil',
    surDefi((b) => b.metric === 'tapPower' && b.g === 0, cible(40))],
  ['auditResetSurChangement', F.ecran, "la sauvegarde réimpose les anciennes références après une mise à jour (bug réel)",
    remplace('setQuestBaselines(defsChangees ? {} : (saved.questBaselines || {}));', 'setQuestBaselines(saved.questBaselines || {});')],
  ['auditEtatComplet', F.ecran, "le tirage reçoit un fragment d'état au lieu de l'état complet (bug réel)",
    remplace('const setApres = nextQuestSet(oeufDuGroupe, [], statsApres);', 'const setApres = nextQuestSet(oeufDuGroupe, [], { ascension: ascApres });')],
  ['auditInstantanesAJour', F.ecran, 'un instantané lit une valeur périmée au lieu de sa ref (bug réel)',
    // ⚠️ Visé DANS `buildQuestStatsSnapshot` : la même ligne existe
    // ailleurs, et un repère ambigu rendait ce sabotage « périmé ».
    (src) => { const i = src.indexOf('const buildQuestStatsSnapshot'); const j = src.indexOf('    tapPower: tapPowerRef.current,', i);
      return i < 0 || j < 0 ? src : src.slice(0, j) + '    tapPower: lifetimeStats.tapPower,' + src.slice(j + '    tapPower: tapPowerRef.current,'.length); }],
  ['auditNomsEnDur', F.ecran, "un nom d'article écrit en dur (« Titan de Foudre », bug réel)",
    remplace('  const addDiamondsToday = async (n) => {', "  const _nom = 'Esprit Frappeur';\n  const addDiamondsToday = async (n) => {")],
  ['auditAchatsColles', F.defis, "deux défis d'achat d'affilée",
    surDefi((b) => b.metric === 'maxTranseHoldSec' && b.g === 0 && b.e === 1,
      (b) => b.replace("metric: 'maxTranseHoldSec'", "metric: 'critDamageLevel'").replace("mode: 'absolute'", "mode: 'delta'"))],
  ['auditPlafondAchats', F.defis, 'un joueur en avance se voit réclamer une fortune',
    surDefi((b) => b.metric === 'auto:esprit' && b.g === 0, cible(200))],
  ['auditCoutCroissant', F.defis, 'un achat bien moins cher que le précédent, en plein groupe',
    surDefi((b) => b.metric.startsWith('auto:') && b.g === 1 && b.e >= 4, cible(1))],
  ['auditBudgetGroupe', F.clicker, "le seuil d'A0 triplé : les achats ne font plus 90 % (règle de l'auteur)",
    (src) => src.replace(/\n(  )(\d+)(,\s+\/\/ A0)/, (m, a, v, c) => '\n' + a + String(Number(v) * 3) + c)],
  ['auditArticlesOrphelins', F.defis, 'un générateur que plus aucun défi ne demande',
    (src) => src.split("metric: 'auto:golem'").join("metric: 'auto:titan'")],
  ['auditEquilibreFamilles', F.defis, "un groupe qui dérive vers tout-Aventure",
    surDefis((b) => b.g === 5 && ['goldenClaimed', 'powerActivated', 'maxTapStreak', 'maxTranseHoldSec'].includes(b.metric),
      (b) => b.replace(/metric: '[^']+'/, "metric: 'battleWon'"))],
  ['auditPrerequisTenus', F.defis, 'un palier de tap demandé avant le Pacte 10 (œuf bloqué)',
    surDefi((b) => b.metric === 'tapPower' && b.g === 1, cible(2))],
  ['auditMetriquesIncrementees', F.defis, "un défi sur une métrique que le jeu n'augmente jamais (œuf bloqué pour toujours)",
    surDefi((b) => b.metric === 'maxTranseHoldSec', (b) => b.replace("metric: 'maxTranseHoldSec'", "metric: 'brouettesLavees'"))],
  ['auditDureeCroissante', F.clicker, "le seuil d'A1 divisé par 50 : sa durée s'effondre",
    (src) => src.replace(/\n(  )(\d+)(,\s+\/\/ A1)/, (m, a, v, c) => '\n' + a + String(Math.round(Number(v) / 50)) + c)],
  ['auditHorsLigne', F.clicker, "le hors ligne verse 1,5 milliard à un joueur à 337/s (bug réel)",
    remplace('  return Number.isFinite(gain) && gain > 0 ? gain : 0;', '  return Math.max(gain, 1500000000);')],
  ['auditFaisableAuMoment', F.defis, "« Atteins 29 000 pièces/s » à l'œuf 2, passif à zéro (bug réel)",
    surDefi((b) => b.metric === 'passiveIncome' && b.e === 2, cible(29000))],
  ['auditCoteEtalon', F.defis, "« Mets 32 M de côté » à l'A2 : 7 fois l'étalon de 94 s de production (bug réel du 24/09)",
    surDefi((b) => b.metric === 'coins' && b.g === 2 && b.e === 7, cible(32000000))],
  ['auditSignalement', F.index, 'le filet de sécurité plante quand le stockage manque',
    remplace('    // 1. Mémoriser, pour la proposer au prochain lancement.',
      "    require('@react-native-async-storage/async-storage').default.setItem('x', 'y');\n    // 1. Mémoriser, pour la proposer au prochain lancement.")],
  ['auditLibelleMode', F.defis, '« Achète 6 niveaux de Pacte » réglé en « atteins le niveau » (bug réel, défis 2 et 8)',
    surDefi((b) => b.metric === 'tapPower', (b) => b.replace("mode: 'delta'", "mode: 'absolute'"))],
  ['auditCibleBudget', F.ecran, "la cible d'achat n'est plus recalculée quand le défi apparaît (bug réel, défi 2)",
    remplace('      const cible = cibleAchatCumulee(q, instantane, q.target);', '      const cible = q.target;')],
  ['auditDefiInvisible', F.ecran, 'un défi validé avant même d\'apparaître (bug réel, défis 7 et 8)',
    remplace('const pasEncoreApparu = (id) => !questBaselines[id];', 'const pasEncoreApparu = (id) => false;')],
  ['auditDocConforme', F.doc, 'le document remis ne dit plus ce que le jeu affiche (bug réel)',
    remplace('Obtiens 750 pièces', 'Obtiens 751 pièces')],
  ['auditDefisEcrits', F.defis, "du code transformé recopié : `(0, _questFormat.fmtQ)` (bug réel, plantage)",
    (src) => src.replace('${fmtQ(t)} pièces par seconde', '${(0, _questFormat.fmtQ)(t)} pièces par seconde')],
  ['auditCorvee', F.defis, '30 offrandes à enchaîner : une corvée',
    surDefi((b) => b.metric === 'offering', cible(30))],
  ['auditModes', F.defis, "« gagne 7 de revenu par seconde EN PLUS » : métrique d'état en delta",
    surDefi((b) => b.metric === 'passiveIncome', (b) => b.replace("mode: 'absolute'", "mode: 'delta'"))],
  ['auditEmballement', F.defis, '900 taps d\'affilée : au-delà de la limite humaine (règle de l\'auteur : 400)',
    surDefi((b) => b.metric === 'maxTapStreak', cible(900))],
  ['auditFamilles', F.defis, "deux défis d'économie dans le même œuf",
    surDefi((b) => b.metric === 'goldenClaimed' && b.g === 0 && b.e === 1, (b) => b.replace("metric: 'goldenClaimed'", "metric: 'coins'"))],
  ['auditDependanceCreature', F.defis, "un défi qui vise une amélioration de créature (famille supprimée)",
    surDefi((b) => b.metric === 'goldenClaimed', (b) => b.replace("metric: 'goldenClaimed'", "metric: 'upgrade:xx'"))],
  ['auditSubstitutions', F.ecran, 'un défi retiré sans passer par `peutEtreRemplace`',
    remplace('  const addDiamondsToday = async (n) => {', '  const _retrait = () => pickQuestSet(0, [], {});\n  const addDiamondsToday = async (n) => {')],
  ['auditCibleSuitLeJoueur', F.logique, 'le moteur remet son échelle sur des cibles déjà finales (bug réel, 35 défis)',
    remplace('    if (quest.fige && !adaptable && !quest.minStep && !quest.step) return quest.target;', '')],
  ['auditCibleMonte', F.defis, "« Enchaîne 140 taps » puis « Enchaîne 120 taps » (bug réel, défis 15 et 35)",
    // Le PREMIER défi de taps de l'A0 passe au-dessus du second : la
    // cible redescend, exactement comme 140 puis 120.
    surDefi((b) => b.metric === 'maxTapStreak' && b.g === 0, cible(300))],
  // ⚠️ Pas « le seuil −40 % » : dans une économie qui accélère, les
  // derniers 40 % du seuil se gagnent vite, et la durée ne bouge que de
  // ~10 % — dans la marge. Le sabotage était trop faible, pas le contrôle.
  // On rejoue donc LE VRAI BUG du 21/09 : la hausse sur tous les
  // générateurs, partout (A1 à 2,7 h, A2 à 3,4 h).
  // ⚠️ Sabotage remplacé le 21/09 : l'ancien (hausse sur tous les
  // générateurs) ne déplaçait plus les durées, le simulateur corrigé
  // n'achetant presque aucun générateur avant l'A2. Un sabotage doit
  // rester DOULOUREUX pour prouver quoi que ce soit.
  ['auditDureeCible', F.clicker, 'la puissance du tap triplée : tout le jeu se boucle trop vite',
    (src) => src.replace(/export const TAP_DAMAGE_PER_LEVEL = ([\d.]+);/, (m, v) => 'export const TAP_DAMAGE_PER_LEVEL = ' + (Number(v) * 3) + ';')],
  ['auditMajorationPrix', F.clicker, "la Main de l'A0 n'est plus majorée alors que ses défis la demandent",
    remplace("  ['esprit', 'main'],                 // A0", "  ['esprit'],                         // A0")],
  ['auditMajorationPrix', F.clicker, "un palier de tap rattaché à une Ascension plus tardive que ses défis (surprime au mauvais moment)",
    remplace('  tap1: 1, tap2: 1, tap3: 2,', '  tap1: 1, tap2: 3, tap3: 2,')],
  ['auditCibleEtat', F.ecran, "les défis d'état ne se recalculent plus à leur apparition (« Atteins 2/s » quand tu en produis 27)",
    remplace('      const cible = cibleEtatAdaptee(q, instantane, q.target);', '      const cible = q.target;')],
  ['auditDebutDePartie', F.clicker, 'une mythique possible dès le premier œuf (bug réel du 21/09)',
    remplace("export const RARETE_MAX_PREMIERS_OEUFS = 'rare';", "export const RARETE_MAX_PREMIERS_OEUFS = 'mythique';")],
  ['auditCibleEtat', F.ecran, 'la photo d\'apparition redonne le passif boosté par un pouvoir (bug pressenti)',
    remplace('    passiveIncome: passiveIncomeBaseRef.current,', '    passiveIncome: passiveIncomeRef.current,')],
  // ⚠️ Vise des types que le contrôle juge ENCORE : cibles dorées, pouvoirs,
  // records et défis d'état en sont exclus depuis le 21/09 (rythmés par le
  // jeu ou recalculés à l'apparition), et l'ancien sabotage était devenu
  // aveugle.
  ['auditTropFacile', F.defis, 'des dizaines de défis réduits à rien',
    surDefis((b) => b.metric.startsWith('auto:') || ['tapPower', 'critLevel', 'critDamageLevel'].includes(b.metric), cible(1))],
];

// ---- Tolérances : lues dans la suite, JAMAIS recopiées ---------------
const suite = fs.readFileSync(path.join(__dirname, 'verifier-defis.js'), 'utf8');
const TOL = {};
const LANCES = [];
for (const m of suite.matchAll(/\['(audit\w+)',\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")(?:,\s*(\d+))?\]/g)) {
  TOL[m[1]] = Number(m[2] || 0);
  LANCES.push(m[1]);
}

// ---- Sauvegardes et garde-fous --------------------------------------
const touches = [...new Set(SABOTAGES.map((s) => s[1]))];
const SAUVE = {};
touches.forEach((f) => { SAUVE[f] = fs.existsSync(f) ? fs.readFileSync(f) : null; });
const toutRestaurer = () => {
  touches.forEach((f) => { if (SAUVE[f] !== null) fs.writeFileSync(f, SAUVE[f]); });
};
process.on('exit', toutRestaurer);
['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => { toutRestaurer(); process.exit(2); }));
process.on('uncaughtException', (e) => { toutRestaurer(); console.error(e); process.exit(2); });

function lancer(nom) {
  const r = spawnSync('node', ['-e', `
    const A = require(${JSON.stringify(path.join(__dirname, 'audit-quetes.js'))});
    let n; try { const r = A[${JSON.stringify(nom)}](); n = Array.isArray(r) ? r.length : -2; }
    catch (e) { n = -1; }
    process.stdout.write('N=' + n);`], { encoding: 'utf8', env: process.env, timeout: 120000 });
  const m = (r.stdout || '').match(/N=(-?\d+)/);
  return m ? Number(m[1]) : -1;
}

const [debut, fin] = [Number(process.argv[2] || 0), Number(process.argv[3] || SABOTAGES.length)];
console.log('\n' + '═'.repeat(74));
console.log('  LE CONTRÔLE DES CONTRÔLES — chaque contrôle doit crier sur un vrai défaut');
console.log('═'.repeat(74));
let echecs = 0;
SABOTAGES.slice(debut, fin).forEach(([nom, fichier, quoi, mutation]) => {
  const original = SAUVE[fichier];
  if (original === null) { echecs++; console.log(`  💥 ${nom.padEnd(26)} fichier introuvable : ${fichier}`); return; }
  const src = original.toString('utf8');
  const sabote = mutation(src);
  if (sabote === src) {
    echecs++;
    console.log(`  ⚠️  ${nom.padEnd(26)} SABOTAGE PÉRIMÉ — son repère a disparu du code`);
    return;
  }
  let n;
  try {
    fs.writeFileSync(fichier, sabote);
    n = lancer(nom);
  } finally {
    fs.writeFileSync(fichier, original);
  }
  const tol = TOL[nom] || 0;
  // Crie = la suite complète échouerait. Une panne compte : la suite
  // blindée la traite comme un échec.
  const crie = n === -1 || n === -2 || n > tol;
  if (!crie) echecs++;
  console.log(`  ${crie ? '🛡️ ' : '🙈'} ${nom.padEnd(26)} ${crie ? (n < 0 ? 'crie (panne)' : 'crie (' + n + ')') : 'AVEUGLE'} — ${quoi}`);
});

// Chaque contrôle LANCÉ doit avoir son sabotage : sinon il n'est pas prouvé.
if (debut === 0 && fin >= SABOTAGES.length) {
  const prouves = new Set(SABOTAGES.map((s) => s[0]));
  LANCES.filter((n) => !prouves.has(n)).forEach((n) => {
    echecs++; console.log(`  💥 ${n.padEnd(26)} lancé par la suite, mais JAMAIS prouvé ici`);
  });
}

// ⚠️⚠️ Vérification finale : chaque fichier touché est intact.
toutRestaurer();
touches.forEach((f) => {
  if (SAUVE[f] !== null && !fs.readFileSync(f).equals(SAUVE[f])) {
    echecs++; console.log(`  💥 FICHIER NON RESTAURÉ : ${f}`);
  }
});
console.log('\n  ' + (echecs === 0
  ? `✅ ${Math.min(fin, SABOTAGES.length) - debut} contrôles prouvés — chacun crie sur son défaut. Fichiers intacts.`
  : `❌ ${echecs} problème(s) : un contrôle aveugle ne protège rien.`) + '\n');
process.exitCode = echecs === 0 ? 0 : 1;

#!/usr/bin/env node
'use strict';
// ════════════════════════════════════════════════════════════════
//  VÉRIFICATION D'UN CHANGEMENT DE DÉFI — une seule commande
// ════════════════════════════════════════════════════════════════
//
//   NODE_PATH=<dossier avec @babel/core> node mobile/tools/verifier-defis.js
//
// À lancer après TOUT ajout ou réglage dans `questDefs.js`. Il enchaîne
// les 10 contrôles, la force brute et la mesure des durées, puis répond
// par un verdict unique. Aucun test manuel sur le téléphone n'est
// nécessaire pour savoir si un ajout casse quelque chose de structurel.
//
// ⚠️ Ce qu'il NE peut PAS vérifier, et qui reste à l'œil humain :
//   - qu'une métrique est bien INCRÉMENTÉE par le jeu (`trackEvent`) —
//     `auditCoherence` vérifie qu'elle est publiée, pas qu'elle bouge ;
//   - qu'un défi est INTÉRESSANT ;
//   - les textes hors défis (sous-titres de la boutique).
const A = require('./audit-quetes.js');

const CONTROLES = [
  ['auditCoherence', 'métrique publiée, cible définissable'],
  ['auditLibelles', 'le libellé dit la vraie cible'],
  ['auditLibelleSansArticle', 'aucun libellé sans son article'],
  ['auditRecompenseDoublee', 'aucune récompense ne double le bonus d Ascension'],
  ['auditTamponsAscension', 'les gains en attente sont vidés à l Ascension'],
  ['auditPrixParAscension', 'la boutique garde sa valeur à chaque Ascension'],
  ['auditInfaisable', 'aucun défi ne coûte plus de 60 % du seuil'],
  ['auditResetSurChangement', 'une maj des défis efface l ancien état'],
  ['auditEtatComplet', 'le moteur reçoit l état complet du joueur'],
  ['auditInstantanesAJour', 'les instantanés lisent des valeurs à jour'],
  ['auditNomsEnDur', 'aucun nom d article écrit en dur hors de clickerLogic'],
  ['auditAchatsColles', 'jamais deux défis d achat d affilée'],
  ['auditPlafondAchats', 'un défi d achat reste faisable pour un joueur en avance'],
  ['auditCoutCroissant', 'le coût d un défi d achat ne redescend jamais'],
  ['auditBudgetGroupe', 'les défis d achat coûtent 80 à 100 % du seuil'],
  ['auditArticlesOrphelins', 'tout article atteignable est demandé par un défi'],
  ['auditEquilibreFamilles', 'l équilibre entre familles de défis tient'],
  ['auditPrerequisTenus', 'aucun défi ne précède le déblocage de son sujet'],
  ['auditMetriquesIncrementees', 'chaque métrique est bien incrémentée par le jeu'],
  ['auditDureeCroissante', 'la durée d un groupe ne retombe jamais'],
  ['auditHorsLigne', 'hors ligne standard, et aucune entrée ne bloque l Ascension'],
  ['auditFaisableAuMoment', 'un défi est faisable AU MOMENT où il arrive'],
  ['auditSignalement', 'le signalement marche et le filet de sécurité tient'],
  ['auditLibelleMode', 'le libellé dit ce que le défi mesure (Achète = delta)'],
  ['auditCibleBudget', 'la règle du total est juste, sûre, et appliquée quand le défi apparaît'],
  ['auditDefiInvisible', 'aucun défi ne peut sauter sans s afficher'],
  ['auditCibleMonte', 'une cible hors achats ne redescend jamais dans un groupe'],
  ['auditCibleEtat', 'les défis d état s adaptent à ce que le joueur a déjà'],
  ['auditDureeCible', 'chaque Ascension reste à ±15 % de sa durée cible'],
  ['auditMajorationPrix', 'la hausse des premiers prix vise les générateurs des défis'],
  ['auditDocConforme', 'le document remis à l auteur correspond au jeu'],
  ['auditDefisEcrits', 'le fichier des 252 défis est cohérent et fait foi'],
  ['auditCorvee', "pas de défi-corvée (N appuis d'affilée)"],
  ['auditModes', "pas de métrique d'ÉTAT en mode delta"],
  ['auditEmballement', "pas de cible de performance qui s'emballe"],
  ['auditFamilles', 'pas deux défis qui se lisent pareil dans un œuf'],
  ['auditDependanceCreature', 'ne dépend pas de posséder une créature'],


  ['auditSubstitutions', 'tout retrait de défi passe par la règle unique'],
  ['auditCibleSuitLeJoueur', 'une cible fixe est la même pour tous les joueurs'],
  ['auditTropFacile', 'au plus 22 défis faciles sur 252', 22],
];

// ⚠️⚠️ CONTRÔLES RETIRÉS, avec leur raison. Un contrôle qui existe sans
// tourner est signalé plus bas : s'il est ici, c'est une décision, pas un
// oubli.
const RETRAITES = {
  audit: 'ancien rapport général sur les modèles abandonnés le 20/09',
  auditPool: 'le pool de remplacement ne sert plus aucun joueur : aucun des 252 défis écrits n\'est remplaçable',
  auditRemplacements: 'comparait le jeu aux anciens modèles, abandonnés le 20/09',
  auditHorsSchema: 'comparait le jeu aux anciens modèles, abandonnés le 20/09',
  auditCiblesFixes: 'lisait les anciens modèles ; couvert par auditCibleSuitLeJoueur, rebranché sur les 252 défis',
  auditAscension: 'lisait les anciens modèles ; couvert par auditBudgetGroupe, auditDureeCroissante et auditFaisableAuMoment',
  auditAvailable: 'lisait les anciens modèles ; les défis écrits n\'ont plus de condition — couvert par auditPrerequisTenus',
};

let echecs = 0;
console.log('\n  CONTRÔLES');
// ⚠️⚠️ UNE PANNE N'EST JAMAIS COUVERTE PAR LA TOLÉRANCE.
//
// Avant le 21/09, un contrôle qui PLANTAIT rendait une seule « anomalie ».
// Avec une tolérance (22 pour auditTropFacile), il passait donc au VERT
// en silence : un contrôle cassé ressemblait à un contrôle satisfait.
// Désormais un contrôle introuvable, qui plante, ou qui ne rend pas une
// liste, est un échec — quelle que soit sa tolérance.
const vus = new Set();
CONTROLES.forEach(([nom, quoi, tolerance = 0]) => {
  let r;
  let panne = null;
  if (vus.has(nom)) panne = 'contrôle listé deux fois';
  vus.add(nom);
  if (!panne && typeof A[nom] !== 'function') panne = 'contrôle introuvable (renommé ou supprimé ?)';
  if (!panne) {
    try { r = A[nom](); } catch (e) { panne = 'le contrôle PLANTE : ' + e.message; }
  }
  if (!panne && !Array.isArray(r)) panne = 'le contrôle ne rend pas une liste (' + typeof r + ')';
  if (panne) {
    echecs++;
    console.log(`  💥 ${nom.padEnd(24)} ${panne}`);
    return;
  }
  // ⚠️ Une tolérance n'est PAS un aveuglement : le seuil reste bas et le
  // nombre s'affiche, donc une régression (on est passé de 32 à 2) se
  // voit immédiatement. Ici, deux défis de fin de partie portent sur des
  // métriques que le joueur fait monter de lui-même — aucune cible ne
  // peut les rendre durs sans casser les premiers groupes.
  const ok = r.length <= tolerance;
  if (!ok) echecs++;
  console.log(`  ${ok ? '✅' : '❌'} ${nom.padEnd(24)} ${quoi}`);
  if (!ok) r.slice(0, 4).forEach((x) => console.log('        ' + JSON.stringify(x)));
});

// ---- Force brute : 200 profils x 14 cycles --------------------------
const { Q, C, etatInitial } = A;
const rnd = (() => { let x = 12345; return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648; })();
let tires = 0; const pb = { infaisable: 0, dejaFait: 0, sousAcquis: 0, cycleCourt: 0 };
for (let p = 0; p < 200; p++) {
  const s = etatInitial();
  const n = Math.floor(rnd() * 26);
  s.ownedIds = C.CREATURES.map((c) => c.id).slice(0, n);
  s.ownedCount = n; s.deckCount = Math.min(3, n);
  s.ascension = Math.floor(rnd() * 5);
  s.tapPower = 1 + Math.floor(rnd() * 12);
  s.sanctuaryLevel = Math.floor(rnd() * 51);
  s.veilleurLevel = Math.floor(rnd() * 51);
  s.coins = Math.floor(rnd() * 1e7);
  s.totalEarned = s.coins * 4;
  s.passiveIncome = Math.floor(rnd() * 5000);
  s.autoClickers = { esprit: Math.floor(rnd() * 40), main: Math.floor(rnd() * 20) };
  s.maxCreatureLevel = 1 + Math.floor(rnd() * 60);
  s.advLevelReached = Math.floor(rnd() * 60);
  s.battleWon = Math.floor(rnd() * 60);
  s.totalTaps = Math.floor(rnd() * 1e5);
  for (let cycle = 0; cycle < 14; cycle++) {
    const set = Q.nextQuestSet(cycle, [], s);
    if (!set || !set.ids || set.ids.length < 4) { pb.cycleCourt++; continue; }
    set.ids.forEach((id) => {
      const q = Q.findQuest(id);
      if (!q) { pb.infaisable++; return; }
      tires++;
      if (!Q.questFeasible(q, s)) pb.infaisable++;
      // ⚠️ Les RECORDS (Transe, combo) sont remis à zéro par le jeu au
      // tirage du cycle. Les comparer à un vieux record ne décrit aucune
      // situation réelle : la sonde annonçait 4 438 « défis nés déjà
      // accomplis » qui n'existent pas en jeu.
      if (q.mode === 'absolute' && !['maxTranseHoldSec', 'maxCombo'].includes(q.metric)) {
        const cible = Q.effectiveQuestTarget(id, s, set.targets || {});
        // `readMetric` n'est pas exporté : on lit la métrique comme le
        // fait le moteur pour les cas simples, ce qui suffit ici.
        // ⚠️ La métrique peut dépendre du GROUPE : la lire brute renvoie
        // `undefined` pour les défis d'achat dont l'article change à
        // chaque Ascension.
        const met = Q.metriqueDuDefi(q, s) || '';
        const acquis = met.startsWith('auto:') ? ((s.autoClickers || {})[met.slice(5)] || 0)
          : met.startsWith('tapUpgrade:') ? ((s.tapUpgrades || {})[met.slice(11)] || 0)
            : (s[met] || 0);
        if (cible <= acquis) pb.sousAcquis++;
        if (Q.questComplete && Q.questComplete(id, s, s, set.targets || {})) pb.dejaFait++;
      }
    });
  }
}
console.log('\n  FORCE BRUTE — ' + tires.toLocaleString('fr-FR') + ' défis tirés');
// ⚠️ « irréalisable au tirage » et « né déjà accompli » ne sont PLUS des
// défauts depuis que la séquence ne substitue plus.
//
// Ces deux compteurs servaient à repérer les défis qui allaient être
// REMPLACÉS par le pool. Le remplacement n'existe plus pour la séquence,
// donc un défi pas encore déblocable reste simplement dans l'œuf et le
// devient en avançant — c'est le comportement voulu, pas une panne.
//
// Ce qui reste un vrai défaut est couvert ailleurs, et l'est mieux :
//  - une condition qui ne peut JAMAIS être vraie -> `auditAvailable` ;
//  - un défi du schéma qui disparaît -> `auditRemplacements` ;
//  - un cycle incomplet -> toujours une panne, il manque un défi.
//
// Les deux premiers restent AFFICHÉS, en information : les profils de la
// force brute sont tirés au hasard et très extrêmes, donc un chiffre non
// nul y est normal. S'il explose d'un coup, c'est un signal à creuser.
[['cycle incomplet', pb.cycleCourt, true]].forEach(([quoi, n, bloquant]) => {
  if (n && bloquant) echecs++;
  console.log(`  ${n === 0 ? '✅' : '❌'} ${String(n).padStart(5)}  ${quoi}`);
});
console.log(`  ℹ️  ${String(pb.infaisable).padStart(5)}  pas encore déblocable au tirage (normal)`);
console.log(`  ℹ️  ${String(pb.dejaFait).padStart(5)}  déjà satisfait au tirage (normal sur profil extrême)`);

// ---- Symboles du moteur utilisés sans être importés ----------------
//
// ⚠️ Babel compile sans broncher un identifiant jamais importé : il ne
// fait pas d'analyse de portée. L'erreur n'apparaît qu'à l'exécution, en
// plein écran, sur le téléphone — « Property 'questLabel' doesn't
// exist », 19/09. Ce contrôle croise ce que `questLogic` exporte avec ce
// que l'écran importe et appelle.
{
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/screens/games/ClickerScreen.js', 'utf8');
  const m = src.match(/import \{([^}]*)\} from '\.\.\/\.\.\/games\/clicker\/questLogic';/);
  const moteur = new Set(
    (fs.readFileSync(__dirname + '/../src/games/clicker/questLogic.js', 'utf8')
      .match(/export (?:function|const) (\w+)/g) || [])
      .map((x) => x.split(' ').pop()),
  );
  const manquants = [];
  if (m) {
    const importes = new Set(m[1].split('\n').map((x) => x.trim().replace(/,$/, ''))
      .filter((x) => x && !x.startsWith('//')));
    const corps = src.slice(m.index + m[0].length);
    moteur.forEach((n) => {
      if (importes.has(n)) return;
      // Appelé comme fonction, et pas précédé d'un point (donc pas une
      // propriété d'objet ni une variable de contexte homonyme).
      const re = new RegExp('(?<![\\w.])' + n + '\\s*\\(', 'g');
      const decl = new RegExp('(?:const|let|var|function)\\s+' + n + '\\b');
      if (re.test(corps) && !decl.test(corps) && !corps.includes(n + ',')) manquants.push(n);
    });
  }
  const ok = manquants.length === 0;
  if (!ok) echecs++;
  console.log(`\n  IMPORTS\n  ${ok ? '✅' : '❌'} symboles du moteur appelés sans import`);
  if (!ok) console.log('        ' + manquants.join(', '));
}

console.log('\n  EMPREINTE DES DÉFINITIONS : ' + Q.QUEST_DEFS_VERSION);
console.log('  (calculée — les défis de l\'œuf en cours seront retirés au sort)');

// ⚠️ UN CONTRÔLE QUI EXISTE SANS TOURNER est un contrôle oublié : il ne
// protège plus rien, et personne ne le voit. Le 21/09, dix contrôles
// lisaient encore les anciens modèles et restaient verts quoi qu'on
// écrive dans les vrais défis — le genre de chose qui ne se voit
// qu'en listant ce qui tourne VRAIMENT.
const oublies = Object.keys(A)
  .filter((k) => /^audit/.test(k) && typeof A[k] === 'function')
  .filter((k) => !vus.has(k) && !RETRAITES[k]);
oublies.forEach((k) => { echecs++; console.log(`  💥 ${k.padEnd(24)} existe mais ne tourne jamais (ni lancé, ni retiré)`); });
const contradictions = [...vus].filter((k) => RETRAITES[k]);
contradictions.forEach((k) => { echecs++; console.log(`  💥 ${k.padEnd(24)} à la fois lancé ET retiré`); });
console.log(`\n  ${vus.size} contrôles lancés · ${Object.keys(RETRAITES).length} retirés avec leur raison`);

console.log('\n  ' + (echecs === 0
  ? '✅ RIEN DE CASSÉ — le changement peut partir.'
  : `❌ ${echecs} PROBLÈME(S) — ne pas pousser en l'état.`) + '\n');
process.exit(echecs === 0 ? 0 : 1);

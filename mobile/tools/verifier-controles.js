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
  grimoire: path.join(RACINE, 'src/games/clicker/grimoireChapitres.js'),
  conseil: path.join(RACINE, 'src/games/clicker/conseilBoutique.js'),
  calcul: path.join(RACINE, 'src/games/clicker/calculDefis.js'),
  pub: path.join(RACINE, 'src/components/FaussePub.js'),
  sons: path.join(RACINE, 'src/screens/games/sonsBoutique.js'),
  grimoireEcran: path.join(RACINE, 'src/screens/games/GrimoireBoutique.js'),
  album: path.join(RACINE, 'src/games/clicker/albumPages.js'),
  cadrage: path.join(RACINE, 'src/games/clicker/cadrageCreatures.js'),
  index: path.join(RACINE, 'index.js'),
  diag: path.join(RACINE, 'src/games/clicker/diagnostic.js'),
  doc: path.join(RACINE, 'DEFIS_PARADOX.md'),
  combat: path.join(RACINE, 'src/games/clicker/combatLogic.js'),
  combatEcran: path.join(RACINE, 'src/screens/games/CombatScreen.js'),
  daily: path.join(RACINE, 'src/games/clicker/dailyLogic.js'),
  contexte: path.join(RACINE, 'src/context/DailyContext.js'),
  aventure: path.join(RACINE, 'src/screens/games/AdventureScreen.js'),
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
  // 17/10 : les cibles écrites ne sont plus celles du joueur (calculateur) — les sabotages visent le NOUVEAU garant.
  ['auditPlafondAchats', F.calcul, "la bascule coupée : un joueur qui a sur-investi un objet reçoit un défi au-dessus de son budget (règle de l'auteur, 17/10)",
    remplace('    if (coutUnNiveau(m, e, asc) <= budget) return null;', '    if (coutUnNiveau(m, e, asc) <= budget || true) return null;')],
  ['auditCoutCroissant', F.calcul, 'des défis d achat dérisoires : le calculateur ne demande plus que le quart de ce que le budget paie',
    remplace('  return Math.max(1, n);\n}', '  return Math.max(1, Math.floor(n / 4));\n}')],
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
  ['auditFaisableAuMoment', F.calcul, "l'arrondi des défis de revenu/s remis à 2 chiffres (bug réel du 17/10 : 161 min au lieu de 12,5 à l'A4)",
    remplace('      cible = arrondiGain(Math.max(actuel + 1, passifAtteint(etatDe(s), asc, budget)), actuel);', '      cible = joliHaut(Math.max(actuel + 1, passifAtteint(etatDe(s), asc, budget)));')],
  ['auditCoteEtalon', F.calcul, "« Mets N de côté » calculé sur 4 fois le temps visé (même défaut que le bug réel du 24/09 : 7 fois l'étalon)",
    remplace("    else if (m === 'coins' && q.mode === 'absolute') cible = joliHaut((s.coins || 0) + prod * tau);", "    else if (m === 'coins' && q.mode === 'absolute') cible = joliHaut((s.coins || 0) + prod * tau * 4);")],
  ['auditPrixParAscension', F.clicker, "le prix « avant l'heure » ramené à 0,6 % du seuil : le joueur achète les objets des Ascensions suivantes (décision 2.2 de l'auteur)",
    remplace('export const AVANT_LHEURE_SUIVANTE = 0.6;', 'export const AVANT_LHEURE_SUIVANTE = 0.006;')],
  ['auditEclosionFraiche', F.ecran, "« Mettre en incubation » ne vide plus le nid (le bug réel : Gardien direct à l'œuf suivant)",
    remplace('    mainEggRef.current = null;\n    setMainEgg(null);\n    setIncubatingEgg(avecPhotoGardien(', '    setIncubatingEgg(avecPhotoGardien(')],
  ['auditEclosionFraiche', F.ecran, "le passage en éclosion réutilise l'ancien minuteur",
    remplace('setMainEgg(() => avecPhotoGardien(startIncubation(', 'setMainEgg((prev) => prev || avecPhotoGardien(startIncubation(')],
  ['auditLegendaires', F.ecran, "les niveaux légendaires remis à zéro par l'Ascension (décision de l'auteur : permanents)",
    remplace('            setLegendairesAsc({}); // 17/10', '            setLegendaires({}); setLegendairesAsc({}); // 17/10')],
  ['auditLegendaires', F.calcul, "le critique légendaire oublié par le calculateur de défis (l'auteur : sinon les défis deviennent trop faciles)",
    remplace('    legendaires: s.legendaires || {}, // 17/10', '    legendaires: {}, // 17/10')],
  ['auditStructureOeufs', F.defis, "la structure déclarée ne correspond plus aux œufs (A0 à 7 œufs, A5 à 6) : l'index d'un œuf changerait de groupe",
    remplace('export const OEUFS_PAR_GROUPE = [6, 6, 7, 7, 7, 7];', 'export const OEUFS_PAR_GROUPE = [7, 6, 7, 7, 7, 6];')],
  ['auditGardienCalibre', F.combat, "le Gardien visé à 90 % de victoires au lieu d'1 sur 3 : le calibrage le suit, le contrôle doit le voir",
    remplace('export const GUARDIAN_WIN_TARGET = 1 / 5;', 'export const GUARDIAN_WIN_TARGET = 0.9;')],
  ['auditGardienEmpreinte', F.combatEcran, "une règle du combat changée dans l'écran (K.O. comptés autrement) sans revérifier la simulation du Gardien",
    remplace('const tombes = newFighters.filter((f, i) => f.hp <= 0 && avant[i].hp > 0).length;', 'const tombes = newFighters.filter((f) => f.hp <= 0).length;')],
  ['auditRechargeDeck', F.clicker, "une créature placée dans le deck repart PRÊTE (le bug signalé par l'auteur le 24/09)",
    remplace('if (c) r[id] = Math.max(r[id] || 0, now + rechargePouvoirMs(c));', 'if (c) r[id] = Math.max(r[id] || 0, now);')],
  ['auditRechargeDeck', F.ecran, "la règle existe mais l'écran ne l'applique plus au deck",
    remplace('const r = rechargesApresChangementDeck(rechargesRef.current, avant, deck, Date.now());', 'const r = rechargesRef.current;')],
  ['auditGriffesBonus', F.daily, "les succès remis à 150 / 400 / 1 000… (les 8 000 Griffes de l'A0 signalées par l'auteur)",
    remplace('export const ACHIEVEMENT_TIER_REWARDS = [15, 40, 100, 250, 600];', 'export const ACHIEVEMENT_TIER_REWARDS = [150, 400, 1000, 2500, 6000];')],
  ['auditManaAdverse', F.combat, "la mana adverse n'est plus gardée (le bug trouvé le 24/09)",
    remplace('return { competence, degats, mana: Math.max(0, mana - (competence.manaCost || 0)) };', 'return { competence, degats, mana: Math.max(0, (adv.mana || 0) - (competence.manaCost || 0)) };')],
  ['auditSortsMoteur', F.combat, "toutes les créatures venimeuses : l'ennemi ne frappe plus personne (le bug redouté par l'auteur)",
    remplace('  return depart;\n}\n// Qui le joueur peut frapper', '  return -1;\n}\n// Qui le joueur peut frapper')],
  ['auditSortsMoteur', F.combat, 'le bouclier divisé par 10 (un chiffre validé qui dérive)',
    remplace('bouclierPartPerdue: 0.45,', 'bouclierPartPerdue: 0.045,')],
  ['auditSortsDonnees', F.clicker, "une créature reçoit un sort d'un autre type (Soin pour un Attaquant)",
    remplace("pyrosile: 'zone',", "pyrosile: 'soin',")],
  ['auditSortsAdverses', F.combat, "un ennemi se soigne même à PV pleins (décision gâchée)",
    remplace("      return blesse >= 0 && pc(adversaires[blesse]) < 0.5 ? id : null;", "      return id;")],
  // 10/10 (niveaux réels) : l'ancienne table AVENTURE_MULTIPLICATEURS n'existe plus — même sabotage sur la
  // table qui la remplace : tous les ennemis deviennent un Pyrosile (l'Aventure trop facile revient).
  // 11/10 (soir) : avec le combat à égalité, « tous les ennemis = Pyrosile » faisait des 1 contre 1 face à des niveaux calibrés,
  // toujours durs (AVEUGLE) → le vrai « trop facile » : tous les ennemis 8 niveaux plus bas.
  // 11/10 (fin) : avec les fenêtres, le jeu lit la PHOTO (plus la table) → le « trop facile » se fait dans la photo.
  ['auditParcours', F.combat, "les photos mettent les ennemis 8 niveaux plus bas (l'Aventure trop facile revient)",
    remplace('    niveaux[n] = r.niveau;', '    niveaux[n] = Math.max(1, r.niveau - 8);')],
  ['auditParcours', F.combat, 'le filet de sécurité débranché (des joueurs gratuits restent bloqués)',
    remplace('  return f ? f.baisse : 0;\n}\n\nexport function multiplicateurFureur', '  return 0;\n}\n\nexport function multiplicateurFureur')],
  ['auditParcours', F.clicker, "la garantie force une Rare même quand le joueur en a déjà une",
    remplace('  return deja < g.nombre ? g.rarete : null;', '  return g.rarete;')],
  ['auditElixir', F.combatEcran, "l'écran de combat n'applique plus l'Élixir (acheté pour rien)",
    remplace('const stats = elixirActif ? appliquerElixir(stats0) : stats0;', 'const stats = stats0;')],
  ['auditElixir', F.ecran, "l'Élixir n'est plus sauvegardé (perdu à la réouverture)",
    remplace('    elixirCombats: elixirCombatsRef.current,\n', '')],
  ['auditElixir', F.aventure, "le sous-composant qui lance les combats ne reçoit plus l'Élixir (plantage à l'exécution)",
    remplace('onOpenCreature, elixirCombats = 0, onElixirUsed, onBuyElixir, defaitesDeSuite = {}, onDefaite }) {', 'onOpenCreature, onBuyElixir, defaitesDeSuite = {}, onDefaite }) {')],
  ['auditPuissanceConseillee', F.combat, 'la puissance conseillée ne dépend plus du niveau',
    remplace('const niv = Math.max(1, Math.floor(n || 1));', 'const niv = 1;')],
  ['auditDefaite', F.combat, "« Tu y étais presque ! » inventé (affiché même à 50 % des PV ennemis)",
    remplace('return max > 0 && reste > 0 && reste / max <= SEUIL_PRESQUE;', 'return max > 0 && reste > 0;')],
  ['auditDefaite', F.aventure, "l'Élixir de l'écran de défaite débranché du sous-composant (plantage)",
    remplace('onOpenCreature, elixirCombats = 0, onElixirUsed, onBuyElixir, defaitesDeSuite = {}, onDefaite }) {', 'onOpenCreature, elixirCombats = 0, onElixirUsed, defaitesDeSuite = {}, onDefaite }) {')],
  ['auditDefaite', F.aventure, "l'achat de Griffes aux diamants ne se ressent plus (point 5)",
    // 06/10 : recalé sur le NOUVEL achat (la boîte de dialogue des Griffes a été remplacée par une page).
    remplace('    annoncerGriffes(GRIFFES_PACK);\n    return true;', '    return true;')],
  ['auditPacks', F.ecran, "le compteur de packs n'est plus remis à zéro à l'Ascension (packs hors de prix pour toujours)",
    remplace('            setGriffesCoinBuys(0);\n', '')],
  ['auditPacks', F.clicker, 'la taille du pack ne grandit plus avec l\'Ascension',
    remplace("  for (let k = 0; k < PACK_PIECES_NIVEAUX; k++) t += levelUpCost({ rarity: 'commun' }, moy + k);", '  t = 126;')], // 16/10 : pack = 2 niveaux
  ['auditPacks', F.clicker, "le plancher de 100 Griffes retiré (demande de l'auteur : « remets 100 Griffes »)",
    remplace('  return Math.max(PACK_PIECES_PLANCHER, Math.round(t));', '  return Math.max(1, Math.round(t));')],
  ['auditPacks', F.clicker, 'les packs redeviennent quasi gratuits (le « 90 packs à l\'A3 » revient)',
    remplace('export const GRIFFES_PACK_FRACTIONS = [0.05, 0.10, 0.20, 0.40, 3.0];', 'export const GRIFFES_PACK_FRACTIONS = [0.001, 0.001, 0.001, 0.001, 0.001];')],
  ['auditDefisAventure', F.defis, "la cible doublée de l'A1 œuf 5 revient (chapitre 12 au lieu de 6)",
    remplace("id: 'a1e5_plusC', icon: '⚔️', metric: 'advLevelReached',\n      target: 51,", "id: 'a1e5_plusC', icon: '⚔️', metric: 'advLevelReached',\n      target: 120,")],
  ['auditValidation', F.ecran, "le défi passe tout seul au suivant (plus de validation)",
    remplace('const currentChallengeId = activeQuestIds.find((id) => !isQuestValidated(id)) || null;', 'const currentChallengeId = activeQuestIds.find((id) => !isQuestDone(id)) || null;')],
  ['auditValidation', F.ecran, "les défis validés ne sont plus remis à zéro au nouvel œuf (le suivant serait sauté)",
    remplace('    setValidatedQuestIds([]);\n    AsyncStorage.removeItem(VALIDATED_QUESTS_KEY)', '    AsyncStorage.removeItem(VALIDATED_QUESTS_KEY)')],
  ['auditValidation', F.ecran, "le bouton Valider redevient de taille zéro (le bug du 26/09 : panneau vert qui ne réagit pas)",
    remplace('<TouchableOpacity style={[styles.challengeCard, styles.challengeCardCliquable]} activeOpacity={0.85}', '<TouchableOpacity activeOpacity={0.85}')],
  ['auditQuetesNiveau', F.contexte, "une quête hebdomadaire verse de nouveau sa valeur écrite brute",
    remplace("const griffes = recompenseDefi(def.reward, 'semaine', niveauxDeckRef.current);", 'const griffes = def.reward;')],
  // 16/10 : défis en niveaux de la meilleure créature (choix de l'auteur).
  ['auditQuetesNiveau', path.join(RACINE, 'src/games/clicker/dailyLogic.js'), "un défi de la semaine médian repaie 9 niveaux (« 10 Offrandes » à ~3 800)",
    remplace('export const NIVEAUX_DEFI_SEMAINE = 3;', 'export const NIVEAUX_DEFI_SEMAINE = 9;')],
  ['auditQuetesNiveau', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le Clicker n'envoie plus le deck au contexte des défis",
    remplace('  useEffect(() => { noterNiveauxDeck(niveauxDuDeck(owned, deck)); }, [owned, deck, noterNiveauxDeck]);', '')],
  ['auditQuetesNiveau', path.join(RACINE, 'src/screens/ProgresScreen.js'), "l'écran Progrès affiche une récompense hors règle",
    remplace("recompenseDefi(def.reward, 'semaine', niveauxDeck)", "recompenseDefi(def.reward, 'semaine', [])")],
  ['auditApprentissage', F.combat, "l'étape 3 confiée à une mythique (Arcanis) : les débutants perdent dès le début",
    // Par MOTIF : la 3e entrée de la table des ennemis, QUELLE QU'ELLE SOIT (10/10 : la table remplace
    // l'ancien multiplicateur, ce sabotage-là visait sa 3e valeur ×5).
    (src) => src.replace(/(export const ENNEMIS_ETAPES = \[\n\s*'[^']*', '[^']*', )'[^']*',/, (m, debut) => debut + "'arcanis',")],
  // (11/10 soir) l'ancien sabotage « ×0,65 » visait FORCE_ENNEMI, qui ne sert plus (niveaux calibrés NIVEAUX_ETAPES) :
  // remplacé par « chapitre 1 de nouveau adouci (ennemis bloqués au niveau 1) » plus bas.
  ['auditFilet', F.combat, "le filet redevient lent (aide après 5 défaites au lieu de 3)",
    remplace("  { defaites: 3, baisse: 0.20 },", "  { defaites: 5, baisse: 0.20 },")],
  ['auditVerrouAventure', F.aventure, "le lancement du combat ne vérifie plus le verrou (on joue le niveau 26 en Ascension 0)",
    remplace("            if (levelPreview > niveauMaxAscension) { setLevelPreview(null); montrerVerrouAscension(); return; }\n", "")],
  // 18/10 : sabotage « garde-fou 3 étoiles retiré » RETIRÉ — plus de verrou d'Aventure (décision de l'auteur), le garde-fou
  // ne se déclenche plus jamais : l'enlever ne change rien, aucun contrôle ne peut (ni ne doit) le voir. À sa place :
  ['auditVerrouAventure', F.logique, "un verrou d'Aventure revient (le « +5 niveaux » le dépasserait : œuf bloqué)",
    remplace("export function niveauMaxAventure(ascensionCount) { // eslint-disable-line no-unused-vars\n  return Infinity;", "export function niveauMaxAventure(ascensionCount) { // eslint-disable-line no-unused-vars\n  return 25 + 40 * (ascensionCount || 0);")],
  ['auditBoutonAscension', F.ecran, "l'Ascension de nouveau achetable n'importe quand (œufs perdus)",
    remplace("  const ascensionReady = seuilAscensionAtteint && defiAscensionEnCours;", "  const ascensionReady = seuilAscensionAtteint;")],
  ['auditBoutonAscension', F.ecran, "l'Ascension achetable sur un défi DÉJÀ réussi (un groupe entier sauté)",
    remplace("  const defiAscensionEnCours = !!currentChallengeId && !currentChallengeReussi\n", "  const defiAscensionEnCours = !!currentChallengeId\n")],
  ['auditPuissanceExacte', F.combat, "l'ancienne formule revient (« 57 contre 58 » pour 0 % de victoires)",
    remplace("  const puissance = chiffreExact(puissanceConseillee(niveau), r.facteur);", "  const puissance = puissanceDeck(membres);")],
  ['auditPuissanceExacte', F.aventure, "l'Élixir recompté dans la puissance de l'aperçu",
    remplace("        const r = puissanceAventure(membresPourCombat(deck, owned, ownedRunes, levelNumber), levelNumber, { filetBaisse });", "        const r = puissanceAventure(membresPourCombat(deck, owned, ownedRunes, levelNumber), levelNumber, { filetBaisse, elixirActif: true });")],
  ['auditDefaite', F.combatEcran, "l'écran de défaite dit « retente ta chance » à chaque défaite (diagnostic débranché)",
    remplace("        manque={outcome === 'lose' ? manqueExact : 0}\n", "        manque={outcome === 'lose' ? 0 : 0}\n")],
  ['auditDefaite', F.combat, "le diagnostic n'est plus minimal (un niveau de trop annoncé)",
    remplace("  return hi;\n}\n// « Ton deck » face au Gardien", "  return hi + 1;\n}\n// « Ton deck » face au Gardien")],
  ['auditZoneTapLibre', F.ecran, "le calque des « +X » repasse en PROPRIÉTÉ pointerEvents (ignorée sur téléphone : taps bloqués)",
    remplace("              <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>", "              <View pointerEvents=\"none\" style={StyleSheet.absoluteFill}>")],
  ['auditEcranFin', F.combatEcran, "confettis capteurs de toucher : les boutons de la victoire bloqués pendant leur chute",
    remplace("coucheConfettis: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 30, pointerEvents: 'none' },", "coucheConfettis: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 30 },")],
  ['auditEcranFin', F.combatEcran, "le pack de Griffes de la défaite débranché par la refonte",
    remplace('onPress: aide.onPackGriffes }', 'onPress: () => {} }')],
  ['auditGardienCalibre', F.combat, "Gardien recalibré sur la MEILLEURE façon de jouer : le joueur moins efficace retombe à ~60 %",
    remplace('    return a.facteurAttaque <= b.facteurAttaque ? a : b;', '    return a.facteurAttaque >= b.facteurAttaque ? a : b;')],
  ['auditGardien80', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le bouton du nid relance le combat SANS le menu « Gardien de l'œuf »",
    remplace("onPress={() => setConfirmGardien('main')}", "onPress={() => resolveHatch('main')}")],
  // 10/10 : plus de niveau max (décision de l'auteur) — le sabotage fait REVENIR le plafond, ou le coût par rareté.
  ['auditNiveauMax', F.combat, "l'ultime redevient abusé (×4 l'attaque normale)",
    remplace('export const ULTIME_MAX = 2;', 'export const ULTIME_MAX = 4;')],
  // 10/10 (soir) : niveau affiché = VRAIES stats — un multiplicateur caché qui revient doit être vu (l'ancien sabotage
  // visait le multiplicateur de force moyenne, désormais traduit en niveau).
  ['auditNiveauMax', F.combat, "un multiplicateur caché revient sur les ennemis (leur niveau affiché ment de nouveau)",
    remplace('    hp: Math.max(1, Math.round(s.hp * k * f)),\n    attack: Math.max(1, Math.round(s.attack * k * f)),', '    hp: Math.max(1, Math.round(s.hp * k * f * 1.2)),\n    attack: Math.max(1, Math.round(s.attack * k * f * 1.2)),')],
  ['auditNiveauMax', F.clicker, "le niveau maximum revient (le joueur est de nouveau bloqué en niveau)",
    remplace('export function niveauMaxCreature(niveauGagne) {\n  return Infinity;\n}', 'export function niveauMaxCreature(niveauGagne) {\n  return Math.max(0, Math.floor(Number(niveauGagne) || 0)) + 5;\n}')],
  ['auditNiveauMax', F.clicker, "le coût d'un niveau dépend de nouveau de la rareté (la prime ne paie plus le niveau d'une rare)",
    remplace('  return Math.max(1, Math.round(partCoutPrime(level) * primeDeVictoire(level) / taille));', '  return Math.max(1, Math.round(partCoutPrime(level) * primeDeVictoire(level) / taille * rarityFactor));')],
  ['auditSoutienEquipe', F.combat, "soutien à zéro : une créature seule redevient la meilleure stratégie",
    remplace('export const SOUTIEN_FRACTION = 0.5;', 'export const SOUTIEN_FRACTION = 0;')],
  ['auditJournalDev', F.combatEcran, "verdicts de jauge plus notés : impossible de mesurer la vraie précision",
    remplace('  const montrerVerdict = (v) => { noterVerdict(v);', '  const montrerVerdict = (v) => {')],
  ['auditGardienGriffes', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "chiffre du Gardien recalculé à chaque affichage : il bouge entre le menu et le résultat",
    remplace('  if (photo.gardien != null) return photo.gardien;\n', '')],
  ['auditGardienGriffes', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "budget du Gardien mis à zéro : il ne demanderait plus rien",
    remplace('budgetGardienRef.current = primesProchainsNiveaux(', 'budgetGardienRef.current = 0 * primesProchainsNiveaux(')],
  ['auditGardienGriffes', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "Gardien de l'œuf 2 de nouveau NON calé (0 % mesuré chez l'auteur)",
    remplace('  if (eggNumber < 2) return null;', '  if (eggNumber < 3) return null;')],
  // 11/10 (fin) : fenêtres de difficulté (système de l'auteur).
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "la photo oublie les Griffes récupérables (défis, succès, calendrier) et la file d'attente",
    remplace('const budget = k === 0 ? 0 : Math.max(0, griffes) + Math.max(0, griffesARecuperer || 0) + enAttente;', 'const budget = k === 0 ? 0 : Math.max(0, griffes);')],
  // 12/10 : indice de maîtrise (remplace la précision), recalcul sans écrasement, Gardien, zone morte.
  ['auditFenetres', F.combat, "la photo ignore l'indice de maîtrise (le bon joueur ne perd plus au 4e et 5e combat)",
    remplace('* fMaitrise * fElements / (n === 1 ? MARGE_PREMIER_COMBAT : 1)', '* fElements / (n === 1 ? MARGE_PREMIER_COMBAT : 1)')],
  ['auditFenetres', F.combat, "plus de plafond de maîtrise (un joueur exceptionnel serait bloqué)",
    remplace('export const MAITRISE_MAX = 1.4;', 'export const MAITRISE_MAX = 5;')],
  ['auditFenetres', F.combat, "plus de prudence statistique (3 victoires chanceuses = joueur exceptionnel)",
    remplace('export const MAITRISE_A_PRIORI = 0.7;', 'export const MAITRISE_A_PRIORI = 100;')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "recalcul avec écrasement (niveau 9 → 28 à l'arrivée d'une créature)",
    remplace('if (recalcul && ancien && ancien.niveaux && ancien.niveaux[depart] != null) nv[depart] = Math.min(nv[depart], ancien.niveaux[depart] + MONTEE_MAX_RECALCUL);', '')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le Gardien ignore l'indice de maîtrise",
    remplace('{ marge: facteurGardienMaitrise(photo.maitrise || 0, membres.length) }', '{ marge: 1 }')],
  // 12/10 : points 1 et 3 de l'auteur.
  ['auditFenetres', F.combat, "la photo ignore les éléments de l'équipe du joueur",
    remplace('* fMaitrise * fElements / (n === 1 ? MARGE_PREMIER_COMBAT : 1)', '* fMaitrise / (n === 1 ? MARGE_PREMIER_COMBAT : 1)')],
  ['auditFenetres', F.combat, "le facteur d'éléments est coupé (exposant 0)",
    remplace('export const EXPOSANT_ELEMENTS = 0.5;', 'export const EXPOSANT_ELEMENTS = 0;')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "la 1re fenêtre compte de nouveau une dépense virtuelle (le débutant ne sait pas encore dépenser)",
    remplace('const budget = k === 0 ? 0 : Math.max(0, griffes) + Math.max(0, griffesARecuperer || 0) + enAttente;', 'const budget = Math.max(0, griffes) + Math.max(0, griffesARecuperer || 0) + enAttente;')],
  // 12/10 : ennemi d'entraînement (choix de l'auteur).
  ['auditFenetres', F.combat, "l'affaiblissement de l'entraînement n'est plus appliqué aux stats (1er combat perdu selon la créature de départ)",
    remplace('  const f = m ? affaiblissementEtape(levelNumber) : 1;', '  const f = 1;')],
  ['auditFenetres', F.combat, "le Gardien est adouci par un ennemi d'entraînement",
    remplace('  const f = m ? affaiblissementEtape(levelNumber) : 1;', '  const f = affaiblissementEtape(levelNumber);')],
  ['auditFenetres', F.combat, "marge du 1er combat dans le MAUVAIS sens (erreur réellement commise le 12/10 : Luxorbe 34 %)",
    remplace('/ (n === 1 ? MARGE_PREMIER_COMBAT : 1)', '* (n === 1 ? MARGE_PREMIER_COMBAT : 1)')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "l'aperçu n'affiche plus « entraînement »",
    remplace("(estEntrainement(levelNumber) ? ' · entraînement' : '')", "''")],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "l'écran ne transmet plus les ennemis d'entraînement",
    remplace('definirNiveauxJoueur(niv, dif, aff);', 'definirNiveauxJoueur(niv, dif);')],
  // 13/10 : Gardien à 90 % quand bloqué au niveau max (règle de l'auteur) ; facteurs « 1 contre 1 ».
  ['auditFenetres', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le Gardien n'applique plus la règle « bloqué au max → 90 % »",
    remplace('if (bloqueAuMaxDuNombre(actuels)) return', 'if (false) return')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le Gardien « bloqué au max » redescend à 80 %",
    remplace('const CIBLE_GARDIEN_BLOQUE = 0.1;', 'const CIBLE_GARDIEN_BLOQUE = 0.2;')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le cache du Gardien ignore l'état « bloqué au max » (ancienne chance affichée)",
    remplace("(bloqueAuMaxDuNombre(membresDuDeck(deckIds, ownedList)) ? 'bloque-max:'", "(false ? 'bloque-max:'")],
  ['auditFenetres', F.combat, "les facteurs d'étape « 1 contre 1 » sont ignorés (créature seule écrasée)",
    remplace('(nbJc === 1 && compo.length === 1 && FACTEUR_ETAPE_1V1[nEt]) || ', '')],
  // 13/10 : soin visible, guide des spécialités.
  ['auditFenetres', F.combat, "le soin perd son minimum (« on ne voit pas l'ajout d'HP »)",
    remplace('Math.max(E.soinMinimum * pvMax(A[t]), E.soinPartPerdue * perdus)', 'E.soinPartPerdue * perdus')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "le soin à PV pleins n'affiche plus rien",
    remplace("texte: (v) => (v ? `+${v} PV` : 'PV pleins')", "texte: (v) => (v ? `+${v}` : null)")],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "le guide affiche de nouveau un chiffre RECOPIÉ faux (+30 %)",
    remplace('Ton élément bat le sien : <Text style={styles.elemHelpStrong}>+{pctGuide(ELEMENT_ADVANTAGE_MULT - 1)}</Text>', 'Ton élément bat le sien : <Text style={styles.elemHelpStrong}>+30 %</Text>')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "un sort manque dans le guide des spécialités",
    remplace("sorts: ['soin', 'boost', 'vitesse', 'marque'] }", "sorts: ['soin', 'boost', 'vitesse'] }")],
  // 14/10 : évolutions dans la dépense virtuelle (demande de l'auteur).
  ['auditFenetres', F.combat, "la photo du calculateur ignore les évolutions",
    remplace('const apres = deckApresEffortEquitable(membres, budget, Infinity, { evolutions: true });', 'const apres = deckApresEffortEquitable(membres, budget);')],
  ['auditFenetres', F.combat, "la dépense virtuelle ne fait jamais évoluer",
    remplace('    if (ev >= 0) { m[ev] = { ...m[ev], evolutionTier:', '    if (false) { m[ev] = { ...m[ev], evolutionTier:')],
  ['auditFenetres', F.combat, "la dépense virtuelle pousse une créature déjà évoluée (une seule évolution au lieu de deux)",
    remplace(' || x.ownedLevel >= seuil(x) || seuil(x) > maxEquipe) return;', ' || x.ownedLevel >= seuil(x)) return;')],
  // 14/10 : descriptions des attaques (source unique).
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "la fiche créature réaffiche le chiffre BRUT (« 3 dégâts »)",
    remplace('valeur={descriptionAttaque(k, creature, stats.attack)}', 'valeur={`${k.damage} dégâts`}')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le Clicker réaffiche « dégâts · END »",
    remplace('{descriptionAttaque(skill, creature, combatStats.attack)}', '{skill.damage} dégâts · {skill.enduranceCost} END')],
  ['auditFenetres', F.combat, "un texte de sort RECOPIE un chiffre (faux) au lieu de le lire dans les règles",
    remplace("`+${pctTexte(E.boostBonus)} sur ses ${E.boostAttaques} prochaines attaques.`", "`+50 % sur ses ${E.boostAttaques} prochaines attaques.`")],
  // 14/10 : choix de l'allié pour Bouclier / Soin / Boost (demande de l'auteur).
  ['auditFenetres', F.combat, "le moteur ignore l'allié CHOISI (retour au choix automatique)",
    remplace('  const choisi = Number.isInteger(cibleAllie) && A[cibleAllie] && vivant(A[cibleAllie]) ? cibleAllie : null;', '  const choisi = null;')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "l'écran ne transmet plus l'allié choisi au moteur",
    remplace('multiplicateurSort(verdictCoup), estSurAllie(skill) ? allyTargetRef.current : null)', 'multiplicateurSort(verdictCoup))')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "les alliés ne sont plus touchables pour un sort d'allié",
    remplace("onPress: estSurAllie(armedSkill) && phase === 'choosing' && pvAffiche('p', fi, f.hp) > 0 ? () => chooseAlly(fi) : null", 'onPress: null')],
  // 14/10 : chance en mots, lueurs (demandes de l'auteur).
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "l'aperçu n'affiche plus la difficulté en mots",
    remplace('const libelle = mesure ? libelleChance(mesure.victoires) : null;', 'const libelle = null;')],
  ['auditFenetres', F.combat, "les libellés de difficulté ne sont plus calés sur les crans",
    remplace("[[0.8, 'Facile', '#3DDC84'], [0.6, 'Moyen'", "[[0.5, 'Facile', '#3DDC84'], [0.6, 'Moyen'")],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "plus de lueur derrière la créature qui joue / la cible",
    remplace('{ring && !fainted && (', '{false && (')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "ta créature reste éclairée pendant la riposte de l'adversaire",
    remplace('        setActeurAdverse(retaliatorIdx); // 14/10', '        // 14/10')],
  // 15/10 : pas de lueur sur les ennemis ; cadre lumineux sur la case de ta créature (demandes de l'auteur).
  ['auditFenetres', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "une lueur revient sur un ennemi",
    remplace('ring: null, // 15/10 : pas de lueur sur les ennemis', "ring: 'target', // lueur ennemie")],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "le cadre lumineux de la case disparaît",
    remplace("borderColor: actif ? '#ffd96a' : '#7cff8a'", "borderColor: 'transparent'")],
  // 15/10 : « 🎁 Tout récupérer » (choix de l'auteur).
  ['auditToutRecuperer', path.join(RACINE, 'src/games/clicker/dailyLogic.js'), "un seul palier de succès payé au lieu de tous",
    remplace('    while (palier < ACHIEVEMENT_MAX_TIER) {\n      const cible = achievementTarget(d, palier);\n      if (cible == null || (stats[d.stat] || 0) < cible) break;\n      const g = Number(achievementReward(palier))', '    while (palier < Math.min(ACHIEVEMENT_MAX_TIER, depart + 1)) {\n      const cible = achievementTarget(d, palier);\n      if (cible == null || (stats[d.stat] || 0) < cible) break;\n      const g = Number(achievementReward(palier))')],
  ['auditToutRecuperer', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "la carte ne crédite plus tout de suite les Griffes récupérées",
    remplace('      if (onEncaisserGriffes) await onEncaisserGriffes();', '')],
  ['auditToutRecuperer', path.join(RACINE, 'src/screens/ProgresScreen.js'), "le bouton « Tout récupérer » de l'écran Progrès est débranché",
    remplace('onPress={toutRecuperer}', 'onPress={() => {}}')],
  // 16/10 : « on ne voit plus les HP des ennemis » — le commentaire avaleur.
  ['auditPortee', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "un commentaire « // » au milieu d'une ligne avale la suite (le bug du 16/10)",
    remplace("nom: d.name, niveau: o.niveau, elite: bonusElite(levelNumber) > 0,", "nom: d.name, niveau: o.niveau, // lueur elite: bonusElite(levelNumber) > 0,")],
  ['auditPanneauxCombat', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "la case des ennemis perd ses PV (le bug du 16/10)",
    remplace("nom: d.name, niveau: o.niveau, elite: bonusElite(levelNumber) > 0,", "nom: d.name, niveau: o.niveau, // lueur elite: bonusElite(levelNumber) > 0,")],
  ['auditPanneauxCombat', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "la case des ennemis n'a plus ses PV max",
    remplace("hp: pvAffiche('o', i, o.hp), hpMax: o.stats.hp, mana: null, ko,", "hp: pvAffiche('o', i, o.hp), mana: null, ko,")],
  // 16/10 : rune visible ; plafond de maîtrise à la nouvelle mesure de l'auteur.
  ['auditRuneResilienceVisible', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "la rune ne se brise plus à la riposte",
    remplace("          newFighters.forEach((f, i) => { if (f && f.resilienceUsed && !resAvantP[i]) effetSort('resilience', 'joueur', i); }); // 16/10 : la rune se brise\n", '')],
  ['auditRuneResilienceVisible', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "l'effet « Rune brisée ! » disparaît",
    remplace("{v.forme === 'rune' && [0, 1].map((k) => (", "{false && [0, 1].map((k) => (")],
  ['auditFenetres', F.combat, "le plafond de maîtrise retombe à 0,75 (l'auteur redevient « trop facile »)",
    remplace('export const MAITRISE_MAX = 1.4;', 'export const MAITRISE_MAX = 0.75;')],
  // 16/10 : ultime du joueur à ×1,5 (choix de l'auteur).
  ['auditUltimeJoueur', F.combat, "l'ultime du joueur revient à ×2",
    remplace('export const MULT_ULTIME_JOUEUR = 0.75;', 'export const MULT_ULTIME_JOUEUR = 1;')],
  ['auditFenetres', F.combat, "les descriptions repassent sur l'ancienne formule (ultime ×2)",
    remplace("const d = Math.max(1, Math.round(degatsBrutsJoueur(k, creature, attaque))); // 16/10 : ultime à ×1,5 compris", 'const d = Math.max(1, Math.round(scaledSkillDamage(k, creature, attaque)));')],
  ['auditUltimeJoueur', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "l'aperçu « jusqu'à X dégâts » du combat repasse sur l'ancienne formule",
    remplace('degatsBrutsJoueur(skill, activeFighter.creature, activeFighter.stats.attack)', 'scaledSkillDamage(skill, activeFighter.creature, activeFighter.stats.attack)')],
  // 16/10 : pack en pièces = 2 niveaux de la créature moyenne ; commentaire avaleur dans les outils.
  ['auditPacks', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "l'achat au Clicker ne lit plus le deck",
    remplace('const taille = taillePackGriffes(niveauxDuDeck(ownedRef.current, deckRef.current));', 'const taille = taillePackGriffes([]);')],
  ['auditPacks', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "l'achat en Aventure ne lit plus le deck",
    remplace('const taille = taillePackGriffes(niveauxDuDeck(owned, deck));', 'const taille = taillePackGriffes([]);')],
  ['auditPortee', path.join(RACINE, 'tools/calculateur-griffes.js'), "un commentaire avale la fin d'une ligne dans un OUTIL (le bug du 16/10)",
    remplace('* F.shop; cumul.shop += p; griffes += p; }', '* F.shop; // pack cumul.shop += p; griffes += p; }')],
  // 16/10 : prime de victoire = prochain niveau de la meilleure créature (règle de l'auteur).
  ['auditPrimeVictoire', F.combat, "une victoire paie 2 niveaux au lieu d'un",
    remplace('export const PRIME_NIVEAUX_VICTOIRE = 1;', 'export const PRIME_NIVEAUX_VICTOIRE = 2;')],
  ['auditPrimeVictoire', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "le paiement revient à l'ancienne prime",
    remplace('const rawReward = primeVictoire(activeBattle.levelNumber, niveauxDuDeck(owned, deck));', 'const rawReward = griffesReward(activeBattle.levelNumber);')],
  ['auditPrimeVictoire', path.join(RACINE, 'tools/simulateur-parcours.js'), "le joueur simulé reçoit un pack hors règle (le bug du 16/10)",
    remplace('taillePack: (niveaux) => L.taillePackGriffes(niveaux),', 'taillePack: (niveaux) => L.taillePackGriffes([]),')],
  ['auditPrimeVictoire', F.combat, "la photo n'ajoute plus la vraie prime",
    remplace('budget += primeVictoire(n, apres.membres.map((m) => m.ownedLevel));', 'budget += griffesReward(n);')],
  ['auditPortee', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "une valeur lue AVANT sa déclaration (zone morte : écran blanc ou valeur vide)",
    remplace('  }, [(lifetimeStats || {}).advLevelReached || 0]); // ⚠️ jamais `owned` ici', '  }, [(lifetimeStats || {}).advLevelReached || 0, owned.length]); // ⚠️ jamais `owned` ici')],
  ['auditFenetres', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "plus de recalcul quand une créature rejoint le deck en cours de fenêtre",
    remplace('const recalcul = !!photo && membres.length > nbPhoto;', 'const recalcul = false;')],
  ['auditFenetres', F.combat, "le cran 5 n'est plus très dur (réglage cassé)",
    remplace('export const CORRECTION_DIFFICULTE = { 1: 1, 2: 0.982, 3: 1.022, 4: 1.014, 5: 1 };', 'export const CORRECTION_DIFFICULTE = { 1: 1, 2: 0.982, 3: 1.022, 4: 1.014, 5: 1.45 };')],
  ['auditFenetres', F.combat, "le jeu ignore la photo du joueur (les ennemis reviennent à la table)",
    remplace('  if (niveauxJoueur && niveauxJoueur[n] != null) return niveauxJoueur[n];', '')],
  ['auditFenetres', path.join(RACINE, 'tools/simulateur-parcours.js'), "les photos du joueur simulé fuient vers les autres mesures",
    remplace('    try { return jouerEtape(l, k, s); } finally { K.definirNiveauxJoueur(null); } // jamais de fuite vers les autres mesures', '    return jouerEtape(l, k, s);')],
  // 11/10 : le plantage « Property 'poudre' doesn't exist » revient (valeur lue hors de sa portée).
  ['auditPortee', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "la carte lit de nouveau une valeur que le parent ne lui transmet pas",
    remplace('function ChapterMapScreen({ onEncaisserGriffes = null, poudre = 0, ascensionCount = 0, currentUnlockedLevel,', 'function ChapterMapScreen({ currentUnlockedLevel,')],
  // 11/10 : journal des Griffes et rapport enrichi (tableau Excel de l'auteur).
  ['auditJournalDev', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "la prime d'étape n'est plus notée dans le journal des Griffes",
    remplace("noterGriffes('prime', reward, { etape: levelNumber });", "void 0;")],
  ['auditJournalDev', path.join(RACINE, 'src/screens/OptionsScreen.js'), "l'export oublie le journal des Griffes",
    remplace("gardiens, combats, economie };", "gardiens, combats };")],
  // 11/10 (soir) : combat à égalité, niveaux 1-40 calibrés, Griffes en baisse (décisions de l'auteur).
  ['auditNiveauMax', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "toutes les créatures du deck combattent de nouveau (combat plus à égalité)",
    remplace('    .slice(0, levelNumber ? combattantsPourEtape(levelNumber) : 3)', '    .slice(0, 3)')],
  ['auditNiveauMax', path.join(RACINE, 'tools/simulateur-parcours.js'), "le joueur simulé ne combat plus à égalité",
    remplace('j.joueurs().slice(0, K.combattantsPourEtape(l))', 'j.joueurs()')],
  ['auditNiveauMax', F.combat, "les ennemis baissent de niveau après un boss",
    remplace('export const NIVEAUX_ETAPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 21,', 'export const NIVEAUX_ETAPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 12,')],
  ['auditNiveauMax', path.join(RACINE, 'src/games/clicker/dailyLogic.js'), "les succès rebaissés (le malentendu du 11/10 revient)",
    remplace('export const ACHIEVEMENT_TIER_REWARDS = [15, 40, 100, 250, 600];', 'export const ACHIEVEMENT_TIER_REWARDS = [4, 10, 25, 60, 150];')],
  ['auditApprentissage', F.combat, "chapitre 1 de nouveau adouci (ennemis bloqués au niveau 1)",
    remplace('export const NIVEAUX_ETAPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 13,', 'export const NIVEAUX_ETAPES = [1, 1, 1, 1, 1, 1, 1, 1, 1, 3,')],
  // 11/10 (soir) : raretés, naissance, Butin, soutiens (règles de l'auteur).
  ['auditNiveauMax', F.combat, "les raretés redeviennent écrasantes (mythique ×12)",
    remplace("  return facteursRarete[rarete] || { pv: 1, degats: 1 };", "  return { pv: 1, degats: 1 };")],
  ['auditNiveauMax', F.combat, "les runes de Butin s'additionnent de nouveau",
    remplace("  const b = butins.reduce((m, r) => Math.max(m, runeBonuses([r]).butinPct), 0);", "  const b = runeBonuses(butins).butinPct;")],
  ['auditNiveauMax', F.combat, "la simulation fait de nouveau déborder les soutiens sur un autre ennemi",
    remplace("      const cS = A[cible] && A[cible].hp > 0 ? cible : -1;", "      const cS = A[cible] && A[cible].hp > 0 ? cible : premierVivant(A);")],
  ['auditNiveauMax', F.clicker, "les légendaires naissent de nouveau à 60 %",
    remplace("export const NAISSANCE_PART = { legendaire: 0.8, mythique: 0.8, autre: 0.8 };", "export const NAISSANCE_PART = { legendaire: 0.6, mythique: 0.45, autre: 0.8 };")],
  // 11/10 : niveau max selon le deck et créatures requises (règle de l'auteur).
  ['auditNiveauMax', F.clicker, "le niveau max selon le deck disparaît (une seule créature porte de nouveau tout)",
    remplace('  return n.length < 3 ? Math.min(10 * Math.max(1, n.length), palier) : palier;', '  return Infinity;')],
  ['auditNiveauMax', F.clicker, "un défi d'œuf peut demander un niveau impossible avec 1 créature (blocage pour toujours)",
    remplace('  return n < 3 ? 10 * n : Infinity;', '  return Infinity;')],
  ['auditVerrouAventure', path.join(RACINE, 'src/screens/games/AdventureScreen.js'), "l'étape 11 se lance avec une seule créature",
    remplace('            if ((owned || []).length < requis) {', '            if (false) {')],
  // 11/10 : l'action de l'ennemi (sort, ultime) se voit — sinon « il passe son tour » (retour de l'auteur).
  ['auditJournalDev', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "l'ultime de l'ennemi n'est plus annoncé (on croit qu'il passe son tour)",
    remplace("setSwitchMessage(`💥 ${ae.nom} lance son ULTIME : ${ae.competence.name} !`);", 'void 0;')],
  // 10/10 : la règle de l'auteur sur la jauge (fin des coups critiques) — retour du ×2,5, ou sort qui ignore le tap.
  ['auditJaugeFrappe', F.combat, "retour des coups critiques : parfait ×2,5 (même raté frappe à 100 %)",
    remplace('export const JAUGE_MULT = { parfait: 1.0, bien: 0.5, rate: 0.25, absent: 0.25 };', 'export const JAUGE_MULT = { parfait: 2.5, bien: 2.0, rate: 1.0, absent: 0.5 };')],
  ['auditJaugeFrappe', path.join(RACINE, 'src/screens/games/CombatScreen.js'), "l'effet d'un sort ignore le tap (bouclier plein même en zone sombre)",
    remplace(', targetIdx, multiplicateurSort(verdictCoup), estSurAllie(skill) ? allyTargetRef.current : null);', ', targetIdx, 1, estSurAllie(skill) ? allyTargetRef.current : null);')],
  // 10/10 : le Gardien et le niveau max (effort plafonné, plan plafonné, menu qui le dit).
  ['auditGardienGriffes', F.combat, "effort du Gardien sans niveau max : il suppose des niveaux inatteignables",
    remplace('for (let n = 0; n < 500; n++) { if (x.ownedLevel >= Math.min(plafond, niveauMaxEquipe(m.map((y) => y.ownedLevel)))) break; const c = levelUpCost', 'for (let n = 0; n < 500; n++) { const c = levelUpCost')],
  ['auditGardienGriffes', F.combat, "plan du Gardien au-delà du niveau max (« Aegisolar +4 » impossible)",
    remplace('prec.forEach((x, i) => { if (x.ownedLevel >= maxEquipe) return; const g = puissanceAffichee', 'prec.forEach((x, i) => { const g = puissanceAffichee')],
  ['auditGardienGriffes', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le menu calcule le plan sans le niveau max actuel",
    remplace(', 0.8, 40, niveauMaxCreature((lifetimeStats || {}).advLevelReached || 0));', ', 0.8, 40);')],
  ['auditGardienGriffes', F.combat, "effort du Gardien passé à 3 combats de Griffes : un mur",
    remplace('export const EFFORT_GARDIEN = 0.25;', 'export const EFFORT_GARDIEN = 3;')],
  ['auditGardien80', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "défaite au niveau du Gardien : retour du « Améliore tes créatures » trompeur",
    remplace('resultatGardien.chance != null && resultatGardien.chance >= 80', 'resultatGardien.chance != null && resultatGardien.chance > 999')],
  ['auditGardien80', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "menu du Gardien sans l'effort en niveaux",
    remplace('return { victoires, niveaux80: plan ? plan.niveaux : null, plan80: plan ? plan.plus : [], bloqueParMax: !!(plan && plan.bloqueParMax) };', 'return { victoires, niveaux80: 0, plan80: [], bloqueParMax: false };')],
  ['auditPuissanceAffichee', F.combat, "puissance affichée sur les stats ARRONDIES : les paliers reviennent (« ça ne bouge pas »)",
    remplace('    return { pv: c.hp, dmg: degatsMoyensDuTour(m.creature, { ...st, attack: c.attack }) };', '    return { pv: st.hp, dmg: degatsMoyensDuTour(m.creature, st) };')],
  ['auditStadeEvolution', F.clicker, "stade figé à 0 : les évolutions ne changeraient plus l'image",
    remplace('  return Math.max(0, Math.min(2, Math.floor(Number(evolutionTier) || 0)));', '  return 0;')],
  ['auditReliquesPossedees', path.join(RACINE, 'src/screens/games/GrimoireBoutique.js'), "filtre des reliques retiré : les pages verrouillées reviennent",
    remplace("const visible = (cle, id) => parId[id] && (cle !== 'reliques' || parId[id].etat !== 'verrouille');", "const visible = (cle, id) => parId[id];")],
  ['auditMusique', path.join(RACINE, 'src/screens/games/musique.js'), "musique du menu poussée à 0,9 : elle couvrirait les bruitages",
    remplace('export const VOLUME_MUSIQUE = { menu: 0.25,', 'export const VOLUME_MUSIQUE = { menu: 0.9,')],
  ['auditSonsJeu', F.combatEcran, "son des impacts débranché : les coups redeviennent muets",
    remplace("    son(cle === 'parfait' ? 'impact-parfait' : cle === 'rate' ? 'rate' : 'impact-normal');\n", '')],
  ['auditTourneSansSaut', path.join(RACINE, 'src/screens/games/livreTourne.js'), "angle remis à zéro à la fin du tour : l'ancienne page réapparaît (bug du 06/10)",
    remplace('        setPosition(vers); setTour(null); enTour.current = false;', '        setPosition(vers); setTour(null); angle.setValue(0); enTour.current = false;')],
  ['auditLimiteGriffesPieces', F.clicker, "plafond relevé à 99 : les packs en pièces redeviennent illimités",
    remplace('export const GRIFFES_PIECES_MAX_PAR_ASCENSION = 4;', 'export const GRIFFES_PIECES_MAX_PAR_ASCENSION = 99;')],
  ['auditCarteChapitres', F.aventure, "fond des capsules redevenu capteur de toucher : le « + » des Griffes et « Éléments » ne répondraient plus sur le téléphone",
    remplace("        <View style={{ position: 'absolute', left: 0, top: 0, width: t.w, height: t.h, flexDirection: 'row', pointerEvents: 'none' }}>", "        <View style={{ position: 'absolute', left: 0, top: 0, width: t.w, height: t.h, flexDirection: 'row' }}>")],
  ['auditGriffesBoutons', F.aventure, "conteneur du cadre redevenu capteur de toucher : les achats ne marcheraient plus sur le téléphone (bug du 06/10)",
    remplace("<View style={{ position: 'absolute', left: 0, top: 0, width: c.width, height: c.height, pointerEvents: 'none' }}>\n              <Image source={FICHE_IMG.cadre}", "<View style={{ position: 'absolute', left: 0, top: 0, width: c.width, height: c.height }}>\n              <Image source={FICHE_IMG.cadre}")],
  ['auditDialoguesJeu', path.join(RACINE, 'App.js'), "hôte des dialogues retiré : toutes les fenêtres maison retomberaient sur la boîte du système",
    remplace('      <HoteDialogue />\n', '')],
  ['auditMenusCreatures', F.aventure, "page des Griffes retirée de l'écran des Runes : son « + » n'ouvrirait plus rien",
    remplace('    return avecBoutique(\n      <RunesScreen\n', '    return (\n      <RunesScreen\n')],
  ['auditFicheCreature', F.aventure, "retirer une rune débranché : toucher une rune équipée ne la retire plus",
    remplace('onPress={() => (rune ? onUnequipRune(rune.id) : setRunePickerSlot(n))}', 'onPress={() => (rune ? null : setRunePickerSlot(n))}')],
  ['auditApercuAuDessus', F.aventure, "l'aperçu redescend sous la barre de la carte : RETOUR avalé (bug du 05/10)",
    remplace("right: 0, bottom: 0, zIndex: 30, backgroundColor: '#0b1418', overflow: 'hidden' },", "right: 0, bottom: 0, zIndex: 15, backgroundColor: '#0b1418', overflow: 'hidden' },")],
  ['auditRuneArcane', F.combatEcran, "l'écran oublie la Rune d'Arcane : mana de départ fixe",
    remplace('stats, hp: stats.hp, mana: manaDeDepart(stats), etats: {} };', 'stats, hp: stats.hp, mana: MANA_DEPART, etats: {} };')],
  ['auditRiposteTourDeRole', F.combatEcran, "l'écran revient à l'ancienne règle : seul l'adversaire visé riposte",
    remplace('choisirRiposteur(newOpponents, targetIdx, riposteRangRef.current)', 'choisirRiposteur(newOpponents, targetIdx)')],
  ['auditTransitionCombat', F.combatEcran, "toucher de déblocage retiré : un minuteur raté figerait le combat comme le 01/09",
    remplace("{phase === 'resolving' && (\n        <View\n          style={styles.tapEverywhere}", "{false && (\n        <View\n          style={styles.tapEverywhere}")],
  ['auditEffetsCombat', F.combatEcran, "couche des étincelles redevenue capteuse de toucher : elle avalerait les taps de la jauge",
    remplace("coucheImpacts: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 22, pointerEvents: 'none' },", "coucheImpacts: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 22 },")],
  ['auditJaugeFrappe', F.combatEcran, "tap de la jauge jugé au RELÂCHEMENT : le joueur serait jugé 50 à 100 ms trop tard",
    remplace('onResponderGrant={handleTap}', 'onResponderRelease={handleTap}')],
  ['auditJaugeFrappe', F.combat, "zone dorée de la mythique ramenée à celle d'une légendaire : la rareté ne compterait plus",
    remplace('legendaire: 0.11, mythique: 0.13 }', 'legendaire: 0.11, mythique: 0.11 }')],
  ['auditDefiTapsLibre', F.combatEcran, "anneau du défi redevenu capteur de toucher : les taps du centre seraient de nouveau avalés",
    remplace("{phase === 'tapping' && (\n          <View style={{ alignItems: 'center', pointerEvents: 'none' }}>", "{phase === 'tapping' && (\n          <View style={{ alignItems: 'center' }}>")],
  ['auditCadrageCreatures', F.cadrage, "cadrage de Luxorbe absent (table non régénérée) : elle serait mal cadrée dans l'Album et l'Exploration",
    remplace('  luxorbe: {', '  luxorbe_retire: {')],
  ['auditImagesTailleExplicite', F.aventure, "panneau RETOUR remis en <Image style={StyleSheet.absoluteFill}> : exactement la plaque géante du 03/10",
    remplace('<Image source={HUB_IMG.retour} resizeMethod="scale" resizeMode="stretch" style={styles.hubPleineImage} />', '<Image source={HUB_IMG.retour} resizeMethod="scale" resizeMode="stretch" style={StyleSheet.absoluteFill} />')],
  ['auditImagesTailleExplicite', F.aventure, "style nommé qui remplit son parent sans largeur/hauteur (4 bords à 0) : même plaque géante",
    remplace("  hubPleineImage: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },", "  hubPleineImage: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },")],
  ['auditHubExploration', F.aventure, "gemme des Runes débranchée dans le hub : les Runes deviendraient inaccessibles",
    remplace('<TouchableOpacity onPress={() => setRunesOpen(true)} activeOpacity={0.8} style={[R(HUB.runes, \'droite\')', '<TouchableOpacity onPress={() => {}} activeOpacity={0.8} style={[R(HUB.runes, \'droite\')')],
  ['auditAlbumComplet', F.album, "élément « Magie » retiré de la liste : ses créatures disparaîtraient de l'album sans bruit",
    remplace("'Lumière', 'Ténèbres', 'Magie'];", "'Lumière', 'Ténèbres'];")],
  ['auditRafaleArretee', F.grimoireEcran, "bouton de prix sans arrêt au relâcher : la rafale viderait les pièces",
    remplace("onAcheter(n.id, e.nativeEvent.pageX, e.nativeEvent.pageY)} onPressOut={onRelacher}\n              style", "onAcheter(n.id, e.nativeEvent.pageX, e.nativeEvent.pageY)}\n              style")],
  ['auditModulesNatifsProteges', F.sons, "expo-audio chargé SANS vérifier le module natif (exactement le plantage du 02/10)",
    remplace("    audio = natif ? require('expo-audio') : null;", "    audio = require('expo-audio');")],
  ['auditConseilBoutique', F.conseil, "revenu passif oublié dans la formule du conseil : les auto-clics ne vaudraient plus rien",
    remplace('  return TAPS_PAR_SECONDE_REF * valeurTap(e) * transeMultiplier(SERIE_SOUTENUE) + passif;', '  return TAPS_PAR_SECONDE_REF * valeurTap(e) * transeMultiplier(SERIE_SOUTENUE);')],
  ['auditCapteurTapsNeutre', F.ecran, "capteur qui PREND les touchers (return true) : plus aucun tap ne serait compté",
    remplace('    return false; // capteur NEUTRE : ne prend jamais le toucher', '    return true; // capteur NEUTRE : ne prend jamais le toucher')],
  ['auditZoneTapAuContact', F.ecran, "zone de tap remise en TouchableOpacity / onPress (exactement le retour du bug du 27/09)",
    remplace('<View style={styles.tapTouch} onStartShouldSetResponder={() => true} onResponderStart={handleTap} onResponderTerminationRequest={() => false} ref={zoneTapRef} onLayout={mesurerZoneTap}>', '<TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.tapTouch}>')],
  ['auditZoneTapAuContact', F.ecran, "tap compté au seul DÉBUT du geste (onResponderGrant) : les touchers chevauchés sont perdus (38 % le 03/10)",
    remplace('onResponderStart={handleTap} onResponderTerminationRequest={() => false}', 'onResponderGrant={handleTap} onResponderTerminationRequest={() => false}')],
  ['auditGrimoireComplet', F.grimoire, "Dégâts critiques retirés du livre : un élément achetable disparaîtrait de la boutique",
    remplace("    ids: () => ['faveur', 'faveurV2', 'critDamage', 'critDamageV2'] },", "    ids: () => ['faveur', 'faveurV2', 'critDamageV2'] },")],
  ['auditPointerEventsStyle', F.aventure, "une propriété pointerEvents réapparaît (ignorée sur téléphone)",
    remplace("<View style={[styles.shopHintWrap, { pointerEvents: 'none' }]}>", "<View style={styles.shopHintWrap} pointerEvents=\"none\">")],
  ['auditExhaustif', F.defis, "un libellé cassé dans un vrai défi (l'outil testait les anciens modèles : vert quand même, 24/09)",
    surDefi((b) => b.metric === 'coins' && b.g === 2 && b.e === 7, (b) => b.replace('label: t => `', 'label: t => `undefined '))],
  ['auditPoigneA0', F.clicker, "Poigne remise à 2 099 : 1/11 du prix du Pacte par point de tap (le « cheat » du 21/09 ; recalé le 17/10, Poigne +1,5)",
    remplace("cost: 23037, growth: 1.45 }", "cost: 4043, growth: 1.45 }")],
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
  ['auditEmballement', F.defis, '1 500 taps d\'affilée : au-delà de la limite de l\'auteur (980 à l\'œuf 26)',
    surDefi((b) => b.metric === 'maxTapStreak', cible(1500))],
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
    surDefi((b) => b.metric === 'maxTapStreak' && b.g === 0, cible(500))],
  // ⚠️ Pas « le seuil −40 % » : dans une économie qui accélère, les
  // derniers 40 % du seuil se gagnent vite, et la durée ne bouge que de
  // ~10 % — dans la marge. Le sabotage était trop faible, pas le contrôle.
  // On rejoue donc LE VRAI BUG du 21/09 : la hausse sur tous les
  // générateurs, partout (A1 à 2,7 h, A2 à 3,4 h).
  // ⚠️ Sabotage remplacé le 21/09 : l'ancien (hausse sur tous les
  // générateurs) ne déplaçait plus les durées, le simulateur corrigé
  // n'achetant presque aucun générateur avant l'A2. Un sabotage doit
  // rester DOULOUREUX pour prouver quoi que ce soit.
  // 17/10 : avec le calculateur, la DURÉE ne dépend plus de la puissance du tap (les cibles la suivent ; un tap triplé est
  // attrapé par auditBudgetGroupe : le seuil ne suit plus la chaîne) — le levier de durée est le TEMPS VISÉ.
  ['auditDureeCible', F.calcul, 'le temps visé des défis divisé par 2 : tout le jeu se boucle deux fois trop vite',
    remplace('  return 300 + 45 * Math.floor((n - 3) / 3);', '  return 150 + 22 * Math.floor((n - 3) / 3);')],
  ['auditMajorationPrix', F.clicker, "la Main de l'A0 n'est plus majorée alors que ses défis la demandent",
    remplace("  ['esprit', 'main', 'feufollet'],      // A0", "  ['esprit', 'feufollet'],              // A0")],
  ['auditMajorationPrix', F.clicker, "un palier de tap rattaché à une Ascension plus tardive que ses défis (surprime au mauvais moment)",
    remplace('  tap1: 0, tap2: 1, tap3: 1,', '  tap1: 0, tap2: 3, tap3: 1,')],
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
  // 17/10 : étapes 61+ mesurées et aperçu calé sur la photo (bug « je gagne tout à partir de l'étape 80 »).
  ['auditEtapesAvancees', F.combat, "les étapes 61+ retombent sur le repli par espèces (crans trop faciles)",
    remplace('|| FACTEUR_ETAPE[nEt];', '|| (nEt <= 60 ? FACTEUR_ETAPE[nEt] : 0);')],
  ['auditEtapesAvancees', F.combat, "une étape perd son facteur mesuré",
    remplace(', "150": 0.952', '')],
  ['auditEtapesAvancees', F.combat, "l'écran ne sait plus si l'étape a sa photo",
    remplace('return !!(niveauxJoueur && niveauxJoueur[Math.max(1, Math.floor(levelNumber || 1))] != null);', 'return true;')],
  ['auditEtapesAvancees', F.aventure, "l'aperçu n'est plus remesuré quand la photo arrive (le bug de l'étape 86)",
    remplace('equipeAdverse.map((m) => [m.creature.id, m.niveau, m.evolutionTier || 0]), affaiblissementEtape(levelNumber), attentePhoto]);', 'attentePhoto]);')],
  ['auditEtapesAvancees', F.aventure, "l'aperçu se mesure sans attendre la photo",
    remplace('if (attentePhoto) return undefined;', 'if (false) return undefined;')],
  ['auditEtapesAvancees', F.aventure, "COMBATTRE actif sans la photo",
    remplace('disabled={deckVide || sansEnergie || attentePhoto}', 'disabled={deckVide || sansEnergie}')],
  ['auditEtapesAvancees', F.aventure, "l'attente de la photo n'est plus transmise à l'aperçu",
    remplace('attentePhoto={fenetreDe(levelPreview) === fenetreDe(currentUnlockedLevel) && deck.some(Boolean) && !etapePhotographiee(levelPreview)}', 'attentePhoto={false}')],
  ['auditEtapesAvancees', F.aventure, "un combat part sans la photo de la fenêtre",
    remplace('if (fenetreDe(levelPreview) === fenetreDe(currentUnlockedLevel) && !etapePhotographiee(levelPreview)) return;', '')],
  ['auditEtapesAvancees', F.aventure, "le journal garde une chance mesurée sur un autre niveau",
    remplace('derniereMesureApercu.niveauEnnemis === nivCombat;', 'true;')],
  // 17/10 : bug 2 — « +X » du Soin et du Bouclier.
  ['auditSortsAffiches', F.combat, "le « +X » du Bouclier montre la valeur lancée, pas le gain",
    remplace('valeur: Math.max(0, Math.max(dejaB, v) - dejaB) });', 'valeur: v });')],
  ['auditSortsAffiches', F.combatEcran, "plus de « Déjà protégé »",
    remplace("texte: (v) => (v ? `+${v}` : 'Déjà protégé')", 'texte: (v) => (v ? `+${v}` : null)')],
  ['auditSortsAffiches', F.combatEcran, "la barre ne voit plus le soin avant le coup ennemi",
    remplace('      pvApresSortP = r.allies.map((f) => f.hp);', '')],
  ['auditSortsAffiches', F.combatEcran, "le gel reprend les PV d'avant le sort",
    remplace('const av = pvApresSortP ? pvApresSortP[i] : pvAvantP[i];', 'const av = pvAvantP[i];')],
  ['auditSortsAffiches', F.combatEcran, "le soin ennemi refond dans ton coup",
    remplace('      pvAvantActionO = newOpponents.map((o) => (o ? o.hp : 0));', '')],
  ['auditSortsAffiches', F.combatEcran, "la barre de l'ennemi soigné reste figée",
    remplace("if (ae.sort === 'soin') degeler('o');", '')],
  // 17/10 : plantage de l'Exploration (import masqué par un tableau local).
  ['auditImportsMasques', F.aventure, "le tableau local reprend le nom de la fonction importée (plantage en touchant EXPLORATION)",
    remplace('  const niveauxEquipe = deck.filter(Boolean)', '  const niveauxDuDeck = deck.filter(Boolean)')],
  // 17/10 (soir) : Pacte du joueur ×1,5 / 30 %, ennemis intacts, énergie 7 (choix de l'auteur).
  ['auditPacteEnergie', F.combat, "le Pacte du joueur repasse à ×2", remplace('  pacteMultJoueur: 1.5,', '  pacteMultJoueur: 2,')],
  ['auditPacteEnergie', F.combat, "le Pacte du joueur ne coûte plus que 15 %", remplace('  pacteCoutPvJoueur: 0.30,', '  pacteCoutPvJoueur: 0.15,')],
  ['auditPacteEnergie', F.combat, "les ennemis prennent le Pacte réduit du joueur", remplace('const r = lancerSort(sort, avecMana, idx, joueurs, cible, 1, null, true);', 'const r = lancerSort(sort, avecMana, idx, joueurs, cible);')],
  ['auditFaussePub', F.pub, "la fausse pub ne dure plus que 5 s", remplace('export const DUREE_FAUSSE_PUB_SEC = 15;', 'export const DUREE_FAUSSE_PUB_SEC = 5;')],
  ['auditFaussePub', F.ecran, "le Tap ×2 de la pub n'est plus appliqué", remplace('critMult * legendaireMult * boostPub));', 'critMult * legendaireMult));')],
  ['auditFaussePub', F.logique, "« Achète une rune » redevient validable d'office", remplace("  'runeEquipped', 'runeFused', 'ascension', 'offering',", "  'runeBought', 'runeEquipped', 'runeFused', 'ascension', 'offering',")],
  ['auditCalculateurDefis', F.calcul, "le temps visé dès l'œuf 3 retombe à 3 min", remplace('  return 300 + 45 * Math.floor((n - 3) / 3);', '  return 180 + 45 * Math.floor((n - 3) / 3);')],
  ['auditCalculateurDefis', F.calcul, "les pouvoirs du deck ne comptent plus dans la production", remplace('  return TAPS_REF * valeurTap(e) * TRANSE_MOYENNE * (1 + b.tap) + revenuPassif(e) * (1 + b.passif);', '  return TAPS_REF * valeurTap(e) * TRANSE_MOYENNE + revenuPassif(e);')],
  ['auditCalculateurDefis', F.ecran, "l'Offrande ne protège plus ses pièces (le payeur perd son avance)", remplace('    piecesProtegeesRef.current += Math.max(0, gained || 0);\n', '')],
  ['auditCalculateurDefis', F.ecran, "le calculateur n'est plus branché à l'apparition du défi", remplace('      if (Number.isInteger(cibleCalc) && cibleCalc >= 1) setQuestTargets((prev) => ({ ...prev, [currentChallengeId]: cibleCalc }));\n', '')],
  ['auditPubsAuteur', F.logique, "« Achète une rune » recompte le cycle (défi validé d'office)", remplace("  'runeEquipped', 'runeFused', 'ascension', 'offering',\n];", "  'runeBought', 'runeEquipped', 'runeFused', 'ascension', 'offering',\n];")],
  ['auditPubsAuteur', F.ecran, "le bonus de la pub n'est plus appliqué au tap", remplace('legendaireMult * boostPub));', 'legendaireMult));')],
  ['auditPubsAuteur', F.aventure, "la pub des Runes ne donne plus de poudre", remplace('setPubPoudre(false); setPoudre((p) => p + 1); };', 'setPubPoudre(false); };')],
  ['auditPacteEnergie', F.combat, "l'énergie max retombe à 5", remplace("export const ENERGY_MAX = 8; // 18/10 : choix de l'auteur (était 7)", 'export const ENERGY_MAX = 5;')],
  ['auditPacteEnergie', F.combat, "la carte du Pacte réécrit ses chiffres en dur",
    remplace("SORTS.pacte.desc = `×${String(EFFETS.pacteMultJoueur).replace('.', ',')} · coûte ${Math.round(EFFETS.pacteCoutPvJoueur * 100)} % de PV`;", "SORTS.pacte.desc = '×2 · coûte 15 % de PV';")],
  // 17/10 (nuit) : combats 4 et 5 adoucis dès l'étape 11 (choix de l'auteur).
  ['auditCransAdoucis', F.combat, "les cibles adoucies reviennent à 50 / 33 %", remplace('export const CIBLES_ADOUCIES = { 4: 0.6, 5: 0.45 };', 'export const CIBLES_ADOUCIES = { 4: 0.5, 5: 1 / 3 };')],
  ['auditCransAdoucis', F.combat, "le calcul des ennemis ignore l'adoucissement", remplace('  if (!douce) return (t[d] || t[3]) * (CORRECTION_DIFFICULTE[d] || 1);', '  if (true) return (t[d] || t[3]) * (CORRECTION_DIFFICULTE[d] || 1);')],
  ['auditCransAdoucis', path.join(RACINE, 'tools/mesurer-etapes.js'), "l'outil de mesure se place sur la cible adoucie", remplace('{ sansFacteur: true, cibleBrute: true }', '{ sansFacteur: true }')],
  // 17/10 : cible dorée −1 sur toute la chaîne, livre de tap plus rapide (demandes de l'auteur).
  ['auditDoreeEtLivre', path.join(RACINE, 'src/games/clicker/defisEcrits.js'), "le défi 5 redemande 3 cibles dorées (sans répercussion)",
    remplace("    { id: 'a0e1_golden', icon: '⭐', metric: 'goldenClaimed',\n      target: 2,", "    { id: 'a0e1_golden', icon: '⭐', metric: 'goldenClaimed',\n      target: 3,")],
  ['auditDoreeEtLivre', path.join(RACINE, 'src/screens/games/GrimoireBoutique.js'), "le livre de tap s'ouvre de nouveau en 900 ms",
    remplace('const DUREE_OUVERTURE = 450;', 'const DUREE_OUVERTURE = 900;')],
  // 17/10 : défis 9 ↔ 11 et lueurs du défi d'achat (demandes de l'auteur).
  ['auditDefisLueur', path.join(RACINE, 'src/games/clicker/defisEcrits.js'), "le défi 9 redevient la Main Spectrale",
    remplace("{ id: 'a0e2_gen2', icon: '⚙️', metric: 'auto:esprit',", "{ id: 'a0e2_gen2', icon: '⚙️', metric: 'auto:main',")],
  ['auditDefisLueur', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le Grimoire ne reçoit plus le défi en cours", remplace('cibleDefi={cibleDefiAchat}', 'cibleDefi={null}')],
  ['auditDefisLueur', path.join(RACINE, 'src/screens/games/GrimoireBoutique.js'), "l'article du défi n'est plus éclairé", remplace('defi={!!props.cibleDefi && id === props.cibleDefi}', 'defi={false}')],
  ['auditDefisLueur', path.join(RACINE, 'src/games/clicker/grimoireChapitres.js'), "la Faveur ne retrouve plus son article", remplace("critLevel: 'faveur'", "critLevel: 'crit'")],
  ['auditDefisLueur', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "la lueur relit les défis du jour au lieu du défi de l'œuf",
    remplace('articleDuDefiAchat(metriqueDuDefi(findQuest(currentChallengeId), { ascension: ascensionCount, objetsDefis: objetsDesDefis(questBaselines) }))', 'articleDuDefiAchat(metriqueDuDefi(findQuest((questIds || [])[0]), { ascension: ascensionCount, objetsDefis: objetsDesDefis(questBaselines) }))')],
  // 17/10 : Transe ratée (croix, zéro, vibration) et lueur en image (demandes de l'auteur).
  ['auditTranseEchec', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "la Transe ratée ne remet plus le compteur à zéro", remplace('echouerTranseRef.current();', 'void 0;')],
  ['auditTranseEchec', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "plus de croix rouges", remplace('{echec ? CHALLENGE_GEM_X_PCT.map(', '{false ? CHALLENGE_GEM_X_PCT.map(')],
  ['auditDefisLueur', path.join(RACINE, 'src/screens/games/GrimoireBoutique.js'), "la lueur redevient un cadre jaune carré",
    remplace("  lueurDefi: { position: 'absolute' },", "  lueurDefi: { position: 'absolute', borderWidth: 3, borderColor: '#ffd54a', borderRadius: 12 },")],
  ['auditTranseEchec', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "les barres ratées ne passent plus au rouge", remplace("tintColor: '#ff2020'", "tintColor: '#ffd54a'")],
  // 17/10 : Poigne +1,5, affichage à virgule, « (Élevage) » retiré (demandes de l'auteur).
  ['auditPoigneElevage', path.join(RACINE, 'src/games/clicker/clickerLogic.js'), "la Poigne repasse à +1", remplace("emoji: '✊', bonus: 1.5, cost: 23037,", "emoji: '✊', bonus: 1, cost: 23037,")],
  ['auditPoigneElevage', path.join(RACINE, 'src/games/clicker/dailyLogic.js'), "« (Élevage) » revient dans un défi", remplace("desc: 'Tape 3 000 fois',", "desc: 'Tape 3 000 fois (Élevage)',")],
  // 17/10 : mesures de jeu du rapport (demande de l'auteur).
  ['auditMesuresRapport', path.join(RACINE, 'src/games/clicker/diagnostic.js'), "le rapport n'écrit plus les mesures", remplace("  if (m && typeof m === 'object') {\n    const duree", "  if (false) {\n    const duree")],
  ['auditMesuresRapport', path.join(RACINE, 'src/signalement.js'), "les mesures ne sont plus transmises au rapport", remplace('build, mesures });', 'build, mesures: null });')],
  ['auditMesuresRapport', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le temps réel des défis n'est plus noté", remplace('if (m.defiId) m.historique = [...m.historique,', 'if (false) m.historique = [...m.historique,')],
  ['auditMesuresRapport', path.join(RACINE, 'src/screens/games/ClickerScreen.js'), "le rythme de tap n'est plus mesuré", remplace('m.tapsActifsSec += ecart / 1000;', 'void 0;')],
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

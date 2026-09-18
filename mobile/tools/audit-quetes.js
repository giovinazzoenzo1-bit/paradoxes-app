// AUDIT AUTOMATIQUE DE LA PROGRESSION DES DÉFIS
//
// Pourquoi cet outil : la séquence compte ~25 œufs × 4 défis. Personne ne
// peut la jouer en entier pour vérifier qu'aucun défi n'est impossible,
// absurde ou interminable. Ce script la PARCOURT et MESURE à la place.
//
// Il ne remplace pas le test manuel du ressenti ; il attrape ce qu'un
// humain ne peut pas voir : un défi infaisable, une cible hors d'échelle,
// un cycle qui demande 40 heures.
//
// Lancement : node mobile/tools/audit-quetes.js
'use strict';
const path = require('path');
const fs = require('fs');
// @babel/core sert à lire les modules ES du jeu depuis Node. Il n'est
// pas une dépendance de l'app : on le cherche là où il se trouve.
// Lancement type : NODE_PATH=<dossier avec @babel/core> node mobile/tools/audit-quetes.js
let babel;
try {
  babel = require('@babel/core');
} catch (e) {
  console.error("@babel/core introuvable. Lance avec NODE_PATH pointant vers un dossier node_modules qui le contient.");
  process.exit(1);
}

const DIR = path.join(__dirname, '..', 'src', 'games', 'clicker');
const cache = {};
function load(name) {
  if (cache[name]) return cache[name].exports;
  const code = babel.transformSync(fs.readFileSync(path.join(DIR, name + '.js'), 'utf8'), {
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
    filename: name + '.js',
  }).code;
  const mod = { exports: {} };
  cache[name] = mod;
  new Function('require', 'module', 'exports', code)((p) => load(path.basename(p)), mod, mod.exports);
  return mod.exports;
}
const Q = load('questLogic');
const C = load('clickerLogic');

// ---- Modèle de joueur ----------------------------------------------
// Hypothèses EXPLICITES, à ajuster si le jeu change. Elles ne cherchent
// pas la précision à la minute mais l'ORDRE DE GRANDEUR : c'est ce qui
// révèle les défis hors d'échelle.
// ⚠️ DOIT rester égal à `HUMAN_TAPS_PER_SEC` de `questBudget.js`.
// L'autoclicker de l'auteur (150 ms, et 142/s en usage réel) est un
// OUTIL DE TEST : il ne doit jamais servir de référence d'équilibrage,
// ni ici ni dans le budget des défis.
const HUMAIN = 4;
const H = {
  tapsParSec: HUMAIN,     // cadence humaine, sans autoclicker
  minParSession: 20,      // durée d'une session type
  energieMax: 5,          // tentatives d'Aventure avant recharge
  diamantsParJour: 21,    // plafond des boss
  griffesParCombat: 20,   // gain moyen en Aventure
  doreeParMin: 0.5,       // cibles dorées par minute
  pouvoirParMin: 1.2,     // activations de pouvoir par minute
};

// ⚠️ L'INSTRUMENT sous-estimait la reconstruction d'APRÈS Ascension.
//
// Le revenu de TAP ne recevait aucun multiplicateur global, alors que
// `gainCoins` (ClickerScreen) lui applique exactement les mêmes que le
// passif : Sanctuaire, essence, Ascension et bonus de pièces. Or juste
// après une Ascension le passif vaut ZÉRO : tout le revenu vient du tap,
// donc c'est précisément là que l'écart comptait. Le ×1,30 par Ascension
// était perdu, et l'audit annonçait un joueur qui rebâtit toujours à la
// même vitesse quel que soit son nombre d'Ascensions — ce qui est faux.
// Revenu PASSIF seul — c'est ce que `questStats.passiveIncome` contient
// dans le jeu (`passiveRate`, sans le tap). L'audit doit publier la même
// chose, sinon `questBudget` reçoit une valeur que le jeu ne lui donne
// jamais et toutes les cibles en pièces sont gonflées.
function passiveOnly(s) {
  return C.passiveRate({
    autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
    sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: s.ascension,
  });
}

function production(s) {
  const passif = C.passiveRate({
    autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
    sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: s.ascension,
  });
  const multTap =
    C.sanctuaryMultiplier(s.sanctuaryLevel || 0) *
    C.essenceBonusMultiplier(s.essence || 0) *
    C.ascensionSpeedMultiplier(s.ascension || 0) *
    (1 + C.upgradeBonuses(s.upgradeLevels || {}).coinPct);
  const paliers = C.tapUpgradeBonus(s.tapUpgrades || {});
  return passif + (C.tapDamage(s.tapPower) + paliers) * H.tapsParSec * multTap;
}

// Minutes estimées pour franchir un défi, selon sa métrique.
// `null` = infaisable (doit être signalé).
// ⚠️⚠️ LE JOUEUR RÉINVESTIT — ne pas compter à revenu GELÉ.
//
// Les défis d'ACHAT (Pacte, générateurs, Sanctuaire, améliorations,
// paliers de tap) augmentent la production à mesure qu'on les paie.
// Diviser le coût TOTAL par la production de DÉPART surestime
// énormément : mesuré, « Pacte 8 » ressortait à 64 minutes alors qu'un
// joueur qui réinvestit y arrive en 12. L'écart explose après une
// Ascension, là où la production repart de zéro — le contrôle
// `auditAscension` a signalé « 2 868 min » sur un défi qui en coûte
// quelques dizaines.
//
// On achète donc niveau par niveau en recalculant la production après
// CHAQUE achat, comme le joueur.
function tempsAchatsCumules(s, appliquer, coutFn, de, a) {
  const copie = JSON.parse(JSON.stringify(s));
  let secondes = 0;
  for (let i = de; i < a; i++) {
    const prod = Math.max(1, production(copie));
    secondes += coutFn(i) / prod;
    appliquer(copie, i + 1);
  }
  return secondes / 60;
}

function minutesPour(q, cible, s) {
  const prod = Math.max(1, production(s));
  const m = q.metric || '';
  const delta = q.mode === 'delta';
  const restant = delta ? cible : Math.max(0, cible - (s[m] || 0));
  if (!delta && (s[m] || 0) >= cible) return 0;

  if (m === 'totalEarned' || m === 'coins') return restant / prod / 60;
  if (m === 'passiveIncome') return null; // dépend des achats, traité à part
  if (m === 'tapPower') return tempsAchatsCumules(s, (x, n) => { x.tapPower = n; }, C.tapPowerCost, s.tapPower, cible);
  if (m === 'sanctuaryLevel') return tempsAchatsCumules(s, (x, n) => { x.sanctuaryLevel = n; }, C.sanctuaryUpgradeCost, s.sanctuaryLevel, cible);
  if (m === 'veilleurLevel') return tempsAchatsCumules(s, (x, n) => { x.veilleurLevel = n; }, C.veilleurUpgradeCost, s.veilleurLevel, cible);
  if (m.startsWith('upgrade:')) {
    const it = C.UPGRADE_ITEMS.find((u) => u.id === m.slice(8));
    if (!it) return null;
    return tempsAchatsCumules(s, (x, n) => { x.upgradeLevels[it.id] = n; },
      (l) => C.upgradeItemCost(it, l), (s.upgradeLevels[it.id] || 0), cible);
  }
  if (m.startsWith('auto:')) {
    const a = C.AUTOCLICKERS.find((x) => x.id === m.slice(5));
    if (!a) return null;
    return tempsAchatsCumules(s, (x, n) => { x.autoClickers[a.id] = n; },
      (n) => C.autoClickerCost(a, n), (s.autoClickers[a.id] || 0), cible);
  }
  if (m.startsWith('tapUpgrade:')) {
    // ⚠️ Renvoyait 12 minutes EN DUR : l'audit ne voyait donc aucun
    // changement de prix des paliers de tap, alors qu'ils ont été
    // multipliés par ~10 le 17/09. On compte le coût réel, comme pour
    // toutes les autres métriques de niveau.
    const palier = C.TAP_UPGRADES.find((t) => t.id === m.slice(11));
    if (!palier) return null;
    return tempsAchatsCumules(s, (x, n) => { x.tapUpgrades = { ...(x.tapUpgrades || {}), [palier.id]: n }; },
      (l) => C.tapUpgradeCost(palier, l), ((s.tapUpgrades || {})[palier.id] || 0), cible);
  } // paliers de tap : quelques minutes
  if (m === 'totalCrits') return restant / (H.tapsParSec * Math.max(0.02, C.critChance(s.critLevel))) / 60;
  if (m === 'goldenClaimed') return restant / H.doreeParMin;
  if (m === 'powerActivated') return restant / H.pouvoirParMin;
  if (m === 'maxTranseHoldSec') return 2;
  if (m === 'maxCombo') return 2;
  // ⚠️ Les Diamants ne tombent PAS au rythme du plafond quotidien. Ils
  // viennent des boss de tap : le 1er à 2 min de jeu actif, les suivants
  // à 20 min, au plus 2 par heure. Modéliser par le plafond journalier
  // donnait 69 min pour UNE Offrande en début de partie — faux, et ça
  // faisait passer le cycle 2 pour un mur qu'il n'est qu'en partie.
  if (m === 'offering') {
    const premier = 2;                       // 1er boss : 2 min actives
    const suivants = Math.max(0, restant - 1) * 20;
    return premier + suivants;
  }
  if (m === 'totalSummons') { let c = 0; for (let n = s.ownedCount; n < s.ownedCount + restant; n++) c += C.summonCost(n); return c / prod / 60; }
  if (m === 'battleWon' || m === 'advLevelReached') return restant * (60 / H.energieMax) / 1; // énergie
  if (m === 'runeBought' || m === 'runeFused') return restant * 100 / H.griffesParCombat * 3;
  if (m === 'runeEquipped') return restant * 1;
  if (m === 'runeEquippedTotal') return restant * 1;
  if (m === 'maxCreatureLevel') { let c = 0; for (let l = s.maxCreatureLevel; l < cible; l++) c += C.levelUpCost({ rarity: 'commun' }, l); return c / H.griffesParCombat * 3; }
  if (m === 'maxEvolutionTier') return 60;
  // ⚠️ L'Ascension est conditionnée par un SEUIL de pièces gagnées à
  // vie, pas par une action. Estimer un forfait laissait passer un défi
  // INFAISABLE (seuil à 5 M alors que la séquence n'en produit que 2).
  // On mesure le temps qu'il faut pour atteindre le seuil restant.
  if (m === 'ascension') {
    const seuil = C.ascensionThreshold(s.ascension || 0);
    const manque = Math.max(0, seuil - (s.totalEarned || 0));
    return manque / prod / 60 + restant * 10;
  }
  if (m === 'ownedCount') return null;
  return null;
}
module.exports = { load, H, production, passiveOnly, minutesPour, Q, C };

// ---- Parcours de TOUTE la séquence ---------------------------------
//
// On avance cycle par cycle. À chaque défi on estime le temps, puis on
// FAIT PROGRESSER le joueur comme s'il l'avait accompli — sinon les
// cycles suivants seraient estimés sur un joueur de niveau 1.
function etatInitial() {
  return {
    tapPower: 1, coins: 0, totalEarned: 0, autoClickers: {}, upgradeLevels: {},
    sanctuaryLevel: 0, veilleurLevel: 0, critLevel: 0, critDamageLevel: 0,
    essence: 0, ascension: 0, ownedCount: 1, ownedIds: [], deckCount: 1,
    maxCreatureLevel: 1, maxEvolutionTier: 0, advLevelReached: 0, tapUpgrades: {},
    totalSummons: 0, totalCrits: 0, goldenClaimed: 0, offering: 0,
    powerActivated: 0, runeBought: 0, runeEquipped: 0, runeFused: 0,
    battleWon: 0, maxTranseHoldSec: 0, maxCombo: 1, tapUpgrades: [],
    passiveIncome: 0, autoTotal: 0,
  };
}

// ⚠️ Remet l'économie à zéro, comme le fait une vraie Ascension.
//
// Sans ça, l'audit simulait un joueur qui GARDE sa production après
// l'Ascension : il annonçait « obtiens 55 000 pièces » pour le défi
// suivant, alors qu'en jeu la production repart de zéro et la cible est
// bien plus basse. L'outil mentait sur toute la partie d'après.
function appliquerAscension(s) {
  s.ascension = (s.ascension || 0) + 1;
  s.coins = 0;
  s.totalEarned = 0;
  s.tapPower = 1;
  s.autoClickers = {};
  s.upgradeLevels = {};
  s.tapUpgrades = {};
  s.sanctuaryLevel = 0;
  s.veilleurLevel = 0;
  s.critLevel = 0;
  s.passiveIncome = passiveOnly(s);
}

// Applique l'effet d'un défi accompli sur l'état du joueur.
function appliquer(q, cible, s) {
  if (q.metric === 'ascension') {
    // Le joueur monte AU TOTAL demandé : autant d'Ascensions qu'il faut.
    const vise = Math.max(cible, 1);
    while ((s.ascension || 0) < vise) appliquerAscension(s);
    return;
  }
  const m = q.metric || '';
  if (q.mode === 'delta') { s[m] = (s[m] || 0) + cible; }
  else if (m.startsWith('upgrade:')) s.upgradeLevels[m.slice(8)] = cible;
  else if (m.startsWith('auto:')) s.autoClickers[m.slice(5)] = cible;
  // `tapUpgrades` est un OBJET id -> niveau, pas une liste.
  else if (m.startsWith('tapUpgrade:')) s.tapUpgrades = { ...(s.tapUpgrades || {}), [m.slice(11)]: cible };
  else s[m] = Math.max(s[m] || 0, cible);
  if (m === 'totalSummons') { s.ownedCount += cible; }
  s.passiveIncome = passiveOnly(s);
}

function audit() {
  const s = etatInitial();
  // Le joueur possède TOUT : on cherche les défis absurdes, pas les
  // défis bloqués par la collection (déjà couvert par questFeasible).
  s.ownedIds = C.CREATURES.map((c) => c.id);
  const lignes = [];
  let total = 0;
  Q.QUEST_SEQUENCE.forEach((cycle, ci) => {
    let totalCycle = 0;
    cycle.forEach((q) => {
      const cible = q.target || Q.resolveQuestTarget(q, s);
      const min = minutesPour(q, cible, s);
      // ⚠️ Le joueur GAGNE des pièces pendant qu'il fait le défi. Sans
      // ce cumul, tout défi conditionné par un seuil de pièces gagnées
      // (l'Ascension) était estimé comme si le joueur repartait de zéro.
      if (min != null) s.totalEarned = (s.totalEarned || 0) + production(s) * 60 * min;
      appliquer(q, cible, s);
      const estime = min == null ? null : Math.round(min);
      if (estime != null) { totalCycle += estime; total += estime; }
      lignes.push({ cycle: ci + 1, id: q.id, metric: q.metric, cible, min: estime });
    });
    lignes.push({ cycle: ci + 1, resume: true, min: totalCycle });
  });
  return { lignes, total, etat: s };
}
module.exports.audit = audit;
// Exportés pour les analyses ponctuelles (seuils, économie) : elles ont
// besoin de rejouer le parcours avec leurs propres mesures.
module.exports.etatInitial = etatInitial;
module.exports.appliquer = appliquer;

if (require.main === module) {
  const { lignes, total } = audit();
  console.log('AUDIT DE LA SÉQUENCE DES DÉFIS');
  console.log('Hypothèses :', JSON.stringify(H));
  console.log('');
  const SEUIL = 90; // minutes : au-delà, un seul défi bloque une soirée
  let alertes = 0;
  lignes.forEach((l) => {
    if (l.resume) { console.log(`   └─ cycle ${l.cycle} : ~${l.min} min\n`); return; }
    const t = l.min == null ? 'NON ESTIMABLE' : `${l.min} min`;
    const flag = l.min == null ? '  ⚠️ métrique non modélisée'
      : l.min > SEUIL ? `  ⚠️ TROP LONG` : '';
    if (flag) alertes++;
    console.log(`  c${String(l.cycle).padStart(2)} ${l.id.padEnd(18)} ${String(l.cible).padStart(10)}  ${t.padStart(14)}${flag}`);
  });
  console.log(`TOTAL : ~${Math.round(total / 60)} h de jeu pour toute la séquence`);
  console.log(`Alertes : ${alertes}`);
}

// ---- Recherche de cibles CORRIGÉES ---------------------------------
//
// Pour chaque défi hors d'échelle, cherche la plus grande cible tenant
// sous le plafond de minutes. Rend le travail d'équilibrage mécanique
// au lieu de le laisser à l'intuition.
function proposerCibles(plafondMin = 45) {
  const s = etatInitial();
  s.ownedIds = C.CREATURES.map((c) => c.id);
  const props = [];
  Q.QUEST_SEQUENCE.forEach((cycle, ci) => {
    cycle.forEach((q) => {
      const cible = q.target || Q.resolveQuestTarget(q, s);
      const min = minutesPour(q, cible, s);
      if (min != null && min > plafondMin && q.target) {
        // Dichotomie sur la cible
        let bas = 1, haut = cible, best = 1;
        for (let i = 0; i < 40; i++) {
          const mid = Math.floor((bas + haut) / 2);
          if (mid <= 1) break;
          const t = minutesPour(q, mid, s);
          if (t != null && t <= plafondMin) { best = mid; bas = mid + 1; } else haut = mid - 1;
        }
        props.push({ cycle: ci + 1, id: q.id, avant: cible, apres: best,
                     minAvant: Math.round(min), minApres: Math.round(minutesPour(q, best, s)) });
      }
      appliquer(q, cible, s);
    });
  });
  return props;
}
module.exports.proposerCibles = proposerCibles;

// ---- Audit du POOL dynamique ---------------------------------------
//
// Le pool remplace les défis écartés. Ses cibles à valeur FIXE ne
// s'adaptent pas au joueur : ce sont elles qui peuvent être absurdes.
function auditPool(plafondMin = 45) {
  const etats = [
    ['debut', { ...etatInitial(), tapPower: 5, autoClickers: { esprit: 5 } }],
    ['milieu', { ...etatInitial(), tapPower: 20, autoClickers: { esprit: 40, golem: 8 }, sanctuaryLevel: 5, ownedCount: 8 }],
    ['avance', { ...etatInitial(), tapPower: 40, autoClickers: { esprit: 150, golem: 60 }, sanctuaryLevel: 10, essence: 200, ownedCount: 18 }],
  ];
  const mauvais = [];
  Q.QUEST_POOL.forEach((q) => {
    if (!q.target) return;                 // cible calculée : s'adapte déjà
    etats.forEach(([lbl, s]) => {
      s.ownedIds = C.CREATURES.map((c) => c.id);
      const min = minutesPour(q, q.target, s);
      if (min != null && min > plafondMin) mauvais.push({ id: q.id, etat: lbl, cible: q.target, min: Math.round(min) });
    });
  });
  return mauvais;
}
module.exports.auditPool = auditPool;

// ---- Second critère : la CORVÉE ------------------------------------
//
// Le temps ne dit pas tout. « Invoque 30 créatures » coûte peu de pièces
// mais demande 30 APPUIS successifs sur le même bouton : c'est pénible
// sans être long. Ce critère compte les actions RÉPÉTÉES et délibérées.
const METRIQUES_ACTION = {
  totalSummons: 'invocations', offering: 'offrandes', runeBought: 'achats de rune',
  runeFused: 'fusions', runeEquipped: 'équipements', ascension: 'ascensions',
  battleWon: 'combats', powerActivated: 'activations', goldenClaimed: 'cibles dorées',
};
function actionsRequises(q, cible) {
  if (!METRIQUES_ACTION[q.metric]) return null;
  return { nb: cible, quoi: METRIQUES_ACTION[q.metric] };
}
function auditCorvee(plafondActions = 12) {
  const res = [];
  const vus = new Set();
  [...Q.QUEST_SEQUENCE.flat(), ...Q.QUEST_POOL].forEach((q) => {
    if (!q.target || vus.has(q.id)) return;
    vus.add(q.id);
    const a = actionsRequises(q, q.target);
    if (a && a.nb > plafondActions) res.push({ id: q.id, ...a });
  });
  return res;
}
module.exports.auditCorvee = auditCorvee;

// ---- Cohérence LIBELLÉ / CIBLE --------------------------------------
//
// Bug réel : « Monte Pacte au niveau 7 » se validait au niveau 5. Le
// libellé et la condition lisaient la cible à deux endroits différents.
// Ce contrôle compare, pour CHAQUE défi, le nombre affiché au nombre
// réellement exigé.
function auditLibelles() {
  const etats = [
    ['debut', { ...etatInitial(), tapPower: 4, autoClickers: { esprit: 3 }, passiveIncome: 6 }],
    ['milieu', { ...etatInitial(), tapPower: 20, autoClickers: { esprit: 40 }, sanctuaryLevel: 5, passiveIncome: 400, coins: 3e5, totalEarned: 4e6 }],
    ['avance', { ...etatInitial(), tapPower: 45, autoClickers: { esprit: 150 }, sanctuaryLevel: 10, essence: 200, ascension: 3, passiveIncome: 2e4, coins: 5e7, totalEarned: 9e8 }],
  ];
  const ecarts = [];
  const tous = [...Q.QUEST_SEQUENCE.flat(), ...Q.QUEST_POOL];
  etats.forEach(([lbl, s]) => {
    s.ownedIds = C.CREATURES.map((c) => c.id);
    tous.forEach((q) => {
      const cible = Q.effectiveQuestTarget(q.id, s, {});
      const texte = Q.questLabel(q.id, null, s, {});
      // Nombres présents dans le libellé, séparateurs de milliers retirés
      // ⚠️ Faux positifs à écarter, sinon le contrôle devient du bruit
      // et on cesse de le lire :
      //  - « 14 millions » : le nombre affiché n'est pas la cible brute ;
      //  - « chapitre 2, niveau 5 » : deux nombres qui désignent un
      //    niveau ABSOLU (15), aucun ne vaut la cible ;
      //  - « Transe x2,5 » : la cible est en dixièmes.
      // ⚠️ « chapitre » N'EST PLUS un faux positif.
      //
      // Il l'était tant que les libellés d'Aventure écrivaient leur
      // chapitre en dur — et c'est justement ce qui a masqué un bug réel :
      // le texte annonçait « chapitre 2, niveau 10 » pendant que la barre
      // comptait sur 25. Un filtre destiné à réduire le bruit avait
      // rendu le contrôle aveugle à la seule chose qu'il devait voir.
      //
      // Les libellés d'Aventure étant désormais dérivés de la cible, on
      // les VÉRIFIE : chapitre et niveau doivent correspondre.
      if (/chapitre/i.test(texte)) {
        const mm = texte.match(/chapitre\s+(\d+).*?niveau\s+(\d+)/i);
        if (mm) {
          const attendu = (parseInt(mm[1], 10) - 1) * 10 + parseInt(mm[2], 10);
          if (attendu !== Math.round(cible)) {
            ecarts.push({ id: q.id, etat: lbl, cible, texte });
          }
        }
        return;
      }
      // ⚠️ TROISIÈME FOIS que ce contrôle est rendu aveugle par un filtre
      // « anti-bruit ». Il écartait tout libellé contenant `x<chiffre>`,
      // à cause du multiplicateur de Transe (« Transe x2,5 »). Résultat :
      // `seq_transe30` annonçait « pendant 42 secondes » EN DUR, sans
      // jamais lire sa cible, et le contrôle ne l'a jamais vu.
      //
      // On ne saute plus le libellé : on RETIRE le token multiplicateur
      // et on vérifie ce qui reste.
      const nettoye = texte.replace(/[x\u00d7]\s*\d+([.,]\d+)?/gi, ' ');
      // ⚠️ Lire les DÉCIMALES : « 1.7 millions » se découpait en 1 et 7,
      // et le contrôle sortait deux faux positifs.
      const nums = (nettoye.replace(/\u202f|\u00a0/g, ' ').match(/\d[\d ]*([.,]\d+)?/g) || [])
        .map((x) => parseFloat(x.replace(/ /g, '').replace(',', '.')));
      if (!nums.length) return;                    // libellé sans nombre : rien à vérifier
      // Nombres abrégés (« 14 millions ») : la cible vaut le nombre
      // multiplié par son ordre de grandeur.
      const echelles = /milliard/i.test(nettoye) ? [1e9]
        : /million/i.test(nettoye) ? [1e6]
        : /millier/i.test(nettoye) ? [1e3] : [1];
      const cibleArrondie = Math.round(cible);
      const ok = nums.some((n) => echelles.some((e) => {
        const v = n * e;
        return e === 1 ? v === cibleArrondie : Math.abs(v - cible) / Math.max(1, cible) < 0.1;
      }));
      if (!ok) ecarts.push({ id: q.id, etat: lbl, cible, texte });
    });
  });
  return ecarts;
}
module.exports.auditLibelles = auditLibelles;

// ---- Cohérence structurelle des défis ---------------------------------
//
// Lit les métriques RÉELLEMENT publiées par l'écran du Clicker et les
// confronte aux métriques exigées par les défis. Une métrique mal
// orthographiée ou oubliée renvoie 0 en silence : le défi ne progresse
// jamais et rien ne le signale à l'exécution.
function metriquesPubliees() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'screens', 'games', 'ClickerScreen.js'), 'utf8');
  const i = src.indexOf('const questStats = {');
  const j = src.indexOf('\n  };', i);
  const bloc = src.slice(i, j);
  const cles = new Set();
  // `cle: valeur`
  for (const m of bloc.matchAll(/^\s*(\w+)\s*:/gm)) cles.add(m[1]);
  // raccourcis `a, b, c,` sur une même ligne
  for (const m of bloc.matchAll(/^\s{4}([\w,\s]+),\s*$/gm)) {
    m[1].split(',').forEach((x) => { const t = x.trim(); if (t) cles.add(t); });
  }
  return [...cles];
}

function auditCoherence() {
  return Q.validateQuests(metriquesPubliees());
}
module.exports.auditCoherence = auditCoherence;
module.exports.metriquesPubliees = metriquesPubliees;

// ---- Cohérence MODE / libellé ----------------------------------------
//
// Un défi en `delta` compte une progression DEPUIS SON TIRAGE ; un défi
// en `absolute` vise un TOTAL atteint. Se tromper de mode donne un défi
// qui ne se valide jamais.
//
// Cas réel : « Fais une seconde Ascension » était en `delta` avec une
// cible de 2, donc il réclamait 2 Ascensions DE PLUS — soit 3 au total
// pour un joueur qui en avait déjà une. Le texte annonçait le rang, la
// condition comptait un supplément.
//
// Un libellé qui parle d'un TOTAL ou d'un RANG (« atteins », « possède »,
// « monte au niveau », « seconde ») avec un mode `delta` est suspect.
const MOTS_DE_TOTAL = /atteins|poss[eè]de|monte|termine|seconde|deuxi[eè]me|troisi[eè]me|jusqu/i;

function auditModes() {
  const suspects = [];
  const tous = [...Q.QUEST_SEQUENCE.flat(), ...Q.QUEST_POOL];
  tous.forEach((q) => {
    if (q.mode !== 'delta') return;
    const texte = Q.questLabel(q.id, q.target || 5, {}, {});
    if (MOTS_DE_TOTAL.test(texte)) suspects.push({ id: q.id, texte });
  });
  return suspects;
}
module.exports.auditModes = auditModes;

// ---- Divergence des cibles avec les ASCENSIONS ------------------------
//
// Bug réel de cette session : le défi qui SUIT une Ascension s'allongeait
// indéfiniment. Cause — le budget ne voyait pas le revenu de TAP, or
// juste après une Ascension le passif vaut ZÉRO et le tap est la seule
// source ; un PLANCHER adossé au seuil d'Ascension avait été ajouté pour
// compenser, mais ce seuil DOUBLE quand la production ne monte que de
// 30 %. Mesuré avant correction, pour « obtiens N pièces » : 2 min à la
// 0e Ascension, puis 48 · 74 · 113 · 174 min. Une divergence sans fin.
//
// Ce contrôle mesure le temps d'un défi JUSTE APRÈS chaque Ascension et
// signale ceux qui s'allongent plus vite que la borne.
//
// Borne : les cibles montent de 45 % par Ascension et la production de
// 30 %, donc le temps doit croître de ~11,5 % par Ascension — soit ×1,55
// sur 4 Ascensions. On laisse passer jusqu'à ×2,2 avant d'alerter.
// ⚠️ On mesure le TEMPS MAXIMAL atteint, pas le rapport début/fin.
//
// Première version : rapport `temps(asc 4) / temps(asc 0)`. Elle
// signalait 4 défis de NIVEAU (Veilleur, améliorations) qui ne divergent
// pas du tout — leur cible avance par niveaux ENTIERS dont le coût
// double, donc leur temps fait des DENTS DE SCIE (17 · 46 · 35 · 27 · 60
// min) et non une montée. Comparer deux extrémités d'une dent de scie ne
// mesure rien. Le seuil en temps absolu répond directement à la question
// posée par le bug : « ce défi devient-il interminable à force
// d'Ascensions ? »
// On compare le temps réel à la FENÊTRE que le défi déclare
// (`effortMin`) : c'est exactement ce que le bug violait — un défi
// annoncé pour 30 min qui en demandait 174.
//
// Dérive attendue : cibles +45 % par Ascension contre production +30 %,
// soit ×1,55 sur 4 Ascensions. On alerte au-delà de ×2,5.
const ASC_DEPASSEMENT_MAX = 2.5;

function etatApresAscension(n) {
  const s = etatInitial();
  s.ownedIds = C.CREATURES.map((c) => c.id);
  s.ascension = n;
  s.passiveIncome = passiveOnly(s);
  return s;
}

function auditAscension(depassementMax = ASC_DEPASSEMENT_MAX, ascMax = 4) {
  const suspects = [];
  // ⚠️ Mesuré à la cadence sur laquelle le BUDGET est calibré, sinon un
  // simple écart de cadence ajouterait une pénalité constante qui
  // noierait la dérive qu'on cherche.
  const cadence = H.tapsParSec;
  H.tapsParSec = HUMAIN;
  const tous = [...Q.QUEST_SEQUENCE.flat(), ...Q.QUEST_POOL];
  const vus = new Set();
  tous.forEach((q) => {
    // Seuls les défis à cible CALCULÉE dépendent du budget.
    if ((!q.effortMin && !q.partAsc) || vus.has(q.id)) return;
    vus.add(q.id);
    const temps = [];
    for (let n = 0; n <= ascMax; n++) {
      const s = etatApresAscension(n);
      // ⚠️ N'ÉVALUER QUE LES DÉFIS RÉELLEMENT PROPOSABLES dans cet état.
      //
      // Sans ce filtre le contrôle sortait 31 alertes, dont « possède N
      // Étoiles Filantes » à 6,4 MILLIARDS de minutes : un défi que le
      // tirage n'offre jamais à un joueur qui vient d'ascendre, puisque
      // `available()` l'écarte. Un contrôle qui hurle sur des cas
      // impossibles cesse d'être lu — c'est aussi nuisible qu'un
      // contrôle aveugle.
      if (!Q.questFeasible(q, s)) continue;
      const t = minutesPour(q, Q.resolveQuestTarget(q, s), s);
      if (t != null) temps.push({ asc: n, min: Math.round(t) });
    }
    if (!temps.length) return;
    const pire = temps.reduce((a, b) => (b.min > a.min ? b : a));
    // ⚠️ Le pire cas doit se produire APRÈS au moins une Ascension.
    //
    // Sinon le contrôle sort des défis dont la courbe DESCEND
    // (`seq_main10` : 65/50/38/30/23 min) — l'inverse d'une divergence.
    // Ce sont des défis quantifiés sur un générateur cher : la 1re unité
    // pèse lourd pour un joueur à zéro, et l'Ascension les allège.
    //
    // Exclusion justifiée, comme l'exige la règle : un pire cas à
    // l'Ascension 0 ne met en cause aucune Ascension, et il est DÉJÀ
    // mesuré par `audit()` — dans l'état réel où le défi est tiré, ce qui
    // est une meilleure sonde qu'une économie vide. `seq_main10` y vaut
    // 22 min, pas 65.
    // ⚠️ Deux règles, parce que les deux écritures ne déclarent pas la
    // même chose. `effortMin` annonce une fenêtre en minutes : on vérifie
    // qu'elle n'est pas dépassée. `partAsc` annonce une PART du chemin
    // vers l'Ascension, pas une durée — on vérifie alors simplement que
    // le défi ne devient jamais interminable, au même plafond que le
    // reste de l'audit.
    if (pire.asc < 1) return;
    if (q.partAsc) {
      if (pire.min > 90) {
        suspects.push({ id: q.id, part: q.partAsc, asc: pire.asc, min: pire.min,
                        courbe: temps.map((t) => t.min).join('/') });
      }
      return;
    }
    if (pire.min > q.effortMin * depassementMax) {
      suspects.push({ id: q.id, fenetre: q.effortMin, asc: pire.asc, min: pire.min,
                      fois: +(pire.min / q.effortMin).toFixed(1),
                      courbe: temps.map((t) => t.min).join('/') });
    }
  });
  H.tapsParSec = cadence;
  return suspects;
}
module.exports.auditAscension = auditAscension;
module.exports.etatApresAscension = etatApresAscension;

// ---- Cibles FIXES sur une métrique à ÉCHELLE DÉRIVÉE ----------------
//
// Bug réel du 17/09 : `seq_sanct10` visait « Sanctuaire niveau 8 » en
// dur. Après le découpage des niveaux par LEVEL_SPLIT, 8 ne valait plus
// qu'un CINQUIÈME du bonus visé. Le joueur finissait la séquence avec un
// multiplicateur global de x1,04 au lieu de x1,20, toute sa production
// s'effondrait, et la 2e Ascension passait de 24 à 694 minutes. Même
// défaut sur `seq_pacte20` (9 anciens niveaux).
//
// Règle : une métrique dont l'ÉCHELLE est définie ailleurs dans le code
// (niveaux, pièces) ne doit JAMAIS porter de cible en dur — sinon elle
// périme en silence au premier changement d'équilibrage. Ces défis-là
// s'écrivent en `effortMin` et se recalculent seuls.
//
// Les métriques de COMPTAGE (combats gagnés, runes achetées, offrandes,
// niveau d'Aventure) gardent leurs cibles fixes : leur échelle est un
// nombre d'actions, elle ne bouge pas quand on rééquilibre l'économie.
const METRIQUES_A_ECHELLE = [
  'tapPower', 'sanctuaryLevel', 'veilleurLevel', 'critLevel', 'critDamageLevel',
  'coins', 'totalEarned', 'passiveIncome', 'autoTotal',
];

function metriqueAEchelle(m) {
  if (!m) return false;
  if (METRIQUES_A_ECHELLE.includes(m)) return true;
  // Générateurs et améliorations : leur coût est une courbe, donc leur
  // échelle aussi.
  return m.startsWith('auto:') || m.startsWith('upgrade:') || m.startsWith('tapUpgrade:');
}

function auditCiblesFixes() {
  const suspects = [];
  const vus = new Set();
  [...Q.QUEST_SEQUENCE.flat(), ...Q.QUEST_POOL].forEach((q) => {
    if (!q || vus.has(q.id)) return;
    vus.add(q.id);
    if (!q.target || q.effortMin) return;
    if (!metriqueAEchelle(q.metric)) return;
    suspects.push({ id: q.id, metric: q.metric, target: q.target });
  });
  return suspects;
}
module.exports.auditCiblesFixes = auditCiblesFixes;

// ---- Cibles ABSOLUES qui s'emballent au fil des passages -------------
//
// Bug réel du 17/09 : le plancher « toujours +15 % au-dessus de ce que le
// joueur a déjà » se recompose à chaque passage de la séquence. La tenue
// de Transe passait de 25 s à 56, puis 641 SECONDES au 4e groupe — dix
// minutes de Transe ininterrompue, impossible.
//
// On rejoue la séquence sur 5 passages et on signale toute cible
// absolue qui dépasse 3x sa valeur du premier passage sans déclarer de
// `cap`.
function auditEmballement(facteurMax = 3, passages = 5) {
  const suspects = [];
  const s = etatInitial();
  s.ownedIds = C.CREATURES.map((c) => c.id);
  s.ownedCount = s.ownedIds.length;
  s.deckCount = 3;
  const premiere = {};
  const pire = {};
  for (let p = 0; p < passages; p++) {
    Q.QUEST_SEQUENCE.forEach((cycle, ci) => {
      cycle.forEach((q) => {
        if (q.mode !== 'absolute') return;
        const cible = q.target || q.partAsc || q.step ? Q.resolveQuestTarget(q, s) : null;
        if (cible == null) return;
        if (premiere[q.id] == null) premiere[q.id] = cible;
        pire[q.id] = Math.max(pire[q.id] || 0, cible);
        const min = minutesPour(q, cible, s);
        if (min != null) s.totalEarned = (s.totalEarned || 0) + production(s) * 60 * min;
        appliquer(q, cible, s);
      });
    });
  }
  Q.QUEST_SEQUENCE.flat().forEach((q) => {
    if (q.mode !== 'absolute' || q.cap) return;
    if (!premiere[q.id] || premiere[q.id] <= 0) return;
    // Les métriques de PROGRESSION montent normalement : on ne regarde
    // que celles qui mesurent une PERFORMANCE, bornée par l'humain.
    if (!['maxTranseHoldSec', 'maxCombo'].includes(q.metric)) return;
    const f = pire[q.id] / premiere[q.id];
    if (f > facteurMax) {
      suspects.push({ id: q.id, metric: q.metric, premiere: premiere[q.id], pire: pire[q.id], fois: +f.toFixed(1) });
    }
  });
  return suspects;
}
module.exports.auditEmballement = auditEmballement;

// ---- Défis dont la condition `available` n'est JAMAIS vraie ----------
//
// Bug réel du 17/09 : deux défis d'objet testaient
// `ownedIds.includes('braisillon')` alors que la créature de « Griffe de
// Braisillon » s'appelle `pyrosile`. La condition était toujours fausse,
// le défi n'était jamais tiré, et le pool le remplaçait en silence. Le
// schéma affiché dans le doc ne correspondait donc pas au jeu, et aucun
// contrôle ne le voyait.
function auditAvailable() {
  const muets = [];
  // Joueur qui a TOUT : si `available` est encore faux ici, elle ne peut
  // jamais être vraie.
  const s = etatInitial();
  s.ownedIds = C.CREATURES.map((c) => c.id);
  s.ownedCount = s.ownedIds.length;
  s.deckCount = 3;
  // ⚠️ Un joueur DÉMESURÉ, pas juste avancé. Première version : le
  // contrôle sortait 11 défis dont 9 parfaitement légitimes (combos,
  // générateurs de haut palier) — leur condition devient vraie plus tard,
  // pas jamais. Un contrôle qui hurle sur des cas normaux cesse d'être
  // lu ; on met donc la sonde hors de portée de toute condition
  // légitime, et ce qui résiste est vraiment mort.
  s.tapPower = 200; s.passiveIncome = 1e12; s.coins = 1e15; s.totalEarned = 1e16;
  s.maxCombo = 500; s.goldenClaimed = 5000; s.totalCrits = 1e6; s.powerActivated = 5000;
  s.offering = 500; s.runeFused = 200; s.runesEquipped = 6; s.advLevelReached = 120;
  s.maxEvolutionTier = 3; s.totalTaps = 1e7; s.threeStarLevel = 50; s.autoTotal = 500;
  s.sanctuaryLevel = 20; s.veilleurLevel = 20; s.critLevel = 10; s.critDamageLevel = 10;
  s.ascension = 3; s.runeBought = 20; s.maxCreatureLevel = 40; s.battleWon = 100;
  s.tapUpgrades = {};
  C.TAP_UPGRADES.forEach((t) => { s.tapUpgrades[t.id] = 10; });
  s.autoClickers = {};
  C.AUTOCLICKERS.forEach((a) => { s.autoClickers[a.id] = 50; });
  s.upgradeLevels = {};
  C.UPGRADE_ITEMS.forEach((u) => { s.upgradeLevels[u.id] = 3; });
  [...Q.QUEST_SEQUENCE.flat(), ...Q.QUEST_POOL].forEach((q) => {
    if (typeof q.available !== 'function') return;
    let ok = false;
    try { ok = !!q.available(s); } catch (e) { ok = false; }
    if (!ok) muets.push({ id: q.id, metric: q.metric });
  });
  return muets;
}
module.exports.auditAvailable = auditAvailable;

// ---- Deux défis qui se lisent PAREIL dans le même œuf ----------------
//
// Bug réel du 17/09, signalé par l'auteur sur capture d'écran : un œuf
// contenait « Mets 78 000 pièces de côté » ET « Constitue un trésor de
// 180 000 pièces » ET « Gagne 41 000 pièces ». Trois métriques
// différentes (`coins`, `coins`, `totalEarned`) mais UNE SEULE chose du
// point de vue du joueur — et le troisième paraît absurde après le
// deuxième.
//
// Cause : quand un défi du schéma n'est pas encore débloqué (Sanctuaire,
// Veilleur, paliers de tap), le pool comble le trou SANS regarder ce que
// l'œuf contient déjà.
//
// Ce contrôle rejoue les œufs et signale tout dépassement du plafond de
// famille — l'ÉCONOMIE étant limitée à un seul défi par œuf.
function auditFamilles(nbOeufs = 18) {
  const fautes = [];
  const s = etatInitial();
  s.ownedIds = []; s.ownedCount = 0; s.deckCount = 0;
  for (let oeuf = 0; oeuf < nbOeufs; oeuf++) {
    const set = Q.nextQuestSet(oeuf, [], s);
    const compte = {};
    set.ids.forEach((id) => {
      const q = Q.findQuest(id);
      if (!q) return;
      const f = Q.familleDe(q.metric);
      compte[f] = (compte[f] || 0) + 1;
      const cible = Q.effectiveQuestTarget(id, s, set.targets || {});
      const min = minutesPour(q, cible, s);
      if (min != null) s.totalEarned = (s.totalEarned || 0) + production(s) * 60 * min;
      appliquer(q, cible, s);
    });
    Object.entries(compte).forEach(([f, n]) => {
      // ⚠️ Doit refléter `MAX_PAR_FAMILLE` du moteur. Un contrôle qui
      // recopie une règle finit par mentir quand la règle bouge — on lit
      // donc la même table.
      const max = { economie: 1, runes: 1, creatures: 1, offrande: 1, ascension: 1 }[f] || 2;
      if (n > max) fautes.push({ oeuf: oeuf + 1, famille: f, nb: n, max });
    });
    const nv = C.CREATURES[Math.min(oeuf, C.CREATURES.length - 1)];
    if (nv && !s.ownedIds.includes(nv.id)) s.ownedIds.push(nv.id);
    s.ownedCount = s.ownedIds.length;
    s.deckCount = Math.min(3, s.ownedCount);
    s.passiveIncome = passiveOnly(s);
  }
  return fautes;
}
module.exports.auditFamilles = auditFamilles;

// ---- Défis qui dépendent de POSSÉDER une créature précise -----------
//
// Bug réel, signalé trois fois par l'auteur. Les 20 défis d'objet de
// créature étaient générés avec un `available` qui ne testait QUE le
// prix, jamais l'appartenance de la créature. La boutique, elle,
// verrouille le bouton (« Nécessite <créature> »). Le défi pouvait donc
// être tiré pour un joueur qui n'a pas la créature — et bloquait son œuf
// DÉFINITIVEMENT.
//
// La famille a été supprimée. Ce contrôle empêche qu'elle revienne :
// aucun défi ne doit viser une amélioration de créature.
function auditDependanceCreature() {
  const fautes = [];
  [...Q.QUEST_SEQUENCE.flat(), ...Q.QUEST_POOL].forEach((q) => {
    if (!q || !q.metric) return;
    if (!q.metric.startsWith('upgrade:')) return;
    const item = C.UPGRADE_ITEMS.find((u) => u.id === q.metric.slice(8));
    fautes.push({ id: q.id, metric: q.metric, creature: item ? item.creatureId : '?' });
  });
  return fautes;
}
module.exports.auditDependanceCreature = auditDependanceCreature;

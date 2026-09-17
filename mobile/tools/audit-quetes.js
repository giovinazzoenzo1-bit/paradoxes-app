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
const H = {
  tapsParSec: 4,          // cadence humaine, sans autoclicker
  minParSession: 20,      // durée d'une session type
  energieMax: 5,          // tentatives d'Aventure avant recharge
  diamantsParJour: 21,    // plafond des boss
  griffesParCombat: 20,   // gain moyen en Aventure
  doreeParMin: 0.5,       // cibles dorées par minute
  pouvoirParMin: 1.2,     // activations de pouvoir par minute
};

function production(s) {
  return C.passiveRate({
    autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
    sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: s.ascension,
  }) + C.tapDamage(s.tapPower) * H.tapsParSec;
}

// Minutes estimées pour franchir un défi, selon sa métrique.
// `null` = infaisable (doit être signalé).
function minutesPour(q, cible, s) {
  const prod = Math.max(1, production(s));
  const m = q.metric || '';
  const delta = q.mode === 'delta';
  const restant = delta ? cible : Math.max(0, cible - (s[m] || 0));
  if (!delta && (s[m] || 0) >= cible) return 0;

  if (m === 'totalEarned' || m === 'coins') return restant / prod / 60;
  if (m === 'passiveIncome') return null; // dépend des achats, traité à part
  if (m === 'tapPower') { let c = 0; for (let l = s.tapPower; l < cible; l++) c += C.tapPowerCost(l); return c / prod / 60; }
  if (m === 'sanctuaryLevel') { let c = 0; for (let l = s.sanctuaryLevel; l < cible; l++) c += C.sanctuaryUpgradeCost(l); return c / prod / 60; }
  if (m === 'veilleurLevel') { let c = 0; for (let l = s.veilleurLevel; l < cible; l++) c += C.veilleurUpgradeCost(l); return c / prod / 60; }
  if (m.startsWith('upgrade:')) {
    const it = C.UPGRADE_ITEMS.find((u) => u.id === m.slice(8));
    if (!it) return null;
    let c = 0; for (let l = (s.upgradeLevels[it.id] || 0); l < cible; l++) c += C.upgradeItemCost(it, l);
    return c / prod / 60;
  }
  if (m.startsWith('auto:')) {
    const a = C.AUTOCLICKERS.find((x) => x.id === m.slice(5));
    if (!a) return null;
    let c = 0; for (let n = (s.autoClickers[a.id] || 0); n < cible; n++) c += C.autoClickerCost(a, n);
    return c / prod / 60;
  }
  if (m.startsWith('tapUpgrade:')) return 12; // paliers de tap : quelques minutes
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
module.exports = { load, H, production, minutesPour, Q, C };

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
    maxCreatureLevel: 1, maxEvolutionTier: 0, advLevelReached: 0,
    totalSummons: 0, totalCrits: 0, goldenClaimed: 0, offering: 0,
    powerActivated: 0, runeBought: 0, runeEquipped: 0, runeFused: 0,
    battleWon: 0, maxTranseHoldSec: 0, maxCombo: 1, tapUpgrades: [],
    passiveIncome: 0, autoTotal: 0,
  };
}

// Applique l'effet d'un défi accompli sur l'état du joueur.
function appliquer(q, cible, s) {
  const m = q.metric || '';
  if (q.mode === 'delta') { s[m] = (s[m] || 0) + cible; }
  else if (m.startsWith('upgrade:')) s.upgradeLevels[m.slice(8)] = cible;
  else if (m.startsWith('auto:')) s.autoClickers[m.slice(5)] = cible;
  else if (m.startsWith('tapUpgrade:')) s.tapUpgrades = [...new Set([...s.tapUpgrades, m.slice(11)])];
  else s[m] = Math.max(s[m] || 0, cible);
  if (m === 'totalSummons') { s.ownedCount += cible; }
  s.passiveIncome = production(s);
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
      if (/million|milliard|millier|chapitre|x\d/i.test(texte)) return;
      const nums = (texte.replace(/\u202f|\u00a0/g, ' ').match(/\d[\d ]*/g) || [])
        .map((x) => parseInt(x.replace(/ /g, ''), 10));
      if (!nums.length) return;                    // libellé sans nombre : rien à vérifier
      if (!nums.includes(Math.round(cible))) ecarts.push({ id: q.id, etat: lbl, cible, texte });
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

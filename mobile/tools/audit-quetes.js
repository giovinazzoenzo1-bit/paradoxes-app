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

// ⚠️⚠️ LE DÉFI D'ASCENSION SE MESURE AVEC L'ÉCONOMIE, PAS À PRODUCTION
// GELÉE.
//
// Il demande d'atteindre le SEUIL d'Ascension — plusieurs heures de jeu
// pendant lesquelles le joueur réinvestit en permanence. Le compter en
// divisant le seuil par la production du moment donnait 16 636 062
// minutes pour la 4e Ascension, là où le simulateur d'économie mesure
// 3,4 heures. C'est ce seul défi qui faisait ressortir le groupe 4 à
// 279 670 heures dans la liste de référence.
//
// On rejoue donc l'économie : achats au meilleur rapport, production
// recalculée après chacun, exactement comme un joueur.
function heuresPourSeuil(ascension, seuil) {
  const st = etatInitial();
  st.ascension = ascension;
  let t = 0, garde = 0;
  while ((st.totalEarned || 0) < seuil && garde++ < 8000) {
    const r = Math.max(1, production(st));
    const opts = [];
    const essaie = (cout, appliquerAchat) => {
      if (!isFinite(cout) || cout <= 0) return;
      const copie = JSON.parse(JSON.stringify(st));
      appliquerAchat(copie);
      const gain = production(copie) - r;
      if (gain > 0) opts.push({ cout, gain, appliquerAchat });
    };
    essaie(C.tapPowerCost(st.tapPower), (x) => { x.tapPower += 1; });
    C.AUTOCLICKERS.forEach((a) => {
      const n = (st.autoClickers || {})[a.id] || 0;
      essaie(C.autoClickerCost(a, n), (x) => { x.autoClickers[a.id] = n + 1; });
    });
    if (!opts.length) { t += (seuil - (st.totalEarned || 0)) / r; break; }
    opts.forEach((o) => { o.score = Math.max(0, (o.cout - (st.coins || 0)) / r) + o.cout / o.gain; });
    opts.sort((a, b) => a.score - b.score);
    const v = opts[0];
    const attente = Math.max(0, (v.cout - (st.coins || 0)) / r);
    const restant = (seuil - (st.totalEarned || 0)) / r;
    if (attente >= restant) { t += restant; break; }
    t += attente;
    st.coins = (st.coins || 0) + r * attente - v.cout;
    st.totalEarned = (st.totalEarned || 0) + r * attente;
    v.appliquerAchat(st);
  }
  return t / 60;
}

function minutesPour(q, cible, s) {
  if (q.metric === 'ascension') {
    return heuresPourSeuil(s.ascension || 0, C.ascensionThreshold(s.ascension || 0));
  }
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
  // ⚠️ TROU DE L'INSTRUMENT, comblé le 19/09.
  //
  // `critLevel` et `critDamageLevel` n'étaient pas modélisés : la mesure
  // rendait `?`, et un `?` se lit comme « pas d'info » alors qu'il veut
  // dire « je ne sais pas mesurer ». C'est comme ça que « Monte les
  // Dégâts critiques au niveau 3 » — 918 pièces, moins d'une minute et
  // demie — m'a échappé alors que l'auteur l'a vu du premier coup d'œil.
  //
  // ⚠️ Un `?` dans un tableau de mesures n'est JAMAIS neutre : c'est un
  // angle mort, et c'est exactement là que se cachent les défauts.
  if (m === 'critLevel') return tempsAchatsCumules(s, (x, n) => { x.critLevel = n; }, C.critUpgradeCost, s.critLevel, cible);
  if (m === 'critDamageLevel') return tempsAchatsCumules(s, (x, n) => { x.critDamageLevel = n; }, C.critDamageUpgradeCost, s.critDamageLevel, cible);
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
    // ⚠️ `tapUpgrades` était déclaré DEUX FOIS dans cet objet, et la
    // seconde déclaration — un tableau vide — écrasait la première.
    // Toute lecture d'un palier de tap rendait donc zéro, et le
    // calculateur d'achats ne plafonnait jamais rien : il croyait le
    // joueur à zéro niveau quoi qu'il possède.
    //
    // ⚠️ JavaScript ne signale PAS une clé en double dans un littéral —
    // il garde silencieusement la dernière. Une faute de frappe invisible
    // qui a fait échouer un contrôle pendant vingt minutes.
    battleWon: 0, maxTranseHoldSec: 0, maxCombo: 1,
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
// ⚠️ « Monte X AU niveau N » est un TOTAL ; « monte X DE N niveaux » est
// un DELTA. Le mot « monte » seul ne tranche pas — c'est la préposition
// qui porte le sens, et la confondre faisait rejeter quatre défis
// parfaitement formulés.
const MOTS_DE_TOTAL = /atteins|poss[eè]de|monte\s+\S+.*\bau niveau\b|termine|seconde|deuxi[eè]me|troisi[eè]me|jusqu/i;

// ⚠️ MÉTRIQUES INTERDITES EN MODE `delta`.
//
// Une métrique qui décrit un ÉTAT ATTEINT (nombre d'Ascensions, niveau
// de Pacte, niveau d'Aventure, niveau de créature) ne peut pas s'écrire
// « N de plus » : le libellé annonce un total, le moteur compte un
// écart. C'est exactement le bug signalé par l'auteur — « Fais ta 2e
// Ascension » en mode delta avec une cible de 2 demandait DEUX
// Ascensions de plus, donc trois en tout.
//
// Le contrôle ne regardait que le TEXTE du libellé, via une liste de
// mots. « Fais ta 2e Ascension » ne contient aucun de ces mots : il
// passait au travers. On teste maintenant la MÉTRIQUE, qui ne dépend
// d'aucune tournure de phrase.
const METRIQUES_D_ETAT = [
  'ascension', 'tapPower', 'sanctuaryLevel', 'veilleurLevel', 'critLevel',
  'critDamageLevel', 'advLevelReached', 'maxCreatureLevel', 'maxEvolutionTier',
  'passiveIncome', 'coins', 'autoTotal', 'maxCombo', 'maxTranseHoldSec',
  'ownedCount', 'deckCount',
];

function auditModes() {
  const suspects = [];
  const tous = [...Q.QUEST_SEQUENCE.flat(), ...Q.QUEST_POOL];
  tous.forEach((q) => {
    if (q.mode !== 'delta') return;
    const m = q.metric || '';
    // ⚠️ EXCEPTION VOULUE : un défi d'ACHAT en mode delta dit « achète N
    // de plus », et son compteur part de zéro quand il commence.
    //
    // L'auteur, le 20/09 : « le défi doit être ACHETER N esprits et pas
    // POSSÉDER N, car dans ton ordre le défi s'annule de lui-même ».
    // Exact — en mode absolu, un défi demandant 5 Esprits était déjà
    // rempli si un défi précédent en avait fait acheter 5.
    //
    // Le mode delta est donc le BON mode pour un achat. L'interdiction
    // visait les métriques d'état comme `coins`, où « gagner 100 de
    // plus » n'a pas de sens stable.
    if (m.startsWith('auto:') || m.startsWith('tapUpgrade:')) return;
    if (METRIQUES_D_ETAT.includes(m) || m.startsWith('auto:')
      || m.startsWith('upgrade:') || m.startsWith('tapUpgrade:')) {
      suspects.push({ id: q.id, metric: m, pourquoi: "métrique d'ÉTAT en mode delta" });
      return;
    }
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
    //
    // ⚠️ Les défis en PART DU SEUIL (`partAsc`) en sont exclus depuis le
    // 19/09 : ils sont stables PAR CONSTRUCTION, puisqu'ils demandent
    // toujours la même fraction du chemin vers l'Ascension. Ce contrôle
    // mesure des MINUTES à production figée, or la production de départ
    // d'un groupe monte à chaque Ascension — il voyait donc une
    // divergence (71 min puis 2 857 min) là où la difficulté réelle ne
    // bouge pas.
    //
    // ⚠️ Mesurer la BONNE grandeur importe plus que multiplier les
    // contrôles. Celui-ci garde tout son sens pour `effortMin`.
    if (!q.effortMin || vus.has(q.id)) return;
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
    // ⚠️ Règle mise à jour le 19/09 : une cible fixe est désormais la
    // NORME, à condition de déclarer son échelle de groupe (`echelle`).
    // Ce qui reste interdit, c'est une cible fixe qui ne monterait
    // JAMAIS sur une métrique dont l'échelle bouge avec la partie.
    // ⚠️ Les niveaux d'Aventure n'ont pas d'`echelle` : ils AVANCENT par
    // addition (`PAS_AVENTURE_PAR_GROUPE`), parce que la campagne se
    // poursuit d'une Ascension à l'autre. Ce n'est pas une cible figée.
    // ⚠️ Trois cas légitimes de cible fixe SANS échelle :
    //  - `advLevelReached` : la campagne AVANCE par addition
    //    (`PAS_AVENTURE_PAR_GROUPE`), elle ne se multiplie pas ;
    //  - Sanctuaire et Veilleur : ces mécaniques PLAFONNENT à 50 et leur
    //    coût est concentré tout en haut. Une échelle de groupe les
    //    saturerait dès le 2e groupe. Le joueur repart de zéro à chaque
    //    Ascension et refait le chemin, ce qui est déjà la progression.
    const capee = ['sanctuaryLevel', 'veilleurLevel', 'advLevelReached'].includes(q.metric);
    if (!q.target || q.effortMin || q.echelle || capee) return;
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
      // ⚠️ La table était RECOPIÉE ici. Relever le plafond dans le
      // moteur ne changeait donc rien au contrôle, qui continuait de
      // refuser — exactement le piège que son propre commentaire
      // annonçait. Le moteur l'expose maintenant, et il n'y a plus
      // qu'une seule table.
      const max = Q.plafondFamille(f);
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

// ---- Défis du SCHÉMA remplacés par le pool --------------------------
//
// Bug réel du 19/09, signalé par l'auteur : « les défis que j'ai ne
// correspondent pas au .md ». Il avait raison.
//
// La boutique se déverrouille en cascade — Pacte 5 -> Faveur -> Dégâts
// critiques -> Sanctuaire -> Veilleur — mais le schéma demandait le
// Sanctuaire dès l'œuf 2, alors que RIEN ne poussait le joueur à acheter
// les deux maillons d'avant. Le défi était donc écarté faute de
// déblocage et le pool le remplaçait en silence : 8 défis sur 12 œufs.
//
// Ce contrôle rejoue un joueur qui suit SES DÉFIS et rien d'autre, et
// signale tout défi du schéma qui se fait remplacer. Zéro est la seule
// valeur acceptable : le schéma est ce que l'auteur valide, le pool
// n'est là que pour les cycles au-delà de la séquence.
function auditRemplacements(nbOeufs = 12) {
  const fautes = [];
  const s = etatInitial();
  s.ownedIds = []; s.ownedCount = 0; s.deckCount = 0;
  const prevu = Q.QUEST_SEQUENCE.map((c) => c.map((q) => q.id));
  for (let oeuf = 0; oeuf < nbOeufs; oeuf++) {
    const set = Q.nextQuestSet(oeuf, [], s);
    prevu[oeuf % Q.QUEST_SEQUENCE.length].forEach((id) => {
      if (!set.ids.includes(id)) fautes.push({ oeuf: oeuf + 1, id });
    });
    set.ids.forEach((id) => {
      const q = Q.findQuest(id);
      if (!q) return;
      const cible = Q.effectiveQuestTarget(id, s, set.targets || {});
      const min = minutesPour(q, cible, s);
      if (min != null) s.totalEarned = (s.totalEarned || 0) + production(s) * 60 * min;
      appliquer(q, cible, s);
    });
    const nv = C.CREATURES[Math.min(oeuf, C.CREATURES.length - 1)];
    if (nv && !s.ownedIds.includes(nv.id)) s.ownedIds.push(nv.id);
    s.ownedCount = s.ownedIds.length;
    s.deckCount = Math.min(3, s.ownedCount);
    s.passiveIncome = passiveOnly(s);
  }
  return fautes;
}
module.exports.auditRemplacements = auditRemplacements;

// ---- Un défi HORS SCHÉMA dans un œuf de la séquence -----------------
//
// Complément de `auditRemplacements`, qui ne voyait que les défis
// MANQUANTS. Celui-ci voit aussi les INTRUS : un défi du pool glissé
// dans un œuf de la séquence.
//
// C'est ce que l'auteur a vu le 19/09, build à jour : « Pacte niveau 6 »
// revenu après les Mains Spectrales, puis « atteins 4 pièces par
// seconde » — deux défis du pool, jamais demandés, aux cibles calculées
// sur son porte-monnaie. Le document de référence ne les contenait pas.
//
// La séquence ne substitue plus : tout écart, dans un sens comme dans
// l'autre, est une panne.
function auditHorsSchema(nbOeufs = 12) {
  const fautes = [];
  const s = etatInitial();
  s.ownedIds = []; s.ownedCount = 0; s.deckCount = 0;
  for (let oeuf = 0; oeuf < nbOeufs; oeuf++) {
    // Le joueur suit la chaîne de boutique que ses défis lui imposent.
    if ((s.tapPower || 1) >= 5) {
      s.critLevel = Math.max(1, s.critLevel || 0);
      s.critDamageLevel = Math.max(1, s.critDamageLevel || 0);
    }
    const set = Q.nextQuestSet(oeuf, [], s);
    const schema = Q.QUEST_SEQUENCE[oeuf % Q.QUEST_SEQUENCE.length].map((q) => q.id);
    set.ids.filter((id) => !schema.includes(id))
      .forEach((id) => fautes.push({ oeuf: oeuf + 1, intrus: id }));
    set.ids.forEach((id) => {
      const q = Q.findQuest(id);
      if (!q) return;
      const cible = Q.effectiveQuestTarget(id, s, set.targets || {});
      const min = minutesPour(q, cible, s);
      if (min != null) s.totalEarned = (s.totalEarned || 0) + production(s) * 60 * min;
      appliquer(q, cible, s);
    });
    const nv = C.CREATURES[Math.min(oeuf, C.CREATURES.length - 1)];
    if (nv && !s.ownedIds.includes(nv.id)) s.ownedIds.push(nv.id);
    s.ownedCount = s.ownedIds.length;
    s.deckCount = Math.min(3, s.ownedCount);
    s.passiveIncome = passiveOnly(s);
  }
  return fautes;
}
module.exports.auditHorsSchema = auditHorsSchema;

// ---- Tout retrait de défi passe-t-il par la règle unique ? ----------
//
// Le jeu comptait TROIS endroits capables de retirer un défi d'un œuf :
// au tirage, au chargement, et en continu pendant la partie. Chacun
// avait sa propre condition écrite à la main, et deux d'entre elles ne
// distinguaient PAS les défis scriptés. Supprimer la première n'a donc
// rien changé pour l'auteur : il a vu un défi de l'œuf 1 prendre la
// place de la Faveur des Esprits pendant qu'il jouait.
//
// Ce contrôle lit le CODE de l'écran et du moteur, et vérifie que chaque
// appel à `pickQuestSet` — la seule fonction qui fabrique des
// remplaçants — est gardé par `peutEtreRemplace`, la règle unique.
//
// ⚠️ Il lit la SOURCE, pas le comportement : c'est le seul moyen de
// repérer un QUATRIÈME chemin qu'on ajouterait demain sans y penser. Un
// contrôle de comportement ne verrait que les chemins qu'il connaît.
function auditSubstitutions() {
  const fs = require('fs');
  const fautes = [];
  const fichiers = [
    ['ClickerScreen.js', __dirname + '/../src/screens/games/ClickerScreen.js'],
    ['questLogic.js', __dirname + '/../src/games/clicker/questLogic.js'],
  ];
  fichiers.forEach(([nom, chemin]) => {
    const src = fs.readFileSync(chemin, 'utf8');
    const lignes = src.split('\n');
    // ⚠️ On COMPTE, on ne regarde pas le voisinage.
    //
    // Première version : la garde devait se trouver dans les 25 lignes
    // précédentes. Un deuxième appel glissé juste après un appel gardé
    // passait donc au travers — vérifié, le contrôle ne le voyait pas.
    // Une garde par appel : impossible d'en ajouter un sans la sienne.
    const appels = [];
    lignes.forEach((ligne, i) => {
      if (!/pickQuestSet\s*\(/.test(ligne)) return;
      // La déclaration de la fonction elle-même, et l'usage interne du
      // tirage hors séquence, ne sont pas des retraits de défi.
      if (/export function pickQuestSet/.test(ligne)) return;
      if (/fromSequence: false/.test(ligne)) return;
      appels.push({ ligne: i + 1, code: ligne.trim().slice(0, 70) });
    });
    const gardes = (src.match(/peutEtreRemplace\s*\(/g) || []).length;
    if (appels.length > gardes) {
      appels.slice(gardes).forEach((a) => fautes.push({
        fichier: nom, ligne: a.ligne, code: a.code,
        detail: `${appels.length} appel(s) pour ${gardes} garde(s)`,
      }));
    }
  });
  return fautes;
}
module.exports.auditSubstitutions = auditSubstitutions;

// ---- Défis TROP FACILES ---------------------------------------------
//
// Demandé par l'auteur après en avoir repéré deux à l'œil sur le seul
// œuf 3 — dont un que mon instrument ne savait même pas mesurer.
//
// On rejoue les 26 œufs en suivant la séquence, et on compare pour
// chaque défi ce que le joueur A DÉJÀ à ce que le défi DEMANDE. Trois
// signaux, chacun suffisant :
//
//  - moins de `MIN_MINUTES` d'effort réel ;
//  - il reste moins de `MIN_PROGRESSION` de chemin depuis l'acquis ;
//  - la même métrique déjà visée moins de `ECART_OEUFS` œufs plus tôt
//    avec une cible à peine plus haute.
const FACILE_MIN_MINUTES = 3;
const FACILE_MIN_PROGRESSION = 0.25;
const FACILE_ECART_OEUFS = 4;
const FACILE_HAUSSE_MINI = 1.5;

function auditTropFacile(nbOeufs = 26) {
  const trouves = [];
  const s = etatInitial();
  s.ownedIds = []; s.ownedCount = 0; s.deckCount = 0;
  const vuRecemment = {};   // metric -> { oeuf, cible }
  let numero = 0;
  for (let oeuf = 0; oeuf < nbOeufs; oeuf++) {
    if ((s.tapPower || 1) >= 5) {
      s.critLevel = Math.max(1, s.critLevel || 0);
      s.critDamageLevel = Math.max(1, s.critDamageLevel || 0);
    }
    const set = Q.nextQuestSet(oeuf, [], s);
    set.ids.forEach((id) => {
      const q = Q.findQuest(id);
      if (!q) return;
      numero += 1;
      const cible = Q.effectiveQuestTarget(id, s, set.targets || {});
      const met = Q.metriqueDuDefi(q, s) || '';
      const acquis = met.startsWith('auto:') ? ((s.autoClickers || {})[met.slice(5)] || 0)
        : met.startsWith('tapUpgrade:') ? ((s.tapUpgrades || {})[met.slice(11)] || 0)
          : (s[met] || 0);
      const min = minutesPour(q, cible, s);
      const raisons = [];
      // ⚠️ Le critère de DURÉE ne vaut pas pour les défis d'ADRESSE.
      //
      // « Tiens la Transe 25 secondes » ou « Fais une Offrande » se
      // mesurent en secondes par construction : leur difficulté est le
      // geste, pas le temps. Les signaler revenait à demander de les
      // rallonger artificiellement — et un contrôle qui hurle sur des
      // cas normaux cesse d'être lu, c'est le piège de cette session.
      // ⚠️ Les défis à PAS RELATIF (`step`) sont exclus du critère de
      // durée : leur difficulté est voulue proportionnelle au joueur, pas
      // absolue. « Monte une créature +5 niveaux au-dessus de ta
      // meilleure » est un choix explicite de l'auteur — le signaler
      // reviendrait à lui demander de renier sa propre règle.
      // ⚠️ Sanctuaire et Veilleur PLAFONNENT à 50 : arrivés au plafond,
      // aucune cible ne peut les rendre plus longs. Les signaler
      // reviendrait à demander l'impossible.
      // ⚠️ Un défi d'ACHAT ne se juge pas au TEMPS mais au COÛT.
      //
      // « Possède 2 Mains Spectrales » ressort à 0 minute dès que le
      // joueur a le revenu : l'achat est instantané. Ça ne dit rien de
      // sa difficulté, qui tient au PRIX — et le prix est déjà contrôlé
      // par `auditInfaisable`, qui le rapporte au seuil du groupe.
      //
      // Mesurer la bonne grandeur, plutôt que multiplier les alertes :
      // ce critère-ci reste celui des défis qui demandent d'ACCUMULER.
      const metA = Q.metriqueDuDefi(q, s) || '';
      const achat = metA.startsWith('auto:') || metA.startsWith('tapUpgrade:');
      // ⚠️ L'ŒUF 1 DU JEU EST UN TUTORIEL. Ses défis sont VOULUS rapides
      // — l'auteur a demandé le Pacte en 2e défi pour apprendre la
      // boutique au joueur. Les compter comme « trop faciles » reviendrait
      // à refuser un tutoriel qui remplit son rôle.
      if (oeuf === 0) return;
      const adresse = q.step || achat
        || ['maxTranseHoldSec', 'maxCombo', 'offering', 'runeFused', 'runeBought',
          'sanctuaryLevel', 'veilleurLevel'].includes(q.metric);
      if (!adresse && min != null && min < FACILE_MIN_MINUTES) raisons.push(`${Math.round(min)} min`);
      // ⚠️ Les RECORDS sont remis à zéro par le jeu au tirage : comparer
      // la cible à un vieux record ne décrit aucune situation réelle.
      // ⚠️ Le critère « déjà X % acquis » ne vaut PAS pour les métriques
      // CUMULATIVES, celles qui ne repartent pas à zéro après une
      // Ascension : niveaux d'Aventure, niveau de créature, taps à vie.
      //
      // Sur une campagne d'Aventure, passer du niveau 20 au 25 est
      // « 80 % acquis » par construction — c'est le principe même d'une
      // progression continue, pas un défaut. Les signaler reviendrait à
      // exiger de doubler la campagne à chaque défi.
      //
      // Le critère garde tout son sens sur ce qui REPART de zéro :
      // pièces, générateurs, niveaux d'amélioration.
      const cumulative = ['advLevelReached', 'maxCreatureLevel', 'totalTaps',
        'battleWon', 'threeStarLevel', 'ascension'].includes(q.metric);
      const record = ['maxTranseHoldSec', 'maxCombo'].includes(q.metric);
      if (!record && !cumulative && q.mode === 'absolute' && acquis > 0 && cible > 0) {
        const progression = (cible - acquis) / cible;
        if (progression < FACILE_MIN_PROGRESSION) {
          raisons.push(`déjà ${Math.round(100 * acquis / cible)} % acquis`);
        }
      }
      // ⚠️ Ne PAS comparer de part et d'autre d'une ASCENSION.
      //
      // Le 7e œuf est le 1er du groupe 2 : le joueur vient de tout
      // perdre et sa production repart de zéro. Lui redemander une
      // petite cible est NORMAL. Sans cette exception, le contrôle
      // signalait tous les premiers œufs de groupe — et un contrôle qui
      // hurle sur des cas normaux cesse d'être lu.
      // ⚠️ Même raison : une campagne AVANCE par petits pas. Demander le
      // chapitre 3-5 après le 2-10 n'est pas une répétition, c'est la
      // suite. Le critère ne vaut que pour ce qui repart de zéro.
      if (cumulative) vuRecemment[q.metric] = { oeuf, cible };
      const memeGroupe = !cumulative && vuRecemment[q.metric]
        && Math.floor(oeuf / Q.QUEST_SEQUENCE.length) === Math.floor(vuRecemment[q.metric].oeuf / Q.QUEST_SEQUENCE.length);
      // ⚠️ Un défi d'ACHAT peut viser le même article qu'un autre du
      // groupe : au 1er groupe il n'existe que deux générateurs pour
      // trois créneaux. Les quantités demandées diffèrent (2, 4, 8),
      // donc ce sont bien trois défis distincts — les signaler comme
      // des répétitions serait du bruit.
      const vu = (memeGroupe && !achat) ? vuRecemment[q.metric] : null;
      if (vu && oeuf - vu.oeuf < FACILE_ECART_OEUFS && cible < vu.cible * FACILE_HAUSSE_MINI) {
        raisons.push(`déjà demandé à l'œuf ${vu.oeuf + 1} (cible ${vu.cible})`);
      }
      vuRecemment[q.metric] = { oeuf, cible };
      if (raisons.length) {
        trouves.push({ n: numero, oeuf: oeuf + 1, id, texte: Q.questLabel(id, null, s, set.targets || {}), pourquoi: raisons });
      }
      const m = minutesPour(q, cible, s);
      if (m != null) s.totalEarned = (s.totalEarned || 0) + production(s) * 60 * m;
      appliquer(q, cible, s);
    });
    const nv = C.CREATURES[Math.min(oeuf, C.CREATURES.length - 1)];
    if (nv && !s.ownedIds.includes(nv.id)) s.ownedIds.push(nv.id);
    s.ownedCount = s.ownedIds.length;
    s.deckCount = Math.min(3, s.ownedCount);
    s.passiveIncome = passiveOnly(s);
  }
  return trouves;
}
module.exports.auditTropFacile = auditTropFacile;

// ---- Une cible fixe dépend-elle encore du joueur ? ------------------
//
// L'auteur, preuve à l'appui : « Monte une créature au niveau 15 »
// s'affichait NIVEAU 128 chez lui, parce qu'il avait une créature au
// 127. Un plancher « toujours au moins 1 de plus que l'acquis » était
// resté dans la résolution — la dernière pièce du système qui adapte
// les défis au joueur.
//
// Ce contrôle résout chaque défi à cible fixe sur DEUX joueurs du même
// groupe : un débutant et un joueur très avancé. La cible doit être
// IDENTIQUE. C'est la garantie que le document de référence dit ce que
// le jeu affiche, pour tout le monde.
function auditCibleSuitLeJoueur() {
  const ecarts = [];
  const faible = (g) => ({
    ascension: g, tapPower: 1, coins: 0, totalEarned: 0, passiveIncome: 0,
    sanctuaryLevel: 0, veilleurLevel: 0, critLevel: 0, critDamageLevel: 0,
    maxCreatureLevel: 1, advLevelReached: 0, totalTaps: 0, maxTranseHoldSec: 0,
    ownedCount: 3, creaturesAVenir: 3, deckCount: 3,
    autoClickers: {}, upgradeLevels: {}, tapUpgrades: {}, essence: 0,
  });
  const fort = (g) => ({
    ...faible(g), tapPower: 40, coins: 1e9, totalEarned: 1e10, passiveIncome: 1e6,
    sanctuaryLevel: 50, veilleurLevel: 50, critLevel: 30, critDamageLevel: 30,
    maxCreatureLevel: 127, advLevelReached: 120, totalTaps: 1e6, maxTranseHoldSec: 400,
    autoClickers: { esprit: 300, main: 200, automate: 100 },
  });
  Q.QUEST_SEQUENCE.flat().forEach((q) => {
    if (!q.target) return;
    // Le défi de taps demande EXPLICITEMENT qu'il reste à faire.
    if (q.minStep) return;
    // ⚠️ Les défis d'ACHAT s'adaptent VOLONTAIREMENT au joueur depuis le
    // 20/09 : `plafondAchatsGroupe` réduit la demande quand il possède
    // déjà ce que le groupe réclame. L'adaptation est BORNÉE — elle ne
    // peut que réduire, jamais augmenter — donc un joueur en retard voit
    // toujours la cible annoncée dans le document.
    if (q.mode === 'delta' && /^(auto:|tapUpgrade:)/.test(
      Q.metriqueDuDefi(q, { ascension: 0 }) || '')) return;
    [0, 1, 3].forEach((g) => {
      const a = Q.resolveQuestTarget(q, faible(g));
      const b = Q.resolveQuestTarget(q, fort(g));
      if (a !== b) ecarts.push({ id: q.id, groupe: g, debutant: a, avance: b });
    });
  });
  return ecarts;
}
module.exports.auditCibleSuitLeJoueur = auditCibleSuitLeJoueur;

// ---- Libellé incomplet faute de métrique -----------------------------
//
// Bug réel du 19/09 : « Possède 14 un article ». Le libellé d'un défi
// dont l'article dépend du groupe reçoit la métrique en 2e argument ;
// `questLabel` la passait, `questDetail` non. Le joueur lisait un défi
// qui ne dit pas quoi faire.
//
// Ce contrôle appelle CHAQUE libellé sans métrique et signale ceux qui
// produisent un texte incomplet — c'est-à-dire ceux qui en ont besoin.
// Il vérifie ensuite que les deux chemins d'affichage la fournissent.
function auditLibelleSansArticle() {
  const fautes = [];
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/games/clicker/questLogic.js', 'utf8');
  // Tout appel `q.label(` doit passer un 2e argument.
  (src.match(/q\.label\([^)]*\)/g) || []).forEach((appel) => {
    if (!appel.includes(',')) fautes.push({ appel, probleme: 'métrique non transmise' });
  });
  // Et aucun défi ne doit produire « un article » avec ses stats réelles.
  [0, 1, 2, 3].forEach((g) => {
    const s = { ascension: g, autoClickers: {}, upgradeLevels: {}, tapUpgrades: {} };
    Q.QUEST_SEQUENCE.flat().forEach((q) => {
      const texte = q.label(10, Q.metriqueDuDefi(q, s)) || '';
      if (/un article|undefined|NaN/.test(texte)) {
        fautes.push({ id: q.id, groupe: g, texte });
      }
    });
  });
  return fautes;
}
module.exports.auditLibelleSansArticle = auditLibelleSansArticle;

// ---- Récompense qui compte le bonus d'Ascension deux fois ------------
//
// Bug réel du 19/09, signalé par l'auteur : « le shop avec les diamants
// donne double récompense après une Ascension ».
//
// `gainCoins` applique tous les multiplicateurs globaux, dont le bonus
// d'Ascension. C'est juste pour ce que le joueur PRODUIT. Mais une
// récompense déjà calée sur son revenu passif contient DÉJÀ ce bonus :
// la repasser par `gainCoins` le compte deux fois — x2 après la 1re
// Ascension, x15 après la 3e. Sur un achat en Diamants, c'est de la
// monnaie réelle qui ne vaut pas ce qui est annoncé.
//
// Ce contrôle lit la SOURCE et signale tout appel à `gainCoins` dont
// l'argument dépend du revenu passif.
function auditRecompenseDoublee() {
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/screens/games/ClickerScreen.js', 'utf8');
  const fautes = [];
  src.split('\n').forEach((ligne, i) => {
    if (!/gainCoins\s*\(/.test(ligne)) return;
    if (/passiveIncome|passiveRate/.test(ligne)) {
      fautes.push({ ligne: i + 1, code: ligne.trim().slice(0, 80) });
    }
  });
  return fautes;
}
module.exports.auditRecompenseDoublee = auditRecompenseDoublee;

// ---- Compteurs tamponnés non remis à zéro à l'Ascension --------------
//
// Bug réel du 19/09 : « je suis à A8 avec le bouton dev et en moins de
// 3 minutes j'ai pu acheter 50 Étoiles Filantes ».
//
// Les pièces sont accumulées dans `pendingGainRef` et versées toutes les
// 100 ms. L'Ascension faisait `setCoins(0)` sans toucher au tampon : ce
// qui y attendait était versé JUSTE APRÈS la remise à zéro. Chaque
// Ascension rendait donc au joueur ce qu'elle venait de lui prendre, et
// le nouveau bonus s'appliquait ensuite à ce report.
//
// Ce contrôle lit la SOURCE et vérifie que chaque `...Ref` servant de
// tampon est bien remis à zéro dans la routine d'Ascension.
function auditTamponsAscension() {
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/screens/games/ClickerScreen.js', 'utf8');
  const fautes = [];
  // ⚠️ SEULS les tampons qui alimentent les PIÈCES sont concernés.
  //
  // Première version : toute ref incrémentée. Elle signalait
  // `totalCritsRef`, `goldenClaimedRef`, `totalSummonsRef` — des
  // compteurs À VIE qui doivent justement survivre à l'Ascension. Un
  // contrôle qui réclame de casser des choses justes ne sera pas suivi.
  //
  // On repère donc les refs dont le contenu finit dans `setCoins`.
  const tampons = new Set();
  const lignes = src.split('\n');
  lignes.forEach((ligne, i) => {
    const m = ligne.match(/setCoins\(\(c\) => c \+ (\w+)\)/);
    if (!m) return;
    // La variable vient d'une ref lue juste au-dessus.
    const avant = lignes.slice(Math.max(0, i - 4), i).join('\n');
    const src2 = avant.match(/const \w+ = (\w+Ref)\.current/);
    if (src2) tampons.add(src2[1]);
  });
  const i = src.indexOf('const confirmAscension');
  if (i === -1) return [{ probleme: 'confirmAscension introuvable' }];
  const routine = src.slice(i, i + 4000);
  tampons.forEach((t) => {
    if (!new RegExp(t + '\\.current = 0').test(routine)) {
      fautes.push({ tampon: t, probleme: 'non remis à zéro par l\'Ascension' });
    }
  });
  return fautes;
}
module.exports.auditTamponsAscension = auditTamponsAscension;

// ---- La boutique garde-t-elle sa valeur à chaque Ascension ? --------
//
// Bug réel du 19/09 : « je dev jusqu'à A5 et en 10 minutes j'achète 5
// Étoiles Filantes ».
//
// Les prix de boutique étaient FIXES alors que le revenu du joueur est
// multiplié par le bonus d'Ascension. Se payer le 1er Esprit Frappeur
// prenait 228 secondes à A0, 1 seconde à A5, rien du tout à A8 : le
// joueur repartait de zéro mais TOUT était gratuit, donc il remontait
// la boutique entière en quelques minutes.
//
// Ce contrôle mesure, à chaque Ascension, le temps qu'il faut pour se
// payer le premier exemplaire de chaque générateur en tapant. Il doit
// être le MÊME partout : c'est la définition d'une boutique qui garde
// sa valeur.
function auditPrixParAscension(tolerance = 0.15) {
  const fautes = [];
  const TAPS = 4;
  C.AUTOCLICKERS.forEach((g) => {
    const temps = [0, 1, 2, 3, 4, 5].map((a) => {
      const revenu = C.tapDamage(1) * TAPS * C.ascensionSpeedMultiplier(a);
      return C.autoClickerCost(g, 0, a) / revenu;
    });
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    if (max > min * (1 + tolerance)) {
      fautes.push({
        article: g.name,
        secondesA0: Math.round(temps[0]),
        secondesA5: Math.round(temps[5]),
      });
    }
  });
  return fautes;
}
module.exports.auditPrixParAscension = auditPrixParAscension;

// ---- Défis INFAISABLES, mesurés sur la vraie progression ------------
//
// ⚠️ Ce contrôle remplace celui de `verif-exhaustive.js`, qui partait
// d'un état FIGÉ (6 Esprits, 4 Mains à tous les groupes). Les deux se
// contredisaient : le même défi ressortait « infaisable » ici et « 0
// minute » là-bas, simplement parce qu'ils ne supposaient pas le même
// joueur. Deux instruments qui ne partagent pas leur état ne peuvent
// pas être comparés — c'est le piège qui a déjà fait perdre des heures
// sur les durées de groupe.
//
// Ici on rejoue la séquence, donc on sait ce que le joueur POSSÈDE
// vraiment quand le défi tombe.
function auditInfaisable(nbOeufs = 26, partMax = 0.6) {
  const trouves = [];
  const s = etatInitial();
  s.ownedIds = []; s.ownedCount = 0; s.deckCount = 0;
  let numero = 0;
  for (let oeuf = 0; oeuf < nbOeufs; oeuf++) {
    if ((s.tapPower || 1) >= 5) {
      s.critLevel = Math.max(1, s.critLevel || 0);
      s.critDamageLevel = Math.max(1, s.critDamageLevel || 0);
    }
    const set = Q.nextQuestSet(oeuf, [], s);
    set.ids.forEach((id) => {
      const q = Q.findQuest(id);
      if (!q) return;
      numero += 1;
      const cible = Q.effectiveQuestTarget(id, s, set.targets || {});
      const met = Q.metriqueDuDefi(q, s) || '';
      if (met.startsWith('auto:') || met.startsWith('tapUpgrade:')) {
        const estAuto = met.startsWith('auto:');
        const item = estAuto
          ? C.AUTOCLICKERS.find((x) => x.id === met.slice(5))
          : C.TAP_UPGRADES.find((x) => x.id === met.slice(11));
        if (item) {
          const possede = estAuto ? ((s.autoClickers || {})[item.id] || 0)
            : ((s.tapUpgrades || {})[item.id] || 0);
          let cout = 0;
          for (let n = possede; n < cible && n < possede + 300; n++) {
            cout += estAuto ? C.autoClickerCost(item, n, s.ascension)
              : C.tapUpgradeCost(item, n, s.ascension);
          }
          const seuil = C.ascensionThreshold(s.ascension || 0);
          if (cout > seuil * partMax) {
            trouves.push({ n: numero, oeuf: oeuf + 1, id,
              texte: Q.questLabel(id, null, s, set.targets || {}),
              part: Math.round(100 * cout / seuil) });
          }
        }
      }
      const m = minutesPour(q, cible, s);
      if (m != null) s.totalEarned = (s.totalEarned || 0) + production(s) * 60 * m;
      appliquer(q, cible, s);
    });
    const nv = C.CREATURES[Math.min(oeuf, C.CREATURES.length - 1)];
    if (nv && !s.ownedIds.includes(nv.id)) s.ownedIds.push(nv.id);
    s.ownedCount = s.ownedIds.length;
    s.deckCount = Math.min(3, s.ownedCount);
    s.passiveIncome = passiveOnly(s);
  }
  return trouves;
}
module.exports.auditInfaisable = auditInfaisable;

// ---- Une mise à jour des défis efface-t-elle bien l'ancien état ? ---
//
// Bug réel du 19/09, signalé plusieurs fois : « sur le jeu c'est encore
// les anciens défis ». Ce n'était ni le cache d'Expo ni une publication
// manquée.
//
// Quand l'empreinte des définitions change, l'écran vide la liste des
// défis pour forcer un nouveau tirage — mais il gardait les CIBLES
// figées et les RÉFÉRENCES de progression de la sauvegarde. Les défis
// fraîchement tirés récupéraient donc les chiffres de l'ancienne
// version.
//
// Ce contrôle lit la source et exige que tout ce qui est restauré
// depuis la sauvegarde et lié aux défis soit conditionné à
// `defsChangees`.
function auditResetSurChangement() {
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/screens/games/ClickerScreen.js', 'utf8');
  const fautes = [];
  const lies = ['questTargets', 'questBaselines', 'activeQuestIds'];
  // ⚠️ Ignorer les COMMENTAIRES, et regarder les deux lignes qui
  // précèdent : un test ternaire s'écrit souvent sur plusieurs lignes,
  // et la condition ne figure pas sur celle qui cite le champ.
  // Sans ces deux précautions le contrôle signalait sa propre
  // documentation — du bruit qui fait ignorer les vraies alertes.
  const lignes = src.split('\n');
  lignes.forEach((ligne, i) => {
    if (/^\s*(\/\/|\*)/.test(ligne)) return;
    lies.forEach((champ) => {
      if (!new RegExp('saved\\.' + champ).test(ligne)) return;
      const contexte = lignes.slice(Math.max(0, i - 2), i + 1).join('\n');
      if (!/defsChangees/.test(contexte)) {
        fautes.push({ ligne: i + 1, champ, code: ligne.trim().slice(0, 70) });
      }
    });
  });
  return fautes;
}
module.exports.auditResetSurChangement = auditResetSurChangement;

// ---- Le moteur reçoit-il l'état COMPLET du joueur ? -----------------
//
// Bug réel du 19/09 : à l'Ascension 5, le joueur voyait les défis du
// tout premier œuf, et son œuf éclosait en deux défis.
//
// Le tirage de secours appelait `nextQuestSet(index, ids, { totalEarned
// })` — un FRAGMENT d'état. Sans `ascension`, le moteur croit le joueur
// au groupe 0 et tire les cibles de départ, qu'un joueur avancé remplit
// instantanément.
//
// ⚠️ Passer un fragment ne provoque AUCUNE erreur : le moteur lit des
// zéros et répond faux. C'est la pire catégorie de bug — silencieuse et
// plausible.
//
// Ce contrôle lit la source et vérifie qu'aucun appel au moteur ne
// reçoit un objet littéral en guise d'état.
function auditEtatComplet() {
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/screens/games/ClickerScreen.js', 'utf8');
  const fautes = [];
  const moteur = ['nextQuestSet', 'pickQuestSet', 'resolveQuestTarget', 'questFeasible',
    'effectiveQuestTarget', 'questProgress'];
  src.split('\n').forEach((ligne, i) => {
    if (/^\s*(\/\/|\*)/.test(ligne)) return;
    moteur.forEach((fn) => {
      const m = ligne.match(new RegExp(fn + '\\(([^)]*)\\)'));
      if (!m) return;
      // Un objet littéral passé en argument = un fragment d'état.
      if (/\{\s*\w+\s*:/.test(m[1])) {
        fautes.push({ ligne: i + 1, fonction: fn, code: ligne.trim().slice(0, 70) });
      }
    });
  });
  return fautes;
}
module.exports.auditEtatComplet = auditEtatComplet;

// ---- Les instantanés lisent-ils des valeurs À JOUR ? ----------------
//
// Bug réel du 19/09 : « tous les défis des ascensions sont pareils ».
//
// Les deux instantanés de stats envoyés au moteur lisaient
// `lifetimeStats.ascension`, une valeur CAPTURÉE au rendu où la fonction
// a été créée. Or le tirage des défis part d'un enchaînement déclenché
// par l'Ascension elle-même : il lisait le compteur d'AVANT, donc zéro.
// Le joueur recevait les défis du groupe 0 quel que soit son avancement.
//
// ⚠️ Le reste du fichier utilisait déjà `ascensionCountRef` partout
// (prix, multiplicateurs). Ces deux-là étaient les seuls à lire la
// valeur du rendu — et c'est exactement le genre d'incohérence qu'aucun
// test de logique ne peut voir, puisque la fonction est correcte : c'est
// le MOMENT de sa lecture qui ne l'est pas.
function auditInstantanesAJour() {
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/../src/screens/games/ClickerScreen.js', 'utf8');
  const fautes = [];
  // Champs qui changent en cours de partie et qui ont une ref dédiée.
  const aRef = { ascension: 'ascensionCountRef', tapPower: 'tapPowerRef', coins: 'coinsRef' };
  src.split('\n').forEach((ligne, i) => {
    if (/^\s*(\/\/|\*)/.test(ligne)) return;
    Object.entries(aRef).forEach(([champ, ref]) => {
      if (!new RegExp('^\\s*' + champ + ':').test(ligne)) return;
      if (!src.includes('const ' + ref)) return;
      // ⚠️ Les lectures de la SAUVEGARDE (`saved.`) sont légitimes : au
      // chargement, les refs ne sont pas encore renseignées. Les
      // signaler reviendrait à demander de lire une valeur qui n'existe
      // pas encore.
      if (/saved\./.test(ligne)) return;
      // Dans un instantané, le champ doit venir de la ref.
      if (!new RegExp(ref).test(ligne) && /\w+\.\w+/.test(ligne)) {
        fautes.push({ ligne: i + 1, champ, attendu: ref, code: ligne.trim().slice(0, 60) });
      }
    });
  });
  return fautes;
}
module.exports.auditInstantanesAJour = auditInstantanesAJour;

// ⚠️ CONTRÔLE ÉCARTÉ, et la raison mérite d'être gardée.
//
// J'ai écrit un contrôle qui compare les champs LUS sur la sauvegarde à
// ceux qui y sont réellement ÉCRITS, pour attraper le bug du 19/09 :
// `saved.lifetimeStats` n'existe pas dans la sauvegarde du clicker, et
// la lecture valait zéro sans la moindre erreur — c'est ce qui donnait
// les défis du groupe 0 à un joueur à l'Ascension 5.
//
// Il sortait 39 alertes, presque toutes fausses : la sauvegarde s'écrit
// en plusieurs endroits et avec des raccourcis que l'analyse de source
// ne sait pas suivre. Un contrôle qui hurle sur des cas normaux cesse
// d'être lu — c'est la règle du projet, et elle s'applique aussi à mes
// propres contrôles.
//
// La bonne parade ici n'est pas un contrôle mais une règle : un champ
// qui vit dans un CONTEXTE ne se lit jamais sur la sauvegarde d'un
// écran. On le prend à sa source.

// ---- Un nom d'article écrit en dur quelque part ? -------------------
//
// L'auteur, après « Titan de Foudre n'a jamais existé » puis « Gardien
// Céleste n'existe pas » : « assure-toi d'avoir les bons noms d'item de
// partout ».
//
// Les noms ne vivent QUE dans `clickerLogic.js`. Partout ailleurs, un
// article se désigne par son identifiant et son nom se lit via
// `nomArticle()`. Écrire un nom en dur crée une copie qui ne suivra pas
// un renommage — et le joueur lit alors un article qui n'existe plus.
//
// ⚠️ Les COMMENTAIRES sont exclus : ils citent des noms pour expliquer un
// bug passé, ce qui est légitime et sans effet sur le jeu.
function auditNomsEnDur() {
  const fs = require('fs');
  const path = require('path');
  const noms = [...C.AUTOCLICKERS.map((a) => a.name), ...C.TAP_UPGRADES.map((t) => t.name)];
  const fautes = [];
  const racine = __dirname + '/../src';
  const parcours = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return parcours(p);
    // ⚠️ `defisEcrits.js` contient les 252 défis avec leur texte final,
    // noms d'articles compris — c'est sa raison d'être. Le contrôle vise
    // le CODE qui construirait un nom à la main, pas une table de
    // libellés figés.
    if (!e.name.endsWith('.js') || p.includes('clickerLogic')
      || p.includes('defisEcrits')) return;
    fs.readFileSync(p, 'utf8').split('\n').forEach((ligne, i) => {
      // ⚠️ Les commentaires sont exclus, y compris ceux qui ferment un
      // bloc JSX (`*/}`) : ils citent des noms pour expliquer un bug
      // passé, ce qui est légitime et sans effet sur le jeu.
      if (/^\s*(\/\/|\*|\/\*)/.test(ligne) || /\*\/\}?\s*$/.test(ligne)) return;
      noms.forEach((n) => {
        if (ligne.includes(n)) {
          fautes.push({ fichier: p.split('/src/')[1], ligne: i + 1, nom: n });
        }
      });
    });
  });
  parcours(racine);
  return fautes;
}
module.exports.auditNomsEnDur = auditNomsEnDur;

// ---- Jamais deux défis d'achat d'affilée ----------------------------
//
// Règle de l'auteur du 20/09 : « jamais deux défis d'achat d'affilée ».
// Deux achats consécutifs enchaînent deux fois le même geste — ouvrir la
// boutique, dépenser. Les alterner donne du rythme.
//
// ⚠️ La règle vaut aussi ENTRE DEUX ŒUFS : le dernier défi d'un œuf et
// le premier du suivant. C'est là qu'elle se casse le plus facilement,
// parce qu'on regarde un œuf à la fois en la vérifiant à l'œil.
function auditAchatsColles(nbOeufs = 28) {
  const fautes = [];
  const s = etatInitial();
  s.ownedCount = 6; s.creaturesAVenir = 6; s.tapPower = 12;
  s.critLevel = 3; s.critDamageLevel = 3;
  let precedent = null;
  for (let oeuf = 0; oeuf < nbOeufs; oeuf++) {
    s.ascension = Math.floor(oeuf / Q.QUEST_SEQUENCE.length);
    const set = Q.nextQuestSet(oeuf, [], s);
    set.ids.forEach((id) => {
      const q = Q.findQuest(id);
      if (!q) return;
      const achat = Q.estDefiAchat(q, s);
      if (achat && precedent) {
        fautes.push({ oeuf: oeuf + 1, id, apres: precedent });
      }
      precedent = achat ? id : null;
    });
  }
  return fautes;
}
module.exports.auditAchatsColles = auditAchatsColles;

// ---- Un défi d'achat peut-il devenir infaisable ? -------------------
//
// Problème posé par l'auteur le 20/09 : « si un joueur a tryhard les
// niveaux d'Esprit Frappeur et qu'un défi lui demande d'en racheter 5,
// il ne pourra peut-être pas — 3 millions de pièces à l'Ascension 0 ».
//
// Le prix d'un générateur monte de 25 % par exemplaire : au 20e il
// coûte 87 fois le premier. Un défi en mode DELTA devenait donc
// impossible pour un joueur EN AVANCE, alors qu'il reste trivial pour
// un joueur en retard.
//
// `plafondAchatsGroupe` borne la demande à ce qui reste à acheter dans
// le groupe. Ce contrôle vérifie qu'un joueur très en avance ne se voit
// jamais réclamer plus d'un exemplaire, et que le coût reste sous le
// seuil de son Ascension.
// ⚠️ Tolérance à 60 %, la même que `auditInfaisable`. Un joueur qui a
// sur-investi paie le prix de son propre choix : le 24e Esprit coûte
// 55 % du seuil parce que chaque exemplaire vaut 25 % de plus que le
// précédent. Ce que le plafond garantit, c'est qu'on ne lui en demande
// qu'UN — pas que cet exemplaire soit bon marché.
function auditPlafondAchats(partMax = 0.6) {
  const fautes = [];
  // ⚠️ On parcourt les défis ÉCRITS, pas les anciens modèles : ce sont
  // eux que le joueur reçoit. Le contrôle testait encore `QUEST_SEQUENCE`
  // après la bascule et mesurait donc des défis qui n'existent plus.
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  [0, 1, 2, 3, 4, 5].forEach((groupe) => {
    (D.DEFIS_ECRITS.slice(groupe * 7, groupe * 7 + 7).flat()).forEach((q) => {
      if (q.mode !== 'delta') return;
      const s = etatInitial();
      s.ascension = groupe;
      const m = q.metric || '';
      if (!m.startsWith('auto:') && !m.startsWith('tapUpgrade:')) return;
      const estAuto = m.startsWith('auto:');
      const item = estAuto ? C.AUTOCLICKERS.find((x) => x.id === m.slice(5))
        : C.TAP_UPGRADES.find((x) => x.id === m.slice(11));
      if (!item) return;
      // ⚠️ Joueur en avance, mais RÉALISTE : la moitié de plus que le
      // plafond. Tester trois fois le plafond n'avait pas de sens — le
      // prix monte de 25 % par exemplaire, donc le 48e Esprit coûte
      // 66 000 fois le premier et aucun joueur n'y arrive à l'Ascension
      // 0. Un contrôle doit décrire une situation ATTEIGNABLE, sinon il
      // refuse des réglages corrects.
      // ⚠️ L'AVANCE RÉALISTE DÉPEND DE LA PENTE DU PRIX. Un générateur
      // monte de 25 % par exemplaire, un palier de tap de 45 % : à
      // plafond égal, le joueur peut aller bien plus loin sur le
      // premier que sur le second. Tester la même avance sur les deux
      // refusait des réglages corrects.
      const plafond = Q.plafondAchatsGroupe(m, s);
      const possede = Math.round(plafond * (estAuto ? 1.5 : 1.15));
      if (estAuto) s.autoClickers[item.id] = possede;
      else s.tapUpgrades[item.id] = possede;
      const cible = Q.resolveQuestTarget(q, s);
      let cout = 0;
      for (let n = possede; n < possede + cible; n++) {
        cout += estAuto ? C.autoClickerCost(item, n, groupe)
          : C.tapUpgradeCost(item, n, groupe);
      }
      const seuil = C.ascensionThreshold(groupe);
      if (cout > seuil * partMax) {
        fautes.push({ id: q.id, groupe, article: item.name, cible,
          part: Math.round(100 * cout / seuil) });
      }
    });
  });
  return fautes;
}
module.exports.auditPlafondAchats = auditPlafondAchats;

// ---- Le fichier écrit dit-il la même chose que le moteur ? ----------
//
// `defisEcrits.js` contient les 252 défis un par un. Tant que le jeu
// tourne encore sur le moteur, les deux doivent dire EXACTEMENT la même
// chose — c'est la preuve que basculer ne changera rien pour un joueur
// en cours de partie.
//
// ⚠️ Ce contrôle est la seule chose qui autorise la bascule. Sans lui,
// remplacer un moteur par une table revient à réécrire le jeu à
// l'aveugle.
function auditDefisEcrits() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return [{ probleme: 'fichier absent' }]; }
  const fautes = [];
  const vus = new Set();
  D.DEFIS_ECRITS.forEach((oeuf, i) => {
    if (oeuf.length !== 6) fautes.push({ oeuf: i + 1, probleme: oeuf.length + ' défis au lieu de 6' });
    oeuf.forEach((q) => {
      if (vus.has(q.id)) fautes.push({ oeuf: i + 1, probleme: 'identifiant en double : ' + q.id });
      vus.add(q.id);
      if (!q.metric) fautes.push({ oeuf: i + 1, probleme: 'métrique absente : ' + q.id });
      if (!q.target || q.target <= 0) fautes.push({ oeuf: i + 1, probleme: 'cible nulle : ' + q.id });
      if (typeof q.label !== 'function') fautes.push({ oeuf: i + 1, probleme: 'libellé absent : ' + q.id });
    });
    // L'Ascension clôt chaque groupe de sept œufs.
    if ((i + 1) % 7 === 0) {
      const dernier = oeuf[oeuf.length - 1];
      if (!dernier || dernier.metric !== 'ascension') {
        fautes.push({ oeuf: i + 1, probleme: "le 7e œuf ne finit pas par l'Ascension" });
      }
    }
  });
  // Le tirage doit rendre EXACTEMENT l'œuf écrit, dans le même ordre.
  D.DEFIS_ECRITS.forEach((oeuf, i) => {
    const s2 = etatInitial();
    s2.ascension = Math.floor(i / 7);
    const set = Q.nextQuestSet(i, [], s2);
    const attendu = oeuf.map((q) => q.id).join(',');
    if (set.ids.join(',') !== attendu) {
      fautes.push({ oeuf: i + 1, probleme: 'le tirage ne rend pas l\'œuf écrit' });
    }
  });
  return fautes;
}
module.exports.auditDefisEcrits = auditDefisEcrits;

// ---- Le coût d'un défi d'achat monte-t-il au fil du groupe ? --------
//
// Idée de l'auteur, le 20/09 : « le défi 152 est logiquement plus cher
// que le 156, alors qu'il est avant. Je me demande si ton calculateur
// pourrait dénoncer ce genre de malfaçon si on lui donne cette
// logique ».
//
// Oui, et c'est exactement ce que fait ce contrôle. Il calcule le COÛT
// RÉEL de chaque défi d'achat — pas sa cible, pas son rang — et vérifie
// qu'il ne redescend jamais à l'intérieur d'un groupe.
//
// ⚠️ Le coût dépend de ce que le joueur POSSÈDE DÉJÀ : acheter le 10e
// exemplaire coûte plus cher que le 3e. On rejoue donc le groupe en
// tenant le compte, au lieu de comparer des prix unitaires.
function auditCoutCroissant(tolerance = 0.5) {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const fautes = [];
  const NIVEAUX = ['tapPower', 'critLevel', 'critDamageLevel',
    'sanctuaryLevel', 'veilleurLevel'];
  for (let groupe = 0; groupe < 6; groupe++) {
    const possede = {};
    let precedent = null;
    let numero = groupe * 42;
    for (let e = 0; e < 7; e++) {
      const oeuf = D.DEFIS_ECRITS[groupe * 7 + e] || [];
      oeuf.forEach((q) => {
        numero += 1;
        const m = q.metric || '';
        const estAuto = m.startsWith('auto:');
        const estTap = m.startsWith('tapUpgrade:');
        if (!estAuto && !estTap && !NIVEAUX.includes(m)) return;
        const item = estAuto ? C.AUTOCLICKERS.find((x) => x.id === m.slice(5))
          : estTap ? C.TAP_UPGRADES.find((x) => x.id === m.slice(11)) : null;
        const deja = possede[m] || 0;
        // En mode delta la cible est un NOMBRE D'ACHATS ; en absolu,
        // c'est un niveau à atteindre depuis ce qu'on a déjà.
        const aAcheter = q.mode === 'delta' ? q.target : Math.max(0, q.target - deja);
        let cout = 0;
        for (let n = deja; n < deja + aAcheter; n++) {
          if (estAuto) cout += C.autoClickerCost(item, n, groupe);
          else if (estTap) cout += C.tapUpgradeCost(item, n, groupe);
          else if (m === 'tapPower') cout += C.tapPowerCost(n);
          else if (m === 'critLevel') cout += C.critUpgradeCost(n);
          else if (m === 'critDamageLevel') cout += C.critDamageUpgradeCost(n);
          else if (m === 'sanctuaryLevel') cout += C.sanctuaryUpgradeCost(n);
          else if (m === 'veilleurLevel') cout += C.veilleurUpgradeCost(n);
        }
        possede[m] = deja + aAcheter;
        if (cout <= 0) return;
        if (precedent && cout < precedent.cout * (1 - tolerance)) {
          fautes.push({ groupe, defi: numero, texte: q.label(q.target),
            cout: Math.round(cout), avant: precedent.defi,
            coutAvant: Math.round(precedent.cout) });
        }
        precedent = { defi: numero, cout };
      });
    }
  }
  return fautes;
}
module.exports.auditCoutCroissant = auditCoutCroissant;

// ---- La règle des 90 % est-elle tenue, groupe par groupe ? ----------
//
// Demandé par l'auteur le 20/09 : « calculer le prix de revient de tous
// les défis d'achat pour chaque Ascension, pour savoir si la règle des
// 90 % est validée ».
//
// RAPPEL DE LA RÈGLE : les défis d'achat d'un groupe coûtent ensemble
// ~90 % du seuil de l'Ascension. Les 10 % restants sont le farm final
// avant de pouvoir ascensionner — un dernier petit effort avant une
// grosse récompense, que l'auteur juge essentiel à la rétention.
//
// ⚠️ On additionne le COÛT RÉEL, en tenant le compte de ce que le joueur
// a déjà acheté dans le groupe. Additionner des prix unitaires donnerait
// un total faux : le 10e exemplaire coûte bien plus cher que le 3e.
function auditBudgetGroupe(min = 0.80, max = 1.00) {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const NIV = ['tapPower', 'critLevel', 'critDamageLevel',
    'sanctuaryLevel', 'veilleurLevel'];
  const fautes = [];
  for (let g = 0; g < 6; g++) {
    const possede = {};
    let total = 0;
    for (let e = 0; e < 7; e++) {
      (D.DEFIS_ECRITS[g * 7 + e] || []).forEach((q) => {
        const m = q.metric || '';
        const auto = m.startsWith('auto:');
        const tap = m.startsWith('tapUpgrade:');
        if (!auto && !tap && !NIV.includes(m)) return;
        const it = auto ? C.AUTOCLICKERS.find((x) => x.id === m.slice(5))
          : tap ? C.TAP_UPGRADES.find((x) => x.id === m.slice(11)) : null;
        const deja = possede[m] || 0;
        const n = q.mode === 'delta' ? q.target : Math.max(0, q.target - deja);
        for (let i = deja; i < deja + n; i++) {
          if (auto) total += C.autoClickerCost(it, i, g);
          else if (tap) total += C.tapUpgradeCost(it, i, g);
          else if (m === 'tapPower') total += C.tapPowerCost(i);
          else if (m === 'critLevel') total += C.critUpgradeCost(i);
          else if (m === 'critDamageLevel') total += C.critDamageUpgradeCost(i);
          else if (m === 'sanctuaryLevel') total += C.sanctuaryUpgradeCost(i);
          else total += C.veilleurUpgradeCost(i);
        }
        possede[m] = deja + n;
      });
    }
    const part = total / C.ascensionThreshold(g);
    if (part < min || part > max) {
      fautes.push({ groupe: g, part: Math.round(part * 100),
        farmFinal: Math.round((1 - part) * 100) });
    }
  }
  return fautes;
}
module.exports.auditBudgetGroupe = auditBudgetGroupe;

// ---- Tout article de la boutique est-il demandé au moins une fois ? -
//
// Un article qu'aucun défi ne nomme est un article que le joueur ne
// découvrira jamais — c'est la plainte d'origine de l'auteur : « aucun
// défi ne parle d'acheter Automate Runique ni Colonie de Familiers ».
// Le contrôle empêche qu'elle revienne, par exemple si un défi est
// supprimé ou déplacé.
function auditArticlesOrphelins() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const vus = new Set();
  D.DEFIS_ECRITS.flat().forEach((q) => vus.add(q.metric));
  const fautes = [];
  // ⚠️ Seuls les articles que le contenu ÉCRIT peut atteindre comptent.
  // Deux générateurs s'ouvrent par Ascension et six Ascensions sont
  // écrites : les paliers au-delà du 12e appartiennent à du contenu qui
  // n'existe pas encore. Les signaler serait réclamer des défis pour des
  // articles que personne ne verra.
  // Deux générateurs par Ascension, six Ascensions écrites (0 à 5) :
  // les dix premiers paliers sont atteignables, les suivants
  // appartiennent à l'Ascension 6 et au-delà, qui n'existe pas encore.
  const ATTEIGNABLES = 10;
  C.AUTOCLICKERS.slice(0, ATTEIGNABLES).forEach((a) => {
    if (!vus.has('auto:' + a.id)) fautes.push({ article: a.name, type: 'générateur' });
  });
  C.TAP_UPGRADES.forEach((t) => {
    if (!vus.has('tapUpgrade:' + t.id)) fautes.push({ article: t.name, type: 'palier de tap' });
  });
  return fautes;
}
module.exports.auditArticlesOrphelins = auditArticlesOrphelins;

// ---- L'équilibre entre familles de défis tient-il ? -----------------
//
// L'auteur veut « un bon ratio de types de défis : achat, aventure,
// action de clic, mettre des pièces de côté ». Un groupe qui dérive vers
// tout-achat ou tout-Aventure devient monotone — et la dérive se fait
// par petites touches, invisible défi par défi.
function auditEquilibreFamilles(ecartMax = 0.5) {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const NIV = ['tapPower', 'critLevel', 'critDamageLevel',
    'sanctuaryLevel', 'veilleurLevel'];
  const AVENT = ['advLevelReached', 'battleWon', 'threeStarLevel',
    'powerActivated', 'runeBought', 'runeFused', 'maxCreatureLevel'];
  const ECO = ['totalEarned', 'coins', 'passiveIncome'];
  const famille = (m) => {
    if (m.startsWith('auto:') || m.startsWith('tapUpgrade:') || NIV.includes(m)) return 'achat';
    if (AVENT.includes(m)) return 'aventure';
    if (ECO.includes(m)) return 'economie';
    if (m === 'ascension') return 'ascension';
    return 'action';
  };
  const parGroupe = [];
  for (let g = 0; g < 6; g++) {
    const compte = { achat: 0, aventure: 0, economie: 0, action: 0 };
    for (let e = 0; e < 7; e++) {
      (D.DEFIS_ECRITS[g * 7 + e] || []).forEach((q) => {
        const f = famille(q.metric || '');
        if (compte[f] !== undefined) compte[f] += 1;
      });
    }
    parGroupe.push(compte);
  }
  // Chaque famille doit rester proche de sa moyenne sur les six groupes.
  const fautes = [];
  ['achat', 'aventure', 'economie', 'action'].forEach((f) => {
    const vals = parGroupe.map((c) => c[f]);
    const moy = vals.reduce((a, b) => a + b, 0) / vals.length;
    vals.forEach((v, g) => {
      if (moy > 0 && Math.abs(v - moy) / moy > ecartMax) {
        fautes.push({ groupe: g, famille: f, compte: v, moyenne: Math.round(moy) });
      }
    });
  });
  return fautes;
}
module.exports.auditEquilibreFamilles = auditEquilibreFamilles;

// ---- Un défi est-il réclamé avant que son sujet existe ? ------------
//
// Bug réel : un défi d'Aventure dans l'œuf 1, alors que le joueur n'a
// aucune créature. Plus largement, un défi dont le sujet n'est pas
// encore débloqué ne peut pas être rempli — et comme la séquence ne
// substitue plus, il bloque l'œuf DÉFINITIVEMENT.
function auditPrerequisTenus() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const AVENT = ['advLevelReached', 'battleWon', 'threeStarLevel',
    'powerActivated', 'runeBought', 'runeFused', 'maxCreatureLevel'];
  const fautes = [];
  // L'œuf 1 du tout premier groupe précède la première créature.
  (D.DEFIS_ECRITS[0] || []).forEach((q) => {
    if (AVENT.includes(q.metric)) {
      fautes.push({ oeuf: 1, id: q.id, probleme: "Aventure avant la première créature" });
    }
  });
  // Un palier de tap exige le Pacte 10 : il ne peut pas être demandé
  // avant qu'un défi de Pacte ait fait atteindre ce niveau.
  for (let g = 0; g < 6; g++) {
    let pacte = 0;
    for (let e = 0; e < 7; e++) {
      (D.DEFIS_ECRITS[g * 7 + e] || []).forEach((q) => {
        // ⚠️ Le Pacte repart du niveau 1 après une Ascension : acheter
        // N niveaux mène au niveau N + 1.
        if (q.metric === 'tapPower') {
          pacte = q.mode === 'delta' ? Math.max(pacte, 1) + q.target : Math.max(pacte, q.target);
        }
        if (q.metric.startsWith('tapUpgrade:') && pacte < 10) {
          fautes.push({ oeuf: g * 7 + e + 1, id: q.id,
            probleme: 'palier de tap demandé avec Pacte ' + pacte + ' (10 requis)' });
        }
      });
    }
  }
  return fautes;
}
module.exports.auditPrerequisTenus = auditPrerequisTenus;

// ---- Chaque métrique est-elle réellement INCRÉMENTÉE par le jeu ? ---
//
// ⚠️ C'EST L'ANGLE MORT LE PLUS DANGEREUX, et il est documenté depuis le
// début sans avoir jamais été couvert : les contrôles vérifient qu'une
// métrique est PUBLIÉE, jamais que le jeu l'augmente.
//
// Un défi portant sur une métrique que personne n'incrémente ne se
// termine JAMAIS. L'œuf est bloqué, la partie est morte, et rien dans le
// code ne signale quoi que ce soit — la métrique existe, elle vaut zéro.
//
// On cherche donc, dans l'écran de jeu, une écriture qui fasse monter
// chaque métrique : `setX(v + 1)`, `x += `, `trackEvent('x')`, etc.
function auditMetriquesIncrementees() {
  const fs = require('fs');
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const sources = ['/../src/screens/games/ClickerScreen.js',
    '/../src/screens/games/AdventureScreen.js',
    '/../src/screens/games/CombatScreen.js',
    '/../src/context/DailyContext.js']
    .map((f) => { try { return fs.readFileSync(__dirname + f, 'utf8'); } catch (e) { return ''; } })
    .join('\n');
  const fautes = [];
  const vues = new Set();
  D.DEFIS_ECRITS.flat().forEach((q) => {
    const m = q.metric || '';
    if (vues.has(m)) return;
    vues.add(m);
    // ⚠️ MÉTRIQUES DÉRIVÉES : elles ne sont pas incrémentées, elles sont
    // CALCULÉES à partir d'autre chose. Les signaler serait une fausse
    // alerte — mais il faut vérifier leur SOURCE, sinon l'angle mort se
    // déplace simplement d'un cran.
    const DERIVEES = {
      totalTaps: 'taps',              // compteur à vie de DailyContext
      passiveIncome: 'autoClickers',  // somme des générateurs possédés
      maxCreatureLevel: 'owned',      // plus haut niveau de la collection
    };
    const reel = DERIVEES[m] || m;
    // Les métriques composées sont incrémentées via leur conteneur.
    const nom = m.startsWith('auto:') ? 'autoClickers'
      : m.startsWith('tapUpgrade:') ? 'tapUpgrades'
        : m.startsWith('upgrade:') ? 'upgradeLevels' : reel;
    // Une écriture qui AUGMENTE : affectation incrémentale, setter avec
    // + 1, ou événement suivi.
    // ⚠️ Motifs écrits SANS échappement double : le bloc précédent les
    // doublait, produisant des expressions invalides qui plantaient le
    // contrôle au lieu de le faire échouer proprement.
    const maj = nom[0].toUpperCase() + nom.slice(1);
    const motifs = [
      nom + '\\s*\\+=',
      nom + '[^\\n]{0,40}\\+\\s*1',
      'set' + maj + '\\s*\\(',
      "trackEvent\\(\\s*'" + nom + "'",
      "trackMax\\(\\s*'" + nom + "'",
      nom + '\\s*:\\s*[^,\\n]*\\+',
    ].map((r) => new RegExp(r));
    if (!motifs.some((r) => r.test(sources))) {
      fautes.push({ metrique: m, source: reel,
        probleme: 'aucune écriture qui la fasse monter' });
    }
  });
  return fautes;
}
module.exports.auditMetriquesIncrementees = auditMetriquesIncrementees;

// ---- La durée d'un groupe monte-t-elle à chaque Ascension ? ---------
//
// Règle de l'auteur : « un peu facile au début et de plus en plus
// compliqué ». Une durée qui retombe après un pic donne le sentiment que
// le jeu se termine.
//
// ⚠️ La durée ne se lit nulle part : elle se MESURE en rejouant
// l'économie. C'est le seul contrôle qui simule une partie entière.
function auditDureeCroissante(baisseMax = 0.15) {
  const TAPS = 4;
  const duree = (a) => {
    const s = etatInitial();
    s.ascension = a;
    const seuil = C.ascensionThreshold(a);
    let t = 0, garde = 0;
    while ((s.totalEarned || 0) < seuil && garde++ < 8000) {
      const r = Math.max(1, production(s));
      const opts = [];
      const essaie = (cout, appliquer2) => {
        if (!isFinite(cout) || cout <= 0) return;
        const c = JSON.parse(JSON.stringify(s));
        appliquer2(c);
        const gain = production(c) - r;
        if (gain > 0) opts.push({ cout, gain, appliquer2 });
      };
      essaie(C.tapPowerCost(s.tapPower), (x) => { x.tapPower += 1; });
      C.AUTOCLICKERS.forEach((g) => {
        const n = (s.autoClickers || {})[g.id] || 0;
        essaie(C.autoClickerCost(g, n, a), (x) => { x.autoClickers[g.id] = n + 1; });
      });
      if (!opts.length) { t += (seuil - (s.totalEarned || 0)) / r; break; }
      opts.forEach((o) => { o.score = Math.max(0, (o.cout - (s.coins || 0)) / r) + o.cout / o.gain; });
      opts.sort((x, y) => x.score - y.score);
      const v = opts[0];
      const attente = Math.max(0, (v.cout - (s.coins || 0)) / r);
      const restant = (seuil - (s.totalEarned || 0)) / r;
      if (attente >= restant) { t += restant; break; }
      t += attente;
      s.coins = (s.coins || 0) + r * attente - v.cout;
      s.totalEarned = (s.totalEarned || 0) + r * attente;
      v.appliquer2(s);
    }
    return t / 3600;
  };
  const fautes = [];
  let precedente = null;
  for (let a = 0; a < 6; a++) {
    const h = duree(a);
    if (precedente !== null && h < precedente * (1 - baisseMax)) {
      fautes.push({ groupe: a, heures: +h.toFixed(1), avant: +precedente.toFixed(1) });
    }
    precedente = h;
  }
  return fautes;
}
module.exports.auditDureeCroissante = auditDureeCroissante;

// ---- Le document remis à l'auteur dit-il la même chose que le jeu ? -
//
// ⚠️ CE CONTRÔLE MANQUAIT, et son absence s'est vue immédiatement :
// après un réordonnancement des défis, le document n'a pas été
// régénéré. L'auteur a lu « Achète 4 niveaux de Pacte » là où le jeu
// affichait « Faveur des Esprits », et a cru à un bug du jeu.
//
// ⚠️ Je l'avais listé comme « idée » au lieu de l'écrire. C'était
// pourtant le seul capable d'attraper cette classe de défaut : un
// document juste au moment où il est produit, faux dès la modification
// suivante.
//
// Le document est la SORTIE, le fichier des défis la SOURCE. Ils doivent
// coïncider défi par défi, dans l'ordre.
function auditDocConforme(chemin) {
  const fs = require('fs');
  const doc = chemin || '/mnt/user-data/outputs/defis-paradox.md';
  let texte;
  try { texte = fs.readFileSync(doc, 'utf8'); } catch (e) {
    return [{ probleme: 'document introuvable : ' + doc }];
  }
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  // Les lignes du document : « - 2. 🔗 Achète 4 niveaux de Pacte ».
  const lus = {};
  texte.split('\n').forEach((l) => {
    const m = l.match(/^[-+ ]\s*(\d+)\.\s+\S+\s+(.*)$/);
    if (m) lus[Number(m[1])] = m[2].trim();
  });
  if (!Object.keys(lus).length) return [{ probleme: 'aucun défi lisible dans le document' }];
  const ecarts = [];
  let n = 0;
  D.DEFIS_ECRITS.forEach((oeuf) => oeuf.forEach((q) => {
    n += 1;
    const attendu = lus[n];
    if (attendu === undefined) return;
    const jeu = q.label(q.target).replace(/[\u202f\u00a0]/g, ' ').trim();
    if (attendu.replace(/[\u202f\u00a0]/g, ' ').trim() !== jeu) {
      ecarts.push({ defi: n, document: attendu, jeu });
    }
  }));
  return ecarts;
}
module.exports.auditDocConforme = auditDocConforme;

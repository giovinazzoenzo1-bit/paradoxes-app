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
// ⚠️⚠️ STRUCTURE DES GROUPES : LUE dans le moteur, jamais « 7 » en dur
// (24/09). Vingt calculs `g * 7`, `i / 7`, `i % 7` supposaient 7 œufs par
// Ascension ; l'A0 et l'A1 en ont 6 depuis la suppression de l'œuf 7.
// Avec l'ancien calcul, les contrôles auraient mesuré l'A1 sur un œuf de
// l'A2 — verts sur un jeu qui n'existe pas.
const oeufsDe = (D, g) => D.DEFIS_ECRITS.slice(Q.debutGroupe(g), Q.debutGroupe(g) + Q.tailleGroupe(g));
const numeroAvant = (D, g) => D.DEFIS_ECRITS.slice(0, Q.debutGroupe(g)).flat().length;

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
  // ⚠️ Multiplicateur du TAP couvrant Transe, critiques et pouvoirs de
  // créature, moins le temps passé hors du tap (menus, boutique,
  // Aventure). Calé sur les chronos RÉELS de l'auteur, pas deviné.
  facteurJoueurReel: 2.48,
  // ⚠️ PAUSES D'ÉNERGIE (24/09). L'auteur : « je n'ai pas compté le repos
  // pour les 5 énergies de l'Aventure : le joueur est hors ligne à ce
  // moment-là, ~1 h 15, et 9 fois dans l'Ascension (on est censé passer
  // le chapitre 4 niveau 5) ». Les gains hors ligne de chaque pause sont
  // crédités par LA fonction du jeu (`offlineEarnings`).
  //
  // ⚠️ 9 PAUSES PAR GROUPE, réparties sur sa durée — pas « une toutes les
  // 10 min ». La première version en créditait 17 à l'A0 et 25 à l'A2
  // (mesuré) : le nombre de recharges dépend des COMBATS à faire, pas du
  // temps passé à taper. Le simulateur estime d'abord la durée sans
  // pause, puis place les 9 pauses à intervalles réguliers.
  pausesParGroupe: 9,
  pauseDureeSec: 4500,
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
  load('defisEcrits').DEFIS_ECRITS.flat().forEach((q) => {
    if (!q.target || vus.has(q.id)) return;
    vus.add(q.id);
    // ⚠️ Les cibles dorées et les pouvoirs n'arrivent qu'à leur APPARITION
    // (environ une par minute) : ce ne sont pas des appuis d'affilée sur un
    // bouton. Rebranché sur les vraies valeurs le 21/09, ce contrôle les
    // signalait — il n'avait jusqu'ici vu que celles de l'Ascension 0.
    if (['goldenClaimed', 'powerActivated'].includes(q.metric)) return;
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
  // ⚠️ REBRANCHÉ le 21/09 sur les 252 défis ÉCRITS. Il lisait les anciens
  // modèles et restait vert quoi qu'on écrive dans le vrai fichier.
  //
  // Deux règles :
  //  1. le libellé affiche la cible réellement exigée ;
  //  2. un libellé à TEXTE FIGÉ n'est permis que si la cible ne peut
  //     jamais changer en cours de partie. Bug réel : « Atteins 29 000
  //     pièces par seconde » écrit en dur, quand la cible valait 10 ; et
  //     « Atteins 2 600 taps » figé alors que ce défi s'adapte.
  const F = load('questFormat');
  // ⚠️ Le nombre doit apparaître ENTIER, pas comme fragment d'un autre.
  // Le 21/09, la cible d'un défi est tombée à 2, et le faux libellé
  // « Atteins 29 000 pièces par seconde » passait le contrôle : il
  // contenait bien un « 2 ». Un contrôle qui compare des morceaux de
  // texte finit toujours par accepter n'importe quoi.
  const montre = (texte, t) => {
    const propre = String(texte).replace(/[\u202f\u00a0]/g, ' ');
    const entier = (v) => {
      const x = String(v).replace(/[\u202f\u00a0]/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(^|[^0-9])' + x + '([^0-9]|$)').test(propre);
    };
    return [String(t), F.fmtQ(t), F.describeAdventureLevel ? F.describeAdventureLevel(t) : null]
      .filter(Boolean).some(entier);
  };
  const fautes = [];
  load('defisEcrits').DEFIS_ECRITS.flat().forEach((q) => {
    const fige = /^\s*\(\s*\)\s*=>/.test(String(q.label));
    // ⚠️ Les défis d'ÉTAT s'adaptent aussi depuis le 21/09 (revenu par
    // seconde, Aventure, pièces de côté, Sanctuaire, Veilleur) : un texte
    // figé y mentirait tout autant.
    const peutChanger = !!(q.step || q.minStep || Q.estEtatAdapte(q.metric)
      || (q.mode === 'delta' && Q.estAchatAdaptable(q.metric)));
    if (fige && peutChanger) {
      fautes.push({ id: q.id, probleme: 'texte figé sur un défi dont la cible change en cours de partie' });
    }
    const essais = fige ? [q.target] : [2, 7, 13, 250, 12500, q.target];
    essais.forEach((t) => {
      if (t < 2) return; // « Active un pouvoir » : pas de chiffre à 1, c'est voulu
      let texte;
      try { texte = q.label(t); } catch (e) { return; } // couvert par auditDefisEcrits
      if (!montre(texte, t)) fautes.push({ id: q.id, cible: t, texte, probleme: "le libellé n'affiche pas la cible" });
    });
  });
  return fautes;
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
  // ⚠️ REBRANCHÉ le 21/09 sur les 252 défis ÉCRITS.
  //
  // Une métrique d'ÉTAT (solde, revenu par seconde, niveau d'un bâtiment
  // plafonné…) n'a pas de sens en mode delta : « gagne 100 de revenu en
  // plus » ne se lit pas. Seuls les ACHATS sans plafond y ont droit —
  // « Achète N », qui compte à partir de maintenant.
  const fautes = [];
  load('defisEcrits').DEFIS_ECRITS.flat().forEach((q) => {
    if (q.mode !== 'delta') return;
    const m = q.metric || '';
    if (Q.estAchatAdaptable(m)) return;
    if (METRIQUES_D_ETAT.includes(m)) {
      fautes.push({ id: q.id, metric: m, probleme: "métrique d'ÉTAT en mode delta" });
    }
  });
  return fautes;
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
function auditEmballement() {
  // ⚠️ REBRANCHÉ le 21/09 sur les 252 défis ÉCRITS.
  //
  // Les défis de PERFORMANCE ont une limite humaine : au-delà, le défi
  // n'est plus difficile, il est impossible. Limites posées par l'auteur
  // ou mesurées sur le jeu actuel :
  //   - taps d'affilée : 400 au maximum (règle de l'auteur, 20/09) ;
  //   - Transe tenue : 180 s ;
  //   - multiplicateur de Transe : x5,0 (stocké 50).
  const LIMITES = { maxTapStreak: 400, maxTranseHoldSec: 180, maxCombo: 50 };
  const fautes = [];
  load('defisEcrits').DEFIS_ECRITS.flat().forEach((q) => {
    const lim = LIMITES[q.metric];
    if (lim && q.target > lim) fautes.push({ id: q.id, metric: q.metric, cible: q.target, limite: lim });
  });
  return fautes;
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
  load('defisEcrits').DEFIS_ECRITS.flat().forEach((q) => {
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
      // ⚠️ DÉFIS RECALCULÉS À LEUR APPARITION : ce contrôle juge la cible
      // ÉCRITE, pas celle que le joueur verra. Depuis le 21/09 :
      //   - un RECORD (taps d'affilée, Transe) repart de zéro quand le
      //     défi s'affiche — « déjà 78 % acquis » n'a plus de sens ;
      //   - un défi d'ÉTAT (revenu/s, Aventure, pièces de côté,
      //     Sanctuaire, Veilleur) demande +20 %, +5 niveaux, +5 minutes…
      //     au-dessus de ce que le joueur a — il ne peut pas naître facile.
      // Leur difficulté est garantie par le jeu, et prouvée par
      // `auditCibleEtat` et `auditDefiInvisible` (chacun avec son
      // sabotage). Les juger ici sur leur cible écrite produisait des
      // alarmes fausses — 15 au passage à 8 défis par œuf.
      if (['maxTapStreak', 'maxTranseHoldSec', 'maxCombo'].includes(met) || Q.estEtatAdapte(met)) return;
      // ⚠️ Cibles dorées et pouvoirs : leurs chaînes sont fixées par
      // l'auteur pour la RÉTENTION (5 cibles à l'œuf 3, 11 pouvoirs à
      // l'œuf 6…). Elles sont rythmées par l'apparition des cibles et la
      // recharge des pouvoirs, pas par la difficulté : « trop facile » n'a
      // rien à y juger, et pousserait à les remonter contre sa règle.
      if (['goldenClaimed', 'powerActivated'].includes(met)) return;
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
  // ⚠️ REBRANCHÉ le 21/09 sur les 252 défis ÉCRITS.
  //
  // Une cible ÉCRITE est la même pour tout le monde. Bug réel du 20/09 :
  // le moteur remettait son échelle par-dessus des cibles déjà finales,
  // DEUX fois, et 35 défis affichaient autre chose que le document.
  //
  // Seules exceptions voulues : la règle du TOTAL des achats (qui ne peut
  // que réduire), le défi de créature (+5 au-dessus de ta meilleure) et
  // celui des taps (il en reste toujours à faire).
  const debutant = etatInitial();
  const avance = etatInitial();
  Object.assign(avance, { tapPower: 40, coins: 9e11, totalEarned: 4e12, critLevel: 25,
    critDamageLevel: 25, sanctuaryLevel: 50, veilleurLevel: 50, totalTaps: 900000,
    goldenClaimed: 500, powerActivated: 400, battleWon: 200, maxCreatureLevel: 90 });
  const fautes = [];
  load('defisEcrits').DEFIS_ECRITS.forEach((oeuf, i) => oeuf.forEach((q) => {
    if (q.step || q.minStep) return;
    if (q.mode === 'delta' && Q.estAchatAdaptable(q.metric)) return;
    const g = Q.groupeDeOeuf(i);
    debutant.ascension = g; avance.ascension = g;
    const a = Q.resolveQuestTarget(q, debutant);
    const b = Q.resolveQuestTarget(q, avance);
    if (a !== q.target || b !== q.target) {
      fautes.push({ id: q.id, ecrite: q.target, debutant: a, avance: b });
    }
  }));
  return fautes;
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
  // ⚠️ REBRANCHÉ le 21/09 sur les 252 défis ÉCRITS.
  //
  // Un texte cassé que le joueur lit tel quel : « Possède 14 un
  // article », « Achète 6 niveaux de une créature » (resté en ligne une
  // journée), « undefined », « NaN »…
  const MAUVAIS = /un article|undefined|NaN|\bnull\b|\[object|de une |de le |de les |\s{2,}/;
  const fautes = [];
  load('defisEcrits').DEFIS_ECRITS.flat().forEach((q) => {
    [1, 2, q.target].forEach((t) => {
      let texte;
      try { texte = q.label(t); } catch (e) { return; }
      if (MAUVAIS.test(String(texte))) fautes.push({ id: q.id, texte, probleme: 'texte cassé' });
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
      // ⚠️ On mesure la valeur de BASE de la boutique : la hausse VOULUE
      // de 35 % sur les premiers exemplaires des générateurs qu'une
      // Ascension demande (21/09) est retirée du calcul. Sans ça, ce
      // contrôle confondait une majoration délibérée et bornée avec le
      // vrai bug qu'il surveille — des prix qui ne suivent plus
      // l'Ascension (228 s à A0, 1 s à A5).
      const majoration = C.generateurMajore(g.id, a) ? 1 + C.PREMIERS_EXEMPLAIRES_MAJORATION : 1;
      // ⚠️ L'ajustement par Ascension (21/09) est lui aussi délibéré : il
      // monte prix ET seuil ensemble pour allonger les groupes. On le
      // retire du calcul, comme la majoration — ce contrôle surveille des
      // prix qui ne SUIVRAIENT PLUS l'Ascension, pas une calibration.
      // La surprime « avant son heure » (21/09) est délibérée aussi.
      return C.autoClickerCost(g, 0, a) / majoration / C.ajustementAscension(a)
        / C.surprimeGenerateur(g, a) / revenu;
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
function auditInfaisable(partMax = 0.6) {
  // ⚠️⚠️ RÉÉCRIT LE 21/09 — le contrôle des contrôles l'a trouvé AVEUGLE.
  //
  // Un défi à 40 niveaux de Pacte, d'un coût astronomique, passait sans
  // la moindre alerte. Deux trous :
  //   - il ne calculait le coût QUE des générateurs et paliers de tap : le
  //     Pacte, la Faveur et les Dégâts critiques lui échappaient ;
  //   - il lisait « Achète 3 » comme « atteins 3 » : un joueur possédant
  //     déjà 5 exemplaires y voyait un coût nul.
  //
  // Il suit désormais les 252 défis écrits, groupe par groupe, en tenant
  // le compte de ce que les défis précédents ont fait acheter — avec LA
  // fonction de coût du moteur, la même que `auditBudgetGroupe`. Un seul
  // instrument : deux calculs de coût qui divergent se contredisent sans
  // que personne le voie.
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const trouves = [];
  for (let g = 0; g < 6; g++) {
    const seuil = C.ascensionThreshold(g);
    const possede = {};
    for (let e = 0; e < Q.tailleGroupe(g); e++) {
      (D.DEFIS_ECRITS[Q.debutGroupe(g) + e] || []).forEach((q) => {
        const m = q.metric || '';
        const plafonne = m === 'sanctuaryLevel' || m === 'veilleurLevel';
        if (!Q.estAchatAdaptable(m) && !plafonne) return;
        const deja = possede[m] !== undefined ? possede[m] : Q.niveauDeBase(m);
        const n = q.mode === 'delta' ? q.target : Math.max(0, q.target - deja);
        let cout = 0;
        for (let i = deja; i < deja + n && i < deja + 400; i++) {
          cout += m === 'sanctuaryLevel' ? C.sanctuaryUpgradeCost(i)
            : m === 'veilleurLevel' ? C.veilleurUpgradeCost(i)
              : Q.coutNiveauAchat(m, i, g);
        }
        possede[m] = deja + n;
        if (!Number.isFinite(cout) || cout > seuil * partMax) {
          trouves.push({ id: q.id, texte: q.label(q.target),
            part: Number.isFinite(cout) ? Math.round(100 * cout / seuil) : 'infini' });
        }
      });
    }
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
// ⚠️ Tolérance à 75 %. Ce que le plafond garantit, c'est qu'on ne
// demande qu'UN exemplaire à un joueur qui a sur-investi — pas que cet
// exemplaire soit bon marché. Un palier de tap coûte 45 % de plus par
// niveau : le 19e vaut mécaniquement une fortune, et c'est le prix du
// choix du joueur, pas un défaut de calibrage.
function auditPlafondAchats(partMax = 0.75) {
  const fautes = [];
  // ⚠️ On parcourt les défis ÉCRITS, pas les anciens modèles : ce sont
  // eux que le joueur reçoit. Le contrôle testait encore `QUEST_SEQUENCE`
  // après la bascule et mesurait donc des défis qui n'existent plus.
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  [0, 1, 2, 3, 4, 5].forEach((groupe) => {
    (oeufsDe(D, groupe).flat()).forEach((q) => {
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
      // ⚠️ LA PENTE EST LUE, plus écrite en dur (24/09). Le 1,15 des
      // paliers valait pour une croissance de 1,45 : à ×2,5 un seul
      // niveau au-delà du plafond coûte 2,5× tout le dernier palier
      // demandé, et le joueur « en avance » de 15 % possédait 118 % du
      // seuil sur un seul article — situation inatteignable, le contrôle
      // refusait des réglages corrects. L'avance en niveaux se réduit avec
      // la pente : 1 + 0,15 × 0,45 / (croissance − 1), soit 1,15 à ×1,45
      // (la valeur historique) et 1,045 à ×2,5 (« possède le total du
      // groupe », et le défi lui demande le niveau suivant).
      const avanceTap = 1 + 0.15 * (0.45 / (Math.max(1.01, item.growth || 1.6) - 1));
      const possede = Math.round(plafond * (estAuto ? 1.5 : avanceTap));
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
  // ⚠️⚠️ AUCUNE TRACE DE CODE TRANSFORMÉ DANS LA SOURCE.
  //
  // Bug du 21/09 : en regénérant ce fichier, un outil a recopié le code
  // des libellés APRÈS sa transformation par Babel. `fmtQ` est devenu
  // `(0, _questFormat.fmtQ)` — un nom qui n'existe pas dans l'app, Babel
  // renommant l'import quand il voit ce nom déjà pris. Chaque défi de
  // revenu passif aurait planté À L'AFFICHAGE, et la compilation passait
  // quand même : le code est syntaxiquement valide.
  //
  // ⚠️ Ne JAMAIS regénérer ce fichier en sérialisant `String(q.label)`
  // d'un module chargé : c'est le code transformé. Partir du texte
  // source.
  const source = require('fs').readFileSync(
    require('path').join(__dirname, '../src/games/clicker/defisEcrits.js'), 'utf8');
  const traces = source.match(/\(0, _\w+|_interopRequire\w*|_questFormat/g);
  if (traces) fautes.push({ probleme: traces.length + ' trace(s) de code transformé : ' + traces[0] });
  const vus = new Set();
  D.DEFIS_ECRITS.forEach((oeuf, i) => {
    // ⚠️ 8 défis par œuf depuis le 21/09 — demande de l'auteur. Le dernier
    // œuf d'un groupe peut en avoir 9 : l'A0 et l'A1 y portent l'Ascension
    // déplacée de l'œuf 7 supprimé (24/09).
    const dernierDuGroupe = Q.rangDansGroupe(i) === Q.tailleGroupe(Q.groupeDeOeuf(i)) - 1;
    if (!(oeuf.length === 8 || (dernierDuGroupe && oeuf.length === 9))) {
      fautes.push({ oeuf: i + 1, probleme: oeuf.length + ' défis' });
    }
    // Chaque libellé doit s'EXÉCUTER — un nom introuvable ne se voit pas
    // à la compilation, seulement à l'affichage.
    oeuf.forEach((q) => {
      [1, 2, 7, q.target].forEach((t) => {
        try {
          const x = q.label(t);
          if (typeof x !== 'string' || !x.trim()) fautes.push({ oeuf: i + 1, probleme: 'libellé vide : ' + q.id });
        } catch (err) {
          fautes.push({ oeuf: i + 1, probleme: 'libellé qui PLANTE (' + q.id + ') : ' + err.message });
        }
      });
    });
    oeuf.forEach((q) => {
      if (vus.has(q.id)) fautes.push({ oeuf: i + 1, probleme: 'identifiant en double : ' + q.id });
      vus.add(q.id);
      if (!q.metric) fautes.push({ oeuf: i + 1, probleme: 'métrique absente : ' + q.id });
      if (!q.target || q.target <= 0) fautes.push({ oeuf: i + 1, probleme: 'cible nulle : ' + q.id });
      if (typeof q.label !== 'function') fautes.push({ oeuf: i + 1, probleme: 'libellé absent : ' + q.id });
    });
    // L'Ascension clôt chaque groupe de sept œufs.
    if (Q.rangDansGroupe(i) === Q.tailleGroupe(Q.groupeDeOeuf(i)) - 1) {
      const dernier = oeuf[oeuf.length - 1];
      if (!dernier || dernier.metric !== 'ascension') {
        fautes.push({ oeuf: i + 1, probleme: "le dernier œuf du groupe ne finit pas par l'Ascension" });
      }
    }
  });
  // Le tirage doit rendre EXACTEMENT l'œuf écrit, dans le même ordre.
  D.DEFIS_ECRITS.forEach((oeuf, i) => {
    const s2 = etatInitial();
    s2.ascension = Q.groupeDeOeuf(i);
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
    let numero = numeroAvant(D, groupe);
    for (let e = 0; e < Q.tailleGroupe(groupe); e++) {
      const oeuf = D.DEFIS_ECRITS[Q.debutGroupe(groupe) + e] || [];
      oeuf.forEach((q) => {
        numero += 1;
        const m = q.metric || '';
        const estAuto = m.startsWith('auto:');
        const estTap = m.startsWith('tapUpgrade:');
        if (!estAuto && !estTap && !NIVEAUX.includes(m)) return;
        const item = estAuto ? C.AUTOCLICKERS.find((x) => x.id === m.slice(5))
          : estTap ? C.TAP_UPGRADES.find((x) => x.id === m.slice(11)) : null;
        // ⚠️ Niveau de départ réel : le Pacte repart de 1, pas de 0.
        const deja = possede[m] !== undefined ? possede[m] : Q.niveauDeBase(m);
        // En mode delta la cible est un NOMBRE D'ACHATS ; en absolu,
        // c'est un niveau à atteindre depuis ce qu'on a déjà.
        const aAcheter = q.mode === 'delta' ? q.target : Math.max(0, q.target - deja);
        let cout = 0;
        for (let n = deja; n < deja + aAcheter; n++) {
          // ⚠️ LA fonction de coût du moteur, pas une copie.
          if (m === 'sanctuaryLevel') cout += C.sanctuaryUpgradeCost(n);
          else if (m === 'veilleurLevel') cout += C.veilleurUpgradeCost(n);
          else cout += Q.coutNiveauAchat(m, n, groupe);
        }
        possede[m] = deja + aAcheter;
        if (cout <= 0) return;
        // ⚠️ L'ŒUF 1 DE L'ASCENSION 0 EST EXEMPTÉ. C'est le tutoriel, et
        // l'auteur y a fixé chaque défi à sa place (« 2 = Pacte, 4 =
        // Faveur 7 »). L'ordre des coûts y cède à l'ordre pédagogique.
        const tutoriel = groupe === 0 && e === 0;
        if (!tutoriel && precedent && cout < precedent.cout * (1 - tolerance)) {
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
// ⚠️⚠️ A0 ET A1 : BORNES PROPRES, décision de l'auteur du 24/09.
// « Annuler l'œuf 7 », « en réalité je veux juste un décalage » : l'œuf 7
// part avec ses achats (49 % du seuil à l'A0, 57 % à l'A1), le seuil ne
// bouge pas. Les achats tombent à 43 % et 30 % : le reste se farme après
// l'œuf 6. MESURÉ à l'A0 sur son propre chrono : il lui restait 537 K
// sur 3,14 M, soit ~15 min à son rythme. L'A1 n'a pas encore de chrono.
// Des bornes et non une exemption : une dérive se voit encore.
const BUDGET_DECALAGE = { 0: [0.35, 0.55], 1: [0.22, 0.40] };
function auditBudgetGroupe(min = 0.80, max = 1.00) {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const NIV = ['tapPower', 'critLevel', 'critDamageLevel',
    'sanctuaryLevel', 'veilleurLevel'];
  const fautes = [];
  for (let g = 0; g < 6; g++) {
    const possede = {};
    let total = 0;
    for (let e = 0; e < Q.tailleGroupe(g); e++) {
      (D.DEFIS_ECRITS[Q.debutGroupe(g) + e] || []).forEach((q) => {
        const m = q.metric || '';
        // ⚠️ LA fonction de coût du moteur — jamais une copie. Un contrôle
        // qui calcule ses coûts à sa façon mesure autre chose que le jeu.
        if (!NIV.includes(m) && !m.startsWith('auto:') && !m.startsWith('tapUpgrade:')) return;
        const deja = possede[m] !== undefined ? possede[m] : Q.niveauDeBase(m);
        const n = q.mode === 'delta' ? q.target : Math.max(0, q.target - deja);
        for (let i = deja; i < deja + n; i++) {
          total += (m === 'sanctuaryLevel') ? C.sanctuaryUpgradeCost(i)
            : (m === 'veilleurLevel') ? C.veilleurUpgradeCost(i)
            : Q.coutNiveauAchat(m, i, g);
        }
        possede[m] = deja + n;
      });
    }
    const part = total / C.ascensionThreshold(g);
    const [bas, haut] = BUDGET_DECALAGE[g] || [min, max];
    if (part < bas || part > haut) {
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
    for (let e = 0; e < Q.tailleGroupe(g); e++) {
      (D.DEFIS_ECRITS[Q.debutGroupe(g) + e] || []).forEach((q) => {
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
    for (let e = 0; e < Q.tailleGroupe(g); e++) {
      (D.DEFIS_ECRITS[Q.debutGroupe(g) + e] || []).forEach((q) => {
        // ⚠️ Le Pacte repart du niveau 1 après une Ascension : acheter
        // N niveaux mène au niveau N + 1.
        if (q.metric === 'tapPower') {
          pacte = q.mode === 'delta' ? Math.max(pacte, 1) + q.target : Math.max(pacte, q.target);
        }
        if (q.metric.startsWith('tapUpgrade:') && pacte < 10) {
          fautes.push({ oeuf: Q.debutGroupe(g) + e + 1, id: q.id,
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
  // ⚠️ Appelle LE simulateur unique. Il avait le sien : il mesurait donc
  // autre chose que `duree.js`, et les deux se contredisaient sans que
  // rien ne le signale. Un contrôle qui mesure avec son propre
  // instrument ne contrôle que lui-même.
  const fautes = [];
  let precedente = null;
  for (let a = 0; a < 6; a++) {
    const h = simulerGroupe(a).heures;
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
  // ⚠️ La copie DU DÉPÔT (24/09) : le document vivait hors du dépôt, dans
  // un dossier de session, et une nouvelle conversation démarrait sans
  // lui. Généré par `mobile/tools/generer-doc.py`.
  const doc = chemin || require('path').join(__dirname, '../DEFIS_PARADOX.md');
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

// ---- LE simulateur de groupe, seul et unique ------------------------
//
// ⚠️⚠️ DEUX SIMULATEURS QUI NE PARTAGENT PAS LEUR ÉTAT NE PEUVENT PAS
// ÊTRE COMPARÉS. Ce piège a coûté du temps quatre fois : `duree.js` et
// le contrôle donnaient 2,9 h et 9,4 h pour le même groupe, et j'ai
// cherché le défaut dans l'équilibrage alors qu'il était dans mes
// instruments.
//
// Il n'y a donc plus qu'UNE fonction. `duree.js`, `auditDureeCroissante`
// et toute mesure future l'appellent. Un désaccord devient impossible.
function simulerGroupe(ascension, tapsParSec, options) {
  const a = ascension;
  const taps = tapsParSec || H.tapsParSec;
  // Intervalle entre deux pauses : la durée SANS pause divisée en N+1.
  // Une seule passe préalable, sans pause, sert d'estimation.
  const sansPause = options && options.sansPause;
  const nbPauses = sansPause ? 0 : (H.pausesParGroupe || 0);
  const intervallePause = nbPauses > 0
    ? simulerGroupe(a, taps, { sansPause: true }).tActif / (nbPauses + 1) : 0;
  const s = etatInitial();
  s.ascension = a;
  s.tapPower = 1;
  s.coins = 0;
  s.totalEarned = 0;
  const rev = () => {
    const passif = C.passiveRate({
      autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
      sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: a,
    });
    const mult = C.sanctuaryMultiplier(s.sanctuaryLevel || 0)
      * C.essenceBonusMultiplier(s.essence || 0)
      * C.ascensionSpeedMultiplier(a)
      * (1 + C.upgradeBonuses(s.upgradeLevels || {}).coinPct);
    // ⚠️⚠️ LE TAP EST MULTIPLIÉ PAR CE QUE LE JOUEUR FAIT VRAIMENT.
    //
    // Le jeu calcule : tap × pouvoir de créature × Transe × critique.
    // Le simulateur ignorait les TROIS, et annonçait 3,0 h pour l'A0 quand
    // l'auteur en mesurait 1 h 05 — « tu t'es trompé dans tes calculs ».
    //
    // Chacun est énorme pris seul : Transe ×3 après 50 taps, critiques
    // ×1,26 au début de l'A0 et ×2,78 à la fin, pouvoir de créature ×12
    // pendant 15 s par minute. Les empiler donnerait ×14 et une Ascension
    // en 12 minutes : faux aussi, parce que le joueur passe du temps dans
    // les menus, la boutique et l'Aventure, ne tient pas la Transe en
    // continu et n'attrape pas toutes les bulles.
    //
    // ⚠️ On ne DEVINE donc pas ces facteurs : un seul coefficient, CALÉ SUR
    // LES CHRONOS RÉELS de l'auteur (21/09) :
    //     défi 17 atteint en 20 min · défi 32 en 50 min · A0 en 1 h 05
    // Il vaut ce qu'il vaut : la mesure, pas l'intuition. À revoir dès
    // qu'un chrono le contredit.
    return passif + (C.tapDamage(s.tapPower) + C.tapUpgradeBonus(s.tapUpgrades || {}))
      * taps * mult * H.facteurJoueurReel;
  };
  const seuil = C.ascensionThreshold(a);
  let t = 0, garde = 0, passifFinal = 0;
  // Jalon de DÉPART : sans lui, un défi de l'œuf 1 n'aurait aucun état
  // de référence et le contrôle de faisabilité le laisserait passer.
  // ⚠️ Chaque jalon note aussi la PRODUCTION (tap + passif) du moment.
  // Ajout du 21/09 : c'est l'étalon des défis « Mets N pièces de côté ».
  // Rien d'autre ne change dans le calcul.
  const jalons = [{ t: 0, passif: 0, production: rev() }];
  let prochainePause = intervallePause;
  let pausesFaites = 0;
  while (s.totalEarned < seuil && garde++ < 20000) {
    // Pause d'énergie : gains hors ligne crédités, temps actif inchangé.
    if (nbPauses > 0 && pausesFaites < nbPauses && t >= prochainePause) {
      prochainePause += intervallePause;
      pausesFaites += 1;
      const pf = C.passiveRate({ autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
        sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: a });
      const gain = C.offlineEarnings(pf, H.pauseDureeSec);
      s.coins += gain; s.totalEarned += gain;
    }
    const r = rev();
    const options = [{ cout: C.tapPowerCost(s.tapPower), appliquer: (x) => { x.tapPower += 1; } }];
    C.AUTOCLICKERS.forEach((g) => {
      const n = (s.autoClickers || {})[g.id] || 0;
      options.push({ cout: C.autoClickerCost(g, n, a), appliquer: (x) => { x.autoClickers[g.id] = n + 1; } });
    });
    // ⚠️ UN PALIER DE TAP SE DÉBLOQUE. Sans cette garde, le simulateur
    // achetait des paliers verrouillés et rendait le jeu sept fois plus
    // rapide qu'il ne l'est — c'est l'écart qui opposait mes deux
    // instruments : l'un ignorait les paliers, l'autre les prenait tous.
    C.TAP_UPGRADES.forEach((u, idx) => {
      const n = (s.tapUpgrades || {})[u.id] || 0;
      if (!C.tapUpgradeUnlocked(idx, s.tapPower, s.tapUpgrades || {})) return;
      options.push({ cout: C.tapUpgradeCost(u, n, a), appliquer: (x) => { x.tapUpgrades[u.id] = n + 1; } });
    });
    options.forEach((o) => {
      const cp = { ...s, autoClickers: { ...s.autoClickers }, tapUpgrades: { ...s.tapUpgrades } };
      o.appliquer(cp);
      const sauve = { ac: s.autoClickers, tu: s.tapUpgrades, tp: s.tapPower };
      s.autoClickers = cp.autoClickers; s.tapUpgrades = cp.tapUpgrades; s.tapPower = cp.tapPower;
      o.gain = rev() - r;
      s.autoClickers = sauve.ac; s.tapUpgrades = sauve.tu; s.tapPower = sauve.tp;
      o.score = o.gain > 0 ? Math.max(0, (o.cout - s.coins) / r) + o.cout / o.gain : Infinity;
    });
    options.sort((x, y) => x.score - y.score);
    const v = options[0];
    if (!v || !isFinite(v.score)) { t += (seuil - s.totalEarned) / r; break; }
    const attente = Math.max(0, (v.cout - s.coins) / r);
    const restant = (seuil - s.totalEarned) / r;
    if (attente >= restant) { t += restant; break; }
    t += attente;
    jalons.push({ t, production: r, passif: C.passiveRate({
      autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
      sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: a }) });
    s.coins += r * attente - v.cout;
    s.totalEarned += r * attente;
    v.appliquer(s);
  }
  // ⚠️ Le passif MOYEN, pas celui de la fin. L'auteur : « le joueur
  // n'obtient pas le maximum de gains hors ligne dès le début, il
  // commence à 0 ». Mesurer le passif final surestimait l'apport du
  // hors ligne d'un facteur dix sur les premiers groupes.
  passifFinal = C.passiveRate({
    autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
    sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: a,
  });
  // Passif MOYEN pondéré par le temps : ce qu'un joueur qui se
  // déconnecte à un moment quelconque du groupe obtient en espérance.
  let somme = 0, prec = 0;
  jalons.forEach((j) => { somme += j.passif * (j.t - prec); prec = j.t; });
  const passifMoyen = t > 0 ? somme / t : 0;
  // `etat` : l'état FINAL du joueur simulé (Pacte, paliers, générateurs),
  // pour lire d'où vient la production — ajouté le 24/09 pour mesurer la
  // croissance des paliers de tap. Lecture seule, rien d'autre ne change.
  return { heures: t / 3600, tActif: t, pauses: pausesFaites, passif: passifFinal, passifMoyen, seuil, production: rev(), jalons, etat: s };
}
module.exports.simulerGroupe = simulerGroupe;

// ---- Le hors ligne suit-il le calcul standard, et ne casse-t-il rien ?
//
// Règle de l'auteur du 21/09, après vérification chez Cookie Clicker,
// Idle Miner Tycoon et AdVenture Capitalist : production des
// AUTOCLICKERS × 25 % × temps, plafonnée à 2 h, sans plancher. Le tap
// n'y entre pas.
//
// ⚠️⚠️ LE RISQUE QUE L'AUTEUR NE PEUT PAS VÉRIFIER LUI-MÊME : le gain
// s'ajoute à `totalEarned`, qui décide de l'Ascension. Un seul `NaN`
// rendrait `totalEarned` égal à `NaN` pour toujours — il est sauvegardé
// — et `NaN >= seuil` est toujours FAUX : le joueur ne pourrait plus
// jamais ascensionner, sans aucun message. Ce contrôle ATTAQUE donc la
// fonction avec toutes les entrées pourries possibles.
function auditHorsLigne() {
  const fautes = [];
  const R = C.OFFLINE_RATE, CAP = C.OFFLINE_CAP_SECONDS;
  // 1. Le calcul standard, au cas exact signalé par l'auteur.
  const attendu = Math.floor(337 * CAP * R);
  if (C.offlineEarnings(337, 8 * 3600) !== attendu) {
    fautes.push({ probleme: 'calcul non standard : 337/s une nuit ne donne pas ' + attendu });
  }
  // 2. Jamais plus que 25 % de 2 h de passif : pas de plancher caché.
  [1, 50, 337, 5000, 2e6].forEach((p) => {
    if (C.offlineEarnings(p, 30 * 86400) > p * CAP * R) {
      fautes.push({ probleme: 'plancher caché : ' + p + '/s reçoit plus que sa production' });
    }
  });
  // 3. Le tap ne compte pas : un passif nul rend zéro.
  if (C.offlineEarnings(0, CAP) !== 0) fautes.push({ probleme: 'un passif nul rapporte quelque chose' });
  // 4. ATTAQUE : aucune entrée ne doit produire un résultat dangereux.
  const pourris = [undefined, null, NaN, -1, -Infinity, Infinity, '', 'abc', {}, []];
  const bons = [337, 7200];
  pourris.forEach((v) => {
    [[v, bons[1]], [bons[0], v]].forEach(([p, t]) => {
      const g = C.offlineEarnings(p, t);
      if (!Number.isInteger(g) || g < 0 || !Number.isFinite(g)) {
        fautes.push({ probleme: 'entrée ' + String(v) + ' -> sortie dangereuse ' + String(g) });
      }
    });
  });
  // 5. La conséquence réelle : l'Ascension reste atteignable.
  const total = 0 + C.offlineEarnings(NaN, NaN);
  if (!(total >= 0)) fautes.push({ probleme: "l'Ascension deviendrait impossible" });
  return fautes;
}
module.exports.auditHorsLigne = auditHorsLigne;

// ---- Le défi est-il faisable AU MOMENT OÙ IL ARRIVE ? ---------------
//
// Demandé par l'auteur le 21/09, après le défi « Atteins 29 000 pièces
// par seconde » : il le trouvait « compliqué et abusé ». Il avait
// raison — à l'œuf 2 de l'Ascension 4, le passif du joueur est à 0.
// Le défi réclamait 29 000 fois ce qu'il avait.
//
// ⚠️⚠️ C'EST LA DEUXIÈME FOIS LE MÊME JOUR QUE CE PIÈGE COÛTE CHER. Mes
// contrôles mesuraient la situation en FIN de groupe (1,6 million par
// seconde) et concluaient « atteignable ». Le hors ligne avait la même
// faute : 72 % du seuil au dernier instant, 0,1 % en moyenne. Mesurer la
// fin d'un groupe décrit un joueur qui a DÉJÀ tout fait — jamais celui
// qui reçoit le défi.
//
// LA RÈGLE : un défi tombé dans l'œuf e doit pouvoir être rempli avant
// la fin de cet œuf. On lit l'état du joueur au moment où l'œuf SUIVANT
// commencerait, et la cible doit être atteinte.
//
// ⚠️ La métrique est LUE dans la simulation (`jalons`), jamais estimée à
// part : un contrôle qui mesure avec son propre instrument ne contrôle
// que lui-même.
function auditFaisableAuMoment(marge = 1.0) {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const fautes = [];
  const sims = {};
  D.DEFIS_ECRITS.forEach((oeuf, i) => {
    const g = Q.groupeDeOeuf(i);
    const e = Q.rangDansGroupe(i);
    if (g > 5) return;
    const r = sims[g] || (sims[g] = simulerGroupe(g));
    if (!r.jalons || !r.jalons.length) return;
    // Fin de l'œuf e = début de l'œuf e + 1, en temps de jeu.
    const tFin = ((e + 1) / Q.tailleGroupe(g)) * r.heures * 3600;
    let etat = r.jalons[0];
    r.jalons.forEach((j) => { if (j.t <= tFin) etat = j; });
    // ⚠️ Le simulateur optimise le REVENU, pas les défis : en début de
    // groupe il achète du tap et laisse le passif à zéro. Un joueur qui
    // SUIT le défi achèterait quelques générateurs. On retient donc le
    // plus grand de deux : le passif simulé, ou celui de trois
    // exemplaires du générateur le moins cher — ce qu'un joueur obtient
    // pour presque rien s'il le décide.
    // ⚠️ Le générateur le MOINS CHER, pas le plus productif sous un seuil
    // de coût. Filtrer « moins de 5 % du seuil » laissait passer des
    // paliers hauts aux dernières Ascensions, dont le seuil est énorme :
    // le contrôle retenait le Colosse de Pierre (198 000/s) comme
    // référence « bon marché » à l'Ascension 4, et acceptait donc un défi
    // à 29 000/s tombé à un moment où le joueur n'a rien.
    let moinsCher = null;
    C.AUTOCLICKERS.forEach((it) => {
      const cout = [0, 1, 2].reduce((acc, n) => acc + C.autoClickerCost(it, n, g), 0);
      if (!moinsCher || cout < moinsCher.cout) moinsCher = { it, cout };
    });
    const bonMarche = moinsCher ? C.passiveRate({
      autoClickers: { [moinsCher.it.id]: 3 }, upgradeLevels: {},
      sanctuaryLevel: 0, essence: 0, ascensionCount: g }) : 0;
    oeuf.forEach((q) => {
      if (q.metric !== 'passiveIncome') return;
      const atteint = Math.max(etat ? etat.passif : 0, bonMarche);
      if (q.target > atteint * marge) {
        fautes.push({ defi: q.id, oeuf: i + 1, texte: q.label(q.target),
          demande: q.target, aCeMoment: Math.round(atteint),
          ecart: +(q.target / Math.max(1, atteint)).toFixed(1) });
      }
    });
  });
  return fautes;
}
module.exports.auditFaisableAuMoment = auditFaisableAuMoment;

// ---- Les cibles « Mets N de côté » suivent-elles encore l'étalon ? ----
//
// Règle de l'auteur : une cible écrite de côté vaut 94 secondes de
// production (la valeur de ses 18 000 au défi 11) à la fin de l'œuf où
// elle tombe ; le jeu monte ensuite à « ce qu'il a + 5 minutes » à
// l'apparition. Une cible écrite trop HAUTE passe devant cette règle et
// réclame plus que 5 minutes ; trop BASSE, elle ne sert plus à rien.
//
// ⚠️ TROUVÉ LE 24/09 : la passe 2 (paliers ×2,5) a divisé la production
// par 2 à 7 selon le groupe, et aucun contrôle ne regardait ce ratio —
// `auditFaisableAuMoment` ne juge que le passif. « Mets 32 M de côté » à
// l'A2 valait 7 fois l'étalon, soit 11 minutes de production au lieu de
// 5. Quarante cibles d'état ont dû être recalculées après coup.
// Tolérance large (÷2, ×2) : l'arrondi et le « +15 % mini entre deux »
// écartent déjà les cibles de l'étalon exact.
function auditCoteEtalon(secondes = 94, min = 0.5, max = 2.0) {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const fautes = [];
  const sims = {};
  D.DEFIS_ECRITS.forEach((oeuf, i) => {
    const g = Q.groupeDeOeuf(i);
    const e = Q.rangDansGroupe(i);
    // L'A0 est le tutoriel réglé à la main avec l'auteur : exempté.
    if (g < 1 || g > 5) return;
    const r = sims[g] || (sims[g] = simulerGroupe(g));
    if (!r.jalons || !r.jalons.length) return;
    const tFin = ((e + 1) / Q.tailleGroupe(g)) * r.heures * 3600;
    let etat = r.jalons[0];
    r.jalons.forEach((j) => { if (j.t <= tFin) etat = j; });
    const etalon = secondes * Math.max(1, etat.production || 0);
    oeuf.forEach((q) => {
      if (q.metric !== 'coins' || q.mode !== 'absolute') return;
      const ratio = q.target / etalon;
      if (ratio < min || ratio > max) {
        fautes.push({ defi: q.id, oeuf: i + 1, ecrit: q.target,
          etalon: Math.round(etalon), ratio: +ratio.toFixed(2) });
      }
    });
  });
  return fautes;
}
module.exports.auditCoteEtalon = auditCoteEtalon;

// ---- Le système de signalement fonctionne-t-il, et ne casse-t-il rien ?
//
// Demandé par l'auteur le 21/09 : savoir si un joueur est bloqué, et
// recevoir un rapport. Il ne peut RIEN vérifier de tout ça sur son
// téléphone — ni le détecteur, ni le rapport, ni surtout le filet de
// sécurité d'`index.js`, qui ne se déclenche que quand tout a planté.
// Ce contrôle le fait à sa place, à chaque vérification.
//
// ⚠️⚠️ LE FILET EST ATTAQUÉ POUR DE VRAI : `index.js` est rejoué avec de
// faux modules, dont certains cassés exprès. Il doit TOUJOURS appeler le
// gestionnaire d'origine et ne JAMAIS planter lui-même — sinon on
// retombe sur l'écran blanc muet qu'il existe pour empêcher.
//
// ⚠️ Premier essai de ce test : il annonçait « tout va bien » alors que
// le filet ne mémorisait rien. Le banc ne convertissait pas les modules
// comme le fait l'app (`modules: 'commonjs'` manquant) : chaque `require`
// échouait, et les `try` avalaient l'erreur en silence. Un test qui
// passe n'est pas un test qui marche — il faut vérifier qu'il voit ce
// qu'il prétend voir.
function auditSignalement() {
  const fautes = [];
  const Dg = load('diagnostic');
  const bon = { coins: 100, totalEarned: 5000, seuil: 1e6,
    defis: [{ id: 'a', trouve: true, label: 'X', current: 3, target: 10, progress: 0.3, done: false }],
    suivi: {} };
  // 1. Aucun faux positif sur un état sain.
  if (Dg.detecterBlocages(bon).length) fautes.push({ probleme: 'faux positif sur un état sain' });
  // 2. Chaque panne bloquante est détectée.
  const pannes = [
    ['totalEarned NaN', { ...bon, totalEarned: NaN }, 'totalEarned'],
    ['totalEarned infini', { ...bon, totalEarned: Infinity }, 'totalEarned'],
    ['pièces négatives', { ...bon, coins: -5 }, 'coins'],
    ['seuil nul', { ...bon, seuil: 0 }, 'seuil'],
    ['aucun défi', { ...bon, defis: [] }, 'aucunDefi'],
    ['défi introuvable', { ...bon, defis: [{ ...bon.defis[0], trouve: false }] }, 'inconnu:a'],
    ['cible invalide', { ...bon, defis: [{ ...bon.defis[0], target: NaN }] }, 'cible:a'],
    ['progression NaN', { ...bon, defis: [{ ...bon.defis[0], current: NaN }] }, 'progression:a'],
    ['immobile 3 h', { ...bon, suivi: { a: { current: 3, stagneSec: 3 * 3600 } } }, 'stagnation:a'],
  ];
  pannes.forEach(([nom, etat, code]) => {
    if (!Dg.detecterBlocages(etat).some((p) => p.code === code)) {
      fautes.push({ probleme: 'panne non détectée : ' + nom });
    }
  });
  // Un défi TERMINÉ n'est jamais « bloqué », même immobile.
  const fini = { ...bon, defis: [{ ...bon.defis[0], done: true }], suivi: { a: { current: 3, stagneSec: 99999 } } };
  if (Dg.detecterBlocages(fini).length) fautes.push({ probleme: 'un défi terminé est signalé bloqué' });
  // 3. Le suivi de stagnation : immobile cumule, bouger remet à zéro.
  let s1 = Dg.suivreStagnation({}, [{ id: 'a', current: 3 }], 60);
  s1 = Dg.suivreStagnation(s1, [{ id: 'a', current: 3 }], 60);
  if (s1.a.stagneSec !== 60) fautes.push({ probleme: 'la stagnation ne cumule pas' });
  if (Dg.suivreStagnation(s1, [{ id: 'a', current: 4 }], 60).a.stagneSec !== 0) {
    fautes.push({ probleme: 'un progrès ne remet pas la stagnation à zéro' });
  }
  // 4. Le rapport : complet, et borné même avec des entrées énormes.
  const r = Dg.construireRapport({ instantane: { ...bon, ascension: 4, oeuf: 29, problemes: [] },
    build: { sha: 'abc1234', time: 'T' }, appareil: 'android 14' });
  ['abc1234', 'Ascension : 4', 'Œuf : 30', 'android 14', 'X —'].forEach((m) => {
    if (!r.includes(m)) fautes.push({ probleme: 'le rapport ne contient pas « ' + m + ' »' });
  });
  const enorme = Dg.construireRapport({ instantane: { ...bon, defis: Array(400).fill(bon.defis[0]) } });
  if (enorme.length > Dg.RAPPORT_LONGUEUR_MAX) fautes.push({ probleme: 'rapport trop long : ' + enorme.length });
  if (!/ce que tu faisais/.test(enorme)) fautes.push({ probleme: 'la troncature a coupé l\'invitation finale' });
  // 5. Le lien mail : bonne adresse, corps restitué à l'identique.
  const lien = Dg.lienMailto('Sujet', 'ligne 1\nligne 2');
  if (!lien.startsWith('mailto:' + Dg.EMAIL_SIGNALEMENT + '?subject=')) fautes.push({ probleme: 'lien mail mal formé' });
  const corps = decodeURIComponent(lien.split('&body=')[1] || '');
  if (corps !== 'ligne 1\r\nligne 2') fautes.push({ probleme: 'le corps du mail n\'est pas restitué' });
  // 6. L'adresse n'existe qu'à UN endroit : la changer ne doit pas
  //    laisser une copie envoyer vers l'ancienne.
  const fsx = require('fs'); const px = require('path');
  const racine = px.join(__dirname, '..');
  const lire = (d) => fsx.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = px.join(d, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : lire(p);
    return p.endsWith('.js') ? [p] : [];
  });
  const copies = [...lire(px.join(racine, 'src')), px.join(racine, 'index.js')]
    .filter((f) => fsx.readFileSync(f, 'utf8').includes(Dg.EMAIL_SIGNALEMENT)
      && !f.endsWith('diagnostic.js'));
  copies.forEach((f) => fautes.push({ probleme: "l'adresse est recopiée dans " + px.relative(racine, f) }));
  // 7. LE FILET DE SÉCURITÉ, attaqué.
  const vm = require('vm');
  const cjs = (f) => babel.transformSync(fsx.readFileSync(f, 'utf8'), {
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]], filename: f }).code;
  const indexSrc = cjs(px.join(racine, 'index.js'));
  const scenario = (nom, { rn = true, as = true, dg = true, erreur = new Error('boum') }) => {
    const t = { memorise: false, bouton: false, origine: false, lien: '' };
    let handler = null;
    const sb = {
      global: { ErrorUtils: { getGlobalHandler: () => () => { t.origine = true; }, setGlobalHandler: (h) => { handler = h; } } },
      require: (m) => {
        if (m === 'react-native') { if (!rn) throw new Error('x');
          return { Alert: { alert: (a, b, btns) => { const x = (btns || []).find((y) => /Signaler/.test(y.text));
            if (x) { t.bouton = true; x.onPress(); } } },
          Linking: { openURL: (u) => { t.lien = u; return Promise.resolve(); } } }; }
        if (m === '@react-native-async-storage/async-storage') { if (!as) throw new Error('x');
          return { default: { setItem: () => { t.memorise = true; return Promise.resolve(); } } }; }
        if (m === './src/games/clicker/diagnostic') { if (!dg) throw new Error('x'); return Dg; }
        if (m === 'expo') return { registerRootComponent: () => {} };
        if (m === './App') return { default: () => null };
        return require(m);
      }, console, module: { exports: {} }, exports: {},
    };
    try { vm.runInNewContext(indexSrc, sb); handler(erreur, true); } catch (e) {
      fautes.push({ probleme: 'le filet PLANTE (' + nom + ') : ' + e.message }); return t;
    }
    if (!t.origine) fautes.push({ probleme: "le filet n'appelle pas le gestionnaire d'origine (" + nom + ')' });
    return t;
  };
  const normal = scenario('cas normal', {});
  if (!normal.memorise) fautes.push({ probleme: "le filet ne mémorise pas l'erreur" });
  if (!normal.bouton) fautes.push({ probleme: 'le filet ne propose pas de signaler' });
  if (!normal.lien.startsWith('mailto:' + Dg.EMAIL_SIGNALEMENT)) fautes.push({ probleme: 'le filet ouvre un mauvais lien' });
  [['sans React Native', { rn: false }], ['sans stockage', { as: false }],
    ['sans diagnostic', { dg: false }], ['tout cassé', { rn: false, as: false, dg: false }],
    ['erreur nulle', { erreur: null }], ['erreur texte', { erreur: 'x' }], ['erreur vide', { erreur: {} }],
  ].forEach(([n, o]) => scenario(n, o));
  return fautes;
}
module.exports.auditSignalement = auditSignalement;


// ---- Le libellé dit-il ce que le défi mesure vraiment ? -------------
//
// Bug réel du 21/09, sur les défis 2 et 8 : « Achète 4 niveaux de
// Pacte » était réglé en mode ABSOLU, c'est-à-dire « atteins le niveau
// 4 ». Le texte mentait. Et le défi 8, « Achète 6 niveaux de Pacte »,
// voulait dire « atteins le niveau 6 » : déjà rempli par tout joueur
// ayant dépassé ce niveau pendant l'œuf 1 — il n'apparaissait jamais.
// L'auteur : « il n'y a pas eu le défi, peut-être mauvais calcul du
// défi précédent ».
//
// LA RÈGLE : « Achète N » compte ce qu'on achète À PARTIR DE MAINTENANT
// (delta) ; « au niveau N » est un niveau à atteindre (absolu). Le mot
// et le mode doivent dire la même chose.
function auditLibelleMode() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const fautes = [];
  D.DEFIS_ECRITS.forEach((oeuf, i) => oeuf.forEach((q) => {
    const texte = q.label(q.target);
    if (/^Ach[eè]te/.test(texte) && q.mode !== 'delta') {
      fautes.push({ oeuf: i + 1, id: q.id, texte, probleme: '« Achète » mais le défi mesure un niveau atteint' });
    }
    if (/au niveau/.test(texte) && q.mode !== 'absolute') {
      fautes.push({ oeuf: i + 1, id: q.id, texte, probleme: '« au niveau » mais le défi compte des achats' });
    }
  }));
  return fautes;
}
module.exports.auditLibelleMode = auditLibelleMode;

// ---- La règle du TOTAL : juste, sûre, et appliquée au BON MOMENT ? ----
//
// Règle de l'auteur du 21/09 : un défi d'achat demande ce qui manque pour
// atteindre le TOTAL prévu — « si le joueur a déjà 6 Pactes au défi 2, il
// ne lui en demandera qu'1, et seulement 2 au 24 ».
//
// ⚠️⚠️ LE BUG QUE CE CONTRÔLE EMPÊCHE DE REVENIR : la règle existait, mais
// ne s'appliquait qu'à la DISTRIBUTION de l'œuf. Le joueur achetait 4
// Pactes pendant le défi 1, et le défi 2 lui en demandait encore 6 DE
// PLUS. Tester la fonction seule ne l'aurait jamais montré — elle était
// juste. C'est son APPEL qui manquait. On vérifie donc aussi que l'écran
// l'appelle à l'instant où le défi apparaît.
function auditCibleBudget() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const fautes = [];
  const etat = (q, n) => {
    const s = { ascension: 0, autoClickers: {}, tapUpgrades: {}, upgradeLevels: {},
      tapPower: 1, critLevel: 0, critDamageLevel: 0 };
    if (q.metric.startsWith('auto:')) s.autoClickers[q.metric.slice(5)] = n;
    else if (q.metric.startsWith('tapUpgrade:')) s.tapUpgrades[q.metric.slice(11)] = n;
    else s[q.metric] = n;
    return s;
  };
  // 1. Garanties, sur chaque défi d'achat des 252.
  D.DEFIS_ECRITS.forEach((oeuf) => oeuf.forEach((q) => {
    if (q.mode !== 'delta' || !Q.estAchatAdaptable(q.metric)) return;
    const avant = Q.niveauPrevuAvant(q);
    let precedente = Infinity;
    for (let n = 0; n <= avant + q.target + 40; n++) {
      const t = Q.cibleAchatCumulee(q, etat(q, n), q.target);
      if (!Number.isInteger(t) || t < 1 || t > q.target) {
        fautes.push({ id: q.id, probleme: 'cible hors de [1, ' + q.target + '] à ' + n + ' : ' + t });
        break;
      }
      if (t > precedente) { fautes.push({ id: q.id, probleme: 'plus avancé, on demande PLUS' }); break; }
      precedente = t;
    }
    // Juste ce qui manque pour le total prévu.
    const k = Math.floor(q.target / 2);
    if (Q.cibleAchatCumulee(q, etat(q, avant + k), q.target) !== Math.max(1, q.target - k)) {
      fautes.push({ id: q.id, probleme: 'ne demande pas ce qui manque pour le total prévu' });
    }
    [undefined, null, {}, etat(q, NaN), etat(q, -5), etat(q, Infinity)].forEach((s) => {
      let t;
      try { t = Q.cibleAchatCumulee(q, s, q.target); } catch (e) {
        fautes.push({ id: q.id, probleme: 'PLANTE sur un état pourri : ' + e.message }); return;
      }
      if (!Number.isInteger(t) || t < 1) fautes.push({ id: q.id, probleme: 'état pourri -> ' + t });
    });
  }));
  // 2. Le cas exact de l'auteur, Ascension 0.
  const pactes = oeufsDe(D, 0).flat().filter((q) => q.metric === 'tapPower');
  if (pactes.length >= 2) {
    const [p2, p24] = pactes;
    const vu = (q, niv) => Q.cibleAchatCumulee(q, { tapPower: niv }, q.target);
    if (vu(p2, 5) !== 2) fautes.push({ probleme: '4 Pactes d\'avance : le défi 2 devrait en demander 2, il en demande ' + vu(p2, 5) });
    if (vu(p2, 7) !== 1) fautes.push({ probleme: '6 Pactes au défi 2 : il devrait en demander 1' });
    if (vu(p24, 8) !== 2) fautes.push({ probleme: 'au défi 24 avec le niveau 8 : il devrait en demander 2' });
  }
  // 3. L'APPEL au bon moment : là où le point de départ du défi est pris.
  const ecran = require('fs').readFileSync(
    require('path').join(__dirname, '../src/screens/games/ClickerScreen.js'), 'utf8');
  const debut = ecran.indexOf('if (questBaselinesRef.current[currentChallengeId]) return;');
  const fin = ecran.indexOf('}, [currentChallengeId, loaded]);', debut);
  const effet = debut >= 0 && fin > debut ? ecran.slice(debut, fin) : '';
  if (!/cibleAchatCumulee\(/.test(effet)) {
    fautes.push({ probleme: "l'écran ne recalcule PAS la cible quand le défi apparaît — le bug du défi 2 revient" });
  }
  return fautes;
}
module.exports.auditCibleBudget = auditCibleBudget;


// ---- Un défi peut-il sauter sans jamais s'afficher ? ----------------
//
// LA FAMILLE DE BUGS LA PLUS SIGNALÉE PAR L'AUTEUR : « il n'y a pas le
// défi 7 », « il n'y a pas eu le défi 8 ». Un défi rempli pendant les
// défis PRÉCÉDENTS sautait sans jamais apparaître.
//
// Trois verrous, vérifiés ensemble — chacun a déjà manqué au moins une
// fois :
//  1. le jeu ne valide un défi qu'APRÈS son apparition, pour TOUTES les
//     métriques (la garde n'en couvrait que deux) ;
//  2. le défi de taps, qui compte les taps À VIE, s'adapte au joueur
//     vétéran — le marqueur « cible figée » court-circuitait cette
//     adaptation, et « Atteins 2 600 taps » naissait rempli au groupe 1
//     pour TOUS les joueurs ;
//  3. ce même défi se recalcule à son apparition.
function auditDefiInvisible() {
  const fautes = [];
  const fs = require('fs'); const path = require('path');
  const ecran = fs.readFileSync(path.join(__dirname, '../src/screens/games/ClickerScreen.js'), 'utf8');
  // 1. La garde s'applique à TOUT défi : aucune liste de métriques.
  const garde = ecran.match(/const pasEncoreApparu = \(id\) => ([^;]+);/);
  if (!garde) fautes.push({ probleme: 'la garde « pas encore apparu » a disparu' });
  else if (/metric|includes\(/.test(garde[1])) {
    fautes.push({ probleme: 'la garde ne couvre que certaines métriques : ' + garde[1] });
  } else if (!/questBaselines/.test(garde[1])) {
    // ⚠️ Une garde qui ne lit plus la référence du défi est une garde
    // NEUTRALISÉE (`=> false`) : elle existe, elle a le bon nom, et elle ne
    // protège plus rien. Trouvé en écrivant le contrôle des contrôles.
    fautes.push({ probleme: 'la garde ne vérifie plus la référence du défi : ' + garde[1] });
  }
  const done = ecran.match(/const isQuestDone = \(id\) =>([\s\S]*?);\n/);
  if (!done || !/!pasEncoreApparu\(id\) && questComplete\(/.test(done[1])) {
    fautes.push({ probleme: 'isQuestDone valide un défi sans vérifier qu\'il est apparu' });
  }
  const verrou = ecran.match(/const atteints = activeQuestIds\.filter\(([\s\S]*?)\);\n/);
  if (!verrou || !/!pasEncoreApparu\(id\)/.test(verrou[1])) {
    fautes.push({ probleme: 'le verrou fige un défi sans vérifier qu\'il est apparu' });
  }
  // 3. Le défi de taps se recalcule à son apparition.
  const debut = ecran.indexOf('if (questBaselinesRef.current[currentChallengeId]) return;');
  const fin = ecran.indexOf('}, [currentChallengeId, loaded]);', debut);
  if (!/q\.minStep/.test(ecran.slice(debut, fin))) {
    fautes.push({ probleme: 'le défi de taps ne se recalcule pas quand il apparaît' });
  }
  // 2. Moteur : un joueur vétéran n'a jamais un défi de taps déjà rempli.
  let D;
  try { D = load('defisEcrits'); } catch (e) { return fautes; }
  D.DEFIS_ECRITS.forEach((oeuf, i) => oeuf.forEach((q) => {
    if (!q.minStep) return;
    [0, 42000, 900000].forEach((n) => {
      const s = etatInitial(); s.ascension = Q.groupeDeOeuf(i); s[q.metric] = n;
      const t = Q.resolveQuestTarget(q, s);
      if (!(t > n)) fautes.push({ id: q.id, avec: n, cible: t, probleme: 'défi déjà rempli pour ce joueur' });
    });
  }));
  return fautes;
}
module.exports.auditDefiInvisible = auditDefiInvisible;

// ---- Une cible peut-elle REDESCENDRE dans un groupe ? ---------------
//
// Signalé par l'auteur le 21/09 : « les défis 15 et 35 ne sont pas
// logiques » — « Enchaîne 140 taps » puis, plus loin, « Enchaîne 120
// taps ». Et les pièces de côté : 90 000, 150 000, puis 25 000.
//
// ⚠️ CAUSE : mon outil de réordonnancement avait mélangé AU HASARD les
// défis hors achats pour placer les achats par coût croissant. Aucun
// contrôle ne vérifiait qu'une cible hors achats ne redescend pas : la
// règle « une cible ne redescend jamais » n'était tenue que pour les
// achats, par leur coût.
//
// Ici : pour chaque métrique d'un groupe, les cibles écrites, dans
// l'ordre où le joueur les rencontre, ne baissent jamais. Exclus : les
// achats (leur COÛT monte, voir auditCoutCroissant — un nombre peut
// baisser quand chaque niveau coûte plus cher), et les défis qui
// s'adaptent au joueur en cours de partie (taps à vie, créature +5).
function auditCibleMonte() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const fautes = [];
  for (let g = 0; g < 6; g++) {
    const vu = {};
    oeufsDe(D, g).flat().forEach((q, k) => {
      const m = q.metric || '';
      if (m === 'ascension' || q.step || q.minStep) return;
      if (Q.estDefiAchat({ metric: m }, {})) return;
      if (vu[m] && q.target < vu[m].cible) {
        fautes.push({ groupe: g, metric: m, defi: numeroAvant(D, g) + k + 1, cible: q.target,
          avant: vu[m].cible, defiAvant: vu[m].defi, probleme: 'la cible redescend' });
      }
      vu[m] = { cible: q.target, defi: numeroAvant(D, g) + k + 1 };
    });
  }
  return fautes;
}
module.exports.auditCibleMonte = auditCibleMonte;

// ---- Les durées restent-elles proches des CIBLES de l'auteur ? -------
//
// Règle de l'auteur (20/09) : 2,8 / 3,5 / 5 / 6,5 / 8 / 10 h par
// Ascension, au tap à la main. `auditDureeCroissante` vérifie seulement
// qu'elles MONTENT, avec une marge.
//
// ⚠️ TROUVÉ LE 21/09 par le contrôle « 100 % » : en étendant une hausse
// de prix à tous les générateurs, l'A1 est tombée de 3,4 h à 2,7 h — sous
// l'A0 — et l'A2 de 5,0 h à 3,4 h. Aucun contrôle ne l'a bloqué : une
// baisse de 3 % passait la marge de « croissante », et rien ne comparait
// aux cibles. Tolérance : ±15 %.
// ⚠️⚠️ CE SONT LES DURÉES RÉELLES MESURÉES, pas les cibles de conception.
//
// L'auteur avait validé 2,8 / 3,5 / 5 / 6,5 / 8 / 10 h — mais ces
// chiffres venaient d'un simulateur qui ignorait la Transe, les critiques
// et les pouvoirs de créature. Ses chronos du 21/09 (défi 17 en 20 min,
// défi 32 en 50 min, A0 en 1 h 05) ont montré l'écart : le jeu réel dure
// 14 h au total, pas 35,7 h.
//
// Ces valeurs protègent donc contre une DÉRIVE du rythme actuel. Étirer
// le jeu jusqu'aux cibles d'origine est une décision de l'auteur, pas une
// correction : elle multiplierait tous les seuils par ~2,5.
//
// ⚠️ A0 : 2,3 -> 3,0 le 24/09. Croissance ×2,5 des paliers de tap
// (demande de l'auteur) : l'A0 n'est pas compensable par l'ajustement
// (prix fixes = 86 % de son budget) et passe de 2,2 à 2,96 h, mesuré
// avec les 9 pauses d'énergie par groupe.
// C'est l'effet direct de « les paliers sont la cause des gros scores dès
// le début » — pas une dérive. Les groupes 1 à 5 sont compensés et
// gardent leur durée.
const DUREES_CIBLES = [3.0, 3.9, 4.3, 6.2, 6.8, 8.1];
function auditDureeCible(tolerance = 0.15) {
  const fautes = [];
  DUREES_CIBLES.forEach((cibleH, g) => {
    const h = simulerGroupe(g).heures;
    if (Math.abs(h - cibleH) > cibleH * tolerance) {
      fautes.push({ groupe: g, heures: +h.toFixed(1), cible: cibleH,
        ecart: Math.round(100 * (h - cibleH) / cibleH) + ' %' });
    }
  });
  return fautes;
}
module.exports.auditDureeCible = auditDureeCible;

// ---- La majoration des premiers prix vise-t-elle les bons générateurs ?
//
// Demande de l'auteur (21/09) : +35 % sur les 3 premiers exemplaires des
// générateurs que chaque Ascension demande. La liste vit dans le moteur
// (`GENERATEURS_MAJORES_PAR_ASCENSION`) ; elle doit correspondre aux
// défis ÉCRITS — si un défi change de générateur, la majoration doit
// suivre. Et aucun prix ne redescend d'un exemplaire au suivant.
function auditMajorationPrix() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const fautes = [];
  for (let g = 0; g < 6; g++) {
    const demandes = new Set();
    oeufsDe(D, g).flat().forEach((q) => {
      if ((q.metric || '').startsWith('auto:')) demandes.add(q.metric.slice(5));
    });
    const majores = new Set(C.GENERATEURS_MAJORES_PAR_ASCENSION[g] || []);
    const manque = [...demandes].filter((x) => !majores.has(x));
    const enTrop = [...majores].filter((x) => !demandes.has(x));
    if (manque.length || enTrop.length) fautes.push({ groupe: g, nonMajores: manque, majoresSansDefi: enTrop });
    // ⚠️ Chaque palier de tap coûte son prix normal à partir de
    // l'Ascension dont les défis le demandent — lue dans le fichier.
    oeufsDe(D, g).flat().forEach((q) => {
      if (!(q.metric || '').startsWith('tapUpgrade:')) return;
      const id = q.metric.slice(11);
      const prevu = C.PALIER_TAP_ASCENSION[id];
      if (prevu === undefined || prevu > g) {
        fautes.push({ groupe: g, palier: id, prevu, probleme: 'palier demandé avant son Ascension : il y coûte une surprime' });
      }
    });
    C.AUTOCLICKERS.forEach((it) => {
      for (let n = 0; n < 8; n++) {
        if (C.autoClickerCost(it, n + 1, g) < C.autoClickerCost(it, n, g)) {
          fautes.push({ groupe: g, generateur: it.id, exemplaire: n + 2, probleme: 'le prix redescend' });
        }
      }
    });
  }
  return fautes;
}
module.exports.auditMajorationPrix = auditMajorationPrix;

// ---- Les défis d'ÉTAT s'adaptent-ils vraiment au joueur ? -----------
//
// Demande de l'auteur le 21/09, après « Atteins 2 pièces par seconde »
// alors qu'il en produisait 27 : « ce défi est complètement useless, il
// faut le même système de calcul pour TOUS les types de défis. »
//
// Ses trois exemples sont ici des tests :
//   27 pièces/s              -> le défi en demande 32
//   chapitre 1, niveau 10    -> le défi demande chapitre 2, niveau 5
//   47 000 de côté           -> ce qu'il a + 5 minutes de sa production,
//                               donc moins s'il tape peu (10 pièces/tap)
//
// ⚠️ Comme pour les achats, tester la fonction ne suffit pas : c'est son
// APPEL au moment où le défi apparaît qui a manqué la dernière fois. On
// vérifie les deux.
function auditCibleEtat() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return []; }
  const fautes = [];
  const t = D.DEFIS_ECRITS.flat();
  const base = { ascension: 0, autoClickers: {}, tapUpgrades: {}, upgradeLevels: {}, tapPower: 1 };
  const prend = (m) => t.find((q) => q.metric === m && q.mode === 'absolute');
  // 1. Les trois exemples de l'auteur.
  const qp = prend('passiveIncome');
  if (qp && Q.cibleEtatAdaptee(qp, { ...base, passiveIncome: 27 }, qp.target) !== 32) {
    fautes.push({ probleme: '27 pièces/s doit donner 32, et donne '
      + Q.cibleEtatAdaptee(qp, { ...base, passiveIncome: 27 }, qp.target) });
  }
  const qa = prend('advLevelReached');
  if (qa && Q.cibleEtatAdaptee(qa, { ...base, advLevelReached: 10 }, qa.target) !== 15) {
    fautes.push({ probleme: 'chapitre 1 niveau 10 doit donner le niveau 15' });
  }
  const qc = prend('coins');
  if (qc) {
    const fort = { ...base, coins: 47000, tapPower: 35, passiveIncome: 27 };
    const faible = { ...base, coins: 47000, tapPower: 10 };
    const a = Q.cibleEtatAdaptee(qc, fort, qc.target);
    const b = Q.cibleEtatAdaptee(qc, faible, qc.target);
    if (!(a > b)) fautes.push({ probleme: 'les pièces de côté ne suivent pas la production' });
    if (b <= 47000) fautes.push({ probleme: 'un défi de côté peut naître déjà rempli' });
  }
  // 2. Garanties sur TOUS les défis d'état : jamais sous la cible écrite,
  //    jamais au-dessus d'un plafond, jamais déjà rempli, jamais de
  //    valeur folle sur un état pourri.
  t.forEach((q) => {
    if (q.mode !== 'absolute' || !Q.estEtatAdapte(q.metric)) return;
    [0, 3, 17, 260, 5000, 90000].forEach((n) => {
      const s = { ...base, [q.metric]: n };
      const c = Q.cibleEtatAdaptee(q, s, q.target);
      if (!Number.isInteger(c) || c < 1 || c < q.target) {
        fautes.push({ id: q.id, avec: n, cible: c, probleme: 'cible invalide ou sous la cible écrite' });
        return;
      }
      const plafond = q.metric === 'sanctuaryLevel' ? C.SANCTUARY_MAX_LEVEL
        : q.metric === 'veilleurLevel' ? C.VEILLEUR_MAX_LEVEL : null;
      if (plafond && c > plafond) fautes.push({ id: q.id, probleme: 'au-dessus du maximum du bâtiment' });
      if (!plafond && n >= q.target && c <= n) {
        fautes.push({ id: q.id, avec: n, cible: c, probleme: 'défi déjà rempli à son apparition' });
      }
    });
    [undefined, null, {}, { [q.metric]: NaN }, { [q.metric]: -5 }, { [q.metric]: Infinity }].forEach((s) => {
      let c;
      try { c = Q.cibleEtatAdaptee(q, s, q.target); } catch (e) {
        fautes.push({ id: q.id, probleme: 'PLANTE sur un état pourri : ' + e.message }); return;
      }
      if (!Number.isInteger(c) || c < 1) fautes.push({ id: q.id, probleme: 'état pourri -> ' + c });
    });
  });
  // 3. L'écran appelle bien le recalcul quand le défi apparaît — et la
  //    photo qu'il lui donne porte le passif de BASE, jamais celui gonflé
  //    par un pouvoir x3 (bug pressenti par l'auteur le 21/09).
  const ecran = require('fs').readFileSync(
    require('path').join(__dirname, '../src/screens/games/ClickerScreen.js'), 'utf8');
  if (!/passiveIncome: passiveIncomeBaseRef\.current,/.test(ecran)) {
    fautes.push({ probleme: "la photo d'apparition donne le passif BOOSTÉ aux défis : cible irréalisable après un pouvoir" });
  }
  if (!/passiveIncome: passiveIncomeBase,/.test(ecran)) {
    fautes.push({ probleme: 'les défis lisent le passif boosté pour leur progression' });
  }
  const debut = ecran.indexOf('if (questBaselinesRef.current[currentChallengeId]) return;');
  const fin = ecran.indexOf('}, [currentChallengeId, loaded]);', debut);
  if (!/cibleEtatAdaptee\(/.test(ecran.slice(debut, fin))) {
    fautes.push({ probleme: "l'écran ne recalcule pas les défis d'état quand ils apparaissent" });
  }
  return fautes;
}
module.exports.auditCibleEtat = auditCibleEtat;


// ---- Les 3 premiers œufs ne donnent-ils jamais mieux que rare ? ------
//
// Demande de l'auteur (21/09) après une ÉPIQUE en première créature et
// une MYTHIQUE à l'œuf 3 : « maximum créature rare jusqu'à l'œuf 3 ».
// Et chaque générateur est rattaché à l'Ascension qui le demande : un
// générateur demandé AVANT son rattachement y coûterait une surprime.
function auditDebutDePartie() {
  const fautes = [];
  const rang = (r) => C.ORDRE_RARETES.indexOf(r);
  for (let nb = 0; nb < 3; nb++) {
    for (let i = 0; i < 3000; i++) {
      const c = C.rollCreature([], C.rareteMaxPourOeuf(nb));
      if (rang(c.rarity) > rang('rare')) { fautes.push({ oeuf: nb + 1, rarete: c.rarity }); break; }
    }
  }
  const ecran = require('fs').readFileSync(require('path').join(__dirname, '../src/screens/games/ClickerScreen.js'), 'utf8');
  if (!/rollCreature\(ownedRef\.current\.map\(\(o\) => o\.id\),\s*rareteMaxPourOeuf\(/.test(ecran)) {
    fautes.push({ probleme: "l'éclosion d'un œuf n'applique pas le plafond de rareté" });
  }
  let D;
  try { D = load('defisEcrits'); } catch (e) { return fautes; }
  D.DEFIS_ECRITS.forEach((oeuf, i) => oeuf.forEach((q) => {
    if (!(q.metric || '').startsWith('auto:')) return;
    const id = q.metric.slice(5); const g = Q.groupeDeOeuf(i);
    const prevu = C.GENERATEUR_ASCENSION[id];
    if (prevu === undefined || prevu > g) fautes.push({ groupe: g, generateur: id, prevu, probleme: 'demandé avant son Ascension' });
  }));
  return fautes;
}
module.exports.auditDebutDePartie = auditDebutDePartie;

// ---- La vérification exhaustive, branchée dans la suite -------------
//
// ⚠️ TROUVÉ LE 24/09 : `verif-exhaustive.js` parcourait `QUEST_SEQUENCE`,
// les 42 modèles d'avant la bascule, et non les 336 défis que le joueur
// reçoit. Il restait vert avec un libellé cassé dans un vrai défi — et la
// passation en faisait une condition pour pousser. Un outil à part ne
// passe jamais par le contrôle des contrôles : c'est pour ça qu'il a pu
// devenir aveugle sans que personne le voie.
//
// Ce contrôle le lance tel quel (processus séparé, le script reste la
// source unique) et compte ses anomalies. Son sabotage vit dans
// `verifier-controles.js` : s'il redevient aveugle, la suite le dit.
function auditExhaustif() {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'verif-exhaustive.js')],
    { encoding: 'utf8', env: process.env, timeout: 120000 });
  const sortie = r.stdout || '';
  if (/AUCUNE ANOMALIE/.test(sortie)) return [];
  const fautes = [];
  sortie.split('\n').forEach((l) => {
    const m = l.match(/^\s*(\S.*?) — (\d+) cas/);
    if (m) for (let i = 0; i < Number(m[2]); i++) fautes.push({ anomalie: m[1] });
  });
  return fautes.length ? fautes : [{ probleme: 'panne : ' + (r.stderr || sortie).slice(0, 120) }];
}
module.exports.auditExhaustif = auditExhaustif;

// ---- La structure des groupes est-elle celle que le jeu croit ? ------
//
// Ajouté le 24/09 avec la suppression de l'œuf 7 de l'A0 et de l'A1. Le
// moteur, l'écran (saut d'œuf à l'Ascension, migration des sauvegardes)
// et tous les outils lisent `OEUFS_PAR_GROUPE`. S'il ne correspond plus au
// fichier, l'index d'un œuf désigne un autre groupe que son Ascension.
// Vérifie : le total d'œufs, que chaque groupe finit par SON Ascension
// (cible = groupe + 1), qu'il n'y en a nulle part ailleurs, et 8 défis par
// œuf (9 pour l'œuf qui porte l'Ascension).
function auditStructureOeufs() {
  let D;
  try { D = load('defisEcrits'); } catch (e) { return [{ probleme: 'fichier absent' }]; }
  const fautes = [];
  const T = D.OEUFS_PAR_GROUPE || [];
  const total = T.reduce((a, n) => a + n, 0);
  if (!T.length || total !== D.DEFIS_ECRITS.length) {
    fautes.push({ probleme: `OEUFS_PAR_GROUPE totalise ${total} œufs, le fichier en a ${D.DEFIS_ECRITS.length}` });
    return fautes;
  }
  T.forEach((n, g) => {
    oeufsDe(D, g).forEach((oeuf, e) => {
      const dernierOeuf = e === n - 1;
      oeuf.forEach((q, k) => {
        if (q.metric !== 'ascension') return;
        if (!dernierOeuf || k !== oeuf.length - 1) fautes.push({ groupe: g, oeuf: e + 1, probleme: 'Ascension hors de la fin du groupe : ' + q.id });
        if (q.target !== g + 1) fautes.push({ groupe: g, probleme: `Ascension ${q.target} dans le groupe ${g}` });
      });
      // 8 défis par œuf ; l'œuf qui porte l'Ascension en a 8 ou 9 (9 quand
      // elle y a été déplacée depuis un œuf supprimé).
      const bon = dernierOeuf ? (oeuf.length === 8 || oeuf.length === 9) : oeuf.length === 8;
      if (!bon) fautes.push({ groupe: g, oeuf: e + 1, probleme: `${oeuf.length} défis` });
      if (dernierOeuf && !oeuf.some((q) => q.metric === 'ascension')) fautes.push({ groupe: g, probleme: 'le groupe ne finit pas par son Ascension' });
    });
  });
  return fautes;
}
module.exports.auditStructureOeufs = auditStructureOeufs;

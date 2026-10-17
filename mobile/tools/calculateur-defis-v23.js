// ════════════════════════════════════════════════════════════════════
//  CALCULATEUR DE DÉFIS v2.3 (18/10) — HORS DU JEU : ne modifie AUCUN fichier du jeu
// ════════════════════════════════════════════════════════════════════
// Demande de l'auteur : « chronomètre chaque défi dans la boucle de simulerGroupe, avec un joueur à
// 7 taps/s, la Transe, les critiques et les pouvoirs ; puis refais le Google Doc des défis ».
//
// POURQUOI v2.3 (historique dans CLICKER_ADVENTURE_STATE.md, 18/10) :
//   - v1 multipliait le NOMBRE de niveaux (faux : les prix montent) ;
//   - v2.2 rejouait un joueur qui n'achète QUE les défis (sa production ne suivait pas) ;
//   - v2.3 : le joueur de `simulerGroupe` (celui des 32 h, achats au meilleur rapport) FAIT les défis,
//     dans l'ordre, DANS la même boucle (crochet `options.defis` de audit-quetes.js). Le défi i+1
//     apparaît quand le défi i est rempli. Toutes les cibles passent par LA fonction du jeu
//     (resolveQuestTarget : règle du total, +20 % de passif, +5 min de production, +5 niveaux…).
//
// Lancement : NODE_PATH=<babel> node mobile/tools/calculateur-defis-v23.js [--json sortie.json]
'use strict';
const path = require('path');
const fs = require('fs');
const A = require(path.join(__dirname, 'audit-quetes.js'));
const C = A.C;
const Q = A.Q;
const D = A.load('defisEcrits');
const K = A.load('combatLogic');
// 17/10 (chantier économie) : RÉALIGNÉ sur le calculateur du JEU — temps visé et cibles viennent de calculDefis.
const CD = A.load('calculDefis');

// ---- HYPOTHÈSES (toutes ici, réglables) ------------------------------
const HYP = {
  tapsParSec: Number(process.env.TAPS || 7), // décision A de l'auteur (18/10) ; TAPS=16.5 pour rejouer un rapport
  partTranse: Number(process.env.PART_TRANSE || 0.6), // part des taps en Transe ≥ ×2,5 — rapport de l'auteur (~60 % à 8,1 taps/s)
  delaiPouvoirSec: 5,     // un pouvoir prêt est activé ~5 s plus tard (2 appuis sur le deck)
  secParCombat: 55,       // durée d'un combat d'Aventure (moyenne relevée le 11/10 : ~55 s) — sans tap
  secAction: 5,           // acheter une rune, faire une Offrande, ouvrir un menu
  secParDefi: Number(process.env.SEC_DEFI || 8), // lire le défi, appuyer sur « Valider », ouvrir le bon menu — sans taper. CALÉ sur
                          // l'œuf 1 : 6,0 min prévus par le v2.1 validé (6,3 min mesurés chez l'auteur)
  part3Etoiles: 0.6,      // victoire à 3 étoiles (hypothèse de griffes-par-source.js)
  diamantsParBoss: 3,     // boss de tap : 200 taps en 28,6 s à 7 taps/s → palier « ≤ 30 s »
  victoireRejeu: 0.95,    // combat REJOUÉ (Aventure au verrou de fin d'Ascension)
  plafondVerrou: process.env.PLAFOND_VERROU !== '0', // correctif proposé du « +5 niveaux » (voir demarrer)
  combatDesQuePlein: process.env.COMBAT_PLEIN !== '0', // l'auteur (18/10) : un joueur ne laisse pas sa barre pleine — il
                          // combat dès qu'elle l'est, même hors défi d'Aventure (sinon la recharge est perdue)
  joueursMC: 600,         // Monte-Carlo des œufs (créatures → pouvoirs du deck)
  graine: 20261018,
};

// ---- Hasard à graine (le calculateur rend toujours le même chiffre) ---
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- TRANSE : multiplicateur MOYEN par tap (formule du jeu) -------------
// Un épisode = la montée (combo 1 → 37 : sous ×2,5) puis K taps en Transe ; part = K / (37 + K).
function facteurTranse(part) {
  let sous = 0;
  while (C.transeMultiplier(sous + 1) < 2.5) sous += 1; // 37 taps sous ×2,5 (règle du jeu)
  const L = Math.max(sous + 1, Math.round(sous / (1 - part)));
  let somme = 0;
  for (let c = 1; c <= L; c++) somme += C.transeMultiplier(c);
  return { moyen: somme / L, montee: sous / HYP.tapsParSec };
}
const TRANSE = facteurTranse(HYP.partTranse);

// ---- CRITIQUES : espérance par tap (formules de handleTap) --------------
function chanceCrit(s) {
  const ub = C.upgradeBonuses(s.upgradeLevels || {});
  return Math.min(1, C.critChance(s.critLevel || 0) + (ub.critChancePct || 0));
}
function facteurCrit(s) {
  const ub = C.upgradeBonuses(s.upgradeLevels || {});
  const p = chanceCrit(s);
  return (1 - p) + p * C.critMultiplier(s.critDamageLevel || 0) * (1 + (ub.critMultPct || 0));
}

// ---- POUVOIRS DU DECK : Monte-Carlo des œufs (tirage du jeu) ------------
// Pour n créatures possédées : deck = les 3 plus rares (ordre d'arrivée à rareté égale). Chaque pouvoir
// s'active dès qu'il est prêt (+ délai), un seul actif à la fois (règle du jeu) ; les pouvoirs « remise »
// (Ventis, Glyphon) comptent comme activations mais ne multiplient rien. Bonus de pièces immédiat
// (coins_burst) et remise ignorés : < 3 % du revenu du tap (mesuré sur le Pacte, voir rapport).
const RANG = (r) => C.ORDRE_RARETES.indexOf(r);
const cacheDeck = {};
function statsDeck(ids) {
  const cle = ids.slice().sort().join('+');
  if (cacheDeck[cle]) return cacheDeck[cle];
  const cs = ids.map((id) => {
    const c = C.CREATURES.find((x) => x.id === id);
    const p = C.powerForCreature(c, 1);
    return { m: p.tapMultiplier, d: p.durationSec, cd: C.rechargePouvoirMs(c) / 1000,
      remise: p.effectType === 'discount_next', passif: p.effectType === 'passive_boost' ? p.effectValue : 1 };
  });
  const T = 8 * 3600;
  const pret = cs.map(() => 0);
  let finActif = 0, n = 0, upTap = 0, upPassif = 0;
  for (let garde = 0; garde < 100000; garde++) {
    const tMin = Math.min(...pret);
    const tAct = Math.max(finActif, tMin) + HYP.delaiPouvoirSec;
    if (tAct > T) break;
    const prets = cs.map((c, i) => i).filter((i) => pret[i] <= tAct);
    prets.filter((i) => cs[i].remise).forEach((i) => { n += 1; pret[i] = tAct + cs[i].cd; });
    const forts = prets.filter((i) => !cs[i].remise).sort((x, y) => cs[y].m - cs[x].m);
    if (forts.length) {
      const i = forts[0];
      n += 1; pret[i] = tAct + cs[i].cd; finActif = tAct + cs[i].d;
      upTap += cs[i].d * (cs[i].m - 1); upPassif += cs[i].d * (cs[i].passif - 1);
    }
  }
  return (cacheDeck[cle] = { gainTap: 1 + upTap / T, gainPassif: 1 + upPassif / T, parSec: n / T });
}
function statsPouvoirsParNombre(nMax = 45) {
  const ancien = Math.random;
  Math.random = mulberry32(HYP.graine);
  const acc = Array.from({ length: nMax + 1 }, () => ({ gainTap: 0, gainPassif: 0, parSec: 0 }));
  try {
    for (let j = 0; j < HYP.joueursMC; j++) {
      const owned = [];
      for (let n = 1; n <= nMax; n++) {
        const c = C.rollCreature(owned, C.rareteMaxPourOeuf(owned.length), C.rareteGarantiePourOeuf(owned));
        owned.push(c.id);
        const deck = owned.map((id, k) => ({ id, k, r: RANG(C.CREATURES.find((x) => x.id === id).rarity) }))
          .sort((x, y) => y.r - x.r || x.k - y.k).slice(0, 3).map((x) => x.id);
        const st = statsDeck(deck);
        acc[n].gainTap += st.gainTap; acc[n].gainPassif += st.gainPassif; acc[n].parSec += st.parSec;
      }
    }
  } finally { Math.random = ancien; }
  acc[0] = { gainTap: HYP.joueursMC, gainPassif: HYP.joueursMC, parSec: 0 };
  return acc.map((x) => ({ gainTap: x.gainTap / HYP.joueursMC, gainPassif: x.gainPassif / HYP.joueursMC, parSec: x.parSec / HYP.joueursMC }));
}
const POUVOIRS = statsPouvoirsParNombre();
// 17/10 — CRÉATURES DU JOUEUR : une suite de tirages à graine (le tirage du jeu) ; la n-ième éclosion = IDS[n − 1].
// Le calculateur du jeu lit les 3 MEILLEURES créatures possédées : il lui faut des identifiants, pas une moyenne.
function suiteCreatures(graine, n = 45) {
  const ancien = Math.random;
  Math.random = mulberry32(graine);
  try {
    const owned = [];
    for (let k = 0; k < n; k++) owned.push(C.rollCreature(owned, C.rareteMaxPourOeuf(owned.length), C.rareteGarantiePourOeuf(owned)).id);
    return owned;
  } finally { Math.random = ancien; }
}
const IDS = suiteCreatures(Number(process.env.GRAINE_DECK || HYP.graine));
const idsPossedes = (n) => IDS.slice(0, Math.max(0, n));


// ---- Les défis d'un groupe, dans l'ordre (source : defisEcrits.js) ------
const defisDuGroupe = (a) => D.DEFIS_ECRITS.slice(Q.debutGroupe(a), Q.debutGroupe(a) + Q.tailleGroupe(a))
  .map((oeuf, k) => oeuf.map((q) => ({ q, oeuf: Q.debutGroupe(a) + k + 1, oeufDuGroupe: k + 1 }))).flat();
const ACHATS = (m) => m === 'tapPower' || m === 'critLevel' || m === 'critDamageLevel'
  || m.startsWith('auto:') || m.startsWith('tapUpgrade:');
const AVENTURE = ['advLevelReached', 'battleWon', 'threeStarLevel', 'maxCreatureLevel', 'runeBought'];
const DUREE_FIXE = ['goldenClaimed', 'maxTapStreak', 'maxTranseHoldSec', 'powerActivated'];
const SANS_ACHAT = ['maxTapStreak', 'maxTranseHoldSec', 'coins'];  // le joueur ne quitte pas l'œuf / il épargne
const pDoree = () => (C.GOLDEN_MIN_INTERVAL_SEC + C.GOLDEN_MAX_INTERVAL_SEC) / 2;
// Attente moyenne de la 1re cible dorée depuis un instant quelconque (intervalle uniforme 45-90 s) :
// E[X²] / (2 E[X]) = 35 s ; les suivantes, 67,5 s en moyenne.
const residuDoree = () => {
  const a = C.GOLDEN_MIN_INTERVAL_SEC, b = C.GOLDEN_MAX_INTERVAL_SEC;
  return ((a * a + a * b + b * b) / 3) / (2 * ((a + b) / 2));
};
const REGEN = K.ENERGY_REGEN_MS / 1000;
const DL = A.load('dailyLogic');
const GRIFFES_JOUR_1 = ((DL.CALENDAR_REWARDS || DL.CALENDRIER || []).find((x) => x.day === 1 && x.type === 'griffes') || { amount: 40 }).amount;

// État « à vie » du joueur (ne repart PAS à zéro à l'Ascension) : copiable en JSON.
function etatVieInitial() {
  return {
    mur: 0, actif: 0, energie: K.ENERGY_MAX, taps: 0, diamants: 0, prochainBoss: 120,
    creatures: 0, av: { n: 0, prog: 0, victoires: 0, trois: 0, poudre: 0, meilleure: 1 }, offrandes: 0, runes: 0,
  };
}
const copie = (x) => JSON.parse(JSON.stringify(x));

// Statistiques telles que le jeu les donne à resolveQuestTarget (buildQuestStatsSnapshot).
function statsJeu(a, s, V) {
  const base = C.passiveRate({ autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
    sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: a });
  return {
    ascension: a, tapPower: s.tapPower, critLevel: s.critLevel, critDamageLevel: s.critDamageLevel,
    autoClickers: s.autoClickers, tapUpgrades: s.tapUpgrades, upgradeLevels: s.upgradeLevels,
    sanctuaryLevel: s.sanctuaryLevel, veilleurLevel: s.veilleurLevel, coins: s.coins, totalEarned: s.totalEarned,
    passiveIncome: base, passiveIncomeBase: base, advLevelReached: V.av.n, maxCreatureLevel: V.av.meilleure,
    ownedCount: V.creatures, totalTaps: Math.floor(V.taps), battleWon: Math.floor(V.av.victoires),
    threeStarLevel: Math.floor(V.av.trois), offering: V.offrandes, runeBought: V.runes, essence: s.essence || 0,
  };
}

// ---- LE JOUEUR QUI FAIT LES DÉFIS (crochet `defis` de simulerGroupe) ----
// opts : { arreterApres: index du défi après lequel s'arrêter (photo prise), photos: true }
function creerJoueur(a, V, depart, opts = {}) {
  const liste = defisDuGroupe(a);
  const taps = HYP.tapsParSec;
  const cap = Q.niveauMaxAventure(a);
  const J = {
    fini: false, bloqueA: null, resultats: [], photos: [], photoFin: null,
    i: depart ? depart.i : 0, courant: depart ? depart.courant : null,
  };
  // 17/10 — RÉALIGNÉ : la production du joueur = celle que suppose le calculateur du jeu (productionReference) :
  // Transe 2,47 × critiques × (1 + % des 3 meilleures créatures possédées) ; passif × (1 + % « passif »).
  const pouvoirs = () => { const b = CD.bonusPouvoirs(idsPossedes(V.creatures)); return { gainTap: 1 + b.tap, gainPassif: 1 + b.passif, parSec: b.parSec }; };
  J.facteurTap = (s) => CD.TRANSE_MOYENNE * facteurCrit(s) * pouvoirs().gainTap;
  J.facteurPassif = () => pouvoirs().gainPassif;
  J.revenuCombat = (s) => C.passiveRate({ autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
    sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: a }) * J.facteurPassif(s);
  const passifBase = (s) => C.passiveRate({ autoClickers: s.autoClickers, upgradeLevels: s.upgradeLevels,
    sanctuaryLevel: s.sanctuaryLevel, essence: s.essence, ascensionCount: a });
  // Valeur ACTUELLE d'une métrique dans la simulation (même lecture que readMetric du jeu).
  const valeur = (m, s) => {
    if (m.startsWith('auto:')) return (s.autoClickers || {})[m.slice(5)] || 0;
    if (m.startsWith('tapUpgrade:')) return (s.tapUpgrades || {})[m.slice(11)] || 0;
    switch (m) {
      case 'tapPower': case 'critLevel': case 'critDamageLevel': case 'sanctuaryLevel': case 'veilleurLevel':
      case 'coins': case 'totalEarned': return s[m] || 0;
      case 'passiveIncome': return passifBase(s);
      case 'totalTaps': return V.taps;
      case 'advLevelReached': return V.av.n;
      case 'battleWon': return V.av.victoires;
      case 'threeStarLevel': return V.av.trois;
      case 'maxCreatureLevel': return V.av.meilleure;
      case 'runeBought': return V.runes;
      case 'offering': return V.offrandes;
      case 'ascension': return s.totalEarned >= C.ascensionThreshold(a) ? a + 1 : a;
      default: return 0;
    }
  };
  // Achat FORCÉ par un défi d'achat (paliers : les prérequis d'abord, règle de déblocage du jeu).
  const achatDe = (m, s) => {
    if (m.startsWith('tapUpgrade:')) {
      let idx = C.TAP_UPGRADES.findIndex((u) => u.id === m.slice(11));
      while (idx >= 0 && !C.tapUpgradeUnlocked(idx, s.tapPower, s.tapUpgrades || {})) {
        if (idx === 0) return achatDe('tapPower', s);
        idx -= 1;
      }
      const u = C.TAP_UPGRADES[idx]; const n = (s.tapUpgrades || {})[u.id] || 0;
      return { quoi: 'tap:' + u.id, cout: Q.coutNiveauAchat('tapUpgrade:' + u.id, n, a),
        appliquer: (x) => { x.tapUpgrades = { ...(x.tapUpgrades || {}), [u.id]: n + 1 }; } };
    }
    if (m.startsWith('auto:')) {
      const id = m.slice(5); const n = (s.autoClickers || {})[id] || 0;
      return { quoi: m, cout: Q.coutNiveauAchat(m, n, a), appliquer: (x) => { x.autoClickers = { ...(x.autoClickers || {}), [id]: n + 1 }; } };
    }
    if (m === 'sanctuaryLevel') return { quoi: m, cout: C.sanctuaryUpgradeCost(s.sanctuaryLevel || 0), appliquer: (x) => { x.sanctuaryLevel = (x.sanctuaryLevel || 0) + 1; } };
    if (m === 'veilleurLevel') return { quoi: m, cout: C.veilleurUpgradeCost(s.veilleurLevel || 0), appliquer: (x) => { x.veilleurLevel = (x.veilleurLevel || 0) + 1; } };
    const niv = s[m] || 0;
    return { quoi: m, cout: Q.coutNiveauAchat(m, niv, a), appliquer: (x) => { x[m] = (x[m] || 0) + 1; } };
  };
  // Défi de PASSIF : le générateur au meilleur gain de passif par pièce.
  // ⚠️ 17/10 — PIÈGE DE L'INSTRUMENT (mesuré) : sans limite de prix, le joueur visait le meilleur rapport de TOUTE la
  // boutique — avec un prix plancher « avant l'heure » fixe (3 × le seuil), le Colosse (objet de l'A5) devenait le
  // meilleur rapport à l'A0 : « Atteins 47 pièces par seconde » en 141 min au lieu de 5. Un joueur (et le calculateur
  // du jeu, passifAtteint) achète parmi ce qu'il peut PAYER : ici, ce qu'il paie en 2 min de production au plus.
  const achatPassif = (s, c, r, prolonge) => {
    const p0 = passifBase(s); let best = null;
    // Budget du DÉFI, comme le calculateur du jeu (passifAtteint) : poche + production de référence × temps visé, à
    // l'apparition ; moins ce que le joueur y a déjà dépensé. (2 min de production : trop court aux A3-A5, mesuré.)
    // ⚠️ 17/10 : budget ÉPUISÉ mais cible pas atteinte (arrondi vers le haut, + 10 % au plus) → le joueur continue au MEILLEUR
    // rapport parmi ce que 2 min de plus lui paient. (Viser le moins cher faisait de faux murs : 987 min à l'œuf 40.)
    const budget = prolonge ? (s.coins || 0) + 120 * Math.max(0, r || 0)
      : Math.max(0, (c && c.budgetPassif || 0) - (c && c.depensePassif || 0));
    let moinsCher = null; // rien de payable en 2 min : le joueur vise le MOINS CHER (sinon : « bloqué » à tort)
    C.AUTOCLICKERS.forEach((g) => {
      const n = (s.autoClickers || {})[g.id] || 0;
      const cout = C.autoClickerCost(g, n, a);
      if (!(cout <= budget)) { if (!moinsCher || cout < moinsCher.cout) moinsCher = { g, n, cout }; return; }
      const p1 = passifBase({ ...s, autoClickers: { ...s.autoClickers, [g.id]: n + 1 } });
      const score = (p1 - p0) / cout;
      if (score > 0 && (!best || score > best.score)) best = { score, quoi: 'auto:' + g.id, cout,
        appliquer: (x) => { x.autoClickers = { ...(x.autoClickers || {}), [g.id]: n + 1 }; } };
    });
    if (!best && !prolonge) return achatPassif(s, c, r, true);
    if (!best && moinsCher) {
      const { g, n, cout } = moinsCher;
      best = { score: 0, quoi: 'auto:' + g.id, cout, appliquer: (x) => { x.autoClickers = { ...(x.autoClickers || {}), [g.id]: n + 1 }; } };
    }
    return best;
  };
  const pVictoire = (n) => K.cibleDifficulte(n, K.difficulteEtape(n));
  // Combats encore nécessaires (estimation, pour savoir combien d'énergie attendre hors ligne).
  const combatsRestants = (c) => {
    const p = V.av.n >= cap ? HYP.victoireRejeu : pVictoire(V.av.n + 1);
    if (c.m === 'advLevelReached') { let f = 0; for (let n = V.av.n + 1; n <= c.cible; n++) f += 1 / pVictoire(n); return Math.max(1, f - V.av.prog); }
    if (c.m === 'battleWon') return (c.base + c.cible - V.av.victoires) / p;
    if (c.m === 'threeStarLevel') return (c.base + c.cible - V.av.trois) / (p * HYP.part3Etoiles);
    if (c.m === 'maxCreatureLevel') return (c.cible - V.av.meilleure) / p;
    if (c.m === 'runeBought') return Math.max(1, (K.POUDRE_PRIX.unite - V.av.poudre) / p);
    return 1;
  };
  const combat = () => {
    V.energie -= 1; V.av.combats = (V.av.combats || 0) + 1;
    if (V.av.n >= cap) { V.av.victoires += HYP.victoireRejeu; V.av.trois += HYP.victoireRejeu * HYP.part3Etoiles; return; }
    const p = pVictoire(V.av.n + 1);
    V.av.prog += p; V.av.victoires += p; V.av.trois += p * HYP.part3Etoiles;
    while (V.av.prog >= 1 && V.av.n < cap) {
      V.av.prog -= 1; V.av.n += 1; V.av.poudre += K.POUDRE_PAR_VICTOIRE;
      // Prime de 1re victoire = le prochain niveau de la meilleure créature (2 au boss), règle du 16/10.
      const plafond = C.niveauMaxPourDefi(V.creatures);
      V.av.meilleure = Math.min(plafond, V.av.meilleure + (K.estEtapeBoss(V.av.n) ? 2 : 1));
    }
  };
  const fait = (c, s) => {
    const m = c.m;
    if (m === 'ascension') return s.totalEarned >= C.ascensionThreshold(a) * (1 - 1e-12);
    if (DUREE_FIXE.includes(m)) return c.ecoule >= c.duree - 1e-9;
    if (m === 'totalCrits') return c.crits >= c.cible - 1e-9;
    const v = valeur(m, s);
    return c.mode === 'delta' ? v - c.base >= c.cible - 1e-9 : v >= c.cible - 1e-9;
  };
  const demarrer = (t, s) => {
    const { q, oeuf, oeufDuGroupe } = liste[J.i];
    // Une créature par œuf déjà éclos. La 1re arrive avec les 40 Griffes du jour 1 (calendrier du jeu),
    // dépensées sur elle au prix du jeu (levelUpCost). Les autres sources (défis du jour, succès) sont
    // IGNORÉES : les défis « Monte une créature » ne comptent ici que les primes de 1re victoire.
    if (V.creatures === 0 && oeuf - 1 >= 1) {
      let g = GRIFFES_JOUR_1;
      while (g >= C.levelUpCost({ rarity: 'commun' }, V.av.meilleure)) { g -= C.levelUpCost({ rarity: 'commun' }, V.av.meilleure); V.av.meilleure += 1; }
    }
    V.creatures = oeuf - 1;
    if (opts.photos) J.photos[J.i] = { s: copie(s), t, V: copie(V) };
    const st = statsJeu(a, s, V);
    const m = Q.metriqueDuDefi(q, st);
    // Comme l'écran à l'apparition du défi (ClickerScreen, effet sur currentChallengeId) : cible résolue, puis
    // défi d'ÉTAT relevé (cibleEtatAdaptee : +20 % de passif, +5 min de production, +5 niveaux, +2) et achat
    // ramené à ce qui manque (cibleAchatCumulee). ⚠️ Oublié dans le 1er essai : « de côté » et revenu/s trop courts.
    let cible = Q.resolveQuestTarget(q, st);
    if (q.mode === 'absolute' && Q.estEtatAdapte(m)) { const c2 = Q.cibleEtatAdaptee(q, st, q.target); if (Number.isInteger(c2) && c2 >= 1 && c2 > cible) cible = c2; }
    if (q.mode === 'delta' && Q.estAchatAdaptable(m)) { const c3 = Q.cibleAchatCumulee(q, st, q.target); if (Number.isInteger(c3) && c3 >= 1 && c3 < cible) cible = c3; }
    // ⚠️ 18/10 — TROU DU JEU trouvé ici : le « +5 niveaux » d'Aventure n'est PAS plafonné au verrou de fin d'Ascension
    // (cibleEtatAdaptee ; le Sanctuaire et le Veilleur le sont). Un joueur à 4 étapes du verrou reçoit une cible
    // inatteignable → œuf bloqué. Simulé ici AVEC le correctif proposé (plafond au verrou), sinon la partie ne finit pas.
    if (m === 'advLevelReached' && HYP.plafondVerrou) cible = Math.min(cible, cap);
    // 17/10 — RÉALIGNÉ : le CALCULATEUR DU JEU passe en DERNIER, comme à l'écran (ClickerScreen, effet d'apparition) ;
    // achats, pièces, revenu/s, cible dorée, pouvoirs, taps, critiques → cible calculée sur la photo, figée.
    const cc = CD.cibleCalculee(q, st, { oeuf, creatures: idsPossedes(V.creatures), protegees: 0 });
    if (Number.isInteger(cc) && cc >= 1) cible = cc;
    const c = { id: q.id, m, mode: q.mode, ecrite: q.target, cible, oeuf, oeufDuGroupe, debutT: t, debutMur: V.mur,
      base: q.mode === 'delta' ? valeur(m, s) : 0, crits: 0, ecoule: 0, duree: 0, label: q.label(cible),
      prelude: HYP.secParDefi };
    if (m === 'goldenClaimed') c.duree = residuDoree() + Math.max(0, cible - 1) * pDoree();
    if (m === 'maxTapStreak') c.duree = cible / taps;
    if (m === 'maxTranseHoldSec') c.duree = (1 - HYP.partTranse) * TRANSE.montee + 1 / taps + cible;
    if (m === 'powerActivated') c.duree = pouvoirs().parSec > 0 ? Math.max(0, cible - 0.5) / pouvoirs().parSec : Infinity;
    J.courant = c;
    // 17/10 : pièces gagnées en fin de chaîne et production de référence à ce moment (seuils déduits de la chaîne).
    if (m === 'ascension') { J.gagneChaine = s.totalEarned; J.prodFin = CD.productionReference(st, idsPossedes(V.creatures)); }
    if (m === 'passiveIncome') { c.budgetPassif = (s.coins || 0) + CD.productionReference(st, idsPossedes(V.creatures)) * CD.tempsViseOeuf(oeuf); c.depensePassif = 0; }
  };
  const terminer = (t) => {
    const c = J.courant;
    let cout = 0;
    if (ACHATS(c.m)) for (let l = c.base; l < c.base + c.cible; l++) cout += Q.coutNiveauAchat(c.m, l, a);
    J.resultats.push({ ...c, cout, finT: t, actif: t - c.debutT, mur: V.mur - c.debutMur, attente: (V.mur - c.debutMur) - (t - c.debutT) });
    J.i += 1; J.courant = null;
  };
  J.bloque = (t) => { J.bloqueA = { i: J.i, t }; J.fini = true; };
  J.decider = (t, s, r, v) => {
    for (let garde = 0; garde < 1000; garde++) {
      if (!J.courant) {
        if (opts.arreterApres !== undefined && J.i > opts.arreterApres) {
          J.photoFin = { s: copie(s), t, V: copie(V) }; J.fini = true; return {};
        }
        if (J.i >= liste.length) { J.fini = true; return {}; }
        demarrer(t, s);
      }
      if (J.courant.prelude > 1e-9) return { achat: null, horizon: J.courant.prelude, combat: true, prelude: true };
      if (!fait(J.courant, s)) break;
      terminer(t);
    }
    const c = J.courant; const m = c.m;
    if (t - c.debutT > 400 * 3600) { J.bloque(t); return {}; }
    if (HYP.combatDesQuePlein && !AVENTURE.includes(m) && !DUREE_FIXE.includes(m) && m !== 'totalCrits' && m !== 'totalTaps'
      && V.energie >= K.ENERGY_MAX - 1e-9 && V.av.n < cap) return { achat: null, horizon: HYP.secParCombat, combat: true };
    if (ACHATS(m) || m === 'sanctuaryLevel' || m === 'veilleurLevel') return { achat: achatDe(m, s), horizon: Infinity };
    if (m === 'passiveIncome') return { achat: achatPassif(s, c, r), horizon: Infinity };
    if (m === 'coins') return { achat: null, horizon: r > 0 ? Math.max(1e-6, (c.cible - s.coins) / r) : Infinity };
    if (m === 'totalEarned') return { achat: v, horizon: r > 0 ? Math.max(1e-6, (c.base + c.cible - s.totalEarned) / r) : Infinity };
    if (m === 'ascension') return { achat: v, horizon: r > 0 ? Math.max(1e-6, (C.ascensionThreshold(a) - s.totalEarned) / r) : Infinity };
    if (DUREE_FIXE.includes(m)) return { achat: SANS_ACHAT.includes(m) ? null : v, horizon: Math.max(1e-6, c.duree - c.ecoule) };
    if (m === 'totalCrits') {
      // Le joueur des 32 h n'achète pas la Faveur de lui-même : pendant ce défi, il en prend un niveau
      // tant que le temps gagné dépasse le temps de le payer (et d'office à 0 % de critique).
      const p = chanceCrit(s), reste = c.cible - c.crits;
      const f = achatDe('critLevel', s);
      const p2 = chanceCrit({ ...s, critLevel: (s.critLevel || 0) + 1 });
      const gagne = p > 0 ? reste / (taps * p) - reste / (taps * p2) : Infinity;
      const prix = r > 0 ? Math.max(0, f.cout - s.coins) / r : Infinity;
      if (p <= 0 || (p2 > p && gagne > prix)) return { achat: f, horizon: p > 0 ? Math.max(1e-6, reste / (taps * p)) : Infinity };
      return { achat: v, horizon: Math.max(1e-6, reste / (taps * p)) };
    }
    if (m === 'totalTaps') return { achat: v, horizon: Math.max(1e-6, (c.cible - V.taps) / taps) };
    if (m === 'offering') {
      if (V.diamants >= 1) return { achat: null, horizon: HYP.secAction, action: 'offrande' };
      return { achat: v, horizon: Math.max(1e-6, V.prochainBoss - V.actif) };
    }
    if (AVENTURE.includes(m)) {
      if (m === 'runeBought' && V.av.poudre >= K.POUDRE_PRIX.unite) return { achat: null, horizon: HYP.secAction, action: 'rune' };
      if (V.energie >= 1) return { achat: null, horizon: HYP.secParCombat, combat: true };
      // Plus d'énergie : le joueur s'en va (hors ligne) et revient quand il en a assez (barre pleine au plus).
      const voulu = Math.min(K.ENERGY_MAX, Math.max(1, Math.ceil(combatsRestants(c) - 1e-9)));
      return { pause: Math.max(1, (voulu - V.energie) * REGEN) };
    }
    return { achat: null, horizon: 0 }; // métrique non modélisée : validée tout de suite (signalée)
  };
  J.avancer = (pas, s, d) => {
    if (d.pause) {
      V.mur += d.pause; V.energie = Math.min(K.ENERGY_MAX, V.energie + d.pause / REGEN);
      V.prochainBoss = V.actif + 120; // nouvelle session : 1er boss à 2 min de jeu actif
      return;
    }
    V.mur += pas; V.actif += pas; V.energie = Math.min(K.ENERGY_MAX, V.energie + pas / REGEN);
    const c = J.courant;
    if (d.prelude) { if (c) c.prelude -= pas; return; }
    if (c) c.ecoule += pas;
    if (!d.combat) {
      V.taps += taps * pas;
      if (c && c.m === 'totalCrits') c.crits += taps * chanceCrit(s) * pas;
      while (V.actif >= V.prochainBoss - 1e-9) { V.diamants += HYP.diamantsParBoss; V.prochainBoss += 1200; }
    }
    if (pas >= d.horizon - 1e-9) {
      if (d.combat) combat();
      if (d.action === 'offrande') { V.diamants -= 1; V.offrandes += 1; }
      if (d.action === 'rune') { V.av.poudre -= K.POUDRE_PRIX.unite; V.runes += 1; }
    }
  };
  J.achete = (achat) => { const c = J.courant; if (c && c.m === 'passiveIncome' && achat && String(achat.quoi).startsWith('auto:')) c.depensePassif += achat.cout; };
  return J;
}

// Joue un groupe (entier, ou depuis une photo jusqu'après le défi `arreterApres`).
function jouer(a, V, photo, opts = {}) {
  const Vc = copie(photo ? photo.V : V);
  const J = creerJoueur(a, Vc, photo ? { i: opts.depuis, courant: null } : null, opts);
  const options = { defis: J };
  if (photo) options.depart = { s: photo.s, t: photo.t };
  const r = A.simulerGroupe(a, HYP.tapsParSec, options);
  return { J, V: Vc, sim: r };
}


// ---- RECHERCHE DES CIBLES v2.3 -------------------------------------------
// Temps visé PAR DÉFI (décision A : durées gardées, 32 h) = durée ACTUELLE du groupe (simulerGroupe, joueur
// de référence à 4 taps/s, temps actif) ÷ œufs ÷ 8 — la règle « temps de l'œuf ÷ 8 » du cahier des charges v2.
// Recalés : pièces, de côté, revenu/s, taps, critiques, cible dorée, pouvoirs, achats. INCHANGÉS : Aventure,
// records (Transe, taps d'affilée), Ascension, Sanctuaire / Veilleur, Offrande, cibles de 1.
const RECALES = ['totalEarned', 'coins', 'passiveIncome', 'totalTaps', 'totalCrits', 'goldenClaimed', 'powerActivated'];
const CONTINUS = ['totalEarned', 'coins', 'passiveIncome', 'totalTaps', 'totalCrits'];
const PREMIER_OEUF = new Set(D.DEFIS_ECRITS[0].map((q) => q.id)); // tutoriel fixé par l'auteur (wiki, 20-21/09)
// 18/10 : l'œuf 1 est recalé lui aussi (l'auteur veut au moins 5 min par défi dès l'œuf 1).
const recale = (q) => (q.target || 0) > 1 && (ACHATS(q.metric) || RECALES.includes(q.metric));
const joli = (x) => (x >= 1000 ? Number(x.toPrecision(2)) : Math.max(1, Math.round(x)));
// Taps « au total » : un compteur À VIE (des centaines de milliers) — 2 chiffres significatifs effaceraient l'écart
// voulu (vécu : 100 500 arrondi à 100 000 = déjà atteint). Arrondi à la centaine.
const arrondi = (m, x) => (m === 'totalTaps' ? Math.max(100, Math.round(x / 100) * 100) : joli(x));
function tempsVise(a) {
  return A.simulerGroupe(a, 4).tActif / (D.OEUFS_PAR_GROUPE[a] * 8);
}
// ⚠️ 18/10 — TEMPS VISÉ CHOISI PAR L'AUTEUR (remplace la règle « durée du groupe ÷ œufs ÷ 8 » ET le départ à 3 min,
// qu'il n'avait jamais validé) : au moins 5 min par défi à l'œuf 1, 7 min à l'œuf 2, 10 min dès l'œuf 3, puis
// +0,75 min tous les 3 œufs (6, 9, 12…). Raison : les défis de combat ou de Transe durent 30 s à 4 min — les défis
// recalés doivent compenser. En secondes de jeu actif, joueur de référence (7 taps/s).
// 17/10 — RÉALIGNÉ : LE temps visé du jeu (l'ancienne copie locale 5 / 7 / 10 min était périmée).
const tempsViseOeuf = CD.tempsViseOeuf;
// Joue UN défi depuis la photo de son apparition, avec la cible écrite x ; rend { r, photoFin }.
function jouerUn(a, photo, i, x) {
  const q = defisDuGroupe(a)[i].q;
  const avant = q.target;
  if (x !== undefined) q.target = x;
  try {
    const r = jouer(a, null, photo, { depuis: i, arreterApres: i });
    // Bloqué (cible inatteignable en 400 h de jeu actif) : temps infini, jamais retenu par la recherche.
    return { r: r.J.resultats[0] || { actif: Infinity, attente: 0, label: q.label(q.target), id: q.id, m: q.metric },
      photoFin: r.J.photoFin, bloque: r.J.bloqueA };
  } finally { if (x !== undefined) q.target = avant; }
}
function chercher(a, photo, i, tau) {
  const q = defisDuGroupe(a)[i].q;
  const cache = {};
  const f = (x) => (cache[x] !== undefined ? cache[x] : (cache[x] = jouerUn(a, photo, i, x).r.actif));
  if (CONTINUS.includes(q.metric)) {
    const J2 = (x) => arrondi(q.metric, x);
    let lo = 1, hi = Math.max(2, q.target);
    if (f(J2(lo)) >= tau) return { x: q.target, note: 'plancher du jeu' };
    for (let k = 0; k < 40 && f(J2(hi)) < tau; k++) { lo = hi; hi *= 4; }
    for (let k = 0; k < 24; k++) { const mid = Math.sqrt(lo * hi); if (f(J2(mid)) >= tau) hi = mid; else lo = mid; }
    const a1 = J2(lo), b1 = J2(hi);
    return { x: Math.abs(f(a1) - tau) <= Math.abs(f(b1) - tau) ? a1 : b1 };
  }
  if (f(1) >= tau) return { x: 1 };
  let lo = 1, hi = Math.max(2, q.target);
  for (let k = 0; k < 30 && f(hi) < tau; k++) { lo = hi; hi *= 2; }
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (f(mid) >= tau) hi = mid; else lo = mid; }
  return { x: Math.abs(f(lo) - tau) <= Math.abs(f(hi) - tau) ? lo : hi };
}
// Chaîne v2.3 d'un groupe : défi par défi, la cible choisie reste écrite pour la suite (règle du total).
function chaineV23(a, vie) {
  const tauG = tempsViseOeuf(D.OEUFS_PAR_GROUPE.slice(0, a).reduce((x, y) => x + y, 0) + 1);
  const liste = defisDuGroupe(a);
  let photo = jouer(a, vie, null, { arreterApres: -1 }).J.photoFin;
  const lignes = [];
  for (let i = 0; i < liste.length; i++) {
    const q = liste[i].q;
    let note = '';
    const tau = tempsViseOeuf(liste[i].oeuf);
    if (recale(q)) {
      const c = chercher(a, photo, i, tau);
      q.target = c.x; note = c.note || '';
    }
    const u = jouerUn(a, photo, i);
    lignes.push({ ...u.r, ecriteV23: q.target, note, bloque: !!u.bloque, tau });
    if (u.bloque) break;
    photo = u.photoFin;
  }
  return { lignes, tau: tauG, vie: photo.V };
}
// Toute la partie : chaîne « aujourd'hui » (cibles écrites), puis chaîne v2.3. Les cibles d'origine sont
// RESTAURÉES à la fin (rien n'est écrit : seul l'objet chargé en mémoire est modifié pendant le calcul).
function calculer() {
  const origine = D.DEFIS_ECRITS.flat().map((q) => q.target);
  try {
    const aujourdhui = []; let vie = etatVieInitial();
    for (let a = 0; a < 6; a++) { const r = jouer(a, vie, null, {}); aujourdhui.push(r.J.resultats); vie = r.V; }
    const v23 = []; vie = etatVieInitial();
    for (let a = 0; a < 6; a++) { const r = chaineV23(a, vie); v23.push(r); vie = r.vie; }
    return { aujourdhui, v23 };
  } finally {
    D.DEFIS_ECRITS.flat().forEach((q, k) => { q.target = origine[k]; });
  }
}

module.exports = { IDS, idsPossedes, suiteCreatures, HYP, TRANSE, POUVOIRS, facteurCrit, chanceCrit, statsDeck, defisDuGroupe, etatVieInitial, jouer, creerJoueur, tempsVise, tempsViseOeuf, calculer };

if (require.main === module) {
  const t0 = Date.now();
  const R = calculer();
  const sortie = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  if (sortie) fs.writeFileSync(sortie, JSON.stringify({ HYP, TRANSE, date: new Date().toISOString(), ...R }));
  const h = (x) => (x / 3600).toFixed(2).replace('.', ',') + ' h';
  for (let a = 0; a < 6; a++) {
    const auj = R.aujourdhui[a], v = R.v23[a];
    const act = (L) => L.reduce((t, x) => t + x.actif, 0), att = (L) => L.reduce((t, x) => t + x.attente, 0);
    console.log(`A${a} · visé ${(v.tau / 60).toFixed(1)} min/défi · aujourd'hui ${h(act(auj))} (+${h(att(auj))} d'énergie) · v2.3 ${h(act(v.lignes))} (+${h(att(v.lignes))})${v.lignes.some((x) => x.bloque) ? ' · BLOQUÉ' : ''}`);
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  CALIBRER L'EXPLORATION : QUI affronte-t-on à chaque étape (niveaux réels, 10/10)
// ═══════════════════════════════════════════════════════════════════════════
//
//   NODE_PATH=<dossier avec @babel/core> node mobile/tools/calibrer-parcours.js [joueurs] [essais] [--ecrire]
//
// Décisions de l'auteur (10/10) : les ennemis sont de VRAIES créatures (niveau = étape, boss +3,
// combatLogic : equipeEnnemie) ; la difficulté vient de ce que l'ennemi MONTRE (nombre, rareté,
// évolution) ; calibrage sur le joueur MÉDIAN à 7 victoires sur 10 (avant : les 10 % les plus
// malchanceux à 6/10 → un joueur normal gagnait 9 fois sur 10) ; chapitre 1 = apprentissage, ennemis
// un peu en dessous du joueur (il reçoit 40 Griffes au jour 1 du calendrier, « quoi qu'il arrive »).
// Boss (dernière étape d'un chapitre) : CIBLE_BOSS, plus dur — sinon le calibrage annulerait ses
// 3 niveaux de plus en choisissant des espèces plus faibles.
//
// Méthode : la MÊME population de joueurs gratuits que le simulateur (vrais œufs, Griffes, runes,
// énergie, filet du jeu, plafond de niveau du jeu) avance étape par étape. À chaque étape : chacun se
// prépare ; on classe TOUTES les équipes possibles (taille du chapitre, espèces toutes différentes)
// par force brute √(ΣPV × ΣATQ) au niveau de l'étape ; dichotomie sur ce classement (côté FACILE) pour
// trouver la frontière où le joueur médian gagne encore la cible ; on mesure quelques équipes autour
// (variété : espèces vues le moins récemment) et on garde la plus proche de la cible ; puis chacun JOUE
// l'étape contre elle. Les ennemis passent par le JEU (ENNEMIS_ETAPES, que l'outil remplit) : jamais
// une copie de ses règles.
const P = require('./simulateur-parcours.js');
const A = require('./audit-quetes.js');
const K = A.load('combatLogic');
const L = A.load('clickerLogic');

// ⚠️ « 7 victoires sur 10 » (décision de l'auteur) se lit sur une PARTIE ENTIÈRE (victoires / combats,
// rejouer compris), pas étape par étape. MESURÉ (40 parties complètes) : viser 0,7 par étape donnait
// 3,8 à 5,6 sur 10 au joueur médian dès l'A1 (chaque défaite ajoute des combats rejoués). Jeu publié
// avant la refonte : 8,1 à 10 sur 10 (le « trop facile » de l'auteur).
// Cible PAR ÉTAPE auto-corrigée : OBJECTIF = victoires / combats du joueur médian sur l'Ascension en
// cours (chapitre 1 exclu : apprentissage, facile exprès). En dessous, les étapes suivantes visent plus
// facile ; au-dessus, plus dur (GAIN). MESURÉ avec une cible FIXE de 0,85 : 5,5 à 8,1 sur 10 selon
// l'Ascension — une cible fixe ne peut pas les égaliser.
// ⚠️ La cible par étape porte sur la victoire MOYENNE de la population, pas sur le joueur médian de
// l'étape. MESURÉ : en visant le médian de chaque étape (jusqu'à 0,97), le joueur médian d'une PARTIE
// restait à 4,9-5,3 sur 10 aux A1-A2 — à chaque étape la moitié gagne presque sûrement, mais ce ne sont
// pas les mêmes d'une étape à l'autre (les œufs rebattent l'ordre des équipes) : chacun perd souvent.
const OBJECTIF = 0.7;
const CIBLE = 0.7, GAIN = 1.5, CIBLE_MIN = 0.4, CIBLE_MAX = 0.97;
const ECART_BOSS = 0.15; // le boss vise 15 points de moins (plus dur)
const CIBLE_BOSS = CIBLE - ECART_BOSS;
const CENTILE = 0.5; // le joueur MÉDIAN
const VOISINAGE = 0.08; // équipes dont la force brute est à ±8 % de la frontière
const MESUREES = 5;     // combien d'entre elles on mesure vraiment (+ la frontière elle-même)
// ⚠️ JAMAIS BLOQUÉ (exigence de l'auteur) : les combats ont très peu de hasard — contre une équipe
// donnée, un joueur gagne presque toujours ou perd presque toujours. Viser le joueur MÉDIAN laisse
// donc les malchanceux (œufs moins rares) sous la barre : ils passent grâce au filet du jeu. Garde :
// le joueur au 10e rang doit gagner au moins SECOURS.taux avec la baisse du filet après 5 défaites.
// MESURÉ sans cette garde (1er essai, 10/10) : 10 joueurs sur 40 bloqués entre les étapes 82 et 149.
const SECOURS = { baisse: 0.4, taux: 0.5 };

// ---- CHAPITRE 1 = APPRENTISSAGE (26/09, décision de l'auteur ; 10/10 : + 40 Griffes du jour 1) ----
// Aux étapes 1 à 10, l'équipe ennemie doit être battue par CHAQUE 1re créature possible (raretés du
// 1er œuf, LUES dans le jeu), au niveau qu'un débutant atteint avec ses 40 Griffes du jour 1 et les
// primes de ses 1res victoires (ni packs, ni quêtes), plafond de niveau du jeu compris :
// 9 fois sur 10 à l'étape 1, 8 fois sur 10 ensuite.
// 10/10 : 100 combats (comme auditApprentissage) — sur 60, un choix limite passait l'outil et échouait au contrôle
// (Luxorbe 67 % au boss de l'étape 10, plancher 70 %).
const APPRENTISSAGE = { niveaux: 10, cibleNiveau1: 0.9, cible: 0.8, combats: 100 };
const GRIFFES_JOUR_1 = 40; // dailyLogic : calendrier, jour 1
function premieresCreatures() {
  const max = L.ORDRE_RARETES.indexOf(L.rareteMaxPourOeuf(0));
  return A.C.CREATURES.filter((c) => { const r = L.ORDRE_RARETES.indexOf(c.rarity); return r >= 0 && r <= max; });
}
function niveauDebutant(l, creature) {
  let griffes = GRIFFES_JOUR_1;
  for (let i = 1; i < l; i++) griffes += K.griffesReward(i);
  const plafond = L.niveauMaxCreature(l - 1); // aucune étape gagnée avant la 1re
  let niv = 1;
  while (niv < plafond && L.levelUpCost(creature, niv) <= griffes) { griffes -= L.levelUpCost(creature, niv); niv++; }
  return niv;
}
// Le PIRE taux de victoire parmi les 1res créatures possibles contre l'équipe que le JEU donne à
// l'étape l (hasard fixé : deux appels identiques donnent le même résultat).
function tauxDebutant(l, k = 1, combats = APPRENTISSAGE.combats) {
  let pire = 1, qui = null;
  premieresCreatures().forEach((c, ci) => {
    let s = (l * 7919 + ci * 104729) >>> 0;
    const alea = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
    const adv = K.opponentTeamForLevel(l).map((o) => ({ creature: o, stats: K.statsForOpponentCreatureTyped(o, l, k) }));
    const moi = [{ creature: c, stats: K.combatStatsForCreatureTyped(c, niveauDebutant(l, c), 0, []) }];
    let g = 0;
    for (let e = 0; e < combats; e++) if (K.simulerCombat(moi, adv, { alea, politique: K.choixJoueur }).gagne) g++;
    if (g / combats < pire) { pire = g / combats; qui = c.id; }
  });
  return { pire, qui };
}

// Toutes les équipes de `taille` espèces différentes (1 : 26, 2 : 325, 3 : 2 600).
function equipesPossibles(taille) {
  const ids = A.C.CREATURES.map((c) => c.id), res = [];
  const rec = (debut, cur) => { if (cur.length === taille) { res.push(cur.slice()); return; }
    for (let i = debut; i < ids.length; i++) { cur.push(ids[i]); rec(i + 1, cur); cur.pop(); } };
  rec(0, []);
  return res;
}
const PAR_ID = Object.fromEntries(A.C.CREATURES.map((c) => [c.id, c]));

// ═══ RÈGLE SIMPLE DE L'AUTEUR (10/10) — remplace le réglage par cible de victoires ═══
// Pour chaque étape : autant d'ennemis que le chapitre en compte (1, 2, puis 3) ; la RARETÉ de chacun = celle des
// créatures d'un joueur typique à cette étape (rareté médiane de sa 1re, 2e, 3e créature la plus forte) ; l'ESPÈCE =
// la moins vue (2 fois au plus par chapitre) ; niveau = l'étape (niveauEnnemi). La FORCE vient de la règle du jeu
// (statsForOpponentCreatureTyped : force moyenne de la rareté × FORCE_ENNEMI). Aucun réglage par cible ici.
function calibrer(nJoueurs = 60, essais = 10, R = P.REGLAGES) {
  const T = K.ENNEMIS_ETAPES;
  T.length = 0;
  const RANG = L.ORDRE_RARETES;
  const joueurs = Array.from({ length: nJoueurs }, (_, i) => P.nouveauJoueur(5000 + i * 104729, R));
  const vuA = {}, parChapitre = {};
  const lignes = [], puissances = [], bloques = [];
  const rang = (v, q) => v[Math.floor(v.length * q)];
  for (let a = 0; a < 6; a++) {
    const stats = joueurs.map((j) => j.nouvelleAsc(a));
    for (let l = (a ? R.finsAventure[a - 1] : 0) + 1; l <= R.finsAventure[a]; l++) {
      const actifs = joueurs.filter((j) => !j.bloque);
      actifs.forEach((j) => j.preparer(l, a));
      const taille = K.opponentTeamSize(l);
      const ch = Math.ceil(l / 10), vusCh = (parChapitre[ch] = parChapitre[ch] || {});
      const ids = [], evos = [];
      for (let i = 0; i < taille; i++) {
        const v = actifs.map((j) => j.trio()[i]).filter(Boolean).map((p) => RANG.indexOf(p.c.rarity)).sort((x, y) => x - y);
        // Chapitre 1 = apprentissage : la rareté de la 1re créature la PLUS FAIBLE possible (commune). MESURÉ avec la
        // rareté médiane : Pyrosile débutant à 43 % à l'étape 2 et 0 % au boss de l'étape 10.
        const r = l <= APPRENTISSAGE.niveaux ? Math.min(...premieresCreatures().map((c) => RANG.indexOf(c.rarity))) : (v.length ? rang(v, 0.5) : 0);
        // Espèces de cette rareté (au besoin, la plus proche), la moins vue dans le chapitre puis la moins récente.
        let pool = [];
        for (let d = 0; !pool.length && d < RANG.length; d++) pool = A.C.CREATURES.filter((c) => !ids.includes(c.id) && Math.abs(RANG.indexOf(c.rarity) - r) === d);
        // 10/10 : jamais une espèce trop forte pour l'étape (son niveau réel tomberait sous 0,5 : le niveau 1 serait déjà
        // trop fort) quand une autre convient — les toutes premières étapes prennent ainsi les espèces les plus faibles.
        const nivEtape = K.niveauEnnemi(l) - K.bonusElite(l), evoSlot = (() => { const ev = actifs.map((j) => j.trio()[i]).filter(Boolean).map((p) => p.evo).sort((x, y) => x - y); return ev.length ? rang(ev, 0.5) : 0; })();
        const convient = (c) => K.niveauReelEnnemi(c, nivEtape, evoSlot, taille) >= 0.5;
        if (pool.some(convient)) pool = pool.filter(convient);
        else { // aucune ne convient (étape 1) : la plus FAIBLE disponible, au plus près de la force voulue
          const best = Math.max(...pool.map((c) => K.niveauReelEnnemi(c, nivEtape, evoSlot, taille)));
          pool = pool.filter((c) => K.niveauReelEnnemi(c, nivEtape, evoSlot, taille) >= best - 1e-9);
        }
        pool.sort((x, y) => ((vusCh[x.id] || 0) - (vusCh[y.id] || 0)) || ((vuA[x.id] || -1e9) - (vuA[y.id] || -1e9)));
        const c = pool[0]; ids.push(c.id); vusCh[c.id] = (vusCh[c.id] || 0) + 1; vuA[c.id] = l;
        // Son évolution : celle de la i-e créature d'un joueur typique (médiane).
        const ev = actifs.map((j) => j.trio()[i]).filter(Boolean).map((p) => p.evo).sort((x, y) => x - y);
        evos.push(ev.length ? rang(ev, 0.5) : 0);
      }
      T[l - 1] = ids.map((id, i) => id + ':' + evos[i]).join('+');
      // Mesure (pour le rapport) : 1er essai de chaque joueur, hasard fixé par (étape, joueur).
      const decks = actifs.map((j) => j.joueurs());
      const v = actifs.map((j, i) => { let h = (l * 2654435761 + i * 40503) >>> 0;
        const alea = () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const adv = j.adversaires(l, 1); let g = 0;
        for (let e = 0; e < essais; e++) if (K.simulerCombat(decks[i], adv, { alea, politique: K.choixJoueur }).gagne) g++;
        return g / Math.max(1, essais); }).sort((x, y) => x - y);
      const niv = actifs.map((j) => { const t = j.trio(); return t.reduce((x, p) => x + p.niv, 0) / Math.max(1, t.length); }).sort((x, y) => x - y);
      lignes.push({ l, boss: K.estEtapeBoss(l), niveau: K.niveauEnnemi(l), ids, raretes: ids.map((id) => PAR_ID[id].rarity),
        med: rang(v, 0.5), p10: rang(v, 0.1), nivJoueur: rang(niv, 0.5) });
      const pw = actifs.map((j) => K.puissanceDeck(j.trio().map((p) => ({ creature: p.c, ownedLevel: p.niv, evolutionTier: p.evo, equippedRunes: [] })))).sort((x, y) => x - y);
      // Maximum COURANT (comme l'ancien outil) : la puissance conseillée ne baisse jamais (auditPuissanceConseillee).
      puissances.push(Math.max(puissances.length ? puissances[puissances.length - 1] : 0, pw[Math.floor(pw.length * CENTILE)]));
      actifs.forEach((j) => { j.jouer(l, 1, stats[joueurs.indexOf(j)]); if (j.bloque) bloques.push(l); });
    }
    joueurs.forEach((j, i) => { if (!j.parAsc[a]) j.finAscension(a, stats[i]); });
  }
  return { table: T.slice(), lignes, puissances, bloques };
}

// Écrit la table et la puissance conseillée dans le jeu (seul chemin autorisé : jamais à la main).
function ecrire(r) {
  const fs = require('fs'), path = require('path');
  const p = path.join(__dirname, '../src/games/clicker/combatLogic.js');
  let s = fs.readFileSync(p, 'utf8');
  const enLignes = (v, n) => { const out = []; for (let i = 0; i < v.length; i += n) out.push('  ' + v.slice(i, i + n).join(', ') + ','); return out.join('\n'); };
  const a = /export const ENNEMIS_ETAPES = \[[^\]]*\];/, b = /export const PUISSANCE_CONSEILLEE = \[[^\]]*\];/;
  if (!a.test(s) || !b.test(s)) throw new Error('tables introuvables dans combatLogic.js');
  s = s.replace(a, 'export const ENNEMIS_ETAPES = [\n' + enLignes(r.table.map((x) => "'" + x + "'"), 6) + '\n];');
  s = s.replace(b, 'export const PUISSANCE_CONSEILLEE = [\n' + enLignes(r.puissances, 18) + '\n];');
  fs.writeFileSync(p, s, 'utf8');
}
module.exports = { calibrer, ecrire, tauxDebutant, niveauDebutant, premieresCreatures, APPRENTISSAGE, CIBLE, CIBLE_BOSS };

if (require.main === module) {
  const n = Number(process.argv[2]) || 60, e = Number(process.argv[3]) || 10;
  const t0 = Date.now();
  const r = calibrer(n, e);
  require('fs').writeFileSync(process.env.SORTIE_CALIBRAGE || '/tmp/calibrage-ennemis.json', JSON.stringify(r));
  r.lignes.forEach((x) => console.log('étape ' + x.l + (x.boss ? ' BOSS' : '') + ' · niv ' + x.niveau + (x.evo ? ' évo ' + x.evo : '') + ' · '
    + x.ids.join(' + ') + ' · médian ' + Math.round(100 * x.med) + ' % · malchanceux ' + Math.round(100 * x.p10) + ' %' + (x.app != null ? ' · débutant ' + Math.round(100 * x.app) + ' %' : '')));
  console.log('bloqués pendant le calibrage : ' + (r.bloques.length ? r.bloques.join(', ') : 'aucun'));
  console.log('(' + n + ' joueurs × ' + e + ' essais, ' + Math.round((Date.now() - t0) / 1000) + ' s)');
  if (process.argv.includes('--ecrire')) { ecrire(r); console.log('tables écrites dans combatLogic.js'); }
}

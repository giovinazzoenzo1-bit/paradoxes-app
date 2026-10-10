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
const APPRENTISSAGE = { niveaux: 10, cibleNiveau1: 0.9, cible: 0.8, combats: 60 };
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

function calibrer(nJoueurs = 40, essais = 10, R = P.REGLAGES) {
  const T = K.ENNEMIS_ETAPES;
  T.length = 0; // on repart de zéro (la table écrite dans le jeu est recalculée en entier)
  const joueurs = Array.from({ length: nJoueurs }, (_, i) => P.nouveauJoueur(5000 + i * 104729, R));
  const equipes = { 1: equipesPossibles(1), 2: equipesPossibles(2), 3: equipesPossibles(3) };
  const vuA = {}; // dernière étape où chaque espèce a été choisie (variété)
  const lignes = [], puissances = [], bloques = [];
  const rang = (v, q) => v[Math.floor(v.length * q)];
  for (let a = 0; a < 6; a++) {
    const stats = joueurs.map((j) => j.nouvelleAsc(a));
    const compte = joueurs.map(() => ({ v: 0, c: 0 })); // victoires / combats de l'Ascension, chapitre 1 exclu
    for (let l = (a ? R.finsAventure[a - 1] : 0) + 1; l <= R.finsAventure[a]; l++) {
      const actifs = joueurs.filter((j) => !j.bloque);
      actifs.forEach((j) => j.preparer(l, a));
      const decks = actifs.map((j) => j.joueurs());
      const boss = K.estEtapeBoss(l);
      const ratios = actifs.map((j) => compte[joueurs.indexOf(j)]).filter((x) => x.c > 0).map((x) => x.v / x.c);
      const courant = ratios.length ? rang(ratios.slice().sort((x, y) => x - y), CENTILE) : OBJECTIF;
      const base = Math.min(CIBLE_MAX, Math.max(CIBLE_MIN, CIBLE + GAIN * (OBJECTIF - courant)));
      const cible = boss ? base - ECART_BOSS : base;
      const nivBase = l + (boss ? K.BONUS_NIVEAU_BOSS : 0);
      const taille = K.opponentTeamSize(l);
      // Toutes les équipes de la taille du chapitre, classées par force brute √(ΣPV × ΣATQ) au niveau
      // de l'étape + b niveaux d'élite (formule du jeu).
      const classement = (b) => {
        const niv = nivBase + b, evo = K.evoPourNiveau(niv), st = {};
        A.C.CREATURES.forEach((c) => { st[c.id] = K.combatStatsForCreatureTyped(c, niv, evo, []); });
        const force = (ids) => Math.sqrt(ids.reduce((t, id) => t + st[id].hp, 0) * ids.reduce((t, id) => t + st[id].attack, 0));
        return equipes[taille].map((ids) => ({ ids, f: force(ids) })).sort((x, y) => x.f - y.f);
      };
      const entree = (ids, b) => ids.join('+') + (b ? '@' + b : '');
      // Taux de la population contre une équipe : posée dans la table DU JEU, lue par le jeu.
      // ⚠️ Hasard FIXÉ par (étape, joueur, équipe) : MESURÉ au 1er essai, un hasard qui avance à chaque
      // mesure donnait 80 % puis 0 % pour la même équipe (joueur médian au ras du seuil) → choix
      // incohérents (étape 15 : 0 % pour le joueur médian).
      const graine = (cle, i, baisse) => { let h = (l * 2654435761 + i * 40503 + Math.round(baisse * 100)) >>> 0;
        for (const ch of cle) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
        return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
      const taux = (ids, b, baisse = 0) => {
        const cle = entree(ids, b);
        T[l - 1] = cle;
        return actifs.map((j, i) => { const adv = j.adversaires(l, 1, baisse); const alea = graine(cle, i, baisse); let g = 0;
          for (let e = 0; e < essais; e++) if (K.simulerCombat(decks[i], adv, { alea, politique: K.choixJoueur }).gagne) g++;
          return g / essais; }).sort((x, y) => x - y);
      };
      const mesure = (ids, b) => { const v = taux(ids, b); return { moy: v.reduce((t, x) => t + x, 0) / v.length, med: rang(v, CENTILE), p10: rang(v, 0.1) }; };
      const secours = (ids, b) => rang(taux(ids, b, SECOURS.baisse), 0.1) >= SECOURS.taux;
      let b = 0;
      let candidats = classement(0);
      if (l <= APPRENTISSAGE.niveaux) {
        // Apprentissage (chapitre 1) : on ne garde que les équipes que CHAQUE débutant bat.
        const cibleApp = l === 1 ? APPRENTISSAGE.cibleNiveau1 : APPRENTISSAGE.cible;
        const ok = candidats.filter((e) => { T[l - 1] = entree(e.ids, 0); return tauxDebutant(l).pire >= cibleApp; });
        candidats = ok.length ? ok : candidats.slice(0, 1); // le plus faible possible (signalé par « débutant »)
      } else if (mesure(candidats[candidats.length - 1].ids, 0).moy >= cible) {
        // PLAFOND : même l'équipe la plus forte est battue par le joueur médian → ÉLITES. Le plus grand
        // bonus (côté FACILE) où le joueur médian gagne encore la cible contre l'équipe la plus forte.
        const plusForte = (bb) => { const t = classement(bb); return t[t.length - 1].ids; };
        let lo = 0, hi = 1;
        while (hi < 256 && mesure(plusForte(hi), hi).moy >= cible) { lo = hi; hi *= 2; }
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (mesure(plusForte(mid), mid).moy >= cible) lo = mid; else hi = mid; }
        b = lo;
        candidats = classement(b);
      }
      // Dichotomie (côté FACILE) : plus grand rang dont la médiane atteint encore la cible.
      let lo = 0, hi = candidats.length - 1;
      if (mesure(candidats[0].ids, b).moy < cible) hi = 0;
      else if (mesure(candidats[hi].ids, b).moy >= cible) lo = hi;
      else { while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (mesure(candidats[mid].ids, b).moy >= cible) lo = mid; else hi = mid - 1; } }
      const i0 = lo;
      // Variété : parmi les voisines de la frontière (force à ±8 %), celles dont les espèces sont vues le
      // moins récemment ; jamais la même équipe que les 2 étapes précédentes.
      const precedentes = [T[l - 2], T[l - 3]].filter(Boolean).map((x) => x.split('@')[0]);
      const recence = (ids) => ids.reduce((t, id) => t + Math.min(30, l - (vuA[id] || -100)), 0) / ids.length;
      const f0 = candidats[i0].f;
      // Voisinage élargi tant qu'il reste moins de 3 équipes (MESURÉ : chapitre 1, l'apprentissage ne
      // laissait qu'Aquamira à ±8 % → 6 étapes sur 10 contre elle).
      let voisines = [];
      for (let v = VOISINAGE; voisines.length < 3 && v <= 8 * VOISINAGE; v *= 2) {
        voisines = candidats.filter((e) => Math.abs(Math.log(e.f / f0)) <= v && !precedentes.includes(e.ids.join('+')));
      }
      voisines = voisines.sort((x, y) => recence(y.ids) - recence(x.ids) || Math.abs(x.f - f0) - Math.abs(y.f - f0)).slice(0, MESUREES);
      if (!voisines.includes(candidats[i0]) && !precedentes.includes(candidats[i0].ids.join('+'))) voisines.push(candidats[i0]);
      let choix = null;
      voisines.forEach((e) => { const m = mesure(e.ids, b);
        const ecart = Math.abs(m.moy - cible) + (m.moy < cible ? 0.05 : 0); // à écart égal, le côté facile
        if ((!choix || ecart < choix.ecart - 1e-9) && secours(e.ids, b)) choix = { ...e, ...m, ecart }; });
      // Aucune voisine ne passe la garde « jamais bloqué » : on descend vers plus facile jusqu'à une qui passe.
      for (let i = i0; !choix && i >= 0; i--) if (!precedentes.includes(candidats[i].ids.join('+')) && secours(candidats[i].ids, b)) choix = { ...candidats[i], ...mesure(candidats[i].ids, b), ecart: 1 };
      for (let i = i0; !choix && i >= 0; i--) if (secours(candidats[i].ids, b)) choix = { ...candidats[i], ...mesure(candidats[i].ids, b), ecart: 1 };
      if (!choix) choix = { ...candidats[0], ...mesure(candidats[0].ids, b), ecart: 1 };
      T[l - 1] = entree(choix.ids, b);
      choix.ids.forEach((id) => { vuA[id] = l; });
      const app = l <= APPRENTISSAGE.niveaux ? tauxDebutant(l).pire : null;
      lignes.push({ l, boss, cible, elite: b, niveau: nivBase + b, evo: K.evoPourNiveau(nivBase + b), ids: choix.ids,
        raretes: choix.ids.map((id) => PAR_ID[id].rarity), moy: choix.moy, med: choix.med, p10: choix.p10, app });
      const pw = actifs.map((j) => K.puissanceDeck(j.trio().map((p) => ({ creature: p.c, ownedLevel: p.niv, evolutionTier: p.evo, equippedRunes: [] })))).sort((x, y) => x - y);
      puissances.push(pw[Math.floor(pw.length * CENTILE)]); // la « puissance conseillée » = celle du joueur visé
      actifs.forEach((j) => { const s0 = stats[joueurs.indexOf(j)], c0 = s0.combats, v0 = s0.victoires;
        j.jouer(l, 1, s0); if (j.bloque) bloques.push(l);
        if (l > APPRENTISSAGE.niveaux) { const k = compte[joueurs.indexOf(j)]; k.c += s0.combats - c0; k.v += s0.victoires - v0; } });
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

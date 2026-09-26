'use strict';
// ════════════════════════════════════════════════════════════════════
//  LE PARCOURS COMPLET D'UN JOUEUR GRATUIT — de l'A0 à l'A5
// ════════════════════════════════════════════════════════════════════
//
//   NODE_PATH=<dossier avec @babel/core> node mobile/tools/simulateur-parcours.js [joueurs]
//
// Demandé par l'auteur le 26/09 : « j'ai peur qu'il y ait des bugs
// dangereux » — un joueur BLOQUÉ pour de bon. Ce simulateur joue la partie
// entière d'un joueur gratuit et mesure, Ascension par Ascension : les
// victoires sur 10, le retard de ses créatures, le temps, ses Griffes, les
// déclenchements du filet de sécurité — et il signale tout joueur bloqué.
//
// Ce qu'il joue (décisions de l'auteur du 26/09) :
//   - œufs au rythme des défis d'Aventure CORRIGÉS (5 en 5 + « ton niveau
//     + 5 ») : fin A0 niv 15, A1 40, A2 65, A3 90, A4 115, A5 140 ;
//   - vrais tirages d'œufs ; nouvelles créatures à 80 % du niveau de la
//     meilleure ;
//   - Griffes : prime de 1re victoire seulement (aucune en rejouant),
//     réglage A ; succès, quêtes par jour, Ascensions, 3 packs contre
//     pièces par Ascension (100 + 75 par Ascension) ;
//   - dépenses : monter le meilleur trio (la plus basse d'abord, évolutions
//     à 25 et 50), 3 runes par Ascension ;
//   - VRAIS combats (`simulerCombat`, la boucle du jeu, sorts compris) ;
//   - énergie : 5 max, +1 / 20 min, 12 h de jeu par jour ;
//   - filet de sécurité : 5 défaites de suite sur un niveau → ennemis −20 %,
//     7 → −40 %, ce niveau seulement, remis à zéro par la victoire.
//
// ⚠️ Hypothèses (à recaler avec les tests de l'auteur) : succès répartis
// par Ascension selon le modèle mesuré le 26/09 ; runes sans effet en
// combat ; le joueur ne gaspille jamais d'énergie pendant ses 12 h.
const A = require('./audit-quetes.js');
const K = A.load('combatLogic');
const L = A.load('clickerLogic');
const C = A.C;

// Le rythme de l'Aventure LU DANS LES DÉFIS (26/09) — une seule source :
// le niveau d'Aventure attendu à la fin de chaque œuf (les victoires
// demandées font avancer d'autant, les défis d'Aventure fixent le niveau).
// ⚠️ MESURÉ : l'ancienne constante (15 / 40 / … / 140) ignorait les
// victoires ; le vrai rythme va bien plus loin.
function niveauxDesOeufs() {
  const D = A.load('defisEcrits');
  let E = 0;
  return D.DEFIS_ECRITS.map((oeuf) => { oeuf.forEach((d) => {
    if (d.metric === 'battleWon') E += d.target;
    if (d.metric === 'advLevelReached') E = Math.max(E, d.target);
  }); return E; });
}
const NIVEAUX_OEUFS = niveauxDesOeufs();
const OEUFS_PAR_ASC = A.load('defisEcrits').OEUFS_PAR_GROUPE;
const FIN_OEUF = OEUFS_PAR_ASC.map((n, a) => OEUFS_PAR_ASC.slice(0, a + 1).reduce((x, y) => x + y, 0));

const REGLAGES = {
  // ⚠️ 26/09 : le JEU fait naître les créatures au niveau 1 (ClickerScreen,
  // addCreatureToOwned) — la « naissance à 80 % » n'a jamais été codée ; le
  // simulateur la supposait à tort. Aligné sur le jeu (0 → niveau 1).
  naissance: 0,
  oeufsParAsc: OEUFS_PAR_ASC,
  niveauxOeufs: NIVEAUX_OEUFS,
  finsAventure: FIN_OEUF.map((k) => NIVEAUX_OEUFS[k - 1]),
  // ⚠️ 26/09 (3e test de l'auteur, bloqué au chapitre 2 niveau 3 avec 2
  // créatures) : le joueur de RÉFÉRENCE n'achète PAS de packs contre pièces
  // (l'auteur ne les a pas utilisés ; ce sont des bonus, pas une obligation)
  // et il a UN ŒUF DE RETARD : les autres défis de l'œuf (clicker) prennent
  // du temps — l'auteur n'avait que 2 créatures au niveau 13, le simulateur
  // 3 (œuf 3 éclos dès le niveau 9). Ses 3 runes par Ascension restent
  // achetées : les Griffes doivent suffire aux runes ET aux niveaux.
  packsParAsc: 0,
  retardOeufs: 1,
  taillePack: (a) => 100 + 75 * a,
  runesParAsc: 3, // 1 pour le défi + 2 volontaires
  prixRune: 100,
  succesParAsc: [175, 260, 760, 1545, 500, 600], // modèle mesuré le 26/09
  // Quêtes : le calendrier (≈ 39/jour) est fixe ; les quêtes du jour et de
  // la semaine (≈ 276/jour au niveau 25) suivent le niveau d'Aventure — la
  // règle DU JEU (combatLogic.facteurQuetes).
  quetesDuJour: (niv) => 39 + 276 * K.facteurQuetes(niv),
  heuresJeuParJour: 12,
  energieMax: 5,
  energieParHeure: 3,
  garantie: true, // GARANTIE_OEUFS (clickerLogic)
  blocage: 30, // défaites de suite sur un même niveau = joueur BLOQUÉ
  // La prime de 1re victoire DU JEU (combatLogic.griffesReward, réglage A).
  prime: (l) => K.griffesReward(l),
};

const aleaGraine = (g) => { let a = g >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const RANG = L.ORDRE_RARETES;
const evoPour = (niv) => (niv >= 50 ? 2 : niv >= 25 ? 1 : 0);
const coutEvo = (de, a) => (a >= 1 && de < 1 ? K.EVOLUTION_GRIFFES_COST[1] : 0) + (a >= 2 && de < 2 ? K.EVOLUTION_GRIFFES_COST[2] : 0);

// ---- UN joueur gratuit, pas à pas (utilisé par le simulateur ET par le
// calibrage : une seule définition du joueur, comme une seule boucle de
// combat). `k` : le multiplicateur des ennemis du niveau joué.
function nouveauJoueur(graine, R = REGLAGES) {
  const alea = aleaGraine(graine);
  const possedees = [];
  const j = { alea, griffes: 0, niveau: 0, heures: 0, energie: R.energieMax, dernierJour: 0, serie: {}, oeufsFaits: 0, runes: 0, parAsc: [], bloque: null };
  const avecGraine = (fn) => { const sauve = Math.random; Math.random = alea; try { return fn(); } finally { Math.random = sauve; } };
  j.trio = () => possedees.slice().sort((x, y) => RANG.indexOf(y.c.rarity) - RANG.indexOf(x.c.rarity) || y.niv - x.niv).slice(0, 3);
  const eclore = () => {
    if (possedees.length >= C.CREATURES.length) return;
    const meilleur = possedees.length ? Math.max(...possedees.map((p) => p.niv)) : 1;
    const ids = possedees.map((p) => p.c.id);
    const c = avecGraine(() => L.rollCreature(ids, L.rareteMaxPourOeuf(ids.length), R.garantie ? L.rareteGarantiePourOeuf(ids) : null));
    const niv = possedees.length ? Math.max(1, Math.round(R.naissance * meilleur)) : 1;
    possedees.push({ c, niv, evo: evoPour(niv) });
  };
  const monter = () => {
    for (let n = 0; n < 500; n++) {
      const t = j.trio().sort((x, y) => x.niv - y.niv)[0];
      // ⚠️ 26/09 : AUCUN plafond (le jeu n'en a pas) — le vrai joueur dépense
      // tout (test de l'auteur : Terracroc niveau 59 au niveau 26). L'ancien
      // plafond « niveau d'Aventure + 1 » cachait 19 000 Griffes non dépensées.
      if (!t) return;
      const cout = L.levelUpCost(t.c, t.niv) + coutEvo(t.evo, evoPour(t.niv + 1));
      if (cout > j.griffes) return;
      j.griffes -= cout; t.niv += 1; t.evo = Math.max(t.evo, evoPour(t.niv));
    }
  };
  const avancerTemps = (h) => {
    j.heures += h;
    const jour = Math.floor(j.heures / R.heuresJeuParJour);
    while (j.dernierJour < jour) { j.griffes += R.quetesDuJour(j.niveau); j.dernierJour += 1; }
  };
  j.joueurs = () => j.trio().map((p) => ({ creature: p.c, stats: K.combatStatsForCreatureTyped(p.c, p.niv, p.evo, []) }));
  j.adversaires = (l, k, baisse = 0) => K.opponentTeamForLevel(l).map((c) => { const st = K.statsForOpponentCreatureTyped(c, l, k);
    return { creature: c, stats: { ...st, hp: Math.max(1, Math.round(st.hp * (1 - baisse))), attack: Math.max(1, st.attack * (1 - baisse)) } }; });
  // Avant le niveau l de l'Ascension a : œufs, revenus répartis, runes, montées.
  j.preparer = (l, a) => {
    const debut = a ? R.finsAventure[a - 1] : 0, fin = R.finsAventure[a];
    // L'œuf k éclôt dès que le niveau exigé par SES défis est franchi.
    // Un œuf de retard (R.retardOeufs) ; en fin d'Ascension, tous ses œufs
    // sont éclos (l'Ascension les exige).
    const vise = l >= fin ? R.niveauxOeufs.filter((n) => n <= fin).length
      : Math.max(1, R.niveauxOeufs.filter((n) => n < l).length - (R.retardOeufs || 0));
    while (j.oeufsFaits < vise) { eclore(); j.oeufsFaits++; }
    j.griffes += (R.succesParAsc[a] + R.packsParAsc * R.taillePack(a)) / (fin - debut);
    if (l === debut + 1) j.runes = 0;
    if (j.runes < R.runesParAsc && j.griffes >= R.prixRune) { j.griffes -= R.prixRune; j.runes++; }
    monter();
  };
  // Jouer le niveau l jusqu'à la victoire (énergie, filet de sécurité), ou le blocage.
  j.jouer = (l, k, s) => {
    for (;;) {
      if (j.energie <= 0) { avancerTemps(1 / R.energieParHeure); j.energie += 1; }
      j.energie -= 1; s.combats += 1;
      const d = j.serie[l] || 0;
      const baisse = K.baisseFilet(d); // le filet DU JEU (combatLogic)
      if (baisse >= 0.6) s.filet10++; else if (baisse >= 0.4) s.filet7++; else if (baisse > 0) s.filet5++;
      const r = K.simulerCombat(j.joueurs(), j.adversaires(l, k, baisse), { alea, politique: K.choixJoueur });
      if (r.gagne) { s.victoires += 1; j.niveau = l; j.serie[l] = 0; j.griffes += R.prime(l); monter(); return true; }
      j.serie[l] = d + 1;
      if (j.serie[l] >= R.blocage) { s.bloque = l; j.bloque = l; return false; }
    }
  };
  j.finAscension = (a, s) => {
    j.griffes += a < 5 ? L.ascensionGriffesReward(a + 1) : 0;
    const t = j.trio();
    s.retard = t.length ? j.niveau - t.reduce((x, p) => x + p.niv, 0) / t.length : 0;
    s.griffes = Math.round(j.griffes);
    s.jours = (j.heures - s.heures0) / R.heuresJeuParJour;
    j.parAsc.push(s);
  };
  j.nouvelleAsc = (a) => ({ a, combats: 0, victoires: 0, filet5: 0, filet7: 0, filet10: 0, bloque: null, heures0: j.heures });
  return j;
}

// Le parcours complet d'un joueur, avec la table d'ennemis du jeu (ou `kDe`).
function parcoursJoueur(graine, R = REGLAGES, kDe = (l) => K.multiplicateurAventure(l)) {
  const j = nouveauJoueur(graine, R);
  for (let a = 0; a < 6 && !j.bloque; a++) {
    const s = j.nouvelleAsc(a);
    for (let l = (a ? R.finsAventure[a - 1] : 0) + 1; l <= R.finsAventure[a] && !j.bloque; l++) { j.preparer(l, a); j.jouer(l, kDe(l), s); }
    j.finAscension(a, s);
  }
  return j.parAsc;
}

function synthese(joueurs = 60, R = REGLAGES, kDe) {
  const tous = [];
  for (let j = 0; j < joueurs; j++) tous.push(parcoursJoueur(1000 + j * 7919, R, kDe));
  const lignes = [];
  for (let a = 0; a < 6; a++) {
    const v = tous.map((p) => p[a]).filter(Boolean);
    const moy = (f) => v.reduce((x, s) => x + f(s), 0) / Math.max(1, v.length);
    lignes.push({ a, joueurs: v.length, bloques: v.filter((s) => s.bloque).length,
      victoiresSur10: 10 * moy((s) => s.victoires / Math.max(1, s.combats)), retard: moy((s) => s.retard),
      combats: moy((s) => s.combats), jours: moy((s) => s.jours), filet5: moy((s) => s.filet5), filet7: moy((s) => s.filet7), filet10: moy((s) => s.filet10), griffes: moy((s) => s.griffes),
      victoires10eCentile: (() => { const q = v.map((s) => 10 * s.victoires / Math.max(1, s.combats)).sort((x, y) => x - y); return q[Math.floor(q.length * 0.1)] || 0; })() });
  }
  return lignes;
}
module.exports = { REGLAGES, nouveauJoueur, parcoursJoueur, synthese, niveauxDesOeufs };

if (require.main === module) {
  const n = Number(process.argv[2]) || 60;
  const t0 = Date.now();
  const res = synthese(n);
  console.log('Asc | joueurs | bloqués | victoires/10 | retard (niv) | combats | jours | filet 5 | filet 7 | Griffes en fin');
  res.forEach((r) => console.log('A' + r.a + '  | ' + String(r.joueurs).padStart(7) + ' | ' + String(r.bloques).padStart(7) + ' | '
    + r.victoiresSur10.toFixed(1).padStart(12) + ' | ' + r.retard.toFixed(1).padStart(12) + ' | ' + Math.round(r.combats).toString().padStart(7)
    + ' | ' + r.jours.toFixed(1).padStart(5) + ' | ' + r.filet5.toFixed(2).padStart(7) + ' | ' + r.filet7.toFixed(2).padStart(7) + ' | ' + Math.round(r.griffes)));
  console.log('(' + n + ' joueurs, ' + Math.round((Date.now() - t0) / 1000) + ' s)');
}

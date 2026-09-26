'use strict';
// ════════════════════════════════════════════════════════════════════
//  SIMULATEUR DE L'AVENTURE — quel niveau de deck pour quel niveau ?
// ════════════════════════════════════════════════════════════════════
//
//   NODE_PATH=<dossier avec @babel/core> node mobile/tools/simulateur-aventure.js
//
// Demande de l'auteur (24/09) : « comment bien mesurer ? faire le même
// principe que le Gardien, je ne peux pas tout tester sans péter un
// plomb ». On rejoue des milliers de combats avec les FONCTIONS DU JEU
// (combatLogic : dégâts du joueur, encaissement, compétences, éléments,
// équipes et stats adverses), la boucle reproduisant CombatScreen :
//   - le joueur frappe sa cible (la première vivante) ; spéciale à mana
//     pleine, sinon sa meilleure compétence ; tap au rythme de l'auteur ;
//   - la cible riposte si elle vit, sinon la première adverse vivante ;
//     compétence tirée au hasard parmi celles payables ;
//   - la mana adverse est GARDÉE (bug corrigé le 24/09 : elle ne l'était
//     pas, les adversaires ne lançaient jamais leur spéciale) ;
//   - 50 % de chances que la cible frappe en premier ; rotation de
//     l'équipe à chaque tour (+1 mana à la créature qui entre).
// Sans runes (le deck « nu ») : un joueur équipé fait mieux.
const A = require('./audit-quetes.js');
const K = A.load('combatLogic');
const C = A.C;

function aleaGraine(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const evoPour = (niv) => (niv >= 50 ? 2 : niv >= 25 ? 1 : 0); // deck optimisé : évolué dès que possible

function combattants(membres) {
  return membres.map((m) => {
    const stats = K.combatStatsForCreatureTyped(m.creature, m.level, evoPour(m.level), []);
    const skills = m.creature.skills || [];
    return { creature: m.creature, stats, hp: stats.hp, mana: K.MANA_DEPART, resilienceUsed: false, etats: {},
      meilleure: skills.filter((k) => !k.special).sort((a, b) => b.damage - a.damage)[0],
      speciale: skills.find((k) => k.special) || null,
      taps: K.effectiveTapCount(stats.clickSpeed, stats.tapReductionPct || 0) };
  });
}

// `humain` : compétence régulière tirée au hasard (un joueur ne choisit pas
// toujours la meilleure). Renvoie { gagne, tours }.
function combatAventureDetail(membres, niveau, alea, tapsParSec = 6.7, humain = false) {
  const f = combattants(membres);
  const o = K.opponentTeamForLevel(niveau).map((c) => {
    const stats = K.statsForOpponentCreatureTyped(c, niveau);
    return { creature: c, stats, hp: stats.hp, mana: K.MANA_DEPART, etats: {} };
  });
  // Règles du MOTEUR PARTAGÉ (combatLogic), les mêmes que l'écran.
  const vivantF = (i) => K.prochainVivant(f, i);
  const cibleO = () => K.premierVivant(o);
  let tour = 0;
  // Le tour ennemi du MOTEUR (sorts compris, étape 4) ; les coups passent
  // par `frapper` × Fureur, comme l'écran.
  const riposte = (oi, fi, fureur = 1) => {
    const a = K.actionAdversaire(o, oi, f, fi, alea);
    a.adversaires.forEach((x, i) => { o[i] = x; });
    a.joueurs.forEach((x, i) => { f[i] = x; });
    let rip = o[oi];
    a.degats.forEach((d, i) => {
      if (d > 0) { const x = K.frapper(rip, f[i], d * fureur, i === fi); rip = x.attaquant; f[i] = x.defenseur; }
    });
    o[oi] = rip;
  };
  let act = 0;
  if (alea() < 0.5) { riposte(0, act); if (f[act].hp <= 0) { act = vivantF(act); if (act < 0) return { gagne: false, tours: 0 }; } }
  for (let tour = 0; tour < 600; tour++) {
    const x = f[act];
    const spe = x.speciale && x.mana >= C.MANA_MAX ? x.speciale : null;
    const regs = (x.creature.skills || []).filter((k) => !k.special);
    const comp = spe || (humain ? regs[Math.floor(alea() * regs.length)] : x.meilleure);
    if (spe) x.mana -= spe.manaCost || C.MANA_MAX;
    // Comme l'écran : un ennemi qui provoque impose la cible ; le coup passe
    // par `frapper` (marque, provocation, venin qui empoisonne).
    const t = K.cibleDuJoueur(o, cibleO());
    const coupJ = K.frapper(x, o[t], K.degatsDuJoueur(comp, x, o[t].creature, x.taps / tapsParSec, true));
    f[act] = coupJ.attaquant;
    o[t] = coupJ.defenseur;
    const r = K.choisirRiposteur(o, t);
    if (r < 0) return { gagne: true, tours: tour + 1 };
    tour += 1;
    riposte(r, K.cibleDeRiposte(f, act), K.multiplicateurFureur(tour));
    K.finDeTour(f).equipe.forEach((y, i) => { f[i] = y; });
    K.finDeTour(o).equipe.forEach((y, i) => { o[i] = y; });
    if (cibleO() < 0) return { gagne: true, tours: tour + 1 };
    const nx = vivantF(act);
    if (nx < 0) return { gagne: false, tours: tour + 1 };
    act = nx;
    f[act].mana = Math.min(C.MANA_MAX, f[act].mana + C.MANA_PER_TURN);
  }
  return { gagne: false, tours: 600 };
}
function combatAventure(membres, niveau, alea, tapsParSec = 6.7) {
  return combatAventureDetail(membres, niveau, alea, tapsParSec).gagne;
}

// Niveau de deck (3 créatures) pour gagner au moins `seuil` des combats.
function niveauRequis(trio, niveau, seuil = 2 / 3, essais = 200) {
  const taux = (L) => { const alea = aleaGraine(niveau * 1000 + L); let g = 0;
    for (let i = 0; i < essais; i++) if (combatAventure(trio.map((c) => ({ creature: c, level: L })), niveau, alea)) g++;
    return g / essais; };
  let lo = 1, hi = 200;
  if (taux(hi) < seuil) return null;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (taux(mid) >= seuil) hi = mid; else lo = mid + 1; }
  return lo;
}

module.exports = { combatAventure, combatAventureDetail, niveauRequis };

if (require.main === module) {
  const trios = (rar) => { const p = C.CREATURES.filter((c) => c.rarity === rar); return [0, 1, 2].map((k) => [0, 1, 2].map((i) => p[(k * 3 + i) % p.length])); };
  const med = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const NIV = [1, 5, 10, 15, 20, 25, 30, 35, 40];
  const table = {};
  for (const rar of ['rare', 'epique']) table[rar] = NIV.map((n) => med(trios(rar).map((t) => niveauRequis(t, n))));
  console.log('Aventure niv : ' + NIV.map((n) => String(n).padStart(4)).join(''));
  for (const rar of ['rare', 'epique']) console.log(('deck ' + rar + 's').padEnd(14) + table[rar].map((x) => String(x == null ? '>200' : x).padStart(4)).join(''));
  process.stdout.write('__TABLE__' + JSON.stringify({ NIV, table }) + '\n');
}

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

// ⚠️ Depuis l'étape 5 des sorts (24/09) : la boucle UNIQUE du moteur
// (`simulerCombat`, la même que le calibrage du Gardien), joueur sensé
// (`choixJoueur`, sorts compris). Plus de boucle recopiée ici.
// `humain` : un joueur qui tape moins vite et choisit ses attaques normales
// au hasard (il lance quand même sorts et spéciale).
function politiqueHumaine(J, act, A, cible, estBoss) {
  const c = K.choixJoueur(J, act, A, cible, estBoss);
  if (c.sort || (c.competence && c.competence.special)) return c;
  const regs = (J[act].creature.skills || []).filter((k) => !k.special);
  return { competence: regs[Math.floor(Math.random() * regs.length)] };
}
function combatAventureDetail(membres, niveau, alea, tapsParSec = 6.7, humain = false) {
  const joueurs = membres.map((m) => ({ creature: m.creature,
    stats: K.combatStatsForCreatureTyped(m.creature, m.level, evoPour(m.level), []) }));
  const adversaires = K.opponentTeamForLevel(niveau).map((c) => ({ creature: c, stats: K.statsForOpponentCreatureTyped(c, niveau) }));
  return K.simulerCombat(joueurs, adversaires, { tapsParSec, alea, politique: humain ? politiqueHumaine : K.choixJoueur });
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

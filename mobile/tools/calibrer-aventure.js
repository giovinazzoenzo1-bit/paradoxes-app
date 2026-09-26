'use strict';
// ════════════════════════════════════════════════════════════════════
//  CALIBRER L'AVENTURE — la table AVENTURE_MULTIPLICATEURS
// ════════════════════════════════════════════════════════════════════
//
//   NODE_PATH=<dossier avec @babel/core> node mobile/tools/calibrer-aventure.js [--ecrire]
//
// Décision de l'auteur (24/09) : « au niveau N de l'Aventure, des créatures
// d'environ niveau N pour gagner 2 combats sur 3 ». Pour chaque niveau N,
// on cherche (dichotomie logarithmique) le multiplicateur des PV et de
// l'attaque adverses avec lequel le deck de RÉFÉRENCE de niveau N gagne
// 2 combats sur 3, joué par `choixJoueur` (joueur sensé, sorts des deux
// côtés), dans la boucle UNIQUE (`simulerCombat`). Médiane sur 3 decks.
//
// Decks de référence (le joueur n'a pas 3 créatures dès le début) :
//   la COLLECTION d'un nouveau joueur : 1 créature aux niveaux 1-2, 2 aux
//   niveaux 3-6 (1re heure, un œuf toutes les ~30 min), 3 dès le 7 ;
//   TOUJOURS 2 rares et 1 épique ; évolutions à 25 et 50 (deck optimisé).
// ⚠️ MESURÉ au 3e essai : « 1 créature puis 3 dès le niveau 4 » faisait
// un saut ×2,5 -> ×8,7 au niveau 4 — un mur pour qui n'a que 2 créatures.
// ⚠️ MESURÉ au 2e essai : un palier « 2 créatures » (niveaux 4-8) créait
// un MUR au niveau 9 (×4,2 -> ×10,75) — or un joueur a 3 créatures bien
// avant le niveau 9 (plusieurs œufs par heure, l'Aventure est limitée par
// l'énergie).
// ⚠️ MESURÉ au 1er essai : changer la rareté des decks au niveau 11 (pile
// où les ennemis passent à 2) faisait sauter la table de ×3,9 à ×13,8 — un
// vrai joueur ne progresse pas par à-coups. 5 decks × 400 combats,
// médiane.
// ⚠️ PAS DE LISSAGE entre niveaux — MESURÉ au 4e essai : chaque niveau a
// SES adversaires (créatures, éléments, types) ; les écarts entre niveaux
// voisins sont réels, pas du bruit. Lissée, la table déréglait des niveaux
// précis (niveau 5 : 98 % de victoires, niveau 10 : 35 %). Chaque niveau
// garde sa valeur : c'est le RESSENTI (≈ 2 sur 3 partout) qui est lisse.
// `--ecrire` : remplace la table dans combatLogic.js.
const fs = require('fs');
const path = require('path');
const A = require('./audit-quetes.js');
const K = A.load('combatLogic');
const C = A.C;

const aleaGraine = (g) => { let a = g >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pool = (r) => C.CREATURES.filter((c) => c.rarity === r);
const evoPour = (n) => (n >= 50 ? 2 : n >= 25 ? 1 : 0);
function decksDeReference(n) {
  const taille = n <= 2 ? 1 : n <= 6 ? 2 : 3;
  const rar = ['rare', 'rare', 'epique'];
  return [0, 1, 2, 3, 4].map((v) => rar.slice(0, taille).map((r, i) => { const p = pool(r); return p[(v * 3 + i) % p.length]; }));
}
// `niveauDeck` : le niveau des créatures (par défaut celui de l'Aventure).
function tauxJoueur(deck, n, k, essais = 400, niveauDeck = n) {
  const joueurs = deck.map((c) => ({ creature: c, stats: K.combatStatsForCreatureTyped(c, niveauDeck, evoPour(niveauDeck), []) }));
  const adv = K.opponentTeamForLevel(n).map((c) => ({ creature: c, stats: K.statsForOpponentCreatureTyped(c, n, k) }));
  const alea = aleaGraine(n * 7919 + deck.length);
  let g = 0;
  for (let i = 0; i < essais; i++) if (K.simulerCombat(joueurs, adv, { alea }).gagne) g++;
  return g / essais;
}
function calibrerNiveau(n) {
  const ks = decksDeReference(n).map((deck) => {
    let lo = Math.log(0.3), hi = Math.log(60);
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (tauxJoueur(deck, n, Math.exp(mid)) > 2 / 3) lo = mid; else hi = mid; }
    // Le côté FACILE (le joueur y gagne plus de 2 fois sur 3), comme pour le
    // Gardien : MESURÉ, le milieu de l'intervalle tombait parfois à 49 %
    // (réponse en marches : PV et attaque arrondis).
    return Math.exp(lo);
  }).sort((a, b) => a - b);
  return ks[Math.floor(ks.length / 2)]; // médiane
}
module.exports = { decksDeReference, tauxJoueur, calibrerNiveau };

if (require.main === module) {
  const t0 = Date.now();
  const table = [];
  for (let n = 1; n <= 40; n++) table.push(Math.round(calibrerNiveau(n) * 100) / 100);
  console.log('table (niveaux 1 à 40) : ' + table.join(', '));
  console.log('calcul : ' + Math.round((Date.now() - t0) / 1000) + ' s');
  if (process.argv.includes('--ecrire')) {
    const p = path.join(__dirname, '../src/games/clicker/combatLogic.js');
    const s = fs.readFileSync(p, 'utf8');
    const a = /export const AVENTURE_MULTIPLICATEURS = [^;]*;[^\n]*/;
    if (!a.test(s)) throw new Error('table introuvable dans combatLogic.js');
    fs.writeFileSync(p, s.replace(a, 'export const AVENTURE_MULTIPLICATEURS = [\n  ' + table.join(', ') + ',\n];'), 'utf8');
    console.log('écrit dans combatLogic.js');
  }
}

// ════════════════════════════════════════════════════════════════════
//  MINI-JEUX — logique pure (décisions de l'auteur), contrôlée par auditChasseLueurs
// ════════════════════════════════════════════════════════════════════
// ✨ CHASSE AUX LUEURS (idée de l'auteur) : une lueur errante passe sur l'écran principal toutes les 30 min environ ; la
// toucher lance le jeu — titre, décompte 3, 2, 1, puis 15 lueurs, une à la fois, à toucher avant qu'elles s'éteignent.
// UNE seule ratée : « PERDU » en rouge 1 s, écran qui tremble, son de défaite, pas de récompense. Pas de compteur.
// RÉCOMPENSE de TOUT mini-jeu (règle de l'auteur) : 80 % les Griffes d'UN niveau de sa meilleure créature, 15 % Tap ×2,
// 5 % Diamants. JAMAIS de pièces (les défis « Obtiens N pièces » et la porte d'Ascension resteraient faussés).
import { CREATURES, levelUpCost } from './clickerLogic';

// Demande de l'auteur (après essai) : 20 lueurs, et chacune s'éteint 0,01 s plus vite (1,4 → 1,39 s ; 0,8 → 0,79 s).
export const LUEURS_NB = 20;
export const LUEUR_DUREE_DEBUT_MS = 1390; // la 1re lueur
export const LUEUR_DUREE_FIN_MS = 790;    // la 20e
// Demande de l'auteur : les lumières BOUGENT dans tous les mini-jeux (jamais statiques) — dérive en ligne droite.
export const LUEUR_DERIVE_PX = 140;      // distance parcourue au plus pendant sa vie
// ⚠️ Décision de l'auteur : le joueur ne CHOISIT pas ses mini-jeux — un mini-jeu au hasard SURGIT tout seul toutes les 10 min
// sur l'écran principal (s'il est ailleurs ou dans une fenêtre, le mini-jeu attend son retour), jamais dans les 2 min qui
// suivent l'ouverture de l'appli. (Avant : une lueur errante toutes les 30 min, à toucher pour jouer.)
export const MINI_JEU_INTERVALLE_MS = 10 * 60 * 1000;
export const MINI_JEU_DELAI_OUVERTURE_MS = 2 * 60 * 1000;
export const PERDU_MS = 1000;
export const DECOMPTE = ['3', '2', '1', 'GO !'];
export const DECOMPTE_PAS_MS = 700;

export function dureeLueur(i) {
  const k = Math.max(0, Math.min(LUEURS_NB - 1, Math.floor(Number(i) || 0)));
  return Math.round(LUEUR_DUREE_DEBUT_MS + (LUEUR_DUREE_FIN_MS - LUEUR_DUREE_DEBUT_MS) * (k / (LUEURS_NB - 1)));
}

export const MINI_JEU_TIRAGE = { griffes: 0.80, boostTap: 0.15, diamants: 0.05 };
export const MINI_JEU_BOOST_MIN = 2;
export const MINI_JEU_DIAMANTS = 3;

// Griffes pour monter UNE fois la « meilleure » créature : celle dont le prochain niveau coûte le plus (niveau et rareté).
export function griffesMeilleureCreature(owned) {
  let meilleur = 0;
  (owned || []).forEach((o) => {
    const def = o && CREATURES.find((c) => c.id === o.id);
    if (!def) return;
    const cout = levelUpCost(def, Math.max(1, Number(o.level) || 1));
    if (Number.isFinite(cout) && cout > meilleur) meilleur = cout;
  });
  return Math.max(1, Math.round(meilleur || 10));
}

export function tirerRecompenseMiniJeu(owned, aleatoire = Math.random) {
  const x = aleatoire();
  if (x < MINI_JEU_TIRAGE.griffes) return { type: 'griffes', amount: griffesMeilleureCreature(owned) };
  if (x < MINI_JEU_TIRAGE.griffes + MINI_JEU_TIRAGE.boostTap) return { type: 'boostTap', minutes: MINI_JEU_BOOST_MIN };
  return { type: 'diamants', amount: MINI_JEU_DIAMANTS };
}

// ════════ Les mini-jeux et leur TUTO d'une seule phrase, affiché pendant le décompte (demande de l'auteur) ════════
export const MINI_JEUX = [
  { id: 'chasse', titre: '✨ Chasse aux Lueurs', tuto: "Touche les 20 lueurs avant qu'elles s'éteignent." },
  { id: 'doree', titre: '🎯 Lueur dorée', tuto: 'Touche seulement la lueur dorée, jamais les bleues.' },
  { id: 'transe', titre: '🥁 Battement de Transe', tuto: "Tape quand l'anneau touche le cercle, 3 ratés et c'est perdu." },
  { id: 'bonneteau', titre: "🥚 Bonneteau d'œufs", tuto: "Suis l'œuf qui cache la lueur, puis touche-le." },
  { id: 'roue', titre: '🌀 Roue des runes', tuto: 'Tape quand la rune dorée passe sous la flèche.' },
];
export function miniJeu(id) { return MINI_JEUX.find((j) => j.id === id) || MINI_JEUX[0]; }
// Le mini-jeu qui surgit est tiré au hasard.
export function choisirMiniJeu(aleatoire = Math.random) {
  return MINI_JEUX[Math.min(MINI_JEUX.length - 1, Math.floor(aleatoire() * MINI_JEUX.length))].id;
}

// 🎯 LUEUR DORÉE : 10 tours ; à chaque tour, des lueurs bleues (pièges) et UNE dorée. Toucher une bleue, ou laisser passer le
// temps : perdu. De 3 lueurs et 1,6 s au 1er tour, à 7 lueurs et 1 s au 10e.
export const DOREE_TOURS = 10;
export function doreeNbLueurs(i) { return 3 + Math.floor(Math.max(0, Math.min(DOREE_TOURS - 1, Number(i) || 0)) / 2); }
export function doreeDuree(i) {
  const k = Math.max(0, Math.min(DOREE_TOURS - 1, Math.floor(Number(i) || 0)));
  return Math.round(1600 + (1000 - 1600) * (k / (DOREE_TOURS - 1)));
}

// 🥁 BATTEMENT DE TRANSE : 16 temps ; un anneau se resserre sur le cercle, il faut taper quand il le touche (± 150 ms).
// Un temps manqué, ou un tap à contretemps, compte un raté ; 3 ratés : perdu. Le tempo accélère : 0,7 s → 0,5 s par temps.
export const TRANSE_TEMPS = 16;
export const TRANSE_FENETRE_MS = 150;
export const TRANSE_RATES_MAX = 3;
export function transeIntervalle(i) {
  const k = Math.max(0, Math.min(TRANSE_TEMPS - 1, Math.floor(Number(i) || 0)));
  return Math.round(700 + (500 - 700) * (k / (TRANSE_TEMPS - 1)));
}

// 🥚 BONNETEAU D'ŒUFS (demande de l'auteur : 3 manches, de facile à difficile) : la lueur se montre sous un des 3 œufs, puis
// ils se mélangent ; toucher le bon œuf. Un mauvais œuf : perdu. Manche 1 : 3 échanges lents ; 2 : 5 ; 3 : 8 rapides.
export const BONNETEAU_TOURS = 3;
export const BONNETEAU_ECHANGES = [3, 5, 8];
export const BONNETEAU_DUREES_MS = [480, 340, 230]; // durée d'UN échange
export const BONNETEAU_MONTRE_MS = 1200;           // la lueur se montre avant le mélange
export function bonneteauEchanges(i) { return BONNETEAU_ECHANGES[Math.max(0, Math.min(BONNETEAU_TOURS - 1, Math.floor(Number(i) || 0)))]; }
export function bonneteauDuree(i) { return BONNETEAU_DUREES_MS[Math.max(0, Math.min(BONNETEAU_TOURS - 1, Math.floor(Number(i) || 0)))]; }
// Une suite d'échanges entre deux PLACES différentes (0, 1, 2).
export function melangeBonneteau(n, aleatoire = Math.random) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = Math.floor(aleatoire() * 3);
    const b = (a + 1 + Math.floor(aleatoire() * 2)) % 3;
    out.push([a, b]);
  }
  return out;
}

// 🌀 ROUE DES RUNES (plan de l'auteur, étape 2) : les 8 runes du jeu tournent en roue, une seule est dorée ; taper quand elle
// passe sous la flèche (en haut). 5 réussites, de plus en plus vite, sens alterné ; un tap à côté = perdu ; la rune dorée
// passe 3 fois sans tap = perdu (pas d'attente infinie). Tolérance ± 22° : ± 0,18 s au 1er tour, ± 0,07 s au 5e.
export const ROUE_RUNES = 8;
export const ROUE_TOURS = 5;
export const ROUE_VITESSES = [120, 160, 200, 250, 300]; // degrés par seconde
export const ROUE_TOLERANCE_DEG = 22;
export const ROUE_PASSAGES_MAX = 3;
export function roueVitesse(i) { return ROUE_VITESSES[Math.max(0, Math.min(ROUE_TOURS - 1, Math.floor(Number(i) || 0)))]; }
// Angle de la roue (degrés, sens horaire depuis le haut) → la rune dorée est-elle sous la flèche ?
export function roueAligne(angleRoueDeg, indexDoree) {
  const a = (((Number(angleRoueDeg) || 0) + (360 / ROUE_RUNES) * (Number(indexDoree) || 0)) % 360 + 360) % 360;
  return Math.min(a, 360 - a) <= ROUE_TOLERANCE_DEG;
}

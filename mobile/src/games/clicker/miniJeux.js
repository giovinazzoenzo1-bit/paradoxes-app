// ════════════════════════════════════════════════════════════════════
//  MINI-JEUX — logique pure (décisions de l'auteur), contrôlée par auditChasseLueurs
// ════════════════════════════════════════════════════════════════════
// ✨ CHASSE AUX LUEURS (idée de l'auteur) : une lueur errante passe sur l'écran principal toutes les 30 min environ ; la
// toucher lance le jeu — titre, décompte 3, 2, 1, puis 15 lueurs, une à la fois, à toucher avant qu'elles s'éteignent.
// UNE seule ratée : « PERDU » en rouge 1 s, écran qui tremble, son de défaite, pas de récompense. Pas de compteur.
// RÉCOMPENSE de TOUT mini-jeu (règle de l'auteur) : 80 % les Griffes d'UN niveau de sa meilleure créature, 15 % Tap ×2,
// 5 % Diamants. JAMAIS de pièces (les défis « Obtiens N pièces » et la porte d'Ascension resteraient faussés).
import { CREATURES, levelUpCost } from './clickerLogic';

export const LUEURS_NB = 15;
export const LUEUR_DUREE_DEBUT_MS = 1400; // la 1re lueur
export const LUEUR_DUREE_FIN_MS = 800;    // la 15e (à régler après les essais de l'auteur)
export const LUEUR_ERRANTE_INTERVALLE_MS = 30 * 60 * 1000;
export const LUEUR_ERRANTE_PREMIERE_MS = 5 * 60 * 1000; // première partie : 5 min après l'arrivée, pour la découvrir
export const LUEUR_ERRANTE_VIE_MS = 60 * 1000;           // ignorée 60 s : elle s'en va
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

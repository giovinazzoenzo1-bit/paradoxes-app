// 🎓 TUTORIEL (validé par l'auteur le 21/10, après ses précisions) : à certains moments du jeu — pas tout de suite —, un
// REPÈRE montre où agir (le ROND doré qui tourne, ou le CARRÉ doré qui respire, avec des étoiles qui scintillent à part)
// et UNE phrase l'explique. Une toute petite croix ferme l'explication : un conseil ne peut JAMAIS bloquer le joueur.
// Chaque conseil n'apparaît qu'UNE fois par joueur (mémoire à part de la partie) : il ne revient pas après une Ascension.
// Les anciens joueurs (au moins une créature ou une Ascension au PREMIER chargement) ne les voient pas ;
// « Revoir les conseils » (Options) les remet à zéro — c'est aussi ainsi que l'auteur les teste.
// ⚠️ Leçon (copie du 20/10, jamais publiée) : un conteneur PLEIN ÉCRAN autour d'un conseil avalait tous les taps sur l'œuf.
// Le guide (components/GuideTuto.js) n'est fait QUE d'éléments posés à leur place ; seule la croix capte le doigt.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLE_TUTO = 'tuto:v2';

// Une phrase par conseil ; `forme` : le repère (rond = un bouton, un point ; carré = une zone).
export const ETAPES = {
  // Écran principal
  taper: { texte: 'Clique ici pour gagner des pièces !', forme: 'rond' },
  boutique: { texte: 'Clique ici pour ouvrir la boutique.', forme: 'rond' },
  defi: { texte: 'Accomplis ce défi pour faire avancer ton œuf.', forme: 'carre' },
  // 21/10 (auteur) : la 1re cible dorée arrive 10 s après le Pacte, FIGÉE en haut à droite de l'œuf (elle n'expire pas).
  doree: { texte: 'Une cible dorée : touche-la pour un bonus !', forme: 'rond' },
  // 21/10 (auteur) : l'œuf qui éclot — chaque tap retire 1 seconde (incubatorLogic : TAP_REDUCTION_MS = 1000).
  eclosion: { texte: 'Ton œuf éclot : chaque tap retire 1 seconde !', forme: 'rond' },
  // Lot 2 (21/10, auteur) : l'œuf de l'INCUBATEUR, le 1er mini-boss (provoqué après l'éclosion, conseil au-dessus de lui),
  // les mini-jeux (après le mini-boss et ses Diamants), l'amélioration des créatures avec les Griffes.
  eclosionIncub: { texte: "Tape l'œuf : chaque tap retire 1 seconde d'éclosion !", forme: 'rond' },
  miniBoss: { texte: 'Brisecorne attaque : tape-le vite pour le vaincre !', forme: 'rond' },
  miniJeux: { texte: 'Des mini-jeux surgissent souvent : reste actif et réactif pour les gagner !', forme: 'info' },
  // 21/10 (auteur) : un vrai PALIER — rester 15 s en Transe (de quoi s'offrir 3 niveaux de Pacte ensuite).
  transe: { texte: "Tape sans t'arrêter : reste en Transe 15 secondes !", forme: 'rond' },
  creature: { texte: 'Ta première créature rejoint ton équipe ici !', forme: 'carre' }, // UNE phrase (le contrôle l'a vu)
  aventure: { texte: "Clique ici pour l'envoyer au combat !", forme: 'rond' },
  incubateur: { texte: 'Ton œuf éclot ici, tout seul.', forme: 'rond' },
  calendrier: { texte: "Ton cadeau du jour t'attend ici !", forme: 'rond' },
  ascension: { texte: 'Ta première Ascension est prête : ouvre la boutique !', forme: 'rond' },
  // Grimoire (boutique)
  // 21/10 (auteur) : 3 niveaux de Pacte avant de passer à la suite.
  pacte: { texte: 'Clique ici pour acheter 3 niveaux de Pacte et gagner encore plus de pièces !', forme: 'rond' },
  sceau: { texte: 'Clique ici pour faire ta première Ascension !', forme: 'rond' },
  // Aventure
  combat: { texte: 'Clique ici pour lancer ton premier combat !', forme: 'rond' },
  ameliorer: { texte: "Clique sur ta créature pour l'améliorer !", forme: 'rond' },
  monter: { texte: 'Améliore toujours tes créatures avec tes Griffes pour gagner tes combats !', forme: 'carre' },
  runes: { texte: 'Tu as assez de poudre : clique ici pour les runes !', forme: 'rond' },
  acheterRune: { texte: 'Clique ici pour fabriquer ta première rune !', forme: 'carre' },
  equiperRune: { texte: "Clique ici pour l'équiper sur une créature !", forme: 'carre' },
  // Combat
  attaque: { texte: 'Choisis une attaque.', forme: 'carre' },
  jauge: { texte: "Touche quand l'aiguille est dans l'or !", forme: 'carre' },
  gardien: { texte: "Brise d'abord son bouclier bleu, puis sa vie.", forme: 'carre' },
};

// Ordre de priorité de l'écran principal : UN conseil à la fois.
// 21/10 (auteur) : l'œuf (100 taps), PUIS la Transe (15 s), PUIS la boutique et le Pacte (3 niveaux), PUIS le défi…
// La cible dorée passe AVANT le défi : elle n'existe que pendant son conseil (sinon le carré du défi la cacherait).
export const ORDRE_ECRAN = ['taper', 'transe', 'boutique', 'doree', 'defi', 'eclosion', 'creature', 'miniJeux', 'aventure', 'incubateur', 'calendrier', 'ascension'];
// « Clique ici pour gagner des pièces » : 100 taps sur l'œuf avant le conseil suivant (auteur, 21/10 ; avant : 10).
export const TAPS_CONSEIL_TAPER = 100;
// « Reste en Transe » : 15 secondes d'affilée (auteur, 21/10).
export const TRANSE_CONSEIL_SEC = 15;
// « Achète le Pacte » : 3 niveaux avant de passer à la suite (auteur, 21/10).
export const PACTE_CONSEIL_NIVEAUX = 3;
// La 1re cible dorée du tuto — l'auteur a changé d'avis (21/10, soir) : 5 s après l'arrivée du DÉFI « Touche N fois la cible
// dorée » (le défi 5 du 1er œuf), une cible apparaît EXCEPTIONNELLEMENT, figée, en haut à droite de l'œuf (en % de sa zone).
// ⚠️ BUG RÉEL de la version d'avant (« plus aucune cible dorée depuis la mise à jour ») : elle BLOQUAIT toute cible au
// hasard jusqu'à celle du tuto, datée par la fin du conseil du Pacte — conseil fermé à la croix → jamais daté → plus
// AUCUNE cible, pour toujours. Désormais rien n'est bloqué : la cible du tuto s'ajoute, c'est tout.
export const DOREE_TUTO_DELAI_MS = 5 * 1000;
export const DOREE_TUTO_POS = { leftPct: 75, topPct: 25 };
// Les runes s'ouvrent après le 3ᵉ combat GAGNÉ (auteur, 21/10) : niveau débloqué ≥ 4.
export const RUNES_COMBATS_GAGNES = 3;
// Le 1er mini-boss est PROVOQUÉ « un peu après » l'éclosion de la 1re créature (auteur) : 20 s sur l'écran principal.
export const MINI_BOSS_TUTO_DELAI_MS = 20 * 1000;
// L'œuf de l'incubateur : le conseil s'en va après 5 taps (le joueur a compris « 1 tap = 1 seconde »).
export const TAPS_CONSEIL_INCUBATEUR = 5;
// Les conseils sans geste à faire (mini-jeux) s'en vont seuls après ce temps.
export const DUREE_CONSEIL_LONG_MS = 9000;
// La progression DANS la phrase, avant son « ! » final (« … pièces (37/100) ! ») : toujours une seule phrase.
export function avecCompteur(texte, n, total) {
  const t = String(texte || ''); const c = ` (${Math.max(0, Math.min(total, Math.floor(n)))}/${total})`;
  return / !$/.test(t) ? t.replace(/ !$/, c + ' !') : t + c;
}
// Les conseils qui ne demandent rien (« ta créature est ici ») s'en vont seuls après ce temps.
export const DUREE_CONSEIL_INFO_MS = 7000;
// Les runes s'expliquent quand le joueur a de quoi en fabriquer une (sa 3ᵉ poudre runique, demande de l'auteur).
export const POUDRE_CONSEIL_RUNES = 3;

export const TUTO_VIDE = { vus: [], passe: false, decide: false };
export const TUTO_REVOIR = { vus: [], passe: false, decide: true };

const abonnes = new Set();
export function abonnerTuto(fn) { abonnes.add(fn); return () => abonnes.delete(fn); }
export async function lireTuto() {
  try {
    const brut = await AsyncStorage.getItem(CLE_TUTO);
    const t = brut ? JSON.parse(brut) : null;
    return t && typeof t === 'object' ? { ...TUTO_VIDE, ...t, vus: Array.isArray(t.vus) ? t.vus : [] } : { ...TUTO_VIDE };
  } catch (e) {
    return { ...TUTO_VIDE };
  }
}
export async function ecrireTuto(t) {
  try { await AsyncStorage.setItem(CLE_TUTO, JSON.stringify(t)); } catch (e) { /* le conseil reviendra : sans gravité */ }
  abonnes.forEach((fn) => { try { fn(t); } catch (e) { /* abonné démonté */ } });
}
export function estVu(tuto, id) { return !!tuto && (tuto.vus || []).includes(id); }
export function tutoActif(tuto) { return !!tuto && tuto.decide && !tuto.passe; }
// Le conseil à montrer : le premier, dans l'ordre, dont la condition est vraie et qui n'a pas été vu.
export function choisirEtape(conditions, tuto, ordre) {
  if (!tutoActif(tuto)) return null;
  for (const id of ordre) if (!estVu(tuto, id) && conditions && conditions[id]) return id;
  return null;
}
export function marquerVu(tuto, id) {
  const vus = new Set((tuto && tuto.vus) || []);
  vus.add(id);
  return { ...TUTO_VIDE, ...(tuto || {}), vus: [...vus] };
}
// Marque un conseil vu et l'écrit (tous les écrans abonnés suivent).
export function vuEtape(tuto, id) {
  if (!tuto || estVu(tuto, id)) return tuto;
  const n = marquerVu(tuto, id);
  ecrireTuto(n);
  return n;
}
// Un ancien joueur (déjà une créature, ou déjà une Ascension) n'a pas besoin des conseils du début.
export function estVeteran({ creatures = 0, ascensions = 0 } = {}) {
  return creatures > 0 || ascensions > 0;
}
// Mesure d'une cible dans le repère d'un écran (sa RACINE) : les deux mesurées dans la fenêtre, puis soustraites.
export function mesurerCible(racine, cible, rappel) {
  if (!racine || !cible || !racine.measureInWindow || !cible.measureInWindow) return;
  racine.measureInWindow((rx, ry) => {
    cible.measureInWindow((x, y, l, h) => {
      if (l > 0 && h > 0) rappel({ x: Math.round(x - rx), y: Math.round(y - ry), l: Math.round(l), h: Math.round(h) });
    });
  });
}

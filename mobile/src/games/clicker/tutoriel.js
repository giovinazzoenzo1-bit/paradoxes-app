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
  doree: { texte: 'Touche-la vite pour un bonus !', forme: 'rond' },
  transe: { texte: "Tape sans t'arrêter : tes pièces sont multipliées !", forme: 'carre' },
  creature: { texte: 'Ta première créature rejoint ton équipe ici !', forme: 'carre' }, // UNE phrase (le contrôle l'a vu)
  aventure: { texte: "Clique ici pour l'envoyer au combat !", forme: 'rond' },
  incubateur: { texte: 'Ton œuf éclot ici, tout seul.', forme: 'rond' },
  calendrier: { texte: "Ton cadeau du jour t'attend ici !", forme: 'rond' },
  ascension: { texte: 'Ta première Ascension est prête : ouvre la boutique !', forme: 'rond' },
  // Grimoire (boutique)
  pacte: { texte: 'Clique ici pour acheter le Pacte et gagner encore plus de pièces !', forme: 'rond' },
  sceau: { texte: 'Clique ici pour faire ta première Ascension !', forme: 'rond' },
  // Aventure
  combat: { texte: 'Clique ici pour lancer ton premier combat !', forme: 'rond' },
  runes: { texte: 'Tu as assez de poudre : clique ici pour les runes !', forme: 'rond' },
  acheterRune: { texte: 'Clique ici pour fabriquer ta première rune !', forme: 'carre' },
  equiperRune: { texte: "Clique ici pour l'équiper sur une créature !", forme: 'carre' },
  // Combat
  attaque: { texte: 'Choisis une attaque.', forme: 'carre' },
  jauge: { texte: "Touche quand l'aiguille est dans l'or !", forme: 'carre' },
  gardien: { texte: "Brise d'abord son bouclier bleu, puis sa vie.", forme: 'carre' },
};

// Ordre de priorité de l'écran principal : UN conseil à la fois.
export const ORDRE_ECRAN = ['taper', 'boutique', 'defi', 'doree', 'transe', 'creature', 'aventure', 'incubateur', 'calendrier', 'ascension'];
// « Clique ici pour gagner des pièces » s'en va tout seul après ce nombre de taps.
export const TAPS_CONSEIL_TAPER = 10;
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

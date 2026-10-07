// ════════════════════════════════════════════════════════════════════
//  MUSIQUES DU JEU (07/10) — Pixabay Music (licence : usage commercial, sans mention)
// ════════════════════════════════════════════════════════════════════
// Une PILE : chaque écran pose sa musique en arrivant (useMusique) et la retire en partant ;
// seule la musique du HAUT de la pile joue. Menu → Exploration → Combat : en sortant d'un
// écran, la musique d'avant REPREND là où elle s'était arrêtée.
// VOLUME BAS (demande de l'auteur : « pas trop fortes ») : les bruitages passent PAR-DESSUS.
// Chaque son a son propre lecteur : un bruitage ne coupe jamais la musique.
// Pause quand l'appli passe en arrière-plan. Réglage « Musique » séparé des « Sons ».
// expo-audio : le même accès PROTÉGÉ que les sons (sonsBoutique.audioDisponible) — sans le
// module natif, il ne se passe rien (jamais de plantage).
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { audioDisponible } from './sonsBoutique';

const MUSIQUES = {
  menu: require('../../../assets/sons/musique-menu.mp3'),
  aventure: require('../../../assets/sons/musique-aventure.mp3'),
  combat: require('../../../assets/sons/musique-combat.mp3'),
  boss: require('../../../assets/sons/musique-boss.mp3'),
};
// Nettement sous les bruitages (0,5 à 0,9).
export const VOLUME_MUSIQUE = { menu: 0.25, aventure: 0.25, combat: 0.28, boss: 0.3 };

let pile = [];
let reglage = true;
let arrierePlan = false;
let courante = null;
const lecteurs = {};
let ecoute = null;

function lecteur(nom) {
  const A = audioDisponible();
  if (!A || typeof A.createAudioPlayer !== 'function' || !MUSIQUES[nom]) return null;
  if (!lecteurs[nom]) {
    const p = A.createAudioPlayer(MUSIQUES[nom]);
    p.loop = true;
    p.volume = VOLUME_MUSIQUE[nom];
    lecteurs[nom] = p;
  }
  return lecteurs[nom];
}

function appliquer() {
  try {
    const voulue = reglage && !arrierePlan && pile.length ? pile[pile.length - 1].nom : null;
    if (voulue === courante) return;
    if (courante && lecteurs[courante]) { try { lecteurs[courante].pause(); } catch (e) { /* rien */ } }
    courante = voulue;
    if (voulue) { const p = lecteur(voulue); if (p) p.play(); } // reprend là où elle s'était arrêtée
  } catch (e) {
    // Jamais bloquant : une musique ratée ne doit rien casser.
  }
}

function surveillerArrierePlan() {
  if (ecoute) return;
  ecoute = AppState.addEventListener('change', (etat) => { arrierePlan = etat !== 'active'; appliquer(); });
}

// À appeler en haut d'un écran (comme un hook) : sa musique tant qu'il est affiché.
export function useMusique(nom, actif = true) {
  useEffect(() => {
    surveillerArrierePlan();
    const jeton = { nom };
    pile.push(jeton);
    appliquer();
    return () => { pile = pile.filter((j) => j !== jeton); appliquer(); };
  }, [nom]);
  useEffect(() => { reglage = actif !== false; appliquer(); }, [actif]);
}

// Pour une musique QUI DÉPEND D'UN ÉTAT (le Boss du jeu de l'œuf) : rendre <MusiqueActive /> pendant l'état.
export function MusiqueActive({ nom, actif = true }) {
  useMusique(nom, actif);
  return null;
}

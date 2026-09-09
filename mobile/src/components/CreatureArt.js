import React from 'react';
import { Image, Text } from 'react-native';

// Illustrations des créatures, par identifiant puis par palier (0/1/2).
//
// Les `require` sont volontairement ÉCRITS EN DUR : Metro résout les
// chemins à la compilation, un chemin construit à l'exécution
// (`require('.../' + id + '/stage-0.png')`) échoue. Chaque créature doit
// donc être ajoutée ici à la main quand ses 3 fichiers arrivent.
//
// Cette table vit ICI et pas dans `clickerLogic.js` À DESSEIN :
// `clickerLogic.js` est importé tel quel dans Node pour les simulations
// d'équilibrage, et Node ne sait pas charger un PNG — y mettre des
// `require` d'images casserait ces simulations.
//
// Format attendu (voir CREATURE_ART_ROADMAP.md) : PNG carré, fond
// transparent, créature centrée. Les 25 créatures sans illustration
// retombent automatiquement sur leur emoji, sans rien casser.
const CREATURE_ART = {
  pyrosile: [
    require('../../assets/creatures/pyrosile/stage-0.png'),
    require('../../assets/creatures/pyrosile/stage-1.png'),
    require('../../assets/creatures/pyrosile/stage-2.png'),
  ],
};

// Renvoie la source d'image du palier demandé, ou `null` si cette
// créature n'a pas encore d'illustration.
export function creatureArtSource(creatureId, stageIndex = 0) {
  const set = CREATURE_ART[creatureId];
  if (!set) return null;
  const i = Math.min(set.length - 1, Math.max(0, stageIndex || 0));
  return set[i] || null;
}

export function hasCreatureArt(creatureId) {
  return !!CREATURE_ART[creatureId];
}

// Affiche l'illustration si elle existe, sinon l'emoji du palier —
// pour que les créatures pas encore illustrées restent visibles.
// `size` est le côté du carré en dp ; `emojiStyle` sert de repli pour
// garder exactement la taille de texte d'origine à chaque emplacement.
export default function CreatureArt({ creatureId, stageIndex = 0, emoji, size = 32, emojiStyle, style }) {
  const src = creatureArtSource(creatureId, stageIndex);
  if (!src) {
    return <Text style={emojiStyle} numberOfLines={1}>{emoji}</Text>;
  }
  return <Image source={src} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
}

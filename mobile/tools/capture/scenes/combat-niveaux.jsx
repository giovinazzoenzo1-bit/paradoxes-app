import React from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import CombatScreen from '../../../src/screens/games/CombatScreen.js';
import { CREATURES } from '../../../src/games/clicker/clickerLogic';
// Banc (10/10, niveaux réels) : le combat d'une étape, pour VOIR les étiquettes « Niv. », la forme
// évoluée des ennemis, le bandeau 👑 / ⭐ et les PV en format court. ?scene=n110 → étape 110.
const n = Number((new URLSearchParams(location.search).get('scene') || 'n110').slice(1)) || 110;
const c = (id) => CREATURES.find((x) => x.id === id);
const niv = Math.max(1, n + 4);
const team = [
  { creature: c('aegisolar'), ownedLevel: niv, evolutionTier: niv >= 50 ? 2 : niv >= 25 ? 1 : 0, equippedRunes: [] },
  { creature: c('terracroc'), ownedLevel: niv, evolutionTier: niv >= 50 ? 2 : niv >= 25 ? 1 : 0, equippedRunes: [] },
  { creature: c('racinea'), ownedLevel: niv, evolutionTier: niv >= 50 ? 2 : niv >= 25 ? 1 : 0, equippedRunes: [] },
];
createRoot(document.getElementById('root')).render(
  <SafeAreaProvider><SettingsProvider><CombatScreen team={team} levelNumber={n} onFinish={() => {}} /></SettingsProvider></SafeAreaProvider>,
);

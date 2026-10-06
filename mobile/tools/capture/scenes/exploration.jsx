import React from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CoinsProvider } from '../../../src/context/CoinsContext';
import { DailyProvider } from '../../../src/context/DailyContext';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import { HoteDialogue } from '../../../src/components/DialogueJeu';
import ClickerScreen from '../../../src/screens/games/ClickerScreen';
// Banc de l'Exploration (03/10) : une partie avec un deck de 2 créatures + 1
// emplacement vide, glissée dans la mémoire de sauvegarde AVANT le rendu.
const vide = window.location.search.includes('vide=1');
window.__memoireBanc['clicker:state:v2'] = JSON.stringify({
  coins: 5000, totalEarned: 5000,
  owned: [{ id: 'pyrosile', level: 6 }, { id: 'caraploof', level: 9 }, { id: 'ventis', level: 4 }, { id: 'luxorbe', level: 3 }, { id: 'fournax', level: 12 }],
  deck: vide ? [null, null, null] : window.location.search.includes('nouvelles=1') ? ['luxorbe', 'pyrosile', 'fournax'] : ['pyrosile', null, 'caraploof'],
});
// « ?progression=1 » : niveaux 1-3 gagnés (3, 2, 1 étoiles), le 4 en cours.
// « ?progression=3 » : chapitre 3 (niveau 25 en cours), pour les combats à plusieurs adversaires.
if (window.location.search.includes('progression=3')) {
  window.__memoireBanc['adventure:state:v2'] = JSON.stringify({ currentUnlockedLevel: 25, griffes: 300, ownedRunes: [], energy: 5, energyUpdatedAt: Date.now(), levelStars: {}, defaitesDeSuite: {} });
}
if (window.location.search.includes('progression=1')) {
  window.__memoireBanc['adventure:state:v2'] = JSON.stringify({ currentUnlockedLevel: 4, griffes: 120, ownedRunes: [], energy: 5, energyUpdatedAt: Date.now(), levelStars: { 1: 3, 2: 2, 3: 1 }, defaitesDeSuite: {} });
}
// « &runes=1 » : une ANCIENNE Rune de Dextérité (niveau 3) en sauvegarde — doit s'afficher en Arcane.
if (window.location.search.includes('runes=1') && window.__memoireBanc['adventure:state:v2']) {
  const st = JSON.parse(window.__memoireBanc['adventure:state:v2']);
  st.ownedRunes = [{ id: 'rune-test-1', type: 'dexterite', level: 3 }, { id: 'rune-test-2', type: 'force', level: 2 }];
  window.__memoireBanc['adventure:state:v2'] = JSON.stringify(st);
}
const rien = () => {};
createRoot(document.getElementById('root')).render(
  <>

  <SafeAreaProvider><CoinsProvider><DailyProvider><SettingsProvider>
    <ClickerScreen onOpenOptions={rien} onOpenQuests={rien} />
  </SettingsProvider></DailyProvider></CoinsProvider></SafeAreaProvider>
    <HoteDialogue />
  </>,
);

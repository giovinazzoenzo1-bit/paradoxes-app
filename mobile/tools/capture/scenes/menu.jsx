import React from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CoinsProvider } from '../../../src/context/CoinsContext';
import { DailyProvider } from '../../../src/context/DailyContext';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import { HoteDialogue } from '../../../src/components/DialogueJeu';
import ClickerScreen from '../../../src/screens/games/ClickerScreen';
// Le menu principal, exactement comme App.js l'enveloppe.
// « ?toutes=1 » (06/10) : toutes les créatures possédées (clé de dev du jeu), pour tester la
// Collection → fiche créature.
if (window.location.search.includes('toutes=1')) {
  window.__memoireBanc = window.__memoireBanc || {};
  window.__memoireBanc['clicker:dev:unlockAll'] = '1';
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

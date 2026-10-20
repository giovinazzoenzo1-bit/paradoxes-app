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
// « ?incubation=1 » : un œuf dans l'incubateur (lueur du bouton de l'incubateur).
if (new URLSearchParams(window.location.search).get('incubation') === '1') {
  try { window.__memoireBanc['clicker:incubator:v1'] = (JSON.stringify({ incubating: { startedAt: Date.now(), totalMs: 3600000, endsAt: Date.now() + 3600000, tapsUsed: 0, videosUsed: 0 }, main: null })); } catch (e) {}
}
createRoot(document.getElementById('root')).render(
  <>

  <SafeAreaProvider><CoinsProvider><DailyProvider><SettingsProvider>
    <ClickerScreen onOpenOptions={rien} onOpenQuests={rien} />
  </SettingsProvider></DailyProvider></CoinsProvider></SafeAreaProvider>
    <HoteDialogue />
  </>,
);

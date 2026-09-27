import React from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CoinsProvider } from '../../../src/context/CoinsContext';
import { DailyProvider } from '../../../src/context/DailyContext';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import ClickerScreen from '../../../src/screens/games/ClickerScreen';
// Le menu principal, exactement comme App.js l'enveloppe.
const rien = () => {};
createRoot(document.getElementById('root')).render(
  <SafeAreaProvider><CoinsProvider><DailyProvider><SettingsProvider>
    <ClickerScreen onOpenOptions={rien} onOpenQuests={rien} />
  </SettingsProvider></DailyProvider></CoinsProvider></SafeAreaProvider>,
);

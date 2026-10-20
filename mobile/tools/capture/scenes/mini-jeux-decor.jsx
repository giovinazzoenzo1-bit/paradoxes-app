import React from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CoinsProvider } from '../../../src/context/CoinsContext';
import { DailyProvider } from '../../../src/context/DailyContext';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import ClickerScreen from '../../../src/screens/games/ClickerScreen';
import MiniJeu from '../../../src/screens/games/MiniJeu';
// 🎮 Un mini-jeu PAR-DESSUS le vrai écran principal (« ?jeu=… ») : juger lisibilité et placement sur le décor réel.
const jeu = new URLSearchParams(window.location.search).get('jeu') || 'chasse';
const rien = () => {};
createRoot(document.getElementById('root')).render(
  <SafeAreaProvider><CoinsProvider><DailyProvider><SettingsProvider>
    <ClickerScreen onOpenOptions={rien} onOpenQuests={rien} />
    <MiniJeu jeu={jeu} oeufSource={require('../../../assets/egg/egg-0-endormi.png')} sons={false} vibrations={false} onGagne={() => ({ texte: '+23 🐾 Griffes' })} onFermer={rien} />
  </SettingsProvider></DailyProvider></CoinsProvider></SafeAreaProvider>,
);

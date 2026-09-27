import React from 'react';
import { createRoot } from 'react-dom/client';
import { ImageBackground } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CoinsProvider } from '../../../src/context/CoinsContext';
import { DailyProvider } from '../../../src/context/DailyContext';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import ProgresScreen from '../../../src/screens/ProgresScreen';
// Quêtes (vrai écran, vraies quêtes du jour) sur le fond du menu principal.
createRoot(document.getElementById('root')).render(
  <SafeAreaProvider><CoinsProvider><DailyProvider><SettingsProvider>
    <ImageBackground source={require('../../../assets/menu/fond.jpg')} style={{ flex: 1 }} resizeMode="cover">
      <ProgresScreen onBack={() => {}} />
    </ImageBackground>
  </SettingsProvider></DailyProvider></CoinsProvider></SafeAreaProvider>,
);

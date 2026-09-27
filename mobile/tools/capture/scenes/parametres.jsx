import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, ImageBackground } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CoinsProvider } from '../../../src/context/CoinsContext';
import { DailyProvider } from '../../../src/context/DailyContext';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import OptionsScreen from '../../../src/screens/OptionsScreen';
// Paramètres (vrai écran) sur le fond du menu principal.
createRoot(document.getElementById('root')).render(
  <SafeAreaProvider><CoinsProvider><DailyProvider><SettingsProvider>
    <ImageBackground source={require('../../../assets/menu/fond.jpg')} style={{ flex: 1 }} resizeMode="cover">
      <OptionsScreen onBack={() => {}} />
    </ImageBackground>
  </SettingsProvider></DailyProvider></CoinsProvider></SafeAreaProvider>,
);

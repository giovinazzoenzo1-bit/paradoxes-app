import React from 'react';
import { createRoot } from 'react-dom/client';
import { ImageBackground } from 'react-native';
import DiamondShop from '../../../src/screens/games/DiamondShop';
import { HoteDialogue } from '../../../src/components/DialogueJeu';
// Boutique (vrai écran) sur le fond du menu principal, 11 diamants.
createRoot(document.getElementById('root')).render(
  <>

  <ImageBackground source={require('../../../assets/menu/fond.jpg')} style={{ flex: 1 }} resizeMode="cover">
    <DiamondShop diamonds={11} onBuy={async () => null} onBack={() => {}} incubatingEgg={null} />
  </ImageBackground>
    <HoteDialogue />
  </>,
);

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ImageBackground } from 'react-native';
import DiamondShop from '../../../src/screens/games/DiamondShop';
import { contenuReel } from '../../../src/games/clicker/achats';
import { CREATURES } from '../../../src/games/clicker/clickerLogic';
import { HoteDialogue } from '../../../src/components/DialogueJeu';
// Boutique (vrai écran) sur le fond du menu principal, 11 diamants.
createRoot(document.getElementById('root')).render(
  <>

  <ImageBackground source={require('../../../assets/menu/fond.jpg')} style={{ flex: 1 }} resizeMode="cover">
    <DiamondShop diamonds={11} onBuy={async () => null} onBack={() => {}} incubatingEgg={null}
      droits={{ sansPubs: false, doubleur: false, passActif: false, passJusqua: 0, demarrageAchete: false }} onAcheterProduit={async () => '+80 💎'}
      apercuContenu={(id) => contenuReel(id, { creature: CREATURES[0], niveau: 30, passifParSec: 250 })} formatNum={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))} />
  </ImageBackground>
    <HoteDialogue />
  </>,
);

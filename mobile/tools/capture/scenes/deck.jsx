import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, ImageBackground } from 'react-native';
import { DeckRow, __stylesClicker as S } from '../../../src/screens/games/ClickerScreen';
// Le deck tel que le menu l'affiche (vrai DeckRow, vrai cadre, vrais styles).
const rien = () => {};
const owned = [{ id: 'glyphon', level: 1, evolutionTier: 0 }, { id: 'ombrillon', level: 30, evolutionTier: 1 }, { id: 'malefix', level: 60, evolutionTier: 2 }];
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, backgroundColor: '#1d3b36', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
    <ImageBackground source={require('../../../assets/menu/cadre-deck.png')} style={[S.deckFrame, { position: 'relative', left: 0, top: 0 }]} resizeMode="stretch">
      <DeckRow deck={['glyphon', 'ombrillon', 'malefix']} owned={owned} onSlotPress={rien} onSlotLongPress={rien} recharges={{}} />
    </ImageBackground>
    <ImageBackground source={require('../../../assets/menu/cadre-deck.png')} style={[S.deckFrame, { position: 'relative', left: 0, top: 0 }]} resizeMode="stretch">
      <DeckRow deck={['pyrosile', null, 'aegisolar']} owned={[{ id: 'pyrosile', level: 12 }, { id: 'aegisolar', level: 40 }]} onSlotPress={rien} onSlotLongPress={rien} recharges={{}} />
    </ImageBackground>
  </View>,
);

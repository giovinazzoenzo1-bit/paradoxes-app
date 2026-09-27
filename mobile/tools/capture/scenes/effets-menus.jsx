import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, ImageBackground } from 'react-native';
import { EffetRecompense } from '../../../src/screens/games/fenetreBois';
import { DeckRow, SpawnedCreatureBubble } from '../../../src/screens/games/ClickerScreen';
import { CREATURES } from '../../../src/games/clicker/clickerLogic';
// Lueur de pouvoir prêt (vrai deck, vraie bulle) + effet de validation relancé en boucle.
function Scene() {
  const [k, setK] = useState(0);
  useEffect(() => { const id = setInterval(() => setK((v) => v + 1), 900); return () => clearInterval(id); }, []);
  const owned = [{ id: 'glyphon', level: 12 }, { id: 'ombrillon', level: 30 }, { id: 'malefix', level: 45 }];
  return (
    <View style={{ flex: 1, backgroundColor: '#1d3b36' }}>
      <ImageBackground source={require('../../../assets/menu/cadre-deck.png')} style={{ width: 300, height: 108, marginLeft: 45, marginTop: 20 }} resizeMode="stretch">
        <DeckRow deck={['glyphon', 'ombrillon', 'malefix']} owned={owned} onSlotPress={() => {}} onSlotLongPress={() => {}} recharges={{}} />
      </ImageBackground>
      <View style={{ position: 'absolute', left: 0, top: 140, width: 390, height: 120 }}>
        <SpawnedCreatureBubble spawned={{ creature: CREATURES.find((c) => c.id === 'ombrillon'), leftPct: 50, topPct: 50 }} onClaim={() => {}} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: 270, width: 390, height: 300 }}>
        <EffetRecompense key={k} texte="+25 Diamants" sousTexte={null} />
      </View>
    </View>
  );
}
createRoot(document.getElementById('root')).render(<Scene />);

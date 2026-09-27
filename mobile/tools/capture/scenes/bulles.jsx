import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { SpawnedCreatureBubble, GoldenTargetBubble, RitualBubble, OfferingBubble } from '../../../src/screens/games/ClickerScreen';
import { CREATURES } from '../../../src/games/clicker/clickerLogic';
// Les 4 bulles du menu (vrais composants), sur le fond sombre du jeu.
const rien = () => {};
const glyphon = CREATURES.find((c) => c.id === 'glyphon');
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, backgroundColor: '#1d3b36' }}>
    <SpawnedCreatureBubble spawned={{ creature: glyphon, leftPct: 15, topPct: 50 }} onClaim={rien} />
    <GoldenTargetBubble target={{ leftPct: 38, topPct: 50 }} onClaim={rien} />
    <RitualBubble target={{ leftPct: 61, topPct: 50 }} onClaim={rien} />
    <OfferingBubble target={{ leftPct: 84, topPct: 50 }} onClaim={rien} />
  </View>,
);

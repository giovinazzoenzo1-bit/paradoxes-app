import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import CreatureArt from '../../../src/components/CreatureArt';
// Même créature : à gauche telle quelle (notre camp), à droite en miroir (adversaire).
const MIROIR = { transform: [{ scaleX: -1 }] };
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, backgroundColor: '#1d3b36', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
    <View style={{ alignItems: 'center' }}><CreatureArt creatureId="malefix" stageIndex={2} emoji="🦊" size={140} /><Text style={{ color: '#fff' }}>notre camp</Text></View>
    <View style={{ alignItems: 'center' }}><CreatureArt creatureId="malefix" stageIndex={2} emoji="🦊" size={140} style={MIROIR} /><Text style={{ color: '#fff' }}>adversaire</Text></View>
  </View>,
);

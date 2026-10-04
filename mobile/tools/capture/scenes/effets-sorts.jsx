import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { EffetSort } from '../../../src/screens/games/CombatScreen';
// Banc (03/10, étape 3) : les 12 visuels de sorts / spécial / K.O., en pleine animation.
const TYPES = [['bouclier', 12], ['soin', 9], ['boost'], ['vitesse'], ['provocation'], ['pacte'], ['poison'], ['marque'], ['execution'], ['zone'], ['special'], ['ko']];
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, backgroundColor: '#3f7a3a', flexDirection: 'row', flexWrap: 'wrap' }}>
    {TYPES.map(([t, v]) => (
      <View key={t} style={{ width: 148, height: 150, alignItems: 'center' }}>
        <View style={{ width: 70, height: 70, marginTop: 50, borderRadius: 35, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        <EffetSort type={t} x={74} y={85} taille={70} valeur={v || null} />
        <Text style={{ position: 'absolute', bottom: 4, color: '#fff', fontSize: 12, fontWeight: '800' }}>{t}</Text>
      </View>
    ))}
  </View>,
);

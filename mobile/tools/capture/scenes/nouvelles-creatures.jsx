import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import CreatureArt from '../../../src/components/CreatureArt';
// Banc (03/10) : Luxorbe et Fournax à leurs 3 stades, par le VRAI CreatureArt, sur fond sombre.
const L = ['luxorbe', 'fournax'];
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, backgroundColor: '#1d2733', padding: 10 }}>
    {L.map((id) => (
      <View key={id} style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 }}>
        {[0, 1, 2].map((s) => (
          <View key={s} style={{ alignItems: 'center', marginRight: 6, backgroundColor: '#263544', borderRadius: 8 }}>
            <CreatureArt creatureId={id} stageIndex={s} emoji="?" size={120} />
            <Text style={{ color: '#ddd', fontSize: 11 }}>{id} · stade {s}</Text>
          </View>
        ))}
      </View>
    ))}
  </View>,
);

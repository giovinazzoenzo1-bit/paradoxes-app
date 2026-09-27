import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import CreatureArt from '../../../src/components/CreatureArt';
// Les créatures telles que le jeu les affiche (CreatureArt), 3 stades chacune.
const ids = (new URLSearchParams(location.search).get('ids') || 'glyphon,ombrillon,malefix').split(',');
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, backgroundColor: '#12303a', padding: 12, gap: 10 }}>
    {ids.map((id) => (
      <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Text style={{ color: '#fff', width: 90, fontWeight: '800' }}>{id}</Text>
        {[0, 1, 2].map((k) => <CreatureArt key={k} creatureId={id} stageIndex={k} emoji="?" size={96} />)}
      </View>
    ))}
  </View>,
);

import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text } from 'react-native';
import { FenetreBois, BoutonBois } from '../../../src/screens/games/fenetreBois';
import IncubatorPanel from '../../../src/screens/games/IncubatorPanel';
import CreatureArt from '../../../src/components/CreatureArt';
// ?vue=creature : la révélation d'une créature ; ?vue=incubateur (&pret=1) : le menu.
const vue = new URLSearchParams(location.search).get('scene') || 'creature';
const rien = () => {};
const maintenant = Date.now();
const oeuf = vue === 'incubateur-pret'
  ? { endsAt: maintenant - 1000, totalMs: 41 * 60000, tapsUsed: 57, videosUsed: 2 }
  : { endsAt: maintenant + 36 * 60000, totalMs: 41 * 60000, tapsUsed: 12, videosUsed: 1 };
createRoot(document.getElementById('root')).render(
  vue === 'creature' ? (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
      <FenetreBois titre="Nouvelle créature !">
        <CreatureArt creatureId="ombrillon" stageIndex={0} emoji="👻" size={170} />
        <Text style={{ color: '#fff7d6', fontSize: 22, fontWeight: '900', marginTop: 2 }}>Ombrillon</Text>
        <Text style={{ color: '#b0bec5', fontSize: 14, fontWeight: '800' }}>Commun</Text>
        <BoutonBois texte="Super !" onPress={rien} />
      </FenetreBois>
    </View>
  ) : (
    <View style={{ flex: 1, backgroundColor: '#1d2b24' }}>
      <IncubatorPanel egg={oeuf} onTap={rien} onWatchVideo={rien} onHatch={rien} onBack={rien} guardianRequired guardianInfo="⚔️ Gardien 24 · 🛡️ Ton deck 22" />
    </View>
  ),
);

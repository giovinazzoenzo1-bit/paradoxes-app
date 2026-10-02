import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, TouchableOpacity } from 'react-native';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import CollectionAlbum from '../../../src/screens/games/CollectionAlbum';
import { CREATURES } from '../../../src/games/clicker/clickerLogic';

// Banc de l'Album de cartes (02/10) : ~15 créatures possédées, deck de 2 + 1 vide.
const owned = CREATURES.filter((c, i) => i % 2 === 0 || i < 6).map((c, i) => ({ id: c.id, level: 1 + ((i * 7) % 20) }));
const deck = [owned[0].id, owned[3].id, null];
const f = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)));
function Fiche({ creature, onClose }) {
  return (
    <TouchableOpacity onPress={onClose} style={{ position: 'absolute', left: 30, top: 220, right: 30, height: 160, backgroundColor: '#f6ead0', zIndex: 30, alignItems: 'center', justifyContent: 'center' }}>
      <Text>FICHE {creature.id}</Text>
    </TouchableOpacity>
  );
}
function Scene() {
  const [sel, setSel] = React.useState(null);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <CollectionAlbum owned={owned} deck={deck} coins={1250000} sharedCoins={78} nextSummonCost={2500} formatNum={f}
        selectedCreature={sel} setSelectedCreature={setSel} FicheCreature={Fiche}
        onSummon={() => { window.__invoque = (window.__invoque || 0) + 1; }}
        onOuvrirEmplacement={(i) => { window.__emplacement = i; }} onRetour={() => {}} />
    </View>
  );
}
createRoot(document.getElementById('root')).render(<SettingsProvider><Scene /></SettingsProvider>);

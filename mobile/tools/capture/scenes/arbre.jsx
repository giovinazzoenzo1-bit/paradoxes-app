import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import BoutiqueArbre from '../../../src/screens/games/ArbreBoutique';
import { AUTOCLICKERS } from '../../../src/games/clicker/clickerLogic';
// L'arbre de la boutique (vrai composant) avec des valeurs réalistes.
const rien = () => {};
const f = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)));
const tries = [...AUTOCLICKERS].sort((a, b) => a.baseCost - b.baseCost);
createRoot(document.getElementById('root')).render(
  <SettingsProvider>
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <BoutiqueArbre
        onRetour={rien} formatNum={f} coins={141800} sharedCoins={78} tapPower={12} critLevel={8} critDamageLevel={5}
        sanctuaryLevel={4} veilleurLevel={0} autoClickers={Object.fromEntries(tries.slice(0, 7).map((c, i) => [c.id, 7 - i]))} upgradeLevels={{}} tapUpgrades={{}}
        applyDiscount={(c) => c} griffesCoinBuys={0} owned={[{ id: 'glyphon', level: 5 }]}
        ascensionReady={false} defiAscensionEnCours ascensionCount={1} totalEarned={60000} essence={0}
        onBuyTapPower={rien} onBuyCrit={rien} onBuyCritDamage={rien} onBuyTapUpgrade={rien} onBuySanctuary={rien}
        onBuyVeilleur={rien} onBuyAutoClicker={rien} onBuyGriffesWithCoins={rien} onBuyUpgradeItem={rien} onOffrande={rien} onAscend={rien}
      />
    </View>
  </SettingsProvider>,
);

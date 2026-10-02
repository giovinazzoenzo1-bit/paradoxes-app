import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import { Animated } from 'react-native';
// Banc : animations ×5 plus lentes pour pouvoir capturer la page EN TRAIN de tourner.
const _t = Animated.timing; Animated.timing = (v, c) => _t(v, { ...c, duration: (c.duration || 300) * 5 });
import BoutiqueGrimoire from '../../../src/screens/games/GrimoireBoutique';
import { AUTOCLICKERS } from '../../../src/games/clicker/clickerLogic';
// Le grimoire de la boutique (vrai composant) avec des valeurs réalistes.
const rien = () => {};
const f = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)));
const tries = [...AUTOCLICKERS].sort((a, b) => a.baseCost - b.baseCost);
createRoot(document.getElementById('root')).render(
  <SettingsProvider>
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <BoutiqueGrimoire
        onRetour={rien} formatNum={f} coins={141800} sharedCoins={78} tapPower={12} critLevel={8} critDamageLevel={5}
        sanctuaryLevel={4} veilleurLevel={0} autoClickers={Object.fromEntries(tries.slice(0, 7).map((c, i) => [c.id, 7 - i]))} upgradeLevels={{}} tapUpgrades={{}}
        applyDiscount={(c) => c} griffesCoinBuys={0} owned={[{ id: 'glyphon', level: 5 }, { id: 'pyrosile', level: 3 }, { id: 'caraploof', level: 2 }]}
        ascensionReady={false} defiAscensionEnCours ascensionCount={1} totalEarned={60000} essence={0}
        onBuyTapPower={rien} onBuyCrit={rien} onBuyCritDamage={rien} onBuyTapUpgrade={rien} onBuySanctuary={rien}
        onBuyVeilleur={rien} onBuyAutoClicker={rien} onBuyGriffesWithCoins={rien} onBuyUpgradeItem={rien} onOffrande={rien} onAscend={rien}
      />
    </View>
  </SettingsProvider>,
);

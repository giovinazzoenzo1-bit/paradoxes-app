import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { SettingsProvider } from '../../../src/context/SettingsContext';
import BoutiqueGrimoire from '../../../src/screens/games/GrimoireBoutique';
import { AUTOCLICKERS } from '../../../src/games/clicker/clickerLogic';
import { HoteDialogue } from '../../../src/components/DialogueJeu';
import { diamantsPourPieces } from '../../../src/games/clicker/boutiqueModele';
// Le grimoire de la boutique (vrai composant) avec des valeurs réalistes.
const rien = () => {};
const f = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)));
const tries = [...AUTOCLICKERS].sort((a, b) => a.baseCost - b.baseCost);
// « ?cible=tapPower » : l'article du défi d'achat en cours (lueur de guidage sur le marque-page de son chapitre).
const cible = new URLSearchParams(window.location.search).get('cible') || null;
// « &tuto=1&vus=taper,boutique » : conseils du tutoriel actifs, certains déjà vus (ex. : le conseil du Pacte).
if (new URLSearchParams(window.location.search).get('tuto') === '1') {
  try { window.__memoireBanc['tuto:v2'] = JSON.stringify({ vus: (new URLSearchParams(window.location.search).get('vus') || '').split(',').filter(Boolean), passe: false, decide: true }); } catch (e) {}
}
createRoot(document.getElementById('root')).render(
  <SettingsProvider>
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <BoutiqueGrimoire
        cibleDefi={cible} onRetour={rien} formatNum={f} coins={Number(new URLSearchParams(window.location.search).get('pieces')) || 141800} sharedCoins={78}
        diamantsPourManque={(m) => diamantsPourPieces(m, 250)} onCompleterEnDiamants={async () => true} tapPower={12} critLevel={8} critDamageLevel={5}
        sanctuaryLevel={4} veilleurLevel={0} autoClickers={Object.fromEntries(tries.slice(0, 7).map((c, i) => [c.id, 7 - i]))} upgradeLevels={{}} tapUpgrades={{}}
        applyDiscount={(c) => c} griffesCoinBuys={0} owned={[{ id: 'glyphon', level: 5 }, { id: 'pyrosile', level: 3 }, { id: 'caraploof', level: 2 }]}
        ascensionReady={false} defiAscensionEnCours ascensionCount={1} totalEarned={60000} essence={0}
        onBuyTapPower={rien} onBuyCrit={rien} onBuyCritDamage={rien} onBuyTapUpgrade={rien} onBuySanctuary={rien}
        onBuyVeilleur={rien} onBuyAutoClicker={rien} onBuyGriffesWithCoins={rien} onBuyUpgradeItem={rien} onOffrande={rien} onAscend={rien}
      />
      <HoteDialogue />{/* 30/10 : la question « compléter en Diamants » s'affiche ici comme dans le jeu */}
    </View>
  </SettingsProvider>,
);

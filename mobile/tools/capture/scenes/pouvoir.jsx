import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Image, Animated } from 'react-native';
import { PowerCastEffect, PowerAura, PowerAttacker, PowerFlash, EGG_SIZE, TAP_ZONE_H } from '../../../src/screens/games/ClickerScreen';
// En haut : 3 apparitions FIGÉES de la créature (gauche, dessus, droite
// retournée) autour de l'œuf. En bas : l'activation (flash plein écran + halo).
const pos = (deg) => {
  const r = (deg * Math.PI) / 180, x = Math.cos(r) * EGG_SIZE * 0.42, y = Math.sin(r) * EGG_SIZE * 0.5;
  return { x: new Animated.Value(x), y: new Animated.Value(y), flip: new Animated.Value(x > 1 ? -1 : 1), vie: new Animated.Value(1) };
};
function Scene() {
  const [k, setK] = useState(0);
  useEffect(() => { const id = setInterval(() => setK((v) => v + 1), 1000); return () => clearInterval(id); }, []);
  const a1 = useRef(pos(180)).current, a2 = useRef(pos(270)).current, a3 = useRef(pos(0)).current;
  return (
    <View style={{ flex: 1, backgroundColor: '#1d3b36' }}>
      <PowerFlash key={'f' + k} couleur="#a07bff" />
      <View style={{ width: 390, height: TAP_ZONE_H, marginTop: 30 }}>
        <Image source={require('../../../assets/menu/grand-nid.png')} style={{ position: 'absolute', width: EGG_SIZE, height: Math.round(EGG_SIZE * 394 / 720), left: 195 - EGG_SIZE / 2, top: TAP_ZONE_H / 2 - 10 }} resizeMode="contain" />
        <Image source={require('../../../assets/egg/egg-1-fremissant.png')} style={{ position: 'absolute', width: EGG_SIZE, height: EGG_SIZE, left: 195 - EGG_SIZE / 2, top: TAP_ZONE_H / 2 - EGG_SIZE / 2 }} resizeMode="contain" />
        <PowerAttacker creatureId="ombrillon" stage={2} attaque={a1} />
        <PowerAttacker creatureId="ombrillon" stage={2} attaque={a2} />
        <PowerAttacker creatureId="ombrillon" stage={2} attaque={a3} />
      </View>
      <View style={{ width: 390, height: TAP_ZONE_H, marginTop: 30 }}>
        <PowerCastEffect key={k} cast={{ creatureId: 'ombrillon', name: 'Éclipse' }} />
      </View>
    </View>
  );
}
createRoot(document.getElementById('root')).render(<Scene />);

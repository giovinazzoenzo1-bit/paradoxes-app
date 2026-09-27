import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Image, Animated } from 'react-native';
import { PowerCastEffect, PowerAura, PowerAttacker, EGG_SIZE, TAP_ZONE_H } from '../../../src/screens/games/ClickerScreen';
// Pouvoir actif (vrais composants) : aura + créature qui bondit sur l'œuf en
// boucle ; à droite, l'activation figée à mi-course.
function Scene() {
  const attaque = useRef(new Animated.Value(0)).current;
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      attaque.setValue(0);
      Animated.sequence([Animated.timing(attaque, { toValue: 1, duration: 70, useNativeDriver: false }), Animated.spring(attaque, { toValue: 0, friction: 5, tension: 120, useNativeDriver: false })]).start();
    }, 420);
    const id2 = setInterval(() => setK((v) => v + 1), 1000);
    return () => { clearInterval(id); clearInterval(id2); };
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: '#1d3b36' }}>
      <View style={{ width: 390, height: TAP_ZONE_H, marginTop: 30 }}>
        <PowerAura couleur="#ff6a2b" />
        <Image source={require('../../../assets/menu/grand-nid.png')} style={{ position: 'absolute', width: EGG_SIZE, height: Math.round(EGG_SIZE * 394 / 720), left: 195 - EGG_SIZE / 2, top: TAP_ZONE_H / 2 - 10 }} resizeMode="contain" />
        <Image source={require('../../../assets/egg/egg-2-fissure.png')} style={{ position: 'absolute', width: EGG_SIZE, height: EGG_SIZE, left: 195 - EGG_SIZE / 2, top: TAP_ZONE_H / 2 - EGG_SIZE / 2 }} resizeMode="contain" />
        <PowerAttacker creatureId="malefix" stage={2} attaque={attaque} />
      </View>
      <View style={{ width: 390, height: TAP_ZONE_H, marginTop: 30 }}>
        <PowerCastEffect key={k} cast={{ creatureId: 'glyphon', name: 'Souffle des sylves' }} />
      </View>
    </View>
  );
}
createRoot(document.getElementById('root')).render(<Scene />);

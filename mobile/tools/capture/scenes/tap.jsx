import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Image } from 'react-native';
import { TapEffect } from '../../../src/screens/games/ClickerScreen';
// Effets de tap (vrai TapEffect) relancés en boucle, figés à mi-course par la
// capture ; + les 2 icônes des bulles.
function Boucle() {
  const [k, setK] = useState(0);
  useEffect(() => { const id = setInterval(() => setK((v) => v + 1), 700); return () => clearInterval(id); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: '#1d3b36' }}>
      <TapEffect key={'a' + k} x={110} y={150} text="+1 240" tap />
      <TapEffect key={'b' + k} x={280} y={150} text="+3 720 💥" crit tap />
      <Image source={require('../../../assets/menu/pierre-runique.png')} style={{ position: 'absolute', left: 120, top: 250, width: 48, height: 48 }} resizeMode="contain" />
      <Image source={require('../../../assets/menu/gland-dore.png')} style={{ position: 'absolute', left: 220, top: 250, width: 48, height: 48 }} resizeMode="contain" />
    </View>
  );
}
createRoot(document.getElementById('root')).render(<Boucle />);

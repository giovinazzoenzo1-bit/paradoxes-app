// 🎉 FÊTE APRÈS UN ACHAT (22/10, demande de l'auteur : « des animations ») — un éclat doré au centre, des objets qui jaillissent
// puis volent vers le compteur (en haut à gauche par défaut), et « Merci ! » avec ce qui a été reçu. ~1,8 s, puis `onFin`.
// ⚠️ ENTIÈREMENT transparente au doigt, et chaque image dans une VUE `pointerEvents: 'none'` (sur téléphone, une image ignore
// `pointerEvents` — bug du rond du tuto, 21/10).
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Image, Dimensions, StyleSheet } from 'react-native';

const LUEUR = require('../../assets/grimoire/lueur-or.png');
const NB = 14;

export default function FeteAchat({ objets = ['💎'], texte = 'Merci !', sousTexte = '', cible = { x: 70, y: 70 }, onFin }) {
  const { width: W, height: H } = Dimensions.get('window');
  const cx = W / 2, cy = H * 0.42;
  const eclat = useRef(new Animated.Value(0)).current;
  const titre = useRef(new Animated.Value(0)).current;
  const parts = useRef([...Array(NB)].map(() => new Animated.Value(0))).current;
  // Trajets tirés une fois : jaillissement en couronne, puis vol vers la cible.
  const trajets = useRef([...Array(NB)].map((_, i) => {
    const a = (i / NB) * Math.PI * 2 + Math.random() * 0.4;
    const r = 70 + Math.random() * 60;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, taille: 22 + Math.random() * 12 };
  })).current;

  useEffect(() => {
    Animated.timing(eclat, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.spring(titre, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    Animated.stagger(35, parts.map((v) => Animated.timing(v, { toValue: 1, duration: 1150, easing: Easing.inOut(Easing.quad), useNativeDriver: true }))).start();
    const t = setTimeout(() => onFin && onFin(), 1850);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, pointerEvents: 'none' }]}>
      {/* Éclat doré */}
      <Animated.View style={{ position: 'absolute', left: cx - 160, top: cy - 160, width: 320, height: 320, pointerEvents: 'none',
        opacity: eclat.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
        transform: [{ scale: eclat.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.4] }) }] }}>
        <Image source={LUEUR} resizeMode="contain" style={{ width: 320, height: 320 }} />
      </Animated.View>
      {/* Objets : jaillissent (0 → 0,35), puis volent vers le compteur en rapetissant */}
      {parts.map((v, i) => {
        const t = trajets[i]; const o = objets[i % objets.length];
        return (
          <Animated.Text key={i} style={{ position: 'absolute', left: cx - t.taille / 2, top: cy - t.taille / 2, fontSize: t.taille, pointerEvents: 'none',
            opacity: v.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, t.dx, cible.x - cx] }) },
              { translateY: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, t.dy, cible.y - cy] }) },
              { scale: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.4, 1.2, 0.5] }) },
            ] }}>{o}</Animated.Text>
        );
      })}
      {/* Merci ! */}
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: cy + 90, alignItems: 'center', pointerEvents: 'none',
        opacity: titre.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
        transform: [{ scale: titre.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
        <Text style={styles.titre}>{texte}</Text>
        {sousTexte ? <Text style={styles.sous}>{sousTexte}</Text> : null}
      </Animated.View>
    </View>
  );
}

// Les objets qui volent selon ce qui a été acheté.
export function objetsDeFete(contenu = {}, famille = '') {
  const o = [];
  if (contenu.diamants) o.push('💎');
  if (contenu.griffes) o.push('🐾');
  if (contenu.pieces) o.push('🪙');
  if (!o.length) o.push(famille === 'avantage' ? '⭐' : '✨');
  return o;
}

const styles = StyleSheet.create({
  titre: { color: '#ffe27a', fontSize: 34, fontWeight: '900', textShadowColor: '#5a2d00', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  sous: { color: '#fff3d6', fontSize: 15, fontWeight: '800', marginTop: 4, textAlign: 'center', paddingHorizontal: 20, textShadowColor: '#000', textShadowRadius: 5 },
});

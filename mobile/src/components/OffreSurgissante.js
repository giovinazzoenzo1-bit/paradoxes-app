// 💥 L'OFFRE QUI SURGIT (22/10, demande de l'auteur : « les animations, celles qui popent à l'écran parfois »). Testable
// depuis le menu 🛠️ ; les MOMENTS où elle surgit (choix de l'auteur, 30/10) : games/clicker/offresMoments.js.
// La fenêtre en bois du jeu TOMBE avec un rebond ; derrière l'objet, des RAYONS dorés tournent ; un REFLET balaie l'objet ; le
// RUBAN (« ×6 de valeur »…) claque à l'arrivée ; le PRIX pulse ; une MINUTERIE pour les offres limitées (`finA`).
// L'icône est un emoji en attendant les images Gemini (prop `image` : elle prendra sa place).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Image, Modal, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { FenetreBois, BoutonBois } from '../screens/games/fenetreBois';

const LUEUR = require('../../assets/grimoire/lueur-or.png');
const RAYONS = 12;

function resteTexte(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}

// 30/10 : `accroche` = la phrase du MOMENT (« Le Gardien te résiste ? »…), au-dessus du contenu (offresMoments.accrocheDuMoment).
export default function OffreSurgissante({ produit, contenuTexte = '', image = null, finA = null, accroche = '', onAcheter, onFermer }) {
  const { height: H } = Dimensions.get('window');
  const chute = useRef(new Animated.Value(0)).current;
  const tour = useRef(new Animated.Value(0)).current;
  const reflet = useRef(new Animated.Value(0)).current;
  const ruban = useRef(new Animated.Value(0)).current;
  const pouls = useRef(new Animated.Value(0)).current;
  const [maintenant, setMaintenant] = useState(Date.now());

  useEffect(() => {
    Animated.spring(chute, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }).start();
    const a = Animated.loop(Animated.timing(tour, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })); a.start();
    const b = Animated.loop(Animated.sequence([Animated.delay(900), Animated.timing(reflet, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(reflet, { toValue: 0, duration: 0, useNativeDriver: true })])); b.start();
    const c = Animated.loop(Animated.sequence([Animated.timing(pouls, { toValue: 1, duration: 650, useNativeDriver: true }), Animated.timing(pouls, { toValue: 0, duration: 650, useNativeDriver: true })])); c.start();
    const t = setTimeout(() => Animated.spring(ruban, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start(), 550);
    const iv = finA ? setInterval(() => setMaintenant(Date.now()), 1000) : null;
    return () => { a.stop(); b.stop(); c.stop(); clearTimeout(t); if (iv) clearInterval(iv); };
  }, []);

  if (!produit) return null;
  const D = 132; // diamètre de la zone de l'objet
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFermer}>
      <View style={styles.fond}>
        <Animated.View style={{ transform: [{ translateY: chute.interpolate({ inputRange: [0, 1], outputRange: [-H, 0] }) }] }}>
          <FenetreBois titre={produit.titre} largeur={320} onFermer={onFermer}>
            {/* L'objet : rayons qui tournent + lueur derrière, reflet qui balaie (tout décoratif dans des vues sans doigt) */}
            <View style={{ width: D * 1.7, height: D * 1.25, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={{ position: 'absolute', width: D * 1.7, height: D * 1.7, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                transform: [{ rotate: tour.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                {[...Array(RAYONS)].map((_, i) => (
                  <View key={i} style={{ position: 'absolute', width: 10, height: D * 1.7, borderRadius: 5, backgroundColor: 'rgba(255, 214, 102, 0.22)', transform: [{ rotate: `${(i * 180) / RAYONS}deg` }] }} />
                ))}
              </Animated.View>
              <View style={{ position: 'absolute', width: D * 1.4, height: D * 1.4, pointerEvents: 'none' }}>
                <Image source={LUEUR} resizeMode="contain" style={{ width: D * 1.4, height: D * 1.4, opacity: 0.85 }} />
              </View>
              <View style={{ width: D, height: D, borderRadius: D / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40, 22, 8, 0.55)', borderWidth: 3, borderColor: '#e8b64c' }}>
                {image ? <View style={{ pointerEvents: 'none' }}><Image source={image} resizeMode="contain" style={{ width: D * 0.82, height: D * 0.82 }} /></View>
                  : <Text style={{ fontSize: 64 }}>{produit.icone}</Text>}
                <Animated.View style={{ position: 'absolute', top: -20, width: 34, height: D + 40, backgroundColor: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
                  transform: [{ rotate: '20deg' }, { translateX: reflet.interpolate({ inputRange: [0, 1], outputRange: [-D, D] }) }] }} />
              </View>
              {produit.badge ? (
                <Animated.View style={[styles.ruban, { transform: [{ rotate: '-12deg' }, { scale: ruban.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }], opacity: ruban }]}>
                  <Text style={styles.rubanTexte}>{produit.badge}</Text>
                </Animated.View>
              ) : null}
            </View>
            {accroche ? <Text style={styles.accroche}>{accroche}</Text> : null}
            <Text style={styles.contenu}>{contenuTexte || produit.desc}</Text>
            {finA ? <Text style={styles.minuterie}>⏳ Plus que {resteTexte(finA - maintenant)}</Text> : null}
            <Animated.View style={{ alignSelf: 'center', marginTop: 8, transform: [{ scale: pouls.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
              <BoutonBois texte={`Acheter · ${produit.prix}`} onPress={onAcheter} />
            </Animated.View>
            <TouchableOpacity onPress={onFermer} style={{ alignSelf: 'center', padding: 8 }}>
              <Text style={styles.plusTard}>Plus tard</Text>
            </TouchableOpacity>
          </FenetreBois>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center' },
  ruban: { position: 'absolute', right: 2, top: 4, backgroundColor: '#c0392b', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 2, borderColor: '#ffd36b' },
  rubanTexte: { color: '#fff', fontSize: 12, fontWeight: '900' },
  accroche: { color: '#ffd66b', fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 2, paddingHorizontal: 10 },
  contenu: { color: '#fff3d6', fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 4, paddingHorizontal: 10 },
  minuterie: { color: '#ffcf3f', fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  plusTard: { color: '#dccbaa', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});

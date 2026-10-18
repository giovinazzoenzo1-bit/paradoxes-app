// ✨ CHASSE AUX LUEURS — l'écran du mini-jeu (logique : games/clicker/miniJeux.js).
// Fenêtre plein écran (Modal) : aucun toucher n'atteint l'œuf, rien ne compte pour les défis ni pour le rythme mesuré.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, Animated, StyleSheet, Vibration } from 'react-native';
import { LUEURS_NB, dureeLueur, PERDU_MS, DECOMPTE, DECOMPTE_PAS_MS } from '../../games/clicker/miniJeux';
import { jouerSon } from './sonsBoutique';

const LUEUR = require('../../../assets/fenetres/lueur-cyan.png');
const LUEUR_OR = require('../../../assets/grimoire/lueur-or.png');
const TAILLE = 88;

export default function ChasseLueurs({ visible, sons = true, vibrations = true, onGagne, onFermer }) {
  const [phase, setPhase] = useState('intro');     // intro → jeu → perdu | gagne
  const [decompte, setDecompte] = useState(0);
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [recompense, setRecompense] = useState(null);
  const [zone, setZone] = useState({ w: 0, h: 0 });
  const eteinte = useRef(new Animated.Value(1)).current;
  const tremble = useRef(new Animated.Value(0)).current;
  const minuteur = useRef(null);
  const fini = useRef(false);

  const nettoyer = () => { if (minuteur.current) { clearTimeout(minuteur.current); minuteur.current = null; } };

  useEffect(() => {
    if (!visible) return undefined;
    fini.current = false;
    setPhase('intro'); setDecompte(0); setIndex(0); setRecompense(null);
    let k = 0;
    const suivant = () => {
      k += 1;
      if (k < DECOMPTE.length) { setDecompte(k); minuteur.current = setTimeout(suivant, DECOMPTE_PAS_MS); }
      else setPhase('jeu');
    };
    minuteur.current = setTimeout(suivant, DECOMPTE_PAS_MS * 1.5);
    return nettoyer;
  }, [visible]);

  const placer = (i) => {
    const w = zone.w || 360, h = zone.h || 640;
    const x = 24 + Math.random() * Math.max(1, w - TAILLE - 48);
    const y = 120 + Math.random() * Math.max(1, h - TAILLE - 260);
    setPos({ x, y });
    eteinte.setValue(1);
    Animated.timing(eteinte, { toValue: 0, duration: dureeLueur(i), useNativeDriver: true }).start();
    nettoyer();
    minuteur.current = setTimeout(perdre, dureeLueur(i));
  };

  useEffect(() => { if (visible && phase === 'jeu') placer(index); }, [phase, index, visible]);

  function perdre() {
    if (fini.current) return;
    fini.current = true;
    nettoyer();
    setPhase('perdu');
    jouerSon('defaite', sons);
    if (vibrations) Vibration.vibrate(250);
    Animated.sequence([10, -10, 8, -8, 5, -5, 0].map((v) => Animated.timing(tremble, { toValue: v, duration: 45, useNativeDriver: true }))).start();
    minuteur.current = setTimeout(() => onFermer && onFermer(), PERDU_MS);
  }

  const toucher = () => {
    if (phase !== 'jeu' || fini.current) return;
    nettoyer();
    jouerSon('bulle-eclatee', sons);
    if (index + 1 >= LUEURS_NB) {
      fini.current = true;
      const r = onGagne ? onGagne() : null;
      setRecompense(r);
      setPhase('gagne');
      jouerSon('recompense', sons);
      minuteur.current = setTimeout(() => onFermer && onFermer(), 2200);
    } else setIndex(index + 1);
  };

  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => { nettoyer(); if (onFermer) onFermer(); }}>
      <Animated.View style={[styles.fond, { transform: [{ translateX: tremble }] }]}
        onLayout={(e) => setZone({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {phase === 'intro' && (
          <View style={styles.centre}>
            <Text style={styles.titre}>✨ Chasse aux Lueurs</Text>
            <Text style={styles.consigne}>Touche les {LUEURS_NB} lueurs avant qu'elles s'éteignent</Text>
            <Text style={styles.decompte}>{DECOMPTE[decompte]}</Text>
          </View>
        )}
        {phase === 'jeu' && (
          <Animated.View style={[styles.lueur, { left: pos.x, top: pos.y, opacity: eteinte,
            transform: [{ scale: eteinte.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }] }]}>
            <TouchableOpacity activeOpacity={0.6} onPressIn={toucher} style={styles.toucher}>
              <Image source={LUEUR} style={styles.image} resizeMode="contain" />
            </TouchableOpacity>
          </Animated.View>
        )}
        {phase === 'perdu' && (
          <View style={styles.centre}><Text style={styles.perdu}>PERDU</Text></View>
        )}
        {phase === 'gagne' && (
          <View style={styles.centre}>
            <Image source={LUEUR_OR} style={styles.eclat} resizeMode="contain" />
            <Text style={styles.gagne}>{recompense && recompense.texte ? recompense.texte : 'Bravo !'}</Text>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(8,6,20,0.86)' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  titre: { color: '#bfefff', fontSize: 30, fontWeight: '800', textAlign: 'center', textShadowColor: '#2aa8ff', textShadowRadius: 12 },
  consigne: { color: '#e8e4ff', fontSize: 15, marginTop: 10, textAlign: 'center' },
  decompte: { color: '#ffffff', fontSize: 64, fontWeight: '900', marginTop: 34 },
  lueur: { position: 'absolute', width: TAILLE, height: TAILLE },
  toucher: { width: TAILLE, height: TAILLE },
  image: { width: TAILLE, height: TAILLE },
  perdu: { color: '#ff3b3b', fontSize: 56, fontWeight: '900', letterSpacing: 4, textShadowColor: '#000', textShadowRadius: 10 },
  eclat: { width: 220, height: 220, position: 'absolute' },
  gagne: { color: '#fff3b0', fontSize: 28, fontWeight: '900', textAlign: 'center', textShadowColor: '#7a4a00', textShadowRadius: 8 },
});

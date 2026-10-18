// 🎮 MINI-JEUX — écran commun (logique et règles : games/clicker/miniJeux.js).
// Fenêtre plein écran (Modal) : aucun toucher n'atteint l'œuf, rien ne compte pour les défis ni pour le rythme mesuré.
// Déroulé commun (demandes de l'auteur) : titre + TUTO d'une seule phrase pendant le décompte 3, 2, 1 → le jeu → une ratée :
// « PERDU » en rouge 1 s, écran qui tremble, son de défaite → réussi : une lueur dorée révèle la récompense.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, Animated, StyleSheet, Vibration } from 'react-native';
import {
  miniJeu, LUEURS_NB, dureeLueur, PERDU_MS, DECOMPTE, DECOMPTE_PAS_MS,
  DOREE_TOURS, doreeNbLueurs, doreeDuree, TRANSE_TEMPS, TRANSE_FENETRE_MS, TRANSE_RATES_MAX, transeIntervalle,
} from '../../games/clicker/miniJeux';
import { jouerSon } from './sonsBoutique';

const LUEUR = require('../../../assets/fenetres/lueur-cyan.png');
const LUEUR_OR = require('../../../assets/grimoire/lueur-or.png');
const TAILLE = 88;

// Position au hasard dans la zone de jeu (marges : titre en haut, bas de l'écran libre).
function auHasard(zone) {
  const w = zone.w || 360, h = zone.h || 640;
  return { x: 24 + Math.random() * Math.max(1, w - TAILLE - 48), y: 120 + Math.random() * Math.max(1, h - TAILLE - 260) };
}

// ✨ CHASSE AUX LUEURS : 15 lueurs, une à la fois, à toucher avant qu'elles s'éteignent.
function JeuChasse({ zone, sons, onRate, onReussi }) {
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(() => auHasard(zone));
  const eteinte = useRef(new Animated.Value(1)).current;
  const minuteur = useRef(null);
  useEffect(() => {
    setPos(auHasard(zone));
    eteinte.setValue(1);
    Animated.timing(eteinte, { toValue: 0, duration: dureeLueur(index), useNativeDriver: true }).start();
    minuteur.current = setTimeout(onRate, dureeLueur(index));
    return () => clearTimeout(minuteur.current);
  }, [index]);
  const toucher = () => {
    clearTimeout(minuteur.current);
    jouerSon('bulle-eclatee', sons);
    if (index + 1 >= LUEURS_NB) onReussi(); else setIndex(index + 1);
  };
  return (
    <Animated.View style={[styles.lueur, { left: pos.x, top: pos.y, opacity: eteinte,
      transform: [{ scale: eteinte.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }] }]}>
      <TouchableOpacity activeOpacity={0.6} onPressIn={toucher} style={styles.toucher}>
        <Image source={LUEUR} style={styles.image} resizeMode="contain" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// 🎯 LUEUR DORÉE : à chaque tour, des lueurs bleues (pièges) et UNE dorée ; seule la dorée se touche.
function JeuDoree({ zone, sons, onRate, onReussi }) {
  const [tour, setTour] = useState(0);
  const [lueurs, setLueurs] = useState([]);
  const minuteur = useRef(null);
  useEffect(() => {
    const n = doreeNbLueurs(tour), places = [];
    for (let essai = 0; places.length < n && essai < 200; essai++) {
      const p = auHasard(zone);
      if (places.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > TAILLE * 1.15)) places.push(p);
    }
    const doree = Math.floor(Math.random() * places.length);
    setLueurs(places.map((p, k) => ({ ...p, doree: k === doree })));
    minuteur.current = setTimeout(onRate, doreeDuree(tour));
    return () => clearTimeout(minuteur.current);
  }, [tour]);
  const toucher = (l) => {
    clearTimeout(minuteur.current);
    if (!l.doree) { onRate(); return; }
    jouerSon('bulle-eclatee', sons);
    if (tour + 1 >= DOREE_TOURS) onReussi(); else setTour(tour + 1);
  };
  return lueurs.map((l, k) => (
    <View key={tour + '-' + k} style={[styles.lueur, { left: l.x, top: l.y }]}>
      <TouchableOpacity activeOpacity={0.6} onPressIn={() => toucher(l)} style={styles.toucher}>
        <Image source={l.doree ? LUEUR_OR : LUEUR} style={styles.image} resizeMode="contain" />
      </TouchableOpacity>
    </View>
  ));
}

// 🥁 BATTEMENT DE TRANSE : un anneau se resserre sur le cercle ; taper quand il le touche (± 150 ms). 3 ratés : perdu.
function JeuTranse({ sons, onRate, onReussi }) {
  const [temps, setTemps] = useState(0);
  const [rates, setRates] = useState(0);
  const [eclair, setEclair] = useState(null); // 'ok' | 'rate'
  const anneau = useRef(new Animated.Value(0)).current;
  const cible = useRef(0);       // instant où l'anneau touche le cercle
  const resolu = useRef(false);  // ce temps est-il déjà joué ?
  const ratesRef = useRef(0);
  const minuteur = useRef(null);
  const rater = () => {
    ratesRef.current += 1;
    setRates(ratesRef.current);
    setEclair('rate');
    jouerSon('refus', sons);
    if (ratesRef.current >= TRANSE_RATES_MAX) { clearTimeout(minuteur.current); onRate(); return true; }
    return false;
  };
  useEffect(() => {
    const iv = transeIntervalle(temps);
    cible.current = Date.now() + iv;
    resolu.current = false;
    setEclair(null);
    anneau.setValue(0);
    Animated.timing(anneau, { toValue: 1, duration: iv, useNativeDriver: true }).start();
    // Fin de la fenêtre du temps : pas tapé à temps = un raté ; puis le temps suivant (ou la fin).
    minuteur.current = setTimeout(() => {
      if (!resolu.current && rater()) return;
      if (temps + 1 >= TRANSE_TEMPS) { if (ratesRef.current < TRANSE_RATES_MAX) onReussi(); } else setTemps(temps + 1);
    }, iv + TRANSE_FENETRE_MS);
    return () => clearTimeout(minuteur.current);
  }, [temps]);
  const toucher = () => {
    if (resolu.current) { rater(); return; } // deuxième tap sur le même temps : à contretemps
    if (Math.abs(Date.now() - cible.current) <= TRANSE_FENETRE_MS) {
      resolu.current = true;
      setEclair('ok');
      jouerSon('bulle-eclatee', sons);
    } else rater();
  };
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={toucher} style={styles.transeZone}>
      <View style={styles.transeRates}>
        {Array.from({ length: rates }).map((_, k) => <Text key={k} style={styles.transeCroix}>✕</Text>)}
      </View>
      <View style={styles.transeCentre}>
        <Animated.View style={[styles.transeAnneau, {
          transform: [{ scale: anneau.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }],
          opacity: anneau.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />
        <View style={[styles.transeCercle, eclair === 'ok' && styles.transeOk, eclair === 'rate' && styles.transeRate]} />
      </View>
    </TouchableOpacity>
  );
}

export default function MiniJeu({ jeu, sons = true, vibrations = true, onGagne, onFermer }) {
  const visible = !!jeu;
  const def = miniJeu(jeu);
  const [phase, setPhase] = useState('intro'); // intro → jeu → perdu | gagne
  const [decompte, setDecompte] = useState(0);
  const [recompense, setRecompense] = useState(null);
  const [zone, setZone] = useState({ w: 0, h: 0 });
  const tremble = useRef(new Animated.Value(0)).current;
  const minuteur = useRef(null);
  const fini = useRef(false);
  const nettoyer = () => { if (minuteur.current) { clearTimeout(minuteur.current); minuteur.current = null; } };

  useEffect(() => {
    if (!visible) return undefined;
    fini.current = false;
    setPhase('intro'); setDecompte(0); setRecompense(null);
    let k = 0;
    const suivant = () => {
      k += 1;
      if (k < DECOMPTE.length) { setDecompte(k); minuteur.current = setTimeout(suivant, DECOMPTE_PAS_MS); } else setPhase('jeu');
    };
    minuteur.current = setTimeout(suivant, DECOMPTE_PAS_MS * 1.5);
    return nettoyer;
  }, [visible, jeu]);

  const perdre = () => {
    if (fini.current) return;
    fini.current = true;
    nettoyer();
    setPhase('perdu');
    jouerSon('defaite', sons);
    if (vibrations) Vibration.vibrate(250);
    Animated.sequence([10, -10, 8, -8, 5, -5, 0].map((v) => Animated.timing(tremble, { toValue: v, duration: 45, useNativeDriver: true }))).start();
    minuteur.current = setTimeout(() => onFermer && onFermer(), PERDU_MS);
  };
  const gagner = () => {
    if (fini.current) return;
    fini.current = true;
    nettoyer();
    setRecompense(onGagne ? onGagne() : null);
    setPhase('gagne');
    jouerSon('recompense', sons);
    minuteur.current = setTimeout(() => onFermer && onFermer(), 2200);
  };

  if (!visible) return null;
  const Jeu = jeu === 'doree' ? JeuDoree : jeu === 'transe' ? JeuTranse : JeuChasse;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => { nettoyer(); if (onFermer) onFermer(); }}>
      <Animated.View style={[styles.fond, { transform: [{ translateX: tremble }] }]}
        onLayout={(e) => setZone({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {phase === 'intro' && (
          <View style={styles.centre}>
            <Text style={styles.titre}>{def.titre}</Text>
            <Text style={styles.consigne}>{def.tuto}</Text>
            <Text style={styles.decompte}>{DECOMPTE[decompte]}</Text>
          </View>
        )}
        {phase === 'jeu' && <Jeu zone={zone} sons={sons} onRate={perdre} onReussi={gagner} />}
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
  consigne: { color: '#e8e4ff', fontSize: 16, marginTop: 12, textAlign: 'center' },
  decompte: { color: '#ffffff', fontSize: 64, fontWeight: '900', marginTop: 34 },
  lueur: { position: 'absolute', width: TAILLE, height: TAILLE },
  toucher: { width: TAILLE, height: TAILLE },
  image: { width: TAILLE, height: TAILLE },
  perdu: { color: '#ff3b3b', fontSize: 56, fontWeight: '900', letterSpacing: 4, textShadowColor: '#000', textShadowRadius: 10 },
  eclat: { width: 220, height: 220, position: 'absolute' },
  gagne: { color: '#fff3b0', fontSize: 28, fontWeight: '900', textAlign: 'center', textShadowColor: '#7a4a00', textShadowRadius: 8 },
  transeZone: { flex: 1 },
  transeRates: { position: 'absolute', top: 70, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  transeCroix: { color: '#ff3b3b', fontSize: 30, fontWeight: '900', marginHorizontal: 8 },
  transeCentre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  transeAnneau: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 5, borderColor: '#7fd8ff' },
  transeCercle: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(127,216,255,0.25)', borderWidth: 3, borderColor: '#bfefff' },
  transeOk: { backgroundColor: 'rgba(80,220,120,0.55)' },
  transeRate: { backgroundColor: 'rgba(255,60,60,0.55)' },
});

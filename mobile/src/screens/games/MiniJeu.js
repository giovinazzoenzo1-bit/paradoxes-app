// 🎮 MINI-JEUX — écran commun (logique et règles : games/clicker/miniJeux.js).
// Fenêtre plein écran (Modal) : aucun toucher n'atteint l'œuf, rien ne compte pour les défis ni pour le rythme mesuré.
// Déroulé commun (demandes de l'auteur) : titre + TUTO d'une seule phrase pendant le décompte 3, 2, 1 → le jeu → une ratée :
// « PERDU » en rouge 1 s, écran qui tremble, son de défaite → réussi : une lueur dorée révèle la récompense.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, Animated, StyleSheet, Vibration } from 'react-native';
import {
  miniJeu, LUEURS_NB, dureeLueur, PERDU_MS, DECOMPTE, DECOMPTE_PAS_MS, LUEUR_DERIVE_PX,
  DOREE_TOURS, doreeNbLueurs, doreeDuree, TRANSE_TEMPS, TRANSE_FENETRE_MS, TRANSE_RATES_MAX, transeIntervalle,
  BONNETEAU_TOURS, bonneteauEchanges, bonneteauDuree, BONNETEAU_MONTRE_MS, melangeBonneteau,
} from '../../games/clicker/miniJeux';
import { jouerSon } from './sonsBoutique';

const LUEUR = require('../../../assets/fenetres/lueur-cyan.png');
const LUEUR_OR = require('../../../assets/grimoire/lueur-or.png');
const OEUF = require('../../../assets/egg/egg-0-endormi.png');
const TAILLE = 88;

// Position au hasard dans la zone de jeu (marges : titre en haut, bas de l'écran libre).
function auHasard(zone) {
  const w = zone.w || 360, h = zone.h || 640;
  return { x: 24 + Math.random() * Math.max(1, w - TAILLE - 48), y: 120 + Math.random() * Math.max(1, h - TAILLE - 260) };
}
// Dérive (demande de l'auteur : les lumières bougent) : un point d'arrivée au hasard, à LUEUR_DERIVE_PX au plus, dans la zone.
function derive(zone, p) {
  const w = zone.w || 360, h = zone.h || 640;
  const a = Math.random() * Math.PI * 2, d = LUEUR_DERIVE_PX * (0.5 + Math.random() * 0.5);
  const x = Math.min(Math.max(12, p.x + Math.cos(a) * d), w - TAILLE - 12), y = Math.min(Math.max(100, p.y + Math.sin(a) * d), h - TAILLE - 140);
  return { dx: x - p.x, dy: y - p.y };
}

// ✨ CHASSE AUX LUEURS : 15 lueurs, une à la fois, à toucher avant qu'elles s'éteignent.
function JeuChasse({ zone, sons, onRate, onReussi }) {
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(() => auHasard(zone));
  const eteinte = useRef(new Animated.Value(1)).current;
  const bouge = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const minuteur = useRef(null);
  useEffect(() => {
    const p = auHasard(zone), d = derive(zone, p);
    setPos(p);
    eteinte.setValue(1);
    bouge.setValue({ x: 0, y: 0 });
    Animated.timing(eteinte, { toValue: 0, duration: dureeLueur(index), useNativeDriver: true }).start();
    Animated.timing(bouge, { toValue: { x: d.dx, y: d.dy }, duration: dureeLueur(index), useNativeDriver: true }).start();
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
      transform: [...bouge.getTranslateTransform(), { scale: eteinte.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }] }]}>
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
    setLueurs(places.map((p, k) => {
      const d = derive(zone, p), v = new Animated.ValueXY({ x: 0, y: 0 });
      Animated.timing(v, { toValue: { x: d.dx, y: d.dy }, duration: doreeDuree(tour), useNativeDriver: true }).start();
      return { ...p, doree: k === doree, v };
    }));
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
    <Animated.View key={tour + '-' + k} style={[styles.lueur, { left: l.x, top: l.y, transform: l.v.getTranslateTransform() }]}>
      <TouchableOpacity activeOpacity={0.6} onPressIn={() => toucher(l)} style={styles.toucher}>
        <Image source={l.doree ? LUEUR_OR : LUEUR} style={styles.image} resizeMode="contain" />
      </TouchableOpacity>
    </Animated.View>
  ));
}

// 🥁 BATTEMENT DE TRANSE : un anneau se resserre sur le cercle ; taper quand il le touche (± 150 ms). 3 ratés : perdu.
function JeuTranse({ zone, sons, onRate, onReussi }) {
  const [temps, setTemps] = useState(0);
  const [rates, setRates] = useState(0);
  const [eclair, setEclair] = useState(null); // 'ok' | 'rate'
  const [place, setPlace] = useState(null);    // le cercle change de place à chaque temps
  const flotte = useRef(new Animated.Value(0)).current;
  const anneau = useRef(new Animated.Value(0)).current;
  const cible = useRef(0);       // instant où l'anneau touche le cercle
  const resolu = useRef(false);  // ce temps est-il déjà joué ?
  const ratesRef = useRef(0);
  const minuteur = useRef(null);
  const rater = () => {
    ratesRef.current += 1;
    setRates(ratesRef.current);
    setEclair('rate');
    jouerSon('rate', sons);
    if (ratesRef.current >= TRANSE_RATES_MAX) { clearTimeout(minuteur.current); onRate(); return true; }
    return false;
  };
  useEffect(() => {
    const iv = transeIntervalle(temps);
    cible.current = Date.now() + iv;
    resolu.current = false;
    setEclair(null);
    const w = zone.w || 360, h = zone.h || 640;
    setPlace({ x: 40 + Math.random() * Math.max(1, w - 220), y: 150 + Math.random() * Math.max(1, h - 420) });
    flotte.setValue(0);
    Animated.timing(flotte, { toValue: 1, duration: iv, useNativeDriver: true }).start();
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
      jouerSon('impact-parfait', sons);
    } else rater();
  };
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={toucher} style={styles.transeZone}>
      <View style={styles.transeRates}>
        {Array.from({ length: rates }).map((_, k) => <Text key={k} style={styles.transeCroix}>✕</Text>)}
      </View>
      <Animated.View style={[styles.transePlace, place ? { left: place.x, top: place.y } : null, {
        transform: [{ translateY: flotte.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -8, 0] }) }] }]}>
        <Animated.View style={[styles.transeAnneau, {
          transform: [{ scale: anneau.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }],
          opacity: anneau.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />
        <View style={[styles.transeCercle, eclair === 'ok' && styles.transeOk, eclair === 'rate' && styles.transeRate]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// 🥚 BONNETEAU D'ŒUFS : la lueur se montre sous un œuf, les 3 œufs se mélangent, toucher le bon. 3 manches.
const OEUF_L = 120, OEUF_H = 150; // assez grands pour viser au doigt (l'image a des marges)
function JeuBonneteau({ zone, sons, onRate, onReussi }) {
  const [tour, setTour] = useState(0);
  const [etape, setEtape] = useState('montre'); // montre → melange → choix → revele
  const lueurDans = useRef(1);                 // l'ŒUF (0, 1, 2) qui cache la lueur
  const placeDe = useRef([0, 1, 2]);            // place (0 gauche, 1 milieu, 2 droite) de chaque œuf
  const xy = useRef([0, 1, 2].map(() => new Animated.ValueXY({ x: 0, y: 0 }))).current;
  const minuteur = useRef(null);
  const w = zone.w || 360, h = zone.h || 640;
  const xPlace = (p) => w / 2 - OEUF_L / 2 + (p - 1) * Math.min(120, (w - OEUF_L - 30) / 2);
  const yBase = h * 0.42;
  useEffect(() => {
    placeDe.current = [0, 1, 2];
    lueurDans.current = Math.floor(Math.random() * 3);
    xy.forEach((v, k) => v.setValue({ x: xPlace(k), y: yBase }));
    setEtape('montre');
    minuteur.current = setTimeout(() => {
      setEtape('melange');
      const echanges = melangeBonneteau(bonneteauEchanges(tour)), d = bonneteauDuree(tour);
      const etapes = echanges.map(([pa, pb]) => () => {
        const ea = placeDe.current.indexOf(pa), eb = placeDe.current.indexOf(pb);
        placeDe.current[ea] = pb; placeDe.current[eb] = pa;
        return Animated.parallel([
          Animated.timing(xy[ea], { toValue: { x: xPlace(pb), y: yBase }, duration: d, useNativeDriver: true }),
          Animated.sequence([Animated.timing(xy[eb], { toValue: { x: (xPlace(pa) + xPlace(pb)) / 2, y: yBase - 46 }, duration: d / 2, useNativeDriver: true }),
            Animated.timing(xy[eb], { toValue: { x: xPlace(pa), y: yBase }, duration: d / 2, useNativeDriver: true })]),
        ]);
      });
      const jouer = (k) => { if (k >= etapes.length) { setEtape('choix'); return; } etapes[k]().start(() => jouer(k + 1)); };
      jouer(0);
    }, BONNETEAU_MONTRE_MS);
    return () => clearTimeout(minuteur.current);
  }, [tour]);
  const toucher = (k) => {
    if (etape !== 'choix') return;
    if (k !== lueurDans.current) { onRate(); return; }
    setEtape('revele');
    jouerSon('bulle-eclatee', sons);
    minuteur.current = setTimeout(() => { if (tour + 1 >= BONNETEAU_TOURS) onReussi(); else setTour(tour + 1); }, 700);
  };
  return [0, 1, 2].map((k) => (
    <Animated.View key={tour + '-' + k} style={[styles.oeufPlace, { transform: xy[k].getTranslateTransform() }]}>
      {(etape === 'montre' || etape === 'revele') && k === lueurDans.current ? (
        <Image source={LUEUR_OR} style={styles.oeufLueur} resizeMode="contain" />
      ) : null}
      <TouchableOpacity activeOpacity={0.7} onPressIn={() => toucher(k)}>
        <Image source={OEUF} style={[styles.oeufImage, (etape === 'montre' || etape === 'revele') && k === lueurDans.current && styles.oeufSouleve]} resizeMode="contain" />
      </TouchableOpacity>
    </Animated.View>
  ));
}

// 🎆 Feux d'artifice autour du gain (demande de l'auteur) : 3 gerbes de 12 étincelles, décalées dans le temps.
const COULEURS_FEU = ['#FFD54A', '#7fd8ff', '#ff8a3d', '#b6ff7a', '#ffffff'];
function Gerbe({ x, y, retard }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.sequence([Animated.delay(retard), Animated.timing(t, { toValue: 1, duration: 900, useNativeDriver: true })]).start(); }, []);
  return Array.from({ length: 12 }).map((_, k) => {
    const a = (k / 12) * Math.PI * 2;
    return (
      <Animated.View key={k} style={[styles.etincelle, { left: x, top: y, backgroundColor: COULEURS_FEU[k % COULEURS_FEU.length],
        opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * 85] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * 85 + 20] }) }] }]} />
    );
  });
}
function FeuxArtifice() {
  return (
    <View style={[styles.feux, { pointerEvents: 'none' }]}>
      <Gerbe x={70} y={110} retard={0} />
      <Gerbe x={250} y={90} retard={280} />
      <Gerbe x={160} y={300} retard={560} />
    </View>
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
  const arrivee = useRef(new Animated.Value(0)).current; // le gain « arrive sur le joueur » (de loin, en élastique)
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
    jouerSon('victoire', sons); // demande de l'auteur : le son de VICTOIRE
    arrivee.setValue(0);
    Animated.spring(arrivee, { toValue: 1, friction: 3, tension: 55, useNativeDriver: true }).start(); // élastique
    minuteur.current = setTimeout(() => onFermer && onFermer(), 2800);
  };

  if (!visible) return null;
  const Jeu = jeu === 'doree' ? JeuDoree : jeu === 'transe' ? JeuTranse : jeu === 'bonneteau' ? JeuBonneteau : JeuChasse;
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
            <FeuxArtifice />
            <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [
              { scale: arrivee.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) },
              { translateY: arrivee.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] }) }] }}>
              <Image source={LUEUR_OR} style={styles.eclat} resizeMode="contain" />
              <Text style={styles.gagne}>{recompense && recompense.texte ? recompense.texte : 'Bravo !'}</Text>
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'transparent' }, // demande de l'auteur : PAS de fond noir pendant les mini-jeux
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  titre: { color: '#bfefff', fontSize: 30, fontWeight: '800', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 } },
  consigne: { color: '#ffffff', fontSize: 16, marginTop: 12, textAlign: 'center', fontWeight: '700', textShadowColor: '#000', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  decompte: { color: '#ffffff', fontSize: 64, fontWeight: '900', marginTop: 34, textShadowColor: '#000', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } },
  lueur: { position: 'absolute', width: TAILLE, height: TAILLE },
  toucher: { width: TAILLE, height: TAILLE },
  image: { width: TAILLE, height: TAILLE },
  perdu: { color: '#ff3b3b', fontSize: 56, fontWeight: '900', letterSpacing: 4, textShadowColor: '#000', textShadowRadius: 10 },
  eclat: { width: 220, height: 220, position: 'absolute' },
  gagne: { color: '#fff3b0', fontSize: 28, fontWeight: '900', textAlign: 'center', textShadowColor: '#7a4a00', textShadowRadius: 8 },
  transeZone: { flex: 1 },
  transeRates: { position: 'absolute', top: 70, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', zIndex: 2 },
  transeCroix: { color: '#ff3b3b', fontSize: 30, fontWeight: '900', marginHorizontal: 8, textShadowColor: '#000', textShadowRadius: 6 },
  transePlace: { position: 'absolute', width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  feux: { position: 'absolute', top: '22%', left: '50%', marginLeft: -165, width: 330, height: 380 },
  oeufPlace: { position: 'absolute', left: 0, top: 0, width: OEUF_L, height: OEUF_H, alignItems: 'center', justifyContent: 'flex-end' },
  oeufImage: { width: OEUF_L, height: OEUF_H },
  oeufSouleve: { transform: [{ translateY: -38 }] }, // l'œuf se soulève : on voit la lueur dessous
  oeufLueur: { position: 'absolute', bottom: -6, width: 70, height: 70 },
  etincelle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  transeAnneau: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 5, borderColor: '#7fd8ff' },
  transeCercle: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(127,216,255,0.25)', borderWidth: 3, borderColor: '#bfefff' },
  transeOk: { backgroundColor: 'rgba(80,220,120,0.55)' },
  transeRate: { backgroundColor: 'rgba(255,60,60,0.55)' },
});

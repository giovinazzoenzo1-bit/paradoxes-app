// 🎮 MINI-JEUX — écran commun (logique et règles : games/clicker/miniJeux.js).
// Fenêtre plein écran (Modal) : aucun toucher n'atteint l'œuf, rien ne compte pour les défis ni pour le rythme mesuré.
// Déroulé commun (demandes de l'auteur) : titre + TUTO d'une seule phrase pendant le décompte 3, 2, 1 → le jeu → une ratée :
// « PERDU » en rouge 1 s, écran qui tremble, son de défaite → réussi : une lueur dorée révèle la récompense.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, Animated, StyleSheet, Vibration, Easing } from 'react-native';
import {
  miniJeu, LUEURS_NB, dureeLueur, PERDU_MS, DECOMPTE, DECOMPTE_PAS_MS, LUEUR_DERIVE_PX,
  DOREE_TOURS, doreeNbLueurs, doreeDuree, TRANSE_TEMPS, TRANSE_FENETRE_MS, TRANSE_RATES_MAX, transeIntervalle,
  BONNETEAU_TOURS, bonneteauEchanges, bonneteauDuree, BONNETEAU_MONTRE_MS, melangeBonneteau,
  ROUE_RUNES, ROUE_TOURS, roueVitesse, roueAligne, ROUE_PASSAGES_MAX,
  COFFRE_BROCHES, coffreLargeur, coffrePeriode, coffreAiguille, coffreDansZone, COFFRE_CYCLES_MAX,
  SPORES_TOTAL, SPORE_SOL, sporeIntervalle, sporeChute, planSpores,
  RITUEL_SYMBOLES, RITUEL_TOURS, rituelLongueur, rituelPas, sequenceRituel, RITUEL_ROTATION_MS, OEUF_CENTRE_Y, RITUEL_NOTES,
  PILLEURS_NB, PILLEURS_BUISSONS, pilleurDuree, pilleurIntervalle, planPilleurs, BARRE_BAS_H,
} from '../../games/clicker/miniJeux';
import { jouerSon } from './sonsBoutique';

const LUEUR = require('../../../assets/fenetres/lueur-cyan.png');
const LUEUR_OR = require('../../../assets/grimoire/lueur-or.png');
const OEUF = require('../../../assets/egg/egg-0-endormi.png');
const OEUF_LUMINEUX = require('../../../assets/egg/egg-3-lumineux.png');
const COFFRE = require('../../../assets/pubs/coffre.png');
const PILLEUR = require('../../../assets/minijeux/pilleur.png');
const PILLEUR_TOUCHE = require('../../../assets/minijeux/pilleur-touche.png');
const BUISSON = require('../../../assets/minijeux/buisson.png');
const SYMBOLES = {
  feu: require('../../../assets/combat/effets/feu.png'), eau: require('../../../assets/combat/effets/eau.png'),
  foudre: require('../../../assets/combat/effets/foudre.png'), lumiere: require('../../../assets/combat/effets/lumiere.png'),
  tenebres: require('../../../assets/combat/effets/tenebres.png'), magie: require('../../../assets/combat/effets/magie.png'),
};
const RUNES = ['affinite', 'arcane', 'butin', 'celerite', 'dexterite', 'force', 'resilience', 'vitalite'].map((n) => ({
  affinite: require('../../../assets/icons/runes/affinite.png'), arcane: require('../../../assets/icons/runes/arcane.png'),
  butin: require('../../../assets/icons/runes/butin.png'), celerite: require('../../../assets/icons/runes/celerite.png'),
  dexterite: require('../../../assets/icons/runes/dexterite.png'), force: require('../../../assets/icons/runes/force.png'),
  resilience: require('../../../assets/icons/runes/resilience.png'), vitalite: require('../../../assets/icons/runes/vitalite.png'),
}[n]));
const TAILLE = 88;

// ✨ LUEUR BIEN VISIBLE (demande de l'auteur : « on ne la voit pas assez » sur le décor) : le halo, un cœur blanc lumineux et
// un anneau de couleur, qui pulsent. couleur : 'cyan' ou 'or'.
function LueurVisible({ couleur = 'cyan', taille = TAILLE }) {
  // ⚠️ L'auteur : l'anneau et le cœur blanc donnaient « des ronds, pas des lueurs ». Désormais le MÊME halo empilé 3 fois
  // (grand qui respire, moyen, petit) : le centre devient très lumineux, les bords restent doux.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const b = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: true })]));
    b.start();
    return () => b.stop();
  }, []);
  const src = couleur === 'or' ? LUEUR_OR : LUEUR;
  return (
    <View style={{ width: taille, height: taille, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Image source={src} resizeMode="contain" style={{ position: 'absolute', width: taille * 1.6, height: taille * 1.6, opacity: 0.9,
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.15] }) }] }} />
      <Image source={src} resizeMode="contain" style={{ position: 'absolute', width: taille * 1.05, height: taille * 1.05 }} />
      <Image source={src} resizeMode="contain" style={{ position: 'absolute', width: taille * 0.6, height: taille * 0.6 }} />
    </View>
  );
}

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
        <LueurVisible couleur="cyan" />
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
        {l.doree ? <LueurVisible couleur="or" /> : <Image source={LUEUR} style={[styles.image, { opacity: 0.8 }]} resizeMode="contain" />}
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
        <View style={[styles.transeCercle, eclair === 'ok' && styles.transeOk, eclair === 'rate' && styles.transeRate]}>
          <Image source={OEUF_LUMINEUX} style={styles.transeOeuf} resizeMode="contain" />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// 🥚 BONNETEAU D'ŒUFS : la lueur se montre sous un œuf, les 3 œufs se mélangent, toucher le bon. 3 manches.
const OEUF_L = 120, OEUF_H = 150; // assez grands pour viser au doigt (l'image a des marges)
function JeuBonneteau({ zone, sons, onRate, onReussi }) {
  const [tour, setTour] = useState(0);
  const [etape, setEtape] = useState('montre'); // montre → melange → choix → revele
  // ⚠️ BUG RÉEL (signalé par l'auteur, reproduit au banc) : l'œuf de la lueur vivait dans une RÉFÉRENCE changée dans
  // l'effet ; au 1er tour setEtape('montre') ne changeait rien (déjà 'montre') → aucun rendu → la lueur se montrait sous
  // l'œuf 1 (valeur de départ) alors que la réponse était un autre œuf. Désormais un ÉTAT (le rendu le lit) + la référence
  // (les gestes la lisent), posés ensemble.
  const lueurDans = useRef(1);                 // l'ŒUF (0, 1, 2) qui cache la lueur — pour les gestes
  const [lueur, setLueur] = useState(1);       // le même — pour le RENDU
  const placeDe = useRef([0, 1, 2]);            // place (0 gauche, 1 milieu, 2 droite) de chaque œuf
  const xy = useRef([0, 1, 2].map(() => new Animated.ValueXY({ x: 0, y: 0 }))).current;
  const minuteur = useRef(null);
  const w = zone.w || 360, h = zone.h || 640;
  const xPlace = (p) => w / 2 - OEUF_L / 2 + (p - 1) * Math.min(120, (w - OEUF_L - 30) / 2);
  const yBase = h * 0.42;
  useEffect(() => {
    placeDe.current = [0, 1, 2];
    lueurDans.current = Math.floor(Math.random() * 3);
    setLueur(lueurDans.current);
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
    // Mauvais œuf : on MONTRE d'abord où était la lueur (0,9 s), puis « PERDU » (l'auteur : « pas de lueur en 3e manche »).
    if (k !== lueurDans.current) { setEtape('revele'); jouerSon('rate', sons); minuteur.current = setTimeout(onRate, 900); return; }
    setEtape('revele');
    jouerSon('bulle-eclatee', sons);
    minuteur.current = setTimeout(() => { if (tour + 1 >= BONNETEAU_TOURS) onReussi(); else setTour(tour + 1); }, 700);
  };
  return [0, 1, 2].map((k) => (
    <Animated.View key={tour + '-' + k} style={[styles.oeufPlace, { transform: xy[k].getTranslateTransform() }]}>
      {(etape === 'montre' || etape === 'revele') && k === lueur ? (
        <View style={styles.oeufLueur}><LueurVisible couleur="or" taille={76} /></View>
      ) : null}
      <TouchableOpacity activeOpacity={0.7} onPressIn={() => toucher(k)}>
        <Image source={OEUF} style={[styles.oeufImage, (etape === 'montre' || etape === 'revele') && k === lueur && styles.oeufSouleve]} resizeMode="contain" />
      </TouchableOpacity>
    </Animated.View>
  ));
}

// 🌀 ROUE DES RUNES : la roue tourne, une rune est dorée ; taper (n'importe où) quand elle passe sous la flèche.
const ROUE_R = 112, RUNE_T = 54;
function JeuRoue({ sons, onRate, onReussi }) {
  const [tour, setTour] = useState(0);
  const [doree, setDoree] = useState(() => Math.floor(Math.random() * ROUE_RUNES));
  const [depart, setDepart] = useState(0);   // angle (degrés) au début du tour : la roue ne saute jamais
  const rot = useRef(new Animated.Value(0)).current;
  const debut = useRef(0), sens = useRef(1), angle0 = useRef(0), boucle = useRef(null), minuteur = useRef(null);
  const angleMaintenant = () => angle0.current + sens.current * roueVitesse(tour) * ((Date.now() - debut.current) / 1000);
  useEffect(() => {
    const v = roueVitesse(tour), periode = 360 / v * 1000;
    sens.current = tour % 2 === 0 ? 1 : -1;  // sens alterné à chaque tour
    angle0.current = depart;
    debut.current = Date.now();
    rot.setValue(0);
    boucle.current = Animated.loop(Animated.timing(rot, { toValue: 1, duration: periode, easing: Easing.linear, useNativeDriver: true }));
    boucle.current.start();
    minuteur.current = setTimeout(onRate, periode * ROUE_PASSAGES_MAX); // la rune passe 3 fois sans tap : perdu
    return () => { clearTimeout(minuteur.current); if (boucle.current) boucle.current.stop(); };
  }, [tour]);
  const toucher = () => {
    const a = angleMaintenant();
    if (!roueAligne(a, doree)) { onRate(); return; }
    jouerSon('impact-parfait', sons);
    clearTimeout(minuteur.current);
    if (tour + 1 >= ROUE_TOURS) { onReussi(); return; }
    setDepart(((a % 360) + 360) % 360);
    setDoree((doree + 2 + Math.floor(Math.random() * (ROUE_RUNES - 3))) % ROUE_RUNES); // jamais la même, jamais la voisine
    setTour(tour + 1);
  };
  const fin = depart + (tour % 2 === 0 ? 360 : -360);
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={toucher} style={styles.roueZone}>
      <Animated.View style={[styles.roue, { transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: [depart + 'deg', fin + 'deg'] }) }] }]}>
        {RUNES.map((src, k) => {
          const a = (k * 360 / ROUE_RUNES) * Math.PI / 180;
          const x = ROUE_R + Math.sin(a) * ROUE_R - RUNE_T / 2, y = ROUE_R - Math.cos(a) * ROUE_R - RUNE_T / 2;
          return (
            <View key={k} style={[styles.roueRune, { left: x, top: y }]}>
              {k === doree ? <View style={styles.roueHalo}><LueurVisible couleur="or" taille={RUNE_T * 1.7} /></View> : null}
              <Image source={src} style={[styles.roueImage, k !== doree && styles.roueEteinte]} resizeMode="contain" />
            </View>
          );
        })}
      </Animated.View>
      <Text style={styles.roueFleche}>▲</Text>
    </TouchableOpacity>
  );
}

// 🔐 COFFRE À BROCHES : l'aiguille fait l'aller-retour ; taper (n'importe où) quand elle est dans la zone verte.
const JAUGE_L = 280;
function JeuCoffre({ sons, onRate, onReussi }) {
  const [broche, setBroche] = useState(0);
  const [centre, setCentre] = useState(() => 0.25 + Math.random() * 0.5);
  const aiguille = useRef(new Animated.Value(0)).current;
  const debut = useRef(0), boucle = useRef(null), minuteur = useRef(null);
  useEffect(() => {
    const per = coffrePeriode(broche);
    debut.current = Date.now();
    aiguille.setValue(0);
    boucle.current = Animated.loop(Animated.sequence([
      Animated.timing(aiguille, { toValue: 1, duration: per / 2, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(aiguille, { toValue: 0, duration: per / 2, easing: Easing.linear, useNativeDriver: true })]));
    boucle.current.start();
    minuteur.current = setTimeout(onRate, per * COFFRE_CYCLES_MAX); // 4 allers-retours sans tap : perdu
    return () => { clearTimeout(minuteur.current); if (boucle.current) boucle.current.stop(); };
  }, [broche]);
  const toucher = () => {
    const pos = coffreAiguille(Date.now() - debut.current, coffrePeriode(broche));
    if (!coffreDansZone(pos, centre, coffreLargeur(broche))) { onRate(); return; }
    jouerSon('impact-parfait', sons);
    clearTimeout(minuteur.current);
    if (broche + 1 >= COFFRE_BROCHES) { onReussi(); return; }
    const l = coffreLargeur(broche + 1);
    setCentre(l / 2 + 0.06 + Math.random() * (1 - l - 0.12));
    setBroche(broche + 1);
  };
  const larg = coffreLargeur(broche) * JAUGE_L;
  return (
    <TouchableOpacity activeOpacity={1} onPressIn={toucher} style={styles.coffreZone}>
      <Image source={COFFRE} style={styles.coffreImage} resizeMode="contain" />
      <View style={styles.coffreBroches}>
        {Array.from({ length: COFFRE_BROCHES }).map((_, k) => (
          <View key={k} style={[styles.coffreBroche, k < broche && styles.coffreBrocheLevee]}><Text style={styles.coffreBrocheTexte}>{k < broche ? '🔓' : '🔒'}</Text></View>
        ))}
      </View>
      <View style={styles.coffreJauge}>
        <View style={[styles.coffreVert, { left: centre * JAUGE_L - larg / 2, width: larg }]} />
        <Animated.View style={[styles.coffreAiguille, { transform: [{ translateX: aiguille.interpolate({ inputRange: [0, 1], outputRange: [0, JAUGE_L] }) }] }]} />
      </View>
    </TouchableOpacity>
  );
}

// ✨ PLUIE DE SPORES : elles tombent vers le nid (le vrai, visible derrière). Seules les DORÉES se touchent (+1 Griffe
// chacune, toute la récompense) ; les bleues sont des leurres qui ne réagissent pas (le doigt passe au travers).
const SPORE_T = 66;
function JeuSpores({ zone, sons, onRate, onReussi }) {
  const [spores, setSpores] = useState([]); // { id, x, chute (Animated.Value), couleur }
  const attrapees = useRef(0), restantes = useRef(SPORES_TOTAL), minuteurs = useRef([]), anims = useRef({}), fini = useRef(false);
  const w = zone.w || 360, h = zone.h || 640, ySol = h * SPORE_SOL - SPORE_T / 2;
  const finir = () => {
    if (fini.current) return;
    fini.current = true;
    if (attrapees.current > 0) onReussi({ griffes: attrapees.current }); else onRate();
  };
  const partie = () => { restantes.current -= 1; if (restantes.current <= 0) finir(); };
  useEffect(() => {
    let t = 0;
    planSpores().forEach((couleur, i) => {
      t += sporeIntervalle(i);
      minuteurs.current.push(setTimeout(() => {
        if (fini.current) return;
        const chute = new Animated.Value(0), id = i;
        const x = 24 + Math.random() * Math.max(1, w - SPORE_T - 48);
        setSpores((l) => [...l, { id, x, chute, couleur }]);
        const a = Animated.timing(chute, { toValue: 1, duration: sporeChute(i), easing: Easing.linear, useNativeDriver: true });
        anims.current[id] = a;
        a.start(({ finished }) => { if (!finished) return; setSpores((l) => l.filter((sp) => sp.id !== id)); partie(); });
      }, t));
    });
    return () => { fini.current = true; minuteurs.current.forEach(clearTimeout); Object.values(anims.current).forEach((a) => a.stop()); };
  }, []);
  const toucher = (sp) => {
    if (fini.current || sp.couleur !== 'or') return;
    const a = anims.current[sp.id];
    if (a) { delete anims.current[sp.id]; a.stop(); }
    setSpores((l) => l.filter((x) => x.id !== sp.id));
    jouerSon('bulle-eclatee', sons);
    attrapees.current += 1;
    partie();
  };
  return spores.map((sp) => (
    <Animated.View key={sp.id} style={[styles.spore, sp.couleur !== 'or' && { pointerEvents: 'none' }, { left: sp.x, top: 80, transform: [
      { translateY: sp.chute.interpolate({ inputRange: [0, 1], outputRange: [0, ySol - 80] }) },
      { translateX: sp.chute.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 14, 0, -14, 0] }) }] }]}>
      <TouchableOpacity activeOpacity={0.6} onPressIn={() => toucher(sp)}>
        <LueurVisible couleur={sp.couleur === 'or' ? 'or' : 'cyan'} taille={SPORE_T} />
      </TouchableOpacity>
    </Animated.View>
  ));
}

// 🔮 RITUEL DE L'ŒUF : 6 symboles tournent lentement autour de l'œuf ; une suite s'allume ; la refaire dans l'ordre.
const RITUEL_R = 150, SYM_L = 86, SYM_H = 64;
function JeuRituel({ zone, sons, onRate, onReussi }) {
  const [tour, setTour] = useState(0);
  const [etape, setEtape] = useState('montre'); // montre → joue
  const [allume, setAllume] = useState(null);   // symbole allumé (rendu)
  const sequence = useRef([]), pos = useRef(0), minuteurs = useRef([]);
  const tourne = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const b = Animated.loop(Animated.timing(tourne, { toValue: 1, duration: RITUEL_ROTATION_MS, easing: Easing.linear, useNativeDriver: true }));
    b.start();
    return () => b.stop();
  }, []);
  const nettoyer = () => { minuteurs.current.forEach(clearTimeout); minuteurs.current = []; };
  const plus = (ms, f) => minuteurs.current.push(setTimeout(f, ms));
  useEffect(() => {
    const n = rituelLongueur(tour), pas = rituelPas(tour);
    sequence.current = sequenceRituel(n);
    pos.current = 0;
    setEtape('montre');
    setAllume(null);
    sequence.current.forEach((sym, j) => {
      plus(600 + j * pas, () => { setAllume(sym); jouerSon(RITUEL_NOTES[sym], sons); }); // sa note
      plus(600 + j * pas + pas * 0.7, () => setAllume(null));
    });
    plus(600 + n * pas + 150, () => setEtape('joue'));
    return nettoyer;
  }, [tour]);
  const toucher = (k) => {
    if (etape !== 'joue') return;
    if (k !== sequence.current[pos.current]) { onRate(); return; }
    jouerSon(RITUEL_NOTES[k], sons); // la note du symbole touché
    setAllume(k);
    plus(220, () => setAllume(null));
    pos.current += 1;
    if (pos.current >= sequence.current.length) {
      setEtape('montre');
      plus(650, () => { if (tour + 1 >= RITUEL_TOURS) onReussi(); else setTour(tour + 1); });
    }
  };
  const w = zone.w || 360, h = zone.h || 640;
  const R = Math.min(RITUEL_R, (w - SYM_L) / 2 - 4); // l'anneau tient dans l'écran
  const cy = h * OEUF_CENTRE_Y; // centre de l'ŒUF de l'écran principal (demande de l'auteur)
  const angle = tourne.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const contre = tourne.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  return (
    <View style={styles.rituelZone}>
      <Animated.View style={[styles.rituelAnneau, { width: R * 2, height: R * 2, left: w / 2 - R, top: cy - R, transform: [{ rotate: angle }] }]}>
        {RITUEL_SYMBOLES.map((nom, k) => {
          const a = (k / RITUEL_SYMBOLES.length) * Math.PI * 2;
          const x = R + Math.sin(a) * R - SYM_L / 2, y = R - Math.cos(a) * R - SYM_H / 2;
          const on = allume === k;
          return (
            <Animated.View key={nom} style={[styles.rituelSymbole, { left: x, top: y, transform: [{ rotate: contre }, { scale: on ? 1.35 : 1 }] }]}>
              {on ? <View style={styles.rituelHalo}><LueurVisible couleur="or" taille={SYM_L} /></View> : null}
              <TouchableOpacity activeOpacity={0.7} onPressIn={() => toucher(k)}>
                <Image source={SYMBOLES[nom]} style={[styles.rituelImage, !on && styles.rituelEteint]} resizeMode="contain" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </Animated.View>
      <Text style={[styles.rituelEtat, { top: Math.max(90, cy - R - SYM_H - 40) }]}>{etape === 'joue' ? 'À toi !' : 'Regarde…'}</Text>
    </View>
  );
}

// 🦹 PILLEURS ENCAPUCHONNÉS : ils surgissent de derrière 5 buissons (le pilleur glisse dans une fenêtre qui le cache, le buisson
// est dessiné PAR-DESSUS) ; les lueurs sont des leurres.
// Rangée du haut : parts de l'écran ; rangée du BAS : posée pile au-dessus de la barre du bas (demande de l'auteur).
const BUISSONS_HAUT = [[0.2, 0.36], [0.5, 0.29], [0.8, 0.36]];
const BUISSONS_BAS_X = [0.2, 0.8];
const PIL_L = 104, PIL_H = 112, BUI_L = 128, BUI_H = 110;
function JeuPilleurs({ zone, sons, onRate, onReussi }) {
  const [occ, setOcc] = useState(() => Array(PILLEURS_BUISSONS).fill(null)); // { id, type, v, touche } par buisson
  const occRef = useRef(Array(PILLEURS_BUISSONS).fill(null)), minuteurs = useRef([]), fini = useRef(false), touches = useRef(0);
  const w = zone.w || 360, h = zone.h || 640;
  const plus = (ms, f) => minuteurs.current.push(setTimeout(f, ms));
  const poser = (b, o) => { occRef.current[b] = o; setOcc([...occRef.current]); };
  const sortir = (e, id) => {
    if (fini.current) return;
    const libres = occRef.current.map((o, b) => (o ? -1 : b)).filter((b) => b >= 0);
    if (!libres.length) { plus(150, () => sortir(e, id)); return; } // tous occupés : un instant plus tard
    const b = libres[Math.floor(Math.random() * libres.length)];
    const v = new Animated.Value(0), o = { id, type: e.type, v, touche: false };
    poser(b, o);
    Animated.timing(v, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    plus(140 + pilleurDuree(e.rang), () => {
      if (fini.current || occRef.current[b] !== o || o.touche) return;
      Animated.timing(v, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
        if (fini.current || occRef.current[b] !== o) return;
        poser(b, null);
        if (o.type === 'pilleur') { fini.current = true; onRate(); } // il a replongé avec son butin
      });
    });
  };
  useEffect(() => {
    let t = 300;
    planPilleurs().forEach((e, id) => { plus(t, () => sortir(e, id)); t += pilleurIntervalle(e.rang); });
    return () => { fini.current = true; minuteurs.current.forEach(clearTimeout); };
  }, []);
  const toucher = (b) => {
    const o = occRef.current[b];
    if (fini.current || !o || o.touche) return;
    if (o.type === 'leurre') { fini.current = true; onRate(); return; } // une lueur : piège
    o.touche = true;
    setOcc([...occRef.current]);
    jouerSon('impact-parfait', sons);
    touches.current += 1;
    if (touches.current >= PILLEURS_NB) { fini.current = true; plus(250, onReussi); return; }
    plus(260, () => Animated.timing(o.v, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => { if (occRef.current[b] === o) poser(b, null); }));
  };
  const yBas = h - BARRE_BAS_H - BUI_H * 0.55; // bas du buisson = haut de la barre du bas
  const places = [...BUISSONS_HAUT.map(([fx, fy]) => [fx * w, fy * h]), ...BUISSONS_BAS_X.map((fx) => [fx * w, yBas])];
  // ⚠️ L'auteur : « on appuie dessus et ça ne marche pas parfois » — le buisson (dessiné par-dessus) cachait le bas du
  // pilleur et prenait le doigt. TOUT le bloc (pilleur + buisson) se touche désormais.
  return places.map(([cx, cy], b) => {
    const o = occ[b];
    return (
      <TouchableOpacity key={b} activeOpacity={1} onPressIn={() => toucher(b)} style={[styles.pilBloc, { left: cx - BUI_L / 2, top: cy - PIL_H }]}>
        <View style={styles.pilFenetre}>
          {o ? (
            <Animated.View style={{ transform: [{ translateY: o.v.interpolate({ inputRange: [0, 1], outputRange: [PIL_H, 0] }) }] }}>
              <View style={styles.pilToucher}>
                {o.type === 'leurre' ? <LueurVisible couleur="cyan" taille={80} />
                  : <Image source={o.touche ? PILLEUR_TOUCHE : PILLEUR} style={styles.pilImage} resizeMode="contain" />}
              </View>
            </Animated.View>
          ) : null}
        </View>
        <Image source={BUISSON} style={styles.pilBuisson} resizeMode="contain" />
      </TouchableOpacity>
    );
  });
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
  const gagner = (resultat) => {
    if (fini.current) return;
    fini.current = true;
    nettoyer();
    setRecompense(onGagne ? onGagne(resultat) : null); // resultat : ex. { griffes: 7 } (Pluie de spores)
    setPhase('gagne');
    jouerSon('victoire', sons); // demande de l'auteur : le son de VICTOIRE
    arrivee.setValue(0);
    Animated.spring(arrivee, { toValue: 1, friction: 3, tension: 55, useNativeDriver: true }).start(); // élastique
    minuteur.current = setTimeout(() => onFermer && onFermer(), 2800);
  };

  if (!visible) return null;
  const Jeu = jeu === 'doree' ? JeuDoree : jeu === 'transe' ? JeuTranse : jeu === 'bonneteau' ? JeuBonneteau
    : jeu === 'roue' ? JeuRoue : jeu === 'coffre' ? JeuCoffre : jeu === 'spores' ? JeuSpores : jeu === 'rituel' ? JeuRituel
    : jeu === 'pilleurs' ? JeuPilleurs : JeuChasse;
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
  roueZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coffreZone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spore: { position: 'absolute', width: SPORE_T, height: SPORE_T },
  rituelZone: { flex: 1 },
  pilBloc: { position: 'absolute', width: BUI_L, height: PIL_H + BUI_H * 0.55 },
  pilFenetre: { position: 'absolute', left: (BUI_L - PIL_L) / 2, top: 0, width: PIL_L, height: PIL_H + 8, overflow: 'hidden', alignItems: 'center' },
  pilToucher: { width: PIL_L, height: PIL_H, alignItems: 'center', justifyContent: 'center' },
  pilImage: { width: PIL_L, height: PIL_H },
  pilBuisson: { position: 'absolute', left: 0, top: PIL_H - BUI_H * 0.45, width: BUI_L, height: BUI_H },
  rituelAnneau: { position: 'absolute' },
  rituelSymbole: { position: 'absolute', width: SYM_L, height: SYM_H, alignItems: 'center', justifyContent: 'center' },
  rituelImage: { width: SYM_L, height: SYM_H },
  rituelEteint: { opacity: 0.55 },
  rituelHalo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  rituelEtat: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 22, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 8 },
  coffreImage: { width: 170, height: 170 },
  coffreBroches: { flexDirection: 'row', marginTop: 6, marginBottom: 18 },
  coffreBroche: { width: 46, height: 46, borderRadius: 23, marginHorizontal: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: '#8a7a5a' },
  coffreBrocheLevee: { backgroundColor: 'rgba(255,200,40,0.45)', borderColor: '#FFD54A' },
  coffreBrocheTexte: { fontSize: 22 },
  coffreJauge: { width: JAUGE_L + 14, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 2, borderColor: '#FFD54A',
    paddingHorizontal: 7, justifyContent: 'center' },
  coffreVert: { position: 'absolute', top: 5, bottom: 5, borderRadius: 8, backgroundColor: '#3BE07A', marginLeft: 7,
    shadowColor: '#3BE07A', shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  coffreAiguille: { position: 'absolute', left: 4, top: -6, width: 6, height: 42, borderRadius: 3, backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
  roueFleche: { color: '#FFD54A', fontSize: 44, fontWeight: '900', marginTop: 4, textShadowColor: '#000', textShadowRadius: 8 }, // EN BAS (demande de l'auteur)
  roue: { width: ROUE_R * 2, height: ROUE_R * 2 },
  roueRune: { position: 'absolute', width: RUNE_T, height: RUNE_T, alignItems: 'center', justifyContent: 'center' },
  roueImage: { width: RUNE_T, height: RUNE_T },
  roueEteinte: { opacity: 0.45 },
  roueHalo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  oeufPlace: { position: 'absolute', left: 0, top: 0, width: OEUF_L, height: OEUF_H, alignItems: 'center', justifyContent: 'flex-end' },
  oeufImage: { width: OEUF_L, height: OEUF_H },
  oeufSouleve: { transform: [{ translateY: -38 }] }, // l'œuf se soulève : on voit la lueur dessous
  oeufLueur: { position: 'absolute', bottom: -4, alignItems: 'center', justifyContent: 'center' },
  etincelle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  // Demande de l'auteur : des ronds « en rapport avec le jeu » — l'ŒUF lumineux au centre (la Transe se joue sur l'œuf) et un
  // anneau d'énergie doré qui se resserre sur lui.
  transeAnneau: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 6, borderColor: '#FFD54A',
    shadowColor: '#FFB300', shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  transeCercle: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,213,74,0.18)', borderWidth: 3, borderColor: '#FFE9A6',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  transeOeuf: { width: 118, height: 118 },
  transeOk: { backgroundColor: 'rgba(80,220,120,0.55)', borderColor: '#7CFF9E' },
  transeRate: { backgroundColor: 'rgba(255,60,60,0.55)', borderColor: '#FF6B6B' },
});

// Flappy Bird — port fidèle de la logique déjà validée dans index.html
// (PWA) : physique par delta-temps (gravité 1400px/s², impulsion -420px/s),
// tuyaux tous les 1500ms, coins-config.js pour les paliers de pièces.
// Graphismes : les 3 assets fournis par l'utilisateur (oiseau toucan, corps
// de tuyau répétable, embouchure) — mêmes fichiers et même logique de
// tuilage (corps carrelé verticalement + embouchure débordant de 4px de
// chaque côté) que le PWA réel (fbDrawPipeSegment). Non porté (hors scope
// V1, comme les autres jeux) : la boutique de thèmes de fond cosmétiques
// (COINS_CONFIG.flappyBirdThemes) et le classement — seul le thème
// "classique" (celui avec les vrais assets) est utilisé.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Vibration, Dimensions, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  GRAVITY,
  FLAP_VELOCITY,
  PIPE_SPEED,
  PIPE_GAP,
  PIPE_WIDTH,
  BIRD_X,
  BIRD_RADIUS,
  step as stepLogic,
} from '../../games/flappybird/flappyBirdLogic';
import useBackGesture from '../../hooks/useBackGesture';

const BIRD_IMG = require('../../../assets/flappybird/bird.png');
const PIPE_BODY_IMG = require('../../../assets/flappybird/pipe_body.png');
const PIPE_HEAD_IMG = require('../../../assets/flappybird/pipe_head.png');

// Décor arrière-plan fourni par Flavio (29/08). ATTENTION : sol.png
// manque à l'appel — seuls 7 des 8 fichiers annoncés ont été reçus (le
// 8e fichier envoyé était en réalité une capture d'écran des consignes,
// pas une image). La bande "sol" (y=260 au bas, défilement rapide)
// n'est donc pas affichée pour l'instant — à ajouter dès réception.
const FOND_IMG = require('../../../assets/flappybird/fond.png');
const NUAGES_IMG = require('../../../assets/flappybird/nuages.png');
const VILLE_IMG = require('../../../assets/flappybird/ville.png');
const ARBRES_IMG = require('../../../assets/flappybird/arbres.png');
const HERBE_IMGS = [
  require('../../../assets/flappybird/herbe_1.png'),
  require('../../../assets/flappybird/herbe_2.png'),
  require('../../../assets/flappybird/herbe_3.png'),
];

const SKY_COLOR = '#4FC3F7';
const TEXT_OUTLINE = '#1A237E';
const CAP_H = 24;
const CAP_OVERHANG = 4;

// Dimensions natives réelles des fichiers reçus (px) — légèrement
// différentes des cotes annoncées dans les consignes (ex: arbres 114 au
// lieu de 110, herbe ~98 au lieu de 40 — les découpes ont des silhouettes
// irrégulières qui débordent du "cadre" nominal, normal pour ce genre
// d'export). On utilise les vraies dimensions pour ne pas déformer les
// images, ancrées par le PIED (bas) comme demandé.
const NUAGES_NATIVE = { w: 600, h: 130 };
const VILLE_NATIVE = { w: 600, h: 80 };
const ARBRES_NATIVE = { w: 600, h: 114 };
const HERBE_NATIVE = { w: 600, h: 98 };

// Vitesses de défilement (px/s, en unités BASE avant mise à l'échelle) —
// "rapide" calée sur PIPE_SPEED (140) pour rester cohérente avec le
// rythme du jeu, le reste en dessous par paliers.
const SCROLL_SPEED = { nuages: 12, ville: 28, arbres: 55, herbe: PIPE_SPEED };

const MILESTONES = [
  { score: 8, coins: 1 },
  { score: 23, coins: 3 },
  { score: 38, coins: 5 },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCALE = Math.min((SCREEN_WIDTH - 32) / BASE_WIDTH, 1.15);
const DIMS = {
  width: BASE_WIDTH * SCALE,
  height: BASE_HEIGHT * SCALE,
  pipeWidth: PIPE_WIDTH * SCALE,
  pipeGap: PIPE_GAP * SCALE,
  pipeSpeed: PIPE_SPEED * SCALE,
  gravity: GRAVITY * SCALE,
  birdX: BIRD_X * SCALE,
  birdRadius: BIRD_RADIUS * SCALE,
};
const CAP_H_S = CAP_H * SCALE;
const CAP_OVERHANG_S = CAP_OVERHANG * SCALE;
const BIRD_W = DIMS.birdRadius * 3.4;
const BODY_TILE_H = 42 * SCALE; // hauteur naturelle de pipe_body.png (52×42), mise à l'échelle

// Carrelage manuel du corps de tuyau : resizeMode="repeat" n'est pas fiable
// sur Android (fonctionne sur iOS mais rend le tuyau invisible sur Android —
// bug constaté). On empile plusieurs copies de l'image à la place, ce qui
// marche de façon identique sur les deux plateformes.
function TiledPipeBody({ width, height }) {
  const tileCount = Math.max(1, Math.ceil(height / BODY_TILE_H));
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {Array.from({ length: tileCount }).map((_, i) => (
        <Image key={i} source={PIPE_BODY_IMG} style={{ width, height: BODY_TILE_H }} resizeMode="stretch" />
      ))}
    </View>
  );
}

// Bande qui défile horizontalement à l'infini : deux copies collées
// l'une à l'autre, translatées en boucle de 0 à -largeur — le raccord
// est invisible puisque le bord droit de l'image rejoint son propre bord
// gauche (raccord déjà fait dans les fichiers fournis).
function ScrollingStrip({ source, width, height, top, speedPxPerSec }) {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateX.setValue(0);
    const durationMs = (width / speedPxPerSec) * 1000;
    const anim = Animated.loop(
      Animated.timing(translateX, { toValue: -width, duration: durationMs, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [width, speedPxPerSec, translateX]);

  return (
    <Animated.View style={{ position: 'absolute', top, left: 0, flexDirection: 'row', transform: [{ translateX }] }}>
      <Image source={source} style={{ width, height }} resizeMode="stretch" />
      <Image source={source} style={{ width, height }} resizeMode="stretch" />
    </Animated.View>
  );
}

// Herbe : défilement rapide (comme le sol) EN PLUS d'une animation
// d'images en aller-retour (1→2→3→2→1→2→3…). Les 3 images restent
// TOUTES montées en permanence, empilées, et on fait un fondu enchaîné
// (opacité) entre elles plutôt que de changer la source de l'Image —
// corrige à la fois le flash de rechargement/décodage ("bug de salade")
// ET le changement de luminosité trop brutal entre les images (elles
// n'ont pas exactement le même éclairage), en lissant la transition.
function HerbeStrip({ width, height, top, speedPxPerSec }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacities = useRef(HERBE_IMGS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const frameIdxRef = useRef(0);
  const frameDirRef = useRef(1);

  useEffect(() => {
    translateX.setValue(0);
    const durationMs = (width / speedPxPerSec) * 1000;
    const scrollAnim = Animated.loop(
      Animated.timing(translateX, { toValue: -width, duration: durationMs, easing: Easing.linear, useNativeDriver: true })
    );
    scrollAnim.start();

    const frameInterval = setInterval(() => {
      const prevIdx = frameIdxRef.current;
      let next = prevIdx + frameDirRef.current;
      if (next >= HERBE_IMGS.length - 1) frameDirRef.current = -1;
      else if (next <= 0) frameDirRef.current = 1;
      next = Math.max(0, Math.min(HERBE_IMGS.length - 1, next));
      frameIdxRef.current = next;
      Animated.parallel([
        Animated.timing(opacities[prevIdx], { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(opacities[next], { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
    }, 150);

    return () => {
      scrollAnim.stop();
      clearInterval(frameInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, speedPxPerSec, translateX]);

  return (
    <Animated.View style={{ position: 'absolute', top, left: 0, flexDirection: 'row', transform: [{ translateX }] }}>
      {[0, 1].map((copyIdx) => (
        <View key={copyIdx} style={{ width, height }}>
          {HERBE_IMGS.map((src, i) => (
            <Animated.Image
              key={i}
              source={src}
              style={{ position: 'absolute', top: 0, left: 0, width, height, opacity: opacities[i] }}
              resizeMode="stretch"
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

// Empile les 6 couches de décor, dans l'ordre (fond fixe en premier =
// tout au fond, herbe animée en dernier = tout devant) — ancrées par le
// PIED comme spécifié. sol.png manque (voir note plus haut), donc pas de
// couche "sol". Les arbres débordent volontairement de +20px sous leur
// pied nominal (y=355) pour bien recouvrir la zone où l'herbe n'est pas
// encore "pleine" (les brins d'herbe ne sont denses qu'à partir d'environ
// 60% de leur hauteur, le haut de l'image est fait de pointes espacées) —
// sans cette marge, un filet de ciel bleu passait entre les deux bandes.
function FlappyBackground({ scale, gameWidth, gameHeight }) {
  const stripW = 600 * scale;
  const ARBRES_OVERLAP = 20; // px supplémentaires sous le pied nominal des arbres
  return (
    <>
      <Image source={FOND_IMG} style={{ position: 'absolute', top: 0, left: 0, width: gameWidth, height: gameHeight }} resizeMode="stretch" />
      <ScrollingStrip source={NUAGES_IMG} width={stripW} height={NUAGES_NATIVE.h * scale} top={0} speedPxPerSec={SCROLL_SPEED.nuages * scale} />
      <ScrollingStrip source={VILLE_IMG} width={stripW} height={VILLE_NATIVE.h * scale} top={266 * scale - VILLE_NATIVE.h * scale} speedPxPerSec={SCROLL_SPEED.ville * scale} />
      <ScrollingStrip
        source={ARBRES_IMG}
        width={stripW}
        height={ARBRES_NATIVE.h * scale}
        top={(355 + ARBRES_OVERLAP) * scale - ARBRES_NATIVE.h * scale}
        speedPxPerSec={SCROLL_SPEED.arbres * scale}
      />
      <HerbeStrip width={stripW} height={HERBE_NATIVE.h * scale} top={gameHeight - HERBE_NATIVE.h * scale} speedPxPerSec={SCROLL_SPEED.herbe * scale} />
    </>
  );
}

export default function FlappyBirdScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('idle'); // 'idle' | 'running' | 'over'
  const [birdY, setBirdY] = useState(DIMS.height / 2);
  const [pipes, setPipes] = useState([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [coinToast, setCoinToast] = useState('');

  const birdVYRef = useRef(FLAP_VELOCITY * SCALE);
  const spawnTimerRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(null);
  const milestonesHitRef = useRef([]);
  const tiltAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('fbBest').then((v) => setBest(v ? parseInt(v, 10) : 0));
  }, []);

  const checkMilestones = useCallback(
    (currentScore) => {
      MILESTONES.forEach((m, i) => {
        if (!milestonesHitRef.current.includes(i) && currentScore >= m.score) {
          milestonesHitRef.current.push(i);
          addCoinsLimited('flappyBird', m.coins).then((awarded) => {
            setCoinToast(`🪙 +${awarded} pièce${awarded > 1 ? 's' : ''} !`);
            setTimeout(() => setCoinToast(''), 1500);
          });
        }
      });
    },
    [addCoinsLimited]
  );

  const endGame = useCallback((finalScore) => {
    setPhase('over');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    Vibration.vibrate([20, 30, 20]);
    setBest((prevBest) => {
      if (finalScore > prevBest) {
        AsyncStorage.setItem('fbBest', String(finalScore));
        return finalScore;
      }
      return prevBest;
    });
  }, []);

  const loop = useCallback(
    (timestamp) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = timestamp;

      setPipes((prevPipes) => {
        setBirdY((prevBirdY) => {
          const result = stepLogic(
            { birdY: prevBirdY, birdVY: birdVYRef.current, pipes: prevPipes, spawnTimer: spawnTimerRef.current },
            dt,
            DIMS
          );
          birdVYRef.current = result.birdVY;
          spawnTimerRef.current = result.spawnTimer;
          setPipes(result.pipes);
          if (result.scoreGained > 0) {
            setScore((s) => {
              const ns = s + result.scoreGained;
              checkMilestones(ns);
              return ns;
            });
          }
          tiltAnim.setValue(Math.max(-0.5, Math.min(0.7, birdVYRef.current * 0.04)));
          if (result.collided) {
            endGame(score + result.scoreGained);
            return prevBirdY;
          }
          rafRef.current = requestAnimationFrame(loop);
          return result.birdY;
        });
        return prevPipes;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [score, checkMilestones, endGame]
  );

  const loopRef = useRef(loop);
  loopRef.current = loop;

  const start = useCallback(() => {
    setBirdY(DIMS.height / 2);
    birdVYRef.current = FLAP_VELOCITY * SCALE;
    setPipes([]);
    setScore(0);
    setCoinToast('');
    milestonesHitRef.current = [];
    spawnTimerRef.current = 0;
    setPhase('running');
    lastTimeRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame((t) => loopRef.current(t));
  }, []);

  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  const handleTap = () => {
    if (phase === 'over' || phase === 'idle') {
      start();
      return;
    }
    birdVYRef.current = FLAP_VELOCITY * SCALE;
    Vibration.vibrate(8);
  };

  const tiltDeg = tiltAnim.interpolate({ inputRange: [-0.5, 0.7], outputRange: ['-28deg', '40deg'] });

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>🐦 Flappy Bird</Text>
      </View>

      <Text style={styles.bestText}>Meilleur : {best}</Text>
      {!!coinToast && <Text style={styles.coinToast}>{coinToast}</Text>}

      <View style={styles.playWrap}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleTap}
          style={[styles.playfield, { width: DIMS.width, height: DIMS.height }]}
        >
          <FlappyBackground scale={SCALE} gameWidth={DIMS.width} gameHeight={DIMS.height} />

          {pipes.map((p, i) => (
            <React.Fragment key={i}>
              <View style={{ position: 'absolute', left: p.x, top: 0, width: DIMS.pipeWidth, height: Math.max(0, p.gapY - CAP_H_S) }}>
                <TiledPipeBody width={DIMS.pipeWidth} height={Math.max(0, p.gapY - CAP_H_S)} />
              </View>
              <Image
                source={PIPE_HEAD_IMG}
                style={{ position: 'absolute', left: p.x - CAP_OVERHANG_S, top: Math.max(0, p.gapY - CAP_H_S), width: DIMS.pipeWidth + CAP_OVERHANG_S * 2, height: CAP_H_S }}
                resizeMode="stretch"
              />
              <Image
                source={PIPE_HEAD_IMG}
                style={{ position: 'absolute', left: p.x - CAP_OVERHANG_S, top: p.gapY + DIMS.pipeGap, width: DIMS.pipeWidth + CAP_OVERHANG_S * 2, height: CAP_H_S }}
                resizeMode="stretch"
              />
              <View
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: p.gapY + DIMS.pipeGap + CAP_H_S,
                  width: DIMS.pipeWidth,
                  height: Math.max(0, DIMS.height - (p.gapY + DIMS.pipeGap + CAP_H_S)),
                }}
              >
                <TiledPipeBody width={DIMS.pipeWidth} height={Math.max(0, DIMS.height - (p.gapY + DIMS.pipeGap + CAP_H_S))} />
              </View>
            </React.Fragment>
          ))}

          <Animated.Image
            source={BIRD_IMG}
            style={{
              position: 'absolute',
              left: DIMS.birdX - BIRD_W / 2,
              top: birdY - BIRD_W / 2,
              width: BIRD_W,
              height: BIRD_W,
              transform: [{ rotate: tiltDeg }],
            }}
          />

          <Text style={styles.scoreText}>{score}</Text>

          {phase === 'idle' && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>Tape sur l'écran pour commencer</Text>
            </View>
          )}
          {phase === 'over' && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>🟥 Perdu ! Score : {score}</Text>
              <Text style={styles.overlaySub}>Meilleur : {best}</Text>
              <Text style={styles.overlaySub}>Tape pour rejouer</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.coinInfo}>🪙 {MILESTONES.map((m) => `Score ${m.score}→${m.coins}`).join(' · ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#141721', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: '#8d93ab', fontSize: 14, fontWeight: '600' },
  title: { color: '#eef0f6', fontSize: 20, fontWeight: '800' },
  bestText: { color: '#8d93ab', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  coinToast: { color: '#FFD700', textAlign: 'center', fontSize: 13, fontWeight: '800', marginBottom: 4 },

  playWrap: { alignItems: 'center', marginTop: 8 },
  playfield: {
    backgroundColor: SKY_COLOR,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scoreText: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
    textShadowColor: TEXT_OUTLINE,
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 2,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 20,
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: TEXT_OUTLINE,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  overlaySub: { color: '#ffffff', fontSize: 13, fontWeight: '700', marginTop: 4 },

  coinInfo: { color: '#8d93ab', fontSize: 11, textAlign: 'center', marginTop: 14 },
});

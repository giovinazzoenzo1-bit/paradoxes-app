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
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Vibration, Dimensions } from 'react-native';
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

const SKY_COLOR = '#4FC3F7';
const TEXT_OUTLINE = '#1A237E';
const CAP_H = 24;
const CAP_OVERHANG = 4;

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

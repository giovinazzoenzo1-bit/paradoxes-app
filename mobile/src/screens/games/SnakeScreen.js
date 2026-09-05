// Snake — port fidèle de la logique déjà validée dans index.html (PWA).
// Pas de cahier des charges dans le dossier Drive "Snake" (vide) — le PWA
// fait foi : palette Game Boy DMG (4 nuances de vert), contrôles D-pad
// (pas de swipe dans le PWA), tick toutes les 160ms. Boîtier Game Boy
// (plastique kaki, grille haut-parleur, écran encastré) reproduit à partir
// du CSS réel du PWA (#gameboy-body / .gameboy-speaker / .gameboy-screen)
// — absent de la V1 initiale, ajouté suite à retour utilisateur. Barre de
// pièces (CoinBar) affichée en jeu, comme sur le PWA (visible en permanence
// même pendant une partie). Non porté (même décision que 2048/Memory) : le
// classement mondial fictif.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Dimensions } from 'react-native';
import BackButton from '../../components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import { GRID_SIZE, OPPOSITES, initialBody, placeFood, tick as tickLogic } from '../../games/snake/snakeLogic';
import useBackGesture from '../../hooks/useBackGesture';

const GB = {
  screenBg: '#9bbc0f',
  dark: '#0f380f',
  mid: '#306230',
  headerText: '#9bbc0f',
  headerTextBright: '#c4f000',
};
const SHELL = {
  body: '#c4c9a3',
  bodyBorder: '#9aa080',
  speaker: '#8a8f6f',
  screenFrame: '#3a3f2f',
  screenBg: '#1a2e1a',
};
const COLORS = {
  bg: '#141721',
  text: '#eef0f6',
  muted: '#8d93ab',
  dpad: '#2a2a2a',
  dpadIcon: '#999999',
};

const MILESTONES = [
  { score: 10, coins: 1 },
  { score: 25, coins: 5 },
  { score: 40, coins: 10 },
];
const TICK_MS = 160;

const SCREEN_WIDTH = Dimensions.get('window').width;
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 32 - 56, 320); // - padding écran - padding boîtier
const CELL = Math.floor(BOARD_SIZE / GRID_SIZE);

export default function SnakeScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [body, setBody] = useState(initialBody());
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [flash, setFlash] = useState(false);
  const [coinToast, setCoinToast] = useState('');

  const dirRef = useRef('right');
  const nextDirRef = useRef('right');
  const bodyRef = useRef(initialBody());
  const foodRef = useRef({ x: 5, y: 5 });
  const intervalRef = useRef(null);
  const milestonesHitRef = useRef([]);

  useEffect(() => {
    AsyncStorage.getItem('snakeHighScore').then((v) => setHighScore(v ? parseInt(v, 10) : 0));
  }, []);

  const vibrate = (pattern) => Vibration.vibrate(pattern);

  const checkMilestones = useCallback(
    (currentScore) => {
      MILESTONES.forEach((m, i) => {
        if (!milestonesHitRef.current.includes(i) && currentScore >= m.score) {
          milestonesHitRef.current.push(i);
          addCoinsLimited('snake', m.coins).then((awarded) => {
            setCoinToast(`🪙 +${awarded} pièces !`);
            setTimeout(() => setCoinToast(''), 1800);
          });
        }
      });
    },
    [addCoinsLimited]
  );

  function runTick() {
    dirRef.current = nextDirRef.current;
    const { body: newBody, ate, dead } = tickLogic(bodyRef.current, dirRef.current, foodRef.current);
    if (dead) {
      setOver(true);
      if (intervalRef.current) clearInterval(intervalRef.current);
      vibrate([20, 30, 20]);
      return;
    }
    bodyRef.current = newBody;
    setBody(newBody);
    if (ate) {
      setScore((s) => {
        const newScore = s + 1;
        checkMilestones(newScore);
        setHighScore((prevHigh) => {
          if (newScore > prevHigh) {
            AsyncStorage.setItem('snakeHighScore', String(newScore));
            setFlash(true);
            vibrate([15, 15, 15, 15, 40]);
            setTimeout(() => setFlash(false), 1600);
            return newScore;
          }
          return prevHigh;
        });
        return newScore;
      });
      const newFood = placeFood(newBody);
      foodRef.current = newFood;
      setFood(newFood);
    }
  }

  const startNew = useCallback(() => {
    const b = initialBody();
    bodyRef.current = b;
    setBody(b);
    dirRef.current = 'right';
    nextDirRef.current = 'right';
    const f = placeFood(b);
    foodRef.current = f;
    setFood(f);
    setScore(0);
    setOver(false);
    setCoinToast('');
    milestonesHitRef.current = [];
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(runTick, TICK_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startNew();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDir = (dir) => {
    if (OPPOSITES[dir] !== dirRef.current) nextDirRef.current = dir;
  };

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />

      <View style={styles.header}>
        {onBack && (
          <BackButton onPress={onBack} />
        )}
        <Text style={styles.title}>🐍 Snake</Text>
      </View>

      {!!coinToast && <Text style={styles.coinToast}>{coinToast}</Text>}

      <View style={[styles.gbBody, flash && styles.gbBodyFlash]}>
        <View style={styles.gbSpeaker} />

        <View style={styles.gbScreen}>
          <View style={styles.gbScreenHeader}>
            <Text style={styles.gbHeaderText}>
              SCORE <Text style={styles.gbHeaderBright}>{score}</Text>
            </Text>
            <Text style={styles.gbHeaderText}>
              MEILLEUR <Text style={styles.gbHeaderBright}>{highScore}</Text>
            </Text>
          </View>

          <View style={{ width: CELL * GRID_SIZE, height: CELL * GRID_SIZE, backgroundColor: GB.screenBg, borderRadius: 2, alignSelf: 'center' }}>
            {Array.from({ length: GRID_SIZE }).map((_, y) => (
              <View key={y} style={{ flexDirection: 'row' }}>
                {Array.from({ length: GRID_SIZE }).map((__, x) => {
                  const isHead = body[0] && body[0].x === x && body[0].y === y;
                  const isBody = !isHead && body.some((s) => s.x === x && s.y === y);
                  const isFood = food.x === x && food.y === y;
                  let bg = 'transparent';
                  if (isHead || isFood) bg = GB.dark;
                  else if (isBody) bg = GB.mid;
                  return <View key={x} style={{ width: CELL, height: CELL, backgroundColor: bg }} />;
                })}
              </View>
            ))}
          </View>

          {over && <Text style={styles.gbStatus}>PERDU — SCORE : {score}</Text>}
        </View>

        {over ? (
          <TouchableOpacity style={styles.replayBtn} onPress={startNew}>
            <Text style={styles.replayBtnText}>Nouvelle partie</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.dpad}>
            <View style={styles.dpadRow}>
              <View style={styles.dpadSpacer} />
              <TouchableOpacity style={[styles.dpadBtn, styles.dpadUp]} onPress={() => setDir('up')}>
                <Text style={styles.dpadText}>▲</Text>
              </TouchableOpacity>
              <View style={styles.dpadSpacer} />
            </View>
            <View style={styles.dpadRow}>
              <TouchableOpacity style={[styles.dpadBtn, styles.dpadLeft]} onPress={() => setDir('left')}>
                <Text style={styles.dpadText}>◀</Text>
              </TouchableOpacity>
              <View style={styles.dpadCenter} />
              <TouchableOpacity style={[styles.dpadBtn, styles.dpadRight]} onPress={() => setDir('right')}>
                <Text style={styles.dpadText}>▶</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dpadRow}>
              <View style={styles.dpadSpacer} />
              <TouchableOpacity style={[styles.dpadBtn, styles.dpadDown]} onPress={() => setDir('down')}>
                <Text style={styles.dpadText}>▼</Text>
              </TouchableOpacity>
              <View style={styles.dpadSpacer} />
            </View>
          </View>
        )}
      </View>

      <Text style={styles.coinInfo}>🪙 {MILESTONES.map((m) => `Score ${m.score}→${m.coins}`).join(' · ')}</Text>
    </View>
  );
}

const DPAD_BTN = 68; // agrandi (retour utilisateur : touches trop petites)

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },

  coinToast: {
    color: '#FFD700',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },

  gbBody: {
    backgroundColor: SHELL.body,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: SHELL.bodyBorder,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  gbBodyFlash: { borderColor: '#FFD700', borderWidth: 4 },
  gbSpeaker: {
    width: 90,
    height: 14,
    borderRadius: 7,
    backgroundColor: SHELL.speaker,
    marginBottom: 16,
    opacity: 0.7,
  },
  gbScreen: {
    backgroundColor: SHELL.screenBg,
    borderRadius: 8,
    borderWidth: 5,
    borderColor: SHELL.screenFrame,
    padding: 12,
  },
  gbScreenHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  gbHeaderText: { color: GB.headerText, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  gbHeaderBright: { color: GB.headerTextBright, fontSize: 12, fontWeight: '800' },
  gbStatus: { color: GB.headerTextBright, fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 8 },

  dpad: { alignItems: 'center', marginTop: 26, gap: 0 },
  dpadRow: { flexDirection: 'row' },
  dpadBtn: {
    width: DPAD_BTN,
    height: DPAD_BTN,
    backgroundColor: COLORS.dpad,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadUp: { borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  dpadDown: { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  dpadLeft: { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  dpadRight: { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  dpadCenter: { width: DPAD_BTN, height: DPAD_BTN, backgroundColor: COLORS.dpad },
  dpadSpacer: { width: DPAD_BTN, height: DPAD_BTN },
  dpadText: { color: COLORS.dpadIcon, fontSize: 24, fontWeight: '800' },

  replayBtn: {
    marginTop: 22,
    backgroundColor: '#1a1f3a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  replayBtnText: { color: '#eef0f6', fontSize: 16, fontWeight: '800' },

  coinInfo: { color: COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 14 },
});

// Snake — port fidèle de la logique déjà validée dans index.html (PWA).
// Pas de cahier des charges dans le dossier Drive "Snake" (vide) — le PWA
// fait foi : palette Game Boy DMG (4 nuances de vert), contrôles D-pad
// (pas de swipe dans le PWA), tick toutes les 160ms. Non porté (même
// décision que 2048/Memory) : le classement mondial fictif.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../../context/CoinsContext';
import { GRID_SIZE, OPPOSITES, initialBody, placeFood, tick as tickLogic } from '../../games/snake/snakeLogic';
import useBackGesture from '../../hooks/useBackGesture';

const GB = {
  screenBg: '#9bbc0f',
  dark: '#0f380f',
  mid: '#306230',
};
const COLORS = {
  bg: '#141721',
  panel: '#1c2032',
  text: '#eef0f6',
  muted: '#8d93ab',
  dpad: '#2a3142',
};

const MILESTONES = [
  { score: 10, coins: 1 },
  { score: 25, coins: 5 },
  { score: 40, coins: 10 },
];
const TICK_MS = 160;

const SCREEN_WIDTH = Dimensions.get('window').width;
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 32, 340);
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
          addCoinsLimited('snake', m.coins);
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
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>🐍 Snake</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Score</Text>
          <Text style={styles.statValue}>{score}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Record</Text>
          <Text style={styles.statValue}>{highScore}</Text>
        </View>
      </View>

      <Text style={styles.status}>{over ? `PERDU — SCORE : ${score}` : ' '}</Text>

      <View style={styles.boardWrap}>
        <View style={[styles.board, flash && styles.boardFlash, { width: CELL * GRID_SIZE, height: CELL * GRID_SIZE }]}>
          {Array.from({ length: GRID_SIZE }).map((_, y) => (
            <View key={y} style={{ flexDirection: 'row' }}>
              {Array.from({ length: GRID_SIZE }).map((__, x) => {
                const isHead = body[0] && body[0].x === x && body[0].y === y;
                const isBody = !isHead && body.some((s) => s.x === x && s.y === y);
                const isFood = food.x === x && food.y === y;
                let bg = 'transparent';
                if (isHead || isFood) bg = GB.dark;
                else if (isBody) bg = GB.mid;
                return <View key={x} style={{ width: CELL, height: CELL, backgroundColor: bg, borderRadius: 2 }} />;
              })}
            </View>
          ))}
        </View>
      </View>

      {over ? (
        <TouchableOpacity style={styles.replayBtn} onPress={startNew}>
          <Text style={styles.replayBtnText}>🔁 Rejouer</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.dpad}>
          <View style={styles.dpadRow}>
            <View style={styles.dpadSpacer} />
            <TouchableOpacity style={styles.dpadBtn} onPress={() => setDir('up')}>
              <Text style={styles.dpadText}>▲</Text>
            </TouchableOpacity>
            <View style={styles.dpadSpacer} />
          </View>
          <View style={styles.dpadRow}>
            <TouchableOpacity style={styles.dpadBtn} onPress={() => setDir('left')}>
              <Text style={styles.dpadText}>◀</Text>
            </TouchableOpacity>
            <View style={styles.dpadSpacer} />
            <TouchableOpacity style={styles.dpadBtn} onPress={() => setDir('right')}>
              <Text style={styles.dpadText}>▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.dpadRow}>
            <View style={styles.dpadSpacer} />
            <TouchableOpacity style={styles.dpadBtn} onPress={() => setDir('down')}>
              <Text style={styles.dpadText}>▼</Text>
            </TouchableOpacity>
            <View style={styles.dpadSpacer} />
          </View>
        </View>
      )}
    </View>
  );
}

const DPAD_BTN = 56;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statCard: { flex: 1, backgroundColor: COLORS.panel, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  statLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 2 },

  status: { color: '#FF5252', textAlign: 'center', marginTop: 10, fontSize: 14, fontWeight: '800', minHeight: 18 },

  boardWrap: { alignItems: 'center', marginTop: 8 },
  board: { backgroundColor: GB.screenBg, borderRadius: 12, padding: 2 },
  boardFlash: { borderWidth: 3, borderColor: '#FFD700' },

  dpad: { alignItems: 'center', marginTop: 24, gap: 8 },
  dpadRow: { flexDirection: 'row', gap: 8 },
  dpadBtn: {
    width: DPAD_BTN,
    height: DPAD_BTN,
    borderRadius: 12,
    backgroundColor: COLORS.dpad,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadSpacer: { width: DPAD_BTN, height: DPAD_BTN },
  dpadText: { color: COLORS.text, fontSize: 22, fontWeight: '800' },

  replayBtn: {
    marginTop: 24,
    alignSelf: 'center',
    backgroundColor: '#00E676',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  replayBtnText: { color: '#04120c', fontSize: 16, fontWeight: '800' },
});

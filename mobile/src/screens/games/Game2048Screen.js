// 2048 — port fidèle de la logique déjà validée dans index.html (PWA).
// Cahier des charges : Google Drive "2048" (docs Enzo = gameplay/logique,
// Flavio = UI/design néon cyberpunk). Couleurs suivent le doc Flavio.
// Non porté en V1 (hors scope, faible valeur / forte complexité relative) :
// classement (perso + mondial fictif) — le PWA en avait un, mais c'est un
// ajout, pas le cœur du jeu. Les power-ups (Undo/Marteau/Swap) sont payants
// UNIQUEMENT en pièces ici (pas de "ou pub" — pas de SDK pub en mobile pour
// l'instant), même logique que l'Undo du Morpion.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../../context/CoinsContext';
import { SIZE, emptyGrid, addTile, move as moveLogic, canMove } from '../../games/g2048/g2048Logic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#0A0B14',
  board: '#14172B',
  cellEmpty: '#1E223D',
  buttonA: '#00F0FF',
  buttonB: '#7000FF',
  danger: '#FF3366',
  text: '#eef0f6',
  muted: '#8d93ab',
};

function tileStyle(v) {
  if (v === 0) return { bg: COLORS.cellEmpty, color: 'transparent' };
  if (v <= 8) return { bg: v === 4 ? '#00FF88' : '#00F0FF', color: '#0A0B14' };
  if (v <= 128) return { bg: v === 32 || v === 128 ? '#FF7B00' : '#FFE600', color: '#ffffff' };
  if (v <= 1024) return { bg: v === 512 ? '#BD00FF' : '#FF0055', color: '#ffffff' };
  return { bg: '#ffffff', color: '#0A0B14' }; // 2048+
}

const COINS_CONFIG = {
  classique: [
    { score: 2000, coins: 3 },
    { score: 8000, coins: 10 },
    { score: 20000, coins: 25 },
    { score: 50000, coins: 50 },
  ],
  rush60s: [
    { score: 720, coins: 3 },
    { score: 880, coins: 6 },
    { score: 1120, coins: 12 },
    { score: 1440, coins: 25 },
  ],
};
const UNDO_COST = 50;
const LASER_COST = 100;
const SWAP_COST = 75;
const SWIPE_THRESHOLD = 25;
const CELL_SIZE = 72;

export default function Game2048Screen({ onBack }) {
  const { coins, addCoinsLimited, spendCoins } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('modes'); // 'modes' | 'playing'
  const [mode, setMode] = useState('normal'); // 'normal' | 'rush'
  const [grid, setGrid] = useState(emptyGrid());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [reached2048, setReached2048] = useState(false);
  const [status, setStatus] = useState('');
  const [laserMode, setLaserMode] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState(null);
  const [rushTimeLeft, setRushTimeLeft] = useState(60);

  const historyRef = useRef([]); // pile {grid, score}, cap 20
  const milestonesHitRef = useRef([]);
  const rushIntervalRef = useRef(null);
  const cellAnims = useRef(
    Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => new Animated.Value(1)))
  ).current;

  useEffect(() => {
    AsyncStorage.getItem('g2048Best').then((v) => setBest(v ? parseInt(v, 10) : 0));
  }, []);

  const vibrate = (pattern) => Vibration.vibrate(pattern);

  const popAllTiles = (g) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (g[r][c] !== 0) {
          cellAnims[r][c].setValue(0);
          Animated.spring(cellAnims[r][c], { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();
        } else {
          cellAnims[r][c].setValue(1);
        }
      }
    }
  };

  const checkMilestones = useCallback(
    (currentScore) => {
      const list = mode === 'rush' ? COINS_CONFIG.rush60s : COINS_CONFIG.classique;
      list.forEach((m, i) => {
        if (!milestonesHitRef.current.includes(i) && currentScore >= m.score) {
          milestonesHitRef.current.push(i);
          addCoinsLimited('jeu2048', m.coins).then((awarded) => {
            setStatus(`🪙 Palier ${m.score} atteint ! +${awarded} pièces`);
            setTimeout(() => setStatus((s) => (s.startsWith('🪙 Palier') ? '' : s)), 2000);
          });
        }
      });
    },
    [mode, addCoinsLimited]
  );

  const endGame = useCallback((reasonLabel, finalScore) => {
    setOver(true);
    if (rushIntervalRef.current) {
      clearInterval(rushIntervalRef.current);
      rushIntervalRef.current = null;
    }
    setStatus(`🟥 ${reasonLabel} Score : ${finalScore}`);
    vibrate([20, 30, 20]);
    setBest((prevBest) => {
      const b = Math.max(prevBest, finalScore);
      AsyncStorage.setItem('g2048Best', String(b));
      return b;
    });
  }, []);

  const startNew = useCallback((selectedMode) => {
    if (rushIntervalRef.current) clearInterval(rushIntervalRef.current);
    const g = emptyGrid();
    addTile(g);
    addTile(g);
    setGrid(g);
    popAllTiles(g);
    setScore(0);
    setOver(false);
    setReached2048(false);
    setLaserMode(false);
    setSwapMode(false);
    setSwapFirst(null);
    setStatus('');
    historyRef.current = [];
    milestonesHitRef.current = [];
    setMode(selectedMode);
    setPhase('playing');
    if (selectedMode === 'rush') {
      setRushTimeLeft(60);
      rushIntervalRef.current = setInterval(() => {
        setRushTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(rushIntervalRef.current);
            rushIntervalRef.current = null;
            setScore((s) => {
              endGame('Temps écoulé !', s);
              return s;
            });
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToModes = () => {
    if (rushIntervalRef.current) {
      clearInterval(rushIntervalRef.current);
      rushIntervalRef.current = null;
    }
    setPhase('modes');
  };

  const doMove = useCallback(
    (dir) => {
      if (over || laserMode || swapMode) return;
      const { grid: newGrid, scoreGained, moved } = moveLogic(grid, dir);
      if (!moved) {
        vibrate([15]);
        return;
      }
      historyRef.current.push({ grid, score });
      if (historyRef.current.length > 20) historyRef.current.shift();
      addTile(newGrid);
      const newScore = score + scoreGained;
      setGrid(newGrid);
      popAllTiles(newGrid);
      setScore(newScore);
      if (scoreGained > 0) vibrate([10]);
      checkMilestones(newScore);

      const flat = newGrid.flat();
      if (flat.includes(2048) && !reached2048) {
        setReached2048(true);
        setStatus('🟩 2048 atteint ! La partie continue...');
        vibrate([30, 20, 30, 20, 60]);
        setTimeout(() => setStatus((s) => (s.startsWith('🟩 2048') ? '' : s)), 2500);
      }
      if (!canMove(newGrid)) {
        endGame('Plus de coup possible.', newScore);
      }
    },
    [grid, score, over, laserMode, swapMode, reached2048, checkMilestones, endGame]
  );

  const doMoveRef = useRef(doMove);
  doMoveRef.current = doMove;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, g) => Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12,
      onPanResponderRelease: (evt, g) => {
        if (Math.max(Math.abs(g.dx), Math.abs(g.dy)) < SWIPE_THRESHOLD) return;
        if (Math.abs(g.dx) > Math.abs(g.dy)) {
          doMoveRef.current(g.dx > 0 ? 'right' : 'left');
        } else {
          doMoveRef.current(g.dy > 0 ? 'down' : 'up');
        }
      },
    })
  ).current;

  const handleUndo = () => {
    if (mode === 'rush' || over || historyRef.current.length === 0) return;
    const revert = () => {
      const prev = historyRef.current.pop();
      setGrid(prev.grid);
      popAllTiles(prev.grid);
      setScore(prev.score);
      setStatus('');
    };
    spendCoins(UNDO_COST).then((ok) => {
      if (ok) revert();
    });
  };

  const handleLaser = () => {
    if (mode === 'rush' || over || laserMode) return;
    spendCoins(LASER_COST).then((ok) => {
      if (!ok) return;
      setLaserMode(true);
      setSwapMode(false);
      setSwapFirst(null);
      setStatus('🔨 Touche une tuile à détruire');
    });
  };

  const handleSwap = () => {
    if (mode === 'rush' || over || swapMode) return;
    spendCoins(SWAP_COST).then((ok) => {
      if (!ok) return;
      setSwapMode(true);
      setSwapFirst(null);
      setLaserMode(false);
      setStatus('🔀 Touche une première tuile');
    });
  };

  const handleCellTap = (r, c) => {
    if (over) return;
    if (laserMode) {
      if (grid[r][c] === 0) return;
      historyRef.current.push({ grid, score });
      const ng = grid.map((row) => [...row]);
      ng[r][c] = 0;
      setGrid(ng);
      setLaserMode(false);
      setStatus('');
      return;
    }
    if (swapMode) {
      if (grid[r][c] === 0) return;
      if (!swapFirst) {
        setSwapFirst([r, c]);
        setStatus('🔀 Choisis une tuile voisine');
        return;
      }
      const [r0, c0] = swapFirst;
      if (r0 === r && c0 === c) {
        setSwapFirst(null);
        setStatus('');
        return;
      }
      const adjacent = Math.abs(r0 - r) + Math.abs(c0 - c) === 1;
      if (!adjacent) {
        setStatus('🟥 Choisis une tuile voisine (adjacente)');
        return;
      }
      historyRef.current.push({ grid, score });
      const ng = grid.map((row) => [...row]);
      const tmp = ng[r0][c0];
      ng[r0][c0] = ng[r][c];
      ng[r][c] = tmp;
      setGrid(ng);
      setSwapMode(false);
      setSwapFirst(null);
      setStatus('');
    }
  };

  // ---------- RENDU ----------

  if (phase === 'modes') {
    const fmt = (list) => list.map((m) => `${m.score}pts→🪙${m.coins}`).join(' · ');
    return (
      <View style={styles.screen} {...panHandlers}>
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Retour</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>🔢 2048</Text>
        </View>

        <View style={styles.modePanel}>
          <TouchableOpacity style={styles.modeCard} onPress={() => startNew('normal')}>
            <Text style={styles.modeTitle}>♾️ Classique</Text>
            <Text style={styles.modeDesc}>Sans limite de temps, jeu infini après 2048.</Text>
            <Text style={styles.coinInfo}>🪙 {fmt(COINS_CONFIG.classique)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeCard} onPress={() => startNew('rush')}>
            <Text style={styles.modeTitle}>⏱️ Rush 60s</Text>
            <Text style={styles.modeDesc}>Chrono serré, pas de power-ups.</Text>
            <Text style={styles.coinInfo}>🪙 {fmt(COINS_CONFIG.rush60s)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen} {...panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity onPress={backToModes} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔢 2048</Text>
        <Text style={styles.badge}>{mode === 'rush' ? 'RUSH 60S' : 'SOLO'}</Text>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
        {mode === 'rush' ? (
          <View style={[styles.scoreCard, rushTimeLeft <= 10 && styles.scoreCardDanger]}>
            <Text style={styles.scoreLabel}>Temps</Text>
            <Text style={[styles.scoreValue, rushTimeLeft <= 10 && { color: COLORS.danger }]}>{rushTimeLeft}s</Text>
          </View>
        ) : (
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Record</Text>
            <Text style={styles.scoreValue}>{best}</Text>
          </View>
        )}
      </View>

      {!!status && <Text style={styles.status}>{status}</Text>}

      <View style={styles.boardWrap}>
        <View style={styles.board} {...panResponder.panHandlers}>
          {Array.from({ length: SIZE }).map((_, r) => (
            <View key={r} style={styles.boardRow}>
              {Array.from({ length: SIZE }).map((__, c) => {
                const v = grid[r][c];
                const t = tileStyle(v);
                const scale = cellAnims[r][c];
                const selected = swapMode && swapFirst && swapFirst[0] === r && swapFirst[1] === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.cell,
                      { backgroundColor: t.bg },
                      (laserMode || swapMode) && v !== 0 && styles.cellSelectable,
                      selected && styles.cellSelected,
                    ]}
                    activeOpacity={laserMode || swapMode ? 0.6 : 1}
                    onPress={() => handleCellTap(r, c)}
                    disabled={!laserMode && !swapMode}
                  >
                    {v !== 0 && (
                      <Animated.Text style={[styles.cellText, { color: t.color, transform: [{ scale }] }]}>
                        {v}
                      </Animated.Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {mode !== 'rush' && (
        <View style={styles.powerRow}>
          <PowerButton label="↩️" cost={UNDO_COST} coins={coins} disabled={over || historyRef.current.length === 0} onPress={handleUndo} />
          <PowerButton label="🔨" cost={LASER_COST} coins={coins} disabled={over} active={laserMode} onPress={handleLaser} />
          <PowerButton label="🔀" cost={SWAP_COST} coins={coins} disabled={over} active={swapMode} onPress={handleSwap} />
        </View>
      )}

      <TouchableOpacity style={styles.newGameBtn} onPress={() => startNew(mode)}>
        <Text style={styles.primaryBtnText}>🔁 Nouvelle partie</Text>
      </TouchableOpacity>
    </View>
  );
}

function PowerButton({ label, cost, coins, disabled, active, onPress }) {
  const canAfford = coins >= cost;
  return (
    <TouchableOpacity
      style={[styles.powerBtn, active && styles.powerBtnActive, (disabled || !canAfford) && styles.powerBtnDisabled]}
      onPress={onPress}
      disabled={disabled || !canAfford}
    >
      <Text style={styles.powerBtnIcon}>{label}</Text>
      <Text style={styles.powerBtnCost}>🪙{cost}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  backBtn: { paddingVertical: 6, paddingRight: 4 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  badge: {
    marginLeft: 'auto',
    color: COLORS.buttonA,
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: COLORS.buttonA,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  modePanel: { marginTop: 16, gap: 14 },
  modeCard: {
    backgroundColor: COLORS.board,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2a2f45',
  },
  modeTitle: { color: COLORS.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  modeDesc: { color: COLORS.muted, fontSize: 13 },
  coinInfo: { color: COLORS.muted, fontSize: 12, marginTop: 10 },

  scoreRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  scoreCard: {
    flex: 1,
    backgroundColor: COLORS.board,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scoreCardDanger: { borderWidth: 1, borderColor: COLORS.danger },
  scoreLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  scoreValue: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 2 },

  status: { color: COLORS.text, textAlign: 'center', marginTop: 10, fontSize: 13, fontWeight: '700', minHeight: 18 },

  boardWrap: { alignItems: 'center', marginTop: 14 },
  board: { backgroundColor: COLORS.board, borderRadius: 16, padding: 8 },
  boardRow: { flexDirection: 'row' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 12,
    margin: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelectable: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  cellSelected: { borderWidth: 3, borderColor: COLORS.buttonA },
  cellText: { fontSize: 24, fontWeight: '800' },

  powerRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 18 },
  powerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.board,
    borderWidth: 1,
    borderColor: COLORS.buttonB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerBtnActive: { backgroundColor: COLORS.buttonB },
  powerBtnDisabled: { opacity: 0.35 },
  powerBtnIcon: { fontSize: 20 },
  powerBtnCost: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },

  newGameBtn: {
    marginTop: 18,
    backgroundColor: COLORS.buttonA,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0b0d13', fontSize: 15, fontWeight: '800' },
});

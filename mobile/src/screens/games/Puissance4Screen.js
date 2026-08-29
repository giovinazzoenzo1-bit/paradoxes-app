// Puissance 4 — port fidèle de la logique déjà validée dans index.html (PWA).
// Pas de cahier des charges dans le dossier Drive "Puissance 4" (vide) — le
// PWA fait foi. Grille 6×7, mode Ami (pass-and-play) ou Bot (2 difficultés),
// pas d'undo/streaks/manches (le PWA n'en a pas pour ce jeu, contrairement
// au Morpion : une partie = une victoire directe).
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration } from 'react-native';
import { useCoins } from '../../context/CoinsContext';
import { ROWS, COLS, emptyBoard, findDropRow, validCols, checkWinAt, botPickCol } from '../../games/puissance4/puissance4Logic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#141721',
  board: '#1c3a5e',
  cell: '#0f2138',
  red: '#FF5252',
  yellow: '#FFD54F',
  text: '#eef0f6',
  muted: '#8d93ab',
  primary: '#29B6F6',
};

const COINS_CONFIG = { facile: 2, normal: 6 };
const CELL_SIZE = 42;

export default function Puissance4Screen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('setup'); // 'setup' | 'playing'
  const [mode, setMode] = useState('ami'); // 'ami' | 'bot'
  const [difficulty, setDifficulty] = useState('normal'); // 'facile' | 'normal'

  const [board, setBoard] = useState(emptyBoard());
  const [turn, setTurn] = useState(1); // 1 = rouge, 2 = jaune
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState('');
  const [coinsWon, setCoinsWon] = useState(0);

  const gameIdRef = useRef(0);
  const botTimeoutRef = useRef(null);
  const cellAnims = useRef(
    Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => new Animated.Value(0)))
  ).current;

  const statusForTurn = useCallback(
    (t, over_) => {
      if (over_) return status;
      if (mode === 'bot') return t === 1 ? '🔴 Tour : Toi' : '🟡 Le bot réfléchit...';
      return t === 1 ? '🔴 Tour : Rouge' : '🟡 Tour : Jaune';
    },
    [mode, status]
  );

  const vibrate = (pattern) => Vibration.vibrate(pattern);

  const popCell = (r, c) => {
    cellAnims[r][c].setValue(0);
    Animated.spring(cellAnims[r][c], { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }).start();
  };

  const startNew = useCallback(() => {
    gameIdRef.current++;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    const b = emptyBoard();
    setBoard(b);
    cellAnims.forEach((row) => row.forEach((a) => a.setValue(0)));
    setTurn(1);
    setOver(false);
    setCoinsWon(0);
    setStatus(mode === 'bot' ? '🔴 Tour : Toi' : '🔴 Tour : Rouge');
    setPhase('playing');
  }, [mode, cellAnims]);

  const openSetup = () => {
    gameIdRef.current++;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    setPhase('setup');
  };

  const drop = useCallback(
    (col, currentBoard, player) => {
      const r = findDropRow(currentBoard, col);
      if (r === -1) return currentBoard;
      const nb = currentBoard.map((row) => [...row]);
      nb[r][col] = player;
      setBoard(nb);
      popCell(r, col);
      vibrate(player === 1 ? [10] : [10, 30, 10]);

      if (checkWinAt(nb, r, col, player)) {
        setOver(true);
        const winnerLabel = mode === 'bot' ? (player === 1 ? 'Toi' : 'Le bot') : player === 1 ? '🔴 Rouge' : '🟡 Jaune';
        setStatus(`🟩 ${winnerLabel} a gagné !`);
        vibrate([30, 20, 30, 20, 60]);
        if (mode === 'bot' && player === 1) {
          const gain = COINS_CONFIG[difficulty] || 6;
          addCoinsLimited('puissance4', gain).then((awarded) => setCoinsWon(awarded));
        }
        return nb;
      }
      if (nb.every((row) => row.every((v) => v !== 0))) {
        setOver(true);
        setStatus('🟨 Match nul !');
        return nb;
      }
      const nextTurn = player === 1 ? 2 : 1;
      setTurn(nextTurn);
      setStatus(mode === 'bot' ? (nextTurn === 1 ? '🔴 Tour : Toi' : '🟡 Le bot réfléchit...') : nextTurn === 1 ? '🔴 Tour : Rouge' : '🟡 Tour : Jaune');
      return nb;
    },
    [mode, difficulty, addCoinsLimited]
  );

  // Tour du bot
  useEffect(() => {
    if (mode !== 'bot' || turn !== 2 || over || phase !== 'playing') return;
    const gid = gameIdRef.current;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    botTimeoutRef.current = setTimeout(() => {
      if (gid !== gameIdRef.current) return;
      try {
        const col = botPickCol(board, difficulty);
        if (col === null || col === undefined || findDropRow(board, col) === -1) {
          throw new Error('colonne invalide calculée par le bot');
        }
        drop(col, board, 2);
      } catch (err) {
        const fallback = validCols(board);
        if (fallback.length > 0) drop(fallback[Math.floor(Math.random() * fallback.length)], board, 2);
      }
    }, 600);
    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, mode, over, phase]);

  const handleColumnTap = (col) => {
    if (over) return;
    if (mode === 'bot' && turn === 2) return;
    if (findDropRow(board, col) === -1) return; // colonne pleine
    drop(col, board, turn);
  };

  // ---------- RENDU ----------

  if (phase === 'setup') {
    const gain = COINS_CONFIG[difficulty] || 6;
    return (
      <View style={styles.screen} {...panHandlers}>
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Retour</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>🔴 Puissance 4</Text>
        </View>

        <View style={styles.setupPanel}>
          <Text style={styles.setupLabel}>Mode</Text>
          <View style={styles.row}>
            <SetupButton label="🧑‍🤝‍🧑 Contre un ami" active={mode === 'ami'} onPress={() => setMode('ami')} />
            <SetupButton label="🤖 Contre le bot" active={mode === 'bot'} onPress={() => setMode('bot')} />
          </View>

          {mode === 'bot' && (
            <>
              <Text style={styles.setupLabel}>Difficulté</Text>
              <View style={styles.row}>
                <SetupButton label="😊 Facile" active={difficulty === 'facile'} onPress={() => setDifficulty('facile')} />
                <SetupButton label="😐 Normal" active={difficulty === 'normal'} onPress={() => setDifficulty('normal')} />
              </View>
              <Text style={styles.coinInfo}>🪙 {gain} pièces si tu gagnes.</Text>
            </>
          )}

          {mode === 'ami' && (
            <Text style={styles.coinInfo}>🟨 Mode Ami : aucune pièce (pour éviter de farmer en jouant les 2 côtés soi-même).</Text>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={startNew}>
            <Text style={styles.primaryBtnText}>Jouer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen} {...panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity onPress={openSetup} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.status}>{status}</Text>

      <View style={styles.boardWrap}>
        <View style={styles.board}>
          {Array.from({ length: COLS }).map((_, c) => (
            <TouchableOpacity
              key={c}
              style={styles.column}
              activeOpacity={0.6}
              onPress={() => handleColumnTap(c)}
              disabled={over}
            >
              {Array.from({ length: ROWS }).map((__, r) => {
                const v = board[r][c];
                const scale = cellAnims[r][c].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.2, 1] });
                return (
                  <View key={r} style={styles.cell}>
                    {v !== 0 && (
                      <Animated.View
                        style={[
                          styles.piece,
                          { backgroundColor: v === 1 ? COLORS.red : COLORS.yellow },
                          { transform: [{ scale }] },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {over && (
        <View style={styles.endPanel}>
          {coinsWon > 0 && <Text style={styles.coinInfo}>🪙 +{coinsWon} pièces gagnées</Text>}
          <TouchableOpacity style={styles.replayBtn} onPress={startNew}>
            <Text style={styles.primaryBtnText}>🔁 Rejouer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function SetupButton({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.setupBtn, active && styles.setupBtnActive]} onPress={onPress}>
      <Text style={[styles.setupBtnText, active && styles.setupBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },

  setupPanel: { marginTop: 8 },
  setupLabel: { color: COLORS.muted, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setupBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.cell,
    borderWidth: 1,
    borderColor: '#2a3142',
  },
  setupBtnActive: { backgroundColor: '#1f3a52', borderColor: COLORS.primary },
  setupBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  setupBtnTextActive: { color: COLORS.text },
  coinInfo: { color: COLORS.muted, fontSize: 12, marginTop: 12, textAlign: 'center' },

  primaryBtn: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0b0d13', fontSize: 16, fontWeight: '800' },

  status: { color: COLORS.text, textAlign: 'center', marginTop: 4, fontSize: 15, fontWeight: '700', minHeight: 20 },

  boardWrap: { alignItems: 'center', marginTop: 14 },
  board: {
    flexDirection: 'row',
    backgroundColor: COLORS.board,
    borderRadius: 20,
    padding: 8,
  },
  column: { alignItems: 'center' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    backgroundColor: COLORS.cell,
    margin: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piece: {
    width: CELL_SIZE - 6,
    height: CELL_SIZE - 6,
    borderRadius: (CELL_SIZE - 6) / 2,
  },

  endPanel: { marginTop: 20, alignItems: 'center' },
  replayBtn: {
    marginTop: 12,
    backgroundColor: '#00E676',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});

// Sudoku — port fidèle de la logique déjà validée dans index.html (PWA).
// Pas de cahier des charges dans le dossier Drive "Sudoku" (vide) — le PWA
// fait foi. Génération avec solution garantie unique (backtracking +
// comptage de solutions), 3 vies, indices donnés non modifiables. Undo et
// Effacer : 1 utilisation gratuite par partie dans le PWA (puis pub) — en
// V1 mobile, désactivés après la charge gratuite (pas de SDK pub), même
// traitement que l'Undo du Morpion. Indice (Hint) : 100% payant en pub dans
// le PWA sans alternative gratuite — non porté en V1 plutôt que d'inventer
// un prix en pièces non validé ; à trancher avec l'utilisateur plus tard.
// Non porté (même décision que les autres jeux à chrono) : le classement.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Dimensions } from 'react-native';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import { DIFFICULTIES, generatePuzzle, conflicts } from '../../games/sudoku/sudokuLogic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#141721',
  board: '#1c2032',
  cellGiven: '#232840',
  cellEditable: '#1a1e30',
  cellSelected: '#2f3a52',
  cellConflict: 'rgba(255,82,82,0.25)',
  border: '#2a2f45',
  borderThick: '#4a5170',
  text: '#eef0f6',
  muted: '#8d93ab',
  given: '#8d93ab',
  entered: '#29B6F6',
  conflictText: '#FF5252',
};

const COINS_CONFIG = {
  facile: { threshold: 300, coins: 17 },
  moyen: { threshold: 480, coins: 46 },
  difficile: { threshold: 720, coins: 120 },
};
const LEVEL_LABELS = { facile: '🟩 Facile', moyen: '🟨 Moyen', difficile: '🟥 Difficile' };

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 32 - 16, 340);
const CELL = Math.floor(BOARD_SIZE / 9);

export default function SudokuScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('levels'); // 'levels' | 'playing'
  const [level, setLevel] = useState('facile');
  const [given, setGiven] = useState([]);
  const [grid, setGrid] = useState([]);
  const [solution, setSolution] = useState([]);
  const [selected, setSelected] = useState(null);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState([]); // [{r,c}]
  const [undoUsed, setUndoUsed] = useState(false);
  const [eraseUsed, setEraseUsed] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const startTimeRef = useRef(0);
  const timerRef = useRef(null);
  const shakeAnims = useRef({}).current;

  const getShake = (r, c) => {
    const key = `${r}-${c}`;
    if (!shakeAnims[key]) shakeAnims[key] = new Animated.Value(0);
    return shakeAnims[key];
  };

  const triggerShake = (r, c) => {
    const a = getShake(r, c);
    a.setValue(0);
    Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(a, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const startLevel = useCallback((lvl) => {
    const { puzzle, solution: sol } = generatePuzzle(DIFFICULTIES[lvl]);
    setLevel(lvl);
    setSolution(sol);
    setGiven(puzzle.map((row) => row.map((v) => v !== 0)));
    setGrid(puzzle.map((row) => [...row]));
    setSelected(null);
    setLives(3);
    setGameOver(false);
    setWon(false);
    setStatus('');
    setHistory([]);
    setUndoUsed(false);
    setEraseUsed(false);
    setSeconds(0);
    startTimeRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    setPhase('playing');
  }, []);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const backToLevels = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('levels');
  };

  const selectCell = (r, c) => {
    if (gameOver || won) return;
    if (given[r][c]) return;
    setSelected({ r, c });
  };

  const checkWin = useCallback(
    (currentGrid) => {
      const full = currentGrid.every((row) => row.every((v) => v !== 0));
      if (!full) return;
      if (timerRef.current) clearInterval(timerRef.current);
      setWon(true);
      setStatus('🟩 Sudoku résolu, bravo !');
      Vibration.vibrate([20, 20, 20, 20, 60]);
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const cfg = COINS_CONFIG[level];
      if (cfg && elapsed <= cfg.threshold) {
        addCoinsLimited('sudoku', cfg.coins).then((awarded) => {
          setStatus((s) => s + ` 🪙 +${awarded} pièces (moins de ${formatTime(cfg.threshold)}) !`);
        });
      }
    },
    [level, addCoinsLimited]
  );

  const inputValue = (value) => {
    if (!selected || gameOver || won) return;
    const { r, c } = selected;
    if (given[r][c] || grid[r][c] !== 0) return;
    if (value === solution[r][c]) {
      const ng = grid.map((row) => [...row]);
      ng[r][c] = value;
      setGrid(ng);
      setHistory((h) => [...h.slice(-49), { r, c }]);
      Vibration.vibrate(10);
      checkWin(ng);
    } else {
      Vibration.vibrate([15, 15, 15]);
      setLives((l) => {
        const nl = l - 1;
        if (nl <= 0) {
          setGameOver(true);
          setStatus('🟥 Plus de vies — partie perdue.');
          if (timerRef.current) clearInterval(timerRef.current);
        }
        return nl;
      });
      triggerShake(r, c);
    }
  };

  const handleErase = () => {
    if (!selected || gameOver || won) return;
    const { r, c } = selected;
    if (given[r][c] || grid[r][c] === 0) return;
    if (eraseUsed) return; // limite : 1 gratuite par partie (pas de SDK pub en V1)
    setEraseUsed(true);
    const ng = grid.map((row) => [...row]);
    ng[r][c] = 0;
    setGrid(ng);
  };

  const handleUndo = () => {
    if (gameOver || won || history.length === 0) return;
    if (undoUsed) return; // limite : 1 gratuite par partie (pas de SDK pub en V1)
    setUndoUsed(true);
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    const ng = grid.map((row) => [...row]);
    ng[last.r][last.c] = 0;
    setGrid(ng);
  };

  const conflictMap = grid.length ? conflicts(grid) : [];

  // ---------- RENDU ----------

  if (phase === 'levels') {
    return (
      <View style={styles.screen} {...panHandlers}>
        <CoinBar />
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Retour</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>🔢 Sudoku</Text>
        </View>

        <View style={styles.levelPanel}>
          {Object.keys(DIFFICULTIES).map((lvl) => (
            <TouchableOpacity key={lvl} style={styles.levelCard} onPress={() => startLevel(lvl)}>
              <Text style={styles.levelLabel}>{LEVEL_LABELS[lvl]}</Text>
              <Text style={styles.levelCoin}>
                🪙 {COINS_CONFIG[lvl].coins} pièces sous {formatTime(COINS_CONFIG[lvl].threshold)} de temps
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={backToLevels} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.levelBadge}>{LEVEL_LABELS[level]}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Temps</Text>
          <Text style={styles.statValue}>{formatTime(seconds)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Vies</Text>
          <Text style={styles.statValue}>{'❤️'.repeat(lives)}{'🤍'.repeat(3 - lives)}</Text>
        </View>
      </View>

      {!!status && <Text style={styles.status}>{status}</Text>}

      <View style={styles.boardWrap}>
        <View style={styles.board}>
          {Array.from({ length: 9 }).map((_, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {Array.from({ length: 9 }).map((__, c) => {
                const v = grid[r][c];
                const isGiven = given[r]?.[c];
                const isSelected = selected && selected.r === r && selected.c === c;
                const isConflict = conflictMap[r]?.[c];
                const shake = getShake(r, c);
                const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });
                return (
                  <Animated.View key={c} style={{ transform: [{ translateX }] }}>
                    <TouchableOpacity
                      style={[
                        styles.cell,
                        { width: CELL, height: CELL },
                        isGiven ? styles.cellGiven : styles.cellEditable,
                        isSelected && styles.cellSelected,
                        isConflict && styles.cellConflict,
                        (c === 2 || c === 5) && styles.borderRight,
                        (r === 2 || r === 5) && styles.borderBottom,
                      ]}
                      activeOpacity={isGiven ? 1 : 0.6}
                      onPress={() => selectCell(r, c)}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          { color: isGiven ? COLORS.given : isConflict ? COLORS.conflictText : COLORS.entered },
                        ]}
                      >
                        {v || ''}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {!won && !gameOver && (
        <>
          <View style={styles.numpad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <TouchableOpacity key={d} style={styles.numBtn} onPress={() => inputValue(d)}>
                <Text style={styles.numBtnText}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, (history.length === 0 || undoUsed) && styles.actionBtnDisabled]}
              onPress={handleUndo}
              disabled={history.length === 0 || undoUsed}
            >
              <Text style={styles.actionBtnText}>↩️ Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, eraseUsed && styles.actionBtnDisabled]}
              onPress={handleErase}
              disabled={eraseUsed}
            >
              <Text style={styles.actionBtnText}>⌫ Effacer</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {(won || gameOver) && (
        <TouchableOpacity style={styles.replayBtn} onPress={() => startLevel(level)}>
          <Text style={styles.replayBtnText}>🔁 Rejouer</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.changeLevelBtn} onPress={backToLevels}>
        <Text style={styles.changeLevelBtnText}>Changer de difficulté</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  levelBadge: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginLeft: 8 },

  levelPanel: { marginTop: 8, gap: 12 },
  levelCard: {
    backgroundColor: COLORS.board,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelLabel: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  levelCoin: { color: COLORS.muted, fontSize: 12, marginTop: 6 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: COLORS.board, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  statLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginTop: 2 },

  status: { color: COLORS.text, textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: '700', minHeight: 16 },

  boardWrap: { alignItems: 'center', marginTop: 10 },
  board: { backgroundColor: COLORS.board, borderRadius: 8, padding: 2 },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  cellGiven: { backgroundColor: COLORS.cellGiven },
  cellEditable: { backgroundColor: COLORS.cellEditable },
  cellSelected: { backgroundColor: COLORS.cellSelected },
  cellConflict: { backgroundColor: COLORS.cellConflict },
  borderRight: { borderRightWidth: 2, borderRightColor: COLORS.borderThick },
  borderBottom: { borderBottomWidth: 2, borderBottomColor: COLORS.borderThick },
  cellText: { fontSize: 16, fontWeight: '700' },

  numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 16 },
  numBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.board,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  numBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '800' },

  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 14 },
  actionBtn: {
    backgroundColor: COLORS.board,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#29B6F6',
  },
  actionBtnDisabled: { opacity: 0.35 },
  actionBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },

  replayBtn: {
    marginTop: 18,
    alignSelf: 'center',
    backgroundColor: '#00E676',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  replayBtnText: { color: '#04120c', fontSize: 16, fontWeight: '800' },

  changeLevelBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  changeLevelBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
});

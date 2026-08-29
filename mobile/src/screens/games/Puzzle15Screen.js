// Puzzle 15 (taquin) — port fidèle de la logique déjà validée dans
// index.html (PWA). Cahier des charges : Google Drive "Puzzle 15" (docs
// Enzo = gameplay/logique, Flavio = UI/design). Divergences volontaires
// PWA > cahier des charges (le PWA fait foi, déjà testé) :
//  - Déplacement simple tuile adjacente uniquement, PAS de glissement en
//    bloc multi-tuiles pourtant mentionné dans le cahier des charges.
//  - Chronomètre démarre immédiatement à l'ouverture, pas au 1er coup.
//  - Pas de power-up Undo (absent du PWA malgré la mention dans le cahier
//    des charges), pas de gestion pause/arrière-plan.
// Non porté (même décision que 2048/Memory/Snake) : le classement (perso +
// mondial fictif).
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import { neighbors, generateTiles, gradientColor, tap as tapLogic, isSolved } from '../../games/puzzle15/puzzle15Logic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#0A0D12',
  board: '#181F2A',
  tileBorder: '#334155',
  gold: '#F59E0B',
  emerald: '#10B981',
  text: '#eef0f6',
  muted: '#94A3B8',
};

const LEVELS = [
  { n: 4, label: '15 (4×4)', dot: '#10B981' },
  { n: 5, label: '24 (5×5)', dot: '#FBBF24' },
  { n: 6, label: '35 (6×6)', dot: '#FF7B00' },
  { n: 7, label: '48 (7×7)', dot: '#EF4444' },
];

const COINS_CONFIG = {
  4: { threshold: 190, coins: 5 },
  5: { threshold: 380, coins: 5 },
  6: { threshold: 540, coins: 5 },
  7: { threshold: 700, coins: 5 },
};

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

function fontSizeFor(n) {
  if (n <= 4) return 18;
  if (n <= 5) return 15;
  if (n <= 6) return 12;
  return 10;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function Puzzle15Screen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('levels'); // 'levels' | 'playing'
  const [n, setN] = useState(4);
  const [tiles, setTiles] = useState([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState('');
  const [best, setBest] = useState(null); // {seconds, moves}
  const [solved, setSolved] = useState(false);

  const timerRef = useRef(null);
  const shakeAnims = useRef({}).current;

  const getShake = (i) => {
    if (!shakeAnims[i]) shakeAnims[i] = new Animated.Value(0);
    return shakeAnims[i];
  };

  const shakeTile = (i) => {
    const a = getShake(i);
    a.setValue(0);
    Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(a, { toValue: -1, duration: 40, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const loadBest = useCallback(async (size) => {
    const raw = await AsyncStorage.getItem(`p15Best:${size}`);
    setBest(raw ? JSON.parse(raw) : null);
  }, []);

  const startLevel = useCallback(
    (size) => {
      setN(size);
      setTiles(generateTiles(size));
      setMoves(0);
      setSeconds(0);
      setStatus('');
      setSolved(false);
      loadBest(size);
      setPhase('playing');
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    },
    [loadBest]
  );

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const backToLevels = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('levels');
  };

  const handleTap = (i) => {
    if (solved) return;
    const emptyIdx = tiles.indexOf(0);
    if (!neighbors(emptyIdx, n).includes(i)) {
      shakeTile(i);
      Vibration.vibrate(15);
      return;
    }
    const { tiles: newTiles } = tapLogic(tiles, i, n);
    const newMoves = moves + 1;
    setTiles(newTiles);
    setMoves(newMoves);

    if (isSolved(newTiles, n)) {
      setSolved(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus(`🟩 Résolu en ${newMoves} coups, en ${formatTime(seconds)} !`);
      Vibration.vibrate([20, 20, 20, 20, 60]);

      const cfg = COINS_CONFIG[n];
      if (cfg && seconds <= cfg.threshold) {
        addCoinsLimited('puzzle15', cfg.coins).then((awarded) => {
          setStatus((s) => s + ` 🪙 +${awarded} pièces (moins de ${formatTime(cfg.threshold)}) !`);
        });
      }
      if (best === null || seconds < best.seconds) {
        const newBest = { seconds, moves: newMoves };
        setBest(newBest);
        AsyncStorage.setItem(`p15Best:${n}`, JSON.stringify(newBest));
      }
    }
  };

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
          <Text style={styles.title}>🧩 Puzzle 15</Text>
        </View>

        <View style={styles.levelPanel}>
          {LEVELS.map((l) => (
            <TouchableOpacity key={l.n} style={styles.levelCard} onPress={() => startLevel(l.n)}>
              <View style={[styles.levelDot, { backgroundColor: l.dot }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.levelLabel}>{l.label}</Text>
                <Text style={styles.levelCoin}>
                  🪙 {COINS_CONFIG[l.n].coins} pièces sous {formatTime(COINS_CONFIG[l.n].threshold)} de temps
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  const boardPadding = 8;
  const gap = n > 5 ? 2 : 4;
  const available = SCREEN_WIDTH - 32 - boardPadding * 2;
  const cellSize = Math.floor((available - gap * 2 * n) / n);
  const fontSize = fontSizeFor(n);
  const maxValue = tiles.length - 1;

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={backToLevels} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Temps</Text>
          <Text style={styles.statValue}>{formatTime(seconds)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Coups</Text>
          <Text style={styles.statValue}>{moves}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Meilleur</Text>
          <Text style={styles.statValueSmall}>{best ? `${formatTime(best.seconds)} (${best.moves})` : '—'}</Text>
        </View>
      </View>

      {!!status && <Text style={styles.status}>{status}</Text>}

      <View style={styles.boardWrap}>
        <View style={[styles.board, { padding: boardPadding }]}>
          {Array.from({ length: n }).map((_, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {Array.from({ length: n }).map((__, c) => {
                const i = r * n + c;
                const v = tiles[i];
                if (v === undefined) return <View key={c} style={{ width: cellSize, height: cellSize, margin: gap }} />;
                const isEmpty = v === 0;
                const shake = getShake(i);
                const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });
                return (
                  <Animated.View key={c} style={{ transform: [{ translateX }] }}>
                    <TouchableOpacity
                      style={[
                        styles.tile,
                        { width: cellSize, height: cellSize, margin: gap },
                        isEmpty && styles.tileEmpty,
                        !isEmpty && { backgroundColor: gradientColor(v, maxValue) },
                      ]}
                      activeOpacity={isEmpty ? 1 : 0.7}
                      onPress={() => !isEmpty && handleTap(i)}
                    >
                      {!isEmpty && <Text style={[styles.tileText, { fontSize }]}>{v}</Text>}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {solved ? (
        <TouchableOpacity style={styles.replayBtn} onPress={() => startLevel(n)}>
          <Text style={styles.replayBtnText}>🔁 Rejouer</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.shuffleBtn} onPress={() => startLevel(n)}>
          <Text style={styles.shuffleBtnText}>🎲 Mélanger</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.changeLevelBtn} onPress={backToLevels}>
        <Text style={styles.changeLevelBtnText}>Changer de niveau</Text>
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

  levelPanel: { marginTop: 8, gap: 12 },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.board,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.tileBorder,
  },
  levelDot: { width: 14, height: 14, borderRadius: 7, marginRight: 14 },
  levelLabel: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  levelCoin: { color: COLORS.muted, fontSize: 12, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: COLORS.board, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  statLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  statValue: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  statValueSmall: { color: COLORS.text, fontSize: 11, fontWeight: '800', marginTop: 4 },

  status: { color: COLORS.emerald, textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: '700', minHeight: 16 },

  boardWrap: { alignItems: 'center', marginTop: 10 },
  board: { backgroundColor: COLORS.board, borderRadius: 16 },
  tile: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmpty: { backgroundColor: '#12161f' },
  tileText: { color: '#0a0a14', fontWeight: '800' },

  shuffleBtn: {
    marginTop: 18,
    alignSelf: 'center',
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  shuffleBtnText: { color: '#1a1300', fontSize: 14, fontWeight: '800' },

  replayBtn: {
    marginTop: 18,
    alignSelf: 'center',
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  replayBtnText: { color: '#04120c', fontSize: 16, fontWeight: '800' },

  changeLevelBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  changeLevelBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
});

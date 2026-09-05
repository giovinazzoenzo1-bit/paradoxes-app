// Memory — port fidèle de la logique déjà validée dans index.html (PWA).
// Cahier des charges : Google Drive "Memory" (docs Enzo = gameplay/logique,
// Flavio = UI/design). Couleurs suivent le doc Flavio. Délai de mismatch
// 800ms et style de carte (simple, pas de vraie rotation 3D) suivent le PWA
// réel, qui diverge légèrement du wishlist visuel du cahier des charges —
// le PWA fait foi (déjà testé). Power-ups Flash X-Ray / Aimant Paire payants
// en pièces uniquement (pas de SDK pub en mobile, même limite assumée que
// les autres jeux). Non porté (hors scope V1, comme pour le 2048) : le
// classement (perso signé anti-triche + mondial fictif).
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Dimensions } from 'react-native';
import BackButton from '../../components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import { DIFFICULTIES, generateCards, formatTime } from '../../games/memory/memoryLogic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#0A0B14',
  cardBack: '#181C30',
  cardBackAccent: '#FF0055',
  cardActive: '#252C4A',
  cardActiveBorder: '#00F0FF',
  matched: '#10B981',
  gold: '#FBBF24',
  xray: '#00F0FF',
  magnet: '#BD00FF',
  expert: '#EF4444',
  text: '#eef0f6',
  muted: '#8d93ab',
};

const COINS_CONFIG = {
  4: { threshold: 18, coins: 4 },
  6: { threshold: 60, coins: 15 },
  10: { threshold: 480, coins: 64 },
  14: { threshold: 900, coins: 200 },
};
const XRAY_COST = 75;
const MAGNET_COST = 100;
const MISMATCH_DELAY = 800;

const SCREEN_WIDTH = Dimensions.get('window').width;

function fontSizeFor(size) {
  if (size <= 4) return 22;
  if (size <= 6) return 17;
  if (size <= 10) return 12;
  return 9;
}

function gapFor(size) {
  return size > 6 ? 2 : 4;
}

export default function MemoryScreen({ onBack }) {
  const { addCoinsLimited, spendCoins } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('difficulty'); // 'difficulty' | 'playing'
  const [size, setSize] = useState(4);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]); // indices actuellement retournés (max 2)
  const [lock, setLock] = useState(false);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState('');
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(null);
  const [xrayActive, setXrayActive] = useState(false);

  const timerRef = useRef(null);
  const cardAnims = useRef({}).current;

  const getAnim = (i) => {
    if (!cardAnims[i]) cardAnims[i] = new Animated.Value(1);
    return cardAnims[i];
  };

  const popCard = (i) => {
    const a = getAnim(i);
    a.setValue(0.7);
    Animated.spring(a, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  };

  const vibrate = (pattern) => Vibration.vibrate(pattern);

  const loadBest = useCallback(async (s) => {
    const raw = await AsyncStorage.getItem(`memoryBest:${s}`);
    setBest(raw ? parseInt(raw, 10) : null);
  }, []);

  const startGame = useCallback(
    (selectedSize) => {
      setSize(selectedSize);
      const c = generateCards(selectedSize);
      setCards(c);
      setFlipped([]);
      setLock(false);
      setMoves(0);
      setSeconds(0);
      setStatus('');
      setOver(false);
      setXrayActive(false);
      loadBest(selectedSize);
      setPhase('playing');
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    },
    [loadBest]
  );

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const backToDifficulty = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('difficulty');
  };

  const finishGame = useCallback(
    async (finalMoves, finalSeconds) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setOver(true);
      setStatus(`🟩 Gagné en ${finalMoves} coups, en ${formatTime(finalSeconds)} !`);
      const cfg = COINS_CONFIG[size];
      if (cfg && finalSeconds <= cfg.threshold) {
        const awarded = await addCoinsLimited('memory', cfg.coins);
        setStatus((s) => s + ` 🪙 +${awarded} pièces (moins de ${formatTime(cfg.threshold)}) !`);
      }
      if (best === null || finalSeconds < best) {
        setBest(finalSeconds);
        await AsyncStorage.setItem(`memoryBest:${size}`, String(finalSeconds));
        vibrate([20, 20, 20, 20, 60]);
      }
    },
    [size, best, addCoinsLimited]
  );

  const flipCard = (i) => {
    if (lock || xrayActive) return;
    if (cards[i].flipped || cards[i].matched) return;
    const nc = cards.map((c, idx) => (idx === i ? { ...c, flipped: true } : c));
    setCards(nc);
    popCard(i);
    const nf = [...flipped, i];
    setFlipped(nf);

    if (nf.length === 2) {
      const newMoves = moves + 1;
      setMoves(newMoves);
      setLock(true);
      const [a, b] = nf;
      if (nc[a].icon === nc[b].icon) {
        const matchedCards = nc.map((c, idx) => (idx === a || idx === b ? { ...c, matched: true } : c));
        setCards(matchedCards);
        setFlipped([]);
        setLock(false);
        vibrate([10, 10, 10]);
        if (matchedCards.every((c) => c.matched)) {
          finishGame(newMoves, seconds);
        }
      } else {
        vibrate([15]);
        setTimeout(() => {
          setCards((prev) => prev.map((c, idx) => (idx === a || idx === b ? { ...c, flipped: false } : c)));
          setFlipped([]);
          setLock(false);
        }, MISMATCH_DELAY);
      }
    }
  };

  const handleXray = () => {
    if (lock || xrayActive) return;
    spendCoins(XRAY_COST).then((ok) => {
      if (!ok) return;
      setXrayActive(true);
      setLock(true);
      setTimeout(() => {
        setXrayActive(false);
        setLock(false);
      }, 1500);
    });
  };

  const handleMagnet = () => {
    if (lock || xrayActive) return;
    const remaining = [];
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].matched) remaining.push(i);
    }
    const byIcon = {};
    remaining.forEach((i) => {
      byIcon[cards[i].icon] = byIcon[cards[i].icon] || [];
      byIcon[cards[i].icon].push(i);
    });
    const pairs = Object.values(byIcon).filter((arr) => arr.length === 2);
    if (pairs.length === 0) return;
    spendCoins(MAGNET_COST).then((ok) => {
      if (!ok) return;
      const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
      const nc = cards.map((c, idx) => (idx === a || idx === b ? { ...c, matched: true, flipped: true } : c));
      setCards(nc);
      vibrate([10, 30, 10]);
      if (nc.every((c) => c.matched)) {
        finishGame(moves, seconds);
      }
    });
  };

  // ---------- RENDU ----------

  if (phase === 'difficulty') {
    return (
      <View style={styles.screen} {...panHandlers}>
      <CoinBar />
        <View style={styles.header}>
          {onBack && (
            <BackButton onPress={onBack} />
          )}
          <Text style={styles.title}>🃏 Memory</Text>
        </View>

        <View style={styles.diffPanel}>
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity key={d.size} style={styles.diffBtn} onPress={() => startGame(d.size)}>
              <Text style={styles.diffBtnText}>
                {d.emoji} {d.label}
              </Text>
              <Text style={styles.diffBtnCoin}>
                🪙 {COINS_CONFIG[d.size].coins} pièces sous {formatTime(COINS_CONFIG[d.size].threshold)} de temps
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  const boardPadding = 8;
  const gap = gapFor(size);
  const available = SCREEN_WIDTH - 32 - boardPadding * 2;
  const cellSize = Math.floor((available - gap * 2 * size) / size);
  const fontSize = fontSizeFor(size);

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        <BackButton onPress={backToDifficulty} />
        {size === 14 && <Text style={styles.expertBadge}>EXPERT</Text>}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Coups</Text>
          <Text style={styles.statValue}>{moves}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Temps</Text>
          <Text style={styles.statValue}>{formatTime(seconds)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Record</Text>
          <Text style={styles.statValue}>{best !== null ? formatTime(best) : '—'}</Text>
        </View>
      </View>

      {!!status && <Text style={styles.status}>{status}</Text>}

      <View style={styles.boardWrap}>
        <View style={[styles.board, { padding: boardPadding }]}>
          {Array.from({ length: size }).map((_, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {Array.from({ length: size }).map((__, c) => {
                const i = r * size + c;
                const card = cards[i];
                if (!card) return <View key={c} style={{ width: cellSize, height: cellSize, margin: gap }} />;
                const revealed = card.flipped || card.matched || xrayActive;
                const scale = getAnim(i);
                return (
                  <Animated.View key={c} style={{ transform: [{ scale }] }}>
                    <TouchableOpacity
                      style={[
                        styles.card,
                        { width: cellSize, height: cellSize, margin: gap },
                        revealed && !card.matched && styles.cardActive,
                        card.matched && styles.cardMatched,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => flipCard(i)}
                    >
                      <Text style={{ fontSize, color: revealed ? undefined : COLORS.cardBackAccent }}>
                        {revealed ? card.icon : '❓'}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.powerRow}>
        <TouchableOpacity style={[styles.powerBtn, { borderColor: COLORS.xray }]} onPress={handleXray}>
          <Text style={styles.powerBtnIcon}>🔦</Text>
          <Text style={styles.powerBtnCost}>🪙{XRAY_COST}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.powerBtn, { borderColor: COLORS.magnet }]} onPress={handleMagnet}>
          <Text style={styles.powerBtnIcon}>🧲</Text>
          <Text style={styles.powerBtnCost}>🪙{MAGNET_COST}</Text>
        </TouchableOpacity>
      </View>

      {over && (
        <TouchableOpacity style={styles.replayBtn} onPress={() => startGame(size)}>
          <Text style={styles.replayBtnText}>🔁 Rejouer</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.changeDiffBtn} onPress={backToDifficulty}>
        <Text style={styles.changeDiffBtnText}>Changer de difficulté</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  expertBadge: {
    marginLeft: 'auto',
    color: COLORS.expert,
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: COLORS.expert,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  diffPanel: { marginTop: 8, gap: 12 },
  diffBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  diffBtnText: { color: '#1a1300', fontSize: 16, fontWeight: '800' },
  diffBtnCoin: { color: '#4a3a00', fontSize: 12, fontWeight: '600', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statCard: { flex: 1, backgroundColor: '#14172B', borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  statLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginTop: 2 },

  status: { color: COLORS.text, textAlign: 'center', marginTop: 8, fontSize: 12, fontWeight: '700', minHeight: 16 },

  boardWrap: { alignItems: 'center', marginTop: 10 },
  board: { backgroundColor: '#14172B', borderRadius: 16 },
  card: {
    borderRadius: 8,
    backgroundColor: COLORS.cardBack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActive: { backgroundColor: COLORS.cardActive, borderWidth: 2, borderColor: COLORS.cardActiveBorder },
  cardMatched: { backgroundColor: 'rgba(16,185,129,0.25)', borderWidth: 1, borderColor: COLORS.matched, opacity: 0.7 },

  powerRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16 },
  powerBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#14172B',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerBtnIcon: { fontSize: 18 },
  powerBtnCost: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },

  changeDiffBtn: { marginTop: 14, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  changeDiffBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  replayBtn: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: COLORS.matched,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  replayBtnText: { color: '#04120c', fontSize: 15, fontWeight: '800' },
});

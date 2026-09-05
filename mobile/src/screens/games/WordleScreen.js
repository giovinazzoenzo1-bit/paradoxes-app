// Wordle — port depuis index.html (PWA), avec correction du bug de gestion
// des lettres doubles (voir wordleLogic.js). Design néon cyberpunk suivant
// le cahier des charges Drive (doc Flavio). Un seul mode (mot aléatoire),
// pas de mode Daily ni de power-ups — le PWA n'a jamais vraiment câblé ces
// fonctionnalités malgré leur mention dans le cahier des charges. Non porté
// (même décision que les autres jeux) : classement et partage social.
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import BackButton from '../../components/BackButton';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import { KEYBOARD_ROWS, pickTarget, evaluateGuess, updateKeyboardStates } from '../../games/wordle/wordleLogic';
import { WORDLE_DICTIONARY } from '../../games/wordle/wordleDictionary';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#0A0B14',
  cellEmpty: '#14172B',
  cellBorder: '#2A2F4A',
  cellActiveBorder: '#00F0FF',
  correct: '#00FF88',
  present: '#FFB800',
  absent: '#202438',
  absentText: '#6B7280',
  keyBase: '#1C2035',
  action: '#00F0FF',
  text: '#eef0f6',
  muted: '#94A3B8',
};

const COINS_CONFIG = { base: 3, tentative_5: 5, tentative_6: 3 };

export default function WordleScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [target, setTarget] = useState(() => pickTarget());
  const [history, setHistory] = useState([]); // [{guess, evaluation}]
  const [current, setCurrent] = useState('');
  const [row, setRow] = useState(0);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState('');
  const [keyStates, setKeyStates] = useState({});
  const [shake, setShake] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    setShake(true);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start(() => setShake(false));
  };

  const newGame = useCallback(() => {
    setTarget(pickTarget());
    setHistory([]);
    setCurrent('');
    setRow(0);
    setOver(false);
    setStatus('');
    setKeyStates({});
  }, []);

  const typeLetter = (letter) => {
    if (over || current.length >= 5) return;
    setCurrent((c) => c + letter);
  };

  const backspace = () => {
    if (over) return;
    setCurrent((c) => c.slice(0, -1));
  };

  const submit = () => {
    if (over || current.length !== 5) return;
    if (!WORDLE_DICTIONARY.has(current)) {
      triggerShake();
      setStatus("🟥 Ce mot n'existe pas");
      setTimeout(() => setStatus((s) => (s.startsWith('🟥 Ce mot') ? '' : s)), 1500);
      return;
    }
    const evaluation = evaluateGuess(current, target);
    const newHistory = [...history, { guess: current, evaluation }];
    setHistory(newHistory);
    setKeyStates((prev) => updateKeyboardStates(prev, current, evaluation));
    const won = current === target;
    const newRow = row + 1;
    setRow(newRow);
    setCurrent('');

    if (won) {
      setOver(true);
      setStatus('🟩 Gagné !');
      const gain = newRow === 5 ? COINS_CONFIG.tentative_5 : newRow === 6 ? COINS_CONFIG.tentative_6 : COINS_CONFIG.base;
      addCoinsLimited('wordle', gain).then((awarded) => {
        setStatus((s) => s + ` 🪙 +${awarded} pièces`);
      });
    } else if (newRow >= 6) {
      setOver(true);
      setStatus(`🟥 Perdu — le mot était ${target}.`);
    }
  };

  const translateX = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        {onBack && (
          <BackButton onPress={onBack} />
        )}
        <Text style={styles.title}>WORDLE</Text>
      </View>

      <Text style={styles.status}>{status}</Text>

      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, r) => {
          const isActive = r === row && !over;
          const rowData = r < history.length ? history[r] : null;
          const guessLetters = isActive ? current : '';
          return (
            <Animated.View
              key={r}
              style={[styles.gridRow, isActive && shake && { transform: [{ translateX }] }]}
            >
              {Array.from({ length: 5 }).map((__, c) => {
                let letter = '';
                let bg = COLORS.cellEmpty;
                let borderColor = COLORS.cellBorder;
                let textColor = COLORS.text;
                if (rowData) {
                  letter = rowData.guess[c];
                  const s = rowData.evaluation[c];
                  if (s === 'correct') {
                    bg = COLORS.correct;
                    textColor = '#0A0B14';
                  } else if (s === 'present') {
                    bg = COLORS.present;
                    textColor = '#0A0B14';
                  } else {
                    bg = COLORS.absent;
                    textColor = COLORS.absentText;
                  }
                  borderColor = bg;
                } else if (isActive) {
                  letter = guessLetters[c] || '';
                  if (letter) borderColor = COLORS.cellActiveBorder;
                }
                return (
                  <View key={c} style={[styles.cell, { backgroundColor: bg, borderColor }]}>
                    <Text style={[styles.cellText, { color: textColor }]}>{letter}</Text>
                  </View>
                );
              })}
            </Animated.View>
          );
        })}
      </View>

      {over && (
        <TouchableOpacity style={styles.replayBtn} onPress={newGame}>
          <Text style={styles.replayBtnText}>🔁 Nouvelle partie</Text>
        </TouchableOpacity>
      )}

      <View style={styles.keyboard}>
        {KEYBOARD_ROWS.map((krow, i) => (
          <View key={i} style={styles.keyboardRow}>
            {krow.map((k) => {
              if (k === 'ENTER') {
                return (
                  <TouchableOpacity key={k} style={[styles.key, styles.keyWide]} onPress={submit} disabled={over}>
                    <Text style={styles.keyTextSmall}>Valider</Text>
                  </TouchableOpacity>
                );
              }
              if (k === 'BACK') {
                return (
                  <TouchableOpacity key={k} style={[styles.key, styles.keyWide]} onPress={backspace} disabled={over}>
                    <Text style={styles.keyText}>⌫</Text>
                  </TouchableOpacity>
                );
              }
              const state = keyStates[k];
              let bg = COLORS.keyBase;
              let color = COLORS.text;
              if (state === 'correct') {
                bg = COLORS.correct;
                color = '#0A0B14';
              } else if (state === 'present') {
                bg = COLORS.present;
                color = '#0A0B14';
              } else if (state === 'absent') {
                bg = COLORS.absent;
                color = COLORS.absentText;
              }
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.key, { backgroundColor: bg }]}
                  onPress={() => typeLetter(k)}
                  disabled={over}
                >
                  <Text style={[styles.keyText, { color }]}>{k}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.coinInfo}>
        🪙 Trouvé : {COINS_CONFIG.base} pièces · 5e essai : {COINS_CONFIG.tentative_5} · 6e essai : {COINS_CONFIG.tentative_6}
      </Text>
    </View>
  );
}

const CELL_SIZE = 44;
const KEY_SIZE = 30;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '900', letterSpacing: 2 },

  status: { color: COLORS.text, textAlign: 'center', marginTop: 4, fontSize: 13, fontWeight: '700', minHeight: 16 },

  grid: { alignItems: 'center', marginTop: 8, gap: 6 },
  gridRow: { flexDirection: 'row', gap: 6 },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 22, fontWeight: '900' },

  replayBtn: {
    marginTop: 14,
    alignSelf: 'center',
    backgroundColor: COLORS.action,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  replayBtnText: { color: '#0A0B14', fontSize: 14, fontWeight: '800' },

  keyboard: { marginTop: 16, gap: 6 },
  keyboardRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  key: {
    minWidth: KEY_SIZE,
    height: 46,
    borderRadius: 8,
    backgroundColor: COLORS.keyBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  keyWide: { minWidth: KEY_SIZE * 1.8, paddingHorizontal: 6 },
  keyText: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  keyTextSmall: { color: COLORS.text, fontSize: 11, fontWeight: '800' },

  coinInfo: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 14 },
});

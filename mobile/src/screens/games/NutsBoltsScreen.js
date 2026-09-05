// Nuts and Bolts (tri par couleur) — port fidèle depuis index.html (PWA).
// Pas de cahier des charges Drive (dossier vide) — PWA fait foi. 50 niveaux
// progressifs, mélange garanti solvable (recherche best-first, vérifié
// <200ms même au niveau 50), déplacement en paquet de même couleur, undo
// 1 gratuit/niveau (puis désactivé, pas de SDK pub), pièce si résolu sous
// le seuil de temps (croissant avec le niveau). Progression (niveau max
// débloqué) persistée. Non porté (même décision que les autres) : classement.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Vibration } from 'react-native';
import BackButton from '../../components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import {
  ALL_COLORS,
  TOTAL_LEVELS,
  configForLevel,
  timeThreshold,
  generateSolvableRods,
  isWon,
  move as moveLogic,
} from '../../games/nutsbolts/nutsBoltsLogic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#141721',
  board: '#1c2032',
  border: '#2a2f45',
  text: '#eef0f6',
  muted: '#8d93ab',
  primary: '#f5b942',
};

const COINS_CONFIG = { coinsIfOnTime: 1, baseSeconds: 18, growthPerLevel: 0.35 };

export default function NutsBoltsScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('levels'); // 'levels' | 'playing'
  const [maxUnlocked, setMaxUnlocked] = useState(1);
  const [level, setLevel] = useState(1);
  const [rods, setRods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('');
  const [won, setWon] = useState(false);
  const [history, setHistory] = useState([]);
  const [undoUsed, setUndoUsed] = useState(false);

  const startTimeRef = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem('nbMaxLevel').then((v) => setMaxUnlocked(Math.min(TOTAL_LEVELS, (v ? parseInt(v, 10) : 0) + 1)));
  }, []);

  const startLevel = useCallback((lvl) => {
    setLevel(lvl);
    const cfg = configForLevel(lvl);
    const colors = ALL_COLORS.slice(0, cfg.colors);
    const newRods = generateSolvableRods(colors, cfg.emptyRods);
    setRods(newRods);
    setSelected(null);
    setHistory([]);
    setUndoUsed(false);
    setStatus('');
    setWon(false);
    startTimeRef.current = Date.now();
    setPhase('playing');
  }, []);

  const backToLevels = () => {
    AsyncStorage.getItem('nbMaxLevel').then((v) => setMaxUnlocked(Math.min(TOTAL_LEVELS, (v ? parseInt(v, 10) : 0) + 1)));
    setPhase('levels');
  };

  const handleTap = (i) => {
    if (won) return;
    if (selected === null) {
      if (rods[i].length > 0) setSelected(i);
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    const { rods: newRods, moved } = moveLogic(rods, selected, i);
    setSelected(null);
    if (moved) {
      setHistory((h) => [...h.slice(-19), rods]);
      setRods(newRods);
      Vibration.vibrate(10);
      if (isWon(newRods)) {
        setWon(true);
        setStatus(`🟩 Niveau ${level} terminé !`);
        Vibration.vibrate([20, 20, 20, 20, 60]);
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const threshold = timeThreshold(level, COINS_CONFIG.baseSeconds, COINS_CONFIG.growthPerLevel);
        if (elapsed <= threshold) {
          addCoinsLimited('nutsAndBolts', COINS_CONFIG.coinsIfOnTime).then((awarded) => {
            setStatus((s) => s + ` 🪙 +${awarded} pièce${awarded > 1 ? 's' : ''} (moins de ${threshold}s) !`);
          });
        }
        AsyncStorage.getItem('nbMaxLevel').then((v) => {
          const currentMax = v ? parseInt(v, 10) : 0;
          if (level > currentMax) AsyncStorage.setItem('nbMaxLevel', String(level));
        });
      }
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || undoUsed) return;
    setUndoUsed(true);
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRods(prev);
    setSelected(null);
    setStatus('');
    setWon(false);
  };

  const nextLevel = () => {
    if (level < TOTAL_LEVELS) startLevel(level + 1);
  };

  // ---------- RENDU ----------

  if (phase === 'levels') {
    return (
      <View style={styles.screen} {...panHandlers}>
        <CoinBar />
        <View style={styles.header}>
          {onBack && (
            <BackButton onPress={onBack} />
          )}
          <Text style={styles.title}>🔧 Nuts and Bolts</Text>
        </View>
        <Text style={styles.subtitle}>Trie les couleurs, une tige par couleur.</Text>

        <ScrollView contentContainerStyle={styles.levelGrid}>
          {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((lvl) => {
            const locked = lvl > maxUnlocked;
            return (
              <TouchableOpacity
                key={lvl}
                style={[styles.levelBtn, locked && styles.levelBtnLocked]}
                disabled={locked}
                onPress={() => startLevel(lvl)}
              >
                <Text style={styles.levelBtnText}>{locked ? '🔒' : lvl}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  const cfg = configForLevel(level);
  const threshold = timeThreshold(level, COINS_CONFIG.baseSeconds, COINS_CONFIG.growthPerLevel);

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        <BackButton onPress={backToLevels} />
        <Text style={styles.levelBadge}>Niveau {level}</Text>
      </View>

      <Text style={styles.coinInfo}>Sous {threshold}s : +{COINS_CONFIG.coinsIfOnTime} pièce</Text>
      {!!status && <Text style={styles.status}>{status}</Text>}

      <View style={styles.rodsWrap}>
        {rods.map((rod, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.rod, selected === i && styles.rodSelected]}
            onPress={() => handleTap(i)}
            activeOpacity={0.7}
          >
            {Array.from({ length: 4 }).map((_, slot) => {
              const nutColor = rod[3 - slot]; // empile visuellement du haut vers le bas
              return <View key={slot} style={[styles.nut, nutColor && { backgroundColor: nutColor }]} />;
            })}
          </TouchableOpacity>
        ))}
      </View>

      {won ? (
        <View style={styles.endRow}>
          <TouchableOpacity style={styles.replayBtn} onPress={() => startLevel(level)}>
            <Text style={styles.replayBtnText}>🔁 Rejouer</Text>
          </TouchableOpacity>
          {level < TOTAL_LEVELS && (
            <TouchableOpacity style={styles.nextBtn} onPress={nextLevel}>
              <Text style={styles.nextBtnText}>Niveau suivant →</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.undoBtn, (history.length === 0 || undoUsed) && styles.undoBtnDisabled]}
          onPress={handleUndo}
          disabled={history.length === 0 || undoUsed}
        >
          <Text style={styles.undoBtnText}>↩️ Annuler</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: COLORS.muted, fontSize: 12, marginBottom: 12 },
  levelBadge: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginLeft: 8 },

  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 40 },
  levelBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.board,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBtnLocked: { opacity: 0.35 },
  levelBtnText: { color: COLORS.text, fontSize: 15, fontWeight: '800' },

  coinInfo: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  status: { color: COLORS.text, textAlign: 'center', marginTop: 8, fontSize: 13, fontWeight: '700', minHeight: 16 },

  rodsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 20 },
  rod: {
    width: 46,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: COLORS.board,
    padding: 3,
    justifyContent: 'flex-start',
  },
  rodSelected: { borderColor: COLORS.primary },
  nut: {
    width: '100%',
    height: 34,
    borderRadius: 6,
    backgroundColor: 'transparent',
    marginBottom: 3,
  },

  undoBtn: {
    marginTop: 26,
    alignSelf: 'center',
    backgroundColor: '#29B6F6',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  undoBtnDisabled: { opacity: 0.35 },
  undoBtnText: { color: '#0b0d13', fontSize: 14, fontWeight: '800' },

  endRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 26 },
  replayBtn: { backgroundColor: '#00E676', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22 },
  replayBtnText: { color: '#04120c', fontSize: 15, fontWeight: '800' },
  nextBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22 },
  nextBtnText: { color: '#1a1300', fontSize: 15, fontWeight: '800' },
});

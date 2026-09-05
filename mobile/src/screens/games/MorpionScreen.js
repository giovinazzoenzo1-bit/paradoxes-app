// Morpion — port fidèle de la logique déjà validée dans index.html (PWA).
// Cahier des charges : Google Drive "Morpion" (docs Enzo = gameplay/logique,
// Flavio = UI/design). Couleurs et layout suivent le doc Flavio. Le nombre de
// manches pour gagner le match (3, pas 2/BO3) et le barème de pièces suivent
// le PWA réel (coins-config.js), qui a été itéré au-delà du cahier des
// charges d'origine — le PWA fait foi en cas de divergence.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import BackButton from '../../components/BackButton';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
} from 'react-native';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import { findWinLine, botPickMove } from '../../games/morpion/morpionLogic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#141721',
  board: '#1E222D',
  cell: '#2A3142',
  cellBorder: '#37474F',
  x: '#FF7043',
  o: '#00E5FF',
  win: '#FFD700',
  undo: '#29B6F6',
  replay: '#00E676',
  text: '#eef0f6',
  muted: '#8d93ab',
};

const COINS_CONFIG = { facile_bonus_match: 1, normal_bonus_match: 6 };
const MATCH_WINS_NEEDED = 3;

function emptyBoard() {
  return Array(9).fill('');
}

export default function MorpionScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('setup'); // 'setup' | 'playing'
  const [mode, setMode] = useState('ami'); // 'ami' | 'bot'
  const [difficulty, setDifficulty] = useState('normal'); // 'facile' | 'normal' | 'expert'
  const [rule, setRule] = useState('classic'); // 'classic' | 'antidraw'

  const [board, setBoard] = useState(emptyBoard());
  const [turn, setTurn] = useState('X');
  const [roundOver, setRoundOver] = useState(false);
  const [matchOver, setMatchOver] = useState(false);
  const [locked, setLocked] = useState(false);
  const [scoreX, setScoreX] = useState(0);
  const [scoreO, setScoreO] = useState(0);
  const [firstPlayer, setFirstPlayer] = useState('X');
  const [streak, setStreak] = useState({ X: 0, O: 0 });
  const [undoCharges, setUndoCharges] = useState(1);
  const [lastMove, setLastMove] = useState(null);
  const [winLine, setWinLine] = useState(null);
  const [status, setStatus] = useState('');
  const [matchCoinsEarned, setMatchCoinsEarned] = useState(0);
  const [matchEndInfo, setMatchEndInfo] = useState(null); // {winner}

  const pieceOrderRef = useRef({ X: [], O: [] });
  const gameIdRef = useRef(0);
  const botTimeoutRef = useRef(null);
  const cellAnims = useRef(Array.from({ length: 9 }, () => new Animated.Value(0))).current;
  const cellShake = useRef(Array.from({ length: 9 }, () => new Animated.Value(0))).current;

  const turnLabel = useCallback(
    (player) => {
      if (player === 'X') return 'Joueur 1 (✕)';
      return (mode === 'bot' ? 'Bot' : 'Joueur 2') + ' (○)';
    },
    [mode]
  );

  const vibrate = (pattern) => Vibration.vibrate(pattern);

  const startNewRound = useCallback(
    (fp) => {
      pieceOrderRef.current = { X: [], O: [] };
      setBoard(emptyBoard());
      cellAnims.forEach((a) => a.setValue(0));
      setTurn(fp);
      setRoundOver(false);
      setLocked(false);
      setUndoCharges(1);
      setLastMove(null);
      setWinLine(null);
      setStatus(`Tour de ${turnLabel(fp)}`);
    },
    [cellAnims, turnLabel]
  );

  const startNewMatch = useCallback(() => {
    gameIdRef.current++;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    setScoreX(0);
    setScoreO(0);
    setMatchOver(false);
    setMatchCoinsEarned(0);
    setMatchEndInfo(null);
    setFirstPlayer('X');
    startNewRound('X');
    setPhase('playing');
  }, [startNewRound]);

  const popCell = (i) => {
    cellAnims[i].setValue(0);
    Animated.spring(cellAnims[i], { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  };

  const shakeCellAnim = (i) => {
    cellShake[i].setValue(0);
    Animated.sequence([
      Animated.timing(cellShake[i], { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(cellShake[i], { toValue: -1, duration: 40, useNativeDriver: true }),
      Animated.timing(cellShake[i], { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(cellShake[i], { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const endMatch = useCallback(
    async (winner) => {
      setMatchOver(true);
      let awarded = 0;
      if (mode === 'bot' && winner === 'X') {
        const gain =
          difficulty === 'normal' || difficulty === 'expert'
            ? COINS_CONFIG.normal_bonus_match
            : COINS_CONFIG.facile_bonus_match;
        awarded = await addCoinsLimited('morpion', gain);
      }
      setMatchCoinsEarned((prev) => prev + awarded);
      setMatchEndInfo({ winner });
    },
    [mode, difficulty, addCoinsLimited]
  );

  const roundWin = useCallback(
    (winner, line) => {
      setRoundOver(true);
      setLocked(true);
      setWinLine(line);
      const newScoreX = scoreX + (winner === 'X' ? 1 : 0);
      const newScoreO = scoreO + (winner === 'O' ? 1 : 0);
      setScoreX(newScoreX);
      setScoreO(newScoreO);
      setStreak((s) => ({
        ...s,
        [winner]: s[winner] + 1,
        [winner === 'X' ? 'O' : 'X']: 0,
      }));
      setStatus(`🟩 ${winner === 'X' ? 'Joueur 1' : turnLabel('O').replace(' (○)', '')} gagne la manche !`);
      vibrate([30, 20, 30, 20, 60]);

      setTimeout(() => {
        const wonMatch = newScoreX >= MATCH_WINS_NEEDED || newScoreO >= MATCH_WINS_NEEDED;
        if (wonMatch) {
          endMatch(newScoreX >= MATCH_WINS_NEEDED ? 'X' : 'O');
        } else {
          const nextFp = firstPlayer === 'X' ? 'O' : 'X';
          setFirstPlayer(nextFp);
          startNewRound(nextFp);
        }
      }, 1500);
    },
    [turnLabel, endMatch, startNewRound, scoreX, scoreO, firstPlayer]
  );

  const roundDraw = useCallback(() => {
    setRoundOver(true);
    setLocked(true);
    setStatus('🟨 Égalité !');
    setTimeout(() => {
      setFirstPlayer((fp) => {
        const nextFp = fp === 'X' ? 'O' : 'X';
        startNewRound(nextFp);
        return nextFp;
      });
    }, 1000);
  }, [startNewRound]);

  const applyMove = useCallback(
    (i, player) => {
      setBoard((prevBoard) => {
        const b = [...prevBoard];
        if (rule === 'antidraw' && pieceOrderRef.current[player].length >= 3) {
          const oldest = pieceOrderRef.current[player].shift();
          b[oldest] = '';
        }
        b[i] = player;
        pieceOrderRef.current[player].push(i);
        return b;
      });
      setLastMove(rule === 'classic' ? { index: i, player } : null);
      popCell(i);
      vibrate(player === 'X' ? [10] : [10, 40, 10]);

      // On calcule victoire/égalité/tour suivant sur l'état à jour via un micro-délai
      // (setBoard est asynchrone) — évite de dupliquer la logique anti-nul ici.
      setTimeout(() => {
        setBoard((current) => {
          const line = findWinLine(current, player);
          if (line) {
            roundWin(player, line);
            return current;
          }
          if (rule === 'classic' && current.every((v) => v)) {
            roundDraw();
            return current;
          }
          const nextTurn = player === 'X' ? 'O' : 'X';
          setTurn(nextTurn);
          setStatus(`Tour de ${turnLabel(nextTurn)}`);
          return current;
        });
      }, 0);
    },
    [rule, roundWin, roundDraw, turnLabel]
  );

  // Tour du bot
  useEffect(() => {
    if (mode !== 'bot' || turn !== 'O' || roundOver || matchOver || phase !== 'playing') return;
    const gid = gameIdRef.current;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    botTimeoutRef.current = setTimeout(() => {
      if (gid !== gameIdRef.current) return;
      try {
        const move = botPickMove(board, difficulty, rule);
        if (move === null || move === undefined || board[move] !== '') {
          throw new Error('coup invalide calculé par le bot');
        }
        applyMove(move, 'O');
      } catch (err) {
        const fallback = board.map((v, i) => (v === '' ? i : null)).filter((i) => i !== null);
        if (fallback.length > 0) applyMove(fallback[Math.floor(Math.random() * fallback.length)], 'O');
      }
    }, 600);
    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, mode, roundOver, matchOver, phase]);

  const handleTap = (i) => {
    if (locked || roundOver || matchOver) return;
    if (mode === 'bot' && turn === 'O') return;
    if (board[i]) {
      shakeCellAnim(i);
      vibrate([15]);
      return;
    }
    applyMove(i, turn);
  };

  const handleUndo = () => {
    if (rule === 'antidraw') return;
    if (!lastMove || roundOver || locked) return;
    if (undoCharges <= 0) return; // recharge pub à ajouter plus tard (pas d'ads en V1)
    setUndoCharges((c) => c - 1);
    setBoard((b) => {
      const nb = [...b];
      nb[lastMove.index] = '';
      return nb;
    });
    pieceOrderRef.current[lastMove.player].pop();
    setTurn(lastMove.player);
    setStatus(`Tour de ${turnLabel(lastMove.player)}`);
    setLastMove(null);
  };

  const openSetup = () => {
    gameIdRef.current++;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    setPhase('setup');
  };

  // ---------- RENDU ----------

  if (phase === 'setup') {
    const matchGain = difficulty === 'normal' || difficulty === 'expert' ? COINS_CONFIG.normal_bonus_match : COINS_CONFIG.facile_bonus_match;
    return (
      <View style={styles.screen} {...panHandlers}>
      <CoinBar />
        <View style={styles.header}>
          {onBack && (
            <BackButton onPress={onBack} />
          )}
          <Text style={styles.title}>❌⭕ Morpion</Text>
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
                <SetupButton label="🔥 Expert" active={difficulty === 'expert'} onPress={() => setDifficulty('expert')} />
              </View>
              <Text style={styles.coinInfo}>
                🪙 Aucun gain par manche — {matchGain} pièces si tu gagnes le match complet (1er à {MATCH_WINS_NEEDED} manches).
              </Text>
            </>
          )}

          <Text style={styles.setupLabel}>Règle</Text>
          <View style={styles.row}>
            <SetupButton label="Classique" active={rule === 'classic'} onPress={() => setRule('classic')} />
            <SetupButton label="♾️ Anti-nul (3 pions max)" active={rule === 'antidraw'} onPress={() => setRule('antidraw')} />
          </View>

          <Text style={styles.coinInfo}>
            {mode === 'ami'
              ? '🟨 Mode Ami : aucune pièce (pour éviter de farmer en jouant les 2 côtés soi-même).'
              : rule === 'antidraw'
              ? "🟨 Règle Anti-nul : l'Undo est désactivé."
              : ''}
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={startNewMatch}>
            <Text style={styles.primaryBtnText}>Jouer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        <BackButton onPress={openSetup} />
      </View>

      <View style={styles.scoreboard}>
        <View style={[styles.playerCard, turn === 'X' && !roundOver && styles.playerCardActiveX]}>
          <Text style={[styles.playerLabel, { color: COLORS.x }]}>
            Joueur 1 · ✕{streak.X >= 3 ? ` 🔥×${streak.X}` : ''}
          </Text>
          <Text style={[styles.playerScore, { color: COLORS.x }]}>{scoreX}</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={[styles.playerCard, turn === 'O' && !roundOver && styles.playerCardActiveO]}>
          <Text style={[styles.playerLabel, { color: COLORS.o }]}>
            {mode === 'bot' ? 'Bot' : 'Joueur 2'} · ○{streak.O >= 3 ? ` 🔥×${streak.O}` : ''}
          </Text>
          <Text style={[styles.playerScore, { color: COLORS.o }]}>{scoreO}</Text>
        </View>
      </View>

      <Text style={styles.status}>{status}</Text>

      <View style={styles.boardWrap}>
        <View style={styles.board}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.boardRow}>
              {[0, 1, 2].map((col) => {
                const i = row * 3 + col;
                const v = board[i];
                const scale = cellAnims[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.2, 1] });
                const translateX = cellShake[i].interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });
                const isWin = winLine && winLine.includes(i);
                return (
                  <Animated.View key={i} style={{ transform: [{ translateX }] }}>
                    <TouchableOpacity
                      style={[styles.cell, isWin && styles.cellWin]}
                      activeOpacity={0.7}
                      onPress={() => handleTap(i)}
                    >
                      <Animated.Text
                        style={[
                          styles.cellText,
                          { color: v === 'X' ? COLORS.x : COLORS.o },
                          v ? { transform: [{ scale }] } : null,
                        ]}
                      >
                        {v === 'X' ? '✕' : v === 'O' ? '○' : ''}
                      </Animated.Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {!matchEndInfo && (
        <TouchableOpacity
          style={[styles.undoBtn, (!lastMove || roundOver || locked || rule === 'antidraw' || undoCharges <= 0) && styles.undoBtnDisabled]}
          onPress={handleUndo}
          disabled={!lastMove || roundOver || locked || rule === 'antidraw' || undoCharges <= 0}
        >
          <Text style={styles.undoBtnText}>
            {rule === 'antidraw' ? '↩️ Indisponible (Anti-nul)' : `↩️ Annuler (×${undoCharges})`}
          </Text>
        </TouchableOpacity>
      )}

      {matchEndInfo && (
        <View style={styles.matchEndPanel}>
          <Text style={styles.matchEndTitle}>
            🏆 {matchEndInfo.winner === 'X' ? 'Joueur 1 (✕)' : turnLabel('O')} remporte le match !
          </Text>
          {matchCoinsEarned > 0 && <Text style={styles.coinInfo}>🪙 +{matchCoinsEarned} pièces gagnées</Text>}
          <TouchableOpacity style={styles.replayBtn} onPress={startNewMatch}>
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

const CELL_SIZE = 84;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
    borderColor: COLORS.cellBorder,
  },
  setupBtnActive: { backgroundColor: '#2f3a52', borderColor: COLORS.undo },
  setupBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  setupBtnTextActive: { color: COLORS.text },
  coinInfo: { color: COLORS.muted, fontSize: 12, marginTop: 12, textAlign: 'center' },

  primaryBtn: {
    marginTop: 24,
    backgroundColor: COLORS.undo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0b0d13', fontSize: 16, fontWeight: '800' },

  scoreboard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 4 },
  playerCard: {
    flex: 1,
    maxWidth: 140,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: COLORS.cell,
    borderWidth: 2,
    borderColor: COLORS.cellBorder,
  },
  playerCardActiveX: { borderColor: COLORS.x, transform: [{ scale: 1.05 }] },
  playerCardActiveO: { borderColor: COLORS.o, transform: [{ scale: 1.05 }] },
  playerLabel: { fontSize: 12, fontWeight: '700' },
  playerScore: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  vs: { fontSize: 11, fontWeight: '800', color: COLORS.muted, opacity: 0.7 },

  status: { color: COLORS.text, textAlign: 'center', marginTop: 14, fontSize: 15, fontWeight: '700', minHeight: 20 },

  boardWrap: { alignItems: 'center', marginTop: 14 },
  board: {
    backgroundColor: COLORS.board,
    borderRadius: 28,
    padding: 12,
  },
  boardRow: { flexDirection: 'row' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: COLORS.cell,
    borderWidth: 1,
    borderColor: COLORS.cellBorder,
    borderRadius: 12,
    margin: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWin: { backgroundColor: 'rgba(255,215,0,0.15)', borderColor: COLORS.win },
  cellText: { fontSize: 40, fontWeight: '900' },

  undoBtn: {
    marginTop: 20,
    alignSelf: 'center',
    backgroundColor: COLORS.undo,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  undoBtnDisabled: { opacity: 0.35 },
  undoBtnText: { color: '#0b0d13', fontWeight: '800', fontSize: 13 },

  matchEndPanel: { marginTop: 20, alignItems: 'center' },
  matchEndTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  replayBtn: {
    marginTop: 12,
    backgroundColor: COLORS.replay,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});

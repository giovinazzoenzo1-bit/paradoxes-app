// Écran de combat réel — étape 5 du plan (voir mobile/ADVENTURE_MODE.md).
// Mécanique hybride tour par tour + tap-battle, entièrement définie et
// testée en étape 1 (combatLogic.js) : ici on ne fait QUE relier cette
// logique déjà validée à une interface, aucune nouvelle règle inventée.
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { COLORS } from './clickerTheme';
import { stageForLevel } from '../../games/clicker/clickerLogic';
import {
  combatStatsForCreature,
  opponentForLevel,
  opponentStatsForLevel,
  damageMultiplierForTime,
  computePlayerDamage,
  resolveRound,
  griffesReward,
  TAP_CHALLENGE_COUNT,
  TAP_CHALLENGE_TIME_LIMIT_SEC,
} from '../../games/clicker/combatLogic';

export default function CombatScreen({ playerCreature, playerOwnedLevel, levelNumber, onFinish }) {
  const opponent = opponentForLevel(levelNumber);
  const playerStats = combatStatsForCreature(playerCreature, playerOwnedLevel);
  const opponentStats = opponentStatsForLevel(levelNumber);

  const [playerHp, setPlayerHp] = useState(playerStats.hp);
  const [opponentHp, setOpponentHp] = useState(opponentStats.hp);
  const [phase, setPhase] = useState('ready'); // 'ready' | 'tapping' | 'resolving' | 'done'
  const [tapCount, setTapCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TAP_CHALLENGE_TIME_LIMIT_SEC);
  const [lastRound, setLastRound] = useState(null); // { dmgToOpponent, dmgToPlayer, multiplier }
  const [outcome, setOutcome] = useState(null); // null | 'win' | 'lose'

  const tapCountRef = useRef(0);
  const challengeStartRef = useRef(0);
  const challengeDoneRef = useRef(false);
  const playerHpRef = useRef(playerStats.hp);
  playerHpRef.current = playerHp;
  const opponentHpRef = useRef(opponentStats.hp);
  opponentHpRef.current = opponentHp;

  const punchScale = useRef(new Animated.Value(1)).current;

  // Boucle du défi de tap : vérifie le temps écoulé toutes les 100ms
  // pendant la phase 'tapping', déclenche la résolution si le temps est
  // écoulé (l'attaque part quand même, juste affaiblie).
  useEffect(() => {
    if (phase !== 'tapping') return;
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - challengeStartRef.current) / 1000;
      const remaining = Math.max(0, TAP_CHALLENGE_TIME_LIMIT_SEC - elapsedSec);
      setTimeLeft(remaining);
      if (remaining <= 0 && !challengeDoneRef.current) {
        finishChallenge(false);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  const startChallenge = () => {
    tapCountRef.current = 0;
    challengeDoneRef.current = false;
    challengeStartRef.current = Date.now();
    setTapCount(0);
    setTimeLeft(TAP_CHALLENGE_TIME_LIMIT_SEC);
    setPhase('tapping');
  };

  const handleTap = () => {
    if (phase !== 'tapping' || challengeDoneRef.current) return;
    tapCountRef.current += 1;
    setTapCount(tapCountRef.current);
    Animated.sequence([
      Animated.timing(punchScale, { toValue: 0.9, duration: 40, useNativeDriver: true }),
      Animated.spring(punchScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    if (tapCountRef.current >= TAP_CHALLENGE_COUNT) {
      finishChallenge(true);
    }
  };

  // Résout le défi de tap (complété ou pas) puis le tour complet —
  // dégâts du joueur, riposte automatique de l'adversaire si besoin.
  const finishChallenge = (completed) => {
    if (challengeDoneRef.current) return;
    challengeDoneRef.current = true;
    const elapsedSec = (Date.now() - challengeStartRef.current) / 1000;
    const multiplier = damageMultiplierForTime(elapsedSec, completed);
    const playerDamage = computePlayerDamage(playerStats.attack, multiplier);
    const result = resolveRound(playerHpRef.current, opponentHpRef.current, opponentStats.attack, playerDamage);

    setPlayerHp(result.playerHp);
    setOpponentHp(result.opponentHp);
    setLastRound({ dmgToOpponent: result.dmgToOpponent, dmgToPlayer: result.dmgToPlayer, multiplier });
    setPhase('resolving');

    setTimeout(() => {
      if (result.outcome === 'win' || result.outcome === 'lose') {
        setOutcome(result.outcome);
        setPhase('done');
      } else {
        setPhase('ready');
      }
    }, 1100);
  };

  if (phase === 'done') {
    return (
      <CombatResultScreen
        outcome={outcome}
        levelNumber={levelNumber}
        onContinue={() => onFinish(outcome)}
      />
    );
  }

  const playerDisplay = playerCreature.stages[stageForLevel(playerOwnedLevel)];
  const opponentDisplay = opponent.stages[0];
  const playerHpPct = Math.max(0, playerHp / playerStats.hp) * 100;
  const opponentHpPct = Math.max(0, opponentHp / opponentStats.hp) * 100;

  return (
    <View style={styles.screen}>
      <Text style={styles.combatTitle}>⚔️ Combat</Text>

      <View style={styles.fighterRow}>
        <View style={styles.fighterCard}>
          <Text style={styles.fighterEmoji}>{playerDisplay.emoji}</Text>
          <Text style={styles.fighterName} numberOfLines={1}>{playerDisplay.name}</Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${playerHpPct}%`, backgroundColor: COLORS.good }]} />
          </View>
          <Text style={styles.hpText}>{Math.max(0, playerHp)} / {playerStats.hp}</Text>
        </View>

        <Text style={styles.vsText}>VS</Text>

        <View style={styles.fighterCard}>
          <Text style={styles.fighterEmoji}>{opponentDisplay.emoji}</Text>
          <Text style={styles.fighterName} numberOfLines={1}>{opponentDisplay.name}</Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${opponentHpPct}%`, backgroundColor: '#FF5252' }]} />
          </View>
          <Text style={styles.hpText}>{Math.max(0, opponentHp)} / {opponentStats.hp}</Text>
        </View>
      </View>

      {lastRound && phase === 'resolving' && (
        <View style={styles.roundLog}>
          <Text style={styles.roundLogText}>💥 -{lastRound.dmgToOpponent} (x{lastRound.multiplier.toFixed(2)})</Text>
          {lastRound.dmgToPlayer > 0 && <Text style={[styles.roundLogText, { color: '#FF5252' }]}>🔻 -{lastRound.dmgToPlayer} reçu</Text>}
        </View>
      )}

      <View style={styles.tapArea}>
        {phase === 'ready' && (
          <TouchableOpacity style={styles.fightBtn} onPress={startChallenge}>
            <Text style={styles.fightBtnText}>⚔️ Attaquer</Text>
          </TouchableOpacity>
        )}

        {phase === 'tapping' && (
          <>
            <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.tapZoneCombat}>
              <Animated.View style={[styles.tapPunch, { transform: [{ scale: punchScale }] }]}>
                <Text style={styles.tapPunchText}>👊</Text>
              </Animated.View>
            </TouchableOpacity>
            <Text style={styles.tapCountText}>{tapCount} / {TAP_CHALLENGE_COUNT}</Text>
            <View style={styles.timeTrack}>
              <View style={[styles.timeFill, { width: `${(timeLeft / TAP_CHALLENGE_TIME_LIMIT_SEC) * 100}%` }]} />
            </View>
          </>
        )}

        {phase === 'resolving' && <Text style={styles.resolvingText}>...</Text>}
      </View>
    </View>
  );
}

function CombatResultScreen({ outcome, levelNumber, onContinue }) {
  const isWin = outcome === 'win';
  const reward = isWin ? griffesReward(levelNumber) : 0;
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={styles.resultEmoji}>{isWin ? '🏆' : '💀'}</Text>
      <Text style={[styles.resultTitle, { color: isWin ? COLORS.good : '#FF5252' }]}>
        {isWin ? 'Victoire !' : 'Défaite'}
      </Text>
      {isWin ? (
        <Text style={styles.resultReward}>+{reward} 🐾 Griffes</Text>
      ) : (
        <Text style={styles.resultSubtitle}>Réessaie quand tu veux — rien n'est perdu.</Text>
      )}
      <TouchableOpacity style={styles.resultBtn} onPress={onContinue}>
        <Text style={styles.resultBtnText}>Retour à la carte</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  combatTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 20 },

  fighterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  fighterCard: {
    flex: 1, backgroundColor: COLORS.panel, borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  fighterEmoji: { fontSize: 46 },
  fighterName: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 4 },
  vsText: { color: COLORS.muted, fontSize: 14, fontWeight: '900' },
  hpTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 8 },
  hpFill: { height: '100%', borderRadius: 4 },
  hpText: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },

  roundLog: { alignItems: 'center', marginTop: 16 },
  roundLogText: { color: COLORS.action, fontSize: 15, fontWeight: '900' },

  tapArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fightBtn: {
    backgroundColor: COLORS.action, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 40,
    shadowColor: COLORS.action, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
  },
  fightBtnText: { color: '#241a00', fontSize: 18, fontWeight: '900' },

  tapZoneCombat: {
    width: 180, height: 180, borderRadius: 90, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.neonPink,
    shadowColor: COLORS.neonPink, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  tapPunch: { alignItems: 'center', justifyContent: 'center' },
  tapPunchText: { fontSize: 80 },
  tapCountText: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 16 },
  timeTrack: { width: 220, height: 8, borderRadius: 4, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 10 },
  timeFill: { height: '100%', backgroundColor: COLORS.neonCyan, borderRadius: 4 },

  resolvingText: { color: COLORS.muted, fontSize: 30, fontWeight: '900' },

  resultEmoji: { fontSize: 80 },
  resultTitle: { fontSize: 26, fontWeight: '900', marginTop: 10 },
  resultReward: { color: COLORS.action, fontSize: 16, fontWeight: '800', marginTop: 10 },
  resultSubtitle: { color: COLORS.muted, fontSize: 13, marginTop: 10, textAlign: 'center', paddingHorizontal: 30 },
  resultBtn: { backgroundColor: COLORS.panel, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 30, marginTop: 30, borderWidth: 1, borderColor: COLORS.border },
  resultBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
});

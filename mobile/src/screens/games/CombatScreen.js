// Écran de combat réel — étape 5 du plan (voir mobile/ADVENTURE_MODE.md),
// mis à jour (29/08) pour le système de compétences + endurance : le
// joueur choisit UNE des 4 attaques de sa créature à chaque tour (chacune
// avec ses propres dégâts fixes et son coût en endurance, format du
// générateur Gemini de l'utilisateur), plutôt qu'un bouton "Attaquer"
// générique unique.
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { COLORS } from './clickerTheme';
import { stageForLevel } from '../../games/clicker/clickerLogic';
import {
  combatStatsForCreatureTyped,
  opponentForLevel,
  opponentStatsForLevelTyped,
  damageMultiplierForTime,
  computePlayerDamage,
  resolveRound,
  griffesReward,
  TAP_CHALLENGE_COUNT,
  TAP_CHALLENGE_TIME_LIMIT_SEC,
} from '../../games/clicker/combatLogic';

// Attaque de secours, toujours disponible même à 0 endurance — sans ça,
// un joueur (ou l'IA) à sec d'endurance serait totalement bloqué et le
// combat ne pourrait plus se terminer. Dégâts volontairement faibles
// (pas de coût, mais pas intéressant à spammer non plus).
const BASIC_ATTACK_RATIO = 0.4; // proportion de la stat ATQ brute

export default function CombatScreen({ playerCreature, playerOwnedLevel, levelNumber, onFinish }) {
  const opponent = opponentForLevel(levelNumber);
  const playerStats = combatStatsForCreatureTyped(playerCreature, playerOwnedLevel);
  const opponentStats = opponentStatsForLevelTyped(levelNumber);
  const basicAttackDamage = Math.max(1, Math.round(playerStats.attack * BASIC_ATTACK_RATIO));
  const opponentBasicDamage = Math.max(1, Math.round(opponentStats.attack * BASIC_ATTACK_RATIO));

  const [playerHp, setPlayerHp] = useState(playerStats.hp);
  const [opponentHp, setOpponentHp] = useState(opponentStats.hp);
  const [playerEndurance, setPlayerEndurance] = useState(playerStats.endurance);
  const [opponentEndurance, setOpponentEndurance] = useState(opponentStats.endurance);
  const [phase, setPhase] = useState('choosing'); // 'choosing' | 'tapping' | 'resolving' | 'done'
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [tapCount, setTapCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TAP_CHALLENGE_TIME_LIMIT_SEC);
  const [lastRound, setLastRound] = useState(null); // { dmgToOpponent, dmgToPlayer, multiplier, skillName, opponentSkillName }
  const [outcome, setOutcome] = useState(null); // null | 'win' | 'lose'

  const tapCountRef = useRef(0);
  const challengeStartRef = useRef(0);
  const challengeDoneRef = useRef(false);
  const playerHpRef = useRef(playerStats.hp);
  playerHpRef.current = playerHp;
  const opponentHpRef = useRef(opponentStats.hp);
  opponentHpRef.current = opponentHp;
  const opponentEnduranceRef = useRef(opponentStats.endurance);
  opponentEnduranceRef.current = opponentEndurance;
  const selectedSkillRef = useRef(null);

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

  // Choix d'une compétence : si le joueur a assez d'endurance pour la
  // payer, elle est débitée immédiatement et le défi de tap démarre.
  const chooseSkill = (skill, isBasic) => {
    if (phase !== 'choosing') return;
    const cost = isBasic ? 0 : skill.enduranceCost;
    if (playerEndurance < cost) return; // bouton normalement déjà désactivé, sécurité en plus
    setPlayerEndurance((e) => e - cost);
    selectedSkillRef.current = { ...skill, isBasic };
    setSelectedSkill({ ...skill, isBasic });
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

  // Choisit l'attaque de l'adversaire : une compétence au hasard parmi
  // celles qu'il peut encore payer, sinon l'attaque de secours à 0
  // endurance (même filet de sécurité que le joueur).
  const pickOpponentAttack = () => {
    const affordable = opponent.skills.filter((s) => s.enduranceCost <= opponentEnduranceRef.current);
    if (affordable.length === 0) {
      return { name: 'Attaque de base', damage: opponentBasicDamage, enduranceCost: 0, isBasic: true };
    }
    const skill = affordable[Math.floor(Math.random() * affordable.length)];
    return { ...skill, isBasic: false };
  };

  // Résout le défi de tap (complété ou pas) puis le tour complet —
  // dégâts du joueur (via la compétence choisie), puis riposte
  // automatique de l'adversaire s'il survit (avec sa propre compétence
  // et son propre coût en endurance).
  const finishChallenge = (completed) => {
    if (challengeDoneRef.current) return;
    challengeDoneRef.current = true;
    const elapsedSec = (Date.now() - challengeStartRef.current) / 1000;
    const skill = selectedSkillRef.current;
    const multiplier = skill.isBasic ? 1 : damageMultiplierForTime(elapsedSec, completed);
    const playerDamage = computePlayerDamage(skill.damage, multiplier);

    const opponentSkill = pickOpponentAttack();
    opponentEnduranceRef.current = Math.max(0, opponentEnduranceRef.current - opponentSkill.enduranceCost);
    setOpponentEndurance(opponentEnduranceRef.current);

    const result = resolveRound(playerHpRef.current, opponentHpRef.current, opponentSkill.damage, playerDamage);

    setPlayerHp(result.playerHp);
    setOpponentHp(result.opponentHp);
    setLastRound({
      dmgToOpponent: result.dmgToOpponent,
      dmgToPlayer: result.dmgToPlayer,
      multiplier,
      skillName: skill.name,
      opponentSkillName: result.dmgToPlayer > 0 ? opponentSkill.name : null,
    });
    setPhase('resolving');

    setTimeout(() => {
      if (result.outcome === 'win' || result.outcome === 'lose') {
        setOutcome(result.outcome);
        setPhase('done');
      } else {
        setPhase('choosing');
      }
    }, 1200);
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
  const playerEndurancePct = Math.max(0, playerEndurance / playerStats.endurance) * 100;
  const opponentEndurancePct = Math.max(0, opponentEndurance / opponentStats.endurance) * 100;

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
          <Text style={styles.hpText}>{Math.max(0, playerHp)} / {playerStats.hp} PV</Text>
          <View style={styles.enduranceTrack}>
            <View style={[styles.enduranceFill, { width: `${playerEndurancePct}%` }]} />
          </View>
          <Text style={styles.enduranceText}>{Math.max(0, playerEndurance)} / {playerStats.endurance} END</Text>
        </View>

        <Text style={styles.vsText}>VS</Text>

        <View style={styles.fighterCard}>
          <Text style={styles.fighterEmoji}>{opponentDisplay.emoji}</Text>
          <Text style={styles.fighterName} numberOfLines={1}>{opponentDisplay.name}</Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${opponentHpPct}%`, backgroundColor: '#FF5252' }]} />
          </View>
          <Text style={styles.hpText}>{Math.max(0, opponentHp)} / {opponentStats.hp} PV</Text>
          <View style={styles.enduranceTrack}>
            <View style={[styles.enduranceFill, { width: `${opponentEndurancePct}%`, backgroundColor: COLORS.neonPink }]} />
          </View>
          <Text style={styles.enduranceText}>{Math.max(0, opponentEndurance)} / {opponentStats.endurance} END</Text>
        </View>
      </View>

      {lastRound && phase === 'resolving' && (
        <View style={styles.roundLog}>
          <Text style={styles.roundLogText}>💥 {lastRound.skillName} : -{lastRound.dmgToOpponent} (x{lastRound.multiplier.toFixed(2)})</Text>
          {lastRound.dmgToPlayer > 0 && (
            <Text style={[styles.roundLogText, { color: '#FF5252' }]}>🔻 {lastRound.opponentSkillName} : -{lastRound.dmgToPlayer} reçu</Text>
          )}
        </View>
      )}

      <View style={styles.tapArea}>
        {phase === 'choosing' && (
          <View style={styles.skillGrid}>
            {playerCreature.skills.map((skill) => {
              const canAfford = playerEndurance >= skill.enduranceCost;
              return (
                <TouchableOpacity
                  key={skill.id}
                  style={[styles.skillBtn, !canAfford && styles.skillBtnDisabled]}
                  onPress={() => chooseSkill(skill, false)}
                  disabled={!canAfford}
                >
                  <Text style={styles.skillBtnName} numberOfLines={1}>{skill.name}</Text>
                  <Text style={styles.skillBtnStats}>{skill.damage} dégâts</Text>
                  <Text style={[styles.skillBtnStats, !canAfford && styles.skillBtnCostMissing]}>{skill.enduranceCost} END</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.basicAttackBtn} onPress={() => chooseSkill({ id: 'basic', name: 'Attaque de base', damage: basicAttackDamage, enduranceCost: 0 }, true)}>
              <Text style={styles.basicAttackText}>👊 Attaque de base (gratuite, {basicAttackDamage} dégâts)</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'tapping' && (
          <>
            <Text style={styles.chosenSkillLabel}>{selectedSkill?.name}</Text>
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
  combatTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 16 },

  fighterRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10 },
  fighterCard: {
    flex: 1, backgroundColor: COLORS.panel, borderRadius: 16, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  fighterEmoji: { fontSize: 40 },
  fighterName: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 4 },
  vsText: { color: COLORS.muted, fontSize: 14, fontWeight: '900', marginTop: 30 },
  hpTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 8 },
  hpFill: { height: '100%', borderRadius: 4 },
  hpText: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 3 },
  enduranceTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 6 },
  enduranceFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.action },
  enduranceText: { color: COLORS.muted, fontSize: 8, fontWeight: '700', marginTop: 2 },

  roundLog: { alignItems: 'center', marginTop: 12 },
  roundLogText: { color: COLORS.action, fontSize: 13, fontWeight: '900' },

  tapArea: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },

  skillGrid: { width: '100%', gap: 8 },
  skillBtn: {
    backgroundColor: COLORS.panel, borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: COLORS.action,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  skillBtnDisabled: { borderColor: COLORS.border, opacity: 0.4 },
  skillBtnName: { color: COLORS.text, fontSize: 13, fontWeight: '800', flex: 1 },
  skillBtnStats: { color: COLORS.action, fontSize: 11, fontWeight: '700', marginLeft: 8 },
  skillBtnCostMissing: { color: '#FF5252' },
  basicAttackBtn: { paddingVertical: 10, alignItems: 'center' },
  basicAttackText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },

  chosenSkillLabel: { color: COLORS.action, fontSize: 14, fontWeight: '900', marginBottom: 10 },
  tapZoneCombat: {
    width: 170, height: 170, borderRadius: 85, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.neonPink,
    shadowColor: COLORS.neonPink, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  tapPunch: { alignItems: 'center', justifyContent: 'center' },
  tapPunchText: { fontSize: 74 },
  tapCountText: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 14 },
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

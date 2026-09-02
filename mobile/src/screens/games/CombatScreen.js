// Écran de combat réel — voir mobile/ADVENTURE_MODE.md et
// mobile/CLICKER_ADVENTURE_STATE.md pour l'historique complet.
//
// Refonte visuelle (30/08), inspirée de Monster Legends : mode PAYSAGE
// forcé, équipe du joueur à gauche (combattant actif en grand + le
// reste de l'équipe en petit), équipe adverse à droite (TOUS tapables
// pour choisir la cible), barre de compétences en bas avec les dégâts
// affichés sous chaque bouton + un bouton "Recharge" (pub simulée,
// comme le Rituel du clicker classique — pas de vrai SDK de pub
// intégré dans ce projet). Pas d'animation pour l'instant, on garde les
// emojis actuels comme "skins". Croix pour quitter en haut à gauche.
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { COLORS } from './clickerTheme';
import { stageForLevel } from '../../games/clicker/clickerLogic';
import {
  combatStatsForCreatureTyped,
  opponentTeamForLevel,
  statsForOpponentCreatureTyped,
  opponentGoesFirst,
  damageMultiplierForTime,
  computePlayerDamage,
  griffesReward,
  effectiveTapCount,
  scaledSkillDamage,
  TAP_CHALLENGE_TIME_LIMIT_SEC,
} from '../../games/clicker/combatLogic';

const BASIC_ATTACK_RATIO = 0.4; // proportion de la stat ATQ brute, pour l'attaque de base gratuite
const RECHARGE_PERCENT = 0.5; // "Recharge" (pub simulée) rend 50% de l'endurance max du combattant actif

function nextLivingIndex(fighters, fromIndex) {
  const n = fighters.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (fighters[idx].hp > 0) return idx;
  }
  return -1;
}
function firstLivingIndex(fighters) {
  return fighters.findIndex((f) => f.hp > 0);
}

// team : [{ creature, ownedLevel, evolutionTier }, ...] (1 à 3 entrées,
// dans l'ordre du deck) — voir ChapterMapScreen pour la construction.
export default function CombatScreen({ team, levelNumber, onFinish }) {
  const opponentTeamCreatures = useRef(opponentTeamForLevel(levelNumber)).current;

  // Verrouille l'écran en paysage à l'entrée du combat, revient en
  // portrait à la sortie — même schéma exact que BilliardScreen.js.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const [fighters, setFighters] = useState(() =>
    team.map((member) => {
      const stats = combatStatsForCreatureTyped(member.creature, member.ownedLevel, member.evolutionTier || 0);
      return { creature: member.creature, ownedLevel: member.ownedLevel, stats, hp: stats.hp, endurance: stats.endurance };
    })
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const [opponents, setOpponents] = useState(() =>
    opponentTeamCreatures.map((creature) => {
      const stats = statsForOpponentCreatureTyped(creature, levelNumber);
      return { creature, stats, hp: stats.hp, endurance: stats.endurance };
    })
  );
  // Cible choisie par le JOUEUR (demande explicite : pouvoir choisir quel
  // adversaire attaquer, pas une rotation automatique côté adversaire).
  const [targetIndex, setTargetIndex] = useState(0);

  const [phase, setPhase] = useState('choosing'); // 'choosing' | 'tapping' | 'resolving' | 'done'
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [tapCount, setTapCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TAP_CHALLENGE_TIME_LIMIT_SEC);
  const [lastRound, setLastRound] = useState(null);
  const [switchMessage, setSwitchMessage] = useState(null);
  const [outcome, setOutcome] = useState(null); // null | 'win' | 'lose'

  const fightersRef = useRef(fighters);
  fightersRef.current = fighters;
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;
  const opponentsRef = useRef(opponents);
  opponentsRef.current = opponents;
  const targetIndexRef = useRef(0);
  targetIndexRef.current = targetIndex;
  const tapCountRef = useRef(0);
  const challengeStartRef = useRef(0);
  const challengeDoneRef = useRef(false);
  const selectedSkillRef = useRef(null);
  const pendingTransitionRef = useRef(null);
  const firstStrikeHandledRef = useRef(false);

  const punchScale = useRef(new Animated.Value(1)).current;

  // Pile ou face au tout début du combat : 1 chance sur 2 que
  // l'adversaire frappe en premier, avant le premier choix du joueur.
  useEffect(() => {
    if (firstStrikeHandledRef.current) return;
    firstStrikeHandledRef.current = true;
    if (!opponentGoesFirst()) return;

    const opp = opponentsRef.current[targetIndexRef.current];
    const oppSkill = pickOpponentSkill(opp);
    const oppDamage = oppSkill.isBasic
      ? oppSkill.damage
      : Math.round(scaledSkillDamage(oppSkill, opp.creature, opp.stats.attack));

    const curIdx = activeIndexRef.current;
    const curFighter = fightersRef.current[curIdx];
    const newPlayerHp = Math.max(0, curFighter.hp - oppDamage);
    const newFighters = fightersRef.current.map((f, i) => (i === curIdx ? { ...f, hp: newPlayerHp } : f));
    fightersRef.current = newFighters;
    setFighters(newFighters);

    setLastRound({ dmgToOpponent: 0, dmgToPlayer: oppDamage, multiplier: 1, skillName: null, opponentSkillName: oppSkill.name });

    if (newPlayerHp <= 0) {
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      if (nextIdx === -1) {
        pendingTransitionRef.current = { type: 'lose' };
      } else {
        pendingTransitionRef.current = {
          type: 'switch',
          nextIdx,
          message: `${newFighters[curIdx].creature.stages[0].name} est K.O. ! ${newFighters[nextIdx].creature.stages[0].name} entre en combat !`,
        };
      }
    } else {
      pendingTransitionRef.current = { type: 'continue' };
    }
    setSwitchMessage("L'adversaire attaque en premier !");
    setPhase('resolving');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const activeFighter = fighters[activeIndex];
  const target = opponents[targetIndex];
  const requiredTaps = effectiveTapCount(activeFighter.stats.clickSpeed);

  // Choisit une cible différente parmi les adversaires vivants — permis
  // seulement pendant le choix de compétence, pas en plein défi de tap.
  const chooseTarget = (idx) => {
    if (phase !== 'choosing') return;
    if (opponents[idx].hp <= 0) return;
    setTargetIndex(idx);
  };

  const chooseSkill = (skill, isBasic) => {
    if (phase !== 'choosing') return;
    const cost = isBasic ? 0 : skill.enduranceCost;
    if (activeFighter.endurance < cost) return;
    setFighters((prev) => prev.map((f, i) => (i === activeIndex ? { ...f, endurance: f.endurance - cost } : f)));
    selectedSkillRef.current = { ...skill, isBasic };
    setSelectedSkill({ ...skill, isBasic });
    tapCountRef.current = 0;
    challengeDoneRef.current = false;
    challengeStartRef.current = Date.now();
    setTapCount(0);
    setTimeLeft(TAP_CHALLENGE_TIME_LIMIT_SEC);
    setPhase('tapping');
  };

  // "Recharge" (pub simulée, comme le Rituel du clicker classique — ce
  // projet n'a pas de vrai SDK de pub intégré) : rend une partie de
  // l'endurance du combattant actif, plafonnée à son max.
  const rechargeEndurance = () => {
    if (phase !== 'choosing') return;
    setFighters((prev) =>
      prev.map((f, i) =>
        i === activeIndex
          ? { ...f, endurance: Math.min(f.stats.endurance, f.endurance + Math.round(f.stats.endurance * RECHARGE_PERCENT)) }
          : f
      )
    );
  };

  const handleTap = () => {
    if (phase !== 'tapping' || challengeDoneRef.current) return;
    tapCountRef.current += 1;
    setTapCount(tapCountRef.current);
    Animated.sequence([
      Animated.timing(punchScale, { toValue: 0.9, duration: 40, useNativeDriver: true }),
      Animated.spring(punchScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    if (tapCountRef.current >= requiredTaps) {
      finishChallenge(true);
    }
  };

  const pickOpponentSkill = (opp) => {
    const affordable = opp.creature.skills.filter((s) => s.enduranceCost <= opp.endurance);
    if (affordable.length === 0) {
      const basicDmg = Math.max(1, Math.round(opp.stats.attack * BASIC_ATTACK_RATIO));
      return { name: 'Attaque de base', damage: basicDmg, enduranceCost: 0, isBasic: true };
    }
    const skill = affordable[Math.floor(Math.random() * affordable.length)];
    return { ...skill, isBasic: false };
  };

  const finishChallenge = (completed) => {
    if (challengeDoneRef.current) return;
    challengeDoneRef.current = true;
    const elapsedSec = (Date.now() - challengeStartRef.current) / 1000;
    const skill = selectedSkillRef.current;
    const curIdx = activeIndexRef.current;
    const curFighter = fightersRef.current[curIdx];
    const targetIdx = targetIndexRef.current;
    const opp = opponentsRef.current[targetIdx];

    const multiplier = skill.isBasic ? 1 : damageMultiplierForTime(elapsedSec, completed);
    const skillDamage = skill.isBasic ? skill.damage : scaledSkillDamage(skill, curFighter.creature, curFighter.stats.attack);
    const playerDamage = computePlayerDamage(skillDamage, multiplier);

    const newOpponentHp = Math.max(0, opp.hp - playerDamage);
    let newOpponents = opponentsRef.current.map((o, i) => (i === targetIdx ? { ...o, hp: newOpponentHp } : o));

    let opponentDamage = 0;
    let opponentSkillName = null;
    if (newOpponentHp > 0) {
      const oppSkill = pickOpponentSkill({ ...opp, hp: newOpponentHp });
      newOpponents = newOpponents.map((o, i) =>
        i === targetIdx ? { ...o, endurance: Math.max(0, o.endurance - oppSkill.enduranceCost) } : o
      );
      opponentDamage = oppSkill.isBasic ? oppSkill.damage : Math.round(scaledSkillDamage(oppSkill, opp.creature, opp.stats.attack));
      opponentSkillName = oppSkill.name;
    }
    opponentsRef.current = newOpponents;
    setOpponents(newOpponents);

    // Si la cible tombe, on repositionne automatiquement la sélection
    // sur le premier adversaire encore vivant — le joueur reste libre de
    // choisir une AUTRE cible ensuite pendant sa prochaine phase de choix.
    if (newOpponentHp <= 0) {
      const nextTarget = firstLivingIndex(newOpponents);
      if (nextTarget !== -1 && nextTarget !== targetIdx) {
        targetIndexRef.current = nextTarget;
        setTargetIndex(nextTarget);
      }
    }

    const newPlayerHp = Math.max(0, curFighter.hp - opponentDamage);
    const newFighters = fightersRef.current.map((f, i) => (i === curIdx ? { ...f, hp: newPlayerHp } : f));
    fightersRef.current = newFighters;
    setFighters(newFighters);

    setLastRound({
      dmgToOpponent: playerDamage,
      dmgToPlayer: opponentDamage,
      multiplier,
      skillName: skill.name,
      opponentSkillName: opponentDamage > 0 ? opponentSkillName : null,
    });
    setPhase('resolving');

    const anyOpponentAlive = newOpponents.some((o) => o.hp > 0);
    if (!anyOpponentAlive) {
      pendingTransitionRef.current = { type: 'win' };
      return;
    }

    if (newPlayerHp <= 0) {
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      if (nextIdx === -1) {
        pendingTransitionRef.current = { type: 'lose' };
      } else {
        pendingTransitionRef.current = {
          type: 'switch',
          nextIdx,
          message: `${newFighters[curIdx].creature.stages[0].name} est K.O. ! ${newFighters[nextIdx].creature.stages[0].name} entre en combat !`,
        };
      }
    } else {
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      pendingTransitionRef.current = {
        type: 'switch',
        nextIdx,
        message: `Au tour de ${newFighters[nextIdx].creature.stages[0].name} !`,
      };
    }
  };

  const confirmContinue = () => {
    const t = pendingTransitionRef.current;
    if (!t) return;
    setSwitchMessage(null);
    if (t.type === 'win') {
      setOutcome('win');
      setPhase('done');
    } else if (t.type === 'lose') {
      setOutcome('lose');
      setPhase('done');
    } else if (t.type === 'switch') {
      activeIndexRef.current = t.nextIdx;
      setActiveIndex(t.nextIdx);
      setSwitchMessage(t.message);
      setPhase('choosing');
      setTimeout(() => setSwitchMessage(null), 2200);
    } else {
      setPhase('choosing');
    }
    pendingTransitionRef.current = null;
  };

  const confirmQuit = () => {
    Alert.alert('Quitter le combat ?', 'Tu ne gagneras aucune récompense et reviendras à la carte.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => onFinish('quit') },
    ]);
  };

  if (phase === 'done') {
    return <CombatResultScreen outcome={outcome} levelNumber={levelNumber} onContinue={() => onFinish(outcome)} />;
  }

  const playerDisplay = activeFighter.creature.stages[stageForLevel(activeFighter.ownedLevel)];
  const playerHpPct = Math.max(0, activeFighter.hp / activeFighter.stats.hp) * 100;
  const playerEndurancePct = Math.max(0, activeFighter.endurance / activeFighter.stats.endurance) * 100;

  return (
    <View style={styles.screen}>
      <TouchableOpacity style={styles.closeBtn} onPress={confirmQuit}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.battlefield}>
        {/* Équipe du joueur, à GAUCHE — combattant actif en grand, le
            reste de l'équipe en petit au-dessus, comme sur les captures
            de référence. */}
        <View style={styles.playerZone}>
          <View style={styles.benchRow}>
            {fighters.map((f, i) => {
              if (i === activeIndex) return null;
              const d = f.creature.stages[stageForLevel(f.ownedLevel)];
              const fainted = f.hp <= 0;
              return (
                <View key={i} style={[styles.benchIcon, fainted && styles.benchIconFainted]}>
                  <Text style={{ fontSize: 22, opacity: fainted ? 0.3 : 1 }}>{d.emoji}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.activeFighterBlock}>
            <Text style={styles.activeEmoji}>{playerDisplay.emoji}</Text>
            <Text style={styles.activeName} numberOfLines={1}>{playerDisplay.name}</Text>
            <View style={styles.hpTrack}>
              <View style={[styles.hpFill, { width: `${playerHpPct}%`, backgroundColor: COLORS.good }]} />
            </View>
            <Text style={styles.hpText}>{Math.max(0, activeFighter.hp)} / {activeFighter.stats.hp}</Text>
            <View style={styles.enduranceTrack}>
              <View style={[styles.enduranceFill, { width: `${playerEndurancePct}%` }]} />
            </View>
          </View>
        </View>

        {/* Zone centrale : défi de tap pendant 'tapping', message/bouton
            Continuer pendant 'resolving', rien pendant 'choosing' (la
            barre du bas prend le relais). */}
        <View style={styles.centerZone}>
          {switchMessage && (
            <View style={styles.switchBanner}>
              <Text style={styles.switchBannerText}>{switchMessage}</Text>
            </View>
          )}
          {lastRound && phase === 'resolving' && !switchMessage && (
            <View style={styles.roundLog}>
              {lastRound.skillName && (
                <Text style={styles.roundLogText}>💥 -{lastRound.dmgToOpponent} (x{lastRound.multiplier.toFixed(2)})</Text>
              )}
              {lastRound.dmgToPlayer > 0 && (
                <Text style={[styles.roundLogText, { color: '#FF5252' }]}>🔻 -{lastRound.dmgToPlayer} reçu</Text>
              )}
            </View>
          )}
          {phase === 'tapping' && (
            <>
              <Text style={styles.chosenSkillLabel}>{selectedSkill?.name}</Text>
              <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.tapZoneCombat}>
                <Animated.View style={{ transform: [{ scale: punchScale }] }}>
                  <Text style={styles.tapPunchText}>👊</Text>
                </Animated.View>
              </TouchableOpacity>
              <Text style={styles.tapCountText}>{tapCount} / {requiredTaps}</Text>
              <View style={styles.timeTrack}>
                <View style={[styles.timeFill, { width: `${(timeLeft / TAP_CHALLENGE_TIME_LIMIT_SEC) * 100}%` }]} />
              </View>
            </>
          )}
          {phase === 'resolving' && (
            <TouchableOpacity style={styles.continueBtn} onPress={confirmContinue}>
              <Text style={styles.continueBtnText}>Continuer →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Équipe adverse, à DROITE — TOUS affichés et tapables pour
            choisir la cible (demande explicite), celle sélectionnée
            entourée d'un contour distinct. */}
        <View style={styles.opponentZone}>
          {opponents.map((o, i) => {
            const d = o.creature.stages[0];
            const fainted = o.hp <= 0;
            const isTarget = i === targetIndex;
            const hpPct = Math.max(0, o.hp / o.stats.hp) * 100;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.opponentCard, isTarget && styles.opponentCardTargeted, fainted && styles.opponentCardFainted]}
                onPress={() => chooseTarget(i)}
                disabled={fainted || phase !== 'choosing'}
              >
                <Text style={{ fontSize: opponents.length > 1 ? 30 : 44, opacity: fainted ? 0.3 : 1 }}>{d.emoji}</Text>
                <Text style={styles.opponentName} numberOfLines={1}>{d.name}</Text>
                <View style={styles.hpTrackSmall}>
                  <View style={[styles.hpFill, { width: `${hpPct}%`, backgroundColor: '#FF5252' }]} />
                </View>
                {isTarget && !fainted && <Text style={styles.targetLabel}>🎯 cible</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Barre de compétences en bas — 4 attaques avec leurs dégâts
          juste en dessous, comme demandé, + bouton Recharge. */}
      {phase === 'choosing' && (
        <View style={styles.bottomBar}>
          {activeFighter.creature.skills.map((skill) => {
            const canAfford = activeFighter.endurance >= skill.enduranceCost;
            return (
              <TouchableOpacity
                key={skill.id}
                style={[styles.skillBtn, !canAfford && styles.skillBtnDisabled]}
                onPress={() => chooseSkill(skill, false)}
                disabled={!canAfford}
              >
                <Text style={styles.skillBtnName} numberOfLines={1}>{skill.name}</Text>
                <Text style={styles.skillBtnDamage}>{skill.damage} dégâts</Text>
                <Text style={[styles.skillBtnCost, !canAfford && styles.skillBtnCostMissing]}>{skill.enduranceCost} END</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.rechargeBtn} onPress={rechargeEndurance}>
            <Text style={styles.rechargeBtnText}>📺</Text>
            <Text style={styles.rechargeBtnLabel}>Recharge</Text>
          </TouchableOpacity>
        </View>
      )}
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
  screen: { flex: 1, backgroundColor: COLORS.bg, flexDirection: 'column' },

  closeBtn: {
    position: 'absolute', top: 10, left: 10, zIndex: 20, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  battlefield: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8 },

  playerZone: { flex: 1, alignItems: 'center' },
  benchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  benchIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.border,
  },
  benchIconFainted: { borderColor: '#FF5252' },
  activeFighterBlock: { alignItems: 'center' },
  activeEmoji: { fontSize: 56 },
  activeName: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 2 },
  hpTrack: { width: 110, height: 8, borderRadius: 4, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 6 },
  hpFill: { height: '100%', borderRadius: 4 },
  hpText: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  enduranceTrack: { width: 110, height: 5, borderRadius: 3, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 4 },
  enduranceFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.action },

  centerZone: { width: 150, alignItems: 'center', justifyContent: 'center' },
  switchBanner: { backgroundColor: 'rgba(245,197,66,0.15)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: COLORS.action },
  switchBannerText: { color: COLORS.action, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  roundLog: { alignItems: 'center' },
  roundLogText: { color: COLORS.action, fontSize: 11, fontWeight: '900' },
  chosenSkillLabel: { color: COLORS.action, fontSize: 11, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
  tapZoneCombat: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.neonPink,
  },
  tapPunchText: { fontSize: 40 },
  tapCountText: { color: COLORS.text, fontSize: 15, fontWeight: '900', marginTop: 8 },
  timeTrack: { width: 100, height: 6, borderRadius: 3, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 6 },
  timeFill: { height: '100%', backgroundColor: COLORS.neonCyan, borderRadius: 3 },
  continueBtn: {
    backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 20,
  },
  continueBtnText: { color: '#241a00', fontSize: 13, fontWeight: '900' },

  opponentZone: { flex: 1.3, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
  opponentCard: {
    backgroundColor: COLORS.panel, borderRadius: 14, padding: 8, alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border, minWidth: 78,
  },
  opponentCardTargeted: { borderColor: '#FF5252', shadowColor: '#FF5252', shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  opponentCardFainted: { opacity: 0.5 },
  opponentName: { color: COLORS.text, fontSize: 9, fontWeight: '700', marginTop: 2, maxWidth: 70 },
  hpTrackSmall: { width: 60, height: 5, borderRadius: 3, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 4 },
  targetLabel: { color: '#FF5252', fontSize: 8, fontWeight: '800', marginTop: 2 },

  bottomBar: { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 8, paddingTop: 4, gap: 6 },
  skillBtn: {
    flex: 1, backgroundColor: COLORS.panel, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.action,
  },
  skillBtnDisabled: { borderColor: COLORS.border, opacity: 0.4 },
  skillBtnName: { color: COLORS.text, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  skillBtnDamage: { color: COLORS.action, fontSize: 11, fontWeight: '900', marginTop: 3 },
  skillBtnCost: { color: COLORS.muted, fontSize: 8, fontWeight: '700', marginTop: 1 },
  skillBtnCostMissing: { color: '#FF5252' },
  rechargeBtn: {
    width: 60, backgroundColor: 'rgba(62,198,240,0.12)', borderRadius: 12, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.neonCyan,
  },
  rechargeBtnText: { fontSize: 16 },
  rechargeBtnLabel: { color: COLORS.neonCyan, fontSize: 8, fontWeight: '800', marginTop: 2 },

  resultEmoji: { fontSize: 70 },
  resultTitle: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  resultReward: { color: COLORS.action, fontSize: 15, fontWeight: '800', marginTop: 8 },
  resultSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  resultBtn: { backgroundColor: COLORS.panel, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 26, marginTop: 24, borderWidth: 1, borderColor: COLORS.border },
  resultBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
});

// Écran de combat réel — voir mobile/ADVENTURE_MODE.md et
// mobile/CLICKER_ADVENTURE_STATE.md pour l'historique complet.
//
// Mise à jour (30/08) — 3 changements demandés :
// 1. Pile ou face au début du combat : 1 chance sur 2 que l'ADVERSAIRE
//    attaque en premier, avant même le premier choix du joueur.
// 2. Les adversaires sont désormais tirés d'un roster TRIÉ PAR PUISSANCE
//    (voir opponentForLevel dans combatLogic.js) — progression logique
//    du plus faible au plus fort à mesure qu'on avance dans les niveaux.
// 3. Équipe adverse de plusieurs créatures à partir du chapitre 2 (2),
//    puis 3 à partir du chapitre 3 — "comme les joueurs avec leurs 3
//    créatures". Contrairement à l'équipe du JOUEUR (qui tourne à CHAQUE
//    attaque, pour varier le combat), l'équipe adverse ne change de
//    combattant actif QUE quand celui-ci tombe K.O. — plus simple, pas
//    demandé explicitement pour l'adversaire, évite d'ajouter une
//    mécanique non demandée.
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
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

// Attaque de secours, toujours disponible même à 0 endurance — sans ça,
// un joueur (ou l'IA) à sec d'endurance serait totalement bloqué et le
// combat ne pourrait plus se terminer. Dégâts volontairement faibles.
const BASIC_ATTACK_RATIO = 0.4; // proportion de la stat ATQ brute

// Trouve le prochain combattant VIVANT après `fromIndex`, en boucle sur
// l'équipe (0→1→2→0…), en sautant les K.O. — utilisé à CHAQUE tour côté
// joueur pour faire tourner l'équipe, et côté adversaire uniquement
// quand le combattant actif tombe K.O. Retourne -1 si personne n'est vivant.
function nextLivingIndex(fighters, fromIndex) {
  const n = fighters.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (fighters[idx].hp > 0) return idx;
  }
  return -1;
}
// Premier index vivant à partir de 0 (pour choisir le prochain
// combattant adverse actif après un K.O., en repartant du début de
// l'équipe plutôt qu'en continuant la boucle — plus prévisible).
function firstLivingIndex(fighters) {
  return fighters.findIndex((f) => f.hp > 0);
}

// team : [{ creature, ownedLevel, evolutionTier }, ...] (1 à 3 entrées,
// dans l'ordre du deck) — voir ChapterMapScreen pour la construction.
export default function CombatScreen({ team, levelNumber, onFinish }) {
  const opponentTeamCreatures = useRef(opponentTeamForLevel(levelNumber)).current;

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
  const [activeOpponentIndex, setActiveOpponentIndex] = useState(0);

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
  const activeOpponentIndexRef = useRef(0);
  activeOpponentIndexRef.current = activeOpponentIndex;
  const tapCountRef = useRef(0);
  const challengeStartRef = useRef(0);
  const challengeDoneRef = useRef(false);
  const selectedSkillRef = useRef(null);
  const pendingTransitionRef = useRef(null);
  const firstStrikeHandledRef = useRef(false);

  const punchScale = useRef(new Animated.Value(1)).current;

  // Pile ou face au tout début du combat : 1 chance sur 2 que
  // l'adversaire frappe en premier, avant le premier choix du joueur.
  // Résolu une seule fois au montage (firstStrikeHandledRef), en
  // réutilisant le même mécanisme "transition en attente + bouton
  // Continuer" que pour un tour normal, plutôt qu'un minuteur séparé.
  useEffect(() => {
    if (firstStrikeHandledRef.current) return;
    firstStrikeHandledRef.current = true;
    if (!opponentGoesFirst()) return;

    const opp = opponentsRef.current[activeOpponentIndexRef.current];
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

  const activeFighter = fighters[activeIndex];
  const activeOpponent = opponents[activeOpponentIndex];
  const requiredTaps = effectiveTapCount(activeFighter.stats.clickSpeed);

  // Choix d'une compétence : si le combattant actif a assez d'endurance,
  // elle est débitée immédiatement et le défi de tap démarre.
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

  // Choisit l'attaque d'un combattant adverse donné : une compétence au
  // hasard parmi celles qu'il peut encore payer, sinon l'attaque de
  // secours à 0 endurance (même filet de sécurité que le joueur).
  const pickOpponentSkill = (opp) => {
    const affordable = opp.creature.skills.filter((s) => s.enduranceCost <= opp.endurance);
    if (affordable.length === 0) {
      const basicDmg = Math.max(1, Math.round(opp.stats.attack * BASIC_ATTACK_RATIO));
      return { name: 'Attaque de base', damage: basicDmg, enduranceCost: 0, isBasic: true };
    }
    const skill = affordable[Math.floor(Math.random() * affordable.length)];
    return { ...skill, isBasic: false };
  };

  // Résout le défi de tap (complété ou pas) puis le tour complet. Si le
  // combattant actif tombe à 0 PV mais qu'un autre membre de l'équipe est
  // encore debout, il entre automatiquement — défaite/victoire seulement
  // si toute une équipe est K.O.
  const finishChallenge = (completed) => {
    if (challengeDoneRef.current) return;
    challengeDoneRef.current = true;
    const elapsedSec = (Date.now() - challengeStartRef.current) / 1000;
    const skill = selectedSkillRef.current;
    const curIdx = activeIndexRef.current;
    const curFighter = fightersRef.current[curIdx];
    const oppIdx = activeOpponentIndexRef.current;
    const opp = opponentsRef.current[oppIdx];

    // Dégâts du joueur, mis à l'échelle par le ratio ATQ actuel/ATQ de base.
    const multiplier = skill.isBasic ? 1 : damageMultiplierForTime(elapsedSec, completed);
    const skillDamage = skill.isBasic ? skill.damage : scaledSkillDamage(skill, curFighter.creature, curFighter.stats.attack);
    const playerDamage = computePlayerDamage(skillDamage, multiplier);

    const newOpponentHp = Math.max(0, opp.hp - playerDamage);
    let newOpponents = opponentsRef.current.map((o, i) => (i === oppIdx ? { ...o, hp: newOpponentHp } : o));

    // L'adversaire actif riposte-t-il ce tour ? Seulement s'il a survécu
    // aux dégâts du joueur — un adversaire qui vient de tomber ne frappe
    // pas depuis l'au-delà.
    let opponentDamage = 0;
    let opponentSkillName = null;
    let nextOppIdx = oppIdx;
    if (newOpponentHp > 0) {
      const oppSkill = pickOpponentSkill({ ...opp, hp: newOpponentHp });
      newOpponents = newOpponents.map((o, i) =>
        i === oppIdx ? { ...o, endurance: Math.max(0, o.endurance - oppSkill.enduranceCost) } : o
      );
      opponentDamage = oppSkill.isBasic ? oppSkill.damage : Math.round(scaledSkillDamage(oppSkill, opp.creature, opp.stats.attack));
      opponentSkillName = oppSkill.name;
    } else {
      // Combattant adverse K.O. — le suivant vivant prend sa place pour
      // le PROCHAIN tour (pas de riposte ce tour-ci).
      nextOppIdx = firstLivingIndex(newOpponents);
    }
    opponentsRef.current = newOpponents;
    setOpponents(newOpponents);
    if (nextOppIdx !== oppIdx && nextOppIdx !== -1) {
      activeOpponentIndexRef.current = nextOppIdx;
      setActiveOpponentIndex(nextOppIdx);
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

    // Victoire : plus AUCUN adversaire vivant après les dégâts du joueur.
    const anyOpponentAlive = newOpponents.some((o) => o.hp > 0);
    if (!anyOpponentAlive) {
      pendingTransitionRef.current = { type: 'win' };
      return;
    }

    // Sinon, gérer le sort du combattant joueur actif (K.O. ou non) — la
    // même rotation "à chaque tour" que d'habitude côté joueur.
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

  // Applique la transition calculée dans finishChallenge — déclenché par
  // le bouton "Continuer", jamais automatiquement.
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

  if (phase === 'done') {
    return <CombatResultScreen outcome={outcome} levelNumber={levelNumber} onContinue={() => onFinish(outcome)} />;
  }

  const playerDisplay = activeFighter.creature.stages[stageForLevel(activeFighter.ownedLevel)];
  const opponentDisplay = activeOpponent.creature.stages[0];
  const playerHpPct = Math.max(0, activeFighter.hp / activeFighter.stats.hp) * 100;
  const opponentHpPct = Math.max(0, activeOpponent.hp / activeOpponent.stats.hp) * 100;
  const playerEndurancePct = Math.max(0, activeFighter.endurance / activeFighter.stats.endurance) * 100;
  const opponentEndurancePct = Math.max(0, activeOpponent.endurance / activeOpponent.stats.endurance) * 100;

  return (
    <View style={styles.screen}>
      <Text style={styles.combatTitle}>⚔️ Combat</Text>

      {/* Rangée d'icônes de CHAQUE équipe : qui est actif, qui attend,
          qui est K.O. — équipe adverse affichée seulement si plus d'1
          membre, pour ne rien changer visuellement aux niveaux à 1 seul
          adversaire (chapitre 1). */}
      <View style={styles.teamRow}>
        {fighters.map((f, i) => {
          const d = f.creature.stages[stageForLevel(f.ownedLevel)];
          const fainted = f.hp <= 0;
          return (
            <View key={i} style={[styles.teamIcon, i === activeIndex && styles.teamIconActive, fainted && styles.teamIconFainted]}>
              <Text style={{ fontSize: 20, opacity: fainted ? 0.3 : 1 }}>{d.emoji}</Text>
            </View>
          );
        })}
      </View>
      {opponents.length > 1 && (
        <View style={[styles.teamRow, { marginTop: 4 }]}>
          {opponents.map((o, i) => {
            const d = o.creature.stages[0];
            const fainted = o.hp <= 0;
            return (
              <View key={i} style={[styles.teamIconOpp, i === activeOpponentIndex && styles.teamIconActiveOpp, fainted && styles.teamIconFainted]}>
                <Text style={{ fontSize: 18, opacity: fainted ? 0.3 : 1 }}>{d.emoji}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.fighterRow}>
        <View style={styles.fighterCard}>
          <Text style={styles.fighterEmoji}>{playerDisplay.emoji}</Text>
          <Text style={styles.fighterName} numberOfLines={1}>{playerDisplay.name}</Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${playerHpPct}%`, backgroundColor: COLORS.good }]} />
          </View>
          <Text style={styles.hpText}>{Math.max(0, activeFighter.hp)} / {activeFighter.stats.hp} PV</Text>
          <View style={styles.enduranceTrack}>
            <View style={[styles.enduranceFill, { width: `${playerEndurancePct}%` }]} />
          </View>
          <Text style={styles.enduranceText}>{Math.max(0, activeFighter.endurance)} / {activeFighter.stats.endurance} END</Text>
        </View>

        <Text style={styles.vsText}>VS</Text>

        <View style={styles.fighterCard}>
          <Text style={styles.fighterEmoji}>{opponentDisplay.emoji}</Text>
          <Text style={styles.fighterName} numberOfLines={1}>{opponentDisplay.name}</Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${opponentHpPct}%`, backgroundColor: '#FF5252' }]} />
          </View>
          <Text style={styles.hpText}>{Math.max(0, activeOpponent.hp)} / {activeOpponent.stats.hp} PV</Text>
          <View style={styles.enduranceTrack}>
            <View style={[styles.enduranceFill, { width: `${opponentEndurancePct}%`, backgroundColor: COLORS.neonPink }]} />
          </View>
          <Text style={styles.enduranceText}>{Math.max(0, activeOpponent.endurance)} / {activeOpponent.stats.endurance} END</Text>
        </View>
      </View>

      {switchMessage && (
        <View style={styles.switchBanner}>
          <Text style={styles.switchBannerText}>{switchMessage}</Text>
        </View>
      )}

      {lastRound && phase === 'resolving' && !switchMessage && (
        <View style={styles.roundLog}>
          {lastRound.skillName && (
            <Text style={styles.roundLogText}>💥 {lastRound.skillName} : -{lastRound.dmgToOpponent} (x{lastRound.multiplier.toFixed(2)})</Text>
          )}
          {lastRound.dmgToPlayer > 0 && (
            <Text style={[styles.roundLogText, { color: '#FF5252' }]}>🔻 {lastRound.opponentSkillName} : -{lastRound.dmgToPlayer} reçu</Text>
          )}
        </View>
      )}

      <View style={styles.tapArea}>
        {phase === 'choosing' && (
          <View style={styles.skillGrid}>
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
                  <Text style={styles.skillBtnStats}>{skill.damage} dégâts</Text>
                  <Text style={[styles.skillBtnStats, !canAfford && styles.skillBtnCostMissing]}>{skill.enduranceCost} END</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.basicAttackBtn}
              onPress={() =>
                chooseSkill(
                  { id: 'basic', name: 'Attaque de base', damage: Math.max(1, Math.round(activeFighter.stats.attack * BASIC_ATTACK_RATIO)), enduranceCost: 0 },
                  true
                )
              }
            >
              <Text style={styles.basicAttackText}>👊 Attaque de base (gratuite)</Text>
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
        <Text style={styles.resultSubtitle}>Toute l'équipe est K.O. — réessaie quand tu veux, rien n'est perdu.</Text>
      )}
      <TouchableOpacity style={styles.resultBtn} onPress={onContinue}>
        <Text style={styles.resultBtnText}>Retour à la carte</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  combatTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 10 },

  teamRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  teamIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.border,
  },
  teamIconActive: { borderColor: COLORS.action, shadowColor: COLORS.action, shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  teamIconOpp: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.border,
  },
  teamIconActiveOpp: { borderColor: '#FF5252', shadowColor: '#FF5252', shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  teamIconFainted: { borderColor: '#FF5252' },

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

  switchBanner: { backgroundColor: 'rgba(245,197,66,0.15)', borderRadius: 10, paddingVertical: 8, marginTop: 12, borderWidth: 1, borderColor: COLORS.action },
  switchBannerText: { color: COLORS.action, fontSize: 12, fontWeight: '800', textAlign: 'center', paddingHorizontal: 10 },

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

  continueBtn: {
    backgroundColor: COLORS.action, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 36,
    shadowColor: COLORS.action, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  continueBtnText: { color: '#241a00', fontSize: 15, fontWeight: '900' },

  resultEmoji: { fontSize: 80 },
  resultTitle: { fontSize: 26, fontWeight: '900', marginTop: 10 },
  resultReward: { color: COLORS.action, fontSize: 16, fontWeight: '800', marginTop: 10 },
  resultSubtitle: { color: COLORS.muted, fontSize: 13, marginTop: 10, textAlign: 'center', paddingHorizontal: 30 },
  resultBtn: { backgroundColor: COLORS.panel, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 30, marginTop: 30, borderWidth: 1, borderColor: COLORS.border },
  resultBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
});

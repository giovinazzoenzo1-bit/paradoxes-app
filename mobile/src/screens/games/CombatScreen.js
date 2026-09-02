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
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, useWindowDimensions, ImageBackground, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Décor de combat fourni par l'utilisateur (30/08) — remplace le fond
// placeholder en formes. Élargi au ratio 2400x1080 par miroir flouté sur
// les côtés pour éviter tout rognage vertical (la lune et le premier plan
// restent visibles quel que soit l'écran), exporté en JPEG (512 Ko).
const BG_IMG = require('../../../assets/combat/background.jpg');
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

// Nombre de dégâts flottant, affiché AU-DESSUS de la créature qui vient
// de subir l'attaque (demande explicite) — monte et s'efface tout seul.
// Purement décoratif : sa propre animation ne bloque JAMAIS la suite du
// combat (contrairement à l'ancien bouton "Continuer"), le `key` unique
// à chaque tour (passé par le parent) le fait juste se remonter et
// rejouer son animation depuis le début.
function FloatingDamage({ amount, color }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -44] });
  const opacity = anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.Text style={[styles.floatingDamage, { color, opacity, transform: [{ translateY }] }]}>
      -{amount}
    </Animated.Text>
  );
}

// team : [{ creature, ownedLevel, evolutionTier }, ...] (1 à 3 entrées,
// dans l'ordre du deck) — voir ChapterMapScreen pour la construction.
// Formation façon Monster Legends (fractions de la largeur/hauteur de
// l'écran en paysage), mesurée sur les captures de référence : côté
// joueur, combattant actif devant en bas à gauche (grand), 2e au milieu,
// 3e derrière en haut (plus petit, atténué = profondeur). Côté adverse,
// miroir : 1er au centre-droite (grand), 2e en haut à droite (petit,
// loin), 3e en bas à droite.
const PLAYER_SLOTS = [
  { x: 0.20, y: 0.56, size: 1.0 },
  { x: 0.36, y: 0.46, size: 0.78 },
  { x: 0.23, y: 0.26, size: 0.62 },
];
const OPPONENT_SLOTS = [
  { x: 0.60, y: 0.48, size: 1.0 },
  { x: 0.79, y: 0.26, size: 0.66 },
  { x: 0.80, y: 0.60, size: 0.82 },
];
const SPRITE_BASE = 74; // taille de l'emoji du sprite "devant" (size 1.0)

export default function CombatScreen({ team, levelNumber, onFinish }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
      const stats = combatStatsForCreatureTyped(member.creature, member.ownedLevel, member.evolutionTier || 0, member.equippedRunes || []);
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

  const [phase, setPhase] = useState('choosing'); // 'choosing' | 'tapping' | 'done'
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [tapCount, setTapCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TAP_CHALLENGE_TIME_LIMIT_SEC);
  const [switchMessage, setSwitchMessage] = useState(null);
  const [outcome, setOutcome] = useState(null); // null | 'win' | 'lose'
  // Statistiques accumulées pendant le combat, pour le récapitulatif de
  // fin (demande explicite) — mises à jour à chaque tour (premier coup
  // adverse inclus) et jamais réinitialisées avant la fin du combat.
  const [battleStats, setBattleStats] = useState({
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    rounds: 0,
    opponentsDefeated: 0,
    fightersFainted: 0,
    perFighterDamage: {}, // { [creatureId]: dégâts infligés par cette créature }
  });

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
  const firstStrikeHandledRef = useRef(false);

  const punchScale = useRef(new Animated.Value(1)).current;

  // Chiffres de dégâts flottants — purement décoratifs (voir
  // FloatingDamage plus haut), `roundKey` change à chaque tour pour les
  // faire rejouer leur animation depuis le début.
  const [roundKey, setRoundKey] = useState(0);
  const [opponentDamageFloat, setOpponentDamageFloat] = useState(null);
  const [playerDamageFloat, setPlayerDamageFloat] = useState(null);

  // Pile ou face au tout début du combat : 1 chance sur 2 que
  // l'adversaire frappe en premier, avant le premier choix du joueur.
  // Transition IMMÉDIATE vers 'choosing' (pas de bouton "Continuer", pas
  // de minuteur non plus — demande explicite de retirer l'attente, sans
  // réintroduire le bug de blocage qu'un minuteur avait causé la
  // dernière fois : ici il n'y a simplement plus RIEN à attendre).
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

    setRoundKey((k) => k + 1);
    setOpponentDamageFloat(null);
    setPlayerDamageFloat(oppDamage);
    setBattleStats((s) => ({
      ...s,
      totalDamageTaken: s.totalDamageTaken + oppDamage,
      rounds: s.rounds + 1,
      fightersFainted: s.fightersFainted + (newPlayerHp <= 0 ? 1 : 0),
    }));

    if (newPlayerHp <= 0) {
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      if (nextIdx === -1) {
        setOutcome('lose');
        setPhase('done');
        return;
      }
      activeIndexRef.current = nextIdx;
      setActiveIndex(nextIdx);
      setSwitchMessage(`${newFighters[curIdx].creature.stages[0].name} est K.O. ! ${newFighters[nextIdx].creature.stages[0].name} entre en combat !`);
    } else {
      setSwitchMessage("L'adversaire attaque en premier !");
    }
    setTimeout(() => setSwitchMessage(null), 2200);
    setPhase('choosing');
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

    // Rune de Célérité : bonus ADDITIF sur le multiplicateur, seulement
    // pour une vraie compétence (l'attaque de base a un multiplicateur
    // fixe à x1, ce n'est pas ce que la rune est censée booster).
    const multiplier = skill.isBasic ? 1 : damageMultiplierForTime(elapsedSec, completed) + (curFighter.stats.dmgMultBonus || 0);
    const skillDamage = skill.isBasic ? skill.damage : scaledSkillDamage(skill, curFighter.creature, curFighter.stats.attack);
    const playerDamage = computePlayerDamage(skillDamage, multiplier);

    const newOpponentHp = Math.max(0, opp.hp - playerDamage);
    let newOpponents = opponentsRef.current.map((o, i) => (i === targetIdx ? { ...o, hp: newOpponentHp } : o));

    let opponentDamage = 0;
    if (newOpponentHp > 0) {
      const oppSkill = pickOpponentSkill({ ...opp, hp: newOpponentHp });
      newOpponents = newOpponents.map((o, i) =>
        i === targetIdx ? { ...o, endurance: Math.max(0, o.endurance - oppSkill.enduranceCost) } : o
      );
      opponentDamage = oppSkill.isBasic ? oppSkill.damage : Math.round(scaledSkillDamage(oppSkill, opp.creature, opp.stats.attack));
    }
    opponentsRef.current = newOpponents;
    setOpponents(newOpponents);

    // Si la cible tombe, on repositionne automatiquement la sélection
    // sur le premier adversaire encore vivant — le joueur reste libre de
    // choisir une AUTRE cible ensuite (à CHAQUE tour, demande explicite).
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

    // Dégâts flottants au-dessus de CHAQUE créature touchée (demande
    // explicite) — purement décoratif, la suite du combat ne les attend
    // jamais.
    setRoundKey((k) => k + 1);
    setOpponentDamageFloat(playerDamage);
    setPlayerDamageFloat(opponentDamage > 0 ? opponentDamage : null);
    setBattleStats((s) => ({
      totalDamageDealt: s.totalDamageDealt + playerDamage,
      totalDamageTaken: s.totalDamageTaken + opponentDamage,
      rounds: s.rounds + 1,
      opponentsDefeated: s.opponentsDefeated + (newOpponentHp <= 0 ? 1 : 0),
      fightersFainted: s.fightersFainted + (newPlayerHp <= 0 ? 1 : 0),
      perFighterDamage: {
        ...s.perFighterDamage,
        [curFighter.creature.id]: (s.perFighterDamage[curFighter.creature.id] || 0) + playerDamage,
      },
    }));

    // Victoire : plus AUCUN adversaire vivant.
    const anyOpponentAlive = newOpponents.some((o) => o.hp > 0);
    if (!anyOpponentAlive) {
      setOutcome('win');
      setPhase('done');
      return;
    }

    // Le joueur est-il K.O. ?
    if (newPlayerHp <= 0) {
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      if (nextIdx === -1) {
        setOutcome('lose');
        setPhase('done');
        return;
      }
      activeIndexRef.current = nextIdx;
      setActiveIndex(nextIdx);
      setSwitchMessage(`${newFighters[curIdx].creature.stages[0].name} est K.O. ! ${newFighters[nextIdx].creature.stages[0].name} entre en combat !`);
      setTimeout(() => setSwitchMessage(null), 2200);
    } else {
      // Rotation systématique côté joueur, comme avant, à chaque tour.
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      activeIndexRef.current = nextIdx;
      setActiveIndex(nextIdx);
      setSwitchMessage(`Au tour de ${newFighters[nextIdx].creature.stages[0].name} !`);
      setTimeout(() => setSwitchMessage(null), 1400);
    }

    // Transition IMMÉDIATE vers le prochain choix — plus de bouton
    // "Continuer" à taper après une attaque du joueur (demande
    // explicite). Sans minuteur non plus (contrairement à l'ancienne
    // version qui avait causé un vrai bug de blocage) : ici il n'y a
    // simplement plus rien à attendre, le passage à 'choosing' est
    // synchrone avec le calcul du tour.
    setPhase('choosing');
  };

  const confirmQuit = () => {
    Alert.alert('Quitter le combat ?', 'Tu ne gagneras aucune récompense et reviendras à la carte.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => onFinish('quit') },
    ]);
  };

  if (phase === 'done') {
    return (
      <CombatResultScreen
        outcome={outcome}
        levelNumber={levelNumber}
        battleStats={battleStats}
        fighters={fighters}
        onContinue={() => onFinish(outcome)}
      />
    );
  }

  // Ordre d'affichage côté joueur : l'actif prend TOUJOURS la place de
  // devant (slot 0), les autres remplissent les slots 1 et 2.
  const playerOrder = [activeIndex, ...fighters.map((_, i) => i).filter((i) => i !== activeIndex)];

  const renderSprite = ({ key, slot, emoji, name, hp, hpMax, endurance, enduranceMax, fainted, ring, onPress, disabled, hpColor, floatDamage }) => {
    const fs = Math.round(SPRITE_BASE * slot.size);
    const boxW = Math.round(fs * 1.7);
    const left = slot.x * W - boxW / 2;
    const top = slot.y * H - fs / 2 - 10;
    return (
      <TouchableOpacity
        key={key}
        activeOpacity={onPress ? 0.8 : 1}
        onPress={onPress}
        disabled={disabled}
        style={[styles.sprite, { left, top, width: boxW, opacity: fainted ? 0.35 : slot.size < 0.7 ? 0.85 : 1 }]}
      >
        {floatDamage != null && (
          <View pointerEvents="none" style={styles.floatingDamageWrap}>
            <FloatingDamage key={`${key}-${roundKey}`} amount={floatDamage} color="#FF5252" />
          </View>
        )}
        <View style={[styles.spriteRing, { width: fs + 22, height: fs + 22, borderRadius: (fs + 22) / 2 }, ring === 'active' && styles.ringActive, ring === 'target' && styles.ringTarget]}>
          <Text style={{ fontSize: fs, lineHeight: fs + 12 }}>{emoji}</Text>
        </View>
        <Text style={[styles.spriteName, { fontSize: Math.max(9, Math.round(12 * slot.size)) }]} numberOfLines={1}>{name}</Text>
        <View style={[styles.spriteHpTrack, { width: Math.round(90 * slot.size) }]}>
          <View style={[styles.spriteHpFill, { width: `${Math.max(0, hp / hpMax) * 100}%`, backgroundColor: hpColor }]} />
        </View>
        {endurance != null && (
          <View style={[styles.spriteEndTrack, { width: Math.round(90 * slot.size) }]}>
            <View style={[styles.spriteEndFill, { width: `${Math.max(0, endurance / enduranceMax) * 100}%` }]} />
          </View>
        )}
        {ring === 'target' && !fainted && <Text style={styles.targetLabel}>🎯</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { marginTop: -insets.top }]}>
      <StatusBar hidden />

      {/* Décor de combat. Voile sombre par-dessus : le décor est très
          détaillé/lumineux, sans ça les sprites et les barres de vie s'y
          perdent visuellement. */}
      <ImageBackground source={BG_IMG} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={styles.bgDim} />
      </ImageBackground>

      <TouchableOpacity style={[styles.closeBtn, { top: 10 + insets.top, left: 10 + insets.left }]} onPress={confirmQuit}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Équipe du joueur — 3 sprites sur le terrain, l'actif devant. */}
      {playerOrder.map((fi, slotIdx) => {
        const f = fighters[fi];
        const d = f.creature.stages[stageForLevel(f.ownedLevel)];
        return renderSprite({
          key: `p${fi}`, slot: PLAYER_SLOTS[slotIdx], emoji: d.emoji, name: d.name,
          hp: f.hp, hpMax: f.stats.hp,
          endurance: fi === activeIndex ? f.endurance : null, enduranceMax: f.stats.endurance,
          fainted: f.hp <= 0, ring: fi === activeIndex ? 'active' : null, disabled: true, hpColor: COLORS.good,
          floatDamage: fi === activeIndex ? playerDamageFloat : null,
        });
      })}

      {/* Équipe adverse — tous tapables pour choisir la cible, à chaque
          tour (demande explicite), pas seulement une fois par combat. */}
      {opponents.map((o, i) => {
        const d = o.creature.stages[0];
        const fainted = o.hp <= 0;
        return renderSprite({
          key: `o${i}`, slot: OPPONENT_SLOTS[i], emoji: d.emoji, name: d.name,
          hp: o.hp, hpMax: o.stats.hp, fainted,
          ring: i === targetIndex && !fainted ? 'target' : null,
          onPress: () => chooseTarget(i), disabled: fainted || phase !== 'choosing', hpColor: '#FF5252',
          floatDamage: i === targetIndex ? opponentDamageFloat : null,
        });
      })}

      {/* Couche centrale : défi de tap / bannière de tour uniquement —
          plus de bouton "Continuer" après une attaque du joueur (demande
          explicite), la transition est immédiate. */}
      <View pointerEvents="box-none" style={styles.centerLayer}>
        {switchMessage && (
          <View style={styles.switchBanner}>
            <Text style={styles.switchBannerText}>{switchMessage}</Text>
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
      </View>

      {phase === 'choosing' && (
        <View style={[styles.bottomWrap, { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom }]}>
          <Text style={styles.hintText}>▼ CHOIX DE COMPÉTENCE ▼</Text>
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
        </View>
      )}
    </View>
  );
}

function CombatResultScreen({ outcome, levelNumber, battleStats, fighters, onContinue }) {
  const isWin = outcome === 'win';
  const reward = isWin ? griffesReward(levelNumber) : 0;

  // Répartition des dégâts par créature, triée par contribution — vide
  // si un seul combattant a fait tout le combat (pas la peine d'un
  // classement à un seul élément).
  const breakdown = Object.entries(battleStats.perFighterDamage)
    .map(([creatureId, dmg]) => {
      const fighter = fighters.find((f) => f.creature.id === creatureId);
      return { name: fighter ? fighter.creature.stages[0].name : creatureId, emoji: fighter ? fighter.creature.stages[0].emoji : '❓', dmg };
    })
    .sort((a, b) => b.dmg - a.dmg);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.resultScroll}>
      <Text style={styles.resultEmoji}>{isWin ? '🏆' : '💀'}</Text>
      <Text style={[styles.resultTitle, { color: isWin ? COLORS.good : '#FF5252' }]}>
        {isWin ? 'Victoire !' : 'Défaite'}
      </Text>
      {isWin && <Text style={styles.resultReward}>+{reward} 🐾 Griffes</Text>}

      {/* Récapitulatif du combat (demande explicite) — mêmes chiffres
          quelle que soit l'issue, victoire ou défaite. */}
      <View style={styles.recapCard}>
        <Text style={styles.recapTitle}>📊 Récapitulatif</Text>
        <View style={styles.recapRow}>
          <View style={styles.recapStat}>
            <Text style={styles.recapStatValue}>{battleStats.totalDamageDealt}</Text>
            <Text style={styles.recapStatLabel}>Dégâts infligés</Text>
          </View>
          <View style={styles.recapStat}>
            <Text style={[styles.recapStatValue, { color: '#FF5252' }]}>{battleStats.totalDamageTaken}</Text>
            <Text style={styles.recapStatLabel}>Dégâts reçus</Text>
          </View>
          <View style={styles.recapStat}>
            <Text style={styles.recapStatValue}>{battleStats.rounds}</Text>
            <Text style={styles.recapStatLabel}>Tours joués</Text>
          </View>
        </View>
        <View style={styles.recapRow}>
          <View style={styles.recapStat}>
            <Text style={[styles.recapStatValue, { color: COLORS.good }]}>{battleStats.opponentsDefeated}</Text>
            <Text style={styles.recapStatLabel}>Adversaires vaincus</Text>
          </View>
          <View style={styles.recapStat}>
            <Text style={[styles.recapStatValue, { color: COLORS.action }]}>{battleStats.fightersFainted}</Text>
            <Text style={styles.recapStatLabel}>Tes créatures K.O.</Text>
          </View>
        </View>

        {breakdown.length > 1 && (
          <>
            <Text style={styles.recapSubTitle}>Dégâts par créature</Text>
            {breakdown.map((b) => (
              <View key={b.name} style={styles.recapBreakdownRow}>
                <Text style={styles.recapBreakdownName}>{b.emoji} {b.name}</Text>
                <Text style={styles.recapBreakdownValue}>{b.dmg} dégâts</Text>
              </View>
            ))}
          </>
        )}
      </View>

      {!isWin && <Text style={styles.resultSubtitle}>Réessaie quand tu veux — rien n'est perdu.</Text>}
      <TouchableOpacity style={styles.resultBtn} onPress={onContinue}>
        <Text style={styles.resultBtnText}>Retour à la carte</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0820' },

  bgDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,4,20,0.34)' },

  closeBtn: {
    position: 'absolute', zIndex: 30, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  sprite: { position: 'absolute', alignItems: 'center', zIndex: 5 },
  spriteRing: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  ringActive: { borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.15)' },
  ringTarget: { borderColor: '#FF5252', backgroundColor: 'rgba(255,82,82,0.15)' },
  spriteName: {
    color: '#fff', fontWeight: '900', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  spriteHpTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.6)', overflow: 'hidden', marginTop: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  spriteHpFill: { height: '100%', borderRadius: 4 },
  spriteEndTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.6)', overflow: 'hidden', marginTop: 2 },
  spriteEndFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.action },
  targetLabel: { fontSize: 12, marginTop: 1 },

  centerLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  switchBanner: { backgroundColor: 'rgba(20,10,0,0.85)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1.5, borderColor: COLORS.action, marginBottom: 8 },
  switchBannerText: { color: COLORS.action, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  chosenSkillLabel: {
    color: COLORS.action, fontSize: 13, fontWeight: '900', marginBottom: 8, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3,
  },
  tapZoneCombat: {
    width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(23,19,49,0.92)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: COLORS.neonPink,
    shadowColor: COLORS.neonPink, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },
  tapPunchText: { fontSize: 68 },
  tapCountText: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3 },
  timeTrack: { width: 130, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.6)', overflow: 'hidden', marginTop: 6 },
  timeFill: { height: '100%', backgroundColor: COLORS.neonCyan, borderRadius: 3 },
  floatingDamageWrap: { position: 'absolute', top: -26, left: 0, right: 0, alignItems: 'center', zIndex: 15 },
  floatingDamage: {
    color: '#FF5252', fontSize: 20, fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },

  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 },
  hintText: {
    color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'center', marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3,
  },
  bottomBar: { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 8, paddingTop: 6, gap: 6, backgroundColor: 'rgba(7,5,26,0.92)' },
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

  resultScroll: { flexGrow: 1, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  recapCard: {
    width: '100%', maxWidth: 420, backgroundColor: COLORS.panel, borderRadius: 16, padding: 16, marginTop: 18,
    borderWidth: 1, borderColor: COLORS.border,
  },
  recapTitle: { color: COLORS.action, fontSize: 13, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  recapRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  recapStat: { alignItems: 'center', flex: 1 },
  recapStatValue: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  recapStatLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  recapSubTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '800', marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
  recapBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  recapBreakdownName: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  recapBreakdownValue: { color: COLORS.action, fontSize: 12, fontWeight: '800' },
});

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
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert, useWindowDimensions, ImageBackground, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreatureArt from '../../components/CreatureArt';
import { StatusBar } from 'expo-status-bar';

// Décor de combat fourni par l'utilisateur (30/08) — remplace le fond
// placeholder en formes. Élargi au ratio 2400x1080 par miroir flouté sur
// les côtés pour éviter tout rognage vertical (la lune et le premier plan
// restent visibles quel que soit l'écran), exporté en JPEG (512 Ko).
// Décor de champ de bataille (11/09). Remplace l'ancien fond : celui-ci
// est dessiné en légère plongée, avec une zone centrale dégagée, donc
// les créatures se posent dessus au lieu de flotter sur une image plate.
const BG_IMG = require('../../../assets/combat/battlefield.jpg');
// Décor de VICTOIRE : la même prairie au soleil couchant. Réutilisé
// aussi en défaite, mais assombri par un voile (voir `resultDim`) —
// une image de défaite séparée n'existe pas encore.
const VICTORY_BG = require('../../../assets/combat/victory.jpg');
const VICTORY_BANNER = require('../../../assets/combat/victory-banner.png');
const DEFEAT_BANNER = require('../../../assets/combat/defeat-banner.png');
// Cadre du récapitulatif. Contrairement aux cadres de la fiche de
// créature, son intérieur est PLEIN (planche de bois) : il sert donc de
// fond complet, et le texte doit passer en SOMBRE pour rester lisible.
// Bordure mesurée sur l'image : 10% en largeur, 15% en hauteur.
const RECAP_FRAME = require('../../../assets/combat/recap-frame.png');
import { COLORS } from './clickerTheme';
import { stageForLevel, MANA_MAX, MANA_PER_TURN } from '../../games/clicker/clickerLogic';
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
// Remontés pour la même raison : la barre de vie du combattant de
// devant arrivait au ras des boutons.
const PLAYER_SLOTS = [
  { x: 0.20, y: 0.46, size: 1.0 },
  { x: 0.36, y: 0.38, size: 0.78 },
  { x: 0.23, y: 0.20, size: 0.62 },
];
// Adversaires décalés vers la droite (11/09) : ils empiétaient sur le
// centre du terrain, où passe le sentier du décor.
// Remontés le 12/09 : avec les boutons d'attaque en carrés de 86dp en
// bas de l'écran, les emplacements bas (y 0,60) passaient derrière eux.
const OPPONENT_SLOTS = [
  { x: 0.70, y: 0.40, size: 1.0 },
  { x: 0.88, y: 0.20, size: 0.66 },
  { x: 0.89, y: 0.50, size: 0.82 },
];
// Agrandi de 74 à 104 (12/09) : les illustrations de créatures
// paraissaient minuscules sur le décor, qui occupe tout l'écran. Les
// emplacements ayant été remontés, la place existe.
const SPRITE_BASE = 104;

export default function CombatScreen({ team, levelNumber, onFinish }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const opponentTeamCreatures = useRef(opponentTeamForLevel(levelNumber)).current;

  // PAS de gestion d'orientation ici. Cet écran n'est rendu que depuis
  // AdventureScreen, qui verrouille déjà le paysage pour tout le mode et
  // ne remet le portrait qu'en le quittant.
  //
  // Il avait son propre verrou, hérité de l'époque où seul le combat
  // était en paysage. Son nettoyage forçait le PORTRAIT au démontage :
  // à la fin d'un combat, on revenait donc à la carte des chapitres en
  // portrait alors que l'Aventure entière doit rester en paysage.
  // L'effet d'AdventureScreen ne se rejoue pas (dépendances vides), donc
  // rien ne rétablissait le paysage.
  //
  // Règle : un seul écran est responsable de l'orientation d'un mode —
  // celui qui l'ouvre et le ferme.

  const [fighters, setFighters] = useState(() =>
    team.map((member) => {
      const stats = combatStatsForCreatureTyped(member.creature, member.ownedLevel, member.evolutionTier || 0, member.equippedRunes || []);
      return { creature: member.creature, ownedLevel: member.ownedLevel, stats, hp: stats.hp, mana: 0 };
    })
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const [opponents, setOpponents] = useState(() =>
    opponentTeamCreatures.map((creature) => {
      const stats = statsForOpponentCreatureTyped(creature, levelNumber);
      return { creature, stats, hp: stats.hp, mana: 0 };
    })
  );
  // Cible choisie par le JOUEUR (demande explicite : pouvoir choisir quel
  // adversaire attaquer, pas une rotation automatique côté adversaire).
  const [targetIndex, setTargetIndex] = useState(0);

  const [phase, setPhase] = useState('choosing'); // 'choosing' | 'tapping' | 'done'
  const [selectedSkill, setSelectedSkill] = useState(null);
  // Détail d'une attaque, affiché sur appui long.
  const [skillInfo, setSkillInfo] = useState(null);
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
  // Élan d'attaque : le combattant actif se jette vers l'adversaire puis
  // revient. Valeur partagée par les deux camps — un seul sprite bouge à
  // la fois, celui dont c'est le tour.
  const lungeAnim = useRef(new Animated.Value(0)).current;
  // { side, index } — l'INDICE est figé au déclenchement.
  //
  // ⚠️ Il était auparavant relu à l'affichage via `activeIndex`, qui
  // change quand le tour avance dans la même séquence : au moment du
  // rendu il désignait déjà le combattant SUIVANT, et c'était lui qui
  // s'animait (bug du 12/09).
  const [lunge, setLunge] = useState(null);
  const playLunge = (side, index) => {
    setLunge({ side, index });
    lungeAnim.setValue(0);
    // Rythme d'un coup porté : recul (anticipation), détente rapide,
    // TEMPS D'ARRÊT à l'impact, puis retour souple. Le temps d'arrêt est
    // ce qui rend le coup percutant — sans lui, l'aller-retour se lit
    // comme un simple glissement (retour du 12/09 : « trop rapide »).
    Animated.sequence([
      Animated.timing(lungeAnim, { toValue: -0.35, duration: 160, useNativeDriver: true }),
      Animated.timing(lungeAnim, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.delay(160),
      Animated.spring(lungeAnim, { toValue: 0, useNativeDriver: true, friction: 6, tension: 60 }),
    ]).start(() => setLunge(null));
  };

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
    // Mana de l'adversaire monté AVANT son choix, sur la copie locale :
    // passer par setOpponents aurait été asynchrone, et il aurait choisi
    // avec la valeur du tour précédent.
    const oppWithMana = { ...opp, mana: Math.min(MANA_MAX, opp.mana + MANA_PER_TURN) };
    // Élan de l'adversaire lancé ici, AVANT que les dégâts ne
    // s'affichent : sans ce décalage, le chiffre rouge apparaissait
    // pendant que la créature bougeait encore et on ne voyait pas qui
    // avait frappé (retour du 12/09).
    playLunge('opponent', 0);
    const oppSkill = pickOpponentSkill(oppWithMana);
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
      // Le mana du combattant qui prend la main monte d'un cran. Sans
      // ce gain, la jauge ne se remplirait jamais et le coup spécial
      // resterait inaccessible toute la partie.
      setFighters((prev) => prev.map((f, i) => (i === nextIdx ? { ...f, mana: Math.min(MANA_MAX, f.mana + MANA_PER_TURN) } : f)));
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
    const cost = isBasic ? 0 : (skill.manaCost || 0);
    // Le spécial exige la jauge PLEINE, pas seulement d'avoir le coût :
    // c'est ce qui en fait un moment attendu plutôt qu'une attaque de plus.
    if (skill.special && activeFighter.mana < MANA_MAX) return;
    if (activeFighter.mana < cost) return;
    setFighters((prev) => prev.map((f, i) => (i === activeIndex ? { ...f, mana: f.mana - cost } : f)));
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
          ? { ...f, mana: MANA_MAX }
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
    const affordable = (opp.creature.skills || []).filter(
      (sk) => (sk.manaCost || 0) <= opp.mana && (!sk.special || opp.mana >= MANA_MAX)
    );
    if (affordable.length === 0) {
      const basicDmg = Math.max(1, Math.round(opp.stats.attack * BASIC_ATTACK_RATIO));
      return { name: 'Attaque de base', damage: basicDmg, manaCost: 0, isBasic: true };
    }
    const skill = affordable[Math.floor(Math.random() * affordable.length)];
    return { ...skill, isBasic: false };
  };

  const finishChallenge = (completed) => {
    if (challengeDoneRef.current) return;
    challengeDoneRef.current = true;
    playLunge('player', activeIndexRef.current);
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
      const oppSkill = pickOpponentSkill({ ...opp, hp: newOpponentHp, mana: Math.min(MANA_MAX, opp.mana + MANA_PER_TURN) });
      newOpponents = newOpponents.map((o, i) =>
        i === targetIdx ? { ...o, mana: Math.max(0, o.mana - (oppSkill.manaCost || 0)) } : o
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
      // Le mana du combattant qui prend la main monte d'un cran. Sans
      // ce gain, la jauge ne se remplirait jamais et le coup spécial
      // resterait inaccessible toute la partie.
      setFighters((prev) => prev.map((f, i) => (i === nextIdx ? { ...f, mana: Math.min(MANA_MAX, f.mana + MANA_PER_TURN) } : f)));
      setSwitchMessage(`${newFighters[curIdx].creature.stages[0].name} est K.O. ! ${newFighters[nextIdx].creature.stages[0].name} entre en combat !`);
      setTimeout(() => setSwitchMessage(null), 2200);
    } else {
      // Rotation systématique côté joueur, comme avant, à chaque tour.
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      activeIndexRef.current = nextIdx;
      setActiveIndex(nextIdx);
      // Le mana du combattant qui prend la main monte d'un cran. Sans
      // ce gain, la jauge ne se remplirait jamais et le coup spécial
      // resterait inaccessible toute la partie.
      setFighters((prev) => prev.map((f, i) => (i === nextIdx ? { ...f, mana: Math.min(MANA_MAX, f.mana + MANA_PER_TURN) } : f)));
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
        onNextLevel={() => onFinish(outcome, true)}
      />
    );
  }

  // Ordre d'affichage côté joueur : l'actif prend TOUJOURS la place de
  // devant (slot 0), les autres remplissent les slots 1 et 2.
  const playerOrder = [activeIndex, ...fighters.map((_, i) => i).filter((i) => i !== activeIndex)];

  const renderSprite = ({ key, slot, creatureId, stageIndex, emoji, name, hp, hpMax, mana, manaMax, fainted, ring, onPress, disabled, hpColor, floatDamage, lunging, lungeDir }) => {
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
        style={[styles.sprite, { left, top, width: boxW, opacity: fainted ? 0.35 : slot.size < 0.7 ? 0.85 : 1 },
          // Élan vers l'adversaire. `zIndex` relevé pendant le
          // mouvement pour que l'attaquant passe DEVANT sa cible.
          lunging && { zIndex: 20 }]}
      >
        {floatDamage != null && (
          <View style={styles.floatingDamageWrap}>
            <FloatingDamage key={`${key}-${roundKey}`} amount={floatDamage} color="#FF5252" />
          </View>
        )}
        {/* Flèche au-dessus de la cible, à la place de l'ancien anneau :
            elle désigne sans encercler, et laisse la créature lisible. */}
        {ring === 'target' && !fainted && <Text style={styles.targetArrow}>▼</Text>}
        <View style={[styles.spriteRing, { width: fs + 22, height: fs + 22, borderRadius: (fs + 22) / 2 }]}>
          {/* `size={fs}` : l'illustration reprend exactement la taille
              calculee pour l'emoji, donc la mise en page du terrain
              (anneaux, barres de vie, positions) reste identique. */}
          <Animated.View
            style={lunging ? {
              transform: [
                // Amplitude portée à 1,1x la taille du sprite : le
                // combattant va vraiment AU CONTACT au lieu d'esquisser
                // un pas.
                { translateX: lungeAnim.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [lungeDir * -Math.round(fs * 0.22), 0, lungeDir * Math.round(fs * 1.1)] }) },
                { scale: lungeAnim.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [0.94, 1, 1.22] }) },
                // Légère bascule vers l'avant, comme un coup d'épaule.
                { rotate: lungeAnim.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [`${-lungeDir * 6}deg`, '0deg', `${lungeDir * 14}deg`] }) },
              ],
            } : null}
          >
            <CreatureArt
              creatureId={creatureId}
              stageIndex={stageIndex}
              emoji={emoji}
              size={fs}
              emojiStyle={{ fontSize: fs, lineHeight: fs + 12 }}
            />
          </Animated.View>
        </View>
        <Text style={[styles.spriteName, { fontSize: Math.max(9, Math.round(12 * slot.size)) }]} numberOfLines={1}>{name}</Text>
        <View style={[styles.spriteHpTrack, { width: Math.round(90 * slot.size) }]}>
          <View style={[styles.spriteHpFill, { width: `${Math.max(0, hp / hpMax) * 100}%`, backgroundColor: hpColor }]} />
        </View>
        {mana != null && (
          <View style={[styles.spriteEndTrack, { width: Math.round(90 * slot.size) }]}>
            <View style={[styles.spriteEndFill, { width: `${Math.max(0, Math.min(1, mana / manaMax)) * 100}%` }]} />
          </View>
        )}

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
          key: `p${fi}`, slot: PLAYER_SLOTS[slotIdx],
          creatureId: f.creature.id, stageIndex: stageForLevel(f.ownedLevel),
          emoji: d.emoji, name: d.name,
          hp: f.hp, hpMax: f.stats.hp,
          mana: fi === activeIndex ? f.mana : null, manaMax: MANA_MAX,
          fainted: f.hp <= 0, ring: fi === activeIndex ? 'active' : null, disabled: true, hpColor: COLORS.good,
          lunging: !!lunge && lunge.side === 'player' && fi === lunge.index, lungeDir: 1,
          floatDamage: fi === activeIndex ? playerDamageFloat : null,
        });
      })}

      {/* Équipe adverse — tous tapables pour choisir la cible, à chaque
          tour (demande explicite), pas seulement une fois par combat. */}
      {opponents.map((o, i) => {
        const d = o.creature.stages[0];
        const fainted = o.hp <= 0;
        return renderSprite({
          key: `o${i}`, slot: OPPONENT_SLOTS[i],
          creatureId: o.creature.id, stageIndex: 0,
          emoji: d.emoji, name: d.name,
          hp: o.hp, hpMax: o.stats.hp, fainted,
          ring: i === targetIndex && !fainted ? 'target' : null,
          // L'adversaire actif est celui du slot de devant : c'est lui
          // qui riposte. Il s'élance vers la GAUCHE (-1).
          lunging: !!lunge && lunge.side === 'opponent' && i === lunge.index, lungeDir: -1,
          onPress: () => chooseTarget(i), disabled: fainted || phase !== 'choosing', hpColor: '#FF5252',
          floatDamage: i === targetIndex ? opponentDamageFloat : null,
        });
      })}

      {/* Couche centrale : défi de tap / bannière de tour uniquement —
          plus de bouton "Continuer" après une attaque du joueur (demande
          explicite), la transition est immédiate. */}
      <View style={styles.centerLayer}>
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

      {/* Détail d'une attaque, sur appui long. Taper à côté ferme. */}
      {skillInfo && (
        <View style={styles.skillInfoBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSkillInfo(null)} />
          <View style={styles.skillInfoCard}>
            <Text style={styles.skillInfoName}>{skillInfo.name}</Text>
            <Text style={styles.skillInfoLine}>
              {skillInfo.damage} dégâts{skillInfo.aoe ? ' · touche TOUS les ennemis' : ' · cible unique'}
            </Text>
            <Text style={styles.skillInfoLine}>
              {skillInfo.special
                ? `Coup spécial — nécessite la jauge pleine (${MANA_MAX}💧)`
                : (skillInfo.manaCost || 0) === 0
                ? 'Attaque de base — gratuite'
                : `Coûte ${skillInfo.manaCost}💧`}
            </Text>
            <TouchableOpacity style={styles.skillInfoClose} onPress={() => setSkillInfo(null)}>
              <Text style={styles.skillInfoCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {phase === 'choosing' && (
        <View style={[styles.bottomWrap, { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom }]}>
          <Text style={styles.hintText}>▼ CHOIX DE COMPÉTENCE ▼</Text>
          <View style={styles.bottomBar}>
            {activeFighter.creature.skills
              // Le spécial reste INVISIBLE tant que la jauge n'est pas
              // pleine : afficher un bouton grisé qu'on ne peut pas
              // utiliser encombre l'écran sans rien apprendre.
              .filter((sk) => !sk.special || activeFighter.mana >= MANA_MAX)
              .map((skill) => {
              const cost = skill.manaCost || 0;
              // Le spécial exige la jauge PLEINE, pas seulement son coût.
              const canAfford = skill.special
                ? activeFighter.mana >= MANA_MAX
                : activeFighter.mana >= cost;
              return (
                <TouchableOpacity
                  key={skill.id}
                  style={[styles.skillBtn, skill.special && styles.skillBtnSpecial, !canAfford && styles.skillBtnDisabled]}
                  // Un appui simple SÉLECTIONNE l'attaque ; un appui long
                  // affiche seulement son détail. Sans cette séparation,
                  // consulter une attaque reviendrait à la lancer.
                  onPress={() => chooseSkill(skill, false)}
                  onLongPress={() => setSkillInfo(skill)}
                  delayLongPress={220}
                  disabled={!canAfford}
                >
                  <Text style={styles.skillBtnName} numberOfLines={2}>{skill.name}</Text>
                  <Text style={styles.skillBtnDamage}>
                    {skill.damage} dégâts{skill.aoe ? ' · ZONE' : ''}
                  </Text>
                  <Text style={[styles.skillBtnCost, !canAfford && styles.skillBtnCostMissing]}>
                    {skill.special ? `SPÉCIAL ${MANA_MAX}💧` : cost === 0 ? 'Gratuit' : `${cost}💧`}
                  </Text>
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

function CombatResultScreen({ outcome, levelNumber, battleStats, fighters, onContinue, onNextLevel }) {
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
    <ImageBackground source={VICTORY_BG} style={styles.screen} resizeMode="cover">
      {/* Voile : léger en victoire (le décor doit rester lumineux),
          nettement plus sombre et froid en défaite — ça évite d'avoir à
          générer une seconde image juste pour l'ambiance. */}
      <View style={[styles.resultDim, !isWin && styles.resultDimLose]} />
      <ScrollView style={styles.resultScrollView} contentContainerStyle={styles.resultScroll}>
      {/* Le titre est écrit DANS le bandeau : la zone centrale a été
          demandée lisse à la génération, précisément pour ça. */}
      <ImageBackground
        source={isWin ? VICTORY_BANNER : DEFEAT_BANNER}
        style={styles.resultBanner}
        imageStyle={styles.resultBannerImg}
        resizeMode="contain"
      >
        <Text style={styles.resultBannerText}>{isWin ? 'VICTOIRE !' : 'DÉFAITE'}</Text>
      </ImageBackground>
      {/* Deux colonnes : le récapitulatif à gauche, les boutons empilés
          à droite. En pleine largeur, le cadre débordait et il fallait
          faire défiler pour atteindre les boutons. */}
      <View style={styles.resultBody}>
      <ImageBackground source={RECAP_FRAME} style={styles.recapCard} imageStyle={styles.recapCardImg} resizeMode="stretch">
        {/* Le gain est DANS le cadre : posé sur le décor il se perdait
            dans les tons dorés du couchant (signalé le 12/09). */}
        {isWin && (
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardBadgeText}>+{reward} 🐾 Griffes</Text>
          </View>
        )}
        <Text style={styles.recapTitle}>📊 Récapitulatif</Text>
        {/* Les 5 chiffres sur UNE rangée : en deux rangées, les boutons
            passaient sous le bord de l'écran (signalé le 12/09). */}
        <View style={styles.recapRow}>
          <View style={styles.recapStat}>
            <Text style={styles.recapStatValue}>{battleStats.totalDamageDealt}</Text>
            <Text style={styles.recapStatLabel}>Infligés</Text>
          </View>
          <View style={styles.recapStat}>
            <Text style={[styles.recapStatValue, { color: '#FF5252' }]}>{battleStats.totalDamageTaken}</Text>
            <Text style={styles.recapStatLabel}>Reçus</Text>
          </View>
          <View style={styles.recapStat}>
            <Text style={styles.recapStatValue}>{battleStats.rounds}</Text>
            <Text style={styles.recapStatLabel}>Tours</Text>
          </View>
        </View>

        {breakdown.length > 1 && (
          <View style={styles.recapBreakdownWrap}>
            {/* Limité à 3 lignes : au-delà, le cadre repoussait les
                boutons hors de l'écran. */}
            {breakdown.slice(0, 3).map((b) => (
              <View key={b.name} style={styles.recapBreakdownRow}>
                <Text style={styles.recapBreakdownName} numberOfLines={1}>{b.emoji} {b.name}</Text>
                <Text style={styles.recapBreakdownValue}>{b.dmg}</Text>
              </View>
            ))}
          </View>
        )}
      </ImageBackground>

        <View style={styles.resultBtnCol}>
          {isWin && (
            <TouchableOpacity style={[styles.resultBtn, styles.resultBtnNext]} onPress={onNextLevel}>
              <Text style={styles.resultBtnText}>⚔️ Niveau suivant</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.resultBtn} onPress={onContinue}>
            <Text style={styles.resultBtnText}>Retour à la carte</Text>
          </TouchableOpacity>
          {!isWin && <Text style={styles.resultSubtitle}>Rien n'est perdu.</Text>}
        </View>
      </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#7ec8f0' },

  // Voile très léger : le décor de prairie est clair, l'ancien voile
  // (calé sur un fond violet uni) l'aurait éteint. Juste assez pour que
  // le texte blanc des barres reste lisible.
  bgDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,10,20,0.12)' },

  closeBtn: {
    position: 'absolute', zIndex: 30, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  sprite: { position: 'absolute', alignItems: 'center', zIndex: 5 },
  // Simple conteneur de centrage : plus aucune bordure. Les anneaux
  // autour des créatures ont été retirés (demande du 11/09), la cible
  // est désormais signalée par une flèche au-dessus d'elle.
  spriteRing: { alignItems: 'center', justifyContent: 'center' },
  targetArrow: {
    color: '#ffcf3f', fontSize: 26, fontWeight: '900', marginBottom: -4,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4,
  },

  ringActive: { borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.15)' },
  ringTarget: { borderColor: '#FF5252', backgroundColor: 'rgba(255,82,82,0.15)' },
  spriteName: {
    color: '#fff', fontWeight: '900', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  spriteHpTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.6)', overflow: 'hidden', marginTop: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  spriteHpFill: { height: '100%', borderRadius: 4 },
  spriteEndTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.6)', overflow: 'hidden', marginTop: 2 },
  spriteEndFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.action },

  // `pointerEvents` dans le STYLE, jamais en prop (voir Regles de
  // survie) : la prop est ignoree depuis le SDK 57. Cette couche couvre
  // TOUT l'ecran avec zIndex 10 — si elle intercepte les taps, plus
  // aucune creature du terrain n'est selectionnable. `box-none` = la
  // couche elle-meme ne recoit rien, ses enfants (bannieres, defi de
  // tap) restent cliquables.
  centerLayer: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
    pointerEvents: 'box-none',
  },
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
  // Idem : purement decoratif (les degats qui s'envolent), ne doit
  // jamais voler le tap destine au sprite en dessous.
  floatingDamageWrap: {
    position: 'absolute', top: -26, left: 0, right: 0,
    alignItems: 'center', zIndex: 15,
    pointerEvents: 'none',
  },
  floatingDamage: {
    color: '#FF5252', fontSize: 20, fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },

  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 },
  hintText: {
    color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'center', marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3,
  },
  // Barre alignée à DROITE et fond transparent : l'écran doit rester
  // épuré, le décor visible. Les boutons ne sont plus étirés sur toute
  // la largeur mais groupés en petits carrés.
  bottomBar: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingBottom: 8, paddingTop: 6, gap: 8,
    backgroundColor: 'transparent',
  },
  // Petit carré (demande du 11/09) plutôt qu'un bouton étiré : les
  // attaques se lisent d'un coup d'œil et laissent voir le terrain.
  skillBtn: {
    width: 86, height: 86, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(16,26,38,0.92)',
    borderWidth: 1.5, borderColor: COLORS.action,
  },
  // Coup spécial : liseré doré pour qu'il se distingue au premier coup
  // d'œil des attaques ordinaires.
  skillBtnSpecial: { borderColor: '#f5c542', borderWidth: 2, backgroundColor: 'rgba(245,197,66,0.16)' },

  skillInfoBackdrop: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  skillInfoCard: {
    minWidth: 240, maxWidth: 380, padding: 16, borderRadius: 14,
    backgroundColor: '#101a26', borderWidth: 2, borderColor: '#f5c542',
    alignItems: 'center',
  },
  skillInfoName: { color: '#fff', fontSize: 16, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  skillInfoLine: { color: '#c8d6e5', fontSize: 12, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  skillInfoClose: {
    marginTop: 12, paddingVertical: 8, paddingHorizontal: 22, borderRadius: 10,
    backgroundColor: '#f5c542',
  },
  skillInfoCloseText: { color: '#0b0d16', fontSize: 13, fontWeight: '900' },

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

  // Ratio du bandeau conservé (1000x180) : `aspectRatio` plutôt qu'une
  // hauteur fixe, pour qu'il ne se déforme sur aucun écran.
  resultBanner: {
    width: '94%', maxWidth: 560, aspectRatio: 1000 / 180,
    alignItems: 'center', justifyContent: 'center',
  },
  resultBannerImg: { resizeMode: 'contain' },
  resultBannerText: {
    color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 5,
  },
  resultReward: { color: COLORS.action, fontSize: 15, fontWeight: '800', marginTop: 8 },
  resultSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },

  resultBtnNext: { backgroundColor: COLORS.good },
  recapBreakdownWrap: { marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(120,85,35,0.35)', paddingTop: 6 },
  resultBtn: { alignItems: 'center', backgroundColor: COLORS.panel, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border },
  resultBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },

  resultDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,10,0,0.18)' },
  // Défaite : voile sombre et froid par-dessus le même décor doré.
  resultDimLose: { backgroundColor: 'rgba(6,10,26,0.66)' },
  resultScrollView: { flex: 1, backgroundColor: 'transparent' },
  // Marges resserrées : il fallait faire défiler pour atteindre le
  // bouton de retour, alors que tout tient à l'écran une fois le gain
  // déplacé dans le cadre.
  resultScroll: { flexGrow: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  rewardBadge: {
    alignSelf: 'center', marginBottom: 10, paddingVertical: 6, paddingHorizontal: 18,
    borderRadius: 20, backgroundColor: 'rgba(90,55,10,0.14)',
    borderWidth: 1.5, borderColor: COLORS.action,
  },
  rewardBadgeText: { color: '#6b4410', fontSize: 16, fontWeight: '900' },
  // Marges calées sur la bordure MESURÉE du cadre (10% / 15%) : sans
  // elles, le contenu passerait sous les dorures.
  resultBody: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%', maxWidth: 700, marginTop: 4,
  },
  // Marges généreuses : la bordure du cadre mange 10% en largeur et 15%
  // en hauteur, et la hauteur étant pilotée par le contenu, un
  // pourcentage vertical serait résolu sur la LARGEUR (règle 13).
  recapCard: {
    flex: 1, minWidth: 0,
    paddingHorizontal: 42, paddingVertical: 34,
  },
  resultBtnCol: { width: 168, gap: 10 },
  recapCardImg: { resizeMode: 'stretch' },
  recapTitle: { color: '#6b4410', fontSize: 13, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  recapRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  recapStat: { alignItems: 'center', flex: 1, minWidth: 0 },
  recapStatValue: { color: '#3d2609', fontSize: 17, fontWeight: '900' },
  recapStatLabel: { color: '#7a5a2e', fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  recapBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  recapBreakdownName: { color: '#4a2f10', fontSize: 12, fontWeight: '700' },
  recapBreakdownValue: { color: '#8a5a12', fontSize: 12, fontWeight: '800' },
});

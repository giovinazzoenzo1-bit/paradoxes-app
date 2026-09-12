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
import { Ionicons } from '@expo/vector-icons';
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
  elementMultiplier,
  elementRelation,
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
  // Attaque choisie mais PAS encore lancée : elle attend que le joueur
  // désigne sa cible.
  const [lastExchange, setLastExchange] = useState(null);
  const [armedSkill, setArmedSkill] = useState(null);
  // Rebond de la flèche de visée. Ne tourne QUE quand une attaque est
  // armée : rien ne s'anime en fond le reste du temps.
  const arrowBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!armedSkill) { arrowBounce.setValue(0); return undefined; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBounce, { toValue: -9, duration: 380, useNativeDriver: true }),
        Animated.timing(arrowBounce, { toValue: 0, duration: 380, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [armedSkill]);
  const armedSkillRef = useRef(null);
  armedSkillRef.current = armedSkill;
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
  // { amount, index } — l'INDICE est figé au moment du coup. Relu via
  // `activeIndex` à l'affichage, il désignait le combattant SUIVANT
  // (même piège que l'élan d'attaque), donc le chiffre des dégâts reçus
  // n'apparaissait pas sur la créature touchée.
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
    const defender = fightersRef.current[activeIndexRef.current];
    const oppDamage = Math.max(1, Math.round(
      (oppSkill.isBasic ? oppSkill.damage : scaledSkillDamage(oppSkill, opp.creature, opp.stats.attack))
      * elementMultiplier(opp.creature.element, defender.creature.element)
    ));

    const curIdx = activeIndexRef.current;
    const curFighter = fightersRef.current[curIdx];
    const newPlayerHp = Math.max(0, curFighter.hp - oppDamage);
    const newFighters = fightersRef.current.map((f, i) => (i === curIdx ? { ...f, hp: newPlayerHp } : f));
    fightersRef.current = newFighters;
    setFighters(newFighters);

    setRoundKey((k) => k + 1);
    setOpponentDamageFloat(null);
    setPlayerDamageFloat(oppDamage > 0 ? { amount: oppDamage, index: curIdx } : null);
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
    // Une attaque armée part sur la cible qu'on vient de désigner.
    // `targetIndexRef` est mis à jour ICI, sans attendre le rendu :
    // `launchArmedSkill` le lit tout de suite et taperait sinon
    // l'ancienne cible.
    if (armedSkillRef.current) {
      targetIndexRef.current = idx;
      launchArmedSkill();
    }
  };

  // Choisir une attaque l'ARME seulement : elle ne part plus tout de
  // suite (demande du 12/09). L'enchaînement est désormais
  // attaque -> cible -> défi de tap, ce qui laisse le temps de lire la
  // description et de viser.
  const chooseSkill = (skill, isBasic) => {
    if (phase !== 'choosing') return;
    const cost = isBasic ? 0 : (skill.manaCost || 0);
    // Le spécial exige la jauge PLEINE, pas seulement d'avoir le coût :
    // c'est ce qui en fait un moment attendu plutôt qu'une attaque de plus.
    if (skill.special && activeFighter.mana < MANA_MAX) return;
    if (activeFighter.mana < cost) return;
    setArmedSkill({ ...skill, isBasic });
  };

  // Lance réellement l'attaque armée, une fois la cible confirmée. Le
  // mana n'est débité QU'ICI : armer puis changer d'avis ne doit rien
  // coûter.
  const launchArmedSkill = () => {
    const skill = armedSkillRef.current;
    if (!skill || phase !== 'choosing') return;
    const cost = skill.isBasic ? 0 : (skill.manaCost || 0);
    setFighters((prev) => prev.map((f, i) => (i === activeIndex ? { ...f, mana: f.mana - cost } : f)));
    selectedSkillRef.current = skill;
    setSelectedSkill(skill);
    setArmedSkill(null);
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
    // Affinité élémentaire : +30% si l'attaquant domine l'élément de sa
    // cible, -25% s'il y est vulnérable.
    const elemMult = elementMultiplier(curFighter.creature.element, opp.creature.element);
    const playerDamage = Math.max(1, Math.round(computePlayerDamage(skillDamage, multiplier) * elemMult));

    // ATTAQUE DE ZONE : frappe TOUS les adversaires encore debout.
    // Elle n'était jusqu'ici qu'une étiquette sur le bouton — le code
    // qui frappe plusieurs cibles n'existait pas (bug du 12/09).
    const newOpponentHp = Math.max(0, opp.hp - playerDamage);
    let newOpponents = opponentsRef.current.map((o, i) => {
      if (skill.aoe) {
        return o.hp > 0 ? { ...o, hp: Math.max(0, o.hp - playerDamage) } : o;
      }
      return i === targetIdx ? { ...o, hp: newOpponentHp } : o;
    });

    // RIPOSTE : c'est l'adversaire ciblé qui riposte s'il survit, SINON
    // le premier encore debout.
    //
    // Avant, la riposte était conditionnée à la survie de la cible : le
    // joueur tuant souvent en un coup, l'équipe adverse ne frappait
    // presque jamais (2 dégâts reçus en 3 tours sur un combat réel).
    // C'était la vraie cause du déséquilibre, bien plus que la valeur
    // des dégâts.
    let opponentDamage = 0;
    const retaliatorIdx = newOpponents[targetIdx] && newOpponents[targetIdx].hp > 0
      ? targetIdx
      : newOpponents.findIndex((o) => o.hp > 0);
    if (retaliatorIdx >= 0) {
      const retaliator = newOpponents[retaliatorIdx];
      const oppSkill = pickOpponentSkill({ ...retaliator, mana: Math.min(MANA_MAX, retaliator.mana + MANA_PER_TURN) });
      newOpponents = newOpponents.map((o, i) =>
        i === retaliatorIdx ? { ...o, mana: Math.max(0, o.mana - (oppSkill.manaCost || 0)) } : o
      );
      const rawOppDamage = oppSkill.isBasic
        ? oppSkill.damage
        : scaledSkillDamage(oppSkill, retaliator.creature, retaliator.stats.attack);
      opponentDamage = Math.max(1, Math.round(
        rawOppDamage * elementMultiplier(retaliator.creature.element, curFighter.creature.element)
      ));
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
    setLastExchange({
      dealt: playerDamage,
      taken: opponentDamage,
      hpAfter: newPlayerHp,
      hpMax: curFighter.stats.hp,
    });

    // Dégâts flottants au-dessus de CHAQUE créature touchée (demande
    // explicite) — purement décoratif, la suite du combat ne les attend
    // jamais.
    setRoundKey((k) => k + 1);
    setOpponentDamageFloat(playerDamage);
    setPlayerDamageFloat(opponentDamage > 0 ? { amount: opponentDamage, index: curIdx } : null);
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
        {/* Flèche de visée : n'apparaît QUE lorsqu'une attaque est
            armée — avant le choix, elle n'indique rien d'utile. Elle
            rebondit pour être repérable au premier coup d'œil. */}
        {ring === 'target' && !fainted && armedSkill && (
          <Animated.View style={{ transform: [{ translateY: arrowBounce }] }}>
            <Ionicons name="arrow-down" size={34} color="#ffcf3f" style={styles.targetArrow} />
          </Animated.View>
        )}
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
            <View style={[styles.spriteEndFill, mana >= manaMax && styles.spriteEndFull, { width: `${Math.max(0, Math.min(1, mana / manaMax)) * 100}%` }]} />
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
          // Jauge visible pour TOUS : le joueur doit voir laquelle de
          // ses créatures approche de son ultime, pas seulement celle
          // qui joue.
          mana: f.mana, manaMax: MANA_MAX,
          fainted: f.hp <= 0, ring: fi === activeIndex ? 'active' : null, disabled: true, hpColor: COLORS.good,
          lunging: !!lunge && lunge.side === 'player' && fi === lunge.index, lungeDir: 1,
          floatDamage: playerDamageFloat && playerDamageFloat.index === fi ? playerDamageFloat.amount : null,
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
            <Animated.View style={{ transform: [{ scale: punchScale }] }}>
              <View style={styles.tapRing}>
                <Text style={styles.tapCountBig}>{tapCount}</Text>
                <Text style={styles.tapCountOf}>/ {requiredTaps}</Text>
              </View>
            </Animated.View>
            <View style={styles.timeTrack}>
              <View style={[styles.timeFill, { width: `${(timeLeft / TAP_CHALLENGE_TIME_LIMIT_SEC) * 100}%` }]} />
            </View>
          </>
        )}
      </View>

      {/* Détail de la dernière attaque choisie, en bandeau au-dessus
          des boutons — jamais une fenêtre bloquante : le combat ne doit
          pas s'interrompre pour lire une description. */}
      {skillInfo && (
        // Calé au-dessus du BOUTON pressé : les boutons font 86dp avec
        // 8dp d'écart et sont alignés à droite, donc le décalage depuis
        // le bord droit se déduit du rang du bouton.
        <View style={[styles.skillInfoCard, { right: 10 + (skillInfo.fromRight || 0) * 94 }]}>
          <Text style={styles.skillInfoName}>{skillInfo.name}</Text>
          {/* Une seule phrase : le panneau masquait un adversaire
              entier. Le coût est déjà lisible sur le bouton, inutile de
              le répéter ici. */}
          <Text style={styles.skillInfoLine}>
            {activeFighter.creature.stages[0].name} utilise {skillInfo.name} et inflige{' '}
            {skillInfo.damage} dégâts{skillInfo.aoe ? ' à TOUS les ennemis' : ''}.
          </Text>
          {/* Affinité contre la cible VISÉE : l'information n'a de sens
              que face à un adversaire précis. */}
          {opponents[targetIndex] && (() => {
            const rel = elementRelation(activeFighter.creature.element, opponents[targetIndex].creature.element);
            if (rel === 'neutre') return null;
            return (
              <Text style={rel === 'fort' ? styles.elemStrong : styles.elemWeak}>
                {activeFighter.creature.element} {rel === 'fort' ? '▲ +30%' : '▼ −25%'} contre {opponents[targetIndex].creature.element}
              </Text>
            );
          })()}
        </View>
      )}

      {/* Pendant le défi, TOUT l'écran est tapable (demande du 12/09) :
          viser une petite zone au doigt pendant 25 taps chronométrés
          était inutilement pénible. Posée en absolu au-dessus du
          terrain, sous la barre du bas qui garde le chrono lisible. */}
      {phase === 'tapping' && (
        <TouchableOpacity
          style={styles.tapEverywhere}
          activeOpacity={1}
          onPress={handleTap}
        />
      )}

      {phase === 'choosing' && (
        <View style={[
          styles.bottomWrap,
          { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom },
          // Pendant le défi, la barre laisse PASSER les taps : elle est
          // au-dessus de la zone plein écran (zIndex 20 contre 8), donc
          // sans ça taper sur le compteur ne compterait pas.
          phase === 'tapping' && styles.bottomWrapPassThrough,
        ]}>
          {/* DIAGNOSTIC (12/09) : affiche le dernier échange chiffré.
              Le calcul donne ~35% de la barre par coup, l'utilisateur
              en voit « 2 mm » — impossible de trancher en lisant le
              code, donc on mesure à l'écran. À retirer une fois la
              cause trouvée. */}
          <Text style={styles.hintText}>
            {lastExchange
              ? `Tu as infligé ${lastExchange.dealt} · reçu ${lastExchange.taken} (PV ${lastExchange.hpAfter}/${lastExchange.hpMax})`
              : '▼ CHOIX DE COMPÉTENCE ▼'}
          </Text>
          <View style={styles.bottomBar}>
            {activeFighter.creature.skills
              // Le spécial reste INVISIBLE tant que la jauge n'est pas
              // pleine : afficher un bouton grisé qu'on ne peut pas
              // utiliser encombre l'écran sans rien apprendre.
              .filter((sk) => !sk.special || activeFighter.mana >= MANA_MAX)
              .map((skill, idx, arr) => {
              const cost = skill.manaCost || 0;
              // Le spécial exige la jauge PLEINE, pas seulement son coût.
              const canAfford = skill.special
                ? activeFighter.mana >= MANA_MAX
                : activeFighter.mana >= cost;
              return (
                <TouchableOpacity
                  key={skill.id}
                  style={[styles.skillBtn, skill.special && styles.skillBtnSpecial, armedSkill && armedSkill.id === skill.id && styles.skillBtnArmed, !canAfford && styles.skillBtnDisabled]}
                  // Un appui simple SÉLECTIONNE l'attaque ; un appui long
                  // affiche seulement son détail. Sans cette séparation,
                  // consulter une attaque reviendrait à la lancer.
                  // Appui simple : sélectionne ET affiche le détail. Il
                  // était auparavant sur appui LONG, que personne ne
                  // découvre — l'information n'était donc jamais vue.
                  onPress={() => { setSkillInfo({ ...skill, fromRight: arr.length - 1 - idx }); chooseSkill(skill, false); }}
                  disabled={!canAfford}
                >
                  <Text style={styles.skillBtnName} numberOfLines={2}>{skill.name}</Text>
                  <Text style={styles.skillBtnDamage}>
                    {skill.damage} dégâts{skill.aoe ? ' · ZONE' : ''}
                  </Text>
                  {/* Rien à afficher pour une attaque normale : elles
                      sont toutes gratuites, le préciser est du bruit.
                      Seul l'ultime annonce qu'il est spécial. */}
                  {skill.special && <Text style={styles.skillBtnCost}>SPÉCIAL</Text>}
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
    marginBottom: -4,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 5,
  },

  ringActive: { borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.15)' },
  ringTarget: { borderColor: '#FF5252', backgroundColor: 'rgba(255,82,82,0.15)' },
  spriteName: {
    color: '#fff', fontWeight: '900', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
  },
  spriteHpTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.6)', overflow: 'hidden', marginTop: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  spriteHpFill: { height: '100%', borderRadius: 4 },
  spriteEndTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.6)', overflow: 'hidden', marginTop: 2 },
  // Bleue : c'est la jauge de MANA. Une fois pleine, l'ultime se
  // débloque — la couleur doit la distinguer nettement de la vie.
  spriteEndFill: { height: '100%', borderRadius: 3, backgroundColor: '#3ec6f0' },
  spriteEndFull: { backgroundColor: '#7fe9ff' },

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
  bottomWrapPassThrough: { pointerEvents: 'none' },
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
  // Attaque ARMÉE : liseré vert vif, pour voir d'un coup d'œil laquelle
  // partira au prochain tap sur un adversaire.
  skillBtnArmed: { borderColor: '#7fffb0', borderWidth: 2.5, backgroundColor: 'rgba(127,255,176,0.14)' },

  // Zone de tap plein écran pendant le défi. zIndex sous la barre du
  // bas (12) pour ne pas masquer le compteur ni le chrono.
  tapEverywhere: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 8 },
  // Compteur rond à la place de l'emoji poing : lisible d'un coup d'œil
  // et cohérent avec le reste de l'interface.
  tapRing: {
    width: 108, height: 108, borderRadius: 54,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,20,30,0.72)',
    borderWidth: 4, borderColor: '#ffcf3f',
  },
  tapCountBig: {
    color: '#fff', fontSize: 38, fontWeight: '900', lineHeight: 42,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4,
  },
  tapCountOf: { color: '#ffcf3f', fontSize: 13, fontWeight: '800', marginTop: -2 },

  skillInfoCard: {
    position: 'absolute', right: 10, bottom: 104, zIndex: 12,
    maxWidth: 200, padding: 8, borderRadius: 10,
    backgroundColor: 'rgba(16,26,38,0.94)', borderWidth: 2, borderColor: '#f5c542',
    // Décoratif : ne doit jamais intercepter un tap destiné au terrain.
    pointerEvents: 'none',
  },
  skillInfoName: { color: '#ffd76a', fontSize: 12, fontWeight: '900', marginBottom: 3 },
  elemStrong: { color: '#7fffb0', fontSize: 10, fontWeight: '900', marginTop: 3 },
  elemWeak: { color: '#ff9b91', fontSize: 10, fontWeight: '900', marginTop: 3 },
  skillInfoLine: { color: '#e6eef7', fontSize: 10, fontWeight: '700', lineHeight: 14 },

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

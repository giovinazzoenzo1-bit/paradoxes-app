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
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert, useWindowDimensions, ImageBackground, Image, ScrollView } from 'react-native';
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
// Étoile de note, commune à toute l'appli (14/09).
const STAR_ICON = require('../../../assets/icons/star.png');
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
  starsForBattle,
  GUARDIAN_SHIELD_RATIO,
  coupSurGardien,
  riposteGardien,
  encaisser,
  degatsDuJoueur,
  guardianStatsCalibrees,
  prochainVivant as nextLivingIndex,
  premierVivant as firstLivingIndex,
  choisirRiposteur,
  riposteAdversaire,
  frapper,
  cibleDeRiposte,
  finDeTour,
  multiplicateurFureur,
  tapsAvecEtats,
  iconesEtats,
  MANA_DEPART,
  competencesAvecSort,
  lancerSort,
  modifierCoup,
  meilleureAttaque,
  SORTS,
  actionAdversaire,
  cibleDuJoueur,
  appliquerElixir,
  appliquerBaisse,
  niveauxManquants,
  presqueGagne,
  GUARDIAN_PHASE1_HP_LOSS,
  applyGuardianDamage,
  guardianStats,
} from '../../games/clicker/combatLogic';
import { GUARDIAN_BASE_LEVEL } from '../../games/clicker/incubatorLogic';

// Couleurs d'affinité, communes à la flèche de visée et aux pastilles.
const ELEM_COLORS = { fort: '#3ddc84', neutre: '#ffb340', faible: '#ff5a4a' };

const RECHARGE_PERCENT = 0.5; // "Recharge" (pub simulée) rend 50% de l'endurance max du combattant actif

// `nextLivingIndex` et `firstLivingIndex` viennent du moteur partagé
// (combatLogic : prochainVivant, premierVivant) — importés sous leur nom
// d'origine, les appels ne changent pas.

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


// `opponentOverride` : impose l'équipe adverse au lieu de la tirer du
// niveau. Sert au combat de Gardien, qui affronte TOUJOURS le Gardien et
// jamais une créature du roster prise au hasard.
// Le message court affiché quand un sort est lancé (« 🛡️ Bouclier +41
// sur Caraploof »). Affichage seulement : l'effet vient du moteur.
function messageDeSort(sortId, evenements, allies) {
  const s = SORTS[sortId];
  const nom = (i) => (allies[i] ? allies[i].creature.stages[0].name : '');
  const e = (evenements || []).find((x) => x.type === 'bouclier' || x.type === 'soin' || x.type === 'boost');
  if (sortId === 'bouclier' && e) return `${s.icone} Bouclier +${e.valeur} sur ${nom(e.cible)}`;
  if (sortId === 'soin' && e) return `${s.icone} Soin +${e.valeur} sur ${nom(e.cible)}`;
  if (sortId === 'boost' && e) return `${s.icone} Boost +35 % sur ${nom(e.cible)}`;
  return `${s.icone} ${s.nom} !`;
}

export default function CombatScreen({ team, levelNumber, onFinish, opponentOverride = null, skipResultScreen = false, guardianEggNumber = 0, guardianCalibrage = null, elixirActif = false, aideDefaite = null, filetBaisse = 0, premiereVictoire = true }) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const opponentTeamCreatures = useRef(opponentOverride || opponentTeamForLevel(levelNumber)).current;

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
      return { creature: member.creature, ownedLevel: member.ownedLevel, stats, hp: stats.hp, mana: MANA_DEPART, etats: {} };
    })
  );
  const [activeIndex, setActiveIndex] = useState(0);

  // ---- Combat de BOSS (le Gardien) ----
  //
  // Reconnu par `creature.boss`. Deux manches : la première s'arrête
  // quand il a perdu la moitié de ses PV, la seconde lui rend TOUT
  // (PV et bouclier) et va jusqu'à zéro.
  const isBoss = !!(opponentTeamCreatures[0] && opponentTeamCreatures[0].boss);
  const [bossPhase, setBossPhase] = useState(1);
  const [bossShield, setBossShield] = useState(0);
  const [phaseBreak, setPhaseBreak] = useState(false);
  const phaseAnim = useRef(new Animated.Value(0)).current;
  // Refs miroir : la résolution d'un tour lit ces valeurs hors du cycle
  // de rendu, un état React y serait en retard d'un tour.
  const bossShieldRef = useRef(0);
  bossShieldRef.current = bossShield;
  const bossPhaseRef = useRef(1);
  bossPhaseRef.current = bossPhase;

  // Passage à la manche 2 : animation, puis le gardien récupère TOUT.
  const startBossPhase2 = (maxHp) => {
    setPhaseBreak(true);
    phaseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(phaseAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.delay(520),
      Animated.timing(phaseAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start(() => {
      setPhaseBreak(false);
      setBossPhase(2);
      setBossShield(Math.round(maxHp * GUARDIAN_SHIELD_RATIO));
      setOpponents((prev) => prev.map((o, i) => (i === 0 ? { ...o, hp: maxHp } : o)));
      // La main revient au joueur : la manche 2 commence par son tour,
      // sinon il encaisse un coup gratuit juste après l'animation.
      setPhase('choosing');
      setArmedSkill(null);
    });
  };

  const [opponents, setOpponents] = useState(() =>
    opponentTeamCreatures.map((creature) => {
      // Le Gardien passe par `guardianStats` : PV du PREMIER réduits de
      // 30 %, dégâts relevés de 15 % à tous les niveaux.
      const statsBase = creature.boss
        // `eggNumber` : le Gardien frappe plus fort à partir du 5e œuf.
        // `guardianCalibrage` : le Gardien calé sur le deck du début de
        // l'œuf (combatLogic.calibrerGardien). Absent : l'ancien Gardien.
        ? (guardianCalibrage
          ? guardianStatsCalibrees(guardianStats(levelNumber, GUARDIAN_BASE_LEVEL, guardianEggNumber), guardianCalibrage)
          : guardianStats(levelNumber, GUARDIAN_BASE_LEVEL, guardianEggNumber))
        : statsForOpponentCreatureTyped(creature, levelNumber);
      // Élixir de faiblesse (shop diamant) : APRÈS le calibrage, adversaires
      // et Gardien −10 % — un avantage réel, que le calculateur ne voit pas.
      // Filet de sécurité (26/09) : après 3 / 5 / 7 défaites de suite sur ce
      // niveau, ennemis −20 / −40 / −60 % (AdventureScreen compte les défaites).
      const stats0 = filetBaisse > 0 ? appliquerBaisse(statsBase, filetBaisse) : statsBase;
      const stats = elixirActif ? appliquerElixir(stats0) : stats0;
      return { creature, stats, hp: stats.hp, mana: MANA_DEPART, etats: {} };
    })
  );
  // Tours de riposte, pour la Fureur (moteur des sorts, 24/09).
  const toursRef = useRef(0);
  // Bouclier initial : 40 % des PV max du gardien. Posé dans un effet
  // plutôt qu'à l'initialisation de l'état, parce qu'il dépend de stats
  // calculées juste au-dessus.
  useEffect(() => {
    if (!isBoss || !opponents[0]) return;
    setBossShield(Math.round(opponents[0].stats.hp * GUARDIAN_SHIELD_RATIO));
  }, [isBoss]);

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

  // ⚔️ RÈGLES DU COMBAT — DÉBUT (sous empreinte : auditGardienEmpreinte)
  // Ce passage porte ce que `simulerCombatGardien` (combatLogic) reproduit
  // pour calibrer le Gardien : premier coup, rotation, mana, relève sans
  // riposte. Le modifier change l'empreinte : le contrôle refuse le push
  // tant que la simulation n'a pas été revérifiée.
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
    // Élan de l'adversaire lancé ici, AVANT que les dégâts ne
    // s'affichent : sans ce décalage, le chiffre rouge apparaissait
    // pendant que la créature bougeait encore et on ne voyait pas qui
    // avait frappé (retour du 12/09).
    playLunge('opponent', 0);
    const curIdx = activeIndexRef.current;
    const curFighter = fightersRef.current[curIdx];
    // Gardien : riposte PARTAGÉE avec la simulation qui le calibre
    // (combatLogic.riposteGardien), attaque de zone comprise. Les autres
    // adversaires gardent leur tirage de compétence.
    const riposte0 = isBoss ? riposteGardien(opp.stats, fightersRef.current, curIdx) : null;
    let oppDamage;
    if (riposte0) {
      oppDamage = riposte0.degats[curIdx];
    } else {
      // Règle PARTAGÉE (combatLogic.riposteAdversaire) : sa mana gagnée est
      // GARDÉE (bug du 24/09 : elle ne l'était pas, et les adversaires ne
      // lançaient jamais leur spéciale).
      const r0 = riposteAdversaire(opp, curFighter);
      oppDamage = r0.degats;
      const avecMana = opponentsRef.current.map((o, i) => (i === targetIndexRef.current ? { ...o, mana: r0.mana } : o));
      opponentsRef.current = avecMana;
      setOpponents(avecMana);
    }
    // Résilience aussi sur CE chemin : l'adversaire qui ouvre le combat
    // pouvait tuer une créature que la rune aurait dû sauver.
    let newPlayerHp = Math.max(0, curFighter.hp - oppDamage);
    let resTriggered = false;
    const resPct0 = curFighter.stats.resiliencePct || 0;
    if (newPlayerHp <= 0 && resPct0 > 0 && !curFighter.resilienceUsed) {
      newPlayerHp = Math.max(1, Math.round(curFighter.stats.hp * resPct0));
      resTriggered = true;
    }
    // Zone : les autres créatures encaissent leur part (Résilience comprise).
    const newFighters = fightersRef.current.map((f, i) => {
      if (i === curIdx) return { ...f, hp: newPlayerHp, resilienceUsed: f.resilienceUsed || resTriggered };
      const d = riposte0 ? riposte0.degats[i] : 0;
      return d > 0 ? { ...f, ...encaisser(f, d) } : f;
    });
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
      fightersFainted: s.fightersFainted + newFighters.filter((f) => f.hp <= 0).length,
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
      setSwitchMessage(riposte0 && riposte0.zone
        ? "🌀 Le Gardien ouvre le combat sur toute l'équipe !"
        : "L'adversaire attaque en premier !");
    }
    setTimeout(() => setSwitchMessage(null), 2200);
    setPhase('choosing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Combat de Gardien : pas de récapitulatif de fin. On rend la main
  // tout de suite, la vraie récompense étant la créature qui éclot juste
  // après.
  //
  // ⚠️ Passe par un EFFET et non par le rendu : appeler `onFinish`
  // pendant le rendu déclencherait une mise à jour d'état du parent au
  // milieu du rendu de l'enfant. Et il est placé ICI, avec les autres
  // Hooks, donc AVANT le `if (phase === 'done')` — un Hook après un
  // retour anticipé a déjà fait planter l'appli une fois.
  const finDemandeeRef = useRef(false);
  useEffect(() => {
    if (!skipResultScreen || phase !== 'done' || finDemandeeRef.current) return;
    finDemandeeRef.current = true;
    onFinish(outcome, false, starsForBattle(battleStats, opponents.length));
  }, [skipResultScreen, phase, outcome]);

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
  const requiredTaps = tapsAvecEtats(activeFighter);

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
    // Un SORT n'est pas débité ici : `lancerSort` (moteur) le paie à la
    // résolution — sinon il le serait deux fois.
    const cost = skill.isBasic || skill.sort ? 0 : (skill.manaCost || 0);
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

  // Le tirage de compétence adverse vit dans le moteur partagé
  // (combatLogic.riposteAdversaire), utilisé aussi par les simulations.

  const finishChallenge = (completed) => {
    if (challengeDoneRef.current) return;
    challengeDoneRef.current = true;
    playLunge('player', activeIndexRef.current);
    const elapsedSec = (Date.now() - challengeStartRef.current) / 1000;
    const skill = selectedSkillRef.current;
    const curIdx = activeIndexRef.current;
    const curFighter = fightersRef.current[curIdx];
    // Un ennemi qui PROVOQUE impose la cible (moteur : cibleDuJoueur).
    const targetIdx = cibleDuJoueur(opponentsRef.current, targetIndexRef.current);
    if (targetIdx >= 0 && targetIdx !== targetIndexRef.current) {
      targetIndexRef.current = targetIdx;
      setTargetIndex(targetIdx);
      if ((opponentsRef.current[targetIdx].etats || {}).provocation > 0) {
        setSwitchMessage(`🔱 ${opponentsRef.current[targetIdx].creature.stages[0].name} provoque !`);
        setTimeout(() => setSwitchMessage(null), 1500);
      }
    }
    const opp = opponentsRef.current[targetIdx];

    // Rune de Célérité : bonus ADDITIF sur le multiplicateur, sur TOUTES
    // les attaques (12/09). L'ancienne exception « sauf attaque de base »
    // n'avait plus lieu d'être : les attaques régulières coûtent toutes
    // 0 mana (SKILL_MANA_COSTS = [0,0,0]), seul l'ultime consomme la
    // jauge, et côté joueur `chooseSkill(skill, false)` est le seul appel
    // — la branche `isBasic` ne pouvait donc jamais se produire.
    const multiplier = damageMultiplierForTime(elapsedSec, completed) + (curFighter.stats.dmgMultBonus || 0);
    const skillDamage = skill.isBasic ? skill.damage : scaledSkillDamage(skill, curFighter.creature, curFighter.stats.attack);
    // Affinité élémentaire : +30% si l'attaquant domine l'élément de sa
    // cible, -25% s'il y est vulnérable.
    const elemMult = elementMultiplier(
      curFighter.creature.element, opp.creature.element, curFighter.stats.affinityBonus || 0
    );
    // ---- SORTS (étape 3b, 24/09) -----------------------------------------
    // Un sort passe par le MOTEUR : `lancerSort` paie le mana (la
    // confirmation ne l'a pas débité), applique l'effet (bouclier, soin,
    // venin, boost, marque, provocation, vitesse…) et dit ce que la créature
    // frappe ENSUITE : rien, une part d'un coup normal, ou une zone. Tous les
    // coups passent par `frapper` / `modifierCoup` : sans état en cours,
    // exactement les dégâts d'avant.
    let coupSort = { part: 1 };
    if (skill.sort) {
      const r = lancerSort(skill.sort, fightersRef.current, curIdx, opponentsRef.current, targetIdx);
      coupSort = r.coup;
      fightersRef.current = r.allies;
      setFighters(r.allies);
      opponentsRef.current = r.ennemis;
      setOpponents(r.ennemis);
      setSwitchMessage(messageDeSort(skill.sort, r.evenements, r.allies));
      setTimeout(() => setSwitchMessage(null), 1800);
    }
    let attaquant = fightersRef.current[curIdx];
    // Ce que frappe un sort offensif : l'attaque normale la plus forte.
    const frappe = skill.sort ? meilleureAttaque(attaquant.creature) : skill;
    const part = coupSort ? (coupSort.zone || coupSort.part || 1) : 0;
    // Règle PARTAGÉE avec la simulation qui calibre le Gardien.
    const coupSur = (cible) => (part > 0 && frappe
      ? Math.max(1, Math.round(degatsDuJoueur(frappe, attaquant, cible.creature, elapsedSec, completed) * part))
      : 0);
    let playerDamage = 0;
    let degatsTotaux = 0;
    let newOpponentHp;
    let newOpponents;
    const cibleActuelle = opponentsRef.current[targetIdx];
    if (isBoss) {
      let bossApres = cibleActuelle;
      const brut = coupSur(cibleActuelle);
      if (brut > 0) {
        const m = modifierCoup(attaquant, cibleActuelle, brut);
        attaquant = m.attaquant;
        bossApres = m.defenseur;
        playerDamage = m.degats;
      }
      degatsTotaux = playerDamage;
      fightersRef.current = fightersRef.current.map((x, i) => (i === curIdx ? attaquant : x));
      setFighters(fightersRef.current);
      // Règle PARTAGÉE (combatLogic.coupSurGardien) : bouclier d'abord,
      // plancher de la manche 1, relève à PV pleins avec un nouveau
      // bouclier (posé par startBossPhase2, mêmes valeurs).
      const maxHp = cibleActuelle.stats.hp;
      const coup = coupSurGardien(
        { hp: cibleActuelle.hp, shield: bossShieldRef.current, phase: bossPhaseRef.current, maxHp }, playerDamage);
      if (coup.releve) {
        setBossShield(0);
        startBossPhase2(maxHp);
        return;
      }
      newOpponentHp = coup.hp;
      setBossShield(coup.shield);
      newOpponents = opponentsRef.current.map((o, i) => (i === targetIdx ? { ...bossApres, hp: newOpponentHp } : o));
    } else {
      newOpponents = opponentsRef.current.slice();
      if (part > 0) {
        // Zone : chaque ennemi vivant, UN SEUL boost consommé ; l'attaquant
        // d'AVANT sert à tous les coups (un boost à sa dernière attaque
        // ne doit pas manquer aux coups 2 et 3) ; un ennemi venimeux touché
        // empoisonne l'attaquant.
        const cibles = coupSort && coupSort.zone
          ? newOpponents.map((_, i) => i).filter((i) => newOpponents[i].hp > 0)
          : [targetIdx];
        const base = attaquant;
        let apres = attaquant;
        cibles.forEach((i, k) => {
          const x = frapper(base, newOpponents[i], coupSur(newOpponents[i]), k === 0);
          if (k === 0) apres = x.attaquant;
          else if (x.attaquant.etats && x.attaquant.etats.poison && !(apres.etats && apres.etats.poison)) {
            apres = { ...apres, etats: { ...apres.etats, poison: x.attaquant.etats.poison } };
          }
          newOpponents[i] = x.defenseur;
          degatsTotaux += x.degats;
          if (i === targetIdx) playerDamage = x.degats;
        });
        attaquant = apres;
      }
      fightersRef.current = fightersRef.current.map((x, i) => (i === curIdx ? attaquant : x));
      setFighters(fightersRef.current);
      newOpponentHp = newOpponents[targetIdx].hp;
    }
    let opponentDamage = 0;
    const retaliatorIdx = choisirRiposteur(newOpponents, targetIdx);
    // ⚠️ MOTEUR DES SORTS (24/09) : la riposte frappe `cibleDeRiposte`
    // (provocation d'abord, évitement du venimeux — TOUJOURS une cible tant
    // qu'une créature vit), chaque coup passe par `frapper` (bouclier,
    // marque, provocation, venin, poison) avec la Fureur, puis `finDeTour`
    // (poison, compteurs) sur les deux équipes. Un K.O. peut toucher une
    // autre créature que l'active (zone, poison) : la suite lit `newFighters`.
    toursRef.current += 1;
    const fureur = multiplicateurFureur(toursRef.current);
    const avant = fightersRef.current;
    const tRip = cibleDeRiposte(avant, curIdx);
    let baseJ = avant; // nos créatures, après un éventuel sort ennemi (marque)
    let riposte = null;
    let degatsRiposte = [];
    if (isBoss && retaliatorIdx >= 0 && tRip >= 0) {
      riposte = riposteGardien(newOpponents[retaliatorIdx].stats, avant, tRip);
      degatsRiposte = riposte.degats;
    } else if (retaliatorIdx >= 0 && tRip >= 0) {
      // Le tour ennemi du MOTEUR (étape 4) : son sort s'il le décide, sinon
      // son attaque. Une marque a pu être posée sur une de nos créatures.
      const a = actionAdversaire(newOpponents, retaliatorIdx, avant, tRip);
      newOpponents = a.adversaires;
      baseJ = a.joueurs;
      degatsRiposte = a.degats;
      if (a.sort) {
        setSwitchMessage(`😈 ${newOpponents[retaliatorIdx].creature.stages[0].name} lance ${SORTS[a.sort].icone} ${SORTS[a.sort].nom} !`);
        setTimeout(() => setSwitchMessage(null), 1800);
      }
    }
    let riposteur = retaliatorIdx >= 0 ? newOpponents[retaliatorIdx] : null;
    opponentDamage = 0;
    let newFighters = baseJ.map((f, i) => {
      const dg = degatsRiposte[i] || 0;
      if (dg <= 0 || !riposteur) return f;
      const x = frapper(riposteur, f, dg * fureur, i === tRip);
      riposteur = x.attaquant;
      if (i === tRip) opponentDamage = x.degats;
      return x.defenseur;
    });
    if (riposteur) newOpponents = newOpponents.map((o, i) => (i === retaliatorIdx ? riposteur : o));
    newFighters = finDeTour(newFighters).equipe;
    newOpponents = finDeTour(newOpponents).equipe;
    opponentsRef.current = newOpponents;
    setOpponents(newOpponents);
    if (!(newOpponents[targetIdx] && newOpponents[targetIdx].hp > 0)) {
      const nextTarget = firstLivingIndex(newOpponents);
      if (nextTarget !== -1 && nextTarget !== targetIdx) {
        targetIndexRef.current = nextTarget;
        setTargetIndex(nextTarget);
      }
    }
    const newPlayerHp = newFighters[curIdx].hp;
    const tombes = newFighters.filter((f, i) => f.hp <= 0 && avant[i].hp > 0).length;
    if (riposte && riposte.zone) setSwitchMessage("🌀 Le Gardien frappe toute l'équipe !");
    fightersRef.current = newFighters;
    setFighters(newFighters);
    setLastExchange({
      dealt: playerDamage,
      taken: opponentDamage,
      hpAfter: newFighters[tRip >= 0 ? tRip : curIdx].hp,
      hpMax: newFighters[tRip >= 0 ? tRip : curIdx].stats.hp,
    });

    // Dégâts flottants au-dessus de CHAQUE créature touchée (demande
    // explicite) — purement décoratif, la suite du combat ne les attend
    // jamais.
    setRoundKey((k) => k + 1);
    setOpponentDamageFloat(playerDamage > 0 ? playerDamage : null);
    setPlayerDamageFloat(opponentDamage > 0 ? { amount: opponentDamage, index: tRip >= 0 ? tRip : curIdx } : null);
    setBattleStats((s) => ({
      totalDamageDealt: s.totalDamageDealt + degatsTotaux,
      totalDamageTaken: s.totalDamageTaken + opponentDamage,
      rounds: s.rounds + 1,
      opponentsDefeated: s.opponentsDefeated + (newOpponentHp <= 0 ? 1 : 0),
      fightersFainted: s.fightersFainted + tombes,
      perFighterDamage: {
        ...s.perFighterDamage,
        [curFighter.creature.id]: (s.perFighterDamage[curFighter.creature.id] || 0) + degatsTotaux,
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

  // ⚔️ RÈGLES DU COMBAT — FIN
  const confirmQuit = () => {
    Alert.alert('Quitter le combat ?', 'Tu ne gagneras aucune récompense et reviendras à la carte.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => onFinish('quit') },
    ]);
  };

  if (phase === 'done') {
    // L'effet ci-dessus a déjà rendu la main : on n'affiche rien plutôt
    // qu'un récapitulatif qui clignoterait une frame.
    if (skipResultScreen) return null;
    return (
      <CombatResultScreen
        outcome={outcome}
        levelNumber={levelNumber}
        battleStats={battleStats}
        opponentCount={opponents.length}
        nbCreatures={(team || []).filter(Boolean).length}
        onContinue={() => onFinish(outcome, false, starsForBattle(battleStats, opponents.length))}
        onNextLevel={() => onFinish(outcome, true, starsForBattle(battleStats, opponents.length))}
        aide={aideDefaite}
        manque={outcome === 'lose' ? niveauxManquants(team, levelNumber) : 0}
        presque={outcome === 'lose' && presqueGagne(opponents)}
        premiereVictoire={premiereVictoire}
      />
    );
  }

  // Ordre d'affichage côté joueur : l'actif prend TOUJOURS la place de
  // devant (slot 0), les autres remplissent les slots 1 et 2.
  const playerOrder = [activeIndex, ...fighters.map((_, i) => i).filter((i) => i !== activeIndex)];

  // Dégâts AFFICHÉS d'une attaque, à l'échelle du niveau du combattant.
  // Utilisée par le bouton ET par le panneau de détail : deux calculs
  // séparés finiraient tôt ou tard par se contredire.
  const degatsAffiches = (skill) => Math.max(1, Math.round(
    skill.isBasic
      ? skill.damage
      : scaledSkillDamage(skill, activeFighter.creature, activeFighter.stats.attack)
  ));

  const renderSprite = ({ key, slot, creatureId, stageIndex, emoji, name, hp, hpMax, mana, manaMax, fainted, ring, onPress, disabled, hpColor, floatDamage, lunging, lungeDir, elemColor , etats = null, etatsCote = 'droite' }) => {
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
        {/* Pastille d'affinité sur CHAQUE adversaire, cible comprise.
            La flèche a été retirée (12/09) : elle doublait l'information
            et n'apparaissait que sur la cible, alors que le joueur doit
            pouvoir COMPARER avant de frapper. La cible reste identifiée
            par sa pastille agrandie. */}
        {elemColor && !fainted && (
          <View style={[styles.elemDot, ring === 'target' && styles.elemDotTarget, { backgroundColor: elemColor }]} />
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
        {/* Barre de PV + ligne d'états (bonus / malus) à DROITE pour nos
            créatures, à GAUCHE pour les adversaires — demande de l'auteur
            (24/09) ; emojis en attendant ses logos. En absolu : ne décale
            rien dans la mise en page. */}
        <View style={{ width: Math.round(90 * slot.size) }}>
          <View style={[styles.spriteHpTrack, { width: Math.round(90 * slot.size) }]}>
            <View style={[styles.spriteHpFill, { width: `${Math.max(0, hp / hpMax) * 100}%`, backgroundColor: hpColor }]} />
          </View>
          {etats && etats.length > 0 && (
            <Text style={[styles.spriteEtats, etatsCote === 'gauche' ? styles.spriteEtatsGauche : styles.spriteEtatsDroite]} numberOfLines={1}>
              {etats.map((e) => e.icone + e.texte).join(' ')}
            </Text>
          )}
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
      {elixirActif && (
        <View style={[styles.elixirBadge, { top: insets.top + 6 }]} pointerEvents="none">
          <Text style={styles.elixirBadgeText}>🧪 Élixir : ennemis −10 %</Text>
        </View>
      )}
      {filetBaisse > 0 && (
        <View style={[styles.elixirBadge, styles.filetBadge, { top: insets.top + (elixirActif ? 34 : 6) }]} pointerEvents="none">
          <Text style={styles.elixirBadgeText}>🛟 Coup de pouce : ennemis −{Math.round(filetBaisse * 100)} %</Text>
        </View>
      )}

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
          etats: iconesEtats(f), etatsCote: 'droite',
          fainted: f.hp <= 0, ring: fi === activeIndex ? 'active' : null, disabled: true, hpColor: COLORS.good,
          lunging: !!lunge && lunge.side === 'player' && fi === lunge.index, lungeDir: 1,
          floatDamage: playerDamageFloat && playerDamageFloat.index === fi ? playerDamageFloat.amount : null,
        });
      })}

      {/* BOSS : barre de vie pleine largeur tout en haut, bouclier juste
          en dessous. Posée en absolu au-dessus du terrain pour occuper
          vraiment toute la largeur, indépendamment de la mise en page
          du combat. */}
      {isBoss && opponents[0] && (
        <View style={[styles.bossBarWrap, { paddingLeft: insets.left + 10, paddingRight: insets.right + 10 }]}>
          <View style={styles.bossBarHeader}>
            <Text style={styles.bossBarName}>🐯 GARDIEN</Text>
            <Text style={styles.bossBarPhase}>Manche {bossPhase}/2</Text>
          </View>
          <View style={styles.bossHpTrack}>
            <View style={[styles.bossHpFill, { width: `${Math.max(0, (opponents[0].hp / opponents[0].stats.hp) * 100)}%` }]} />
            {/* Repère de mi-parcours : montre où s'arrête la manche 1. */}
            {bossPhase === 1 && <View style={styles.bossHpHalfMark} />}
          </View>
          <View style={styles.bossShieldTrack}>
            <View style={[styles.bossShieldFill, {
              width: `${Math.max(0, (bossShield / Math.max(1, Math.round(opponents[0].stats.hp * GUARDIAN_SHIELD_RATIO))) * 100)}%`,
            }]} />
          </View>
          {/* ⚠️ OUTIL DE TEST — gagne le combat immédiatement.
              Le combat de Gardien est le passage le plus long de la
              boucle d'œuf : sans ce raccourci, vérifier un défi situé
              après lui demande de le refaire en entier à chaque essai.
              Demandé par l'auteur le 20/09 pour « vite valider les œufs
              et tester en profondeur ».
              ⚠️ On vide les PV et le bouclier AVANT de déclarer la
              victoire, au lieu de sauter directement à l'issue : les
              récompenses et l'affichage lisent l'état des adversaires,
              et un Gardien déclaré mort mais encore à pleine vie les
              ferait mentir.
              ⚠️ À retirer avec les autres outils de dev avant la
              sortie. */}
          {phase !== 'done' && (
            <TouchableOpacity
              style={styles.devWinBtn}
              onPress={() => {
                setOpponents((prev) => prev.map((o) => ({ ...o, hp: 0 })));
                setBossShield(0);
                setOutcome('win');
                setPhase('done');
              }}
            >
              <Text style={styles.devWinBtnText}>🛠️ Gagner le combat</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Transition entre les deux manches. */}
      {phaseBreak && (
        <Animated.View style={[styles.phaseBreakWrap, {
          opacity: phaseAnim,
          transform: [{ scale: phaseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }]}>
          <Text style={styles.phaseBreakText}>LE GARDIEN SE RELÈVE</Text>
          <Text style={styles.phaseBreakSub}>Il récupère ses forces</Text>
        </Animated.View>
      )}

      {/* Équipe adverse — tous tapables pour choisir la cible, à chaque
          tour (demande explicite), pas seulement une fois par combat. */}
      {opponents.map((o, i) => {
        // `stages[0]` : le Gardien n'a qu'une apparence, les créatures en
        // ont trois — l'index 0 est valide dans les deux cas.
        const d = o.creature.stages[0];
        const fainted = o.hp <= 0;
        return renderSprite({
          key: `o${i}`,
          // Le boss est plus imposant : emplacement recentré et agrandi
          // de 70 %, pour qu'il pèse à l'écran au lieu de ressembler à
          // une créature ordinaire.
          slot: isBoss ? { x: 0.72, y: 0.46, size: 1.7 } : OPPONENT_SLOTS[i],
          creatureId: o.creature.id, stageIndex: 0,
          emoji: d.emoji, name: d.name,
          hp: o.hp, hpMax: o.stats.hp, fainted,
          etats: iconesEtats(o), etatsCote: 'gauche',
          ring: i === targetIndex && !fainted ? 'target' : null,
          // Vert = ton élément domine le sien, orange = neutre, rouge =
          // tu es en position défavorable.
          elemColor: ELEM_COLORS[elementRelation(activeFighter.creature.element, o.creature.element)],
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
      {skillInfo && armedSkill && (
        // Calé au-dessus du BOUTON pressé : les boutons font 86dp avec
        // 8dp d'écart et sont alignés à droite, donc le décalage depuis
        // le bord droit se déduit du rang du bouton.
        <View style={[styles.skillInfoCard, { right: 10 + (skillInfo.fromRight || 0) * 80 }]}>

          {/* Une seule phrase : le panneau masquait un adversaire
              entier. Le coût est déjà lisible sur le bouton, inutile de
              le répéter ici. */}
          <Text style={styles.skillInfoLine}>
            {activeFighter.creature.stages[0].name} utilise {skillInfo.name} et inflige{' '}
            {skillInfo.sort ? `${SORTS[skillInfo.sort].desc} · ${skillInfo.manaCost} mana` : `${degatsAffiches(skillInfo)} dégâts`}.
          </Text>
          {/* L'affinité est lue sur les PASTILLES colorées des
              adversaires, pas répétée ici. */}
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
              : ''}
          </Text>
          <View style={styles.bottomBar}>
            {competencesAvecSort(activeFighter.creature)
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
                  style={[styles.skillBtn, !canAfford && styles.skillBtnOff, skill.special && styles.skillBtnSpecial, armedSkill && armedSkill.id === skill.id && styles.skillBtnArmed, !canAfford && styles.skillBtnDisabled]}
                  // Un appui simple SÉLECTIONNE l'attaque ; un appui long
                  // affiche seulement son détail. Sans cette séparation,
                  // consulter une attaque reviendrait à la lancer.
                  // Appui simple : sélectionne ET affiche le détail. Il
                  // était auparavant sur appui LONG, que personne ne
                  // découvre — l'information n'était donc jamais vue.
                  onPress={() => { setSkillInfo({ ...skill, fromRight: arr.length - 1 - idx }); chooseSkill(skill, false); }}
                  disabled={!canAfford}
                >
                  <Text style={styles.skillBtnName} numberOfLines={2}>{skill.sort ? `${skill.icone} ${skill.name}` : skill.name}</Text>
                  {/* ⚠️ Dégâts MIS À L'ÉCHELLE du niveau, pas la valeur de
                      base. Le bouton affichait `skill.damage` brut : une
                      créature niveau 20 annonçait donc les mêmes chiffres
                      qu'au niveau 1, alors qu'elle frappe bien plus fort.
                      On réutilise `scaledSkillDamage`, la FONCTION MÊME
                      qui sert au calcul du coup — impossible que
                      l'affichage et les dégâts divergent. */}
                  <Text style={styles.skillBtnDamage}>
                    {skill.sort ? SORTS[skill.sort].desc : `${degatsAffiches(skill)} dégâts`}
                  </Text>
                  {/* Rien à afficher pour une attaque normale : elles
                      sont toutes gratuites, le préciser est du bruit.
                      Seul l'ultime annonce qu'il est spécial. */}
                  {skill.special && <Text style={styles.skillBtnCost}>SPÉCIAL</Text>}
                  {skill.sort && <Text style={styles.skillBtnCost}>{skill.manaCost} mana</Text>}
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

// Délai avant que les boutons du récapitulatif deviennent actifs.
//
// ⚠️ Nécessaire parce que la zone de tap du combat couvre TOUT l'écran :
// au moment où le récapitulatif s'affiche, le doigt du joueur est encore
// en train de taper et tombe sur ce qui se trouve dessous. Déplacer les
// boutons ne suffit donc pas — aucune position ne sort de la zone.
//
// 700 ms : bloque ~4,7 taps résiduels même à la cadence d'un autoclic
// (6,7/s), tout en restant imperceptible pour qui veut vraiment appuyer.
const RESULT_BTN_GUARD_MS = 700;

function CombatResultScreen({ outcome, levelNumber, battleStats, opponentCount, onContinue, onNextLevel, aide = null, manque = 0, presque = false, premiereVictoire = true, nbCreatures = 3 }) {
  const isWin = outcome === 'win';
  const [btnsArmed, setBtnsArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setBtnsArmed(true), RESULT_BTN_GUARD_MS);
    return () => clearTimeout(id);
  }, []);
  const stars = isWin ? starsForBattle(battleStats, opponentCount) : 0;
  const reward = isWin ? griffesReward(levelNumber) : 0;

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
          <View style={styles.starsRow}>
            {[1, 2, 3].map((n) => (
              <Image
                key={n}
                source={STAR_ICON}
                style={[styles.star, n > stars && styles.starOff]}
                resizeMode="contain"
              />
            ))}
          </View>
        )}
        {isWin && (
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardBadgeText}>
              {premiereVictoire ? `+${reward} 🐾 Griffes` : 'Niveau déjà gagné : pas de Griffes'}
            </Text>
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

      </ImageBackground>

        <View style={styles.resultBtnCol}>
          {isWin && (
            <TouchableOpacity
              style={[styles.resultBtn, styles.resultBtnNext, !btnsArmed && styles.resultBtnLocked]}
              onPress={onNextLevel}
              disabled={!btnsArmed}
            >
              <Text style={styles.resultBtnText}>⚔️ Niveau suivant</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.resultBtn, !btnsArmed && styles.resultBtnLocked]}
            onPress={onContinue}
            disabled={!btnsArmed}
          >
            <Text style={styles.resultBtnText}>Retour à la carte</Text>
          </TouchableOpacity>
          {!isWin && !aide && <Text style={styles.resultSubtitle}>Rien n'est perdu.</Text>}
          {/* ÉCRAN DE DÉFAITE (demande de l'auteur, 26/09) : comprendre
              pourquoi, et voir la solution tout de suite. « Presque » et
              le retard sont des calculs VRAIS (combatLogic). */}
          {!isWin && aide && (
            <View style={styles.aideBloc}>
              {presque && <Text style={styles.aidePresque}>🔥 Tu y étais presque !</Text>}
              <Text style={styles.aideDiag}>
                {manque > 0
                  ? `Il te manquait environ ${manque} niveau${manque > 1 ? 'x' : ''}.`
                  : 'Ton deck a la puissance conseillée : retente ta chance !'}
              </Text>
              {/* 26/09 (test de l'auteur) : une créature seule face à 2 ou 3
                  ennemis perd presque toujours (MESURÉ : 0 % au niveau 11) —
                  le calibrage suppose les œufs éclos. On le DIT. */}
              {nbCreatures > 0 && nbCreatures < opponentCount && (
                <Text style={styles.aideDiag}>
                  {`🥚 ${nbCreatures} créature${nbCreatures > 1 ? 's' : ''} contre ${opponentCount} adversaires : fais éclore ton prochain œuf.`}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.resultBtn, !btnsArmed && styles.resultBtnLocked]}
                disabled={!btnsArmed}
                onPress={() => { onContinue(); if (aide.onMonter) aide.onMonter(); }}
              >
                <Text style={styles.resultBtnText}>⬆️ Monter mes créatures</Text>
              </TouchableOpacity>
              {aide.onPackGriffes && (
                <TouchableOpacity style={[styles.resultBtn, !btnsArmed && styles.resultBtnLocked]} disabled={!btnsArmed} onPress={aide.onPackGriffes}>
                  <Text style={styles.resultBtnText}>🐾 Pack de Griffes · 💎 {aide.coutPack}</Text>
                </TouchableOpacity>
              )}
              {aide.onElixir && (
                <TouchableOpacity style={[styles.resultBtn, !btnsArmed && styles.resultBtnLocked]} disabled={!btnsArmed} onPress={aide.onElixir}>
                  <Text style={styles.resultBtnText}>🧪 Élixir de faiblesse · 💎 {aide.coutElixir}</Text>
                </TouchableOpacity>
              )}
              {aide.onVideoEnergie && aide.adsLeft > 0 && (
                <TouchableOpacity style={[styles.resultBtn, !btnsArmed && styles.resultBtnLocked]} disabled={!btnsArmed} onPress={aide.onVideoEnergie}>
                  <Text style={styles.resultBtnText}>📺 +1 énergie (vidéo)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  filetBadge: { backgroundColor: 'rgba(13,110,70,0.9)' },
  aideBloc: { gap: 8, marginTop: 4 },
  aidePresque: { color: '#FFB74D', fontWeight: '900', fontSize: 14, textAlign: 'center' },
  aideDiag: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  elixirBadge: { position: 'absolute', left: 10, zIndex: 20, backgroundColor: 'rgba(76,29,149,0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  elixirBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  skillBtnOff: { opacity: 0.35 },
  spriteEtats: { position: 'absolute', top: -5, fontSize: 10, color: '#fff', fontWeight: '700' },
  spriteEtatsDroite: { left: '100%', marginLeft: 4 },
  spriteEtatsGauche: { right: '100%', marginRight: 4 },
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
  elemDot: {
    width: 12, height: 12, borderRadius: 6, marginBottom: 2,
    
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.55)',
  },
  // Cible en cours : pastille agrandie et cerclée de blanc.
  elemDotTarget: { width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: '#fff' },

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
    width: 72, height: 72, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 3,
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

  // Semi-transparent (0,94 -> 0,62) et plus petit : il masquait les
  // adversaires placés derrière lui.
  skillInfoCard: {
    position: 'absolute', right: 10, bottom: 92, zIndex: 12,
    maxWidth: 160, padding: 6, borderRadius: 9,
    backgroundColor: 'rgba(16,26,38,0.62)', borderWidth: 1, borderColor: 'rgba(245,197,66,0.7)',
    // Décoratif : ne doit jamais intercepter un tap destiné au terrain.
    pointerEvents: 'none',
  },
  skillInfoLine: { color: '#e6eef7', fontSize: 10, fontWeight: '700', lineHeight: 14 },

  skillBtnDisabled: { borderColor: COLORS.border, opacity: 0.4 },
  skillBtnName: { color: COLORS.text, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  skillBtnDamage: { color: COLORS.action, fontSize: 10, fontWeight: '900', marginTop: 2 },
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
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 6 },
  // Image et non plus caractère : 28 dp, soit l'équivalent visuel de
  // l'ancienne police 26.
  star: { width: 28, height: 28 },
  // Étoile non gagnée : MÊME image recolorée en sombre.
  starOff: { tintColor: '#4a3a1c', opacity: 0.85 },

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
  // `alignSelf: 'flex-start'` : les boutons remontent en haut de la
  // rangée au lieu d'être centrés face au cadre — demande explicite, on
  // clique moins dessus par accident en fin de combat. Mesuré : ça les
  // remonte d'environ 45 dp.
  resultBtnCol: { width: 168, gap: 10, alignSelf: 'flex-start' },
  // Pendant le délai de garde : visiblement inactifs, pour que le joueur
  // comprenne que ça n'a pas été ignoré au hasard.
  resultBtnLocked: { opacity: 0.45 },

  // ---- Barre du Gardien ----
  //
  // Posée en ABSOLU en haut : elle doit occuper toute la largeur, quelle
  // que soit la mise en page du terrain. Mesuré : le bloc fait 55 dp de
  // haut et le sprite agrandi commence à 82 dp, donc aucun chevauchement.
  bossBarWrap: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 12,
    paddingTop: 6, paddingBottom: 6,
    backgroundColor: 'rgba(6,10,18,0.55)',
  },
  bossBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  bossBarName: { color: '#ffcf3f', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  bossBarPhase: { color: COLORS.muted, fontSize: 11, fontWeight: '800' },
  bossHpTrack: {
    height: 14, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', justifyContent: 'center',
  },
  bossHpFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#FF5252' },
  // Repère à 50 % : le joueur voit où s'arrête la manche 1.
  bossHpHalfMark: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.75)' },
  devWinBtn: {
    alignSelf: 'center', marginTop: 8,
    paddingVertical: 5, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1,
    borderColor: '#7a5cff', backgroundColor: 'rgba(122,92,255,0.18)',
  },
  devWinBtnText: { color: '#b3a0ff', fontSize: 11, fontWeight: '800' },
  bossShieldTrack: {
    height: 8, borderRadius: 4, marginTop: 3, backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(90,209,255,0.35)', overflow: 'hidden',
  },
  bossShieldFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#5ad1ff' },

  // Centré verticalement : l'animation est haute, un ancrage à 38 %
  // l'aurait fait déborder en bas.
  phaseBreakWrap: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    zIndex: 30, alignItems: 'center', justifyContent: 'center',
    // Purement décoratif : il couvre tout l'écran et ne doit surtout pas
    // capter de clics (règle de survie n°2).
    pointerEvents: 'none',
  },
  phaseBreakText: {
    color: '#ffcf3f', fontSize: 26, fontWeight: '900', letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 8,
  },
  phaseBreakSub: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  recapCardImg: { resizeMode: 'stretch' },
  recapTitle: { color: '#6b4410', fontSize: 13, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  recapRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  recapStat: { alignItems: 'center', flex: 1, minWidth: 0 },
  recapStatValue: { color: '#3d2609', fontSize: 17, fontWeight: '900' },
  recapStatLabel: { color: '#7a5a2e', fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
});

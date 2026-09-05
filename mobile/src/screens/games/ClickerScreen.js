// Clicker de Créatures — premier jeu du menu. Tap pour gagner des pièces,
// invoque des créatures (gacha), nourris-les pour les faire monter de
// niveau et évoluer. Revenu passif hors-ligne inclus (plafonné à 4h).
// Persisté via AsyncStorage, indépendant du système de pièces global de
// l'appli (économie propre à ce jeu, comme les autres).
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, FlatList, Alert, ScrollView, Image, ImageBackground, Dimensions } from 'react-native';
import BackButton from '../../components/BackButton';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdventureScreen from './AdventureScreen';
import { useCoins } from '../../context/CoinsContext';
import { useDaily, PENDING_GRIFFES_KEY, PENDING_CREATURES_KEY } from '../../context/DailyContext';
import {
  CREATURES,
  RARITY_LABEL,
  RARITY_COLOR,
  stageForLevel,
  levelUpCost,
  summonCost,
  tapPowerCost,
  tapDamage,
  critDamageUpgradeCost,
  TAP_UPGRADES,
  TAP_UPGRADE_FIRST_PACTE_LEVEL,
  TAP_UPGRADE_UNLOCK_LEVEL,
  tapUpgradeUnlocked,
  tapUpgradeBonus,
  tapUpgradeCost,
  normalizeTapUpgrades,
  coreUpgradeUnlocked,
  coreUpgradeRequirement,
  sanctuaryMaxed,
  veilleurMaxed,
  SANCTUARY_MAX_LEVEL,
  VEILLEUR_MAX_LEVEL,
  rollCreature,
  rollCreatureOfRarity,
  offlineEarnings,
  shouldSpawn,
  pickFromDeck,
  powerForCreature,
  SPAWN_INTERVAL_SEC,
  SPAWN_VISIBLE_SEC,
  critChance,
  critMultiplier,
  critUpgradeCost,
  transeMultiplier,
  transeStillActive,
  nextGoldenDelaySec,
  goldenBonus,
  GOLDEN_VISIBLE_SEC,
  sanctuaryMultiplier,
  sanctuaryUpgradeCost,
  veilleurOfflineMultiplier,
  veilleurUpgradeCost,
  ascensionEssenceGain,
  ascensionThreshold,
  essenceBonusMultiplier,
  ascensionGriffesReward,
  ascensionSpeedMultiplier,
  ritualReward,
  ritualReady,
  OFFRANDE_APPCOINS_COST,
  offrandeReward,
  nextQuestSet,
  pickQuestSet,
  findQuest,
  SEQUENCE_LENGTH,
  QUEST_POOL,
  QUEST_SET_SIZE,
  questComplete,
  questDetail,
  resolveQuestTarget,
  EGG_STAGES,
  eggStageForCompletedCount,
  HATCH_TAPS_REQUIRED,
  CAPTURE_TAPS_REQUIRED,
  AUTOCLICKERS,
  autoClickerCost,
  totalAutoClickIncome,
  UPGRADE_ITEMS,
  upgradeItemCost,
  upgradeBonuses,
  normalizeUpgradeLevels,
  CREATURE_POWERS,
  migrateCreatureId,
  RARITY_BADGE_LETTER,
} from '../../games/clicker/clickerLogic';
import { combatStatsForCreatureTyped } from '../../games/clicker/combatLogic';
import useBackGesture from '../../hooks/useBackGesture';
import { COLORS } from './clickerTheme';

// Cyan de la barre de navigation, repris de la maquette. Defini une
// fois plutot qu'en dur a chaque usage.
const NAV_CYAN = '#5bc8f0';

// Dimensions figées au chargement du module — utilisées pour calculer
// des positions/largeurs en PIXELS plutôt qu'en %. Découvert le 04/09 :
// un élément en position:'absolute' qui combine largeur en % ET
// aspectRatio se rend avec une largeur bien plus petite que demandée
// dans ce build ExpoGo (bug Yoga/RN confirmé par mesure : 88% demandé →
// ~74,5% réel, 75% demandé → ~46% réel). Une largeur FIXE en pixels
// (calculée ici une fois) contourne complètement le bug — vérifié :
// coinsPill (déjà en pixels fixes) s'est toujours rendu correctement,
// contrairement à challengeCard/deckFrame (en %).
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Les 5 illustrations d'œuf (un fichier par palier de EGG_STAGES,
// même index). `require` doit recevoir un chemin STATIQUE — Metro
// résout les images au moment du bundling, pas à l'exécution, donc un
// tableau construit avec un chemin dynamique ne fonctionnerait pas.
const EGG_IMAGES = [
  require('../../../assets/egg/egg-0-endormi.png'),
  require('../../../assets/egg/egg-1-fremissant.png'),
  require('../../../assets/egg/egg-2-fissure.png'),
  require('../../../assets/egg/egg-3-lumineux.png'),
  require('../../../assets/egg/egg-4-pret.png'),
];
import { DeckPicker } from './DeckPicker';

export const STORAGE_KEY = 'clicker:state:v1';
// Copie de la dernière sauvegarde brute quand un chargement échoue —
// restaurable depuis Options (voir OptionsScreen.js).
export const BACKUP_KEY = 'clicker:state:v1:backup';
// Drapeau posé par le bouton dev "Débloquer tous les monstres" (Options) :
// le clicker le lit au chargement et fait la fusion LUI-MÊME dans son
// état en mémoire, puis l'efface. Options n'écrit plus jamais directement
// dans la sauvegarde principale — zéro risque de course/corruption.
export const DEV_UNLOCK_ALL_KEY = 'clicker:dev:unlockAll';

function formatNum(n) {
  if (!Number.isFinite(n)) return '0'; // garde-fou : jamais NaN/Infinity affiché
  if (n < 1000) return Math.floor(n).toString();
  if (n < 999_950) return (n / 1000).toFixed(1) + 'K'; // évite "1000.0K" juste sous 1M
  if (n < 999_950_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n < 999_950_000_000) return (n / 1_000_000_000).toFixed(2) + 'Md';
  // Au-delà du milliard — nécessaire depuis l'ajout des auto-clics de
  // palier 3 (jusqu'à 4 000 milliards de coût).
  return (n / 1_000_000_000_000).toFixed(2) + 'T';
}

export default function ClickerScreen({ onBack }) {
  const panHandlers = useBackGesture(onBack);
  const { coins: sharedCoins, spendCoins: spendSharedCoins, addCoins: addSharedCoins } = useCoins();
  const {
    trackEvent, lifetimeStats, loaded: dailyLoaded,
    calendar, calendarDay, streakClaimedDate, date: today, claimStreak,
  } = useDaily();
  // Nombre d'Ascensions faites, source unique du bonus de vitesse. Vient
  // de DailyContext (compteur à vie) plutôt que d'un état local : il
  // survit ainsi à tout ce que l'Ascension remet à zéro.
  const ascensionCount = lifetimeStats.ascension || 0;
  const ascensionCountRef = useRef(0);
  ascensionCountRef.current = ascensionCount;

  const [loaded, setLoaded] = useState(false);
  const [coins, setCoins] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0); // cumul jamais décroissant, pour l'Ascension
  const [tapPower, setTapPower] = useState(1);
  const [owned, setOwned] = useState([]); // [{id, level}]
  const [view, setView] = useState('tap'); // 'tap' | 'shop' | 'collection' | 'adventure'
  const [selectedCreature, setSelectedCreature] = useState(null);
  const [welcomeBack, setWelcomeBack] = useState(null);
  const [popups, setPopups] = useState([]);
  const [spawnedCreature, setSpawnedCreature] = useState(null); // {creature, expiresAt, leftPct, topPct}
  const [deck, setDeck] = useState([null, null, null]); // 3 emplacements, id de créature ou null
  const [pickerSlot, setPickerSlot] = useState(null); // index de l'emplacement en cours de choix, ou null
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activePower, setActivePower] = useState(null); // {name, rarity, tapMultiplier, expiresAt, effectType}
  const [pendingDiscount, setPendingDiscount] = useState(null); // {percent, name} — consommé au prochain achat
  const [critLevel, setCritLevel] = useState(0);
  // Dégâts critiques : amélioration SÉPARÉE de la Faveur des Esprits,
  // qui ne donne plus que la chance. Cumuler les deux sur un seul bouton
  // le rendait bien trop rentable pour son prix.
  const [critDamageLevel, setCritDamageLevel] = useState(0);
  const critDamageLevelRef = useRef(0);
  critDamageLevelRef.current = critDamageLevel;
  // Paliers de tap achetés (ids de TAP_UPGRADES), achat unique chacun.
  const [tapUpgrades, setTapUpgrades] = useState({});
  const tapUpgradesRef = useRef({});
  tapUpgradesRef.current = tapUpgrades;
  const [comboCount, setComboCount] = useState(0); // niveau actuel de la Transe
  const [goldenTarget, setGoldenTarget] = useState(null); // {expiresAt, leftPct, topPct} ou null
  const [ritualTarget, setRitualTarget] = useState(null); // {expiresAt, leftPct, topPct} ou null — bulle "pub" (Rituel)
  const [autoClickers, setAutoClickers] = useState({}); // { esprit: 3, main: 1, ... }
  // Améliorations à débloquer, achetées une seule fois — liste d'ids
  // (voir UPGRADE_ITEMS dans clickerLogic.js).
  const [upgradeLevels, setUpgradeLevels] = useState({});
  // (plus d'état combatComingSoonOpen — remplacé par la vraie navigation
  // vers AdventureScreen, voir plus bas)
  const [sanctuaryLevel, setSanctuaryLevel] = useState(0);
  const [veilleurLevel, setVeilleurLevel] = useState(0);
  const [essence, setEssence] = useState(0); // bonus permanent d'Ascension, survit aux resets
  const [lastRitualAt, setLastRitualAt] = useState(0);
  // Stats pour les quêtes (cumuls jamais décroissants).
  const [totalSummons, setTotalSummons] = useState(0);
  const [totalCrits, setTotalCrits] = useState(0);
  const [goldenClaimed, setGoldenClaimed] = useState(0);
  const [maxCombo, setMaxCombo] = useState(1);
  // Système de quêtes + œuf.
  // Les défis ET leurs cibles résolues. Les deux doivent voyager
  // ensemble : des ids sans leurs cibles feraient recalculer des
  // objectifs différents au prochain chargement, et un défi presque fini
  // repartirait de zéro (ou serait validé d'emblée) selon le sens où le
  // revenu a bougé entre-temps.
  // Avancement dans la séquence de démarrage scriptée. Tant qu'il est
  // sous SEQUENCE_LENGTH, les défis viennent de la séquence ; ensuite le
  // jeu bascule définitivement sur le pool dynamique.
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const sequenceIndexRef = useRef(0);
  sequenceIndexRef.current = sequenceIndex;
  const initialQuests = useState(() => nextQuestSet(0))[0];
  const [activeQuestIds, setActiveQuestIds] = useState(initialQuests.ids);
  const [questTargets, setQuestTargets] = useState(initialQuests.targets);
  // Snapshot des stats au moment du tirage — voir le commentaire sur
  // questProgress() dans clickerLogic.js pour le pourquoi. Vide au tout
  // départ : un nouveau joueur a forcément 0 partout, donc "absolu" et
  // "depuis le baseline" reviennent au même dans ce cas précis.
  const [questBaseline, setQuestBaseline] = useState({});
  const [eggPhase, setEggPhase] = useState('collecting'); // 'collecting' | 'hatching' | 'capturing'
  const [hatchTaps, setHatchTaps] = useState(0);
  const [captureTaps, setCaptureTaps] = useState(0);
  const [rewardCreature, setRewardCreature] = useState(null); // affiché après capture
  const [, setLiveTick] = useState(0); // force le re-rendu pour les décomptes visuels

  const coinsRef = useRef(0);
  coinsRef.current = coins;
  const totalEarnedRef = useRef(0);
  totalEarnedRef.current = totalEarned;
  const ownedRef = useRef([]);
  ownedRef.current = owned;
  const tapPowerRef = useRef(1);
  tapPowerRef.current = tapPower;
  const autoClickersRef = useRef({});
  autoClickersRef.current = autoClickers;
  const upgradeLevelsRef = useRef({});
  upgradeLevelsRef.current = upgradeLevels;
  const sanctuaryLevelRef = useRef(0);
  sanctuaryLevelRef.current = sanctuaryLevel;
  const veilleurLevelRef = useRef(0);
  veilleurLevelRef.current = veilleurLevel;
  const essenceRef = useRef(0);
  essenceRef.current = essence;
  const lastRitualAtRef = useRef(0);
  lastRitualAtRef.current = lastRitualAt;
  const totalSummonsRef = useRef(0);
  totalSummonsRef.current = totalSummons;
  const totalCritsRef = useRef(0);
  totalCritsRef.current = totalCrits;
  const goldenClaimedRef = useRef(0);
  goldenClaimedRef.current = goldenClaimed;
  const maxComboRef = useRef(1);
  maxComboRef.current = maxCombo;
  const activeQuestIdsRef = useRef([]);
  activeQuestIdsRef.current = activeQuestIds;
  const questBaselineRef = useRef({});
  questBaselineRef.current = questBaseline;
  const questTargetsRef = useRef({});
  questTargetsRef.current = questTargets;
  // Instantané des stats pris quand CHAQUE défi devient le défi courant,
  // et non une seule fois pour tout le cycle.
  //
  // Bug réel : avec un baseline commun aux 4 défis, tout ce que le
  // joueur accumulait en travaillant le défi 1 comptait déjà pour le
  // défi 3. « Obtiens 20 coups critiques » arrivait à moitié fait, voire
  // déjà validé. Un compteur ne doit courir que pendant SON défi.
  // Défis validés de force par l'outil de dev. Liste d'ids plutôt qu'une
  // modification des stats du joueur : valider un défi ne doit pas lui
  // offrir des coups critiques ou des pièces qu'il n'a pas gagnés, sinon
  // l'outil de test fausse l'équilibrage qu'on mesure juste après.
  const [devCompletedIds, setDevCompletedIds] = useState([]);
  const devCompletedIdsRef = useRef([]);
  devCompletedIdsRef.current = devCompletedIds;
  const [questBaselines, setQuestBaselines] = useState({});
  const questBaselinesRef = useRef({});
  questBaselinesRef.current = questBaselines;
  const eggPhaseRef = useRef('collecting');
  eggPhaseRef.current = eggPhase;
  const hatchTapsRef = useRef(0);
  hatchTapsRef.current = hatchTaps;
  const captureTapsRef = useRef(0);
  captureTapsRef.current = captureTaps;
  const popupIdRef = useRef(0);
  const saveTimeoutRef = useRef(null);
  const saveBlockedRef = useRef(false); // true si le chargement a échoué — plus aucune écriture (protège la sauvegarde sur disque)
  const viewRef = useRef('tap');
  viewRef.current = view;
  const spawnedCreatureRef = useRef(null);
  spawnedCreatureRef.current = spawnedCreature;
  const deckRef = useRef([null, null, null]);
  deckRef.current = deck;
  const activePowerRef = useRef(null);
  activePowerRef.current = activePower;
  const pendingDiscountRef = useRef(null);
  pendingDiscountRef.current = pendingDiscount;
  const critLevelRef = useRef(0);
  critLevelRef.current = critLevel;
  const comboCountRef = useRef(0);
  comboCountRef.current = comboCount;
  const lastTapTimeRef = useRef(0);
  const goldenTargetRef = useRef(null);
  goldenTargetRef.current = goldenTarget;
  const nextGoldenAtRef = useRef(Date.now() + nextGoldenDelaySec() * 1000);
  const ritualTargetRef = useRef(null);
  ritualTargetRef.current = ritualTarget;
  const RITUAL_VISIBLE_SEC = 6; // un peu plus longue que la cible dorée, bonus plus rare
  // Premier essaim au bout d'~1/3 de l'intervalle (pas d'attente complète
  // pour un nouveau joueur), puis toutes les SPAWN_INTERVAL_SEC ensuite.
  const lastSpawnTimeRef = useRef(Date.now() - Math.round(SPAWN_INTERVAL_SEC * (2 / 3)) * 1000);

  // Durée pendant laquelle la Transe s'est maintenue AU MOINS à x2,5,
  // en une seule série ininterrompue. Un défi « reste en Transe x2,5
  // pendant 30 secondes » ne peut pas se contenter du pic atteint : il
  // faut mesurer la tenue. On garde le meilleur record, pas la série en
  // cours, sinon le compteur retomberait à zéro à chaque pause et le
  // défi ne pourrait jamais s'afficher comme progressant.
  const transeStartRef = useRef(null);
  const [maxTranseHoldSec, setMaxTranseHoldSec] = useState(0);
  const maxTranseHoldSecRef = useRef(0);
  maxTranseHoldSecRef.current = maxTranseHoldSec;

  const tapScale = useRef(new Animated.Value(1)).current;
  // Secousse latérale de l'œuf, jouée UNIQUEMENT pendant l'éclosion et la
  // capture (02/09). Sans elle, les centaines de taps nécessaires pour
  // briser la coquille n'ont aucun retour visuel autre que le petit
  // rebond d'échelle déjà présent sur un tap normal — le joueur ne
  // distingue plus "je récolte des pièces" de "je casse l'œuf".
  const eggShake = useRef(new Animated.Value(0)).current;

  // Lueur du bouton cadeau qui respire (04/09, demande explicite).
  // useNativeDriver: true — tourne sur le thread natif, jamais recalculé
  // par React à chaque re-rendu de cet écran (contrairement au piège du
  // LinearGradient plein écran des Règles de survie). Boucle démarrée UNE
  // fois au montage (tableau de dépendances vide).
  const giftGlowPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(giftGlowPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(giftGlowPulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Chargement initial + calcul des gains hors-ligne.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const nowSec = Date.now() / 1000;
          const elapsed = saved.lastSave ? nowSec - saved.lastSave : 0;
          const savedVeilleur = saved.veilleurLevel || 0;
          const savedAutoClickers = saved.autoClickers || {};
          // Migration douce depuis l'ancien "Familier" à niveau unique (dev
          // en cours, pas d'utilisateurs en prod à préserver strictement) :
          // convertit un ancien niveau en unités du 1er palier de la boutique.
          if (!saved.autoClickers && saved.familiarLevel) {
            savedAutoClickers.esprit = saved.familiarLevel;
          }
          const offlineUpgradeBoost = 1 + upgradeBonuses(saved.upgradeLevels || saved.purchasedUpgradeIds || {}).autoClickerPct;
          const offlineIncome = totalAutoClickIncome(savedAutoClickers) * veilleurOfflineMultiplier(savedVeilleur) * offlineUpgradeBoost;
          const offline = Math.round(offlineEarnings(offlineIncome, elapsed));
          setCoins((saved.coins || 0) + offline);
          setTotalEarned((saved.totalEarned || 0) + offline);
          setTapPower(saved.tapPower || 1);
          // Migration des identifiants renommés (créatures d'origine
          // remplacées par des versions Gemini) — sans ça, une sauvegarde
          // qui référence encore un ancien id fait planter tout ce qui
          // essaie de retrouver la créature correspondante. Déduplique
          // ensuite par sécurité (cas limite : si la nouvelle et
          // l'ancienne créature étaient TOUTES LES DEUX déjà possédées,
          // la migration créerait un doublon — on garde alors le niveau
          // le plus élevé des deux).
          const migratedOwned = (saved.owned || []).map((o) => ({ ...o, id: migrateCreatureId(o.id) }));
          const dedupedOwned = [];
          migratedOwned.forEach((o) => {
            const existing = dedupedOwned.find((x) => x.id === o.id);
            if (existing) {
              existing.level = Math.max(existing.level, o.level);
              existing.evolutionTier = Math.max(existing.evolutionTier || 0, o.evolutionTier || 0);
            } else {
              dedupedOwned.push(o);
            }
          });
          setOwned(dedupedOwned);
          setDeck((saved.deck || [null, null, null]).map((id) => (id ? migrateCreatureId(id) : id)));
          setCritLevel(saved.critLevel || 0);
          setCritDamageLevel(saved.critDamageLevel || 0);
          // Migration douce : l'ancien format était un tableau d'ids
          // achetés une fois, relu comme « niveau 1 » chacun.
          setTapUpgrades(normalizeTapUpgrades(saved.tapUpgrades || {}));
          setAutoClickers(savedAutoClickers);
          // Migration douce (02/09) : les sauvegardes d'avant la refonte
          // stockaient `purchasedUpgradeIds` (tableau d'ids achetés une
          // fois). normalizeUpgradeLevels() les relit comme « niveau 1 »
          // chacune, donc un joueur existant garde exactement les bonus
          // qu'il avait déjà — et peut désormais les monter plus haut.
          setUpgradeLevels(normalizeUpgradeLevels(saved.upgradeLevels || saved.purchasedUpgradeIds || {}));
          setSanctuaryLevel(saved.sanctuaryLevel || 0);
          setVeilleurLevel(savedVeilleur);
          setEssence(saved.essence || 0);
          setLastRitualAt(saved.lastRitualAt || 0);
          setTotalSummons(saved.totalSummons || 0);
          setTotalCrits(saved.totalCrits || 0);
          setGoldenClaimed(saved.goldenClaimed || 0);
          setMaxCombo(saved.maxCombo || 1);
          setMaxTranseHoldSec(saved.maxTranseHoldSec || 0);
          // Les défis sauvegardés sont revalidés contre le pool ACTUEL :
          // un id disparu du pool renverrait une progression de 0 pour
          // toujours et bloquerait l'œuf définitivement. On retire donc
          // au tirage adapté à la progression du joueur.
          const savedSeqIndex = saved.sequenceIndex || 0;
          setSequenceIndex(savedSeqIndex);
          // Un défi valide est soit dans la séquence, soit dans le pool.
          const savedQuests = (saved.activeQuestIds || []).filter((id) => !!findQuest(id));
          // La séquence impose un nombre de défis par cycle (4 ou 5) ;
          // le pool dynamique en donne toujours 4. On compare donc à la
          // taille attendue du cycle courant, pas à une constante.
          const expectedSize = savedSeqIndex < SEQUENCE_LENGTH
            ? nextQuestSet(savedSeqIndex).ids.length
            : QUEST_SET_SIZE;
          const savedTargets = saved.questTargets || {};
          if (savedQuests.length === expectedSize) {
            // Sauvegardes d'AVANT les cibles dynamiques : aucune cible
            // stockée. On les résout une fois à partir des stats
            // chargées, puis elles sont figées comme les autres — sans
            // ce repli, questProgress recalculerait une cible à chaque
            // rendu et le défi s'éloignerait à mesure que le joueur
            // progresse, sans jamais se terminer.
            const statsAtLoad = {
              totalEarned: saved.totalEarned || 0,
              coins: saved.coins || 0,
              passiveIncome: totalAutoClickIncome(saved.autoClickers || {}),
              tapPower: saved.tapPower || 1,
              autoClickers: saved.autoClickers || {},
              upgradeLevels: saved.upgradeLevels || {},
              sanctuaryLevel: saved.sanctuaryLevel || 0,
              veilleurLevel: saved.veilleurLevel || 0,
              critLevel: saved.critLevel || 0,
              essence: saved.essence || 0,
              ownedCount: (saved.owned || []).length,
              deckCount: (saved.deck || []).filter(Boolean).length,
              maxCreatureLevel: (saved.owned || []).reduce((m, o) => Math.max(m, o.level || 0), 0),
              autoTotal: Object.values(saved.autoClickers || {}).reduce((a, b) => a + (b || 0), 0),
            };
            // Un défi sauvegardé peut être devenu INFAISABLE : c'est le
            // cas signalé après une réinitialisation, où « gagne 3
            // combats » avait été tiré alors que le joueur n'avait
            // aucune créature — l'Aventure refusant de démarrer sur un
            // deck vide, l'œuf ne pouvait plus jamais éclore. On
            // remplace ici les défis dont la précondition n'est plus
            // remplie, un par un, en gardant les autres intacts pour ne
            // pas effacer la progression déjà faite.
            // Les défis SCRIPTÉS ne sont jamais remplacés : la séquence
            // est un fil fixe, y substituer un défi aléatoire casserait
            // l'ordre de découverte voulu. Seuls les défis du pool
            // dynamique sont revalidés.
            const stillOk = savedQuests.filter((id) => {
              const q = findQuest(id);
              return !q || !q.available || q.available(statsAtLoad);
            });
            let finalQuests = savedQuests;
            if (stillOk.length < savedQuests.length) {
              const replacements = pickQuestSet(stillOk, statsAtLoad).ids.filter((id) => !stillOk.includes(id));
              finalQuests = [...stillOk, ...replacements].slice(0, expectedSize);
            }
            const resolved = {};
            finalQuests.forEach((id) => {
              const q = QUEST_POOL.find((x) => x.id === id);
              resolved[id] = savedTargets[id] || resolveQuestTarget(q, statsAtLoad);
            });
            setActiveQuestIds(finalQuests);
            setQuestTargets(resolved);
          } else {
            const fresh = nextQuestSet(savedSeqIndex, savedQuests, { totalEarned: saved.totalEarned || 0 });
            setActiveQuestIds(fresh.ids);
            setQuestTargets(fresh.targets);
          }
          // Migration douce pour les sauvegardes d'avant ce correctif
          // (pas de questBaseline stocké) : on prend un instantané des
          // stats ACTUELLES comme point de départ — équitable, pas de
          // quête instantanément acquise ni bloquée pour toujours.
          setQuestBaseline(
            saved.questBaseline || {
              maxCombo: saved.maxCombo || 1,
              totalSummons: saved.totalSummons || 0,
              totalCrits: saved.totalCrits || 0,
              goldenClaimed: saved.goldenClaimed || 0,
              totalEarned: (saved.totalEarned || 0) + offline,
              maxCreatureLevel: dedupedOwned.reduce((max, o) => Math.max(max, o.level), 0),
              tapPower: saved.tapPower || 1,
            }
          );
          setQuestBaselines(saved.questBaselines || {});
          setDevCompletedIds(saved.devCompletedIds || []);
          setEggPhase(saved.eggPhase || 'collecting');
          setHatchTaps(saved.hatchTaps || 0);
          setCaptureTaps(saved.captureTaps || 0);
          if (offline > 5) setWelcomeBack(offline);
        }
        // Drapeau dev "Débloquer tous les monstres" (posé depuis Options) :
        // fusion faite ICI, dans l'état en mémoire, puis persistée par la
        // sauvegarde normale — jamais d'écriture directe depuis Options.
        // Placé HORS du if(raw) pour marcher aussi sur une install vierge.
        // N'écrase jamais une créature déjà possédée (niveau/palier gardés).
        const unlockFlag = await AsyncStorage.getItem(DEV_UNLOCK_ALL_KEY);
        if (unlockFlag === '1') {
          setOwned((prev) => {
            const haveIds = new Set(prev.map((o) => o.id));
            const missing = CREATURES.filter((c) => !haveIds.has(c.id)).map((c) => ({ id: c.id, level: 1, evolutionTier: 0 }));
            return [...prev, ...missing];
          });
          await AsyncStorage.removeItem(DEV_UNLOCK_ALL_KEY);
        }

        // Creatures offertes par le calendrier. DailyContext depose une
        // intention, le clicker (seul proprietaire de la collection)
        // l'encaisse ici. Une creature deja possedee monte d'un niveau,
        // comme lors d'une invocation.
        const pendingRaw = await AsyncStorage.getItem(PENDING_CREATURES_KEY);
        if (pendingRaw) {
          let rarities = [];
          try { rarities = JSON.parse(pendingRaw); } catch (e2) { rarities = []; }
          if (Array.isArray(rarities) && rarities.length) {
            const gifts = rarities.map((r) => rollCreatureOfRarity(r)).filter(Boolean);
            if (gifts.length) {
              setOwned((prev) => {
                let next = [...prev];
                gifts.forEach((c) => {
                  const i = next.findIndex((o) => o.id === c.id);
                  if (i >= 0) next[i] = { ...next[i], level: next[i].level + 1 };
                  else next.push({ id: c.id, level: 1, evolutionTier: 0 });
                });
                return next;
              });
            }
          }
          await AsyncStorage.removeItem(PENDING_CREATURES_KEY);
        }
      } catch (e) {
        // Chargement raté (JSON abîmé, donnée inattendue…). AVANT (bug
        // réel de "remise à zéro") : on repartait de zéro en mémoire, puis
        // la sauvegarde automatique ÉCRASAIT la sauvegarde encore valide
        // sur disque avec ces zéros → perte définitive. Désormais on
        // bloque toute écriture pour cette session, et la sauvegarde
        // brute est copiée dans une clé de secours restaurable depuis
        // Options.
        saveBlockedRef.current = true;
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) await AsyncStorage.setItem(BACKUP_KEY, raw);
        } catch (_) {}
      }
      setLoaded(true);
    })();
  }, []);

  // DailyContext (source de lifetimeStats, les compteurs Aventure à
  // vie) se charge de façon INDÉPENDANTE de ce chargement-ci — il peut
  // finir après. Ce petit effet capture le baseline des 3 quêtes
  // Aventure dès que ces données arrivent, sans jamais écraser un
  // baseline déjà sauvegardé pour ces mêmes champs (le spread `...prev`
  // gagne s'ils existaient déjà). Se déclenche une seule fois grâce à
  // la ref, une fois que lifetimeStats a fini de charger (distingué
  // d'un simple "pas encore de combat gagné" par le fait que
  // DailyContext initialise lifetimeStats à {} tant qu'il n'a pas fini
  // sa propre lecture d'AsyncStorage).
  const advBaselineCapturedRef = useRef(false);
  useEffect(() => {
    if (!loaded || advBaselineCapturedRef.current || !dailyLoaded) return;
    advBaselineCapturedRef.current = true;
    setQuestBaseline((prev) => ({
      battleWon: lifetimeStats.battleWon || 0,
      runeEquipped: lifetimeStats.runeEquipped || 0,
      runeBought: lifetimeStats.runeBought || 0,
      ...prev,
    }));
  }, [loaded, dailyLoaded, lifetimeStats]);

  // Sauvegarde (avec un léger anti-rebond pour ne pas écrire à chaque tap).
  useEffect(() => {
    if (!loaded || saveBlockedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveData()));
    }, 600);
  }, [
    coins, totalEarned, tapPower, owned, deck, critLevel, critDamageLevel, tapUpgrades, autoClickers, upgradeLevels, sanctuaryLevel,
    veilleurLevel, essence, lastRitualAt, totalSummons, totalCrits, goldenClaimed, maxCombo, maxTranseHoldSec,
    activeQuestIds, questTargets, questBaseline, questBaselines, devCompletedIds, sequenceIndex, eggPhase, hatchTaps, captureTaps, loaded,
  ]);

  // Construit l'objet de sauvegarde à partir des REFS uniquement, donc
  // toujours à jour quel que soit le moment de l'appel.
  //
  // Il existait deux objets de sauvegarde distincts (un pour l'écriture
  // anti-rebond, un pour la sortie d'écran) qu'il fallait tenir
  // synchronisés à la main. `maxTranseHoldSec` avait été ajouté au
  // premier seulement : en quittant l'écran, le second écrasait la
  // sauvegarde avec un objet où le champ manquait, le record de Transe
  // repassait à 0 au retour et le défi « tiens 30 secondes », pourtant
  // validé, redevenait le défi courant. Une seule fonction, plus de
  // divergence possible.
  const buildSaveData = () => ({
    coins: coinsRef.current,
    totalEarned: totalEarnedRef.current,
    tapPower: tapPowerRef.current,
    owned: ownedRef.current,
    deck: deckRef.current,
    critLevel: critLevelRef.current,
    critDamageLevel: critDamageLevelRef.current,
    tapUpgrades: tapUpgradesRef.current,
    autoClickers: autoClickersRef.current,
    upgradeLevels: upgradeLevelsRef.current,
    sanctuaryLevel: sanctuaryLevelRef.current,
    veilleurLevel: veilleurLevelRef.current,
    essence: essenceRef.current,
    lastRitualAt: lastRitualAtRef.current,
    totalSummons: totalSummonsRef.current,
    totalCrits: totalCritsRef.current,
    goldenClaimed: goldenClaimedRef.current,
    maxCombo: maxComboRef.current,
    maxTranseHoldSec: maxTranseHoldSecRef.current,
    activeQuestIds: activeQuestIdsRef.current,
    questTargets: questTargetsRef.current,
    questBaseline: questBaselineRef.current,
    questBaselines: questBaselinesRef.current,
    devCompletedIds: devCompletedIdsRef.current,
    sequenceIndex: sequenceIndexRef.current,
    eggPhase: eggPhaseRef.current,
    hatchTaps: hatchTapsRef.current,
    captureTaps: captureTapsRef.current,
    lastSave: Date.now() / 1000,
  });

  // Sauvegarde immédiate à la sortie de l'écran. Annule d'abord le
  // minuteur anti-rebond encore en attente : sans ça, une écriture
  // OBSOLÈTE pouvait partir ~600ms après avoir quitté l'écran et écraser
  // ce qu'un autre écran (ex: le bouton "Débloquer tous les monstres" des
  // Options) venait de modifier dans le stockage. Et jamais d'écriture si
  // le chargement avait échoué (voir saveBlockedRef).
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (saveBlockedRef.current) return;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveData()));
    };
  }, []);

  // Point de passage UNIQUE pour tout gain de pièces — applique le
  // multiplicateur global (Sanctuaire × bonus permanent d'Ascension) et
  // alimente le cumul total (totalEarned), qui ne baisse jamais même en
  // dépensant, utilisé pour calculer le gain d'essence à l'Ascension.
  // Gains en attente. Remplis par gainCoins a chaque tap, repercutes
  // dans l'etat 10 fois par seconde par l'effet ci-dessous.
  const pendingGainRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const pending = pendingGainRef.current;
      if (pending <= 0) return;
      pendingGainRef.current = 0;
      setCoins((c) => c + pending);
      setTotalEarned((t) => t + pending);
      trackEvent('coinsEarned', pending);
    }, 100);
    return () => {
      clearInterval(id);
      // Vidage final : sans lui, jusqu'a 100 ms de gains seraient
      // perdus en quittant l'ecran — une dizaine de taps a haute
      // cadence.
      const pending = pendingGainRef.current;
      if (pending > 0) {
        pendingGainRef.current = 0;
        setCoins((c) => c + pending);
        setTotalEarned((t) => t + pending);
        trackEvent('coinsEarned', pending);
      }
    };
  }, [trackEvent]);

  const gainCoins = (rawAmount) => {
    const upgradeCoinMult = 1 + upgradeBonuses(upgradeLevelsRef.current).coinPct;
    // Le bonus de vitesse d'Ascension (+30% par Ascension, multiplicatif)
    // s'applique ici avec les autres multiplicateurs globaux : c'est ce
    // qui rend le run d'après nettement plus rapide alors que le joueur
    // repart d'une économie à zéro.
    const multiplier =
      sanctuaryMultiplier(sanctuaryLevelRef.current) *
      essenceBonusMultiplier(essenceRef.current) *
      ascensionSpeedMultiplier(ascensionCountRef.current) *
      upgradeCoinMult;
    const amount = rawAmount * multiplier;
    // Accumule au lieu de declencher un rendu : voir l'intervalle de
    // vidage plus bas. Le montant retourne reste exact pour l'appelant.
    pendingGainRef.current += amount;
    return amount;
  };

  // Revenu passif : +1 tick par seconde, désormais UNIQUEMENT depuis la
  // boutique d'auto-clics (les créatures ne produisent plus rien
  // automatiquement — elles servent au tap, à leur pouvoir dédié en bulle,
  // et bientôt au combat). Le pouvoir passive_boost d'une créature booste
  // maintenant ce revenu d'auto-clics.
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      const base = totalAutoClickIncome(autoClickersRef.current);
      const boost = activePowerRef.current && activePowerRef.current.effectType === 'passive_boost' ? activePowerRef.current.effectValue : 1;
      const upgradeAutoBoost = 1 + upgradeBonuses(upgradeLevelsRef.current).autoClickerPct;
      const income = base * boost * upgradeAutoBoost;
      if (income > 0) gainCoins(income);
    }, 1000);
    return () => clearInterval(interval);
  }, [loaded]);

  // Boucle toutes les 300ms qui gère :
  // - les apparitions de créatures sur le bouton de tap (deck uniquement,
  //   voir plus haut) et leur expiration si ratées
  // - l'expiration du pouvoir actif
  // - la retombée du combo Transe si le joueur arrête de taper (pas
  //   seulement au prochain tap — sinon le multiplicateur affiché resterait
  //   figé si le joueur s'arrête net)
  // - l'apparition et l'expiration de la cible dorée (intervalle aléatoire)
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      const now = Date.now();

      if (spawnedCreatureRef.current && now > spawnedCreatureRef.current.expiresAt) {
        setSpawnedCreature(null);
      } else if (!spawnedCreatureRef.current && viewRef.current === 'tap' && shouldSpawn(lastSpawnTimeRef.current, now)) {
        const picked = pickFromDeck(deckRef.current);
        if (picked) {
          lastSpawnTimeRef.current = now;
          const pos = randomRingPosition();
          setSpawnedCreature({ creature: picked, expiresAt: now + SPAWN_VISIBLE_SEC * 1000, leftPct: pos.leftPct, topPct: pos.topPct });
        }
        // Deck vide : on ne met PAS à jour lastSpawnTimeRef, pour qu'une
        // apparition devienne possible dès qu'une créature est ajoutée au
        // deck, sans devoir attendre un cycle complet de plus.
      }

      if (activePowerRef.current && now > activePowerRef.current.expiresAt) {
        setActivePower(null);
      }

      if (comboCountRef.current > 0 && !transeStillActive(lastTapTimeRef.current, now)) {
        comboCountRef.current = 0;
        setComboCount(0);
      }

      if (goldenTargetRef.current && now > goldenTargetRef.current.expiresAt) {
        setGoldenTarget(null);
        nextGoldenAtRef.current = now + nextGoldenDelaySec() * 1000;
      } else if (!goldenTargetRef.current && viewRef.current === 'tap' && now >= nextGoldenAtRef.current) {
        const pos = randomRingPosition();
        setGoldenTarget({ expiresAt: now + GOLDEN_VISIBLE_SEC * 1000, leftPct: pos.leftPct, topPct: pos.topPct });
      }

      // Bulle Rituel ("pub" de boost) : apparaît dès que le cooldown est
      // écoulé, comme une bulle de pouvoir — plus de bouton dédié ni de
      // bannière fixe. Si ratée, redevient éligible dès le tick suivant
      // (le cooldown est déjà passé), donc réapparaîtra bientôt plutôt que
      // de punir un raté par une attente supplémentaire.
      if (ritualTargetRef.current && now > ritualTargetRef.current.expiresAt) {
        setRitualTarget(null);
      } else if (!ritualTargetRef.current && viewRef.current === 'tap' && ritualReady(lastRitualAtRef.current, now)) {
        const pos = randomRingPosition();
        setRitualTarget({ expiresAt: now + RITUAL_VISIBLE_SEC * 1000, leftPct: pos.leftPct, topPct: pos.topPct });
      }

      setLiveTick((t) => t + 1);
    }, 300);
    return () => clearInterval(interval);
  }, [loaded]);

  const spawnPopup = (text, x, y, isCrit) => {
    const id = popupIdRef.current++;
    setPopups((p) => [...p, { id, text, x, y, isCrit }]);
    setTimeout(() => setPopups((p) => p.filter((pp) => pp.id !== id)), 700);
  };

  const handleTap = (evt) => {
    const now = Date.now();

    // Transe : la fenêtre entre deux taps décide si le combo continue ou repart de 1.
    const stillActive = transeStillActive(lastTapTimeRef.current, now);
    const newCombo = stillActive ? comboCountRef.current + 1 : 1;
    comboCountRef.current = newCombo;
    lastTapTimeRef.current = now;
    setComboCount(newCombo);
    const newTranseMult = transeMultiplier(newCombo);
    if (newTranseMult > maxComboRef.current) {
      maxComboRef.current = newTranseMult;
      setMaxCombo(newTranseMult);
    }

    // Tenue de la Transe à x2,5 ou plus : on marque seulement le DÉBUT
    // de la série ici. Le décompte lui-même tourne dans un intervalle
    // (voir plus bas) — mesuré uniquement au tap, le compteur n'avançait
    // que par à-coups et restait figé dès que le joueur s'arrêtait, ce
    // qui rendait le défi « tiens 30 secondes » illisible.
    if (newTranseMult >= 2.5) {
      if (transeStartRef.current === null) transeStartRef.current = now;
    } else {
      transeStartRef.current = null;
    }

    // Faveur des Esprits : jet de coup critique indépendant à chaque tap.
    // Bonus des améliorations débloquées ajoutés PAR-DESSUS (chance et
    // multiplicateur), sans toucher aux fonctions pures critChance/
    // critMultiplier (encore utilisées ailleurs pour l'affichage du
    // niveau seul, pas la peine de changer leur signature).
    const upgradeBonus = upgradeBonuses(upgradeLevelsRef.current);
    const effectiveCritChance = Math.min(1, critChance(critLevelRef.current) + upgradeBonus.critChancePct);
    const isCrit = Math.random() < effectiveCritChance;
    if (isCrit) {
      totalCritsRef.current += 1;
      setTotalCrits(totalCritsRef.current);
      trackEvent('crit', 1);
    }

    const powerMult = activePowerRef.current ? activePowerRef.current.tapMultiplier : 1;
    const critMult = isCrit ? critMultiplier(critDamageLevelRef.current) * (1 + upgradeBonus.critMultPct) : 1;
    // `tapPower` est le NIVEAU du Pacte, pas les dégâts : il faut passer
    // par tapDamage(). S'en servir directement rendait chaque niveau
    // deux fois trop puissant.
    const effectiveTapPower =
      tapDamage(tapPowerRef.current) + upgradeBonus.tapFlat + tapUpgradeBonus(tapUpgradesRef.current);
    const gain = Math.max(1, Math.round(effectiveTapPower * powerMult * newTranseMult * critMult));
    const finalGain = Math.round(gainCoins(gain));
    Animated.sequence([
      Animated.timing(tapScale, { toValue: isCrit ? 0.8 : 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    const x = evt.nativeEvent.locationX || 60;
    const y = evt.nativeEvent.locationY || 60;
    spawnPopup(`+${finalGain}${isCrit ? ' 💥' : ''}`, x, y, isCrit);

    // 02/09 : l'onglet Quêtes a disparu, l'œuf de l'écran d'accueil EST
    // désormais le véritable œuf à casser. Quand les 4 défis sont
    // validés, ce même tap fait aussi avancer l'éclosion puis la
    // capture — le joueur ne change ni d'écran ni de geste, il tape au
    // même endroit et l'œuf finit par s'ouvrir. Le gain de pièces reste
    // acquis en plus (aucune raison de punir le joueur pendant cette
    // phase). `handleEggTap` est déclaré plus bas dans le composant :
    // pas de souci de TDZ, cette ligne ne s'exécute qu'au moment d'un
    // vrai appui, bien après l'initialisation.
    if (eggPhaseRef.current !== 'collecting') handleEggTap();
  };

  // Le joueur a tapé la créature apparue à temps : son pouvoir s'active,
  // différent selon la créature (pas juste sa rareté).
  const claimPower = () => {
    trackEvent('powerActivated', 1);
    const spawned = spawnedCreatureRef.current;
    if (!spawned) return;
    const power = powerForCreature(spawned.creature, tapPowerRef.current);

    if (power.effectType === 'discount_next') {
      // Réduit le coût du tout prochain achat (tap/invocation/nourrir),
      // quel qu'il soit — consommé une seule fois.
      setPendingDiscount({ percent: power.effectValue, name: power.name });
      spawnPopup(`-${Math.round(power.effectValue * 100)}%`, 110, 60);
    } else {
      // coins_burst et passive_boost passent tous les deux par le buff actif
      // (coins_burst donne aussi un bonus immédiat en plus du multiplicateur de tap).
      setActivePower({ ...power, expiresAt: Date.now() + power.durationSec * 1000 });
      if (power.bonusCoins > 0) {
        const finalBonus = Math.round(gainCoins(power.bonusCoins));
        spawnPopup(`+${finalBonus}`, 110, 60);
      }
    }
    setSpawnedCreature(null);
  };

  // Applique la remise en attente (pouvoir discount_next) au coût donné —
  // ne fait rien si aucune remise n'est active. Consommée séparément, au
  // moment où l'achat aboutit vraiment (voir les 3 fonctions ci-dessous).
  const applyDiscount = (cost) => (pendingDiscount ? Math.max(1, Math.round(cost * (1 - pendingDiscount.percent))) : cost);

  const buyTapPower = () => {
    const cost = applyDiscount(tapPowerCost(tapPower));
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setTapPower((t) => t + 1);
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  // État lu par toutes les conditions de déverrouillage des mécaniques.
  const coreStateRef = () => ({
    tapPower: tapPowerRef.current,
    critLevel: critLevelRef.current,
    critDamageLevel: critDamageLevelRef.current,
    sanctuaryLevel: sanctuaryLevelRef.current,
  });

  const buyCritUpgrade = () => {
    // Revérifié à l'achat, pas seulement à l'affichage : un bouton grisé
    // reste sinon parfaitement cliquable.
    if (!coreUpgradeUnlocked('faveur', coreStateRef())) return;
    const cost = applyDiscount(critUpgradeCost(critLevel));
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setCritLevel((l) => l + 1);
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  // Achète UNE unité d'un palier de la boutique d'auto-clics donné.
  const buyAutoClicker = (clickerId) => {
    const clicker = AUTOCLICKERS.find((a) => a.id === clickerId);
    const owned = autoClickersRef.current[clickerId] || 0;
    const cost = applyDiscount(autoClickerCost(clicker, owned));
    if (coinsRef.current < cost) return;
    setCoins((c) => c - cost);
    setAutoClickers((prev) => ({ ...prev, [clickerId]: (prev[clickerId] || 0) + 1 }));
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  // Achat UNIQUE d'une amélioration à débloquer — refuse si déjà achetée,
  // si le palier est encore verrouillé, ou si les pièces manquent.
  // Achat d'un niveau d'amélioration — même forme que buyVeilleur et
  // consorts : on paie le coût du niveau courant, le niveau monte de 1.
  const buyCritDamage = () => {
    if (!coreUpgradeUnlocked('critDamage', coreStateRef())) return;
    const cost = applyDiscount(critDamageUpgradeCost(critDamageLevelRef.current));
    if (coinsRef.current < cost) return;
    setCoins((c) => c - cost);
    setCritDamageLevel((l) => l + 1);
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  // Palier de tap : achat UNIQUE, et seulement si déverrouillé — la
  // vérification est refaite ici et pas seulement à l'affichage, sinon
  // un bouton grisé resterait cliquable.
  const buyTapUpgrade = (upgradeId) => {
    const index = TAP_UPGRADES.findIndex((u) => u.id === upgradeId);
    if (index === -1) return;
    // Le déverrouillage est revérifié ICI, pas seulement à l'affichage :
    // un bouton grisé reste sinon cliquable.
    if (!tapUpgradeUnlocked(index, tapPowerRef.current, tapUpgradesRef.current)) return;
    const level = tapUpgradesRef.current[upgradeId] || 0;
    const cost = applyDiscount(tapUpgradeCost(TAP_UPGRADES[index], level));
    if (coinsRef.current < cost) return;
    setCoins((c) => c - cost);
    setTapUpgrades((prev) => ({ ...prev, [upgradeId]: (prev[upgradeId] || 0) + 1 }));
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  const buyUpgradeItem = (upgradeId) => {
    const item = UPGRADE_ITEMS.find((u) => u.id === upgradeId);
    if (!item) return;
    const level = upgradeLevelsRef.current[upgradeId] || 0;
    const cost = applyDiscount(upgradeItemCost(item, level));
    if (coinsRef.current < cost) return;
    setCoins((c) => c - cost);
    setUpgradeLevels((prev) => ({ ...prev, [upgradeId]: (prev[upgradeId] || 0) + 1 }));
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  const buySanctuary = () => {
    if (!coreUpgradeUnlocked('sanctuaire', coreStateRef())) return;
    if (sanctuaryMaxed(sanctuaryLevelRef.current)) return;
    const cost = applyDiscount(sanctuaryUpgradeCost(sanctuaryLevel));
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setSanctuaryLevel((l) => l + 1);
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  const buyVeilleur = () => {
    if (!coreUpgradeUnlocked('veilleur', coreStateRef())) return;
    if (veilleurMaxed(veilleurLevelRef.current)) return;
    const cost = applyDiscount(veilleurUpgradeCost(veilleurLevel));
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setVeilleurLevel((l) => l + 1);
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  // Ascension : réinitialise coins/Pacte/Faveur/Familier/Sanctuaire/
  // Veilleur/collection/deck contre un gain d'essence PERMANENT (jamais
  // remis à zéro, même par une nouvelle Ascension).
  // Le seuil double à chaque Ascension (5M, 10M, 20M...), donc il faut
  // passer le compteur : sans lui, la 2e Ascension serait proposée dès
  // le seuil de la 1re.
  const essenceGainPreview = ascensionEssenceGain(totalEarned, ascensionCount);
  const doAscension = () => {
    if (essenceGainPreview <= 0) return;
    const ascensionNumber = (lifetimeStats.ascension || 0) + 1;
    const griffesReward = ascensionGriffesReward(ascensionNumber);
    const nextSpeed = ascensionSpeedMultiplier(ascensionNumber);
    Alert.alert(
      'Ascension',
      `Tu remets à zéro ton économie (pièces, Pacte, Faveur, Sanctuaire, Veilleur, auto-clics, améliorations).\n\n`
        + `Tu GARDES tes créatures, ton deck et toute ta progression en Aventure.\n\n`
        + `Tu gagnes : ${griffesReward} Griffes, +${essenceGainPreview} essence, et une production x${nextSpeed.toFixed(2)} pour toujours.\n\nContinuer ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ascensionner',
          style: 'destructive',
          onPress: async () => {
            trackEvent('ascension', 1);
            setEssence((e) => e + essenceGainPreview);
            // Remise à zéro de la SEULE économie du clicker.
            setCoins(0);
            setTotalEarned(0);
            setTapPower(1);
            setCritLevel(0);
            setAutoClickers({});
            setUpgradeLevels({});
            setSanctuaryLevel(0);
            setVeilleurLevel(0);
            setActivePower(null);
            setPendingDiscount(null);
            // Créatures, deck et progression d'Aventure sont CONSERVÉS.
            // Perdre ses monstres et sa campagne rendait le prestige
            // punitif au lieu d'être une récompense ; et la progression
            // d'Aventure vit dans une autre sauvegarde, la réinitialiser
            // d'ici aurait été l'écriture croisée qu'on s'interdit.

            // Griffes créditées via le drapeau partagé : c'est
            // l'AdventureScreen qui les encaissera à sa prochaine
            // ouverture. Le clicker n'écrit jamais dans la sauvegarde
            // d'Aventure directement.
            try {
              const raw = await AsyncStorage.getItem(PENDING_GRIFFES_KEY);
              const pending = raw ? parseInt(raw, 10) || 0 : 0;
              await AsyncStorage.setItem(PENDING_GRIFFES_KEY, String(pending + griffesReward));
            } catch (_) {}

            // Les défis d'œuf CONTINUENT à la suite : ni le cycle en
            // cours ni la séquence ne sont remis à zéro. Le joueur garde
            // ses créatures, donc plus aucun défi ne devient infaisable
            // — c'était la seule raison de re-tirer auparavant. Les
            // premiers défis seront simplement plus durs à relever avec
            // une économie repartie de zéro, ce qui est l'effet voulu.
          },
        },
      ]
    );
  };

  const passiveIncome =
    totalAutoClickIncome(autoClickers) *
    (activePower && activePower.effectType === 'passive_boost' ? activePower.effectValue : 1) *
    sanctuaryMultiplier(sanctuaryLevel) *
    essenceBonusMultiplier(essence) *
    ascensionSpeedMultiplier(ascensionCount);

  const claimRitual = () => {
    if (!ritualTargetRef.current) return;
    const reward = Math.round(gainCoins(ritualReward(tapPowerRef.current, passiveIncome)));
    setLastRitualAt(Date.now());
    setRitualTarget(null);
    spawnPopup(`+${reward} 🕯️`, 110, 60, true);
  };

  // Ajoute une créature à la collection (nouvelle entrée, ou niveau +1 si
  // déjà possédée) — factorisé car utilisé à la fois par l'invocation
  // gacha ET la récompense de capture d'œuf.
  const addCreatureToOwned = (creature) => {
    // Place automatiquement la créature dans le premier emplacement de
    // deck libre. Sans ça, un joueur qui vient de capturer sa première
    // créature a bien une collection mais un deck vide — et l'Aventure
    // refuse de démarrer sur un deck vide (« Deck vide »), ce qui rend
    // le défi « termine le chapitre 1 » infaisable sans que rien ne
    // l'explique. En attendant le tutoriel, on équipe pour lui. On ne
    // remplace jamais un emplacement déjà occupé : le choix du joueur
    // reste prioritaire.
    setDeck((prevDeck) => {
      if (prevDeck.includes(creature.id)) return prevDeck;
      const freeSlot = prevDeck.findIndex((id) => !id);
      if (freeSlot === -1) return prevDeck;
      const nextDeck = [...prevDeck];
      nextDeck[freeSlot] = creature.id;
      return nextDeck;
    });
    setOwned((prev) => {
      const existing = prev.find((o) => o.id === creature.id);
      if (existing) {
        return prev.map((o) => (o.id === creature.id ? { ...o, level: o.level + 1 } : o));
      }
      return [...prev, { id: creature.id, level: 1, evolutionTier: 0 }];
    });
  };

  // Reclame la recompense du jour. `addSharedCoins` est passe au
  // Context car lui seul connait le type de recompense du jour.
  const handleClaimCalendar = async () => {
    const got = await claimStreak(addSharedCoins);
    setCalendarOpen(false);
    if (!got) return;
    if (got.type === 'appCoins') spawnPopup(`+${got.amount} 🪙`, 110, 60);
    else if (got.type === 'griffes') spawnPopup(`+${got.amount} 🐾`, 110, 60);
    else if (got.type === 'creature') Alert.alert('🥚 Créature Rare !', "Elle t'attend dans ta Collection.");
    else if (got.type === 'skin') Alert.alert('🎨 Bon pour un skin', "Le système de skins arrive bientôt — ton bon est conservé.");
  };

  const doOffrande = () => {
    if (sharedCoins < OFFRANDE_APPCOINS_COST) return;
    spendSharedCoins(OFFRANDE_APPCOINS_COST).then((ok) => {
      if (!ok) return;
      trackEvent('offering', 1);
      const reward = Math.round(gainCoins(offrandeReward(tapPowerRef.current)));
      spawnPopup(`+${reward} 🪙`, 110, 60);
    });
  };

  // ---- Système de quêtes + œuf ----
  const maxCreatureLevel = owned.reduce((max, o) => Math.max(max, o.level), 0);
  // Toutes les métriques lisibles par un défi. Le pool étant déclaratif
  // (voir QUEST_POOL), ajouter un défi ne demande RIEN ici tant qu'il
  // s'appuie sur une métrique déjà listée — c'est tout l'intérêt.
  // `maxCombo` est en centièmes côté défi (x2,5 → 25) pour rester un
  // entier affichable dans la barre segmentée.
  const questStats = {
    maxCombo: Math.round(maxCombo * 10),
    totalSummons, totalCrits, goldenClaimed, totalEarned, maxCreatureLevel, tapPower,
    coins,
    passiveIncome,
    autoTotal: Object.values(autoClickers).reduce((sum, n) => sum + (n || 0), 0),
    autoClickers,
    upgradeLevels,
    sanctuaryLevel,
    veilleurLevel,
    critLevel,
    essence,
    ownedCount: owned.length,
    // Nombre de créatures réellement placées dans le deck : c'est CETTE
    // valeur, pas `ownedCount`, qui décide si l'Aventure est jouable
    // (AdventureScreen désactive le combat sur « Deck vide »).
    deckCount: deck.filter(Boolean).length,
    // Palier d'évolution le plus haut atteint sur une créature.
    maxEvolutionTier: owned.reduce((m, o) => Math.max(m, o.evolutionTier || 0), 0),
    // Tenue de la Transe (secondes) — voir le tracker dans handleTap.
    maxTranseHoldSec: Math.floor(maxTranseHoldSec),
    // Compteurs À VIE venant de DailyContext. `advLevelReached` est
    // publié par l'Aventure via trackMax : c'est un maximum, pas un
    // cumul, donc rejouer un niveau déjà battu ne le fait pas monter.
    offering: lifetimeStats.offering || 0,
    powerActivated: lifetimeStats.powerActivated || 0,
    ascension: lifetimeStats.ascension || 0,
    advLevelReached: lifetimeStats.advLevelReached || 0,
    runeFused: lifetimeStats.runeFused || 0,
    // Compteurs Aventure À VIE (DailyContext).
    battleWon: lifetimeStats.battleWon || 0,
    runeEquipped: lifetimeStats.runeEquipped || 0,
    runeBought: lifetimeStats.runeBought || 0,
  };
  // Baseline effectif d'un défi : le sien s'il a déjà démarré, sinon
  // celui du cycle (utilisé tant que le défi n'est pas devenu courant,
  // et pour les sauvegardes d'avant les baselines par défi).
  const baselineFor = (id) => questBaselines[id] || questBaseline;
  // Point de vérité unique de « ce défi est-il terminé ». Tout le reste
  // (compteur du cycle, défi courant, éclosion) passe par ici, sinon un
  // défi validé en dev serait terminé pour l'affichage mais pas pour
  // l'œuf, qui n'éclorait jamais.
  const isQuestDone = (id) =>
    devCompletedIds.includes(id) || questComplete(id, questStats, baselineFor(id), questTargets);
  const completedQuestCount = activeQuestIds.filter(isQuestDone).length;

  // Défi mis en avant sur l'écran d'accueil : le PREMIER non terminé des
  // 4 du cycle. Un seul à la fois, volontairement — la barre segmentée
  // reprise de Monster Legends n'a de sens que pour un objectif unique,
  // et empiler 4 barres sur l'accueil recréerait l'onglet Quêtes qu'on
  // vient justement de supprimer. Vaut `null` quand les 4 sont finies
  // (l'affichage bascule alors sur la barre d'éclosion).
  const currentChallengeId = activeQuestIds.find((id) => !isQuestDone(id)) || null;
  const currentChallenge = currentChallengeId
    ? questDetail(currentChallengeId, questStats, baselineFor(currentChallengeId), questTargets)
    : null;

  // Démarre le chronomètre d'un défi au moment EXACT où il devient le
  // défi courant. Tout ce qui a été accumulé avant ne compte pas.
  //
  // Les métriques de type RECORD (meilleure tenue de Transe, meilleur
  // multiplicateur atteint) sont en plus remises à zéro : un baseline ne
  // suffit pas pour elles. Un record de 12 s obtenu avant le défi
  // rendrait la barre incompréhensible — elle afficherait une avance que
  // le joueur n'a pas prise pendant ce défi, et un record déjà supérieur
  // à la cible validerait le défi d'emblée.
  useEffect(() => {
    if (!loaded || !currentChallengeId) return;
    if (questBaselinesRef.current[currentChallengeId]) return;
    const quest = findQuest(currentChallengeId);
    if (quest && (quest.metric === 'maxTranseHoldSec' || quest.metric === 'maxCombo')) {
      maxTranseHoldSecRef.current = 0;
      setMaxTranseHoldSec(0);
      transeStartRef.current = null;
      maxComboRef.current = 1;
      setMaxCombo(1);
    }
    setQuestBaselines((prev) => (
      prev[currentChallengeId] ? prev : { ...prev, [currentChallengeId]: buildQuestStatsSnapshot() }
    ));
  }, [currentChallengeId, loaded]);

  // Palier visuel de l'œuf (0-4), réaffiché sur l'accueil : il existait
  // déjà (EGG_STAGES) mais n'était rendu que dans l'onglet Quêtes, donc
  // sa suppression avait fait disparaître tout retour sur l'état de
  // l'œuf. L'œuf se réveille maintenant sous les yeux du joueur au fil
  // des défis validés, sur l'écran où il tape vraiment.
  const eggStageIndex = eggPhase === 'collecting' ? eggStageForCompletedCount(completedQuestCount) : 4;
  const eggStage = EGG_STAGES[eggStageIndex];

  // Bascule automatique collecte -> éclosion dès que les 4 quêtes sont
  // validées. Bug corrigé (30/08, signalé par capture d'écran : l'œuf
  // restait bloqué sur "prêt à éclore" avec les 4 quêtes cochées, sans
  // jamais vraiment passer en phase d'éclosion) : l'ancienne version
  // vérifiait `eggPhaseRef.current === 'collecting'` dans l'effet — au
  // chargement d'une sauvegarde, plusieurs setState (quêtes ET stats)
  // arrivent dans le même lot, et selon l'ordre exact de résolution des
  // rendus, la condition pouvait ne jamais être vraie AU MOMENT où
  // `completedQuestCount` passait à 4 dans les dépendances de l'effet —
  // et comme cette valeur ne "changeait" plus ensuite (déjà à 4), rien
  // ne redéclenchait plus jamais la bascule. Corrigé en vérifiant l'état
  // ACTUEL directement dans l'updater fonctionnel de setEggPhase (jamais
  // périmé, quel que soit l'ordre des rendus) plutôt que via une ref.
  useEffect(() => {
    if (activeQuestIds.length > 0 && completedQuestCount >= activeQuestIds.length) {
      setEggPhase((phase) => (phase === 'collecting' ? 'hatching' : phase));
    }
  }, [completedQuestCount, eggPhase]);

  // Instantané complet des métriques de défi à cet instant. Une seule
  // définition, appelée au démarrage de chaque défi ET au tirage d'un
  // nouveau cycle : deux versions divergentes laisseraient des
  // métriques absentes d'un côté, et un compteur absent du baseline
  // repart de zéro et se valide instantanément.
  // Décompte de la tenue de Transe, en temps réel. Deux rôles :
  //  - faire avancer le compteur seconde par seconde même entre deux
  //    taps, pour que la barre du défi bouge visiblement ;
  //  - couper la série dès que la fenêtre de Transe expire, pour que le
  //    compteur s'arrête net quand le joueur cesse de taper au lieu de
  //    rester figé sur sa dernière valeur.
  // On conserve le MEILLEUR temps tenu, pas la série en cours : sinon la
  // barre retomberait à zéro à chaque pause et n'atteindrait la cible
  // que sur une seule série parfaite, sans jamais montrer de progrès.
  useEffect(() => {
    const id = setInterval(() => {
      if (transeStartRef.current === null) return;
      const now = Date.now();
      if (!transeStillActive(lastTapTimeRef.current, now)) {
        transeStartRef.current = null;
        return;
      }
      const heldSec = (now - transeStartRef.current) / 1000;
      if (heldSec > maxTranseHoldSecRef.current) {
        maxTranseHoldSecRef.current = heldSec;
        setMaxTranseHoldSec(heldSec);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  const buildQuestStatsSnapshot = () => ({
    totalEarned: totalEarnedRef.current,
    coins: coinsRef.current,
    passiveIncome,
    tapPower: tapPowerRef.current,
    autoClickers: autoClickersRef.current,
    autoTotal: Object.values(autoClickersRef.current).reduce((a, b) => a + (b || 0), 0),
    upgradeLevels: upgradeLevelsRef.current,
    sanctuaryLevel: sanctuaryLevelRef.current,
    veilleurLevel: veilleurLevelRef.current,
    critLevel: critLevelRef.current,
    critDamageLevel: critDamageLevelRef.current,
    tapUpgrades: tapUpgradesRef.current,
    essence: essenceRef.current,
    ownedCount: ownedRef.current.length,
    deckCount: deckRef.current.filter(Boolean).length,
    maxCreatureLevel: ownedRef.current.reduce((m, o) => Math.max(m, o.level || 0), 0),
    maxCombo: Math.round(maxComboRef.current * 10),
    maxTranseHoldSec: Math.floor(maxTranseHoldSecRef.current),
    maxEvolutionTier: ownedRef.current.reduce((m, o) => Math.max(m, o.evolutionTier || 0), 0),
    offering: lifetimeStats.offering || 0,
    powerActivated: lifetimeStats.powerActivated || 0,
    ascension: lifetimeStats.ascension || 0,
    advLevelReached: lifetimeStats.advLevelReached || 0,
    runeFused: lifetimeStats.runeFused || 0,
    totalSummons: totalSummonsRef.current,
    totalCrits: totalCritsRef.current,
    goldenClaimed: goldenClaimedRef.current,
    battleWon: lifetimeStats.battleWon || 0,
    runeEquipped: lifetimeStats.runeEquipped || 0,
    runeBought: lifetimeStats.runeBought || 0,
  });

  const handleEggTap = () => {
    // Secousse à chaque coup porté sur la coquille. Séquence courte et
    // symétrique qui revient toujours à 0 : impossible que l'œuf reste
    // figé de travers si le joueur tape en rafale.
    eggShake.stopAnimation(() => {
      eggShake.setValue(0);
      Animated.sequence([
        Animated.timing(eggShake, { toValue: 1, duration: 45, useNativeDriver: true }),
        Animated.timing(eggShake, { toValue: -1, duration: 45, useNativeDriver: true }),
        Animated.timing(eggShake, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]).start();
    });

    if (eggPhaseRef.current === 'hatching') {
      const next = hatchTapsRef.current + 1;
      hatchTapsRef.current = next;
      setHatchTaps(next);
      if (next >= HATCH_TAPS_REQUIRED) {
        setEggPhase('capturing');
      }
    } else if (eggPhaseRef.current === 'capturing') {
      const next = captureTapsRef.current + 1;
      captureTapsRef.current = next;
      setCaptureTaps(next);
      if (next >= CAPTURE_TAPS_REQUIRED) {
        // Capture réussie : récompense (tirage classique, comme demandé —
        // pas de créature rare garantie) + petit bonus de pièces, puis
        // nouveau cycle de quêtes.
        const creature = rollCreature();
        addCreatureToOwned(creature);
        gainCoins(goldenBonus(tapPowerRef.current) * 3);
        setRewardCreature(creature);
        // Instantané complet des stats à cet instant précis. Il sert à
        // DEUX choses désormais : résoudre les cibles des nouveaux défis
        // (« 25 minutes de farm » se convertit en pièces d'après le
        // revenu d'ICI), et servir de point zéro à la progression.
        //
        // Il couvre TOUTES les métriques, plus seulement les 'delta' :
        // depuis que la barre des défis 'absolute' se mesure elle aussi
        // depuis le tirage, une métrique absente ferait repartir la
        // barre d'un état faux.
        const statsAtDraw = buildQuestStatsSnapshot();
        // Avance d'un cran dans la séquence scriptée. Une fois celle-ci
        // épuisée, nextQuestSet bascule tout seul sur le pool dynamique
        // et l'index continue de grimper sans effet.
        const nextIndex = sequenceIndexRef.current + 1;
        setSequenceIndex(nextIndex);
        const nextSet = nextQuestSet(nextIndex, activeQuestIdsRef.current, statsAtDraw);
        setActiveQuestIds(nextSet.ids);
        setQuestTargets(nextSet.targets);
        setQuestBaseline(statsAtDraw);
        // Les chronomètres par défi repartent à zéro : chaque défi du
        // nouveau cycle démarrera le sien quand il deviendra courant.
        setQuestBaselines({});
        setDevCompletedIds([]);
        setEggPhase('collecting');
        setHatchTaps(0);
        setCaptureTaps(0);
        hatchTapsRef.current = 0;
        captureTapsRef.current = 0;
      }
    }
  };

  const claimGolden = () => {
    if (!goldenTargetRef.current) return;
    const bonus = Math.round(gainCoins(goldenBonus(tapPowerRef.current)));
    spawnPopup(`+${bonus} ✨`, 110, 60, true);
    setGoldenTarget(null);
    nextGoldenAtRef.current = Date.now() + nextGoldenDelaySec() * 1000;
    goldenClaimedRef.current += 1;
    setGoldenClaimed(goldenClaimedRef.current);
  };

  const nextSummonCost = applyDiscount(summonCost(owned.length));

  const doSummon = () => {
    if (coins < nextSummonCost) return;
    setCoins((c) => c - nextSummonCost);
    if (pendingDiscountRef.current) setPendingDiscount(null);
    const creature = rollCreature();
    addCreatureToOwned(creature);
    totalSummonsRef.current += 1;
    setTotalSummons(totalSummonsRef.current);
    trackEvent('summon', 1);
    setSelectedCreature(creature.id);
    setView('collection');
  };

  // Applique la montée de niveau d'une créature. NE débite RIEN : les
  // créatures se paient désormais uniquement en Griffes, et c'est
  // AdventureScreen qui vérifie et débite ce coût, puisque les Griffes
  // vivent dans son état. Ce point d'entrée ne fait que persister le
  // nouveau niveau, la collection appartenant au clicker — même schéma
  // que handleEvolveCreature.
  const handleLevelUpCreature = (id) => {
    setOwned((prev) => prev.map((o) => (o.id === id ? { ...o, level: o.level + 1 } : o)));
    trackEvent('creatureFed', 1);
  };

  // Deck de 3 créatures (les seules qui peuvent apparaître sur le cookie).
  const assignToDeck = (slotIndex, creatureId) => {
    setDeck((prev) => {
      const next = [...prev];
      // Retire d'abord la créature de tout autre emplacement où elle
      // serait déjà (pas de doublon dans le deck).
      for (let i = 0; i < next.length; i++) {
        if (next[i] === creatureId) next[i] = null;
      }
      next[slotIndex] = creatureId;
      return next;
    });
    setPickerSlot(null);
  };

  const clearDeckSlot = (slotIndex) => {
    setDeck((prev) => prev.map((id, i) => (i === slotIndex ? null : id)));
    setPickerSlot(null);
  };

  if (!loaded) {
    return (
      <ImageBackground source={require('../../../assets/icons/home-background.jpg')} style={styles.screen} resizeMode="cover" {...panHandlers}>
        <Text style={styles.loadingText}>Chargement…</Text>
      </ImageBackground>
    );
  }

  // Fait passer une créature possédée à un nouveau palier d'évolution —
  // appelé depuis AdventureScreen (qui a déjà vérifié le niveau requis et
  // débité les Griffes de son côté ; ici on ne fait que persister le
  // nouveau palier sur la collection du clicker).
  const handleEvolveCreature = (creatureId, newTier) => {
    setOwned((prev) => prev.map((o) => (o.id === creatureId ? { ...o, evolutionTier: newTier } : o)));
  };

  // L'Aventure est un écran à part entière (son propre header, sa propre
  // barre du bas) — pas juste une "vue" de plus parmi tap/shop/quests/
  // collection, pour éviter d'empiler deux headers et deux barres de nav.
  if (view === 'adventure') {
    return (
      <AdventureScreen
        owned={owned}
        deck={deck}
        onBack={() => setView('tap')}
        onEvolveCreature={handleEvolveCreature}
        onLevelUpCreature={handleLevelUpCreature}
        onAssignDeck={assignToDeck}
        onClearDeckSlot={clearDeckSlot}
      />
    );
  }

  return (
    <ImageBackground source={require('../../../assets/icons/home-background.jpg')} style={styles.screen} resizeMode="cover" {...panHandlers}>
      <View style={styles.headerRow}>
        {/* Case "Élevage" retirée complètement, sur demande explicite —
            il ne reste que le bouton retour, sans fond. Contextuel :
            depuis Shop/Collection il ramène à l'accueil du Clicker
            (view 'tap'), depuis l'accueil il sort du Clicker (onBack). */}
        {(onBack || view !== 'tap') && (
          <BackButton onPress={() => (view !== 'tap' ? setView('tap') : onBack())} />
        )}
      </View>

      {view === 'tap' && (
        <>
          <ImageBackground
            source={require('../../../assets/icons/coins-pill.png')}
            style={styles.coinsPill}
            resizeMode="stretch"
          >
            <Text style={styles.coinsPillText} numberOfLines={1}>{formatNum(coins)}</Text>
          </ImageBackground>
          {passiveIncome > 0 && <Text style={styles.incomeText}>+{passiveIncome.toFixed(1)}/s</Text>}

          {activePower && (
            <View style={styles.powerBanner}>
              <Text style={styles.powerBannerText}>
                ⚡ {activePower.name} actif : x{activePower.tapMultiplier} tap
                {activePower.effectType === 'passive_boost' ? ` + x${activePower.effectValue} revenu passif` : ''}
                {' '}({Math.max(0, Math.ceil((activePower.expiresAt - Date.now()) / 1000))}s)
              </Text>
            </View>
          )}

          {pendingDiscount && (
            <View style={[styles.powerBanner, styles.discountBanner]}>
              <Text style={[styles.powerBannerText, styles.discountBannerText]}>
                🏷️ {pendingDiscount.name} : -{Math.round(pendingDiscount.percent * 100)}% sur ton prochain achat
              </Text>
            </View>
          )}

          {welcomeBack !== null && (
            <TouchableOpacity style={styles.welcomeBanner} onPress={() => setWelcomeBack(null)}>
              <Text style={styles.welcomeText}>🎉 Pendant ton absence, tes créatures ont gagné {formatNum(welcomeBack)} pièces !</Text>
            </TouchableOpacity>
          )}

          {/* Écran d'accueil volontairement épuré : juste l'œuf, les
              pièces, le revenu/s, et le deck actuel — tout le reste
              (améliorations, quêtes, collection) vit maintenant dans la
              barre de navigation du bas. */}
          {/* Le défi en cours vit désormais ICI, sur l'écran d'accueil,
              exactement à l'emplacement de l'ancien vide entre la
              bannière de pouvoir et le deck. En phase d'éclosion/capture
              la même barre bascule sur le décompte de taps, pour que le
              joueur n'ait jamais deux barres concurrentes à l'écran. */}
          {eggPhase === 'collecting' ? (
            currentChallenge && (
              <ChallengeBar
                icon={currentChallenge.icon}
                label={currentChallenge.label}
                current={currentChallenge.current}
                target={currentChallenge.target}
                cycleIndex={completedQuestCount}
                cycleTotal={activeQuestIds.length}
              />
            )
          ) : (
            <ChallengeBar
              icon={eggPhase === 'hatching' ? '🥚' : '💫'}
              label={eggPhase === 'hatching' ? "L'œuf est prêt : brise la coquille !" : 'La créature bouge encore : capture-la !'}
              current={eggPhase === 'hatching' ? hatchTaps : captureTaps}
              target={eggPhase === 'hatching' ? HATCH_TAPS_REQUIRED : CAPTURE_TAPS_REQUIRED}
              cycleIndex={0}
              cycleTotal={0}
            />
          )}

          {/* Outil de test : valide le défi affiché sans tricher sur les
              stats du joueur (voir devCompletedIds). Même statut que la
              section dev des Options, visible en phase de test. */}
          {eggPhase === 'collecting' && currentChallengeId && (
            <TouchableOpacity
              style={styles.devSkipBtn}
              onPress={() => setDevCompletedIds((prev) => (prev.includes(currentChallengeId) ? prev : [...prev, currentChallengeId]))}
            >
              <Text style={styles.devSkipBtnText}>🛠️ Valider ce défi (dev)</Text>
            </TouchableOpacity>
          )}

          <>
            {/* Cadeau et cadre du deck, chacun avec ses coordonnées ABSOLUES
                fixées en % du plein écran — plus de rangée flex ni
                d'espaceur, chaque bloc est indépendant et ne peut plus
                dériver de l'autre. */}
            <TouchableOpacity style={styles.calBtn} onPress={() => setCalendarOpen(true)}>
              {/* Icône unique, qui respire légèrement (scale) — plus de
                  duplicata derrière (créait un effet fantôme, 2 cadeaux
                  superposés, signalé par l'utilisateur). */}
              <Animated.View
                style={[
                  styles.calBtnImageWrap,
                  { transform: [{ scale: giftGlowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] },
                ]}
              >
                <Image source={require('../../../assets/icons/gift.png')} style={styles.calBtnImage} resizeMode="cover" />
              </Animated.View>
              {streakClaimedDate !== today && <View style={styles.calBtnDot} />}
            </TouchableOpacity>

            <ImageBackground
              source={require('../../../assets/icons/deck-frame.png')}
              style={styles.deckFrame}
              resizeMode="stretch"
            >
              <DeckRow deck={deck} owned={owned} onSlotPress={setPickerSlot} />
            </ImageBackground>

            <View style={styles.tapZone}>
              <TouchableOpacity activeOpacity={1} onPress={handleTap} style={StyleSheet.absoluteFillObject}>
                <View style={styles.tapButtonWrap}>
                  <Animated.View
                    style={[
                      styles.tapButton,
                      {
                        transform: [
                          { scale: tapScale },
                          {
                            translateX: eggShake.interpolate({
                              inputRange: [-1, 0, 1],
                              outputRange: [-7, 0, 7],
                            }),
                          },
                          {
                            rotate: eggShake.interpolate({
                              inputRange: [-1, 0, 1],
                              outputRange: ['-5deg', '0deg', '5deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {eggPhase === 'capturing' ? (
                      <Text style={[styles.tapEmoji, { opacity: 0.6 + eggStageIndex * 0.1 }]}>💫</Text>
                    ) : (
                      <Image
                        source={EGG_IMAGES[Math.min(EGG_IMAGES.length - 1, Math.max(0, eggStageIndex))]}
                        style={styles.eggImage}
                        resizeMode="contain"
                      />
                    )}
                  </Animated.View>
                </View>
              </TouchableOpacity>
              {popups.map((p) => (
                <Animated.Text key={p.id} style={[styles.popup, p.isCrit && styles.popupCrit, { left: p.x, top: p.y }]}>
                  {p.text}
                </Animated.Text>
              ))}
              {/* Bulles de pouvoir : toutes FRÈRES du bouton tapable, pas
                  enfants — elles captent leur propre appui sans jamais
                  entrer en conflit avec le tap de l'œuf en dessous. */}
              {spawnedCreature && <SpawnedCreatureBubble spawned={spawnedCreature} onClaim={claimPower} />}
              {goldenTarget && <GoldenTargetBubble target={goldenTarget} onClaim={claimGolden} />}
              {ritualTarget && <RitualBubble target={ritualTarget} onClaim={claimRitual} />}
            </View>

            {/* Regroupés dans une zone positionnée en absolu, juste sous
                tapZone — étaient restés en flux normal après le passage
                en absolu du reste de l'écran, ce qui les faisait remonter
                tout en haut (derrière le header, signalé par
                l'utilisateur : texte "Ta../Œ.." visible en arrière-plan). */}
            <View style={styles.tapHintZone}>
              {comboCount > 1 ? (
                <Text style={styles.comboText}>🔥 Transe x{transeMultiplier(comboCount).toFixed(2)} ({comboCount} taps)</Text>
              ) : (
                <Text style={styles.tapHint}>
                  {eggPhase === 'hatching'
                    ? "Tape pour casser l'œuf"
                    : eggPhase === 'capturing'
                    ? 'Tape pour capturer la créature'
                    : 'Tape pour récolter des pièces'}
                </Text>
              )}
              {/* Nom du palier toujours visible, même pendant la Transe :
                  c'est l'indicateur d'état de l'œuf, pas un message
                  contextuel qu'on peut masquer. */}
              {eggPhase === 'collecting' && <Text style={styles.eggStageLabel}>{eggStage.name}</Text>}
            </View>
          </>
        </>
      )}

      {view === 'shop' && (
        <ShopView
          coins={coins}
          sharedCoins={sharedCoins}
          tapPower={tapPower}
          critLevel={critLevel}
          sanctuaryLevel={sanctuaryLevel}
          veilleurLevel={veilleurLevel}
          autoClickers={autoClickers}
          upgradeLevels={upgradeLevels}
          applyDiscount={applyDiscount}
          onBuyTapPower={buyTapPower}
          onBuyCrit={buyCritUpgrade}
          onBuyCritDamage={buyCritDamage}
          onBuyTapUpgrade={buyTapUpgrade}
          critDamageLevel={critDamageLevel}
          tapUpgrades={tapUpgrades}
          onBuySanctuary={buySanctuary}
          onBuyVeilleur={buyVeilleur}
          onBuyAutoClicker={buyAutoClicker}
          onBuyUpgradeItem={buyUpgradeItem}
          onOffrande={doOffrande}
          essence={essence}
          essenceGainPreview={essenceGainPreview}
          ascensionCount={ascensionCount}
          totalEarned={totalEarned}
          onAscend={doAscension}
        />
      )}

      {view === 'collection' && (
        <CollectionView
          owned={owned}
          selectedCreature={selectedCreature}
          setSelectedCreature={setSelectedCreature}
          coins={coins}
          pendingDiscount={pendingDiscount}
          nextSummonCost={nextSummonCost}
          onSummon={doSummon}
        />
      )}

      {calendarOpen && (
        <DailyCalendarModal
          calendar={calendar}
          currentDay={calendarDay}
          alreadyClaimedToday={streakClaimedDate === today}
          onClaim={handleClaimCalendar}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {pickerSlot !== null && (
        <DeckPicker
          slotIndex={pickerSlot}
          deck={deck}
          owned={owned}
          onPick={(id) => assignToDeck(pickerSlot, id)}
          onClear={() => clearDeckSlot(pickerSlot)}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {/* La capture d'une créature peut désormais se produire depuis
          l'écran d'accueil (l'onglet Quêtes n'existe plus), donc cet
          overlay est remonté au niveau de l'écran entier — sinon la
          récompense serait invisible au moment exact où elle tombe. */}
      {rewardCreature && (
        <View style={styles.detailOverlay}>
          <View style={styles.rewardPanel}>
            <Text style={styles.detailEmoji}>{rewardCreature.stages[0].emoji}</Text>
            <Text style={styles.detailName}>Capturé !</Text>
            <Text style={[styles.creatureRarity, { color: RARITY_COLOR[rewardCreature.rarity] }]}>
              {rewardCreature.stages[0].name} · {RARITY_LABEL[rewardCreature.rarity]}
            </Text>
            <TouchableOpacity style={styles.feedBtn} onPress={() => setRewardCreature(null)}>
              <Text style={styles.feedBtnText}>Super !</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <BottomTabBar
        view={view}
        setView={setView}
        onAdventurePress={() => setView('adventure')}
        ownedCount={owned.length}
        totalCreatures={CREATURES.length}
      />
    </ImageBackground>
  );
}

// Les 3 emplacements du deck, affichés au-dessus de l'œuf. Un
// emplacement vide est un œuf grisé — appuyer dessus (rempli ou vide)
// ouvre le sélecteur pour choisir/changer la créature qui l'occupe.
// Calendrier de connexion, calque sur la maquette : grille irreguliere
// (3 petites cases, 2 grandes, 2 moyennes) ou la taille signale
// l'importance du lot, le jour 7 encadre en dore.
function DailyCalendarModal({ calendar, currentDay, alreadyClaimedToday, onClaim, onClose }) {
  if (!Array.isArray(calendar) || calendar.length === 0) return null;
  const ready = !alreadyClaimedToday;
  const claimedCount = (currentDay - 1) + (ready ? 0 : 1);

  const cell = (d, style) => {
    const isToday = d.day === currentDay;
    const isPast = d.day < currentDay;
    const claimable = isToday && ready;
    const isSupreme = d.day === 7;
    return (
      <TouchableOpacity
        key={d.day}
        style={[styles.calBox, style, isSupreme && styles.calBoxSupreme,
          isPast && styles.calBoxPast, isToday && styles.calBoxToday,
          claimable && styles.calBoxClaimable]}
        onPress={claimable ? onClaim : undefined}
        disabled={!claimable}
        activeOpacity={claimable ? 0.7 : 1}
      >
        <Text style={styles.calBoxIcon}>{d.icon}</Text>
        <Text style={[styles.calBoxDay, isSupreme && styles.calBoxDaySupreme]}>JOUR {d.day}</Text>
        <Text style={[styles.calBoxLabel, isSupreme && styles.calBoxLabelSupreme]} numberOfLines={2}>
          {d.label}
        </Text>
        {isPast && <Text style={styles.calBoxCheck}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.calOverlay}>
      <View style={styles.calPanel}>
        <TouchableOpacity onPress={onClose} style={styles.calClose}>
          <Ionicons name="close" size={20} color={COLORS.muted} />
        </TouchableOpacity>

        <Text style={styles.calPanelTitle}>CALENDRIER DE RÉCOMPENSES</Text>
        <Text style={styles.calPanelSub}>SEMAINE DE CONNEXION</Text>

        <View style={styles.calGridRow}>{calendar.slice(0, 3).map((d) => cell(d, styles.calBoxSmall))}</View>
        <View style={styles.calGridRow}>{calendar.slice(3, 5).map((d) => cell(d, styles.calBoxLarge))}</View>
        <View style={styles.calGridRow}>{calendar.slice(5, 7).map((d) => cell(d, styles.calBoxMedium))}</View>

        <Text style={styles.calFooter}>CONNEXIONS RÉCLAMÉES : {claimedCount} / 7</Text>
        <View style={styles.calProgressTrack}>
          <View style={[styles.calProgressFill, { width: `${(claimedCount / 7) * 100}%` }]} />
        </View>

        {ready && (
          <TouchableOpacity style={styles.calBigBtn} onPress={onClaim}>
            <Text style={styles.calBigBtnText}>RÉCUPÉRER LE JOUR {currentDay}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Centres mesurés sur deck-frame.png (panneau intérieur entre les
// bordures ornées, 12,5% à 92,5% de large). Écart resserré (±26,67% →
// ±10% autour du centre) sur demande explicite, et le slot du milieu
// verrouillé à EXACTEMENT 50% (pas 52,5%, le centre géométrique du
// panneau utile) — deckFrame a ses propres coordonnées ABSOLUES fixes
// (left 20.8%, voir styles.deckFrame), 50% du cadre reste stable.
// Créatures doublées (19 -> 38px) et espacées de ~3mm (~19dp) entre les
// bords, sur demande explicite — calculé à partir de la largeur RÉELLE
// du cadre (SCREEN_W * 0,55, voir styles.deckFrame) plutôt qu'en dur,
// pour que l'espacement en mm reste correct quelle que soit la largeur
// d'écran.
const DECK_FRAME_W_PX = SCREEN_W * 0.55;
const DECK_SLOT_DIAMETER_PX = 38;
const DECK_SLOT_GAP_PX = 19; // ~3mm
const DECK_SLOT_CENTER_GAP_PCT = ((DECK_SLOT_DIAMETER_PX + DECK_SLOT_GAP_PX) / DECK_FRAME_W_PX) * 100;
const DECK_SLOT_X_PCT = [50 - DECK_SLOT_CENTER_GAP_PCT, 50, 50 + DECK_SLOT_CENTER_GAP_PCT];

function DeckRow({ deck, owned, onSlotPress }) {
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  return (
    <>
      {deck.map((id, i) => {
        const creature = id ? CREATURES.find((c) => c.id === id) : null;
        const own = id ? ownedMap[id] : null;
        const display = creature && own ? creature.stages[stageForLevel(own.level)] : null;
        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.deckSlot,
              { left: `${DECK_SLOT_X_PCT[i]}%` },
              creature && { borderColor: RARITY_COLOR[creature.rarity] },
            ]}
            onPress={() => onSlotPress(i)}
          >
            {display ? <Text style={styles.deckSlotEmoji}>{display.emoji}</Text> : <Text style={styles.deckSlotEmpty}>🥚</Text>}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

// Sélecteur : choisir quelle créature possédée occupe l'emplacement
// tapé. Une créature déjà dans un autre emplacement peut être choisie —
// elle sera simplement retirée de l'autre emplacement (pas de doublon).
// Menu boutique dédié aux générateurs d'auto-clics (remplace l'ancien
// bouton "Familier" à niveau unique) — un palier par ligne, avec le
// nombre possédé, le revenu qu'il rapporte, et un bouton pour en acheter
// un de plus (coût qui grimpe à chaque achat du même palier).
// Écran Boutique, plein écran (pas un modal), avec 2 PAGES internes façon
// Cookie Clicker : "Améliorations" (Pacte, Faveur des Esprits, Sanctuaire,
// Veilleur, puis Offrande en dernier) et "Auto-clics" (les 5 générateurs).
// Résume l'effet TOTAL déjà acquis sur une amélioration (effet unitaire
// x niveau), pour que le joueur voie ce que ses niveaux lui rapportent
// vraiment et pas seulement le gain du prochain. Les 5 types d'effet
// n'ont pas la même unité : deux sont des nombres plats, trois des
// pourcentages — d'où le formatage par type plutôt qu'un template unique.
function describeUpgradeTotal(item, level) {
  const total = item.effect.value * level;
  switch (item.effect.type) {
    case 'tapFlat': return `+${Math.round(total)} par tap`;
    case 'coinPct': return `+${Math.round(total * 100)}% production`;
    case 'autoClickerPct': return `+${Math.round(total * 100)}% auto-clics`;
    case 'critChancePct': return `+${Math.round(total * 100)}% chance crit`;
    case 'critMultPct': return `+${Math.round(total * 100)}% dégâts crit`;
    default: return '';
  }
}

function ShopView({
  coins, sharedCoins, tapPower, critLevel, sanctuaryLevel, veilleurLevel, autoClickers = {}, upgradeLevels = {},
  applyDiscount, onBuyTapPower, onBuyCrit, onBuyCritDamage, onBuySanctuary, onBuyVeilleur, onBuyAutoClicker, onBuyUpgradeItem, onBuyTapUpgrade,
  critDamageLevel = 0, tapUpgrades = [], onOffrande,
  essence, essenceGainPreview, totalEarned, ascensionCount, onAscend,
}) {
  const coreState = { tapPower, critLevel, critDamageLevel, sanctuaryLevel };
  const isUnlocked = (id) => coreUpgradeUnlocked(id, coreState);
  const [page, setPage] = useState('upgrades'); // 'upgrades' | 'autoclick'

  return (
    <View style={{ flex: 1, width: '100%', paddingTop: 64 }}>
      <View style={styles.shopPageRow}>
        <TouchableOpacity style={[styles.shopPageBtn, page === 'upgrades' && styles.shopPageBtnActive]} onPress={() => setPage('upgrades')}>
          <Text style={[styles.shopPageBtnText, page === 'upgrades' && styles.shopPageBtnTextActive]}>Améliorations</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.shopPageBtn, page === 'autoclick' && styles.shopPageBtnActive]} onPress={() => setPage('autoclick')}>
          <Text style={[styles.shopPageBtnText, page === 'autoclick' && styles.shopPageBtnTextActive]}>Auto-clics</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {page === 'upgrades' ? (
          <>
            {/* Déverrouillage en chaîne des 4 mécaniques : voir
                CORE_UNLOCKS. Un bouton verrouillé reste affiché mais
                grisé, avec la condition à remplir. */}
            {/* Offrande et Ascension EN HAUT de la boutique : ce sont
            les deux actions à fort impact (l'une convertit la monnaie
            de l'appli, l'autre relance toute la partie). Enfouies en
            bas de liste, elles passaient inaperçues. */}
            {/* Offrande, toujours juste après les 4 mécaniques historiques. */}
            <TouchableOpacity style={[styles.offrandeBtn, sharedCoins < OFFRANDE_APPCOINS_COST && styles.actionBtnDisabled]} onPress={onOffrande} disabled={sharedCoins < OFFRANDE_APPCOINS_COST}>
              <Text style={styles.offrandeBtnText}>🪙 Offrande</Text>
              <Text style={styles.offrandeBtnSubtext}>Échange {OFFRANDE_APPCOINS_COST} pièces de l'appli (tu en as {sharedCoins}) contre un bonus ici</Text>
            </TouchableOpacity>

            {/* Ascension : elle vivait dans l'onglet Quêtes, qui n'existe
                plus depuis que les défis sont passés sur l'écran
                d'accueil (02/09). Rapatriée ici plutôt que sur l'accueil,
                qu'on veut garder épuré — et c'est le seul autre endroit
                du clicker où l'on dépense sa progression. */}
            <TouchableOpacity
              style={[styles.ascensionBtn, essenceGainPreview <= 0 && styles.actionBtnDisabled]}
              onPress={onAscend}
              disabled={essenceGainPreview <= 0}
            >
              <Text style={styles.ascensionBtnText}>
                🌟 Ascension {ascensionCount > 0 ? `(x${ascensionSpeedMultiplier(ascensionCount).toFixed(2)} production)` : ''}
              </Text>
              <Text style={styles.ascensionBtnSubtext}>
                {essenceGainPreview > 0
                  ? `Remet ton économie à zéro · tu gardes créatures et Aventure · +${ascensionGriffesReward(ascensionCount + 1)} Griffes et production x${ascensionSpeedMultiplier(ascensionCount + 1).toFixed(2)}`
                  : `Gagne encore ${formatNum(ascensionThreshold(ascensionCount) - totalEarned)} pièces au total pour débloquer`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, coins < applyDiscount(tapPowerCost(tapPower)) && styles.actionBtnDisabled]}
              onPress={onBuyTapPower}
              disabled={coins < applyDiscount(tapPowerCost(tapPower))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>🔗 Pacte : {tapPower} → {tapPower + 1}</Text>
                <Text style={styles.actionBtnSubtext}>+0,5 pièce par tap à chaque niveau (actuellement {tapDamage(tapPower).toFixed(1)})</Text>
              </View>
              <Text style={styles.actionBtnCost}>💰 {formatNum(applyDiscount(tapPowerCost(tapPower)))}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, (!isUnlocked('faveur') || coins < applyDiscount(critUpgradeCost(critLevel))) && styles.actionBtnDisabled, !isUnlocked('faveur') && styles.actionBtnLockedTap]}
              onPress={onBuyCrit}
              disabled={!isUnlocked('faveur') || coins < applyDiscount(critUpgradeCost(critLevel))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>{isUnlocked('faveur') ? `✨ Faveur des Esprits (nv ${critLevel})` : '🔒 ???'}</Text>
                <Text style={styles.actionBtnSubtext}>
                  {isUnlocked('faveur')
                    ? `${(critChance(critLevel) * 100).toFixed(2)}% de chance de coup critique · +1,25% par niveau`
                    : coreUpgradeRequirement('faveur')}
                </Text>
              </View>
              <Text style={styles.actionBtnCost}>{isUnlocked('faveur') ? `💰 ${formatNum(applyDiscount(critUpgradeCost(critLevel)))}` : '🔒'}</Text>
            </TouchableOpacity>

            {/* Dégâts critiques : bouton distinct de la Faveur, qui ne
                gère plus que la chance. */}
            <TouchableOpacity
              style={[styles.actionBtn, (!isUnlocked('critDamage') || coins < applyDiscount(critDamageUpgradeCost(critDamageLevel))) && styles.actionBtnDisabled, !isUnlocked('critDamage') && styles.actionBtnLockedTap]}
              onPress={onBuyCritDamage}
              disabled={!isUnlocked('critDamage') || coins < applyDiscount(critDamageUpgradeCost(critDamageLevel))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>{isUnlocked('critDamage') ? `💥 Dégâts critiques (nv ${critDamageLevel})` : '🔒 ???'}</Text>
                <Text style={styles.actionBtnSubtext}>
                  {isUnlocked('critDamage')
                    ? `Coup critique x${critMultiplier(critDamageLevel).toFixed(1)} · +0,5 par niveau`
                    : coreUpgradeRequirement('critDamage')}
                </Text>
              </View>
              <Text style={styles.actionBtnCost}>{isUnlocked('critDamage') ? `💰 ${formatNum(applyDiscount(critDamageUpgradeCost(critDamageLevel)))}` : '🔒'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, (!isUnlocked('sanctuaire') || sanctuaryMaxed(sanctuaryLevel) || coins < applyDiscount(sanctuaryUpgradeCost(sanctuaryLevel))) && styles.actionBtnDisabled, !isUnlocked('sanctuaire') && styles.actionBtnLockedTap]}
              onPress={onBuySanctuary}
              disabled={!isUnlocked('sanctuaire') || sanctuaryMaxed(sanctuaryLevel) || coins < applyDiscount(sanctuaryUpgradeCost(sanctuaryLevel))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>{isUnlocked('sanctuaire') ? `🏛️ Sanctuaire (nv ${sanctuaryLevel}/${SANCTUARY_MAX_LEVEL})` : '🔒 ???'}</Text>
                <Text style={styles.actionBtnSubtext}>
                  {isUnlocked('sanctuaire')
                    ? '+2,5% sur TOUTE la production (tap + passif) par niveau'
                    : coreUpgradeRequirement('sanctuaire')}
                </Text>
              </View>
              <Text style={styles.actionBtnCost}>
                {!isUnlocked('sanctuaire') ? '🔒' : sanctuaryMaxed(sanctuaryLevel) ? '⭐ MAX' : `💰 ${formatNum(applyDiscount(sanctuaryUpgradeCost(sanctuaryLevel)))}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, (!isUnlocked('veilleur') || veilleurMaxed(veilleurLevel) || coins < applyDiscount(veilleurUpgradeCost(veilleurLevel))) && styles.actionBtnDisabled, !isUnlocked('veilleur') && styles.actionBtnLockedTap]}
              onPress={onBuyVeilleur}
              disabled={!isUnlocked('veilleur') || veilleurMaxed(veilleurLevel) || coins < applyDiscount(veilleurUpgradeCost(veilleurLevel))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>{isUnlocked('veilleur') ? `🌙 Veilleur (nv ${veilleurLevel}/${VEILLEUR_MAX_LEVEL})` : '🔒 ???'}</Text>
                <Text style={styles.actionBtnSubtext}>
                  {isUnlocked('veilleur') ? '+5% de gains hors-ligne par niveau' : coreUpgradeRequirement('veilleur')}
                </Text>
              </View>
              <Text style={styles.actionBtnCost}>
                {!isUnlocked('veilleur') ? '🔒' : veilleurMaxed(veilleurLevel) ? '⭐ MAX' : `💰 ${formatNum(applyDiscount(veilleurUpgradeCost(veilleurLevel)))}`}
              </Text>
            </TouchableOpacity>


            {/* Améliorations refondues (02/09) : de simples améliorations
                de plus, dans la continuité de Pacte/Faveur/Sanctuaire/
                Veilleur juste au-dessus — un niveau, un coût qui grimpe,
                un effet qui se cumule. Plus de paliers, plus de cases
                "??? ???" : tout est visible, le prix suffit à échelonner.
                Triées par coût de base pour que la suite se lise de
                gauche à droite du plus abordable au plus lointain. */}
            {/* 10 paliers de tap, déverrouillés en chaîne. Un palier
                verrouillé reste AFFICHÉ mais grisé, avec sa condition :
                le joueur voit ce qui l'attend et sait quoi viser, au
                lieu d'une boutique qui grandit sans prévenir. */}
            <Text style={styles.shopTierHeader}>✊ Puissance de tap</Text>
            {TAP_UPGRADES.map((item, index) => {
              const level = tapUpgrades[item.id] || 0;
              const unlocked = tapUpgradeUnlocked(index, tapPower, tapUpgrades);
              const cost = applyDiscount(tapUpgradeCost(item, level));
              const canBuy = unlocked && coins >= cost;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.actionBtn, !canBuy && styles.actionBtnDisabled, !unlocked && styles.actionBtnLockedTap]}
                  onPress={() => onBuyTapUpgrade(item.id)}
                  disabled={!canBuy}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionBtnText}>
                      {unlocked ? `${item.emoji} ${item.name} (nv ${level})` : '🔒 ???'}
                    </Text>
                    <Text style={styles.actionBtnSubtext}>
                      {unlocked
                        ? `+${formatNum(item.bonus)} par tap et par niveau${level > 0 ? ` · actuellement +${formatNum(item.bonus * level)}` : ''}`
                        : index === 0
                        ? `Se débloque au niveau ${TAP_UPGRADE_FIRST_PACTE_LEVEL} de Pacte`
                        : `Se débloque à ${TAP_UPGRADE_UNLOCK_LEVEL} niveaux de ${TAP_UPGRADES[index - 1].name}`}
                    </Text>
                  </View>
                  <Text style={styles.actionBtnCost}>{unlocked ? `💰 ${formatNum(cost)}` : '🔒'}</Text>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.shopTierHeader}>💎 Améliorations de créatures</Text>
            {[...UPGRADE_ITEMS].sort((a, b) => a.cost - b.cost).map((item) => {
              const level = upgradeLevels[item.id] || 0;
              const cost = applyDiscount(upgradeItemCost(item, level));
              const canAfford = coins >= cost;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.actionBtn, !canAfford && styles.actionBtnDisabled]}
                  onPress={() => onBuyUpgradeItem(item.id)}
                  disabled={!canAfford}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionBtnText}>
                      {item.emoji} {item.name} (nv {level})
                    </Text>
                    <Text style={styles.actionBtnSubtext}>
                      {item.desc} par niveau{level > 0 ? ` · actuellement ${describeUpgradeTotal(item, level)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.actionBtnCost}>💰 {formatNum(cost)}</Text>
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <>
            <Text style={styles.pickerSubtitle}>Seule source de revenu passif du jeu — les créatures n'en produisent plus.</Text>
            {/* Auto-clics : même refonte que les améliorations (02/09).
                Les 15 générateurs sont listés d'affilée par coût
                croissant, sans palier ni case "??? ???" — c'est déjà la
                progression naturelle d'un clicker, le prix fait le
                travail tout seul. */}
            {[...AUTOCLICKERS].sort((a, b) => a.baseCost - b.baseCost).map((clicker) => {
              const ownedCount = autoClickers[clicker.id] || 0;
              const cost = applyDiscount(autoClickerCost(clicker, ownedCount));
              const canAfford = coins >= cost;
              return (
                <View key={clicker.id} style={styles.shopRow}>
                  <Text style={styles.shopRowEmoji}>{clicker.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopRowName}>{clicker.name}</Text>
                    <Text style={styles.shopRowInfo}>
                      Possédé : {ownedCount} · +{clicker.baseIncome.toFixed(1)}/s chacun
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.shopBuyBtn, !canAfford && styles.actionBtnDisabled]}
                    onPress={() => onBuyAutoClicker(clicker.id)}
                    disabled={!canAfford}
                  >
                    <Text style={styles.shopBuyBtnText} numberOfLines={1}>💰 {formatNum(cost)}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Onglet Quêtes : l'œuf (5 apparences selon la progression), les 4
// quêtes du cycle en cours avec leur barre de progression, puis la
// séquence finale (éclosion 500 taps -> capture 200 taps) une fois les 4
// quêtes validées.
function CollectionView({ owned, selectedCreature, setSelectedCreature, coins, pendingDiscount, nextSummonCost, onSummon }) {
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  return (
    <View style={{ flex: 1, paddingTop: 64 }}>
      <FlatList
        data={CREATURES}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.summonBtn, coins < nextSummonCost && styles.actionBtnDisabled]}
            onPress={onSummon}
            disabled={coins < nextSummonCost}
          >
            <Text style={styles.summonBtnText}>🥚 Invoquer une créature</Text>
            <Text style={styles.summonBtnCost}>💰 {formatNum(nextSummonCost)}</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => {
          const own = ownedMap[item.id];
          const discovered = !!own;
          const stage = discovered ? stageForLevel(own.level) : 0;
          const display = discovered ? item.stages[stage] : null;
          return (
            <TouchableOpacity
              style={[styles.creatureCell, !discovered && styles.creatureCellLocked]}
              onPress={() => discovered && setSelectedCreature(item.id)}
              disabled={!discovered}
            >
              <Text style={styles.creatureEmoji}>{discovered ? display.emoji : '❔'}</Text>
              <Text style={styles.creatureName} numberOfLines={1}>{discovered ? display.name : '???'}</Text>
              {discovered && <Text style={styles.creatureLevel}>Nv {own.level}</Text>}
              <Text style={[styles.creatureRarity, { color: RARITY_COLOR[item.rarity] }]}>{RARITY_LABEL[item.rarity]}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {selectedCreature && ownedMap[selectedCreature] && (
        <CreatureDetail
          creature={CREATURES.find((c) => c.id === selectedCreature)}
          owned={ownedMap[selectedCreature]}
          coins={coins}
          onClose={() => setSelectedCreature(null)}
          pendingDiscount={pendingDiscount}
        />
      )}
    </View>
  );
}

function CreatureDetail({ creature, owned, coins, onClose, pendingDiscount }) {
  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const baseName = creature.stages[0].name;
  const power = CREATURE_POWERS[creature.id];
  const combatStats = combatStatsForCreatureTyped(creature, owned.level, owned.evolutionTier || 0);
  const baseCost = levelUpCost(creature, owned.level);
  const cost = pendingDiscount ? Math.max(1, Math.round(baseCost * (1 - pendingDiscount.percent))) : baseCost;
  const nextEvoLevel = stage === 0 ? 5 : stage === 1 ? 15 : null;

  return (
    <View style={styles.detailOverlay}>
      <TouchableOpacity style={styles.detailClose} onPress={onClose}>
        <Text style={styles.detailCloseText}>✕</Text>
      </TouchableOpacity>
      {/* maxHeight sur un View englobant plutôt que directement sur le
          ScrollView — plus fiable en React Native (le pourcentage sur un
          ScrollView peut ne pas se calculer correctement selon les
          versions), c'est ce qui empêchait de défiler jusqu'au bouton
          "Nourrir" en bas de la fiche. */}
      <View style={styles.detailPanelWrap}>
        <ScrollView style={styles.detailPanel} contentContainerStyle={styles.detailPanelContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.rarityBadgeSmall, { backgroundColor: RARITY_COLOR[creature.rarity] }]}>
              <Text style={styles.rarityBadgeSmallText}>{RARITY_BADGE_LETTER[creature.rarity]}</Text>
            </View>
            <Text style={styles.elementLabelSmall}>{creature.element}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.detailEmoji}>{display.emoji}</Text>
            <Text style={styles.detailName}>{display.name}</Text>
          </View>
        </View>

        <Text style={[styles.creatureRarity, { color: RARITY_COLOR[creature.rarity] }]}>
          {RARITY_LABEL[creature.rarity]} · {creature.combatType}
        </Text>
        <Text style={styles.detailStat}>Niveau {owned.level}</Text>
        {nextEvoLevel && <Text style={styles.detailEvoHint}>Évolue au niveau {nextEvoLevel}</Text>}

        <View style={styles.combatStatsRow}>
          <Text style={styles.combatStatItem}>❤️ {combatStats.hp} PV</Text>
          <Text style={styles.combatStatItem}>⚔️ {combatStats.attack} ATQ</Text>
          <Text style={styles.combatStatItem}>👆 {combatStats.clickSpeed} vitesse</Text>
          <Text style={styles.combatStatItem}>🔋 {combatStats.endurance} END</Text>
        </View>

        <Text style={styles.detailPowerHint}>✨ Pouvoir dédié (bulle) : {power.name}</Text>

        <View style={styles.skillsBox}>
          <Text style={styles.sectionTitleSmall}>⚔️ Attaques</Text>
          {creature.skills.map((skill) => (
            <View key={skill.id} style={styles.skillRowSmall}>
              <Text style={styles.skillNameSmall}>{skill.name}</Text>
              <Text style={styles.skillStatsSmall}>{skill.damage} dégâts · {skill.enduranceCost} END</Text>
            </View>
          ))}
        </View>

        {creature.lore && (
          <View style={styles.skillsBox}>
            <Text style={styles.sectionTitleSmall}>📖 Histoire</Text>
            {display.name !== baseName && <Text style={styles.speciesNoteSmall}>Forme de base : {baseName}</Text>}
            <Text style={styles.loreTextSmall}>{creature.lore}</Text>
          </View>
        )}

        {/* Le nourrissage en pièces a été retiré : les créatures se
            montent uniquement en Griffes, depuis l'Aventure, où cette
            monnaie vit. Laisser le bouton ici aurait fait coexister deux
            systèmes d'amélioration payés dans deux monnaies différentes.
            On indique le chemin plutôt que de laisser un vide. */}
        <View style={styles.upgradeHintBox}>
          <Text style={styles.upgradeHintText}>
            🐾 Améliore cette créature depuis l'Exploration : ouvre son deck et touche sa fiche.
          </Text>
          <Text style={styles.upgradeHintCost}>Prochain niveau : {formatNum(cost)} Griffes</Text>
        </View>
        </ScrollView>
      </View>
    </View>
  );
}

// Position aléatoire en anneau AUTOUR de l'œuf (pas dessus, pas dans un
// coin fixe) — angle et rayon tirés au hasard à chaque apparition.
function randomRingPosition() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 32 + Math.random() * 10; // % de la zone, autour du centre
  return {
    leftPct: 50 + Math.cos(angle) * radius,
    topPct: 50 + Math.sin(angle) * radius,
  };
}

function SpawnedCreatureBubble({ spawned, onClaim }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const drift = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 350, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 350, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    // Dérive douce et continue (flotte lentement autour de son point
    // d'apparition, jamais tout à fait immobile).
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: { x: 10, y: -8 }, duration: 1400, useNativeDriver: true }),
        Animated.timing(drift, { toValue: { x: -10, y: 8 }, duration: 1400, useNativeDriver: true }),
        Animated.timing(drift, { toValue: { x: 0, y: 0 }, duration: 1400, useNativeDriver: true }),
      ])
    );
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [pulse, drift]);

  const display = spawned.creature.stages[0];
  const color = RARITY_COLOR[spawned.creature.rarity];

  return (
    <TouchableOpacity
      onPress={onClaim}
      style={[styles.spawnBubbleWrap, { left: `${spawned.leftPct}%`, top: `${spawned.topPct}%` }]}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
    >
      <Animated.View
        style={[
          styles.spawnBubble,
          { borderColor: color, transform: [...drift.getTranslateTransform(), { scale: pulse }] },
        ]}
      >
        <Text style={styles.spawnBubbleEmoji}>{display.emoji}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Cible dorée : pulsation plus rapide (courte durée de vie, doit se voir
// tout de suite), pas de dérive — l'urgence vient du rythme, pas du
// mouvement.
function GoldenTargetBubble({ target, onClaim }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 220, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <TouchableOpacity
      onPress={onClaim}
      style={[styles.spawnBubbleWrap, { left: `${target.leftPct}%`, top: `${target.topPct}%` }]}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
    >
      <Animated.View style={[styles.goldenBubble, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.spawnBubbleEmoji}>✨</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Bulle "Rituel" (pub de boost) — remplace l'ancienne bannière fixe en
// bas. Même famille visuelle que la cible dorée mais teintée différemment
// pour qu'on la distingue au premier coup d'œil, pulsation plus lente
// (elle reste affichée plus longtemps, moins d'urgence).
function RitualBubble({ target, onClaim }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 380, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 380, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <TouchableOpacity
      onPress={onClaim}
      style={[styles.spawnBubbleWrap, { left: `${target.leftPct}%`, top: `${target.topPct}%` }]}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
    >
      <Animated.View style={[styles.ritualBubble, { transform: [{ scale: pulse }] }]}>
        <Text style={styles.spawnBubbleEmoji}>🕯️</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Barre de navigation du bas — Shop | Quêtes | Collection | Aventure.
// Icônes vectorielles (Ionicons, fournies avec Expo, libres de droits)
// plutôt que du texte ou des images tirées du web, pour rester sûr sur le
// plan des droits et cohérent techniquement.
// Barre de défi segmentée affichée sur l'écran d'accueil, juste au-dessus
// du deck (02/09). Remplace entièrement l'ancien onglet Quêtes : un seul
// défi montré à la fois — le premier non terminé des 4 du cycle en cours
// — avec le libellé au-dessus et une barre découpée en segments façon
// Monster Legends (pastille d'icône à gauche, fraction à droite).
//
// Le nombre de segments est PLAFONNÉ à 6 : certaines quêtes ont un
// objectif à 20 (coups critiques), et 20 segments sur un écran de 380px
// donneraient des traits de 2px illisibles. Au-delà du plafond, chaque
// segment représente donc plusieurs unités, mais la fraction affichée à
// droite reste toujours la vraie valeur (3/20), jamais la valeur
// ramenée à l'échelle des segments.
const CHALLENGE_MAX_SEGMENTS = 6;

// Barre de défi (écran d'accueil) — fond réel fourni par l'utilisateur
// (mobile/assets/icons/challenge-bar.png, 900x295, ratio figé via
// aspectRatio pour que les positions en % ci-dessous tombent toujours
// au bon endroit quelle que soit la largeur de l'écran). TOUT le texte
// vit maintenant DANS le cadre (étiquette dans la zone vide au-dessus
// du cercle/gemmes, "Défi X sur Y" dans la zone vide en dessous) —
// signalé par l'utilisateur, correspond aussi à l'emplacement exact de
// la maquette Gemini d'origine.
const CHALLENGE_CARD_ASPECT_RATIO = 900 / 295;
// Re-mesuré (05/09) directement sur une capture réelle de l'appli,
// carte défi + cristaux visibles ensemble — les anciennes valeurs
// (mesurées sur challenge-bar.png isolé, avant intégration) étaient
// décalées d'environ 10% vers la droite : le cristal du slot 1 tombait
// pile sur l'emplacement visuel de la gemme 2, signalé "cristal
// manquant sur la 1ère case" alors que le vrai souci était un décalage
// de positions, pas un bug de logique de remplissage.
const CHALLENGE_GEM_X_PCT = [20.6, 33.0, 44.8, 57.2, 69.1, 80.9];

function ChallengeBar({ icon, label, current, target, cycleIndex, cycleTotal }) {
  const segments = Math.max(1, Math.min(CHALLENGE_MAX_SEGMENTS, target));
  const ratio = target > 0 ? Math.min(1, current / target) : 0;
  const filled = Math.floor(ratio * segments);

  return (
    <ImageBackground
      source={require('../../../assets/icons/challenge-bar.png')}
      style={styles.challengeCard}
      resizeMode="stretch"
    >
      {/* Étiquette du défi — zone vide mesurée au-dessus du cercle. */}
      <View style={styles.challengeLabelZone}>
        <Text style={styles.challengeLabel} numberOfLines={2}>
          {icon} {label}
        </Text>
      </View>

      {/* Icône du défi, centrée sur le cercle peint dans l'image. */}
      <View style={styles.challengeIconZone}>
        <Text style={styles.challengeIconText}>{icon}</Text>
      </View>

      {/* Cristal lumineux par gemme REMPLIE (asset réel, remplace
          l'ancienne pastille dorée) — itère sur les 6 positions FIXES
          (CHALLENGE_GEM_X_PCT) et compare l'index plutôt que de
          reconstruire un tableau de longueur variable (Array.from a été
          remplacé : signalé que la 1ère case ne recevait jamais son
          cristal, cette forme élimine tout doute sur les clés React).
          Les gemmes non remplies restent grisées telles quelles. */}
      {CHALLENGE_GEM_X_PCT.map((pct, i) =>
        i < filled ? (
          <Image
            key={pct}
            source={require('../../../assets/icons/gem-filled.png')}
            style={[styles.challengeGemFilled, { left: `${pct}%` }]}
            resizeMode="contain"
          />
        ) : null
      )}

      {/* adjustsFontSizeToFit : la place entre la 6e gemme et le bord du
          cadre est mesurée mais reste étroite — un gros nombre (ex.
          "428/5 000") se réduit tout seul plutôt que d'être coupé
          (signalé caché par l'utilisateur). */}
      <Text
        style={styles.challengeCount}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {formatNum(current)}/{formatNum(target)}
      </Text>

      {cycleTotal > 0 && (
        <View style={styles.challengeCycleZone}>
          <Text style={styles.challengeCycle} numberOfLines={2}>
            Défi {Math.min(cycleIndex + 1, cycleTotal)} sur {cycleTotal} avant l'éclosion
          </Text>
        </View>
      )}
    </ImageBackground>
  );
}

function BottomTabBar({ view, setView, onAdventurePress, ownedCount, totalCreatures }) {
  return (
    <View style={styles.bottomBar}>
      {/* Chaque onglet : icone dans une case encadree de cyan, libelle
          dessous — le motif de la maquette. La case active passe en
          dore, couleur d'accent du jeu partout ailleurs. Icones = vrais
          assets recadrés depuis la maquette Gemini fournie par
          l'utilisateur (mobile/assets/icons/), plus des Ionicons du
          tout début du projet. */}
      <TouchableOpacity style={styles.bottomBarItem} onPress={() => setView('shop')}>
        <View style={[styles.navBox, view === 'shop' && styles.navBoxActive]}>
          <Image source={require('../../../assets/icons/nav-shop.png')} style={styles.navBoxImage} resizeMode="contain" />
        </View>
        <Text style={[styles.bottomBarLabel, view === 'shop' && styles.bottomBarLabelActive]}>SHOP</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bottomBarItem} onPress={() => setView('collection')}>
        <View style={[styles.navBox, view === 'collection' && styles.navBoxActive]}>
          <Image source={require('../../../assets/icons/nav-collection.png')} style={styles.navBoxImage} resizeMode="contain" />
          <View style={styles.bottomBarBadge}><Text style={styles.bottomBarBadgeText}>{ownedCount}</Text></View>
        </View>
        <Text style={[styles.bottomBarLabel, view === 'collection' && styles.bottomBarLabelActive]}>COLLECTION</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bottomBarItem} onPress={onAdventurePress}>
        <View style={styles.navBox}>
          <Image source={require('../../../assets/icons/nav-exploration.png')} style={styles.navBoxImage} resizeMode="contain" />
        </View>
        <Text style={styles.bottomBarLabel}>EXPLORATION</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  loadingText: { color: COLORS.muted, textAlign: 'center', marginTop: 40 },
  // Positionnement ABSOLU en % du plein écran (04/09) — sur demande
  // explicite de l'utilisateur, qui a utilisé un outil de glisser-
  // déposer pour fixer les coordonnées exactes, en réaction au flux
  // flex (marges + aspectRatio en cascade) qui donnait des résultats
  // imprévisibles dans ExpoGo. Chaque grand bloc de l'écran Élevage a
  // maintenant un top/left figé, plus aucun calcul en chaîne.
  // Conteneur ABSOLU (a pris la position/zIndex de l'ancien header) —
  // regroupe le bouton retour (sans fond, voir BackButton) ET la
  // pilule bleue du titre, côte à côte. La "grosse case bleue" signalée
  // moche autour du bouton retour : c'était CE fond qui enveloppait
  // aussi le bouton avant. Maintenant le fond bleu n'entoure plus QUE
  // le titre.
  // Ne contient plus que le bouton retour (case "Élevage" retirée
  // complètement, sur demande explicite) — width réduite au strict
  // nécessaire, plus besoin de place pour une pilule de titre.
  headerRow: {
    position: 'absolute', left: SCREEN_W * 0.068, top: SCREEN_H * 0.008, zIndex: 3,
  },

  // Pilule de pièces — fond réel (coins-pill.png, 520x210, sac déjà
  // peint sur la gauche). Largeur fixe (pas '100%' comme le cadre de
  // défi : cette pilule doit rester compacte et centrée, pas s'étirer).
  // Pilule de pièces — fond réel (coins-pill.png, 460x180, re-détourée
  // avec érosion du masque alpha pour supprimer le liseré clair
  // résiduel sur les bords, signalé "pas bien fait sur les côtés").
  // Réduite (220 -> 165, signalé trop grande).
  // Remontée de ~5mm (~32dp — 1mm ≈ 6,3dp à la densité de référence
  // 160dpi) avec le cadre du deck, sur demande explicite.
  coinsPill: {
    position: 'absolute', left: SCREEN_W * 0.303, top: SCREEN_H * 0.096 - 32, zIndex: 3,
    width: 165, aspectRatio: 460 / 180,
    alignItems: 'center', justifyContent: 'center',
  },
  // Zone de texte dans l'espace vide à droite du sac peint (mesuré sur
  // le nouvel asset : le sac + son cadre occupent ~36% de la largeur).
  coinsPillText: {
    position: 'absolute', left: '38%', right: '8%', top: 0, bottom: 0,
    color: COLORS.action, fontSize: 15, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center',
    textShadowColor: 'rgba(245,197,66,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6,
  },
  incomeText: {
    position: 'absolute', left: SCREEN_W * 0.1, top: SCREEN_H * 0.13, width: SCREEN_W * 0.8, zIndex: 3,
    color: COLORS.good, fontSize: 13, fontWeight: '700', textAlign: 'center',
  },

  welcomeBanner: {
    position: 'absolute', left: SCREEN_W * 0.08, top: SCREEN_H * 0.145, width: SCREEN_W * 0.84, zIndex: 3,
    backgroundColor: 'rgba(0,230,118,0.15)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.good,
  },
  welcomeText: { color: COLORS.good, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  powerBanner: {
    position: 'absolute', left: SCREEN_W * 0.08, top: SCREEN_H * 0.145, width: SCREEN_W * 0.84, zIndex: 3,
    backgroundColor: 'rgba(245,197,66,0.15)', borderRadius: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.action,
  },
  discountBanner: { backgroundColor: 'rgba(46,127,184,0.15)', borderColor: '#3ec6f0' },

  discountBannerText: { color: '#3ec6f0' },
  powerBannerText: { color: COLORS.action, fontSize: 12, fontWeight: '800', textAlign: 'center' },

  // Barre de défi (écran d'accueil) — cadre réel (challenge-bar.png),
  // voir le composant ChallengeBar pour le détail des coordonnées.
  // Étiquette et "Défi X sur Y" vivent maintenant DANS le cadre (zones
  // vides mesurées au-dessus/en-dessous du cercle+gemmes) — plus de
  // wrap ni de marges externes, tout est à l'intérieur de l'image.
  // Remontée de ~2mm (~13dp) sur demande explicite.
  challengeCard: {
    position: 'absolute', left: SCREEN_W * 0.061, top: SCREEN_H * 0.157 - 13, zIndex: 3,
    width: SCREEN_W * 0.88, aspectRatio: CHALLENGE_CARD_ASPECT_RATIO,
  },
  // Zone vide mesurée entre le bord supérieur du cadre et le cercle
  // (9,3% à 39,8% de la hauteur).
  challengeLabelZone: {
    position: 'absolute', left: '8%', right: '8%', top: '9.3%', height: '30.5%',
    alignItems: 'center', justifyContent: 'center',
  },
  challengeLabel: { color: COLORS.text, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  // Cercle peint à 7,2% / 57,5% du cadre, ~7,7% de diamètre.
  challengeIconZone: {
    position: 'absolute', left: '2.8%', top: '46%', width: '9%', height: '23%',
    alignItems: 'center', justifyContent: 'center',
  },
  challengeIconText: { fontSize: 15 },
  // Pastille de progression, centrée sur la gemme peinte correspondante
  // (CHALLENGE_GEM_X_PCT). Largeur/hauteur en dur plutôt qu'en % : une
  // petite pastille ronde n'a pas besoin de suivre l'échelle du cadre.
  // Cristal lumineux (gem-filled.png, 240x77) redimensionné pour
  // couvrir la gemme peinte sous-jacente — largeur ≈ 10,6% du cadre
  // (même mesure que la gemme peinte elle-même), hauteur dérivée du
  // ratio propre de l'asset (240/77) plutôt que forcée, pour ne pas le
  // déformer.
  challengeGemFilled: {
    position: 'absolute', top: '57.5%',
    width: SCREEN_W * 0.88 * 0.106, height: (SCREEN_W * 0.88 * 0.106) / (240 / 77),
    marginLeft: -(SCREEN_W * 0.88 * 0.106) / 2, marginTop: -((SCREEN_W * 0.88 * 0.106) / (240 / 77)) / 2,
  },
  // Fraction actuelle/cible — dans la marge à droite de la 6e gemme,
  // avant le bord arrondi du cadre (place mesurée : ~4% de large, d'où
  // adjustsFontSizeToFit sur le Text lui-même : un gros nombre se
  // réduit plutôt que d'être coupé, signalé caché par l'utilisateur).
  challengeCount: {
    position: 'absolute', right: '1.5%', top: '46%', width: '11%', height: '23%',
    color: COLORS.action, fontSize: 11, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center',
  },
  // Remontée de ~2mm (~13dp) sur demande explicite.
  devSkipBtn: {
    position: 'absolute', left: SCREEN_W * 0.258, top: SCREEN_H * 0.303 - 13, zIndex: 3,
    paddingVertical: 5, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#7a5cff', backgroundColor: 'rgba(122,92,255,0.12)',
  },
  devSkipBtnText: { color: '#b3a0ff', fontSize: 11, fontWeight: '800' },
  actionBtnLockedTap: { opacity: 0.45, borderStyle: 'dashed' },
  // Zone vide mesurée entre le bas de la pilule et le bord inférieur du
  // cadre (74,75% à 96,6% de la hauteur).
  challengeCycleZone: {
    position: 'absolute', left: '8%', right: '8%', top: '74.75%', height: '21.85%',
    alignItems: 'center', justifyContent: 'center',
  },
  challengeCycle: { color: COLORS.muted, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  spawnBubbleWrap: { position: 'absolute', zIndex: 10, marginLeft: -27, marginTop: -27 },
  spawnBubble: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5,
    shadowColor: '#fff', shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  spawnBubbleEmoji: { fontSize: 28 },
  goldenBubble: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: '#3d2f00',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: COLORS.action,
    shadowColor: COLORS.action, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  ritualBubble: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: '#2a1f42',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#b96bff',
    shadowColor: '#b96bff', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },

  // Barre de navigation du bas — Shop | Quêtes | Collection | Aventure.
  // Positionnement ABSOLU (voir header) — partagé par les 3 onglets
  // (tap/shop/collection), donc leur ScrollView/FlatList a besoin d'un
  // paddingBottom compensatoire (voir styles.grid et ShopView) pour ne
  // pas finir caché sous cette barre devenue flottante.
  // Élargie à 100% (bord à bord) sur demande explicite — avant 96% avec
  // une marge de chaque côté.
  bottomBar: {
    position: 'absolute', left: 0, top: SCREEN_H * 0.9, zIndex: 5,
    flexDirection: 'row', width: SCREEN_W, borderTopWidth: 2, borderTopColor: COLORS.action,
    paddingTop: 8, backgroundColor: COLORS.bg,
    shadowColor: COLORS.action, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: -4 }, elevation: 4,
  },
  bottomBarItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  // Case encadree autour de l'icone, comme sur la maquette.
  navBox: {
    width: 52, height: 48, borderRadius: 10,
    borderWidth: 1, borderColor: '#2a6f96', backgroundColor: 'rgba(16,40,64,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  navBoxImage: { width: 40, height: 40 },
  navBoxActive: {
    borderColor: COLORS.action, backgroundColor: 'rgba(246,195,67,0.12)',
    shadowColor: COLORS.action, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  bottomBarLabel: { color: NAV_CYAN, fontSize: 8.5, fontWeight: '800', marginTop: 4, letterSpacing: 0.4 },
  bottomBarLabelActive: { color: COLORS.action },
  bottomBarBadge: {
    position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.action,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  bottomBarBadgeText: { color: '#241a00', fontSize: 9, fontWeight: '900' },

  // Les 2 pages internes de l'écran Shop.
  shopPageRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  shopPageBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border },
  shopPageBtnActive: { backgroundColor: COLORS.action, borderColor: COLORS.action },
  shopPageBtnText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  shopPageBtnTextActive: { color: '#241a00' },

  // ---- Calendrier de connexion ----
  calBtn: {
    position: 'absolute', left: SCREEN_W * 0.015, top: SCREEN_H * 0.334, zIndex: 3,
    width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ff2d2d', shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  calBtnImageWrap: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  calBtnImage: { width: 62, height: 62 },
  calBtnDot: {
    position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.action, borderWidth: 2, borderColor: COLORS.bg,
  },
  calOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  calPanel: {
    width: '100%', maxWidth: 360, borderRadius: 14, padding: 14,
    backgroundColor: COLORS.panel, borderWidth: 2, borderColor: COLORS.neonCyan,
  },
  calClose: { position: 'absolute', top: 8, right: 8, padding: 6, zIndex: 10 },
  calPanelTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5, marginTop: 2 },
  calPanelSub: { color: COLORS.action, fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 1, marginTop: 3, marginBottom: 10 },
  calGridRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  calBox: {
    backgroundColor: COLORS.panelLight, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', padding: 5,
  },
  calBoxSmall: { flex: 1, height: 74 },
  calBoxLarge: { flex: 1, height: 96 },
  calBoxMedium: { flex: 1, height: 66 },
  calBoxPast: { opacity: 0.4 },
  calBoxToday: { borderColor: COLORS.neonCyan, borderWidth: 2 },
  calBoxClaimable: { backgroundColor: 'rgba(246,195,67,0.18)', borderColor: COLORS.action, borderWidth: 2 },
  calBoxSupreme: { borderColor: COLORS.action, backgroundColor: 'rgba(246,195,67,0.10)' },
  calBoxIcon: { fontSize: 20 },
  calBoxDay: { color: COLORS.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.3, marginTop: 2 },
  calBoxDaySupreme: { color: COLORS.action },
  calBoxLabel: { color: COLORS.muted, fontSize: 7.5, fontWeight: '700', textAlign: 'center', marginTop: 1 },
  calBoxLabelSupreme: { color: COLORS.action, fontWeight: '900' },
  calBoxCheck: { position: 'absolute', top: 3, right: 5, color: COLORS.good, fontSize: 11, fontWeight: '900' },
  calFooter: { color: COLORS.muted, fontSize: 9, fontWeight: '800', textAlign: 'center', letterSpacing: 0.8, marginTop: 4 },
  calProgressTrack: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 5, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border,
  },
  calProgressFill: { height: '100%', backgroundColor: COLORS.action },
  calBigBtn: { backgroundColor: COLORS.action, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  calBigBtnText: { color: '#0b0d16', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  // Cadre du deck — fond réel (deck-frame.png, 800x329). Rétréci encore
  // (72% -> 62%, marges réduites) : pas seulement pour la taille en
  // elle-même, mais parce que son ancien encombrement vertical (largeur
  // 72% + marginBottom 30) participait au débordement qui poussait le
  // cadre par-dessus le bouton dev — plus un souci maintenant, chaque
  // bloc a ses propres coordonnées ABSOLUES indépendantes.
  // Mesuré directement sur la maquette Gemini (screenshot 1080px de
  // large) : cadre à 553px = 49,5% de la largeur PLEINE d'écran.
  // Rétréci (75% -> 55%, signalé encore trop grand), recentré au même
  // point qu'avant (centre à 58,3% conservé), et remonté de ~5mm
  // (~32dp) avec la pilule de pièces sur demande explicite.
  // Centré au vrai centre de l'écran (left = 50% - largeur/2), au lieu
  // du centre décalé (58,3%) hérité d'un ancien réglage. Les créatures
  // suivent automatiquement (DECK_SLOT_X_PCT est en % de CE cadre).
  deckFrame: {
    position: 'absolute', left: SCREEN_W * 0.225, top: SCREEN_H * 0.357 - 32, zIndex: 3,
    width: SCREEN_W * 0.55, aspectRatio: 800 / 329,
  },
  // Positionné en absolu (voir DECK_SLOT_X_PCT), plus de flexDirection
  // row : chaque emplacement tombe exactement sur le panneau peint.
  // Fond translucide (pas COLORS.panel plein, qui ferait un pâté bleu
  // nuit sur le cuir brun) — juste assez pour distinguer la créature/
  // l'œuf du fond, l'anneau de couleur reste le vrai indicateur de rareté.
  // Rapetissé (50 -> 36, signalé trop grand par rapport au cadre
  // réduit à 72%) — même proportion relative qu'avant le rétrécissement
  // du cadre.
  // Rescalé avec le cadre (72% -> 62% de large, même proportion).
  // Rescalé avec le cadre élargi (62% -> 75%, même proportion :
  // 31 * 75/62 ≈ 38). Emplacement vide (🥚) rendu plus visible — trop
  // discret avant (12px, 50% opacité), pouvait donner l'impression d'un
  // 3e emplacement manquant plutôt que juste vide.
  // Rapetissé (38 -> 26), signalé encore trop grand par l'utilisateur.
  // Rescalé avec le cadre (75% -> 55%, ratio 0,733 : 26 -> 19).
  // Doublées (19 -> 38, sur demande explicite : voir DECK_SLOT_DIAMETER_PX).
  deckSlot: {
    position: 'absolute', top: '49%', width: 38, height: 38, borderRadius: 19,
    marginLeft: -19, marginTop: -19,
    backgroundColor: 'rgba(8,19,31,0.35)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  deckSlotEmoji: { fontSize: 19 },
  deckSlotEmpty: { fontSize: 16, opacity: 0.7 },

  // Écran d'accueil : positionnement ABSOLU (voir header) — tapArea
  // (le flex qui centrait tout et causait débordements/désyncs à
  // répétition) a été retiré. tapZone flotte maintenant à ses propres
  // coordonnées, indépendant de tout le reste.
  // RÈGLE ABSOLUE toujours respectée : zone(290) > bouton(260) >
  // image(230), zone en hauteur FIXE (jamais flex).
  // Zone de clic agrandie (290 -> 330) sur demande explicite — la
  // TouchableOpacity couvre TOUTE cette zone (absoluteFillObject), pas
  // seulement le bouton visuel. RÈGLE ABSOLUE : zone(330) > bouton(290)
  // > image(250), zone toujours en hauteur FIXE.
  // Agrandie de 5mm de chaque côté (~32dp, +64 au total) sur demande
  // explicite — top décalé de -32 pour garder l'œuf centré dans la
  // zone plutôt que de laisser grandir seulement vers le bas.
  tapZone: {
    position: 'absolute', left: 0, top: SCREEN_H * 0.564 - 32, zIndex: 2,
    width: '100%', height: 394,
  },
  // Centré (flex) puis décalé de ~2mm (~13dp) vers la droite via
  // transform, sur demande explicite — un translateX ne casse pas le
  // centrage flex sous-jacent, il l'offset juste visuellement.
  tapButtonWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: 13 }] },
  // Plus de rond : ni fond, ni bordure, ni ombre. Les illustrations
  // d'oeuf portent deja leur propre halo peint.
  tapButton: {
    width: 290, height: 290,
    alignItems: 'center', justifyContent: 'center',
  },
  tapEmoji: { fontSize: 84 },
  eggImage: { width: 250, height: 250 },
  // Zone regroupant les textes sous l'œuf — position ABSOLUE, juste
  // sous tapZone (top 56,4% + hauteur fixe 290 + petite marge).
  // Zone regroupant les textes sous l'œuf — position ABSOLUE, juste
  // sous tapZone (top 56,4% + hauteur fixe 330 + petite marge). zIndex
  // remonté à 3 (comme les autres blocs flottants) — signalé invisible
  // pendant la Transe, possible conflit d'empilement avec zIndex:2.
  // Repositionné juste AU-DESSUS de la barre du bas (top 90%) sur
  // demande explicite — ne dépend plus de la hauteur de tapZone.
  tapHintZone: {
    position: 'absolute', left: 0, top: SCREEN_H * 0.9 - 58, zIndex: 3,
    width: '100%', alignItems: 'center',
  },
  tapHint: { color: COLORS.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  eggStageLabel: { color: COLORS.action, fontSize: 11, fontWeight: '800', marginTop: 2, opacity: 0.8, textAlign: 'center' },
  comboText: { color: '#FF7043', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  popup: { position: 'absolute', color: COLORS.action, fontSize: 16, fontWeight: '900' },
  popupCrit: { color: '#FF7043', fontSize: 20 },

  actionBtn: {
    width: '100%', backgroundColor: COLORS.panel, borderRadius: 14, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  actionBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700', flex: 1 },
  actionBtnSubtext: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  actionBtnCost: { color: COLORS.action, fontSize: 13, fontWeight: '800' },
  actionBtnDisabled: { opacity: 0.4 },

  // Paliers d'améliorations/auto-clics à débloquer (30/08).
  shopTierHeader: { color: COLORS.action, fontSize: 14, fontWeight: '900', marginTop: 26, marginBottom: 4 },

  summonBtn: {
    width: '100%', backgroundColor: 'rgba(185,107,255,0.15)', borderRadius: 14, padding: 16, marginTop: 12,
    borderWidth: 1.5, borderColor: '#b96bff', alignItems: 'center',
    shadowColor: '#b96bff', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  summonBtnText: { color: '#b96bff', fontSize: 15, fontWeight: '900' },
  summonBtnCost: { color: COLORS.action, fontSize: 12, fontWeight: '800', marginTop: 4 },

  ascensionBtn: {
    width: '100%', backgroundColor: 'rgba(255,112,67,0.12)', borderRadius: 14, padding: 14, marginTop: 16,
    borderWidth: 1.5, borderColor: '#FF7043', alignItems: 'center',
    shadowColor: '#FF7043', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  ascensionBtnText: { color: '#FF7043', fontSize: 14, fontWeight: '900' },
  ascensionBtnSubtext: { color: COLORS.muted, fontSize: 10, marginTop: 4, textAlign: 'center' },

  offrandeBtn: {
    width: '100%', backgroundColor: 'rgba(62,198,240,0.1)', borderRadius: 14, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: COLORS.neonCyan, alignItems: 'center',
    shadowColor: COLORS.neonCyan, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  offrandeBtnText: { color: COLORS.neonCyan, fontSize: 14, fontWeight: '900' },
  offrandeBtnSubtext: { color: COLORS.muted, fontSize: 10, marginTop: 4, textAlign: 'center' },

  grid: { paddingBottom: 100 },
  creatureCell: {
    flex: 1, margin: 4, backgroundColor: COLORS.panel, borderRadius: 12, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, minHeight: 100,
  },
  creatureCellLocked: { opacity: 0.4 },
  creatureEmoji: { fontSize: 30 },
  creatureName: { color: COLORS.text, fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  creatureLevel: { color: COLORS.muted, fontSize: 9, marginTop: 1 },
  creatureRarity: { fontSize: 8, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },

  detailOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  detailPanelWrap: { width: '100%', maxHeight: '85%' },
  detailPanel: { width: '100%', backgroundColor: COLORS.panel, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  detailPanelContent: { alignItems: 'center', padding: 24, paddingBottom: 40 },
  rewardPanel: { width: '100%', backgroundColor: COLORS.panel, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  detailClose: { position: 'absolute', top: 30, right: 30, padding: 6, zIndex: 10 },
  detailCloseText: { color: COLORS.muted, fontSize: 16, fontWeight: '800' },
  detailEmoji: { fontSize: 64 },
  detailName: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 6 },
  detailStat: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  detailEvoHint: { color: '#b96bff', fontSize: 11, fontWeight: '700', marginTop: 4 },
  detailPowerHint: { color: COLORS.action, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },

  rarityBadgeSmall: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  rarityBadgeSmallText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  elementLabelSmall: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 4 },

  combatStatsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12 },
  combatStatItem: { color: COLORS.text, fontSize: 11, fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  skillsBox: { width: '100%', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 },
  sectionTitleSmall: { color: COLORS.action, fontSize: 12, fontWeight: '900', marginBottom: 6 },
  skillRowSmall: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  skillNameSmall: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  skillStatsSmall: { color: COLORS.action, fontSize: 10, fontWeight: '700' },
  speciesNoteSmall: { color: COLORS.muted, fontSize: 10, fontStyle: 'italic', marginBottom: 4 },
  loreTextSmall: { color: COLORS.text, fontSize: 11, lineHeight: 16 },

  shopRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  shopRowEmoji: { fontSize: 28 },
  shopRowName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  shopRowInfo: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  shopBuyBtn: {
    backgroundColor: COLORS.action, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, minWidth: 84,
    alignItems: 'center', shadowColor: COLORS.action, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  shopBuyBtnText: { color: '#241a00', fontSize: 13, fontWeight: '900' },

  pickerTitle: { color: COLORS.text, fontSize: 17, fontWeight: '900', marginTop: 6 },
  pickerSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 4, marginBottom: 14, textAlign: 'center' },
  pickerEmptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, width: '100%' },
  pickerCell: {
    width: 84, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  pickerCellSelected: { borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.12)' },
  pickerInUse: { color: COLORS.muted, fontSize: 8, marginTop: 2, fontStyle: 'italic' },
  pickerClearBtn: { marginTop: 16, paddingVertical: 8 },
  pickerClearBtnText: { color: '#FF5252', fontSize: 13, fontWeight: '700' },

  feedBtn: { backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28, marginTop: 16, alignItems: 'center' },
  feedBtnText: { color: '#241a00', fontSize: 14, fontWeight: '900' },
  upgradeHintBox: {
    backgroundColor: COLORS.panelLight, borderRadius: 12, padding: 12, marginTop: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  upgradeHintText: { color: COLORS.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  upgradeHintCost: { color: COLORS.action, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4 },


});

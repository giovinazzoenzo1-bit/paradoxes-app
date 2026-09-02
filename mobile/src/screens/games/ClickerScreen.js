// Clicker de Créatures — premier jeu du menu. Tap pour gagner des pièces,
// invoque des créatures (gacha), nourris-les pour les faire monter de
// niveau et évoluer. Revenu passif hors-ligne inclus (plafonné à 4h).
// Persisté via AsyncStorage, indépendant du système de pièces global de
// l'appli (économie propre à ce jeu, comme les autres).
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, FlatList, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdventureScreen from './AdventureScreen';
import { useCoins } from '../../context/CoinsContext';
import { useDaily } from '../../context/DailyContext';
import {
  CREATURES,
  RARITY_LABEL,
  RARITY_COLOR,
  stageForLevel,
  levelUpCost,
  summonCost,
  tapPowerCost,
  rollCreature,
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
  ASCENSION_MIN_LIFETIME_EARNED,
  essenceBonusMultiplier,
  ritualReward,
  ritualReady,
  OFFRANDE_APPCOINS_COST,
  offrandeReward,
  pickQuestSet,
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
  const { coins: sharedCoins, spendCoins: spendSharedCoins } = useCoins();
  const { trackEvent, lifetimeStats, loaded: dailyLoaded } = useDaily();

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
  const [activePower, setActivePower] = useState(null); // {name, rarity, tapMultiplier, expiresAt, effectType}
  const [pendingDiscount, setPendingDiscount] = useState(null); // {percent, name} — consommé au prochain achat
  const [critLevel, setCritLevel] = useState(0); // niveau de "Faveur des Esprits"
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
  const initialQuests = useState(() => pickQuestSet())[0];
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

  const tapScale = useRef(new Animated.Value(1)).current;
  // Secousse latérale de l'œuf, jouée UNIQUEMENT pendant l'éclosion et la
  // capture (02/09). Sans elle, les centaines de taps nécessaires pour
  // briser la coquille n'ont aucun retour visuel autre que le petit
  // rebond d'échelle déjà présent sur un tap normal — le joueur ne
  // distingue plus "je récolte des pièces" de "je casse l'œuf".
  const eggShake = useRef(new Animated.Value(0)).current;

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
          // Les défis sauvegardés sont revalidés contre le pool ACTUEL :
          // un id disparu du pool renverrait une progression de 0 pour
          // toujours et bloquerait l'œuf définitivement. On retire donc
          // au tirage adapté à la progression du joueur.
          const savedQuests = (saved.activeQuestIds || []).filter((id) => QUEST_POOL.some((q) => q.id === id));
          const savedTargets = saved.questTargets || {};
          if (savedQuests.length === QUEST_SET_SIZE) {
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
            const stillOk = savedQuests.filter((id) => {
              const q = QUEST_POOL.find((x) => x.id === id);
              return !q.available || q.available(statsAtLoad);
            });
            let finalQuests = savedQuests;
            if (stillOk.length < savedQuests.length) {
              const replacements = pickQuestSet(stillOk, statsAtLoad).ids.filter((id) => !stillOk.includes(id));
              finalQuests = [...stillOk, ...replacements].slice(0, QUEST_SET_SIZE);
            }
            const resolved = {};
            finalQuests.forEach((id) => {
              const q = QUEST_POOL.find((x) => x.id === id);
              resolved[id] = savedTargets[id] || resolveQuestTarget(q, statsAtLoad);
            });
            setActiveQuestIds(finalQuests);
            setQuestTargets(resolved);
          } else {
            const fresh = pickQuestSet(savedQuests, { totalEarned: saved.totalEarned || 0 });
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
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          coins, totalEarned, tapPower, owned, deck, critLevel,
          autoClickers, upgradeLevels, sanctuaryLevel, veilleurLevel, essence, lastRitualAt,
          totalSummons, totalCrits, goldenClaimed, maxCombo,
          activeQuestIds, questTargets, questBaseline, eggPhase, hatchTaps, captureTaps,
          lastSave: Date.now() / 1000,
        })
      );
    }, 600);
  }, [
    coins, totalEarned, tapPower, owned, deck, critLevel, autoClickers, upgradeLevels, sanctuaryLevel,
    veilleurLevel, essence, lastRitualAt, totalSummons, totalCrits, goldenClaimed, maxCombo,
    activeQuestIds, questTargets, questBaseline, eggPhase, hatchTaps, captureTaps, loaded,
  ]);

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
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          coins: coinsRef.current, totalEarned: totalEarnedRef.current, tapPower: tapPowerRef.current,
          owned: ownedRef.current, deck: deckRef.current, critLevel: critLevelRef.current,
          autoClickers: autoClickersRef.current, upgradeLevels: upgradeLevelsRef.current, sanctuaryLevel: sanctuaryLevelRef.current,
          veilleurLevel: veilleurLevelRef.current, essence: essenceRef.current, lastRitualAt: lastRitualAtRef.current,
          totalSummons: totalSummonsRef.current, totalCrits: totalCritsRef.current,
          goldenClaimed: goldenClaimedRef.current, maxCombo: maxComboRef.current,
          activeQuestIds: activeQuestIdsRef.current, questTargets: questTargetsRef.current,
          questBaseline: questBaselineRef.current, eggPhase: eggPhaseRef.current,
          hatchTaps: hatchTapsRef.current, captureTaps: captureTapsRef.current,
          lastSave: Date.now() / 1000,
        })
      );
    };
  }, []);

  // Point de passage UNIQUE pour tout gain de pièces — applique le
  // multiplicateur global (Sanctuaire × bonus permanent d'Ascension) et
  // alimente le cumul total (totalEarned), qui ne baisse jamais même en
  // dépensant, utilisé pour calculer le gain d'essence à l'Ascension.
  const gainCoins = (rawAmount) => {
    const upgradeCoinMult = 1 + upgradeBonuses(upgradeLevelsRef.current).coinPct;
    const multiplier = sanctuaryMultiplier(sanctuaryLevelRef.current) * essenceBonusMultiplier(essenceRef.current) * upgradeCoinMult;
    const amount = rawAmount * multiplier;
    setCoins((c) => c + amount);
    setTotalEarned((t) => t + amount);
    trackEvent('coinsEarned', amount);
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
    const critMult = isCrit ? critMultiplier(critLevelRef.current) * (1 + upgradeBonus.critMultPct) : 1;
    const effectiveTapPower = tapPowerRef.current + upgradeBonus.tapFlat;
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

  const buyCritUpgrade = () => {
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
    const cost = applyDiscount(sanctuaryUpgradeCost(sanctuaryLevel));
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setSanctuaryLevel((l) => l + 1);
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  const buyVeilleur = () => {
    const cost = applyDiscount(veilleurUpgradeCost(veilleurLevel));
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setVeilleurLevel((l) => l + 1);
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  // Ascension : réinitialise coins/Pacte/Faveur/Familier/Sanctuaire/
  // Veilleur/collection/deck contre un gain d'essence PERMANENT (jamais
  // remis à zéro, même par une nouvelle Ascension).
  const essenceGainPreview = ascensionEssenceGain(totalEarned);
  const doAscension = () => {
    if (essenceGainPreview <= 0) return;
    Alert.alert(
      'Ascension',
      `Tu vas tout réinitialiser (pièces, Pacte, créatures, améliorations) contre +${essenceGainPreview} essence permanente (production x${(essenceBonusMultiplier(essence + essenceGainPreview)).toFixed(2)} pour toujours). Continuer ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ascensionner',
          style: 'destructive',
          onPress: () => {
            setEssence((e) => e + essenceGainPreview);
            setCoins(0);
            setTotalEarned(0);
            setTapPower(1);
            setCritLevel(0);
            setAutoClickers({});
            setSanctuaryLevel(0);
            setVeilleurLevel(0);
            setOwned([]);
            setDeck([null, null, null]);
            setActivePower(null);
            setPendingDiscount(null);
            // L'Ascension vide le deck et la collection. Un défi tiré
            // AVANT (« gagne 3 combats », « nourris une créature »)
            // deviendrait infaisable jusqu'à ce que le joueur réinvoque
            // une créature — et ses cibles chiffrées, calculées sur
            // l'ancien revenu, seraient de toute façon absurdes après un
            // reset à zéro. On repart donc d'un cycle neuf, tiré sur les
            // stats d'après-Ascension.
            const statsAfterAscension = {
              totalEarned: 0, coins: 0, passiveIncome: 0, tapPower: 1,
              autoClickers: {}, autoTotal: 0, upgradeLevels: upgradeLevelsRef.current,
              sanctuaryLevel: 0, veilleurLevel: 0, critLevel: 0,
              essence: essenceRef.current + essenceGainPreview,
              ownedCount: 0, deckCount: 0, maxCreatureLevel: 0,
              maxCombo: Math.round(maxComboRef.current * 10),
              totalSummons: totalSummonsRef.current,
              totalCrits: totalCritsRef.current,
              goldenClaimed: goldenClaimedRef.current,
              battleWon: lifetimeStats.battleWon || 0,
              runeEquipped: lifetimeStats.runeEquipped || 0,
              runeBought: lifetimeStats.runeBought || 0,
            };
            const freshSet = pickQuestSet([], statsAfterAscension);
            setActiveQuestIds(freshSet.ids);
            setQuestTargets(freshSet.targets);
            setQuestBaseline(statsAfterAscension);
            setEggPhase('collecting');
            setHatchTaps(0);
            setCaptureTaps(0);
            hatchTapsRef.current = 0;
            captureTapsRef.current = 0;
          },
        },
      ]
    );
  };

  const passiveIncome =
    totalAutoClickIncome(autoClickers) *
    (activePower && activePower.effectType === 'passive_boost' ? activePower.effectValue : 1) *
    sanctuaryMultiplier(sanctuaryLevel) *
    essenceBonusMultiplier(essence);

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
    setOwned((prev) => {
      const existing = prev.find((o) => o.id === creature.id);
      if (existing) {
        return prev.map((o) => (o.id === creature.id ? { ...o, level: o.level + 1 } : o));
      }
      return [...prev, { id: creature.id, level: 1, evolutionTier: 0 }];
    });
  };

  const doOffrande = () => {
    if (sharedCoins < OFFRANDE_APPCOINS_COST) return;
    spendSharedCoins(OFFRANDE_APPCOINS_COST).then((ok) => {
      if (!ok) return;
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
    // Compteurs Aventure À VIE (DailyContext).
    battleWon: lifetimeStats.battleWon || 0,
    runeEquipped: lifetimeStats.runeEquipped || 0,
    runeBought: lifetimeStats.runeBought || 0,
  };
  const completedQuestCount = activeQuestIds.filter((id) => questComplete(id, questStats, questBaseline, questTargets)).length;

  // Défi mis en avant sur l'écran d'accueil : le PREMIER non terminé des
  // 4 du cycle. Un seul à la fois, volontairement — la barre segmentée
  // reprise de Monster Legends n'a de sens que pour un objectif unique,
  // et empiler 4 barres sur l'accueil recréerait l'onglet Quêtes qu'on
  // vient justement de supprimer. Vaut `null` quand les 4 sont finies
  // (l'affichage bascule alors sur la barre d'éclosion).
  const currentChallengeId = activeQuestIds.find((id) => !questComplete(id, questStats, questBaseline, questTargets)) || null;
  const currentChallenge = currentChallengeId
    ? questDetail(currentChallengeId, questStats, questBaseline, questTargets)
    : null;

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
    if (completedQuestCount >= QUEST_SET_SIZE) {
      setEggPhase((phase) => (phase === 'collecting' ? 'hatching' : phase));
    }
  }, [completedQuestCount, eggPhase]);

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
        const statsAtDraw = {
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
          essence: essenceRef.current,
          ownedCount: ownedRef.current.length,
          deckCount: deckRef.current.filter(Boolean).length,
          maxCreatureLevel: ownedRef.current.reduce((m, o) => Math.max(m, o.level || 0), 0),
          maxCombo: Math.round(maxComboRef.current * 10),
          totalSummons: totalSummonsRef.current,
          totalCrits: totalCritsRef.current,
          goldenClaimed: goldenClaimedRef.current,
          battleWon: lifetimeStats.battleWon || 0,
          runeEquipped: lifetimeStats.runeEquipped || 0,
          runeBought: lifetimeStats.runeBought || 0,
        };
        const nextSet = pickQuestSet(activeQuestIdsRef.current, statsAtDraw);
        setActiveQuestIds(nextSet.ids);
        setQuestTargets(nextSet.targets);
        setQuestBaseline(statsAtDraw);
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

  const feedCreature = (id) => {
    const owned1 = ownedRef.current.find((o) => o.id === id);
    if (!owned1) return;
    const creature = CREATURES.find((c) => c.id === id);
    const cost = applyDiscount(levelUpCost(creature, owned1.level));
    if (coinsRef.current < cost) return;
    setCoins((c) => c - cost);
    if (pendingDiscountRef.current) setPendingDiscount(null);
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
      <View style={styles.screen} {...panHandlers}>
        <Text style={styles.loadingText}>Chargement…</Text>
      </View>
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
        onAssignDeck={assignToDeck}
        onClearDeckSlot={clearDeckSlot}
      />
    );
  }

  return (
    <View style={styles.screen} {...panHandlers}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>🐾 Élevage</Text>
      </View>

      {view === 'tap' && (
        <>
          <Text style={styles.coinsValue}>💰 {formatNum(coins)}</Text>
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

          <View style={styles.tapArea}>
            <DeckRow deck={deck} owned={owned} onSlotPress={setPickerSlot} />

            <View style={styles.tapZone}>
              <TouchableOpacity activeOpacity={1} onPress={handleTap} style={StyleSheet.absoluteFillObject}>
                <View style={styles.tapButtonWrap}>
                  <Animated.View
                    style={[
                      styles.tapButton,
                      // La bordure et la lueur s'intensifient palier par
                      // palier : l'œuf passe de terne à incandescent au
                      // fur et à mesure que les défis tombent.
                      { borderWidth: 3 + eggStageIndex * 0.6, shadowOpacity: 0.25 + eggStageIndex * 0.15 },
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
                    <Text style={[styles.tapEmoji, { opacity: 0.6 + eggStageIndex * 0.1 }]}>
                      {eggPhase === 'capturing' ? '💫' : '🥚'}
                    </Text>
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
          onBuySanctuary={buySanctuary}
          onBuyVeilleur={buyVeilleur}
          onBuyAutoClicker={buyAutoClicker}
          onBuyUpgradeItem={buyUpgradeItem}
          onOffrande={doOffrande}
          essence={essence}
          essenceGainPreview={essenceGainPreview}
          totalEarned={totalEarned}
          onAscend={doAscension}
          onBack={() => setView('tap')}
        />
      )}

      {view === 'collection' && (
        <CollectionView
          owned={owned}
          selectedCreature={selectedCreature}
          setSelectedCreature={setSelectedCreature}
          coins={coins}
          onFeed={feedCreature}
          pendingDiscount={pendingDiscount}
          nextSummonCost={nextSummonCost}
          onSummon={doSummon}
          onBack={() => setView('tap')}
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
    </View>
  );
}

// Les 3 emplacements du deck, affichés au-dessus de l'œuf. Un
// emplacement vide est un œuf grisé — appuyer dessus (rempli ou vide)
// ouvre le sélecteur pour choisir/changer la créature qui l'occupe.
function DeckRow({ deck, owned, onSlotPress }) {
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  return (
    <View style={styles.deckRow}>
      {deck.map((id, i) => {
        const creature = id ? CREATURES.find((c) => c.id === id) : null;
        const own = id ? ownedMap[id] : null;
        const display = creature && own ? creature.stages[stageForLevel(own.level)] : null;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.deckSlot, creature && { borderColor: RARITY_COLOR[creature.rarity] }]}
            onPress={() => onSlotPress(i)}
          >
            {display ? <Text style={styles.deckSlotEmoji}>{display.emoji}</Text> : <Text style={styles.deckSlotEmpty}>🥚</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
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
  coins, sharedCoins, tapPower, critLevel, sanctuaryLevel, veilleurLevel, autoClickers, upgradeLevels,
  applyDiscount, onBuyTapPower, onBuyCrit, onBuySanctuary, onBuyVeilleur, onBuyAutoClicker, onBuyUpgradeItem, onOffrande,
  essence, essenceGainPreview, totalEarned, onAscend, onBack,
}) {
  const [page, setPage] = useState('upgrades'); // 'upgrades' | 'autoclick'

  return (
    <View style={{ flex: 1, width: '100%' }}>
      <TouchableOpacity style={styles.viewBackBtn} onPress={onBack}>
        <Text style={styles.viewBackBtnText}>← Retour au clicker</Text>
      </TouchableOpacity>

      <View style={styles.shopPageRow}>
        <TouchableOpacity style={[styles.shopPageBtn, page === 'upgrades' && styles.shopPageBtnActive]} onPress={() => setPage('upgrades')}>
          <Text style={[styles.shopPageBtnText, page === 'upgrades' && styles.shopPageBtnTextActive]}>Améliorations</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.shopPageBtn, page === 'autoclick' && styles.shopPageBtnActive]} onPress={() => setPage('autoclick')}>
          <Text style={[styles.shopPageBtnText, page === 'autoclick' && styles.shopPageBtnTextActive]}>Auto-clics</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {page === 'upgrades' ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, coins < applyDiscount(tapPowerCost(tapPower)) && styles.actionBtnDisabled]}
              onPress={onBuyTapPower}
              disabled={coins < applyDiscount(tapPowerCost(tapPower))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>🔗 Pacte : {tapPower} → {tapPower + 1}</Text>
                <Text style={styles.actionBtnSubtext}>+1 pièce par tap à chaque niveau</Text>
              </View>
              <Text style={styles.actionBtnCost}>💰 {formatNum(applyDiscount(tapPowerCost(tapPower)))}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, coins < applyDiscount(critUpgradeCost(critLevel)) && styles.actionBtnDisabled]}
              onPress={onBuyCrit}
              disabled={coins < applyDiscount(critUpgradeCost(critLevel))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>✨ Faveur des Esprits (nv {critLevel})</Text>
                <Text style={styles.actionBtnSubtext}>
                  {Math.round(critChance(critLevel) * 100)}% de chance de coup critique x{critMultiplier(critLevel).toFixed(1)}
                </Text>
              </View>
              <Text style={styles.actionBtnCost}>💰 {formatNum(applyDiscount(critUpgradeCost(critLevel)))}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, coins < applyDiscount(sanctuaryUpgradeCost(sanctuaryLevel)) && styles.actionBtnDisabled]}
              onPress={onBuySanctuary}
              disabled={coins < applyDiscount(sanctuaryUpgradeCost(sanctuaryLevel))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>🏛️ Sanctuaire (nv {sanctuaryLevel})</Text>
                <Text style={styles.actionBtnSubtext}>+5% sur TOUTE la production (tap + passif) par niveau</Text>
              </View>
              <Text style={styles.actionBtnCost}>💰 {formatNum(applyDiscount(sanctuaryUpgradeCost(sanctuaryLevel)))}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, coins < applyDiscount(veilleurUpgradeCost(veilleurLevel)) && styles.actionBtnDisabled]}
              onPress={onBuyVeilleur}
              disabled={coins < applyDiscount(veilleurUpgradeCost(veilleurLevel))}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnText}>🌙 Veilleur (nv {veilleurLevel})</Text>
                <Text style={styles.actionBtnSubtext}>+15% de gains hors-ligne par niveau</Text>
              </View>
              <Text style={styles.actionBtnCost}>💰 {formatNum(applyDiscount(veilleurUpgradeCost(veilleurLevel)))}</Text>
            </TouchableOpacity>

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
              <Text style={styles.ascensionBtnText}>🌟 Ascension {essence > 0 ? `(essence : ${essence})` : ''}</Text>
              <Text style={styles.ascensionBtnSubtext}>
                {essenceGainPreview > 0
                  ? `Réinitialise ta progression contre +${essenceGainPreview} essence permanente`
                  : `Gagne encore ${formatNum(ASCENSION_MIN_LIFETIME_EARNED - totalEarned)} pièces au total pour débloquer`}
              </Text>
            </TouchableOpacity>

            {/* Améliorations refondues (02/09) : de simples améliorations
                de plus, dans la continuité de Pacte/Faveur/Sanctuaire/
                Veilleur juste au-dessus — un niveau, un coût qui grimpe,
                un effet qui se cumule. Plus de paliers, plus de cases
                "??? ???" : tout est visible, le prix suffit à échelonner.
                Triées par coût de base pour que la suite se lise de
                gauche à droite du plus abordable au plus lointain. */}
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
function CollectionView({ owned, selectedCreature, setSelectedCreature, coins, onFeed, pendingDiscount, nextSummonCost, onSummon, onBack }) {
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={styles.viewBackBtn} onPress={onBack}>
        <Text style={styles.viewBackBtnText}>← Retour au clicker</Text>
      </TouchableOpacity>
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
          onFeed={() => onFeed(selectedCreature)}
          onClose={() => setSelectedCreature(null)}
          pendingDiscount={pendingDiscount}
        />
      )}
    </View>
  );
}

function CreatureDetail({ creature, owned, coins, onFeed, onClose, pendingDiscount }) {
  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const baseName = creature.stages[0].name;
  const power = CREATURE_POWERS[creature.id];
  const combatStats = combatStatsForCreatureTyped(creature, owned.level, owned.evolutionTier || 0);
  const baseCost = levelUpCost(creature, owned.level);
  const cost = pendingDiscount ? Math.max(1, Math.round(baseCost * (1 - pendingDiscount.percent))) : baseCost;
  const canFeed = coins >= cost;
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

        <TouchableOpacity style={[styles.feedBtn, !canFeed && styles.actionBtnDisabled]} onPress={onFeed} disabled={!canFeed}>
          <Text style={styles.feedBtnText}>🍖 Nourrir</Text>
          <Text style={styles.feedBtnCost}>💰 {formatNum(cost)}</Text>
        </TouchableOpacity>
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

function ChallengeBar({ icon, label, current, target, cycleIndex, cycleTotal }) {
  const segments = Math.max(1, Math.min(CHALLENGE_MAX_SEGMENTS, target));
  const ratio = target > 0 ? Math.min(1, current / target) : 0;
  const filled = Math.floor(ratio * segments);

  return (
    <View style={styles.challengeWrap}>
      <Text style={styles.challengeLabel} numberOfLines={2}>
        {icon} {label}
      </Text>
      <View style={styles.challengeBar}>
        <View style={styles.challengeIconBubble}>
          <Text style={styles.challengeIconText}>{icon}</Text>
        </View>
        <View style={styles.challengeSegments}>
          {Array.from({ length: segments }).map((_, i) => (
            <View key={i} style={[styles.challengeSegment, i < filled && styles.challengeSegmentFilled]} />
          ))}
        </View>
        <Text style={styles.challengeCount}>
          {formatNum(current)}/{formatNum(target)}
        </Text>
      </View>
      {cycleTotal > 0 && (
        <Text style={styles.challengeCycle}>
          Défi {Math.min(cycleIndex + 1, cycleTotal)} sur {cycleTotal} avant l'éclosion
        </Text>
      )}
    </View>
  );
}

function BottomTabBar({ view, setView, onAdventurePress, ownedCount, totalCreatures }) {
  return (
    <View style={styles.bottomBar}>
      <TouchableOpacity style={styles.bottomBarItem} onPress={() => setView('shop')}>
        <View style={view === 'shop' && styles.bottomBarIconGlow}>
          <Ionicons name="storefront" size={24} color={view === 'shop' ? COLORS.action : COLORS.muted} />
        </View>
        <Text style={[styles.bottomBarLabel, view === 'shop' && styles.bottomBarLabelActive]}>Shop</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bottomBarItem} onPress={() => setView('collection')}>
        <View style={view === 'collection' && styles.bottomBarIconGlow}>
          <Ionicons name="albums" size={24} color={view === 'collection' ? COLORS.action : COLORS.muted} />
          <View style={styles.bottomBarBadge}><Text style={styles.bottomBarBadgeText}>{ownedCount}</Text></View>
        </View>
        <Text style={[styles.bottomBarLabel, view === 'collection' && styles.bottomBarLabelActive]}>Collection</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bottomBarItem} onPress={onAdventurePress}>
        <Ionicons name="skull" size={24} color={COLORS.muted} />
        <Text style={styles.bottomBarLabel}>Aventure</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  loadingText: { color: COLORS.muted, textAlign: 'center', marginTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },

  coinsValue: {
    color: COLORS.action, fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 4,
    textShadowColor: 'rgba(245,197,66,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  incomeText: { color: COLORS.good, fontSize: 13, fontWeight: '700', textAlign: 'center' },

  welcomeBanner: { backgroundColor: 'rgba(0,230,118,0.15)', borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.good },
  welcomeText: { color: COLORS.good, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  powerBanner: { backgroundColor: 'rgba(245,197,66,0.15)', borderRadius: 10, paddingVertical: 6, marginTop: 6, borderWidth: 1, borderColor: COLORS.action },
  discountBanner: { backgroundColor: 'rgba(46,127,184,0.15)', borderColor: '#3ec6f0' },
  discountBannerText: { color: '#3ec6f0' },
  powerBannerText: { color: COLORS.action, fontSize: 12, fontWeight: '800', textAlign: 'center' },

  // Barre de défi (écran d'accueil). Reprise du repère visuel Monster
  // Legends : piste sombre en gélule, segments dorés séparés par de
  // vrais espaces (pas une barre continue), pastille d'icône collée à
  // gauche et fraction collée à droite, le tout sur une seule ligne.
  challengeWrap: { marginTop: 10, marginBottom: 2 },
  challengeLabel: { color: COLORS.text, fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  challengeBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.panel, borderRadius: 22,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  challengeIconBubble: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.panelLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  challengeIconText: { fontSize: 14 },
  challengeSegments: { flex: 1, flexDirection: 'row' },
  challengeSegment: {
    flex: 1, height: 16, borderRadius: 8, marginHorizontal: 1.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  challengeSegmentFilled: {
    backgroundColor: COLORS.action,
    shadowColor: COLORS.action, shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  challengeCount: { color: COLORS.action, fontSize: 13, fontWeight: '900', marginLeft: 8, minWidth: 38, textAlign: 'right' },
  challengeCycle: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4 },

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
  bottomBar: {
    flexDirection: 'row', width: '100%', borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 8, marginTop: 6, backgroundColor: COLORS.bg,
  },
  bottomBarItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  bottomBarIconGlow: {
    backgroundColor: 'rgba(245,197,66,0.14)', borderRadius: 20, padding: 6,
    shadowColor: COLORS.action, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  bottomBarLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
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

  deckRow: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  deckSlot: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  deckSlotEmoji: { fontSize: 26 },
  deckSlotEmpty: { fontSize: 22, opacity: 0.35 },

  // Écran d'accueil épuré : l'œuf centré, plus grand qu'avant puisqu'il
  // n'a plus à partager l'espace avec la colonne d'icônes ni la longue
  // liste de boutons (tout ça vit dans les onglets de la barre du bas).
  tapArea: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  tapZone: { width: '100%', height: 260, position: 'relative' },
  tapButtonWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tapButton: {
    width: 180, height: 180, borderRadius: 90, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.action,
    shadowColor: COLORS.action, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  tapEmoji: { fontSize: 84 },
  tapHint: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  eggStageLabel: { color: COLORS.action, fontSize: 11, fontWeight: '800', marginTop: 2, opacity: 0.8 },
  comboText: { color: '#FF7043', fontSize: 12, fontWeight: '900', marginTop: 4 },
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

  viewBackBtn: { paddingVertical: 8, marginBottom: 4 },
  viewBackBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  grid: { paddingBottom: 20 },
  creatureCell: {
    flex: 1, margin: 4, backgroundColor: COLORS.panel, borderRadius: 12, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, minHeight: 100,
  },
  creatureCellLocked: { opacity: 0.4 },
  creatureEmoji: { fontSize: 30 },
  creatureName: { color: COLORS.text, fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  creatureLevel: { color: COLORS.muted, fontSize: 9, marginTop: 1 },
  creatureRarity: { fontSize: 8, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },

  detailOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
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
  feedBtnCost: { color: '#241a00', fontSize: 11, fontWeight: '700', marginTop: 2 },


});

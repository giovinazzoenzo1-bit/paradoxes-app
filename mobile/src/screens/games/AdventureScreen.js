// Écran principal du mode Aventure. Voir mobile/ADVENTURE_MODE.md pour
// le design complet et l'ordre de construction — ceci ajoute l'étape 4
// (carte des chapitres/niveaux, structure visuelle seulement, le vrai
// combat derrière chaque niveau arrive à l'étape 5).
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions, Image, ImageBackground, Animated, Alert } from 'react-native';
import BackButton from '../../components/BackButton';
import CreatureArt from '../../components/CreatureArt';
import { elementTheme } from './elementThemes';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { cardFrameForElement, CARD_FRAME_BORDER_X, CARD_FRAME_BORDER_Y } from './cardFrames';

// Décor d'Exploration (12/09) : mur de pierre gravé + carte au
// parchemin. Remplace l'ancien fond de pierre uni. Le filigrane Gemini
// en bas à droite a été reconstruit par symétrie depuis le bord gauche —
// l'image est vierge.
const EXPLORATION_BG = require('../../../assets/adventure/exploration-bg.jpg');
const TITLE_BANNER = require('../../../assets/adventure/title-banner.png');
const COMBAT_BTN = require('../../../assets/adventure/combat-btn.png');

// Icônes des 2 monnaies de l'écran Exploration (12/09) — remplacent les
// emojis 🐾/💎 partout dans cet écran. Détourées depuis un fond magenta :
// le halo flou généré par Gemini a été retiré à la découpe (il se
// confondait avec le fond et se détourait mal, voir CLICKER_ADVENTURE_
// STATE.md) — le halo visible autour du compteur principal est fait EN
// CODE via <CurrencyIcon>, pas dans l'image.
const GRIFFES_ICON = require('../../../assets/icons/griffes-icon.png');
const RUNES_GEM = require('../../../assets/icons/runes-gem.png');

// Panneau de la boutique de runes (Gemini, détouré ici). Les 3 cases
// sont de vrais TROUS dans l'image : on y rend le contenu en code, donc
// il reste modifiable sans repasser par Gemini. Fractions MESURÉES sur
// l'asset, à remesurer si l'image change.
const RUNES_SHOP_PANEL = require('../../../assets/icons/runes-shop-panel.png');
const SHOP_PANEL_RATIO = 900 / 482;
const SHOP_BANNER = { top: 0.008, bottom: 0.058, left: 0.322, right: 0.672 };
const SHOP_SLOTS = [
  { left: 0.0767, right: 0.3089 },
  { left: 0.3856, right: 0.6133 },
  { left: 0.6878, right: 0.9222 },
];
const SHOP_SLOT_Y = { top: 0.2427, bottom: 0.7178 };

// Offres. Le pack et l'offre spéciale sont volontairement AVANTAGEUX :
// c'est ce qui leur donne une raison d'exister à côté du tirage à
// l'unité. Mesuré — avec 7 types, obtenir 2 runes d'un type PRÉCIS
// demande ~14 tirages, soit 1400 Griffes ; l'offre spéciale livre ce
// résultat pour 300.
const RUNE_PACK_SIZE = 3;
const RUNE_PACK_COST = 250;        // contre 300 à l'unité : -17%
const RUNE_SPECIAL_COST = 300;     // une rune NIVEAU 2 d'un type imposé
const RUNE_OFFER_KEY = 'adventure:runeOffer:v1';

// Halo derrière chaque icône — un dégradé radial PRÉ-RENDU (Gaussian
// blur fait une fois, pas à l'exécution) plutôt que des cercles plats
// superposés : 2-3 anneaux d'opacité fixe créent des bandes visibles au
// lieu d'une lueur, aucune vraie primitive de flou n'existe en RN pur.
const GLOW_GOLD = require('../../../assets/icons/glow-gold.png');
const GLOW_CYAN = require('../../../assets/icons/glow-cyan.png');
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from './clickerTheme';
import CombatScreen from './CombatScreen';
import { DeckPicker } from './DeckPicker';
import { CREATURES, RARITY_LABEL, RARITY_COLOR, RARITY_BADGE_LETTER, stageForLevel, levelUpCost } from '../../games/clicker/clickerLogic';
import { useDaily, PENDING_GRIFFES_KEY } from '../../context/DailyContext';
import {
  combatStatsForCreatureTyped,
  chapterForLevel,
  levelIndexInChapter,
  LEVELS_PER_CHAPTER,
  opponentForLevel,
  griffesReward,
  butinBonus,
  canEvolve,
  evolutionCost,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  computeEnergyRegen,
  msUntilNextEnergy,
} from '../../games/clicker/combatLogic';

// NOTIFICATIONS RETIREES (03/09).
//
// expo-notifications faisait planter le demarrage sous Expo Go :
//   « Android Push notifications functionality provided by
//     expo-notifications was removed from Expo Go with the release of
//     SDK 53. Use a development build instead of Expo Go. »
//
// Le code etait pourtant deja protege par try/catch, mais ca ne servait
// a rien : l'erreur vient du CHARGEMENT du module (addPushTokenListener
// est appele a l'import), donc avant que le moindre try/catch du projet
// puisse intervenir. Un import statique ne peut pas etre rattrape.
//
// La notification « energie pleine » n'etait qu'un bonus — la
// regeneration d'energie fonctionne exactement pareil sans elle. On
// remplace donc l'appel par une fonction vide plutot que de garder une
// dependance qui empeche l'appli de demarrer.
//
// A rebrancher le jour ou on passera aux development builds, ou
// expo-notifications fonctionne a nouveau.
async function scheduleEnergyFullNotification(msFromNow) {
  // Volontairement vide : voir le commentaire ci-dessus.
}

// Sauvegarde séparée de celle du clicker classique — la progression
// d'Aventure grossira avec le temps (niveaux, ressource Griffes...), pas
// la peine d'alourdir davantage la sauvegarde déjà volumineuse du clicker.
const ADVENTURE_STORAGE_KEY = 'adventure:state:v1';
// Drapeau dev "Ajouter des Griffes" (posé depuis Options) — même schéma
// de sécurité que DEV_UNLOCK_ALL_KEY dans ClickerScreen.js : jamais
// d'écriture directe dans la sauvegarde depuis un autre écran, juste un
// drapeau lu et appliqué par AdventureScreen lui-même à son chargement.
// Coût d'une recharge d'énergie en Diamants. Aligné sur l'offre
// équivalente de la boutique du Clicker — deux prix différents pour la
// même chose serait incompréhensible.
// Abaissé de 15 à 5 (12/09) : les Diamants viennent du calendrier
// quotidien (~25-50 par semaine). À 15, une recharge d'énergie coûtait
// une demi-semaine de gains pour un simple confort — le bouton restait
// grisé en permanence.
// Échange Diamants -> Griffes proposé par le « + » du compteur. Aligné
// sur l'offre équivalente de la boutique du Clicker.
export const GRIFFES_PACK = 250;
export const GRIFFES_DIAMOND_COST = 25;

export const ENERGY_DIAMOND_COST = 5;
export const DEV_ADD_GRIFFES_KEY = 'adventure:dev:addGriffes';
const DEV_GRIFFES_AMOUNT = 1000;
// Même schéma que ci-dessus pour recharger l'énergie au max depuis Options.
export const DEV_REFILL_ENERGY_KEY = 'adventure:dev:refillEnergy';
// Remise à ZÉRO des Griffes — pour tester la difficulté de l'Aventure
// depuis une bourse vide, ce que « +1000 Griffes » ne permet pas.
export const DEV_RESET_GRIFFES_KEY = 'adventure:dev:resetGriffes';

// Runes — proposition initiale de 4 types (voir le tableau des paliers
// donné à l'utilisateur en réponse). Les BONUS eux-mêmes ne sont pas
// encore appliqués aux stats de combat, seule la structure achat/fusion
// est fonctionnelle pour l'instant.
const RUNE_TYPES = {
  force: { name: 'Rune de Force', icon: '⚔️', color: '#FF5252' },
  vitalite: { name: 'Rune de Vitalité', icon: '❤️', color: COLORS.good },
  // L'Endurance a disparu du combat le 11/09 (remplacée par le mana) :
  // sa rune ne servait plus à rien. Devient la Dextérité, qui retire des
  // taps au défi de combat. Les runes d'Endurance DÉJÀ EN SAUVEGARDE
  // sont converties au chargement — sans ça, RUNE_TYPES[type] serait
  // undefined et l'écran des runes planterait sur def.icon.
  dexterite: { name: 'Rune de Dextérité', icon: '🎯', color: COLORS.action },
  celerite: { name: 'Rune de Célérité', icon: '⚡', color: COLORS.neonCyan },
  // 3 runes ajoutées le 12/09 pour sortir du « tout offensif » : les 4
  // premières poussaient toutes les dégâts ou les PV.
  affinite: { name: "Rune d'Affinité", icon: '🔥', color: '#ff8a3d' },
  butin: { name: 'Rune de Butin', icon: '💰', color: '#f2c14e' },
  resilience: { name: 'Rune de Résilience', icon: '🛡️', color: '#7fdcff' },
};
const RUNE_TYPE_KEYS = Object.keys(RUNE_TYPES);

// Convertit les runes d'une sauvegarde ancienne. Toute rune dont le type
// n'existe plus (aujourd'hui « endurance ») devient une Dextérité de
// même niveau : le joueur ne perd rien, et surtout l'affichage ne tombe
// pas sur un type inconnu.
function migrateRunes(list) {
  return (list || []).map((r) =>
    r && !RUNE_TYPES[r.type] ? { ...r, type: 'dexterite' } : r
  );
}
const RUNE_COST = 100;
const RUNE_MAX_LEVEL = 5;
let runeIdCounter = 0;
function makeRuneId() {
  runeIdCounter += 1;
  return `rune_${Date.now()}_${runeIdCounter}`;
}


export default function AdventureScreen({ owned, deck, onBack, onEvolveCreature, onLevelUpCreature, onAssignDeck, onClearDeckSlot, onSpendDiamonds, diamonds = 0 }) {
  // Largeur réelle de la fenêtre (écran en paysage) — nécessaire pour
  // dimensionner parchmentBg en PIXELS plutôt qu'en %. Un % de largeur
  // combiné à aspectRatio sur un élément position:'absolute' se rend
  // avec une largeur bien plus petite que demandée dans ce build
  // ExpoGo (bug Yoga confirmé sur le Clicker, voir
  // CLICKER_ADVENTURE_STATE.md) — donc jamais width:'%' + aspectRatio
  // ensemble, ici comme ailleurs.
  const { width: screenWidth } = useWindowDimensions();

  // Hauteur RÉELLE de la rangée de cartes, mesurée plutôt que devinée :
  // elle dépend de l'en-tête, de la barre du bas et des encoches, qui
  // varient d'un téléphone à l'autre. Deviner une constante ici, ce
  // serait refaire le bug de la règle 8.
  const [deckRowH, setDeckRowH] = useState(0);
  // Taille réelle du fond, pour savoir OÙ tombe le parchemin à l'écran.
  const [bgSize, setBgSize] = useState({ w: 0, h: 0 });

  // Emprise du parchemin MESURÉE sur l'image (colonnes claires) :
  // 15,1% à 84,8% de sa largeur — à REMESURER si l'image change. Les cartes doivent tenir là-dedans, pas
  // sur toute la largeur de l'écran — c'était le vrai défaut du 12/09,
  // les cartes des bords se posaient sur la pierre.
  const BG_RATIO = 1793 / 747;
  const PARCH_L = 0.151;
  const PARCH_R = 0.848;
  let parchInsetL = 12;
  let parchInsetR = 12;
  if (bgSize.w > 0 && bgSize.h > 0) {
    // `resizeMode="cover"` : l'image est agrandie pour couvrir puis
    // CENTRÉE, donc une fraction de l'image ne vaut pas une fraction de
    // l'écran. On refait le calcul au lieu de le supposer.
    const renderedW = Math.max(bgSize.w, bgSize.h * BG_RATIO);
    const offsetX = (bgSize.w - renderedW) / 2;
    parchInsetL = Math.max(0, offsetX + PARCH_L * renderedW - 14);
    parchInsetR = Math.max(0, bgSize.w - (offsetX + PARCH_R * renderedW) - 14);
  }

  // Ratio réel des cadres d'élément (420x~560) : les cartes doivent le
  // respecter, sinon `resizeMode="stretch"` déforme le cadre. C'était la
  // cause des « cadres trop grands » signalés le 12/09 — la carte
  // occupait toute la place (width:'100%' + flex:1), soit un ratio ~1,0,
  // et le cadre portrait était étiré en largeur jusqu'à déborder.
  const CARD_RATIO = 0.75;
  const rowInnerW = bgSize.w > 0 ? Math.max(0, bgSize.w - 28 - parchInsetL - parchInsetR) : 0;
  const cardMaxW = rowInnerW > 0 ? (rowInnerW - 48) / 3 : 0; // 48 = respiration entre/autour des cartes
  const cardMaxH = deckRowH > 0 ? deckRowH - 24 : 0; // 24 = bouton « Changer »
  const CARD_H = cardMaxH > 0 && cardMaxW > 0 ? Math.min(cardMaxH, cardMaxW / CARD_RATIO) : 0;
  const CARD_W = CARD_H * CARD_RATIO;
  const CARD_ART = Math.round(Math.min(CARD_W * 0.62, CARD_H * 0.46));

  // Tout le mode Aventure se joue en PAYSAGE. L'appli entière est
  // déclarée en portrait dans app.json ; on bascule donc à l'entrée et
  // on REMET le portrait au démontage.
  //
  // Le nettoyage est indispensable et doit vivre dans le `return` de
  // l'effet : sans lui, quitter l'Aventure par le bouton retour système
  // laisserait le clicker et tout le reste de l'appli bloqués en
  // paysage, sans aucun moyen d'en sortir autrement qu'en redémarrant.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const { trackEvent, trackMax } = useDaily();
  const [detailCreatureId, setDetailCreatureId] = useState(null);
  const [deckPickerSlot, setDeckPickerSlot] = useState(null); // index de l'emplacement en cours de modification, ou null
  const [chapterMapOpen, setChapterMapOpen] = useState(false);
  const [runesOpen, setRunesOpen] = useState(false);
  const [currentUnlockedLevel, setCurrentUnlockedLevel] = useState(1);
  const [griffes, setGriffes] = useState(0);
  // Runes possédées : [{ id, type, level }] — id unique généré à l'achat/
  // la fusion, type = l'une des 4 clés de RUNE_TYPES, level 1 à 5.
  const [ownedRunes, setOwnedRunes] = useState([]);
  // Offre spéciale du jour : { date, type, purchased }. Stockée dans sa
  // PROPRE clé — une offre ratée ne doit pas pouvoir corrompre la
  // sauvegarde d'Aventure. Une date différente au chargement retire un
  // nouveau type et remet l'achat à zéro : pas de minuteur de minuit.
  const [specialOffer, setSpecialOffer] = useState(null);
  useEffect(() => {
    (async () => {
      const today = new Date().toDateString();
      let cur = null;
      try {
        const raw = await AsyncStorage.getItem(RUNE_OFFER_KEY);
        if (raw) cur = JSON.parse(raw);
      } catch {}
      if (!cur || cur.date !== today || !RUNE_TYPES[cur.type]) {
        cur = {
          date: today,
          type: RUNE_TYPE_KEYS[Math.floor(Math.random() * RUNE_TYPE_KEYS.length)],
          purchased: false,
        };
        AsyncStorage.setItem(RUNE_OFFER_KEY, JSON.stringify(cur)).catch(() => {});
      }
      setSpecialOffer(cur);
    })();
  }, []);
  // Énergie — 1 point toutes les 20 min, plafond 5, coûte 1 pour LANCER
  // un combat (voir startBattleWithEnergy plus bas).
  // Meilleur nombre d'étoiles par niveau, { [levelNumber]: 1..3 }. On
  // ne conserve que le MEILLEUR : un joueur qui rejoue et fait moins bien
  // ne doit pas perdre son score.
  const [levelStars, setLevelStars] = useState({});
  const levelStarsRef = useRef({});
  levelStarsRef.current = levelStars;
  const [energy, setEnergy] = useState(ENERGY_MAX);
  const [energyUpdatedAt, setEnergyUpdatedAt] = useState(Date.now());
  const [progressLoaded, setProgressLoaded] = useState(false);
  const currentUnlockedLevelRef = useRef(1);
  currentUnlockedLevelRef.current = currentUnlockedLevel;

  // Chargement de la progression au montage.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ADVENTURE_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setCurrentUnlockedLevel(saved.currentUnlockedLevel || 1);
          setLevelStars(saved.levelStars || {});
          setGriffes(saved.griffes || 0);
          setOwnedRunes(migrateRunes(saved.ownedRunes));
          // Recalcule l'énergie à partir du temps RÉELLEMENT écoulé
          // depuis la dernière sauvegarde (même principe que les gains
          // hors-ligne du clicker) — sans ça, fermer l'appli ne ferait
          // jamais avancer la régénération.
          const storedEnergy = saved.energy != null ? saved.energy : ENERGY_MAX;
          const storedAt = saved.energyUpdatedAt || Date.now();
          const recalced = computeEnergyRegen(storedEnergy, storedAt, Date.now());
          setEnergy(recalced.energy);
          setEnergyUpdatedAt(recalced.lastUpdateAt);
        }
      } catch (e) {
        // pas de sauvegarde valide, on démarre au niveau 1
      }
      // Drapeaux dev — placés hors du if(raw) pour marcher aussi sans
      // sauvegarde existante.
      //
      // La remise à zéro est traitée AVANT l'ajout : si les deux
      // drapeaux sont posés (le joueur a cliqué sur les deux boutons
      // avant de revenir), il obtient 0 puis +1000, soit 1000. Dans
      // l'ordre inverse le +1000 serait silencieusement annulé.
      const resetGriffesFlag = await AsyncStorage.getItem(DEV_RESET_GRIFFES_KEY);
      if (resetGriffesFlag === '1') {
        setGriffes(0);
        await AsyncStorage.removeItem(DEV_RESET_GRIFFES_KEY);
      }
      const griffesFlag = await AsyncStorage.getItem(DEV_ADD_GRIFFES_KEY);
      // Un MONTANT, plus un drapeau : `'1'` de l'ancien format vaut 1,
      // donc on retombe sur le montant par défaut pour ne rien perdre
      // d'une demande faite avant cette correction.
      if (griffesFlag) {
        const amount = parseInt(griffesFlag, 10) || 0;
        setGriffes((g) => g + (amount > 1 ? amount : DEV_GRIFFES_AMOUNT));
        await AsyncStorage.removeItem(DEV_ADD_GRIFFES_KEY);
      }
      const energyFlag = await AsyncStorage.getItem(DEV_REFILL_ENERGY_KEY);
      if (energyFlag === '1') {
        setEnergy(ENERGY_MAX);
        setEnergyUpdatedAt(Date.now());
        await AsyncStorage.removeItem(DEV_REFILL_ENERGY_KEY);
      }
      // Griffes en attente (récompenses de quêtes quotidiennes/streak,
      // réclamées depuis ProgresScreen) — même schéma de sécurité que
      // les drapeaux dev ci-dessus, montant accumulé plutôt qu'un simple
      // booléen (plusieurs récompenses peuvent s'empiler).
      const pendingRaw = await AsyncStorage.getItem(PENDING_GRIFFES_KEY);
      if (pendingRaw) {
        const pending = parseInt(pendingRaw, 10) || 0;
        if (pending > 0) setGriffes((g) => g + pending);
        await AsyncStorage.removeItem(PENDING_GRIFFES_KEY);
      }
      setProgressLoaded(true);
    })();
  }, []);

  // Sauvegarde à chaque changement.
  useEffect(() => {
    if (!progressLoaded) return;
    AsyncStorage.setItem(ADVENTURE_STORAGE_KEY, JSON.stringify({ currentUnlockedLevel, griffes, ownedRunes, energy, energyUpdatedAt, levelStars }));
  }, [currentUnlockedLevel, griffes, ownedRunes, energy, energyUpdatedAt, levelStars, progressLoaded]);

  // Pendant que l'écran Aventure est ouvert, revérifie la régénération
  // toutes les 30s — permet de VOIR l'énergie remonter en direct sans
  // avoir à fermer/rouvrir l'appli. Coût négligeable (juste une
  // soustraction de timestamps), et purement décoratif si rien n'a
  // changé (computeEnergyRegen ne fait rien tant qu'un tick complet ne
  // s'est pas écoulé).
  useEffect(() => {
    if (!progressLoaded) return;
    const interval = setInterval(() => {
      setEnergy((e) => {
        const recalced = computeEnergyRegen(e, energyUpdatedAt, Date.now());
        if (recalced.energy !== e) setEnergyUpdatedAt(recalced.lastUpdateAt);
        return recalced.energy;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [progressLoaded, energyUpdatedAt]);

  // Reprogramme la notification "énergie pleine" à chaque fois que
  // l'énergie change — annule automatiquement l'ancienne (identifiant
  // fixe côté scheduleEnergyFullNotification) si elle n'est plus valable.
  useEffect(() => {
    if (!progressLoaded) return;
    const remaining = msUntilNextEnergy(energy, energyUpdatedAt, Date.now());
    if (energy >= ENERGY_MAX) {
    } else {
      // Temps jusqu'au PLEIN (pas juste le prochain point) : autant de
      // ticks manquants que d'énergie sous le plafond.
      const ticksMissing = ENERGY_MAX - energy;
      const msUntilFull = remaining + (ticksMissing - 1) * ENERGY_REGEN_MS;
      scheduleEnergyFullNotification(msUntilFull);
    }
  }, [energy, energyUpdatedAt, progressLoaded]);

  // Dépense 1 énergie pour lancer un combat — recalcule d'abord la
  // régénération au cas où du temps se serait écoulé depuis la dernière
  // vérification. Retourne false (et ne dépense rien) si pas assez.
  // Recharge d'énergie en Diamants. DÉFINIE ICI et non dans
  // ChapterMapScreen : c'est AdventureScreen qui détient l'énergie et
  // reçoit `onSpendDiamonds`. Placée plus bas, elle sortait en silence
  // faute de ces deux éléments (bug du 12/09).
  const buyGriffesWithDiamonds = () => {
    if (!onSpendDiamonds) return;
    Alert.alert(
      'Échanger des Diamants',
      `${GRIFFES_DIAMOND_COST} 💎 contre ${GRIFFES_PACK} 🐾 Griffes ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Échanger',
          onPress: async () => {
            const ok = await onSpendDiamonds(GRIFFES_DIAMOND_COST);
            if (!ok) {
              Alert.alert('Diamants insuffisants', `Il t'en faut ${GRIFFES_DIAMOND_COST}.`);
              return;
            }
            // Crédit DIRECT : on est déjà dans l'écran qui détient les
            // Griffes, pas besoin de passer par la clé en attente.
            setGriffes((g) => g + GRIFFES_PACK);
          },
        },
      ]
    );
  };

  const buyEnergyWithDiamonds = async () => {
    if (!onSpendDiamonds) return;
    const ok = await onSpendDiamonds(ENERGY_DIAMOND_COST);
    if (!ok) {
      Alert.alert('Diamants insuffisants', `Il te faut ${ENERGY_DIAMOND_COST} 💎 pour recharger l'énergie.`);
      return;
    }
    setEnergy(ENERGY_MAX);
    setEnergyUpdatedAt(Date.now());
  };

  const startBattleWithEnergy = () => {
    const now = Date.now();
    const recalced = computeEnergyRegen(energy, energyUpdatedAt, now);
    if (recalced.energy <= 0) {
      setEnergy(recalced.energy);
      setEnergyUpdatedAt(recalced.lastUpdateAt);
      return false;
    }
    const wasFull = recalced.energy >= ENERGY_MAX;
    setEnergy(recalced.energy - 1);
    // Si on VIENT de repasser sous le plafond, le compte à rebours des
    // 20 min démarre maintenant — sinon on garde le timestamp déjà en
    // cours (ne pas perdre la progression déjà accumulée vers le
    // prochain point).
    setEnergyUpdatedAt(wasFull ? now : recalced.lastUpdateAt);
    return true;
  };

  // Appelé par ChapterMapScreen (via CombatScreen) à la fin d'un combat
  // gagné : débloque le niveau suivant SEULEMENT si c'était bien le
  // niveau de progression actuel (rejouer un niveau déjà acquis ne fait
  // pas avancer davantage), et crédite la récompense.
  const handleLevelWon = (levelNumber, reward) => {
    setGriffes((g) => g + reward);
    trackEvent('battleWon', 1);
    // Publie le niveau atteint pour que les défis de l'œuf (clicker)
    // puissent lire la progression d'Aventure. trackMax, pas trackEvent :
    // c'est un maximum, rejouer un niveau déjà battu ne doit pas le
    // faire monter. L'Aventure PUBLIE, le clicker LIT — jamais d'accès
    // direct d'un écran à la sauvegarde de l'autre.
    trackMax('advLevelReached', levelNumber);
    if (levelNumber === currentUnlockedLevelRef.current) {
      setCurrentUnlockedLevel((l) => l + 1);
    }
  };

  // Fait évoluer une créature d'un palier : vérifie l'éligibilité et le
  // coût ICI (Griffes vivent dans cet écran), débite localement, puis
  // remonte au clicker (via onEvolveCreature) pour persister le nouveau
  // palier sur owned — l'évolution touche la collection du clicker, pas
  // seulement l'état de l'écran Aventure.
  const handleEvolve = (creatureId, currentTier, ownedLevel) => {
    if (!canEvolve(currentTier, ownedLevel)) return;
    const cost = evolutionCost(currentTier);
    if (griffes < cost) return;
    setGriffes((g) => g - cost);
    onEvolveCreature(creatureId, currentTier + 1);
  };

  // Monte une créature d'un niveau, payé EN GRIFFES. Même schéma que
  // handleEvolve : le coût est vérifié et débité ICI (les Griffes vivent
  // dans cet écran), puis le nouveau niveau est persisté par le clicker
  // via onLevelUpCreature — la collection lui appartient.
  //
  // Le nourrissage se faisait avant dans le clicker, payé en pièces. Il a
  // été déplacé ici plutôt que de faire descendre les Griffes vers le
  // clicker : garder une monnaie dans un seul écran évite qu'elle soit
  // débitée à deux endroits qui ne se voient pas.
  const handleLevelUp = (creatureId) => {
    const creature = CREATURES.find((c) => c.id === creatureId);
    const ownedEntry = ownedMap[creatureId];
    if (!creature || !ownedEntry) return;
    const cost = levelUpCost(creature, ownedEntry.level);
    if (griffes < cost) return;
    setGriffes((g) => g - cost);
    onLevelUpCreature(creatureId);
  };

  // Achète une rune ALÉATOIRE contre 100 Griffes (toujours niveau 1, pas
  // encore équipée). Les bonus des runes affectent maintenant vraiment
  // les stats de combat (voir combatLogic.js/runeBonuses).
  const buyRandomRune = () => {
    if (griffes < RUNE_COST) return;
    setGriffes((g) => g - RUNE_COST);
    const type = RUNE_TYPE_KEYS[Math.floor(Math.random() * RUNE_TYPE_KEYS.length)];
    setOwnedRunes((prev) => [...prev, { id: makeRuneId(), type, level: 1, equippedCreatureId: null }]);
    trackEvent('runeBought', 1);
  };

  // Pack : N runes aléatoires d'un coup, moins cher qu'à l'unité.
  const buyRunePack = () => {
    if (griffes < RUNE_PACK_COST) return;
    setGriffes((g) => g - RUNE_PACK_COST);
    const drawn = Array.from({ length: RUNE_PACK_SIZE }, () => ({
      id: makeRuneId(),
      type: RUNE_TYPE_KEYS[Math.floor(Math.random() * RUNE_TYPE_KEYS.length)],
      level: 1,
      equippedCreatureId: null,
    }));
    setOwnedRunes((prev) => [...prev, ...drawn]);
    trackEvent('runeBought', RUNE_PACK_SIZE);
  };

  // Offre spéciale : une rune de NIVEAU 2 d'un type imposé, tiré une
  // fois par jour. Une seule fois par jour — sinon elle remplacerait
  // complètement le tirage à l'unité, qu'elle bat largement.
  const buySpecialOffer = () => {
    if (!specialOffer || specialOffer.purchased) return;
    if (griffes < RUNE_SPECIAL_COST) return;
    setGriffes((g) => g - RUNE_SPECIAL_COST);
    setOwnedRunes((prev) => [
      ...prev,
      { id: makeRuneId(), type: specialOffer.type, level: 2, equippedCreatureId: null },
    ]);
    const next = { ...specialOffer, purchased: true };
    setSpecialOffer(next);
    AsyncStorage.setItem(RUNE_OFFER_KEY, JSON.stringify(next)).catch(() => {});
    trackEvent('runeBought', 2);
  };

  // Fusionne 2 runes du MÊME type et MÊME niveau en une seule au niveau
  // supérieur (jamais au-delà du palier 5) — les deux runes d'origine
  // disparaissent. Si l'une des deux était équipée, la nouvelle rune
  // fusionnée prend AUTOMATIQUEMENT sa place (pas de désarmement surprise).
  const fuseRunes = (id1, id2) => {
    // Vérification faite AVANT le setState (pas dans l'updater) : appeler
    // trackEvent (un AUTRE setState) depuis l'intérieur d'un updater
    // risquerait un double déclenchement en mode strict de React, qui
    // peut ré-invoquer les fonctions d'updater pour détecter les effets
    // de bord — ça compterait la quête deux fois pour une seule fusion.
    const r1 = ownedRunes.find((r) => r.id === id1);
    const r2 = ownedRunes.find((r) => r.id === id2);
    const valid = r1 && r2 && r1.id !== r2.id && r1.type === r2.type && r1.level === r2.level && r1.level < RUNE_MAX_LEVEL;
    if (!valid) return;

    setOwnedRunes((prev) => {
      const rest = prev.filter((r) => r.id !== id1 && r.id !== id2);
      const inheritedSlot = r1.equippedCreatureId || r2.equippedCreatureId || null;
      return [...rest, { id: makeRuneId(), type: r1.type, level: r1.level + 1, equippedCreatureId: inheritedSlot }];
    });
    trackEvent('runeFused', 1);
  };

  // Équipe une rune NON équipée sur une créature — refuse si la créature
  // a déjà ses 3 emplacements pleins (garde-fou, la carte des 3 cases
  // dans le profil ne devrait de toute façon jamais en proposer une 4e).
  const equipRune = (runeId, creatureId) => {
    const alreadyEquipped = ownedRunes.filter((r) => r.equippedCreatureId === creatureId).length;
    if (alreadyEquipped >= 3) return;
    setOwnedRunes((prev) => prev.map((r) => (r.id === runeId ? { ...r, equippedCreatureId: creatureId } : r)));
    trackEvent('runeEquipped', 1);
  };

  const unequipRune = (runeId) => {
    setOwnedRunes((prev) => prev.map((r) => (r.id === runeId ? { ...r, equippedCreatureId: null } : r)));
  };

  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  const hasEmptySlot = deck.some((id) => !id);

  // La fiche détaillée est un vrai écran (pas juste un overlay léger
  // comme à l'étape 2) — retour anticipé, même schéma que celui utilisé
  // dans ClickerScreen pour la navigation entre écrans complets.
  if (detailCreatureId) {
    return (
      <CreatureDetailScreen
        creature={CREATURES.find((c) => c.id === detailCreatureId)}
        owned={ownedMap[detailCreatureId]}
        griffes={griffes}
        onEvolve={() => handleEvolve(detailCreatureId, ownedMap[detailCreatureId].evolutionTier || 0, ownedMap[detailCreatureId].level)}
        onLevelUp={() => handleLevelUp(detailCreatureId)}
        ownedRunes={ownedRunes}
        onEquipRune={(runeId) => equipRune(runeId, detailCreatureId)}
        onUnequipRune={unequipRune}
        onBack={() => setDetailCreatureId(null)}
      />
    );
  }

  // Carte des chapitres — même schéma de retour anticipé.
  if (chapterMapOpen) {
    return (
      <ChapterMapScreen
        currentUnlockedLevel={currentUnlockedLevel}
        owned={owned}
        deck={deck}
        griffes={griffes}
        ownedRunes={ownedRunes}
        energy={energy}
        energyUpdatedAt={energyUpdatedAt}
        onStartBattle={startBattleWithEnergy}
        onLevelWon={handleLevelWon}
        onBack={() => setChapterMapOpen(false)}
        onBuyEnergy={buyEnergyWithDiamonds}
        onBuyGriffes={buyGriffesWithDiamonds}
        diamonds={diamonds}
        levelStars={levelStars}
        onRecordStars={(lv, stars) => {
          // Étoiles GAGNÉES, pas simplement obtenues : on ne compte que
          // le progrès par rapport au meilleur score précédent. Sans ça,
          // rejouer un niveau déjà à 3 étoiles ferait monter les défis
          // en boucle.
          const gained = Math.max(0, stars - (levelStarsRef.current[lv] || 0));
          if (gained > 0) {
            trackEvent('starsEarned', gained);
            setLevelStars((prev) => ({ ...prev, [lv]: stars }));
          }
          if (stars === 3 && (levelStarsRef.current[lv] || 0) < 3) {
            trackEvent('threeStarLevel', 1);
          }
        }}
      />
    );
  }

  // Runes — même schéma de retour anticipé.
  if (runesOpen) {
    return (
      <RunesScreen
        griffes={griffes}
        ownedRunes={ownedRunes}
        onBuyRune={buyRandomRune}
        onBuyPack={buyRunePack}
        onBuySpecial={buySpecialOffer}
        specialOffer={specialOffer}
        onFuseRunes={fuseRunes}
        onBuyGriffes={buyGriffesWithDiamonds}
        onBack={() => setRunesOpen(false)}
      />
    );
  }

  return (
    <ImageBackground
      source={EXPLORATION_BG}
      style={styles.screen}
      resizeMode="cover"
      onLayout={(e) => setBgSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* En-tête paysage : retour à gauche, Griffes au centre, accès aux
          Runes en HAUT À DROITE (même icône qu'avant, seulement
          déplacée). L'ancienne barre du bas disparaît : en paysage la
          hauteur est la ressource rare, on ne la gaspille pas en barre
          de navigation. */}
      <View style={styles.headerLand}>
        <BackButton onPress={onBack} />
        <ImageBackground source={TITLE_BANNER} style={styles.titleBanner} resizeMode="contain">
          <Text style={styles.titleBannerText}>EXPLORATION</Text>
        </ImageBackground>
        <View style={styles.headerRight}>
          <CurrencyCounter currency="griffes" amount={griffes} onPlus={buyGriffesWithDiamonds} />
          <TouchableOpacity style={styles.runesTopBtn} onPress={() => setRunesOpen(true)}>
            {/* Gemme des Runes + halo cyan généré en code (même principe
                que le compteur de Griffes). Remplace rune-button.png. */}
            <Image source={GLOW_CYAN} style={styles.runesTopBtnGlow} resizeMode="contain" />
            <Image source={RUNES_GEM} style={styles.runesTopBtnImage} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Les 3 créatures du deck, côte à côte et occupant toute la
          largeur. C'est le MÊME deck que celui du clicker — une seule
          source de vérité, pas de sélection séparée. */}
      <View
        style={[styles.creatureRowLand, { paddingLeft: parchInsetL, paddingRight: parchInsetR }]}
        onLayout={(e) => setDeckRowH(e.nativeEvent.layout.height)}
      >
        {deck.map((id, i) => {
          const creature = id ? CREATURES.find((c) => c.id === id) : null;
          const own = id ? ownedMap[id] : null;
          const display = creature && own ? creature.stages[stageForLevel(own.level)] : null;
          const cardFrame = creature ? cardFrameForElement(creature.element) : null;
          return (
            <View key={i} style={styles.creatureCellLand}>
              <TouchableOpacity
                style={[
                  styles.creatureSlotLand,
                  // Taille FIXE en portrait (aucun pourcentage, aucun
                  // aspectRatio : voir le bug Yoga en tête de fichier).
                  CARD_H > 0 && { width: CARD_W, height: CARD_H },
                  // Le cadre illustré remplace la bordure colorée : les
                  // deux ensemble feraient double encadrement.
                  creature && !cardFrame && { borderColor: RARITY_COLOR[creature.rarity] },
                  cardFrame && styles.creatureSlotFramed,
                  // Marges calées sur la bordure MESURÉE du cadre
                  // (13% en largeur, 10% en hauteur), en pixels — une
                  // marge en % se résoudrait sur la largeur même en
                  // vertical (règle 13).
                  cardFrame && CARD_H > 0 && {
                    paddingHorizontal: Math.round(CARD_W * 0.13),
                    paddingVertical: Math.round(CARD_H * 0.10),
                  },
                ]}
                onPress={() => (creature ? setDetailCreatureId(id) : setDeckPickerSlot(i))}
                activeOpacity={0.8}
              >
                {/* Cadre posé PAR-DESSUS le contenu, en absolu : il
                    décore sans jamais intercepter le tap de la carte. */}
                {cardFrame && (
                  <Image source={cardFrame} style={styles.creatureFrameImg} resizeMode="stretch" />
                )}
                {display ? (
                  <>
                    {/* Taille de l'illustration dérivée de la carte, pour
                        qu'elle la remplisse quelle que soit la place. */}
                    <CreatureArt creatureId={id} stageIndex={stageForLevel(own.level)} emoji={display.emoji} size={CARD_ART || 84} emojiStyle={styles.creatureEmojiLand} />
                    <Text style={styles.creatureNameLand} numberOfLines={1}>{display.name}</Text>
                    {/* Rareté et niveau retirés : le cadre porte déjà
                        l'élément, et la fiche détaillée donne le reste. */}
                  </>
                ) : (
                  <>
                    <Text style={styles.emptySlotEmojiLand}>🥚</Text>
                    <Text style={styles.creatureNameLand}>Emplacement vide</Text>
                  </>
                )}
              </TouchableOpacity>
              {creature && (
                <TouchableOpacity style={styles.editSlotBtn} onPress={() => setDeckPickerSlot(i)}>
                  <Ionicons name="pencil" size={12} color={COLORS.action} />
                  <Text style={styles.editSlotBtnText}>Changer</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {deckPickerSlot !== null && (
        <DeckPicker
          slotIndex={deckPickerSlot}
          deck={deck}
          owned={owned}
          onPick={(creatureId) => {
            onAssignDeck(deckPickerSlot, creatureId);
            setDeckPickerSlot(null);
          }}
          onClear={() => {
            onClearDeckSlot(deckPickerSlot);
            setDeckPickerSlot(null);
          }}
          onClose={() => setDeckPickerSlot(null)}
        />
      )}

      <View style={styles.bottomLand}>
        <TouchableOpacity style={styles.combatBtnLand} onPress={() => setChapterMapOpen(true)}>
          <ImageBackground source={COMBAT_BTN} style={styles.combatBtnImg} resizeMode="contain">
            <Text style={styles.combatBtnText}>COMBAT</Text>
          </ImageBackground>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

// Fiche détaillée d'une créature, inspirée de l'onglet "Info" de Monster
// Legends fourni en référence : portrait, stats de combat, compétence,
// histoire. Les stats viennent de combatLogic.js (étape 1) — première
// fois que cette logique sert réellement à quelque chose de visible.
// Carte d'évolution : palier actuel (★★★), et si éligible (niveau
// suffisant), un bouton pour dépenser les Griffes et débloquer le
// palier suivant — pas de changement de nom, juste un boost de PV/ATQ/
// Endurance (contrairement aux 10 créatures d'origine avec 3 noms/
// dessins distincts par stade évolutif).
// Montée de niveau, payée en Griffes. Affiche aussi le prochain palier
// d'évolution visé, pour que le joueur sache à quoi servent les niveaux
// qu'il achète au lieu de monter à l'aveugle.
function LevelUpCard({ creature, ownedLevel, griffes, onLevelUp }) {
  const cost = levelUpCost(creature, ownedLevel);
  const affordable = griffes >= cost;
  const nextTierLevel = ownedLevel < 25 ? 25 : ownedLevel < 50 ? 50 : null;

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>🍖 Niveau</Text>
      <Text style={styles.sectionBody}>Niveau actuel : {ownedLevel}</Text>
      {nextTierLevel && (
        <Text style={styles.speciesNote}>
          Encore {nextTierLevel - ownedLevel} niveau{nextTierLevel - ownedLevel > 1 ? 'x' : ''} avant le prochain palier d'évolution.
        </Text>
      )}
      <TouchableOpacity
        style={[styles.startBattleBtn, !affordable && styles.actionBtnDisabledAdv]}
        onPress={onLevelUp}
        disabled={!affordable}
      >
        <Text style={styles.startBattleBtnText}>Monter au niveau {ownedLevel + 1} — {cost} <Image source={GRIFFES_ICON} style={styles.inlineCurrencyIcon} resizeMode="contain" /> Griffes</Text>
      </TouchableOpacity>
    </View>
  );
}

function EvolutionCard({ evolutionTier, ownedLevel, griffes, onEvolve }) {
  const maxed = evolutionTier >= 2;
  const eligible = !maxed && canEvolve(evolutionTier, ownedLevel);
  const cost = maxed ? null : evolutionCost(evolutionTier);
  const nextLevelNeeded = maxed ? null : (evolutionTier === 0 ? 25 : 50);

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>🌟 Évolution</Text>
      <Text style={styles.sectionBody}>Palier actuel : {'★'.repeat(evolutionTier + 1)}{'☆'.repeat(2 - evolutionTier)}</Text>
      {maxed ? (
        <Text style={[styles.speciesNote, { marginTop: 8 }]}>Palier maximum atteint.</Text>
      ) : eligible ? (
        <TouchableOpacity
          style={[styles.startBattleBtn, griffes < cost && styles.actionBtnDisabledAdv]}
          onPress={onEvolve}
          disabled={griffes < cost}
        >
          <Text style={styles.startBattleBtnText}>Évoluer — {cost} <Image source={GRIFFES_ICON} style={styles.inlineCurrencyIcon} resizeMode="contain" /> Griffes</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.speciesNote, { marginTop: 8 }]}>Atteins le niveau {nextLevelNeeded} pour débloquer ce palier.</Text>
      )}
    </View>
  );
}


// Profil de créature — mise en page calquée sur la fiche Monster Legends
// fournie en référence, et surtout : TOUT TIENT À L'ÉCRAN, sans aucun
// défilement.
//
// C'est la contrainte structurante. Elle impose du flex pur (aucune
// ScrollView), des hauteurs qui se partagent l'espace disponible plutôt
// que des marges fixes, et des textes bornés par `numberOfLines` — une
// description longue doit se tronquer, jamais pousser le reste hors de
// l'écran.
//
//   GAUCHE (44%) : portrait, puis étoiles / niveau / barre, puis les
//                  deux boutons d'action.
//   DROITE (56%) : stats et runes côte à côte, attribut + habitat,
//                  description, le tout dans un panneau.
// Fond de l'écran de profil. Avec un thème : l'illustration de
// l'élément, assombrie par un voile pour que le texte reste lisible
// par-dessus. Sans thème : exactement la vue unie d'avant.
// Bloc thémé — approche CONTENU D'ABORD.
//
// Le contenu garde sa taille naturelle ; le cadre est construit AUTOUR
// de lui, en dehors du flux. C'est l'inverse de la première version, qui
// imposait une taille de cadre puis tentait d'y comprimer le contenu —
// et qui obligeait à des marges impossibles à exprimer (pixels fixes
// inadaptés aux 4 tailles, pourcentages résolus sur la largeur).
//
// Le cadre étant en position absolue, il ne compte pas dans la hauteur
// du bloc. La boucle qui empêchait d'appliquer ce système à la légende
// (plus de marge -> plus haut -> plus de marge) disparaît donc : ce
// composant marche pour TOUS les blocs, y compris ceux dimensionnés par
// leur contenu.
//
// Ratios mesurés sur l'image du cadre : la bordure occupe 8,7% de la
// largeur totale et ~17% de la hauteur totale. Pour un contenu de taille
// C, le cadre doit donc mesurer C/0,826 en largeur et C/0,66 en hauteur,
// soit un débordement de 10,5% et 26% de la taille du contenu.
const FRAME_OVERHANG_X = 0.105;
const FRAME_OVERHANG_Y = 0.26;

// Pulsation du bouton d'amélioration, UNIQUEMENT quand le joueur a de
// quoi payer : animer un bouton inutilisable serait une fausse promesse.
// La boucle est arrêtée dès que `active` repasse à faux, donc rien ne
// tourne en fond pour rien.
function PulsingButton({ active, children }) {
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 780, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 780, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  return (
    <Animated.View
      style={{
        width: '100%',
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ThemedBlock({ theme, style, children }) {
  const [size, setSize] = React.useState(null);
  if (!theme) return <View style={style}>{children}</View>;

  const ox = size ? Math.max(10, Math.round(size.width * FRAME_OVERHANG_X)) : 0;
  const oy = size ? Math.max(10, Math.round(size.height * FRAME_OVERHANG_Y)) : 0;

  return (
    // Marges égales au débordement : le cadre s'étend hors du bloc, sans
    // ces marges il mordrait sur les blocs voisins (le défaut du
    // « treillis » déjà corrigé une fois).
    <View style={[style, styles.themedBlockOuter, { marginHorizontal: ox, marginVertical: oy }]}>
      {size && (
        <Image
          source={theme.panelFrame}
          style={{
            position: 'absolute',
            left: -ox, right: -ox, top: -oy, bottom: -oy,
            width: undefined, height: undefined,
            pointerEvents: 'none',
          }}
          resizeMode="stretch"
        />
      )}
      <View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSize((prev) => (prev && Math.abs(prev.height - height) < 2 && Math.abs(prev.width - width) < 2 ? prev : { width, height }));
        }}
      >
        {children}
      </View>
    </View>
  );
}

function ThemedProfileBackground({ theme, children }) {
  if (!theme) return <View style={styles.profileScreen}>{children}</View>;
  return (
    <ImageBackground source={theme.background} style={styles.profileScreen} resizeMode="cover">
      <View style={styles.profileScrim} />
      {children}
    </ImageBackground>
  );
}

function CreatureDetailScreen({ creature, owned, griffes, onEvolve, onLevelUp, ownedRunes, onEquipRune, onUnequipRune, onBack }) {
  const [runePickerSlot, setRunePickerSlot] = useState(null);
  // Thème visuel lié à l'ÉLÉMENT de la créature (Feu, Eau...). `null`
  // pour les éléments pas encore illustrés : l'écran garde alors son
  // apparence actuelle, rien ne casse.
  const theme = elementTheme(creature.element);

  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const evolutionTier = owned.evolutionTier || 0;

  const equippedRunes = ownedRunes.filter((r) => r.equippedCreatureId === creature.id);
  const statsBase = combatStatsForCreatureTyped(creature, owned.level, evolutionTier, []);
  const stats = combatStatsForCreatureTyped(creature, owned.level, evolutionTier, equippedRunes);
  const hpBonus = stats.hp - statsBase.hp;
  const atkBonus = stats.attack - statsBase.attack;

  const levelCost = levelUpCost(creature, owned.level);
  const evoMaxed = evolutionTier >= 2;
  const evoEligible = !evoMaxed && canEvolve(evolutionTier, owned.level);
  const evoCost = evoMaxed ? null : evolutionCost(evolutionTier);
  const nextEvoLevel = evoMaxed ? null : (evolutionTier === 0 ? 25 : 50);
  // Barre de niveau : progression vers le palier d'évolution suivant,
  // c'est le seul jalon qui donne du sens au niveau actuel.
  const levelSpanFrom = evolutionTier === 0 ? 1 : 25;
  const levelSpanTo = nextEvoLevel || owned.level;
  const levelRatio = evoMaxed
    ? 1
    : Math.max(0, Math.min(1, (owned.level - levelSpanFrom) / Math.max(1, levelSpanTo - levelSpanFrom)));

  return (
    <>
    <ThemedProfileBackground theme={theme}>
      <View style={styles.profileTopBar}>
        <BackButton onPress={onBack} />
        <CurrencyCounter currency="griffes" amount={griffes} />
      </View>

      <View style={styles.profileBody}>
        {/* ---------- GAUCHE ---------- */}
        <View style={styles.mlLeft}>
          {/* Ordre inversé avec un thème : nom, barre et boutons EN HAUT,
              créature EN BAS — elle se pose ainsi sur le piédestal de
              pierre peint dans le décor, au lieu de flotter par-dessus. */}
          <Text style={styles.mlName} numberOfLines={1}>{display.name}</Text>

          <View style={styles.mlStars}>
            <Text style={styles.mlStarsText}>
              {'★'.repeat(evolutionTier + 1)}{'☆'.repeat(2 - evolutionTier)}
            </Text>
            <Text style={styles.mlLevelText}>
              Niveau {owned.level}{!evoMaxed && `/${levelSpanTo}`}
            </Text>
          </View>

          <View style={styles.mlLevelBarTrack}>
            <View style={[styles.mlLevelBarFill, { width: `${Math.round(levelRatio * 100)}%` }]} />
          </View>

          {/* Bouton de montée de niveau. Avec un thème, l'illustration
              remplace le fond uni — elle était livrée mais n'avait
              jamais été branchée. Marges calées sur ses ornements
              latéraux (~13% de chaque côté) pour que le texte tombe
              dans la zone lisse du centre. */}
          <PulsingButton active={griffes >= levelCost}>
          <TouchableOpacity
            style={[styles.mlMainBtn, theme && styles.mlMainBtnThemed, griffes < levelCost && styles.actionBtnDisabledAdv]}
            onPress={onLevelUp}
            disabled={griffes < levelCost}
            // Pas de transparence à l'appui sur un bouton thémé : il
            // chevauche la barre d'XP (marge négative pour le remonter)
            // et l'illustration a des zones ajourées. En devenant
            // translucide, il laissait voir la barre bleue à travers —
            // « l'ancienne barre en fond » signalée le 11/09. Le retour
            // visuel est assuré par la pulsation et par le niveau qui
            // change aussitôt.
            activeOpacity={theme ? 1 : 0.7}
          >
            {theme && (
              <Image source={theme.button} style={styles.mlMainBtnImg} resizeMode="stretch" />
            )}
            <Text style={[styles.mlMainBtnText, theme && styles.mlMainBtnTextThemed]}>NIVEAU {owned.level + 1} · {levelCost} <Image source={GRIFFES_ICON} style={styles.inlineCurrencyIcon} resizeMode="contain" /></Text>
          </TouchableOpacity>
          </PulsingButton>

          <View style={[styles.mlPortraitZone, theme && styles.mlPortraitZoneThemed]}>
            <CreatureArt creatureId={creature.id} stageIndex={stage} emoji={display.emoji} size={170} emojiStyle={styles.mlPortraitEmoji} />
          </View>

          {evoMaxed ? (
            <Text style={styles.mlSubNote}>Palier maximum atteint</Text>
          ) : evoEligible ? (
            <TouchableOpacity
              style={[styles.mlEvoBtn, griffes < evoCost && styles.actionBtnDisabledAdv]}
              onPress={onEvolve}
              disabled={griffes < evoCost}
            >
              <Text style={styles.mlEvoBtnText}>🌟 ÉVOLUER · {evoCost} <Image source={GRIFFES_ICON} style={styles.inlineCurrencyIcon} resizeMode="contain" /></Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.mlSubNote}>Niveau {nextEvoLevel} pour le palier suivant</Text>
          )}
        </View>

        {/* ---------- DROITE ---------- */}
        <View style={styles.mlRight}>
          <View style={styles.mlRow}>
            <ThemedBlock theme={theme} style={styles.mlStatsBox}>
              <MlStat icon="⚔️" label="ATTAQUE" value={stats.attack} bonus={atkBonus} color={COLORS.bad} />
              <MlStat icon="❤️" label="VIE" value={stats.hp} bonus={hpBonus} color={COLORS.good} />
              {/* ENDURANCE retirée (11/09) : la stat ne pilote plus rien
                  depuis que le mana l'a remplacée en combat, et elle
                  n'est volontairement PAS remplacée par le mana — celui-ci
                  est identique pour toutes les créatures (0 à 5), donc
                  l'afficher dans une fiche n'apprendrait rien. */}
              {/* VITESSE retirée (12/09) : elle occupait une ligne pour
                  une information qui ne pilote plus rien de visible
                  depuis la refonte du combat. */}
            </ThemedBlock>

            <ThemedBlock theme={theme} style={styles.mlRunesBox}>
              <Text style={styles.mlBoxTitle}>RUNES</Text>
              <View style={styles.mlRuneRow}>
                {[0, 1, 2].map((i) => {
                  const rune = equippedRunes[i];
                  const def = rune ? RUNE_TYPES[rune.type] : null;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.mlRuneSlot, !theme && def && { borderColor: def.color }, theme && styles.mlRuneSlotThemed]}
                      onPress={() => (rune ? onUnequipRune(rune.id) : setRunePickerSlot(i))}
                    >
                      {/* Avec un thème, le socle illustré remplace le
                          cercle uni. Posé en fond, le contenu (icône de
                          rune, niveau) reste au-dessus. */}
                      {theme && (
                        <Image source={theme.runeSlot} style={styles.mlRuneSlotImg} resizeMode="contain" />
                      )}
                      <Text style={styles.mlRuneEmoji}>{def ? def.icon : '＋'}</Text>
                      {rune && <Text style={styles.mlRuneLevel}>{rune.level}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ThemedBlock>
          </View>

          <View style={styles.mlRow}>
            <ThemedBlock theme={theme} style={styles.mlAttrBox}>
              <Text style={styles.mlBoxTitle}>ATTRIBUT</Text>
              <View style={styles.mlAttrRow}>
                <View style={[styles.mlAttrChip, { borderColor: RARITY_COLOR[creature.rarity] }]}>
                  <Text style={[styles.mlAttrChipText, { color: RARITY_COLOR[creature.rarity] }]}>
                    {RARITY_BADGE_LETTER[creature.rarity]}
                  </Text>
                </View>
                <View style={styles.mlAttrChip}>
                  <Text style={styles.mlAttrChipText}>{creature.element}</Text>
                </View>
                <View style={styles.mlAttrChip}>
                  <Text style={styles.mlAttrChipText}>{creature.combatType}</Text>
                </View>
              </View>
            </ThemedBlock>

            <ThemedBlock theme={theme} style={styles.mlSkillsBox}>
              <Text style={styles.mlBoxTitle}>ATTAQUES</Text>
              {creature.skills.slice(0, 2).map((skill) => (
                <Text key={skill.id} style={styles.mlSkillLine} numberOfLines={1}>
                  {skill.name} · {skill.damage} dgt
                </Text>
              ))}
            </ThemedBlock>
          </View>

          {/* Description bornée : elle se tronque au lieu de pousser le
              reste de la fiche hors de l'écran. */}
          {/* Même composant que les 4 panneaux : le cadre étant hors
              du flux, il n'y a plus de cas particulier à traiter ici. */}
          <ThemedBlock theme={theme} style={styles.mlLoreBox}>
            <Text style={styles.mlLoreText} numberOfLines={4}>{creature.lore}</Text>
          </ThemedBlock>
        </View>
      </View>
    </ThemedProfileBackground>

    {runePickerSlot !== null && (
      <RunePickerOverlay
        ownedRunes={ownedRunes}
        onPick={(runeId) => {
          onEquipRune(runeId);
          setRunePickerSlot(null);
        }}
        onClose={() => setRunePickerSlot(null)}
      />
    )}
    </>
  );
}

// Ligne de statistique compacte, façon encadré Monster Legends.
function MlStat({ icon, label, value, bonus, color }) {
  return (
    <View style={styles.mlStatLine}>
      <Text style={styles.mlStatIcon}>{icon}</Text>
      <Text style={styles.mlStatLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.mlStatValue} numberOfLines={1}>
        {value}{bonus > 0 && <Text style={{ color }}> +{bonus}</Text>}
      </Text>
    </View>
  );
}



// Tracé de la carte des chapitres (30/08) — positions calculées (pas de
// mise en page flexbox) pour pouvoir dessiner des tracés COURBES entre
// les niveaux plutôt que des lignes droites.
//
// Ces trois constantes avaient été supprimées par erreur lors du passage
// en paysage : un nettoyage de styles morts par expression régulière en
// mode DOTALL a mangé leur bloc en même temps qu'un style voisin, et
// l'écran Combat plantait sur « Property 'ROW_HEIGHT' doesn't exist ».
const LEVEL_NODE_SIZE = 46;
const ROW_HEIGHT = 92; // espace vertical entre deux niveaux
const WAVE_AMPLITUDE = 0.30; // amplitude horizontale du serpentin, en fraction de la largeur

// Position (fraction 0-1 de la largeur, y en px depuis le haut du
// chapitre) du niveau d'index `i` (0-9) dans son chapitre — une onde
// continue plutôt que 3 positions fixes en alternance, pour que la
// courbe entre deux niveaux consécutifs ait vraiment l'air organique.
function nodePosition(i) {
  const x = 0.5 + Math.sin(i * 0.95) * WAVE_AMPLITUDE;
  const y = i * ROW_HEIGHT + LEVEL_NODE_SIZE;
  return { x, y };
}

// Point sur une courbe de Bézier quadratique.
function bezierPoint(p0, p1, ctrl, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * ctrl.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * ctrl.y + t * t * p1.y,
  };
}

// Points intermédiaires (petits ronds) entre deux niveaux consécutifs,
// le long d'une courbe (pas une ligne droite) — le point de contrôle est
// décalé perpendiculairement au segment direct pour créer un vrai arc.
function pathDots(p0, p1, count = 7) {
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendiculaire normalisée, sens fixé par le signe de dx pour que
  // l'arc penche toujours "vers l'extérieur" du serpentin plutôt
  // qu'aléatoirement à gauche ou à droite.
  const bend = 26 * (dx >= 0 ? 1 : -1);
  const ctrl = { x: mx - (dy / len) * bend, y: my + (dx / len) * bend };
  const dots = [];
  for (let k = 1; k < count; k++) {
    dots.push(bezierPoint(p0, p1, ctrl, k / count));
  }
  return dots;
}

// Petit badge autonome, avec son propre tick d'1s pour un compte à
// rebours fluide (indépendant du rafraîchissement toutes les 30s côté
// AdventureScreen, qui lui met à jour la VRAIE valeur d'énergie).
function EnergyBadge({ energy, energyUpdatedAt }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const remaining = msUntilNextEnergy(energy, energyUpdatedAt, Date.now());
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  return (
    <View style={styles.energyBadge}>
      <Text style={styles.energyBadgeText}>⚡ {energy}/{ENERGY_MAX}</Text>
      {energy < ENERGY_MAX && (
        <Text style={styles.energyBadgeCountdown}>+1 dans {mm}:{String(ss).padStart(2, '0')}</Text>
      )}
    </View>
  );
}

// Explication du système d'éléments. Volontairement COURTE : le joueur
// l'ouvre en cours de partie, pas pour lire un manuel.
function ElementHelpOverlay({ onClose }) {
  return (
    <View style={styles.elemHelpBackdrop}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={styles.elemHelpCard}>
        <Text style={styles.elemHelpTitle}>Affinités élémentaires</Text>
        <Text style={styles.elemHelpLine}>
          Attaquer un élément que le tien domine inflige <Text style={styles.elemHelpStrong}>+30 %</Text> de dégâts.
          L'inverse en inflige <Text style={styles.elemHelpWeak}>−25 %</Text>.
        </Text>
        <Text style={styles.elemHelpChain}>🔥 Feu ▸ 💨 Air ▸ 🌍 Terre ▸ ⚡ Foudre ▸ 💧 Eau ▸ 🔥</Text>
        <Text style={styles.elemHelpLine}>
          ✨ Lumière et 🌑 Ténèbres se frappent <Text style={styles.elemHelpStrong}>fort mutuellement</Text>.
          {'\n'}🔮 Magie n'a ni avantage ni faiblesse.
        </Text>
        <Text style={styles.elemHelpFoot}>
          En combat, une pastille colorée au-dessus de chaque adversaire indique
          ta position : vert favorable, orange neutre, rouge défavorable.
        </Text>
        <TouchableOpacity style={styles.elemHelpClose} onPress={onClose}>
          <Text style={styles.elemHelpCloseText}>Compris</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Icône de monnaie (griffe ou diamant) avec un halo — image de dégradé
// radial pré-rendue (GLOW_GOLD/GLOW_CYAN), PAS le halo peint par Gemini
// dans l'asset d'origine (il se détourait mal contre le magenta, voir
// CLICKER_ADVENTURE_STATE.md § habillage Exploration) et PAS non plus des
// cercles plats superposés en style (2-3 anneaux d'opacité fixe créent
// des bandes visibles, aucune vraie primitive de flou n'existe en RN
// pur). Couleur calée sur la teinte dominante de chaque icône : cyan
// pour le diamant, or pour la griffe.
const CURRENCY_ICONS = {
  griffes: { source: GRIFFES_ICON, glow: GLOW_GOLD },
};

function CurrencyIcon({ kind, size = 22, haloed = true, style }) {
  const def = CURRENCY_ICONS[kind] || CURRENCY_ICONS.griffes;
  // Le halo déborde l'icône (×2,4) : c'est une lueur, elle doit se voir
  // autour du disque. L'asset de halo retombe à alpha 0 AVANT son bord,
  // sinon on voit un carré (bug du 12/09, voir règle 15).
  const glowSize = size * 2.4;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {haloed && (
        <Image
          source={def.glow}
          style={{
            position: 'absolute', width: glowSize, height: glowSize,
            left: (size - glowSize) / 2, top: (size - glowSize) / 2,
            pointerEvents: 'none',
          }}
          resizeMode="contain"
        />
      )}
      <Image source={def.source} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

// Compteur de monnaie : icône, montant, et « + » rouge.
//
// Le « + » n'est pas décoratif : il propose l'échange Diamants → Griffes
// (250 pour 25 💎), seule façon d'en obtenir sur-le-champ. Sans
// `onPlus`, le bouton n'est simplement pas rendu.
function CurrencyCounter({ currency = 'griffes', amount, onPlus, style }) {
  return (
    <View style={[styles.counterRow, style]}>
      <CurrencyIcon kind={currency} size={22} />
      <Text style={styles.counterValue} numberOfLines={1}>{amount}</Text>
      {onPlus && (
        <TouchableOpacity style={styles.counterPlus} onPress={onPlus} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.counterPlusText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ChapterMapScreen({ currentUnlockedLevel, owned, deck, griffes, ownedRunes, energy, energyUpdatedAt, onStartBattle, onLevelWon, onBack, onBuyEnergy, onBuyGriffes, diamonds = 0, levelStars = {}, onRecordStars }) {
  // Défilement automatique jusqu'au niveau courant : la carte s'ouvrait
  // en haut, obligeant à faire défiler à chaque visite pour retrouver où
  // on en est (signalé le 12/09).
  const mapScrollRef = useRef(null);
  const mapAutoScrolledRef = useRef(false);
  const scrollToCurrentLevel = () => {
    // Une seule fois par ouverture : sans ce garde, chaque changement de
    // taille du contenu ramènerait brutalement le joueur en place alors
    // qu'il est peut-être en train d'explorer la carte.
    if (mapAutoScrolledRef.current || !mapScrollRef.current) return;
    mapAutoScrolledRef.current = true;

    // Position dérivée du niveau : chaque niveau occupe ~86dp, on
    // recule d'un demi-écran pour le placer au centre.
    const y = Math.max(0, (currentUnlockedLevel - 1) * 86 - 160);
    mapScrollRef.current.scrollTo({ y, animated: false });
  };

  const [levelPreview, setLevelPreview] = useState(null); // numéro de niveau ou null

  const [activeBattle, setActiveBattle] = useState(null); // { levelNumber } ou null
  const [elemHelpOpen, setElemHelpOpen] = useState(false);

  // Replacement au retour d'un combat. `onContentSizeChange` ne se
  // déclenche pas dans ce cas (la taille du contenu est inchangée), il
  // faut donc un effet explicite. Le garde est réarmé d'abord, sinon
  // `scrollToCurrentLevel` sortirait immédiatement.
  //
  // ⚠️ Placé APRÈS la déclaration d'`activeBattle` : plus haut, il le
  // lisait avant son initialisation.
  useEffect(() => {
    if (activeBattle) return;
    mapAutoScrolledRef.current = false;
    scrollToCurrentLevel();
  }, [activeBattle, currentUnlockedLevel]);
  // TOUJOURS appelé avant tout retour anticipé (règle des Hooks React) —
  // c'était placé après le "if (activeBattle) return" et faisait planter
  // l'appli ("Rendered fewer hooks than expected") dès qu'on
  // entrait/sortait d'un combat, puisque le nombre de Hooks exécutés
  // différait d'un rendu à l'autre selon activeBattle.
  const { width: screenWidth } = useWindowDimensions();

  // Combat en cours — retour anticipé, même schéma que le reste de
  // l'écran Aventure. L'équipe entière (les 3 créatures du deck, dans
  // l'ordre) combat à tour de rôle — plus de sélection d'une seule
  // créature avant le combat.
  if (activeBattle) {
    const team = deck
      .filter((id) => id)
      .map((id) => ({
        creature: CREATURES.find((c) => c.id === id),
        ownedLevel: owned.find((o) => o.id === id).level,
        evolutionTier: owned.find((o) => o.id === id).evolutionTier || 0,
        // Runes équipées sur CETTE créature précise — c'est ce qui rend
        // les runes réellement actives en combat (voir CombatScreen.js).
        equippedRunes: ownedRunes.filter((r) => r.equippedCreatureId === id),
      }));
    return (
      <CombatScreen
        team={team}
        levelNumber={activeBattle.levelNumber}
        onFinish={(outcome, goNext, stars) => {
          if (outcome === 'win' && stars) {
            const lv = activeBattle.levelNumber;
            // Uniquement si c'est MIEUX qu'avant.
            onRecordStars(lv, stars);
          }
          if (outcome === 'win') {
            // Rune de Butin : bonus calculé sur TOUTES les runes
            // équipées des 3 créatures du deck (plafonné à +100% dans
            // butinBonus), pas sur la seule créature qui a porté le
            // coup final — c'est l'équipe qui gagne le combat.
            const deckRunes = ownedRunes.filter((r) => deck.includes(r.equippedCreatureId));
            const rawReward = griffesReward(activeBattle.levelNumber);
            const reward = Math.round(rawReward * (1 + butinBonus(deckRunes)));
            onLevelWon(activeBattle.levelNumber, reward);
          }
          const nextLevel = activeBattle.levelNumber + 1;

          setActiveBattle(null);
          // « Niveau suivant » : on rouvre directement l'écran de
          // préparation du niveau d'après, sans repasser par la carte.
          setLevelPreview(outcome === 'win' && goNext ? nextLevel : null);
        }}
      />
    );
  }

  // Affiche le chapitre en cours + 6 chapitres suivants (verrouillés,
  // pour montrer qu'il y a une suite) — porté de +2 à +6 (4 chapitres de
  // marge supplémentaires, demande explicite) plutôt que de générer une
  // liste potentiellement infinie d'un coup. La difficulté adverse reste
  // cohérente sur toute cette plage (vérifié : puissance totale
  // strictement croissante jusqu'au niveau 100 au moins, voir
  // combatLogic.js/opponentPowerBudget).
  const currentChapter = chapterForLevel(currentUnlockedLevel);
  const chaptersToShow = currentChapter + 6;
  const pathWidth = screenWidth - 28; // marges de l'écran (padding: 14 de chaque côté)
  const chapterHeight = (LEVELS_PER_CHAPTER - 1) * ROW_HEIGHT + LEVEL_NODE_SIZE * 2;

  return (
    <View style={styles.screen}>
      {/* Plein écran : la barre système casse l'immersion en paysage. */}
      <StatusBar hidden />
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>⚔️ Chapitres</Text>
      </View>
      <View style={styles.topStatsRow}>
        <CurrencyCounter currency="griffes" amount={griffes} onPlus={onBuyGriffes} />
        <EnergyBadge energy={energy} energyUpdatedAt={energyUpdatedAt} />
      </View>

      <ScrollView
        ref={mapScrollRef}
        contentContainerStyle={{ paddingBottom: 30 }}
        onContentSizeChange={scrollToCurrentLevel}
      >
        {Array.from({ length: chaptersToShow }, (_, chapterIdx) => chapterIdx + 1).map((chapterNum) => {
          // Positions converties en PIXELS tout de suite (x ET y dans la
          // même unité) — un vrai bug avait laissé x en fraction (0-1) et
          // y déjà en pixels, ce qui envoyait les points de contrôle des
          // courbes très loin hors écran (le calcul de perpendiculaire
          // mélangeait des échelles totalement différentes) : les
          // pointillés étaient bien calculés, juste invisibles car
          // positionnés à des milliers de pixels du cadre visible.
          const positions = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => {
            const p = nodePosition(i);
            return { x: p.x * pathWidth, y: p.y };
          });
          return (
            <View key={chapterNum} style={styles.chapterBlock}>
              <Text style={styles.chapterTitle}>Chapitre {chapterNum}</Text>
              <View style={[styles.chapterPath, { height: chapterHeight }]}>
                {/* Tracé courbe en pointillés entre chaque niveau consécutif —
                    dessiné EN PREMIER pour rester derrière les pastilles. */}
                {positions.slice(0, -1).map((p0, i) => {
                  const p1 = positions[i + 1];
                  return pathDots(p0, p1).map((d, di) => (
                    <View
                      key={`dot-${i}-${di}`}
                      style={[
                        styles.pathDot,
                        { left: d.x - 3, top: d.y - 3 },
                      ]}
                    />
                  ));
                })}

                {positions.map((pos, i) => {
                  const levelNum = (chapterNum - 1) * LEVELS_PER_CHAPTER + i + 1;
                  const state = levelNum < currentUnlockedLevel ? 'done' : levelNum === currentUnlockedLevel ? 'current' : 'locked';
                  return (
                    <TouchableOpacity
                      key={levelNum}
                      style={[
                        styles.levelNode,
                        { left: pos.x - LEVEL_NODE_SIZE / 2, top: pos.y - LEVEL_NODE_SIZE / 2 },
                        state === 'current' && styles.levelNodeCurrent,
                        state === 'done' && styles.levelNodeDone,
                      ]}
                      onPress={() => state !== 'locked' && setLevelPreview(levelNum)}
                      disabled={state === 'locked'}
                    >
                      {state === 'locked' ? (
                        <Ionicons name="lock-closed" size={16} color={COLORS.muted} />
                      ) : state === 'done' ? (
                        <Ionicons name="checkmark" size={20} color="#0a3d24" />
                      ) : (
                        <Text style={styles.levelNodeText}>{levelIndexInChapter(levelNum)}</Text>
                      )}
                      {/* Étoiles sous le nœud : le joueur voit d'un
                          coup d'œil les niveaux à refaire pour en
                          gagner davantage. Affichées seulement sur les
                          niveaux TERMINÉS — ailleurs elles n'auraient
                          rien à dire. */}
                      {levelStars[levelNum] > 0 && (
                        <View style={styles.levelStars}>
                          {[1, 2, 3].map((n) => (
                            <Text key={n} style={[styles.levelStar, n > levelStars[levelNum] && styles.levelStarOff]}>
                              {n <= levelStars[levelNum] ? '★' : '☆'}
                            </Text>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Recharge d'énergie payée en Diamants. Le débit est délégué au
          Clicker (qui détient la monnaie) ; ici on ne fait que remplir
          la jauge si le paiement a réussi. */}
      {/* Bouton d'aide, en bas à gauche. Masqué dès qu'un niveau est
          ouvert : il se superposait au panneau de préparation, où il
          n'a rien à faire. */}
      {!levelPreview && (
      <TouchableOpacity style={styles.elemHelpBtn} onPress={() => setElemHelpOpen(true)}>
        <Text style={styles.elemHelpBtnText}>🔥 Éléments</Text>
      </TouchableOpacity>
      )}

      {elemHelpOpen && <ElementHelpOverlay onClose={() => setElemHelpOpen(false)} />}

      {levelPreview && (
        <FighterSelectOverlay
          levelNumber={levelPreview}
          owned={owned}
          deck={deck}
          energy={energy}
          onClose={() => setLevelPreview(null)}
          onStart={() => {
            // 1 énergie par TENTATIVE (pas remboursée en cas de défaite,
            // c'est bien "1 vie", pas "1 vie par victoire") — bloque le
            // lancement si le joueur n'en a plus.
            if (!onStartBattle()) return;
            setActiveBattle({ levelNumber: levelPreview });
          }}
          onBuyEnergy={onBuyEnergy}
          diamonds={diamonds}
        />
      )}
    </View>
  );
}

// Aperçu avant combat — montre l'adversaire ET toute l'équipe qui va se
// battre (les 3 créatures du deck, à tour de rôle si l'une tombe). Plus
// de choix d'une seule créature : toute l'équipe part au combat.
// Écran Runes — achat aléatoire (100 Griffes) + fusion (2 runes du même
// type/niveau -> 1 rune au niveau supérieur). Sélection tactile simple :
// touche une 1ère rune pour la sélectionner, touche une 2ème rune
// compatible pour fusionner automatiquement.
// Boutique de runes : l'image porte le cadre et les 3 cases, le contenu
// est rendu EN ABSOLU par-dessus, aux fractions mesurées sur l'asset.
// Les cases sont de vrais trous, donc ce qu'on pose dedans se voit.
function RuneShopPanel({ width, griffes, specialOffer, onBuyRandom, onBuyPack, onBuySpecial }) {
  const H = width / SHOP_PANEL_RATIO;
  const slotTop = SHOP_SLOT_Y.top * H;
  const slotH = (SHOP_SLOT_Y.bottom - SHOP_SLOT_Y.top) * H;
  const offerDef = specialOffer ? RUNE_TYPES[specialOffer.type] : null;
  const soldOut = specialOffer ? specialOffer.purchased : true;

  const offers = [
    {
      key: 'special',
      icon: offerDef ? offerDef.icon : '✨',
      label: soldOut ? 'Épuisée' : 'Niv. 2',
      cost: RUNE_SPECIAL_COST,
      disabled: soldOut || griffes < RUNE_SPECIAL_COST,
      onPress: onBuySpecial,
    },
    { key: 'pack', icon: '🎒', label: `x${RUNE_PACK_SIZE}`, cost: RUNE_PACK_COST,
      disabled: griffes < RUNE_PACK_COST, onPress: onBuyPack },
    { key: 'random', icon: '🎲', label: 'Aléatoire', cost: RUNE_COST,
      disabled: griffes < RUNE_COST, onPress: onBuyRandom },
  ];

  return (
    <View style={{ width, height: H }}>
      <Image
        source={RUNES_SHOP_PANEL}
        style={{ position: 'absolute', width, height: H, pointerEvents: 'none' }}
        resizeMode="stretch"
      />
      {/* Titre écrit DANS la bannière vide de l'image. */}
      <View
        style={{
          position: 'absolute',
          left: SHOP_BANNER.left * width,
          width: (SHOP_BANNER.right - SHOP_BANNER.left) * width,
          top: SHOP_BANNER.top * H,
          height: (SHOP_BANNER.bottom - SHOP_BANNER.top) * H,
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Text style={styles.shopBannerText} numberOfLines={1}>BOUTIQUE</Text>
      </View>

      {offers.map((o, i) => {
        const slot = SHOP_SLOTS[i];
        return (
          <TouchableOpacity
            key={o.key}
            style={{
              position: 'absolute',
              left: slot.left * width, width: (slot.right - slot.left) * width,
              top: slotTop, height: slotH,
              alignItems: 'center', justifyContent: 'center',
              opacity: o.disabled ? 0.45 : 1,
            }}
            onPress={o.onPress}
            disabled={o.disabled}
            activeOpacity={0.75}
          >
            <Text style={styles.shopOfferIcon}>{o.icon}</Text>
            <Text style={styles.shopOfferLabel} numberOfLines={1}>{o.label}</Text>
            <View style={styles.shopPriceRow}>
              <Text style={styles.shopPriceText}>{o.cost}</Text>
              <Image source={GRIFFES_ICON} style={styles.shopPriceIcon} resizeMode="contain" />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RunesScreen({ griffes, ownedRunes, onBuyRune, onBuyPack, onBuySpecial, specialOffer, onFuseRunes, onBuyGriffes, onBack }) {
  // Écran de fusion dédié (30/08) — remplace l'ancien mode "tape une
  // rune puis retape une pareille", pas très intuitif (fallait deviner
  // quelle rune correspondait à quelle autre). Regroupe automatiquement
  // les runes identiques, un seul bouton clair par groupe.
  const [fusionOpen, setFusionOpen] = useState(false);
  const [shopW, setShopW] = useState(0);

  if (fusionOpen) {
    return <RuneFusionScreen ownedRunes={ownedRunes} onFuseRunes={onFuseRunes} onBack={() => setFusionOpen(false)} />;
  }

  return (
    <View style={styles.screen}>
      {/* Plein écran : la barre système casse l'immersion en paysage. */}
      <StatusBar hidden />
      {/* Même disposition que le menu Aventure : retour à gauche, titre,
          et le compteur de Griffes avec son « + » en HAUT À DROITE. Le
          solde était auparavant un texte centré sans bouton — le joueur
          voyait le prix d'une rune sans pouvoir recharger sur place. */}
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}><Image source={RUNES_GEM} style={styles.inlineCurrencyIconTitle} resizeMode="contain" /> Runes</Text>
        <View style={styles.headerSpacer} />
        <CurrencyCounter currency="griffes" amount={griffes} onPlus={onBuyGriffes} />
      </View>

      {/* Paysage : la boutique occupe la colonne de DROITE, la
          collection celle de gauche. La hauteur est la ressource rare en
          paysage, on ne l'empile pas verticalement. */}
      <View style={styles.runesBody}>
        <View style={styles.runesLeftCol}>
          <TouchableOpacity style={styles.fusionModeBtn} onPress={() => setFusionOpen(true)}>
            <Text style={styles.fusionModeBtnText}>🔀 Fusionner des runes</Text>
          </TouchableOpacity>
          <Text style={styles.runeHint}>
            Pour équiper une rune, va dans la fiche d'une créature.
          </Text>
          <ScrollView contentContainerStyle={styles.runeGrid}>
        {ownedRunes.length === 0 ? (
          <Text style={styles.runeEmptyText}>Aucune rune pour l'instant — achètes-en une ci-dessus !</Text>
        ) : (
          ownedRunes
            .slice()
            .sort((a, b) => b.level - a.level)
            .map((rune) => {
              const def = RUNE_TYPES[rune.type];
              return (
                <View key={rune.id} style={[styles.runeCell, { borderColor: def.color, opacity: 0.9 }]}>
                  <Text style={styles.runeEmoji}>{def.icon}</Text>
                  <Text style={styles.runeLevel}>Niv. {rune.level}</Text>
                  {rune.equippedCreatureId && <Text style={styles.runeEquippedTag}>équipée</Text>}
                </View>
              );
            })
        )}
          </ScrollView>
        </View>

        {/* Boutique : panneau illustré en HAUT À DROITE. Sa largeur est
            mesurée par onLayout et sa hauteur en découle (ratio de
            l'image) — jamais l'inverse, sinon le cadre se déforme. */}
        <View style={styles.runesRightCol} onLayout={(e) => setShopW(e.nativeEvent.layout.width)}>
          {shopW > 0 && (
            <RuneShopPanel
              width={shopW}
              griffes={griffes}
              specialOffer={specialOffer}
              onBuyRandom={onBuyRune}
              onBuyPack={onBuyPack}
              onBuySpecial={onBuySpecial}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// Écran de fusion — regroupe les runes par type+niveau IDENTIQUES, un
// bouton "Fusionner" unique et clair par groupe (au lieu de deviner
// quelle rune correspond à quelle autre). Grisé/désactivé si moins de 2
// exemplaires, ou si déjà au palier maximum.
function RuneFusionScreen({ ownedRunes, onFuseRunes, onBack }) {
  const groups = {};
  ownedRunes.forEach((r) => {
    const key = `${r.type}_${r.level}`;
    (groups[key] = groups[key] || []).push(r);
  });
  const groupList = Object.values(groups).sort((a, b) => {
    if (a[0].type !== b[0].type) return a[0].type.localeCompare(b[0].type);
    return b[0].level - a[0].level;
  });

  const handleFuse = (group) => {
    // Fusionne 2 runes NON équipées en priorité (pas de surprise sur le
    // matériel d'une créature) — si moins de 2 sont libres, inclut une
    // rune équipée (son emplacement est de toute façon reporté sur la
    // nouvelle rune fusionnée, voir fuseRunes plus haut).
    const unequipped = group.filter((r) => !r.equippedCreatureId);
    const pool = unequipped.length >= 2 ? unequipped : group;
    onFuseRunes(pool[0].id, pool[1].id);
  };

  return (
    <View style={styles.screen}>
      {/* Plein écran : la barre système casse l'immersion en paysage. */}
      <StatusBar hidden />
      <View style={styles.header}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>🔀 Fusionner</Text>
      </View>
      <Text style={styles.runeHint}>2 runes identiques (même type, même niveau) fusionnent en 1 rune au niveau supérieur.</Text>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
        {groupList.length === 0 ? (
          <Text style={styles.runeEmptyText}>Aucune rune pour l'instant.</Text>
        ) : (
          groupList.map((group) => {
            const rune = group[0];
            const def = RUNE_TYPES[rune.type];
            const isMaxed = rune.level >= RUNE_MAX_LEVEL;
            const canFuse = group.length >= 2 && !isMaxed;
            return (
              <View key={rune.type + '_' + rune.level} style={[styles.fusionGroupCard, { borderColor: def.color }]}>
                <View style={styles.fusionGroupInfo}>
                  <Text style={styles.runeEmoji}>{def.icon}</Text>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.fusionGroupName}>{def.name}</Text>
                    <Text style={styles.fusionGroupCount}>Niveau {rune.level} · possédées : {group.length}</Text>
                  </View>
                </View>
                {isMaxed ? (
                  <Text style={styles.fusionGroupMaxed}>Niveau max</Text>
                ) : (
                  <TouchableOpacity
                    style={[styles.fusionBtn, !canFuse && styles.fusionBtnDisabled]}
                    onPress={() => handleFuse(group)}
                    disabled={!canFuse}
                  >
                    <Text style={[styles.fusionBtnText, !canFuse && styles.fusionBtnTextDisabled]}>Fusionner → Niv. {rune.level + 1}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}


// Sélecteur affiché quand on touche une case de rune VIDE dans la fiche
// d'une créature — ne propose que les runes NON équipées ailleurs (une
// rune ne peut être sur qu'une seule créature à la fois).
function RunePickerOverlay({ ownedRunes, onPick, onClose }) {
  const available = ownedRunes.filter((r) => !r.equippedCreatureId);
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayPanel}>
        <BackButton onPress={onClose} style={styles.overlayClose} />
        <Text style={styles.overlayTitle}>Choisir une rune</Text>
        {available.length === 0 ? (
          <Text style={[styles.overlaySubtitle, { marginTop: 10 }]}>
            Aucune rune disponible — achètes-en une ou libères-en une déjà équipée ailleurs.
          </Text>
        ) : (
          <View style={[styles.runeGrid, { marginTop: 14 }]}>
            {available
              .slice()
              .sort((a, b) => b.level - a.level)
              .map((rune) => {
                const def = RUNE_TYPES[rune.type];
                return (
                  <TouchableOpacity
                    key={rune.id}
                    style={[styles.runeCell, { borderColor: def.color }]}
                    onPress={() => onPick(rune.id)}
                  >
                    <Text style={styles.runeEmoji}>{def.icon}</Text>
                    <Text style={styles.runeLevel}>Niv. {rune.level}</Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}
      </View>
    </View>
  );
}

function FighterSelectOverlay({ levelNumber, owned, deck, energy, onClose, onStart, onBuyEnergy, diamonds = 0 }) {
  const opponent = opponentForLevel(levelNumber);
  const display = opponent.stages[0];
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));
  const teamCount = deck.filter((id) => id).length;

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayPanel}>
        <BackButton onPress={onClose} style={styles.overlayClose} />
        <Text style={styles.overlayTitle}>
          Chapitre {chapterForLevel(levelNumber)} · Niveau {levelIndexInChapter(levelNumber)}
        </Text>
        <CreatureArt
          creatureId={opponent.id}
          stageIndex={0}
          emoji={display.emoji}
          size={72}
          emojiStyle={{ fontSize: 50, marginVertical: 6 }}
          style={{ marginVertical: 6 }}
        />
        <Text style={[styles.overlaySubtitle, { color: RARITY_COLOR[opponent.rarity] }]}>
          Adversaire : {display.name}
        </Text>

        <Text style={[styles.overlaySubtitle, { marginTop: 14, marginBottom: 8 }]}>Ton équipe (à tour de rôle) :</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {deck.map((id, i) => {
            const creature = id ? CREATURES.find((c) => c.id === id) : null;
            const own = id ? ownedMap[id] : null;
            const fighterDisplay = creature && own ? creature.stages[stageForLevel(own.level)] : null;
            return (
              <View key={i} style={[styles.fighterPick, creature && { borderColor: RARITY_COLOR[creature.rarity] }]}>
                {fighterDisplay ? (
                  <CreatureArt
                    creatureId={id}
                    stageIndex={stageForLevel(own.level)}
                    emoji={fighterDisplay.emoji}
                    size={42}
                    emojiStyle={{ fontSize: 30 }}
                  />
                ) : (
                  <Text style={{ fontSize: 24, opacity: 0.3 }}>🥚</Text>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.energyCostText}>⚡ Coûte 1 énergie ({energy}/{ENERGY_MAX} disponible{energy > 1 ? 's' : ''})</Text>

        <View style={styles.startRow}>
          <TouchableOpacity
            style={[styles.startBattleBtn, styles.startBattleBtnFlex, (teamCount === 0 || energy <= 0) && styles.actionBtnDisabledAdv]}
            onPress={onStart}
            disabled={teamCount === 0 || energy <= 0}
          >
            <Text style={styles.startBattleBtnText}>
              {teamCount === 0 ? 'Deck vide' : energy <= 0 ? '⚡ Plus d\'énergie' : '⚔️ Combattre'}
            </Text>
          </TouchableOpacity>

          {/* Petit carré à DROITE plutôt qu'une barre en dessous : la
              recharge est une action secondaire, elle ne doit pas peser
              autant que « Combattre ». */}
          {energy <= 0 && onBuyEnergy && (
            <TouchableOpacity
              style={[styles.buyEnergyBtn, diamonds < ENERGY_DIAMOND_COST && styles.actionBtnDisabledAdv]}
              onPress={onBuyEnergy}
              disabled={diamonds < ENERGY_DIAMOND_COST}
            >
              <Text style={styles.buyEnergyIcon}>💎</Text>
              <Text style={styles.buyEnergyCost}>{ENERGY_DIAMOND_COST}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recharge en Diamants quand la jauge est vide : sans ça, le
            joueur n'a plus qu'à fermer l'appli et attendre. */}


      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // backgroundColor sert de repère sombre en attendant le fond noir
  // que l'utilisateur va fournir, à poser ici derrière le parchemin.
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerSpacer: { flex: 1 },
  // Écran Runes en 2 colonnes (paysage) : collection à gauche, boutique
  // illustrée à droite. En paysage la hauteur est la ressource rare, on
  // n'empile pas verticalement.
  runesBody: { flex: 1, flexDirection: 'row', gap: 12 },
  runesLeftCol: { flex: 1 },
  runesRightCol: { width: '46%', alignItems: 'stretch' },
  shopBannerText: { color: '#f3e3c0', fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  shopOfferIcon: { fontSize: 30 },
  shopOfferLabel: { color: '#f3e3c0', fontSize: 10, fontWeight: '800', marginTop: 2 },
  shopPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  shopPriceText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  shopPriceIcon: { width: 12, height: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '900' },

  editSlotBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: 'rgba(245,197,66,0.1)', borderRadius: 8 },
  editSlotBtnText: { color: COLORS.action, fontSize: 9, fontWeight: '700' },



  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  overlayPanel: {
    width: '100%', backgroundColor: COLORS.panel, borderRadius: 20, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  overlayClose: { position: 'absolute', top: 10, left: 10, zIndex: 5 },
  overlayTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  overlaySubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },

  chapterBlock: { marginBottom: 28 },
  chapterTitle: { color: COLORS.action, fontSize: 15, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  chapterPath: { width: '100%', position: 'relative' },
  pathDot: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  levelNode: {
    position: 'absolute',
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  levelNodeCurrent: {
    borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.15)',
    shadowColor: COLORS.action, shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  levelNodeDone: { borderColor: COLORS.good, backgroundColor: COLORS.good },
  levelNodeText: { color: COLORS.text, fontSize: 15, fontWeight: '900' },

  topStatsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
  energyBadge: { alignItems: 'center' },
  energyBadgeText: { color: COLORS.neonCyan, fontSize: 13, fontWeight: '800' },
  energyBadgeCountdown: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 1 },
  levelStars: {
    position: 'absolute', bottom: -13, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 1,
  },
  levelStar: {
    fontSize: 11, color: '#ffcf3f',
    textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 2,
  },
  levelStarOff: { color: 'rgba(120,90,40,0.75)' },

  elemHelpBtn: {
    position: 'absolute', left: 12, bottom: 12, zIndex: 15,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: 'rgba(10,20,32,0.9)',
    borderWidth: 1.5, borderColor: COLORS.action,
  },
  elemHelpBtnText: { color: COLORS.action, fontSize: 12, fontWeight: '900' },
  elemHelpBackdrop: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.66)', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  elemHelpCard: {
    maxWidth: 520, padding: 18, borderRadius: 16,
    backgroundColor: COLORS.bg, borderWidth: 2, borderColor: COLORS.action,
  },
  elemHelpTitle: { color: COLORS.action, fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  elemHelpLine: { color: COLORS.text, fontSize: 12, fontWeight: '600', lineHeight: 18, marginBottom: 8 },
  elemHelpChain: {
    color: COLORS.text, fontSize: 13, fontWeight: '900', textAlign: 'center',
    marginBottom: 10, letterSpacing: 0.3,
  },
  elemHelpStrong: { color: '#3ddc84', fontWeight: '900' },
  elemHelpWeak: { color: '#ff5a4a', fontWeight: '900' },
  elemHelpFoot: { color: COLORS.muted, fontSize: 11, fontWeight: '600', lineHeight: 16, marginBottom: 12 },
  elemHelpClose: {
    alignSelf: 'center', paddingVertical: 9, paddingHorizontal: 26,
    borderRadius: 12, backgroundColor: COLORS.action,
  },
  elemHelpCloseText: { color: '#0b0d16', fontSize: 13, fontWeight: '900' },

  startRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, alignSelf: 'stretch' },
  startBattleBtnFlex: { flex: 1 },
  buyEnergyBtn: {
    width: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(42,127,168,0.22)',
    borderWidth: 1.5, borderColor: '#7fdcff',
  },
  buyEnergyIcon: { fontSize: 16 },
  buyEnergyCost: { color: '#7fdcff', fontSize: 12, fontWeight: '900', marginTop: 1 },
  energyCostText: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 10, marginBottom: 4 },
  fighterPick: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  startBattleBtn: {
    backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 30, marginTop: 20,
    shadowColor: COLORS.action, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  startBattleBtnText: { color: '#241a00', fontSize: 15, fontWeight: '900' },

  runeHint: { color: COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 14, marginBottom: 10, paddingHorizontal: 10 },
  runeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingBottom: 30 },
  runeEmptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 20, width: '100%' },
  runeCell: {
    width: 84, backgroundColor: COLORS.panel, borderRadius: 14, padding: 12, alignItems: 'center',
    borderWidth: 2,
  },
  runeEmoji: { fontSize: 30 },
  runeLevel: { color: COLORS.text, fontSize: 11, fontWeight: '800', marginTop: 4 },
  actionBtnDisabledAdv: { opacity: 0.4 },



  // ---------- Mise en page PAYSAGE ----------
  // En paysage la HAUTEUR est la ressource rare : marges et polices sont
  // volontairement plus serrées qu'en portrait, et la navigation passe
  // dans l'en-tête plutôt que dans une barre du bas.
  headerLand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6,
  },
  // Bannière de titre : le texte s'écrit DANS le parchemin, dont le
  // centre a été demandé lisse à la génération pour cela.
  // `position: absolute` centré sur TOUT l'écran : en `flex: 1` dans la
  // rangée, le bouton retour à gauche et les compteurs à droite n'ont
  // pas la même largeur, ce qui décalait le titre vers la gauche.
  titleBanner: {
    position: 'absolute', left: '50%', marginLeft: -170, top: 4,
    width: 340, height: 52, alignItems: 'center', justifyContent: 'center',
  },
  titleBannerText: {
    color: '#5a3d16', fontSize: 17, fontWeight: '900', letterSpacing: 2,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Fond/bordure retirés (cadre réel intégré, currency-pill.png,
  // 320x120) — appliqué aussi dans ChapterMapScreen ("menu combat").
  // Largeur fixe (pas de %+aspectRatio combinés, cause confirmée d'un
  // bug Yoga ailleurs dans le projet, voir CLICKER_ADVENTURE_STATE.md).
  // Compteur épuré (12/09) : plus de cadre ouvragé. Fond sombre
  // translucide pour rester lisible sur n'importe quel décor.
  counterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingLeft: 8, paddingRight: 4, paddingVertical: 4, borderRadius: 16,
    backgroundColor: 'rgba(8,14,24,0.72)',
  },
  // Icônes 🐾/💎 remplacées par des images (12/09) — tailles calées sur
  // le fontSize du texte qui les entoure, en `Image` inline dans un `Text`.
  inlineCurrencyIcon: { width: 14, height: 14 },
  inlineCurrencyIconTitle: { width: 18, height: 18 },
  counterValue: { color: '#fff', fontSize: 14, fontWeight: '900' },
  counterPlus: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#e03a3a', borderWidth: 1.5, borderColor: '#ff7a6b',
  },
  counterPlusText: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 17 },
  // Fond/bordure retirés (image réelle intégrée, cadre déjà peint dedans).
  runesTopBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
  },
  // Halo posé derrière la gemme, débordant du bouton (×2,4 comme les
  // compteurs). Décoratif : il ne doit jamais voler le tap du bouton.
  runesTopBtnGlow: {
    position: 'absolute', width: 91, height: 91, left: -26.5, top: -26.5,
    pointerEvents: 'none',
  },
  runesTopBtnImage: { width: 38, height: 38 },

  // Les 3 créatures occupent toute la largeur, à parts égales.
  // Rangée centrée : les cartes ont désormais une taille fixe en
  // portrait, elles ne remplissent plus la largeur. `space-evenly` les
  // répartit dans le parchemin au lieu de les coller à gauche.
  creatureRowLand: { flexDirection: 'row', gap: 12, flex: 1, alignItems: 'center', justifyContent: 'space-evenly' },
  creatureCellLand: { alignItems: 'center' },
  creatureSlotLand: {
    backgroundColor: COLORS.panel, borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8,
  },
  // Avec un cadre illustré : plus de fond ni de bordure unie. Les marges
  // sont posées à l'appel, en pixels dérivés de la taille réelle de la
  // carte (voir le rendu) — pas ici, où l'on ne connaît pas ses
  // dimensions.
  creatureSlotFramed: {
    backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0,
  },
  creatureFrameImg: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    width: undefined, height: undefined,
    // Décoratif : ne doit jamais voler le tap de la carte.
    pointerEvents: 'none',
  },
  creatureEmojiLand: { fontSize: 46 },
  creatureNameLand: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 4 },
  emptySlotEmojiLand: { fontSize: 40, opacity: 0.35 },
  // `flex-end` et non `space-between` : le texte d'aide ayant été
  // retiré, le bouton était le seul enfant et serait resté collé à
  // gauche.
  bottomLand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  // Fond doré retiré (image réelle intégrée à la place), juste un
  // conteneur pour la taper — même position bas-droite qu'avant
  // (bottomLand en row/space-between, ce bouton est le 2e élément).
  combatBtnLand: {
    alignItems: 'center', justifyContent: 'center',
  },
  // Agrandi de 130x43 à 230x55 : ratio de l'image conservé (700x167),
  // le texte s'écrit dans sa plaque centrale.
  combatBtnImg: { width: 230, height: 55, alignItems: 'center', justifyContent: 'center' },
  combatBtnText: {
    color: '#3a2608', fontSize: 15, fontWeight: '900', letterSpacing: 1.5,
    marginLeft: 26,
  },

  // ---------- Profil de créature (2 colonnes) ----------

  // Delta de bonus affiché à côté de la stat concernée — couleur liée au
  // TYPE de rune (demande explicite : vert pour PV, rouge pour ATQ).

  fusionModeBtn: {
    borderRadius: 14, paddingVertical: 10, alignItems: 'center', marginTop: 10,
    borderWidth: 1.5, borderColor: COLORS.neonCyan, backgroundColor: 'rgba(62,198,240,0.08)',
  },
  fusionModeBtnText: { color: COLORS.neonCyan, fontSize: 13, fontWeight: '800' },
  runeEquippedTag: { color: COLORS.action, fontSize: 8, fontWeight: '800', marginTop: 2 },

  fusionGroupCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.panel, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5,
  },
  // `minWidth: 0` : sans ça, Yoga refuse de rétrécir un élément flex
  // sous la largeur de son texte, et l'élément voisin (bouton, valeur)
  // sort de la ligne. Même défaut que les boutons d'achat du Shop.
  fusionGroupInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  fusionGroupName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  fusionGroupCount: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  fusionGroupMaxed: { color: COLORS.muted, fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
  fusionBtn: { backgroundColor: COLORS.action, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  fusionBtnDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  fusionBtnText: { color: '#241a00', fontSize: 11, fontWeight: '800' },
  fusionBtnTextDisabled: { color: COLORS.muted },

  // ---------- Profil de créature, calqué sur Monster Legends ----------
  // Aucune ScrollView : tout doit tenir. Les hauteurs se partagent
  // l'espace via `flex`, jamais via des valeurs fixes qui déborderaient
  // sur un écran plus court.
  profileScreen: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 10, paddingBottom: 8 },
  profileScrim: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(8,6,10,0.45)',
  },
  profileTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  profileBackBtn: {
    width: 38, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border,
  },
  profileBody: { flex: 1, flexDirection: 'row', gap: 10 },

  // --- colonne gauche ---
  mlLeft: { width: '44%', alignItems: 'center' },
  mlPortraitZone: {
    flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panel, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  // Avec un thème, la créature se pose directement sur le décor : ni
  // fond ni bordure, sinon elle apparaît dans une boîte posée devant le
  // piédestal au lieu d'être dessus.
  // Idem : marge en pixels. Écarte le texte des ornements latéraux du
  // bouton pour qu'il tombe dans la zone lisse du centre.
  // Bouton d'amélioration mis en avant : lueur dorée autour et texte
  // clair sur l'illustration. Remonté de ~0,5 cm (30dp) par une marge
  // NÉGATIVE en haut, qui rapproche du bloc précédent sans laisser de
  // vide derrière lui.
  mlMainBtnThemed: {
    backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0,
    paddingHorizontal: 46,
    marginTop: -30,
    shadowColor: COLORS.action, shadowOpacity: 0.95, shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  mlMainBtnTextThemed: {
    color: '#fff5d6', fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5,
  },
  mlMainBtnImg: {
    position: 'absolute', left: 0, right: 0, top: -6, bottom: -6,
    width: undefined, height: undefined,
    pointerEvents: 'none',
  },
  // 1 cm ≈ 63dp (1 pouce = 160dp, 2,54 cm par pouce). Remontée de
  // 1,5 cm ≈ 94dp pour poser la créature sur le piédestal peint dans le
  // décor. `transform` plutôt qu'une marge : ça déplace le rendu sans
  // toucher à la place occupée dans la colonne, donc sans décaler le
  // reste.
  mlPortraitZoneThemed: {
    backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0,
    justifyContent: 'flex-end', paddingBottom: 4,
    // Remontée ramenée de 94 à 50dp : 1,5 cm était trop, la créature
    // flottait au-dessus du rocher. 50dp la pose sur le repère indiqué.
    transform: [{ translateY: -50 }],
    // ⚠️ INDISPENSABLE : cette zone est rendue APRÈS le bouton
    // d'amélioration, donc au-dessus, et la remontée de 50dp la fait
    // recouvrir ce bouton. Sans ça elle intercepte les taps et la
    // montée de niveau devient impossible (signalé le 11/09). La zone
    // est purement décorative, elle ne doit jamais capter un tap.
    pointerEvents: 'none',
  },
  mlPortraitEmoji: { fontSize: 96 },
  mlName: { color: COLORS.text, fontSize: 15, fontWeight: '900', marginTop: 6 },
  mlStars: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  mlStarsText: { color: COLORS.action, fontSize: 14 },
  mlLevelText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  mlLevelBarTrack: {
    width: '90%', height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 4, overflow: 'hidden',
  },
  mlLevelBarFill: { height: '100%', backgroundColor: COLORS.neonCyan },
  mlMainBtn: {
    width: '100%', backgroundColor: COLORS.action, borderRadius: 12,
    paddingVertical: 9, alignItems: 'center', marginTop: 7,
  },
  mlMainBtnText: { color: '#0b0d16', fontSize: 13, fontWeight: '900' },
  mlEvoBtn: {
    width: '100%', backgroundColor: 'rgba(246,195,67,0.15)', borderRadius: 12,
    paddingVertical: 8, alignItems: 'center', marginTop: 5,
    borderWidth: 1, borderColor: COLORS.action,
  },
  mlEvoBtnText: { color: COLORS.action, fontSize: 12, fontWeight: '900' },
  mlSubNote: { color: COLORS.muted, fontSize: 10, fontStyle: 'italic', marginTop: 6, textAlign: 'center' },

  // --- colonne droite ---
  // Écarts portés à 16 : chaque panneau doit respirer pour que son
  // cadre se lise comme un cadre, et non comme une cloison partagée
  // avec le panneau voisin.
  // `alignItems: 'flex-start'` : les blocs ne s'étirent plus en hauteur,
  // ils prennent la taille de leur CONTENU — c'est tout le principe du
  // nouveau système. Les écarts tombent à 0 : ce sont les marges
  // proportionnelles de ThemedBlock qui espacent désormais les cadres.
  mlRight: { flex: 1, gap: 0, justifyContent: 'center' },
  mlRow: { flexDirection: 'row', gap: 0, alignItems: 'flex-start' },
  mlBoxTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  mlStatsBox: {
    flex: 1.25, backgroundColor: COLORS.panel, borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: COLORS.border, justifyContent: 'space-around',
  },
  // Avec un thème, le panneau perd sa bordure unie : c'est le cadre
  // ouvragé qui la remplace. Le fond reste légèrement opaque pour
  // garder le texte lisible sur le décor.
  // PAS de `flex: undefined` ici : dans une rangée, `flex` pilote la
  // LARGEUR, tandis que c'est `alignItems: 'flex-start'` de la rangée
  // qui donne la hauteur du contenu. L'annuler rétrécissait les blocs à
  // la largeur de leur texte — les libellés de stats étaient tronqués
  // en « ··· » et les panneaux n'atteignaient plus le bord droit.
  themedBlockOuter: {
    backgroundColor: 'rgba(18,10,8,0.86)',
    borderColor: 'transparent', borderWidth: 0,
  },
  mlRuneSlotThemed: { backgroundColor: 'transparent', borderColor: 'transparent' },
  mlRuneSlotImg: {
    position: 'absolute', left: -5, right: -5, top: -5, bottom: -5,
    width: undefined, height: undefined,
    pointerEvents: 'none',
  },
  // Décalage vers la droite des lignes de stats (demande du 11/09) :
  // elles se collaient au bord gauche de l'ouverture du cadre.
  mlStatLine: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 14 },
  mlStatIcon: { fontSize: 13 },
  mlStatLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', flex: 1 },
  mlStatValue: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  mlRunesBox: {
    flex: 1, backgroundColor: COLORS.panel, borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center',
  },
  mlRuneRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  mlRuneSlot: {
    width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panelLight, borderWidth: 1, borderColor: COLORS.border,
  },
  mlRuneEmoji: { fontSize: 18 },
  mlRuneLevel: { color: COLORS.muted, fontSize: 9, fontWeight: '800' },
  mlAttrBox: {
    flex: 1.25, backgroundColor: COLORS.panel, borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  mlAttrRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  mlAttrChip: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
    backgroundColor: COLORS.panelLight, borderWidth: 1, borderColor: COLORS.border,
  },
  mlAttrChipText: { color: COLORS.text, fontSize: 9, fontWeight: '800' },
  mlSkillsBox: {
    flex: 1, backgroundColor: COLORS.panel, borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  mlSkillLine: { color: COLORS.text, fontSize: 9, fontWeight: '700', marginBottom: 2 },
  mlLoreBox: {
    backgroundColor: COLORS.panel, borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  mlLoreText: { color: COLORS.muted, fontSize: 10, lineHeight: 14 },

  sectionCard: {
    backgroundColor: COLORS.panel, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.action, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  sectionBody: { color: COLORS.text, fontSize: 13, lineHeight: 19 },
  speciesNote: { color: COLORS.muted, fontSize: 11, fontStyle: 'italic', marginBottom: 6 },

});

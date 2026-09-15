// Écran principal du mode Aventure. Voir mobile/ADVENTURE_MODE.md pour
// le design complet et l'ordre de construction — ceci ajoute l'étape 4
// (carte des chapitres/niveaux, structure visuelle seulement, le vrai
// combat derrière chaque niveau arrive à l'étape 5).
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions, Image, ImageBackground, Animated, Alert } from 'react-native';
import BackButton from '../../components/BackButton';
import CreatureArt from '../../components/CreatureArt';
import { elementTheme } from './elementThemes';
import { PENDING_FREE_RUNE_KEY } from '../../games/clicker/questLogic';
import { CHAPTER_ROUTES } from './chapterRoutes';
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
// Étoile de note (14/09). Une seule image pour les 3 étoiles : les
// « vides » sont la MÊME image recolorée par `tintColor`, ce qui garde
// exactement la même silhouette.
const STAR_ICON = require('../../../assets/icons/star.png');

// Emprise des boutons de l'en-tête, en dp, MESURÉE sur des captures
// (2000x923). Sert à savoir si une rangée d'étoiles tient au-dessus d'un
// niveau sans passer sous un bouton.
const HEADER_BOXES = [
  { x0: 14, x1: 134, y0: 8, y1: 43 },    // Retour
  { x0: 584, x1: 676, y0: 13, y1: 43 },  // Éléments
  { x0: 687, x1: 836, y0: 13, y1: 44 },  // Griffes + Énergie
];
const STAR_SIZE = 12;
const STAR_GAP = 2;
const STAR_OFFSET = 10;   // écart entre le nœud et la rangée

// Rangée de 3 étoiles. `filled` = nombre d'étoiles gagnées.
function StarRow({ filled, size = STAR_SIZE, style }) {
  return (
    <View style={[styles.starRow, { gap: STAR_GAP }, style]}>
      {[1, 2, 3].map((n) => (
        <Image
          key={n}
          source={STAR_ICON}
          style={[{ width: size, height: size }, n > filled && styles.starRowEmpty]}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

// Une rangée tient-elle AU-DESSUS du nœud ? Sinon elle repasse dessous.
// Les niveaux 10 sont collés au haut de l'écran : sans ce repli, leurs
// étoiles finiraient sous les boutons ou hors de l'écran (vérifié : 6
// cas sur 120).
function starsFitAbove(x, y) {
  const rowW = 3 * STAR_SIZE + 2 * STAR_GAP;
  const top = y - LEVEL_NODE_SIZE / 2 - STAR_OFFSET - STAR_SIZE;
  const bottom = y - LEVEL_NODE_SIZE / 2 - STAR_OFFSET;
  const left = x - rowW / 2;
  const right = x + rowW / 2;
  if (top < 2) return false;
  return !HEADER_BOXES.some(
    (b) => right > b.x0 && left < b.x1 && bottom > b.y0 && top < b.y1
  );
}

// Panneau de la boutique de runes (Gemini, détouré ici). Les 3 cases
// sont de vrais TROUS dans l'image : on y rend le contenu en code, donc
// il reste modifiable sans repasser par Gemini. Fractions MESURÉES sur
// l'asset, à remesurer si l'image change.
const RUNES_SHOP_PANEL = require('../../../assets/icons/runes-shop-panel.png');
// Atelier de fusion : le panneau (enclume + plaque dorée) et les DEUX
// poses du marteau. L'animation est faite en code avec Animated, pas en
// vidéo : une vidéo imposerait un module natif et surtout la
// transparence vidéo n'est pas portable iOS+Android — on aurait un
// rectangle opaque autour du marteau.
const FORGE_PANEL = require('../../../assets/icons/forge-panel-wide.png');
// Panneau de collection + fond de l'écran Runes (13/09).
// Panneau d'inventaire (13/09). Repères MESURÉS sur CET asset : les
// deux zones intérieures sont sombres (pas des trous), le contenu se
// pose donc par-dessus.
const INVENTORY_PANEL = require('../../../assets/icons/inventory-panel.png');
const INVENTORY_RATIO = 1000 / 572;
const INV_GRID_ZONE = { left: 0.038, right: 0.704, top: 0.224, bottom: 0.939 };
const INV_DETAIL_ZONE = { left: 0.719, right: 0.965, top: 0.224, bottom: 0.939 };
const INV_TITLE = { left: 0.280, right: 0.680, top: 0.015, bottom: 0.085 };
// Plaque en bois servant de bouton (13/09). Fond source MESURÉ à
// (167,61,133) : Gemini avait rendu un magenta désaturé, pas le #FF00FF
// habituel — un détourage calé sur #FF00FF n'aurait rien retiré.
const WOOD_PLATE = require('../../../assets/icons/wood-plate.png');
const WOOD_PLATE_RATIO = 520 / 134;

// Effet lisible d'une rune, à son niveau. Construit depuis la MÊME table
// que le combat (`RUNE_BONUS_TABLE`) : une description écrite à la main
// finirait par mentir dès le premier rééquilibrage.
function runeEffectText(type, level) {
  const table = RUNE_BONUS_TABLE[type];
  if (!table) return { simple: '', value: '' };
  const v = table[Math.max(0, Math.min(table.length - 1, level - 1))];
  const pct = `${Math.round(v * 100)}%`;
  // Deux morceaux : une phrase qu'un enfant comprend, et le chiffre
  // exact en dessous. Le chiffre vient de la MÊME table que le combat,
  // donc il ne peut pas mentir après un rééquilibrage.
  switch (type) {
    case 'force': return { simple: 'Tes coups font plus mal.', value: `+${pct} d'attaque` };
    case 'vitalite': return { simple: 'Tu as plus de vie.', value: `+${pct} de vie` };
    case 'celerite': return { simple: 'Tes attaques frappent plus fort.', value: `+${v.toFixed(2)} de dégâts` };
    case 'dexterite': return { simple: 'Moins de tapes pour attaquer.', value: `−${pct} de tapes` };
    case 'affinite': return { simple: 'Très fort contre le bon élément.', value: `+${v.toFixed(2)} si avantage` };
    case 'butin': return { simple: 'Tu gagnes plus de griffes.', value: `+${pct} de griffes` };
    case 'resilience': return { simple: 'Tu survis à un coup mortel.', value: `1× par combat, à ${pct} de vie` };
    default: return { simple: '', value: '' };
  }
}
const RUNES_BG = require('../../../assets/adventure/runes-bg.jpg');
const FORGE_HAMMER = require('../../../assets/icons/forge-hammer.png');
const FORGE_HAMMER_HIT = require('../../../assets/icons/forge-hammer-hit.png');
// Version LARGE (13/09) : l'ancien panneau était presque carré (1,145)
// et mangeait toute la hauteur de sa colonne. Repères REMESURÉS sur le
// nouvel asset — ils ne sont pas transposables d'une image à l'autre.
const FORGE_PANEL_RATIO = 900 / 428;
// Plaque dorée (le bouton), mesurée sur l'asset.
const FORGE_PLATE = { left: 0.3622, right: 0.6322, top: 0.7850, bottom: 0.8949 };
// Point de frappe sur l'enclume, et où se situe ce point DANS chaque
// sprite — c'est ce qui aligne les deux poses sur le même impact.
const FORGE_ANVIL = { x: 0.50, y: 0.420 };
// L'asset du marteau levé a été MIROITÉ (12/09) : il avait le manche à
// gauche (x 0,37) alors que la pose d'impact l'a à droite (x 0,65), donc
// le marteau changeait de côté au moment de frapper. Après miroir les
// deux poses ont le manche du même côté (0,63 et 0,65) et le coup se
// lit comme un vrai balancement.
const FORGE_HAMMER_ANCHOR = { x: 0.47, y: 0.34, h: 0.44 };
const FORGE_HIT_ANCHOR = { x: 0.42, y: 0.74, h: 0.42 };
const SHOP_PANEL_RATIO = 900 / 482;
// Zone LISSE de la plaque, remesurée le 12/09. L'ancien relevé
// (0,008-0,058) n'attrapait que la partie de la plaque dépassant
// AU-DESSUS du panneau, soit une boîte de 10 dp de haut : le titre en
// police 13 y était coupé. La plaque descend en fait sur le bois.
const SHOP_BANNER = { top: 0.022, bottom: 0.125, left: 0.330, right: 0.686 };
// Bande de bois libre sous les cases, pour la légende de chaque offre.
const SHOP_DESC_Y = { top: 0.735, bottom: 0.905 };
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
import {
  CREATURES,
  RARITY_LABEL,
  RARITY_COLOR,
  RARITY_BADGE_LETTER,
  stageForLevel,
  levelUpCost,
  griffesCoinCost,
  GRIFFES_COIN_PACK,
} from '../../games/clicker/clickerLogic';
import { useDaily, PENDING_GRIFFES_KEY } from '../../context/DailyContext';
import {
  combatStatsForCreatureTyped,
  chapterForLevel,
  levelIndexInChapter,
  LEVELS_PER_CHAPTER,
  opponentForLevel,
  griffesReward,
  chapterClearDiamonds,
  butinBonus,
  RUNE_BONUS_TABLE,
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
  force: { name: 'Rune de Force', icon: '⚔️', color: '#FF5252', art: require('../../../assets/icons/runes/force.png') },
  vitalite: { name: 'Rune de Vitalité', icon: '❤️', color: COLORS.good, art: require('../../../assets/icons/runes/vitalite.png') },
  // L'Endurance a disparu du combat le 11/09 (remplacée par le mana) :
  // sa rune ne servait plus à rien. Devient la Dextérité, qui retire des
  // taps au défi de combat. Les runes d'Endurance DÉJÀ EN SAUVEGARDE
  // sont converties au chargement — sans ça, RUNE_TYPES[type] serait
  // undefined et l'écran des runes planterait sur def.icon.
  dexterite: { name: 'Rune de Dextérité', icon: '🎯', color: COLORS.action, art: require('../../../assets/icons/runes/dexterite.png') },
  celerite: { name: 'Rune de Célérité', icon: '⚡', color: COLORS.neonCyan, art: require('../../../assets/icons/runes/celerite.png') },
  // 3 runes ajoutées le 12/09 pour sortir du « tout offensif » : les 4
  // premières poussaient toutes les dégâts ou les PV.
  affinite: { name: "Rune d'Affinité", icon: '🔥', color: '#ff8a3d', art: require('../../../assets/icons/runes/affinite.png') },
  butin: { name: 'Rune de Butin', icon: '💰', color: '#f2c14e', art: require('../../../assets/icons/runes/butin.png') },
  resilience: { name: 'Rune de Résilience', icon: '🛡️', color: '#7fdcff', art: require('../../../assets/icons/runes/resilience.png') },
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


export default function AdventureScreen({ owned, deck, onBack, onEvolveCreature, onLevelUpCreature, onAssignDeck, onClearDeckSlot, onSpendDiamonds, onAddDiamonds, onSpendCoins, griffesCoinBuys = 0, ascensionCount = 0, onGriffesCoinBought, diamonds = 0 }) {
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
  // Deux façons d'obtenir des Griffes : les Diamants (premium) ou les
  // pièces du Clicker. La seconde relie les deux économies — le Clicker
  // finance l'Aventure — et son prix suit la PRODUCTION du joueur, donc
  // le même effort à tous les stades.
  const coutGriffesEnPieces = griffesCoinCost(griffesCoinBuys, ascensionCount);

  const buyGriffesWithCoins = async () => {
    if (!onSpendCoins) return;
    const ok = await onSpendCoins(coutGriffesEnPieces);
    if (!ok) {
      Alert.alert('Pièces insuffisantes', `Il t'en faut ${coutGriffesEnPieces.toLocaleString('fr-FR')}.`);
      return;
    }
    setGriffes((g) => g + GRIFFES_COIN_PACK);
    if (onGriffesCoinBought) onGriffesCoinBought();
  };

  const buyGriffesWithDiamonds = () => {
    if (!onSpendDiamonds) return;
    Alert.alert(
      'Obtenir des Griffes',
      `💎 ${GRIFFES_DIAMOND_COST} Diamants → ${GRIFFES_PACK} 🐾\n`
      + `💰 ${coutGriffesEnPieces.toLocaleString('fr-FR')} pièces → ${GRIFFES_COIN_PACK} 🐾`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: `💰 ${GRIFFES_COIN_PACK} Griffes`, onPress: buyGriffesWithCoins },
        {
          text: `💎 ${GRIFFES_PACK} Griffes`,
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
    // Fin de chapitre : 10 Diamants, UNE SEULE FOIS. La condition
    // `levelNumber === currentUnlockedLevelRef.current` garantit que
    // c'est bien la première victoire sur ce niveau — sans elle, rejouer
    // le niveau 10 en boucle serait une source infinie de Diamants.
    const bonusDiamonds = chapterClearDiamonds(levelNumber);
    if (bonusDiamonds > 0 && levelNumber === currentUnlockedLevelRef.current && onAddDiamonds) {
      onAddDiamonds(bonusDiamonds);
    }
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
  // Les 3 achats RENVOIENT les runes tirées, pour que l'écran puisse les
  // montrer. Rien (undefined) si l'achat n'a pas eu lieu.
  // TIRAGE GRATUIT offert par le Clicker quand le défi des Runes arrive.
  //
  // ⚠️ La rune n'est PAS donnée en silence : le joueur garde un tirage à
  // utiliser dans la boutique. C'est cet usage qui valide le défi — il
  // découvre donc l'écran des Runes par lui-même, sans rien dépenser.
  const [freeRuneDraw, setFreeRuneDraw] = useState(false);
  useEffect(() => {
    let vivant = true;
    AsyncStorage.getItem(PENDING_FREE_RUNE_KEY)
      .then((du) => {
        if (!vivant || !du) return;
        AsyncStorage.removeItem(PENDING_FREE_RUNE_KEY).catch(() => {});
        setFreeRuneDraw(true);
      })
      .catch(() => {});
    return () => { vivant = false; };
  }, []);

  // Utilisation du tirage gratuit : même effet qu'un achat, coût nul.
  // `trackEvent('runeBought')` est volontaire — c'est ce qui valide le
  // défi, comme demandé.
  const useFreeRuneDraw = () => {
    if (!freeRuneDraw) return null;
    setFreeRuneDraw(false);
    const type = RUNE_TYPE_KEYS[Math.floor(Math.random() * RUNE_TYPE_KEYS.length)];
    const rune = { id: makeRuneId(), type, level: 1, equippedCreatureId: null };
    setOwnedRunes((prev) => [...prev, rune]);
    trackEvent('runeBought', 1);
    return [rune];
  };

  const buyRandomRune = () => {
    if (griffes < RUNE_COST) return null;
    setGriffes((g) => g - RUNE_COST);
    const type = RUNE_TYPE_KEYS[Math.floor(Math.random() * RUNE_TYPE_KEYS.length)];
    const rune = { id: makeRuneId(), type, level: 1, equippedCreatureId: null };
    setOwnedRunes((prev) => [...prev, rune]);
    trackEvent('runeBought', 1);
    return [rune];
  };

  // Pack : N runes aléatoires d'un coup, moins cher qu'à l'unité.
  const buyRunePack = () => {
    if (griffes < RUNE_PACK_COST) return null;
    setGriffes((g) => g - RUNE_PACK_COST);
    const drawn = Array.from({ length: RUNE_PACK_SIZE }, () => ({
      id: makeRuneId(),
      type: RUNE_TYPE_KEYS[Math.floor(Math.random() * RUNE_TYPE_KEYS.length)],
      level: 1,
      equippedCreatureId: null,
    }));
    setOwnedRunes((prev) => [...prev, ...drawn]);
    trackEvent('runeBought', RUNE_PACK_SIZE);
    return drawn;
  };

  // Offre spéciale : une rune de NIVEAU 2 d'un type imposé, tiré une
  // fois par jour. Une seule fois par jour — sinon elle remplacerait
  // complètement le tirage à l'unité, qu'elle bat largement.
  const buySpecialOffer = () => {
    if (!specialOffer || specialOffer.purchased) return null;
    if (griffes < RUNE_SPECIAL_COST) return null;
    setGriffes((g) => g - RUNE_SPECIAL_COST);
    const rune = { id: makeRuneId(), type: specialOffer.type, level: 2, equippedCreatureId: null };
    setOwnedRunes((prev) => [...prev, rune]);
    const next = { ...specialOffer, purchased: true };
    setSpecialOffer(next);
    AsyncStorage.setItem(RUNE_OFFER_KEY, JSON.stringify(next)).catch(() => {});
    trackEvent('runeBought', 2);
    return [rune];
  };

  // Fusion automatique : enchaîne TOUTES les fusions possibles jusqu'à
  // épuisement, en une seule mise à jour d'état.
  //
  // Deux partis pris :
  //  - les runes ÉQUIPÉES sont exclues : fusionner en masse pourrait
  //    déséquiper une créature sans prévenir (2 runes équipées sur 2
  //    créatures -> 1 seule survit). Un bouton « tout fusionner » ne
  //    doit jamais toucher à ce que le joueur a mis en place.
  //  - tout se fait en UNE passe de setState. Fusionner paire par paire
  //    relirait `ownedRunes` figé dans la closure à chaque étape et les
  //    fusions s'écraseraient entre elles.
  //
  // Renvoie le nombre de fusions effectuées, pour le retour visuel.
  const fuseAllRunes = () => {
    const equipped = ownedRunes.filter((r) => r.equippedCreatureId);
    let pool = ownedRunes.filter((r) => !r.equippedCreatureId);
    let count = 0;
    let again = true;
    while (again) {
      again = false;
      const groups = {};
      pool.forEach((r) => {
        if (r.level >= RUNE_MAX_LEVEL) return;
        const k = `${r.type}:${r.level}`;
        (groups[k] = groups[k] || []).push(r);
      });
      Object.values(groups).forEach((g) => {
        while (g.length >= 2) {
          const a = g.pop();
          const b = g.pop();
          pool = pool.filter((r) => r.id !== a.id && r.id !== b.id);
          pool.push({ id: makeRuneId(), type: a.type, level: a.level + 1, equippedCreatureId: null });
          count += 1;
          again = true;
        }
      });
    }
    if (count > 0) {
      setOwnedRunes([...equipped, ...pool]);
      trackEvent('runeFused', count);
    }
    return count;
  };

  // Fusionne 2 runes du MÊME type et MÊME niveau en une seule au niveau
  // supérieur (jamais au-delà du palier 5) — les deux runes d'origine
  // disparaissent. Si l'une des deux était équipée, la nouvelle rune
  // fusionnée prend AUTOMATIQUEMENT sa place (pas de désarmement surprise).

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
        freeRuneDraw={freeRuneDraw}
        onUseFreeDraw={useFreeRuneDraw}
        specialOffer={specialOffer}
        onFuseAll={fuseAllRunes}
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
      <View style={styles.sectionStarsRow}>
        <Text style={styles.sectionBody}>Palier actuel :</Text>
        <StarRow filled={evolutionTier + 1} size={14} />
      </View>
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
            <StarRow filled={evolutionTier + 1} size={14} />
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
                      {def ? (
                        <Image source={def.art} style={styles.mlRuneArt} resizeMode="contain" />
                      ) : (
                        <Text style={styles.mlRuneEmoji}>＋</Text>
                      )}
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
const LEVEL_NODE_SIZE = 38;   // réduit : 10 niveaux doivent tenir sur une page
// Plus de hauteur fixe par niveau (13/09) : un chapitre doit tenir
// ENTIÈREMENT dans une page, donc l'espacement se déduit de la hauteur
// disponible. `ROW_HEIGHT` est conservé, d'autres écrans l'importaient.
const ROW_HEIGHT = 92;
const MAP_PAD = 10;        // marge haut/bas d'une page

// Position (fraction 0-1 de la largeur, y en px depuis le haut du
// chapitre) du niveau d'index `i` (0-9) dans son chapitre — une onde
// continue plutôt que 3 positions fixes en alternance, pour que la
// courbe entre deux niveaux consécutifs ait vraiment l'air organique.
// Tracé du chapitre : 10 positions POSÉES À LA MAIN, en fraction de la
// largeur et de la hauteur (0 = bas). Une sinusoïde donnait un zigzag
// mécanique et mal réparti ; ici le chemin balaie la largeur, tourne au
// bord, repart en sens inverse et monte — lisible comme un vrai
// sentier.
//
// Mesuré sur 825x317 : distance minimale entre 2 nœuds 102 dp (nœuds de
// 38), pas de 150 à 210 dp, AUCUN croisement de segments.
// Positions des 10 niveaux, en FRACTIONS DE LA PAGE (u = largeur,
// v = hauteur DEPUIS LE HAUT), centre du nœud.
//
// Convention changée le 13/09 : avant, les coordonnées passaient par des
// marges et la taille du nœud. Or le décor d'un chapitre est une image
// qui couvre la page — pour poser un niveau sur une plateforme peinte,
// il faut la MÊME unité que l'image, donc des fractions de page.
const CHAPTER_PATHS = [
  // A — balayage gauche → droite, retour, montée
  [[0.080, 0.876], [0.290, 0.810], [0.500, 0.859], [0.710, 0.778], [0.901, 0.614],
   [0.729, 0.451], [0.519, 0.386], [0.309, 0.435], [0.138, 0.271], [0.386, 0.116]],
  // B — miroir : on part de la droite
  [[0.920, 0.876], [0.710, 0.810], [0.500, 0.859], [0.290, 0.778], [0.099, 0.614],
   [0.271, 0.451], [0.481, 0.386], [0.691, 0.435], [0.862, 0.271], [0.614, 0.116]],
  // C — triple vague
  [[0.118, 0.868], [0.366, 0.794], [0.614, 0.868], [0.862, 0.745], [0.653, 0.598],
   [0.405, 0.533], [0.157, 0.451], [0.366, 0.304], [0.634, 0.239], [0.882, 0.215]],
  // ⚠️ Le dernier nœud de C a été DESCENDU (0,124 -> 0,215) : à 0,124 il
  // tombait sous les boutons du coin haut droit une fois la carte passée
  // en plein écran. Vérifié : écart minimal inchangé (96 dp).
  // D — départ au centre, grand tour
  [[0.500, 0.884], [0.233, 0.802], [0.080, 0.614], [0.328, 0.533], [0.595, 0.598],
   [0.862, 0.533], [0.729, 0.353], [0.481, 0.304], [0.233, 0.255], [0.405, 0.108]],
];

// Décor propre à un chapitre. Le tracé est alors calé sur les
// plateformes RÉELLEMENT peintes dans l'image, mesurées dessus — pas sur
// un tracé générique qu'on espérerait voir coïncider.
//
// Le rapport de l'image (2,602) est celui de la page : les fractions de
// l'image valent donc directement fractions de page.
const CHAPTER_SCENES = {
  1: {
    bg: require('../../../assets/adventure/chapter-1.jpg'),
    // Calé sur les 10 plateformes rondes peintes, détectées sur l'image.
    path: [[0.082, 0.846], [0.293, 0.784], [0.501, 0.837], [0.710, 0.760], [0.901, 0.600],
           [0.727, 0.448], [0.519, 0.367], [0.310, 0.424], [0.138, 0.261], [0.385, 0.118]],
  },
  2: {
    bg: require('../../../assets/adventure/chapter-2.jpg'),
    // ⚠️ Cette île n'a PAS de plateformes rondes (la détection du
    // chapitre 1 n'y trouvait que 2 disques). Le calage part donc du
    // masque de SOL PRATICABLE (dalles et sentiers, 7% de l'image).
    //
    // ⚠️ Mais l'ORDRE reste celui du guide (tracé B) : Gemini l'avait
    // bien suivi. Chaque point du plan est simplement RECALÉ sur le sol
    // le plus dégagé dans un rayon de 90 px — déplacement de 7 à 123 px,
    // donc le dessin de l'île reste celui prévu.
    path: [[0.885, 0.833], [0.701, 0.812], [0.506, 0.825], [0.321, 0.745], [0.172, 0.597],
           [0.266, 0.459], [0.485, 0.381], [0.680, 0.433], [0.849, 0.294], [0.626, 0.144]],
  },
  3: {
    bg: require('../../../assets/adventure/chapter-3.jpg'),
    // Guide suivi : plan C — DÉDUIT par mesure (9 de ses 10 points
    // tombaient déjà sur le sol, contre 0 ou 1 pour les autres plans),
    // pas supposé d'après l'ordre d'envoi des images.
    path: [[0.132, 0.855], [0.370, 0.791], [0.616, 0.862], [0.838, 0.734], [0.644, 0.592],
           [0.405, 0.538], [0.165, 0.447], [0.370, 0.309], [0.632, 0.250], [0.806, 0.203]],
  },
  4: {
    bg: require('../../../assets/adventure/chapter-4.jpg'),
    // Guide suivi : plan D (9/10 sur le sol).
    path: [[0.475, 0.855], [0.231, 0.788], [0.103, 0.595], [0.332, 0.527], [0.593, 0.597],
           [0.828, 0.577], [0.728, 0.338], [0.477, 0.288], [0.240, 0.250], [0.396, 0.200]],
  },
  5: {
    bg: require('../../../assets/adventure/chapter-5.jpg'),
    // Plan A, DÉDUIT par mesure ; 10/10 des niveaux posés sur une
    // plateforme réellement peinte, le reste recalé sur le sol.
    path: [[0.087, 0.858], [0.290, 0.797], [0.500, 0.850], [0.707, 0.765], [0.897, 0.604],
           [0.728, 0.444], [0.521, 0.374], [0.311, 0.420], [0.141, 0.263], [0.387, 0.117]],
  },
  6: {
    bg: require('../../../assets/adventure/chapter-6.jpg'),
    // Plan B, DÉDUIT par mesure ; 8/10 des niveaux posés sur une
    // plateforme réellement peinte, le reste recalé sur le sol.
    path: [[0.917, 0.867], [0.709, 0.802], [0.502, 0.846], [0.291, 0.767], [0.101, 0.600],
           [0.272, 0.444], [0.478, 0.375], [0.688, 0.426], [0.859, 0.255], [0.613, 0.108]],
  },
  7: {
    bg: require('../../../assets/adventure/chapter-7.jpg'),
    // Plan C, DÉDUIT par mesure ; 9/10 des niveaux posés sur une
    // plateforme réellement peinte, le reste recalé sur le sol.
    path: [[0.119, 0.855], [0.367, 0.774], [0.614, 0.852], [0.862, 0.729], [0.651, 0.583],
           [0.406, 0.518], [0.157, 0.436], [0.368, 0.290], [0.633, 0.229], [0.829, 0.197]],
  },
  8: {
    bg: require('../../../assets/adventure/chapter-8.jpg'),
    // Plan D, DÉDUIT par mesure ; 10/10 des niveaux posés sur une
    // plateforme réellement peinte, le reste recalé sur le sol.
    path: [[0.501, 0.875], [0.233, 0.789], [0.081, 0.599], [0.328, 0.526], [0.596, 0.593],
           [0.864, 0.523], [0.730, 0.345], [0.481, 0.295], [0.233, 0.248], [0.405, 0.104]],
  },
  9: {
    bg: require('../../../assets/adventure/chapter-9.jpg'),
    // Air — pics et ponts suspendus. Plan A déduit par mesure ; 10/10 des niveaux sur une
    // plateforme peinte.
    path: [[0.086, 0.862], [0.290, 0.798], [0.503, 0.851], [0.713, 0.767], [0.899, 0.603],
           [0.732, 0.440], [0.524, 0.372], [0.310, 0.432], [0.136, 0.262], [0.383, 0.122]],
  },
  10: {
    bg: require('../../../assets/adventure/chapter-10.jpg'),
    // Air — plateaux et moulins. Plan B déduit par mesure ; 8/10 des niveaux sur une
    // plateforme peinte.
    path: [[0.904, 0.849], [0.708, 0.794], [0.503, 0.839], [0.293, 0.759], [0.114, 0.601],
           [0.279, 0.435], [0.482, 0.376], [0.691, 0.427], [0.850, 0.270], [0.623, 0.110]],
  },
  11: {
    bg: require('../../../assets/adventure/chapter-11.jpg'),
    // Feu — coulées de lave. Plan C déduit par mesure ; 9/10 des niveaux sur une
    // plateforme peinte.
    path: [[0.119, 0.859], [0.366, 0.789], [0.616, 0.862], [0.864, 0.735], [0.652, 0.596],
           [0.404, 0.525], [0.156, 0.445], [0.367, 0.297], [0.635, 0.234], [0.834, 0.172]],
  },
  12: {
    bg: require('../../../assets/adventure/chapter-12.jpg'),
    // Feu — cratères éteints. Plan D déduit par mesure ; 9/10 des niveaux sur une
    // plateforme peinte.
    path: [[0.502, 0.883], [0.236, 0.796], [0.085, 0.610], [0.329, 0.533], [0.596, 0.595],
           [0.864, 0.528], [0.730, 0.351], [0.481, 0.303], [0.235, 0.265], [0.356, 0.050]],
  },
};

// Renvoie des PIXELS (x et y dans la même unité — un ancien bug avait
// laissé x en fraction et y en pixels, envoyant les points de contrôle
// des courbes hors écran).
// `chapterNum` choisit le tracé : celui du décor s'il y en a un, sinon
// l'une des 4 variantes génériques, par cycle.
function nodePosition(i, pathW, pageH, chapterNum = 1) {
  const scene = CHAPTER_SCENES[chapterNum];
  const path = scene ? scene.path : CHAPTER_PATHS[(chapterNum - 1) % CHAPTER_PATHS.length];
  const [u, v] = path[i] || path[0];
  // Bornes rentrées d'un demi-nœud, sinon les niveaux des extrémités
  // seraient coupés par le bord de l'écran.
  const half = LEVEL_NODE_SIZE / 2;
  return {
    x: Math.min(pathW - half, Math.max(half, u * pathW)),
    y: Math.min(pageH - half, Math.max(half, v * pageH)),
  };
}

// Point sur une courbe de Bézier quadratique.
function bezierPoint(p0, p1, ctrl, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * ctrl.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * ctrl.y + t * t * p1.y,
  };
}

// Pointillés le long de l'itinéraire MESURÉ sur l'image du chapitre.
//
// `CHAPTER_ROUTES[n]` contient 9 tronçons (niveau 1→2 … 9→10). Les
// pastilles sont réparties ÉGALEMENT sur CHAQUE tronçon : on vise ~21 dp
// d'écart, mais le pas exact est ajusté à la longueur du tronçon. Un pas
// constant sur tout le chemin laissait des tronçons à 2 pastilles et
// d'autres à 6.
const DOT_TARGET = 21;   // écart visé entre 2 pastilles
const DOT_CLEAR = 27;    // rayon autour d'un niveau où l'on n'en pose pas
const DOT_APART = 14;    // distance mini entre 2 pastilles (double passage)

function routeDots(route, pathW, pageH, nodes) {
  const placed = [];
  route.forEach((seg) => {
    const pts = seg.map(([u, v]) => ({ x: u * pathW, y: v * pageH }));
    const cum = [0];
    for (let i = 0; i < pts.length - 1; i++) {
      cum.push(cum[i] + Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y));
    }
    const total = cum[cum.length - 1];
    if (total < 1) return;
    const n = Math.max(2, Math.round(total / DOT_TARGET));
    for (let k = 1; k < n; k++) {
      const target = (total * k) / n;
      let j = 0;
      while (j < cum.length - 2 && cum[j + 1] < target) j += 1;
      const t = (target - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      const x = pts[j].x + (pts[j + 1].x - pts[j].x) * t;
      const y = pts[j].y + (pts[j + 1].y - pts[j].y) * t;
      if (nodes.some((nd) => Math.hypot(nd.x - x, nd.y - y) < DOT_CLEAR)) continue;
      // Quand le chemin repasse près de lui-même, on ne redessine pas
      // par-dessus : sinon les pastilles se chevauchent.
      if (placed.some((d) => Math.hypot(d.x - x, d.y - y) < DOT_APART)) continue;
      placed.push({ x, y });
    }
  });
  return placed;
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
// Mémorise que l'aide sur les éléments a déjà été montrée.
const ELEM_HELP_SEEN_KEY = 'adventure:elemHelpSeen:v1';

function ElementHelpOverlay({ onClose }) {
  return (
    <View style={styles.elemHelpBackdrop}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={styles.elemHelpCard}>
        {/* Retour en HAUT À DROITE (demande explicite) : à la première
            ouverture, le joueur découvre l'écran et doit voir tout de
            suite comment en sortir. */}
        <TouchableOpacity style={styles.elemHelpBack} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.elemHelpBackText}>✕</Text>
        </TouchableOpacity>
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
  const [mapJumpToken, setMapJumpToken] = useState(0);
  // Hauteur d'une page = hauteur du défilement lui-même. MESURÉE : c'est
  // elle qui dicte l'espacement des niveaux ET le pas de pagination, les
  // deux doivent être rigoureusement identiques sinon les pages
  // dérivent.
  const [page, setPage] = useState({ w: 0, h: 0 });
  // Position de défilement, pour faire fondre les pages l'une dans
  // l'autre : sans ça on passe brutalement d'un ciel bleu à un fond noir
  // en changeant de chapitre.
  const scrollY = useRef(new Animated.Value(0)).current;
  // Page actuellement à l'écran. Sert à ne MONTER que les décors
  // voisins : un fond décodé pèse ~2,9 Mo, donc 30 chapitres montés
  // d'un coup feraient 86 Mo de bitmaps. En se limitant à la page
  // courante ±1, on reste à ~8,6 Mo quel que soit le nombre de
  // chapitres. Le ±1 est indispensable : c'est la page voisine qui
  // apparaît pendant le glissement.
  const [visiblePage, setVisiblePage] = useState(null);
  const pageH = page.h;

  const [levelPreview, setLevelPreview] = useState(null); // numéro de niveau ou null

  const [activeBattle, setActiveBattle] = useState(null); // { levelNumber } ou null
  const [elemHelpOpen, setElemHelpOpen] = useState(false);
  // Ouvert AUTOMATIQUEMENT à la toute première visite de la carte : les
  // affinités décident des combats, un joueur qui les découvre après
  // coup a déjà perdu des étoiles. Mémorisé, donc une seule fois.
  useEffect(() => {
    let vivant = true;
    AsyncStorage.getItem(ELEM_HELP_SEEN_KEY)
      .then((vu) => {
        if (!vivant || vu) return;
        setElemHelpOpen(true);
        AsyncStorage.setItem(ELEM_HELP_SEEN_KEY, '1').catch(() => {});
      })
      .catch(() => {});
    return () => { vivant = false; };
  }, []);

  // Replacement au retour d'un combat : on réarme simplement le garde,
  // le saut se refera au prochain `onLayout` du défilement.
  //
  // ⚠️ Placé APRÈS la déclaration d'`activeBattle` : plus haut, il le
  // lisait avant son initialisation.
  useEffect(() => {
    if (activeBattle) return;
    mapAutoScrolledRef.current = false;
    // Le jeton force l'effet de saut à se rejouer : sans lui, ses
    // dépendances (hauteur, index) n'ont pas changé au retour d'un
    // combat et il ne se relancerait jamais.
    setMapJumpToken((n) => n + 1);
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
  // ⚠️ TROISIÈME écriture de ce saut — les deux précédentes dépendaient
  // d'un MINUTAGE et ont fini par retomber en panne :
  //   1. `onLayout` du ScrollView : les pages n'existaient pas encore,
  //      le contenu mesurait 0 et la position était ramenée à 0.
  //   2. `onLayout` de la page du chapitre : ne se redéclenche PAS au
  //      retour d'un combat (la mise en page n'a pas changé), donc on
  //      revenait en haut de la carte.
  //
  // Ici le saut est piloté par un EFFET qui observe la hauteur de page,
  // le chapitre visé et un jeton. Plus aucune course : dès que la
  // hauteur est connue, les pages sont rendues (elles ne le sont que
  // dans ce cas), donc le contenu existe forcément.
  const doJump = (y) => {
    // `Animated.ScrollView` transmet sa ref au ScrollView réel dans les
    // versions récentes, mais l'ancienne API l'enveloppait derrière
    // `getNode()`. On accepte les deux : un `scrollTo` introuvable
    // ramènerait silencieusement le joueur en haut de la carte.
    const sv = mapScrollRef.current;
    const target = sv && (typeof sv.scrollTo === 'function' ? sv : sv.getNode && sv.getNode());
    if (!target || typeof target.scrollTo !== 'function') return false;
    target.scrollTo({ y, animated: false });
    // ⚠️ INDISPENSABLE. `scrollY` n'est alimenté que par `onScroll`, et un
    // défilement PROGRAMMÉ n'émet pas cet événement. Sans cette ligne,
    // `scrollY` restait à 0 alors que le contenu était déjà à `y` : la
    // page affichée tombait hors de sa plage d'interpolation, donc à une
    // opacité de 0 — carte NOIRE jusqu'au premier glissement du joueur,
    // qui déclenchait enfin `onScroll`.
    scrollY.setValue(y);
    return true;
  };

  // ⚠️ CE HOOK DOIT RESTER ICI, AVANT le `if (activeBattle) return`.
  // Placé après, il n'était pas appelé quand un combat démarrait :
  // React voyait moins de Hooks d'un rendu à l'autre et plantait sur
  // « Rendered fewer hooks than expected » dès le premier niveau lancé.
  // C'est le MÊME piège que celui déjà documenté quelques lignes plus
  // haut pour l'effet de réarmement.
  //
  // Les valeurs nécessaires sont recalculées ici plutôt que lues plus
  // bas : elles dérivent toutes de `currentUnlockedLevel`, déjà
  // disponible, et un Hook ne peut pas attendre une déclaration qui vit
  // après un retour anticipé.
  const jumpChapter = chapterForLevel(currentUnlockedLevel);
  const jumpShown = Math.max(jumpChapter + 6, Math.max(...Object.keys(CHAPTER_SCENES).map(Number)));
  const jumpIndex = jumpShown - jumpChapter;

  useEffect(() => {
    if (mapAutoScrolledRef.current) return undefined;
    if (!pageH) return undefined;
    // Une image posée après coup peut décaler le contenu : on retente à
    // la frame suivante, c'est gratuit et ça couvre ce cas.
    if (doJump(jumpIndex * pageH)) mapAutoScrolledRef.current = true;
    const id = requestAnimationFrame(() => doJump(jumpIndex * pageH));
    return () => cancelAnimationFrame(id);
  }, [pageH, jumpIndex, mapJumpToken]);


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
  // Au moins jusqu'au dernier chapitre ILLUSTRÉ : sinon un joueur au
  // chapitre 1 ne voyait que 7 pages (1 + 6) alors que 12 îles sont
  // dessinées — le travail d'illustration restait invisible.
  const lastIllustrated = Math.max(...Object.keys(CHAPTER_SCENES).map(Number));
  const chaptersToShow = Math.max(currentChapter + 6, lastIllustrated);
  // Largeur MESURÉE du défilement, pas `screenWidth` : si le conteneur
  // est décalé (encoche, marge d'un parent), supposer la largeur de la
  // fenêtre laissait une bande vide à gauche et débordait à droite.
  const pathWidth = page.w || screenWidth;

  // Pages ORDONNÉES À L'ENVERS : le chapitre 1 est la page du BAS et les
  // suivants sont AU-DESSUS. On gravit donc la carte — pour voir la
  // suite on monte, on ne descend plus.
  const chapterPages = Array.from({ length: chaptersToShow }, (_, i) => chaptersToShow - i);
  const currentPageIndex = chaptersToShow - currentChapter;

  // Positionnement initial sur le chapitre en cours. `onLayout` donne la
  // hauteur, et c'est seulement une fois qu'on la connaît qu'on peut
  // sauter à la bonne page.
  // Page visible, déduite de la position de défilement à l'arrêt.
  const onScrollSettled = (e) => {
    const h = e.nativeEvent.layoutMeasurement.height;
    if (h > 0) setVisiblePage(Math.round(e.nativeEvent.contentOffset.y / h));
  };

  return (
    // PAS `styles.screen` ici : son `padding: 14` laissait une bande
    // noire tout autour du décor. La carte occupe l'écran entier et
    // l'en-tête flotte PAR-DESSUS.
    <View style={styles.mapScreen}>
      {/* Plein écran : la barre système casse l'immersion en paysage. */}
      <StatusBar hidden />
      <View style={[styles.header, styles.mapHeader]}>
        <BackButton onPress={onBack} />
        <View style={styles.headerSpacer} />
        {/* Aide sur les éléments, juste à GAUCHE des Griffes : elle se
            consulte avant un combat, sa place est dans l'en-tête et non
            perdue dans un coin bas de l'écran. */}
        <TouchableOpacity style={styles.elemHelpBtn} onPress={() => setElemHelpOpen(true)}>
          <Text style={styles.elemHelpBtnText}>🔥 Éléments</Text>
        </TouchableOpacity>
        <CurrencyCounter currency="griffes" amount={griffes} onPlus={onBuyGriffes} />
        <EnergyBadge energy={energy} energyUpdatedAt={energyUpdatedAt} />
      </View>

      {/* Un chapitre = une page, on change de chapitre en glissant,
          comme un fil de vidéos. `pagingEnabled` cale le pas sur la
          hauteur du ScrollView : c'est pourquoi chaque page utilise
          EXACTEMENT `pageH`. */}
      <Animated.ScrollView
        ref={mapScrollRef}
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        style={styles.mapScroll}
        onLayout={(e) =>
          setPage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
        onMomentumScrollEnd={onScrollSettled}
        onScrollEndDrag={onScrollSettled}
      >
        {pageH > 0 && chapterPages.map((chapterNum, pageIdx) => {
          // Positions converties en PIXELS tout de suite (x ET y dans la
          // même unité) — un vrai bug avait laissé x en fraction (0-1) et
          // y déjà en pixels, ce qui envoyait les points de contrôle des
          // courbes très loin hors écran (le calcul de perpendiculaire
          // mélangeait des échelles totalement différentes) : les
          // pointillés étaient bien calculés, juste invisibles car
          // positionnés à des milliers de pixels du cadre visible.
          const scene = CHAPTER_SCENES[chapterNum];
          // Avant le premier défilement, `visiblePage` est inconnu : on
          // se rabat sur la page visée à l'ouverture.
          const activePage = visiblePage == null ? currentPageIndex : visiblePage;
          const bgMounted = Math.abs(pageIdx - activePage) <= 1;
          const positions = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) =>
            nodePosition(i, pathWidth, pageH, chapterNum)
          );
          return (
            <Animated.View
              key={chapterNum}
              style={[
                styles.chapterBlock,
                { height: pageH },
                // Fondu : pleine opacité quand la page est centrée, nulle
                // à une page d'écart. À mi-glissement les deux voisines
                // sont à 50% sur le fond sombre, ce qui efface la couture
                // entre deux décors très différents.
                {
                  opacity: scrollY.interpolate({
                    inputRange: [(pageIdx - 1) * pageH, pageIdx * pageH, (pageIdx + 1) * pageH],
                    outputRange: [0, 1, 0],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              {/* Décor du chapitre. Posé avec une largeur ET une hauteur
                  explicites (jamais absoluteFill seul sur une Image :
                  elle se dessinerait à sa taille native). */}
              {/* `stretch` et NON `cover` : en plein écran le rapport
                  passe de 2,60 (image) à ~2,17 (écran). `cover`
                  rognerait 17% de la largeur et rejetterait les niveaux
                  1 et 5 HORS de l'écran (mesuré : x = -1 et x = 837).
                  `stretch` remplit exactement, donc une fraction de
                  l'image reste une fraction de page et les niveaux
                  tombent pile sur les plateformes peintes. Coût : ~20%
                  d'étirement vertical, invisible sur ce style. */}
              {scene && bgMounted && (
                <Image
                  source={scene.bg}
                  style={{ position: 'absolute', width: pathWidth, height: pageH, pointerEvents: 'none' }}
                  resizeMode="stretch"
                />
              )}
              <View style={[styles.chapterPath, { height: pageH }]}>
                {/* Tracé courbe en pointillés entre chaque niveau consécutif —
                    dessiné EN PREMIER pour rester derrière les pastilles. */}
                {(CHAPTER_ROUTES[chapterNum]
                  ? [routeDots(CHAPTER_ROUTES[chapterNum], pathWidth, pageH, positions)]
                  : positions.slice(0, -1).map((p0, i) => pathDots(p0, positions[i + 1]))
                ).map((group, i) => {
                  return group.map((d, di) => (
                    <View
                      key={`dot-${i}-${di}`}
                      style={[
                        styles.pathDot,
                        scene && styles.pathDotOnScene,
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
                        scene && styles.levelNodeOnScene,
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
                        <StarRow
                          filled={levelStars[levelNum]}
                          style={
                            starsFitAbove(pos.x, pos.y)
                              ? [styles.levelStars, { top: -(STAR_OFFSET + STAR_SIZE) }]
                              : [styles.levelStars, { bottom: -(STAR_OFFSET + STAR_SIZE) }]
                          }
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      {/* Repère de chapitre : une pastille par page, la pleine indique
          où l'on est. Remplace le libellé texte supprimé. */}
      <View style={styles.chapterDots}>
        {chapterPages.map((chapterNum) => (
          <View
            key={chapterNum}
            style={[styles.chapterDot, chapterNum === currentChapter && styles.chapterDotOn]}
          />
        ))}
      </View>

      {/* Recharge d'énergie payée en Diamants. Le débit est délégué au
          Clicker (qui détient la monnaie) ; ici on ne fait que remplir
          la jauge si le paiement a réussi. */}
      {/* Bouton d'aide, en bas à gauche. Masqué dès qu'un niveau est
          ouvert : il se superposait au panneau de préparation, où il
          n'a rien à faire. */}

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
// Atelier de fusion. Le marteau frappe, les éclats jaillissent, puis le
// résultat s'affiche. Les deux poses sont empilées et c'est leur OPACITÉ
// qui bascule : changer la `source` d'une Image en cours d'animation
// provoquerait un rendu JS à chaque coup, alors qu'opacité et transform
// partent sur le driver natif.
// Inventaire des runes, en surcouche. Panneau en bois illustré, grille
// à gauche, détail de la rune choisie à droite.
//
// Surcouche et non écran séparé : la règle 11 du projet rappelle qu'une
// surcouche ne démonte pas l'écran en dessous — l'état de la boutique et
// l'offre du jour restent intacts en revenant.
// Révélation d'un achat : les pierres obtenues apparaissent une à une,
// avec un halo à leur couleur.
//
// UNE seule Animated.Value pilote tout, et chaque pierre lit une plage
// décalée de cette même valeur. Bien plus sûr que N animations
// parallèles : pas de désynchronisation, et un seul `start()` à nettoyer.
function RuneReveal({ runes, onClose }) {
  const t = useRef(new Animated.Value(0)).current;
  const STEP = 0.18;          // décalage entre 2 pierres
  const SPAN = 0.55;          // durée d'apparition d'une pierre

  useEffect(() => {
    t.setValue(0);
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 380 + runes.length * 170,
      useNativeDriver: true,
    });
    anim.start();
    // Arrêt si l'écran se démonte pendant l'animation.
    return () => anim.stop();
  }, [runes]);

  const total = Math.max(1, 1 + (runes.length - 1) * STEP);

  return (
    <TouchableOpacity style={styles.revealOverlay} activeOpacity={1} onPress={onClose}>
      <Text style={styles.revealTitle}>
        {runes.length > 1 ? `${runes.length} NOUVELLES RUNES` : 'NOUVELLE RUNE'}
      </Text>

      <View style={styles.revealRow}>
        {runes.map((rune, i) => {
          const def = RUNE_TYPES[rune.type];
          const d0 = (i * STEP) / total;
          const d1 = (i * STEP + SPAN * 0.65) / total;
          const d2 = (i * STEP + SPAN) / total;
          // Léger dépassement à l'arrivée (1,18 puis 1) : c'est ce
          // ressenti de « pop » qui fait lire le gain.
          const scale = t.interpolate({
            inputRange: [d0, d1, d2, 1],
            outputRange: [0.2, 1.18, 1, 1],
            extrapolate: 'clamp',
          });
          const opacity = t.interpolate({
            inputRange: [d0, d1, 1],
            outputRange: [0, 1, 1],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View key={rune.id} style={[styles.revealItem, { opacity, transform: [{ scale }] }]}>
              {/* Halo pré-rendu, RECOLORÉ à la teinte de la rune via
                  tintColor : une seule image sert aux 7 couleurs. */}
              <Image
                source={GLOW_GOLD}
                style={[styles.revealGlow, { tintColor: def.color }]}
                resizeMode="contain"
              />
              <Image source={def.art} style={styles.revealArt} resizeMode="contain" />
              <Text style={[styles.revealName, { color: def.color }]} numberOfLines={1}>
                {def.name.replace('Rune de ', '').replace("Rune d'", '')}
              </Text>
              <Text style={styles.revealLevel}>Niv. {rune.level}</Text>
            </Animated.View>
          );
        })}
      </View>

      <Text style={styles.revealHint}>Touche pour continuer</Text>
    </TouchableOpacity>
  );
}

function RuneInventory({ ownedRunes, onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = ownedRunes.find((r) => r.id === selectedId) || null;
  const def = selected ? RUNE_TYPES[selected.type] : null;
  const effect = selected ? runeEffectText(selected.type, selected.level) : null;

  // Le cadre garde SON ratio. Le forcer dans une boîte en % l'étirait de
  // 47% : le décor paraissait écrasé et la bannière décalée.
  const { width: winW, height: winH } = useWindowDimensions();
  const panelW = Math.min(winW * 0.94, winH * 0.92 * INVENTORY_RATIO);
  const panelH = panelW / INVENTORY_RATIO;
  const box = (z) => ({
    position: 'absolute',
    left: z.left * panelW,
    width: (z.right - z.left) * panelW,
    top: z.top * panelH,
    height: (z.bottom - z.top) * panelH,
  });

  return (
    <View style={styles.invOverlay}>
      <View style={{ width: panelW, height: panelH }}>
        <Image
          source={INVENTORY_PANEL}
          style={{ position: 'absolute', width: panelW, height: panelH, pointerEvents: 'none' }}
          resizeMode="stretch"
        />

        {/* Titre dans la plaque vide du haut. */}
        <View style={[box(INV_TITLE), styles.invCenter, { pointerEvents: 'none' }]}>
          <Text style={styles.invBannerText} numberOfLines={1} adjustsFontSizeToFit>
            INVENTAIRE DES RUNES
          </Text>
        </View>

        {/* Zone de gauche : la grille. */}
        <View style={box(INV_GRID_ZONE)}>
          <ScrollView contentContainerStyle={styles.runeGrid}>
            {ownedRunes.length === 0 ? (
              <Text style={styles.runeEmptyText}>Aucune rune — achètes-en une dans la boutique.</Text>
            ) : (
              ownedRunes
                .slice()
                .sort((a, b) => b.level - a.level || a.type.localeCompare(b.type))
                .map((rune) => {
                  const d = RUNE_TYPES[rune.type];
                  const on = rune.id === selectedId;
                  return (
                    <TouchableOpacity
                      key={rune.id}
                      style={[styles.runeCell, { borderColor: on ? '#ffd86b' : d.color, opacity: on ? 1 : 0.9 }]}
                      onPress={() => setSelectedId(on ? null : rune.id)}
                      activeOpacity={0.8}
                    >
                      <Image source={d.art} style={styles.runeArt} resizeMode="contain" />
                      <Text style={styles.runeLevel}>Niv. {rune.level}</Text>
                      {rune.equippedCreatureId && <Text style={styles.runeEquippedTag}>équipée</Text>}
                    </TouchableOpacity>
                  );
                })
            )}
          </ScrollView>
        </View>

        {/* Zone de droite : le détail. */}
        <View style={[box(INV_DETAIL_ZONE), styles.invDetailCol]}>
          {selected ? (
            <>
              {/* Pierre encadrée, comme sur la maquette. */}
              <View style={[styles.invDetailArtBox, { borderColor: def.color }]}>
                <Image source={def.art} style={styles.invDetailArt} resizeMode="contain" />
              </View>
              <Text style={[styles.invDetailName, { color: def.color }]} numberOfLines={2}>{def.name}</Text>
              <Text style={styles.invDetailLevel}>Niveau {selected.level} / {RUNE_MAX_LEVEL}</Text>
              <Text style={styles.invDetailEffect}>{effect.simple}</Text>
              <Text style={[styles.invDetailValue, { color: def.color }]}>{effect.value}</Text>
              <Text style={styles.invDetailState}>
                {selected.equippedCreatureId ? 'Équipée' : 'Non équipée'}
              </Text>
            </>
          ) : (
            <Text style={styles.invDetailHint}>Touche une rune pour voir ce qu'elle fait.</Text>
          )}
        </View>

        {/* Le bouton RETOUR habituel de l'appli prend la place de la
            croix dessinée : un seul geste de sortie, le même que sur
            tous les autres écrans. */}
        <BackButton
          onPress={onClose}
          style={{ position: 'absolute', right: panelW * 0.005, top: panelH * 0.022 }}
        />
      </View>
    </View>
  );
}

function ForgePanel({ width, onAutoFuse }) {
  const H = width / FORGE_PANEL_RATIO;
  const blow = useRef(new Animated.Value(0)).current;
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const hamH = H * FORGE_HAMMER_ANCHOR.h;
  const hamW = hamH * (268 / 420);
  const hitH = H * FORGE_HIT_ANCHOR.h;
  const hitW = hitH * (560 / 492);

  // 0 -> marteau levé, 1 -> marteau abattu.
  const hamTranslate = blow.interpolate({ inputRange: [0, 1], outputRange: [-H * 0.22, -H * 0.04] });
  const hamRotate = blow.interpolate({ inputRange: [0, 1], outputRange: ['26deg', '4deg'] });
  // Le sprite d'impact n'apparaît que sur la toute fin de la descente.
  const hitOpacity = blow.interpolate({ inputRange: [0, 0.82, 1], outputRange: [0, 0, 1] });
  const hamOpacity = blow.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] });

  const strike = (times, done) => {
    const one = Animated.sequence([
      Animated.timing(blow, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.timing(blow, { toValue: 0, duration: 230, useNativeDriver: true }),
    ]);
    Animated.sequence(Array.from({ length: times }, () => one)).start(done);
  };

  const onPress = () => {
    if (busy) return;
    // La fusion est appliquée TOUT DE SUITE : l'animation n'est qu'un
    // retour visuel. Si le joueur quitte l'écran pendant les coups de
    // marteau, ses runes sont déjà fusionnées.
    const count = onAutoFuse();
    if (count === 0) {
      setResult('Rien à fusionner');
      return;
    }
    setBusy(true);
    setResult(null);
    strike(Math.min(3, count), () => {
      setBusy(false);
      setResult(`${count} fusion${count > 1 ? 's' : ''} !`);
    });
  };

  return (
    <View style={{ width, height: H }}>
      <Image
        source={FORGE_PANEL}
        style={{ position: 'absolute', width, height: H, pointerEvents: 'none' }}
        resizeMode="stretch"
      />

      <Animated.Image
        source={FORGE_HAMMER}
        resizeMode="contain"
        style={{
          position: 'absolute',
          width: hamW, height: hamH,
          left: width * FORGE_ANVIL.x - hamW * FORGE_HAMMER_ANCHOR.x,
          top: H * FORGE_ANVIL.y - hamH * FORGE_HAMMER_ANCHOR.y,
          opacity: hamOpacity,
          transform: [{ translateY: hamTranslate }, { rotate: hamRotate }],
          pointerEvents: 'none',
        }}
      />
      <Animated.Image
        source={FORGE_HAMMER_HIT}
        resizeMode="contain"
        style={{
          position: 'absolute',
          width: hitW, height: hitH,
          left: width * FORGE_ANVIL.x - hitW * FORGE_HIT_ANCHOR.x,
          top: H * FORGE_ANVIL.y - hitH * FORGE_HIT_ANCHOR.y,
          opacity: hitOpacity,
          pointerEvents: 'none',
        }}
      />

      {result && (
        <View style={styles.forgeResultWrap}>
          <Text style={styles.forgeResultText}>{result}</Text>
        </View>
      )}

      {/* La plaque dorée EST le bouton. */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          left: FORGE_PLATE.left * width,
          width: (FORGE_PLATE.right - FORGE_PLATE.left) * width,
          top: FORGE_PLATE.top * H,
          height: (FORGE_PLATE.bottom - FORGE_PLATE.top) * H,
          alignItems: 'center', justifyContent: 'center',
        }}
        onPress={onPress}
        disabled={busy}
        activeOpacity={0.75}
      >
        <Text
          style={[styles.forgePlateText, { fontSize: Math.max(8, Math.round(width * 0.058)) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          FUSION AUTOMATIQUE
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function RuneShopPanel({ width, griffes, specialOffer, onBuyRandom, onBuyPack, onBuySpecial, freeRuneDraw = false, onUseFreeDraw }) {
  const H = width / SHOP_PANEL_RATIO;
  const slotTop = SHOP_SLOT_Y.top * H;
  const slotH = (SHOP_SLOT_Y.bottom - SHOP_SLOT_Y.top) * H;
  const descTop = SHOP_DESC_Y.top * H;
  const descH = (SHOP_DESC_Y.bottom - SHOP_DESC_Y.top) * H;
  const offerDef = specialOffer ? RUNE_TYPES[specialOffer.type] : null;
  const soldOut = specialOffer ? specialOffer.purchased : true;
  // Tailles DÉRIVÉES de la largeur : le panneau a rétréci pour laisser
  // la place à l'inventaire, des tailles fixes ne tiendraient plus dans
  // les cases. Planchers pour rester lisible sur petit écran.
  const fsIcon = Math.max(14, Math.round(width * 0.085));
  const fsIconSmall = Math.max(9, Math.round(width * 0.052));
  const fsPrice = Math.max(9, Math.round(width * 0.042));
  const fsDesc = Math.max(6, Math.round(width * 0.030));
  const fsBanner = Math.max(8, Math.round(width * 0.042));

  const offers = [
    {
      key: 'special',
      // La PIERRE du type réellement en vente ce jour : le joueur doit
      // voir quelle rune il achète avant de payer, pas une étoile.
      arts: offerDef ? [offerDef.art] : [],
      emoji: offerDef ? null : '✨',
      cost: RUNE_SPECIAL_COST,
      desc: soldOut ? 'Revient demain' : `${offerDef ? offerDef.name.replace('Rune de ', '').replace("Rune d'", '') : ''} niv.2\n1 par jour`,
      disabled: soldOut || griffes < RUNE_SPECIAL_COST,
      onPress: onBuySpecial,
    },
    {
      key: 'pack',
      // 3 pierres côte à côte : le contenu du pack doit se LIRE. Ce sont
      // des exemples, le tirage reste aléatoire sur les 7 types.
      arts: [RUNE_TYPES.force.art, RUNE_TYPES.vitalite.art, RUNE_TYPES.celerite.art],
      cost: RUNE_PACK_COST,
      desc: '3 runes niv.1\nmoins cher',
      disabled: griffes < RUNE_PACK_COST,
      onPress: onBuyPack,
    },
    {
      key: 'random',
      // Le dé reste un emoji : c'est le hasard qu'il représente, aucune
      // pierre précise ne conviendrait.
      arts: [],
      emoji: '🎲',
      // Tant qu'un tirage offert est en attente, c'est CETTE case qui
      // sert : coût nul, libellé explicite. Une case de plus aurait
      // débordé du panneau (3 emplacements mesurés dans l'asset).
      cost: freeRuneDraw ? 0 : RUNE_COST,
      desc: freeRuneDraw ? 'TIRAGE OFFERT\n1 rune niv.1' : '1 rune niv.1\nau hasard',
      disabled: freeRuneDraw ? false : griffes < RUNE_COST,
      onPress: freeRuneDraw ? onUseFreeDraw : onBuyRandom,
    },
  ];

  return (
    <View style={{ width, height: H }}>
      <Image
        source={RUNES_SHOP_PANEL}
        style={{ position: 'absolute', width, height: H, pointerEvents: 'none' }}
        resizeMode="stretch"
      />
      {/* Titre écrit DANS la plaque vide de l'image. */}
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
        <Text style={[styles.shopBannerText, { fontSize: fsBanner }]} numberOfLines={1} adjustsFontSizeToFit>
          BOUTIQUE
        </Text>
      </View>

      {offers.map((o, i) => {
        const slot = SHOP_SLOTS[i];
        const left = slot.left * width;
        const w = (slot.right - slot.left) * width;
        return (
          <React.Fragment key={o.key}>
            <TouchableOpacity
              style={{
                position: 'absolute', left, width: w, top: slotTop, height: slotH,
                alignItems: 'center', justifyContent: 'center',
                opacity: o.disabled ? 0.45 : 1,
              }}
              onPress={o.onPress}
              disabled={o.disabled}
              activeOpacity={0.75}
            >
              <View style={styles.shopIconRow}>
                {o.arts.length > 0
                  ? o.arts.map((art, k) => {
                      const sz = o.arts.length > 1 ? fsIconSmall * 1.7 : fsIcon * 1.5;
                      return (
                        <Image key={k} source={art} style={{ width: sz, height: sz }} resizeMode="contain" />
                      );
                    })
                  : <Text style={{ fontSize: fsIcon }}>{o.emoji}</Text>}
              </View>
              <View style={styles.shopPriceRow}>
                {/* Un coût nul afficherait « 0 🐾 », ce qui se lit comme un
                    prix. On écrit GRATUIT et on masque l'icône. */}
                <Text style={[styles.shopPriceText, { fontSize: fsPrice }]}>
                  {o.cost > 0 ? o.cost : 'GRATUIT'}
                </Text>
                {o.cost > 0 && (
                <Image
                  source={GRIFFES_ICON}
                  style={{ width: fsPrice, height: fsPrice }}
                  resizeMode="contain"
                />
                )}
              </View>
            </TouchableOpacity>

            {/* Légende sur le bois, sous la case : sans elle les 3 offres
                ne se distinguaient que par leur prix. */}
            <View
              style={{
                position: 'absolute', left, width: w, top: descTop, height: descH,
                alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Text
                style={[styles.shopOfferDesc, { fontSize: fsDesc, lineHeight: fsDesc + 2 }]}
                numberOfLines={2}
              >
                {o.desc}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function RunesScreen({ griffes, ownedRunes, onBuyRune, onBuyPack, onBuySpecial, specialOffer, onFuseAll, onBuyGriffes, onBack }) {
  // Écran de fusion dédié (30/08) — remplace l'ancien mode "tape une
  // rune puis retape une pareille", pas très intuitif (fallait deviner
  // quelle rune correspondait à quelle autre). Regroupe automatiquement
  // les runes identiques, un seul bouton clair par groupe.
  const [shopW, setShopW] = useState(0);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  // Runes à révéler après un achat (null = rien à montrer).
  const [reveal, setReveal] = useState(null);
  // Emballe un achat : s'il a abouti, on montre ce qui est sorti. Un
  // achat refusé (pas assez de Griffes, offre déjà prise) renvoie null
  // et ne déclenche donc aucune animation.
  const withReveal = (buy) => () => {
    const got = buy();
    if (got && got.length) setReveal(got);
  };
  const [rightBox, setRightBox] = useState({ w: 0, h: 0 });
  // La collection est passée en SURCOUCHE (13/09) : l'atelier est seul
  // dans sa colonne et peut donc la remplir.
  const forgeMaxH = rightBox.h * 0.95;
  const forgeW = rightBox.h > 0 ? Math.min(rightBox.w, forgeMaxH * FORGE_PANEL_RATIO) : 0;

  return (
    <ImageBackground source={RUNES_BG} style={styles.screen} resizeMode="cover">
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
        {/* GAUCHE : la boutique, sur toute la colonne. */}
        <View style={styles.runesShopCol} onLayout={(e) => setShopW(e.nativeEvent.layout.width)}>
          {shopW > 0 && (
            <RuneShopPanel
              width={shopW}
              griffes={griffes}
              specialOffer={specialOffer}
              onBuyRandom={withReveal(onBuyRune)}
              onBuyPack={withReveal(onBuyPack)}
              onBuySpecial={withReveal(onBuySpecial)}
            />
          )}

          {/* Bouton INVENTAIRE : la plaque en bois EST le bouton. Sa
              hauteur découle de sa largeur (ratio de l'image), jamais
              l'inverse, sinon le cadre se déforme. */}
          {shopW > 0 && (
            <TouchableOpacity
              style={styles.invOpenBtn}
              onPress={() => setInventoryOpen(true)}
              activeOpacity={0.8}
            >
              {/* ImageBackground et NON <Image style={absoluteFill}> :
                  une Image sans largeur/hauteur explicites n'est pas
                  contrainte de façon fiable et se dessinait à sa taille
                  NATIVE (520x134), d'où une plaque géante avec le texte
                  coincé dans son coin. ImageBackground se comporte comme
                  une View : l'image suit la boîte du texte. */}
              <ImageBackground
                source={WOOD_PLATE}
                style={styles.invOpenPlate}
                resizeMode="stretch"
              >
                <Text style={styles.woodPlateText} numberOfLines={1}>INVENTAIRE</Text>
              </ImageBackground>
            </TouchableOpacity>
          )}
        </View>

        {/* DROITE : l'atelier en haut, la collection dessous. */}
        <View
          style={styles.runesRightCol}
          onLayout={(e) => setRightBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          <View style={styles.forgeZone}>
            {forgeW > 0 && <ForgePanel width={forgeW} onAutoFuse={onFuseAll} />}
          </View>
        </View>
      </View>

      {inventoryOpen && (
        <RuneInventory ownedRunes={ownedRunes} onClose={() => setInventoryOpen(false)} />
      )}

      {/* Rendu EN DERNIER : la révélation doit passer au-dessus de tout,
          l'ordre des frères décide de l'empilement. */}
      {reveal && <RuneReveal runes={reveal} onClose={() => setReveal(null)} />}
    </ImageBackground>
  );
}

// Écran de fusion — regroupe les runes par type+niveau IDENTIQUES, un
// bouton "Fusionner" unique et clair par groupe (au lieu de deviner
// quelle rune correspond à quelle autre). Grisé/désactivé si moins de 2
// exemplaires, ou si déjà au palier maximum.
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
                    <Image source={def.art} style={styles.runeArt} resizeMode="contain" />
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
  runesShopCol: { width: '46%' },
  runesRightCol: { flex: 1 },
  forgeZone: { alignItems: 'center' },
  // Plaque dimensionnée par son texte : hauteur fixe, largeur libre.
  invOpenBtn: { alignSelf: 'center', marginTop: 8 },

  // --- Révélation d'achat ---
  revealOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(4,7,14,0.88)',
    alignItems: 'center', justifyContent: 'center',
  },
  revealTitle: {
    color: '#f3e3c0', fontSize: 15, fontWeight: '900',
    letterSpacing: 1.4, marginBottom: 18,
  },
  revealRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  revealItem: { alignItems: 'center', width: 92 },
  // left CALCULÉ, pas laissé à l'align-items du parent : un enfant
  // absolu sans inset dépend du moteur de mise en page, autant le poser.
  // (92 - 130) / 2 = -19
  revealGlow: { position: 'absolute', width: 130, height: 130, top: -28, left: -19 },
  revealArt: { width: 72, height: 72 },
  revealName: { fontSize: 12, fontWeight: '900', marginTop: 6 },
  revealLevel: { color: '#e8d5ab', fontSize: 10, fontWeight: '800', marginTop: 1 },
  revealHint: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginTop: 24 },
  // La plaque se cale sur son texte : hauteur fixe, largeur libre.
  invOpenPlate: {
    height: 28, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  woodPlateText: { color: '#f3e3c0', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  runeArt: { width: 30, height: 30 },
  invDetailArtBox: {
    width: 54, height: 54, borderWidth: 2, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  invDetailArt: { width: 42, height: 42 },
  invDetailValue: { fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 3 },

  // --- Inventaire des runes (surcouche, 13/09) ---
  invOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(4,7,14,0.82)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  // Largeur fixe en % + hauteur en % : PAS d'aspectRatio ici, le cadre
  // est étiré (resizeMode stretch) et supporte de ne pas être à son
  // ratio natif.
  // Taille posée à l'appel (dérivée du ratio du cadre), pas ici.
  invCenter: { alignItems: 'center', justifyContent: 'center' },
  invBannerText: { color: '#e8d5ab', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  // Corps posé dans la zone de bois utile du cadre (fractions mesurées).
  // AUCUNE largeur ici : elle vient de la zone MESURÉE sur l'asset,
  // posée à l'appel. En remettre une l'écraserait (le tableau de styles
  // applique le dernier gagnant) et le contenu sortirait du cadre.
  invDetailCol: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  invDetailName: { fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  invDetailLevel: { color: '#e8d5ab', fontSize: 10, fontWeight: '800', marginTop: 2 },
  invDetailEffect: {
    color: '#fff', fontSize: 11, fontWeight: '700',
    textAlign: 'center', marginTop: 8, lineHeight: 15,
  },
  invDetailState: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 8 },
  invDetailHint: {
    color: COLORS.muted, fontSize: 10, fontWeight: '700',
    textAlign: 'center', paddingHorizontal: 4,
  },
  shopBannerText: { color: '#f3e3c0', fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  forgePlateText: { color: '#4a3410', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  forgeResultWrap: {
    position: 'absolute', left: 0, right: 0, top: '6%', alignItems: 'center',
    pointerEvents: 'none',
  },
  forgeResultText: {
    color: '#ffd86b', fontSize: 13, fontWeight: '900',
    backgroundColor: 'rgba(8,14,24,0.75)', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10, overflow: 'hidden',
  },
  shopIconRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  shopOfferDesc: { color: '#e8d5ab', fontSize: 8, fontWeight: '700', textAlign: 'center', lineHeight: 10 },
  shopPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  shopPriceText: { color: '#fff', fontSize: 12, fontWeight: '900' },
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

  // Une page = un chapitre. AUCUNE marge : `pagingEnabled` cale son pas
  // sur la hauteur du ScrollView, la moindre marge ferait dériver les
  // pages les unes après les autres.
  chapterBlock: {},
  chapterPath: { width: '100%', position: 'relative' },
  mapScroll: { flex: 1 },
  mapScreen: { flex: 1, backgroundColor: COLORS.bg },
  // En-tête EN SURCOUCHE : il ne prend plus de place dans le flux, donc
  // le décor commence bien à y = 0.
  mapHeader: {
    position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20,
    paddingHorizontal: 14, paddingTop: 8, marginBottom: 0,
  },
  // Pastilles de chapitre, collées au bord droit et hors du flux.
  chapterDots: {
    position: 'absolute', right: 4, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 6,
    pointerEvents: 'none',
  },
  chapterDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(140,170,205,0.45)',
  },
  chapterDotOn: { backgroundColor: COLORS.action, width: 8, height: 8, borderRadius: 4 },
  pathDot: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  levelNode: {
    position: 'absolute',
    // Dérivé de LEVEL_NODE_SIZE : la valeur était figée à 46 alors que
    // la constante valait 38, donc le positionnement (qui utilise la
    // constante) décalait chaque nœud de 4 px.
    width: LEVEL_NODE_SIZE, height: LEVEL_NODE_SIZE, borderRadius: LEVEL_NODE_SIZE / 2,
    backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  // Sur un décor clair, la pastille sombre par défaut se noie : fond
  // plus opaque et contour blanc pour la détacher.
  levelNodeOnScene: {
    backgroundColor: 'rgba(12,22,36,0.86)',
    borderColor: 'rgba(255,255,255,0.85)', borderWidth: 2.5,
  },
  pathDotOnScene: { backgroundColor: 'rgba(255,255,255,0.92)' },
  levelNodeCurrent: {
    borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.15)',
    shadowColor: COLORS.action, shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  levelNodeDone: { borderColor: COLORS.good, backgroundColor: COLORS.good },
  levelNodeText: { color: COLORS.text, fontSize: 15, fontWeight: '900' },

  // Pastille sombre plutôt qu'un voile derrière l'en-tête : elle épouse
  // le texte au lieu de dessiner un rectangle gris sur le décor.
  energyBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,14,24,0.72)',
    borderRadius: 14, paddingHorizontal: 9, paddingVertical: 3,
  },
  energyBadgeText: { color: COLORS.neonCyan, fontSize: 13, fontWeight: '800' },
  energyBadgeCountdown: { color: '#9fb2c9', fontSize: 9, fontWeight: '700', marginTop: 1 },
  // Position verticale posée à l'appel (au-dessus, ou en dessous quand
  // il n'y a pas la place).
  levelStars: { position: 'absolute', left: 0, right: 0 },
  starRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  sectionStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Étoile non gagnée : MÊME image, simplement recolorée en sombre —
  // une opacité seule laissait lire une étoile dorée pâlie.
  starRowEmpty: { tintColor: '#4a3a1c', opacity: 0.85 },

  elemHelpBtn: {
    // Dans le flux de l'en-tête (13/09) : plus de position absolue.
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14,
    marginRight: 8,
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
  elemHelpBack: {
    position: 'absolute', top: 8, right: 10, zIndex: 5,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  elemHelpBackText: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
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

  runeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingBottom: 20 },
  runeEmptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 20, width: '100%' },
  // Cellules réduites (12/09) : la collection doit tenir sous l'atelier
  // et afficher beaucoup de runes d'un coup.
  runeCell: {
    width: 54, backgroundColor: COLORS.panel, borderRadius: 10, padding: 6, alignItems: 'center',
    borderWidth: 2,
  },
  runeLevel: { color: COLORS.text, fontSize: 9, fontWeight: '800', marginTop: 2 },
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

  runeEquippedTag: { color: COLORS.action, fontSize: 8, fontWeight: '800', marginTop: 2 },

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
  mlRuneArt: { width: 22, height: 22 },
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

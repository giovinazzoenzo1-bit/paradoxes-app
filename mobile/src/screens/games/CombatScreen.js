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
  View, Text, TouchableOpacity, StyleSheet, Animated, Alert, useWindowDimensions, ImageBackground, Image, ScrollView, Easing, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreatureArt, { hasCreatureArt } from '../../components/CreatureArt';
import { afficherDialogue } from '../../components/DialogueJeu';
import { jouerSon, SON_ELEMENT } from './sonsBoutique';
import { useSettings } from '../../context/SettingsContext';
import { useMusique } from './musique';
import { debutCombat, noterVerdict, noterAttaque, noterSort, noterSpecial } from './journalCombat';
import { CADRAGE_CREATURES } from '../../games/clicker/cadrageCreatures';
import { StatusBar } from 'expo-status-bar';

// Décor de combat fourni par l'utilisateur (30/08) — remplace le fond
// placeholder en formes. Élargi au ratio 2400x1080 par miroir flouté sur
// les côtés pour éviter tout rognage vertical (la lune et le premier plan
// restent visibles quel que soit l'écran), exporté en JPEG (512 Ko).
// Décor de champ de bataille (11/09). Remplace l'ancien fond : celui-ci
// est dessiné en légère plongée, avec une zone centrale dégagée, donc
// les créatures se posent dessus au lieu de flotter sur une image plate.
const BG_IMG = require('../../../assets/combat/battlefield.jpg');
// ════════════════════════════════════════════════════════════════════
//  COMBAT « LE BANDEAU DE COMBAT » (03/10, maquette de l'auteur, paysage)
// ════════════════════════════════════════════════════════════════════
// Maquette : design/a-integrer/07-combat/concepts/1791102918928.jpg. Bandeau
// en haut : tes créatures à gauche (nom, vie CHIFFRÉE, mana), le tour au centre,
// les adversaires à droite (badge d'élément cerclé de la couleur d'affinité).
// Attaques sur des cartes (bois ; pierre grise si le mana manque), étiquette sur
// la planche de l'aperçu. Pièces de Gemini élargies en 9 morceaux (coins gardés).
// L'AFFICHAGE seul change : la logique du combat est intacte.
const COMBAT_IMG = {
  bandeau: require('../../../assets/combat/bandeau.png'),
  panneau: require('../../../assets/combat/panneau.png'),
  carteBois: require('../../../assets/combat/carte-bois.png'),
  cartePierre: require('../../../assets/combat/carte-pierre.png'),
  recharge: require('../../../assets/combat/recharge.png'),
  planche: require('../../../assets/exploration/plaque-titre.png'),
  medaillon: require('../../../assets/exploration/medaillon.png'),
  lueur: require('../../../assets/grimoire/lueur-or.png'),
};
const COMBAT_RAPPORT = 1376 / 768;

// ════════════════════════════════════════════════════════════════════
//  EFFETS DE COMBAT — ÉTAPE 1 : L'IMPACT (03/10, demande de l'auteur)
// ════════════════════════════════════════════════════════════════════
// À l'instant où l'élan TOUCHE (~270 ms : 160 de recul + 110 de détente) :
// éclat blanc de la silhouette, anneau + étincelles, secousse de l'écran,
// vibration, chiffres selon le verdict (PARFAIT gros et doré). Tout est
// DÉCORATIF (rien n'attend ces effets) et TRANSPARENT au toucher (style).
const ND = Platform.OS !== 'web'; // moteur natif sur téléphone ; JS au banc (le natif n'y tourne pas)
// Tempo d'un échange (03/10) : élan PLUS LONG vers la cible (détente 150 ms au lieu de
// 110), impact à 310 ms ; l'adversaire riposte quand ton élan est revenu ; le coup
// FINAL reste visible avant l'écran de victoire / défaite.
const LUNGE_DETENTE_MS = 150;
const IMPACT_MS = 160 + LUNGE_DETENTE_MS;
// Effets d'ÉLÉMENT à l'impact (03/10, étape 2) : peints par Gemini sur fond NOIR, la
// lumière convertie en transparence (assets/combat/effets/).
const EFFET_ELEMENT = {
  Feu: require('../../../assets/combat/effets/feu.png'),
  Eau: require('../../../assets/combat/effets/eau.png'),
  Terre: require('../../../assets/combat/effets/terre.png'),
  Air: require('../../../assets/combat/effets/air.png'),
  Foudre: require('../../../assets/combat/effets/foudre.png'),
  'Lumière': require('../../../assets/combat/effets/lumiere.png'),
  'Ténèbres': require('../../../assets/combat/effets/tenebres.png'),
  Magie: require('../../../assets/combat/effets/magie.png'),
};
const RIPOSTE_MS = 950; // ton élan (recul, détente, arrêt, ressort) est REVENU : les 2 mouvements ne se chevauchent pas
const FIN_EN_PLUS_MS = 700;
const STYLE_COUP = {
  soutien: { couleur: '#cfe9ff', etincelles: 3, secousse: 0, vibration: null }, // coup de soutien (09/10) : discret
  parfait: { couleur: '#ffd24a', taille: 32, etincelles: 12, secousse: 9, vibration: 'heavy' },
  bien: { couleur: '#ffffff', taille: 26, etincelles: 8, secousse: 5, vibration: 'medium' },
  rate: { couleur: '#c9ccd2', taille: 22, etincelles: 4, secousse: 2, vibration: 'light' },
  absent: { couleur: '#ff9a8a', taille: 20, etincelles: 3, secousse: 1, vibration: 'light' },
  riposte: { couleur: '#ff6a4a', taille: 24, etincelles: 6, secousse: 4, vibration: 'light' },
};
// Vibration : JAMAIS de plantage. ⚠️ Même motif que sonsBoutique.js (02/10) :
// expo-haptics appelle le module natif dès son chargement, et un try/catch autour
// d'un require ne voit pas l'erreur FATALE de Metro → on DEMANDE d'abord si le
// module natif existe (requireOptionalNativeModule ne lève pas), et on ne charge
// expo-haptics que s'il existe (l'appli construite peut ne pas l'embarquer).
// Contrôle : auditModulesNatifsProteges.
let haptique; // undefined : pas encore essayé ; null : indisponible
function moduleHaptique() {
  if (haptique === undefined) {
    let natif = null;
    try { natif = requireOptionalNativeModule('ExpoHaptics'); } catch (e) { natif = null; }
    haptique = natif ? require('expo-haptics') : null;
  }
  return haptique;
}
function vibrer(force) {
  try {
    const H = moduleHaptique();
    if (!H) return;
    const s = force === 'heavy' ? H.ImpactFeedbackStyle.Heavy : force === 'medium' ? H.ImpactFeedbackStyle.Medium : H.ImpactFeedbackStyle.Light;
    const r = H.impactAsync(s);
    if (r && r.catch) r.catch(() => {});
  } catch (e) { /* pas de vibration, pas de plantage */ }
}
// Un impact : un anneau qui s'ouvre et des étincelles qui jaillissent, puis s'effacent.
function Impact({ x, y, couleur, etincelles, effet = null, taille = 90, grand = false, onFini }) {
  const t = useRef(new Animated.Value(0)).current;
  const angles = useRef(Array.from({ length: etincelles }, (_, i) => (i / etincelles) * Math.PI * 2 + Math.random() * 0.5)).current;
  const dist = useRef(angles.map(() => 34 + Math.random() * 30)).current;
  const rot = useRef(Math.round(Math.random() * 24 - 12)).current;
  const T = taille * (grand ? 2.1 : 1.65);
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: effet ? 600 : 520, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start(() => onFini && onFini());
  }, []);
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, pointerEvents: 'none' }}>
      {effet && (
        <Animated.Image source={effet} resizeMethod="scale" resizeMode="contain" style={{ position: 'absolute', left: -T / 2, top: -T / 2, width: T, height: T,
          opacity: t.interpolate({ inputRange: [0, 0.12, 0.6, 1], outputRange: [0, 1, 0.85, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.35] }) }, { rotate: `${rot}deg` }] }} />
      )}
      <Animated.View style={[styles.impactAnneau, { borderColor: couleur, opacity: t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.5, 0] }), transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.9] }) }] }]} />
      {angles.map((a, i) => (
        <Animated.View key={i} style={[styles.impactEtincelle, { backgroundColor: couleur, opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
          transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * dist[i]] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * dist[i]] }) }, { rotate: `${Math.round(a * 57)}deg` }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.4] }) }] }]} />
      ))}
    </View>
  );
}
// ════ EFFETS DE COMBAT — ÉTAPE 3 : SORTS, SPÉCIAL, K.O. (03/10) ════
// Un visuel par sort (forme, couleur, icône, texte), joué sur la bonne créature : au
// LANCEMENT pour les sorts de soutien, à l'IMPACT pour les offensifs ; le spécial assombrit
// l'écran ; une créature qui tombe affiche « K.O. ». Transparents au toucher.
const SORT_VISUEL = {
  bouclier: { couleur: '#8fd3ff', icone: '🛡️', duree: 1100, forme: 'bulle', texte: (v) => (v ? `+${v}` : null) },
  soin: { couleur: '#5ee08a', icone: '💚', duree: 1100, forme: 'montee', texte: (v) => (v ? `+${v}` : null) },
  boost: { couleur: '#ff8a3d', icone: '🔥', duree: 900, forme: 'anneaux' },
  vitesse: { couleur: '#ffd24a', icone: '⚡', duree: 800, forme: 'anneaux' },
  provocation: { couleur: '#ff4d4d', icone: '🔱', duree: 900, forme: 'anneaux' },
  pacte: { couleur: '#d81e3a', icone: '🩸', duree: 900, forme: 'gouttes' },
  poison: { couleur: '#7be04a', icone: '☠️', duree: 1000, forme: 'bulles' },
  marque: { couleur: '#ff3b3b', icone: '🎯', duree: 900, forme: 'viseur' },
  execution: { couleur: '#ffffff', icone: '🗡️', duree: 650, forme: 'taillade' },
  zone: { couleur: '#b98cff', icone: '🌀', duree: 850, forme: 'onde' },
  special: { couleur: '#ffd24a', icone: '🌟', duree: 950, forme: 'onde' },
  ko: { couleur: '#ff5252', icone: null, duree: 950, forme: 'ko', texte: () => 'K.O.' },
};
// Exporté pour la scène de banc des effets (tools/capture/scenes/effets-sorts.jsx).
export function EffetSort({ type, x, y, taille = 90, valeur = null, onFini }) {
  const v = SORT_VISUEL[type] || SORT_VISUEL.boost;
  const t = useRef(new Animated.Value(0)).current;
  const parts = useRef(Array.from({ length: 8 }, () => ({ dx: (Math.random() - 0.5) * taille * 0.9 }))).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: v.duree, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start(() => onFini && onFini());
  }, []);
  const R = taille * 0.75;
  const fond = (c, a) => c + a;
  const txt = v.texte ? v.texte(valeur) : null;
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, pointerEvents: 'none' }}>
      {v.forme === 'bulle' && (
        <Animated.View style={[styles.sortCercle, { left: -R, top: -R, width: 2 * R, height: 2 * R, borderRadius: R, borderColor: v.couleur, backgroundColor: fond(v.couleur, '30'),
          opacity: t.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.9, 0] }), transform: [{ scale: t.interpolate({ inputRange: [0, 0.2, 0.35, 1], outputRange: [0.5, 1.1, 1, 1] }) }] }]} />
      )}
      {(v.forme === 'anneaux' || v.forme === 'onde' || v.forme === 'ko') && [0, 1].map((k) => (
        <Animated.View key={k} style={[styles.sortCercle, { left: -R, top: -R, width: 2 * R, height: 2 * R, borderRadius: R, borderColor: v.forme === 'ko' ? '#9aa0a6' : v.couleur,
          opacity: t.interpolate({ inputRange: [0, 0.1 + k * 0.2, 1], outputRange: [0, 0.9, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3 + k * 0.2, v.forme === 'onde' ? 3.2 : 1.6 + k * 0.3] }) }] }]} />
      ))}
      {(v.forme === 'montee' || v.forme === 'bulles' || v.forme === 'gouttes') && parts.map((pt, k) => (
        <Animated.View key={k} style={[styles.sortParticule, v.forme === 'gouttes' && styles.sortGoutte, { backgroundColor: v.couleur, left: pt.dx - 4,
          opacity: t.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 0.8, 0] }),
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: v.forme === 'gouttes' ? [-R * 0.6, R * 0.5] : [R * 0.3, -R * 1.3 - k * 3] }) }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) }] }]} />
      ))}
      {v.forme === 'viseur' && (
        <Animated.View style={[styles.sortViseur, { left: -R * 0.8, top: -R * 0.8, width: 1.6 * R, height: 1.6 * R, borderRadius: 0.8 * R, borderColor: v.couleur,
          opacity: t.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1.8, 1, 1] }) }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }]} />
      )}
      {v.forme === 'taillade' && (
        <Animated.View style={[styles.sortTaillade, { left: -R * 1.2, width: 2.4 * R, backgroundColor: v.couleur,
          opacity: t.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 1, 0.8, 0] }),
          transform: [{ rotate: '-35deg' }, { scaleX: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.1, 1, 1.1] }) }] }]} />
      )}
      {v.icone && (
        <Animated.Text style={[styles.sortIcone, { fontSize: Math.round(taille * 0.42), left: -taille * 0.3, top: -taille * 1.05, width: taille * 0.6,
          opacity: t.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 0.18, 0.3, 1], outputRange: [0.3, 1.4, 1, 1] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [10, -12] }) }] }]}>{v.icone}</Animated.Text>
      )}
      {txt && (
        <Animated.Text style={[styles.sortTexte, { color: v.couleur, left: -taille * 0.6, width: taille * 1.2, top: -taille * 0.25,
          opacity: t.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -taille * 0.6] }) }] }]}>{txt}</Animated.Text>
      )}
    </View>
  );
}
// Spécial : l'écran S'ASSOMBRIT un instant (transparent au toucher).
function AssombrirEcran() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(t, { toValue: 0.5, duration: 140, useNativeDriver: ND }),
      Animated.delay(260),
      Animated.timing(t, { toValue: 0, duration: 320, useNativeDriver: ND }),
    ]).start();
  }, []);
  return <Animated.View style={[styles.assombrirEcran, { opacity: t }]} />;
}

// Éclair BLANC sur tout l'écran (PARFAIT) — bref, transparent au toucher.
function EclairEcran() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(t, { toValue: 0.3, duration: 50, useNativeDriver: ND }),
      Animated.timing(t, { toValue: 0, duration: 170, useNativeDriver: ND }),
    ]).start();
  }, []);
  return <Animated.View style={[styles.eclairEcran, { opacity: t }]} />;
}
// Éclat BLANC de la silhouette touchée : la même illustration, teintée en blanc.
function EclatSilhouette({ creatureId, stageIndex, emoji, size, style }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 60, useNativeDriver: ND }),
      Animated.timing(t, { toValue: 0, duration: 220, useNativeDriver: ND }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity: t, pointerEvents: 'none' }}>
      <CreatureArt creatureId={creatureId} stageIndex={stageIndex} emoji={emoji} size={size} style={[style, { tintColor: '#ffffff' }]} />
    </Animated.View>
  );
}

// Jauge de frappe (03/10). L'aiguille est dessinée par positionAiguille — la MÊME
// formule que le verdict du tap — image par image, dans ce SEUL composant (l'écran
// de combat ne se redessine pas à 60 images/s).
function JaugeFrappe({ jauge, largeur }) {
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (!jauge) return undefined;
    let id;
    const boucle = () => { setPos(positionAiguille((Date.now() - jauge.debut) / 1000)); id = requestAnimationFrame(boucle); };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, [jauge]);
  if (!jauge) return null;
  // Habillage (03/10) : la PLANCHE de l'aperçu (pièce Gemini) en cadre ; l'aiguille et
  // les zones courent dans le SILLON intérieur — c'est lui qui vaut 0 → 1 (même
  // fraction que le verdict : seule la largeur de référence change).
  const W = largeur; const H = Math.round(W * 0.15);
  const insX = W * 0.085; const insY = H * 0.27;
  const w = W - 2 * insX; const h = H - 2 * insY; const haut = 9;
  const zoneP = jauge.largeur * w; const zoneB = (jauge.largeur + 2 * JAUGE_MARGE_BIEN) * w; const cx = jauge.centre * w;
  return (
    <View style={{ width: W, height: H + 2 * haut, marginTop: 4 }}>
      <Image source={COMBAT_IMG.planche} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: 0, top: haut, width: W, height: H }} />
      {/* Lueur derrière le sillon : l'or du « parfait » déborde sur le cadre. */}
      <Image source={COMBAT_IMG.lueur} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: insX + cx - zoneP * 1.8, top: haut + insY - h * 0.9, width: zoneP * 3.6, height: h * 2.8, opacity: 0.85, pointerEvents: 'none' }} />
      <View style={[styles.jaugeSillon, { left: insX, top: haut + insY, width: w, height: h, borderRadius: h / 2 }]}>
        <View style={[styles.jaugeBien, { left: cx - zoneB / 2, width: zoneB }]} />
        <View style={[styles.jaugeParfait, { left: cx - zoneP / 2, width: zoneP }]}>
          <View style={styles.jaugeParfaitReflet} />
        </View>
      </View>
      <View style={[styles.jaugeAiguille, { left: insX + pos * w - 4, top: haut + insY - 6, height: h + 12 }]}>
        <View style={styles.jaugeAiguilleTete} />
      </View>
    </View>
  );
}
const ELEMENT_EMOJI = { Feu: '🔥', Eau: '💧', Terre: '🌿', Air: '🌪️', Foudre: '⚡', 'Lumière': '☀️', 'Ténèbres': '🌙', Magie: '🔮' };
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
import { stadeVisuel, MANA_MAX, MANA_PER_TURN } from '../../games/clicker/clickerLogic';
import {
  combatStatsForCreatureTyped,
  opponentTeamForLevel,
  statsForOpponentCreatureTyped,
  equipeEnnemie,
  estEtapeBoss,
  bonusElite,
  bonusBoss,
  nombreCourt,
  opponentGoesFirst,
  damageMultiplierForTime,
  computePlayerDamage,
  griffesReward,
  effectiveTapCount,
  scaledSkillDamage,
  TAP_CHALLENGE_TIME_LIMIT_SEC,
  largeurZoneParfait,
  positionAiguille,
  centreZoneAleatoire,
  resultatJauge,
  multiplicateurJauge,
  multiplicateurSort,
  JAUGE_DELAI_MAX_SEC,
  JAUGE_MARGE_BIEN,
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
  manaDeDepart,
  competencesAvecSort,
  lancerSort,
  modifierCoup,
  meilleureAttaque,
  SORTS,
  actionAdversaire,
  cibleDuJoueur,
  appliquerElixir,
  appliquerBaisse,
  niveauxManquantsExact,
  presqueGagne,
  GUARDIAN_PHASE1_HP_LOSS,
  applyGuardianDamage,
  guardianStats,
  coupsDeSoutien,
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
function FloatingDamage({ amount, color, taille = null, pop = false }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: ND }).start();
  }, [anim]);
  // PARFAIT : le chiffre JAILLIT (×1,5 puis se pose).
  const scale = pop ? anim.interpolate({ inputRange: [0, 0.12, 0.3, 1], outputRange: [0.6, 1.5, 1, 1] }) : 1;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -44] });
  const opacity = anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.Text style={[styles.floatingDamage, taille ? { fontSize: taille } : null, { color, opacity, transform: [{ translateY }, { scale }] }]}>
      -{nombreCourt(amount)}
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
// Places sur le terrain (03/10) : celles de la maquette « Le bandeau de combat » —
// tout entre le bandeau (en haut) et les cartes (en bas) ; l'actif devant.
const PLAYER_SLOTS = [
  { x: 0.20, y: 0.60, size: 1.0 },
  { x: 0.31, y: 0.50, size: 0.78 },
  { x: 0.40, y: 0.47, size: 0.68 },
];
// Adversaires décalés vers la droite (11/09) : ils empiétaient sur le
// centre du terrain, où passe le sentier du décor.
// Remontés le 12/09 : avec les boutons d'attaque en carrés de 86dp en
// bas de l'écran, les emplacements bas (y 0,60) passaient derrière eux.
const OPPONENT_SLOTS = [
  { x: 0.70, y: 0.57, size: 1.0 },
  { x: 0.82, y: 0.46, size: 0.78 },
  { x: 0.89, y: 0.62, size: 0.85 },
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
      // Mana de départ : règle PARTAGÉE (Rune d'Arcane comprise, 03/10).
    return { creature: member.creature, ownedLevel: member.ownedLevel, evolutionTier: member.evolutionTier || 0, stats, hp: stats.hp, mana: manaDeDepart(stats), etats: {} };
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
      // Niveaux réels (10/10) : niveau et évolution AFFICHÉS de l'ennemi (le Gardien n'en a pas).
      const membre = creature.boss ? null : equipeEnnemie(levelNumber).find((m) => m.creature.id === creature.id);
      return { creature, stats, hp: stats.hp, mana: MANA_DEPART, etats: {}, niveau: membre ? membre.niveau : null, evolutionTier: membre ? membre.evolutionTier : 0 };
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
  // Jauge de frappe (03/10) : { debut, centre, largeur } ; verdict affiché après le tap.
  const [jauge, setJauge] = useState(null);
  const jaugeRef = useRef(null);
  const verdictRef = useRef(null);
  const [verdict, setVerdict] = useState(null);
  // Sons du combat (07/10, ElevenLabs) : réglage « Sons » des Paramètres.
  const { sons: sonsReglage, musique: musiqueReglage } = useSettings();
  useMusique(guardianEggNumber > 0 ? 'boss' : 'combat', musiqueReglage); // musique du combat (07/10)
  const sonsRef = useRef(true);
  sonsRef.current = sonsReglage !== false;
  const son = (nom) => jouerSon(nom, sonsRef.current);
  // (08/10) Journal des combats : l'équipe, le mode, le Gardien — au début du combat.
  useEffect(() => {
    const g = guardianEggNumber > 0 && opponents && opponents[0] && opponents[0].stats ? opponents[0].stats : null;
    debutCombat({ mode: guardianEggNumber > 0 ? 'gardien' : 'aventure', niveau: levelNumber, oeuf: guardianEggNumber || 0, elixir: !!elixirActif,
      equipe: (team || []).map((m) => ({ id: m.creature && m.creature.id, rarete: m.creature && m.creature.rarity, niv: m.ownedLevel, palier: m.evolutionTier || 0, runes: (m.equippedRunes || []).length })),
      gardien: g ? { pv: g.hp, attaque: Math.round((g.attack || 0) * 100) / 100 } : null });
  }, []);
  // Le Gardien de l'œuf entre en scène (07/10).
  useEffect(() => { if (guardianEggNumber > 0) son('boss-apparition'); }, []);
  // Spécial prêt (07/10) : le mana du combattant actif atteint le maximum.
  const manaActif = fighters[activeIndex] ? fighters[activeIndex].mana : 0;
  const manaPrecRef = useRef(manaActif);
  useEffect(() => {
    if (manaActif >= MANA_MAX && manaPrecRef.current < MANA_MAX) son('special-pret');
    manaPrecRef.current = manaActif;
  }, [manaActif]);
  const montrerVerdict = (v) => { noterVerdict(v); if (v === 'parfait') son('jauge-parfait'); setVerdict(v); setTimeout(() => setVerdict((x) => (x === v ? null : x)), 900); };
  const [timeLeft, setTimeLeft] = useState(TAP_CHALLENGE_TIME_LIMIT_SEC);
  const [switchMessage, setSwitchMessage] = useState(null);
  const [outcome, setOutcome] = useState(null); // null | 'win' | 'lose'
  // « Il te manquait X niveaux » (26/09) : la MÊME mesure exacte que la
  // puissance de l'aperçu (combatLogic.niveauxManquantsExact), en différé à
  // la défaite — « … » le temps du calcul. Aventure seulement (`aideDefaite`) ;
  // filet du combat compté, Élixir EXCLU.
  const [manqueExact, setManqueExact] = useState(null);
  useEffect(() => {
    if (outcome !== 'lose' || !aideDefaite) return undefined;
    let annule = false;
    const t = setTimeout(() => {
      try {
        const d = niveauxManquantsExact(team, levelNumber, { filetBaisse });
        if (!annule) setManqueExact(d);
      } catch (e) {
        if (!annule) setManqueExact(0);
      }
    }, 60);
    return () => { annule = true; clearTimeout(t); };
  }, [outcome]);
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
  // Élan VERS LA CIBLE (03/10, demande de l'auteur : « un plus long mouvement vers celui
  // qu'il attaque ») : 62 % du chemin jusqu'à elle (avant : 1,1 × sa taille, à l'horizontale).
  // Rythme : recul, détente, TEMPS D'ARRÊT à l'impact (12/09), retour souple.
  // ⚠️ L'ANIMATION D'UN ÉLAN DÉMARRE APRÈS LA MISE À JOUR DE L'ÉCRAN (useEffect ci-dessous),
  // jamais dans playLunge (03/10, mesuré : la riposte s'arrêtait 41 ms après son départ).
  // Les élans partagent `lungeAnim` : quand la créature précédente cesse d'être « en élan »,
  // sa transformation se DÉTACHE ; sans autre attache à cet instant, Animated ARRÊTE
  // l'animation en cours — celle de l'élan suivant, lancée juste avant. Chaque élan a
  // aussi son NUMÉRO : une animation interrompue n'efface que SON élan.
  const lungeIdRef = useRef(0);
  const playLunge = (side, index, cible = null) => {
    const id = ++lungeIdRef.current;
    const depart = centreSprite(side === 'player' ? 'joueur' : 'adversaire', index);
    // 75 % du chemin (03/10 : « encore un petit peu plus », avant 62 %).
    const dx = depart && cible ? (cible.x - depart.x) * 0.75 : (side === 'player' ? 1 : -1) * 110;
    const dy = depart && cible ? (cible.y - depart.y) * 0.75 : 0;
    setLunge({ id, side, index, dx, dy });
  };
  useEffect(() => {
    if (!lunge) return;
    const id = lunge.id;
    lungeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(lungeAnim, { toValue: -0.35, duration: 160, useNativeDriver: ND }),
      Animated.timing(lungeAnim, { toValue: 1, duration: LUNGE_DETENTE_MS, easing: Easing.in(Easing.quad), useNativeDriver: ND }),
      Animated.delay(160),
      Animated.spring(lungeAnim, { toValue: 0, useNativeDriver: ND, friction: 6, tension: 60 }),
    ]).start(() => { if (lungeIdRef.current === id) setLunge(null); });
  }, [lunge && lunge.id]);



  // Minuteur de la suite : posé à chaque résolution, nettoyé si la phase change (03/10).
  useEffect(() => {
    if (phase !== 'resolving') return undefined;
    const t = setTimeout(() => appliquerTransition(), resolutionDureeRef.current);
    return () => clearTimeout(t);
  }, [phase, resolutionId]);

  // Chiffres de dégâts flottants — purement décoratifs (voir
  // FloatingDamage plus haut), `roundKey` change à chaque tour pour les
  // faire rejouer leur animation depuis le début.
  const [roundKey, setRoundKey] = useState(0);
  // ── Effets d'impact (03/10) ──
  const [impacts, setImpacts] = useState([]);
  const [verdictDernierCoup, setVerdictDernierCoup] = useState(null);
  const secousse = useRef(new Animated.Value(0)).current;
  const secouer = (force) => {
    if (!force) return;
    Animated.sequence([force, -force, force * 0.6, -force * 0.6, force * 0.3, 0].map((v) => Animated.timing(secousse, { toValue: v, duration: 40, useNativeDriver: ND }))).start();
  };
  const centreSprite = (cote, index) => {
    if (cote === 'adversaire') {
      const slot = isBoss ? { x: 0.72, y: 0.53, size: 1.7 } : OPPONENT_SLOTS[index];
      return slot ? { x: slot.x * W, y: slot.y * H, taille: SPRITE_BASE * slot.size } : null;
    }
    const actif = activeIndexRef.current;
    const ordre = [actif, ...fightersRef.current.map((_, i) => i).filter((i) => i !== actif)];
    const slot = PLAYER_SLOTS[ordre.indexOf(index)];
    return slot ? { x: slot.x * W, y: slot.y * H, taille: SPRITE_BASE * slot.size } : null;
  };
  // ── Suite du combat après les animations (03/10) — voir finishChallenge ──
  const [resolutionId, setResolutionId] = useState(0);
  const transitionRef = useRef(null);
  const resolutionDureeRef = useRef(0);
  const debutResolutionRef = useRef(0);
  const lancerResolution = (transition, duree) => {
    transitionRef.current = transition;
    resolutionDureeRef.current = duree;
    debutResolutionRef.current = Date.now();
    setResolutionId((x) => x + 1);
    setPhase('resolving');
  };
  // Appliquée UNE seule fois (minuteur, toucher de déblocage : le premier gagne).
  const appliquerTransition = () => {
    const t = transitionRef.current;
    if (!t) return;
    transitionRef.current = null;
    setPvGeles({}); // la suite dégèle tout (filet)
    if (t.type === 'win') { setOutcome('win'); setPhase('done'); return; }
    if (t.type === 'lose') { setOutcome('lose'); setPhase('done'); return; }
    activeIndexRef.current = t.nextIdx;
    setActiveIndex(t.nextIdx);
    // Le mana du combattant qui prend la main monte d'un cran. Sans ce gain, la jauge
    // ne se remplirait jamais et le coup spécial resterait inaccessible toute la partie.
    setFighters((prev) => prev.map((f, i) => (i === t.nextIdx ? { ...f, mana: Math.min(MANA_MAX, f.mana + MANA_PER_TURN) } : f)));
    setSwitchMessage(t.message);
    setTimeout(() => setSwitchMessage(null), t.ko ? 2200 : 1400);
    setPhase('choosing');
  };

  // Éclats + étincelles + secousse + vibration, selon le verdict du coup (ou « riposte »).
  // PV AFFICHÉS gelés jusqu'à l'impact (03/10, l'auteur : « les dégâts sont enlevés avant
  // l'animation »). La LOGIQUE et l'état se mettent à jour tout de suite (les réfs sont
  // recopiées de l'état à CHAQUE rendu : retarder l'état les aurait faussées) ; seul
  // l'AFFICHAGE garde l'ancienne valeur ('o2', 'p0'…) jusqu'au coup. La suite dégèle tout.
  const [pvGeles, setPvGeles] = useState({});
  const pvAffiche = (cote, i, hp) => (pvGeles[`${cote}${i}`] != null ? pvGeles[`${cote}${i}`] : hp);
  const degeler = (prefixe) => setPvGeles((g) => { const n = {}; Object.keys(g).forEach((k) => { if (!k.startsWith(prefixe)) n[k] = g[k]; }); return n; });
  // Riposte À TOUR DE RÔLE (03/10) : rang du prochain adversaire qui frappe.
  const riposteRangRef = useRef(0);
  const [eclairKey, setEclairKey] = useState(0);
  const [assombriKey, setAssombriKey] = useState(0);
  // Visuel d'un sort / du spécial / d'un K.O. sur une créature (03/10, étape 3).
  // Son de chaque visuel (07/10) ; le SPÉCIAL sonne à son LANCEMENT (assombriKey, plus bas).
  const SON_SORT = { soin: 'sort-soin', bouclier: 'sort-bouclier', boost: 'sort-bouclier', vitesse: 'sort-bouclier', provocation: 'sort-bouclier', pacte: 'sort-bouclier',
    poison: 'sort-attaque', marque: 'sort-attaque', execution: 'sort-attaque', zone: 'sort-attaque', ko: 'ko' };
  useEffect(() => { if (assombriKey > 0) { son('special'); noterSpecial(); } }, [assombriKey]);
  const effetSort = (type, cote, index, valeur = null) => {
    if (SON_SORT[type]) son(SON_SORT[type]);
    noterSort(type, cote); // journal des combats (08/10)
    const c = centreSprite(cote, index);
    if (!c) return;
    setImpacts((l) => [...l, { id: `${Date.now()}-${Math.random()}`, sort: type, x: c.x, y: c.y, taille: c.taille, valeur }]);
  };
  const effetsImpact = (cote, index, cle, element = null) => {
    const st = STYLE_COUP[cle] || STYLE_COUP.bien;
    const c = centreSprite(cote, index);
    if (c) setImpacts((l) => [...l, { id: `${Date.now()}-${Math.random()}`, x: c.x, y: c.y, couleur: st.couleur, etincelles: st.etincelles,
      effet: element ? EFFET_ELEMENT[element] || null : null, taille: c.taille, grand: cle === 'parfait' }]);
    if (cle === 'parfait') setEclairKey((k) => k + 1);
    secouer(st.secousse);
    vibrer(st.vibration);
    // Sons (07/10) : le choc selon le verdict, puis l'élément de l'attaquant (pas sur un coup raté).
    son(cle === 'parfait' ? 'impact-parfait' : cle === 'rate' ? 'rate' : 'impact-normal');
    noterAttaque(cle); // journal des combats (08/10)
    if (element && cle !== 'rate' && cle !== 'soutien' && SON_ELEMENT[element]) son(SON_ELEMENT[element]);
  };
  // (09/10) Les coups de SOUTIEN se voient : un petit impact par coéquipier, juste après le coup principal.
  const planifierSoutiens = (soutiens, cibleIdx) => {
    soutiens.forEach((s, k) => {
      const f = fightersRef.current[s.i];
      setTimeout(() => effetsImpact('adversaire', cibleIdx, 'soutien', f && f.creature ? f.creature.element : null), 430 + k * 150);
    });
  };
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
    const curIdx = activeIndexRef.current;
    const pvAvant0 = fightersRef.current.map((f) => f.hp);
    playLunge('opponent', targetIndexRef.current, centreSprite('joueur', curIdx));
    riposteRangRef.current = targetIndexRef.current + 1; // il a frappé : au suivant (tour de rôle)
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

    { const gel0 = {}; newFighters.forEach((f, k) => { if (f && f.hp !== pvAvant0[k]) gel0[`p${k}`] = pvAvant0[k]; }); setPvGeles(gel0); }
    // Impact (03/10) à l'instant où l'élan adverse touche. CORRECTIF : une 2e ligne
    // remettait un NOMBRE au lieu de { amount, index } — le chiffre sur ta créature
    // ne s'affichait jamais quand l'adversaire frappait le premier.
    setTimeout(() => {
      setVerdictDernierCoup(null);
      setRoundKey((k) => k + 1);
      setOpponentDamageFloat(null);
      setPlayerDamageFloat(oppDamage > 0 ? { amount: oppDamage, index: curIdx } : null);
      degeler('p');
      if (oppDamage > 0) effetsImpact('joueur', curIdx, 'riposte', opp.creature.element);
      newFighters.forEach((f, k) => { if (f && f.hp <= 0 && pvAvant0[k] > 0) effetSort('ko', 'joueur', k); });
    }, IMPACT_MS);
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
      const remaining = Math.max(0, JAUGE_DELAI_MAX_SEC - elapsedSec);
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
    setTimeLeft(JAUGE_DELAI_MAX_SEC);
    // Jauge : zone dorée au hasard, largeur selon la rareté (+ sort Vitesse).
    const j = { debut: challengeStartRef.current, centre: centreZoneAleatoire(), largeur: largeurZoneParfait(fightersRef.current[activeIndexRef.current]) };
    jaugeRef.current = j; setJauge(j); verdictRef.current = null;
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

  // UN tap (03/10) : verdict selon l'aiguille à l'INSTANT du toucher (début du geste :
  // onResponderGrant, jamais au relâchement), par la MÊME formule que son dessin.
  const handleTap = () => {
    if (phase !== 'tapping' || challengeDoneRef.current || !jaugeRef.current) return;
    const j = jaugeRef.current;
    const v = resultatJauge(positionAiguille((Date.now() - j.debut) / 1000) - j.centre, j.largeur);
    verdictRef.current = v;
    tapCountRef.current += 1;
    setTapCount(tapCountRef.current);
    montrerVerdict(v);
    finishChallenge(true);
  };


  // Le tirage de compétence adverse vit dans le moteur partagé
  // (combatLogic.riposteAdversaire), utilisé aussi par les simulations.

  const finishChallenge = (completed) => {
    if (challengeDoneRef.current) return;
    challengeDoneRef.current = true;
    const pvAvantO = opponentsRef.current.map((o) => o.hp);
    const pvAvantP = fightersRef.current.map((f) => f.hp);
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
    // Multiplicateur de la JAUGE (03/10) : « absent » si aucun tap à temps.
    const verdictCoup = completed ? (verdictRef.current || 'rate') : 'absent';
    if (!completed) montrerVerdict('absent');
    const multJauge = multiplicateurJauge(verdictCoup);
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
    let evenementsSort = [];
    if (skill.sort) {
      // 10/10 (règle de l'auteur) : l'EFFET du sort suit ce même tap (jaune 100 %, orange 50 %, zone sombre ou
      // pas de tap 10 %) ; ses dégâts éventuels suivent `multJauge` (100 / 50 / 25 %).
      const r = lancerSort(skill.sort, fightersRef.current, curIdx, opponentsRef.current, targetIdx, multiplicateurSort(verdictCoup));
      coupSort = r.coup;
      evenementsSort = r.evenements || [];
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
    // Élan VERS la cible seulement s'il y a un COUP (03/10) : un soin, un bouclier… se
    // lancent sur place (avant : la créature bondissait vers l'ennemi pour se soigner).
    if (part > 0) playLunge('player', curIdx, centreSprite('adversaire', targetIdx));
    // Étape 3 : visuels des sorts de SOUTIEN au lancement (~200 ms) ; le spécial assombrit.
    const sortId = skill.sort || null; const estSpecial = !!skill.special;
    if (estSpecial) { setAssombriKey((k) => k + 1); vibrer('heavy'); }
    if (sortId) {
      const evts = evenementsSort;
      setTimeout(() => {
        evts.forEach((ev) => { if (ev.type === 'bouclier' || ev.type === 'soin' || ev.type === 'boost') effetSort(ev.type, 'joueur', ev.cible, ev.valeur || null); });
        if (sortId === 'provocation' || sortId === 'vitesse' || sortId === 'pacte') effetSort(sortId, 'joueur', curIdx);
      }, 200);
    }
    // Règle PARTAGÉE avec la simulation qui calibre le Gardien.
    const coupSur = (cible) => (part > 0 && frappe
      ? Math.max(1, Math.round(degatsDuJoueur(frappe, attaquant, cible.creature, multJauge) * part))
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
      // SOUTIEN (09/10) — règle PARTAGÉE avec la simulation : les autres créatures vivantes frappent le Gardien.
      let bossS = { ...bossApres, hp: coup.hp };
      let bouclierS = coup.shield;
      let releveS = false;
      const soutiensBoss = coupsDeSoutien(fightersRef.current, curIdx, cibleActuelle.creature);
      for (const s of soutiensBoss) {
        const m2 = modifierCoup(fightersRef.current[s.i], bossS, s.degats, false);
        fightersRef.current = fightersRef.current.map((x, i) => (i === s.i ? m2.attaquant : x));
        bossS = m2.defenseur;
        const c2 = coupSurGardien({ hp: bossS.hp, shield: bouclierS, phase: bossPhaseRef.current, maxHp }, m2.degats);
        bossS = { ...bossS, hp: c2.hp };
        bouclierS = c2.shield;
        degatsTotaux += m2.degats;
        if (c2.releve) { releveS = true; break; }
      }
      if (soutiensBoss.length) { setFighters(fightersRef.current); planifierSoutiens(soutiensBoss, targetIdx); }
      if (releveS) {
        setBossShield(0);
        startBossPhase2(maxHp);
        return;
      }
      newOpponentHp = bossS.hp;
      setBossShield(bouclierS);
      newOpponents = opponentsRef.current.map((o, i) => (i === targetIdx ? bossS : o));
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
      // SOUTIEN (09/10) — règle PARTAGÉE avec la simulation : les autres créatures vivantes frappent la cible
      // (ou le 1er ennemi vivant), qu'il y ait eu un coup ou un sort.
      const cS = newOpponents[targetIdx] && newOpponents[targetIdx].hp > 0 ? targetIdx : newOpponents.findIndex((o) => o.hp > 0);
      if (cS >= 0) {
        const soutiens = coupsDeSoutien(fightersRef.current, curIdx, newOpponents[cS].creature);
        for (const s of soutiens) {
          if (!(newOpponents[cS].hp > 0)) break;
          const x = frapper(fightersRef.current[s.i], newOpponents[cS], s.degats, false);
          fightersRef.current = fightersRef.current.map((f, i) => (i === s.i ? x.attaquant : f));
          newOpponents[cS] = x.defenseur;
          degatsTotaux += x.degats;
        }
        if (soutiens.length) planifierSoutiens(soutiens, cS);
      }
      setFighters(fightersRef.current);
      newOpponentHp = newOpponents[targetIdx].hp;
    }
    let opponentDamage = 0;
    const retaliatorIdx = choisirRiposteur(newOpponents, targetIdx, riposteRangRef.current);
    if (retaliatorIdx >= 0) riposteRangRef.current = retaliatorIdx + 1;
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
    // Impact (03/10) : chiffres, éclats, étincelles, secousse, vibration À L'INSTANT où
    // l'élan touche (~270 ms), et plus au départ de l'élan ; la riposte 180 ms après.
    const cleCoup = verdictCoup; const cibleCoup = targetIdx; const blesse = tRip >= 0 ? tRip : curIdx;
    // L'ADVERSAIRE RIPOSTE À VUE (03/10, demande de l'auteur : « qu'on voie l'attaque des
    // ennemis ») : son élan part quand le tien est revenu, ses dégâts tombent à SON impact.
    const avecRiposte = opponentDamage > 0 && retaliatorIdx >= 0;
    const elemAttaquant = curFighter.creature.element;
    const elemRiposteur = retaliatorIdx >= 0 && newOpponents[retaliatorIdx] ? newOpponents[retaliatorIdx].creature.element : null;
    setTimeout(() => {
      setVerdictDernierCoup(cleCoup);
      setRoundKey((k) => k + 1);
      setOpponentDamageFloat(playerDamage > 0 ? playerDamage : null);
      setPlayerDamageFloat(!avecRiposte && opponentDamage > 0 ? { amount: opponentDamage, index: blesse } : null);
      degeler('o'); if (!avecRiposte) degeler('p');
      if (playerDamage > 0) effetsImpact('adversaire', cibleCoup, cleCoup, elemAttaquant);
      if (!avecRiposte && opponentDamage > 0) effetsImpact('joueur', blesse, 'riposte', elemRiposteur);
      // Étape 3 : sorts offensifs, onde de la zone (et l'élément sur CHAQUE ennemi touché),
      // spécial, et K.O. des adversaires tombés sous ce coup.
      if (sortId === 'poison' || sortId === 'marque' || sortId === 'execution') effetSort(sortId, 'adversaire', cibleCoup);
      if (sortId === 'zone') {
        newOpponents.forEach((o, i) => { if (i !== cibleCoup && o && pvAvantO[i] > 0 && o.hp < pvAvantO[i]) effetsImpact('adversaire', i, cleCoup, elemAttaquant); });
        effetSort('zone', 'adversaire', cibleCoup);
      }
      if (estSpecial) { effetSort('special', 'adversaire', cibleCoup); secouer(14); }
      newOpponents.forEach((o, i) => { if (o && o.hp <= 0 && pvAvantO[i] > 0) effetSort('ko', 'adversaire', i); });
      if (!avecRiposte) newFighters.forEach((f, i) => { if (f && f.hp <= 0 && pvAvantP[i] > 0) effetSort('ko', 'joueur', i); });
    }, IMPACT_MS);
    if (avecRiposte) {
      setTimeout(() => {
        playLunge('opponent', retaliatorIdx, centreSprite('joueur', blesse));
        setTimeout(() => {
          setVerdictDernierCoup(null);
          setOpponentDamageFloat(null);
          setRoundKey((k) => k + 1);
          setPlayerDamageFloat({ amount: opponentDamage, index: blesse });
          degeler('p');
          effetsImpact('joueur', blesse, 'riposte', elemRiposteur);
          newFighters.forEach((f, i) => { if (f && f.hp <= 0 && pvAvantP[i] > 0) effetSort('ko', 'joueur', i); });
        }, IMPACT_MS);
      }, RIPOSTE_MS);
    }
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

    // ── Suite du combat (03/10) : CALCULÉE ici, APPLIQUÉE après les animations (le coup
    // final et la riposte se VOIENT avant l'écran de fin, demande de l'auteur).
    // ⚠️ Leçon du 01/09 (7e43465) : un minuteur SEUL figeait le combat s'il ne partait pas.
    // Ici : suite mise de côté (transitionRef), appliquée UNE seule fois
    // (appliquerTransition), minuteur posé et nettoyé par un useEffect, ET un toucher
    // la débloque après la durée prévue — jamais figé. Contrôle : auditTransitionCombat.
    const anyOpponentAlive = newOpponents.some((o) => o.hp > 0);
    let transition;
    if (!anyOpponentAlive) transition = { type: 'win' };
    else if (newPlayerHp <= 0) {
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      transition = nextIdx === -1 ? { type: 'lose' } : { type: 'suite', nextIdx, ko: true,
        message: `${newFighters[curIdx].creature.stages[0].name} est K.O. ! ${newFighters[nextIdx].creature.stages[0].name} entre en combat !` };
    } else {
      // Rotation systématique côté joueur, comme avant, à chaque tour.
      const nextIdx = nextLivingIndex(newFighters, curIdx);
      transition = { type: 'suite', nextIdx, ko: false, message: `Au tour de ${newFighters[nextIdx].creature.stages[0].name} !` };
    }
    const duree = (avecRiposte ? RIPOSTE_MS + IMPACT_MS + 520 : IMPACT_MS + 640) + (transition.type === 'suite' ? 0 : FIN_EN_PLUS_MS);
    // Gel de l'affichage : chaque PV qui change garde sa valeur d'AVANT jusqu'à son impact.
    const gel = {};
    newOpponents.forEach((o, i) => { if (o && o.hp !== pvAvantO[i]) gel[`o${i}`] = pvAvantO[i]; });
    newFighters.forEach((f, i) => { if (f && f.hp !== pvAvantP[i]) gel[`p${i}`] = pvAvantP[i]; });
    setPvGeles(gel);
    lancerResolution(transition, duree);
  };

  // ⚔️ RÈGLES DU COMBAT — FIN
  const confirmQuit = () => {
    afficherDialogue('Quitter le combat ?', 'Tu ne gagneras aucune récompense et reviendras à la carte.', [
      { texte: 'Annuler', style: 'annuler' },
      { texte: 'Quitter', style: 'danger', onPress: () => onFinish('quit') },
    ]);
  };

  if (phase === 'done') {
    // L'effet ci-dessus a déjà rendu la main : on n'affiche rien plutôt
    // qu'un récapitulatif qui clignoterait une frame.
    if (skipResultScreen) return null;
    // Le HÉROS du combat (03/10) : la créature qui a infligé le plus de dégâts.
    const dmg = (battleStats && battleStats.perFighterDamage) || {};
    let meilleur = null;
    fighters.forEach((f) => { const v = dmg[f.creature.id] || 0; if (!meilleur || v > meilleur.v) meilleur = { v, f }; });
    const herosFin = meilleur ? (() => {
      const stade = stadeVisuel(meilleur.f.evolutionTier);
      const d = meilleur.f.creature.stages[stade] || meilleur.f.creature.stages[0];
      return { creatureId: meilleur.f.creature.id, stade, emoji: d.emoji, nom: d.name };
    })() : null;
    return (
      <CombatResultScreen
        heros={herosFin}
        outcome={outcome}
        levelNumber={levelNumber}
        battleStats={battleStats}
        opponentCount={opponents.length}
        nbCreatures={(team || []).filter(Boolean).length}
        onContinue={() => onFinish(outcome, false, starsForBattle(battleStats, opponents.length))}
        onNextLevel={() => onFinish(outcome, true, starsForBattle(battleStats, opponents.length))}
        aide={aideDefaite}
        manque={outcome === 'lose' ? manqueExact : 0}
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

  // ── Bandeau de combat : mesures (maquette : bandeau en haut, panneaux ~10,5 % de large) ──
  const uiL = Math.min(H * COMBAT_RAPPORT, W); const uiH = uiL / COMBAT_RAPPORT;
  const largeurBandeau = W - insets.left - insets.right - 8;
  const bandeauH = Math.round(Math.min(uiH * 0.18, largeurBandeau / 11.53));
  const sousBandeau = bandeauH + 6;
  const PW = largeurBandeau * 0.108; const PH = bandeauH * 0.8; const PT = bandeauH * 0.1;
  const panneauCombattant = ({ key, gauche, nom, niveau = null, elite = false, hp, hpMax, mana, actif, cible, ko, badge, onPress }) => (
    <TouchableOpacity key={key} activeOpacity={onPress ? 0.8 : 1} disabled={!onPress} onPress={onPress}
      // Sans action (tes panneaux ; ceux des adversaires hors choix) : AUCUNE capture du toucher
      // (le défi de taps compte partout, bandeau compris).
      style={{ position: 'absolute', left: gauche, top: PT, width: PW, height: PH, opacity: ko ? 0.4 : 1, pointerEvents: onPress ? 'auto' : 'none' }}>
      {(actif || cible) && !ko && (
        <Image source={COMBAT_IMG.lueur} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: -PW * 0.18, top: -PH * 0.3, width: PW * 1.36, height: PH * 1.6, opacity: actif ? 0.9 : 0.55, pointerEvents: 'none' }} />
      )}
      <Image source={COMBAT_IMG.panneau} resizeMethod="scale" resizeMode="stretch" style={styles.pleineImage} />
      <Text style={[styles.panneauNom, { fontSize: Math.max(8, Math.round(PH * 0.2)), marginTop: PH * 0.12, marginHorizontal: PW * 0.08 }]} numberOfLines={1}>{nom}</Text>
      <View style={[styles.panneauVie, { height: Math.max(10, Math.round(PH * 0.24)), marginHorizontal: PW * 0.1 }]}>
        <View style={[styles.panneauVieFond, { width: `${Math.max(0, Math.min(1, hp / hpMax)) * 100}%` }]} />
        <Text style={[styles.panneauVieTexte, { fontSize: Math.max(8, Math.round(PH * 0.18)) }]} numberOfLines={1}>{nombreCourt(hp)} / {nombreCourt(hpMax)}</Text>
      </View>
      {mana != null && (
        <View style={[styles.panneauMana, { height: Math.max(4, Math.round(PH * 0.08)), marginHorizontal: PW * 0.1 }]}>
          <View style={[styles.panneauManaFond, mana >= MANA_MAX && styles.panneauManaPlein, { width: `${Math.max(0, Math.min(1, mana / MANA_MAX)) * 100}%` }]} />
        </View>
      )}
      {/* Niveaux réels (10/10) : le NIVEAU de chaque créature, les tiennes comme les ennemies (⭐ = élite). */}
      {niveau != null && (
        <View style={[styles.panneauNiveau, elite && styles.panneauNiveauElite, { right: -PH * 0.1, top: -PH * 0.16, paddingHorizontal: Math.round(PH * 0.08), borderRadius: Math.round(PH * 0.14) }]}>
          <Text style={[styles.panneauNiveauTexte, { fontSize: Math.max(8, Math.round(PH * 0.17)) }]} numberOfLines={1}>{elite ? '⭐' : ''}Niv. {niveau}</Text>
        </View>
      )}
      {badge && (
        <View style={[styles.panneauBadge, { width: PH * 0.44, height: PH * 0.44, borderRadius: PH * 0.22, left: -PH * 0.18, top: -PH * 0.14, borderColor: badge.couleur }]}>
          <Text style={{ fontSize: Math.round(PH * 0.22), includeFontPadding: false }}>{badge.emoji}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
  // Cartes d'attaque (maquette : ~25,5 % de large) ; étiquette sur la planche de l'aperçu.
  const CW = Math.round(uiL * 0.25); const CH = Math.round(CW / 2.61);

  const renderSprite = ({ sansJauges = false, adversaire = false, key, slot, creatureId, stageIndex, emoji, name, hp, hpMax, mana, manaMax, fainted, ring, onPress, disabled, hpColor, floatDamage, floatVerdict = null, lunging, lungeDir, lungeDx = 0, lungeDy = 0, elemColor , etats = null, etatsCote = 'droite' }) => {
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
            <FloatingDamage key={`${key}-${roundKey}`} amount={floatDamage} color={floatVerdict && STYLE_COUP[floatVerdict] ? STYLE_COUP[floatVerdict].couleur : '#FF5252'} taille={floatVerdict && STYLE_COUP[floatVerdict] ? STYLE_COUP[floatVerdict].taille : null} pop={floatVerdict === 'parfait'} />
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
        {elemColor && !fainted && !sansJauges && (
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
                // Vers la CIBLE (03/10) : dx / dy calculés au départ de l'élan (playLunge).
                { translateX: lungeAnim.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [-lungeDx * 0.15, 0, lungeDx] }) },
                { translateY: lungeAnim.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [-lungeDy * 0.15, 0, lungeDy] }) },
                { scale: lungeAnim.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [0.94, 1, 1.22] }) },
                // Légère bascule vers l'avant, comme un coup d'épaule.
                { rotate: lungeAnim.interpolate({ inputRange: [-0.35, 0, 1], outputRange: [`${-lungeDir * 6}deg`, '0deg', `${lungeDir * 14}deg`] }) },
              ],
            } : null}
          >
            {/* 27/09 (demande de l'auteur) : les ADVERSAIRES regardent vers la
                gauche, vers nos créatures — miroir sur l'IMAGE seule (ni le
                nom ni les PV), à l'intérieur du bond (mouvement inchangé). */}
            <CreatureArt
              creatureId={creatureId}
              stageIndex={stageIndex}
              emoji={emoji}
              size={fs}
              style={adversaire ? MIROIR : null}
              emojiStyle={[{ fontSize: fs, lineHeight: fs + 12 }, adversaire ? MIROIR : null]}
            />
            {/* Éclat blanc de la silhouette, au coup (03/10) — seulement si illustrée (un emoji ne se teinte pas). */}
            {floatDamage != null && hasCreatureArt(creatureId) && (
              <EclatSilhouette key={`${key}-eclat-${roundKey}`} creatureId={creatureId} stageIndex={stageIndex} emoji={emoji} size={fs} style={adversaire ? MIROIR : null} />
            )}
          </Animated.View>
        </View>
        {!sansJauges && <Text style={[styles.spriteName, { fontSize: Math.max(9, Math.round(12 * slot.size)) }]} numberOfLines={1}>{name}</Text>}
        {/* Barre de PV + ligne d'états (bonus / malus) à DROITE pour nos
            créatures, à GAUCHE pour les adversaires — demande de l'auteur
            (24/09) ; emojis en attendant ses logos. En absolu : ne décale
            rien dans la mise en page. */}
        {sansJauges ? (
          etats && etats.length > 0 && (
            <Text style={[styles.spriteEtats, styles.spriteEtatsSeul]} numberOfLines={1}>{etats.map((e) => e.icone + e.texte).join(' ')}</Text>
          )
        ) : (
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
        )}
        {mana != null && !sansJauges && (
          <View style={[styles.spriteEndTrack, { width: Math.round(90 * slot.size) }]}>
            <View style={[styles.spriteEndFill, mana >= manaMax && styles.spriteEndFull, { width: `${Math.max(0, Math.min(1, mana / manaMax)) * 100}%` }]} />
          </View>
        )}

      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.screen, { marginTop: -insets.top, transform: [{ translateX: secousse }] }]}>
      <StatusBar hidden />
      {elixirActif && (
        <View style={[styles.elixirBadge, { top: sousBandeau + 6, left: 10 + insets.left + 52, pointerEvents: 'none' }]}>
          <Text style={styles.elixirBadgeText}>🧪 Élixir : ennemis −10 %</Text>
        </View>
      )}
      {filetBaisse > 0 && (
        <View style={[styles.elixirBadge, styles.filetBadge, { top: sousBandeau + 6 + (elixirActif ? 28 : 0), left: 10 + insets.left + 52, pointerEvents: 'none' }]}>
          <Text style={styles.elixirBadgeText}>🛟 Coup de pouce : ennemis −{Math.round(filetBaisse * 100)} %</Text>
        </View>
      )}

      {/* Niveaux réels (10/10) : étape de boss (+3 niveaux) et/ou élites (niveaux en plus), DITS au joueur. */}
      {!isBoss && (estEtapeBoss(levelNumber) || bonusElite(levelNumber) > 0) && (
        <View style={[styles.elixirBadge, styles.niveauxBadge, { top: sousBandeau + 6 + (elixirActif ? 28 : 0) + (filetBaisse > 0 ? 28 : 0), left: 10 + insets.left + 52, pointerEvents: 'none' }]}>
          <Text style={styles.elixirBadgeText}>
            {(estEtapeBoss(levelNumber) ? '👑 Boss' : '') + (estEtapeBoss(levelNumber) && bonusElite(levelNumber) > 0 ? ' · ' : '') + (bonusElite(levelNumber) > 0 ? '⭐ Élites' : '')
              + (bonusBoss(levelNumber) + bonusElite(levelNumber) > 0 ? ' : ennemis +' + (bonusBoss(levelNumber) + bonusElite(levelNumber)) + ' niveaux' : ' de chapitre')}
          </Text>
        </View>
      )}

      {/* Décor de combat. Voile sombre par-dessus : le décor est très
          détaillé/lumineux, sans ça les sprites et les barres de vie s'y
          perdent visuellement. */}
      <ImageBackground source={BG_IMG} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={styles.bgDim} />
      </ImageBackground>

      {/* « ✕ » au style des médaillons (confirmation déjà en place : confirmQuit), sous le bandeau. */}
      <TouchableOpacity style={[styles.closeBtn, { top: sousBandeau, left: 10 + insets.left }]} onPress={confirmQuit}>
        <Image source={COMBAT_IMG.medaillon} resizeMethod="scale" resizeMode="stretch" style={styles.pleineImage} />
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Équipe du joueur — 3 sprites sur le terrain, l'actif devant. */}
      {playerOrder.map((fi, slotIdx) => {
        const f = fighters[fi];
        const d = f.creature.stages[stadeVisuel(f.evolutionTier)];
        return renderSprite({
          key: `p${fi}`, slot: PLAYER_SLOTS[slotIdx], sansJauges: true,
          creatureId: f.creature.id, stageIndex: stadeVisuel(f.evolutionTier),
          emoji: d.emoji, name: d.name,
          hp: pvAffiche('p', fi, f.hp), hpMax: f.stats.hp,
          // Jauge visible pour TOUS : le joueur doit voir laquelle de
          // ses créatures approche de son ultime, pas seulement celle
          // qui joue.
          mana: f.mana, manaMax: MANA_MAX,
          etats: iconesEtats(f), etatsCote: 'droite',
          fainted: pvAffiche('p', fi, f.hp) <= 0, ring: fi === activeIndex ? 'active' : null, disabled: true, hpColor: COLORS.good,
          lunging: !!lunge && lunge.side === 'player' && fi === lunge.index, lungeDir: 1,
          lungeDx: lunge && lunge.side === 'player' && fi === lunge.index ? lunge.dx : 0, lungeDy: lunge && lunge.side === 'player' && fi === lunge.index ? lunge.dy : 0,
          floatDamage: playerDamageFloat && playerDamageFloat.index === fi ? playerDamageFloat.amount : null,
        });
      })}

      {/* BOSS : barre de vie pleine largeur tout en haut, bouclier juste
          en dessous. Posée en absolu au-dessus du terrain pour occuper
          vraiment toute la largeur, indépendamment de la mise en page
          du combat. */}
      {isBoss && opponents[0] && (
        <View style={[styles.bossBarWrap, { top: bandeauH + 2, paddingLeft: insets.left + 10, paddingRight: insets.right + 10 }]}>
          <View style={styles.bossBarHeader}>
            <Text style={styles.bossBarName}>🐯 GARDIEN</Text>
            <Text style={styles.bossBarPhase}>Manche {bossPhase}/2</Text>
          </View>
          <View style={styles.bossHpTrack}>
            <View style={[styles.bossHpFill, { width: `${Math.max(0, (pvAffiche('o', 0, opponents[0].hp) / opponents[0].stats.hp) * 100)}%` }]} />
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
        const d = o.creature.stages[stadeVisuel(o.evolutionTier || 0)] || o.creature.stages[0]; // ennemi évolué : sa forme évoluée (10/10)
        const fainted = pvAffiche('o', i, o.hp) <= 0;
        return renderSprite({
          key: `o${i}`, sansJauges: true,
          // Le boss est plus imposant : emplacement recentré et agrandi
          // de 70 %, pour qu'il pèse à l'écran au lieu de ressembler à
          // une créature ordinaire.
          slot: isBoss ? { x: 0.72, y: 0.53, size: 1.7 } : OPPONENT_SLOTS[i],
          creatureId: o.creature.id, stageIndex: stadeVisuel(o.evolutionTier || 0),
          emoji: d.emoji, name: d.name,
          hp: pvAffiche('o', i, o.hp), hpMax: o.stats.hp, fainted,
          etats: iconesEtats(o), etatsCote: 'gauche',
          ring: i === targetIndex && !fainted ? 'target' : null,
          // Vert = ton élément domine le sien, orange = neutre, rouge =
          // tu es en position défavorable.
          elemColor: ELEM_COLORS[elementRelation(activeFighter.creature.element, o.creature.element)],
          // L'adversaire actif est celui du slot de devant : c'est lui
          // qui riposte. Il s'élance vers la GAUCHE (-1).
          lunging: !!lunge && lunge.side === 'opponent' && i === lunge.index, lungeDir: -1, adversaire: true,
          lungeDx: lunge && lunge.side === 'opponent' && i === lunge.index ? lunge.dx : 0, lungeDy: lunge && lunge.side === 'opponent' && i === lunge.index ? lunge.dy : 0,
          onPress: () => chooseTarget(i), disabled: fainted || phase !== 'choosing', hpColor: '#FF5252',
          floatDamage: i === targetIndex ? opponentDamageFloat : null, floatVerdict: verdictDernierCoup,
        });
      })}

      {/* Étincelles d'impact (03/10) : au-dessus des créatures, TRANSPARENTES au toucher. */}
      <View style={styles.coucheImpacts}>
        {impacts.map((im) => (
          im.sort
            ? <EffetSort key={im.id} type={im.sort} x={im.x} y={im.y} taille={im.taille} valeur={im.valeur} onFini={() => setImpacts((l) => l.filter((x) => x.id !== im.id))} />
            : <Impact key={im.id} x={im.x} y={im.y} couleur={im.couleur} etincelles={im.etincelles} effet={im.effet} taille={im.taille} grand={im.grand} onFini={() => setImpacts((l) => l.filter((x) => x.id !== im.id))} />
        ))}
      </View>

      {eclairKey > 0 && <EclairEcran key={`eclair-${eclairKey}`} />}
      {assombriKey > 0 && <AssombrirEcran key={`sombre-${assombriKey}`} />}

      {/* ── Bandeau de combat (03/10) : tes créatures à gauche, le tour au centre, les adversaires
          à droite. Toucher un panneau adversaire le vise (comme le toucher sur le terrain). */}
      {/* Pendant le défi de taps, le bandeau laisse passer le toucher (tout l'écran compte). */}
      <View style={[styles.bandeau, { left: insets.left + 4, top: 2, width: largeurBandeau, height: bandeauH, pointerEvents: phase === 'tapping' ? 'none' : 'box-none' }]}>
        <Image source={COMBAT_IMG.bandeau} resizeMethod="scale" resizeMode="stretch" style={styles.pleineImage} />
        {fighters.map((f, fi) => {
          const d = f.creature.stages[stadeVisuel(f.evolutionTier)];
          return panneauCombattant({ key: `bp${fi}`, gauche: largeurBandeau * (0.035 + fi * 0.118), nom: d.name, niveau: f.ownedLevel, hp: pvAffiche('p', fi, f.hp), hpMax: f.stats.hp, mana: f.mana, actif: fi === activeIndex, ko: pvAffiche('p', fi, f.hp) <= 0 });
        })}
        <View style={[styles.bandeauMessage, { left: largeurBandeau * 0.395, width: largeurBandeau * 0.21, height: bandeauH }]}>
          <Text style={[styles.bandeauMessageTexte, { fontSize: Math.max(10, Math.round(bandeauH * 0.22)) }]} numberOfLines={2}>
            {switchMessage || `Au tour de ${activeFighter.creature.stages[stadeVisuel(activeFighter.evolutionTier)].name} !`}
          </Text>
        </View>
        {!isBoss && opponents.map((o, i) => {
          const d = o.creature.stages[stadeVisuel(o.evolutionTier || 0)] || o.creature.stages[0]; const ko = pvAffiche('o', i, o.hp) <= 0;
          return panneauCombattant({
            key: `bo${i}`, gauche: largeurBandeau * (0.635 + i * 0.118), nom: d.name, niveau: o.niveau, elite: bonusElite(levelNumber) > 0, hp: pvAffiche('o', i, o.hp), hpMax: o.stats.hp, mana: null, cible: i === targetIndex, ko,
            badge: { emoji: ELEMENT_EMOJI[o.creature.element] || '✨', couleur: ELEM_COLORS[elementRelation(activeFighter.creature.element, o.creature.element)] || '#ffb340' },
            onPress: !ko && phase === 'choosing' ? () => chooseTarget(i) : null,
          });
        })}
      </View>

      {/* Couche centrale : défi de tap / bannière de tour uniquement —
          plus de bouton "Continuer" après une attaque du joueur (demande
          explicite), la transition est immédiate. */}
      <View style={styles.centerLayer}>
        {/* Message de tour : désormais au centre du BANDEAU (03/10). */}
        {/* ⚠️ Défi de taps (03/10) : l'anneau, son titre et son chrono sont TRANSPARENTS au toucher.
            Au plan 10, au-dessus de la zone qui compte (tapEverywhere, plan 8), ils AVALAIENT
            les taps posés au centre de l'écran, là où l'on tape (même famille que les « +X »
            du 27/09). Contrôle auditDefiTapsLibre. */}
        {phase === 'tapping' && (
          <View style={{ alignItems: 'center', pointerEvents: 'none' }}>
            <Text style={styles.chosenSkillLabel}>{selectedSkill?.name}</Text>
            <JaugeFrappe jauge={jauge} largeur={Math.round(Math.min(W * 0.55, 440))} />
            <Text style={styles.jaugeConsigne}>Touche quand l'aiguille est dans l'or !</Text>
          </View>
        )}
        {verdict && (
          <View style={{ pointerEvents: 'none' }}>
            <Text style={[styles.verdict, styles[`verdict_${verdict}`]]}>
              {verdict === 'parfait' ? 'PARFAIT !' : verdict === 'bien' ? 'BIEN' : verdict === 'rate' ? 'RATÉ' : 'TROP TARD'}
              {/* 10/10 (règle de l'auteur) : la part du coup — ou de l'effet du sort — obtenue par ce tap. */}
              {` · ${Math.round(100 * (selectedSkill && selectedSkill.sort ? multiplicateurSort(verdict) : multiplicateurJauge(verdict)))} %`}
            </Text>
          </View>
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
            {skillInfo.sort ? `${SORTS[skillInfo.sort].desc} · ${skillInfo.manaCost} mana` : `${nombreCourt(degatsAffiches(skillInfo))} dégâts`}.
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
        <View
          // Début du toucher (onResponderGrant), pas le relâchement : le verdict de la
          // jauge se joue à quelques centièmes (leçon des taps de l'œuf, 03/10).
          style={styles.tapEverywhere}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleTap}
        />
      )}
      {/* Résolution (03/10) : un toucher DÉBLOQUE la suite après la durée prévue — filet si
          le minuteur ne partait pas (leçon du 01/09) ; ignoré pendant l'animation (on ne
          saute pas l'attaque par accident). */}
      {phase === 'resolving' && (
        <View
          style={styles.tapEverywhere}
          onStartShouldSetResponder={() => true}
          onResponderGrant={() => { if (Date.now() - debutResolutionRef.current >= resolutionDureeRef.current) appliquerTransition(); }}
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
          {/* (06/10) La ligne de DIAGNOSTIC du 12/09 (« Tu as infligé X · reçu Y ») est retirée :
              un reste de développement, « à retirer une fois la cause trouvée ». */}
          <View style={styles.bottomBar}>
            {competencesAvecSort(activeFighter.creature)
              // Le spécial reste INVISIBLE tant que la jauge n'est pas
              // pleine : afficher un bouton grisé qu'on ne peut pas
              // utiliser encombre l'écran sans rien apprendre.
              .filter((sk) => !sk.special || activeFighter.mana >= MANA_MAX)
              // Ordre de la maquette : NORMAL d'abord, puis SORT, puis SPÉCIAL.
              .sort((a, b) => (a.special ? 2 : a.sort ? 1 : 0) - (b.special ? 2 : b.sort ? 1 : 0))
              .map((skill, idx, arr) => {
              const cost = skill.manaCost || 0;
              // Le spécial exige la jauge PLEINE, pas seulement son coût.
              const canAfford = skill.special
                ? activeFighter.mana >= MANA_MAX
                : activeFighter.mana >= cost;
              return (
                // Carte d'attaque (03/10) : bois si jouable, pierre grise si le mana manque.
                <TouchableOpacity
                  key={skill.id}
                  style={[styles.carteAttaque, { width: CW, height: CH, marginTop: CH * 0.2 }]}
                  activeOpacity={0.85}
                  onPress={() => { setSkillInfo({ ...skill, fromRight: arr.length - 1 - idx }); chooseSkill(skill, false); }}
                  disabled={!canAfford}
                >
                  {armedSkill && armedSkill.id === skill.id && (
                    <Image source={COMBAT_IMG.lueur} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: -CW * 0.08, top: -CH * 0.25, width: CW * 1.16, height: CH * 1.5, pointerEvents: 'none' }} />
                  )}
                  <Image source={canAfford ? COMBAT_IMG.carteBois : COMBAT_IMG.cartePierre} resizeMethod="scale" resizeMode="stretch" style={styles.pleineImage} />
                  {/* Étiquette sur la petite planche de l'aperçu, à cheval sur le haut de la carte. */}
                  <View style={[styles.carteEtiquette, { left: CW * 0.29, width: CW * 0.42, top: -CH * 0.2, height: CH * 0.3 }]}>
                    <Image source={COMBAT_IMG.planche} resizeMethod="scale" resizeMode="stretch" style={styles.pleineImage} />
                    <Text style={[styles.carteEtiquetteTexte, { fontSize: Math.max(8, Math.round(CH * 0.13)) }, !canAfford && styles.carteTexteEteint]} numberOfLines={1}>
                      {skill.special ? 'SPÉCIAL' : skill.sort ? 'SORT' : 'NORMAL'}
                    </Text>
                  </View>
                  <View style={[styles.carteContenu, { paddingHorizontal: CW * 0.07, paddingTop: CH * 0.1 }]}>
                    <Text style={[styles.carteIcone, { fontSize: Math.round(CH * 0.36) }, !canAfford && { opacity: 0.45 }]}>{skill.sort ? skill.icone : skill.special ? '🌟' : '⚔️'}</Text>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={[styles.carteNom, { fontSize: Math.max(9, Math.round(CH * 0.2)) }, !canAfford && styles.carteTexteEteint]} numberOfLines={1}>{skill.name}</Text>
                      {/* Dégâts calculés par la FONCTION du coup (degatsAffiches) : affichage et dégâts ne divergent pas. */}
                      <Text style={[styles.carteDetail, { fontSize: Math.max(8, Math.round(CH * 0.16)) }, !canAfford && styles.carteTexteEteint]} numberOfLines={1}>
                        {skill.sort ? SORTS[skill.sort].desc : `${nombreCourt(degatsAffiches(skill))} dégâts`}
                      </Text>
                      {skill.sort && <Text style={[styles.carteCout, { fontSize: Math.max(8, Math.round(CH * 0.14)) }, !canAfford && styles.carteTexteEteint]} numberOfLines={1}>{skill.manaCost} mana</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={{ width: Math.round(CH * 0.95 * 1.06), height: Math.round(CH * 0.95) }} onPress={rechargeEndurance} activeOpacity={0.85}>
              <Image source={COMBAT_IMG.recharge} resizeMethod="scale" resizeMode="stretch" style={styles.pleineImage} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
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

// ════════════════════════════════════════════════════════════════════
//  FIN DE COMBAT « Le médaillon du héros » (03/10, concept A choisi par l'auteur)
// ════════════════════════════════════════════════════════════════════
// Maquettes : design/a-integrer/08-fin-de-combat/concepts (victoire, défaite).
// Mesures en fractions de la HAUTEUR (u), colonne CENTRÉE : l'écran (≈ 2,17:1) est
// plus large que la maquette (16:9) — les côtés ne montrent que la prairie.
// Logique INCHANGÉE : actions, conditions des aides, verrou anti-toucher accidentel.
const FIN_IMG = {
  etoile: require('../../../assets/combat/fin/etoile.png'),
  lauriers: require('../../../assets/combat/fin/lauriers.png'),
  boutonBois: require('../../../assets/combat/fin/bouton-bois.png'),
  boutonDore: require('../../../assets/exploration/bouton-combattre-vierge.png'),
  // 05/10 (l'auteur : « plus coloré ») : la face dorée ravivée, pour la VICTOIRE ; le bois de
  // l'emblème garde son brun. La défaite garde le bouton maison.
  boutonDoreVif: require('../../../assets/combat/fin/bouton-dore-vif.png'),
  // 05/10 (l'auteur : « plus joyeux, qui donne envie de gagner » ; l'ancien = la carte en
  // automne) : vallée de printemps en fête (Gemini). La défaite garde son crépuscule.
  fondVictoire: require('../../../assets/combat/fin/fond-victoire.jpg'),
};
const FIN_RAPPORT = { etoile: 314 / 300, lauriers: 708 / 640, boutonDore: 1144 / 296 };
const FIN_V = {
  titre: { w: 0.62, h: 0.13, y: 0.035, police: 0.066 },
  etoiles: [{ dx: -0.118, y: 0.262, t: 0.105 }, { dx: 0, y: 0.212, t: 0.12 }, { dx: 0.118, y: 0.262, t: 0.105 }],
  medaillon: { y: 0.415, t: 0.235 },
  lauriers: { h: 0.32 },
  etiquette: { w: 0.36, h: 0.062, y: 0.523, police: 0.027 },
  centre: { w: 0.36, h: 0.072, y: 0.598, police: 0.032, lignes: 1 },
  recap: { w: 0.19, h: 0.115, y: 0.684, ecart: 0.205, chiffre: 0.05, legende: 0.025 },
  aides: null,
  bouton: { w: 0.56, y: 0.828, police: 0.034, lignes: 1 },
};
const FIN_D = {
  titre: { w: 0.56, h: 0.118, y: 0.022, police: 0.06 },
  etoiles: [{ dx: -0.104, y: 0.212, t: 0.088 }, { dx: 0, y: 0.178, t: 0.1 }, { dx: 0.104, y: 0.212, t: 0.088 }],
  medaillon: { y: 0.352, t: 0.19 },
  lauriers: { h: 0.262 },
  etiquette: { w: 0.36, h: 0.055, y: 0.436, police: 0.025 },
  centre: { w: 0.68, h: 0.1, y: 0.5, police: 0.028, lignes: 3 },
  recap: { w: 0.2, h: 0.088, y: 0.608, ecart: 0.215, chiffre: 0.04, legende: 0.021 },
  aides: { w: 0.3, h: 0.09, y: 0.706, ecart: 0.32, police: 0.021 },
  bouton: { w: 0.58, y: 0.818, police: 0.032, lignes: 2 },
};
const FIN_RETOUR = { w: 0.31, h: 0.085, y: 0.878, marge: 0.045, police: 0.03 };
const FIN_OMBRE = { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } };

// Une pièce (image étirée) avec un texte centré DEDANS. Règles du projet : textAlign ET
// alignSelf explicites ; la marge sur le TEXTE, jamais sur le cadre d'une image absolue.
function PieceTexte({ source, x, y, w, h, texte, police, couleur = '#fbe9c4', lignes = 1, marge = 0.12 }) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: w, height: h, justifyContent: 'center', pointerEvents: 'none' }}>
      <Image source={source} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />
      <Text numberOfLines={lignes} adjustsFontSizeToFit minimumFontScale={0.55}
        style={[{ textAlign: 'center', alignSelf: 'stretch', marginHorizontal: w * marge, color: couleur, fontSize: police, fontWeight: '900', includeFontPadding: false }, FIN_OMBRE]}>
        {texte}
      </Text>
    </View>
  );
}
// Un bouton de la fin de combat : la pièce, le texte, le verrou anti-toucher accidentel.
function BoutonFin({ source, x, y, w, h, texte, police, couleur = '#fbe9c4', dore = false, lignes = 1, onPress, disabled }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={disabled}
      style={{ position: 'absolute', left: x, top: y, width: w, height: h, justifyContent: 'center', opacity: disabled ? 0.55 : 1 }}>
      <Image source={source} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />
      {/* Bouton DORÉ : l'emblème des épées occupe le quart gauche — le texte vit entre 25 et
          85 % de la largeur, comme « COMBATTRE » dans l'aperçu de niveau. */}
      <View style={{ position: 'absolute', left: dore ? w * 0.25 : w * 0.08, right: dore ? w * 0.15 : w * 0.08, top: 0, bottom: 0, justifyContent: 'center', pointerEvents: 'none' }}>
        <Text numberOfLines={lignes} adjustsFontSizeToFit minimumFontScale={0.7}
          style={[{ textAlign: 'center', alignSelf: 'stretch', color: couleur, fontSize: police, fontWeight: '900', includeFontPadding: false },
            dore ? { letterSpacing: 1 } : FIN_OMBRE]}>
          {texte}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
// Une plaque du récapitulatif : le chiffre, puis sa légende.
function RecapPlaque({ x, y, w, h, valeur, legende, couleur, chiffre, police }) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: w, height: h, justifyContent: 'center', pointerEvents: 'none' }}>
      <Image source={FIN_IMG.boutonBois} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={[{ textAlign: 'center', alignSelf: 'stretch', color: couleur, fontSize: chiffre, fontWeight: '900', includeFontPadding: false }, FIN_OMBRE]}>{valeur}</Text>
      <Text numberOfLines={1} style={[{ textAlign: 'center', alignSelf: 'stretch', color: '#fbe9c4', fontSize: police, fontWeight: '800', includeFontPadding: false }, FIN_OMBRE]}>{legende}</Text>
    </View>
  );
}
// Une étoile : gagnée, elle JAILLIT (l'une après l'autre) ; sinon, éteinte (grise).
function EtoileFin({ cx, cy, t, gagnee, delai, onPop = null }) {
  const a = useRef(new Animated.Value(gagnee ? 0 : 1)).current;
  const lueur = useRef(new Animated.Value(0)).current;
  const scint = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!gagnee) return undefined;
    Animated.sequence([Animated.delay(delai), Animated.spring(a, { toValue: 1, friction: 4, tension: 120, useNativeDriver: ND })]).start();
    // 05/10 (l'auteur : « plus jaunes et qui brillent ») : une lueur qui PULSE derrière, et un
    // SCINTILLEMENT ✦ qui passe d'une étoile à l'autre (décalé par `delai`).
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(lueur, { toValue: 1, duration: 850, useNativeDriver: ND }),
      Animated.timing(lueur, { toValue: 0.45, duration: 850, useNativeDriver: ND }),
    ]));
    const eclat = Animated.loop(Animated.sequence([
      Animated.delay(900 + delai),
      Animated.timing(scint, { toValue: 1, duration: 200, useNativeDriver: ND }),
      Animated.timing(scint, { toValue: 0, duration: 280, useNativeDriver: ND }),
      Animated.delay(1400),
    ]));
    const id = setTimeout(() => { pulse.start(); eclat.start(); }, delai + 250);
    const idSon = setTimeout(() => { if (onPop) onPop(); }, delai + 60);
    return () => { clearTimeout(id); clearTimeout(idSon); pulse.stop(); eclat.stop(); };
  }, []);
  const w = t * FIN_RAPPORT.etoile;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}>
      {gagnee && (
        <Animated.Image source={COMBAT_IMG.lueur} resizeMethod="scale" resizeMode="stretch"
          style={{ position: 'absolute', left: cx - t * 1.35, top: cy - t * 1.35, width: t * 2.7, height: t * 2.7, opacity: lueur }} />
      )}
      <Animated.Image source={FIN_IMG.etoile} resizeMethod="scale" resizeMode="stretch"
        style={[{ position: 'absolute', left: cx - w / 2, top: cy - t / 2, width: w, height: t, transform: [{ scale: a }] },
          !gagnee && { tintColor: '#2b3038', opacity: 0.92 }]} />
      {gagnee && (
        <Animated.Text style={[styles.finScintille, { left: cx + w * 0.12, top: cy - t * 0.72, fontSize: Math.round(t * 0.45), opacity: scint,
          transform: [{ scale: scint.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.2] }) }, { rotate: '15deg' }] }]}>✦</Animated.Text>
      )}
    </View>
  );
}
// Le médaillon du héros : couronne de lauriers, anneau doré, la créature zoomée sur sa zone
// dessinée et découpée en rond (MÊME géométrie que l'aperçu de niveau : 76 %, cadrage) ;
// lueur dorée en victoire, médaillon TERNI en défaite.
// Confettis de la VICTOIRE (05/10, « plus coloré, les joueurs aiment ça ») : une pluie
// multicolore, une seule fois, TRANSPARENTE au toucher (couche et chaque pièce).
const CONFETTI_COULEURS = ['#ff4d6d', '#ffd23f', '#3ec1d3', '#7bd389', '#b388ff', '#ff9f1c', '#ffffff'];
function Confettis({ W, H, nombre = 46 }) {
  const pieces = useRef(Array.from({ length: nombre }, (_, i) => ({
    x: Math.random() * W, couleur: CONFETTI_COULEURS[i % CONFETTI_COULEURS.length],
    duree: 3200 + Math.random() * 1800, delai: Math.random() * 900,
    tour: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540), derive: (Math.random() - 0.5) * 80,
    w: 6 + Math.random() * 5, h: 10 + Math.random() * 6, anim: new Animated.Value(0),
  }))).current;
  useEffect(() => {
    const a = Animated.parallel(pieces.map((p) => Animated.sequence([
      Animated.delay(p.delai),
      Animated.timing(p.anim, { toValue: 1, duration: p.duree, easing: Easing.linear, useNativeDriver: ND }),
    ])));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <View style={styles.coucheConfettis}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: p.x, top: -20, width: p.w, height: p.h, borderRadius: 2, backgroundColor: p.couleur, pointerEvents: 'none',
          opacity: p.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, H + 40] }) },
            { translateX: p.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.derive, p.derive * 0.4] }) },
            { rotate: p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.tour}deg`] }) }] }} />
      ))}
    </View>
  );
}

function MedaillonHeros({ cx, cy, t, heros, terne, lauriersH }) {
  const ri = t * 0.76;
  // 05/10 (« plus coloré ») : soleil de RAYONS dorés qui tourne lentement derrière (victoire).
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (terne) return undefined;
    const l = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: ND }));
    l.start();
    return () => l.stop();
  }, [terne]);
  const cad = heros && heros.creatureId ? (CADRAGE_CREATURES[heros.creatureId] || {})[heros.stade] : null;
  let art = null;
  if (cad) {
    const cote = ri * 0.82;
    const T = Math.min(cote / (cad[2] - cad[0]), cote / (cad[3] - cad[1]));
    art = (
      <View style={{ position: 'absolute', left: ri / 2 - ((cad[0] + cad[2]) / 2) * T, top: ri / 2 - ((cad[1] + cad[3]) / 2) * T }}>
        <CreatureArt creatureId={heros.creatureId} stageIndex={heros.stade} emoji={heros.emoji} size={Math.round(T)} />
      </View>
    );
  } else if (heros) {
    art = <Text style={{ fontSize: Math.round(ri * 0.55), includeFontPadding: false }}>{heros.emoji}</Text>;
  }
  const lw = lauriersH * FIN_RAPPORT.lauriers;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}>
      {!terne && (
        <Animated.Image source={EFFET_ELEMENT['Lumière']} resizeMethod="scale" resizeMode="contain"
          style={{ position: 'absolute', left: cx - t * 1.75, top: cy - t * 1.75, width: t * 3.5, height: t * 3.5, opacity: 0.85,
            transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} />
      )}
      {!terne && <Image source={COMBAT_IMG.lueur} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: cx - t * 1.15, top: cy - t * 1.15, width: t * 2.3, height: t * 2.3, opacity: 0.7 }} />}
      <Image source={FIN_IMG.lauriers} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: cx - lw / 2, top: cy - lauriersH * 0.47, width: lw, height: lauriersH, opacity: terne ? 0.55 : 1 }} />
      <Image source={COMBAT_IMG.medaillon} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: cx - t / 2, top: cy - t / 2, width: t, height: t }} />
      <View style={{ position: 'absolute', left: cx - ri / 2, top: cy - ri / 2, width: ri, height: ri, borderRadius: ri / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {art}
      </View>
      {terne && <View style={{ position: 'absolute', left: cx - t / 2, top: cy - t / 2, width: t, height: t, borderRadius: t / 2, backgroundColor: 'rgba(12,18,32,0.42)' }} />}
    </View>
  );
}

function CombatResultScreen({ outcome, levelNumber, battleStats, opponentCount, onContinue, onNextLevel, aide = null, manque = 0, presque = false, premiereVictoire = true, nbCreatures = 3, heros = null }) {
  const isWin = outcome === 'win';
  const { sons: sonsFin } = useSettings();
  // Victoire ou défaite (07/10) : le jingle à l'arrivée de l'écran ; chaque étoile tinte en apparaissant.
  useEffect(() => { jouerSon(isWin ? 'victoire' : 'defaite', sonsFin !== false); }, []);
  const [btnsArmed, setBtnsArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setBtnsArmed(true), RESULT_BTN_GUARD_MS);
    return () => clearTimeout(id);
  }, []);
  const stars = isWin ? starsForBattle(battleStats, opponentCount) : 0;
  const reward = isWin ? griffesReward(levelNumber) : 0;
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const u = H; const cx = W / 2;
  const L = isWin ? FIN_V : FIN_D;
  const avecAides = !isWin && !!aide;
  // Au centre : la récompense (victoire) ou le diagnostic (défaite).
  let centre;
  if (isWin) centre = premiereVictoire ? `+${reward} 🐾 Griffes` : 'Niveau déjà gagné : pas de Griffes';
  else if (!aide) centre = "Rien n'est perdu.";
  else {
    const lignes = [];
    if (presque) lignes.push('🔥 Tu y étais presque !');
    lignes.push(manque == null
      ? 'Analyse de ton combat…'
      : manque > 0
        ? `Il te manquait environ ${manque} niveau${manque > 1 ? 'x' : ''}.`
        : 'Ta puissance était suffisante : pas de chance cette fois, retente !');
    // 26/09 (test de l'auteur) : une créature seule face à 2 ou 3 ennemis perd presque
    // toujours (MESURÉ : 0 % au niveau 11) — le calibrage suppose les œufs éclos. On le DIT.
    if (nbCreatures > 0 && nbCreatures < opponentCount) lignes.push(`🥚 ${nbCreatures} créature${nbCreatures > 1 ? 's' : ''} contre ${opponentCount} adversaires : fais éclore ton prochain œuf.`);
    centre = lignes.join('\n');
  }
  // Les aides de la défaite (Aventure), chacune À SA CONDITION, comme avant.
  const aides = !avecAides ? [] : [
    aide.onPackGriffes && { cle: 'pack', texte: `Pack de Griffes\n💎 ${aide.coutPack}`, onPress: aide.onPackGriffes },
    aide.onElixir && { cle: 'elixir', texte: `Élixir de faiblesse\n💎 ${aide.coutElixir}`, onPress: aide.onElixir },
    aide.onVideoEnergie && aide.adsLeft > 0 && { cle: 'video', texte: '+1 énergie\n📺 vidéo', onPress: aide.onVideoEnergie },
  ].filter(Boolean);
  const principal = isWin
    ? { texte: 'NIVEAU SUIVANT', onPress: onNextLevel }
    : avecAides
      ? { texte: 'MONTER\nMES CRÉATURES', onPress: () => { onContinue(); if (aide.onMonter) aide.onMonter(); } }
      : { texte: 'RETOUR À LA CARTE', onPress: onContinue };
  const r = (o) => ({ x: cx - (o.w * u) / 2, y: o.y * u, w: o.w * u, h: o.h * u });
  return (
    <ImageBackground source={isWin ? FIN_IMG.fondVictoire : VICTORY_BG} style={styles.screen} resizeMode="cover" resizeMethod="scale">
      {/* Voile : AUCUN en victoire (05/10, « plus coloré »), sombre et froid en défaite. */}
      {!isWin && <View style={[styles.resultDim, styles.resultDimLose]} />}
      <PieceTexte source={COMBAT_IMG.planche} {...r(L.titre)} texte={isWin ? 'VICTOIRE !' : 'DÉFAITE'} police={L.titre.police * u} couleur={isWin ? '#ffe14d' : '#dfe8f5'} />
      <MedaillonHeros cx={cx} cy={L.medaillon.y * u} t={L.medaillon.t * u} heros={heros} terne={!isWin} lauriersH={L.lauriers.h * u} />
      {L.etoiles.map((e, i) => (
        <EtoileFin key={i} cx={cx + e.dx * u} cy={e.y * u} t={e.t * u} gagnee={i < stars} delai={300 + i * 220} onPop={() => jouerSon('etoile', sonsFin !== false)} />
      ))}
      <PieceTexte source={COMBAT_IMG.planche} {...r(L.etiquette)} texte={isWin ? 'Héros du combat' : 'Meilleure créature'} police={L.etiquette.police * u} />
      <PieceTexte source={COMBAT_IMG.planche} {...r(L.centre)} texte={centre} police={L.centre.police * u} lignes={L.centre.lignes} marge={0.09} couleur={isWin ? '#ffe680' : '#fbe9c4'} />
      {[['Infligés', battleStats.totalDamageDealt, isWin ? '#ffd23f' : '#ffe9a8'], ['Reçus', battleStats.totalDamageTaken, isWin ? '#ff6b8b' : '#ff8a7a'], ['Tours', battleStats.rounds, isWin ? '#6fd3ff' : '#ffe9a8']].map(([leg, val, coul], i) => (
        <RecapPlaque key={leg} x={cx + (i - 1) * L.recap.ecart * u - (L.recap.w * u) / 2} y={L.recap.y * u} w={L.recap.w * u} h={L.recap.h * u}
          valeur={val} legende={leg} couleur={coul} chiffre={L.recap.chiffre * u} police={L.recap.legende * u} />
      ))}
      {L.aides && aides.map((a, i) => (
        <BoutonFin key={a.cle} source={FIN_IMG.boutonBois} x={cx + (i - (aides.length - 1) / 2) * L.aides.ecart * u - (L.aides.w * u) / 2} y={L.aides.y * u}
          w={L.aides.w * u} h={L.aides.h * u} texte={a.texte} police={L.aides.police * u} lignes={2} onPress={a.onPress} disabled={!btnsArmed} />
      ))}
      <BoutonFin source={isWin ? FIN_IMG.boutonDoreVif : FIN_IMG.boutonDore} x={cx - (L.bouton.w * u) / 2} y={L.bouton.y * u} w={L.bouton.w * u} h={(L.bouton.w * u) / FIN_RAPPORT.boutonDore}
        texte={principal.texte} police={L.bouton.police * u} lignes={L.bouton.lignes} couleur="#5a360f" dore onPress={principal.onPress} disabled={!btnsArmed} />
      {(isWin || avecAides) && (
        <BoutonFin source={FIN_IMG.boutonBois} x={W - insets.right - (FIN_RETOUR.marge + FIN_RETOUR.w) * u} y={FIN_RETOUR.y * u} w={FIN_RETOUR.w * u} h={FIN_RETOUR.h * u}
          texte="Retour à la carte" police={FIN_RETOUR.police * u} onPress={onContinue} disabled={!btnsArmed} />
      )}
      {isWin && <Confettis W={W} H={H} />}
    </ImageBackground>
  );
}

// Image retournée horizontalement (créatures adverses, 27/09).
const MIROIR = { transform: [{ scaleX: -1 }] };

const styles = StyleSheet.create({
  filetBadge: { backgroundColor: 'rgba(13,110,70,0.9)' },
  niveauxBadge: { backgroundColor: 'rgba(146,64,14,0.92)' },
  panneauNiveau: { position: 'absolute', backgroundColor: 'rgba(20,14,6,0.88)', borderWidth: 1.5, borderColor: '#c9a35b', paddingVertical: 1 },
  panneauNiveauElite: { borderColor: '#ffd54a', backgroundColor: 'rgba(92,52,0,0.92)' },
  panneauNiveauTexte: { color: '#fbe9c4', fontWeight: '900', includeFontPadding: false },
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

  // ── Combat « Le bandeau de combat » (03/10) ──
  pleineImage: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  bandeau: { position: 'absolute', zIndex: 25 },
  panneauNom: { textAlign: 'center', alignSelf: 'stretch', color: '#fbe9c4', fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 2 },
  panneauVie: { marginTop: 3, borderRadius: 6, backgroundColor: 'rgba(20,10,4,0.75)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.6)', overflow: 'hidden', justifyContent: 'center' },
  panneauVieFond: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#3ddc5a' },
  panneauVieTexte: { textAlign: 'center', alignSelf: 'stretch', color: '#ffffff', fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 2 },
  panneauMana: { marginTop: 3, borderRadius: 3, backgroundColor: 'rgba(10,16,30,0.75)', overflow: 'hidden' },
  panneauManaFond: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#3b9dff' },
  panneauManaPlein: { backgroundColor: '#7cc8ff' },
  panneauBadge: { position: 'absolute', backgroundColor: '#f3e2b0', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  bandeauMessage: { position: 'absolute', top: 0, alignItems: 'center', justifyContent: 'center' },
  bandeauMessageTexte: { textAlign: 'center', alignSelf: 'stretch', color: '#fbe9c4', fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3 },
  carteAttaque: { justifyContent: 'center' },
  carteEtiquette: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  carteEtiquetteTexte: { textAlign: 'center', alignSelf: 'stretch', color: '#fbe9c4', fontWeight: '900', letterSpacing: 1, includeFontPadding: false },
  carteContenu: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  carteIcone: { includeFontPadding: false, marginRight: 4 },
  carteNom: { textAlign: 'center', alignSelf: 'stretch', color: '#fbe9c4', fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 },
  carteDetail: { textAlign: 'center', alignSelf: 'stretch', color: '#ffd24a', fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 },
  carteCout: { textAlign: 'center', alignSelf: 'stretch', color: '#9fd0ff', fontWeight: '800', includeFontPadding: false },
  carteTexteEteint: { color: '#c9ccd2' },
  spriteEtatsSeul: { position: 'relative', top: 0, alignSelf: 'center' },
  // « ✕ » au style des médaillons (03/10) : le médaillon fait le fond.
  closeBtn: {
    position: 'absolute', zIndex: 30, width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  // Effets d'impact (03/10)
  // Étape 3 : sorts, spécial, K.O. (03/10)
  finScintille: { position: 'absolute', color: '#ffffff', fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(255,230,120,0.95)', textShadowRadius: 8 },
  coucheConfettis: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 30, pointerEvents: 'none' },
  sortCercle: { position: 'absolute', borderWidth: 3 },
  sortParticule: { position: 'absolute', top: 0, width: 9, height: 9, borderRadius: 5 },
  sortGoutte: { width: 7, height: 13, borderTopLeftRadius: 3.5, borderTopRightRadius: 3.5, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  sortViseur: { position: 'absolute', borderWidth: 3, borderStyle: 'dashed' },
  sortTaillade: { position: 'absolute', top: -3, height: 6, borderRadius: 3 },
  sortIcone: { position: 'absolute', textAlign: 'center', includeFontPadding: false },
  sortTexte: { position: 'absolute', textAlign: 'center', fontSize: 24, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3 },
  assombrirEcran: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 21, backgroundColor: '#000000', pointerEvents: 'none' },
  eclairEcran: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 24, backgroundColor: '#ffffff', pointerEvents: 'none' },
  coucheImpacts: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 22, pointerEvents: 'none' },
  impactAnneau: { position: 'absolute', left: -28, top: -28, width: 56, height: 56, borderRadius: 28, borderWidth: 4 },
  impactEtincelle: { position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: 2 },
  // Jauge de frappe (03/10)
  jaugeSillon: { position: 'absolute', backgroundColor: 'rgba(26,13,4,0.92)', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.6)', overflow: 'hidden' },
  jaugeBien: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(255,184,62,0.36)' },
  jaugeParfait: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#ffcf3a', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#fff3b0' },
  jaugeParfaitReflet: { position: 'absolute', left: 0, right: 0, top: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.38)' },
  jaugeAiguille: { position: 'absolute', width: 8, borderRadius: 4, backgroundColor: '#fff8e1', borderWidth: 1.5, borderColor: '#9a6516', alignItems: 'center' },
  jaugeAiguilleTete: { position: 'absolute', top: -8, width: 12, height: 12, backgroundColor: '#ffd54a', borderWidth: 1.5, borderColor: '#8a5a12', transform: [{ rotate: '45deg' }] },
  jaugeConsigne: { marginTop: 6, color: '#fbe9c4', fontSize: 12, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3 },
  verdict: { fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  verdict_parfait: { color: '#ffd24a' },
  verdict_bien: { color: '#e8f0ff' },
  verdict_rate: { color: '#c9ccd2' },
  verdict_absent: { color: '#ff7a6a' },
  closeBtnText: { color: '#fbe9c4', fontSize: 17, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 2 },

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
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
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
  // Défaite avec aides, sans défilement (26/09) : ≈ 260 points de haut.
  resultBannerCompact: { maxWidth: 400 },
  resultLeft: { flex: 1, minWidth: 0, gap: 8 },
  recapCardCompact: { flex: 0, paddingVertical: 20, paddingHorizontal: 34 },
  aideDiagBloc: { gap: 4, paddingHorizontal: 6 },
  resultBtnColCompact: { width: 300, gap: 8 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  resultBtnDemi: { width: '48.5%', minHeight: 46, justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 6 },
  resultBtnTextDemi: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  resultBtnRetour: { paddingVertical: 10 },
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

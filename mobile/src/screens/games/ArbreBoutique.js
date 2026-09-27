import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, PanResponder, Animated, Easing, StyleSheet, ScrollView, Dimensions } from 'react-native';
import {
  TAP_UPGRADES, UPGRADE_ITEMS, AUTOCLICKERS, TAP_DAMAGE_PER_LEVEL, CREATURES, describeUpgradeEffect,
  tapPowerCost, critUpgradeCost, critDamageUpgradeCost, sanctuaryUpgradeCost, sanctuaryMaxed,
  veilleurUpgradeCost, veilleurMaxed, tapUpgradeCost, tapUpgradeUnlocked, upgradeItemCost,
  autoClickerCost, griffesCoinCost, taillePackGriffes, coreUpgradeUnlocked, ascensionSpeedMultiplier,
  ascensionThreshold, OFFRANDE_APPCOINS_COST, SANCTUARY_MAX_LEVEL, VEILLEUR_MAX_LEVEL,
  coreUpgradeRequirement, critChance, critMultiplier, offrandeReward, SANCTUARY_BONUS_PER_LEVEL, VEILLEUR_BONUS_PER_LEVEL,
  TAP_UPGRADE_UNLOCK_LEVEL, TAP_UPGRADE_FIRST_PACTE_LEVEL,
} from '../../games/clicker/clickerLogic';
import { useSettings } from '../../context/SettingsContext';
import { TOILE_L, TOILE_H, ZOOM_MIN, ZOOM_MAX, ZOOM_DEPART, ZOOM_TEXTE_REF, ZOOM_COMPENSATION_MIN, CENTRE, POS, CHAINE_TAP, CHAINE_AUTO, TITRES, ETIQUETTE, COMPENSATION_MAX } from '../../games/clicker/arbreDisposition';
import { vibrerSucces, CYAN_CHAMPIGNON, BoutonLarge, FenetreBois, BanniereTitre, largeurInterieureFenetre, CRISTAL, GrandPanneau, largeurInterieure } from './fenetreBois';
import BackButton from '../../components/BackButton';

// ════════════════════════════════════════════════════════════════════
//  BOUTIQUE EN ARBRE DE COMPÉTENCES « DANS L'ESPACE » (27/09)
// ════════════════════════════════════════════════════════════════════
// Demande de l'auteur : un arbre (Ascension au centre, dégâts de tap en haut,
// auto-clics en bas, Griffes et Offrande de part et d'autre), qu'on explore
// librement — glisser, pincer pour zoomer, élan — « comme dans l'espace ».
//
// ⚠️⚠️ AUCUNE dépendance ajoutée. react-native-gesture-handler a été LA cause
// de l'écran blanc (voir index.js, bisection) : on ne le remet pas. Moteur
// maison : PanResponder + Animated. FLUIDITÉ = ZÉRO rendu React pendant un
// geste : les doigts ne font que `setValue` sur des valeurs animées ; l'élan
// après le lâcher tourne sur le PILOTE NATIF.
//
// ⚠️ ÉCONOMIE INCHANGÉE : mêmes fonctions de prix, de verrou et d'achat que
// l'ancienne liste (ShopView) — seule la présentation change. Si l'arbre
// plante, `BoutiqueArbre` affiche l'ancienne boutique (filet de sécurité).
//
// ⚠️ Tailles et positions en NOMBRES (règle du 27/09).

const CENTRE_ECRAN_Y = 0.57;

const { width: ECRAN_L, height: ECRAN_H } = Dimensions.get('window');
// Fiche : un VRAI menu (retour de l'auteur : illisible avec l'arbre derrière).
const FICHE_L = Math.min(Math.round(ECRAN_L * 0.92), 380);
// Reliques : grand panneau vertical, comme la Boutique et les Quêtes.
const RELIQUES_L = Math.min(Math.round(ECRAN_L * 0.94), 400);
const RELIQUES_H = Math.round(Math.min(ECRAN_H * 0.78, RELIQUES_L / 0.56));
const RELIQUES_INT = largeurInterieure(RELIQUES_L);
const FICHE_INT = largeurInterieureFenetre(FICHE_L);
const IMG_PLAQUE = require('../../../assets/fenetres/plaque-solde.png');
const IMG = {
  ciel: require('../../../assets/arbre/ciel.jpg'),
  etoilesLoin: require('../../../assets/arbre/etoiles-loin.png'),
  etoilesPres: require('../../../assets/arbre/etoiles-pres.png'),
  traitAllume: require('../../../assets/arbre/trait-allume.png'),
  traitEteint: require('../../../assets/arbre/trait-eteint.png'),
  lueur: require('../../../assets/fenetres/lueur-cyan.png'),
  prixOr: require('../../../assets/arbre/prix-or.png'),
  prixGris: require('../../../assets/arbre/prix-gris.png'),
  rond: require('../../../assets/fenetres/bouton-rond-vert.png'),
};

// ── Le modèle : chaque nœud avec son prix, son état, son GAIN, son achat ──
// Branches LOGIQUES (2e version, retour de l'auteur) : chaque branche = un
// thème ET une dépendance réelle du jeu (voir arbreDisposition.js). La ligne
// de GAIN dit ce que rapporte l'élément ; sur un nœud verrouillé, ce qu'il
// faut faire pour l'ouvrir. Aucun nombre écrit en dur : tout vient des
// fonctions et constantes du jeu.
function construireNoeuds(p) {
  const f = p.formatNum || ((n) => String(Math.round(n)));
  const nb = (x, d = 2) => Number(x.toFixed(d)).toString().replace('.', ',');
  const remise = p.applyDiscount || ((c) => c);
  const coreState = { tapPower: p.tapPower, critLevel: p.critLevel, critDamageLevel: p.critDamageLevel, sanctuaryLevel: p.sanctuaryLevel };
  const debloque = (id) => coreUpgradeUnlocked(id, coreState);
  const etat = (verrou, max, prix, solde) => (verrou ? 'verrouille' : max ? 'max' : solde >= prix ? 'achetable' : 'cher');
  const N = [];
  const ajouter = (n) => N.push({ taille: 76, devise: 'pieces', allume: false, ...n });
  const exigence = (id) => `🔒 ${coreUpgradeRequirement(id)}`;

  // ── Centre : Ascension, Griffes (gauche), Offrande (droite)
  const seuil = ascensionThreshold(p.ascensionCount);
  ajouter({
    id: 'ascension', x: CENTRE.x, y: CENTRE.y, taille: 150, emoji: '🌟', nom: 'Ascension',
    niveau: p.ascensionCount > 0 ? `×${ascensionSpeedMultiplier(p.ascensionCount).toFixed(2)}` : '',
    gain: `prochaine ×${nb(ascensionSpeedMultiplier(p.ascensionCount + 1))}`,
    etat: p.ascensionReady ? 'achetable' : 'cher', prix: null, onPress: p.ascensionReady ? p.onAscend : null,
    progres: seuil > 0 ? Math.min(1, (p.totalEarned || 0) / seuil) : 0, allume: true,
    detail: p.ascensionReady
      ? 'Remet ton économie à zéro — tu gardes tes créatures et l\'Aventure.'
      : !p.defiAscensionEnCours
        ? `Débloquée par le défi « Fais ta ${p.ascensionCount + 1}${p.ascensionCount === 0 ? 're' : 'e'} Ascension ».`
        : `Gagne encore ${f(Math.max(0, seuil - (p.totalEarned || 0)))} pièces au total pour débloquer.`,
  });
  const prixGriffes = griffesCoinCost(p.griffesCoinBuys, p.ascensionCount);
  ajouter({ id: 'griffes', parent: 'ascension', x: POS.griffes[0], y: POS.griffes[1], taille: 88, emoji: '🐾', nom: `${taillePackGriffes(p.ascensionCount)} Griffes`,
    gain: 'pour l\'Aventure', prix: prixGriffes, etat: etat(false, false, prixGriffes, p.coins), onPress: p.onBuyGriffesWithCoins, allume: true,
    detail: 'Des Griffes pour faire progresser tes créatures en Aventure. Le pack suivant coûtera plus cher.' });
  ajouter({ id: 'offrande', parent: 'ascension', x: POS.offrande[0], y: POS.offrande[1], taille: 88, emoji: '💎', nom: 'Offrande', devise: 'diamants',
    gain: `≈ +${f(offrandeReward(p.tapPower))} pièces`, prix: OFFRANDE_APPCOINS_COST, etat: etat(false, false, OFFRANDE_APPCOINS_COST, p.sharedCoins),
    onPress: p.onOffrande, allume: true, detail: `Échange ${OFFRANDE_APPCOINS_COST} diamant${OFFRANDE_APPCOINS_COST > 1 ? 's' : ''} contre un bonus de pièces.` });
  ajouter({ id: 'reliques', parent: 'ascension', x: POS.reliques[0], y: POS.reliques[1], taille: 84, emoji: '📜', nom: 'Reliques', prix: null,
    gain: 'bonus des créatures', etat: 'achetable', ouvreReliques: true, allume: true, detail: 'Les améliorations liées à tes créatures.' });

  // ── PUISSANCE DE TAP : Pacte → les 10 améliorations en UNE chaîne (chacune
  // s'ouvre au niveau 5 de la précédente : la branche montre la dépendance).
  const prixPacte = remise(tapPowerCost(p.tapPower));
  ajouter({ id: 'pacte', parent: 'ascension', x: POS.pacte[0], y: POS.pacte[1], emoji: '🔗', nom: 'Pacte', niveau: `${p.tapPower}`,
    gain: `+${nb(TAP_DAMAGE_PER_LEVEL, 1)} / tap / nv`, prix: prixPacte, etat: etat(false, false, prixPacte, p.coins), onPress: p.onBuyTapPower, allume: p.tapPower > 1,
    detail: `+${nb(TAP_DAMAGE_PER_LEVEL, 1)} pièce par tap à chaque niveau.` });
  let prochainVerrou = false;
  TAP_UPGRADES.forEach((item, i) => {
    const pos = CHAINE_TAP[i]; if (!pos) return;
    const niveau = (p.tapUpgrades && p.tapUpgrades[item.id]) || 0;
    const ouvert = tapUpgradeUnlocked(i, p.tapPower, p.tapUpgrades);
    if (!ouvert) { if (prochainVerrou) return; prochainVerrou = true; } // seul le PROCHAIN verrou est montré
    const prix = remise(tapUpgradeCost(item, niveau, p.ascensionCount));
    const condition = i === 0 ? `🔒 Pacte nv ${TAP_UPGRADE_FIRST_PACTE_LEVEL}` : `🔒 ${TAP_UPGRADES[i - 1].name} nv ${TAP_UPGRADE_UNLOCK_LEVEL}`;
    ajouter({ id: item.id, parent: i === 0 ? 'pacte' : TAP_UPGRADES[i - 1].id, x: pos[0], y: pos[1],
      emoji: item.emoji, nom: item.name, niveau: `nv ${niveau}`, prix, etat: etat(!ouvert, false, prix, p.coins),
      gain: ouvert ? `+${f(item.bonus)} / tap / nv` : condition,
      onPress: () => p.onBuyTapUpgrade(item.id), allume: niveau > 0,
      detail: ouvert ? `+${f(item.bonus)} par tap et par niveau${niveau > 0 ? ` · actuellement +${f(item.bonus * niveau)}` : ''}.` : condition });
  });

  // ── CRITIQUES : Faveur des Esprits (chance) → Dégâts critiques (force)
  const prixFaveur = remise(critUpgradeCost(p.critLevel));
  const okFaveur = debloque('faveur');
  ajouter({ id: 'faveur', parent: 'pacte', x: POS.faveur[0], y: POS.faveur[1], emoji: '✨', nom: 'Faveur des Esprits', niveau: `nv ${p.critLevel}`,
    gain: okFaveur ? `+${nb((critChance(p.critLevel + 1) - critChance(p.critLevel)) * 100)} % crit / nv` : exigence('faveur'),
    prix: prixFaveur, etat: etat(!okFaveur, false, prixFaveur, p.coins), onPress: p.onBuyCrit, allume: p.critLevel > 0,
    detail: okFaveur ? `${nb(critChance(p.critLevel) * 100)} % de chance de coup critique.` : exigence('faveur') });
  const prixCrit = remise(critDamageUpgradeCost(p.critDamageLevel));
  const okCrit = debloque('critDamage');
  ajouter({ id: 'critDamage', parent: 'faveur', x: POS.critDamage[0], y: POS.critDamage[1], emoji: '💥', nom: 'Dégâts critiques', niveau: `nv ${p.critDamageLevel}`,
    gain: okCrit ? `+${nb(critMultiplier(p.critDamageLevel + 1) - critMultiplier(p.critDamageLevel), 1)} force crit / nv` : exigence('critDamage'),
    prix: prixCrit, etat: etat(!okCrit, false, prixCrit, p.coins), onPress: p.onBuyCritDamage, allume: p.critDamageLevel > 0,
    detail: okCrit ? `Coup critique ×${nb(critMultiplier(p.critDamageLevel), 1)}.` : exigence('critDamage') });

  // ── PASSIF : Sanctuaire → Veilleur
  const maxS = sanctuaryMaxed(p.sanctuaryLevel); const prixS = remise(sanctuaryUpgradeCost(p.sanctuaryLevel)); const okS = debloque('sanctuaire');
  ajouter({ id: 'sanctuaire', parent: 'ascension', x: POS.sanctuaire[0], y: POS.sanctuaire[1], emoji: '🏛️', nom: 'Sanctuaire', niveau: `${p.sanctuaryLevel}/${SANCTUARY_MAX_LEVEL}`,
    gain: okS ? `+${nb(SANCTUARY_BONUS_PER_LEVEL * 100, 1)} % production / nv` : exigence('sanctuaire'),
    prix: prixS, etat: etat(!okS, maxS, prixS, p.coins), onPress: p.onBuySanctuary, allume: p.sanctuaryLevel > 0,
    detail: okS ? 'Augmente TOUTE ta production (tap + passif).' : exigence('sanctuaire') });
  const maxV = veilleurMaxed(p.veilleurLevel); const prixV = remise(veilleurUpgradeCost(p.veilleurLevel)); const okV = debloque('veilleur');
  ajouter({ id: 'veilleur', parent: 'sanctuaire', x: POS.veilleur[0], y: POS.veilleur[1], emoji: '🌙', nom: 'Veilleur', niveau: `${p.veilleurLevel}/${VEILLEUR_MAX_LEVEL}`,
    gain: okV ? `+${nb(VEILLEUR_BONUS_PER_LEVEL * 100, 1)} % hors-ligne / nv` : exigence('veilleur'),
    prix: prixV, etat: etat(!okV, maxV, prixV, p.coins), onPress: p.onBuyVeilleur, allume: p.veilleurLevel > 0,
    detail: okV ? 'Augmente tes gains quand tu ne joues pas.' : exigence('veilleur') });

  // ── AUTO-CLICS : les 15 en UNE chaîne, par prix ; révélés 2 par 2 (les
  // possédés, le suivant, puis un « ??? »).
  const tries = [...AUTOCLICKERS].sort((a, b) => a.baseCost - b.baseCost);
  let dernierPossede = -1;
  tries.forEach((c, i) => { if (((p.autoClickers && p.autoClickers[c.id]) || 0) > 0) dernierPossede = i; });
  tries.forEach((c, i) => {
    const pos = CHAINE_AUTO[i]; if (!pos || i > dernierPossede + 2) return;
    const possede = (p.autoClickers && p.autoClickers[c.id]) || 0;
    const mystere = i === dernierPossede + 2;
    const prix = remise(autoClickerCost(c, possede, p.ascensionCount));
    ajouter({ id: c.id, parent: i === 0 ? 'ascension' : tries[i - 1].id, x: pos[0], y: pos[1],
      emoji: c.emoji, nom: c.name, niveau: possede > 0 ? `×${possede}` : '', prix, etat: etat(mystere, false, prix, p.coins),
      gain: mystere ? `🔒 achète ${tries[i - 1].name}` : `+${nb(c.baseIncome, 1)} /s chacun`,
      onPress: () => p.onBuyAutoClicker(c.id), allume: possede > 0,
      detail: mystere ? `🔒 Achète d'abord ${tries[i - 1].name}.` : `Possédé : ${possede} · +${nb(c.baseIncome, 1)}/s chacun.` });
  });
  return N;
}

// ── Le moteur « espace » : glisser, pincer, élan ─────────────────────────
function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }
function EspaceZoomable({ onEchelle, children, fond }) {
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const s = useRef(new Animated.Value(1)).current;
  const etat = useRef({ tx: 0, ty: 0, s: ZOOM_DEPART, l: 0, h: 0, px: 0, py: 0, pret: false }).current;
  const boite = useRef(null);
  const geste = useRef({ depart: null, pince: null }).current;
  const echelleAvant = useRef(ZOOM_DEPART);

  const limiter = (x, y, z) => {
    // On peut amener chaque bord de la toile jusqu'au milieu de l'écran.
    const { l, h } = etat;
    return [borne(x, l / 2 - TOILE_L * z, l / 2), borne(y, h / 2 - TOILE_H * z, h / 2), z];
  };
  const appliquer = (x, y, z) => {
    const [bx, by, bz] = limiter(x, y, borne(z, ZOOM_MIN, ZOOM_MAX));
    etat.tx = bx; etat.ty = by; etat.s = bz;
    tx.setValue(bx); ty.setValue(by); s.setValue(bz);
  };
  // Après un geste : l'échelle, arrondie au dixième, sert à garder les noms
  // lisibles (un rendu seulement quand le palier change, jamais pendant).
  const signalerDetail = () => {
    const e = Math.round(etat.s * 10) / 10;
    if (e !== echelleAvant.current) { echelleAvant.current = e; onEchelle && onEchelle(e); }
  };
  const arreter = () => { tx.stopAnimation(); ty.stopAnimation(); s.stopAnimation(); };
  const animerVers = (x, y, z, duree) => {
    const [bx, by, bz] = limiter(x, y, borne(z, ZOOM_MIN, ZOOM_MAX));
    etat.tx = bx; etat.ty = by; etat.s = bz;
    const e = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(tx, { toValue: bx, duration: duree, easing: e, useNativeDriver: true }),
      Animated.timing(ty, { toValue: by, duration: duree, easing: e, useNativeDriver: true }),
      Animated.timing(s, { toValue: bz, duration: duree, easing: e, useNativeDriver: true }),
    ]).start();
    signalerDetail();
  };
  const recentrer = (duree = 420) => animerVers(etat.l / 2 - CENTRE.x * ZOOM_DEPART, etat.h * CENTRE_ECRAN_Y - CENTRE.y * ZOOM_DEPART, ZOOM_DEPART, duree);
  const zoomerAutourDuCentre = (facteur) => {
    const z = borne(etat.s * facteur, ZOOM_MIN, ZOOM_MAX);
    const cx = (etat.l / 2 - etat.tx) / etat.s; const cy = (etat.h / 2 - etat.ty) / etat.s;
    animerVers(etat.l / 2 - cx * z, etat.h / 2 - cy * z, z, 260);
  };

  const pan = useRef(PanResponder.create({
    // Un simple toucher reste aux nœuds (achat) ; on ne prend la main qu'au
    // déplacement ou à deux doigts.
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.touches.length >= 2 || Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
    onMoveShouldSetPanResponderCapture: (e, g) => e.nativeEvent.touches.length >= 2 || Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      arreter();
      geste.depart = { tx: etat.tx, ty: etat.ty, dx: 0, dy: 0 };
      geste.pince = null;
    },
    onPanResponderMove: (e, g) => {
      const t = e.nativeEvent.touches;
      if (t.length >= 2) {
        // ⚠️ pageX (écran) − position de la carte : locationX serait relatif
        // à l'élément touché (souvent un nœud), le zoom partirait de travers.
        const mx = (t[0].pageX + t[1].pageX) / 2 - etat.px; const my = (t[0].pageY + t[1].pageY) / 2 - etat.py;
        const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) || 1;
        if (!geste.pince) {
          geste.pince = { d0: d, cx: (mx - etat.tx) / etat.s, cy: (my - etat.ty) / etat.s, s0: etat.s };
        }
        // Le point de la toile sous les doigts y reste : zoom « autour des doigts ».
        const z = borne(geste.pince.s0 * (d / geste.pince.d0), ZOOM_MIN, ZOOM_MAX);
        appliquer(mx - geste.pince.cx * z, my - geste.pince.cy * z, z);
      } else {
        if (geste.pince) { geste.pince = null; geste.depart = { tx: etat.tx, ty: etat.ty, dx: g.dx, dy: g.dy }; }
        appliquer(geste.depart.tx + g.dx - geste.depart.dx, geste.depart.ty + g.dy - geste.depart.dy, etat.s);
      }
    },
    onPanResponderRelease: (e, g) => {
      // Élan : on prolonge le mouvement selon la vitesse du lâcher, puis on
      // freine en douceur (pilote natif, borné : aucun dépassement).
      if (geste.pince) { signalerDetail(); return; }
      animerVers(etat.tx + g.vx * 320, etat.ty + g.vy * 320, etat.s, 700);
    },
    onPanResponderTerminate: () => signalerDetail(),
  })).current;

  // Parallaxe : les étoiles lointaines glissent 5 fois moins vite que
  // l'arbre, les proches 2,5 fois moins — la profondeur de « l'espace ».
  const tuile = 512;
  const couche = (facteur) => ({
    transform: [
      { translateX: Animated.subtract(Animated.modulo(Animated.multiply(tx, facteur), tuile), tuile) },
      { translateY: Animated.subtract(Animated.modulo(Animated.multiply(ty, facteur), tuile), tuile) },
    ],
  });

  return (
    <View
      ref={boite}
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        const premier = !etat.pret; etat.l = width; etat.h = height; etat.pret = true;
        if (boite.current && boite.current.measureInWindow) boite.current.measureInWindow((x, y) => { etat.px = x || 0; etat.py = y || 0; });
        if (premier) { appliquer(width / 2 - CENTRE.x * ZOOM_DEPART, height * CENTRE_ECRAN_Y - CENTRE.y * ZOOM_DEPART, ZOOM_DEPART); }
      }}
      {...pan.panHandlers}
    >
      <Image source={IMG.ciel} resizeMode="stretch" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} />
      <Animated.View style={[styles.couche, couche(0.2)]}>
        <Image source={IMG.etoilesLoin} resizeMode="repeat" style={styles.coucheImage} />
      </Animated.View>
      <Animated.View style={[styles.couche, couche(0.4)]}>
        <Image source={IMG.etoilesPres} resizeMode="repeat" style={styles.coucheImage} />
      </Animated.View>
      {fond}
      <Animated.View style={[styles.toile, { transform: [{ translateX: tx }, { translateY: ty }, { scale: s }] }]}>
        {children}
      </Animated.View>
      <View style={styles.commandes}>
        {[['＋', () => zoomerAutourDuCentre(1.3)], ['－', () => zoomerAutourDuCentre(1 / 1.3)], ['◎', () => recentrer()]].map(([sym, f]) => (
          <TouchableOpacity key={sym} style={styles.commande} onPress={f}>
            <Image source={IMG.rond} resizeMode="contain" style={styles.commandeImage} />
            <Text style={styles.commandeTexte}>{sym}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Une branche : trait lumineux entre deux nœuds (image étirée, tournée) ──
const Branche = React.memo(function Branche({ a, b, allume }) {
  const dx = b.x - a.x; const dy = b.y - a.y; const L = Math.hypot(dx, dy); const ep = allume ? 14 : 10;
  return (
    <Image
      source={allume ? IMG.traitAllume : IMG.traitEteint}
      resizeMode="stretch"
      style={{ position: 'absolute', left: (a.x + b.x) / 2 - L / 2, top: (a.y + b.y) / 2 - ep / 2, width: L, height: ep,
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }}
    />
  );
}, (x, y) => x.allume === y.allume && x.a.x === y.a.x && x.a.y === y.a.y && x.b.x === y.b.x && x.b.y === y.b.y);

// ── Un nœud : médaillon + (de près) nom, niveau, prix ──────────────────────
const COULEUR_ETAT = { achetable: '#f7cf57', cher: '#6d7f86', verrouille: '#3a4a50', max: '#f7cf57' };
const Noeud = React.memo(function Noeud({ n, compense, pouls, onAppui, onAppuiLong, formatNum }) {
  const t = n.taille; const verrou = n.etat === 'verrouille'; const c = compense;
  const prixTexte = n.prix != null ? `${n.devise === 'diamants' ? '💎' : '💰'} ${formatNum(n.prix)}` : null;
  const pl = Math.round(Math.max(64, Math.min(118, (prixTexte ? prixTexte.length : 0) * 7.5 + 26)) * c);
  const ph = Math.round(ETIQUETTE.pastilleH * c);
  return (
    <View style={{ position: 'absolute', left: n.x - t / 2, top: n.y - t / 2, width: t, alignItems: 'center' }}>
      {n.etat === 'achetable' && !verrou ? (
        <Animated.Image source={IMG.lueur} resizeMode="stretch" style={{ position: 'absolute', left: -t * 0.35, top: -t * 0.35, width: t * 1.7, height: t * 1.7, opacity: pouls, pointerEvents: 'none' }} />
      ) : null}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onAppui(n.id)}
        onLongPress={() => onAppuiLong(n.id)}
        delayLongPress={320}
        style={[styles.medaillon, { width: t, height: t, borderRadius: t / 2, borderColor: COULEUR_ETAT[n.etat] }, verrou && styles.medaillonVerrou]}
      >
        <Text style={{ fontSize: Math.round(t * (n.id === 'ascension' ? 0.42 : 0.44)) }}>{verrou ? '🔒' : n.emoji}</Text>
        {n.progres != null && !verrou ? (
          <View style={[styles.anneau, { width: t - 10, height: 6, bottom: 12 }]}>
            <View style={{ width: Math.round((t - 12) * n.progres), height: 4, borderRadius: 2, backgroundColor: CYAN_CHAMPIGNON }} />
          </View>
        ) : null}
      </TouchableOpacity>
      {/* Le NOM juste dessous, le PRIX encore dessous (retour de l'auteur) —
          compensés au zoom pour rester lisibles de loin. En nombres. */}
      {/* 'box-none' : la pastille de prix reçoit le toucher (achat), le reste laisse
          passer les doigts vers la carte. */}
      <View style={{ width: Math.round(ETIQUETTE.largeur * c), marginLeft: Math.round((t - ETIQUETTE.largeur * c) / 2), alignItems: 'center', marginTop: Math.round(ETIQUETTE.marge * c), pointerEvents: 'box-none' }}>
        <Text style={[styles.nom, { fontSize: Math.round(ETIQUETTE.police * c), lineHeight: Math.round(ETIQUETTE.interligne * c) }]} numberOfLines={2}>
          {verrou ? '???' : n.nom}{!verrou && n.niveau ? ` · ${n.niveau}` : ''}
        </Text>
        {/* Ce que rapporte l'élément (ou, verrouillé, comment l'ouvrir). */}
        {n.gain ? (
          <Text style={[styles.gain, { fontSize: Math.round(ETIQUETTE.gainPolice * c), lineHeight: Math.round(ETIQUETTE.gainInterligne * c) }, verrou && styles.gainVerrou]} numberOfLines={1}>{n.gain}</Text>
        ) : null}
        {!verrou && n.etat === 'max' ? (
          <Text style={[styles.nom, { fontSize: Math.round(12 * c), color: '#f7cf57' }]}>⭐ MAX</Text>
        ) : !verrou && prixTexte ? (
          // La pastille de prix ACHÈTE aussi (retour de l'auteur).
          <TouchableOpacity activeOpacity={0.7} onPress={() => onAppui(n.id)} onLongPress={() => onAppuiLong(n.id)} delayLongPress={320}
            style={{ width: pl, height: ph, marginTop: Math.round(3 * c), alignItems: 'center', justifyContent: 'center' }}>
            <Image source={n.etat === 'achetable' ? IMG.prixOr : IMG.prixGris} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: pl, height: ph }} />
            <Text style={[styles.prix, { fontSize: Math.round(12 * c) }, n.etat !== 'achetable' && styles.prixCher]} numberOfLines={1}>{prixTexte}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}, (x, y) => x.compense === y.compense && x.n.etat === y.n.etat && x.n.prix === y.n.prix && x.n.niveau === y.n.niveau && x.n.gain === y.n.gain
  && x.n.nom === y.n.nom && x.n.progres === y.n.progres && x.n.x === y.n.x && x.n.y === y.n.y);

// Pastille de prix (dorée si achetable, grise sinon), touchable : achète.
function PastillePrix({ texte, ok, largeur = 86, hauteur = 30, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.7} disabled={!onPress} onPress={onPress} style={{ width: largeur, height: hauteur, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={ok ? IMG.prixOr : IMG.prixGris} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: largeur, height: hauteur }} />
      <Text style={[styles.prix, { fontSize: 12.5 }, !ok && styles.prixCher]} numberOfLines={1}>{texte}</Text>
    </TouchableOpacity>
  );
}

// ── L'arbre ────────────────────────────────────────────────────────────
function ArbreBoutique(props) {
  const { vibrations } = useSettings();
  const [echelle, setEchelle] = useState(ZOOM_DEPART);
  // Compensation plafonnée à ZOOM_COMPENSATION_MIN : plus bas, tout rétrécit
  // ensemble (vue d'ensemble du dézoom « à fond »).
  const compense = Math.max(1, Math.min(COMPENSATION_MAX, ZOOM_TEXTE_REF / Math.max(echelle, ZOOM_COMPENSATION_MIN)));
  const [ficheId, setFicheId] = useState(null);
  const [reliques, setReliques] = useState(false);
  const formatNum = props.formatNum || ((n) => String(Math.round(n)));
  const noeuds = useMemo(() => construireNoeuds(props), [props]);
  const parId = useMemo(() => Object.fromEntries(noeuds.map((n) => [n.id, n])), [noeuds]);
  // ⚠️ Un nœud mémorisé garde un ANCIEN objet : l'achat relit le nœud FRAIS
  // (gestionnaire et solde du dernier rendu) — jamais une fermeture périmée.
  const frais = useRef(parId); frais.current = parId;
  const fiche = ficheId ? parId[ficheId] : null;
  // UNE animation partagée par toutes les lueurs d'achat possible (pas une par nœud).
  const pouls = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const b = Animated.loop(Animated.sequence([
      Animated.timing(pouls, { toValue: 0.95, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pouls, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, []);

  const vib = useRef(vibrations); vib.current = vibrations;
  const acheter = useCallback((id) => {
    const n = frais.current[id];
    if (!n) return;
    if (n.ouvreReliques) { setReliques(true); return; }
    // L'Ascension (irréversible) ouvre TOUJOURS sa fiche, avec son bouton.
    if (id === 'ascension' || n.etat !== 'achetable' || !n.onPress) { setFicheId(id); return; }
    n.onPress();
    vibrerSucces(vib.current);
  }, []);

  return (
    <View style={styles.racine}>
      <EspaceZoomable onEchelle={setEchelle}>
        {noeuds.filter((n) => n.parent && parId[n.parent]).map((n) => (
          <Branche key={'b' + n.id} a={parId[n.parent]} b={n} allume={n.allume && parId[n.parent].allume} />
        ))}
        {TITRES.map((T) => (
          <Text key={T.texte} style={[styles.titreBranche, { left: T.x - 170, top: T.y - Math.round(ETIQUETTE.titrePolice * compense * 0.7), fontSize: Math.round(ETIQUETTE.titrePolice * compense) }]}>{T.texte}</Text>
        ))}
        {noeuds.map((n) => (
          <Noeud key={n.id} n={n} compense={compense} pouls={pouls} onAppui={acheter} onAppuiLong={setFicheId} formatNum={formatNum} />
        ))}
      </EspaceZoomable>

      {/* En-tête du thème forêt, par-dessus la carte (les zones vides laissent
          passer les doigts vers la carte). */}
      <View style={[styles.entete, { pointerEvents: 'box-none' }]}>
        <BackButton onPress={props.onRetour} style={styles.retour} />
        <View style={[styles.soldes, { pointerEvents: 'none' }]}>
          <View style={styles.plaque}>
            <Image source={IMG_PLAQUE} resizeMode="stretch" style={styles.plaqueImage} />
            <Text style={styles.plaqueTexte} numberOfLines={1}>💰 {formatNum(props.coins || 0)}</Text>
          </View>
          <View style={styles.plaque}>
            <Image source={IMG_PLAQUE} resizeMode="stretch" style={styles.plaqueImage} />
            <Image source={CRISTAL} resizeMode="contain" style={styles.plaqueCristal} />
            <Text style={styles.plaqueTexte} numberOfLines={1}>{props.sharedCoins || 0}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.titreZone, { pointerEvents: 'none' }]}>
        <BanniereTitre titre="Améliorations" largeur={220} />
      </View>

      {fiche ? (
        <View style={styles.menuFond}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFicheId(null)} />
          <FenetreBois titre={fiche.etat === 'verrouille' ? '???' : fiche.nom} largeur={FICHE_L} onFermer={() => setFicheId(null)}>
            <View style={[styles.ficheMedaillon, { borderColor: COULEUR_ETAT[fiche.etat] }]}>
              <Text style={styles.ficheEmoji}>{fiche.etat === 'verrouille' ? '🔒' : fiche.emoji}</Text>
            </View>
            {fiche.niveau && fiche.etat !== 'verrouille' ? <Text style={styles.ficheNiveau}>Niveau actuel : {fiche.niveau}</Text> : null}
            {fiche.gain ? (
              <View style={[styles.ficheBloc, { width: FICHE_INT }]}>
                <Text style={styles.ficheIntitule}>{fiche.etat === 'verrouille' ? 'Pour le débloquer' : 'Ce que ça rapporte'}</Text>
                <Text style={[styles.ficheGain, fiche.etat === 'verrouille' && styles.gainVerrou]}>{fiche.gain}</Text>
              </View>
            ) : null}
            {fiche.detail && fiche.detail !== fiche.gain ? <Text style={[styles.ficheLigne, { width: FICHE_INT }]}>{fiche.detail}</Text> : null}
            {fiche.progres != null ? (
              <View style={[styles.ficheBarre, { width: FICHE_INT }]}>
                <View style={{ width: Math.round((FICHE_INT - 4) * fiche.progres), height: 8, borderRadius: 4, backgroundColor: CYAN_CHAMPIGNON }} />
              </View>
            ) : null}
            {fiche.id === 'ascension' ? (
              <BoutonLarge
                couleur={fiche.etat === 'achetable' ? 'vert' : 'rouge'}
                largeur={FICHE_INT}
                hauteur={56}
                desactive={fiche.etat !== 'achetable'}
                texte="🌟 Faire l'Ascension"
                onPress={() => { setFicheId(null); if (props.onAscend) props.onAscend(); }}
              />
            ) : fiche.prix != null && fiche.etat !== 'verrouille' && fiche.etat !== 'max' ? (
              <BoutonLarge
                couleur={fiche.etat === 'achetable' ? 'vert' : 'rouge'}
                largeur={FICHE_INT}
                hauteur={56}
                desactive={fiche.etat !== 'achetable'}
                texte={`Acheter · ${fiche.devise === 'diamants' ? '💎' : '💰'} ${formatNum(fiche.prix)}`}
                sousTexte={fiche.etat === 'achetable' ? null : 'Pas assez de pièces'}
                onPress={() => acheter(fiche.id)}
              />
            ) : fiche.etat === 'max' ? <Text style={styles.ficheNiveau}>⭐ Niveau maximum atteint</Text> : null}
          </FenetreBois>
        </View>
      ) : null}

      {reliques ? (
        <View style={styles.menuFond}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setReliques(false)} />
          <GrandPanneau titre="Reliques" largeur={RELIQUES_L} hauteur={RELIQUES_H} onFermer={() => setReliques(false)}>
            <Text style={[styles.reliquesIntro, { width: RELIQUES_INT }]}>Les améliorations de tes créatures. Chaque relique s'ouvre avec sa créature.</Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {[...UPGRADE_ITEMS]
                .sort((a, b) => {
                  const pos = new Set((props.owned || []).map((o) => o.id));
                  return (pos.has(a.creatureId) ? 0 : 1) - (pos.has(b.creatureId) ? 0 : 1);
                })
                .map((item) => {
                  const possedee = (props.owned || []).some((o) => o.id === item.creatureId);
                  const niveau = (props.upgradeLevels && props.upgradeLevels[item.id]) || 0;
                  const prix = (props.applyDiscount || ((c) => c))(upgradeItemCost(item, niveau));
                  const ok = possedee && (props.coins || 0) >= prix;
                  const acheterRelique = ok ? () => { props.onBuyUpgradeItem(item.id); vibrerSucces(vibrations); } : null;
                  return (
                    <View key={item.id} style={[styles.relique, { width: RELIQUES_INT }, !possedee && { opacity: 0.5 }]}>
                      <Text style={styles.reliqueEmoji}>{possedee ? item.emoji : '🔒'}</Text>
                      <View style={{ width: RELIQUES_INT - 34 - 10 - 92 - 10 }}>
                        <Text style={styles.reliqueNom} numberOfLines={1}>{possedee ? `${item.name} · nv ${niveau}` : '???'}</Text>
                        {/* Texte TIRÉ DE L'EFFET (describeUpgradeEffect, comme l'ancienne
                            boutique) : 4 reliques n'ont pas de champ desc, « null »
                            s'affichait. ⚠️ describeUpgradeTotal n'est PAS exportée par
                            clickerLogic (interne à ClickerScreen) : ne pas l'importer.
                            Verrouillée : QUELLE créature il faut. */}
                        <Text style={styles.reliqueDesc} numberOfLines={2}>
                          {possedee
                            ? `${describeUpgradeEffect(item)} / nv`
                            : `🔒 Nécessite ${(CREATURES.find((c) => c.id === item.creatureId) || { stages: [{ name: '???' }] }).stages[0].name}`}
                        </Text>
                      </View>
                      {possedee ? <PastillePrix texte={`💰 ${formatNum(prix)}`} ok={ok} largeur={92} hauteur={32} onPress={acheterRelique} /> : null}
                    </View>
                  );
                })}
            </ScrollView>
          </GrandPanneau>
        </View>
      ) : null}
    </View>
  );
}

// ── Filet de sécurité : si l'arbre plante, l'ancienne boutique s'affiche ──
class FiletArbre extends React.Component {
  constructor(p) { super(p); this.state = { erreur: null }; }
  static getDerivedStateFromError(erreur) { return { erreur }; }
  componentDidCatch(erreur) { try { console.warn('Arbre de la boutique en erreur :', erreur && erreur.message); } catch (e) {} }
  render() { return this.state.erreur ? this.props.secours : this.props.children; }
}
export default function BoutiqueArbre({ Secours, ...props }) {
  return (
    <FiletArbre secours={Secours ? <Secours {...props} /> : null}>
      <ArbreBoutique {...props} />
    </FiletArbre>
  );
}
export { construireNoeuds, TOILE_L, TOILE_H };

const styles = StyleSheet.create({
  // PLEIN ÉCRAN (retour de l'auteur) : sous la barre de navigation (zIndex 5),
  // au-dessus de tout le reste ; l'arbre repose son propre bouton RETOUR.
  racine: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 4, overflow: 'hidden', backgroundColor: '#061018' },
  couche: { position: 'absolute', left: 0, top: 0, width: 2048, height: 2560 },
  coucheImage: { width: 2048, height: 2560 },
  toile: { position: 'absolute', left: 0, top: 0, width: TOILE_L, height: TOILE_H, transformOrigin: 'top left' },
  medaillon: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,30,34,0.92)', borderWidth: 3 },
  medaillonVerrou: { backgroundColor: 'rgba(10,16,20,0.92)' },
  anneau: { position: 'absolute', borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.55)', padding: 1, justifyContent: 'center' },
  nom: { color: '#fff7e0', fontSize: 12, fontWeight: '900', textAlign: 'center', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 4 },
  prix: { color: '#3a2208', fontSize: 12, fontWeight: '900', includeFontPadding: false },
  gain: { color: '#8ff0e0', fontWeight: '800', textAlign: 'center', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 3 },
  gainVerrou: { color: '#ffcf6b' },
  titreBranche: { position: 'absolute', width: 340, textAlign: 'center', color: '#f0d48a', fontWeight: '900', letterSpacing: 1.5, includeFontPadding: false, pointerEvents: 'none', textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 6 },
  prixCher: { color: '#e0e6e6' },
  // Au-dessus de la barre de navigation (posée par-dessus le bas).
  commandes: { position: 'absolute', right: 12, bottom: 150, gap: 10 },
  commande: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  commandeImage: { position: 'absolute', left: 0, top: 0, width: 50, height: 50 },
  commandeTexte: { color: '#ffffff', fontSize: 20, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
  entete: { position: 'absolute', left: 0, right: 0, top: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 12 },
  retour: { position: 'relative', left: 0, top: 0 },
  soldes: { gap: 6, alignItems: 'flex-end' },
  plaque: { width: 124, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  plaqueImage: { position: 'absolute', left: 0, top: 0, width: 124, height: 38 },
  plaqueCristal: { width: 12, height: 22, marginRight: 6 },
  plaqueTexte: { color: '#ffe38a', fontSize: 14, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
  titreZone: { position: 'absolute', left: 0, right: 0, top: 88, alignItems: 'center' },
  // Vrai menu : fond PRESQUE OPAQUE (avec l'arbre visible derrière, la fiche
  // était illisible — retour de l'auteur), centré (en bas, le bouton passait
  // sous la barre).
  menuFond: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, backgroundColor: 'rgba(2,8,10,0.94)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  ficheMedaillon: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, backgroundColor: 'rgba(14,30,34,0.95)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  ficheEmoji: { fontSize: 44 },
  ficheNiveau: { color: '#f0d48a', fontSize: 14, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
  ficheBloc: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8, alignItems: 'center' },
  ficheIntitule: { color: '#d8c7a4', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  ficheGain: { color: '#8ff0e0', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  ficheBarre: { height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)', padding: 2, marginBottom: 8, justifyContent: 'center' },
  reliquesIntro: { color: '#dccbaa', fontSize: 11.5, textAlign: 'center', marginBottom: 8 },
  ficheLigne: { color: '#d8e8e6', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  relique: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(98,250,235,0.18)', gap: 10 },
  reliqueEmoji: { fontSize: 26, width: 34, textAlign: 'center' },
  reliqueNom: { color: '#fff7e0', fontSize: 13, fontWeight: '900' },
  reliqueDesc: { color: '#b9cccb', fontSize: 11 },
});

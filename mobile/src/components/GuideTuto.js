// 🎓 GUIDE DU TUTORIEL (21/10, demande de l'auteur) : un REPÈRE autour de ce qu'il faut toucher, et UNE phrase.
//  - ROND doré (image Gemini 110, AMINCI à 40 % de son épaisseur le 21/10 — demande de l'auteur : la bande resserrée vers son
//    milieu, contour et reflets gardés) qui TOURNE doucement ; CARRÉ doré (image 112, remonté en 12 morceaux pour s'étirer sans
//    déformer ses coins) qui RESPIRE ;
//  - deux ÉTOILES (image 111) en haut à droite, qui scintillent chacune à leur rythme et NE tournent PAS avec le rond ;
//  - une lueur dorée derrière (ajoutée par le jeu, comme convenu) ;
//  - la bulle : une phrase, et une TOUTE PETITE croix en haut à droite qui ferme le conseil (jamais bloquant).
// ⚠️ AUCUN conteneur plein écran (leçon du 20/10 : il avalait les taps sur l'œuf). Le guide renvoie des éléments posés
// chacun à sa place ; tout est transparent au toucher SAUF la croix. Le parent le pose à SA racine (repère de `rect`).
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';

const IMG = {
  rond: require('../../assets/tuto/rond.png'),
  etoile: require('../../assets/tuto/etoile.png'),
  lueur: require('../../assets/grimoire/lueur-or.png'),
  coinHG: require('../../assets/tuto/coin-hg.png'),
  coinHD: require('../../assets/tuto/coin-hd.png'),
  coinBG: require('../../assets/tuto/coin-bg.png'),
  coinBD: require('../../assets/tuto/coin-bd.png'),
  bandeH: require('../../assets/tuto/bande-h.png'),
  bandeB: require('../../assets/tuto/bande-b.png'),
  bandeG: require('../../assets/tuto/bande-g.png'),
  bandeD: require('../../assets/tuto/bande-d.png'),
  encocheH: require('../../assets/tuto/encoche-h.png'),
  encocheB: require('../../assets/tuto/encoche-b.png'),
  encocheG: require('../../assets/tuto/encoche-g.png'),
  encocheD: require('../../assets/tuto/encoche-d.png'),
};
// Épaisseur affichée de la bande du carré (les morceaux font 53 px pour une bande de 24 px).
const EP = 8;
const COIN = Math.round((53 / 24) * EP);
const ENC_L = Math.round((28 / 24) * EP);

// Le cadre doré, étiré à la taille voulue sans déformer ses coins ni ses encoches.
export function CadreTuto({ l, h }) {
  const im = (src, left, top, width, height, k) => (
    <Image key={k} source={src} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left, top, width: Math.max(1, width), height: Math.max(1, height) }} />
  );
  const mx = Math.round((l - ENC_L) / 2); const my = Math.round((h - ENC_L) / 2);
  return (
    <>
      {im(IMG.coinHG, 0, 0, COIN, COIN, 'c1')}
      {im(IMG.coinHD, l - COIN, 0, COIN, COIN, 'c2')}
      {im(IMG.coinBG, 0, h - COIN, COIN, COIN, 'c3')}
      {im(IMG.coinBD, l - COIN, h - COIN, COIN, COIN, 'c4')}
      {im(IMG.bandeH, COIN, 0, mx - COIN, COIN, 'h1')}
      {im(IMG.encocheH, mx, 0, ENC_L, COIN, 'h2')}
      {im(IMG.bandeH, mx + ENC_L, 0, l - COIN - mx - ENC_L, COIN, 'h3')}
      {im(IMG.bandeB, COIN, h - COIN, mx - COIN, COIN, 'b1')}
      {im(IMG.encocheB, mx, h - COIN, ENC_L, COIN, 'b2')}
      {im(IMG.bandeB, mx + ENC_L, h - COIN, l - COIN - mx - ENC_L, COIN, 'b3')}
      {im(IMG.bandeG, 0, COIN, COIN, my - COIN, 'g1')}
      {im(IMG.encocheG, 0, my, COIN, ENC_L, 'g2')}
      {im(IMG.bandeG, 0, my + ENC_L, COIN, h - COIN - my - ENC_L, 'g3')}
      {im(IMG.bandeD, l - COIN, COIN, COIN, my - COIN, 'd1')}
      {im(IMG.encocheD, l - COIN, my, COIN, ENC_L, 'd2')}
      {im(IMG.bandeD, l - COIN, my + ENC_L, COIN, h - COIN - my - ENC_L, 'd3')}
    </>
  );
}

function boucle(v, duree, retard = 0) {
  return Animated.loop(Animated.sequence([
    Animated.delay(retard),
    Animated.timing(v, { toValue: 1, duration: duree, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    Animated.timing(v, { toValue: 0, duration: duree, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
  ]));
}

// rect : { x, y, l, h } dans le repère du parent ; ecran : { l, h } ; place : 'auto' | 'haut' | 'bas' (bulle).
export default function GuideTuto({ rect, forme = 'rond', texte, onFermer, ecran, place = 'auto', zIndex = 60 }) {
  const tour = useRef(new Animated.Value(0)).current;
  const scint1 = useRef(new Animated.Value(0)).current;
  const scint2 = useRef(new Animated.Value(0)).current;
  const respire = useRef(new Animated.Value(0)).current;
  const apparition = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = Animated.loop(Animated.timing(tour, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    const a = boucle(scint1, 700); const b = boucle(scint2, 950, 300); const c = boucle(respire, 800);
    t.start(); a.start(); b.start(); c.start();
    Animated.timing(apparition, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    return () => { t.stop(); a.stop(); b.stop(); c.stop(); };
  }, []);
  if (!rect || !ecran) return null;

  const cx = rect.x + rect.l / 2; const cy = rect.y + rect.h / 2;
  // Le repère : rond (un peu plus grand que la cible, entre 64 et 210 — au banc, à 1,3 × l'œuf, l'anneau écrasait tout)
  // ou carré (la cible + une marge).
  // Taille selon la SURFACE de la cible (√(l × h) × 1,5) : un long bouton (COMBAT) n'a plus un anneau démesuré.
  const D = Math.min(210, Math.max(64, Math.round(Math.sqrt(rect.l * rect.h) * 1.5)));
  const M = 7;
  const boite = forme === 'rond'
    ? { x: cx - D / 2, y: cy - D / 2, l: D, h: D }
    : { x: rect.x - M, y: rect.y - M, l: rect.l + 2 * M, h: rect.h + 2 * M };
  // La bulle : sous le repère s'il y a la place, sinon au-dessus ; jamais hors de l'écran.
  const BL = Math.min(ecran.l - 24, 320); const BH = 60;
  const enBas = place === 'bas' || (place === 'auto' && boite.y + boite.h + 14 + BH < ecran.h - 8);
  const bulleTop = enBas ? boite.y + boite.h + 12 : Math.max(8, boite.y - 12 - BH);
  const bulleLeft = Math.max(12, Math.min(ecran.l - 12 - BL, cx - BL / 2));
  // Les étoiles SUR le rond, en haut à droite (comme le dessin de l'auteur) ; au coin haut-droit du carré.
  const etoiles = forme === 'rond' ? { x: cx + 0.707 * (D / 2), y: cy - 0.707 * (D / 2) } : { x: boite.x + boite.l, y: boite.y };

  // ⚠️ BUG RÉEL (21/10, auteur : « on ne peut pas cliquer à l'intérieur du rond ») : sur TÉLÉPHONE, `pointerEvents` n'est
  // respecté que par les VUES — une IMAGE l'ignore et prend le doigt (le banc web, lui, le respecte : 20/20 au banc, 0 sur
  // l'APK). Chaque image décorative est donc posée DANS une vue transparente au doigt ; le texte aussi.
  const deco = (style, enfant, key) => <Animated.View key={key} style={[{ position: 'absolute', zIndex, pointerEvents: 'none' }, style]}>{enfant}</Animated.View>;
  return (
    <>
      {/* Lueur dorée derrière le repère. */}
      {deco({ left: boite.x - boite.l * 0.25, top: boite.y - boite.h * 0.25, width: boite.l * 1.5, height: boite.h * 1.5,
        opacity: Animated.multiply(apparition, respire.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] })) },
        <Image source={IMG.lueur} resizeMethod="scale" resizeMode="stretch" style={{ width: boite.l * 1.5, height: boite.h * 1.5 }} />, 'lueur')}
      {forme === 'rond'
        ? deco({ left: boite.x, top: boite.y, width: boite.l, height: boite.h, opacity: apparition,
          transform: [{ rotate: tour.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
          <Image source={IMG.rond} resizeMethod="scale" resizeMode="contain" style={{ width: boite.l, height: boite.h }} />, 'rond')
        : deco({ left: boite.x, top: boite.y, width: boite.l, height: boite.h, opacity: apparition,
          transform: [{ scale: respire.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] },
          <CadreTuto l={boite.l} h={boite.h} />, 'carre')}
      {/* Les étoiles : à part du rond (elles ne tournent pas avec lui), chacune son rythme. */}
      {deco({ left: etoiles.x - 16, top: etoiles.y - 14, width: 28, height: 28,
        opacity: Animated.multiply(apparition, scint1.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })),
        transform: [{ scale: scint1.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }] },
        <Image source={IMG.etoile} resizeMethod="scale" resizeMode="contain" style={{ width: 28, height: 28 }} />, 'etoile1')}
      {deco({ left: etoiles.x + 6, top: etoiles.y + 8, width: 17, height: 17,
        opacity: Animated.multiply(apparition, scint2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })),
        transform: [{ scale: scint2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) }] },
        <Image source={IMG.etoile} resizeMethod="scale" resizeMode="contain" style={{ width: 17, height: 17 }} />, 'etoile2')}
      {/* La bulle : transparente au toucher, sauf la petite croix (le texte est dans une VUE transparente au doigt). */}
      <Animated.View style={[styles.bulle, { zIndex, left: bulleLeft, top: bulleTop, width: BL, minHeight: BH, opacity: apparition, pointerEvents: 'box-none' }]}>
        {/* Espace INSÉCABLE avant « ! ? : ; » : au banc, le « ! » partait seul à la ligne. */}
        <View style={{ pointerEvents: 'none' }}>
          <Text style={styles.texte}>{String(texte || '').replace(/ ([!?:;])/g, '\u00A0$1')}</Text>
        </View>
        <TouchableOpacity onPress={onFermer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.croix} accessibilityLabel="Fermer le conseil">
          <Text style={styles.croixTexte}>✕</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  bulle: { position: 'absolute', justifyContent: 'center', paddingVertical: 10, paddingLeft: 14, paddingRight: 24, borderRadius: 14,
    backgroundColor: 'rgba(28,16,6,0.92)', borderWidth: 2, borderColor: '#e8b33a' },
  texte: { color: '#FFF3D6', fontSize: 14, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  croix: { position: 'absolute', right: 3, top: 2, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  croixTexte: { color: 'rgba(255,243,214,0.75)', fontSize: 11, fontWeight: '900' },
});

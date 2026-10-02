import React, { useRef, useState } from 'react';
import { Image, Animated, Easing, PanResponder, StyleSheet } from 'react-native';

// ════════════════════════════════════════════════════════════════════
//  LIVRE QUI TOURNE SES PAGES — moteur COMMUN (Grimoire, Album de cartes)
// ════════════════════════════════════════════════════════════════════
// Extrait du Grimoire (02/10) pour ne pas le dupliquer. Une feuille (image de
// la page) pivote en 3D autour du dos : recto = page quittée, verso = page
// d'arrivée, ombre au passage. ⚠️ Deux faces SŒURS, pas imbriquées : sur
// téléphone, la 3D d'un parent ne se propage pas aux enfants.
// Livre = chapitres [{ planches: [[pageGauche, pageDroite], …] }, …] ;
// position = { c: chapitre, p: double page }.

export const DUREE_TOUR = 640;
export const PERSPECTIVE = 1400;

// État + gestes. `chapRef.current` = les chapitres (lus au moment du geste).
// `avantTour` : appelé au début de chaque tour (son, arrêt d'une rafale…).
export function useLivreTourne(chapRef, avantTour) {
  const [position, setPosition] = useState({ c: 0, p: 0 });
  const [tour, setTour] = useState(null); // { sens, de, vers } pendant qu'une page tourne
  const posRef = useRef(position); posRef.current = position;
  const avantRef = useRef(avantTour); avantRef.current = avantTour;
  const angle = useRef(new Animated.Value(0)).current;
  const enTour = useRef(false);
  const tourner = (vers, sens) => {
    if (enTour.current) return;
    enTour.current = true;
    if (avantRef.current) avantRef.current();
    setTour({ sens, de: posRef.current, vers });
    angle.setValue(0);
    requestAnimationFrame(() => {
      Animated.timing(angle, { toValue: 1, duration: DUREE_TOUR, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
        setPosition(vers); setTour(null); angle.setValue(0); enTour.current = false;
      });
    });
  };
  const suivante = () => {
    const { c, p } = posRef.current; const C = chapRef.current;
    if (p + 1 < C[c].planches.length) tourner({ c, p: p + 1 }, 1);
    else if (c + 1 < C.length) tourner({ c: c + 1, p: 0 }, 1);
  };
  const precedente = () => {
    const { c, p } = posRef.current; const C = chapRef.current;
    if (p > 0) tourner({ c, p: p - 1 }, -1);
    else if (c > 0) tourner({ c: c - 1, p: C[c - 1].planches.length - 1 }, -1);
  };
  const glisse = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onMoveShouldSetPanResponderCapture: (e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (e, g) => { if (g.dx < -40) suivante(); else if (g.dx > 40) precedente(); },
  })).current;
  return { position, tour, angle, tourner, suivante, precedente, glisse };
}

// Ce qui est POSÉ et ce qui TOURNE. `planche(pos)` → [pageGauche, pageDroite].
// Vers l'avant : la page de DROITE se soulève, dessous la droite d'arrivée ;
// vers l'arrière : la page de GAUCHE se soulève, dessous la gauche d'arrivée.
export function doublePage(tour, position, planche) {
  if (!tour) { const [gauche, droite] = planche(position); return { gauche, droite, faces: [] }; }
  const [dg, dd] = planche(tour.de); const [vg, vd] = planche(tour.vers);
  if (tour.sens > 0) {
    return { gauche: dg, droite: vd, faces: [{ page: dd, cote: 'droite', debut: '0deg', fin: '-180deg' }, { page: vg, cote: 'gauche', debut: '180deg', fin: '0deg' }] };
  }
  return { gauche: vg, droite: dd, faces: [{ page: dg, cote: 'gauche', debut: '0deg', fin: '180deg' }, { page: vd, cote: 'droite', debut: '-180deg', fin: '0deg' }] };
}

// Une face de feuille qui tourne : pivote autour du DOS (bord gauche d'une
// page de droite, bord droit d'une page de gauche), image de la page + contenu
// + ombre. `rect` = { x, y, l, h } de la feuille à l'écran.
export function FaceTournante({ angle, rect, cote, debut, fin, image, children }) {
  const d = cote === 'droite' ? -rect.l / 2 : rect.l / 2;
  const rot = angle.interpolate({ inputRange: [0, 1], outputRange: [debut, fin] });
  const ombre = angle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 0] });
  return (
    <Animated.View style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.l, height: rect.h, backfaceVisibility: 'hidden',
      transform: [{ perspective: PERSPECTIVE }, { translateX: d }, { rotateY: rot }, { translateX: -d }] }}>
      <Image source={image} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: rect.l, height: rect.h }} />
      {children}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a0f04', opacity: ombre, pointerEvents: 'none' }]} />
    </Animated.View>
  );
}

import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { CREATURES, stageForLevel } from '../../games/clicker/clickerLogic';
import { construireAlbum, RANG_RARETE as RANG } from '../../games/clicker/albumPages';
import CreatureArt from '../../components/CreatureArt';
import { useSettings } from '../../context/SettingsContext';
import { cardFrameForElement, CARD_FRAME_BORDER_X, CARD_FRAME_BORDER_Y } from './cardFrames';
import { useLivreTourne, doublePage, FaceTournante } from './livreTourne';
import { jouerSon } from './sonsBoutique';

// ════════════════════════════════════════════════════════════════════
//  COLLECTION EN « ALBUM DE CARTES » — 2e version, FIDÈLE À LA MAQUETTE
// ════════════════════════════════════════════════════════════════════
// Maquette : design/a-integrer/03-collection-et-deck/concepts/1790968948748.jpg
// (retour de l'auteur, 02/10 : « ce n'est pas du tout le même menu »).
// - La barre du haut (diamants, pièces, revenu, réglages) et RETOUR sont
//   ceux de l'ÉCRAN PRINCIPAL, affichés aussi sur la Collection : ce calque
//   est donc au plan 2 (sous eux), sous la barre du bas (5), le sélecteur de
//   deck (20) et la fiche d'une créature (10, posée par ClickerScreen).
// - L'ABRI du deck, LARGE, en haut ; l'ALBUM, grand, posé sur la SOUCHE ;
//   l'ORBE doré au centre de la souche, « Invoquer » et le prix dessous.
// - 8 cartes par double page, éléments mélangés (albumPages.js) ; cartes
//   hautes : icône d'élément, image, bandeau (nom, Niv., gemmes) ; inconnue =
//   SILHOUETTE dans le cadre de son élément ; onglets pointus à droite.
// Toutes les positions viennent des MESURES des images ; tailles en NOMBRES.

const { width: ECRAN_L, height: ECRAN_H } = Dimensions.get('window');
const HAUT = Math.round(ECRAN_H * 0.135); // sous la barre du haut et RETOUR
const BAS = ECRAN_H - 150; // haut de la barre du bas (mesuré)
const ONGLET_L = 50;

// ── Pièces dessinées (rapport largeur / hauteur + mesures en fractions) ──
// L'abri LARGE et la souche à l'orbe (images 74 et 75) remplacent l'abri carré
// et l'œuf au nid dès leur arrivée : il suffit de changer ces deux blocs.
const PIECE_ABRI = {
  image: require('../../../assets/collection/abri-deck.png'), rapport: 753 / 700,
  emplacements: [[0.205, 0.475, 0.38, 0.755], [0.405, 0.475, 0.595, 0.755], [0.615, 0.475, 0.80, 0.755]],
  panneau: [0.37, 0.005, 0.62, 0.09],
};
const PIECE_SOUCHE = {
  image: require('../../../assets/collection/oeuf-souche.png'), rapport: 617 / 697,
  orbe: [0.305, 0.011, 0.69, 0.373],
};

// ── Mise en page (390 × 844 de référence ; tout se recalcule) ──
const ABRI_BOITE = { x: Math.round(ECRAN_L * 0.03), y: HAUT, l: Math.round(ECRAN_L * 0.94) };
ABRI_BOITE.h = Math.round(ABRI_BOITE.l / 2.6); // proportions de l'abri de la maquette
// L'album dessiné seul est plus « plat » que sur la maquette (rapport 1,46 contre
// ~1,15) : affiché à 1,25 pour que les cartes remplissent les pages comme elle.
const R_ALBUM = 1 / 1.25;
const ALBUM = { l: Math.round(ECRAN_L - 6 - ONGLET_L + 10) };
ALBUM.h = Math.round(ALBUM.l * R_ALBUM); ALBUM.x = 6; ALBUM.y = ABRI_BOITE.y + ABRI_BOITE.h - 6;
const SOUCHE_BOITE = { y: ALBUM.y + ALBUM.h - 40 };
SOUCHE_BOITE.h = BAS - SOUCHE_BOITE.y; SOUCHE_BOITE.l = Math.round(ECRAN_L * 0.92); SOUCHE_BOITE.x = Math.round((ECRAN_L - SOUCHE_BOITE.l) / 2);

// Image posée « contain » dans une boîte (centrée en largeur, calée en bas si demandé).
function poser(boite, rapport, enBas) {
  let l = boite.l; let h = Math.round(l / rapport);
  if (h > boite.h) { h = boite.h; l = Math.round(h * rapport); }
  return { x: boite.x + Math.round((boite.l - l) / 2), y: enBas ? boite.y + boite.h - h : boite.y + Math.round((boite.h - h) / 2), l, h };
}
const frac = (R, [x0, y0, x1, y1]) => ({ x: Math.round(R.x + x0 * R.l), y: Math.round(R.y + y0 * R.h), l: Math.round((x1 - x0) * R.l), h: Math.round((y1 - y0) * R.h) });
const ABRI = poser(ABRI_BOITE, PIECE_ABRI.rapport, false);
const SOUCHE = poser(SOUCHE_BOITE, PIECE_SOUCHE.rapport, true);
const FEUILLE = { gauche: frac(ALBUM, [0.1459, 0.0104, 0.5351, 0.9125]), droite: frac(ALBUM, [0.5351, 0.0104, 0.9213, 0.9125]) };
const ZONE = { gauche: frac(ALBUM, [0.162, 0.03, 0.5, 0.895]), droite: frac(ALBUM, [0.571, 0.03, 0.914, 0.895]) };

// ── Cartes : cadre de l'élément (rapport 0,76) + bandeau sous le cadre ──
const RAPPORT_CADRE = 0.76;
const BANDEAU = 0.6; // hauteur du bandeau / largeur de la carte
const hauteurCarte = (l) => Math.round(l / RAPPORT_CADRE) + Math.round(l * BANDEAU);
const ELEMENT = {
  Feu: { emoji: '🔥', couleur: '#c2410c' }, Eau: { emoji: '💧', couleur: '#2563eb' }, Terre: { emoji: '🌿', couleur: '#4d7c0f' },
  Air: { emoji: '🌪️', couleur: '#cbd5e1', sombre: true }, Foudre: { emoji: '⚡', couleur: '#3730a3' }, 'Lumière': { emoji: '☀️', couleur: '#ca8a04', sombre: true },
  'Ténèbres': { emoji: '🌑', couleur: '#3f3f46' }, Magie: { emoji: '🔮', couleur: '#7e22ce' },
};
const ONGLETS = [['Feu', 'FEU'], ['Eau', 'EAU'], ['Terre', 'TERRE'], ['Air', 'AIR'], ['Foudre', 'FOUDRE'], ['Lumière', 'LUMIÈRE'], ['Ténèbres', 'TÉNÈBRES'], ['Magie', 'MAGIE']];

const IMG = {
  fond: require('../../../assets/menu/fond.jpg'),
  album: require('../../../assets/collection/album.png'),
  feuille: { gauche: require('../../../assets/collection/album-feuille-gauche.png'), droite: require('../../../assets/collection/album-feuille-droite.png') },
  vide: require('../../../assets/collection/emplacement-vide.png'),
  lueur: require('../../../assets/grimoire/lueur-or.png'),
};
const GEMMES = {
  commun: require('../../../assets/collection/gemme-commun.png'),
  peu_commun: require('../../../assets/collection/gemme-peu_commun.png'),
  rare: require('../../../assets/collection/gemme-rare.png'),
  epique: require('../../../assets/collection/gemme-epique.png'),
  legendaire: require('../../../assets/collection/gemme-legendaire.png'),
  mythique: require('../../../assets/collection/gemme-mythique.png'),
};

function Gemmes({ rarete, taille }) {
  const n = RANG[rarete] || 1;
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: n }).map((_, i) => (
        <Image key={i} source={GEMMES[rarete] || GEMMES.commun} resizeMode="contain" style={{ width: taille, height: Math.round(taille * 1.4), marginLeft: i ? 1 : 0 }} />
      ))}
    </View>
  );
}

// Une carte : cadre de l'élément, icône de l'élément, image (ou SILHOUETTE « ? »
// si inconnue), et sous le cadre un bandeau : nom, Niv., gemmes.
function Carte({ creature, own, l, onPress }) {
  const fh = Math.round(l / RAPPORT_CADRE); const bh = Math.round(l * BANDEAU);
  const decouverte = !!own;
  const stade = decouverte ? stageForLevel(own.level) : 0;
  const d = creature.stages[stade] || creature.stages[0];
  const cadre = cardFrameForElement(creature.element);
  const el = ELEMENT[creature.element] || { emoji: '✨', couleur: '#6b5a3a' };
  const bx = Math.round(l * CARD_FRAME_BORDER_X); const by = Math.round(fh * CARD_FRAME_BORDER_Y);
  const art = Math.min(l - 2 * bx, fh - 2 * by);
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} disabled={!onPress} style={{ width: l }}>
      <View style={{ width: l, height: fh }}>
        <View style={[styles.fenetre, { left: bx, top: by, width: l - 2 * bx, height: fh - 2 * by }]}>
          <CreatureArt creatureId={creature.id} stageIndex={stade} emoji={decouverte ? d.emoji : ''} size={art}
            style={decouverte ? null : styles.silhouette} emojiStyle={{ fontSize: Math.round(art * 0.6) }} />
          {decouverte ? null : <Text style={[styles.inconnue, { fontSize: Math.round(art * 0.5) }]}>?</Text>}
        </View>
        {cadre ? <Image source={cadre} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: l, height: fh }} /> : null}
        <View style={[styles.icone, { backgroundColor: el.couleur }]}><Text style={styles.iconeTexte}>{el.emoji}</Text></View>
      </View>
      <View style={[styles.bandeau, { height: bh, borderColor: el.couleur }]}>
        <Text style={styles.nom} numberOfLines={1}>{decouverte ? d.name : '???'}</Text>
        {decouverte ? <Text style={styles.niv}>Niv. {own.level}</Text> : null}
        <Gemmes rarete={creature.rarity} taille={5} />
      </View>
    </TouchableOpacity>
  );
}

function Album(props) {
  const { owned = [], deck = [null, null, null], coins = 0, nextSummonCost = 0, formatNum = (n) => String(Math.round(n)) } = props;
  const { sons } = useSettings();
  const sonsRef = useRef(sons); sonsRef.current = sons;
  const ownedMap = useMemo(() => Object.fromEntries(owned.map((o) => [o.id, o])), [owned]);
  const { chapitres, debut } = useMemo(() => construireAlbum(), []);
  const chapRef = useRef(chapitres); chapRef.current = chapitres;
  const { position, tour, angle, tourner, glisse } = useLivreTourne(chapRef, () => jouerSon('page', sonsRef.current));
  const planche = (pos) => { const P = chapitres[0].planches; return P[Math.min(pos.p, P.length - 1)] || [null, null]; };
  const dp = doublePage(tour, position, planche);
  const pCourante = (tour ? tour.vers : position).p;

  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const b = Animated.loop(Animated.sequence([
      Animated.timing(halo, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(halo, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, []);

  // 4 cartes (2 × 2) centrées dans la zone de la page, sans titre (maquette).
  const contenu = (page, cote) => {
    if (!page) return null;
    const z = ZONE[cote]; const f = FEUILLE[cote];
    const ecart = 5;
    const l = Math.floor(Math.min((z.l - 3 * ecart) / 2, (z.h - 3 * ecart) / 2 / (1 / RAPPORT_CADRE + BANDEAU)));
    return (
      <View style={[styles.page, { left: z.x - f.x, top: z.y - f.y, width: z.l, height: z.h, rowGap: ecart, columnGap: ecart }]}>
        {page.ids.map((id) => {
          const c = CREATURES.find((x) => x.id === id); const own = ownedMap[id];
          return <Carte key={id} creature={c} own={own} l={l} onPress={own ? () => props.setSelectedCreature && props.setSelectedCreature(id) : null} />;
        })}
      </View>
    );
  };
  const pagePosee = (page, cote) => (
    <View key={'posee-' + cote} style={{ position: 'absolute', left: FEUILLE[cote].x, top: FEUILLE[cote].y, width: FEUILLE[cote].l, height: FEUILLE[cote].h }} {...glisse.panHandlers}>
      {contenu(page, cote)}
    </View>
  );

  const peutInvoquer = coins >= nextSummonCost;
  const invoquer = () => (peutInvoquer && props.onSummon ? props.onSummon() : null);
  const orbe = frac(SOUCHE, PIECE_SOUCHE.orbe);
  const haloL = Math.round(Math.max(orbe.l, orbe.h) * 2.4);
  const panneau = frac({ x: 0, y: 0, l: ABRI.l, h: ABRI.h }, PIECE_ABRI.panneau);
  return (
    <View style={styles.racine}>
      <ImageBackground source={IMG.fond} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,10,12,0.25)' }]} />
      </ImageBackground>

      {/* ── La souche (derrière l'album, qui repose dessus) et l'orbe doré. */}
      <Animated.Image source={IMG.lueur} resizeMode="stretch" style={{ position: 'absolute', left: orbe.x + orbe.l / 2 - haloL / 2, top: orbe.y + orbe.h / 2 - haloL / 2, width: haloL, height: haloL, pointerEvents: 'none',
        opacity: halo.interpolate({ inputRange: [0, 1], outputRange: peutInvoquer ? [0.6, 1] : [0.2, 0.35] }), transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }] }} />
      <TouchableOpacity activeOpacity={0.85} onPress={invoquer} style={{ position: 'absolute', left: SOUCHE.x, top: SOUCHE.y, width: SOUCHE.l, height: SOUCHE.h }}>
        <Image source={PIECE_SOUCHE.image} resizeMode="stretch" style={{ width: SOUCHE.l, height: SOUCHE.h }} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.85} onPress={invoquer} style={[styles.invoquer, { top: BAS - 64 }]}>
        <Text style={styles.invoquerTexte}>Invoquer</Text>
        <Text style={[styles.prixTexte, !peutInvoquer && styles.prixCher]}>{formatNum(nextSummonCost)} Po</Text>
      </TouchableOpacity>

      {/* ── L'abri du deck : le VRAI deck ; toucher un emplacement ouvre le sélecteur. */}
      <View style={{ position: 'absolute', left: ABRI.x, top: ABRI.y, width: ABRI.l, height: ABRI.h }}>
        <Image source={PIECE_ABRI.image} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: ABRI.l, height: ABRI.h }} />
        <View style={[styles.panneau, { left: panneau.x, top: panneau.y, width: panneau.l, height: panneau.h }]}>
          <Text style={styles.panneauTexte}>DECK</Text>
        </View>
        {PIECE_ABRI.emplacements.map((e, i) => {
          const r = frac({ x: 0, y: 0, l: ABRI.l, h: ABRI.h }, e);
          const id = deck[i]; const c = id ? CREATURES.find((x) => x.id === id) : null; const own = id ? ownedMap[id] : null;
          const l = Math.floor(Math.min(r.l, r.h / (1 / RAPPORT_CADRE + BANDEAU)));
          return (
            <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => props.onOuvrirEmplacement && props.onOuvrirEmplacement(i)}
              style={{ position: 'absolute', left: r.x, top: r.y, width: r.l, height: r.h, alignItems: 'center', justifyContent: 'center' }}>
              {/* pointerEvents dans le STYLE (règle SDK 57 : la propriété est ignorée). */}
              {c && own ? <View style={{ pointerEvents: 'none' }}><Carte creature={c} own={own} l={l} /></View>
                : <Image source={IMG.vide} resizeMode="stretch" style={{ width: r.l, height: r.h }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── L'album : pages posées + feuilles qui tournent (moteur commun). */}
      <View style={{ position: 'absolute', left: ALBUM.x, top: ALBUM.y, width: ALBUM.l, height: ALBUM.h }} {...glisse.panHandlers}>
        <Image source={IMG.album} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: ALBUM.l, height: ALBUM.h }} />
      </View>
      {pagePosee(dp.gauche, 'gauche')}
      {pagePosee(dp.droite, 'droite')}
      {dp.faces.map((f) => (
        <FaceTournante key={'face-' + f.cote} angle={angle} rect={FEUILLE[f.cote]} cote={f.cote} debut={f.debut} fin={f.fin} image={IMG.feuille[f.cote]}>
          {contenu(f.page, f.cote)}
        </FaceTournante>
      ))}

      {/* ── Onglets d'éléments, pointus, collés au bord droit de l'album. */}
      {ONGLETS.map(([cle, nom], i) => {
        const pas = (ALBUM.h * 0.84) / ONGLETS.length; const h = Math.round(pas - 3);
        const el = ELEMENT[cle]; const dest = debut[cle];
        const ici = dest === pCourante;
        return (
          <TouchableOpacity key={cle} activeOpacity={0.8} disabled={dest === undefined}
            onPress={() => { if (dest !== undefined && dest !== pCourante) tourner({ c: 0, p: dest }, dest > pCourante ? 1 : -1); }}
            style={[styles.onglet, { left: ALBUM.x + ALBUM.l - 12 + (ici ? 3 : 0), top: Math.round(ALBUM.y + ALBUM.h * 0.07 + i * pas), height: h, opacity: dest === undefined ? 0.45 : 1 }]}>
            <View style={[styles.ongletCorps, { backgroundColor: el.couleur }]}>
              <View style={[styles.ongletReflet, { height: Math.round(h * 0.42) }]} />
              <Text style={[styles.ongletTexte, nom.length > 6 && styles.ongletTexteLong, el.sombre && styles.ongletTexteSombre]} numberOfLines={1}>{nom}</Text>
            </View>
            <View style={{ width: 0, height: 0, borderTopWidth: h / 2, borderBottomWidth: h / 2, borderLeftWidth: 7, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: el.couleur }} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Filet de sécurité : si l'album plante, l'ancienne Collection s'affiche ──
class FiletAlbum extends React.Component {
  constructor(p) { super(p); this.state = { erreur: null }; }
  static getDerivedStateFromError(erreur) { return { erreur }; }
  componentDidCatch(erreur) { try { console.warn('Album de la Collection en erreur :', erreur && erreur.message); } catch (e) {} }
  render() { return this.state.erreur ? this.props.secours : this.props.children; }
}
export default function CollectionAlbum({ Secours, ...props }) {
  return (
    <FiletAlbum secours={Secours ? <Secours {...props} /> : null}>
      <Album {...props} />
    </FiletAlbum>
  );
}

const styles = StyleSheet.create({
  // Plan 2 : sous la barre du haut de l'écran principal (3-4), la barre du bas (5),
  // la fiche (10) et le sélecteur de deck (20).
  racine: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 2, overflow: 'hidden', backgroundColor: '#061018' },
  page: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center' },
  fenetre: { position: 'absolute', backgroundColor: 'rgba(20,14,8,0.5)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 3 },
  silhouette: { tintColor: '#140c05', opacity: 0.92 },
  inconnue: { position: 'absolute', color: '#e8c56a', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3, includeFontPadding: false },
  icone: { position: 'absolute', left: -3, top: -3, width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: '#f3e2b0', alignItems: 'center', justifyContent: 'center' },
  iconeTexte: { fontSize: 8, includeFontPadding: false },
  bandeau: { marginTop: -2, borderWidth: 1.5, borderTopWidth: 0, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, backgroundColor: 'rgba(28,18,8,0.92)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1 },
  nom: { color: '#fff6dc', fontSize: 8, fontWeight: '900', includeFontPadding: false, maxWidth: '100%' },
  niv: { color: '#ffd66b', fontSize: 7, fontWeight: '800', includeFontPadding: false, marginBottom: 1 },
  panneau: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  panneauTexte: { color: '#fff1cf', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, textShadowColor: 'rgba(40,20,0,0.95)', textShadowRadius: 3, includeFontPadding: false },
  onglet: { position: 'absolute', width: ONGLET_L, flexDirection: 'row' },
  ongletCorps: { flex: 1, justifyContent: 'center', paddingLeft: 9, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, overflow: 'hidden' },
  ongletReflet: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: 'rgba(255,255,255,0.18)' },
  ongletTexte: { color: '#ffffff', fontSize: 8, fontWeight: '900', letterSpacing: 0.4, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 2, includeFontPadding: false },
  ongletTexteLong: { fontSize: 6.5, letterSpacing: 0 },
  ongletTexteSombre: { color: '#2b2416', textShadowColor: 'rgba(255,255,255,0.55)' },
  invoquer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  invoquerTexte: { color: '#ffffff', fontSize: 22, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, includeFontPadding: false },
  prixTexte: { color: '#ffd24a', fontSize: 20, fontWeight: '900', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 5, includeFontPadding: false },
  prixCher: { color: '#b9b0a0' },
});

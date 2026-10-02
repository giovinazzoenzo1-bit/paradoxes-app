import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { CREATURES, stageForLevel } from '../../games/clicker/clickerLogic';
import { construireAlbum, RANG_RARETE as RANG } from '../../games/clicker/albumPages';
import CreatureArt from '../../components/CreatureArt';
import BackButton from '../../components/BackButton';
import { useSettings } from '../../context/SettingsContext';
import { cardFrameForElement, CARD_FRAME_BORDER_X, CARD_FRAME_BORDER_Y } from './cardFrames';
import { useLivreTourne, doublePage, FaceTournante } from './livreTourne';
import { jouerSon } from './sonsBoutique';
import { CRISTAL } from './fenetreBois';
import { ICONES } from './grimoireIcones';

// ════════════════════════════════════════════════════════════════════
//  COLLECTION EN « ALBUM DE CARTES » (02/10, concept retenu par l'auteur)
// ════════════════════════════════════════════════════════════════════
// Maquette : design/a-integrer/03-collection-et-deck/concepts/1790968948748.jpg.
// - En haut, l'ABRI du deck : le VRAI deck (3 emplacements) ; toucher un
//   emplacement ouvre le sélecteur habituel (DeckPicker de ClickerScreen).
// - L'ALBUM : une page par élément (4 cartes par page), deux pages par double
//   page ; les pages tournent en 3D avec le moteur COMMUN (livreTourne.js).
// - Les RUBANS d'éléments, à droite, sautent à la page de l'élément.
// - L'ŒUF doré invoque une créature (prix affiché, grisé si trop cher).
// Toutes les positions viennent des MESURES des images
// (assets/collection/mesures.json) ; tailles et positions en NOMBRES.
// Logique NON dupliquée : stade = stageForLevel, image = CreatureArt, cadre =
// cardFrameForElement, fiche = CreatureDetail (passée par ClickerScreen).

const { width: ECRAN_L, height: ECRAN_H } = Dimensions.get('window');
const HAUT = 126; // sous les soldes
const BAS = ECRAN_H - 152; // haut de la barre du bas (~150 pts, mesuré)
const R_ABRI = 700 / 753;
const R_ALBUM = 480 / 699;
const R_OEUF = 697 / 617;
const RUBAN_MARGE = 42; // place des rubans à droite de l'album
const CHEVAUCHE = 10; // l'album recouvre un peu le pied de l'abri
const RAPPORT_CARTE = 0.76; // largeur / hauteur des cadres de cartes
// Mise à l'échelle : tout tient entre les soldes et la barre du bas.
const BESOIN = ECRAN_L * 0.6 * R_ABRI + (ECRAN_L - 12 - RUBAN_MARGE) * R_ALBUM + 96 - CHEVAUCHE;
const K = Math.min(1, (BAS - HAUT) / BESOIN);
const ABRI = { l: Math.round(ECRAN_L * 0.6 * K) };
ABRI.h = Math.round(ABRI.l * R_ABRI); ABRI.x = Math.round((ECRAN_L - ABRI.l) / 2); ABRI.y = HAUT;
const ALBUM = { l: Math.round((ECRAN_L - 12 - RUBAN_MARGE) * K) };
ALBUM.h = Math.round(ALBUM.l * R_ALBUM); ALBUM.x = Math.round((ECRAN_L - RUBAN_MARGE - ALBUM.l) / 2) + 4; ALBUM.y = ABRI.y + ABRI.h - CHEVAUCHE;
const OEUF = { h: Math.round(96 * K) };
OEUF.l = Math.round(OEUF.h / R_OEUF); OEUF.x = Math.round(ECRAN_L / 2 - OEUF.l + 4); OEUF.y = ALBUM.y + ALBUM.h + 2;

// Rectangle mesuré (fractions x0, y0, x1, y1) d'une pièce posée en R.
const frac = (R, [x0, y0, x1, y1]) => ({ x: Math.round(R.x + x0 * R.l), y: Math.round(R.y + y0 * R.h), l: Math.round((x1 - x0) * R.l), h: Math.round((y1 - y0) * R.h) });
const FEUILLE = { gauche: frac(ALBUM, [0.1459, 0.0104, 0.5351, 0.9125]), droite: frac(ALBUM, [0.5351, 0.0104, 0.9213, 0.9125]) };
// Zone des cartes : la page de parchemin mesurée, moins une marge.
const ZONE = { gauche: frac(ALBUM, [0.175, 0.045, 0.49, 0.885]), droite: frac(ALBUM, [0.58, 0.045, 0.902, 0.885]) };
const EMPLACEMENTS = [[0.205, 0.475, 0.38, 0.755], [0.405, 0.475, 0.595, 0.755], [0.615, 0.475, 0.80, 0.755]];
const PANNEAU = [0.37, 0.005, 0.62, 0.09];
const OEUF_FORME = [0.305, 0.011, 0.69, 0.373]; // l'œuf dans son image (centre du halo)
const TITRE_H = 16;
const LEGENDE_H = 22; // nom + niveau / gemmes sous la carte

const IMG = {
  fond: require('../../../assets/menu/fond.jpg'),
  plaque: require('../../../assets/fenetres/plaque-solde.png'),
  album: require('../../../assets/collection/album.png'),
  feuille: { gauche: require('../../../assets/collection/album-feuille-gauche.png'), droite: require('../../../assets/collection/album-feuille-droite.png') },
  abri: require('../../../assets/collection/abri-deck.png'),
  oeuf: require('../../../assets/collection/oeuf-souche.png'),
  dos: require('../../../assets/collection/dos-carte.png'),
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
// Visuels des rubans, dans l'ORDRE de albumPages.ORDRE_ELEMENTS ; `cle` = élément du jeu.
const ELEMENTS = [
  { cle: 'Feu', nom: 'FEU', ruban: require('../../../assets/collection/ruban-feu.png'), couleur: '#b4380c' },
  { cle: 'Eau', nom: 'EAU', ruban: require('../../../assets/collection/ruban-eau.png'), couleur: '#1c64a8' },
  { cle: 'Terre', nom: 'TERRE', ruban: require('../../../assets/collection/ruban-terre.png'), couleur: '#4a7310' },
  { cle: 'Air', nom: 'AIR', ruban: require('../../../assets/collection/ruban-air.png'), couleur: '#5d6b7a', sombre: true },
  { cle: 'Foudre', nom: 'FOUDRE', ruban: require('../../../assets/collection/ruban-foudre.png'), couleur: '#312e91' },
  { cle: 'Lumière', nom: 'LUMIÈRE', ruban: require('../../../assets/collection/ruban-lumiere.png'), couleur: '#946005', sombre: true },
  { cle: 'Ténèbres', nom: 'TÉNÈBRES', ruban: require('../../../assets/collection/ruban-tenebres.png'), couleur: '#3a2a49' },
  { cle: 'Magie', nom: 'MAGIE', ruban: require('../../../assets/collection/ruban-magie.png'), couleur: '#7323b8' },
];

// Pages de l'album : games/clicker/albumPages.js (pur, contrôlé par auditAlbumComplet).

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

// Une carte : cadre de l'élément + image de la créature (découverte), ou dos
// de carte (inconnue). `sansLegende` : dans l'abri du deck.
function Carte({ creature, own, largeur, onPress, sansLegende }) {
  const h = Math.round(largeur / RAPPORT_CARTE);
  const decouverte = !!own;
  const stade = decouverte ? stageForLevel(own.level) : 0;
  const d = creature.stages[stade] || creature.stages[0];
  const cadre = cardFrameForElement(creature.element);
  const bx = Math.round(largeur * CARD_FRAME_BORDER_X);
  const by = Math.round(h * CARD_FRAME_BORDER_Y);
  const art = Math.min(largeur - 2 * bx, h - 2 * by);
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} disabled={!onPress} style={{ width: largeur, alignItems: 'center' }}>
      <View style={{ width: largeur, height: h }}>
        {decouverte ? (
          <>
            <View style={[styles.fenetre, { left: bx, top: by, width: largeur - 2 * bx, height: h - 2 * by }]}>
              <CreatureArt creatureId={creature.id} stageIndex={stade} emoji={d.emoji} size={art} emojiStyle={{ fontSize: Math.round(art * 0.6) }} />
            </View>
            {cadre ? <Image source={cadre} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: largeur, height: h }} /> : null}
          </>
        ) : (
          <Image source={IMG.dos} resizeMode="stretch" style={{ width: largeur, height: h }} />
        )}
        {/* Niveau en BADGE dans le coin (sous la carte, « Nv 12 » + gemmes ne
            tenaient pas sur une ligne : la case grandissait et écrasait le titre). */}
        {decouverte ? <View style={styles.badgeNiveau}><Text style={styles.badgeNiveauTexte}>{own.level}</Text></View> : null}
      </View>
      {sansLegende ? null : (
        <>
          <Text style={styles.nom} numberOfLines={1}>{decouverte ? d.name : '???'}</Text>
          <View style={styles.legende}>
            <Gemmes rarete={creature.rarity} taille={6} />
          </View>
        </>
      )}
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
  const affichee = planche(tour ? tour.vers : position);
  const elementsVisibles = affichee.filter(Boolean).map((pg) => pg.element);

  // Halo de l'œuf qui respire.
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const b = Animated.loop(Animated.sequence([
      Animated.timing(halo, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(halo, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, []);

  // Contenu d'une page (titre de l'élément + jusqu'à 4 cartes), posé dans sa feuille.
  const contenu = (page, cote) => {
    if (!page) return null;
    const z = ZONE[cote]; const f = FEUILLE[cote];
    const el = ELEMENTS.find((e) => e.cle === page.element);
    const largeur = Math.floor(Math.min((z.l - 6) / 2, ((z.h - TITRE_H - 4) / 2 - LEGENDE_H) * RAPPORT_CARTE));
    return (
      <View style={{ position: 'absolute', left: z.x - f.x, top: z.y - f.y, width: z.l, height: z.h }}>
        <Text style={[styles.titrePage, { color: el ? el.couleur : '#3b2a14' }]} numberOfLines={1}>{el ? el.nom : page.element}</Text>
        <View style={styles.grille}>
          {page.ids.map((id) => {
            const c = CREATURES.find((x) => x.id === id);
            const own = ownedMap[id];
            return (
              <View key={id} style={{ width: (z.l - 6) / 2, alignItems: 'center', marginBottom: 4 }}>
                <Carte creature={c} own={own} largeur={largeur} onPress={own ? () => props.setSelectedCreature && props.setSelectedCreature(id) : null} />
              </View>
            );
          })}
        </View>
      </View>
    );
  };
  const pagePosee = (page, cote) => (
    <View key={'posee-' + cote} style={{ position: 'absolute', left: FEUILLE[cote].x, top: FEUILLE[cote].y, width: FEUILLE[cote].l, height: FEUILLE[cote].h }} {...glisse.panHandlers}>
      {contenu(page, cote)}
    </View>
  );

  const peutInvoquer = coins >= nextSummonCost;
  const oeuf = frac(OEUF, OEUF_FORME);
  const haloL = Math.round(oeuf.l * 2.2);
  const fiche = props.selectedCreature && ownedMap[props.selectedCreature] ? props.selectedCreature : null;
  const Fiche = props.FicheCreature;
  return (
    <View style={styles.racine}>
      <ImageBackground source={IMG.fond} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,10,12,0.3)' }]} />
      </ImageBackground>

      {/* ── L'abri du deck : le VRAI deck ; toucher un emplacement ouvre le sélecteur. */}
      <View style={{ position: 'absolute', left: ABRI.x, top: ABRI.y, width: ABRI.l, height: ABRI.h }}>
        <Image source={IMG.abri} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: ABRI.l, height: ABRI.h }} />
        <View style={[styles.panneau, { left: PANNEAU[0] * ABRI.l, top: PANNEAU[1] * ABRI.h, width: (PANNEAU[2] - PANNEAU[0]) * ABRI.l, height: (PANNEAU[3] - PANNEAU[1]) * ABRI.h }]}>
          <Text style={styles.panneauTexte}>DECK</Text>
        </View>
        {EMPLACEMENTS.map((e, i) => {
          const r = frac({ x: 0, y: 0, l: ABRI.l, h: ABRI.h }, e);
          const id = deck[i];
          const c = id ? CREATURES.find((x) => x.id === id) : null;
          const own = id ? ownedMap[id] : null;
          return (
            <TouchableOpacity key={i} activeOpacity={0.75} onPress={() => props.onOuvrirEmplacement && props.onOuvrirEmplacement(i)}
              style={{ position: 'absolute', left: r.x, top: r.y, width: r.l, height: r.h, alignItems: 'center', justifyContent: 'center' }}>
              {c && own ? <Carte creature={c} own={own} largeur={Math.min(r.l, Math.round(r.h * RAPPORT_CARTE))} sansLegende />
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

      {/* ── Rubans d'éléments : sautent à la page de l'élément. */}
      {ELEMENTS.map((el, i) => {
        const pas = Math.min(26, (ALBUM.h * 0.9) / ELEMENTS.length);
        const actif = elementsVisibles.includes(el.cle);
        const x = ALBUM.x + ALBUM.l - 16 + (actif ? 6 : 0);
        const l = Math.max(30, ECRAN_L - x - 2);
        const dest = debut[el.cle];
        return (
          <TouchableOpacity key={el.cle} activeOpacity={0.8} disabled={dest === undefined}
            onPress={() => { const p = (tour ? tour.vers : position).p; if (dest !== undefined && dest !== p) tourner({ c: 0, p: dest }, dest > p ? 1 : -1); }}
            style={[styles.ruban, { left: x, top: ALBUM.y + ALBUM.h * 0.05 + i * pas, width: l, height: pas - 2, opacity: dest === undefined ? 0.45 : actif ? 1 : 0.88 }]}>
            <Image source={el.ruban} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: l, height: pas - 2 }} />
            <Text style={[styles.rubanTexte, el.nom.length > 6 && styles.rubanTexteLong, el.sombre && { color: '#2b2416', textShadowColor: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>{el.nom}</Text>
          </TouchableOpacity>
        );
      })}

      {/* ── L'œuf doré : invoquer une créature. Halo fait par le code (dégradé). */}
      <Animated.Image source={IMG.lueur} resizeMode="stretch" style={{ position: 'absolute', left: oeuf.x + oeuf.l / 2 - haloL / 2, top: oeuf.y + oeuf.h / 2 - haloL / 2, width: haloL, height: haloL, pointerEvents: 'none',
        opacity: halo.interpolate({ inputRange: [0, 1], outputRange: peutInvoquer ? [0.55, 0.95] : [0.2, 0.35] }), transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) }] }} />
      <TouchableOpacity activeOpacity={0.8} onPress={() => (peutInvoquer && props.onSummon ? props.onSummon() : null)}
        style={{ position: 'absolute', left: OEUF.x, top: OEUF.y, width: OEUF.l, height: OEUF.h }}>
        <Image source={IMG.oeuf} resizeMode="stretch" style={{ width: OEUF.l, height: OEUF.h }} />
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} onPress={() => (peutInvoquer && props.onSummon ? props.onSummon() : null)}
        style={[styles.invoquer, { left: OEUF.x + OEUF.l + 6, top: OEUF.y + OEUF.h * 0.32 }]}>
        <Text style={styles.invoquerTexte}>Invoquer</Text>
        <View style={[styles.prix, peutInvoquer ? styles.prixOk : styles.prixCher]}>
          <Image source={ICONES.piece} resizeMode="contain" style={{ width: 14, height: 14, marginRight: 4 }} />
          <Text style={styles.prixTexte}>{formatNum(nextSummonCost)}</Text>
        </View>
      </TouchableOpacity>

      {/* ── En-tête : RETOUR et les soldes, en deux éléments séparés (pas de bande plein écran). */}
      <BackButton onPress={props.onRetour} style={{ position: 'absolute', left: 12, top: 40 }} />
      <View style={[styles.soldes, { pointerEvents: 'none' }]}>
        <View style={styles.plaque}>
          <Image source={IMG.plaque} resizeMode="stretch" style={styles.plaqueImg} />
          <Image source={ICONES.piece} resizeMode="contain" style={{ width: 20, height: 20, marginRight: 5 }} />
          <Text style={styles.plaqueTexte} numberOfLines={1}>{formatNum(coins)}</Text>
        </View>
        <View style={styles.plaque}>
          <Image source={IMG.plaque} resizeMode="stretch" style={styles.plaqueImg} />
          <Image source={CRISTAL} resizeMode="contain" style={{ width: 12, height: 22, marginRight: 6 }} />
          <Text style={styles.plaqueTexte} numberOfLines={1}>{props.sharedCoins || 0}</Text>
        </View>
      </View>

      {fiche && Fiche ? (
        <Fiche creature={CREATURES.find((c) => c.id === fiche)} owned={ownedMap[fiche]} coins={coins}
          onClose={() => props.setSelectedCreature && props.setSelectedCreature(null)} pendingDiscount={props.pendingDiscount} />
      ) : null}
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
  // Plein écran, sous la barre de navigation (zIndex 5) et le sélecteur de deck (zIndex 20).
  racine: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 4, overflow: 'hidden', backgroundColor: '#061018' },
  fenetre: { position: 'absolute', backgroundColor: 'rgba(20,14,8,0.5)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 3 },
  nom: { color: '#3b2a14', fontSize: 8.5, fontWeight: '900', marginTop: 1, maxWidth: '100%', includeFontPadding: false },
  legende: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  badgeNiveau: { position: 'absolute', left: -4, top: -4, minWidth: 16, height: 14, paddingHorizontal: 3, borderRadius: 7, backgroundColor: '#3b2a14', borderWidth: 1, borderColor: '#e2b04a', alignItems: 'center', justifyContent: 'center' },
  badgeNiveauTexte: { color: '#ffe9b0', fontSize: 8, fontWeight: '900', includeFontPadding: false },
  // flexShrink 0 : le titre ne peut plus être écrasé si la page déborde.
  titrePage: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textAlign: 'center', height: TITRE_H, flexShrink: 0, includeFontPadding: false },
  grille: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  panneau: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  panneauTexte: { color: '#fff1cf', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, textShadowColor: 'rgba(40,20,0,0.95)', textShadowRadius: 3, includeFontPadding: false },
  ruban: { position: 'absolute', justifyContent: 'center', paddingLeft: 13 },
  rubanTexte: { color: '#ffffff', fontSize: 8, fontWeight: '900', letterSpacing: 0.6, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 2, includeFontPadding: false },
  rubanTexteLong: { fontSize: 6.5, letterSpacing: 0 },
  invoquer: { position: 'absolute', alignItems: 'flex-start' },
  invoquerTexte: { color: '#fff4d6', fontSize: 16, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4, includeFontPadding: false },
  prix: { flexDirection: 'row', alignItems: 'center', height: 22, paddingHorizontal: 8, marginTop: 4, borderRadius: 11, borderWidth: 1.5 },
  prixOk: { backgroundColor: '#8a2a1c', borderColor: '#e8b84a' },
  prixCher: { backgroundColor: '#9a9182', borderColor: '#c4baa8' },
  prixTexte: { color: '#fff4d6', fontSize: 11, fontWeight: '900', includeFontPadding: false },
  soldes: { position: 'absolute', right: 12, top: 40, width: 124, gap: 6, alignItems: 'flex-end' },
  plaque: { width: 124, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  plaqueImg: { position: 'absolute', left: 0, top: 0, width: 124, height: 38 },
  plaqueTexte: { color: '#ffe38a', fontSize: 14, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
});

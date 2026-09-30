import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, PanResponder, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { CHAPITRES_GRIMOIRE } from '../../games/clicker/grimoireChapitres';
import { useSettings } from '../../context/SettingsContext';
import { vibrerSucces, CRISTAL, CYAN_CHAMPIGNON } from './fenetreBois';
import { construireNoeuds, FicheElement } from './ArbreBoutique';
import BackButton from '../../components/BackButton';

// ════════════════════════════════════════════════════════════════════
//  BOUTIQUE EN GRIMOIRE (27/09, choix de l'auteur après l'arbre)
// ════════════════════════════════════════════════════════════════════
// Un livre ouvert : à gauche le chapitre illustré, à droite ses éléments ;
// marque-pages par chapitre ; pages tournées au glisser. Images Gemini de
// l'auteur (assets/grimoire/, pièces 56-61).
//
// ⚠️ Économie INCHANGÉE et logique NON dupliquée : le modèle des éléments
// (prix, gains, états, achats, verrous) est celui de l'arbre
// (construireNoeuds), déjà vérifié ; on ignore seulement ses positions.
// La fiche détaillée (FicheElement) est partagée avec l'arbre.
//
// ⚠️ Tailles et positions en NOMBRES (règle du 27/09). Les zones d'écriture
// des pages sont MESURÉES sur l'image du livre (parchemin dans les cadres
// ornementaux) : chacune ne fait que 28 % de la largeur du livre, d'où un
// livre affiché 1,18 × plus large que l'écran (seules les couvertures
// dépassent) et les marque-pages sur la tranche HAUTE (à droite, ils
// sortiraient de l'écran).

const { width: ECRAN_L, height: ECRAN_H } = Dimensions.get('window');
const LIVRE_L = Math.round(ECRAN_L * 1.18);
const LIVRE_H = Math.round((LIVRE_L * 807) / 900);
const LIVRE_X = Math.round((ECRAN_L - LIVRE_L) / 2);
const LIVRE_Y = 168;
// Zones d'écriture mesurées (fractions de l'image du livre : x0, y0, x1, y1).
const ZONE = { gauche: [0.1097, 0.079, 0.3925, 0.7141], droite: [0.5981, 0.0836, 0.8752, 0.7144] };
const zone = (cote) => {
  const [x0, y0, x1, y1] = ZONE[cote];
  return { x: Math.round(LIVRE_X + x0 * LIVRE_L), y: Math.round(LIVRE_Y + y0 * LIVRE_H), l: Math.round((x1 - x0) * LIVRE_L), h: Math.round((y1 - y0) * LIVRE_H) };
};
const Z_G = zone('gauche');
const Z_D = zone('droite');
const PAR_PAGE = 4;
const ENTREE_H = Math.floor(Z_D.h / PAR_PAGE);
const ONGLET_L = 46;
const ONGLET_H = Math.round((ONGLET_L * 243) / 110);
const SOUS_LIVRE_Y = LIVRE_Y + LIVRE_H + 4;

const IMG = {
  livre: require('../../../assets/grimoire/livre.png'),
  medaillon: require('../../../assets/grimoire/medaillon.png'),
  sceau: require('../../../assets/grimoire/sceau-prix.png'),
  sceauGris: require('../../../assets/grimoire/sceau-prix-gris.png'),
  sceauAscension: require('../../../assets/grimoire/sceau-ascension.png'),
  fond: require('../../../assets/menu/fond.jpg'),
  plaque: require('../../../assets/fenetres/plaque-solde.png'),
};

// Les 5 chapitres = les 5 marque-pages. `ids(N)` : les éléments du modèle,
// dans l'ordre du livre (le modèle révèle déjà progressivement : le livre se
// remplit au fil de la partie).
// Les 5 chapitres = les 5 marque-pages. Listes COMPLÈTES dans la source
// unique (grimoireChapitres.js, contrôlée) ; le livre ne montre que ce que le
// modèle révèle (il se remplit au fil de la partie).
const VISUELS = {
  tap: { marque: require('../../../assets/grimoire/marque-tap.png'), image: require('../../../assets/grimoire/chapitre-tap.png') },
  critiques: { marque: require('../../../assets/grimoire/marque-critiques.png'), image: require('../../../assets/grimoire/chapitre-critiques.png') },
  auto: { marque: require('../../../assets/grimoire/marque-auto.png'), image: require('../../../assets/grimoire/chapitre-auto.png') },
  sanctuaire: { marque: require('../../../assets/grimoire/marque-sanctuaire.png'), image: require('../../../assets/grimoire/chapitre-sanctuaire.png') },
  reliques: { marque: require('../../../assets/grimoire/marque-reliques.png'), image: require('../../../assets/grimoire/chapitre-reliques.png') },
};
const CHAPITRES = CHAPITRES_GRIMOIRE.map((c) => ({ ...c, ...VISUELS[c.cle], ids: (N) => c.ids().filter((id) => N[id]) }));

// Pages d'un chapitre : 0 = intro (illustration), puis 4 éléments par page.
// Une double page = [page 2k, page 2k+1].
function planchesDuChapitre(ids) {
  const pages = [{ intro: true }];
  for (let i = 0; i < ids.length; i += PAR_PAGE) pages.push({ ids: ids.slice(i, i + PAR_PAGE) });
  const planches = [];
  for (let k = 0; k < pages.length; k += 2) planches.push([pages[k], pages[k + 1] || null]);
  return planches;
}

// ── Une entrée du livre : médaillon, nom, gain, sceau de prix ─────────────
function Entree({ n, formatNum, onAppui, onAppuiLong }) {
  const verrou = n.etat === 'verrouille';
  const ok = n.etat === 'achetable';
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onAppui(n.id)} onLongPress={() => onAppuiLong(n.id)} delayLongPress={320} style={styles.entree}>
      <View style={styles.entreeMedaillon}>
        <Image source={IMG.medaillon} resizeMode="contain" style={styles.entreeMedaillonImg} />
        <Text style={[styles.entreeEmoji, verrou && { opacity: 0.55 }]}>{verrou ? '🔒' : n.emoji}</Text>
      </View>
      <View style={{ width: Z_D.l - 40 }}>
        <Text style={styles.entreeNom} numberOfLines={2}>{verrou ? '???' : n.nom}{!verrou && n.niveau ? ` · ${n.niveau}` : ''}</Text>
        {n.gain ? <Text style={[styles.entreeGain, verrou && styles.entreeGainVerrou]} numberOfLines={1}>{n.gain}</Text> : null}
        {!verrou && n.prix != null ? (
          n.etat === 'max' ? <Text style={styles.entreePrix}>⭐ MAX</Text> : (
            <View style={styles.entreePrixLigne}>
              <Image source={ok ? IMG.sceau : IMG.sceauGris} resizeMode="contain" style={styles.entreeSceau} />
              <Text style={[styles.entreePrix, !ok && styles.entreePrixCher]} numberOfLines={1}>
                {n.devise === 'diamants' ? '💎 ' : ''}{formatNum(n.prix)}
              </Text>
            </View>
          )
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Petit élément sous le livre (Griffes, Offrande) ───────────────────────
function Special({ n, formatNum, onAppui, onAppuiLong, style }) {
  if (!n) return null;
  const ok = n.etat === 'achetable';
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onAppui(n.id)} onLongPress={() => onAppuiLong(n.id)} delayLongPress={320} style={[styles.special, style]}>
      <View style={styles.specialMedaillon}>
        <Image source={IMG.medaillon} resizeMode="contain" style={styles.specialMedaillonImg} />
        <Text style={styles.specialEmoji}>{n.emoji}</Text>
      </View>
      <Text style={styles.specialNom} numberOfLines={1}>{n.nom}</Text>
      <View style={styles.entreePrixLigne}>
        <Image source={ok ? IMG.sceau : IMG.sceauGris} resizeMode="contain" style={styles.entreeSceau} />
        <Text style={[styles.specialPrix, !ok && styles.entreePrixCher]} numberOfLines={1}>{n.devise === 'diamants' ? '💎 ' : ''}{formatNum(n.prix)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function Grimoire(props) {
  const { vibrations } = useSettings();
  const formatNum = props.formatNum || ((n) => String(Math.round(n)));
  const noeuds = useMemo(() => construireNoeuds(props), [props]);
  const parId = useMemo(() => Object.fromEntries(noeuds.map((n) => [n.id, n])), [noeuds]);
  const frais = useRef(parId); frais.current = parId;
  const vib = useRef(vibrations); vib.current = vibrations;
  const [ficheId, setFicheId] = useState(null);
  const [position, setPosition] = useState({ chapitre: 0, planche: 0 });

  const chapitres = CHAPITRES.map((c) => ({ ...c, planches: planchesDuChapitre(c.ids(parId)) }));
  const chap = chapitres[position.chapitre];
  const planche = chap.planches[Math.min(position.planche, chap.planches.length - 1)];

  // Achat : relit l'élément FRAIS (jamais une fermeture périmée). L'Ascension
  // (irréversible) ouvre toujours sa fiche.
  const acheter = useCallback((id) => {
    const n = frais.current[id];
    if (!n) return;
    if (id === 'ascension' || n.etat !== 'achetable' || !n.onPress) { setFicheId(id); return; }
    n.onPress();
    vibrerSucces(vib.current);
  }, []);

  // ── Tourner les pages : fondu + léger glissement (pilote natif) ─────────
  const tourne = useRef(new Animated.Value(1)).current;
  const sens = useRef(1);
  const aller = (chapitre, plancheIdx, s) => {
    sens.current = s;
    Animated.timing(tourne, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setPosition({ chapitre, planche: plancheIdx });
      Animated.timing(tourne, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
  };
  const posRef = useRef(position); posRef.current = position;
  const chapRef = useRef(chapitres); chapRef.current = chapitres;
  const suivante = () => {
    const { chapitre, planche: p } = posRef.current; const C = chapRef.current;
    if (p + 1 < C[chapitre].planches.length) aller(chapitre, p + 1, 1);
    else if (chapitre + 1 < C.length) aller(chapitre + 1, 0, 1);
  };
  const precedente = () => {
    const { chapitre, planche: p } = posRef.current; const C = chapRef.current;
    if (p > 0) aller(chapitre, p - 1, -1);
    else if (chapitre > 0) aller(chapitre - 1, C[chapitre - 1].planches.length - 1, -1);
  };
  const glisse = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onMoveShouldSetPanResponderCapture: (e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (e, g) => { if (g.dx < -40) suivante(); else if (g.dx > 40) precedente(); },
  })).current;

  const glissement = tourne.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const animPage = { opacity: tourne, transform: [{ translateX: Animated.multiply(glissement, sens.current) }] };
  const page = (p, Z, cote) => {
    if (!p) return null;
    if (p.intro) {
      return (
        <Animated.View style={[styles.page, { left: Z.x, top: Z.y, width: Z.l, height: Z.h, alignItems: 'center' }, animPage]} {...glisse.panHandlers}>
          <Text style={styles.chapTitre} numberOfLines={2}>{chap.titre}</Text>
          <Image source={chap.image} resizeMode="contain" style={{ width: Math.min(Z.l, 120), height: Math.min(Z.h * 0.52, 130), marginVertical: 6 }} />
          <Text style={styles.chapIntro}>{chap.intro}</Text>
          {position.chapitre === 0 && position.planche === 0 ? <Text style={styles.chapAide}>Glisse pour tourner la page ›</Text> : null}
        </Animated.View>
      );
    }
    return (
      <Animated.View style={[styles.page, { left: Z.x, top: Z.y, width: Z.l, height: Z.h }, animPage]} {...glisse.panHandlers}>
        {p.ids.map((id) => (parId[id] ? <Entree key={id} n={parId[id]} formatNum={formatNum} onAppui={acheter} onAppuiLong={setFicheId} /> : null))}
      </Animated.View>
    );
  };

  const total = chap.planches.length;
  const asc = parId.ascension;
  return (
    <View style={styles.racine}>
      <ImageBackground source={IMG.fond} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,10,12,0.35)' }]} />
      </ImageBackground>

      {/* Marque-pages sur la tranche HAUTE, derrière le livre ; celui du
          chapitre ouvert dépasse davantage. */}
      {chapitres.map((c, i) => {
        const actif = i === position.chapitre;
        const x = LIVRE_X + Math.round(LIVRE_L * 0.2) + i * Math.round((LIVRE_L * 0.6) / (CHAPITRES.length - 1)) - ONGLET_L / 2;
        return (
          <TouchableOpacity key={c.cle} activeOpacity={0.8} onPress={() => (i !== position.chapitre ? aller(i, 0, i > position.chapitre ? 1 : -1) : null)}
            style={[styles.onglet, { left: x, top: LIVRE_Y - 44 - (actif ? 10 : 0) }]}>
            <Image source={c.marque} resizeMode="stretch" style={[styles.ongletImg, { transform: [{ scaleY: -1 }] }]} />
            <Image source={c.image} resizeMode="contain" style={[styles.ongletIcone, !actif && { opacity: 0.75 }]} />
          </TouchableOpacity>
        );
      })}

      <View style={{ position: 'absolute', left: LIVRE_X, top: LIVRE_Y, width: LIVRE_L, height: LIVRE_H }} {...glisse.panHandlers}>
        <Image source={IMG.livre} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: LIVRE_L, height: LIVRE_H }} />
      </View>
      {/* ⚠️ Une couche PAR PAGE, à la taille exacte de la page : une couche
          plein écran en 'box-none' recouvrait les marque-pages (au banc, la
          valeur est ignorée dans le style) — plus aucune dépendance à ça. */}
      {page(planche[0], Z_G, 'gauche')}
      {page(planche[1], Z_D, 'droite')}

      {/* Flèches et numéro de page, dans le bas du livre. */}
      <TouchableOpacity onPress={precedente} style={[styles.fleche, { left: Z_G.x - 4, top: Z_G.y + Z_G.h + 6 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.flecheTexte}>‹</Text>
      </TouchableOpacity>
      {/* Numéro de page court, sur une étiquette de parchemin (sur l'ornement du
          bas, « Chapitre · 1 / 1 » se lisait mal). */}
      <View style={[styles.numero, { left: Math.round(ECRAN_L / 2 - 26), top: Z_G.y + Z_G.h + 10, pointerEvents: 'none' }]}>
        <Text style={styles.numeroTexte}>{Math.min(position.planche, total - 1) + 1} / {total}</Text>
      </View>
      <TouchableOpacity onPress={suivante} style={[styles.fleche, { left: Z_D.x + Z_D.l - 26, top: Z_D.y + Z_D.h + 6 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.flecheTexte}>›</Text>
      </TouchableOpacity>

      {/* Sous le livre : le sceau de l'Ascension, Griffes et Offrande. */}
      <Special n={parId.griffes} formatNum={formatNum} onAppui={acheter} onAppuiLong={setFicheId} style={{ left: 8, top: SOUS_LIVRE_Y + 8 }} />
      {asc ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => setFicheId('ascension')} style={[styles.ascension, { left: ECRAN_L / 2 - 52, top: SOUS_LIVRE_Y }]}>
          <Image source={IMG.sceauAscension} resizeMode="contain" style={styles.ascensionImg} />
          <Text style={styles.ascensionTexte}>ASCENSION</Text>
          {asc.niveau ? <Text style={styles.ascensionNiveau}>{asc.niveau}</Text> : null}
          <View style={styles.ascensionBarre}>
            <View style={{ width: Math.round(76 * (asc.progres || 0)), height: 4, borderRadius: 2, backgroundColor: CYAN_CHAMPIGNON }} />
          </View>
        </TouchableOpacity>
      ) : null}
      <Special n={parId.offrande} formatNum={formatNum} onAppui={acheter} onAppuiLong={setFicheId} style={{ left: ECRAN_L - 8 - 104, top: SOUS_LIVRE_Y + 8 }} />

      {/* En-tête : RETOUR et soldes. */}
      <View style={[styles.entete, { pointerEvents: 'box-none' }]}>
        <BackButton onPress={props.onRetour} style={{ position: 'relative', left: 0, top: 0 }} />
        <View style={{ gap: 6, alignItems: 'flex-end', pointerEvents: 'none' }}>
          <View style={styles.plaque}>
            <Image source={IMG.plaque} resizeMode="stretch" style={styles.plaqueImg} />
            <Text style={styles.plaqueTexte} numberOfLines={1}>💰 {formatNum(props.coins || 0)}</Text>
          </View>
          <View style={styles.plaque}>
            <Image source={IMG.plaque} resizeMode="stretch" style={styles.plaqueImg} />
            <Image source={CRISTAL} resizeMode="contain" style={{ width: 12, height: 22, marginRight: 6 }} />
            <Text style={styles.plaqueTexte} numberOfLines={1}>{props.sharedCoins || 0}</Text>
          </View>
        </View>
      </View>

      <FicheElement fiche={ficheId ? parId[ficheId] : null} onFermer={() => setFicheId(null)} onAcheter={acheter} onAscend={props.onAscend} formatNum={formatNum} />
    </View>
  );
}

// ── Filet de sécurité : si le grimoire plante, l'ancienne liste s'affiche ──
class FiletGrimoire extends React.Component {
  constructor(p) { super(p); this.state = { erreur: null }; }
  static getDerivedStateFromError(erreur) { return { erreur }; }
  componentDidCatch(erreur) { try { console.warn('Grimoire de la boutique en erreur :', erreur && erreur.message); } catch (e) {} }
  render() { return this.state.erreur ? this.props.secours : this.props.children; }
}
export default function BoutiqueGrimoire({ Secours, ...props }) {
  return (
    <FiletGrimoire secours={Secours ? <Secours {...props} /> : null}>
      <Grimoire {...props} />
    </FiletGrimoire>
  );
}
export { CHAPITRES, planchesDuChapitre };

const ENCRE = '#3b2a14';
const styles = StyleSheet.create({
  // Plein écran, sous la barre de navigation (zIndex 5).
  racine: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 4, overflow: 'hidden', backgroundColor: '#061018' },
  page: { position: 'absolute' },
  chapTitre: { color: ENCRE, fontSize: 17, fontWeight: '900', textAlign: 'center', includeFontPadding: false, letterSpacing: 0.5 },
  chapIntro: { color: '#5a4322', fontSize: 10.5, fontStyle: 'italic', textAlign: 'center', includeFontPadding: false },
  chapAide: { color: '#2e6b2f', fontSize: 9.5, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  entree: { height: ENTREE_H, flexDirection: 'row', alignItems: 'center', gap: 6 },
  entreeMedaillon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  entreeMedaillonImg: { position: 'absolute', left: 0, top: 0, width: 34, height: 34 },
  entreeEmoji: { fontSize: 15 },
  entreeNom: { color: ENCRE, fontSize: 10, fontWeight: '900', lineHeight: 12, includeFontPadding: false },
  entreeGain: { color: '#2e6b2f', fontSize: 9, fontWeight: '800', marginTop: 1, includeFontPadding: false },
  entreeGainVerrou: { color: '#8b4a1c' },
  entreePrixLigne: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  entreeSceau: { width: 18, height: 18, marginRight: 4 },
  entreePrix: { color: '#5b3a10', fontSize: 10.5, fontWeight: '900', includeFontPadding: false },
  entreePrixCher: { color: '#8a7f70' },
  onglet: { position: 'absolute', width: ONGLET_L, height: ONGLET_H, alignItems: 'center' },
  ongletImg: { position: 'absolute', left: 0, top: 0, width: ONGLET_L, height: ONGLET_H },
  ongletIcone: { width: 28, height: 28, marginTop: 8 },
  fleche: { position: 'absolute', width: 30, height: 26, alignItems: 'center', justifyContent: 'center' },
  flecheTexte: { color: ENCRE, fontSize: 24, fontWeight: '900', includeFontPadding: false, lineHeight: 26 },
  numero: { position: 'absolute', width: 52, height: 20, borderRadius: 10, backgroundColor: 'rgba(246,234,204,0.95)', borderWidth: 1, borderColor: 'rgba(120,84,30,0.6)', alignItems: 'center', justifyContent: 'center' },
  numeroTexte: { color: '#4a3418', fontSize: 10.5, fontWeight: '900', includeFontPadding: false },
  special: { position: 'absolute', width: 104, alignItems: 'center' },
  specialMedaillon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  specialMedaillonImg: { position: 'absolute', left: 0, top: 0, width: 50, height: 50 },
  specialEmoji: { fontSize: 22 },
  specialNom: { color: '#fff7e0', fontSize: 11, fontWeight: '900', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3 },
  specialPrix: { color: '#ffe38a', fontSize: 11, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3 },
  ascension: { position: 'absolute', width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  ascensionImg: { position: 'absolute', left: 0, top: 0, width: 104, height: 104 },
  ascensionTexte: { color: '#4a2e06', fontSize: 11, fontWeight: '900', letterSpacing: 0.5, includeFontPadding: false },
  ascensionNiveau: { color: '#4a2e06', fontSize: 10, fontWeight: '800', includeFontPadding: false },
  ascensionBarre: { width: 80, height: 6, marginTop: 4, borderRadius: 3, backgroundColor: 'rgba(40,24,6,0.55)', padding: 1, justifyContent: 'center' },
  entete: { position: 'absolute', left: 0, right: 0, top: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 12 },
  plaque: { width: 124, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  plaqueImg: { position: 'absolute', left: 0, top: 0, width: 124, height: 38 },
  plaqueTexte: { color: '#ffe38a', fontSize: 14, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
});

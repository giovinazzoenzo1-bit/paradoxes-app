import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, Pressable, PanResponder, Animated, Easing, StyleSheet, Dimensions, Platform } from 'react-native';
import { CHAPITRES_GRIMOIRE } from '../../games/clicker/grimoireChapitres';
import { useSettings } from '../../context/SettingsContext';
import { vibrerSucces, CRISTAL, CYAN_CHAMPIGNON } from './fenetreBois';
import { construireNoeuds, FicheElement } from './ArbreBoutique';
import BackButton from '../../components/BackButton';
import { ICONES } from './grimoireIcones';
import { meilleurAchat, valeurTap, revenuPassif, etatApres } from '../../games/clicker/conseilBoutique';
import { jouerSon } from './sonsBoutique';

// ════════════════════════════════════════════════════════════════════
//  BOUTIQUE EN GRIMOIRE (27/09, choix de l'auteur après l'arbre)
// ════════════════════════════════════════════════════════════════════
// 2e version (retours de l'auteur) :
// - zones d'écriture MESURÉES HORS ORNEMENTS (plus grand rectangle sans
//   aucun pixel de cadre à moins de 6 px) : rien ne chevauche les dessins ;
// - VRAIE page qui se tourne : une feuille (image de la page découpée du
//   livre) pivote en 3D autour du dos, recto = page quittée, verso = page
//   d'arrivée, avec une ombre ; deux faces SŒURS (pas imbriquées : sur
//   téléphone, une rotation parente ne se propage pas en 3D aux enfants) ;
// - achat CLAIR : le bouton de prix (cire rouge, pièce dorée) achète, toucher
//   l'élément ouvre sa fiche ; un « +1 » s'envole à chaque achat ;
// - livre ×1,35 l'écran : le sceau de l'Ascension monte dans l'en-tête et
//   Griffes / Offrande deviennent le chapitre « Comptoir ».
// ⚠️ Économie INCHANGÉE, logique NON dupliquée : modèle des éléments =
// construireNoeuds (arbre, vérifié) ; fiche partagée (FicheElement).
// ⚠️ Tailles et positions en NOMBRES (règle du 27/09).

const { width: ECRAN_L } = Dimensions.get('window');
// ×1,22 : assez grand pour les zones d'écriture, et la place SOUS le livre
// pour Griffes, le sceau de l'Ascension et Offrande (retour de l'auteur).
const LIVRE_L = Math.round(ECRAN_L * 1.22);
const LIVRE_H = Math.round((LIVRE_L * 807) / 900);
const LIVRE_X = Math.round((ECRAN_L - LIVRE_L) / 2);
const LIVRE_Y = 168;
const SOUS_LIVRE_Y = LIVRE_Y + Math.round((LIVRE_L * 807) / 900) - 6;
// Mesures sur l'image du livre (fractions x0, y0, x1, y1) : FEUILLE = page
// entière jusqu'au dos (pour la feuille qui tourne) ; ZONE = rectangle libre
// de tout ornement (pour le texte).
const FEUILLE = { gauche: [0.0822, 0.0087, 0.5, 0.9145], droite: [0.5, 0.0062, 0.9067, 0.9133] };
const ZONE = { gauche: [0.1622, 0.1214, 0.4022, 0.6716], droite: [0.5933, 0.1041, 0.8067, 0.7138] };
const rect = ([x0, y0, x1, y1]) => ({ x: Math.round(LIVRE_X + x0 * LIVRE_L), y: Math.round(LIVRE_Y + y0 * LIVRE_H), l: Math.round((x1 - x0) * LIVRE_L), h: Math.round((y1 - y0) * LIVRE_H) });
const F = { gauche: rect(FEUILLE.gauche), droite: rect(FEUILLE.droite) };
const Z = { gauche: rect(ZONE.gauche), droite: rect(ZONE.droite) };
const PAR_PAGE = 4;
// Espace LIBRE de l'en-tête, entre RETOUR (108 pts depuis 12) et les soldes
// (124 pts depuis le bord droit) : le sélecteur et les gains s'y logent, quelle
// que soit la largeur (un Android de 360 pts n'a que ~92 pts libres).
const LIBRE_G = 12 + 108 + 6;
const LIBRE_L = Math.max(80, (ECRAN_L - 12 - 124 - 6) - LIBRE_G);
const MODE_L = Math.min(34, Math.floor((LIBRE_L - 6) / 3));
const MEDAILLON = 30;
const ONGLET_L = 46;
const ONGLET_H = Math.round((ONGLET_L * 243) / 110);
const PERSPECTIVE = 1400;
// Lettres à empattements du système (aucune police à charger).
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const DUREE_TOUR = 640;

const IMG = {
  livre: require('../../../assets/grimoire/livre.png'),
  feuille: { gauche: require('../../../assets/grimoire/page-gauche.png'), droite: require('../../../assets/grimoire/page-droite.png') },
  medaillon: require('../../../assets/grimoire/medaillon.png'),
  // Or VIF + halo doré (retour de l'auteur : « pas jaune brillant comme la maquette »).
  sceauAscension: require('../../../assets/grimoire/sceau-ascension-or.png'),
  lueurOr: require('../../../assets/grimoire/lueur-or.png'),
  fond: require('../../../assets/menu/fond.jpg'),
  plaque: require('../../../assets/fenetres/plaque-solde.png'),
};
const VISUELS = {
  tap: { marque: require('../../../assets/grimoire/marque-tap.png'), image: require('../../../assets/grimoire/chapitre-tap.png') },
  critiques: { marque: require('../../../assets/grimoire/marque-critiques.png'), image: require('../../../assets/grimoire/chapitre-critiques.png') },
  auto: { marque: require('../../../assets/grimoire/marque-auto.png'), image: require('../../../assets/grimoire/chapitre-auto.png') },
  sanctuaire: { marque: require('../../../assets/grimoire/marque-sanctuaire.png'), image: require('../../../assets/grimoire/chapitre-sanctuaire.png') },
  reliques: { marque: require('../../../assets/grimoire/marque-reliques.png'), image: require('../../../assets/grimoire/chapitre-reliques.png') },
};

// Pages d'un chapitre : 0 = intro (illustration), puis 4 éléments par page.
// Une double page = [page 2k, page 2k+1]. Chaque page connaît son chapitre.
function planches(c, ids) {
  const pages = [{ intro: true, c }];
  for (let i = 0; i < ids.length; i += PAR_PAGE) pages.push({ c, ids: ids.slice(i, i + PAR_PAGE) });
  const r = [];
  for (let k = 0; k < pages.length; k += 2) r.push([pages[k], pages[k + 1] || null]);
  return r;
}

// Niveau court pour le badge du médaillon (« nv 3 » → 3, « ×7 » → 7) ; rien à 0.
function badge(niveau) {
  if (!niveau) return null;
  const t = String(niveau).replace('nv ', '').replace('×', '');
  return t === '0' || t === '0/50' ? null : t;
}

// ── Une entrée : toucher = fiche ; le BOUTON DE PRIX achète ───────────────
function Entree({ n, largeur, hauteur, formatNum, onFiche, onAcheter, offre, conseil }) {
  const verrou = n.etat === 'verrouille';
  const o = offre || { q: 1, total: n.prix, ok: n.etat === 'achetable' };
  const ok = o.ok;
  const b = verrou ? null : badge(n.niveau);
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onFiche(n.id)} style={[styles.entree, { width: largeur, height: hauteur }]}>
      <View style={styles.medaillon}>
        <Image source={IMG.medaillon} resizeMode="contain" style={styles.medaillonImg} />
        {!verrou && ICONES[n.id] ? <Image source={ICONES[n.id]} resizeMode="contain" style={styles.icone} />
          : <Text style={[styles.emoji, verrou && { opacity: 0.55 }]}>{verrou ? '🔒' : n.emoji}</Text>}
        {b ? <View style={styles.badge}><Text style={styles.badgeTexte} numberOfLines={1}>{b}</Text></View> : null}
        {/* ⭐ Conseillé : le meilleur gain de pièces pour son prix (conseilBoutique). */}
        {conseil ? <View style={styles.conseil}><Text style={styles.conseilTexte}>★</Text></View> : null}
      </View>
      <View style={{ width: largeur - MEDAILLON - 5 }}>
        <Text style={styles.nom} numberOfLines={2}>{verrou ? '???' : n.nom}</Text>
        {n.gain ? <Text style={[styles.gain, verrou && styles.gainVerrou]} numberOfLines={1}>{n.gain}</Text> : null}
        {!verrou && n.prix != null ? (
          n.etat === 'max' ? <Text style={styles.max}>⭐ MAX</Text> : (
            // ⚠️ Achat AU CONTACT (onPressIn), comme la zone de tap : un
            // TouchableOpacity / onPress jette les taps rapides (auditZoneTapAuContact).
            <Pressable onPressIn={(e) => onAcheter(n.id, e.nativeEvent.pageX, e.nativeEvent.pageY)}
              style={({ pressed }) => [styles.prix, ok ? styles.prixOk : styles.prixCher, conseil && ok && styles.prixConseil, pressed && { opacity: 0.75 }]} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Image source={n.devise === 'diamants' ? ICONES.diamant : ICONES.piece} resizeMode="contain" style={styles.prixIcone} />
              <Text style={[styles.prixTexte, !ok && styles.prixTexteCher]} numberOfLines={1}>{o.q > 1 ? `×${o.q} ` : ''}{formatNum(o.total)}</Text>
            </Pressable>
          )
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Sous le livre, mis en avant : Griffes et Offrande ─────────────────────
function Special({ n, formatNum, onFiche, onAcheter, style }) {
  if (!n) return null;
  const ok = n.etat === 'achetable';
  return (
    <View style={[styles.special, style]}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => onFiche(n.id)} style={{ alignItems: 'center' }}>
        <View style={styles.specialMedaillon}>
          <Image source={IMG.medaillon} resizeMode="contain" style={styles.specialMedaillonImg} />
          {ICONES[n.id] ? <Image source={ICONES[n.id]} resizeMode="contain" style={styles.specialIcone} /> : <Text style={{ fontSize: 22 }}>{n.emoji}</Text>}
        </View>
        <Text style={styles.specialNom} numberOfLines={1}>{n.nom}</Text>
      </TouchableOpacity>
      {/* Achat AU CONTACT (onPressIn), comme les pages. */}
      <Pressable onPressIn={(e) => onAcheter(n.id, e.nativeEvent.pageX, e.nativeEvent.pageY)}
        style={({ pressed }) => [styles.prix, { alignSelf: 'center' }, ok ? styles.prixOk : styles.prixCher, pressed && { opacity: 0.75 }]} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Image source={n.devise === 'diamants' ? ICONES.diamant : ICONES.piece} resizeMode="contain" style={styles.prixIcone} />
        <Text style={[styles.prixTexte, !ok && styles.prixTexteCher]} numberOfLines={1}>{formatNum(n.prix)}</Text>
      </Pressable>
    </View>
  );
}

function Grimoire(props) {
  const { vibrations, sons } = useSettings();
  const sonsRef = useRef(sons); sonsRef.current = sons;
  const formatNum = props.formatNum || ((n) => String(Math.round(n)));
  const noeuds = useMemo(() => construireNoeuds(props), [props]);
  const parId = useMemo(() => Object.fromEntries(noeuds.map((n) => [n.id, n])), [noeuds]);
  const frais = useRef(parId); frais.current = parId;
  const etatRef = useRef(null);
  // Gains lisibles : 1 décimale sous 10 (« 0,6 »), entier sous 1 000, puis K/M…
  const fmtGain = (x) => (x >= 1000 ? formatNum(x) : x >= 10 ? String(Math.round(x)) : Number(x.toFixed(1)).toString().replace('.', ','));
  const fmtRef = useRef(fmtGain); fmtRef.current = fmtGain;
  const vib = useRef(vibrations); vib.current = vibrations;
  const [ficheId, setFicheId] = useState(null);
  const [position, setPosition] = useState({ c: 0, p: 0 });
  const [tour, setTour] = useState(null); // { sens, de, vers } pendant qu'une page tourne
  // Quantité d'achat : ×1, ×10 ou MAX (le plus possible avec tes pièces).
  const [mode, setMode] = useState(1);
  const pieces = props.coins || 0;
  const remise = props.applyDiscount || ((c) => c);
  // Offre d'un élément selon le mode : quantité, total (prix de CHAQUE niveau,
  // la remise sur le 1er seulement — comme l'achat groupé de ClickerScreen),
  // achetable ou non. Sans prix niveau par niveau (Griffes, Offrande) : ×1.
  const offre = (n) => {
    if (!n || n.prix == null) return { q: 1, total: n ? n.prix : 0, ok: false };
    if (!n.cout || mode === 1) return { q: 1, total: n.prix, ok: n.etat === 'achetable' };
    const limite = mode === 10 ? 10 : 1000;
    let total = 0; let q = 0;
    while (q < limite && !(n.estMax && n.estMax(q))) {
      const c = q === 0 ? remise(n.cout(0)) : n.cout(q);
      if (!Number.isFinite(c) || (mode === 'max' && total + c > pieces)) break;
      total += c; q += 1;
    }
    if (q === 0) return { q: 1, total: n.prix, ok: false };
    return { q, total, ok: n.etat !== 'verrouille' && n.etat !== 'max' && total <= pieces };
  };
  const offreRef = useRef(offre); offreRef.current = offre;

  // Auto-clics : dans l'ORDRE du modèle (prix réels de l'Ascension en cours).
  const ordonner = (cle, ids) => (cle === 'auto' ? [...ids].sort((x, y) => (parId[x].ordre ?? 0) - (parId[y].ordre ?? 0)) : ids);
  const chapitres = CHAPITRES_GRIMOIRE.map((c, i) => ({ ...c, ...VISUELS[c.cle], planches: planches(i, ordonner(c.cle, c.ids().filter((id) => parId[id]))) }));
  const chapRef = useRef(chapitres); chapRef.current = chapitres;
  const dansLeLivre = new Set(chapitres.flatMap((c) => c.ids()));
  const etatJeu = { tapPower: props.tapPower, critLevel: props.critLevel, critDamageLevel: props.critDamageLevel, sanctuaryLevel: props.sanctuaryLevel,
    autoClickers: props.autoClickers, upgradeLevels: props.upgradeLevels, tapUpgrades: props.tapUpgrades, ascensionCount: props.ascensionCount, essence: props.essence };
  const candidats = noeuds.filter((n) => n.delta && n.etat === 'achetable' && dansLeLivre.has(n.id)).map((n) => ({ id: n.id, delta: n.delta, prix: n.prix }));
  etatRef.current = etatJeu;
  const signature = JSON.stringify([etatJeu, candidats.map((c) => c.id)]);
  // Ce que tu gagnes : par tap (critiques comprises, hors Transe) et en passif.
  const gains = useMemo(() => ({ tap: valeurTap(etatJeu), passif: revenuPassif(etatJeu) }), [signature]);
  // ~1 à 6 ms : PAS à chaque rafraîchissement des pièces (le bug des taps a
  // montré ce que coûte la charge) — seulement quand la signature change.
  const conseilId = useMemo(() => meilleurAchat(etatJeu, candidats), [signature]);
  const posRef = useRef(position); posRef.current = position;
  const planche = (pos) => { const C = chapitres[pos.c]; return C.planches[Math.min(pos.p, C.planches.length - 1)]; };

  // ── Achat : relit l'élément FRAIS ; « +1 » qui s'envole là où on a touché
  const [effet, setEffet] = useState(null);
  const effetAnim = useRef(new Animated.Value(0)).current;
  const acheter = useCallback((id, x, y) => {
    const n = frais.current[id];
    if (!n) return;
    if (id === 'ascension' || !n.onPress) { setFicheId(id); return; }
    const o = offreRef.current(n);
    if (!o.ok) { setFicheId(id); return; }
    // Le VRAI gain de cet achat, dans sa bonne unité (« +20/tap », « +3,5/s »),
    // calculé AVANT l'achat (l'état changera au rendu suivant) avec les
    // formules du jeu (conseilBoutique). Sans effet mesurable : « +q ».
    let texte = `+${o.q}`;
    const e = etatRef.current;
    if (n.delta && e) {
      const e2 = etatApres(e, n.delta, o.q);
      const dTap = valeurTap(e2) - valeurTap(e); const dPas = revenuPassif(e2) - revenuPassif(e);
      const parts = [];
      if (dTap > 1e-6) parts.push(`+${fmtRef.current(dTap)}/tap`);
      if (dPas > 1e-6) parts.push(`+${fmtRef.current(dPas)}/s`);
      if (parts.length) texte = parts.join(' · ');
    }
    n.onPress(o.q);
    vibrerSucces(vib.current);
    jouerSon('achat', sonsRef.current);
    if (x != null) {
      setEffet({ x, y, cle: Date.now(), texte });
      effetAnim.setValue(0);
      // Retiré à la fin : un texte invisible resté à l'écran pourrait
      // intercepter le toucher suivant, pile sur le bouton de prix.
      Animated.timing(effetAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setEffet(null));
    }
  }, []);

  // ── Tourner une page : une feuille pivote en 3D autour du dos ────────────
  const angle = useRef(new Animated.Value(0)).current;
  const enTour = useRef(false);
  const tourner = (vers, sens) => {
    if (enTour.current) return;
    enTour.current = true;
    jouerSon('page', sonsRef.current);
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

  // Contenu d'une page, posé dans sa feuille (zone d'écriture relative).
  const contenu = (page, cote) => {
    if (!page) return null;
    const z = Z[cote]; const f = F[cote];
    const boite = { position: 'absolute', left: z.x - f.x, top: z.y - f.y, width: z.l, height: z.h };
    if (page.intro) {
      const C = chapitres[page.c];
      return (
        <View style={[boite, { alignItems: 'center' }]}>
          <Text style={styles.chapTitre} numberOfLines={2}>{C.titre}</Text>
          <Image source={C.image} resizeMode="contain" style={{ width: Math.min(z.l - 6, 116), height: Math.min(Math.round(z.h * 0.5), 124), marginVertical: 6 }} />
          <Text style={styles.chapIntro}>{C.intro}</Text>
          {page.c === 0 ? <Text style={styles.chapAide}>Glisse pour tourner la page ›</Text> : null}
        </View>
      );
    }
    const h = Math.floor(z.h / PAR_PAGE);
    return (
      <View style={boite}>
        {page.ids.map((id) => (parId[id] ? <Entree key={id} n={parId[id]} largeur={z.l} hauteur={h} formatNum={formatNum} onFiche={setFicheId} onAcheter={acheter} offre={offre(parId[id])} conseil={id === conseilId} /> : null))}
      </View>
    );
  };
  // Page posée (sans fond : le livre dessine déjà le parchemin).
  const pagePosee = (page, cote) => (
    <View key={'posee-' + cote} style={[styles.feuille, { left: F[cote].x, top: F[cote].y, width: F[cote].l, height: F[cote].h }]} {...glisse.panHandlers}>
      {contenu(page, cote)}
    </View>
  );
  // Face d'une feuille qui tourne : image de la page + contenu + ombre.
  // Rotation autour du DOS : bord gauche pour une page de droite, bord droit
  // pour une page de gauche (translateX ± l/2 autour de la rotation).
  const ombre = angle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 0] });
  const face = (page, cote, debut, fin) => {
    const f = F[cote]; const d = cote === 'droite' ? -f.l / 2 : f.l / 2;
    const rot = angle.interpolate({ inputRange: [0, 1], outputRange: [debut, fin] });
    return (
      <Animated.View key={'face-' + cote} style={[styles.feuille, { left: f.x, top: f.y, width: f.l, height: f.h, backfaceVisibility: 'hidden',
        transform: [{ perspective: PERSPECTIVE }, { translateX: d }, { rotateY: rot }, { translateX: -d }] }]}>
        <Image source={IMG.feuille[cote]} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: f.l, height: f.h }} />
        {contenu(page, cote)}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a0f04', opacity: ombre, pointerEvents: 'none' }]} />
      </Animated.View>
    );
  };

  // Ce qui est posé / ce qui tourne, selon le sens.
  let gauche; let droite; let feuilles = null;
  if (!tour) {
    [gauche, droite] = planche(position);
  } else if (tour.sens > 0) {
    // Vers l'avant : la page de DROITE se soulève ; dessous, la droite d'arrivée.
    const [dg, dd] = planche(tour.de); const [vg, vd] = planche(tour.vers);
    gauche = dg; droite = vd;
    feuilles = [face(dd, 'droite', '0deg', '-180deg'), face(vg, 'gauche', '180deg', '0deg')];
  } else {
    // Vers l'arrière : la page de GAUCHE se soulève ; dessous, la gauche d'arrivée.
    const [dg, dd] = planche(tour.de); const [vg, vd] = planche(tour.vers);
    gauche = vg; droite = dd;
    feuilles = [face(dg, 'gauche', '0deg', '180deg'), face(vd, 'droite', '-180deg', '0deg')];
  }

  const chap = chapitres[(tour ? tour.vers : position).c];
  const total = chap.planches.length;
  const numero = Math.min((tour ? tour.vers : position).p, total - 1) + 1;
  const asc = parId.ascension;
  const halo = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const b = Animated.loop(Animated.sequence([
      Animated.timing(halo, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(halo, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, []);
  const cActif = (tour ? tour.vers : position).c;
  return (
    <View style={styles.racine}>
      <ImageBackground source={IMG.fond} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,10,12,0.35)' }]} />
      </ImageBackground>

      {/* Marque-pages sur la tranche HAUTE (icône du chapitre) ; celui du
          chapitre ouvert dépasse davantage. */}
      {chapitres.map((c, i) => {
        const actif = i === cActif;
        const x = LIVRE_X + Math.round(LIVRE_L * (0.2 + (i * 0.6) / (chapitres.length - 1))) - ONGLET_L / 2;
        return (
          <TouchableOpacity key={c.cle} activeOpacity={0.8} onPress={() => (i !== cActif ? tourner({ c: i, p: 0 }, i > cActif ? 1 : -1) : null)}
            style={[styles.onglet, { left: x, top: LIVRE_Y - 44 - (actif ? 10 : 0) }]}>
            <Image source={c.marque} resizeMode="stretch" style={[styles.ongletImg, { transform: [{ scaleY: -1 }] }]} />
            <Image source={c.image} resizeMode="contain" style={[styles.ongletIcone, !actif && { opacity: 0.75 }]} />
            {/* Pastille : ⭐ le chapitre contient l'achat conseillé ; • un achat est possible. */}
            {c.ids().includes(conseilId) ? <View style={styles.pastilleConseil}><Text style={styles.pastilleConseilTexte}>★</Text></View>
              : c.ids().some((id) => parId[id] && parId[id].etat === 'achetable') ? <View style={styles.pastille} /> : null}
          </TouchableOpacity>
        );
      })}

      <View style={{ position: 'absolute', left: LIVRE_X, top: LIVRE_Y, width: LIVRE_L, height: LIVRE_H }} {...glisse.panHandlers}>
        <Image source={IMG.livre} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: LIVRE_L, height: LIVRE_H }} />
      </View>
      {pagePosee(gauche, 'gauche')}
      {pagePosee(droite, 'droite')}
      {feuilles}

      {/* Flèches aux coins bas des pages et numéro sur le dos du livre. */}
      <TouchableOpacity onPress={precedente} style={[styles.fleche, { left: Math.max(6, F.gauche.x + 14), top: F.gauche.y + F.gauche.h - 34 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.flecheTexte}>‹</Text>
      </TouchableOpacity>
      <View style={[styles.numero, { left: Math.round(ECRAN_L / 2 - 26), top: F.gauche.y + F.gauche.h - 30, pointerEvents: 'none' }]}>
        <Text style={styles.numeroTexte}>{numero} / {total}</Text>
      </View>
      <TouchableOpacity onPress={suivante} style={[styles.fleche, { left: Math.min(ECRAN_L - 36, F.droite.x + F.droite.l - 44), top: F.droite.y + F.droite.h - 34 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.flecheTexte}>›</Text>
      </TouchableOpacity>

      {/* SOUS le livre, mis en avant : Griffes, le sceau de l'Ascension, Offrande. */}
      <Special n={parId.griffes} formatNum={formatNum} onFiche={setFicheId} onAcheter={acheter} style={{ left: 10, top: SOUS_LIVRE_Y + 4 }} />
      {/* Quantité d'achat : ×1 / ×10 / MAX. */}
      <View style={styles.modes}>
        {[[1, '×1'], [10, '×10'], ['max', 'MAX']].map(([m, txt]) => (
          <TouchableOpacity key={txt} activeOpacity={0.7} onPress={() => setMode(m)} style={[styles.modeBtn, mode === m && styles.modeBtnActif]}>
            <Text style={[styles.modeTexte, mode === m && styles.modeTexteActif]}>{txt}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {asc ? (
        <Animated.Image source={IMG.lueurOr} resizeMode="stretch" style={{ position: 'absolute', left: Math.round(ECRAN_L / 2 - 70), top: SOUS_LIVRE_Y - 29, width: 140, height: 140, pointerEvents: 'none',
          opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] }), transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) }] }} />
      ) : null}
      {asc ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => setFicheId('ascension')} style={[styles.ascension, { left: Math.round(ECRAN_L / 2 - 41), top: SOUS_LIVRE_Y }]}>
          <Image source={IMG.sceauAscension} resizeMode="contain" style={styles.ascensionImg} />
          <Text style={styles.ascensionTexte}>ASCENSION</Text>
          {asc.niveau ? <Text style={styles.ascensionNiveau}>{asc.niveau}</Text> : null}
          <View style={styles.ascensionBarre}>
            <View style={{ width: Math.round(52 * (asc.progres || 0)), height: 4, borderRadius: 2, backgroundColor: CYAN_CHAMPIGNON }} />
          </View>
        </TouchableOpacity>
      ) : null}
      <Special n={parId.offrande} formatNum={formatNum} onFiche={setFicheId} onAcheter={acheter} style={{ left: ECRAN_L - 10 - 104, top: SOUS_LIVRE_Y + 4 }} />

      {/* Ce que tu gagnes, sous le sélecteur (retour de l'auteur : « on ne voit pas
          combien un item fait gagner »). */}
      <View style={[styles.gains, { pointerEvents: 'none' }]}>
        {/* Deux lignes : entre RETOUR et les soldes, il n'y a que ~125 points. */}
        <Text style={styles.gainsTexte} numberOfLines={1}>👆 {fmtGain(gains.tap)} /tap</Text>
        <Text style={styles.gainsTexte} numberOfLines={1}>⚙️ {fmtGain(gains.passif)} /s</Text>
      </View>
      {/* En-tête : RETOUR et les soldes, en DEUX éléments séparés — ⚠️ pas de
          bande pleine largeur « transparente au toucher » : elle recouvrait le
          sélecteur ×1 / ×10 / MAX (même piège que les marque-pages). */}
      <BackButton onPress={props.onRetour} style={{ position: 'absolute', left: 12, top: 40 }} />
      <View style={[styles.soldes, { pointerEvents: 'none' }]}>
        <View style={styles.plaque}>
          <Image source={IMG.plaque} resizeMode="stretch" style={styles.plaqueImg} />
          <Image source={ICONES.piece} resizeMode="contain" style={{ width: 20, height: 20, marginRight: 5 }} />
          <Text style={styles.plaqueTexte} numberOfLines={1}>{formatNum(props.coins || 0)}</Text>
        </View>
        <View style={styles.plaque}>
          <Image source={IMG.plaque} resizeMode="stretch" style={styles.plaqueImg} />
          <Image source={CRISTAL} resizeMode="contain" style={{ width: 12, height: 22, marginRight: 6 }} />
          <Text style={styles.plaqueTexte} numberOfLines={1}>{props.sharedCoins || 0}</Text>
        </View>
      </View>

      {/* « +1 » qui s'envole à l'achat. */}
      {effet ? (
        <Animated.View key={effet.cle} style={{ position: 'absolute', left: effet.x - 90, top: effet.y - 34, width: 180, pointerEvents: 'none',
          opacity: effetAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateY: effetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) }, { scale: effetAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.7, 1.15, 1] }) }] }}>
          <Text style={styles.effet}>{effet.texte || '+1'}</Text>
        </Animated.View>
      ) : null}

      <FicheElement fiche={ficheId && parId[ficheId] ? { ...parId[ficheId], icone: ICONES[ficheId], detail: (parId[ficheId].detail || '') + (ficheId === conseilId ? '\n⭐ Conseillé : c\'est l\'achat qui rapporte le plus de pièces pour son prix.' : '') } : null} onFermer={() => setFicheId(null)} onAcheter={(id) => acheter(id)} onAscend={props.onAscend} formatNum={formatNum} />
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

const ENCRE = '#3b2a14';
const styles = StyleSheet.create({
  // Plein écran, sous la barre de navigation (zIndex 5).
  racine: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 4, overflow: 'hidden', backgroundColor: '#061018' },
  feuille: { position: 'absolute' },
  chapTitre: { color: ENCRE, fontSize: 16, fontWeight: '900', textAlign: 'center', includeFontPadding: false, letterSpacing: 0.4 },
  chapIntro: { color: '#5a4322', fontSize: 10, fontStyle: 'italic', textAlign: 'center', includeFontPadding: false },
  chapAide: { color: '#2e6b2f', fontSize: 9.5, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  entree: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  medaillon: { width: MEDAILLON, height: MEDAILLON, alignItems: 'center', justifyContent: 'center' },
  medaillonImg: { position: 'absolute', left: 0, top: 0, width: MEDAILLON, height: MEDAILLON },
  icone: { width: 22, height: 22 },
  emoji: { fontSize: 14 },
  badge: { position: 'absolute', right: -5, bottom: -4, minWidth: 16, height: 14, paddingHorizontal: 3, borderRadius: 7, backgroundColor: '#3b2a14', borderWidth: 1, borderColor: '#e2b04a', alignItems: 'center', justifyContent: 'center' },
  badgeTexte: { color: '#ffe9b0', fontSize: 8, fontWeight: '900', includeFontPadding: false },
  nom: { color: ENCRE, fontSize: 10, fontWeight: '900', lineHeight: 12, includeFontPadding: false },
  gain: { color: '#2e6b2f', fontSize: 9, fontWeight: '800', marginTop: 1, includeFontPadding: false },
  gainVerrou: { color: '#8b4a1c' },
  max: { color: '#9a6a12', fontSize: 10, fontWeight: '900', marginTop: 2 },
  // Bouton de prix : cire rouge à bord doré (achetable) / gris (pas assez).
  prix: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', height: 20, paddingHorizontal: 7, marginTop: 3, borderRadius: 10, borderWidth: 1.5 },
  prixOk: { backgroundColor: '#8a2a1c', borderColor: '#e8b84a' },
  prixCher: { backgroundColor: '#9a9182', borderColor: '#c4baa8' },
  prixIcone: { width: 13, height: 13, marginRight: 4 },
  prixTexte: { color: '#fff4d6', fontSize: 10.5, fontWeight: '900', includeFontPadding: false },
  prixTexteCher: { color: '#f1ebe0' },
  onglet: { position: 'absolute', width: ONGLET_L, height: ONGLET_H, alignItems: 'center' },
  ongletImg: { position: 'absolute', left: 0, top: 0, width: ONGLET_L, height: ONGLET_H },
  ongletIcone: { width: 28, height: 28, marginTop: 8 },
  fleche: { position: 'absolute', width: 30, height: 26, alignItems: 'center', justifyContent: 'center' },
  flecheTexte: { color: ENCRE, fontSize: 24, fontWeight: '900', includeFontPadding: false, lineHeight: 26 },
  numero: { position: 'absolute', width: 52, height: 20, borderRadius: 10, backgroundColor: 'rgba(246,234,204,0.95)', borderWidth: 1, borderColor: 'rgba(120,84,30,0.6)', alignItems: 'center', justifyContent: 'center' },
  numeroTexte: { color: '#4a3418', fontSize: 10.5, fontWeight: '900', includeFontPadding: false },
  ascension: { position: 'absolute', width: 82, height: 82, alignItems: 'center', justifyContent: 'center' },
  ascensionImg: { position: 'absolute', left: 0, top: 0, width: 82, height: 82 },
  // Comme la maquette : capitales à empattements, crème cerclée de brun, petites.
  ascensionTexte: { color: '#fff4d0', fontFamily: SERIF, fontSize: 8.5, fontWeight: '700', letterSpacing: 0.7, includeFontPadding: false, textShadowColor: 'rgba(70,35,0,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  ascensionNiveau: { color: '#fff4d0', fontFamily: SERIF, fontSize: 8, fontWeight: '700', includeFontPadding: false, textShadowColor: 'rgba(70,35,0,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  ascensionBarre: { width: 56, height: 6, marginTop: 3, borderRadius: 3, backgroundColor: 'rgba(40,24,6,0.55)', padding: 1, justifyContent: 'center' },
  soldes: { position: 'absolute', right: 12, top: 40, width: 124, gap: 6, alignItems: 'flex-end' },
  plaque: { width: 124, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  plaqueImg: { position: 'absolute', left: 0, top: 0, width: 124, height: 38 },
  plaqueTexte: { color: '#ffe38a', fontSize: 14, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
  special: { position: 'absolute', width: 104, alignItems: 'center' },
  specialMedaillon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  specialMedaillonImg: { position: 'absolute', left: 0, top: 0, width: 46, height: 46 },
  specialIcone: { width: 32, height: 32 },
  specialNom: { color: '#fff7e0', fontSize: 11, fontWeight: '900', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3 },
  conseil: { position: 'absolute', left: -6, top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#f2c94c', borderWidth: 1, borderColor: '#7a4a08', alignItems: 'center', justifyContent: 'center' },
  conseilTexte: { color: '#5a3200', fontSize: 10, fontWeight: '900', includeFontPadding: false, lineHeight: 12 },
  prixConseil: { borderColor: '#ffe27a', borderWidth: 2 },
  pastille: { position: 'absolute', right: 4, top: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: CYAN_CHAMPIGNON, borderWidth: 1, borderColor: '#ffffff' },
  pastilleConseil: { position: 'absolute', right: 1, top: 1, width: 16, height: 16, borderRadius: 8, backgroundColor: '#f2c94c', borderWidth: 1, borderColor: '#7a4a08', alignItems: 'center', justifyContent: 'center' },
  pastilleConseilTexte: { color: '#5a3200', fontSize: 10, fontWeight: '900', includeFontPadding: false, lineHeight: 12 },
  modes: { position: 'absolute', top: 50, left: LIBRE_G + Math.round((LIBRE_L - (3 * MODE_L + 6)) / 2), width: 3 * MODE_L + 6, flexDirection: 'row', justifyContent: 'space-between' },
  modeBtn: { width: MODE_L, height: 24, borderRadius: 12, backgroundColor: 'rgba(30,18,6,0.82)', borderWidth: 1.5, borderColor: '#8a6a3a', alignItems: 'center', justifyContent: 'center' },
  modeBtnActif: { backgroundColor: '#e8b84a', borderColor: '#fff0c0' },
  modeTexte: { color: '#f3e6c8', fontSize: 10.5, fontWeight: '900', includeFontPadding: false },
  modeTexteActif: { color: '#3b2208' },
  gains: { position: 'absolute', top: 79, left: LIBRE_G, width: LIBRE_L, height: 32, borderRadius: 9, backgroundColor: 'rgba(20,12,4,0.72)', borderWidth: 1, borderColor: 'rgba(232,184,74,0.55)', alignItems: 'center', justifyContent: 'center' },
  gainsTexte: { color: '#fff1cf', fontSize: 10, fontWeight: '800', lineHeight: 13, includeFontPadding: false },
  effet: { width: 180, textAlign: 'center', color: '#ffd84a', fontSize: 16, fontWeight: '900', textShadowColor: 'rgba(60,30,0,0.9)', textShadowRadius: 4 },
});

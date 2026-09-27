import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet } from 'react-native';

// ════════════════════════════════════════════════════════════════════
//  FENÊTRES DU THÈME FORÊT (27/09, images Gemini de l'auteur)
// ════════════════════════════════════════════════════════════════════
// UN style pour les victoires (mini boss, Gardien) et l'incubateur : grand
// panneau de bois moussu, bannière verte à cheval sur le bord du haut pour le
// titre, bouton en bois doré à émail vert, rouge ou bleu (rouge et bleu
// recolorés par le code depuis le bouton « Valider » : l'émail seulement).
// Images : assets/fenetres/.
const PANNEAU = require('../../../assets/fenetres/panneau.png');
const BANNIERE = require('../../../assets/fenetres/banniere.png');
export const COURONNE = require('../../../assets/fenetres/couronne.png');
export const CRISTAL = require('../../../assets/fenetres/cristal.png');
export const SABLIER = require('../../../assets/fenetres/sablier.png');
const BOUTONS = {
  vert: require('../../../assets/fenetres/bouton-vert.png'),
  rouge: require('../../../assets/fenetres/bouton-rouge.png'),
  bleu: require('../../../assets/fenetres/bouton-bleu.png'),
};
export const FERMER = require('../../../assets/fenetres/fermer.png');
const PANNEAU_HAUT = require('../../../assets/fenetres/panneau-haut.png');
const PLANCHE = require('../../../assets/fenetres/planche.png');
const RAIL = require('../../../assets/fenetres/rail.png');
const ROND = { vert: require('../../../assets/fenetres/bouton-rond-vert.png'), gris: require('../../../assets/fenetres/bouton-rond-gris.png') };
const LARGES = { vert: require('../../../assets/fenetres/bouton-large-vert.png'), rouge: require('../../../assets/fenetres/bouton-large-rouge.png') };
const RATIO_PANNEAU_HAUT = 640 / 1118;
const RATIO_LARGE = 900 / 250;
const RATIO_PANNEAU = 900 / 1145;
const RATIO_BANNIERE = 900 / 349;
const RATIO_BOUTON = 420 / 161;

// Largeur disponible pour le contenu d'une FenetreBois (marge de 15 % du
// panneau de chaque côté) — à utiliser plutôt que recopier ces marges.
export const largeurInterieureFenetre = (largeur) => Math.round(largeur) - 2 * Math.round(largeur * 0.15);
export function FenetreBois({ titre, children, largeur = 310, onFermer = null }) {
  const lBanniere = Math.round(largeur * 0.92);
  const hBanniere = Math.round(lBanniere / RATIO_BANNIERE);
  return (
    <View style={{ width: largeur, alignItems: 'center', paddingTop: Math.round(hBanniere * 0.5) }}>
      <ImageBackground
        source={PANNEAU}
        resizeMode="stretch"
        style={{
          width: largeur,
          minHeight: Math.round((largeur / RATIO_PANNEAU) * 0.72),
          alignItems: 'center',
          paddingTop: Math.round(hBanniere * 0.62),
          paddingHorizontal: Math.round(largeur * 0.15), // = largeurInterieureFenetre
          paddingBottom: Math.round(largeur * 0.12),
        }}
      >
        {children}
      </ImageBackground>
      {/* Dessinée APRÈS le panneau : elle passe par-dessus son bord. */}
      <View style={[styles.banniere, { width: lBanniere, height: hBanniere }]}>
        <BanniereTitre titre={titre} largeur={lBanniere} />
      </View>
      {/* 27/09 : la croix ronde EN BOIS (pièce Gemini), dessinée APRÈS la
          bannière pour passer par-dessus, sur le coin du panneau. */}
      {onFermer ? (
        <TouchableOpacity style={[styles.fermer, { top: Math.round(hBanniere * 0.5) - 12 }]} onPress={onFermer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Image source={FERMER} resizeMode="contain" style={{ width: 42, height: 42 }} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Bannière verte seule, avec son titre (fenêtres ET grands menus).
// Zone du titre en NOMBRES (pas en %) : sur téléphone, le titre de
// l'incubateur tombait trop bas (retour de l'auteur, 27/09) ; puis remontée
// d'≈ 14 points (2e retour : « de quelques millimètres »).
export function BanniereTitre({ titre, largeur }) {
  const l = Math.round(largeur);
  const h = Math.round(l / RATIO_BANNIERE);
  return (
    <ImageBackground source={BANNIERE} resizeMode="contain" style={{ width: l, height: h }}>
      <View style={[styles.titreZone, { left: Math.round(l * 0.17), width: Math.round(l * 0.66), top: Math.round(h * 0.24), height: Math.round(h * 0.42) }]}>
        <Text style={styles.titre} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{titre}</Text>
      </View>
    </ImageBackground>
  );
}

// ════════════════════════════════════════════════════════════════════
//  GRANDS MENUS (Paramètres, Boutique, Quêtes…) — pièces Gemini du 27/09
// ════════════════════════════════════════════════════════════════════
// Grand panneau vertical + bannière + croix. Tailles en NOMBRES (règle du
// 27/09 : pas de % ni de « 100 % » d'un bloc sans largeur fixe). Le contenu
// dispose de `largeurInterieure(largeur)` points de large.
const marge = (largeur) => Math.round(largeur * 0.07);
export const largeurInterieure = (largeur) => Math.round(largeur) - 2 * marge(largeur);
export function GrandPanneau({ titre, largeur, hauteur, onFermer = null, children }) {
  const lB = Math.round(largeur * 0.8);
  const hB = Math.round(lB / RATIO_BANNIERE);
  const haut = Math.round(hB * 0.5);
  return (
    <View style={{ width: largeur, height: hauteur + haut }}>
      <Image source={PANNEAU_HAUT} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: haut, width: largeur, height: hauteur }} />
      <View style={{ position: 'absolute', left: 0, top: haut, width: largeur, height: hauteur, paddingTop: Math.round(hB * 0.6), paddingBottom: Math.round(largeur * 0.05), paddingHorizontal: marge(largeur) }}>
        {children}
      </View>
      <View style={{ position: 'absolute', top: 0, left: Math.round((largeur - lB) / 2) }}>
        <BanniereTitre titre={titre} largeur={lB} />
      </View>
      {onFermer ? (
        <TouchableOpacity onPress={onFermer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ position: 'absolute', right: -6, top: haut - 16, width: 46, height: 46 }}>
          <Image source={FERMER} style={{ width: 46, height: 46 }} resizeMode="contain" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Interrupteur : rail en bois, bouton rond émeraude (activé) ou gris.
export function Interrupteur({ valeur }) {
  return (
    <View style={{ width: 62, height: 30 }}>
      <Image source={RAIL} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: 62, height: 30 }} />
      <Text style={[styles.interTexte, valeur ? { left: 8 } : { right: 7 }]}>{valeur ? 'ON' : 'OFF'}</Text>
      <Image source={valeur ? ROND.vert : ROND.gris} resizeMode="contain" style={{ position: 'absolute', top: 1, left: valeur ? 33 : 1, width: 28, height: 28 }} />
    </View>
  );
}

// Planche de réglage : titre + détail à gauche, interrupteur à droite ; toute
// la planche est cliquable.
export function LigneReglage({ largeur, titre, detail = null, valeur, onPress }) {
  const h = Math.round(Math.max(64, largeur / 4.2));
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{ width: largeur, height: h, marginBottom: 8 }}>
      <Image source={PLANCHE} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: largeur, height: h }} />
      <View style={{ width: largeur, height: h, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Math.round(largeur * 0.07) }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.reglageTitre} numberOfLines={1}>{titre}</Text>
          {detail ? <Text style={styles.reglageDetail} numberOfLines={2}>{detail}</Text> : null}
        </View>
        <Interrupteur valeur={valeur} />
      </View>
    </TouchableOpacity>
  );
}

// Grand bouton rectangulaire (cadre doré, émail vert ou rouge). Même règle
// que BoutonBois : le bouton porte sa taille, l'image a une taille explicite,
// la taille du texte est calculée pour tenir sur l'émail (≈ 86 %).
export function BoutonLarge({ texte, sousTexte = null, couleur = 'vert', onPress, largeur, hauteur = null, desactive = false, sansMarge = false }) {
  const h = hauteur || Math.round(largeur / RATIO_LARGE);
  const utile = largeur * 0.84;
  const tailleTexte = Math.max(11, Math.min(16, Math.floor(utile / (0.62 * Math.max(1, longueurVisible(texte))))));
  const tailleSous = sousTexte ? Math.max(8, Math.min(11, Math.floor(utile / (0.56 * Math.max(1, longueurVisible(sousTexte)))))) : 0;
  return (
    <TouchableOpacity onPress={onPress} disabled={desactive || !onPress} activeOpacity={0.85} style={{ width: largeur, height: h, marginTop: sansMarge ? 0 : 8, opacity: desactive ? 0.6 : 1 }}>
      <Image source={LARGES[couleur] || LARGES.vert} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: largeur, height: h }} />
      <View style={{ width: largeur, height: h, paddingHorizontal: Math.round(largeur * 0.08), alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[styles.boutonTexte, { fontSize: tailleTexte }]} numberOfLines={1}>{texte}</Text>
        {sousTexte ? <Text style={[styles.boutonSous, { fontSize: tailleSous, lineHeight: tailleSous + 2 }]} numberOfLines={1}>{sousTexte}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ⚠️ Le TouchableOpacity PORTE la taille (leçon du 26/09 : un bouton autour
// d'un élément en position absolue fait zéro pixel). ⚠️⚠️ 27/09 (retour de
// l'auteur) : l'image de fond a une taille EXPLICITE en nombres, et AUCUNE
// marge sur son conteneur — une marge en % sur l'ImageBackground réduisait,
// SUR TÉLÉPHONE, l'image à ≈ 66 % du bouton, calée à gauche (le texte
// débordait, on voyait le décor derrière) ; le navigateur, lui, l'étirait.
// Largeur « visuelle » d'un texte en caractères : émojis et symboles comptent
// plus large qu'une lettre.
function longueurVisible(t) {
  return Array.from(t || '').reduce((n, c) => n + (c.codePointAt(0) > 0x2000 ? 1.4 : 1), 0);
}
export function BoutonBois({ texte, sousTexte = null, couleur = 'vert', onPress, largeur = 250, hauteur = null, icone = null, desactive = false, children = null }) {
  const h = hauteur || Math.round(largeur / RATIO_BOUTON);
  // ⚠️ 27/09 (retour de l'auteur : « écritures trop grosses ») : la taille du
  // texte est CALCULÉE pour tenir sur l'émail (≈ 66 % de la largeur) —
  // adjustsFontSizeToFit ne réduit rien sur son téléphone Android.
  const lIcone = icone ? Math.round(h * 0.42) + 6 : 0;
  const tailleTexte = Math.max(10, Math.min(15, Math.floor((largeur * 0.66 - lIcone) / (0.62 * Math.max(1, longueurVisible(texte))))));
  // Sous-texte : sur UNE ligne s'il reste lisible (≥ 9), sinon sur DEUX si le
  // bouton est assez haut — plutôt qu'écrire en 7, illisible.
  const sous1 = sousTexte ? Math.floor((largeur * 0.66) / (0.56 * Math.max(1, longueurVisible(sousTexte)))) : 0;
  const lignesSous = sousTexte && sous1 < 9 && h >= 58 ? 2 : 1;
  const tailleSous = sousTexte ? Math.max(7, Math.min(10, lignesSous === 2 ? Math.min(9, sous1 * 2) : sous1)) : 0;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={desactive || !onPress}
      activeOpacity={0.85}
      style={[styles.bouton, { width: largeur, height: h, opacity: desactive ? 0.6 : 1 }]}
    >
      <Image source={BOUTONS[couleur] || BOUTONS.vert} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: largeur, height: h }} />
      {/* Texte centré sur l'ÉMAIL, pas sur l'image : l'émail occupe 30 à 80 %
          de la hauteur (centre à 55 %, mesuré) — d'où le décalage vers le bas. */}
      <View style={{ width: largeur, height: h, paddingHorizontal: Math.round(largeur * 0.17), paddingTop: Math.round(h * 0.1), alignItems: 'center', justifyContent: 'center' }}>
        {children || (
          <>
            <View style={styles.boutonLigne}>
              {icone ? <Image source={icone} style={{ width: Math.round(h * 0.42), height: Math.round(h * 0.42), marginRight: 6 }} resizeMode="contain" /> : null}
              <Text style={[styles.boutonTexte, { fontSize: tailleTexte }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{texte}</Text>
            </View>
            {sousTexte ? (
              <Text style={[styles.boutonSous, { fontSize: tailleSous, lineHeight: tailleSous + 2, textAlign: 'center' }]} numberOfLines={lignesSous} adjustsFontSizeToFit minimumFontScale={0.6}>{sousTexte}</Text>
            ) : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banniere: { position: 'absolute', top: 0, alignSelf: 'center' },
  titreZone: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  titre: { color: '#fff7d6', fontSize: 20, fontWeight: '900', includeFontPadding: false, textAlignVertical: 'center', textShadowColor: 'rgba(15,40,10,0.95)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  bouton: { alignSelf: 'center', marginTop: 8 },
  interTexte: { position: 'absolute', top: 8, color: '#ffe6a8', fontSize: 9, fontWeight: '900', includeFontPadding: false },
  reglageTitre: { color: '#fff7e0', fontSize: 15, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  reglageDetail: { color: '#e6d6b0', fontSize: 10.5, marginTop: 2, includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 },
  fermer: { position: 'absolute', right: -6, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  fermerTexte: { color: '#ffe6a8', fontSize: 15, fontWeight: '900' },
  boutonLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  boutonTexte: { color: '#fff', fontSize: 15, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  boutonSous: { color: 'rgba(255,255,255,0.92)', fontSize: 10, fontWeight: '800', marginTop: 1, includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 },
});

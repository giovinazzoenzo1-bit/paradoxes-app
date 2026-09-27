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
const RATIO_PANNEAU = 900 / 1145;
const RATIO_BANNIERE = 900 / 349;
const RATIO_BOUTON = 420 / 161;

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
          paddingHorizontal: Math.round(largeur * 0.15),
          paddingBottom: Math.round(largeur * 0.12),
        }}
      >
        {children}
      </ImageBackground>
      {onFermer ? (
        <TouchableOpacity style={[styles.fermer, { top: Math.round(hBanniere * 0.5) + 10 }]} onPress={onFermer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.fermerTexte}>✕</Text>
        </TouchableOpacity>
      ) : null}
      {/* Dessinée APRÈS le panneau : elle passe par-dessus son bord. */}
      <ImageBackground source={BANNIERE} resizeMode="contain" style={[styles.banniere, { width: lBanniere, height: hBanniere }]}>
        {/* Zone du titre en NOMBRES (pas en %) : sur téléphone, le titre de
            l'incubateur tombait trop bas (retour de l'auteur, 27/09). */}
        <View style={[styles.titreZone, { left: Math.round(lBanniere * 0.17), width: Math.round(lBanniere * 0.66), top: Math.round(hBanniere * 0.36), height: Math.round(hBanniere * 0.44) }]}>
          <Text style={styles.titre} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{titre}</Text>
        </View>
      </ImageBackground>
    </View>
  );
}

// ⚠️ Le TouchableOpacity PORTE la taille (leçon du 26/09 : un bouton autour
// d'un élément en position absolue fait zéro pixel). ⚠️⚠️ 27/09 (retour de
// l'auteur) : l'image de fond a une taille EXPLICITE en nombres, et AUCUNE
// marge sur son conteneur — une marge en % sur l'ImageBackground réduisait,
// SUR TÉLÉPHONE, l'image à ≈ 66 % du bouton, calée à gauche (le texte
// débordait, on voyait le décor derrière) ; le navigateur, lui, l'étirait.
export function BoutonBois({ texte, sousTexte = null, couleur = 'vert', onPress, largeur = 250, hauteur = null, icone = null, desactive = false, children = null }) {
  const h = hauteur || Math.round(largeur / RATIO_BOUTON);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={desactive || !onPress}
      activeOpacity={0.85}
      style={[styles.bouton, { width: largeur, height: h, opacity: desactive ? 0.6 : 1 }]}
    >
      <Image source={BOUTONS[couleur] || BOUTONS.vert} resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: largeur, height: h }} />
      <View style={{ width: largeur, height: h, paddingHorizontal: Math.round(largeur * 0.17), alignItems: 'center', justifyContent: 'center' }}>
        {children || (
          <>
            <View style={styles.boutonLigne}>
              {icone ? <Image source={icone} style={{ width: Math.round(h * 0.42), height: Math.round(h * 0.42), marginRight: 6 }} resizeMode="contain" /> : null}
              <Text style={styles.boutonTexte} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{texte}</Text>
            </View>
            {sousTexte ? (
              <Text style={styles.boutonSous} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{sousTexte}</Text>
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
  fermer: { position: 'absolute', right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(40,24,12,0.92)', borderWidth: 1.5, borderColor: '#d9a441', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  fermerTexte: { color: '#ffe6a8', fontSize: 15, fontWeight: '900' },
  boutonLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  boutonTexte: { color: '#fff', fontSize: 15, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  boutonSous: { color: 'rgba(255,255,255,0.92)', fontSize: 10, fontWeight: '800', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 },
});

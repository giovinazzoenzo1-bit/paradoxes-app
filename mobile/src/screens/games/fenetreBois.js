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

export function FenetreBois({ titre, children, largeur = 310 }) {
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
      {/* Dessinée APRÈS le panneau : elle passe par-dessus son bord. */}
      <ImageBackground source={BANNIERE} resizeMode="contain" style={[styles.banniere, { width: lBanniere, height: hBanniere }]}>
        <View style={styles.titreZone}>
          <Text style={styles.titre} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{titre}</Text>
        </View>
      </ImageBackground>
    </View>
  );
}

// ⚠️ Le TouchableOpacity PORTE la taille et l'image le REMPLIT (leçon du
// 26/09 : un bouton autour d'un élément en position absolue fait zéro pixel).
export function BoutonBois({ texte, sousTexte = null, couleur = 'vert', onPress, largeur = 220, hauteur = null, icone = null, desactive = false }) {
  const h = hauteur || Math.round(largeur / RATIO_BOUTON);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={desactive || !onPress}
      activeOpacity={0.85}
      style={[styles.bouton, { width: largeur, height: h, opacity: desactive ? 0.6 : 1 }]}
    >
      <ImageBackground source={BOUTONS[couleur] || BOUTONS.vert} resizeMode="stretch" style={styles.boutonImage}>
        <View style={styles.boutonLigne}>
          {icone ? <Image source={icone} style={{ width: Math.round(h * 0.42), height: Math.round(h * 0.42), marginRight: 6 }} resizeMode="contain" /> : null}
          <Text style={styles.boutonTexte} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{texte}</Text>
        </View>
        {sousTexte ? (
          <Text style={styles.boutonSous} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{sousTexte}</Text>
        ) : null}
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banniere: { position: 'absolute', top: 0, alignSelf: 'center' },
  titreZone: { position: 'absolute', left: '17%', right: '17%', top: '36%', bottom: '20%', alignItems: 'center', justifyContent: 'center' },
  titre: { color: '#fff7d6', fontSize: 20, fontWeight: '900', textShadowColor: 'rgba(15,40,10,0.95)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  bouton: { alignSelf: 'center', marginTop: 8 },
  boutonImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: '17%' },
  boutonLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  boutonTexte: { color: '#fff', fontSize: 16, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  boutonSous: { color: 'rgba(255,255,255,0.92)', fontSize: 10, fontWeight: '800', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 },
});

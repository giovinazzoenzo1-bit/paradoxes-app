// Fenêtre MAISON (06/10, demande de l'auteur) : remplace les boîtes de dialogue du système
// et les vieux panneaux bleu nuit. Pièces Gemini du bandeau de combat (carte de bois au liseré
// d'or pour les messages, panneau pour les fenêtres à contenu), planche de titre, onglets de
// bois pour les boutons, croix dorée. S'adapte au portrait ET au paysage.
// ⚠️ L'image du corps est dimensionnée par MESURE (onLayout), jamais en « remplir le parent » :
// sur Android, une <Image> en absoluteFill s'affiche à la taille d'ORIGINE du fichier.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useWindowDimensions } from 'react-native';

const PIECES = {
  carte: require('../../assets/combat/carte-bois.png'),
  panneau: require('../../assets/combat/panneau.png'),
  plaque: require('../../assets/exploration/plaque-titre.png'),
  onglet: { g: require('../../assets/fiche/onglet-g.png'), m: require('../../assets/fiche/onglet-m.png'), d: require('../../assets/fiche/onglet-d.png'), capG: 48, capD: 48, h: 236 },
};
const COULEUR_BOUTON = { principal: '#ffd96a', annuler: '#f1e2c4', danger: '#ff8a7a' };

// Bouton : un onglet de bois en 3 tranches (les bouts gardent leurs proportions).
export function BoutonBois({ texte, style = 'principal', onPress, largeur = 180, hauteur = 46, desactive = false }) {
  const k = hauteur / PIECES.onglet.h;
  return (
    <TouchableOpacity onPress={onPress} disabled={desactive} activeOpacity={0.85} style={{ width: largeur, height: hauteur, opacity: desactive ? 0.55 : 1 }}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: largeur, height: hauteur, flexDirection: 'row' }}>
        <Image source={PIECES.onglet.g} resizeMethod="scale" resizeMode="stretch" style={{ width: PIECES.onglet.capG * k, height: hauteur }} />
        <Image source={PIECES.onglet.m} resizeMethod="scale" resizeMode="stretch" style={{ flex: 1, height: hauteur }} />
        <Image source={PIECES.onglet.d} resizeMethod="scale" resizeMode="stretch" style={{ width: PIECES.onglet.capD * k, height: hauteur }} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}>
        <Text style={[styles.texteBouton, { color: COULEUR_BOUTON[style] || COULEUR_BOUTON.principal, fontSize: Math.round(hauteur * 0.36) }]} numberOfLines={1}>{texte}</Text>
      </View>
    </TouchableOpacity>
  );
}

// La fenêtre : fond assombri, corps en bois (hauteur selon le contenu), planche de titre à
// cheval sur le bord, croix dorée facultative. `piece` : 'carte' (messages) ou 'panneau'.
export function FenetreJeu({ titre, onFermer = null, toucherFondFerme = false, piece = 'carte', largeur = null, zIndex = 1000, children }) {
  const { width: W, height: H } = useWindowDimensions();
  const paysage = W > H;
  const L = largeur || Math.min(W * (paysage ? 0.56 : 0.9), 620);
  const [taille, setTaille] = useState(null);
  const plaqueL = Math.min(L * 0.8, 460); const plaqueH = plaqueL / (1300 / 313);
  // Taille du titre selon sa LONGUEUR (≈ 0,55 em par lettre) : un titre long tenait mal (06/10).
  const policeTitre = Math.round(Math.min(plaqueH * 0.36, (plaqueL * 0.78) / Math.max(1, (titre || '').length * 0.55)));
  return (
    <View style={[styles.fond, { zIndex }]}>
      {toucherFondFerme && onFermer
        ? <TouchableOpacity style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} activeOpacity={1} onPress={onFermer} />
        : <View style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }} />}
      <View style={{ width: L, maxHeight: H * 0.94, marginTop: plaqueH * 0.45 }}
        onLayout={(e) => setTaille({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {taille && (
          <Image source={PIECES[piece] || PIECES.carte} resizeMethod="scale" resizeMode="stretch"
            style={{ position: 'absolute', left: 0, top: 0, width: taille.w, height: taille.h }} />
        )}
        <View style={{ paddingTop: plaqueH * 0.62 + 6, paddingBottom: 18, paddingHorizontal: Math.max(18, L * 0.06), alignItems: 'center' }}>
          {children}
        </View>
        {titre ? (
          <View style={{ position: 'absolute', left: L / 2 - plaqueL / 2, top: -plaqueH * 0.45, width: plaqueL, height: plaqueH }}>
            <Image source={PIECES.plaque} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: plaqueL, height: plaqueH }} />
            <View style={{ position: 'absolute', left: plaqueL * 0.1, right: plaqueL * 0.1, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[styles.titre, { fontSize: policeTitre }]} numberOfLines={1}>{titre}</Text>
            </View>
          </View>
        ) : null}
        {onFermer ? (
          <TouchableOpacity style={[styles.fermer, { right: -10, top: -14 }]} onPress={onFermer} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.fermerTexte}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(4,8,12,0.74)', alignItems: 'center', justifyContent: 'center' },
  titre: { color: '#fff3d6', fontWeight: '900', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
  texteBouton: { fontWeight: '900', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
  fermer: { position: 'absolute', width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: '#d6a64d', backgroundColor: '#6b4521', alignItems: 'center', justifyContent: 'center' },
  fermerTexte: { color: '#ffe9a8', fontSize: 20, fontWeight: '900', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false },
});

import React from 'react';
import { TouchableOpacity, ImageBackground, Text, StyleSheet } from 'react-native';

// Bouton retour partagé par TOUS les écrans du jeu.
//
// Le mot « RETOUR » est écrit PAR-DESSUS l'image, pas gravé dedans.
// Volontaire : un texte gravé se pixelise dès qu'on change la taille du
// bouton et fige la langue, alors qu'ici la police suit l'écran et le
// placement se règle en une ligne. Les décalages rencontrés venaient de
// la mise en page environnante, jamais du texte lui-même.
//
// La plaque dorée porte une flèche gravée à gauche : le libellé est donc
// décalé vers la droite pour ne pas se poser dessus.
export default function BackButton({ onPress, style, label = 'RETOUR' }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, style]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <ImageBackground
        source={require('../../assets/icons/back-button.png')}
        style={styles.image}
        resizeMode="contain"
      >
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingRight: 12, justifyContent: 'center' },
  // Ratio de l'image conservé (360x116) : une hauteur libre la
  // déformerait.
  image: { width: 108, height: 35, alignItems: 'center', justifyContent: 'center' },
  label: {
    color: '#3a2608', fontSize: 11, fontWeight: '900', letterSpacing: 0.8,
    marginLeft: 22,
  },
});

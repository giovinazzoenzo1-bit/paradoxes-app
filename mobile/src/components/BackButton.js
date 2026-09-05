import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';

// Bouton retour partagé par TOUS les écrans de jeu (04/09 — sur demande
// explicite : "je veux que le bouton y soit pour tous les boutons
// retour"). Remplace le texte "← Retour" présent, à l'identique, dans
// chaque écran de jeu. Aucun fond/case autour : juste l'image, comme
// pour le cadeau — la "grosse case bleue" signalée venait du panneau de
// fond du header du Clicker, pas de ce bouton lui-même.
export default function BackButton({ onPress, style }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.btn, style]}>
      <Image
        source={require('../../assets/icons/back-button.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingRight: 12, justifyContent: 'center' },
  image: { width: 63, height: 22 },
});

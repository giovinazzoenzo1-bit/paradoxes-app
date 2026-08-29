// VERSION DE TEST TEMPORAIRE — diagnostic écran blanc.
// Aucune lib tierce (pas de navigation, gesture-handler, safe-area-context,
// async-storage). Objectif : vérifier si le socle Expo/RN pur fonctionne
// du tout sur ce build, avant de réintroduire les libs une par une.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>✅ TEST OK — le socle marche</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#eef0f6', fontSize: 18, fontWeight: '800', textAlign: 'center', padding: 20 },
});

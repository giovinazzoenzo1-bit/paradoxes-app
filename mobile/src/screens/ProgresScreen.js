import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CoinBar from '../components/CoinBar';

export default function ProgresScreen() {
  return (
    <View style={styles.container}>
      <CoinBar />
      <View style={styles.center}>
        <Text style={styles.title}>🏆 Progrès</Text>
        <Text style={styles.subtitle}>Trophées et classements arrivent bientôt ici.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#eef0f6', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#8d93ab', textAlign: 'center' },
});

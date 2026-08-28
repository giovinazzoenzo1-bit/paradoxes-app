import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import CoinBar from '../components/CoinBar';
import { useCoins } from '../context/CoinsContext';

export default function OptionsScreen() {
  const { addCoins } = useCoins();

  return (
    <View style={styles.container}>
      <CoinBar />
      <View style={styles.content}>
        <Text style={styles.title}>⚙️ Options</Text>

        <View style={styles.devCard}>
          <Text style={styles.devTitle}>🛠️ Mode développeur</Text>
          <Text style={styles.devSubtitle}>Outil de test — ne pas montrer aux joueurs finaux.</Text>
          <TouchableOpacity style={styles.devBtn} onPress={() => addCoins(10)}>
            <Text style={styles.devBtnText}>🪙 +10 pièces</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c' },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#eef0f6', marginBottom: 16 },
  devCard: {
    borderWidth: 1,
    borderColor: '#2a2f45',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
  },
  devTitle: { fontSize: 15, fontWeight: '700', color: '#eef0f6', marginBottom: 4 },
  devSubtitle: { fontSize: 12, color: '#8d93ab', marginBottom: 12 },
  devBtn: {
    backgroundColor: '#232840',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  devBtnText: { color: '#eef0f6', fontWeight: '700', fontSize: 14 },
});

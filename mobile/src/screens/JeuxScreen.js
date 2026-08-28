import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import CoinBar from '../components/CoinBar';

const GAMES = [
  { name: 'Morpion', status: 'À venir' },
  { name: 'Puissance 4', status: 'À venir' },
  { name: '2048', status: 'À venir' },
  { name: 'Memory', status: 'À venir' },
  { name: 'Snake', status: 'À venir' },
];

export default function JeuxScreen() {
  return (
    <View style={styles.container}>
      <CoinBar />
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.title}>🎮 Jeux</Text>
        <Text style={styles.subtitle}>
          Première version native — les jeux arrivent un par un.
        </Text>
        {GAMES.map((g) => (
          <View key={g.name} style={styles.card}>
            <Text style={styles.cardTitle}>{g.name}</Text>
            <Text style={styles.cardStatus}>{g.status}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c' },
  list: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#eef0f6', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#8d93ab', marginBottom: 16 },
  card: {
    backgroundColor: '#1c2032',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#eef0f6' },
  cardStatus: { fontSize: 12, color: '#8d93ab', marginTop: 4 },
});

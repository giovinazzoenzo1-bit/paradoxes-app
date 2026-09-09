import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import CoinBar from '../components/CoinBar';
import ClickerScreen from './games/ClickerScreen';

// Les 13 mini-jeux (Morpion, Puissance 4, 2048, Memory, Snake, Puzzle 15,
// Sudoku, Nuts and Bolts, Flappy Bird, Wordle, Billard, Ping-pong, Traceur
// de Runes) ont ete RETIRES de l'appli le 06/09 — trop de surface a
// maintenir en parallele du Clicker/Aventure.
//
// Ils ne sont PAS supprimes : leur code complet est archive dans
// `archive/minigames/` A LA RACINE DU DEPOT, donc hors du dossier `mobile/`
// que Metro empaquette. Ils n'entrent plus dans le bundle et ne peuvent
// plus casser un demarrage. Voir archive/minigames/README.md pour la
// procedure de restauration exacte (deplacements + imports a remettre).
const GAMES = [
  { key: 'clicker', name: 'Élevage', status: 'Jouer', ready: true },
];

export default function JeuxScreen({ onGameOpenChange, onOpenOptions, onOpenQuests }) {
  const [openGame, setOpenGame] = useState(null);

  // Signale à App.js quand un jeu est ouvert, pour masquer la barre d'onglets
  // du bas pendant la partie (plus d'espace, moins de risque de tap fantôme).
  useEffect(() => {
    if (onGameOpenChange) onGameOpenChange(!!openGame);
  }, [openGame, onGameOpenChange]);

  if (openGame === 'clicker') {
    return <ClickerScreen onBack={() => setOpenGame(null)} onOpenOptions={onOpenOptions} onOpenQuests={onOpenQuests} />;
  }

  return (
    <View style={styles.container}>
      <CoinBar />
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.title}>🎮 Jeux</Text>
        {GAMES.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={styles.card}
            disabled={!g.ready}
            onPress={() => g.ready && setOpenGame(g.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>{g.name}</Text>
            <Text style={[styles.cardStatus, g.ready && styles.cardStatusReady]}>{g.status}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c' },
  list: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#eef0f6', marginBottom: 16 },
  card: {
    backgroundColor: '#1c2032',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#eef0f6' },
  cardStatus: { fontSize: 12, color: '#8d93ab', marginTop: 4 },
  cardStatusReady: { color: '#f5b942', fontWeight: '700' },
});

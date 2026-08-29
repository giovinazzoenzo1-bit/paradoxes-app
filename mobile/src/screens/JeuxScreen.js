import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import CoinBar from '../components/CoinBar';
import MorpionScreen from './games/MorpionScreen';
import Puissance4Screen from './games/Puissance4Screen';
import Game2048Screen from './games/Game2048Screen';
import MemoryScreen from './games/MemoryScreen';
import SnakeScreen from './games/SnakeScreen';
import Puzzle15Screen from './games/Puzzle15Screen';
import SudokuScreen from './games/SudokuScreen';
import NutsBoltsScreen from './games/NutsBoltsScreen';
import FlappyBirdScreen from './games/FlappyBirdScreen';
import WordleScreen from './games/WordleScreen';
import BilliardScreen from './games/BilliardScreen';

const GAMES = [
  { key: 'morpion', name: 'Morpion', status: 'Jouer', ready: true },
  { key: 'puissance4', name: 'Puissance 4', status: 'Jouer', ready: true },
  { key: '2048', name: '2048', status: 'Jouer', ready: true },
  { key: 'memory', name: 'Memory', status: 'Jouer', ready: true },
  { key: 'snake', name: 'Snake', status: 'Jouer', ready: true },
  { key: 'puzzle15', name: 'Puzzle 15', status: 'Jouer', ready: true },
  { key: 'sudoku', name: 'Sudoku', status: 'Jouer', ready: true },
  { key: 'nutsbolts', name: 'Nuts and Bolts', status: 'Jouer', ready: true },
  { key: 'flappybird', name: 'Flappy Bird', status: 'Jouer', ready: true },
  { key: 'wordle', name: 'Wordle', status: 'Jouer', ready: true },
  { key: 'billiard', name: 'Billard', status: 'Jouer', ready: true },
];

export default function JeuxScreen({ onGameOpenChange }) {
  const [openGame, setOpenGame] = useState(null);

  // Signale à App.js quand un jeu est ouvert, pour masquer la barre d'onglets
  // du bas pendant la partie (plus d'espace, moins de risque de tap fantôme).
  useEffect(() => {
    if (onGameOpenChange) onGameOpenChange(!!openGame);
  }, [openGame, onGameOpenChange]);

  if (openGame === 'morpion') {
    return <MorpionScreen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'puissance4') {
    return <Puissance4Screen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === '2048') {
    return <Game2048Screen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'memory') {
    return <MemoryScreen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'snake') {
    return <SnakeScreen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'puzzle15') {
    return <Puzzle15Screen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'sudoku') {
    return <SudokuScreen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'nutsbolts') {
    return <NutsBoltsScreen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'flappybird') {
    return <FlappyBirdScreen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'wordle') {
    return <WordleScreen onBack={() => setOpenGame(null)} />;
  }
  if (openGame === 'billiard') {
    return <BilliardScreen onBack={() => setOpenGame(null)} />;
  }

  return (
    <View style={styles.container}>
      <CoinBar />
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.title}>🎮 Jeux</Text>
        <Text style={styles.subtitle}>
          Première version native — les jeux arrivent un par un.
        </Text>
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
  cardStatusReady: { color: '#f5b942', fontWeight: '700' },
});

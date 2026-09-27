import React from 'react';
import { createRoot } from 'react-dom/client';
import { View } from 'react-native';
import { ChallengeBar } from '../../../src/screens/games/ClickerScreen';
// Le panneau de défi (vrai ChallengeBar) : en cours, puis RÉUSSI (bouton Valider).
const rien = () => {};
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, backgroundColor: '#1d3b36', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12 }}>
    <View style={{ width: '100%', height: 140 }}><ChallengeBar icon="💰" label="Mets 18 000 pièces de côté" current={8400} target={18000} cycleIndex={1} cycleTotal={8} /></View>
    <View style={{ width: '100%', height: 140 }}><ChallengeBar icon="💰" label="Mets 18 000 pièces de côté" current={18000} target={18000} cycleIndex={1} cycleTotal={8} reussi onValider={rien} /></View>
    <View style={{ width: '100%', height: 140 }}><ChallengeBar icon="🪄" label="Achète 4 niveaux de Faveur des Esprits" current={4} target={4} cycleIndex={6} cycleTotal={8} reussi onValider={rien} /></View>
  </View>,
);

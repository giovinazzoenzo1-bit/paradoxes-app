import React from 'react';
import { createRoot } from 'react-dom/client';
import { CombatResultScreen } from '../../../src/screens/games/CombatScreen.js';
const scene = new URLSearchParams(location.search).get('scene') || 'defaite';
const rien = () => {};
const aide = { onMonter: rien, onPackGriffes: rien, coutPack: 12, onElixir: rien, coutElixir: 30, onVideoEnergie: rien, adsLeft: 3 };
const stats = { totalDamageDealt: 1840, totalDamageTaken: 2310, rounds: 17, fightersFainted: 1 };
const props = scene === 'victoire'
  ? { outcome: 'win', levelNumber: 12, battleStats: { ...stats, fightersFainted: 0, rounds: 8 }, opponentCount: 2, premiereVictoire: true }
  : { outcome: 'lose', levelNumber: 19, battleStats: stats, opponentCount: 3, aide, manque: 5, presque: true, nbCreatures: 2 };
createRoot(document.getElementById('root')).render(<CombatResultScreen {...props} onContinue={rien} onNextLevel={rien} />);

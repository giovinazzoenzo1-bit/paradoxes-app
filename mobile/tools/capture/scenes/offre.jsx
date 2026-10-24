// Banc (22/10) : l'offre qui surgit (?fete=1 : la fête d'un achat à la place).
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ImageBackground } from 'react-native';
import OffreSurgissante from '../../../src/components/OffreSurgissante';
import FeteAchat from '../../../src/components/FeteAchat';
import { produit } from '../../../src/games/clicker/achats';
const q = new URLSearchParams(window.location.search);
createRoot(document.getElementById('root')).render(
  <ImageBackground source={require('../../../assets/menu/fond.jpg')} style={{ flex: 1 }} resizeMode="cover">
    {q.get('fete') ? <FeteAchat objets={['💎', '🐾']} sousTexte="+400 💎 · +1 987 Griffes (en Exploration)" onFin={() => {}} />
      : <OffreSurgissante produit={produit(q.get('id') || 'pack_ascension')} contenuTexte="1 987 Griffes + 400 💎 + 3.6M pièces" finA={Date.now() + 23 * 3600 * 1000 + 59 * 60 * 1000} onAcheter={() => {}} onFermer={() => {}} />}
  </ImageBackground>,
);

// Banc (22/10) : l'offre qui surgit (?fete=1 : la fête d'un achat à la place).
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ImageBackground } from 'react-native';
import OffreSurgissante from '../../../src/components/OffreSurgissante';
import FeteAchat from '../../../src/components/FeteAchat';
import { produit } from '../../../src/games/clicker/achats';
import { IMAGES_ACHATS } from '../../../src/components/imagesAchats';
import { offreDuMoment } from '../../../src/games/clicker/offresMoments';
const q = new URLSearchParams(window.location.search);
// 30/10 : ?moment=bloque (gardien, pubs, affaire…) = l'offre telle qu'un MOMENT la présente (phrase, minuterie seulement si elle expire).
const o = q.get('moment') ? offreDuMoment(q.get('moment'), { etape: 23 }) : null;
const id = o ? o.id : (q.get('id') || 'pack_ascension');
createRoot(document.getElementById('root')).render(
  <ImageBackground source={require('../../../assets/menu/fond.jpg')} style={{ flex: 1 }} resizeMode="cover">
    {q.get('fete') ? <FeteAchat objets={['💎', '🐾']} sousTexte="+400 💎 · +1 987 Griffes (en Exploration)" onFin={() => {}} />
      : <OffreSurgissante produit={produit(id)} image={IMAGES_ACHATS[id]} contenuTexte={o ? (id === 'sans_pubs' ? '' : '1 987 Griffes + 400 💎') : '1 987 Griffes + 400 💎 + 3.6M pièces'}
          finA={o ? o.finA : Date.now() + 23 * 3600 * 1000 + 59 * 60 * 1000} accroche={o ? o.accroche : ''} onAcheter={() => {}} onFermer={() => {}} />}
  </ImageBackground>,
);

// Banc (22/10) : l'offre qui surgit (?fete=1 : la fête d'un achat à la place).
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ImageBackground } from 'react-native';
import OffreSurgissante from '../../../src/components/OffreSurgissante';
import FeteAchat from '../../../src/components/FeteAchat';
import { produit, contenuReel } from '../../../src/games/clicker/achats';
import { CREATURES } from '../../../src/games/clicker/clickerLogic';
import { IMAGES_ACHATS } from '../../../src/components/imagesAchats';
import { offreDuMoment } from '../../../src/games/clicker/offresMoments';
const q = new URLSearchParams(window.location.search);
// 30/10 : ?moment=bloque (gardien, pubs, affaire…) = l'offre telle qu'un MOMENT la présente (phrase, minuterie seulement si elle expire).
const o = q.get('moment') ? offreDuMoment(q.get('moment'), { etape: 23 }) : null;
const id = o ? o.id : (q.get('id') || 'pack_ascension');
// Le contenu RÉEL (même calcul que le jeu), écrit comme l'écran principal l'écrit.
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const texteContenu = (c) => [c.griffes ? `${k(c.griffes)} Griffes` : null, c.diamants ? `${c.diamants} 💎` : null, c.pieces ? `${k(c.pieces)} pièces` : null].filter(Boolean).join(' + ');
createRoot(document.getElementById('root')).render(
  <ImageBackground source={require('../../../assets/menu/fond.jpg')} style={{ flex: 1 }} resizeMode="cover">
    {q.get('fete') ? <FeteAchat objets={['💎', '🐾']} sousTexte="+400 💎 · +1 987 Griffes (en Exploration)" onFin={() => {}} />
      : <OffreSurgissante produit={produit(id)} image={IMAGES_ACHATS[id]} contenuTexte={o ? texteContenu(contenuReel(id, { creature: CREATURES[0], niveau: 30, passifParSec: 250 })) : '1 987 Griffes + 400 💎 + 3.6M pièces'}
          finA={o ? o.finA : Date.now() + 23 * 3600 * 1000 + 59 * 60 * 1000} accroche={o ? o.accroche : ''} onAcheter={() => {}} onFermer={() => {}} />}
  </ImageBackground>,
);

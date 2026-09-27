import React from 'react';
import { createRoot } from 'react-dom/client';
import { View, Text, Image } from 'react-native';
import { FenetreBois, BoutonBois, COURONNE, CRISTAL, SABLIER } from '../../../src/screens/games/fenetreBois';
// Fenêtres et boutons du thème forêt (vrais composants), textes du jeu.
const rien = () => {};
const t = { color: '#fff', fontSize: 15, textAlign: 'center', marginBottom: 6 };
createRoot(document.getElementById('root')).render(
  <View style={{ flex: 1, backgroundColor: '#1d2b24', alignItems: 'center', paddingTop: 10, gap: 14 }}>
    <FenetreBois titre="Boss vaincu !">
      <Image source={COURONNE} style={{ width: 118, height: 118 }} resizeMode="contain" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image source={CRISTAL} style={{ width: 22, height: 42 }} resizeMode="contain" />
        <Text style={{ color: '#7ee8ff', fontSize: 30, fontWeight: '900' }}>+3</Text>
      </View>
      <BoutonBois texte="Continuer" onPress={rien} />
    </FenetreBois>
    <FenetreBois titre="Gardien vaincu !">
      <Image source={COURONNE} style={{ width: 118, height: 118 }} resizeMode="contain" />
      <Text style={t}>Ton œuf éclot.</Text>
      <Text style={[t, { color: '#FFE9A8', fontWeight: '700' }]}>⚔️ Gardien 24 · 🛡️ Ton deck 22</Text>
      <BoutonBois texte="Voir ma créature" onPress={rien} />
    </FenetreBois>
    <BoutonBois couleur="rouge" largeur={312} hauteur={64} texte="⚔️ Affronter le gardien" sousTexte="Gardien 24 · Ton deck 22 — améliore tes créatures" onPress={rien} />
    <BoutonBois couleur="bleu" largeur={257} hauteur={50} icone={SABLIER} texte="Mettre en incubation" sousTexte="34 min 36" onPress={rien} />
    <BoutonBois couleur="vert" largeur={273} hauteur={56} texte="🐣 Faire éclore l'œuf" onPress={rien} />
  </View>,
);

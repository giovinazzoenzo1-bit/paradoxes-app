// 18/10 — FAUSSE PUB (demande de l'auteur) : écran plein de 15 s, impossible à fermer avant la fin — pas de vrai SDK de
// pub ; la durée empêche les testeurs d'en abuser. La récompense n'est donnée qu'en touchant « Récupérer ».
// Utilisée par : +1 poudre runique (menu des Runes) et Tap ×2 pendant 2 min (écran principal du clicker).
import React, { useEffect, useState } from 'react';
import { droitsAchats } from '../games/clicker/achats';
import { noterPubVue } from '../games/clicker/offresMoments';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { ICONES_PUB } from './iconesPubs';

export const DUREE_FAUSSE_PUB_SEC = 15;

export default function FaussePub({ visible = false, recompense = '', onFin }) {
  // 💳 « Sans pubs » (achat, 22/10) : la récompense est donnée TOUT DE SUITE, sans montrer la pub. Point de passage unique
  // des pubs du jeu (Tap ×2, poudre runique) — la vraie régie pub passera aussi par ici.
  const sansPubs = droitsAchats().sansPubs;
  useEffect(() => { if (visible && sansPubs && onFin) onFin(); }, [visible, sansPubs]);
  const [reste, setReste] = useState(DUREE_FAUSSE_PUB_SEC);
  useEffect(() => {
    if (!visible) return undefined;
    const t0 = Date.now(); // compté sur l'horloge : un minuteur en retard ne raccourcit rien
    setReste(DUREE_FAUSSE_PUB_SEC);
    const id = setInterval(() => {
      const r = Math.max(0, DUREE_FAUSSE_PUB_SEC - Math.floor((Date.now() - t0) / 1000));
      setReste(r);
      if (r <= 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [visible]);
  const fini = reste <= 0;
  if (sansPubs) return null; // (après tous les hooks) rien à montrer : la récompense est déjà donnée
  return (
    <Modal visible={!!visible} animationType="fade" transparent={false} onRequestClose={() => {}}>
      <View style={st.fond}>
        <Text style={st.titre}>Publicité</Text>
        <Image source={ICONES_PUB.badge} style={st.image} resizeMode="contain" />
        <Text style={st.texte}>Ta récompense : {recompense}</Text>
        <View style={st.barre}>
          <View style={[st.plein, { width: `${Math.round((1 - reste / DUREE_FAUSSE_PUB_SEC) * 100)}%` }]} />
        </View>
        <Text style={st.texte}>{fini ? 'Merci !' : `Récompense dans ${reste} s`}</Text>
        {/* 💳 30/10 : une pub regardée JUSQU'AU BOUT est comptée ici (la 3e du jour ouvre le moment « Sans pubs », offresMoments). */}
        <TouchableOpacity disabled={!fini} onPress={() => { if (fini && onFin) { noterPubVue(); onFin(); } }} style={[st.bouton, !fini && st.boutonOff]}>
          <Text style={st.boutonTexte}>{fini ? 'Récupérer' : '…'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  fond: { flex: 1, backgroundColor: '#0b0b14', alignItems: 'center', justifyContent: 'center', padding: 24 },
  titre: { color: '#9aa0b5', fontSize: 14, letterSpacing: 2, marginBottom: 12 },
  image: { width: 128, height: 120, marginBottom: 16 },
  texte: { color: '#ffffff', fontSize: 18, textAlign: 'center', marginVertical: 8 },
  barre: { width: '80%', height: 10, borderRadius: 5, backgroundColor: '#2a2a3a', overflow: 'hidden', marginVertical: 12 },
  plein: { height: 10, backgroundColor: '#f2c94c' },
  bouton: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 36, borderRadius: 24, backgroundColor: '#f2c94c' },
  boutonOff: { backgroundColor: '#3a3a4a' },
  boutonTexte: { color: '#0b0b14', fontSize: 18, fontWeight: '700' },
});

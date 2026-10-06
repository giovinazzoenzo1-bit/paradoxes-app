// Boîte de dialogue MAISON (06/10) : même usage qu'Alert.alert —
//   afficherDialogue(titre, message, [{ texte, style: 'principal' | 'annuler' | 'danger', onPress }])
// — mais dans le style du jeu (FenetreJeu), affichée par un HÔTE unique posé à la racine de
// l'appli (App.js), au-dessus de tout. SANS hôte (un écran testé seul…), elle retombe sur la
// boîte du SYSTÈME : aucun message ne peut se perdre.
// ⚠️ Les alertes de SÉCURITÉ (« Tu sembles bloqué », « Le jeu a rencontré une erreur ») restent
// en Alert : elles doivent marcher même quand l'interface du jeu est cassée.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { FenetreJeu, BoutonBois } from './FenetreJeu';

let afficheur = null;

export function afficherDialogue(titre, message = '', boutons = null) {
  const liste = boutons && boutons.length ? boutons : [{ texte: 'OK', style: 'principal' }];
  if (afficheur) { afficheur({ titre, message, boutons: liste, id: Date.now() + Math.random() }); return; }
  Alert.alert(titre, message, liste.map((b) => ({ text: b.texte, onPress: b.onPress, style: b.style === 'annuler' ? 'cancel' : b.style === 'danger' ? 'destructive' : 'default' })));
}

export function HoteDialogue() {
  const [d, setD] = useState(null);
  const { width: W, height: H } = useWindowDimensions();
  useEffect(() => {
    afficheur = setD;
    return () => { if (afficheur === setD) afficheur = null; };
  }, []);
  if (!d) return null;
  const paysage = W > H;
  const n = d.boutons.length;
  const bl = Math.min(paysage ? 210 : 160, Math.floor((Math.min(W * (paysage ? 0.56 : 0.9), 620) - 60) / Math.max(1, n)) - 8);
  const fermer = () => setD(null);
  return (
    <FenetreJeu titre={d.titre} zIndex={2000}>
      {d.message ? <Text style={styles.message}>{d.message}</Text> : null}
      <View style={styles.boutons}>
        {d.boutons.map((b, i) => (
          <View key={i} style={{ marginHorizontal: 4 }}>
            <BoutonBois texte={b.texte} style={b.style || (i === n - 1 ? 'principal' : 'annuler')} largeur={bl} hauteur={paysage ? 44 : 46}
              onPress={() => { fermer(); if (b.onPress) b.onPress(); }} />
          </View>
        ))}
      </View>
    </FenetreJeu>
  );
}

const styles = StyleSheet.create({
  message: { color: '#fbe9c4', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 21, marginBottom: 14, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
  boutons: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
});

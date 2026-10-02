import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { FenetreBois, BoutonLarge, CYAN_CHAMPIGNON, largeurInterieureFenetre } from './fenetreBois';

// Fiche détaillée d'un élément de la boutique (déplacée de l'ancien fichier de
// l'arbre, 02/10) : un VRAI menu, fond presque opaque, fenêtre en bois.
const { width: ECRAN_L } = Dimensions.get('window');
const FICHE_L = Math.min(Math.round(ECRAN_L * 0.92), 380);
const FICHE_INT = largeurInterieureFenetre(FICHE_L);
const COULEUR_ETAT = { achetable: '#f7cf57', cher: '#6d7f86', verrouille: '#3a4a50', max: '#f7cf57' };

// Fiche d'un élément : un VRAI menu (fond presque opaque, fenêtre en bois,
// médaillon, niveau, gain, détail, bouton d'achat). Réutilisée par l'arbre
// ET par le grimoire (27/09).
export function FicheElement({ fiche, onFermer, onAcheter, onAscend, formatNum }) {
  if (!fiche) return null;
  return (
    <View style={styles.menuFond}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => onFermer()} />
      <FenetreBois titre={fiche.etat === 'verrouille' ? '???' : fiche.nom} largeur={FICHE_L} onFermer={() => onFermer()}>
        <View style={[styles.ficheMedaillon, { borderColor: COULEUR_ETAT[fiche.etat] }]}>
          {/* Icône peinte si fournie (grimoire), sinon l'émoji. */}
          {fiche.etat !== 'verrouille' && fiche.icone ? <Image source={fiche.icone} resizeMode="contain" style={{ width: 56, height: 56 }} />
            : <Text style={styles.ficheEmoji}>{fiche.etat === 'verrouille' ? '🔒' : fiche.emoji}</Text>}
        </View>
        {fiche.niveau && fiche.etat !== 'verrouille' ? <Text style={styles.ficheNiveau}>Niveau actuel : {fiche.niveau}</Text> : null}
        {fiche.gain ? (
          <View style={[styles.ficheBloc, { width: FICHE_INT }]}>
            <Text style={styles.ficheIntitule}>{fiche.etat === 'verrouille' ? 'Pour le débloquer' : 'Ce que ça rapporte'}</Text>
            <Text style={[styles.ficheGain, fiche.etat === 'verrouille' && styles.gainVerrou]}>{fiche.gain}</Text>
          </View>
        ) : null}
        {fiche.detail && fiche.detail !== fiche.gain ? <Text style={[styles.ficheLigne, { width: FICHE_INT }]}>{fiche.detail}</Text> : null}
        {fiche.progres != null ? (
          <View style={[styles.ficheBarre, { width: FICHE_INT }]}>
            <View style={{ width: Math.round((FICHE_INT - 4) * fiche.progres), height: 8, borderRadius: 4, backgroundColor: CYAN_CHAMPIGNON }} />
          </View>
        ) : null}
        {fiche.id === 'ascension' ? (
          <BoutonLarge
            couleur={fiche.etat === 'achetable' ? 'vert' : 'rouge'}
            largeur={FICHE_INT}
            hauteur={56}
            desactive={fiche.etat !== 'achetable'}
            texte="🌟 Faire l'Ascension"
            onPress={() => { onFermer(); if (onAscend) onAscend(); }}
          />
        ) : fiche.prix != null && fiche.etat !== 'verrouille' && fiche.etat !== 'max' ? (
          <BoutonLarge
            couleur={fiche.etat === 'achetable' ? 'vert' : 'rouge'}
            largeur={FICHE_INT}
            hauteur={56}
            desactive={fiche.etat !== 'achetable'}
            texte={`Acheter · ${fiche.devise === 'diamants' ? '💎' : '💰'} ${formatNum(fiche.prix)}`}
            sousTexte={fiche.etat === 'achetable' ? null : 'Pas assez de pièces'}
            onPress={() => onAcheter(fiche.id)}
          />
        ) : fiche.etat === 'max' ? <Text style={styles.ficheNiveau}>⭐ Niveau maximum atteint</Text> : null}
      </FenetreBois>
    </View>
  );
}

const styles = StyleSheet.create({
  ficheBarre: { height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)', padding: 2, marginBottom: 8, justifyContent: 'center' },
  ficheBloc: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8, alignItems: 'center' },
  ficheEmoji: { fontSize: 44 },
  ficheGain: { color: '#8ff0e0', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  ficheIntitule: { color: '#d8c7a4', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  ficheLigne: { color: '#d8e8e6', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  ficheMedaillon: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, backgroundColor: 'rgba(14,30,34,0.95)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  ficheNiveau: { color: '#f0d48a', fontSize: 14, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
  gainVerrou: { color: '#ffcf6b' },
  // Vrai menu : fond PRESQUE OPAQUE (avec l'arbre visible derrière, la fiche
  // était illisible — retour de l'auteur), centré (en bas, le bouton passait
  // sous la barre).
  menuFond: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, backgroundColor: 'rgba(2,8,10,0.94)', alignItems: 'center', justifyContent: 'center', padding: 12 },
});

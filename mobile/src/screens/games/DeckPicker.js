// Sélecteur de deck — extrait dans son propre fichier (29/08) pour être
// réutilisable à la fois depuis ClickerScreen (écran principal, DeckRow)
// ET AdventureScreen (modifier son deck sans repasser par le clicker) —
// SANS créer d'import circulaire entre les deux écrans (même piège déjà
// rencontré avec COLORS, voir clickerTheme.js).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from './clickerTheme';
import { CREATURES, RARITY_COLOR, stageForLevel } from '../../games/clicker/clickerLogic';

// Choix de quelle créature possédée occupe l'emplacement tapé. Une
// créature déjà dans un autre emplacement peut être choisie — elle sera
// simplement retirée de l'autre emplacement (pas de doublon dans le deck).
export function DeckPicker({ slotIndex, deck, owned, onPick, onClear, onClose }) {
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.close} onPress={onClose}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      {/* maxHeight sur ce View englobant, PAS sur le ScrollView lui-même
          (peu fiable en RN) — avec 26 créatures désormais, la grille peut
          largement dépasser l'écran, il faut vraiment pouvoir défiler
          jusqu'en bas pour voir "Vider cet emplacement". */}
      <View style={styles.panelWrap}>
        <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text style={styles.title}>Emplacement {slotIndex + 1} du deck</Text>
        <Text style={styles.subtitle}>Choisis une créature que tu possèdes</Text>

        {owned.length === 0 ? (
          <Text style={styles.emptyText}>Tu ne possèdes encore aucune créature — invoque-en une d'abord !</Text>
        ) : (
          <View style={styles.grid}>
            {owned
              .filter((o) => CREATURES.some((c) => c.id === o.id)) // garde-fou : ignore un id devenu invalide (créature renommée sans migration) plutôt que de planter
              .map((o) => {
                const creature = CREATURES.find((c) => c.id === o.id);
                const display = creature.stages[stageForLevel(o.level)];
                const inOtherSlot = deck.includes(o.id) && deck[slotIndex] !== o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.cell, deck[slotIndex] === o.id && styles.cellSelected, { borderColor: RARITY_COLOR[creature.rarity] }]}
                    onPress={() => onPick(o.id)}
                  >
                    <Text style={styles.emoji}>{display.emoji}</Text>
                    <Text style={styles.name} numberOfLines={1}>{display.name}</Text>
                    {inOtherSlot && <Text style={styles.inUse}>déjà en jeu</Text>}
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {deck[slotIndex] && (
          <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
            <Text style={styles.clearBtnText}>Vider cet emplacement</Text>
          </TouchableOpacity>
        )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  panelWrap: { width: '100%', maxHeight: '85%' },
  panel: {
    width: '100%', backgroundColor: COLORS.panel, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
  },
  panelContent: { alignItems: 'center', padding: 24, paddingBottom: 40 },
  close: { position: 'absolute', top: 30, right: 30, zIndex: 10 },
  closeText: { color: COLORS.muted, fontSize: 18, fontWeight: '900' },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '900', marginTop: 6 },
  subtitle: { color: COLORS.muted, fontSize: 12, marginTop: 4, marginBottom: 14, textAlign: 'center' },
  emptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, width: '100%' },
  cell: {
    width: 84, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, alignItems: 'center',
    borderWidth: 1,
  },
  cellSelected: { backgroundColor: 'rgba(245,197,66,0.12)' },
  emoji: { fontSize: 30 },
  name: { color: COLORS.text, fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  inUse: { color: COLORS.muted, fontSize: 8, marginTop: 2, fontStyle: 'italic' },
  clearBtn: { marginTop: 16, paddingVertical: 8 },
  clearBtnText: { color: '#FF5252', fontSize: 13, fontWeight: '700' },
});

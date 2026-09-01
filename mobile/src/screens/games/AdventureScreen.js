// Écran principal du mode Aventure. Voir mobile/ADVENTURE_MODE.md pour
// le design complet et l'ordre de construction — ceci est l'étape 2
// (affichage seulement, le vrai combat et la fiche créature détaillée
// arrivent aux étapes suivantes).
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './clickerTheme';
import { CREATURES, RARITY_LABEL, RARITY_COLOR, stageForLevel } from '../../games/clicker/clickerLogic';

export default function AdventureScreen({ owned, deck, onBack }) {
  const [detailCreatureId, setDetailCreatureId] = useState(null);
  const [combatComingSoon, setCombatComingSoon] = useState(false);

  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  const hasEmptySlot = deck.some((id) => !id);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🗺️ Aventure</Text>
      </View>

      {/* Les 3 créatures affichées ici sont le MÊME deck que celui utilisé
          pour les bulles de pouvoir du clicker classique — pas de
          sélection séparée à gérer, une seule source de vérité. */}
      <View style={styles.creatureRow}>
        {deck.map((id, i) => {
          const creature = id ? CREATURES.find((c) => c.id === id) : null;
          const own = id ? ownedMap[id] : null;
          const display = creature && own ? creature.stages[stageForLevel(own.level)] : null;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.creatureSlot, creature && { borderColor: RARITY_COLOR[creature.rarity] }]}
              onPress={() => creature && setDetailCreatureId(id)}
              disabled={!creature}
            >
              {display ? (
                <>
                  <Text style={styles.creatureEmoji}>{display.emoji}</Text>
                  <Text style={styles.creatureName} numberOfLines={1}>{display.name}</Text>
                  <Text style={[styles.creatureRarity, { color: RARITY_COLOR[creature.rarity] }]}>{RARITY_LABEL[creature.rarity]}</Text>
                </>
              ) : (
                <Text style={styles.emptySlotEmoji}>🥚</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {hasEmptySlot && (
        <Text style={styles.hint}>Configure ton deck depuis l'écran principal du clicker pour remplir les emplacements vides.</Text>
      )}

      {!hasEmptySlot && <Text style={styles.hint}>Touche une créature pour voir sa fiche.</Text>}

      <View style={{ flex: 1 }} />

      {/* Barre du bas dédiée à l'Aventure — pour les futurs modes de jeu
          qu'on ajoutera avec le temps. Un seul item pour l'instant. */}
      <View style={styles.subBar}>
        <TouchableOpacity style={styles.subBarItem} onPress={() => setCombatComingSoon(true)}>
          <Ionicons name="map" size={24} color={COLORS.action} />
          <Text style={styles.subBarLabel}>Mode Combat</Text>
        </TouchableOpacity>
      </View>

      {detailCreatureId && (
        <CreaturePreviewOverlay
          creature={CREATURES.find((c) => c.id === detailCreatureId)}
          owned={ownedMap[detailCreatureId]}
          onClose={() => setDetailCreatureId(null)}
        />
      )}

      {combatComingSoon && (
        <View style={styles.overlay}>
          <View style={styles.overlayPanel}>
            <TouchableOpacity style={styles.overlayClose} onPress={() => setCombatComingSoon(false)}>
              <Text style={styles.overlayCloseText}>✕</Text>
            </TouchableOpacity>
            <Ionicons name="map" size={40} color={COLORS.action} />
            <Text style={styles.overlayTitle}>Mode Combat des chapitres</Text>
            <Text style={styles.overlaySubtitle}>
              Bientôt disponible — une carte de niveaux organisés en chapitres, avec des adversaires de plus en plus forts.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Aperçu léger d'une créature — la vraie fiche détaillée (histoire,
// compétences) arrive à l'étape 3 du plan. Pour l'instant, juste de quoi
// confirmer que le clic fonctionne et donner les infos déjà disponibles.
function CreaturePreviewOverlay({ creature, owned, onClose }) {
  const display = creature.stages[stageForLevel(owned.level)];
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayPanel}>
        <TouchableOpacity style={styles.overlayClose} onPress={onClose}>
          <Text style={styles.overlayCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.previewEmoji}>{display.emoji}</Text>
        <Text style={styles.overlayTitle}>{display.name}</Text>
        <Text style={[styles.overlaySubtitle, { color: RARITY_COLOR[creature.rarity] }]}>
          {RARITY_LABEL[creature.rarity]} · {creature.family} · Niveau {owned.level}
        </Text>
        <Text style={[styles.overlaySubtitle, { marginTop: 10 }]}>
          Fiche détaillée (histoire, compétences) bientôt disponible.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: { marginRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '900' },

  creatureRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 30 },
  creatureSlot: {
    width: 100, height: 130, borderRadius: 18, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border, padding: 8,
  },
  creatureEmoji: { fontSize: 42 },
  creatureName: { color: COLORS.text, fontSize: 11, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  creatureRarity: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  emptySlotEmoji: { fontSize: 36, opacity: 0.3 },

  hint: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 18, paddingHorizontal: 20 },

  subBar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10,
  },
  subBarItem: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  subBarLabel: { color: COLORS.action, fontSize: 11, fontWeight: '800', marginTop: 4 },

  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  overlayPanel: {
    width: '100%', backgroundColor: COLORS.panel, borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  overlayClose: { position: 'absolute', top: 12, right: 14 },
  overlayCloseText: { color: COLORS.muted, fontSize: 18, fontWeight: '900' },
  previewEmoji: { fontSize: 60, marginBottom: 6 },
  overlayTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  overlaySubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },
});

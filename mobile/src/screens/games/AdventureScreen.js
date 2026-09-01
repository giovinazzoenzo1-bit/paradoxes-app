// Écran principal du mode Aventure. Voir mobile/ADVENTURE_MODE.md pour
// le design complet et l'ordre de construction — ceci est l'étape 2
// (affichage seulement, le vrai combat et la fiche créature détaillée
// arrivent aux étapes suivantes).
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './clickerTheme';
import { CREATURES, RARITY_LABEL, RARITY_COLOR, stageForLevel, CREATURE_POWERS } from '../../games/clicker/clickerLogic';
import { combatStatsForCreature } from '../../games/clicker/combatLogic';

export default function AdventureScreen({ owned, deck, onBack }) {
  const [detailCreatureId, setDetailCreatureId] = useState(null);
  const [combatComingSoon, setCombatComingSoon] = useState(false);

  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  const hasEmptySlot = deck.some((id) => !id);

  // La fiche détaillée est un vrai écran (pas juste un overlay léger
  // comme à l'étape 2) — retour anticipé, même schéma que celui utilisé
  // dans ClickerScreen pour la navigation entre écrans complets.
  if (detailCreatureId) {
    return (
      <CreatureDetailScreen
        creature={CREATURES.find((c) => c.id === detailCreatureId)}
        owned={ownedMap[detailCreatureId]}
        onBack={() => setDetailCreatureId(null)}
      />
    );
  }

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

// Fiche détaillée d'une créature, inspirée de l'onglet "Info" de Monster
// Legends fourni en référence : portrait, stats de combat, compétence,
// histoire. Les stats viennent de combatLogic.js (étape 1) — première
// fois que cette logique sert réellement à quelque chose de visible.
function CreatureDetailScreen({ creature, owned, onBack }) {
  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const stats = combatStatsForCreature(creature, owned.level);
  const power = CREATURE_POWERS[creature.id];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{display.name}</Text>
      </View>

      <View style={styles.detailPortrait}>
        <Text style={styles.detailEmoji}>{display.emoji}</Text>
        <Text style={[styles.detailRarity, { color: RARITY_COLOR[creature.rarity] }]}>
          {RARITY_LABEL[creature.rarity]} · {creature.family}
        </Text>
        <Text style={styles.detailLevel}>Niveau {owned.level}</Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <Ionicons name="flash" size={18} color={COLORS.neonPink} />
          <Text style={styles.statLabel}>Force</Text>
          <Text style={styles.statValue}>{stats.attack}</Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="heart" size={18} color={COLORS.good} />
          <Text style={styles.statLabel}>Vie</Text>
          <Text style={styles.statValue}>{stats.hp}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>✨ Compétence</Text>
        <Text style={styles.sectionBody}>{power.name}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📖 Histoire</Text>
        <Text style={styles.sectionBody}>{creature.lore}</Text>
      </View>
    </ScrollView>
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
  overlayTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  overlaySubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },

  detailPortrait: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  detailEmoji: { fontSize: 90 },
  detailRarity: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  detailLevel: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 4 },

  statsCard: {
    backgroundColor: COLORS.panel, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  statLabel: { color: COLORS.muted, fontSize: 13, fontWeight: '700', flex: 1 },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: '900' },

  sectionCard: {
    backgroundColor: COLORS.panel, borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.action, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  sectionBody: { color: COLORS.text, fontSize: 13, lineHeight: 19 },
});

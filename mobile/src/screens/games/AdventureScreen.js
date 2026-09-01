// Écran principal du mode Aventure. Voir mobile/ADVENTURE_MODE.md pour
// le design complet et l'ordre de construction — ceci ajoute l'étape 4
// (carte des chapitres/niveaux, structure visuelle seulement, le vrai
// combat derrière chaque niveau arrive à l'étape 5).
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from './clickerTheme';
import CombatScreen from './CombatScreen';
import { CREATURES, RARITY_LABEL, RARITY_COLOR, stageForLevel, CREATURE_POWERS } from '../../games/clicker/clickerLogic';
import {
  combatStatsForCreature,
  chapterForLevel,
  levelIndexInChapter,
  LEVELS_PER_CHAPTER,
  opponentForLevel,
  griffesReward,
} from '../../games/clicker/combatLogic';

// Sauvegarde séparée de celle du clicker classique — la progression
// d'Aventure grossira avec le temps (niveaux, ressource Griffes...), pas
// la peine d'alourdir davantage la sauvegarde déjà volumineuse du clicker.
const ADVENTURE_STORAGE_KEY = 'adventure:state:v1';

export default function AdventureScreen({ owned, deck, onBack }) {
  const [detailCreatureId, setDetailCreatureId] = useState(null);
  const [chapterMapOpen, setChapterMapOpen] = useState(false);
  const [currentUnlockedLevel, setCurrentUnlockedLevel] = useState(1);
  const [griffes, setGriffes] = useState(0);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const currentUnlockedLevelRef = useRef(1);
  currentUnlockedLevelRef.current = currentUnlockedLevel;

  // Chargement de la progression au montage.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ADVENTURE_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setCurrentUnlockedLevel(saved.currentUnlockedLevel || 1);
          setGriffes(saved.griffes || 0);
        }
      } catch (e) {
        // pas de sauvegarde valide, on démarre au niveau 1
      }
      setProgressLoaded(true);
    })();
  }, []);

  // Sauvegarde à chaque changement.
  useEffect(() => {
    if (!progressLoaded) return;
    AsyncStorage.setItem(ADVENTURE_STORAGE_KEY, JSON.stringify({ currentUnlockedLevel, griffes }));
  }, [currentUnlockedLevel, griffes, progressLoaded]);

  // Appelé par ChapterMapScreen (via CombatScreen) à la fin d'un combat
  // gagné : débloque le niveau suivant SEULEMENT si c'était bien le
  // niveau de progression actuel (rejouer un niveau déjà acquis ne fait
  // pas avancer davantage), et crédite la récompense.
  const handleLevelWon = (levelNumber, reward) => {
    setGriffes((g) => g + reward);
    if (levelNumber === currentUnlockedLevelRef.current) {
      setCurrentUnlockedLevel((l) => l + 1);
    }
  };

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

  // Carte des chapitres — même schéma de retour anticipé.
  if (chapterMapOpen) {
    return (
      <ChapterMapScreen
        currentUnlockedLevel={currentUnlockedLevel}
        owned={owned}
        deck={deck}
        griffes={griffes}
        onLevelWon={handleLevelWon}
        onBack={() => setChapterMapOpen(false)}
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
        <TouchableOpacity style={styles.subBarItem} onPress={() => setChapterMapOpen(true)}>
          <Ionicons name="map" size={24} color={COLORS.action} />
          <Text style={styles.subBarLabel}>Mode Combat</Text>
        </TouchableOpacity>
      </View>
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

// Carte des chapitres/niveaux, façon Monster Legends (capture de
// référence fournie) — sentier en zigzag plutôt qu'une vraie courbe SVG
// (plus simple et robuste en React Native, même effet de progression
// visuelle). Structure uniquement à cette étape : taper un niveau montre
// un aperçu de l'adversaire, mais le vrai combat reste à coder (étape 5).
function ChapterMapScreen({ currentUnlockedLevel, owned, deck, griffes, onLevelWon, onBack }) {
  const [levelPreview, setLevelPreview] = useState(null); // numéro de niveau ou null
  const [activeBattle, setActiveBattle] = useState(null); // { levelNumber, creatureId } ou null

  // Combat en cours — retour anticipé, même schéma que le reste de
  // l'écran Aventure.
  if (activeBattle) {
    const ownedEntry = owned.find((o) => o.id === activeBattle.creatureId);
    const creature = CREATURES.find((c) => c.id === activeBattle.creatureId);
    return (
      <CombatScreen
        playerCreature={creature}
        playerOwnedLevel={ownedEntry.level}
        levelNumber={activeBattle.levelNumber}
        onFinish={(outcome) => {
          if (outcome === 'win') {
            onLevelWon(activeBattle.levelNumber, griffesReward(activeBattle.levelNumber));
          }
          setActiveBattle(null);
          setLevelPreview(null);
        }}
      />
    );
  }

  // Affiche le chapitre en cours + 2 chapitres suivants (verrouillés,
  // pour montrer qu'il y a une suite) plutôt que de générer une liste
  // potentiellement infinie d'un coup.
  const currentChapter = chapterForLevel(currentUnlockedLevel);
  const chaptersToShow = currentChapter + 2;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚔️ Chapitres</Text>
      </View>
      <Text style={styles.griffesText}>🐾 {griffes} Griffes</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {Array.from({ length: chaptersToShow }, (_, chapterIdx) => chapterIdx + 1).map((chapterNum) => (
          <View key={chapterNum} style={styles.chapterBlock}>
            <Text style={styles.chapterTitle}>Chapitre {chapterNum}</Text>
            <View style={styles.chapterPath}>
              {Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => (chapterNum - 1) * LEVELS_PER_CHAPTER + i + 1).map(
                (levelNum, i) => {
                  const align = i % 3 === 0 ? 'flex-start' : i % 3 === 1 ? 'center' : 'flex-end';
                  const state = levelNum < currentUnlockedLevel ? 'done' : levelNum === currentUnlockedLevel ? 'current' : 'locked';
                  return (
                    <View key={levelNum} style={[styles.levelNodeRow, { alignItems: align === 'flex-start' ? 'flex-start' : align === 'flex-end' ? 'flex-end' : 'center' }]}>
                      <TouchableOpacity
                        style={[
                          styles.levelNode,
                          state === 'current' && styles.levelNodeCurrent,
                          state === 'done' && styles.levelNodeDone,
                        ]}
                        onPress={() => state !== 'locked' && setLevelPreview(levelNum)}
                        disabled={state === 'locked'}
                      >
                        {state === 'locked' ? (
                          <Ionicons name="lock-closed" size={16} color={COLORS.muted} />
                        ) : state === 'done' ? (
                          <Ionicons name="checkmark" size={20} color="#0a3d24" />
                        ) : (
                          <Text style={styles.levelNodeText}>{levelIndexInChapter(levelNum)}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                }
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {levelPreview && (
        <FighterSelectOverlay
          levelNumber={levelPreview}
          owned={owned}
          deck={deck}
          onClose={() => setLevelPreview(null)}
          onSelect={(creatureId) => setActiveBattle({ levelNumber: levelPreview, creatureId })}
        />
      )}
    </View>
  );
}

// Choix du combattant avant de lancer le combat — limité aux 3 créatures
// du deck (même roster que le reste du mode Aventure, pas de sélection
// séparée à gérer). Montre déjà l'adversaire qui attend.
function FighterSelectOverlay({ levelNumber, owned, deck, onClose, onSelect }) {
  const opponent = opponentForLevel(levelNumber);
  const display = opponent.stages[0];
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayPanel}>
        <TouchableOpacity style={styles.overlayClose} onPress={onClose}>
          <Text style={styles.overlayCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.overlayTitle}>
          Chapitre {chapterForLevel(levelNumber)} · Niveau {levelIndexInChapter(levelNumber)}
        </Text>
        <Text style={{ fontSize: 50, marginVertical: 6 }}>{display.emoji}</Text>
        <Text style={[styles.overlaySubtitle, { color: RARITY_COLOR[opponent.rarity] }]}>
          Adversaire : {display.name}
        </Text>

        <Text style={[styles.overlaySubtitle, { marginTop: 14, marginBottom: 8 }]}>Choisis ton combattant :</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {deck.map((id, i) => {
            const creature = id ? CREATURES.find((c) => c.id === id) : null;
            const own = id ? ownedMap[id] : null;
            const fighterDisplay = creature && own ? creature.stages[stageForLevel(own.level)] : null;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.fighterPick, creature && { borderColor: RARITY_COLOR[creature.rarity] }]}
                onPress={() => creature && onSelect(id)}
                disabled={!creature}
              >
                {fighterDisplay ? (
                  <Text style={{ fontSize: 30 }}>{fighterDisplay.emoji}</Text>
                ) : (
                  <Text style={{ fontSize: 24, opacity: 0.3 }}>🥚</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
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
  overlayTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  overlaySubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },

  chapterBlock: { marginBottom: 28 },
  chapterTitle: { color: COLORS.action, fontSize: 15, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  chapterPath: { width: '100%' },
  levelNodeRow: { width: '100%', paddingHorizontal: 20, marginVertical: 4 },
  levelNode: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  levelNodeCurrent: {
    borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.15)',
    shadowColor: COLORS.action, shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  levelNodeDone: { borderColor: COLORS.good, backgroundColor: COLORS.good },
  levelNodeText: { color: COLORS.text, fontSize: 15, fontWeight: '900' },

  griffesText: { color: COLORS.action, fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 14 },
  fighterPick: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },

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

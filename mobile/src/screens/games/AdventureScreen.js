// Écran principal du mode Aventure. Voir mobile/ADVENTURE_MODE.md pour
// le design complet et l'ordre de construction — ceci ajoute l'étape 4
// (carte des chapitres/niveaux, structure visuelle seulement, le vrai
// combat derrière chaque niveau arrive à l'étape 5).
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from './clickerTheme';
import CombatScreen from './CombatScreen';
import { DeckPicker } from './DeckPicker';
import { CREATURES, RARITY_LABEL, RARITY_COLOR, RARITY_BADGE_LETTER, stageForLevel } from '../../games/clicker/clickerLogic';
import {
  combatStatsForCreatureTyped,
  chapterForLevel,
  levelIndexInChapter,
  LEVELS_PER_CHAPTER,
  opponentForLevel,
  griffesReward,
  canEvolve,
  evolutionCost,
} from '../../games/clicker/combatLogic';

// Sauvegarde séparée de celle du clicker classique — la progression
// d'Aventure grossira avec le temps (niveaux, ressource Griffes...), pas
// la peine d'alourdir davantage la sauvegarde déjà volumineuse du clicker.
const ADVENTURE_STORAGE_KEY = 'adventure:state:v1';

export default function AdventureScreen({ owned, deck, onBack, onEvolveCreature, onAssignDeck, onClearDeckSlot }) {
  const [detailCreatureId, setDetailCreatureId] = useState(null);
  const [deckPickerSlot, setDeckPickerSlot] = useState(null); // index de l'emplacement en cours de modification, ou null
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

  // Fait évoluer une créature d'un palier : vérifie l'éligibilité et le
  // coût ICI (Griffes vivent dans cet écran), débite localement, puis
  // remonte au clicker (via onEvolveCreature) pour persister le nouveau
  // palier sur owned — l'évolution touche la collection du clicker, pas
  // seulement l'état de l'écran Aventure.
  const handleEvolve = (creatureId, currentTier, ownedLevel) => {
    if (!canEvolve(currentTier, ownedLevel)) return;
    const cost = evolutionCost(currentTier);
    if (griffes < cost) return;
    setGriffes((g) => g - cost);
    onEvolveCreature(creatureId, currentTier + 1);
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
        griffes={griffes}
        onEvolve={() => handleEvolve(detailCreatureId, ownedMap[detailCreatureId].evolutionTier || 0, ownedMap[detailCreatureId].level)}
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
          sélection séparée à gérer, une seule source de vérité. Touche le
          corps d'un emplacement rempli pour voir sa fiche, touche le
          petit crayon (ou un emplacement vide) pour changer qui l'occupe. */}
      <View style={styles.creatureRow}>
        {deck.map((id, i) => {
          const creature = id ? CREATURES.find((c) => c.id === id) : null;
          const own = id ? ownedMap[id] : null;
          const display = creature && own ? creature.stages[stageForLevel(own.level)] : null;
          return (
            <View key={i} style={{ alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.creatureSlot, creature && { borderColor: RARITY_COLOR[creature.rarity] }]}
                onPress={() => (creature ? setDetailCreatureId(id) : setDeckPickerSlot(i))}
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
              {creature && (
                <TouchableOpacity style={styles.editSlotBtn} onPress={() => setDeckPickerSlot(i)}>
                  <Ionicons name="pencil" size={12} color={COLORS.action} />
                  <Text style={styles.editSlotBtnText}>Changer</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {deckPickerSlot !== null && (
        <DeckPicker
          slotIndex={deckPickerSlot}
          deck={deck}
          owned={owned}
          onPick={(creatureId) => {
            onAssignDeck(deckPickerSlot, creatureId);
            setDeckPickerSlot(null);
          }}
          onClear={() => {
            onClearDeckSlot(deckPickerSlot);
            setDeckPickerSlot(null);
          }}
          onClose={() => setDeckPickerSlot(null)}
        />
      )}

      {hasEmptySlot && (
        <Text style={styles.hint}>Touche un emplacement vide pour choisir une créature.</Text>
      )}

      {!hasEmptySlot && <Text style={styles.hint}>Touche une créature pour voir sa fiche, "Changer" pour la remplacer.</Text>}

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
// Carte d'évolution : palier actuel (★★★), et si éligible (niveau
// suffisant), un bouton pour dépenser les Griffes et débloquer le
// palier suivant — pas de changement de nom, juste un boost de PV/ATQ/
// Endurance (contrairement aux 10 créatures d'origine avec 3 noms/
// dessins distincts par stade évolutif).
function EvolutionCard({ evolutionTier, ownedLevel, griffes, onEvolve }) {
  const maxed = evolutionTier >= 2;
  const eligible = !maxed && canEvolve(evolutionTier, ownedLevel);
  const cost = maxed ? null : evolutionCost(evolutionTier);
  const nextLevelNeeded = maxed ? null : (evolutionTier === 0 ? 25 : 50);

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>🌟 Évolution</Text>
      <Text style={styles.sectionBody}>Palier actuel : {'★'.repeat(evolutionTier + 1)}{'☆'.repeat(2 - evolutionTier)}</Text>
      {maxed ? (
        <Text style={[styles.speciesNote, { marginTop: 8 }]}>Palier maximum atteint.</Text>
      ) : eligible ? (
        <TouchableOpacity
          style={[styles.startBattleBtn, griffes < cost && styles.actionBtnDisabledAdv]}
          onPress={onEvolve}
          disabled={griffes < cost}
        >
          <Text style={styles.startBattleBtnText}>Évoluer — {cost} 🐾 Griffes</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.speciesNote, { marginTop: 8 }]}>Atteins le niveau {nextLevelNeeded} pour débloquer ce palier.</Text>
      )}
    </View>
  );
}


function CreatureDetailScreen({ creature, owned, griffes, onEvolve, onBack }) {
  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const baseName = creature.stages[0].name; // nom de base, pour clarifier le lien avec l'histoire
  const evolutionTier = owned.evolutionTier || 0;
  const stats = combatStatsForCreatureTyped(creature, owned.level, evolutionTier);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{display.name}</Text>
      </View>

      <View style={styles.detailPortraitRow}>
        {/* Badge de rareté à GAUCHE du portrait, façon Monster Legends —
            élément juste en dessous. */}
        <View style={styles.rarityBadgeColumn}>
          <View style={[styles.rarityBadge, { backgroundColor: RARITY_COLOR[creature.rarity] }]}>
            <Text style={styles.rarityBadgeText}>{RARITY_BADGE_LETTER[creature.rarity]}</Text>
          </View>
          <Text style={styles.elementLabel}>{creature.element}</Text>
        </View>

        <View style={styles.detailPortrait}>
          <Text style={styles.detailEmoji}>{display.emoji}</Text>
          <Text style={styles.detailRarity}>{RARITY_LABEL[creature.rarity]} · {creature.combatType}</Text>
          <Text style={styles.detailLevel}>Niveau {owned.level}</Text>
        </View>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <Ionicons name="heart" size={18} color={COLORS.good} />
          <Text style={styles.statLabel}>PV</Text>
          <Text style={styles.statValue}>{stats.hp}</Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="flash" size={18} color={COLORS.neonPink} />
          <Text style={styles.statLabel}>ATQ</Text>
          <Text style={styles.statValue}>{stats.attack}</Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="finger-print" size={18} color={COLORS.neonCyan} />
          <Text style={styles.statLabel}>Vitesse de clic</Text>
          <Text style={styles.statValue}>{stats.clickSpeed}</Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="battery-charging" size={18} color={COLORS.action} />
          <Text style={styles.statLabel}>Endurance</Text>
          <Text style={styles.statValue}>{stats.endurance}</Text>
        </View>
      </View>

      <EvolutionCard evolutionTier={evolutionTier} ownedLevel={owned.level} griffes={griffes} onEvolve={onEvolve} />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>⚔️ Attaques</Text>
        {creature.skills.map((skill) => (
          <View key={skill.id} style={styles.skillRow}>
            <Text style={styles.skillName}>{skill.name}</Text>
            <Text style={styles.skillStats}>{skill.damage} dégâts · {skill.enduranceCost} endurance</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📖 Histoire</Text>
        {display.name !== baseName && (
          <Text style={styles.speciesNote}>Forme de base : {baseName}</Text>
        )}
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
// Tracé de la carte des chapitres (30/08) — positions calculées (pas de
// mise en page flexbox) pour pouvoir dessiner des tracés COURBES entre
// les niveaux plutôt que des lignes droites, comme demandé ("belles
// formes logiques, arrondies, comme sur d'autres jeux vidéo").
const LEVEL_NODE_SIZE = 46;
const ROW_HEIGHT = 92; // espace vertical entre deux niveaux
const WAVE_AMPLITUDE = 0.30; // amplitude horizontale du serpentin, en fraction de la largeur

// Position (fraction 0-1 de la largeur, y en px depuis le haut du
// chapitre) du niveau d'index `i` (0-9) dans son chapitre — une onde
// continue plutôt que 3 positions fixes en alternance, pour que la
// courbe entre deux niveaux consécutifs ait vraiment l'air organique.
function nodePosition(i) {
  const x = 0.5 + Math.sin(i * 0.95) * WAVE_AMPLITUDE;
  const y = i * ROW_HEIGHT + LEVEL_NODE_SIZE;
  return { x, y };
}

// Point sur une courbe de Bézier quadratique.
function bezierPoint(p0, p1, ctrl, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * ctrl.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * ctrl.y + t * t * p1.y,
  };
}

// Points intermédiaires (petits ronds) entre deux niveaux consécutifs,
// le long d'une courbe (pas une ligne droite) — le point de contrôle est
// décalé perpendiculairement au segment direct pour créer un vrai arc.
function pathDots(p0, p1, count = 7) {
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendiculaire normalisée, sens fixé par le signe de dx pour que
  // l'arc penche toujours "vers l'extérieur" du serpentin plutôt
  // qu'aléatoirement à gauche ou à droite.
  const bend = 26 * (dx >= 0 ? 1 : -1);
  const ctrl = { x: mx - (dy / len) * bend, y: my + (dx / len) * bend };
  const dots = [];
  for (let k = 1; k < count; k++) {
    dots.push(bezierPoint(p0, p1, ctrl, k / count));
  }
  return dots;
}

function ChapterMapScreen({ currentUnlockedLevel, owned, deck, griffes, onLevelWon, onBack }) {
  const [levelPreview, setLevelPreview] = useState(null); // numéro de niveau ou null
  const [activeBattle, setActiveBattle] = useState(null); // { levelNumber } ou null
  // TOUJOURS appelé avant tout retour anticipé (règle des Hooks React) —
  // c'était placé après le "if (activeBattle) return" et faisait planter
  // l'appli ("Rendered fewer hooks than expected") dès qu'on
  // entrait/sortait d'un combat, puisque le nombre de Hooks exécutés
  // différait d'un rendu à l'autre selon activeBattle.
  const { width: screenWidth } = useWindowDimensions();

  // Combat en cours — retour anticipé, même schéma que le reste de
  // l'écran Aventure. L'équipe entière (les 3 créatures du deck, dans
  // l'ordre) combat à tour de rôle — plus de sélection d'une seule
  // créature avant le combat.
  if (activeBattle) {
    const team = deck
      .filter((id) => id)
      .map((id) => ({
        creature: CREATURES.find((c) => c.id === id),
        ownedLevel: owned.find((o) => o.id === id).level,
        evolutionTier: owned.find((o) => o.id === id).evolutionTier || 0,
      }));
    return (
      <CombatScreen
        team={team}
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

  // Affiche le chapitre en cours + 6 chapitres suivants (verrouillés,
  // pour montrer qu'il y a une suite) — porté de +2 à +6 (4 chapitres de
  // marge supplémentaires, demande explicite) plutôt que de générer une
  // liste potentiellement infinie d'un coup. La difficulté adverse reste
  // cohérente sur toute cette plage (vérifié : puissance totale
  // strictement croissante jusqu'au niveau 100 au moins, voir
  // combatLogic.js/opponentPowerBudget).
  const currentChapter = chapterForLevel(currentUnlockedLevel);
  const chaptersToShow = currentChapter + 6;
  const pathWidth = screenWidth - 28; // marges de l'écran (padding: 14 de chaque côté)
  const chapterHeight = (LEVELS_PER_CHAPTER - 1) * ROW_HEIGHT + LEVEL_NODE_SIZE * 2;

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
        {Array.from({ length: chaptersToShow }, (_, chapterIdx) => chapterIdx + 1).map((chapterNum) => {
          // Positions converties en PIXELS tout de suite (x ET y dans la
          // même unité) — un vrai bug avait laissé x en fraction (0-1) et
          // y déjà en pixels, ce qui envoyait les points de contrôle des
          // courbes très loin hors écran (le calcul de perpendiculaire
          // mélangeait des échelles totalement différentes) : les
          // pointillés étaient bien calculés, juste invisibles car
          // positionnés à des milliers de pixels du cadre visible.
          const positions = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => {
            const p = nodePosition(i);
            return { x: p.x * pathWidth, y: p.y };
          });
          return (
            <View key={chapterNum} style={styles.chapterBlock}>
              <Text style={styles.chapterTitle}>Chapitre {chapterNum}</Text>
              <View style={[styles.chapterPath, { height: chapterHeight }]}>
                {/* Tracé courbe en pointillés entre chaque niveau consécutif —
                    dessiné EN PREMIER pour rester derrière les pastilles. */}
                {positions.slice(0, -1).map((p0, i) => {
                  const p1 = positions[i + 1];
                  return pathDots(p0, p1).map((d, di) => (
                    <View
                      key={`dot-${i}-${di}`}
                      style={[
                        styles.pathDot,
                        { left: d.x - 3, top: d.y - 3 },
                      ]}
                    />
                  ));
                })}

                {positions.map((pos, i) => {
                  const levelNum = (chapterNum - 1) * LEVELS_PER_CHAPTER + i + 1;
                  const state = levelNum < currentUnlockedLevel ? 'done' : levelNum === currentUnlockedLevel ? 'current' : 'locked';
                  return (
                    <TouchableOpacity
                      key={levelNum}
                      style={[
                        styles.levelNode,
                        { left: pos.x - LEVEL_NODE_SIZE / 2, top: pos.y - LEVEL_NODE_SIZE / 2 },
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
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {levelPreview && (
        <FighterSelectOverlay
          levelNumber={levelPreview}
          owned={owned}
          deck={deck}
          onClose={() => setLevelPreview(null)}
          onStart={() => setActiveBattle({ levelNumber: levelPreview })}
        />
      )}
    </View>
  );
}

// Aperçu avant combat — montre l'adversaire ET toute l'équipe qui va se
// battre (les 3 créatures du deck, à tour de rôle si l'une tombe). Plus
// de choix d'une seule créature : toute l'équipe part au combat.
function FighterSelectOverlay({ levelNumber, owned, deck, onClose, onStart }) {
  const opponent = opponentForLevel(levelNumber);
  const display = opponent.stages[0];
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));
  const teamCount = deck.filter((id) => id).length;

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

        <Text style={[styles.overlaySubtitle, { marginTop: 14, marginBottom: 8 }]}>Ton équipe (à tour de rôle) :</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {deck.map((id, i) => {
            const creature = id ? CREATURES.find((c) => c.id === id) : null;
            const own = id ? ownedMap[id] : null;
            const fighterDisplay = creature && own ? creature.stages[stageForLevel(own.level)] : null;
            return (
              <View key={i} style={[styles.fighterPick, creature && { borderColor: RARITY_COLOR[creature.rarity] }]}>
                {fighterDisplay ? (
                  <Text style={{ fontSize: 30 }}>{fighterDisplay.emoji}</Text>
                ) : (
                  <Text style={{ fontSize: 24, opacity: 0.3 }}>🥚</Text>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.startBattleBtn, teamCount === 0 && styles.actionBtnDisabledAdv]}
          onPress={onStart}
          disabled={teamCount === 0}
        >
          <Text style={styles.startBattleBtnText}>{teamCount > 0 ? '⚔️ Combattre' : 'Deck vide'}</Text>
        </TouchableOpacity>

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
  editSlotBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: 'rgba(245,197,66,0.1)', borderRadius: 8 },
  editSlotBtnText: { color: COLORS.action, fontSize: 9, fontWeight: '700' },

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
  chapterPath: { width: '100%', position: 'relative' },
  pathDot: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  levelNode: {
    position: 'absolute',
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
  startBattleBtn: {
    backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 30, marginTop: 20,
    shadowColor: COLORS.action, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  startBattleBtnText: { color: '#241a00', fontSize: 15, fontWeight: '900' },
  actionBtnDisabledAdv: { opacity: 0.4 },

  detailPortraitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 10, marginBottom: 20 },
  rarityBadgeColumn: { alignItems: 'center' },
  rarityBadge: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  rarityBadgeText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  elementLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center' },

  detailPortrait: { alignItems: 'center' },
  detailEmoji: { fontSize: 90 },
  detailRarity: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 8, textTransform: 'capitalize' },
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
  speciesNote: { color: COLORS.muted, fontSize: 11, fontStyle: 'italic', marginBottom: 6 },

  skillRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  skillName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  skillStats: { color: COLORS.action, fontSize: 11, fontWeight: '700' },
});

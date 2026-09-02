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
import { CREATURES, RARITY_LABEL, RARITY_COLOR, RARITY_BADGE_LETTER, stageForLevel, levelUpCost } from '../../games/clicker/clickerLogic';
import * as Notifications from 'expo-notifications';
import { useDaily, PENDING_GRIFFES_KEY } from '../../context/DailyContext';
import {
  combatStatsForCreatureTyped,
  chapterForLevel,
  levelIndexInChapter,
  LEVELS_PER_CHAPTER,
  opponentForLevel,
  griffesReward,
  canEvolve,
  evolutionCost,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  computeEnergyRegen,
  msUntilNextEnergy,
} from '../../games/clicker/combatLogic';

// Configuration du gestionnaire de notifications — une seule fois, au
// chargement du module. Protégé par try/catch : si expo-notifications
// pose problème sur l'environnement (permissions, plateforme...), le
// reste de l'appli ne doit JAMAIS en dépendre pour fonctionner —
// l'énergie elle-même marche très bien sans notification.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  // Pas grave — les notifications sont un bonus, pas une dépendance dure.
}

// Programme (ou reprogramme) LA notification "énergie pleine" — un seul
// identifiant fixe pour toujours remplacer la précédente plutôt que
// d'en empiler plusieurs à chaque fois que l'écran se recharge.
async function scheduleEnergyFullNotification(msFromNow) {
  try {
    await Notifications.cancelScheduledNotificationAsync('energy-full').catch(() => {});
    if (msFromNow <= 0) return;
    const { status } = await Notifications.getPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      identifier: 'energy-full',
      content: { title: '⚡ Énergie pleine !', body: 'Tes 5 vies sont prêtes — retourne combattre !' },
      trigger: { seconds: Math.max(1, Math.round(msFromNow / 1000)) },
    });
  } catch (e) {
    // Pas grave — même raison qu'au-dessus.
  }
}

// Sauvegarde séparée de celle du clicker classique — la progression
// d'Aventure grossira avec le temps (niveaux, ressource Griffes...), pas
// la peine d'alourdir davantage la sauvegarde déjà volumineuse du clicker.
const ADVENTURE_STORAGE_KEY = 'adventure:state:v1';
// Drapeau dev "Ajouter des Griffes" (posé depuis Options) — même schéma
// de sécurité que DEV_UNLOCK_ALL_KEY dans ClickerScreen.js : jamais
// d'écriture directe dans la sauvegarde depuis un autre écran, juste un
// drapeau lu et appliqué par AdventureScreen lui-même à son chargement.
export const DEV_ADD_GRIFFES_KEY = 'adventure:dev:addGriffes';
const DEV_GRIFFES_AMOUNT = 1000;
// Même schéma que ci-dessus pour recharger l'énergie au max depuis Options.
export const DEV_REFILL_ENERGY_KEY = 'adventure:dev:refillEnergy';

// Runes — proposition initiale de 4 types (voir le tableau des paliers
// donné à l'utilisateur en réponse). Les BONUS eux-mêmes ne sont pas
// encore appliqués aux stats de combat, seule la structure achat/fusion
// est fonctionnelle pour l'instant.
const RUNE_TYPES = {
  force: { name: 'Rune de Force', icon: '⚔️', color: '#FF5252' },
  vitalite: { name: 'Rune de Vitalité', icon: '❤️', color: COLORS.good },
  endurance: { name: "Rune d'Endurance", icon: '🔋', color: COLORS.action },
  celerite: { name: 'Rune de Célérité', icon: '⚡', color: COLORS.neonCyan },
};
const RUNE_TYPE_KEYS = Object.keys(RUNE_TYPES);
const RUNE_COST = 100;
const RUNE_MAX_LEVEL = 5;
let runeIdCounter = 0;
function makeRuneId() {
  runeIdCounter += 1;
  return `rune_${Date.now()}_${runeIdCounter}`;
}


export default function AdventureScreen({ owned, deck, onBack, onEvolveCreature, onLevelUpCreature, onAssignDeck, onClearDeckSlot }) {
  const { trackEvent, trackMax } = useDaily();
  const [detailCreatureId, setDetailCreatureId] = useState(null);
  const [deckPickerSlot, setDeckPickerSlot] = useState(null); // index de l'emplacement en cours de modification, ou null
  const [chapterMapOpen, setChapterMapOpen] = useState(false);
  const [runesOpen, setRunesOpen] = useState(false);
  const [currentUnlockedLevel, setCurrentUnlockedLevel] = useState(1);
  const [griffes, setGriffes] = useState(0);
  // Runes possédées : [{ id, type, level }] — id unique généré à l'achat/
  // la fusion, type = l'une des 4 clés de RUNE_TYPES, level 1 à 5.
  const [ownedRunes, setOwnedRunes] = useState([]);
  // Énergie — 1 point toutes les 20 min, plafond 5, coûte 1 pour LANCER
  // un combat (voir startBattleWithEnergy plus bas).
  const [energy, setEnergy] = useState(ENERGY_MAX);
  const [energyUpdatedAt, setEnergyUpdatedAt] = useState(Date.now());
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
          setOwnedRunes(saved.ownedRunes || []);
          // Recalcule l'énergie à partir du temps RÉELLEMENT écoulé
          // depuis la dernière sauvegarde (même principe que les gains
          // hors-ligne du clicker) — sans ça, fermer l'appli ne ferait
          // jamais avancer la régénération.
          const storedEnergy = saved.energy != null ? saved.energy : ENERGY_MAX;
          const storedAt = saved.energyUpdatedAt || Date.now();
          const recalced = computeEnergyRegen(storedEnergy, storedAt, Date.now());
          setEnergy(recalced.energy);
          setEnergyUpdatedAt(recalced.lastUpdateAt);
        }
      } catch (e) {
        // pas de sauvegarde valide, on démarre au niveau 1
      }
      // Drapeau dev "Ajouter des Griffes" — placé hors du if(raw) pour
      // marcher aussi sans sauvegarde existante.
      const griffesFlag = await AsyncStorage.getItem(DEV_ADD_GRIFFES_KEY);
      if (griffesFlag === '1') {
        setGriffes((g) => g + DEV_GRIFFES_AMOUNT);
        await AsyncStorage.removeItem(DEV_ADD_GRIFFES_KEY);
      }
      const energyFlag = await AsyncStorage.getItem(DEV_REFILL_ENERGY_KEY);
      if (energyFlag === '1') {
        setEnergy(ENERGY_MAX);
        setEnergyUpdatedAt(Date.now());
        await AsyncStorage.removeItem(DEV_REFILL_ENERGY_KEY);
      }
      // Griffes en attente (récompenses de quêtes quotidiennes/streak,
      // réclamées depuis ProgresScreen) — même schéma de sécurité que
      // les drapeaux dev ci-dessus, montant accumulé plutôt qu'un simple
      // booléen (plusieurs récompenses peuvent s'empiler).
      const pendingRaw = await AsyncStorage.getItem(PENDING_GRIFFES_KEY);
      if (pendingRaw) {
        const pending = parseInt(pendingRaw, 10) || 0;
        if (pending > 0) setGriffes((g) => g + pending);
        await AsyncStorage.removeItem(PENDING_GRIFFES_KEY);
      }
      setProgressLoaded(true);
    })();
  }, []);

  // Sauvegarde à chaque changement.
  useEffect(() => {
    if (!progressLoaded) return;
    AsyncStorage.setItem(ADVENTURE_STORAGE_KEY, JSON.stringify({ currentUnlockedLevel, griffes, ownedRunes, energy, energyUpdatedAt }));
  }, [currentUnlockedLevel, griffes, ownedRunes, energy, energyUpdatedAt, progressLoaded]);

  // Pendant que l'écran Aventure est ouvert, revérifie la régénération
  // toutes les 30s — permet de VOIR l'énergie remonter en direct sans
  // avoir à fermer/rouvrir l'appli. Coût négligeable (juste une
  // soustraction de timestamps), et purement décoratif si rien n'a
  // changé (computeEnergyRegen ne fait rien tant qu'un tick complet ne
  // s'est pas écoulé).
  useEffect(() => {
    if (!progressLoaded) return;
    const interval = setInterval(() => {
      setEnergy((e) => {
        const recalced = computeEnergyRegen(e, energyUpdatedAt, Date.now());
        if (recalced.energy !== e) setEnergyUpdatedAt(recalced.lastUpdateAt);
        return recalced.energy;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [progressLoaded, energyUpdatedAt]);

  // Reprogramme la notification "énergie pleine" à chaque fois que
  // l'énergie change — annule automatiquement l'ancienne (identifiant
  // fixe côté scheduleEnergyFullNotification) si elle n'est plus valable.
  useEffect(() => {
    if (!progressLoaded) return;
    const remaining = msUntilNextEnergy(energy, energyUpdatedAt, Date.now());
    if (energy >= ENERGY_MAX) {
      Notifications.cancelScheduledNotificationAsync('energy-full').catch(() => {});
    } else {
      // Temps jusqu'au PLEIN (pas juste le prochain point) : autant de
      // ticks manquants que d'énergie sous le plafond.
      const ticksMissing = ENERGY_MAX - energy;
      const msUntilFull = remaining + (ticksMissing - 1) * ENERGY_REGEN_MS;
      scheduleEnergyFullNotification(msUntilFull);
    }
  }, [energy, energyUpdatedAt, progressLoaded]);

  // Dépense 1 énergie pour lancer un combat — recalcule d'abord la
  // régénération au cas où du temps se serait écoulé depuis la dernière
  // vérification. Retourne false (et ne dépense rien) si pas assez.
  const startBattleWithEnergy = () => {
    const now = Date.now();
    const recalced = computeEnergyRegen(energy, energyUpdatedAt, now);
    if (recalced.energy <= 0) {
      setEnergy(recalced.energy);
      setEnergyUpdatedAt(recalced.lastUpdateAt);
      return false;
    }
    const wasFull = recalced.energy >= ENERGY_MAX;
    setEnergy(recalced.energy - 1);
    // Si on VIENT de repasser sous le plafond, le compte à rebours des
    // 20 min démarre maintenant — sinon on garde le timestamp déjà en
    // cours (ne pas perdre la progression déjà accumulée vers le
    // prochain point).
    setEnergyUpdatedAt(wasFull ? now : recalced.lastUpdateAt);
    return true;
  };

  // Appelé par ChapterMapScreen (via CombatScreen) à la fin d'un combat
  // gagné : débloque le niveau suivant SEULEMENT si c'était bien le
  // niveau de progression actuel (rejouer un niveau déjà acquis ne fait
  // pas avancer davantage), et crédite la récompense.
  const handleLevelWon = (levelNumber, reward) => {
    setGriffes((g) => g + reward);
    trackEvent('battleWon', 1);
    // Publie le niveau atteint pour que les défis de l'œuf (clicker)
    // puissent lire la progression d'Aventure. trackMax, pas trackEvent :
    // c'est un maximum, rejouer un niveau déjà battu ne doit pas le
    // faire monter. L'Aventure PUBLIE, le clicker LIT — jamais d'accès
    // direct d'un écran à la sauvegarde de l'autre.
    trackMax('advLevelReached', levelNumber);
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

  // Monte une créature d'un niveau, payé EN GRIFFES. Même schéma que
  // handleEvolve : le coût est vérifié et débité ICI (les Griffes vivent
  // dans cet écran), puis le nouveau niveau est persisté par le clicker
  // via onLevelUpCreature — la collection lui appartient.
  //
  // Le nourrissage se faisait avant dans le clicker, payé en pièces. Il a
  // été déplacé ici plutôt que de faire descendre les Griffes vers le
  // clicker : garder une monnaie dans un seul écran évite qu'elle soit
  // débitée à deux endroits qui ne se voient pas.
  const handleLevelUp = (creatureId) => {
    const creature = CREATURES.find((c) => c.id === creatureId);
    const ownedEntry = ownedMap[creatureId];
    if (!creature || !ownedEntry) return;
    const cost = levelUpCost(creature, ownedEntry.level);
    if (griffes < cost) return;
    setGriffes((g) => g - cost);
    onLevelUpCreature(creatureId);
  };

  // Achète une rune ALÉATOIRE contre 100 Griffes (toujours niveau 1, pas
  // encore équipée). Les bonus des runes affectent maintenant vraiment
  // les stats de combat (voir combatLogic.js/runeBonuses).
  const buyRandomRune = () => {
    if (griffes < RUNE_COST) return;
    setGriffes((g) => g - RUNE_COST);
    const type = RUNE_TYPE_KEYS[Math.floor(Math.random() * RUNE_TYPE_KEYS.length)];
    setOwnedRunes((prev) => [...prev, { id: makeRuneId(), type, level: 1, equippedCreatureId: null }]);
    trackEvent('runeBought', 1);
  };

  // Fusionne 2 runes du MÊME type et MÊME niveau en une seule au niveau
  // supérieur (jamais au-delà du palier 5) — les deux runes d'origine
  // disparaissent. Si l'une des deux était équipée, la nouvelle rune
  // fusionnée prend AUTOMATIQUEMENT sa place (pas de désarmement surprise).
  const fuseRunes = (id1, id2) => {
    // Vérification faite AVANT le setState (pas dans l'updater) : appeler
    // trackEvent (un AUTRE setState) depuis l'intérieur d'un updater
    // risquerait un double déclenchement en mode strict de React, qui
    // peut ré-invoquer les fonctions d'updater pour détecter les effets
    // de bord — ça compterait la quête deux fois pour une seule fusion.
    const r1 = ownedRunes.find((r) => r.id === id1);
    const r2 = ownedRunes.find((r) => r.id === id2);
    const valid = r1 && r2 && r1.id !== r2.id && r1.type === r2.type && r1.level === r2.level && r1.level < RUNE_MAX_LEVEL;
    if (!valid) return;

    setOwnedRunes((prev) => {
      const rest = prev.filter((r) => r.id !== id1 && r.id !== id2);
      const inheritedSlot = r1.equippedCreatureId || r2.equippedCreatureId || null;
      return [...rest, { id: makeRuneId(), type: r1.type, level: r1.level + 1, equippedCreatureId: inheritedSlot }];
    });
    trackEvent('runeFused', 1);
  };

  // Équipe une rune NON équipée sur une créature — refuse si la créature
  // a déjà ses 3 emplacements pleins (garde-fou, la carte des 3 cases
  // dans le profil ne devrait de toute façon jamais en proposer une 4e).
  const equipRune = (runeId, creatureId) => {
    const alreadyEquipped = ownedRunes.filter((r) => r.equippedCreatureId === creatureId).length;
    if (alreadyEquipped >= 3) return;
    setOwnedRunes((prev) => prev.map((r) => (r.id === runeId ? { ...r, equippedCreatureId: creatureId } : r)));
    trackEvent('runeEquipped', 1);
  };

  const unequipRune = (runeId) => {
    setOwnedRunes((prev) => prev.map((r) => (r.id === runeId ? { ...r, equippedCreatureId: null } : r)));
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
        onLevelUp={() => handleLevelUp(detailCreatureId)}
        ownedRunes={ownedRunes}
        onEquipRune={(runeId) => equipRune(runeId, detailCreatureId)}
        onUnequipRune={unequipRune}
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
        ownedRunes={ownedRunes}
        energy={energy}
        energyUpdatedAt={energyUpdatedAt}
        onStartBattle={startBattleWithEnergy}
        onLevelWon={handleLevelWon}
        onBack={() => setChapterMapOpen(false)}
      />
    );
  }

  // Runes — même schéma de retour anticipé.
  if (runesOpen) {
    return (
      <RunesScreen
        griffes={griffes}
        ownedRunes={ownedRunes}
        onBuyRune={buyRandomRune}
        onFuseRunes={fuseRunes}
        onBack={() => setRunesOpen(false)}
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
          qu'on ajoutera avec le temps. */}
      <View style={styles.subBar}>
        <TouchableOpacity style={styles.subBarItem} onPress={() => setChapterMapOpen(true)}>
          <Ionicons name="map" size={24} color={COLORS.action} />
          <Text style={styles.subBarLabel}>Mode Combat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.subBarItem} onPress={() => setRunesOpen(true)}>
          <Ionicons name="diamond" size={24} color={COLORS.neonCyan} />
          <Text style={[styles.subBarLabel, { color: COLORS.neonCyan }]}>Runes</Text>
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
// Montée de niveau, payée en Griffes. Affiche aussi le prochain palier
// d'évolution visé, pour que le joueur sache à quoi servent les niveaux
// qu'il achète au lieu de monter à l'aveugle.
function LevelUpCard({ creature, ownedLevel, griffes, onLevelUp }) {
  const cost = levelUpCost(creature, ownedLevel);
  const affordable = griffes >= cost;
  const nextTierLevel = ownedLevel < 25 ? 25 : ownedLevel < 50 ? 50 : null;

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>🍖 Niveau</Text>
      <Text style={styles.sectionBody}>Niveau actuel : {ownedLevel}</Text>
      {nextTierLevel && (
        <Text style={styles.speciesNote}>
          Encore {nextTierLevel - ownedLevel} niveau{nextTierLevel - ownedLevel > 1 ? 'x' : ''} avant le prochain palier d'évolution.
        </Text>
      )}
      <TouchableOpacity
        style={[styles.startBattleBtn, !affordable && styles.actionBtnDisabledAdv]}
        onPress={onLevelUp}
        disabled={!affordable}
      >
        <Text style={styles.startBattleBtnText}>Monter au niveau {ownedLevel + 1} — {cost} 🐾 Griffes</Text>
      </TouchableOpacity>
    </View>
  );
}

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


function CreatureDetailScreen({ creature, owned, griffes, onEvolve, onLevelUp, ownedRunes, onEquipRune, onUnequipRune, onBack }) {
  const [runePickerSlot, setRunePickerSlot] = useState(null); // index (0-2) ou null

  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const baseName = creature.stages[0].name; // nom de base, pour clarifier le lien avec l'histoire
  const evolutionTier = owned.evolutionTier || 0;

  // Runes équipées sur CETTE créature (jusqu'à 3), dans l'ordre où elles
  // ont été équipées — sert à la fois de liste d'affichage et de calcul
  // des bonus réels.
  const equippedRunes = ownedRunes.filter((r) => r.equippedCreatureId === creature.id);
  const statsBase = combatStatsForCreatureTyped(creature, owned.level, evolutionTier, []);
  const stats = combatStatsForCreatureTyped(creature, owned.level, evolutionTier, equippedRunes);
  // Delta affiché en couleur à côté de chaque stat concernée — vert pour
  // les PV, rouge pour l'ATQ, doré pour l'Endurance (mêmes couleurs que
  // les barres correspondantes ailleurs dans l'appli).
  const hpBonus = stats.hp - statsBase.hp;
  const atkBonus = stats.attack - statsBase.attack;
  const enduranceBonus = stats.endurance - statsBase.endurance;

  return (
    <>
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
          <Text style={styles.statValue}>
            {stats.hp}{hpBonus > 0 && <Text style={styles.statBonusGood}> (+{hpBonus} PV)</Text>}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="flash" size={18} color={COLORS.neonPink} />
          <Text style={styles.statLabel}>ATQ</Text>
          <Text style={styles.statValue}>
            {stats.attack}{atkBonus > 0 && <Text style={styles.statBonusBad}> (+{atkBonus} ATQ)</Text>}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="finger-print" size={18} color={COLORS.neonCyan} />
          <Text style={styles.statLabel}>Vitesse de clic</Text>
          <Text style={styles.statValue}>{stats.clickSpeed}</Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="battery-charging" size={18} color={COLORS.action} />
          <Text style={styles.statLabel}>Endurance</Text>
          <Text style={styles.statValue}>
            {stats.endurance}{enduranceBonus > 0 && <Text style={styles.statBonusAction}> (+{enduranceBonus})</Text>}
          </Text>
        </View>
        {stats.dmgMultBonus > 0 && (
          <View style={styles.statRow}>
            <Ionicons name="flame" size={18} color={COLORS.neonCyan} />
            <Text style={styles.statLabel}>Multiplicateur max</Text>
            <Text style={styles.statValue}>
              x{(2.5 + stats.dmgMultBonus).toFixed(2)}<Text style={styles.statBonusCyan}> (+{stats.dmgMultBonus.toFixed(2)})</Text>
            </Text>
          </View>
        )}
      </View>

      {/* 3 cases de rune — grisée si vide (tap = ouvre le sélecteur),
          remplie sinon (tap = propose de la retirer). */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>💎 Runes</Text>
        <View style={styles.runeSlotRow}>
          {[0, 1, 2].map((slotIdx) => {
            const rune = equippedRunes[slotIdx];
            if (rune) {
              const def = RUNE_TYPES[rune.type];
              return (
                <TouchableOpacity
                  key={slotIdx}
                  style={[styles.runeSlot, { borderColor: def.color, backgroundColor: 'rgba(255,255,255,0.06)' }]}
                  onPress={() => onUnequipRune(rune.id)}
                >
                  <Text style={styles.runeSlotEmoji}>{def.icon}</Text>
                  <Text style={styles.runeSlotLevel}>Niv. {rune.level}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={slotIdx} style={styles.runeSlotEmpty} onPress={() => setRunePickerSlot(slotIdx)}>
                <Ionicons name="add" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.speciesNote}>Touche une case pleine pour retirer sa rune.</Text>
      </View>

      <LevelUpCard creature={creature} ownedLevel={owned.level} griffes={griffes} onLevelUp={onLevelUp} />

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

    {runePickerSlot !== null && (
      <RunePickerOverlay
        ownedRunes={ownedRunes}
        onPick={(runeId) => {
          onEquipRune(runeId);
          setRunePickerSlot(null);
        }}
        onClose={() => setRunePickerSlot(null)}
      />
    )}
    </>
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

// Petit badge autonome, avec son propre tick d'1s pour un compte à
// rebours fluide (indépendant du rafraîchissement toutes les 30s côté
// AdventureScreen, qui lui met à jour la VRAIE valeur d'énergie).
function EnergyBadge({ energy, energyUpdatedAt }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const remaining = msUntilNextEnergy(energy, energyUpdatedAt, Date.now());
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  return (
    <View style={styles.energyBadge}>
      <Text style={styles.energyBadgeText}>⚡ {energy}/{ENERGY_MAX}</Text>
      {energy < ENERGY_MAX && (
        <Text style={styles.energyBadgeCountdown}>+1 dans {mm}:{String(ss).padStart(2, '0')}</Text>
      )}
    </View>
  );
}

function ChapterMapScreen({ currentUnlockedLevel, owned, deck, griffes, ownedRunes, energy, energyUpdatedAt, onStartBattle, onLevelWon, onBack }) {
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
        // Runes équipées sur CETTE créature précise — c'est ce qui rend
        // les runes réellement actives en combat (voir CombatScreen.js).
        equippedRunes: ownedRunes.filter((r) => r.equippedCreatureId === id),
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
      <View style={styles.topStatsRow}>
        <Text style={styles.griffesText}>🐾 {griffes} Griffes</Text>
        <EnergyBadge energy={energy} energyUpdatedAt={energyUpdatedAt} />
      </View>

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
          energy={energy}
          onClose={() => setLevelPreview(null)}
          onStart={() => {
            // 1 énergie par TENTATIVE (pas remboursée en cas de défaite,
            // c'est bien "1 vie", pas "1 vie par victoire") — bloque le
            // lancement si le joueur n'en a plus.
            if (!onStartBattle()) return;
            setActiveBattle({ levelNumber: levelPreview });
          }}
        />
      )}
    </View>
  );
}

// Aperçu avant combat — montre l'adversaire ET toute l'équipe qui va se
// battre (les 3 créatures du deck, à tour de rôle si l'une tombe). Plus
// de choix d'une seule créature : toute l'équipe part au combat.
// Écran Runes — achat aléatoire (100 Griffes) + fusion (2 runes du même
// type/niveau -> 1 rune au niveau supérieur). Sélection tactile simple :
// touche une 1ère rune pour la sélectionner, touche une 2ème rune
// compatible pour fusionner automatiquement.
function RunesScreen({ griffes, ownedRunes, onBuyRune, onFuseRunes, onBack }) {
  // Écran de fusion dédié (30/08) — remplace l'ancien mode "tape une
  // rune puis retape une pareille", pas très intuitif (fallait deviner
  // quelle rune correspondait à quelle autre). Regroupe automatiquement
  // les runes identiques, un seul bouton clair par groupe.
  const [fusionOpen, setFusionOpen] = useState(false);

  if (fusionOpen) {
    return <RuneFusionScreen ownedRunes={ownedRunes} onFuseRunes={onFuseRunes} onBack={() => setFusionOpen(false)} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💎 Runes</Text>
      </View>
      <Text style={styles.griffesText}>🐾 {griffes} Griffes</Text>

      <TouchableOpacity
        style={[styles.startBattleBtn, griffes < RUNE_COST && styles.actionBtnDisabledAdv]}
        onPress={onBuyRune}
        disabled={griffes < RUNE_COST}
      >
        <Text style={styles.startBattleBtnText}>🎲 Rune aléatoire — {RUNE_COST} 🐾 Griffes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.fusionModeBtn} onPress={() => setFusionOpen(true)}>
        <Text style={styles.fusionModeBtnText}>🔀 Fusionner des runes</Text>
      </TouchableOpacity>

      <Text style={styles.runeHint}>
        Pour équiper une rune, va dans la fiche d'une créature. Ta collection complète est listée ci-dessous.
      </Text>

      <ScrollView contentContainerStyle={styles.runeGrid}>
        {ownedRunes.length === 0 ? (
          <Text style={styles.runeEmptyText}>Aucune rune pour l'instant — achètes-en une ci-dessus !</Text>
        ) : (
          ownedRunes
            .slice()
            .sort((a, b) => b.level - a.level)
            .map((rune) => {
              const def = RUNE_TYPES[rune.type];
              return (
                <View key={rune.id} style={[styles.runeCell, { borderColor: def.color, opacity: 0.9 }]}>
                  <Text style={styles.runeEmoji}>{def.icon}</Text>
                  <Text style={styles.runeLevel}>Niv. {rune.level}</Text>
                  {rune.equippedCreatureId && <Text style={styles.runeEquippedTag}>équipée</Text>}
                </View>
              );
            })
        )}
      </ScrollView>
    </View>
  );
}

// Écran de fusion — regroupe les runes par type+niveau IDENTIQUES, un
// bouton "Fusionner" unique et clair par groupe (au lieu de deviner
// quelle rune correspond à quelle autre). Grisé/désactivé si moins de 2
// exemplaires, ou si déjà au palier maximum.
function RuneFusionScreen({ ownedRunes, onFuseRunes, onBack }) {
  const groups = {};
  ownedRunes.forEach((r) => {
    const key = `${r.type}_${r.level}`;
    (groups[key] = groups[key] || []).push(r);
  });
  const groupList = Object.values(groups).sort((a, b) => {
    if (a[0].type !== b[0].type) return a[0].type.localeCompare(b[0].type);
    return b[0].level - a[0].level;
  });

  const handleFuse = (group) => {
    // Fusionne 2 runes NON équipées en priorité (pas de surprise sur le
    // matériel d'une créature) — si moins de 2 sont libres, inclut une
    // rune équipée (son emplacement est de toute façon reporté sur la
    // nouvelle rune fusionnée, voir fuseRunes plus haut).
    const unequipped = group.filter((r) => !r.equippedCreatureId);
    const pool = unequipped.length >= 2 ? unequipped : group;
    onFuseRunes(pool[0].id, pool[1].id);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔀 Fusionner</Text>
      </View>
      <Text style={styles.runeHint}>2 runes identiques (même type, même niveau) fusionnent en 1 rune au niveau supérieur.</Text>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
        {groupList.length === 0 ? (
          <Text style={styles.runeEmptyText}>Aucune rune pour l'instant.</Text>
        ) : (
          groupList.map((group) => {
            const rune = group[0];
            const def = RUNE_TYPES[rune.type];
            const isMaxed = rune.level >= RUNE_MAX_LEVEL;
            const canFuse = group.length >= 2 && !isMaxed;
            return (
              <View key={rune.type + '_' + rune.level} style={[styles.fusionGroupCard, { borderColor: def.color }]}>
                <View style={styles.fusionGroupInfo}>
                  <Text style={styles.runeEmoji}>{def.icon}</Text>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.fusionGroupName}>{def.name}</Text>
                    <Text style={styles.fusionGroupCount}>Niveau {rune.level} · possédées : {group.length}</Text>
                  </View>
                </View>
                {isMaxed ? (
                  <Text style={styles.fusionGroupMaxed}>Niveau max</Text>
                ) : (
                  <TouchableOpacity
                    style={[styles.fusionBtn, !canFuse && styles.fusionBtnDisabled]}
                    onPress={() => handleFuse(group)}
                    disabled={!canFuse}
                  >
                    <Text style={[styles.fusionBtnText, !canFuse && styles.fusionBtnTextDisabled]}>Fusionner → Niv. {rune.level + 1}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}


// Sélecteur affiché quand on touche une case de rune VIDE dans la fiche
// d'une créature — ne propose que les runes NON équipées ailleurs (une
// rune ne peut être sur qu'une seule créature à la fois).
function RunePickerOverlay({ ownedRunes, onPick, onClose }) {
  const available = ownedRunes.filter((r) => !r.equippedCreatureId);
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayPanel}>
        <TouchableOpacity style={styles.overlayClose} onPress={onClose}>
          <Text style={styles.overlayCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.overlayTitle}>Choisir une rune</Text>
        {available.length === 0 ? (
          <Text style={[styles.overlaySubtitle, { marginTop: 10 }]}>
            Aucune rune disponible — achètes-en une ou libères-en une déjà équipée ailleurs.
          </Text>
        ) : (
          <View style={[styles.runeGrid, { marginTop: 14 }]}>
            {available
              .slice()
              .sort((a, b) => b.level - a.level)
              .map((rune) => {
                const def = RUNE_TYPES[rune.type];
                return (
                  <TouchableOpacity
                    key={rune.id}
                    style={[styles.runeCell, { borderColor: def.color }]}
                    onPress={() => onPick(rune.id)}
                  >
                    <Text style={styles.runeEmoji}>{def.icon}</Text>
                    <Text style={styles.runeLevel}>Niv. {rune.level}</Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}
      </View>
    </View>
  );
}

function FighterSelectOverlay({ levelNumber, owned, deck, energy, onClose, onStart }) {
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

        <Text style={styles.energyCostText}>⚡ Coûte 1 énergie ({energy}/{ENERGY_MAX} disponible{energy > 1 ? 's' : ''})</Text>

        <TouchableOpacity
          style={[styles.startBattleBtn, (teamCount === 0 || energy <= 0) && styles.actionBtnDisabledAdv]}
          onPress={onStart}
          disabled={teamCount === 0 || energy <= 0}
        >
          <Text style={styles.startBattleBtnText}>
            {teamCount === 0 ? 'Deck vide' : energy <= 0 ? '⚡ Plus d\'énergie' : '⚔️ Combattre'}
          </Text>
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
  topStatsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
  energyBadge: { alignItems: 'center' },
  energyBadgeText: { color: COLORS.neonCyan, fontSize: 13, fontWeight: '800' },
  energyBadgeCountdown: { color: COLORS.muted, fontSize: 9, fontWeight: '700', marginTop: 1 },
  energyCostText: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 10, marginBottom: 4 },
  fighterPick: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  startBattleBtn: {
    backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 30, marginTop: 20,
    shadowColor: COLORS.action, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  startBattleBtnText: { color: '#241a00', fontSize: 15, fontWeight: '900' },

  runeHint: { color: COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 14, marginBottom: 10, paddingHorizontal: 10 },
  runeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingBottom: 30 },
  runeEmptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 20, width: '100%' },
  runeCell: {
    width: 84, backgroundColor: COLORS.panel, borderRadius: 14, padding: 12, alignItems: 'center',
    borderWidth: 2,
  },
  runeCellSelected: { backgroundColor: 'rgba(245,197,66,0.15)', borderColor: COLORS.action },
  runeEmoji: { fontSize: 30 },
  runeLevel: { color: COLORS.text, fontSize: 11, fontWeight: '800', marginTop: 4 },
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
  // Delta de bonus affiché à côté de la stat concernée — couleur liée au
  // TYPE de rune (demande explicite : vert pour PV, rouge pour ATQ).
  statBonusGood: { color: COLORS.good, fontSize: 13, fontWeight: '800' },
  statBonusBad: { color: '#FF5252', fontSize: 13, fontWeight: '800' },
  statBonusAction: { color: COLORS.action, fontSize: 13, fontWeight: '800' },
  statBonusCyan: { color: COLORS.neonCyan, fontSize: 13, fontWeight: '800' },

  runeSlotRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
  runeSlot: {
    width: 66, height: 66, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  runeSlotEmoji: { fontSize: 26 },
  runeSlotLevel: { color: COLORS.text, fontSize: 9, fontWeight: '800', marginTop: 2 },
  runeSlotEmpty: {
    width: 66, height: 66, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.02)',
  },
  fusionModeBtn: {
    borderRadius: 14, paddingVertical: 10, alignItems: 'center', marginTop: 10,
    borderWidth: 1.5, borderColor: COLORS.neonCyan, backgroundColor: 'rgba(62,198,240,0.08)',
  },
  fusionModeBtnText: { color: COLORS.neonCyan, fontSize: 13, fontWeight: '800' },
  runeEquippedTag: { color: COLORS.action, fontSize: 8, fontWeight: '800', marginTop: 2 },

  fusionGroupCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.panel, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5,
  },
  fusionGroupInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  fusionGroupName: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  fusionGroupCount: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  fusionGroupMaxed: { color: COLORS.muted, fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
  fusionBtn: { backgroundColor: COLORS.action, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  fusionBtnDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  fusionBtnText: { color: '#241a00', fontSize: 11, fontWeight: '800' },
  fusionBtnTextDisabled: { color: COLORS.muted },

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

// Écran principal du mode Aventure. Voir mobile/ADVENTURE_MODE.md pour
// le design complet et l'ordre de construction — ceci ajoute l'étape 4
// (carte des chapitres/niveaux, structure visuelle seulement, le vrai
// combat derrière chaque niveau arrive à l'étape 5).
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
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
  // Tout le mode Aventure se joue en PAYSAGE. L'appli entière est
  // déclarée en portrait dans app.json ; on bascule donc à l'entrée et
  // on REMET le portrait au démontage.
  //
  // Le nettoyage est indispensable et doit vivre dans le `return` de
  // l'effet : sans lui, quitter l'Aventure par le bouton retour système
  // laisserait le clicker et tout le reste de l'appli bloqués en
  // paysage, sans aucun moyen d'en sortir autrement qu'en redémarrant.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

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
      {/* En-tête paysage : retour à gauche, Griffes au centre, accès aux
          Runes en HAUT À DROITE (même icône qu'avant, seulement
          déplacée). L'ancienne barre du bas disparaît : en paysage la
          hauteur est la ressource rare, on ne la gaspille pas en barre
          de navigation. */}
      <View style={styles.headerLand}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.titleLand}>🗺️ Aventure</Text>
        <View style={styles.headerRight}>
          <View style={styles.griffesPill}>
            <Text style={styles.griffesPillText}>🐾 {griffes}</Text>
          </View>
          <TouchableOpacity style={styles.runesTopBtn} onPress={() => setRunesOpen(true)}>
            <Ionicons name="diamond" size={22} color={COLORS.neonCyan} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Les 3 créatures du deck, côte à côte et occupant toute la
          largeur. C'est le MÊME deck que celui du clicker — une seule
          source de vérité, pas de sélection séparée. */}
      <View style={styles.creatureRowLand}>
        {deck.map((id, i) => {
          const creature = id ? CREATURES.find((c) => c.id === id) : null;
          const own = id ? ownedMap[id] : null;
          const display = creature && own ? creature.stages[stageForLevel(own.level)] : null;
          return (
            <View key={i} style={styles.creatureCellLand}>
              <TouchableOpacity
                style={[styles.creatureSlotLand, creature && { borderColor: RARITY_COLOR[creature.rarity] }]}
                onPress={() => (creature ? setDetailCreatureId(id) : setDeckPickerSlot(i))}
                activeOpacity={0.8}
              >
                {display ? (
                  <>
                    <Text style={styles.creatureEmojiLand}>{display.emoji}</Text>
                    <Text style={styles.creatureNameLand} numberOfLines={1}>{display.name}</Text>
                    <Text style={[styles.creatureRarity, { color: RARITY_COLOR[creature.rarity] }]}>
                      {RARITY_LABEL[creature.rarity]}
                    </Text>
                    <Text style={styles.creatureLevelLand}>Niveau {own.level}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptySlotEmojiLand}>🥚</Text>
                    <Text style={styles.creatureNameLand}>Emplacement vide</Text>
                  </>
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

      <View style={styles.bottomLand}>
        <Text style={styles.hintLand}>
          {hasEmptySlot
            ? 'Touche un emplacement vide pour choisir une créature.'
            : 'Touche une créature pour ouvrir son profil.'}
        </Text>
        <TouchableOpacity style={styles.combatBtnLand} onPress={() => setChapterMapOpen(true)}>
          <Ionicons name="map" size={20} color="#0b0d16" />
          <Text style={styles.combatBtnLandText}>Mode Combat</Text>
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


// Profil de créature, en PAYSAGE et structuré comme la fiche de Monster
// Legends fournie en référence :
//   - colonne GAUCHE : portrait, puis niveau et paliers d'évolution
//     juste en dessous ; les Griffes sont affichées au-dessus.
//   - colonne DROITE : stats, runes, attaques, histoire — tout le reste,
//     dans une zone défilante propre.
// Les deux colonnes défilent indépendamment : en paysage la hauteur est
// très limitée, une seule zone de défilement pour toute la fiche aurait
// obligé à remonter en haut pour revoir le portrait.
function CreatureDetailScreen({ creature, owned, griffes, onEvolve, onLevelUp, ownedRunes, onEquipRune, onUnequipRune, onBack }) {
  const [runePickerSlot, setRunePickerSlot] = useState(null); // index (0-2) ou null

  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const baseName = creature.stages[0].name;
  const evolutionTier = owned.evolutionTier || 0;

  const equippedRunes = ownedRunes.filter((r) => r.equippedCreatureId === creature.id);
  const statsBase = combatStatsForCreatureTyped(creature, owned.level, evolutionTier, []);
  const stats = combatStatsForCreatureTyped(creature, owned.level, evolutionTier, equippedRunes);
  const hpBonus = stats.hp - statsBase.hp;
  const atkBonus = stats.attack - statsBase.attack;
  const enduranceBonus = stats.endurance - statsBase.endurance;

  const levelCost = levelUpCost(creature, owned.level);
  const evoMaxed = evolutionTier >= 2;
  const evoEligible = !evoMaxed && canEvolve(evolutionTier, owned.level);
  const evoCost = evoMaxed ? null : evolutionCost(evolutionTier);
  const nextEvoLevel = evoMaxed ? null : (evolutionTier === 0 ? 25 : 50);

  return (
    <>
    <View style={styles.screen}>
      {/* Bandeau supérieur : retour, nom, et les GRIFFES au-dessus de
          tout le reste, comme demandé. */}
      <View style={styles.headerLand}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.titleLand} numberOfLines={1}>{display.name}</Text>
        <View style={styles.griffesPill}>
          <Text style={styles.griffesPillText}>🐾 {griffes}</Text>
        </View>
      </View>

      <View style={styles.profileRow}>
        {/* ---------- COLONNE GAUCHE ---------- */}
        <ScrollView style={styles.profileLeft} contentContainerStyle={{ paddingBottom: 16 }}>
          <View style={[styles.portraitBox, { borderColor: RARITY_COLOR[creature.rarity] }]}>
            <View style={[styles.rarityBadge, { backgroundColor: RARITY_COLOR[creature.rarity] }]}>
              <Text style={styles.rarityBadgeText}>{RARITY_BADGE_LETTER[creature.rarity]}</Text>
            </View>
            <Text style={styles.portraitEmoji}>{display.emoji}</Text>
            <Text style={styles.portraitElement}>{creature.element} · {creature.combatType}</Text>
          </View>

          {/* Niveau et paliers, JUSTE EN DESSOUS du portrait. */}
          <View style={styles.levelBlock}>
            <Text style={styles.levelBlockLevel}>Niveau {owned.level}</Text>
            <Text style={styles.levelBlockTier}>
              {'★'.repeat(evolutionTier + 1)}{'☆'.repeat(2 - evolutionTier)}
            </Text>
            <Text style={styles.levelBlockRarity}>{RARITY_LABEL[creature.rarity]}</Text>
          </View>

          <TouchableOpacity
            style={[styles.profileBtn, griffes < levelCost && styles.actionBtnDisabledAdv]}
            onPress={onLevelUp}
            disabled={griffes < levelCost}
          >
            <Text style={styles.profileBtnText}>Niveau {owned.level + 1}</Text>
            <Text style={styles.profileBtnCost}>{levelCost} 🐾</Text>
          </TouchableOpacity>

          {evoMaxed ? (
            <Text style={styles.profileNote}>Palier maximum atteint.</Text>
          ) : evoEligible ? (
            <TouchableOpacity
              style={[styles.profileBtnGold, griffes < evoCost && styles.actionBtnDisabledAdv]}
              onPress={onEvolve}
              disabled={griffes < evoCost}
            >
              <Text style={styles.profileBtnText}>🌟 Évoluer</Text>
              <Text style={styles.profileBtnCost}>{evoCost} 🐾</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.profileNote}>Niveau {nextEvoLevel} requis pour le palier suivant.</Text>
          )}
        </ScrollView>

        {/* ---------- COLONNE DROITE ---------- */}
        <ScrollView style={styles.profileRight} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📊 Statistiques</Text>
            <StatLine label="❤️ Vie" value={stats.hp} bonus={hpBonus} color={COLORS.good} />
            <StatLine label="⚔️ Attaque" value={stats.attack} bonus={atkBonus} color={COLORS.bad} />
            <StatLine label="⚡ Endurance" value={stats.endurance} bonus={enduranceBonus} color={COLORS.action} />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🪬 Runes</Text>
            <View style={styles.runeSlotRow}>
              {[0, 1, 2].map((i) => {
                const rune = equippedRunes[i];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.runeSlot, rune && styles.runeSlotFilled]}
                    onPress={() => (rune ? onUnequipRune(rune.id) : setRunePickerSlot(i))}
                  >
                    <Text style={styles.runeSlotText}>{rune ? RUNE_TYPES[rune.type].emoji : '＋'}</Text>
                    {rune && <Text style={styles.runeSlotLevel}>nv {rune.level}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.speciesNote}>Touche une case pleine pour retirer sa rune.</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>⚔️ Attaques</Text>
            {creature.skills.map((skill) => (
              <View key={skill.id} style={styles.skillRow}>
                <Text style={styles.skillName}>{skill.name}</Text>
                <Text style={styles.skillStats}>{skill.damage} dégâts · {skill.enduranceCost} endurance</Text>
              </View>
            ))}
          </View>

          {creature.lore && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📖 Histoire</Text>
              {display.name !== baseName && (
                <Text style={styles.speciesNote}>Forme de base : {baseName}</Text>
              )}
              <Text style={styles.loreText}>{creature.lore}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>

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

// Une ligne de statistique avec son bonus de runes en couleur.
function StatLine({ label, value, bonus, color }) {
  return (
    <View style={styles.statLine}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {bonus > 0 && <Text style={{ color }}> (+{bonus})</Text>}
      </Text>
    </View>
  );
}


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

  creatureRarity: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  editSlotBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: 'rgba(245,197,66,0.1)', borderRadius: 8 },
  editSlotBtnText: { color: COLORS.action, fontSize: 9, fontWeight: '700' },



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
  runeEmoji: { fontSize: 30 },
  runeLevel: { color: COLORS.text, fontSize: 11, fontWeight: '800', marginTop: 4 },
  actionBtnDisabledAdv: { opacity: 0.4 },

  rarityBadge: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  rarityBadgeText: { color: '#fff', fontSize: 16, fontWeight: '900' },


  // ---------- Mise en page PAYSAGE ----------
  // En paysage la HAUTEUR est la ressource rare : marges et polices sont
  // volontairement plus serrées qu'en portrait, et la navigation passe
  // dans l'en-tête plutôt que dans une barre du bas.
  headerLand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6,
  },
  titleLand: { color: COLORS.text, fontSize: 18, fontWeight: '900', flex: 1, textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  griffesPill: {
    backgroundColor: COLORS.panel, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  griffesPillText: { color: COLORS.action, fontSize: 13, fontWeight: '900' },
  runesTopBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.neonCyan,
  },

  // Les 3 créatures occupent toute la largeur, à parts égales.
  creatureRowLand: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, flex: 1 },
  creatureCellLand: { flex: 1, alignItems: 'center' },
  creatureSlotLand: {
    width: '100%', flex: 1, backgroundColor: COLORS.panel, borderRadius: 16,
    borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8,
  },
  creatureEmojiLand: { fontSize: 46 },
  creatureNameLand: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 4 },
  creatureLevelLand: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  emptySlotEmojiLand: { fontSize: 40, opacity: 0.35 },
  bottomLand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, gap: 12,
  },
  hintLand: { color: COLORS.muted, fontSize: 11, flex: 1 },
  combatBtnLand: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.action, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 10,
  },
  combatBtnLandText: { color: '#0b0d16', fontSize: 14, fontWeight: '900' },

  // ---------- Profil de créature (2 colonnes) ----------
  profileRow: { flex: 1, flexDirection: 'row', paddingHorizontal: 12, gap: 12 },
  profileLeft: { width: '34%' },
  profileRight: { flex: 1 },
  portraitBox: {
    backgroundColor: COLORS.panel, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', paddingVertical: 14, position: 'relative',
  },
  portraitEmoji: { fontSize: 72 },
  portraitElement: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  levelBlock: {
    backgroundColor: COLORS.panelLight, borderRadius: 12, paddingVertical: 8,
    alignItems: 'center', marginTop: 8,
  },
  levelBlockLevel: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  levelBlockTier: { color: COLORS.action, fontSize: 15, marginTop: 2 },
  levelBlockRarity: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  profileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.panelLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  profileBtnGold: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(246,195,67,0.14)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 8, borderWidth: 1, borderColor: COLORS.action,
  },
  profileBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  profileBtnCost: { color: COLORS.action, fontSize: 12, fontWeight: '900' },
  profileNote: { color: COLORS.muted, fontSize: 11, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },
  statLine: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 5,
  },
  runeSlotFilled: { borderColor: COLORS.neonCyan },
  runeSlotText: { fontSize: 22 },
  loreText: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },

  statLabel: { color: COLORS.muted, fontSize: 13, fontWeight: '700', flex: 1 },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  // Delta de bonus affiché à côté de la stat concernée — couleur liée au
  // TYPE de rune (demande explicite : vert pour PV, rouge pour ATQ).

  runeSlotRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
  runeSlot: {
    width: 66, height: 66, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  runeSlotLevel: { color: COLORS.text, fontSize: 9, fontWeight: '800', marginTop: 2 },
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

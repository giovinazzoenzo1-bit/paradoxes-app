// Clicker de Créatures — premier jeu du menu. Tap pour gagner des pièces,
// invoque des créatures (gacha), nourris-les pour les faire monter de
// niveau et évoluer. Revenu passif hors-ligne inclus (plafonné à 4h).
// Persisté via AsyncStorage, indépendant du système de pièces global de
// l'appli (économie propre à ce jeu, comme les autres).
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CREATURES,
  RARITY_LABEL,
  RARITY_COLOR,
  stageForLevel,
  incomeForCreature,
  levelUpCost,
  summonCost,
  tapPowerCost,
  rollCreature,
  totalPassiveIncome,
  offlineEarnings,
  shouldSpawn,
  pickFromDeck,
  powerForCreature,
  SPAWN_INTERVAL_SEC,
  SPAWN_VISIBLE_SEC,
} from '../../games/clicker/clickerLogic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#12102a',
  panel: '#1d1a3d',
  border: '#332c5e',
  text: '#eef0f6',
  muted: '#9088b8',
  action: '#f5c542',
  good: '#00E676',
};

export const STORAGE_KEY = 'clicker:state:v1';

function formatNum(n) {
  if (n < 1000) return Math.floor(n).toString();
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'K';
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  return (n / 1_000_000_000).toFixed(2) + 'Md';
}

export default function ClickerScreen({ onBack }) {
  const panHandlers = useBackGesture(onBack);

  const [loaded, setLoaded] = useState(false);
  const [coins, setCoins] = useState(0);
  const [tapPower, setTapPower] = useState(1);
  const [owned, setOwned] = useState([]); // [{id, level}]
  const [view, setView] = useState('tap'); // 'tap' | 'collection'
  const [selectedCreature, setSelectedCreature] = useState(null);
  const [welcomeBack, setWelcomeBack] = useState(null);
  const [popups, setPopups] = useState([]);
  const [spawnedCreature, setSpawnedCreature] = useState(null); // {creature, expiresAt, leftPct, topPct}
  const [deck, setDeck] = useState([null, null, null]); // 3 emplacements, id de créature ou null
  const [pickerSlot, setPickerSlot] = useState(null); // index de l'emplacement en cours de choix, ou null
  const [activePower, setActivePower] = useState(null); // {name, rarity, tapMultiplier, expiresAt, effectType}
  const [pendingDiscount, setPendingDiscount] = useState(null); // {percent, name} — consommé au prochain achat
  const [, setLiveTick] = useState(0); // force le re-rendu pour les décomptes visuels

  const coinsRef = useRef(0);
  coinsRef.current = coins;
  const ownedRef = useRef([]);
  ownedRef.current = owned;
  const tapPowerRef = useRef(1);
  tapPowerRef.current = tapPower;
  const popupIdRef = useRef(0);
  const saveTimeoutRef = useRef(null);
  const viewRef = useRef('tap');
  viewRef.current = view;
  const spawnedCreatureRef = useRef(null);
  spawnedCreatureRef.current = spawnedCreature;
  const deckRef = useRef([null, null, null]);
  deckRef.current = deck;
  const activePowerRef = useRef(null);
  activePowerRef.current = activePower;
  const pendingDiscountRef = useRef(null);
  pendingDiscountRef.current = pendingDiscount;
  // Premier essaim au bout d'~1/3 de l'intervalle (pas d'attente complète
  // pour un nouveau joueur), puis toutes les SPAWN_INTERVAL_SEC ensuite.
  const lastSpawnTimeRef = useRef(Date.now() - Math.round(SPAWN_INTERVAL_SEC * (2 / 3)) * 1000);

  const tapScale = useRef(new Animated.Value(1)).current;

  // Chargement initial + calcul des gains hors-ligne.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          const nowSec = Date.now() / 1000;
          const elapsed = saved.lastSave ? nowSec - saved.lastSave : 0;
          const offline = offlineEarnings(saved.owned || [], elapsed);
          setCoins((saved.coins || 0) + offline);
          setTapPower(saved.tapPower || 1);
          setOwned(saved.owned || []);
          setDeck(saved.deck || [null, null, null]);
          if (offline > 5) setWelcomeBack(offline);
        }
      } catch (e) {
        // pas de sauvegarde valide, on démarre à zéro
      }
      setLoaded(true);
    })();
  }, []);

  // Sauvegarde (avec un léger anti-rebond pour ne pas écrire à chaque tap).
  useEffect(() => {
    if (!loaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ coins, tapPower, owned, deck, lastSave: Date.now() / 1000 })
      );
    }, 600);
  }, [coins, tapPower, owned, deck, loaded]);

  // Sauvegarde immédiate à la sortie de l'écran.
  useEffect(() => {
    return () => {
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ coins: coinsRef.current, tapPower: tapPowerRef.current, owned: ownedRef.current, deck: deckRef.current, lastSave: Date.now() / 1000 })
      );
    };
  }, []);

  // Revenu passif : +1 tick par seconde, boosté si un pouvoir passive_boost est actif.
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      const base = totalPassiveIncome(ownedRef.current);
      const boost = activePowerRef.current && activePowerRef.current.effectType === 'passive_boost' ? activePowerRef.current.effectValue : 1;
      const income = base * boost;
      if (income > 0) setCoins((c) => c + income);
    }, 1000);
    return () => clearInterval(interval);
  }, [loaded]);

  // Apparitions de créatures sur le bouton de tap : toutes les
  // Apparitions de créatures sur le bouton de tap : toutes les
  // SPAWN_INTERVAL_SEC, si on est sur l'onglet Tap, qu'aucune créature
  // n'est déjà affichée, ET que le deck contient au moins une créature —
  // seules les créatures placées dans le deck peuvent apparaître (plus le
  // tirage sur les 10 créatures, qui donnait l'impression que certaines ne
  // sortaient jamais). La même boucle gère aussi l'expiration de
  // l'apparition (ratée si pas tapée à temps) et l'expiration du pouvoir actif.
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      const now = Date.now();

      if (spawnedCreatureRef.current && now > spawnedCreatureRef.current.expiresAt) {
        setSpawnedCreature(null);
      } else if (!spawnedCreatureRef.current && viewRef.current === 'tap' && shouldSpawn(lastSpawnTimeRef.current, now)) {
        const picked = pickFromDeck(deckRef.current);
        if (picked) {
          lastSpawnTimeRef.current = now;
          const pos = randomRingPosition();
          setSpawnedCreature({ creature: picked, expiresAt: now + SPAWN_VISIBLE_SEC * 1000, leftPct: pos.leftPct, topPct: pos.topPct });
        }
        // Deck vide : on ne met PAS à jour lastSpawnTimeRef, pour qu'une
        // apparition devienne possible dès qu'une créature est ajoutée au
        // deck, sans devoir attendre un cycle complet de plus.
      }

      if (activePowerRef.current && now > activePowerRef.current.expiresAt) {
        setActivePower(null);
      }

      setLiveTick((t) => t + 1);
    }, 300);
    return () => clearInterval(interval);
  }, [loaded]);

  const spawnPopup = (text, x, y) => {
    const id = popupIdRef.current++;
    setPopups((p) => [...p, { id, text, x, y }]);
    setTimeout(() => setPopups((p) => p.filter((pp) => pp.id !== id)), 700);
  };

  const handleTap = (evt) => {
    const multiplier = activePowerRef.current ? activePowerRef.current.tapMultiplier : 1;
    const gain = tapPowerRef.current * multiplier;
    setCoins((c) => c + gain);
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    const x = evt.nativeEvent.locationX || 60;
    const y = evt.nativeEvent.locationY || 60;
    spawnPopup(`+${gain}`, x, y);
  };

  // Le joueur a tapé la créature apparue à temps : son pouvoir s'active,
  // différent selon la créature (pas juste sa rareté).
  const claimPower = () => {
    const spawned = spawnedCreatureRef.current;
    if (!spawned) return;
    const power = powerForCreature(spawned.creature, tapPowerRef.current);

    if (power.effectType === 'discount_next') {
      // Réduit le coût du tout prochain achat (tap/invocation/nourrir),
      // quel qu'il soit — consommé une seule fois.
      setPendingDiscount({ percent: power.effectValue, name: power.name });
      spawnPopup(`-${Math.round(power.effectValue * 100)}%`, 110, 60);
    } else {
      // coins_burst et passive_boost passent tous les deux par le buff actif
      // (coins_burst donne aussi un bonus immédiat en plus du multiplicateur de tap).
      setActivePower({ ...power, expiresAt: Date.now() + power.durationSec * 1000 });
      if (power.bonusCoins > 0) {
        setCoins((c) => c + power.bonusCoins);
        spawnPopup(`+${power.bonusCoins}`, 110, 60);
      }
    }
    setSpawnedCreature(null);
  };

  // Applique la remise en attente (pouvoir discount_next) au coût donné —
  // ne fait rien si aucune remise n'est active. Consommée séparément, au
  // moment où l'achat aboutit vraiment (voir les 3 fonctions ci-dessous).
  const applyDiscount = (cost) => (pendingDiscount ? Math.max(1, Math.round(cost * (1 - pendingDiscount.percent))) : cost);

  const buyTapPower = () => {
    const cost = applyDiscount(tapPowerCost(tapPower));
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setTapPower((t) => t + 1);
    if (pendingDiscountRef.current) setPendingDiscount(null);
  };

  const passiveIncome = totalPassiveIncome(owned) * (activePower && activePower.effectType === 'passive_boost' ? activePower.effectValue : 1);
  const nextSummonCost = applyDiscount(summonCost(owned.length));

  const doSummon = () => {
    if (coins < nextSummonCost) return;
    setCoins((c) => c - nextSummonCost);
    if (pendingDiscountRef.current) setPendingDiscount(null);
    const creature = rollCreature();
    setOwned((prev) => {
      const existing = prev.find((o) => o.id === creature.id);
      if (existing) {
        return prev.map((o) => (o.id === creature.id ? { ...o, level: o.level + 1 } : o));
      }
      return [...prev, { id: creature.id, level: 1 }];
    });
    setSelectedCreature(creature.id);
    setView('collection');
  };

  const feedCreature = (id) => {
    const owned1 = ownedRef.current.find((o) => o.id === id);
    if (!owned1) return;
    const creature = CREATURES.find((c) => c.id === id);
    const cost = applyDiscount(levelUpCost(creature, owned1.level));
    if (coinsRef.current < cost) return;
    setCoins((c) => c - cost);
    if (pendingDiscountRef.current) setPendingDiscount(null);
    setOwned((prev) => prev.map((o) => (o.id === id ? { ...o, level: o.level + 1 } : o)));
  };

  // Deck de 3 créatures (les seules qui peuvent apparaître sur le cookie).
  const assignToDeck = (slotIndex, creatureId) => {
    setDeck((prev) => {
      const next = [...prev];
      // Retire d'abord la créature de tout autre emplacement où elle
      // serait déjà (pas de doublon dans le deck).
      for (let i = 0; i < next.length; i++) {
        if (next[i] === creatureId) next[i] = null;
      }
      next[slotIndex] = creatureId;
      return next;
    });
    setPickerSlot(null);
  };

  const clearDeckSlot = (slotIndex) => {
    setDeck((prev) => prev.map((id, i) => (i === slotIndex ? null : id)));
    setPickerSlot(null);
  };

  if (!loaded) {
    return (
      <View style={styles.screen} {...panHandlers}>
        <Text style={styles.loadingText}>Chargement…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen} {...panHandlers}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>🐾 Élevage</Text>
      </View>

      <View style={styles.coinsRow}>
        <Text style={styles.coinsValue}>💰 {formatNum(coins)}</Text>
        {passiveIncome > 0 && <Text style={styles.incomeText}>+{passiveIncome.toFixed(1)}/s</Text>}
      </View>

      {activePower && (
        <View style={styles.powerBanner}>
          <Text style={styles.powerBannerText}>
            ⚡ {activePower.name} actif : x{activePower.tapMultiplier} tap
            {activePower.effectType === 'passive_boost' ? ` + x${activePower.effectValue} revenu passif` : ''}
            {' '}({Math.max(0, Math.ceil((activePower.expiresAt - Date.now()) / 1000))}s)
          </Text>
        </View>
      )}

      {pendingDiscount && (
        <View style={[styles.powerBanner, styles.discountBanner]}>
          <Text style={[styles.powerBannerText, styles.discountBannerText]}>
            🏷️ {pendingDiscount.name} : -{Math.round(pendingDiscount.percent * 100)}% sur ton prochain achat
          </Text>
        </View>
      )}

      {welcomeBack !== null && (
        <TouchableOpacity style={styles.welcomeBanner} onPress={() => setWelcomeBack(null)}>
          <Text style={styles.welcomeText}>🎉 Pendant ton absence, tes créatures ont gagné {formatNum(welcomeBack)} pièces !</Text>
        </TouchableOpacity>
      )}

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, view === 'tap' && styles.tabBtnActive]} onPress={() => setView('tap')}>
          <Text style={[styles.tabBtnText, view === 'tap' && styles.tabBtnTextActive]}>Tap</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, view === 'collection' && styles.tabBtnActive]} onPress={() => setView('collection')}>
          <Text style={[styles.tabBtnText, view === 'collection' && styles.tabBtnTextActive]}>
            Collection ({owned.length}/{CREATURES.length})
          </Text>
        </TouchableOpacity>
      </View>

      {view === 'tap' ? (
        <View style={styles.tapArea}>
          <DeckRow deck={deck} owned={owned} onSlotPress={setPickerSlot} />

          <View style={styles.tapZone}>
            <TouchableOpacity activeOpacity={1} onPress={handleTap} style={StyleSheet.absoluteFillObject}>
              <View style={styles.tapButtonWrap}>
                <Animated.View style={[styles.tapButton, { transform: [{ scale: tapScale }] }]}>
                  <Text style={styles.tapEmoji}>🥚</Text>
                </Animated.View>
              </View>
            </TouchableOpacity>
            {popups.map((p) => (
              <Animated.Text key={p.id} style={[styles.popup, { left: p.x, top: p.y }]}>
                {p.text}
              </Animated.Text>
            ))}
            {/* La bulle de créature est un FRÈRE du bouton tapable, pas un
                enfant — elle capte son propre appui sans jamais entrer en
                conflit avec le tap de l'œuf en dessous. */}
            {spawnedCreature && <SpawnedCreatureBubble spawned={spawnedCreature} onClaim={claimPower} />}
          </View>
          <Text style={styles.tapHint}>Tape pour récolter des pièces</Text>

          <TouchableOpacity
            style={[styles.actionBtn, coins < applyDiscount(tapPowerCost(tapPower)) && styles.actionBtnDisabled]}
            onPress={buyTapPower}
            disabled={coins < applyDiscount(tapPowerCost(tapPower))}
          >
            <Text style={styles.actionBtnText}>👆 Puissance de tap : {tapPower} → {tapPower + 1}</Text>
            <Text style={styles.actionBtnCost}>💰 {formatNum(applyDiscount(tapPowerCost(tapPower)))}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.summonBtn, coins < nextSummonCost && styles.actionBtnDisabled]}
            onPress={doSummon}
            disabled={coins < nextSummonCost}
          >
            <Text style={styles.summonBtnText}>🥚 Invoquer une créature</Text>
            <Text style={styles.summonBtnCost}>💰 {formatNum(nextSummonCost)}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <CollectionView
          owned={owned}
          selectedCreature={selectedCreature}
          setSelectedCreature={setSelectedCreature}
          coins={coins}
          onFeed={feedCreature}
          pendingDiscount={pendingDiscount}
        />
      )}

      {pickerSlot !== null && (
        <DeckPicker
          slotIndex={pickerSlot}
          deck={deck}
          owned={owned}
          onPick={(id) => assignToDeck(pickerSlot, id)}
          onClear={() => clearDeckSlot(pickerSlot)}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </View>
  );
}

// Les 3 emplacements du deck, affichés au-dessus de l'œuf. Un
// emplacement vide est un œuf grisé — appuyer dessus (rempli ou vide)
// ouvre le sélecteur pour choisir/changer la créature qui l'occupe.
function DeckRow({ deck, owned, onSlotPress }) {
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  return (
    <View style={styles.deckRow}>
      {deck.map((id, i) => {
        const creature = id ? CREATURES.find((c) => c.id === id) : null;
        const own = id ? ownedMap[id] : null;
        const display = creature && own ? creature.stages[stageForLevel(own.level)] : null;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.deckSlot, creature && { borderColor: RARITY_COLOR[creature.rarity] }]}
            onPress={() => onSlotPress(i)}
          >
            {display ? <Text style={styles.deckSlotEmoji}>{display.emoji}</Text> : <Text style={styles.deckSlotEmpty}>🥚</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Sélecteur : choisir quelle créature possédée occupe l'emplacement
// tapé. Une créature déjà dans un autre emplacement peut être choisie —
// elle sera simplement retirée de l'autre emplacement (pas de doublon).
function DeckPicker({ slotIndex, deck, owned, onPick, onClear, onClose }) {
  return (
    <View style={styles.detailOverlay}>
      <View style={styles.detailPanel}>
        <TouchableOpacity style={styles.detailClose} onPress={onClose}>
          <Text style={styles.detailCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.pickerTitle}>Emplacement {slotIndex + 1} du deck</Text>
        <Text style={styles.pickerSubtitle}>Choisis une créature que tu possèdes</Text>

        {owned.length === 0 ? (
          <Text style={styles.pickerEmptyText}>Tu ne possèdes encore aucune créature — invoque-en une d'abord !</Text>
        ) : (
          <View style={styles.pickerGrid}>
            {owned.map((o) => {
              const creature = CREATURES.find((c) => c.id === o.id);
              const display = creature.stages[stageForLevel(o.level)];
              const inOtherSlot = deck.includes(o.id) && deck[slotIndex] !== o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.pickerCell, deck[slotIndex] === o.id && styles.pickerCellSelected]}
                  onPress={() => onPick(o.id)}
                >
                  <Text style={styles.creatureEmoji}>{display.emoji}</Text>
                  <Text style={styles.creatureName} numberOfLines={1}>{display.name}</Text>
                  {inOtherSlot && <Text style={styles.pickerInUse}>déjà en jeu</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {deck[slotIndex] && (
          <TouchableOpacity style={styles.pickerClearBtn} onPress={onClear}>
            <Text style={styles.pickerClearBtnText}>Vider cet emplacement</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function CollectionView({ owned, selectedCreature, setSelectedCreature, coins, onFeed, pendingDiscount }) {
  const ownedMap = {};
  owned.forEach((o) => (ownedMap[o.id] = o));

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={CREATURES}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const own = ownedMap[item.id];
          const discovered = !!own;
          const stage = discovered ? stageForLevel(own.level) : 0;
          const display = discovered ? item.stages[stage] : null;
          return (
            <TouchableOpacity
              style={[styles.creatureCell, !discovered && styles.creatureCellLocked]}
              onPress={() => discovered && setSelectedCreature(item.id)}
              disabled={!discovered}
            >
              <Text style={styles.creatureEmoji}>{discovered ? display.emoji : '❔'}</Text>
              <Text style={styles.creatureName} numberOfLines={1}>{discovered ? display.name : '???'}</Text>
              {discovered && <Text style={styles.creatureLevel}>Nv {own.level}</Text>}
              <Text style={[styles.creatureRarity, { color: RARITY_COLOR[item.rarity] }]}>{RARITY_LABEL[item.rarity]}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {selectedCreature && ownedMap[selectedCreature] && (
        <CreatureDetail
          creature={CREATURES.find((c) => c.id === selectedCreature)}
          owned={ownedMap[selectedCreature]}
          coins={coins}
          onFeed={() => onFeed(selectedCreature)}
          onClose={() => setSelectedCreature(null)}
          pendingDiscount={pendingDiscount}
        />
      )}
    </View>
  );
}

function CreatureDetail({ creature, owned, coins, onFeed, onClose, pendingDiscount }) {
  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const income = incomeForCreature(creature, owned.level);
  const baseCost = levelUpCost(creature, owned.level);
  const cost = pendingDiscount ? Math.max(1, Math.round(baseCost * (1 - pendingDiscount.percent))) : baseCost;
  const canFeed = coins >= cost;
  const nextEvoLevel = stage === 0 ? 5 : stage === 1 ? 15 : null;

  return (
    <View style={styles.detailOverlay}>
      <View style={styles.detailPanel}>
        <TouchableOpacity style={styles.detailClose} onPress={onClose}>
          <Text style={styles.detailCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.detailEmoji}>{display.emoji}</Text>
        <Text style={styles.detailName}>{display.name}</Text>
        <Text style={[styles.creatureRarity, { color: RARITY_COLOR[creature.rarity] }]}>
          {RARITY_LABEL[creature.rarity]} · {creature.family}
        </Text>
        <Text style={styles.detailStat}>Niveau {owned.level} — 💰 {income.toFixed(2)}/s</Text>
        {nextEvoLevel && <Text style={styles.detailEvoHint}>Évolue au niveau {nextEvoLevel}</Text>}

        <TouchableOpacity style={[styles.feedBtn, !canFeed && styles.actionBtnDisabled]} onPress={onFeed} disabled={!canFeed}>
          <Text style={styles.feedBtnText}>🍖 Nourrir</Text>
          <Text style={styles.feedBtnCost}>💰 {formatNum(cost)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Position aléatoire en anneau AUTOUR de l'œuf (pas dessus, pas dans un
// coin fixe) — angle et rayon tirés au hasard à chaque apparition.
function randomRingPosition() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 32 + Math.random() * 10; // % de la zone, autour du centre
  return {
    leftPct: 50 + Math.cos(angle) * radius,
    topPct: 50 + Math.sin(angle) * radius,
  };
}

function SpawnedCreatureBubble({ spawned, onClaim }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const drift = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 350, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 350, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    // Dérive douce et continue (flotte lentement autour de son point
    // d'apparition, jamais tout à fait immobile).
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: { x: 10, y: -8 }, duration: 1400, useNativeDriver: true }),
        Animated.timing(drift, { toValue: { x: -10, y: 8 }, duration: 1400, useNativeDriver: true }),
        Animated.timing(drift, { toValue: { x: 0, y: 0 }, duration: 1400, useNativeDriver: true }),
      ])
    );
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [pulse, drift]);

  const display = spawned.creature.stages[0];
  const color = RARITY_COLOR[spawned.creature.rarity];

  return (
    <TouchableOpacity
      onPress={onClaim}
      style={[styles.spawnBubbleWrap, { left: `${spawned.leftPct}%`, top: `${spawned.topPct}%` }]}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
    >
      <Animated.View
        style={[
          styles.spawnBubble,
          { borderColor: color, transform: [...drift.getTranslateTransform(), { scale: pulse }] },
        ]}
      >
        <Text style={styles.spawnBubbleEmoji}>{display.emoji}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  loadingText: { color: COLORS.muted, textAlign: 'center', marginTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },

  coinsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginTop: 4 },
  coinsValue: { color: COLORS.action, fontSize: 26, fontWeight: '900' },
  incomeText: { color: COLORS.good, fontSize: 13, fontWeight: '700' },

  welcomeBanner: { backgroundColor: 'rgba(0,230,118,0.15)', borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1, borderColor: COLORS.good },
  welcomeText: { color: COLORS.good, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  powerBanner: { backgroundColor: 'rgba(245,197,66,0.15)', borderRadius: 10, paddingVertical: 6, marginTop: 6, borderWidth: 1, borderColor: COLORS.action },
  discountBanner: { backgroundColor: 'rgba(46,127,184,0.15)', borderColor: '#3ec6f0' },
  discountBannerText: { color: '#3ec6f0' },
  powerBannerText: { color: COLORS.action, fontSize: 12, fontWeight: '800', textAlign: 'center' },

  spawnBubbleWrap: { position: 'absolute', zIndex: 10, marginLeft: -27, marginTop: -27 },
  spawnBubble: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2.5,
    shadowColor: '#fff', shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  spawnBubbleEmoji: { fontSize: 28 },

  tabRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border },
  tabBtnActive: { backgroundColor: COLORS.action, borderColor: COLORS.action },
  tabBtnText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  tabBtnTextActive: { color: '#241a00' },

  deckRow: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  deckSlot: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  deckSlotEmoji: { fontSize: 26 },
  deckSlotEmpty: { fontSize: 22, opacity: 0.35 },

  tapArea: { flex: 1, alignItems: 'center', marginTop: 10 },
  tapZone: { width: '100%', height: 220, position: 'relative' },
  tapButtonWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tapButton: {
    width: 160, height: 160, borderRadius: 80, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.action,
    shadowColor: COLORS.action, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
  },
  tapEmoji: { fontSize: 74 },
  tapHint: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  popup: { position: 'absolute', color: COLORS.action, fontSize: 16, fontWeight: '900' },

  actionBtn: {
    width: '100%', backgroundColor: COLORS.panel, borderRadius: 14, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  actionBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '700', flex: 1 },
  actionBtnCost: { color: COLORS.action, fontSize: 13, fontWeight: '800' },
  actionBtnDisabled: { opacity: 0.4 },

  summonBtn: {
    width: '100%', backgroundColor: 'rgba(185,107,255,0.15)', borderRadius: 14, padding: 16, marginTop: 12,
    borderWidth: 1.5, borderColor: '#b96bff', alignItems: 'center',
  },
  summonBtnText: { color: '#b96bff', fontSize: 15, fontWeight: '900' },
  summonBtnCost: { color: COLORS.action, fontSize: 12, fontWeight: '800', marginTop: 4 },

  grid: { paddingBottom: 20 },
  creatureCell: {
    flex: 1, margin: 4, backgroundColor: COLORS.panel, borderRadius: 12, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, minHeight: 100,
  },
  creatureCellLocked: { opacity: 0.4 },
  creatureEmoji: { fontSize: 30 },
  creatureName: { color: COLORS.text, fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  creatureLevel: { color: COLORS.muted, fontSize: 9, marginTop: 1 },
  creatureRarity: { fontSize: 8, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },

  detailOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  detailPanel: { width: '100%', backgroundColor: COLORS.panel, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  detailClose: { position: 'absolute', top: 12, right: 12, padding: 6 },
  detailCloseText: { color: COLORS.muted, fontSize: 16, fontWeight: '800' },
  detailEmoji: { fontSize: 64 },
  detailName: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 6 },
  detailStat: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  detailEvoHint: { color: '#b96bff', fontSize: 11, fontWeight: '700', marginTop: 4 },

  pickerTitle: { color: COLORS.text, fontSize: 17, fontWeight: '900', marginTop: 6 },
  pickerSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 4, marginBottom: 14, textAlign: 'center' },
  pickerEmptyText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, width: '100%' },
  pickerCell: {
    width: 84, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  pickerCellSelected: { borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.12)' },
  pickerInUse: { color: COLORS.muted, fontSize: 8, marginTop: 2, fontStyle: 'italic' },
  pickerClearBtn: { marginTop: 16, paddingVertical: 8 },
  pickerClearBtnText: { color: '#FF5252', fontSize: 13, fontWeight: '700' },

  feedBtn: { backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28, marginTop: 16, alignItems: 'center' },
  feedBtnText: { color: '#241a00', fontSize: 14, fontWeight: '900' },
  feedBtnCost: { color: '#241a00', fontSize: 11, fontWeight: '700', marginTop: 2 },
});

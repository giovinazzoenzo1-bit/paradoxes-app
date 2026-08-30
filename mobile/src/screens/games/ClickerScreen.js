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

const STORAGE_KEY = 'clicker:state:v1';

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

  const coinsRef = useRef(0);
  coinsRef.current = coins;
  const ownedRef = useRef([]);
  ownedRef.current = owned;
  const tapPowerRef = useRef(1);
  tapPowerRef.current = tapPower;
  const popupIdRef = useRef(0);
  const saveTimeoutRef = useRef(null);

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
        JSON.stringify({ coins, tapPower, owned, lastSave: Date.now() / 1000 })
      );
    }, 600);
  }, [coins, tapPower, owned, loaded]);

  // Sauvegarde immédiate à la sortie de l'écran.
  useEffect(() => {
    return () => {
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ coins: coinsRef.current, tapPower: tapPowerRef.current, owned: ownedRef.current, lastSave: Date.now() / 1000 })
      );
    };
  }, []);

  // Revenu passif : +1 tick par seconde.
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      const income = totalPassiveIncome(ownedRef.current);
      if (income > 0) setCoins((c) => c + income);
    }, 1000);
    return () => clearInterval(interval);
  }, [loaded]);

  const spawnPopup = (text, x, y) => {
    const id = popupIdRef.current++;
    setPopups((p) => [...p, { id, text, x, y }]);
    setTimeout(() => setPopups((p) => p.filter((pp) => pp.id !== id)), 700);
  };

  const handleTap = (evt) => {
    setCoins((c) => c + tapPowerRef.current);
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();
    const x = evt.nativeEvent.locationX || 60;
    const y = evt.nativeEvent.locationY || 60;
    spawnPopup(`+${tapPowerRef.current}`, x, y);
  };

  const buyTapPower = () => {
    const cost = tapPowerCost(tapPower);
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setTapPower((t) => t + 1);
  };

  const passiveIncome = totalPassiveIncome(owned);
  const nextSummonCost = summonCost(owned.length);

  const doSummon = () => {
    if (coins < nextSummonCost) return;
    setCoins((c) => c - nextSummonCost);
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
    const cost = levelUpCost(creature, owned1.level);
    if (coinsRef.current < cost) return;
    setCoins((c) => c - cost);
    setOwned((prev) => prev.map((o) => (o.id === id ? { ...o, level: o.level + 1 } : o)));
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
          <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.tapZone}>
            <Animated.View style={[styles.tapButton, { transform: [{ scale: tapScale }] }]}>
              <Text style={styles.tapEmoji}>🥚</Text>
            </Animated.View>
            {popups.map((p) => (
              <Animated.Text key={p.id} style={[styles.popup, { left: p.x, top: p.y }]}>
                {p.text}
              </Animated.Text>
            ))}
          </TouchableOpacity>
          <Text style={styles.tapHint}>Tape pour récolter des pièces</Text>

          <TouchableOpacity
            style={[styles.actionBtn, coins < tapPowerCost(tapPower) && styles.actionBtnDisabled]}
            onPress={buyTapPower}
            disabled={coins < tapPowerCost(tapPower)}
          >
            <Text style={styles.actionBtnText}>👆 Puissance de tap : {tapPower} → {tapPower + 1}</Text>
            <Text style={styles.actionBtnCost}>💰 {formatNum(tapPowerCost(tapPower))}</Text>
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
        />
      )}
    </View>
  );
}

function CollectionView({ owned, selectedCreature, setSelectedCreature, coins, onFeed }) {
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
        />
      )}
    </View>
  );
}

function CreatureDetail({ creature, owned, coins, onFeed, onClose }) {
  const stage = stageForLevel(owned.level);
  const display = creature.stages[stage];
  const income = incomeForCreature(creature, owned.level);
  const cost = levelUpCost(creature, owned.level);
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

  tabRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border },
  tabBtnActive: { backgroundColor: COLORS.action, borderColor: COLORS.action },
  tabBtnText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  tabBtnTextActive: { color: '#241a00' },

  tapArea: { flex: 1, alignItems: 'center', marginTop: 10 },
  tapZone: { width: '100%', height: 220, alignItems: 'center', justifyContent: 'center' },
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

  feedBtn: { backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28, marginTop: 16, alignItems: 'center' },
  feedBtnText: { color: '#241a00', fontSize: 14, fontWeight: '900' },
  feedBtnCost: { color: '#241a00', fontSize: 11, fontWeight: '700', marginTop: 2 },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import CoinBar from '../components/CoinBar';
import { useDaily } from '../context/DailyContext';
import { questDef, streakReward, STREAK_REWARDS } from '../games/clicker/dailyLogic';
import { COLORS } from './games/clickerTheme';

// Les récompenses de quêtes/streak sont créditées en Griffes (ressource
// d'Aventure) via un drapeau partagé (PENDING_GRIFFES_KEY, voir
// DailyContext.js) — pas d'accès direct à l'état d'Aventure depuis cet
// écran, donc la récompense n'apparaît qu'à la PROCHAINE ouverture du
// mode Aventure, pas instantanément ici. On le dit clairement au joueur
// pour ne pas le laisser chercher où sont passées ses Griffes.
export default function ProgresScreen() {
  const { loaded, questIds, questProgress, questClaimed, streak, streakClaimedDate, date, claimQuest, claimStreak } = useDaily();
  const [busyId, setBusyId] = useState(null); // évite un double-tap pendant l'écriture AsyncStorage

  if (!loaded) {
    return (
      <View style={styles.container}>
        <CoinBar />
      </View>
    );
  }

  const streakAlreadyClaimed = streakClaimedDate === date;
  const todayReward = streakReward(streak);
  const dayInCycle = ((streak - 1) % STREAK_REWARDS.length) + 1;

  const handleClaimQuest = async (questId) => {
    setBusyId(questId);
    const reward = await claimQuest(questId);
    setBusyId(null);
    if (reward) {
      Alert.alert('Quête terminée !', `+${reward} 🐾 Griffes — récupère-les en ouvrant le mode Exploration.`);
    }
  };

  const handleClaimStreak = async () => {
    setBusyId('streak');
    const reward = await claimStreak();
    setBusyId(null);
    if (reward) {
      Alert.alert('Bonus de connexion !', `+${reward} 🐾 Griffes — récupère-les en ouvrant le mode Exploration.`);
    }
  };

  return (
    <View style={styles.container}>
      <CoinBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>🏆 Progrès</Text>

        {/* Streak de connexion — volontairement NEUTRE (aucune mention de
            clicker ou d'aventure) : juste être revenu aujourd'hui compte,
            peu importe le mode joué. */}
        <View style={styles.streakCard}>
          <Text style={styles.streakTitle}>🔥 Jour {dayInCycle} / 7</Text>
          <Text style={styles.streakSubtitle}>Le cycle de 7 jours recommence ensuite</Text>

          {/* Tableau des 7 jours — remplace les petits points par une
              vraie grille numérotée avec la récompense visible sur
              chaque case (demande explicite), et affiche bien "Jour 1"
              après le jour 7, pas un compteur qui grimpe sans fin. */}
          <View style={styles.streakTable}>
            {STREAK_REWARDS.map((reward, i) => {
              const dayNum = i + 1;
              const isCurrent = dayNum === dayInCycle;
              const isDone = dayNum < dayInCycle || (dayNum === dayInCycle && streakAlreadyClaimed);
              return (
                <View
                  key={i}
                  style={[styles.streakDayCell, isCurrent && styles.streakDayCellCurrent, isDone && styles.streakDayCellDone]}
                >
                  <Text style={[styles.streakDayLabel, isCurrent && styles.streakDayLabelCurrent]}>J{dayNum}</Text>
                  <Text style={[styles.streakDayReward, isCurrent && styles.streakDayLabelCurrent]}>{reward}</Text>
                  {isDone && <Text style={styles.streakDayCheck}>✓</Text>}
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.claimBtn, streakAlreadyClaimed && styles.claimBtnDone]}
            onPress={handleClaimStreak}
            disabled={streakAlreadyClaimed || busyId === 'streak'}
          >
            <Text style={styles.claimBtnText}>
              {streakAlreadyClaimed ? "✓ Déjà réclamé aujourd'hui" : `Réclamer +${todayReward} 🐾`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quêtes du jour — mélange volontaire Élevage/Aventure. */}
        <Text style={styles.sectionTitle}>Quêtes du jour</Text>
        {questIds.map((qid) => {
          const def = questDef(qid);
          if (!def) return null;
          const progress = Math.min(def.target, Math.floor(questProgress[qid] || 0));
          const done = progress >= def.target;
          const claimed = !!questClaimed[qid];
          const pct = Math.min(100, (progress / def.target) * 100);
          return (
            <View key={qid} style={styles.questCard}>
              <Text style={styles.questDesc}>{def.desc}</Text>
              <View style={styles.questBarTrack}>
                <View style={[styles.questBarFill, { width: `${pct}%` }, claimed && { backgroundColor: COLORS.muted }]} />
              </View>
              <View style={styles.questFooter}>
                <Text style={styles.questProgressText}>{progress} / {def.target}</Text>
                <TouchableOpacity
                  style={[styles.questClaimBtn, (!done || claimed) && styles.questClaimBtnDisabled]}
                  onPress={() => handleClaimQuest(qid)}
                  disabled={!done || claimed || busyId === qid}
                >
                  <Text style={[styles.questClaimBtnText, (!done || claimed) && styles.questClaimBtnTextDisabled]}>
                    {claimed ? '✓ Réclamée' : `+${def.reward} 🐾`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <Text style={styles.footnote}>Nouvelles quêtes chaque jour à minuit. Récompenses créditées à ta prochaine ouverture du mode Exploration.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c' },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#eef0f6', marginBottom: 16 },

  streakCard: {
    backgroundColor: COLORS.panel, borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 22,
  },
  streakTitle: { color: COLORS.action, fontSize: 18, fontWeight: '900' },
  streakSubtitle: { color: COLORS.muted, fontSize: 10, marginTop: 2, marginBottom: 14 },
  streakTable: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  streakDayCell: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: COLORS.border,
  },
  streakDayCellCurrent: { borderColor: COLORS.action, backgroundColor: 'rgba(245,197,66,0.14)' },
  streakDayCellDone: { borderColor: COLORS.good, backgroundColor: 'rgba(0,255,163,0.08)' },
  streakDayLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  streakDayLabelCurrent: { color: COLORS.action },
  streakDayReward: { color: COLORS.text, fontSize: 12, fontWeight: '900', marginTop: 3 },
  streakDayCheck: { color: COLORS.good, fontSize: 11, fontWeight: '900', marginTop: 2 },

  sectionTitle: { color: COLORS.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10 },

  questCard: {
    backgroundColor: COLORS.panel, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  questDesc: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  questBarTrack: { height: 8, borderRadius: 4, backgroundColor: '#241d42', overflow: 'hidden' },
  questBarFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.good },
  questFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  questProgressText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  questClaimBtn: { backgroundColor: COLORS.action, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  questClaimBtnDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  questClaimBtnText: { color: '#241a00', fontSize: 11, fontWeight: '800' },
  questClaimBtnTextDisabled: { color: COLORS.muted },

  claimBtn: { backgroundColor: COLORS.action, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 22, width: '100%', alignItems: 'center' },
  claimBtnDone: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  claimBtnText: { color: '#241a00', fontSize: 13, fontWeight: '800' },

  footnote: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 16, paddingHorizontal: 10 },
});

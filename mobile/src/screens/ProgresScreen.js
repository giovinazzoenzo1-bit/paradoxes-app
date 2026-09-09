import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useDaily } from '../context/DailyContext';
import { questDef, weeklyQuestDef, achievementDef } from '../games/clicker/dailyLogic';
import { COLORS } from './games/clickerTheme';

// Menu Quêtes — panneau MODAL (ne couvre plus tout l'écran, on voit le
// menu du Clicker autour), refondu le 07/09 d'après la maquette fournie :
// bandeau de titre + croix de fermeture, liste au centre, rangée
// d'onglets en bas.
//
// Le bloc "récompense de connexion journalière" (streak 7 jours) a été
// RETIRÉ sur demande : il faisait doublon avec le calendrier déjà
// accessible par le bouton cadeau du menu principal. Les fonctions
// correspondantes de DailyContext (claimStreak, streakReward,
// STREAK_REWARDS) n'ont pas été touchées — le calendrier du Clicker s'en
// sert toujours.
// Onglet "Log-In" retiré le 07/09 : il aurait fait doublon avec le
// calendrier du bouton cadeau, comme le bloc streak retiré juste avant.
const TABS = [
  { key: 'daily', label: 'Quotidiennement' },
  { key: 'weekly', label: 'Hebdomadaire' },
  { key: 'success', label: 'Succès' },
];

export default function ProgresScreen({ onBack }) {
  const {
    loaded, questIds, questProgress, questClaimed, claimQuest,
    weeklyIds, weeklyProgress, weeklyClaimed, claimWeekly,
    achievements, achievementsClaimed, achievementProgress, claimAchievement,
  } = useDaily();
  const [tab, setTab] = useState('daily');
  const [busyId, setBusyId] = useState(null); // évite un double-tap pendant l'écriture AsyncStorage

  // Un seul gestionnaire pour les 3 types : seule la fonction de
  // réclamation change, le reste (verrou anti-double-tap, message) est
  // identique.
  const handleClaim = async (id, claimFn) => {
    setBusyId(id);
    const reward = await claimFn(id);
    setBusyId(null);
    if (reward) {
      Alert.alert('Récompense !', `+${reward} 🐾 Griffes — récupère-les en ouvrant le mode Exploration.`);
    }
  };

  // Abrège les grosses cibles des succès (1000000 -> 1M), sinon le
  // compteur déborde de la barre.
  const formatCount = (n) => {
    if (n >= 1000000) return `${+(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  // Une seule fonction de rendu pour les 3 onglets : les règles
  // d'affichage sont identiques (barre plafonnée à la cible, bouton
  // actif seulement si terminé et pas encore réclamé). Dupliquer aurait
  // garanti que les trois divergent au premier ajustement.
  const renderRow = (key, def, rawProgress, claimed, onClaim) => {
    const progress = Math.min(def.target, Math.floor(rawProgress || 0));
    const done = progress >= def.target;
    const pct = Math.min(100, (progress / def.target) * 100);
    return (
      <View key={key} style={styles.questRow}>
        <View style={styles.questGem}>
          <Text style={styles.questGemIcon}>🐾</Text>
        </View>
        <View style={styles.questMiddle}>
          <Text style={styles.questDesc} numberOfLines={2}>{def.desc}</Text>
          <View style={styles.questBarTrack}>
            <View style={[styles.questBarFill, { width: `${pct}%` }, claimed && { backgroundColor: COLORS.muted }]} />
            <Text style={styles.questBarLabel}>{formatCount(progress)}/{formatCount(def.target)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.questClaimBtn, (!done || claimed) && styles.questClaimBtnDisabled]}
          onPress={onClaim}
          disabled={!done || claimed || busyId === key}
        >
          <Text style={[styles.questClaimBtnText, (!done || claimed) && styles.questClaimBtnTextDisabled]}>
            {claimed ? '✓' : `+${def.reward}`}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDaily = () => (
    <>
      {questIds.map((qid) => {
        const def = questDef(qid);
        if (!def) return null;
        return renderRow(qid, def, questProgress[qid], !!questClaimed[qid], () => handleClaim(qid, claimQuest));
      })}
      <Text style={styles.footnote}>
        Nouvelles quêtes chaque jour à minuit. Récompenses créditées à ta prochaine ouverture du mode Exploration.
      </Text>
    </>
  );

  const renderWeekly = () => (
    <>
      {(weeklyIds || []).map((qid) => {
        const def = weeklyQuestDef(qid);
        if (!def) return null;
        return renderRow(qid, def, weeklyProgress?.[qid], !!weeklyClaimed?.[qid], () => handleClaim(qid, claimWeekly));
      })}
      <Text style={styles.footnote}>
        Objectifs ~6× plus gros que les quotidiens, à faire en 7 jours. Remise à zéro chaque lundi.
      </Text>
    </>
  );

  const renderAchievements = () => (
    <>
      {(achievements || []).map((a) => (
        renderRow(a.id, a, achievementProgress(a.id), !!achievementsClaimed?.[a.id], () => handleClaim(a.id, claimAchievement))
      ))}
      <Text style={styles.footnote}>
        Jalons à vie, réclamables une seule fois. Ils ne sont jamais remis à zéro.
      </Text>
    </>
  );

  // Onglets sans contenu réel pour l'instant. Message explicite plutôt
  // qu'une page vide : on voit que l'onglet marche et ce qu'il attend.
  const renderEmpty = (text) => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  return (
    <View style={styles.backdrop}>
      {/* Zone cliquable DERRIÈRE le panneau : taper à côté ferme le menu.
          Posée en absolu plutôt qu'en parent du panneau, sinon un tap sur
          le panneau lui-même déclencherait aussi la fermeture. */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onBack} />

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Quêtes</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {!loaded
            ? renderEmpty('Chargement…')
            : tab === 'daily'
            ? renderDaily()
            : tab === 'weekly'
            ? renderWeekly()
            : renderAchievements()}
        </ScrollView>

        <View style={styles.tabsRow}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]} numberOfLines={1}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fond assombri : le menu du Clicker reste visible autour du panneau,
  // comme sur la maquette (le menu ne prend plus tout l'écran).
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: COLORS.bg,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.panelLight,
    borderBottomWidth: 2, borderBottomColor: COLORS.border,
  },
  panelTitle: { color: COLORS.text, fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: {
    position: 'absolute', right: 12,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border,
  },
  closeBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '900' },

  body: { flexGrow: 0 },
  bodyContent: { padding: 12 },

  // ---- Rangée de quête : gemme | texte + barre | bouton ----
  questRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.panel,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    padding: 10, marginBottom: 10,
  },
  questGem: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panelLight,
    borderWidth: 1.5, borderColor: COLORS.neonCyan,
    marginRight: 10,
  },
  questGemIcon: { fontSize: 20 },

  questMiddle: { flex: 1 },
  questDesc: { color: COLORS.text, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  questBarTrack: {
    height: 18, borderRadius: 9, backgroundColor: '#0a1a28',
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', justifyContent: 'center',
  },
  questBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.good },
  questBarLabel: {
    color: COLORS.text, fontSize: 10, fontWeight: '900', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 2,
  },

  questClaimBtn: {
    minWidth: 52, marginLeft: 10, paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.action,
  },
  questClaimBtnDisabled: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.border },
  questClaimBtnText: { color: '#241a00', fontSize: 13, fontWeight: '900' },
  questClaimBtnTextDisabled: { color: COLORS.muted },

  footnote: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },

  emptyWrap: { paddingVertical: 40, paddingHorizontal: 16 },
  emptyText: { color: COLORS.muted, fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 20 },

  // ---- Onglets du bas ----
  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: 2, borderTopColor: COLORS.border,
    backgroundColor: COLORS.panelLight,
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 2,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: 'rgba(42,111,150,0.4)',
  },
  tabBtnActive: { backgroundColor: COLORS.panel, borderBottomWidth: 3, borderBottomColor: COLORS.neonCyan },
  tabLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  tabLabelActive: { color: COLORS.neonCyan },
});

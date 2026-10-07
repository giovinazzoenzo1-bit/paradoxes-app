import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, Dimensions } from 'react-native';
import { GrandPanneau, BoutonLarge, largeurInterieure, EffetRecompense, vibrerSucces } from './games/fenetreBois';
import { useSettings } from '../context/SettingsContext';
import { jouerSon } from './games/sonsBoutique';

// 27/09 : Quêtes du thème forêt (pièces Gemini 45-51 de l'auteur, kit partagé
// fenetreBois). Tailles en NOMBRES (règle du 27/09).
const { width: ECRAN_L, height: ECRAN_H } = Dimensions.get('window');
const PANNEAU_L = Math.min(Math.round(ECRAN_L * 0.94), 400);
const PANNEAU_H = Math.round(Math.min(ECRAN_H * 0.78, PANNEAU_L / 0.56));
const INTERIEUR = largeurInterieure(PANNEAU_L);
const LIGNE_H = 84;
const LIGNE_PAD = Math.round(INTERIEUR * 0.06);
const DROITE_L = 88;
const MILIEU_L = INTERIEUR - 2 * LIGNE_PAD - DROITE_L - 8;
const BARRE_H = 18;
const ONGLET_L = Math.floor((INTERIEUR - 8) / 3);
const IMG = {
  planche: require('../../assets/fenetres/planche.png'),
  plancheDoree: require('../../assets/fenetres/planche-doree.png'),
  rail: require('../../assets/fenetres/rail-barre.png'),
  remplissage: require('../../assets/fenetres/remplissage-barre.png'),
  plaque: require('../../assets/fenetres/plaque-recompense.png'),
  pattes: require('../../assets/fenetres/pattes.png'),
  ongletActif: require('../../assets/fenetres/onglet-actif.png'),
  ongletInactif: require('../../assets/fenetres/onglet-inactif.png'),
};
// Taille du libellé d'onglet CALCULÉE pour tenir (le téléphone ne réduit pas).
const tailleOnglet = (t) => Math.max(8, Math.min(13, Math.floor((ONGLET_L * 0.82) / (0.58 * t.length))));
import { useDaily } from '../context/DailyContext';
import { questDef, weeklyQuestDef, achievementTarget, achievementReward, ACHIEVEMENT_MAX_TIER } from '../games/clicker/dailyLogic';
import { COLORS } from './games/clickerTheme';
import { recompenseQuete } from '../games/clicker/combatLogic';

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
  { key: 'daily', label: 'Quotidien' }, // 27/09 : raccourci pour tenir dans l'onglet
  { key: 'weekly', label: 'Hebdomadaire' },
  { key: 'success', label: 'Succès' },
];

export default function ProgresScreen({ onBack }) {
  const {
    loaded, questIds, questProgress, questClaimed, claimQuest,
    weeklyIds, weeklyProgress, weeklyClaimed, claimWeekly,
    achievements, achievementsClaimed, achievementProgress, claimAchievement, lifetimeStats,
  } = useDaily();
  // 26/09 : les quêtes du jour et de la semaine affichent la récompense
  // RÉELLE à ton niveau d'Aventure (la même règle que le versement).
  const niveauAventure = (lifetimeStats || {}).advLevelReached || 1;
  const [tab, setTab] = useState('daily');
  const [effet, setEffet] = useState(null);
  const { vibrations, sons } = useSettings();
  const [busyId, setBusyId] = useState(null); // évite un double-tap pendant l'écriture AsyncStorage

  // Un seul gestionnaire pour les 3 types : seule la fonction de
  // réclamation change, le reste (verrou anti-double-tap, message) est
  // identique.
  const handleClaim = async (id, claimFn) => {
    setBusyId(id);
    const reward = await claimFn(id);
    setBusyId(null);
    if (reward) {
      // 27/09 (demande de l'auteur) : plus de fenêtre blanche — petite
      // vibration + effet doré (la note du bas rappelle l'Exploration).
      vibrerSucces(vibrations);
      jouerSon('recompense', sons !== false);
      const idEffet = Date.now();
      setEffet({ id: idEffet, texte: `+${reward} Griffes`, sousTexte: 'À récupérer en Exploration' });
      setTimeout(() => setEffet((e) => (e && e.id === idEffet ? null : e)), 1400);
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
  const renderRow = (key, def, rawProgress, claimed, onClaim, recompense = null) => {
    const progress = Math.min(def.target, Math.floor(rawProgress || 0));
    const done = progress >= def.target;
    const pct = Math.min(100, (progress / def.target) * 100);
    const gain = recompense != null ? recompense : def.reward;
    const aRecuperer = done && !claimed;
    // 27/09 : planche DORÉE quand la quête est à récupérer ; estompée une fois
    // récupérée. Barre : rail + remplissage doré, largeurs en NOMBRES.
    return (
      <View key={key} style={[styles.ligne, claimed && { opacity: 0.6 }]}>
        <Image source={aRecuperer ? IMG.plancheDoree : IMG.planche} resizeMode="stretch" style={styles.lignePlanche} />
        <View style={styles.ligneMilieu}>
          <Text style={styles.ligneTexte} numberOfLines={2}>{def.desc}</Text>
          <View style={styles.barre}>
            <Image source={IMG.rail} resizeMode="stretch" style={styles.barreRail} />
            {pct > 0 ? (
              <Image source={IMG.remplissage} resizeMode="stretch" style={[styles.barreRemplie, { width: Math.max(8, Math.round((MILIEU_L - 6) * pct / 100)) }]} />
            ) : null}
            <Text style={styles.barreTexte}>{formatCount(progress)}/{formatCount(def.target)}</Text>
          </View>
        </View>
        {aRecuperer ? (
          <BoutonLarge couleur="vert" sansMarge largeur={DROITE_L} hauteur={46} texte="Récupérer" sousTexte={`+${gain} Griffes`} onPress={busyId === key ? null : onClaim} />
        ) : (
          <View style={styles.plaque}>
            <Image source={IMG.plaque} resizeMode="stretch" style={styles.plaqueImage} />
            {claimed ? (
              <Text style={styles.plaqueTexte}>✓</Text>
            ) : (
              <>
                <Image source={IMG.pattes} resizeMode="contain" style={styles.plaquePattes} />
                <Text style={styles.plaqueTexte} numberOfLines={1}>+{gain}</Text>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderDaily = () => (
    <>
      {questIds.map((qid) => {
        const def = questDef(qid);
        if (!def) return null;
        return renderRow(qid, def, questProgress[qid], !!questClaimed[qid], () => handleClaim(qid, claimQuest), recompenseQuete(def.reward, niveauAventure));
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
        return renderRow(qid, def, weeklyProgress?.[qid], !!weeklyClaimed?.[qid], () => handleClaim(qid, claimWeekly), recompenseQuete(def.reward, niveauAventure));
      })}
      <Text style={styles.footnote}>
        Objectifs ~6× plus gros que les quotidiens, à faire en 7 jours. Remise à zéro chaque lundi.
      </Text>
    </>
  );

  const renderAchievements = () => (
    <>
      {(achievements || []).map((a) => {
        // `Number(...) || 0` : une sauvegarde d'avant les paliers
        // stockait un booléen ici, qu'on ignore proprement.
        const claimedTiers = Number(achievementsClaimed?.[a.id]) || 0;
        const maxed = claimedTiers >= ACHIEVEMENT_MAX_TIER;
        const target = achievementTarget(a, claimedTiers);
        const value = achievementProgress(a.id);

        if (maxed) {
          return (
            <View key={a.id} style={[styles.ligne, { opacity: 0.75 }]}>
              <Image source={IMG.planche} resizeMode="stretch" style={styles.lignePlanche} />
              <View style={styles.ligneMilieu}>
                <Text style={styles.ligneTexte} numberOfLines={2}>🏆 {a.desc}</Text>
                <Text style={styles.tierLabel}>Terminé — palier 5/5</Text>
              </View>
              <View style={styles.plaque}>
                <Image source={IMG.plaque} resizeMode="stretch" style={styles.plaqueImage} />
                <Text style={styles.plaqueTexte}>✓</Text>
              </View>
            </View>
          );
        }

        // On réutilise le rendu commun en lui passant une définition
        // construite pour le PALIER COURANT (cible + gain du palier),
        // plutôt que de dupliquer toute la rangée.
        const tierDef = {
          desc: a.desc,
          target,
          reward: achievementReward(claimedTiers),
        };
        return (
          <View key={a.id}>
            <Text style={styles.tierLabel}>Palier {claimedTiers + 1}/{ACHIEVEMENT_MAX_TIER}</Text>
            {renderRow(a.id, tierDef, value, false, () => handleClaim(a.id, claimAchievement))}
          </View>
        );
      })}
      <Text style={styles.footnote}>
        Jalons à vie, en 5 paliers de plus en plus durs. Chaque palier réclamé débloque le suivant.
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

      <GrandPanneau titre="Quêtes" largeur={PANNEAU_L} hauteur={PANNEAU_H} onFermer={onBack}>
        {/* 27/09 : onglets EN HAUT, sous la bannière (maquette validée). */}
        <View style={styles.onglets}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.key} style={styles.onglet} onPress={() => setTab(t.key)}>
              <Image source={tab === t.key ? IMG.ongletActif : IMG.ongletInactif} resizeMode="stretch" style={styles.ongletImage} />
              <Text style={[styles.ongletTexte, { fontSize: tailleOnglet(t.label) }, tab !== t.key && styles.ongletTexteInactif]} numberOfLines={1}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          {!loaded
            ? renderEmpty('Chargement…')
            : tab === 'daily'
            ? renderDaily()
            : tab === 'weekly'
            ? renderWeekly()
            : renderAchievements()}
        </ScrollView>
      </GrandPanneau>
      {effet && <EffetRecompense key={effet.id} texte={effet.texte} sousTexte={effet.sousTexte} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // 27/09 : Quêtes du thème forêt.
  onglets: { width: INTERIEUR, height: 40, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  onglet: { width: ONGLET_L, height: 40, alignItems: 'center', justifyContent: 'center' },
  ongletImage: { position: 'absolute', left: 0, top: 0, width: ONGLET_L, height: 40 },
  ongletTexte: { color: '#fff7e0', fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  ongletTexteInactif: { color: '#d8c7a4' },
  ligne: { width: INTERIEUR, height: LIGNE_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: LIGNE_PAD, marginBottom: 8 },
  lignePlanche: { position: 'absolute', left: 0, top: 0, width: INTERIEUR, height: LIGNE_H },
  ligneMilieu: { width: MILIEU_L, marginRight: 8 },
  ligneTexte: { color: '#fff7e0', fontSize: 13, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  barre: { width: MILIEU_L, height: BARRE_H, marginTop: 6, justifyContent: 'center' },
  barreRail: { position: 'absolute', left: 0, top: 0, width: MILIEU_L, height: BARRE_H },
  barreRemplie: { position: 'absolute', left: 3, top: 3, height: BARRE_H - 6 },
  barreTexte: { color: '#fff', fontSize: 10, fontWeight: '900', textAlign: 'center', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 3 },
  plaque: { width: DROITE_L, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  plaqueImage: { position: 'absolute', left: 0, top: 0, width: DROITE_L, height: 46 },
  plaquePattes: { width: 22, height: 22, marginRight: 4 },
  plaqueTexte: { color: '#ffe6a8', fontSize: 14, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
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

  // `minWidth: 0` : sans ça, Yoga refuse de rétrécir un élément flex
  // sous la largeur de son texte, et l'élément voisin (bouton, valeur)
  // sort de la ligne. Même défaut que les boutons d'achat du Shop.
  questMiddle: { flex: 1, minWidth: 0 },
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
    minWidth: 52, marginLeft: 10, paddingVertical: 10, paddingHorizontal: 8, flexShrink: 0,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.action,
  },
  questClaimBtnDisabled: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.border },
  questClaimBtnText: { color: '#241a00', fontSize: 13, fontWeight: '900' },
  questClaimBtnTextDisabled: { color: COLORS.muted },

  footnote: { color: '#dccbaa', fontSize: 10, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },

  tierLabel: {
    color: '#f0d48a', fontSize: 10, fontWeight: '900',
    marginBottom: 3, marginLeft: 2, letterSpacing: 0.3,
  },
  questRowDone: { opacity: 0.65, borderColor: COLORS.good },

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

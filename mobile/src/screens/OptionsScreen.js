import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../context/CoinsContext';
import { useDaily } from '../context/DailyContext';
import { useSettings } from '../context/SettingsContext';
import { STORAGE_KEY as CLICKER_STORAGE_KEY, BACKUP_KEY, DEV_UNLOCK_ALL_KEY, disableClickerSave } from './games/ClickerScreen';
import { INCUBATOR_STORAGE_KEY } from '../games/clicker/incubatorLogic';
import { DEV_ADD_GRIFFES_KEY, DEV_REFILL_ENERGY_KEY, DEV_RESET_GRIFFES_KEY } from './games/AdventureScreen';
import { CREATURES } from '../games/clicker/clickerLogic';
import { COLORS } from './games/clickerTheme';

// Menu Paramètres — panneau MODAL, même gabarit que le menu Quêtes
// (07/09). Le mode développeur n'est plus affiché en vrac dans la page :
// il est derrière un bouton en bas qui ouvre son PROPRE panneau, pour ne
// pas noyer les vrais réglages sous des outils de test.
//
// Réglages volontairement peu nombreux : on n'affiche QUE ce qui est
// réellement branché (voir SettingsContext.js). Pas de "Son"/"Musique"
// tant qu'aucune lib audio n'est installée.
export default function OptionsScreen({ onBack, onAfterReset, onFullReset }) {
  const { addCoins } = useCoins();
  const { resetLifetimeStats } = useDaily();
  const { vibrations, ambientFx, toggleSetting } = useSettings();
  const [devOpen, setDevOpen] = useState(false);

  // Remise à zéro complète : efface TOUT le stockage local (pièces,
  // sauvegarde du clicker, réglages...) plutôt que d'énumérer chaque clé
  // à la main — plus fiable, et couvre automatiquement tout ajout futur.
  const resetWholeApp = () => {
    Alert.alert(
      "Réinitialiser toute l'appli ?",
      'Ça efface tes pièces, ta progression et tes réglages, sans possibilité de revenir en arrière.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: async () => {
            // Verrou AVANT d'effacer : sans lui, le Clicker (resté monté
            // sous cette surcouche) réécrit son état en mémoire dès la
            // première action, et l'effacement semble sans effet.
            // Verrou AVANT d'effacer : sans lui, le Clicker (resté monté
            // sous cette surcouche) réécrit son état en mémoire dès la
            // première action.
            disableClickerSave();
            const allKeys = await AsyncStorage.getAllKeys();
            if (allKeys.length) await AsyncStorage.multiRemove(allKeys);
            Alert.alert('Fait', "L'appli a été réinitialisée.");
            // Remontage de TOUT l'arbre (contextes compris) et pas
            // seulement du Clicker : pièces, quotidien et réglages
            // vivent au-dessus de l'écran, ils survivaient à
            // l'effacement et réécrivaient leur état. `resetCoins`
            // devient inutile — le contexte se recharge à vide.
            if (onFullReset) onFullReset();
            else if (onAfterReset) onAfterReset();
          },
        },
      ]
    );
  };

  const resetClicker = () => {
    Alert.alert(
      'Réinitialiser Élevage ?',
      'Ça efface tes pièces, ta puissance de tap et toutes tes créatures du jeu Élevage, sans possibilité de revenir en arrière.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            disableClickerSave();
            await AsyncStorage.removeItem(CLICKER_STORAGE_KEY);
            // L'œuf en incubation vit dans SA propre clé : sans cette
            // ligne il survivait à la réinitialisation d'Élevage.
            await AsyncStorage.removeItem(INCUBATOR_STORAGE_KEY);
            // Les compteurs À VIE (niveau d'Aventure atteint, Offrandes,
            // pouvoirs activés, Ascensions...) vivent dans DailyContext,
            // pas dans la sauvegarde du clicker. Sans cette remise à
            // zéro ils survivaient au reset, et les défis qui les lisent
            // restaient validés d'office sur une partie pourtant neuve.
            resetLifetimeStats();
            Alert.alert('Fait', 'Élevage a été réinitialisé.');
            if (onAfterReset) onAfterReset();
          },
        },
      ]
    );
  };

  // Outil de dev : pose un simple DRAPEAU, lu par ClickerScreen à son
  // prochain chargement, qui fait la fusion lui-même dans son état en
  // mémoire (voir DEV_UNLOCK_ALL_KEY dans ClickerScreen.js). L'ancienne
  // version réécrivait directement la sauvegarde principale depuis ici —
  // risque de course/corruption avec l'écran clicker, supprimé.
  const unlockAllCreatures = async () => {
    await AsyncStorage.setItem(DEV_UNLOCK_ALL_KEY, '1');
    Alert.alert('Fait', `Les ${CREATURES.length} créatures ont été ajoutées (celles déjà possédées gardent leur niveau).`);
    // Le drapeau n'est lu qu'au CHARGEMENT du Clicker : sans remontage
    // il ne s'appliquerait qu'au prochain lancement de l'appli. Pas de
    // verrou ici — l'état courant doit bien être sauvegardé avant, c'est
    // sur lui que la fusion se fera.
    if (onAfterReset) onAfterReset();
  };

  // Restaure la sauvegarde de secours (copiée automatiquement par
  // ClickerScreen quand un chargement échoue, avant qu'elle ne soit
  // écrasée) — filet de sécurité contre une « remise à zéro ».
  const restoreBackup = async () => {
    const backup = await AsyncStorage.getItem(BACKUP_KEY);
    if (!backup) {
      Alert.alert('Aucune sauvegarde de secours', "Rien à restaurer pour l'instant.");
      return;
    }
    Alert.alert('Restaurer la sauvegarde de secours ?', "Remplace l'état actuel d'Élevage par la dernière sauvegarde valide connue.", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Restaurer',
        onPress: async () => {
          // Verrou puis remontage : l'écran resté monté écraserait la
          // sauvegarde restaurée par son état en mémoire. Avec ça, plus
          // besoin de relancer l'appli.
          disableClickerSave();
          await AsyncStorage.setItem(CLICKER_STORAGE_KEY, backup);
          Alert.alert('Fait', 'Sauvegarde de secours restaurée.');
          if (onAfterReset) onAfterReset();
        },
      },
    ]);
  };

  // Même schéma que unlockAllCreatures — un drapeau lu par
  // AdventureScreen à son prochain chargement, jamais d'écriture directe
  // dans sa sauvegarde depuis ici.
  const devAddGriffes = async () => {
    await AsyncStorage.setItem(DEV_ADD_GRIFFES_KEY, '1');
    Alert.alert('Fait', "1000 Griffes seront ajoutées à l'ouverture du mode Exploration.");
  };

  const devResetGriffes = async () => {
    await AsyncStorage.setItem(DEV_RESET_GRIFFES_KEY, '1');
    Alert.alert('Fait', "Les Griffes seront remises à 0 à l'ouverture du mode Exploration.");
  };

  const devRefillEnergy = async () => {
    await AsyncStorage.setItem(DEV_REFILL_ENERGY_KEY, '1');
    Alert.alert('Fait', "L'énergie sera remise au max à l'ouverture du mode Exploration.");
  };

  const Toggle = ({ label, hint, value, onPress }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
      </View>
    </TouchableOpacity>
  );

  // ---- Panneau du mode développeur ----
  if (devOpen) {
    return (
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setDevOpen(false)} />
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Mode développeur</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDevOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.devWarning}>Outils de test — ne pas montrer aux joueurs finaux.</Text>

            <TouchableOpacity style={styles.devBtn} onPress={() => addCoins(10)}>
              <Text style={styles.devBtnText}>💎 +10 Diamants</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.devBtn} onPress={unlockAllCreatures}>
              <Text style={styles.devBtnText}>🐾 Débloquer tous les monstres (Élevage)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.devBtn} onPress={restoreBackup}>
              <Text style={styles.devBtnText}>🛟 Restaurer la sauvegarde de secours (Élevage)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.devBtn} onPress={devAddGriffes}>
              <Text style={styles.devBtnText}>🐾 +1000 Griffes (Exploration)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.devBtn} onPress={devResetGriffes}>
              <Text style={styles.devBtnText}>🧹 Remettre les Griffes à 0 (Exploration)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.devBtn} onPress={devRefillEnergy}>
              <Text style={styles.devBtnText}>⚡ Énergie au max (Exploration)</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity style={styles.bottomBtn} onPress={() => setDevOpen(false)}>
            <Text style={styles.bottomBtnText}>← Retour aux paramètres</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---- Panneau des paramètres ----
  return (
    <View style={styles.backdrop}>
      {/* Zone cliquable DERRIÈRE le panneau : taper à côté ferme le menu.
          En absolu plutôt qu'en parent, sinon un tap sur le panneau
          lui-même fermerait aussi. */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onBack} />

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Paramètres</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Jeu</Text>
          <Toggle
            label="Vibrations"
            hint="Courte vibration sur un coup critique"
            value={vibrations}
            onPress={() => toggleSetting('vibrations')}
          />
          <Toggle
            label="Animations d'ambiance"
            hint="Lueur du cadeau qui respire — couper peut aider sur téléphone lent"
            value={ambientFx}
            onPress={() => toggleSetting('ambientFx')}
          />

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Réinitialisation</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={resetClicker}>
            <Text style={styles.dangerBtnText}>🐾 Réinitialiser Élevage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dangerBtn, styles.dangerBtnStrong]} onPress={resetWholeApp}>
            <Text style={styles.dangerBtnText}>🗑️ Réinitialiser toute l'appli</Text>
          </TouchableOpacity>

          <Text style={styles.version}>Paradox — version de test</Text>
        </ScrollView>

        {/* Accès au mode développeur, en bas et visuellement à part : ce
            ne sont pas des réglages de joueur. */}
        <TouchableOpacity style={styles.bottomBtn} onPress={() => setDevOpen(true)}>
          <Text style={styles.bottomBtnText}>🛠️ Mode développeur</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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

  sectionTitle: {
    color: COLORS.muted, fontSize: 11, fontWeight: '900',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },

  // ---- Ligne de réglage avec interrupteur ----
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.panel,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    padding: 12, marginBottom: 10,
  },
  // `minWidth: 0` : sans ça, Yoga refuse de rétrécir un élément flex
  // sous la largeur de son texte, et l'élément voisin (bouton, valeur)
  // sort de la ligne. Même défaut que les boutons d'achat du Shop.
  rowText: { flex: 1, minWidth: 0, marginRight: 10 },
  rowLabel: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  rowHint: { color: COLORS.muted, fontSize: 10, fontWeight: '600', marginTop: 3 },
  // Interrupteur dessiné à la main plutôt que le `Switch` de React
  // Native : celui-ci s'affiche avec les couleurs système et jurerait
  // avec le reste du jeu.
  switchTrack: {
    width: 46, height: 26, borderRadius: 13, flexShrink: 0,
    backgroundColor: '#0a1a28', borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', padding: 2,
  },
  switchTrackOn: { backgroundColor: 'rgba(0,255,163,0.18)', borderColor: COLORS.good },
  switchKnob: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.muted, marginLeft: 0,
  },
  switchKnobOn: { backgroundColor: COLORS.good, marginLeft: 20 },

  dangerBtn: {
    backgroundColor: 'rgba(255,82,82,0.12)',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,82,82,0.4)',
    marginBottom: 10,
  },
  dangerBtnStrong: { backgroundColor: 'rgba(255,82,82,0.22)', borderColor: '#FF5252' },
  dangerBtnText: { color: '#FF5252', fontWeight: '800', fontSize: 14 },

  version: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 10 },

  // ---- Bouton du bas (accès dev / retour) ----
  bottomBtn: {
    paddingVertical: 14, alignItems: 'center',
    borderTopWidth: 2, borderTopColor: COLORS.border,
    backgroundColor: COLORS.panelLight,
  },
  bottomBtnText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },

  devWarning: {
    color: '#FF5252', fontSize: 11, fontWeight: '700',
    textAlign: 'center', marginBottom: 12,
  },
  devBtn: {
    backgroundColor: COLORS.panel,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  devBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
});

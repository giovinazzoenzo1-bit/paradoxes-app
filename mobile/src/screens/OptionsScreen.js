import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CoinBar from '../components/CoinBar';
import { useCoins } from '../context/CoinsContext';
import { STORAGE_KEY as CLICKER_STORAGE_KEY, BACKUP_KEY, DEV_UNLOCK_ALL_KEY } from './games/ClickerScreen';
import { DEV_ADD_GRIFFES_KEY, DEV_REFILL_ENERGY_KEY } from './games/AdventureScreen';
import { CREATURES } from '../games/clicker/clickerLogic';

export default function OptionsScreen() {
  const { addCoins, resetCoins } = useCoins();

  // Remise à zéro complète : efface TOUT le stockage local (pièces, meilleurs
  // scores de chaque jeu, sauvegarde du clicker...) plutôt que d'énumérer
  // chaque clé à la main — plus fiable, et couvre automatiquement tout
  // futur jeu sans qu'il faille penser à mettre cette fonction à jour.
  const resetWholeApp = () => {
    Alert.alert(
      "Réinitialiser toute l'appli ?",
      'Ça efface tes pièces, tes meilleurs scores et toute progression dans tous les jeux, sans possibilité de revenir en arrière.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout effacer',
          style: 'destructive',
          onPress: async () => {
            const allKeys = await AsyncStorage.getAllKeys();
            if (allKeys.length) await AsyncStorage.multiRemove(allKeys);
            await resetCoins(); // remet aussi l'état en mémoire (pas juste le stockage) à 0
            Alert.alert('Fait', "L'appli a été réinitialisée.");
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
            await AsyncStorage.removeItem(CLICKER_STORAGE_KEY);
            Alert.alert('Fait', 'Élevage a été réinitialisé.');
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
    Alert.alert('Fait', `Les ${CREATURES.length} créatures seront ajoutées à l'ouverture d'Élevage (celles déjà possédées gardent leur niveau).`);
  };

  // Restaure la sauvegarde de secours (copiée automatiquement par
  // ClickerScreen quand un chargement échoue, avant qu'elle ne soit
  // écrasée) — filet de sécurité contre une "remise à zéro".
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
          await AsyncStorage.setItem(CLICKER_STORAGE_KEY, backup);
          Alert.alert('Fait', "Relance l'appli complètement pour que ça prenne effet.");
        },
      },
    ]);
  };

  // Outil de dev : même schéma que unlockAllCreatures — pose un drapeau
  // lu par AdventureScreen à son prochain chargement (+1000 Griffes),
  // jamais d'écriture directe dans sa sauvegarde depuis ici.
  const devAddGriffes = async () => {
    await AsyncStorage.setItem(DEV_ADD_GRIFFES_KEY, '1');
    Alert.alert('Fait', "1000 Griffes seront ajoutées à l'ouverture du mode Aventure.");
  };

  // Même schéma — pose un drapeau lu par AdventureScreen à son prochain
  // chargement, qui remet l'énergie au max lui-même.
  const devRefillEnergy = async () => {
    await AsyncStorage.setItem(DEV_REFILL_ENERGY_KEY, '1');
    Alert.alert('Fait', "L'énergie sera remise au max à l'ouverture du mode Aventure.");
  };

  return (
    <View style={styles.container}>
      <CoinBar />
      <View style={styles.content}>
        <Text style={styles.title}>⚙️ Options</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réinitialisation</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={resetClicker}>
            <Text style={styles.dangerBtnText}>🐾 Réinitialiser Élevage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dangerBtn, styles.dangerBtnStrong]} onPress={resetWholeApp}>
            <Text style={styles.dangerBtnText}>🗑️ Réinitialiser toute l'appli</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.devCard}>
          <Text style={styles.devTitle}>🛠️ Mode développeur</Text>
          <Text style={styles.devSubtitle}>Outil de test — ne pas montrer aux joueurs finaux.</Text>
          <TouchableOpacity style={styles.devBtn} onPress={() => addCoins(10)}>
            <Text style={styles.devBtnText}>🪙 +10 pièces</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.devBtn, { marginTop: 8 }]} onPress={unlockAllCreatures}>
            <Text style={styles.devBtnText}>🐾 Débloquer tous les monstres (Élevage)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.devBtn, { marginTop: 8 }]} onPress={restoreBackup}>
            <Text style={styles.devBtnText}>🛟 Restaurer la sauvegarde de secours (Élevage)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.devBtn, { marginTop: 8 }]} onPress={devAddGriffes}>
            <Text style={styles.devBtnText}>🐾 +1000 Griffes (Aventure)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.devBtn, { marginTop: 8 }]} onPress={devRefillEnergy}>
            <Text style={styles.devBtnText}>⚡ Énergie au max (Aventure)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c' },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#eef0f6', marginBottom: 16 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#8d93ab', marginBottom: 10, letterSpacing: 0.5 },
  dangerBtn: {
    backgroundColor: 'rgba(255,82,82,0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.4)',
    marginBottom: 10,
  },
  dangerBtnStrong: { backgroundColor: 'rgba(255,82,82,0.22)', borderColor: '#FF5252' },
  dangerBtnText: { color: '#FF5252', fontWeight: '800', fontSize: 14 },

  devCard: {
    borderWidth: 1,
    borderColor: '#2a2f45',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
  },
  devTitle: { fontSize: 15, fontWeight: '700', color: '#eef0f6', marginBottom: 4 },
  devSubtitle: { fontSize: 12, color: '#8d93ab', marginBottom: 12 },
  devBtn: {
    backgroundColor: '#232840',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  devBtnText: { color: '#eef0f6', fontWeight: '700', fontSize: 14 },
});

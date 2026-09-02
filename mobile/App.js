// Navigation par onglets en état local (pas de react-navigation/gesture-handler/
// screens) : ce groupe de libs causait un blocage indéfini du contexte React sur
// ce build (écran blanc permanent), confirmé par bisection. Solution stable.
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import ErrorBoundary from './src/components/ErrorBoundary';
import { CoinsProvider } from './src/context/CoinsContext';
import { DailyProvider } from './src/context/DailyContext';
import JeuxScreen from './src/screens/JeuxScreen';
import ProgresScreen from './src/screens/ProgresScreen';
import OptionsScreen from './src/screens/OptionsScreen';

const TABS = [
  { key: 'Jeux', icon: '🎮', Component: JeuxScreen },
  { key: 'Progrès', icon: '🏆', Component: ProgresScreen },
  { key: 'Options', icon: '⚙️', Component: OptionsScreen },
];

// Zone sûre gérée ICI, une seule fois, plutôt que dans chaque écran : évite
// le chevauchement avec la barre de statut (haut) et la barre de gestes
// Android (bas) partout dans l'appli, y compris dans les jeux (ex: Morpion).
function AppContent() {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState('Jeux');
  const [gameOpen, setGameOpen] = useState(false); // masque la tab bar quand un jeu est ouvert

  // Barre de navigation/gestes Android masquée pour TOUTE l'appli (plus
  // d'immersion, demande explicite) — plus seulement pendant le billard.
  // 'overlay-swipe' permet quand même de la faire réapparaître brièvement
  // d'un geste bord d'écran si besoin (pas totalement bloquant).
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    }
  }, []);

  const ActiveComponent = TABS.find((t) => t.key === active).Component;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <ActiveComponent onGameOpenChange={setGameOpen} />
      </View>
      {!gameOpen && (
        <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={styles.tabItem}
              onPress={() => setActive(t.key)}
            >
              <Text style={{ fontSize: 18, opacity: active === t.key ? 1 : 0.5 }}>{t.icon}</Text>
              <Text style={[styles.tabLabel, active === t.key && styles.tabLabelActive]}>{t.key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <CoinsProvider>
          <DailyProvider>
            <AppContent />
          </DailyProvider>
        </CoinsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2a2f45',
    backgroundColor: '#1c2032',
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabLabel: { fontSize: 11, color: '#8d93ab', marginTop: 2 },
  tabLabelActive: { color: '#f5b942', fontWeight: '700' },
});

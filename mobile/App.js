// Navigation par onglets en état local (pas de react-navigation/gesture-handler/
// screens) : ce groupe de libs causait un blocage indéfini du contexte React sur
// ce build (écran blanc permanent), confirmé par bisection. Solution stable.
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import { CoinsProvider } from './src/context/CoinsContext';
import JeuxScreen from './src/screens/JeuxScreen';
import ProgresScreen from './src/screens/ProgresScreen';
import OptionsScreen from './src/screens/OptionsScreen';

const TABS = [
  { key: 'Jeux', icon: '🎮', Component: JeuxScreen },
  { key: 'Progrès', icon: '🏆', Component: ProgresScreen },
  { key: 'Options', icon: '⚙️', Component: OptionsScreen },
];

export default function App() {
  const [active, setActive] = useState('Jeux');
  const ActiveComponent = TABS.find((t) => t.key === active).Component;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <CoinsProvider>
          <StatusBar style="light" />
          <View style={styles.container}>
            <ActiveComponent />
            <View style={styles.tabBar}>
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
          </View>
        </CoinsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2a2f45',
    backgroundColor: '#1c2032',
    paddingBottom: 24,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabLabel: { fontSize: 11, color: '#8d93ab', marginTop: 2 },
  tabLabelActive: { color: '#f5b942', fontWeight: '700' },
});

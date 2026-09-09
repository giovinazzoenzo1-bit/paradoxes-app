// L'appli ouvre DIRECTEMENT sur le menu du Clicker (06/09). Les 3 onglets
// (Jeux / Progrès / Options) ont été retirés : Options et Progrès sont
// désormais accessibles depuis le menu du Clicker lui-même (bouton ⚙️ en
// haut à droite, bouton Quêtes sous le cadeau), affichés ici en surcouche.
//
// Historique conservé : la navigation était en état local, PAS avec
// react-navigation/gesture-handler/screens — ce groupe de libs causait un
// blocage indéfini du contexte React sur ce build (écran blanc permanent),
// confirmé par bisection. Ne pas les réintroduire pour recréer des onglets.
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import ErrorBoundary from './src/components/ErrorBoundary';
import { CoinsProvider } from './src/context/CoinsContext';
import { DailyProvider } from './src/context/DailyContext';
import { SettingsProvider } from './src/context/SettingsContext';
import ClickerScreen from './src/screens/games/ClickerScreen';
import ProgresScreen from './src/screens/ProgresScreen';
import OptionsScreen from './src/screens/OptionsScreen';

// Zone sûre gérée ICI, une seule fois, plutôt que dans chaque écran : évite
// le chevauchement avec la barre de statut (haut) et la barre de gestes
// Android (bas) partout dans l'appli, y compris dans les jeux (ex: Morpion).
function AppContent() {
  const insets = useSafeAreaInsets();
  // Surcouches ouvertes depuis le menu du Clicker (bouton ⚙️ en haut à
  // droite, bouton Quêtes sous le cadeau). Elles sont montées ICI et pas
  // dans ClickerScreen : `OptionsScreen` importe déjà des constantes
  // DEPUIS `ClickerScreen`, donc l'inverse créerait un cycle d'imports
  // (valeurs `undefined` au démarrage, panne difficile à diagnostiquer).
  const [overlay, setOverlay] = useState(null); // null | 'options' | 'quests'

  // Barre de navigation/gestes Android masquée pour TOUTE l'appli (plus
  // d'immersion, demande explicite) — plus seulement pendant le billard.
  // 'overlay-swipe' permet quand même de la faire réapparaître brièvement
  // d'un geste bord d'écran si besoin (pas totalement bloquant).
  // Barre de navigation Android masquee.
  //
  // `setBehaviorAsync` a ete RETIREE d'expo-navigation-bar en SDK 57 (le
  // mode edge-to-edge la remplace) : l'appeler donnait
  // « undefined is not a function » et faisait planter le demarrage.
  //
  // Le `.catch()` ne protegeait rien : l'erreur est levee en appelant
  // une valeur undefined, donc AVANT qu'une promesse existe. Seul un
  // test d'existence de la fonction protege reellement d'une API
  // retiree entre deux versions de SDK — d'ou le `typeof` ci-dessous,
  // appliquer aux deux appels pour ne pas retomber dans le meme piege
  // au prochain retrait.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      if (typeof NavigationBar.setVisibilityAsync === 'function') {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      }
    } catch (e) {
      // La barre de navigation est cosmetique : jamais de quoi empecher
      // l'appli de demarrer.
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <ClickerScreen
          onOpenOptions={() => setOverlay('options')}
          onOpenQuests={() => setOverlay('quests')}
        />
      </View>

      {/* Surcouches plein écran, montées au-dessus du Clicker. Elles le
          couvrent entièrement : on ne peut donc pas interagir avec le menu
          par-dessus une surcouche ouverte. */}
      {overlay === 'options' && (
        <View style={styles.overlay}>
          <OptionsScreen onBack={() => setOverlay(null)} />
        </View>
      )}
      {/* Pas de paddingTop ici, contrairement aux Options : le menu
          Quêtes est un panneau centré et son fond assombri doit couvrir
          TOUT l'écran, barre de statut comprise — sinon une bande claire
          reste visible en haut. */}
      {overlay === 'quests' && (
        <View style={styles.overlay}>
          <ProgresScreen onBack={() => setOverlay(null)} />
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
            <SettingsProvider>
              <AppContent />
            </SettingsProvider>
          </DailyProvider>
        </CoinsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  // Pas de couleur de fond ici : chaque surcouche fournit la sienne.
  // OptionsScreen est opaque plein écran (son propre `container`), alors
  // que le menu Quêtes est un panneau modal sur fond assombri qui laisse
  // voir le Clicker autour. Mettre un fond opaque ici annulerait cet
  // effet pour les Quêtes.
  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    zIndex: 50,
  },
  container: { flex: 1, backgroundColor: '#11131c' },
  content: { flex: 1 },
});

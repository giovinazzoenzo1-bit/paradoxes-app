// Doit être la toute première ligne exécutée de l'appli : react-native-gesture-handler
// (dont dépend React Navigation) a besoin d'être initialisé avant tout le reste, sinon
// ça peut planter silencieusement au démarrage sur une vraie build Android (contrairement
// à Expo Go, plus tolérant en développement).
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';

import App from './App';

// Filet de sécurité : affiche toute erreur JS non catchée (avant même le rendu React)
// via une alerte native, plutôt qu'un écran blanc silencieux. Utile tant qu'on n'a pas
// accès facilement aux logs natifs de build.
if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const { Alert } = require('react-native');
      Alert.alert(
        isFatal ? '💥 Erreur fatale' : '⚠️ Erreur',
        String(error?.message || error) + '\n\n' + String(error?.stack || '')
      );
    } catch (e) {
      // ignore
    }
    if (defaultHandler) defaultHandler(error, isFatal);
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

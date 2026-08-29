// VERSION DE TEST TEMPORAIRE — diagnostic écran blanc.
// Pas d'import react-native-gesture-handler ici volontairement, pour isoler
// si c'est ce module qui bloque l'initialisation du contexte React.
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

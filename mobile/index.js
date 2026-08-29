// react-native-gesture-handler retiré volontairement : c'était la cause du bug
// d'écran blanc (blocage indéfini du contexte React sur ce build, confirmé par
// bisection). On n'utilise plus react-navigation, donc plus besoin de ce module.
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);

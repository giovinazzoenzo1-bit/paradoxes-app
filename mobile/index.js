// react-native-gesture-handler retiré volontairement : c'était la cause du bug
// d'écran blanc (blocage indéfini du contexte React sur ce build, confirmé par
// bisection). On n'utilise plus react-navigation, donc plus besoin de ce module.

// Filet de sécurité posé AVANT tout autre import applicatif : affiche via une
// alerte native toute erreur JS non attrapée, y compris celles qui surviennent
// à l'import des modules — donc avant que React ne rende quoi que ce soit.
//
// L'ErrorBoundary de App.js ne couvre QUE les erreurs de rendu React. Une
// erreur au chargement d'un module se produit plus tôt : elle ne l'atteint
// jamais et laisse un écran blanc muet. Ce garde-fou existait en août puis a
// été supprimé par erreur en même temps que gesture-handler, ce qui nous a
// privés du seul moyen de voir ces erreurs sans accès aux logs natifs.
if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const { Alert } = require('react-native');
      Alert.alert(
        isFatal ? '💥 Erreur fatale au démarrage' : '⚠️ Erreur',
        String(error?.message || error) + '\n\n' + String(error?.stack || '')
      );
    } catch (e) {
      // Si même l'alerte échoue, on ne masque pas l'erreur d'origine.
    }
    if (defaultHandler) defaultHandler(error, isFatal);
  });
}

const { registerRootComponent } = require('expo');
const App = require('./App').default;

registerRootComponent(App);

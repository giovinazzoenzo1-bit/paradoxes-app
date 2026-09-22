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
//
// ⚠️⚠️ SIGNALEMENT (21/09). Ce filet mémorise aussi l'erreur, et propose
// au joueur de l'envoyer à l'auteur — qui, avant ça, ne voyait JAMAIS
// les plantages de ses joueurs : l'erreur s'affichait sur leur écran,
// pas chez lui.
//
// ⚠️⚠️ CHAQUE AJOUT VIT DANS SON PROPRE `try`, et tout est chargé À LA
// DEMANDE (`require` dans le gestionnaire), jamais en tête de fichier.
// Ce fichier est le dernier rempart quand tout le reste a planté : si
// un de ses propres imports échouait, il planterait avec le reste et on
// retomberait sur l'écran blanc muet. Quoi qu'il arrive, le
// gestionnaire d'origine (`defaultHandler`) est appelé à la fin.
//
// ⚠️ Sur une erreur FATALE dans une app publiée, le système peut fermer
// l'app avant que le joueur appuie sur « Signaler ». C'est pourquoi
// l'erreur est d'abord MÉMORISÉE : elle sera proposée au prochain
// lancement. La capture fiable des plantages sur le store reste le rôle
// d'un outil dédié (Sentry), prévu au lancement.
if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const message = String(error?.message || error);
    const stack = String(error?.stack || '');
    // 1. Mémoriser, pour la proposer au prochain lancement.
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { DIAGNOSTIC_ERREUR_KEY } = require('./src/games/clicker/diagnostic');
      AsyncStorage.setItem(DIAGNOSTIC_ERREUR_KEY, JSON.stringify({
        message, stack: stack.split('\n').slice(0, 6).join('\n'),
        fatal: !!isFatal, at: Date.now(), proposee: false,
      })).catch(() => {});
    } catch (e) {
      // Mémorisation impossible : on continue, l'alerte reste utile.
    }
    // 2. Afficher, avec de quoi signaler tout de suite.
    try {
      const { Alert, Linking } = require('react-native');
      const boutons = [{ text: 'Fermer', style: 'cancel' }];
      try {
        const D = require('./src/games/clicker/diagnostic');
        const corps = D.construireRapport({
          derniereErreur: { message, stack, fatal: !!isFatal },
        });
        const lien = D.lienMailto(D.sujetRapport([{ code: isFatal ? 'fatale' : 'erreur' }]), corps);
        boutons.push({
          text: '📧 Signaler',
          onPress: () => { try { Linking.openURL(lien).catch(() => {}); } catch (e) { /* rien */ } },
        });
      } catch (e) {
        // Sans le module de diagnostic, l'alerte s'affiche sans bouton.
      }
      Alert.alert(
        isFatal ? '💥 Erreur fatale au démarrage' : '⚠️ Erreur',
        message + '\n\n' + stack,
        boutons
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

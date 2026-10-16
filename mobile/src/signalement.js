// ════════════════════════════════════════════════════════════════════
//  SIGNALEMENT — envoyer le rapport à l'auteur
// ════════════════════════════════════════════════════════════════════
//
// La partie « téléphone » du diagnostic, réduite au strict minimum. Toute
// la logique (détecter, rédiger) vit dans `games/clicker/diagnostic.js`,
// qui est pur et testé dans le bac à sable.
//
// ⚠️⚠️ AUCUN MODULE À INSTALLER. `Linking`, `Share` et `Platform` font
// partie de React Native lui-même : ils sont présents dans Expo Go comme
// dans une app publiée sur le store. Les modules natifs ajoutés ont déjà
// bloqué le démarrage de l'app trois fois — on n'en ajoute pas un de
// plus pour envoyer un mail.
import { Linking, Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lienMailto, construireRapport, sujetRapport, MESURES_JEU_KEY } from './games/clicker/diagnostic';
import { BUILD_SHA, BUILD_TIME } from './version';

export function descriptionAppareil() {
  try {
    return Platform.OS + ' ' + String(Platform.Version);
  } catch (e) {
    return 'inconnu';
  }
}

// Ouvre l'appli mail du joueur, rapport déjà rédigé et adressé.
//
// ⚠️ On ESSAIE d'ouvrir le mail directement, sans demander d'abord
// `Linking.canOpenURL`. Sur Android récent, `canOpenURL('mailto:')`
// répond « non » quand l'appli ne déclare pas le schéma dans son
// manifeste — ce qui est le cas d'Expo Go — alors même qu'une appli
// mail est installée. On aurait refusé d'envoyer à tort.
//
// Sans appli mail, le partage prend le relais : le joueur peut envoyer
// le texte par messagerie, ou le copier.
//
// Rend 'mail', 'partage' ou 'echec'. Ne lève JAMAIS d'exception : un
// signalement qui plante l'écran serait le comble.
export async function envoyerRapport({ instantane, derniereErreur } = {}) {
  const build = { sha: BUILD_SHA, time: BUILD_TIME };
  // 17/10 : mesures de jeu (écrites par l'écran de jeu toutes les 15 s) — jamais bloquant si elles manquent.
  let mesures = null;
  try { mesures = JSON.parse((await AsyncStorage.getItem(MESURES_JEU_KEY)) || 'null'); } catch (e) { mesures = null; }
  const corps = construireRapport({ instantane, derniereErreur, appareil: descriptionAppareil(), build, mesures });
  const sujet = sujetRapport(instantane && instantane.problemes, build);
  try {
    await Linking.openURL(lienMailto(sujet, corps));
    return 'mail';
  } catch (e) {
    try {
      await Share.share({ title: sujet, message: corps });
      return 'partage';
    } catch (e2) {
      return 'echec';
    }
  }
}

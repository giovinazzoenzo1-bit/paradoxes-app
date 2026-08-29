// Geste de retour réutilisable pour tout écran empilé au-dessus des onglets
// (ex: un jeu ouvert depuis JeuxScreen). Pas de react-navigation/gesture-handler
// (retirés définitivement, voir App.js) — implémenté avec PanResponder, qui fait
// partie du cœur de React Native (aucun module natif, ne réintroduit pas le bug
// de blocage). Couvre 2 déclencheurs :
//  1. Swipe : appui près du bord droit de l'écran, glissé vers la gauche.
//  2. Bouton/geste "retour" natif d'Android (BackHandler).
//
// Usage dans un écran avec un onBack :
//   const panHandlers = useBackGesture(onBack);
//   <View {...panHandlers}> ... </View>
import { useEffect, useRef } from 'react';
import { PanResponder, Dimensions, BackHandler } from 'react-native';

const EDGE_ZONE = 48; // largeur de la zone de départ du swipe, depuis le bord droit
const SWIPE_DISTANCE = 60; // distance mini glissée vers la gauche pour valider le retour

export default function useBackGesture(onBack, enabled = true) {
  const { width } = Dimensions.get('window');

  useEffect(() => {
    if (!enabled || !onBack) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, enabled]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (!enabled || !onBack) return false;
        return evt.nativeEvent.pageX > width - EDGE_ZONE;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        if (!enabled || !onBack) return false;
        return evt.nativeEvent.pageX > width - EDGE_ZONE && gestureState.dx < -10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!enabled || !onBack) return;
        if (gestureState.dx < -SWIPE_DISTANCE) onBack();
      },
    })
  ).current;

  return panResponder.panHandlers;
}

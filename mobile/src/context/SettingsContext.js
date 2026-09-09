import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Réglages de l'appli (07/09). Volontairement MINIMAL : on n'expose ici
// que des réglages réellement branchés à quelque chose. Pas de "Son" ni
// de "Musique" tant qu'aucune lib audio n'est installée — un interrupteur
// qui ne fait rien est pire que pas d'interrupteur du tout.
//
// Pour en ajouter un : mettre sa valeur par défaut dans DEFAULTS, puis le
// LIRE quelque part dans le code. Tant qu'il n'est lu nulle part, ne pas
// l'afficher dans l'écran Options.
export const SETTINGS_KEY = 'app:settings:v1';

const DEFAULTS = {
  vibrations: true,   // vibration courte sur coup critique (Clicker)
  ambientFx: true,    // animations d'ambiance (lueur du cadeau qui respire)
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          // Fusion avec DEFAULTS et pas remplacement : une sauvegarde
          // écrite par une version plus ancienne ne connaît pas les
          // réglages ajoutés depuis, qui seraient sinon `undefined`.
          setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
        }
      } catch (e) {
        // Réglages illisibles : on garde les valeurs par défaut plutôt
        // que d'empêcher l'appli de démarrer pour si peu.
      }
      setLoaded(true);
    })();
  }, []);

  // Écriture seulement APRÈS le chargement initial, sinon le premier
  // rendu (valeurs par défaut) écraserait la sauvegarde existante avant
  // même de l'avoir lue.
  const loadedRef = useRef(false);
  loadedRef.current = loaded;
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  const toggleSetting = useCallback((key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <SettingsContext.Provider value={{ ...settings, loaded, toggleSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  // Valeurs de repli : un composant monté hors du provider garde un
  // comportement normal (tout activé) au lieu de planter sur `undefined`.
  return ctx || { ...DEFAULTS, loaded: false, toggleSetting: () => {} };
}

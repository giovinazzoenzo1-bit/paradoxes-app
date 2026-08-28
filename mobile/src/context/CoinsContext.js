import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Port fidèle du système de pièces du PWA (voir index.html: appCoinsAdd/Spend/AddLimited).
// Même logique exacte : plafond de 40 pièces/heure par jeu, fenêtre glissante.
const COIN_RATE_LIMIT_PER_HOUR = 40;

const CoinsContext = createContext(null);

export function CoinsProvider({ children }) {
  const [coins, setCoins] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('appCoins');
      setCoins(stored ? parseInt(stored, 10) : 0);
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (value) => {
    setCoins(value);
    await AsyncStorage.setItem('appCoins', String(value));
  }, []);

  const addCoins = useCallback(async (n) => {
    setCoins((prev) => {
      const next = prev + n;
      AsyncStorage.setItem('appCoins', String(next));
      return next;
    });
  }, []);

  const spendCoins = useCallback(async (n) => {
    let success = false;
    setCoins((prev) => {
      if (prev < n) {
        success = false;
        return prev;
      }
      success = true;
      const next = prev - n;
      AsyncStorage.setItem('appCoins', String(next));
      return next;
    });
    // setState est asynchrone : on relit la valeur fraîche pour renvoyer un résultat fiable
    const fresh = await AsyncStorage.getItem('appCoins');
    return fresh !== null ? true : success;
  }, []);

  // Plafond anti-abus : 40 pièces/heure max par jeu (clé = ex. 'morpion', 'puissance4'...),
  // fenêtre glissante stockée sous 'coinRateLimit:<jeu>'. Retourne le montant réellement accordé.
  const addCoinsLimited = useCallback(async (gameKey, amount) => {
    const key = `coinRateLimit:${gameKey}`;
    const now = Date.now();
    let history = [];
    try {
      const raw = await AsyncStorage.getItem(key);
      history = raw ? JSON.parse(raw) : [];
    } catch (e) {
      history = [];
    }
    history = history.filter((e) => now - e.t < 3600000);
    const earnedThisHour = history.reduce((sum, e) => sum + e.amount, 0);
    const allowance = Math.max(0, COIN_RATE_LIMIT_PER_HOUR - earnedThisHour);
    const toAward = Math.max(0, Math.min(amount, allowance));
    if (toAward > 0) {
      history.push({ t: now, amount: toAward });
      await AsyncStorage.setItem(key, JSON.stringify(history));
      await addCoins(toAward);
    }
    return toAward;
  }, [addCoins]);

  const resetCoins = useCallback(async () => {
    await persist(0);
    const keys = await AsyncStorage.getAllKeys();
    const rateLimitKeys = keys.filter((k) => k.startsWith('coinRateLimit:'));
    if (rateLimitKeys.length) await AsyncStorage.multiRemove(rateLimitKeys);
  }, [persist]);

  return (
    <CoinsContext.Provider value={{ coins, loaded, addCoins, spendCoins, addCoinsLimited, resetCoins }}>
      {children}
    </CoinsContext.Provider>
  );
}

export function useCoins() {
  const ctx = useContext(CoinsContext);
  if (!ctx) throw new Error('useCoins doit être utilisé à l\'intérieur de <CoinsProvider>');
  return ctx;
}

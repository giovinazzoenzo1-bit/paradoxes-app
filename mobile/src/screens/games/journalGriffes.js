// JOURNAL DES GRIFFES (11/10, demande de l'auteur : « ajoute toute information utile pour un tableau Excel ») — chaque
// GAIN et chaque DÉPENSE de Griffes, avec sa SOURCE : prime, defi-jour, defi-semaine, succes, calendrier, shop-pieces,
// shop-diamants, ascension, niveau, evolution, dev. Sert à comparer le jeu réel au calculateur de Griffes (étape par
// étape) et à voir où le joueur manque de Griffes. Jamais bloquant ; 600 dernières lignes.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const JOURNAL_GRIFFES_KEY = 'dev:journalGriffes';
const MAX = 600;
let file = Promise.resolve();

export function noterGriffes(source, montant, details = {}) {
  const m = Math.round(Number(montant) || 0);
  if (!source || !m) return;
  const ligne = { t: Date.now(), source, montant: m, ...(details || {}) };
  // Écritures EN FILE (sinon deux gains rapprochés s'écrasent : lecture-écriture concurrente).
  file = file.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(JOURNAL_GRIFFES_KEY);
      const l = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(JOURNAL_GRIFFES_KEY, JSON.stringify([...(Array.isArray(l) ? l : []), ligne].slice(-MAX)));
    } catch (e) { /* jamais bloquant */ }
  });
}

export async function lireJournalGriffes() {
  try { await file; const raw = await AsyncStorage.getItem(JOURNAL_GRIFFES_KEY); const l = raw ? JSON.parse(raw) : []; return Array.isArray(l) ? l : []; } catch (e) { return []; }
}

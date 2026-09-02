import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey, pickDailyQuests, questDef, nextStreak, streakReward } from '../games/clicker/dailyLogic';

// Clé lue par AdventureScreen.js à son prochain chargement pour créditer
// les récompenses de quêtes/streak — MÊME schéma de sécurité que
// DEV_ADD_GRIFFES_KEY : ce Context ne touche JAMAIS directement à la
// sauvegarde d'Aventure (risque de course déjà rencontré et corrigé une
// fois cette session, pas la peine de le réintroduire ici). On accumule
// un MONTANT (pas juste un booléen comme les drapeaux dev) au cas où
// plusieurs récompenses seraient réclamées avant qu'Aventure ne soit
// rouverte.
export const PENDING_GRIFFES_KEY = 'adventure:pendingGriffesReward';

const STORAGE_KEY = 'daily:state:v1';
const DailyContext = createContext(null);

export function DailyProvider({ children }) {
  const [date, setDate] = useState(null);
  const [questIds, setQuestIds] = useState([]);
  const [questProgress, setQuestProgress] = useState({});
  const [questClaimed, setQuestClaimed] = useState({});
  const [streak, setStreak] = useState(0);
  const [streakClaimedDate, setStreakClaimedDate] = useState(null);
  // Compteurs À VIE (jamais remis à zéro, contrairement aux quêtes
  // quotidiennes ci-dessus) — permet au cycle de quêtes de l'œuf
  // (clicker) d'avoir enfin des quêtes liées à l'Aventure, chose
  // explicitement notée comme "pas encore possible" quand ce pool avait
  // été créé, faute de cette couche de stats partagée entre les deux
  // jeux. Alimentés par le MÊME trackEvent déjà câblé côté Aventure —
  // aucun nouveau point de suivi à ajouter ailleurs dans le code.
  const [lifetimeStats, setLifetimeStats] = useState({});
  const [loaded, setLoaded] = useState(false);

  // Refs pour trackEvent — évite de recréer cette fonction (et donc de
  // casser les callbacks mémoïsés qui la référencent ailleurs) à chaque
  // changement de progression.
  const questIdsRef = useRef([]);
  questIdsRef.current = questIds;
  const questProgressRef = useRef({});
  questProgressRef.current = questProgress;
  const questClaimedRef = useRef({});
  questClaimedRef.current = questClaimed;

  useEffect(() => {
    (async () => {
      const today = todayKey();
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = raw ? JSON.parse(raw) : {};
        const savedDate = saved.date || null;

        if (savedDate !== today) {
          // Nouveau jour (ou première ouverture) : nouveau tirage,
          // progression et réclamations remises à zéro.
          setDate(today);
          setQuestIds(pickDailyQuests(today));
          setQuestProgress({});
          setQuestClaimed({});
        } else {
          setDate(savedDate);
          setQuestIds(saved.questIds && saved.questIds.length ? saved.questIds : pickDailyQuests(today));
          setQuestProgress(saved.questProgress || {});
          setQuestClaimed(saved.questClaimed || {});
        }

        const prevStreak = saved.streak || 0;
        const newStreak = nextStreak(prevStreak, saved.lastLoginDate || null, today);
        setStreak(newStreak);
        setStreakClaimedDate(saved.streakClaimedDate || null);
        setLifetimeStats(saved.lifetimeStats || {});
      } catch (e) {
        setDate(today);
        setQuestIds(pickDailyQuests(today));
        setStreak(1);
      }
      setLoaded(true);
    })();
  }, []);

  // Sauvegarde à chaque changement — `lastLoginDate` toujours écrit comme
  // la date DU JOUR (recalculée ici plutôt que stockée à part), donc pas
  // besoin d'un state séparé pour elle.
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date, questIds, questProgress, questClaimed, streak, lastLoginDate: date, streakClaimedDate, lifetimeStats })
    );
  }, [date, questIds, questProgress, questClaimed, streak, streakClaimedDate, lifetimeStats, loaded]);

  // Appelé par le clicker ET l'aventure quand un événement pertinent se
  // produit (ex: trackEvent('summon', 1)) — ne touche QUE les quêtes du
  // jour dont le type correspond, ignore silencieusement le reste. Une
  // quête déjà réclamée n'accumule plus (pas la peine, mais surtout pas
  // de risque de dépasser la cible si le joueur continue de jouer après
  // avoir réclamé).
  const trackEvent = useCallback((eventType, amount = 1) => {
    // Compteur À VIE — totalement indépendant des quêtes quotidiennes
    // ci-dessous, jamais plafonné ni remis à zéro. C'est CE compteur que
    // le pool de quêtes de l'œuf (clicker) consulte pour ses propres
    // quêtes liées à l'Aventure.
    setLifetimeStats((prev) => ({ ...prev, [eventType]: (prev[eventType] || 0) + amount }));

    setQuestProgress((prev) => {
      let changed = false;
      const next = { ...prev };
      questIdsRef.current.forEach((qid) => {
        const def = questDef(qid);
        if (!def || def.event !== eventType) return;
        if (questClaimedRef.current[qid]) return;
        const current = next[qid] || 0;
        if (current >= def.target) return;
        next[qid] = Math.min(def.target, current + amount);
        changed = true;
      });
      return changed ? next : prev;
    });
  }, []);

  // Réclame la récompense d'UNE quête terminée — crédite via le drapeau
  // partagé (voir PENDING_GRIFFES_KEY plus haut), pas d'accès direct à
  // l'état d'Aventure depuis ce Context.
  const claimQuest = useCallback(async (questId) => {
    const def = questDef(questId);
    if (!def) return false;
    if (questClaimedRef.current[questId]) return false;
    const progress = questProgressRef.current[questId] || 0;
    if (progress < def.target) return false;
    setQuestClaimed((prev) => ({ ...prev, [questId]: true }));
    const raw = await AsyncStorage.getItem(PENDING_GRIFFES_KEY);
    const pending = raw ? parseInt(raw, 10) || 0 : 0;
    await AsyncStorage.setItem(PENDING_GRIFFES_KEY, String(pending + def.reward));
    return def.reward;
  }, []);

  const claimStreak = useCallback(async () => {
    if (streakClaimedDate === date) return false;
    const reward = streakReward(streak);
    setStreakClaimedDate(date);
    const raw = await AsyncStorage.getItem(PENDING_GRIFFES_KEY);
    const pending = raw ? parseInt(raw, 10) || 0 : 0;
    await AsyncStorage.setItem(PENDING_GRIFFES_KEY, String(pending + reward));
    return reward;
  }, [streak, date, streakClaimedDate]);

  const value = {
    loaded, date, questIds, questProgress, questClaimed, streak, streakClaimedDate, lifetimeStats,
    trackEvent, claimQuest, claimStreak,
  };

  return <DailyContext.Provider value={value}>{children}</DailyContext.Provider>;
}

export function useDaily() {
  const ctx = useContext(DailyContext);
  if (!ctx) throw new Error('useDaily doit être utilisé à l\'intérieur de <DailyProvider>');
  return ctx;
}

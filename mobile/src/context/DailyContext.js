import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey, pickDailyQuests, questDef, nextStreak, streakReward, calendarRewardForStreak, calendarDayForStreak, DAILY_CALENDAR } from '../games/clicker/dailyLogic';

// Clé lue par AdventureScreen.js à son prochain chargement pour créditer
// les récompenses de quêtes/streak — MÊME schéma de sécurité que
// DEV_ADD_GRIFFES_KEY : ce Context ne touche JAMAIS directement à la
// sauvegarde d'Aventure (risque de course déjà rencontré et corrigé une
// fois cette session, pas la peine de le réintroduire ici). On accumule
// un MONTANT (pas juste un booléen comme les drapeaux dev) au cas où
// plusieurs récompenses seraient réclamées avant qu'Aventure ne soit
// rouverte.
export const PENDING_GRIFFES_KEY = 'adventure:pendingGriffesReward';
// Creatures offertes par le calendrier de connexion. Le clicker (seul
// proprietaire de la collection) les encaisse a son prochain chargement.
// Valeur stockee : un JSON de tableau de raretes, ex. ["rare"].
export const PENDING_CREATURES_KEY = 'clicker:pendingCalendarCreatures';
// Bons de skin : le systeme de skins n'existe pas encore. On credite un
// compteur pour que la recompense du jour 7 soit reellement acquise et
// echangeable le jour ou les skins seront developpes.
export const PENDING_SKINS_KEY = 'clicker:pendingSkinTickets';

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
  // claimStreak est memoise sur `date` seul : sans ces refs il
  // capturerait le streak et la date de reclamation du premier rendu et
  // distribuerait la recompense du mauvais jour.
  const streakRef = useRef(0);
  streakRef.current = streak;
  const streakClaimedDateRef = useRef(null);
  streakClaimedDateRef.current = streakClaimedDate;

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

  // Variante de trackEvent pour les valeurs qui sont un MAXIMUM et non
  // un cumul : « niveau 12 atteint en Aventure » ne doit pas s'ajouter
  // au précédent, il doit le remplacer s'il est plus haut. Rejouer un
  // niveau déjà battu ne fait donc pas progresser un défi de
  // progression, ce qui est le comportement attendu.
  //
  // C'est aussi le seul chemin propre pour qu'un défi du clicker lise la
  // progression du mode Aventure : celle-ci vit dans une sauvegarde
  // séparée (`adventure:state:v1`), et l'écrire depuis un autre écran a
  // déjà causé une perte de progression (voir les pièges du fichier
  // d'état). Ici l'Aventure PUBLIE sa valeur, le clicker la lit.
  const trackMax = useCallback((eventType, value) => {
    if (!Number.isFinite(value)) return;
    setLifetimeStats((prev) => (
      (prev[eventType] || 0) >= value ? prev : { ...prev, [eventType]: value }
    ));
  }, []);

  // Remet à zéro les compteurs À VIE. Appelé par la réinitialisation
  // d'Élevage.
  //
  // Sans ça, ces compteurs survivaient à toutes les réinitialisations :
  // ils vivent dans la sauvegarde de ce Context, pas dans celle du
  // clicker. Conséquence observée — un joueur ayant battu une fois le
  // niveau 3 en Aventure gardait `advLevelReached >= 3` pour toujours,
  // donc le défi « Termine le chapitre 1, niveau 3 » était validé
  // d'office et n'apparaissait JAMAIS, même sur une partie neuve.
  //
  // On passe par le Context plutôt que d'écrire dans le stockage depuis
  // l'écran Options : c'est la même règle que partout ailleurs, l'écran
  // propriétaire d'une donnée est le seul à l'écrire.
  const resetLifetimeStats = useCallback(() => {
    setLifetimeStats({});
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

  // Reclame la recompense du jour de calendrier courant.
  //
  // Retourne l'entree du calendrier (pour que l'ecran affiche ce qui a
  // ete gagne), ou false si deja reclamee aujourd'hui. Les pieces
  // d'appli sont creditees directement car ce Context y a acces via son
  // parent ; les Griffes, creatures et skins passent par un drapeau,
  // l'ecran proprietaire les encaissant lui-meme.
  const claimStreak = useCallback(async (addAppCoins) => {
    if (streakClaimedDateRef.current === date) return false;
    const entry = calendarRewardForStreak(streakRef.current);
    if (!entry) return false;
    setStreakClaimedDate(date);

    if (entry.type === 'griffes') {
      const raw = await AsyncStorage.getItem(PENDING_GRIFFES_KEY);
      const pending = raw ? parseInt(raw, 10) || 0 : 0;
      await AsyncStorage.setItem(PENDING_GRIFFES_KEY, String(pending + entry.amount));
    } else if (entry.type === 'appCoins') {
      if (typeof addAppCoins === 'function') await addAppCoins(entry.amount);
    } else if (entry.type === 'creature') {
      const raw = await AsyncStorage.getItem(PENDING_CREATURES_KEY);
      let list = [];
      try { list = raw ? JSON.parse(raw) : []; } catch (e) { list = []; }
      if (!Array.isArray(list)) list = [];
      list.push(entry.rarity);
      await AsyncStorage.setItem(PENDING_CREATURES_KEY, JSON.stringify(list));
    } else if (entry.type === 'skin') {
      const raw = await AsyncStorage.getItem(PENDING_SKINS_KEY);
      const pending = raw ? parseInt(raw, 10) || 0 : 0;
      await AsyncStorage.setItem(PENDING_SKINS_KEY, String(pending + entry.amount));
    }
    return entry;
  }, [date]);

  const value = {
    loaded, date, questIds, questProgress, questClaimed, streak, streakClaimedDate, lifetimeStats,
    trackEvent, trackMax, resetLifetimeStats, claimQuest, claimStreak,
    calendarDay: calendarDayForStreak(streak), calendar: DAILY_CALENDAR,
  };

  return <DailyContext.Provider value={value}>{children}</DailyContext.Provider>;
}

export function useDaily() {
  const ctx = useContext(DailyContext);
  if (!ctx) throw new Error('useDaily doit être utilisé à l\'intérieur de <DailyProvider>');
  return ctx;
}

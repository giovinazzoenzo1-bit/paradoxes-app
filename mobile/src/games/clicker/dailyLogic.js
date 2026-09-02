// ---- Quêtes quotidiennes + streak de connexion (30/08) ----
// Logique pure, testable indépendamment de React/AsyncStorage — l'état
// et la persistance vivent dans src/context/DailyContext.js.
//
// Décision de conception (validée avec l'utilisateur avant d'écrire une
// ligne de code) : les quêtes MÉLANGENT clicker et aventure — certaines
// se valident dans l'un, d'autres dans l'autre — pour donner un petit
// coup de pouce à découvrir les deux, sans jamais forcer. Le streak de
// connexion, lui, reste totalement NEUTRE : juste "as-tu ouvert l'appli
// aujourd'hui", peu importe le mode joué.

// Date au format 'YYYY-MM-DD', dans le fuseau LOCAL de l'appareil — pas
// UTC, sinon la "journée" du joueur changerait à une heure absurde selon
// son fuseau plutôt qu'à minuit chez lui.
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Nombre de jours calendaires entre deux clés 'YYYY-MM-DD' (b - a) — via
// de vrais objets Date pour gérer correctement les fins de mois/année.
export function daysBetween(aKey, bKey) {
  const a = new Date(aKey + 'T00:00:00');
  const b = new Date(bKey + 'T00:00:00');
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

// Pool mixte — "event" est la clé que trackEvent() du DailyContext
// reconnaît, câblée depuis ClickerScreen.js ET AdventureScreen.js.
export const DAILY_QUEST_POOL = [
  { id: 'win2battles', desc: 'Gagne 2 combats en Aventure', event: 'battleWon', target: 2, reward: 40 },
  { id: 'equip1rune', desc: 'Équipe 1 rune sur une créature', event: 'runeEquipped', target: 1, reward: 30 },
  { id: 'buyRune1', desc: 'Achète 1 rune', event: 'runeBought', target: 1, reward: 25 },
  { id: 'fuseRune1', desc: 'Fusionne 2 runes en 1', event: 'runeFused', target: 1, reward: 35 },
  { id: 'summon3', desc: 'Invoque 3 créatures (Élevage)', event: 'summon', target: 3, reward: 30 },
  { id: 'crit10', desc: 'Obtiens 10 coups critiques (Élevage)', event: 'crit', target: 10, reward: 30 },
  { id: 'earn2000', desc: 'Gagne 2 000 pièces (Élevage)', event: 'coinsEarned', target: 2000, reward: 30 },
  { id: 'feedCreature1', desc: 'Nourris une créature (Élevage)', event: 'creatureFed', target: 1, reward: 25 },
];

const QUESTS_PER_DAY = 3;

// Tire 3 quêtes du jour, SEEDÉ par la date (pas un vrai Math.random) —
// rouvrir l'appli plusieurs fois le même jour redonne toujours le même
// tirage, pas besoin de le figer/stocker à l'avance pour être cohérent.
export function pickDailyQuests(dateKey) {
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) seed = (seed * 31 + dateKey.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
  };
  const shuffled = [...DAILY_QUEST_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, QUESTS_PER_DAY).map((q) => q.id);
}

export function questDef(questId) {
  return DAILY_QUEST_POOL.find((q) => q.id === questId);
}

// ---- Streak de connexion ----
// 7 paliers, la récompense grandit puis reboucle (jour 8 = comme jour 1).
export const STREAK_REWARDS = [15, 20, 25, 35, 45, 60, 100];

export function streakReward(streakDay) {
  const idx = Math.max(0, (streakDay - 1) % STREAK_REWARDS.length);
  return STREAK_REWARDS[idx];
}

// Nouveau streak à partir de la dernière date de connexion connue :
// +1 si c'était HIER (jour consécutif), remis à 1 si trou d'un jour ou
// plus (ou jamais connecté), INCHANGÉ si déjà comptée aujourd'hui
// (rouvrir l'appli plusieurs fois le même jour ne fait pas grimper le
// streak plusieurs fois).
export function nextStreak(prevStreak, lastLoginKey, todayDateKey) {
  if (!lastLoginKey) return 1;
  const gap = daysBetween(lastLoginKey, todayDateKey);
  if (gap === 0) return prevStreak;
  if (gap === 1) return prevStreak + 1;
  return 1;
}

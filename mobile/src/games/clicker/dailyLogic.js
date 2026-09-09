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

// ---- Quêtes HEBDOMADAIRES (07/09) ----
//
// Même mécanique que les quotidiennes (tirage seedé, progression,
// réclamation) mais sur une clé de SEMAINE, avec des objectifs environ
// 6× plus durs : une semaine compte 7 jours, donc viser ~6× garde le
// même effort quotidien tout en laissant une journée de marge à qui
// rate un jour. Les récompenses suivent la même échelle (~6×), sinon
// il serait toujours plus rentable de ne faire que les quotidiennes.

// Clé de semaine ISO ('YYYY-Www'), en fuseau LOCAL comme todayKey.
// Semaine commençant le LUNDI : `getDay()` renvoie 0 pour dimanche, on
// le ramène à 7 pour que lundi=1 soit bien le début.
export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() === 0 ? 7 : d.getDay();
  // On se place sur le JEUDI de la même semaine : c'est la règle ISO,
  // et c'est ce qui donne le bon numéro d'année pour les semaines à
  // cheval sur deux années (fin décembre / début janvier).
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export const WEEKLY_QUEST_POOL = [
  { id: 'w_win12battles', desc: 'Gagne 12 combats en Aventure', event: 'battleWon', target: 12, reward: 240 },
  { id: 'w_fuseRune6',    desc: 'Fusionne 6 fois des runes',    event: 'runeFused', target: 6,  reward: 210 },
  { id: 'w_equipRune6',   desc: 'Équipe 6 runes',               event: 'runeEquipped', target: 6, reward: 180 },
  { id: 'w_buyRune6',     desc: 'Achète 6 runes',               event: 'runeBought', target: 6,  reward: 150 },
  { id: 'w_summon18',     desc: 'Invoque 18 créatures',         event: 'summon',    target: 18, reward: 180 },
  { id: 'w_crit60',       desc: 'Obtiens 60 coups critiques',   event: 'crit',      target: 60, reward: 180 },
  { id: 'w_earn12000',    desc: 'Gagne 12 000 pièces',          event: 'coinsEarned', target: 12000, reward: 180 },
  { id: 'w_feed6',        desc: 'Nourris 6 fois une créature',  event: 'creatureFed', target: 6, reward: 150 },
  // Ces deux événements sont suivis depuis longtemps mais n'étaient
  // exploités par AUCUNE quête — le plus gros manque du pool actuel.
  { id: 'w_offering3',    desc: 'Fais 3 Offrandes',             event: 'offering',  target: 3,  reward: 200 },
  { id: 'w_power10',      desc: 'Active 10 pouvoirs de créature', event: 'powerActivated', target: 10, reward: 160 },
];

const QUESTS_PER_WEEK = 3;

export function pickWeeklyQuests(wKey) {
  let seed = 0;
  for (let i = 0; i < wKey.length; i++) seed = (seed * 31 + wKey.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
  };
  const shuffled = [...WEEKLY_QUEST_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, QUESTS_PER_WEEK).map((q) => q.id);
}

export function weeklyQuestDef(questId) {
  return WEEKLY_QUEST_POOL.find((q) => q.id === questId);
}

// ---- SUCCÈS (07/09) ----
//
// Objectifs de très long terme, réclamables UNE SEULE FOIS et jamais
// remis à zéro. Ils lisent `lifetimeStats` (compteurs à vie du
// DailyContext), pas la progression du jour : c'est ce qui permet des
// cibles à 4 chiffres sans qu'elles soient hors d'atteinte.
//
// `mode: 'max'` pour les valeurs qui sont un RECORD et non un cumul
// (le niveau atteint en Aventure), alimentées par trackMax.
//
// Volontairement DURS, comme demandé : les paliers sont calés très
// au-dessus des hebdomadaires (ex. 12 combats/semaine -> 500 au total,
// soit environ 10 mois de jeu régulier).
export const ACHIEVEMENTS = [
  { id: 'a_battles500',  desc: 'Gagner 500 combats',              stat: 'battleWon',      target: 500,     reward: 1500 },
  { id: 'a_level50',     desc: 'Atteindre le niveau 50 en Aventure', stat: 'advLevelReached', target: 50,  reward: 2000, mode: 'max' },
  { id: 'a_coins1m',     desc: 'Gagner 1 000 000 de pièces',      stat: 'coinsEarned',    target: 1000000, reward: 1200 },
  { id: 'a_crit5000',    desc: 'Obtenir 5 000 coups critiques',   stat: 'crit',           target: 5000,    reward: 1000 },
  { id: 'a_summon150',   desc: 'Invoquer 150 créatures',          stat: 'summon',         target: 150,     reward: 1000 },
  { id: 'a_fuse75',      desc: 'Fusionner 75 fois des runes',     stat: 'runeFused',      target: 75,      reward: 1200 },
  { id: 'a_ascension10', desc: 'Faire 10 Ascensions',             stat: 'ascension',      target: 10,      reward: 2500 },
  { id: 'a_offering25',  desc: 'Faire 25 Offrandes',              stat: 'offering',       target: 25,      reward: 900 },
  { id: 'a_feed100',     desc: 'Nourrir 100 fois une créature',   stat: 'creatureFed',    target: 100,     reward: 800 },
  { id: 'a_power200',    desc: 'Activer 200 pouvoirs de créature', stat: 'powerActivated', target: 200,    reward: 900 },
];

export function achievementDef(id) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

// ---- Streak de connexion ----
// 7 paliers, la récompense grandit puis reboucle (jour 8 = comme jour 1).
// ---- Calendrier de connexion (7 jours, en boucle) ----
//
// Remplace l'ancien STREAK_REWARDS, qui ne donnait que des Griffes et
// n'etait affiche nulle part. Chaque jour a un TYPE de recompense
// different : l'alternance est ce qui donne envie de revenir, une suite
// de montants croissants du meme lot lasse vite.
//
// Types possibles :
//   griffes   -> credite via PENDING_GRIFFES_KEY (Aventure)
//   appCoins  -> pieces PARTAGEES de l'appli (pas les pieces du clicker)
//   creature  -> une creature garantie, de la rarete indiquee
//   skin      -> systeme de skins pas encore developpe : on credite un
//                BON echangeable, pour que la recompense soit reellement
//                acquise le jour ou les skins existeront. Rien n'est
//                perdu entre-temps.
export const DAILY_CALENDAR = [
  { day: 1, type: 'griffes',  amount: 40,  icon: '🐾', label: '40 Griffes' },
  { day: 2, type: 'appCoins', amount: 25,  icon: '🪙', label: "25 pièces d'appli" },
  { day: 3, type: 'creature', rarity: 'rare', icon: '🥚', label: 'Créature Rare' },
  { day: 4, type: 'griffes',  amount: 80,  icon: '🐾', label: '80 Griffes' },
  { day: 5, type: 'appCoins', amount: 50,  icon: '🪙', label: "50 pièces d'appli" },
  { day: 6, type: 'griffes',  amount: 150, icon: '🐾', label: '150 Griffes' },
  { day: 7, type: 'skin',     amount: 1,   icon: '🎨', label: 'Skin aléatoire' },
];

// Le jour du calendrier (1-7) pour un streak donne. Le streak continue
// de grimper indefiniment (7, 8, 9...), le calendrier boucle.
export function calendarDayForStreak(streakDay) {
  if (!Number.isFinite(streakDay) || streakDay < 1) return 1;
  return ((Math.floor(streakDay) - 1) % DAILY_CALENDAR.length) + 1;
}

export function calendarRewardForStreak(streakDay) {
  return DAILY_CALENDAR[calendarDayForStreak(streakDay) - 1];
}

// Conserve pour compatibilite : d'anciennes sauvegardes et l'ecran
// Progres s'appuient encore dessus.
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

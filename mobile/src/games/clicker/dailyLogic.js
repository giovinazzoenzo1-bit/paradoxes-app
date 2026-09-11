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
  // ---- Incubation (07/09) ----
  // Cibles calées sur le rythme de FIN de partie, pas de début : un œuf
  // prend 10 min à la 1re créature mais 14 h à la 26e (144 œufs/jour
  // possibles au début, 1,7 à la fin). Viser le début rendrait ces défis
  // infaisables les derniers jours.
  { id: 'hatch1', desc: 'Fais éclore 1 œuf', event: 'eggHatched', target: 1, reward: 40 },
  { id: 'hatchVideo2', desc: "Regarde 2 vidéos d'accélération", event: 'hatchVideo', target: 2, reward: 30 },
  { id: 'hatchTap600', desc: "Gagne 600 secondes d'éclosion en tapant", event: 'hatchSecondsSaved', target: 600, reward: 35 },
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

// Objectifs CALIBRÉS SUR MESURE (07/09), pas sur une intuition. Repères
// obtenus en lisant les constantes du jeu :
//  - Énergie : max 5, +1 / 20 min => plafond de 72 combats/jour, mais un
//    joueur régulier (3-5 sessions) en fait 15-25/jour, soit 105-175/sem.
//  - Griffes : ~20 par combat au niveau 10 => ~2800/semaine, donc ~28
//    runes achetables (100 Griffes pièce) si on ne dépense que ça.
//  - Critiques : à 5 taps/s et ~15% de chance, ~2000/jour => ~14 000/sem.
//
// Les cibles visent ~50-60% de ce qu'un joueur régulier produit en une
// semaine : atteignable en 6-7 jours en jouant vraiment, jamais en une
// seule session. L'ancienne version (12 combats, 60 critiques) tombait
// à 7% et 0,4% d'une semaine — d'où le fait qu'elles se validaient
// toutes seules.
export const WEEKLY_QUEST_POOL = [
  { id: 'w_win80battles', desc: 'Gagne 80 combats en Aventure', event: 'battleWon', target: 80, reward: 700 },
  { id: 'w_crit8000',     desc: 'Obtiens 8 000 coups critiques', event: 'crit', target: 8000, reward: 600 },
  { id: 'w_buyRune12',    desc: 'Achète 12 runes',              event: 'runeBought', target: 12, reward: 600 },
  // 4 et non 6 : la fusion exige DEUX runes identiques (même type ET
  // même niveau). Sur ~28 runes tirées au hasard parmi 4 types, on
  // obtient environ 7 paires — viser 6 revenait à exiger 100% de la
  // production hebdomadaire ET une chance parfaite au tirage.
  { id: 'w_fuseRune4',    desc: 'Fusionne 4 fois des runes',    event: 'runeFused', target: 4, reward: 650 },
  { id: 'w_equipRune15',  desc: 'Équipe 15 runes',              event: 'runeEquipped', target: 15, reward: 500 },
  { id: 'w_summon40',     desc: 'Invoque 40 créatures',         event: 'summon', target: 40, reward: 550 },
  { id: 'w_earn250k',     desc: 'Gagne 250 000 pièces',         event: 'coinsEarned', target: 250000, reward: 500 },
  { id: 'w_feed30',       desc: 'Nourris 30 fois une créature', event: 'creatureFed', target: 30, reward: 500 },
  { id: 'w_offering10',   desc: 'Fais 10 Offrandes',            event: 'offering', target: 10, reward: 700 },
  { id: 'w_power60',      desc: 'Active 60 pouvoirs de créature', event: 'powerActivated', target: 60, reward: 550 },
  // 5 œufs et non 30+ : même raison que les quotidiens, c'est le rythme
  // de fin de partie (~1,7 œuf/jour, soit 12/semaine) qui fixe le
  // plafond réaliste, pas celui du début.
  { id: 'w_hatch5',       desc: 'Fais éclore 5 œufs',              event: 'eggHatched', target: 5, reward: 700 },
  { id: 'w_hatchVideo12', desc: "Regarde 12 vidéos d'accélération", event: 'hatchVideo', target: 12, reward: 550 },
  { id: 'w_hatchTap3600', desc: "Gagne 3 600 secondes d'éclosion en tapant", event: 'hatchSecondsSaved', target: 3600, reward: 600 },
];

// 6 par semaine (au lieu de 3) : sur 10 défis disponibles, en tirer 6
// laisse encore de la variété d'une semaine à l'autre tout en donnant
// nettement plus à faire.
const QUESTS_PER_WEEK = 6;

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

// ---- SUCCÈS À PALIERS (07/09) ----
//
// Chaque succès est une FAMILLE de 5 paliers de plus en plus durs, et
// non un objectif isolé. La version précédente mélangeait des exigences
// incohérentes entre elles (« gagner 500 combats » demandait ~10 fois
// plus d'efforts que « atteindre le niveau 50 », alors que les deux
// donnaient une récompense comparable) — corrigé en calant chaque
// famille sur le même rythme de progression.
//
// Pas de succès « gagner des combats » (retiré le 07/09) : il faisait
// doublon avec « atteindre un niveau » tout en récompensant l'inverse.
// Les niveaux déjà battus restent rejouables, donc `battleWon` monte en
// farmant le niveau 1 en boucle — il mesurait le temps passé, pas la
// progression. `advLevelReached` (trackMax) ne peut pas être gonflé
// ainsi et reflète la vraie puissance de l'équipe. NE PAS le remettre.
// `battleWon` reste utilisé par les quotidiens/hebdos, où mesurer
// l'activité du jour ou de la semaine est justement le but.
//
// Repères utilisés (mêmes mesures que pour les hebdos) : ~140 combats,
// ~14 000 critiques et ~2800 Griffes par semaine pour un joueur régulier.
// Palier 1 ≈ premiers jours, palier 5 ≈ plusieurs mois de jeu régulier.
//
// La progression se LIT dans lifetimeStats, jamais stockée en double.
// `mode: 'max'` pour un RECORD et non un cumul (niveau atteint en
// Aventure), alimenté par trackMax.
export const ACHIEVEMENT_TIER_REWARDS = [150, 400, 1000, 2500, 6000];

export const ACHIEVEMENTS = [
  // Les niveaux d'Aventure ne se grindent pas : la puissance adverse
  // grimpe de 6,2% par niveau (composé), donc la difficulté vient du
  // mur de puissance, pas du nombre de combats. Les paliers restent
  // donc bien plus bas que ceux des combats gagnés — c'est voulu.
  { id: 'a_level',   desc: 'Atteindre un niveau en Aventure', stat: 'advLevelReached', mode: 'max', tiers: [10, 20, 35, 50, 75] },
  { id: 'a_crit',    desc: 'Obtenir des coups critiques',  stat: 'crit',            tiers: [2000, 15000, 75000, 300000, 1000000] },
  // Les pièces croissent de façon exponentielle avec la progression :
  // les paliers doivent suivre la même courbe, sinon les trois derniers
  // tomberaient le même jour.
  { id: 'a_coins',   desc: 'Gagner des pièces',            stat: 'coinsEarned',     tiers: [50000, 1000000, 25000000, 500000000, 10000000000] },
  { id: 'a_summon',  desc: 'Invoquer des créatures',       stat: 'summon',          tiers: [10, 50, 150, 400, 1000] },
  { id: 'a_fuse',    desc: 'Fusionner des runes',          stat: 'runeFused',       tiers: [3, 15, 50, 150, 400] },
  { id: 'a_feed',    desc: 'Nourrir des créatures',        stat: 'creatureFed',     tiers: [10, 50, 200, 600, 1500] },
  { id: 'a_power',   desc: 'Activer des pouvoirs',         stat: 'powerActivated',  tiers: [25, 150, 600, 2000, 5000] },
  { id: 'a_offering',desc: 'Faire des Offrandes',          stat: 'offering',        tiers: [3, 15, 50, 150, 400] },
  // L'Ascension remet la progression à zéro : c'est l'acte le plus
  // coûteux du jeu, d'où des paliers très bas comparés au reste.
  { id: 'a_ascension', desc: 'Faire des Ascensions',       stat: 'ascension',       tiers: [1, 3, 8, 20, 50] },
  { id: 'a_hatch',      desc: 'Faire éclore des œufs',            stat: 'eggHatched', tiers: [5, 25, 75, 150, 300] },
  // Plafonné à 5 vidéos par œuf : 1 500 vidéos ≈ 300 œufs, donc ce
  // palier 5 tombe en même temps que celui des éclosions.
  { id: 'a_hatchVideo', desc: "Regarder des vidéos d'accélération", stat: 'hatchVideo', tiers: [10, 50, 200, 600, 1500] },
];

export function achievementDef(id) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

// Cible du palier suivant, ou null si les 5 sont déjà réclamés.
export function achievementTarget(def, tiersClaimed) {
  if (!def || tiersClaimed >= def.tiers.length) return null;
  return def.tiers[tiersClaimed];
}

export function achievementReward(tiersClaimed) {
  return ACHIEVEMENT_TIER_REWARDS[Math.min(ACHIEVEMENT_TIER_REWARDS.length - 1, tiersClaimed)];
}

export const ACHIEVEMENT_MAX_TIER = 5;

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
//   appCoins  -> DIAMANTS, la monnaie premium (pas les pieces du
//                clicker). Le type garde son ancien nom : il sert de
//                cle de sauvegarde, le renommer effacerait les soldes.
//   creature  -> une creature garantie, de la rarete indiquee
//   skin      -> systeme de skins pas encore developpe : on credite un
//                BON echangeable, pour que la recompense soit reellement
//                acquise le jour ou les skins existeront. Rien n'est
//                perdu entre-temps.
export const DAILY_CALENDAR = [
  { day: 1, type: 'griffes',  amount: 40,  icon: '🐾', label: '40 Griffes' },
  { day: 2, type: 'appCoins', amount: 25,  icon: '💎', label: '25 Diamants' },
  { day: 3, type: 'creature', rarity: 'rare', icon: '🥚', label: 'Créature Rare' },
  { day: 4, type: 'griffes',  amount: 80,  icon: '🐾', label: '80 Griffes' },
  { day: 5, type: 'appCoins', amount: 50,  icon: '💎', label: '50 Diamants' },
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

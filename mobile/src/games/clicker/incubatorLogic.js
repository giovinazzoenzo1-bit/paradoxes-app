// Incubation des œufs (07/09) — VERSION 1, pour tester la mécanique.
//
// Volontairement SANS aucune dépendance à React ni à React Native :
// ce fichier doit rester chargeable dans Node pour simuler la courbe de
// durée avant de la figer (règle du projet : mesurer, ne pas estimer).
//
// Règles issues du cahier des charges (voir le document « Paradox —
// Fonctionnalités à venir ») :
//  - la durée grandit avec le NOMBRE DE CRÉATURES POSSÉDÉES : 10 min
//    pour la première, jusqu'à 12-16 h ensuite ;
//  - 1 tap = 1 seconde en moins, forfaitaire ;
//  - 1 vidéo = 20 % de la durée TOTALE en moins (et non un nombre de
//    minutes fixe, qui ne voudrait rien dire à 10 min comme à 14 h) ;
//  - le minuteur tourne appli fermée : tout est basé sur un HORODATAGE
//    de fin, jamais sur un compteur qui décrémente ;
//  - à zéro, PAS d'éclosion automatique : le joueur doit revenir taper.

export const INCUBATOR_STORAGE_KEY = 'clicker:incubator:v1';

export const INCUBATION_BASE_MS = 10 * 60 * 1000;   // 10 min pour la 1re créature
export const INCUBATION_GROWTH = 1.194;             // +19,4 % par créature possédée
export const INCUBATION_MAX_MS = 16 * 3600 * 1000;  // plafond à 16 h
export const TAP_REDUCTION_MS = 1000;               // 1 tap = 1 seconde
export const VIDEO_REDUCTION_RATIO = 0.20;          // 1 vidéo = 20 % du total
export const MAX_VIDEOS_PER_EGG = 5;                // 5 vidéos = 100 % du total retirable

// Durée totale d'incubation pour la PROCHAINE créature, sachant combien
// le joueur en possède déjà. `owned = 0` -> 10 min.
export function incubationDurationMs(creaturesOwned = 0) {
  const n = Math.max(0, Math.floor(creaturesOwned));
  const raw = INCUBATION_BASE_MS * Math.pow(INCUBATION_GROWTH, n);
  return Math.min(INCUBATION_MAX_MS, Math.round(raw));
}

// Crée un œuf en incubation. `endsAt` est un horodatage absolu : c'est
// ce qui fait que le minuteur continue appli fermée, sans aucun code de
// rattrapage au retour.
export function startIncubation(creaturesOwned, now = Date.now()) {
  const totalMs = incubationDurationMs(creaturesOwned);
  return {
    startedAt: now,
    totalMs,
    endsAt: now + totalMs,
    tapsUsed: 0,
    videosUsed: 0,
  };
}

export function remainingMs(egg, now = Date.now()) {
  if (!egg) return 0;
  return Math.max(0, egg.endsAt - now);
}

export function isReady(egg, now = Date.now()) {
  return !!egg && remainingMs(egg, now) <= 0;
}

// Part de l'incubation déjà écoulée, de 0 à 1 — pour la barre de
// progression. Calculée sur le temps RESTANT et non sur le temps passé :
// les réductions (taps, vidéos) doivent faire avancer la barre tout de
// suite, ce qu'un simple `(now - startedAt) / totalMs` ne ferait pas.
export function progressRatio(egg, now = Date.now()) {
  if (!egg || egg.totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingMs(egg, now) / egg.totalMs));
}

// Un tap retire 1 seconde. Ne descend jamais sous `now` : sans ce
// plancher, taper sur un œuf déjà prêt enverrait `endsAt` loin dans le
// passé et fausserait la barre de progression.
export function applyTap(egg, now = Date.now()) {
  if (!egg) return egg;
  return {
    ...egg,
    endsAt: Math.max(now, egg.endsAt - TAP_REDUCTION_MS),
    tapsUsed: (egg.tapsUsed || 0) + 1,
  };
}

export function canWatchVideo(egg) {
  return !!egg && (egg.videosUsed || 0) < MAX_VIDEOS_PER_EGG;
}

export function applyVideo(egg, now = Date.now()) {
  if (!egg || !canWatchVideo(egg)) return egg;
  return {
    ...egg,
    endsAt: Math.max(now, egg.endsAt - egg.totalMs * VIDEO_REDUCTION_RATIO),
    videosUsed: (egg.videosUsed || 0) + 1,
  };
}

// ---- Gardien d'œuf (07/09) ----
//
// À la fin du minuteur, un gardien apparaît : il faut le battre pour que
// l'œuf éclose. Le combat réutilise le moteur de l'Aventure (3v3).

// Pas de gardien sur le PREMIER œuf : le joueur n'a encore aucune
// créature, il ne pourrait pas combattre. Le gardien démarre donc au 2e
// œuf, c'est-à-dire dès que la collection contient au moins 1 créature.
export const GUARDIAN_FIRST_EGG = 2;

export function guardianRequired(creaturesOwned) {
  return (creaturesOwned || 0) >= GUARDIAN_FIRST_EGG - 1;
}

// Niveau d'Aventure équivalent du gardien, à partir du numéro de l'œuf
// (= créatures possédées + 1). Courbe FIXE, jamais calée sur le deck du
// joueur : sinon monter son équipe ne servirait à rien pour éclore, et
// il suffirait d'équiper son deck le plus faible au moment du
// déclenchement pour obtenir un gardien facile.
//
// Progression volontairement LENTE (œuf 2 → niveau 3, œuf 26 → niveau 15)
// et non 1 pour 1. Raison mesurée : la difficulté de l'Aventure est déjà
// déséquilibrée en haut de courbe — ratio puissance adverse/joueur de 1,0
// aux niveaux 1-10, mais 2,3 au niveau 15 et 4,9 au niveau 25. Un gardien
// « niveau 26 » serait infaisable. Rester dans la plage 3-15 garde des
// combats tenables.
//
// ⚠️ À revoir quand l'équilibrage des combats d'Aventure sera corrigé :
// cette courbe compense un défaut qui n'a pas vocation à rester.
export const GUARDIAN_BASE_LEVEL = 3;
export const GUARDIAN_LEVEL_PER_EGG = 0.5;
export function guardianLevelForEgg(eggNumber) {
  const n = Math.max(GUARDIAN_FIRST_EGG, Math.floor(eggNumber || 0));
  return Math.max(1, Math.round(GUARDIAN_BASE_LEVEL + (n - GUARDIAN_FIRST_EGG) * GUARDIAN_LEVEL_PER_EGG));
}

// Défaite : l'œuf n'est JAMAIS perdu, seule une attente est imposée.
// La sanction est le temps, pas la perte — perdre un œuf après des
// heures d'incubation ferait désinstaller.
export const GUARDIAN_RETRY_DELAY_MS = 10 * 60 * 1000; // 10 min

export function applyGuardianDefeat(egg, now = Date.now()) {
  if (!egg) return egg;
  return { ...egg, retryAt: now + GUARDIAN_RETRY_DELAY_MS };
}

// Le gardien est affrontable si l'œuf est prêt ET que l'attente after
// défaite est écoulée.
export function guardianReady(egg, now = Date.now()) {
  if (!egg || !isReady(egg, now)) return false;
  return !egg.retryAt || egg.retryAt <= now;
}

export function guardianRetryRemainingMs(egg, now = Date.now()) {
  if (!egg || !egg.retryAt) return 0;
  return Math.max(0, egg.retryAt - now);
}

// Formatage court du temps restant : « 3 h 12 », « 12 min 04 », « 43 s ».
export function formatRemaining(ms) {
  if (ms <= 0) return 'Prêt !';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')}`;
  return `${s} s`;
}

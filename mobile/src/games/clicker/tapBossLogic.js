// Boss de tap (11/09) — apparaît au hasard pendant que le joueur est
// actif sur le Clicker. Le taper 200 fois le vainc ; plus c'est rapide,
// plus la récompense en Diamants est grosse.
//
// Sans aucune dépendance à React : ce fichier doit rester chargeable
// dans Node pour vérifier les cadences et le plafond par simulation
// avant de figer les valeurs.

export const TAP_BOSS_STORAGE_KEY = 'clicker:tapBoss:v1';

export const TAP_BOSS_TAPS_REQUIRED = 200;
export const TAP_BOSS_TIME_LIMIT_MS = 60 * 1000;

// Apparition : mesurée en JEU ACTIF (pas en temps réel — sinon le boss
// surgirait appli fermée et serait raté d'office).
//
// Le PREMIER boss d'une session arrive vite, les suivants demandent une
// vraie session. Avant, il fallait 20 à 30 minutes d'affilée : un joueur
// qui fait des sessions de 10 minutes ne voyait donc JAMAIS de boss, et
// n'avait aucun moyen d'obtenir des Diamants.
export const TAP_BOSS_FIRST_GAP_MS = 2 * 60 * 1000;
export const TAP_BOSS_NEXT_GAP_MS = 20 * 60 * 1000;

// ⚠️ GARDE-FOU ANTI-ABUS, en temps RÉEL cette fois : au plus 2 boss par
// heure glissante.
//
// Le compteur de jeu actif repart à zéro à chaque ouverture de l'appli.
// Sans ce plafond, il suffirait de fermer et rouvrir toutes les 2
// minutes pour enchaîner les boss et vider le plafond quotidien de
// Diamants en quelques minutes.
//
// Les horodatages sont SAUVEGARDÉS : fermer/rouvrir ne les efface pas,
// c'est tout l'intérêt.
export const TAP_BOSS_MAX_PER_HOUR = 2;
export const TAP_BOSS_HOUR_MS = 60 * 60 * 1000;

// Ne garde que les apparitions de la dernière heure. Sert aussi à borner
// la taille de ce qu'on sauvegarde.
export function recentSpawns(spawnAts, now) {
  return (spawnAts || []).filter((t) => now - t < TAP_BOSS_HOUR_MS);
}

// Le boss peut-il apparaître ? Les DEUX conditions doivent être
// remplies : assez de jeu actif, ET le quota horaire non atteint.
export function canSpawnBoss({ activeMs, gapMs, spawnAts, now }) {
  if (activeMs < gapMs) return false;
  return recentSpawns(spawnAts, now).length < TAP_BOSS_MAX_PER_HOUR;
}

// Délai avant la PROCHAINE apparition : court pour la première d'une
// session, long ensuite.
export function nextSpawnGapMs(isFirst = false) {
  return isFirst ? TAP_BOSS_FIRST_GAP_MS : TAP_BOSS_NEXT_GAP_MS;
}

// Plafond quotidien de Diamants, toutes sources de boss confondues.
//
// En DIAMANTS et non en nombre de boss, décision prise après
// comparaison : avec un plafond de 7 boss, un joueur maladroit qui ne
// fait qu'1 💎 par boss reste bloqué à 7 et ne peut JAMAIS atteindre le
// maximum. Avec un plafond de 21 💎, tout le monde peut l'atteindre —
// l'habileté ne détermine plus *si* on y arrive mais *en combien de
// temps*. Et la boutique peut être calée sur un maximum ferme et
// identique pour tous (21/jour, ~630/mois).
export const TAP_BOSS_DAILY_DIAMOND_CAP = 21;

export const TAP_BOSS_TIERS = [
  { maxMs: 30 * 1000, diamonds: 3 },
  { maxMs: 45 * 1000, diamonds: 2 },
  { maxMs: 60 * 1000, diamonds: 1 },
];

export function diamondsForDuration(ms) {
  for (const tier of TAP_BOSS_TIERS) {
    if (ms <= tier.maxMs) return tier.diamonds;
  }
  return 0;
}

// Délai avant la prochaine apparition, tiré au hasard dans la plage.

// Diamants réellement crédités, une fois le plafond du jour appliqué.
export function grantableDiamonds(earned, alreadyToday) {
  const left = Math.max(0, TAP_BOSS_DAILY_DIAMOND_CAP - (alreadyToday || 0));
  return Math.min(earned, left);
}

// ---- Détection de cadence anormale ----
//
// Pose un simple DRAPEAU, ne sanctionne rien. Décidé ainsi car
// aujourd'hui aucune donnée ne remonte (pas de serveur) : le jour où une
// sanction sera choisie, il faut que la donnée existe déjà, sinon il
// faudra une mise à jour PLUS plusieurs jours de collecte avant de
// pouvoir agir.
//
// Un humain ne tape jamais à intervalles réguliers ; un autoclicker
// produit une régularité mathématique. On mesure donc la dispersion
// relative des intervalles (écart-type / moyenne).
export const TAP_RHYTHM_SUSPICIOUS_CV = 0.06;

export function tapRhythmCoefficient(intervals) {
  if (!intervals || intervals.length < 20) return null;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean <= 0) return null;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  return Math.sqrt(variance) / mean;
}

export function isRhythmSuspicious(intervals) {
  const cv = tapRhythmCoefficient(intervals);
  return cv !== null && cv < TAP_RHYTHM_SUSPICIOUS_CV;
}

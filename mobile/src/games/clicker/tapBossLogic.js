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

// Apparition : entre 20 et 30 minutes de JEU ACTIF (pas de temps réel —
// sinon le boss surgirait pendant que l'appli est fermée et serait raté).
export const TAP_BOSS_MIN_GAP_MS = 20 * 60 * 1000;
export const TAP_BOSS_MAX_GAP_MS = 30 * 60 * 1000;

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

// Paliers de récompense, à la VITESSE et non au nombre de taps : une
// seule cible (200) avec un bonus de rapidité se lit d'un coup d'œil,
// là où trois cibles différentes demandent de réfléchir.
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
export function nextSpawnGapMs(rand = Math.random) {
  return TAP_BOSS_MIN_GAP_MS + rand() * (TAP_BOSS_MAX_GAP_MS - TAP_BOSS_MIN_GAP_MS);
}

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

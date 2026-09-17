// Défis (quêtes) et paliers de l'œuf.
//
// Extrait de `clickerLogic.js` le 14/09 : ces ~700 lignes n'avaient rien
// à faire dans le fichier de logique du clicker, et s'y perdaient.
//
// Dépendance à SENS UNIQUE : ce fichier importe clickerLogic, jamais
// l'inverse. Vérifié : aucun symbole d'ici n'est utilisé par
// clickerLogic, donc pas de cycle d'imports.
import {
  AUTOCLICKERS,
  SANCTUARY_MAX_LEVEL,
  UPGRADE_ITEMS,
  VEILLEUR_MAX_LEVEL,
  autoClickerCost,
  coreUpgradeUnlocked,
  critChance,
  critUpgradeCost,
  normalizeTapUpgrades,
  normalizeUpgradeLevels,
  sanctuaryUpgradeCost,
  summonCost,
  tapPowerCost,
  upgradeItemCost,
  veilleurUpgradeCost,
} from './clickerLogic';


// ---- Système de quêtes + œuf à 4 paliers ----
// Première passe volontairement limitée aux quêtes réalisables DANS le
// clicker (internes + compétence/timing) — les quêtes liées aux autres
// jeux de l'appli (ex: "gagner 5 fois à Puissance 4") demandent une
// couche de stats partagées entre jeux qui n'existe pas encore ; à
// construire séparément avant de les ajouter à ce pool.
// ---- Séquence de démarrage (défis fixes) ----
//
// Les premiers cycles d'œuf ne sont PAS tirés au hasard : ils suivent une
// progression écrite à la main, qui sert de fil conducteur au début de
// partie. Elle enseigne les mécaniques dans l'ordre (tap → Pacte →
// Transe → cible dorée → critiques → Offrande → Aventure → auto-clics →
// pouvoirs → Sanctuaire → Veilleur → Ascension).
//
// Cibles ÉCRITES EN DUR ici, contrairement au pool dynamique : au tout
// début de partie le revenu du joueur est trop faible et trop instable
// pour qu'une cible calculée en « minutes de farm » ait du sens, et on
// veut surtout que tous les joueurs vivent exactement la même montée.
// Une fois la séquence terminée, le jeu bascule automatiquement sur le
// pool dynamique (voir `pickQuestSet`), qui lui s'adapte au revenu.
//
// Le nombre de défis par cycle est VARIABLE (4 ou 5) : l'œuf éclot quand
// tous ceux du cycle en cours sont validés, pas à un compte fixe.
//
// Un niveau d'Aventure est exprimé en niveau GLOBAL : 10 niveaux par
// chapitre (`LEVELS_PER_CHAPTER`), donc chapitre 2 niveau 5 = niveau 15.
export const QUEST_SEQUENCE = [
  // --- Cycle 1 : les bases du clicker ---
  [
    { id: 'seq_earn10k', icon: '💰', metric: 'totalEarned', effortMin: 12, mode: 'delta',
      label: (t) => `Obtiens ${fmtQ(t)} pièces` },
    { id: 'seq_pacte15', icon: '🔗', metric: 'tapPower', effortMin: 20, mode: 'absolute',
      label: (t) => `Monte Pacte au niveau ${t}` },
    { id: 'seq_transe30', icon: '🔥', metric: 'maxTranseHoldSec', target: 42, mode: 'absolute',
      label: () => 'Reste en Transe x2,5 pendant 42 secondes' },
    { id: 'seq_golden3', icon: '⭐', metric: 'goldenClaimed', target: 4, mode: 'delta',
      label: (t) => `Touche ${t} fois la cible dorée` },
  ],
  // --- Cycle 2 : critiques, Offrande, premier combat ---
  [
    { id: 'seq_crit20', icon: '💥', metric: 'totalCrits', target: 28, mode: 'delta',
      label: (t) => `Obtiens ${t} coups critiques` },
    { id: 'seq_offering2', icon: '💎', metric: 'offering', target: 1, mode: 'delta',
      label: () => 'Fais 1 Offrande' },
    { id: 'seq_adv_c1l1', icon: '⚔️', metric: 'advLevelReached', target: 3, mode: 'absolute',
      label: () => 'Termine le chapitre 1, niveau 3' },
    { id: 'seq_esprit10', icon: '👻', metric: 'auto:esprit', effortMin: 20, mode: 'absolute',
      label: (t) => `Possède ${t} Esprits Vagabonds` },
  ],
  // --- Cycle 3 : pouvoirs, Sanctuaire, revenu passif (5 défis) ---
  [
    // Ramené de 7 à 5 (14/09) : trop long pour ce moment du cycle.
    { id: 'seq_power5', icon: '✨', metric: 'powerActivated', target: 5, mode: 'delta',
      label: (t) => `Active ${t} fois un pouvoir de créature` },
    { id: 'seq_adv_c1l10', icon: '⚔️', metric: 'advLevelReached', target: 10, mode: 'absolute',
      label: () => 'Termine le chapitre 1, niveau 10' },
    { id: 'seq_sanct10', icon: '🏛️', metric: 'sanctuaryLevel', effortMin: 25, mode: 'absolute',
      label: (t) => `Monte le Sanctuaire au niveau ${t}` },
    // Ramené de 140 000 à 100 000 (14/09) : trop élevé pour le niveau
    // réel du joueur à ce stade du cycle.
    { id: 'seq_hold100k', icon: '🏦', metric: 'coins', effortMin: 30, mode: 'absolute',
      label: (t) => `Accumule ${fmtQ(t)} pièces en réserve` },
    { id: 'seq_passive50', icon: '📈', metric: 'passiveIncome', effortMin: 25, mode: 'absolute',
      label: (t) => `Atteins ${fmtQ(t)} pièces par seconde` },
  ],
  // --- Cycle 4 : montée en puissance ---
  [
    { id: 'seq_golden6', icon: '⭐', metric: 'goldenClaimed', target: 5, mode: 'delta',
      label: (t) => `Touche ${t} fois la cible dorée` },
    { id: 'seq_veilleur10', icon: '🌙', metric: 'veilleurLevel', effortMin: 25, mode: 'absolute',
      label: (t) => `Monte le Veilleur au niveau ${t}` },
    { id: 'seq_crit40', icon: '💥', metric: 'totalCrits', target: 56, mode: 'delta',
      label: (t) => `Obtiens ${t} coups critiques` },
    { id: 'seq_adv_c2l5', icon: '⚔️', metric: 'advLevelReached', target: 15, mode: 'absolute',
      label: () => 'Termine le chapitre 2, niveau 5' },
  ],
  // --- Cycle 5 : première Ascension, et découverte des Runes ---
  [
    // ⚠️ Placé au CINQUIÈME cycle, donc après la 4e éclosion : avant, le
    // joueur n'a ni Griffes ni créatures à équiper, et une rune ne lui
    // servirait à rien.
    //
    // ⚠️ Ce cycle compte 5 défis et non 4 : celui-ci est un défi EN PLUS,
    // pas un remplacement. Il se valide avec le TIRAGE GRATUIT offert à
    // l'arrivée du cycle (voir PENDING_FREE_RUNE_KEY) — le joueur n'a
    // donc rien à dépenser pour découvrir les Runes, il lui suffit
    // d'utiliser son tirage.
    { id: 'seq_firstrune', icon: '🔮', metric: 'runeBought', target: 1, mode: 'delta',
      label: () => 'Achète une Rune et équipe-la' },
    { id: 'seq_offering5', icon: '💎', metric: 'offering', target: 2, mode: 'delta',
      label: () => 'Fais 2 Offrandes' },
    { id: 'seq_griffe5', icon: '🔥', metric: 'upgrade:griffeBraisillon', effortMin: 25, mode: 'absolute',
      label: (t) => `Monte Griffe de Braisillon au niveau ${t}` },
    // ⚠️ Remplace l'ancien « chapitre 2, niveau 10 » : le cycle
    // PRÉCÉDENT demandait déjà « chapitre 2, niveau 5 ». Deux défis
    // d'Aventure dans le même chapitre à un cycle d'écart se lisaient
    // comme le même défi répété. On varie de famille.
    { id: 'seq_transe60', icon: '🔥', metric: 'maxTranseHoldSec', target: 60, mode: 'absolute',
      label: (t) => `Tiens la Transe pendant ${t} secondes` },
    { id: 'seq_ascend1', icon: '🌟', metric: 'ascension', target: 1, mode: 'delta',
      label: () => "Fais l'Ascension" },
  ],
  // --- Cycle 6 : relance après Ascension ---
  [
    { id: 'seq_earn100k', icon: '💰', metric: 'totalEarned', effortMin: 30, mode: 'delta',
      label: (t) => `Obtiens ${fmtQ(t)} pièces` },
    { id: 'seq_pacte20', icon: '🔗', metric: 'tapPower', effortMin: 30, mode: 'absolute',
      label: (t) => `Monte Pacte au niveau ${t}` },
    { id: 'seq_rune1', icon: '🛒', metric: 'runeBought', target: 1, mode: 'delta',
      label: () => 'Achète 1 rune en Exploration' },
    { id: 'seq_adv_c3l5', icon: '⚔️', metric: 'advLevelReached', target: 25, mode: 'absolute',
      label: () => 'Termine le chapitre 3, niveau 5' },
  ],
  // --- Cycle 7 : runes et évolution ---
  [
    // Cible ramenée de 3 à 2, et métrique changée : `runeEquipped`
    // comptait les GESTES (glitchable en déséquipant/rééquipant),
    // `runesEquipped` compte les runes réellement en place.
    { id: 'seq_equipRune2', icon: '🪬', metric: 'runesEquipped', target: 2, mode: 'absolute',
      label: (t) => `Équipe ${t} runes sur tes créatures` },
    // Remplacé : le Sanctuaire est plafonné à 10, « niveau 15 » était
    // devenu littéralement impossible et bloquait l'œuf pour toujours.
    { id: 'seq_sanct15', icon: '✊', metric: 'tapUpgrade:tap1', effortMin: 25, mode: 'absolute',
      label: () => 'Débloque la Poigne Ancienne' },
    { id: 'seq_hold1M', icon: '🏦', metric: 'coins', effortMin: 35, mode: 'absolute',
      label: (t) => `Accumule ${fmtQ(t)} pièces en réserve` },
    { id: 'seq_evolve1', icon: '🧬', metric: 'maxEvolutionTier', target: 1, mode: 'absolute',
      label: () => 'Fais évoluer une créature au palier 1' },
  ],
  // --- Cycle 8 : rythme ---
  [
    { id: 'seq_power10', icon: '✨', metric: 'powerActivated', target: 10, mode: 'delta',
      label: (t) => `Active ${t} fois un pouvoir de créature` },
    { id: 'seq_main10', icon: '🖐️', metric: 'auto:main', effortMin: 30, mode: 'absolute',
      label: (t) => `Possède ${t} Mains Spectrales` },
    { id: 'seq_adv_c3l10', icon: '⚔️', metric: 'advLevelReached', target: 30, mode: 'absolute',
      label: () => 'Termine le chapitre 3, niveau 10' },
    { id: 'seq_crit100', icon: '💥', metric: 'totalCrits', target: 140, mode: 'delta',
      label: (t) => `Obtiens ${t} coups critiques` },
  ],
  // --- Cycle 9 : profondeur ---
  [
    { id: 'seq_hold10M', icon: '🏦', metric: 'coins', effortMin: 40, mode: 'absolute',
      label: (t) => `Accumule ${fmtQ(t)} pièces en réserve` },
    { id: 'seq_croc10', icon: '🪨', metric: 'upgrade:crocBouldog', effortMin: 30, mode: 'absolute',
      label: (t) => `Monte Croc de Bouldog au niveau ${t}` },
    { id: 'seq_fuse2', icon: '🔮', metric: 'runeFused', target: 3, mode: 'delta',
      label: () => 'Fusionne 3 runes' },
    { id: 'seq_adv_c4l10', icon: '⚔️', metric: 'advLevelReached', target: 40, mode: 'absolute',
      label: () => 'Termine le chapitre 4, niveau 10' },
  ],
  // --- Cycle 10 : seconde Ascension, dernier cycle scripté ---
  [
    { id: 'seq_hold50M', icon: '🏦', metric: 'coins', effortMin: 40, mode: 'absolute',
      label: (t) => `Accumule ${fmtQ(t)} pièces en réserve` },
    // Remplacé pour la même raison : le Veilleur est plafonné à 10.
    { id: 'seq_veilleur20', icon: '🪄', metric: 'tapUpgrade:tap2', effortMin: 30, mode: 'absolute',
      label: () => 'Débloque le Gantelet Runique' },
    { id: 'seq_feed30', icon: '🍖', metric: 'maxCreatureLevel', effortMin: 35, mode: 'absolute',
      label: (t) => `Monte une créature au niveau ${t}` },
    { id: 'seq_ascend2', icon: '🌟', metric: 'ascension', target: 2, mode: 'delta',
      label: () => 'Fais une seconde Ascension' },
  ],
];

// Tous les défis scriptés à plat, pour que questProgress/questDetail les
// retrouvent par id exactement comme ceux du pool dynamique.
export const SEQUENCE_QUESTS = QUEST_SEQUENCE.flat();

export function sequenceCycle(index) {
  return QUEST_SEQUENCE[index] || null;
}
export const SEQUENCE_LENGTH = QUEST_SEQUENCE.length;

// ---- Défis de l'œuf (refonte 02/09) ----
//
// Un défi ne stocke plus une cible chiffrée mais un **temps de farm**
// (`effortMin`). La cible réelle est calculée au tirage à partir du
// revenu du joueur, puis figée — voir `resolveQuestTarget()` plus bas.
//
// Pourquoi : une cible en dur n'est juste qu'à un instant précis de la
// partie. « Aie 30M de pièces » est un mur au début et un défi déjà
// validé trois heures plus tard. Une version précédente découpait la
// partie en 6 phases pour limiter le problème, mais à l'intérieur d'une
// même phase le revenu varie déjà d'un facteur 100 — l'approximation
// restait grossière. Avec `effortMin`, un défi coûte le même temps de
// jeu à toutes les échelles, et les phases deviennent inutiles.
//
// Champs :
//   id         identifiant stable, JAMAIS renommé (il vit dans les sauvegardes)
//   icon       pastille de la barre de défi
//   label(t)   FONCTION qui construit le texte depuis la cible résolue,
//              pour qu'un libellé ne puisse pas mentir sur l'objectif
//   metric     quoi mesurer (voir readMetric)
//   effortMin  minutes de farm visées
//   target     cible FIXE, pour les défis de rythme d'action (nombre de
//              taps, de combats) que le temps ne convertit pas en pièces
//   mode       'absolute' = état atteint ici et maintenant
//              'delta'    = progression DEPUIS le tirage
//   available  (optionnel) le défi a-t-il un sens pour ce joueur
//   step/minStep  pas minimum pour les métriques non monétaires
//
// Le mode n'est pas cosmétique. `delta` sert aux compteurs qui ne
// redescendent jamais (invocations, critiques, combats) : sans lui, un
// vétéran validerait le défi à l'instant du tirage. `absolute` sert aux
// états que le joueur possède ou non (niveau d'un Pacte, pièces en
// réserve, générateurs achetés) — les avoir déjà EST la preuve de
// progression.

const fmtQ = (n) => {
  const v = Math.round(n);
  if (v >= 1e15) return `${+(v / 1e15).toFixed(1)} millions de milliards`;
  if (v >= 1e12) return `${+(v / 1e12).toFixed(1)} billions`;
  if (v >= 1e9) return `${+(v / 1e9).toFixed(1)} milliards`;
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)} millions`;
  return v.toLocaleString('fr-FR');
};
// « 290 milliards DE pièces » mais « 100 000 pièces » : dès que le
// nombre est écrit en mots, le français impose la préposition.
const qtyQ = (n, noun) => (Math.round(n) >= 1e6 ? `${fmtQ(n)} de ${noun}` : `${fmtQ(n)} ${noun}`);
// Les noms de générateurs sont au singulier dans AUTOCLICKERS
// (« Automate Runique ») : un défi en demande toujours plusieurs. Seul
// le groupe AVANT une préposition s'accorde — « Colonie de Familiers »
// donne « Colonies de Familiers », pas « Colonies des Familiers ».
const PLURAL_STOP = ['de', 'du', 'des', 'la', 'le', 'les', "d'"];
const pluralQ = (name) => {
  const words = name.split(' ');
  const stopAt = words.findIndex((w) => PLURAL_STOP.includes(w.toLowerCase()));
  const limit = stopAt === -1 ? words.length : stopAt;
  return words
    .map((w, i) => (i < limit && !/[sx]$/i.test(w) ? `${w}s` : w))
    .join(' ');
};
export const QUEST_POOL = [
  // ---------- Économie générale ----------
  { id: 'earnShort', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 10, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'earnMid', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 25, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'earnLong', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 60, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'holdShort', family: 'economy', icon: '🏦', metric: 'coins', effortMin: 15, mode: 'absolute',
    label: (t) => `Aie ${qtyQ(t, 'pièces')} en réserve` },
  { id: 'holdMid', family: 'economy', icon: '🏦', metric: 'coins', effortMin: 35, mode: 'absolute',
    label: (t) => `Aie ${qtyQ(t, 'pièces')} en réserve` },
  { id: 'holdLong', family: 'economy', icon: '🏦', metric: 'coins', effortMin: 75, mode: 'absolute',
    label: (t) => `Aie ${qtyQ(t, 'pièces')} en réserve` },
  { id: 'passiveMid', family: 'economy', icon: '📈', metric: 'passiveIncome', effortMin: 30, mode: 'absolute',
    label: (t) => `Atteins ${qtyQ(t, 'pièces')} par seconde` },
  { id: 'passiveLong', family: 'economy', icon: '📈', metric: 'passiveIncome', effortMin: 70, mode: 'absolute',
    label: (t) => `Atteins ${qtyQ(t, 'pièces')} par seconde` },

  // ---------- Mécaniques historiques ----------
  { id: 'pacteMid', family: 'core', icon: '🔗', metric: 'tapPower', effortMin: 20, mode: 'absolute',
    label: (t) => `Fais monter Pacte au niveau ${t}` },
  { id: 'pacteLong', family: 'core', icon: '🔗', metric: 'tapPower', effortMin: 50, mode: 'absolute',
    label: (t) => `Fais monter Pacte au niveau ${t}` },
  { id: 'sanctMid', family: 'core', icon: '🏛️', metric: 'sanctuaryLevel', effortMin: 25, mode: 'absolute',
    available: (s) => coreUpgradeUnlocked('sanctuaire', s) && (s.sanctuaryLevel || 0) < SANCTUARY_MAX_LEVEL,
    label: (t) => `Monte le Sanctuaire au niveau ${t}` },
  { id: 'sanctLong', family: 'core', icon: '🏛️', metric: 'sanctuaryLevel', effortMin: 55, mode: 'absolute',
    available: (s) => coreUpgradeUnlocked('sanctuaire', s) && (s.sanctuaryLevel || 0) < SANCTUARY_MAX_LEVEL,
    label: (t) => `Monte le Sanctuaire au niveau ${t}` },
  { id: 'veilleurMid', family: 'core', icon: '🌙', metric: 'veilleurLevel', effortMin: 20, mode: 'absolute',
    available: (s) => coreUpgradeUnlocked('veilleur', s) && (s.veilleurLevel || 0) < VEILLEUR_MAX_LEVEL,
    label: (t) => `Monte le Veilleur au niveau ${t}` },
  { id: 'faveurMid', family: 'core', icon: '✨', metric: 'critLevel', effortMin: 20, mode: 'absolute',
    available: (s) => coreUpgradeUnlocked('faveur', s),
    label: (t) => `Monte la Faveur des Esprits au niveau ${t}` },
  { id: 'autoTotalMid', family: 'core', icon: '🔧', metric: 'autoTotal', effortMin: 30, mode: 'absolute',
    label: (t) => `Possède ${fmtQ(t)} auto-clics en tout` },
  { id: 'autoTotalLong', family: 'core', icon: '🔧', metric: 'autoTotal', effortMin: 65, mode: 'absolute',
    label: (t) => `Possède ${fmtQ(t)} auto-clics en tout` },

  // ---------- Rythme d'action (cibles FIXES) ----------
  // Ces défis ne coûtent pas de pièces mais du temps de jeu actif : les
  // convertir en budget n'aurait aucun sens.
  { id: 'combo25', family: 'action', icon: '🔥', metric: 'maxCombo', target: 25, mode: 'absolute',
    label: () => 'Atteins un multiplicateur de Transe x2,5' },
  { id: 'combo30', family: 'action', icon: '🔥', metric: 'maxCombo', target: 30, mode: 'absolute',
    available: (s) => (s.maxCombo || 0) >= 20,
    label: () => 'Atteins un multiplicateur de Transe x3' },
  // `critChance(0)` vaut exactement 0 : sans Faveur des Esprits, aucun
  // coup critique ne peut tomber. Mais le 1er niveau ne coûte que 25
  // pièces — le défi est donc parfaitement atteignable dès le début, il
  // demande juste d'acheter la Faveur d'abord. On ne le bloque donc que
  // pour un joueur qui n'a pas encore de quoi se la payer.
  { id: 'crit20', family: 'action', icon: '💥', metric: 'totalCrits', target: 20, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && ((s.critLevel || 0) >= 1 || (s.coins || 0) >= critUpgradeCost(0) || questBudget(s, 5) >= critUpgradeCost(0)),
    label: (t) => `Obtiens ${t} coups critiques` },
  { id: 'crit100', family: 'action', icon: '💥', metric: 'totalCrits', target: 100, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && (s.critLevel || 0) >= 2,
    label: (t) => `Obtiens ${t} coups critiques` },
  { id: 'crit400', family: 'action', icon: '💥', metric: 'totalCrits', target: 200, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && (s.critLevel || 0) >= 5,
    label: (t) => `Obtiens ${t} coups critiques` },
  { id: 'golden3', family: 'action', icon: '⭐', metric: 'goldenClaimed', target: 3, mode: 'delta',
    label: (t) => `Touche ${t} fois la cible dorée` },
  // La cible dorée n'apparaît qu'une fois toutes les 45-90 secondes :
  // 10 captures demandent une bonne dizaine de minutes de présence
  // continue. Réservé à un joueur qui en a déjà attrapé.
  { id: 'golden10', family: 'action', icon: '⭐', metric: 'goldenClaimed', target: 10, mode: 'delta',
    available: (s) => (s.goldenClaimed || 0) >= 3,
    label: (t) => `Touche ${t} fois la cible dorée` },
  // L'invocation coûte des pièces et son prix grimpe avec la
  // collection : inutile de proposer 10 invocations à qui n'a pas de
  // quoi en payer une seule.
  { id: 'summon10', family: 'action', icon: '🔮', metric: 'totalSummons', target: 10, mode: 'delta',
    available: (s) => questBudget(s, 20) >= summonCost(s.ownedCount || 0) * 10,
    label: (t) => `Invoque ${t} créatures` },
  { id: 'summon30', family: 'action', icon: '🔮', metric: 'totalSummons', target: 12, mode: 'delta',
    available: (s) => (s.ownedCount || 0) >= 4 && questBudget(s, 30) >= summonCost(s.ownedCount || 0) * 30,
    label: (t) => `Invoque ${t} créatures` },

  // ---------- Collection (pas monétaire : pas relatif) ----------
  // PAS de défi « possède N créatures différentes » : les créatures
  // s'obtiennent en faisant éclore l'œuf, que ce défi bloquerait — une
  // dépendance circulaire. Le gacha offre bien une porte de sortie, mais
  // un défi ne doit pas exiger de contourner le système qu'il gèle.
  // `summon*` couvre déjà l'invocation, proprement et en mode delta.
  // Nourrir suppose d'avoir au moins une créature à nourrir.
  { id: 'feed5', family: 'collection', icon: '🍖', metric: 'maxCreatureLevel', mode: 'absolute', step: 5, minStep: 5,
    available: (s) => (s.ownedCount || 0) >= 1,
    label: (t) => `Nourris une créature jusqu'au niveau ${t}` },
  { id: 'feed15', family: 'collection', icon: '🍖', metric: 'maxCreatureLevel', mode: 'absolute', step: 15, minStep: 15,
    available: (s) => (s.ownedCount || 0) >= 1 && (s.maxCreatureLevel || 0) >= 5,
    label: (t) => `Nourris une créature jusqu'au niveau ${t}` },

  // ---------- Défis Aventure ----------
  //
  // BUG RÉEL (signalé après une réinitialisation de progression) : ces
  // défis étaient proposés à un joueur tout neuf, qui recevait « gagne 3
  // combats » et « équipe une rune » alors qu'il n'avait AUCUNE créature.
  // Le bouton Combattre d'AdventureScreen est désactivé quand le deck
  // est vide (« Deck vide ») : l'œuf devenait donc définitivement
  // inéclosable. Chaque défi porte maintenant sa vraie précondition, et
  // la chaîne complète est respectée :
  //   créature dans le deck -> combats -> Griffes -> achat de rune ->
  //   équipement de rune
  { id: 'advWin3', family: 'adventure', icon: '⚔️', metric: 'battleWon', target: 3, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1,
    label: (t) => `Gagne ${t} combats en Exploration` },
  { id: 'advWin10', family: 'adventure', icon: '⚔️', metric: 'battleWon', target: 4, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.battleWon || 0) >= 3,
    label: (t) => `Gagne ${t} combats en Exploration` },
  // Les runes s'achètent avec des Griffes, qui ne s'obtiennent qu'en
  // gagnant des combats : exiger un combat déjà gagné, pas seulement une
  // créature.
  { id: 'advBuyRune1', family: 'adventure', icon: '🛒', metric: 'runeBought', target: 1, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.battleWon || 0) >= 1,
    label: (t) => `Achète ${t} rune en Aventure` },
  { id: 'advBuyRune5', family: 'adventure', icon: '🛒', metric: 'runeBought', target: 2, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.runeBought || 0) >= 1,
    label: (t) => `Achète ${t} runes en Aventure` },
  // On ne peut équiper une rune qu'après en avoir acheté une.
  { id: 'advEquipRune2', family: 'adventure', icon: '🪬', metric: 'runesEquipped', target: 2, mode: 'absolute',
    available: (s) => (s.deckCount || 0) >= 1 && (s.runeBought || 0) >= 1,
    label: (t) => `Équipe ${t} runes sur tes créatures (Aventure)` },
];

// Lit une métrique dans l'objet de stats. Les métriques paramétrées
// (`upgrade:<id>`, `auto:<id>`) sont résolues ici plutôt que d'exiger
// une entrée à plat par amélioration — sinon ajouter une amélioration
// obligerait à toucher aussi la couche de stats.
// Retrouve un défi par id, qu'il vienne de la séquence scriptée ou du
// pool dynamique. Toutes les fonctions publiques passent par ici, donc
// les deux systèmes se lisent exactement pareil côté écran.
export function findQuest(questId) {
  return SEQUENCE_QUESTS.find((q) => q.id === questId) || QUEST_POOL.find((q) => q.id === questId) || null;
}

function readMetric(metric, stats) {
  if (!stats) return 0;
  if (metric.startsWith('upgrade:')) {
    const levels = normalizeUpgradeLevels(stats.upgradeLevels);
    return levels[metric.slice(8)] || 0;
  }
  if (metric.startsWith('auto:')) {
    return (stats.autoClickers || {})[metric.slice(5)] || 0;
  }
  if (metric.startsWith('tapUpgrade:')) {
    return normalizeTapUpgrades(stats.tapUpgrades)[metric.slice(11)] || 0;
  }
  const v = stats[metric];
  return Number.isFinite(v) ? v : 0;
}

// ---- Cibles dynamiques : « X minutes de jeu » plutôt qu'un nombre ----
//
// Le problème que ça résout : une cible écrite en dur ne peut être juste
// qu'à un seul moment de la partie. « Aie 30M de pièces » est un mur
// infranchissable au début et un défi déjà validé trois heures plus
// tard. Les phases de progression (QUEST_TIER_THRESHOLDS) limitaient les
// dégâts en ne proposant que des défis de la bonne tranche, mais restent
// une approximation grossière : à l'intérieur d'une même phase, le
// revenu du joueur varie déjà d'un facteur 100.
//
// La cible est donc calculée AU MOMENT DU TIRAGE à partir du revenu réel
// du joueur, puis FIGÉE pour toute la durée du défi (persistée dans la
// sauvegarde, voir `questTargets` dans ClickerScreen.js). Un défi coûte
// désormais un temps de jeu — « environ 25 minutes de farm » — quelle
// que soit la phase, et ce temps reste honnête à toutes les échelles.
//
// Figer la cible est indispensable : recalculée à chaque rendu, elle
// monterait en même temps que le revenu du joueur et le défi
// s'éloignerait à mesure qu'il progresse, sans jamais se terminer.

// Revenu total estimé par seconde, passif + tap. Le tap est compté à un
// rythme volontairement bas (2 taps/s sur une fraction du temps) : il
// sert seulement à éviter un budget nul en tout début de partie, quand
// il n'y a encore aucun auto-clic.
export function estimatedIncomePerSecond(stats) {
  const passive = Math.max(0, readMetric('passiveIncome', stats));
  const perTap = Math.max(1, readMetric('tapPower', stats));
  return passive + perTap * 0.5;
}

// ---- Surcoût des défis en PIÈCES après une Ascension ----
//
// Une Ascension multiplie la production par 1,30, et comme le budget
// dérive de la production, les cibles en pièces montaient déjà de 30 %
// par Ascension — donc à effort CONSTANT pour le joueur.
//
// Décision : elles doivent monter de **45 %**, pour que chaque Ascension
// resserre un peu la vis plutôt que d'être neutre.
//
// ⚠️ La production apportant déjà ×1,30, on ajoute seulement le
// COMPLÉMENT : 1,45 / 1,30 = 1,1154 par Ascension. Appliquer 1,45 tel
// quel donnerait 1,30 × 1,45 = ×1,885, soit bien plus que voulu.
//
// ⚠️ Ne concerne QUE les cibles dérivées du budget en pièces. Les défis
// de RYTHME (cible dorée, critiques, pouvoirs, invocations) gardent leur
// propre progression — leur rythme ne dépend pas de la production.
export const ASCENSION_COIN_TARGET_RATE = 1.45;
const ASCENSION_COIN_EXTRA = ASCENSION_COIN_TARGET_RATE / 1.30;

export function ascensionCoinMultiplier(ascensionCount) {
  const n = Math.max(0, ascensionCount || 0);
  return Math.pow(ASCENSION_COIN_EXTRA, n);
}

// Budget de pièces qu'un joueur produit en `minutes` minutes de jeu.
export function questBudget(stats, minutes) {
  return estimatedIncomePerSecond(stats) * 60 * Math.max(1, minutes)
    * ascensionCoinMultiplier(stats && stats.ascension);
}

// Combien de niveaux supplémentaires ce budget permet-il d'acheter, en
// suivant la VRAIE fonction de coût du jeu ? C'est ce qui rend un défi
// « monte Griffe de Braisillon » aussi honnête qu'un défi en pièces :
// on ne devine pas, on additionne les coûts réels jusqu'à épuisement.
//
// Le garde-fou `MAX_LEVEL_SCAN` évite une boucle sans fin si une
// fonction de coût renvoyait 0 ou NaN.
const MAX_LEVEL_SCAN = 500;
function levelsAffordable(costFn, currentLevel, budget) {
  let spent = 0;
  let level = currentLevel;
  for (let i = 0; i < MAX_LEVEL_SCAN; i++) {
    const cost = costFn(level);
    if (!Number.isFinite(cost) || cost <= 0) break;
    if (spent + cost > budget) break;
    spent += cost;
    level += 1;
  }
  return level;
}

// Revenu passif atteint si tout le budget partait dans le générateur le
// plus rentable que le joueur peut s'offrir. Sert de cible aux défis
// « atteins X pièces/seconde ».
function passiveIncomeAfterBudget(stats, budget) {
  const current = Math.max(0, readMetric('passiveIncome', stats));
  const owned = stats.autoClickers || {};
  let bestGain = 0;
  for (const clicker of AUTOCLICKERS) {
    const have = owned[clicker.id] || 0;
    const reachable = levelsAffordable((n) => autoClickerCost(clicker, n), have, budget);
    const gain = (reachable - have) * clicker.baseIncome;
    if (gain > bestGain) bestGain = gain;
  }
  return current + bestGain;
}

// Arrondi « lisible » : un défi doit annoncer 25 000, pas 24 137.
export function roundQuestTarget(n) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  if (n < 10) return Math.max(1, Math.round(n));
  if (n < 100) return Math.round(n / 5) * 5;
  const exp = Math.floor(Math.log10(n));
  const step = Math.pow(10, exp - 1);
  return Math.round(n / step) * step;
}

// Résout la cible d'un défi pour un joueur donné. `effortMin` = durée de
// farm visée. Le résultat est toujours strictement supérieur à l'état
// actuel du joueur : sinon le défi naîtrait déjà validé.
// Métriques d'ACTION : leur rythme ne dépend pas de la production, donc
// le budget en pièces ne les calibre pas. Elles gardent une cible fixe,
// mais celle-ci monte avec les ASCENSIONS — un joueur qui a prestigé
// plusieurs fois doit être davantage sollicité, sinon ces défis
// deviennent des formalités à côté de ses défis en pièces (eux montent
// de 30 % par Ascension via la production).
//
// +20 % par Ascension, PLAFONNÉ à ×3 : au-delà, un défi d'action
// deviendrait plus long que la session entière.
export const ACTION_ASCENSION_STEP = 1.2;
export const ACTION_ASCENSION_CAP = 3;
const METRIQUES_RYTHME = [
  'goldenClaimed', 'totalCrits', 'powerActivated', 'totalSummons', 'maxCombo',
];

export function ascensionActionMultiplier(ascensionCount) {
  const n = Math.max(0, ascensionCount || 0);
  return Math.min(ACTION_ASCENSION_CAP, Math.pow(ACTION_ASCENSION_STEP, n));
}

export function resolveQuestTarget(quest, stats) {
  if (!quest) return 1;
  if (quest.target) {
    const brute = METRIQUES_RYTHME.includes(quest.metric)
      // Seules les métriques de RYTHME suivent les Ascensions.
      ? roundQuestTarget(quest.target * ascensionActionMultiplier(stats && stats.ascension))
      : quest.target;
    // ⚠️ INVARIANT : un défi doit TOUJOURS demander plus que ce que le
    // joueur a déjà. Une cible fixe sortait d'ici sans passer par le
    // plancher appliqué plus bas aux cibles calculées : elle pouvait
    // donc afficher un niveau DÉJÀ ATTEINT, que le joueur lisait comme
    // un défi cassé.
    if (quest.mode !== 'absolute') return brute;
    const dejaLa = readMetric(quest.metric, stats);
    return Math.max(brute, dejaLa + Math.max(quest.minStep || 1, Math.ceil(dejaLa * 0.15)));
  }
  const minutes = quest.effortMin || 15;
  const budget = questBudget(stats, minutes);
  const now = readMetric(quest.metric, stats);
  const metric = quest.metric;
  let raw;

  if (metric === 'totalEarned') {
    raw = budget;
  } else if (metric === 'coins') {
    // Épargner demande de ne PAS tout réinvestir : on vise une fraction
    // de la production de la période, pas sa totalité.
    raw = Math.max(budget * 0.6, now * 1.5);
  } else if (metric === 'passiveIncome') {
    raw = Math.max(passiveIncomeAfterBudget(stats, budget), now * 1.25);
  } else if (metric === 'tapPower') {
    raw = levelsAffordable((lv) => tapPowerCost(lv), Math.max(1, now), budget);
  } else if (metric === 'sanctuaryLevel') {
    // Plafonné : viser au-delà du niveau max rendrait le défi infaisable.
    raw = Math.min(SANCTUARY_MAX_LEVEL, levelsAffordable((lv) => sanctuaryUpgradeCost(lv), now, budget));
  } else if (metric === 'veilleurLevel') {
    raw = Math.min(VEILLEUR_MAX_LEVEL, levelsAffordable((lv) => veilleurUpgradeCost(lv), now, budget));
  } else if (metric === 'critLevel') {
    raw = levelsAffordable((lv) => critUpgradeCost(lv), now, budget);
  } else if (metric.startsWith('upgrade:')) {
    const item = UPGRADE_ITEMS.find((u) => u.id === metric.slice(8));
    raw = item ? levelsAffordable((lv) => upgradeItemCost(item, lv), now, budget) : now + 1;
  } else if (metric.startsWith('auto:')) {
    const clicker = AUTOCLICKERS.find((c) => c.id === metric.slice(5));
    raw = clicker ? levelsAffordable((n) => autoClickerCost(clicker, n), now, budget) : now + 1;
  } else if (metric === 'autoTotal') {
    // Combien d'unités de PLUS le budget achète, en le dépensant sur le
    // générateur qui en rend le plus — c'est ce qu'un joueur ferait pour
    // faire grimper ce compteur au moins cher.
    const owned = stats.autoClickers || {};
    let bestCount = 0;
    for (const clicker of AUTOCLICKERS) {
      const have = owned[clicker.id] || 0;
      const reachable = levelsAffordable((n) => autoClickerCost(clicker, n), have, budget);
      if (reachable - have > bestCount) bestCount = reachable - have;
    }
    raw = now + bestCount;
  } else {
    // Métriques non monétaires (créatures possédées, niveau nourri,
    // essence) : le temps ne s'y convertit pas en pièces, on avance donc
    // d'un pas relatif à l'état actuel.
    raw = now + (quest.step || 1);
  }

  const rounded = roundQuestTarget(raw);
  // Un défi doit toujours demander un vrai pas en avant, même si le
  // budget calculé était trop faible pour acheter quoi que ce soit.
  //
  // Ce plancher ne vaut QUE pour les défis 'absolute'. Sur un défi
  // 'delta', `now` est un cumul de toute la partie : le borner par
  // `now + 1` donnait « gagne 162 001 pièces » à un joueur qui en avait
  // déjà gagné 162 000 — soit un défi validé à l'instant du tirage.
  if (quest.mode === 'delta') return Math.max(rounded, quest.minStep || 1);
  // Le pas minimum est aussi RELATIF à l'existant : sur un compteur déjà
  // haut, « +1 » donne un défi affiché à 98% dès le tirage. On exige au
  // moins 15% de progression pour que la barre parte d'un état crédible.
  const floor = now + Math.max(quest.minStep || 1, Math.ceil(now * 0.15));
  const target = Math.max(rounded, floor);
  // Le plancher relatif pourrait repasser au-dessus d'un plafond dur.
  if (metric === 'sanctuaryLevel') return Math.min(SANCTUARY_MAX_LEVEL, target);
  if (metric === 'veilleurLevel') return Math.min(VEILLEUR_MAX_LEVEL, target);
  return target;
}

// Progression 0-1 d'un défi. `targets` = cibles figées au tirage
// (objet id -> valeur). Si une cible manque, on la recalcule à la volée
// depuis les stats — ce n'est qu'un repli pour les sauvegardes d'avant
// les cibles dynamiques, jamais le chemin normal.
// ⚠️ Métriques d'ACTION RARE : elles se comptent depuis le début du
// CYCLE, pas depuis le moment où le défi devient courant.
//
// Bug réel : « Équipe 3 runes » ne se validait pas pour un joueur qui
// avait déjà équipé ses 3 runes plus tôt dans le cycle. Le compteur
// repartait de zéro, et comme ses 3 emplacements étaient pleins il ne
// POUVAIT PLUS en équiper — défi infaisable sans deviner qu'il fallait
// déséquiper puis rééquiper.
//
// Ces actions sont rares, coûteuses et délibérées : le joueur qui les a
// faites pendant le cycle a fait le travail, ça doit compter. Les
// métriques d'ACCUMULATION (pièces gagnées, critiques, cibles dorées)
// gardent leur référence par défi, sinon elles se valideraient toutes
// seules — le joueur en accumule en permanence.
export const CYCLE_SCOPED_METRICS = [
  'runeBought', 'runeEquipped', 'runeFused', 'ascension', 'offering',
];

export function metricScopedToCycle(metric) {
  return CYCLE_SCOPED_METRICS.includes(metric);
}

export function questProgress(questId, stats, baseline = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return 0;
  // ⚠️ Une cible FIXE (`q.target`) prime TOUJOURS sur la valeur
  // sauvegardée. Les cibles sont figées au tirage du cycle : après un
  // changement d'équilibrage, une partie en cours gardait l'ANCIENNE
  // valeur alors que le libellé, lui, est recalculé. Le défi affichait
  // « 100 000 pièces » tout en en exigeant 140 000 — bug signalé.
  // Seules les cibles CALCULÉES (effort en minutes) doivent rester
  // figées, sinon elles bougeraient au fil de la partie.
  const target = effectiveQuestTarget(questId, baseline && baseline.totalEarned !== undefined ? baseline : stats, targets);
  if (!target) return 0;
  const now = readMetric(q.metric, stats);
  const base = readMetric(q.metric, baseline);
  if (q.mode === 'delta') {
    return Math.max(0, Math.min(1, Math.max(0, now - base) / target));
  }
  // Mode 'absolute' : progression = valeur RÉELLE / cible.
  //
  // Une version précédente normalisait depuis l'état au tirage, pour
  // qu'un défi « possède 58 Colosses » proposé à qui en a déjà 50 ne
  // s'affiche pas à 86% d'emblée. Mais le compteur affichait alors un
  // nombre FAUX : un joueur avec 46 700 pièces en banque lisait
  // « 28,0K/100,0K ». Sur un défi « aie X pièces », le joueur vérifie
  // le chiffre dans sa barre du haut — il doit correspondre.
  // Une barre qui démarre haut est un moindre mal face à un compteur
  // qui ment.
  return Math.max(0, Math.min(1, now / target));
}

export function questComplete(questId, stats, baseline = {}, targets = {}) {
  return questProgress(questId, stats, baseline, targets) >= 1;
}

// Libellé d'un défi, construit à partir de la cible RÉSOLUE — il ne peut
// donc pas mentir sur ce qui est demandé. C'est le piège tombé deux fois
// avec les libellés figés : changer une cible sans régénérer le texte.
// ⚠️ RÉSOLVEUR UNIQUE de la cible d'un défi.
//
// Trois endroits la calculaient, et pas dans le même ordre : le libellé
// privilégiait la cible SAUVEGARDÉE, la progression celle de la
// DÉFINITION. Résultat : « Monte Pacte au niveau 7 » qui se validait au
// niveau 5 — le texte et la condition ne parlaient pas de la même chose.
//
// Ordre unique et définitif :
//   1. cible FIXE de la définition (`q.target`) — fait autorité, c'est
//      elle qui suit les changements d'équilibrage ;
//   2. cible SAUVEGARDÉE au tirage (défis calibrés par effort) ;
//   3. calcul à la volée, en dernier recours.
export function effectiveQuestTarget(questId, stats = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return 1;
  // ⚠️ La cible FIGÉE au tirage fait autorité, y compris pour les défis
  // à cible fixe.
  //
  // `resolveQuestTarget` applique un plancher « plus que l'acquis » —
  // indispensable AU TIRAGE pour qu'un défi ne naisse pas déjà accompli.
  // Mais l'appeler à chaque évaluation faisait FUIR la cible : « équipe
  // 2 runes » en réclamait 3 dès qu'on en avait 2.
  //
  // Le plancher n'agit donc qu'une fois, au tirage ; ensuite on relit la
  // valeur enregistrée.
  if (targets[questId]) return targets[questId];
  if (q.target && METRIQUES_RYTHME.includes(q.metric)) {
    return roundQuestTarget(q.target * ascensionActionMultiplier(stats && stats.ascension));
  }
  if (q.target) return q.target;
  return resolveQuestTarget(q, stats);
}

// Cibles manquantes d'un cycle DÉJÀ tiré.
//
// ⚠️ Les parties commencées avant que les cibles soient figées au tirage
// n'en ont aucune d'enregistrée : elles se recalculent à chaque rendu et
// suivent l'état du joueur. Après une Ascension, qui remet le Pacte à
// zéro, la cible retombait à un niveau déjà franchi.
//
// On les fige une bonne fois, sur l'état courant.
export function freezeMissingTargets(activeIds, stats = {}, targets = {}) {
  let change = false;
  const suivant = { ...targets };
  (activeIds || []).forEach((id) => {
    if (suivant[id]) return;
    const q = findQuest(id);
    if (!q) return;
    suivant[id] = q.target || resolveQuestTarget(q, stats);
    change = true;
  });
  return change ? suivant : null;
}

export function questLabel(questId, target, stats = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return '';
  // `target` explicite prioritaire pour les appels qui en fournissent un,
  // sinon on passe par le résolveur commun.
  const t = target || effectiveQuestTarget(questId, stats, targets);
  return q.label(t || 1);
}

export function questDetail(questId, stats, baseline = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return { icon: '🎯', label: '', progress: 0, target: 1, current: 0, done: false };
  // Même règle qu'au-dessus : une cible fixe vient de la définition.
  const target = effectiveQuestTarget(questId, stats, targets);
  const progress = questProgress(questId, stats, baseline, { ...targets, [questId]: target });
  return {
    icon: q.icon,
    label: q.label(target),
    progress,
    target,
    current: Math.min(target, Math.floor(progress * target + 1e-9)),
    done: progress >= 1,
  };
}


// Point d'entrée unique pour obtenir le prochain jeu de défis.
//
// Tant que la séquence de démarrage n'est pas épuisée, on sert le cycle
// scripté à l'index courant (cibles fixes, mêmes défis pour tous, dans
// un ordre pensé pour enseigner les mécaniques). Ensuite seulement, on
// bascule sur le pool dynamique dont les cibles suivent le revenu.
//
// `index` est l'avancement dans la séquence, persisté par l'écran. Il
// n'est PAS remis à zéro par une Ascension : la séquence est un fil de
// découverte, on ne rejoue pas le tutoriel à chaque prestige.
// Un défi est-il DÉJÀ accompli au moment où on le propose ?
//
// Seul le mode 'absolute' est concerné : il compare la valeur actuelle à
// la cible, donc un joueur qui a déjà dépassé la cible voit le défi se
// valider tout seul, sans jamais l'avoir vu. Le mode 'delta' part
// toujours de zéro (il mesure depuis l'instantané du tirage), il ne peut
// pas être accompli d'avance.
//
// Cas réel signalé : « Reste en Transe x2,5 pendant 42 secondes » sur
// `maxTranseHoldSec`, qui est un RECORD à vie. Une joueuse ayant tenu
// une longue Transe plus tôt n'a jamais vu ce défi apparaître.
// Métriques de type RECORD : elles sont remises à zéro au tirage du
// cycle par ClickerScreen, donc elles ne sont JAMAIS déjà accomplies.
// Les exclure ici est essentiel : sans ça, le défi de Transe serait
// REMPLACÉ alors qu'il suffit de le remettre à zéro pour le rendre
// jouable — on perdrait un défi au lieu de le réparer.
const RESET_ON_DRAW_METRICS = ['maxTranseHoldSec', 'maxCombo'];

// La créature dont dépend une amélioration est-elle possédée ?
//
// ⚠️ Depuis que les améliorations sont réservées aux créatures
// possédées, un défi « monte l'objet X » devient IMPOSSIBLE sans elle —
// et comme l'œuf attend que tous les défis du cycle soient validés, il
// resterait bloqué à jamais. Cas réel : « Monte Griffe de Braisillon au
// niveau 5 » proposé à un joueur qui n'a pas Pyrosile.
export function upgradeCreatureOwned(metric, stats = {}) {
  if (!metric || !metric.startsWith('upgrade:')) return true;
  const item = UPGRADE_ITEMS.find((u) => u.id === metric.slice(8));
  if (!item || !item.creatureId) return true;
  return (stats.ownedIds || []).includes(item.creatureId);
}

// Un défi est-il RÉALISABLE dans l'état actuel ? Réunit sa condition
// propre (`available`) et la possession de la créature requise.
export function questFeasible(quest, stats = {}) {
  if (!quest) return false;
  if (!upgradeCreatureOwned(quest.metric, stats)) return false;
  if (typeof quest.available === 'function' && !quest.available(stats)) return false;
  return true;
}

export function questAlreadyDone(quest, stats = {}) {
  if (!quest || quest.mode !== 'absolute' || !quest.target) return false;
  if (RESET_ON_DRAW_METRICS.includes(quest.metric)) return false;
  return readMetric(quest.metric, stats) >= quest.target;
}

export function nextQuestSet(index, excludeIds = [], stats = {}) {
  const cycle = sequenceCycle(index);
  if (cycle) {
    // Les défis déjà accomplis sont REMPLACÉS par des défis du pool
    // dynamique, dont la cible est calculée à partir de l'état courant
    // et se situe donc forcément devant le joueur.
    //
    // Pourquoi remplacer plutôt que relever la cible du défi scripté :
    // les libellés de la séquence contiennent leur nombre EN DUR
    // (« ...pendant 42 secondes »). Changer la cible sans le texte
    // donnerait un défi qui ment sur son propre objectif.
    // ⚠️ On écarte les défis déjà faits ET les IRRÉALISABLES (créature
    // manquante). Sans ce second filtre, un défi impossible entrait dans
    // le cycle et bloquait l'éclosion définitivement.
    const kept = cycle.filter((q) => !questAlreadyDone(q, stats) && questFeasible(q, stats));
    // ⚠️ La cible est FIGÉE ici, au tirage. Pour les défis calibrés par
    // EFFORT (`effortMin`), `q.target` est `undefined` : sans ce calcul,
    // la cible était recalculée à CHAQUE RENDU sur l'état courant, et
    // elle FUYAIT devant le joueur.
    //
    // Cas réels signalés : « Monte Pacte » dont la cible montait à mesure
    // qu'on montait le Pacte (production en hausse ⇒ budget en hausse),
    // et « Obtiens N pièces » qui se validait aussitôt après une
    // Ascension (production repartie de zéro ⇒ budget minuscule).
    const targets = {};
    kept.forEach((q) => { targets[q.id] = q.target || resolveQuestTarget(q, stats); });
    const ids = kept.map((q) => q.id);

    const missing = cycle.length - kept.length;
    if (missing > 0) {
      const sub = pickQuestSet([...excludeIds, ...ids], stats);
      sub.ids.slice(0, missing).forEach((id) => {
        ids.push(id);
        targets[id] = sub.targets[id];
      });
    }
    return { ids, targets, fromSequence: true };
  }
  return { ...pickQuestSet(excludeIds, stats), fromSequence: false };
}

export const QUEST_SET_SIZE = 4;

// Index (0-based) du cycle qui introduit les Runes.
//
// ⚠️ Le tirage offert se déduit de CET index, pas de la liste des défis
// actifs. Cette liste est SAUVEGARDÉE au tirage du cycle : un joueur
// arrivé au cycle 5 avant l'ajout du défi garde une liste qui ne le
// contient pas, et la condition « le défi est actif » restait fausse à
// jamais. La progression, elle, est fiable.
export const RUNE_CYCLE_INDEX = 4;

// Rune OFFERTE au joueur quand le défi qui introduit les Runes arrive.
//
// ⚠️ La clé vit ICI et pas dans un écran : le Clicker la dépose,
// l'Aventure l'encaisse. La déclarer dans l'un des deux créait un CYCLE
// d'imports (chacun important l'autre), exactement le piège évité en
// extrayant ce fichier. `questLogic` est déjà importé par les deux, dans
// un seul sens.
export const PENDING_FREE_RUNE_KEY = 'adventure:pendingFreeRune:v1';

// Tire 4 défis et résout leurs cibles d'un coup. Retourne
// `{ ids, targets }` — les deux doivent être persistés ENSEMBLE : des
// ids sans leurs cibles feraient recalculer des objectifs différents au
// prochain chargement.
//
// Un défi n'est éligible que si sa métrique a du sens pour ce joueur
// (`available`) : proposer « possède 30 Étoiles Filantes » à quelqu'un
// qui n'a pas encore les moyens du premier générateur donnerait un défi
// techniquement résoluble mais absurde.
export function pickQuestSet(excludeIds = [], stats = {}) {
  // `questAlreadyDone` en plus de `available` : un défi du pool à cible
  // FIXE peut lui aussi être déjà accompli, et se validerait sans que le
  // joueur le voie.
  const eligible = QUEST_POOL.filter((q) => questFeasible(q, stats)).filter(
    (q) => (!q.available || q.available(stats)) && !questAlreadyDone(q, stats)
  );
  let pool = eligible.filter((q) => !excludeIds.includes(q.id));
  if (pool.length < QUEST_SET_SIZE) pool = eligible;
  if (pool.length < QUEST_SET_SIZE) pool = QUEST_POOL;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  // Un seul défi par métrique dans un même jeu : sans ce filtre, le
  // tirage sortait « atteins 130 000/s » ET « atteins 170 000/s » côte à
  // côte, ce qui donne l'impression d'un bug plutôt que d'un choix.
  // Un jeu de 4 défis doit être VARIÉ : une seule métrique par défi, et
  // au plus 2 défis d'une même famille. Sans la contrainte de famille,
  // le tirage sortait quatre « monte telle amélioration au niveau X »
  // d'affilée, ou deux paliers du même objectif côte à côte — ce qui
  // ressemble à un bug plus qu'à un choix.
  const chosen = [];
  const usedMetrics = new Set();
  const familyCount = {};
  const MAX_PER_FAMILY = 2;
  for (const q of shuffled) {
    if (chosen.length >= QUEST_SET_SIZE) break;
    if (usedMetrics.has(q.metric)) continue;
    const fam = q.family || 'autre';
    if ((familyCount[fam] || 0) >= MAX_PER_FAMILY) continue;
    usedMetrics.add(q.metric);
    familyCount[fam] = (familyCount[fam] || 0) + 1;
    chosen.push(q);
  }
  // Repli : si la contrainte d'unicité empêche d'atteindre 4 défis
  // (joueur très en début de partie, peu de métriques disponibles), on
  // complète sans elle plutôt que de rendre un jeu incomplet.
  for (const q of shuffled) {
    if (chosen.length >= QUEST_SET_SIZE) break;
    if (!chosen.includes(q)) chosen.push(q);
  }
  const targets = {};
  chosen.forEach((q) => {
    targets[q.id] = resolveQuestTarget(q, stats);
  });
  return { ids: chosen.map((q) => q.id), targets };
}

export const EGG_STAGES = [
  { name: 'Œuf endormi', desc: 'Immobile, terne' },
  { name: 'Œuf frémissant', desc: 'Petits tremblements' },
  { name: 'Œuf fissuré', desc: 'Fissures visibles' },
  { name: 'Œuf lumineux', desc: 'Lueur qui pulse' },
  { name: 'Œuf prêt à éclore', desc: 'Vibre fort, prêt !' },
];
// Nombre de quêtes validées (0-4) -> palier visuel (0-4).
// Math.min/Math.max laissent passer NaN : l'appelant indexerait alors
// EGG_STAGES[NaN] (undefined) et planterait sur `.name`. Le garde-fou
// coûte une ligne, le crash coûterait un écran blanc.
export function eggStageForCompletedCount(completedCount) {
  if (!Number.isFinite(completedCount)) return 0;
  return Math.max(0, Math.min(4, Math.floor(completedCount)));
}


// (L'ancienne « note d'ordre » qui obligeait ce bloc à vivre en fin de
// fichier n'a plus lieu d'être : `AUTOCLICKERS` arrive maintenant par un
// import ES, donc clickerLogic est entièrement évalué avant ce fichier.)

// Défis visant une amélioration ou un générateur PRÉCIS, générés depuis
// les tableaux existants plutôt qu'écrits à la main : ajouter une
// amélioration au jeu ajoute automatiquement son défi, et aucun libellé
// ne peut se désynchroniser d'un renommage.
UPGRADE_ITEMS.forEach((item) => {
  QUEST_POOL.push({
    id: `up_${item.id}`,
    family: 'upgrade',
    icon: item.emoji,
    metric: `upgrade:${item.id}`,
    effortMin: 30,
    mode: 'absolute',
    available: (s) => {
      const lvl = normalizeUpgradeLevels(s.upgradeLevels)[item.id] || 0;
      return lvl > 0 || upgradeItemCost(item, 0) <= questBudget(s, 30);
    },
    label: (t) => `Monte ${item.name} au niveau ${t}`,
  });
});

AUTOCLICKERS.forEach((clicker) => {
  QUEST_POOL.push({
    id: `ac_${clicker.id}`,
    family: 'autoclicker',
    icon: clicker.emoji,
    metric: `auto:${clicker.id}`,
    effortMin: 30,
    mode: 'absolute',
    available: (s) => {
      const have = (s.autoClickers || {})[clicker.id] || 0;
      return have > 0 || autoClickerCost(clicker, 0) <= questBudget(s, 30);
    },
    label: (t) => `Possède ${fmtQ(t)} ${pluralQ(clicker.name)}`,
  });
});

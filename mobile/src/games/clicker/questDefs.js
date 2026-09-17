// ════════════════════════════════════════════════════════════════
//  LES DÉFIS — ce fichier ne contient QUE leur définition.
// ════════════════════════════════════════════════════════════════
//
// Aucun calcul, aucune progression, aucune validation : tout cela vit
// dans `questLogic.js`. Pour ajouter ou régler un défi, c'est ICI et
// nulle part ailleurs.
//
// Chaque défi déclare :
//   id       identifiant unique
//   metric   CE QU'ON MESURE (doit exister dans `questStats`)
//   target   cible fixe        ─┐ une seule des trois
//   effortMin cible calculée   ─┤ (`validateQuests` le vérifie)
//   step     cible relative    ─┘
//   mode     'absolute' (valeur totale) ou 'delta' (depuis le tirage)
//   label    (t) => texte — JAMAIS de nombre en dur, toujours dérivé
//            de la cible, sinon le texte ment dès qu'un réglage bouge
//
import {
  AUTOCLICKERS,
  SANCTUARY_MAX_LEVEL,
  UPGRADE_ITEMS,
  VEILLEUR_MAX_LEVEL,
  coreUpgradeUnlocked,
  critChance,
  critUpgradeCost,
  summonCost,
} from './clickerLogic';
import { fmtQ, qtyQ, describeAdventureLevel } from './questFormat';
import { questBudget } from './questBudget';


export const EGG_STAGES = [
  { name: 'Œuf endormi', desc: 'Immobile, terne' },
  { name: 'Œuf frémissant', desc: 'Petits tremblements' },
  { name: 'Œuf fissuré', desc: 'Fissures visibles' },
  { name: 'Œuf lumineux', desc: 'Lueur qui pulse' },
  { name: 'Œuf prêt à éclore', desc: 'Vibre fort, prêt !' },
];


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
// ⚠️ DÉFIS D'AVENTURE : progression de +5 NIVEAUX d'un défi au suivant.
//
// Les derniers sautaient de +10 (20 → 30 → 40), ce qui plaçait le défi
// très au-delà du joueur : il était au chapitre 4 niveau 1 quand le défi
// exigeait le chapitre 4 niveau 10. Tout nouveau défi de ce type reprend
// ce pas de +5.
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
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'seq_esprit10', icon: '👻', metric: 'auto:esprit', effortMin: 20, mode: 'absolute',
      label: (t) => `Possède ${t} Esprits Frappeurs` },
  ],
  // --- Cycle 3 : pouvoirs, Sanctuaire, revenu passif (5 défis) ---
  [
    // Ramené de 7 à 5 (14/09) : trop long pour ce moment du cycle.
    { id: 'seq_power5', icon: '✨', metric: 'powerActivated', target: 5, mode: 'delta',
      label: (t) => `Active ${t} fois un pouvoir de créature` },
    { id: 'seq_adv_c1l10', icon: '⚔️', metric: 'advLevelReached', target: 10, mode: 'absolute',
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'seq_sanct10', icon: '🏛️', metric: 'sanctuaryLevel', target: 8, mode: 'absolute',
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
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
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
    // ⚠️ `absolute`, PAS `delta`. En delta, la cible compte des
    // Ascensions EN PLUS de celles déjà faites : un joueur qui en avait
    // déjà une devait en faire une seconde pour valider « Fais
    // l'Ascension ». Ici on vise un TOTAL atteint.
    { id: 'seq_ascend1', icon: '🌟', metric: 'ascension', target: 1, mode: 'absolute',
      label: (t) => (t <= 1 ? "Fais l'Ascension" : `Atteins ${t} Ascensions`) },
  ],
  // --- Cycle 6 : relance après Ascension ---
  [
    { id: 'seq_earn100k', icon: '💰', metric: 'totalEarned', effortMin: 30, mode: 'delta',
      label: (t) => `Obtiens ${fmtQ(t)} pièces` },
    { id: 'seq_pacte20', icon: '🔗', metric: 'tapPower', target: 9, mode: 'absolute',
      label: (t) => `Monte Pacte au niveau ${t}` },
    { id: 'seq_rune1', icon: '🛒', metric: 'runeBought', target: 1, mode: 'delta',
      label: () => 'Achète 1 rune en Exploration' },
    { id: 'seq_adv_c3l5', icon: '⚔️', metric: 'advLevelReached', target: 20, mode: 'absolute',
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
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
    { id: 'seq_sanct15', icon: '✊', metric: 'tapUpgrade:tap1', target: 5, mode: 'absolute',
      label: (t) => `Monte Poigne Ancienne au niveau ${t}` },
    { id: 'seq_hold1M', icon: '🏦', metric: 'coins', effortMin: 35, mode: 'absolute',
      label: (t) => `Accumule ${fmtQ(t)} pièces en réserve` },
    { id: 'seq_evolve1', icon: '🧬', metric: 'maxEvolutionTier', target: 1, mode: 'absolute',
      label: () => 'Fais évoluer une créature au palier 1' },
  ],
  // --- Cycle 8 : rythme ---
  [
    { id: 'seq_power10', icon: '✨', metric: 'powerActivated', target: 10, mode: 'delta',
      label: (t) => `Active ${t} fois un pouvoir de créature` },
    { id: 'seq_main10', icon: '🖐️', metric: 'auto:main', target: 5, mode: 'absolute',
      label: (t) => `Possède ${t} Mains Spectrales` },
    { id: 'seq_adv_c3l10', icon: '⚔️', metric: 'advLevelReached', target: 25, mode: 'absolute',
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'seq_crit100', icon: '💥', metric: 'totalCrits', target: 140, mode: 'delta',
      label: (t) => `Obtiens ${t} coups critiques` },
    { id: 'seq_tap2lvl5', icon: '🪄', metric: 'tapUpgrade:tap2', target: 5, mode: 'absolute',
      label: (t) => `Monte Gantelet Runique au niveau ${t}` },
  ],
  // --- Cycle 9 : profondeur ---
  [
    { id: 'seq_hold10M', icon: '🏦', metric: 'coins', effortMin: 40, mode: 'absolute',
      label: (t) => `Accumule ${fmtQ(t)} pièces en réserve` },
    { id: 'seq_croc10', icon: '🪨', metric: 'upgrade:crocBouldog', effortMin: 30, mode: 'absolute',
      label: (t) => `Monte Croc de Bouldog au niveau ${t}` },
    { id: 'seq_fuse2', icon: '🔮', metric: 'runeFused', target: 1, mode: 'delta',
      label: (t) => `Fusionne ${t} rune${t > 1 ? 's' : ''}` },
    { id: 'seq_adv_c4l10', icon: '⚔️', metric: 'advLevelReached', target: 35, mode: 'absolute',
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'seq_tap3', icon: '🔱', metric: 'tapUpgrade:tap3', target: 1, mode: 'absolute',
      label: () => 'Débloque le Sceau de Puissance' },
  ],
  // --- Cycle 10 : seconde Ascension, dernier cycle scripté ---
  [
    { id: 'seq_hold50M', icon: '🏦', metric: 'coins', effortMin: 40, mode: 'absolute',
      label: (t) => `Accumule ${fmtQ(t)} pièces en réserve` },
    // Remplacé pour la même raison : le Veilleur est plafonné à 10.
        { id: 'seq_feed30', icon: '🍖', metric: 'maxCreatureLevel', effortMin: 35, mode: 'absolute',
      label: (t) => `Monte une créature au niveau ${t}` },
    // ⚠️ Même correction : en delta, ce défi exigeait 2 Ascensions de
    // PLUS (soit 3 au total pour un joueur qui en avait déjà une) alors
    // que le texte annonce « la seconde ». Il ne se validait jamais.
    { id: 'seq_ascend2', icon: '🌟', metric: 'ascension', target: 2, mode: 'absolute',
      label: (t) => (t === 2 ? 'Fais une seconde Ascension' : `Atteins ${t} Ascensions`) },
  ],
];
// ⚠️ AUCUN défi ne doit dépendre de l'INVOCATION.
//
// Les créatures viennent des ŒUFS ; le bouton « Invoquer » est destiné
// aux développeurs. Un défi « Invoque N créatures » serait donc
// INFAISABLE pour un joueur — et un seul défi infaisable bloque
// l'éclosion DÉFINITIVEMENT.
//
// `summon10` et `summon30` ont été retirés pour cette raison (15/09).
export const QUEST_POOL = [
  // ---------- Économie générale ----------
  { id: 'earnShort', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 10, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'earnMid', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 25, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'earnLong', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 60, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'holdShort', family: 'economy', icon: '🏦', metric: 'coins', effortMin: 15, mode: 'absolute',
    label: (t) => `Mets ${fmtQ(t)} pièces de côté` },
  { id: 'holdMid', family: 'economy', icon: '🏦', metric: 'coins', effortMin: 35, mode: 'absolute',
    label: (t) => `Accumule ${qtyQ(t, 'pièces')} en réserve` },
  { id: 'holdLong', family: 'economy', icon: '🏦', metric: 'coins', effortMin: 75, mode: 'absolute',
    label: (t) => `Constitue un trésor de ${fmtQ(t)} pièces` },
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
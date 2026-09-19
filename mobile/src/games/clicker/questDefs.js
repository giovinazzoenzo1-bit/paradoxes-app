// ⚠️ `QUEST_DEFS_VERSION` est déclarée EN FIN DE FICHIER : elle se
// calcule à partir de QUEST_SEQUENCE et QUEST_POOL, qui doivent donc
// être évalués avant. La placer ici lève « Cannot access before
// initialization » au démarrage de l'appli.


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

// ⚠️ La créature d'un objet se DÉDUIT de `UPGRADE_ITEMS`, jamais écrite
// en dur dans un `available`. « Griffe de Braisillon » appartient en
// réalité à `pyrosile` : la condition `ownedIds.includes('braisillon')`
// était toujours FAUSSE, donc le défi n'était jamais tiré et se faisait
// remplacer en silence par un défi du pool. Aucun contrôle ne le voyait.




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
  // ══════════════════ ŒUF 1 — RELANCER ══════════════════
  // Aucun défi d'Aventure ni de Rune ici : au tout premier œuf le joueur
  // n'a AUCUNE créature, donc pas de deck, donc pas de combat ni de
  // Griffes. Un défi injouable bloquerait l'œuf pour toujours. Le
  // schéma se répétant à chaque groupe, on le retire du SCHÉMA plutôt
  // que d'ajouter un cas particulier au premier groupe.
  [
    // ⚠️ L'ACCROCHE — la part la plus petite de tout le jeu.
    // C'est le tout premier défi qu'un joueur voit : il doit se boucler
    // en 2-3 minutes. À 1,2 % du seuil il en demandait 25, et le joueur
    // décrochait avant d'avoir compris à quoi sert le bouton.
    { id: 'g_e1_coins', icon: '🪙', metric: 'totalEarned', partAsc: 0.0015, mode: 'delta',
      label: (t) => `Obtiens ${fmtQ(t)} pièces` },
    { id: 'g_e1_pacte', icon: '🔗', metric: 'tapPower', partAsc: 0.01, mode: 'absolute',
      label: (t) => `Monte Pacte au niveau ${t}` },
    // ⚠️ `cap` OBLIGATOIRE sur une tenue de Transe : sans lui le plancher
    // « +15 % au-dessus de l'acquis » la poussait à 641 secondes.
    { id: 'g_e1_transe', icon: '🔥', metric: 'maxTranseHoldSec', target: 25, cap: 40, mode: 'absolute',
      label: (t) => `Reste en Transe x2,5 pendant ${t} secondes` },
    // ⚠️ Générateur NOMMÉ, jamais un total. « Possède 7 auto-clics en
    // tout » ne dit rien au joueur : il ne sait pas quoi acheter, et deux
    // chemins différents valident le même défi.
    { id: 'g_e1_auto1', icon: '👻', metric: 'auto:esprit', partAsc: 0.018, mode: 'absolute',
      label: (t) => `Possède ${t} Esprit${t > 1 ? 's' : ''} Frappeur${t > 1 ? 's' : ''}` },
    { id: 'g_e1_golden', icon: '⭐', metric: 'goldenClaimed', target: 3, mode: 'delta',
      label: (t) => (t > 1 ? `Touche ${t} fois la cible dorée` : 'Touche la cible dorée') },
  ],

  // ══════════════════ ŒUF 2 — AUTOMATISER ══════════════════
  // La première créature est arrivée et s'équipe toute seule : l'Aventure
  // devient jouable, et avec elle les Griffes.
  [
    { id: 'g_e2_passive', icon: '⚙️', metric: 'passiveIncome', partAsc: 0.05, mode: 'absolute',
      label: (t) => `Atteins ${fmtQ(t)} pièces par seconde` },
    // ⚠️⚠️ L'ORDRE DE CETTE CHAÎNE N'EST PAS DÉCORATIF.
    //
    // La boutique se déverrouille en cascade :
    //   Pacte 5 -> Faveur -> Dégâts critiques -> Sanctuaire -> Veilleur
    //
    // Le schéma demandait le Sanctuaire dès l'œuf 2 alors que RIEN ne
    // poussait le joueur à acheter la Faveur ni les Dégâts critiques.
    // Le défi était donc écarté faute de déblocage et le pool le
    // remplaçait : mesuré, 8 défis du schéma sur 12 œufs finissaient
    // remplacés, et la liste affichée ne correspondait plus à celle du
    // document de référence.
    //
    // Chaque maillon est désormais UN DÉFI, dans l'ordre : le joueur qui
    // suit ses défis ouvre mécaniquement le maillon suivant.
    { id: 'g_e2_faveur', icon: '🍀', metric: 'critLevel', partAsc: 0.04, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('faveur', s),
      label: (t) => `Monte la Faveur des Esprits au niveau ${t}` },
    { id: 'g_e2_adv', icon: '⚔️', metric: 'advLevelReached', step: 5, mode: 'absolute',
      // ⚠️ `ownedCount` et NON `deckCount` : `deckCount` compte les
      // créatures PLACÉES dans le deck d'Aventure. Un joueur qui possède
      // des créatures mais n'a pas encore garni son deck voyait tous ses
      // défis d'Aventure disparaître en silence, remplacés par des défis
      // du pool. Symptôme signalé : « à la place de chapitre 1 niveau 5,
      // c'est le défi de Sanctuaire qui apparaît ». Posséder une
      // créature suffit : le deck se remplit en deux gestes.
      available: (s) => (s.ownedCount || 0) > 0,
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'g_e2_crit', icon: '💥', metric: 'totalCrits', target: 30, mode: 'delta',
      label: (t) => `Obtiens ${t} coup${t > 1 ? 's' : ''} critique${t > 1 ? 's' : ''}` },
    // ⚠️ 6e défi de l'œuf 2 : le Sanctuaire et le premier palier
    // d'Aventure doivent apparaître TOUS LES DEUX. Ils se disputaient la
    // même place, et l'Aventure perdait dès que le deck était vide.
    // Un cycle peut compter 6 défis : l'œuf éclot quand tous sont
    // validés, jamais à un compte fixe.
    { id: 'g_e2_taps', icon: '👆', metric: 'totalTaps', target: 600, mode: 'delta',
      label: (t) => `Tape ${fmtQ(t)} fois` },
    { id: 'g_e2_auto2', icon: '🖐️', metric: 'auto:main', partAsc: 0.06, mode: 'absolute',
      label: (t) => `Possède ${t} Main${t > 1 ? 's' : ''} Spectrale${t > 1 ? 's' : ''}` },
  ],

  // ══════════════════ ŒUF 3 — RENFORCER ══════════════════
  [
    // ⚠️ SEULE réserve du groupe avant l'œuf 5.
    // « Accumule 38 000 pièces » suivi de « Constitue un trésor de
    // 43 000 » se lisait comme le même défi deux fois. Les deux défis de
    // trésor d'un groupe sont désormais séparés par deux œufs ET d'un
    // facteur 5 au moins sur la cible.
    { id: 'g_e3_hold', icon: '💰', metric: 'coins', partAsc: 0.10, mode: 'absolute',
      label: (t) => `Mets ${fmtQ(t)} pièces de côté` },
    // 2e maillon : ouvert par la Faveur de l'œuf 2, ouvre le Sanctuaire.
    { id: 'g_e3_critdmg', icon: '💢', metric: 'critDamageLevel', partAsc: 0.05, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('critDamage', s),
      label: (t) => `Monte les Dégâts critiques au niveau ${t}` },
    // ⚠️ TROIS défis de NIVEAU d'Aventure par groupe (œufs 2, 3 et 5),
    // chacun +5 niveaux, donc une campagne qui avance de 15 niveaux par
    // Ascension et qui se lit comme une suite : chapitre 1 niveau 5,
    // puis 10, puis chapitre 2 niveau 5…
    //
    // ⚠️ `advLevelReached` est ABSOLU et n'est PAS remis à zéro par une
    // Ascension — l'Aventure est une campagne, pas une économie. Un
    // `step` repart donc du niveau réellement atteint, jamais de zéro.
    { id: 'g_e3_adv', icon: '⚔️', metric: 'advLevelReached', step: 5, mode: 'absolute',
      // ⚠️ `ownedCount` et NON `deckCount` : `deckCount` compte les
      // créatures PLACÉES dans le deck d'Aventure. Un joueur qui possède
      // des créatures mais n'a pas encore garni son deck voyait tous ses
      // défis d'Aventure disparaître en silence, remplacés par des défis
      // du pool. Symptôme signalé : « à la place de chapitre 1 niveau 5,
      // c'est le défi de Sanctuaire qui apparaît ». Posséder une
      // créature suffit : le deck se remplit en deux gestes.
      available: (s) => (s.ownedCount || 0) > 0,
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'g_e3_power', icon: '✨', metric: 'powerActivated', target: 5, mode: 'delta',
      label: (t) => (t > 1 ? `Active ${t} fois un pouvoir` : 'Active un pouvoir') },
    // ⚠️ Les PALIERS DE TAP sortent du schéma : le premier exige Pacte 10
    // et chacun exige 5 niveaux du précédent. Rien ne garantit qu'un
    // joueur y soit au bon œuf, donc ils étaient systématiquement
    // remplacés. Ils restent dans le pool, où un remplacement est normal.
    { id: 'g_e3_auto3', icon: '🤖', metric: 'auto:automate', partAsc: 0.16, mode: 'absolute',
      label: (t) => `Achète ${t} Automate${t > 1 ? 's' : ''} Runique${t > 1 ? 's' : ''}` },
  ],

  // ══════════════════ ŒUF 4 — ÉQUIPER ══════════════════
  [
    { id: 'g_e4_rune', icon: '🔮', metric: 'runeBought', target: 1, mode: 'delta',
      label: (t) => (t > 1 ? `Achète ${t} runes` : 'Achète une rune') },
    // ⚠️ Pas de +2 : monter une créature de deux niveaux ne se remarque
    // pas. Le pas est assez grand pour être un objectif en soi.
    { id: 'g_e4_creature', icon: '🐣', metric: 'maxCreatureLevel', step: 14, mode: 'absolute',
      available: (s) => (s.ownedCount || 0) > 0,
      label: (t) => `Monte une créature au niveau ${t}` },
    { id: 'g_e4_stars', icon: '🌟', metric: 'threeStarLevel', target: 1, mode: 'delta',
      // ⚠️ `ownedCount` et NON `deckCount` : `deckCount` compte les
      // créatures PLACÉES dans le deck d'Aventure. Un joueur qui possède
      // des créatures mais n'a pas encore garni son deck voyait tous ses
      // défis d'Aventure disparaître en silence, remplacés par des défis
      // du pool. Symptôme signalé : « à la place de chapitre 1 niveau 5,
      // c'est le défi de Sanctuaire qui apparaît ». Posséder une
      // créature suffit : le deck se remplit en deux gestes.
      available: (s) => (s.ownedCount || 0) > 0,
      label: (t) => (t > 1
        ? `Décroche toutes les étoiles sur ${t} niveaux d'Aventure`
        : "Décroche toutes les étoiles sur un niveau d'Aventure") },
    // 3e maillon : ouvert par les Dégâts critiques de l'œuf 3.
    { id: 'g_e4_sanct', icon: '🏛️', metric: 'sanctuaryLevel', partAsc: 0.10, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('sanctuaire', s) && (s.sanctuaryLevel || 0) < SANCTUARY_MAX_LEVEL,
      label: (t) => `Monte le Sanctuaire au niveau ${t}` },
    // ⚠️ Remplace un défi d'objet de créature, supprimés parce qu'ils
    // étaient impossibles : ils pouvaient être tirés pour un joueur qui
    // ne possède pas la créature, et bloquaient l'œuf. Un palier de tap
    // est achetable par TOUT joueur.
    { id: 'g_e4_coins', icon: '🪙', metric: 'totalEarned', partAsc: 0.08, mode: 'delta',
      label: (t) => `Obtiens ${fmtQ(t)} pièces` },
  ],

  // ══════════════════ ŒUF 5 — MAÎTRISER ══════════════════
  [
    // Facteur 5 au moins sur la réserve de l'œuf 3 : c'est un cran, pas
    // une répétition.
    { id: 'g_e5_hold', icon: '💰', metric: 'coins', partAsc: 0.55, mode: 'absolute',
      label: (t) => `Mets ${fmtQ(t)} pièces de côté` },
    { id: 'g_e5_auto3', icon: '🤖', metric: 'auto:automate', partAsc: 0.20, mode: 'absolute',
      label: (t) => `Achète ${t} Automate${t > 1 ? 's' : ''} Runique${t > 1 ? 's' : ''}` },
    { id: 'g_e5_adv', icon: '⚔️', metric: 'advLevelReached', step: 5, mode: 'absolute',
      // ⚠️ `ownedCount` et NON `deckCount` : `deckCount` compte les
      // créatures PLACÉES dans le deck d'Aventure. Un joueur qui possède
      // des créatures mais n'a pas encore garni son deck voyait tous ses
      // défis d'Aventure disparaître en silence, remplacés par des défis
      // du pool. Symptôme signalé : « à la place de chapitre 1 niveau 5,
      // c'est le défi de Sanctuaire qui apparaît ». Posséder une
      // créature suffit : le deck se remplit en deux gestes.
      available: (s) => (s.ownedCount || 0) > 0,
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'g_e5_transe', icon: '🔥', metric: 'maxTranseHoldSec', target: 45, cap: 75, mode: 'absolute',
      label: (t) => `Tiens la Transe pendant ${t} secondes` },
    // 4e et dernier maillon : ouvert par le Sanctuaire de l'œuf 4.
    { id: 'g_e5_veilleur', icon: '🌙', metric: 'veilleurLevel', partAsc: 0.12, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('veilleur', s) && (s.veilleurLevel || 0) < VEILLEUR_MAX_LEVEL,
      label: (t) => `Monte le Veilleur au niveau ${t}` },
  ],

  // ══════════════════ ŒUF 6 — FRANCHIR ══════════════════
  // Le dernier effort avant l'Ascension. Les parts sont les plus grosses
  // du groupe : c'est là que le joueur finit de remplir le seuil.
  [
    { id: 'g_e6_coins', icon: '🪙', metric: 'totalEarned', partAsc: 0.30, mode: 'delta',
      label: (t) => `Obtiens ${fmtQ(t)} pièces` },
    // Les Dégâts critiques : la seule des 5 améliorations de base qui
    // n'avait aucun défi, et elle renforce le TAP.
    // ⚠️ Cette place a porté deux mauvais défis avant celui-ci.
    //
    // Les Dégâts critiques d'abord : doublon avec l'œuf 3. Puis le
    // Sanctuaire : il PLAFONNE à 50 et l'œuf 4 y monte déjà, donc son
    // `available` devenait faux et le pool le remplaçait — le contrôle
    // `auditRemplacements` l'a attrapé avant la publication.
    //
    // Le Pacte n'a ni plafond ni prérequis : il est toujours disponible,
    // et c'est un dernier coup de pouce cohérent juste avant l'Ascension.
    { id: 'g_e6_pacte', icon: '🔗', metric: 'tapPower', partAsc: 0.22, mode: 'absolute',
      label: (t) => `Monte Pacte au niveau ${t}` },
    { id: 'g_e6_adv', icon: '🗡️', metric: 'battleWon', target: 6, mode: 'delta',
      // ⚠️ `ownedCount` et NON `deckCount` : `deckCount` compte les
      // créatures PLACÉES dans le deck d'Aventure. Un joueur qui possède
      // des créatures mais n'a pas encore garni son deck voyait tous ses
      // défis d'Aventure disparaître en silence, remplacés par des défis
      // du pool. Symptôme signalé : « à la place de chapitre 1 niveau 5,
      // c'est le défi de Sanctuaire qui apparaît ». Posséder une
      // créature suffit : le deck se remplit en deux gestes.
      available: (s) => (s.ownedCount || 0) > 0,
      label: (t) => `Gagne ${t} combat${t > 1 ? 's' : ''} en Aventure` },
    { id: 'g_e6_offering', icon: '🕯️', metric: 'offering', target: 1, mode: 'delta',
      label: (t) => (t > 1 ? `Fais ${t} Offrandes` : 'Fais une Offrande') },
    // ⚠️ `step: 1` et NON une cible en dur.
    //
    // Il n'existait que deux défis d'Ascension (`target: 1` et
    // `target: 2`) : passé la 2e, plus AUCUN défi n'en demandait, et la
    // séquence cessait de structurer le jeu pour les 16 œufs suivants.
    // Avec un pas, chaque passage du groupe demande l'Ascension
    // SUIVANTE, indéfiniment.
    { id: 'g_e6_ascend', icon: '🌟', metric: 'ascension', step: 1, mode: 'absolute',
      label: (t) => `Fais ta ${t}${t === 1 ? 're' : 'e'} Ascension` },
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
  { id: 'holdLong', family: 'economy', icon: '🏦', metric: 'coins', effortMin: 75, mode: 'absolute',
    label: (t) => `Mets ${fmtQ(t)} pièces de côté` },
  { id: 'passiveMid', family: 'economy', icon: '📈', metric: 'passiveIncome', effortMin: 30, mode: 'absolute',
    label: (t) => `Atteins ${qtyQ(t, 'pièces')} par seconde` },
  { id: 'passiveLong', family: 'economy', icon: '📈', metric: 'passiveIncome', effortMin: 70, mode: 'absolute',
    label: (t) => `Atteins ${qtyQ(t, 'pièces')} par seconde` },

  // ---------- Mécaniques historiques ----------
  // ⚠️ Deux familles ajoutées le 17/09.
  //
  // `totalTaps` : le seul défi qui ne dépend d'AUCUNE ressource. Aucun
  // risque de blocage, aucune précondition — il est toujours faisable.
  // Cible dérivée de la cadence de référence, jamais écrite en dur.
  { id: 'tapCount', family: 'tap', icon: '👆', metric: 'totalTaps', target: 600, mode: 'delta',
    label: (t) => `Tape ${t.toLocaleString('fr-FR')} fois` },
  { id: 'tapCountLong', family: 'tap', icon: '👆', metric: 'totalTaps', target: 2000, mode: 'delta',
    label: (t) => `Tape ${t.toLocaleString('fr-FR')} fois` },
  // `threeStarLevel` : se règle avec les combats DÉJÀ faits pour les
  // défis de niveau d'Aventure — de la variété sans une énergie de plus.
  // ⚠️ Exige un deck : la précondition d'Aventure s'applique.
  // ⚠️ Libellé SANS le nombre « 3 ». Première écriture : « Obtiens 3
  // étoiles sur un niveau » — `auditLibelles()` l'a signalé à raison, le
  // 3 désigne les étoiles et la cible vaut 1 NIVEAU. Deux nombres
  // différents dans la même phrase, c'est exactement ce que le contrôle
  // doit refuser, et c'est ainsi qu'un joueur lit une cible fausse.
  // `available` : sans deck, l'Aventure est injouable et l'œuf bloque.
  { id: 'advThreeStar', family: 'adventure', icon: '🌟', metric: 'threeStarLevel', target: 1, mode: 'delta',
    available: (s) => (s.deckCount || 0) > 0,
    label: (t) => (t > 1
      ? `Décroche toutes les étoiles sur ${t} niveaux d'Aventure`
      : "Décroche toutes les étoiles sur un niveau d'Aventure") },
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
  // ⚠️ « Possède N auto-clics EN TOUT » SUPPRIMÉ.
  //
  // Un total ne dit rien au joueur : il ne sait pas quoi acheter, et
  // deux chemins très différents valident le même défi. Un générateur
  // NOMMÉ (« Possède 4 Mains Spectrales ») indique la cible et pousse
  // vers un palier précis de la boutique. Tous les défis de génération
  // passent par `auto:<id>`.

  // ---------- Rythme d'action (cibles FIXES) ----------
  // Ces défis ne coûtent pas de pièces mais du temps de jeu actif : les
  // convertir en budget n'aurait aucun sens.
  { id: 'combo25', family: 'action', icon: '🔥', metric: 'maxCombo', target: 25, cap: 60, mode: 'absolute',
    label: () => 'Atteins un multiplicateur de Transe x2,5' },
  { id: 'combo30', family: 'action', icon: '🔥', metric: 'maxCombo', target: 30, cap: 80, mode: 'absolute',
    available: (s) => (s.maxCombo || 0) >= 20,
    label: () => 'Atteins un multiplicateur de Transe x3' },
  // `critChance(0)` vaut exactement 0 : sans Faveur des Esprits, aucun
  // coup critique ne peut tomber. Mais le 1er niveau ne coûte que 25
  // pièces — le défi est donc parfaitement atteignable dès le début, il
  // demande juste d'acheter la Faveur d'abord. On ne le bloque donc que
  // pour un joueur qui n'a pas encore de quoi se la payer.
  { id: 'crit20', family: 'action', icon: '💥', metric: 'totalCrits', target: 20, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && ((s.critLevel || 0) >= 1 || (s.coins || 0) >= critUpgradeCost(0) || questBudget(s, 5) >= critUpgradeCost(0)),
    label: (t) => `Obtiens ${t} coup${t > 1 ? 's' : ''} critique${t > 1 ? 's' : ''}` },
  { id: 'crit100', family: 'action', icon: '💥', metric: 'totalCrits', target: 100, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && (s.critLevel || 0) >= 2,
    label: (t) => `Obtiens ${t} coup${t > 1 ? 's' : ''} critique${t > 1 ? 's' : ''}` },
  { id: 'crit400', family: 'action', icon: '💥', metric: 'totalCrits', target: 200, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && (s.critLevel || 0) >= 5,
    label: (t) => `Obtiens ${t} coup${t > 1 ? 's' : ''} critique${t > 1 ? 's' : ''}` },
  { id: 'golden3', family: 'action', icon: '⭐', metric: 'goldenClaimed', target: 3, mode: 'delta',
    label: (t) => (t > 1 ? `Touche ${t} fois la cible dorée` : 'Touche la cible dorée') },
  // La cible dorée n'apparaît qu'une fois toutes les 45-90 secondes :
  // 10 captures demandent une bonne dizaine de minutes de présence
  // continue. Réservé à un joueur qui en a déjà attrapé.
  { id: 'golden10', family: 'action', icon: '⭐', metric: 'goldenClaimed', target: 10, mode: 'delta',
    available: (s) => (s.goldenClaimed || 0) >= 3,
    label: (t) => (t > 1 ? `Touche ${t} fois la cible dorée` : 'Touche la cible dorée') },
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

// ⚠️⚠️ VERSION DES DÉFINITIONS — CALCULÉE, plus jamais à la main.
//
// Les défis sont VERROUILLÉS au tirage : leur cible est figée quand
// l'œuf les distribue, puis persistée. C'est voulu — sans ça la cible
// suivrait le porte-monnaie du joueur et s'éloignerait sans fin. Mais ça
// veut dire qu'un changement ici n'a AUCUN effet sur l'œuf en cours.
//
// Ce numéro le règle : au chargement, s'il diffère de celui de la
// sauvegarde, les défis de l'œuf en cours sont retirés au sort avec les
// nouvelles définitions (le reste de la partie n'est pas touché).
//
// ⚠️ Il était écrit à la main, et c'était le SEUL point de la chaîne
// qu'aucun contrôle ne couvrait : l'oublier en ajoutant un défi, et
// l'auteur ne voit pas son changement — il croit à un bug de
// publication. C'est arrivé le 17/09.
//
// Il se calcule maintenant à partir de la STRUCTURE des défis : ids,
// métriques, modes, cibles, parts, pas et plafonds. Ajouter, retirer ou
// régler un défi change le numéro tout seul.
//
// Les LIBELLÉS ne sont volontairement pas dans le calcul : ils sont des
// fonctions de la cible, donc un texte modifié s'affiche correctement
// sans qu'il faille retirer les défis au sort.
function empreinteDefis() {
  const morceaux = [];
  const decrire = (q) => morceaux.push([
    q.id, q.metric, q.mode,
    q.target == null ? '' : q.target,
    q.partAsc == null ? '' : q.partAsc,
    q.effortMin == null ? '' : q.effortMin,
    q.step == null ? '' : q.step,
    q.cap == null ? '' : q.cap,
  ].join('|'));
  QUEST_SEQUENCE.forEach((cycle) => cycle.forEach(decrire));
  QUEST_POOL.forEach(decrire);
  const texte = morceaux.join(';');
  // Hachage simple et stable (djb2). Pas de dépendance, même résultat
  // sur tous les téléphones.
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h * 33) ^ texte.charCodeAt(i)) >>> 0;
  return h;
}

export const QUEST_DEFS_VERSION = empreinteDefis();

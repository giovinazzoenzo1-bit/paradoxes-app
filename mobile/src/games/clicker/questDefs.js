// ⚠️⚠️ VERSION DES DÉFINITIONS DE DÉFIS — à INCRÉMENTER à chaque fois
// qu'une cible, un libellé ou une famille change ici.
//
// Les défis sont VERROUILLÉS au tirage : leur cible est figée au moment
// où l'œuf les distribue, et persistée. C'est voulu (sans ça la cible
// suivrait le porte-monnaie du joueur et s'éloignerait sans fin). Mais
// ça veut dire qu'un changement dans ce fichier n'a AUCUN effet sur
// l'œuf en cours — il faudrait attendre l'œuf suivant pour le voir.
//
// Ce numéro règle le problème : au chargement, s'il a changé depuis la
// dernière sauvegarde, les défis de l'œuf en cours sont RETIRÉS et
// retirés au sort avec les nouvelles définitions. L'avancement de l'œuf
// lui-même (cycle, éclosion, créatures, pièces) n'est pas touché.
//
// ⚠️ Oublier de l'incrémenter = l'auteur ne voit pas son changement et
// croit à un bug de publication. C'est arrivé le 17/09.
export const QUEST_DEFS_VERSION = 5;

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
  // ══════════════════ ŒUF 1 — RELANCER ══════════════════
  // Aucun défi d'Aventure ni de Rune ici : au tout premier œuf le joueur
  // n'a AUCUNE créature, donc pas de deck, donc pas de combat ni de
  // Griffes. Un défi injouable bloquerait l'œuf pour toujours. Le
  // schéma se répétant à chaque groupe, on le retire du SCHÉMA plutôt
  // que d'ajouter un cas particulier au premier groupe.
  [
    // ⚠️ L'ACCROCHE — la part la plus petite de tout le jeu.
    //
    // C'est le tout premier défi qu'un joueur voit. Le doc répète depuis
    // longtemps qu'il doit se boucler en 2-3 minutes : à 1,2 % du seuil
    // il en demandait 25, et le joueur décrochait avant d'avoir compris
    // à quoi sert le bouton.
    { id: 'g_e1_coins', icon: '🪙', metric: 'totalEarned', partAsc: 0.0015, mode: 'delta',
      label: (t) => `Obtiens ${fmtQ(t)} pièces` },
    { id: 'g_e1_pacte', icon: '🔗', metric: 'tapPower', partAsc: 0.02, mode: 'absolute',
      label: (t) => `Monte Pacte au niveau ${t}` },
    // ⚠️ `cap` OBLIGATOIRE sur une tenue de Transe : sans lui le plancher
    // « +15 % au-dessus de l'acquis » la poussait à 641 secondes.
    { id: 'g_e1_transe', icon: '🔥', metric: 'maxTranseHoldSec', target: 25, cap: 40, mode: 'absolute',
      label: (t) => `Reste en Transe x2,5 pendant ${t} secondes` },
    { id: 'g_e1_auto1', icon: '👻', metric: 'auto:esprit', partAsc: 0.03, mode: 'absolute',
      label: (t) => `Possède ${t} Esprits Frappeurs` },
    { id: 'g_e1_golden', icon: '⭐', metric: 'goldenClaimed', target: 3, mode: 'delta',
      label: (t) => `Touche ${t} fois la cible dorée` },
  ],

  // ══════════════════ ŒUF 2 — AUTOMATISER ══════════════════
  // La première créature est arrivée et s'équipe toute seule : l'Aventure
  // devient jouable, et avec elle les Griffes.
  [
    { id: 'g_e2_passive', icon: '⚙️', metric: 'passiveIncome', partAsc: 0.05, mode: 'absolute',
      label: (t) => `Atteins ${fmtQ(t)} pièces par seconde` },
    { id: 'g_e2_sanct', icon: '🏛️', metric: 'sanctuaryLevel', partAsc: 0.06, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('sanctuaire', s) && (s.sanctuaryLevel || 0) < SANCTUARY_MAX_LEVEL,
      label: (t) => `Monte le Sanctuaire au niveau ${t}` },
    { id: 'g_e2_adv', icon: '⚔️', metric: 'advLevelReached', step: 5, mode: 'absolute',
      available: (s) => (s.deckCount || 0) > 0,
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'g_e2_crit', icon: '💥', metric: 'totalCrits', target: 30, mode: 'delta',
      label: (t) => `Obtiens ${t} coups critiques` },
    { id: 'g_e2_taps', icon: '👆', metric: 'totalTaps', target: 1200, mode: 'delta',
      label: (t) => `Tape ${fmtQ(t)} fois` },
  ],

  // ══════════════════ ŒUF 3 — RENFORCER ══════════════════
  [
    { id: 'g_e3_hold', icon: '💰', metric: 'coins', partAsc: 0.08, mode: 'absolute',
      label: (t) => `Constitue un trésor de ${fmtQ(t)} pièces` },
    { id: 'g_e3_veilleur', icon: '🌙', metric: 'veilleurLevel', partAsc: 0.07, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('veilleur', s) && (s.veilleurLevel || 0) < VEILLEUR_MAX_LEVEL,
      label: (t) => `Monte le Veilleur au niveau ${t}` },
    { id: 'g_e3_battles', icon: '🗡️', metric: 'battleWon', target: 4, mode: 'delta',
      available: (s) => (s.deckCount || 0) > 0,
      label: (t) => `Gagne ${t} combats en Aventure` },
    { id: 'g_e3_power', icon: '✨', metric: 'powerActivated', target: 5, mode: 'delta',
      label: (t) => `Active ${t} fois un pouvoir` },
    { id: 'g_e3_tapup', icon: '✊', metric: 'tapUpgrade:tap1', partAsc: 0.05, mode: 'absolute',
      available: (s) => (s.tapPower || 1) >= 10,
      label: (t) => `Monte la Poigne Ancienne au niveau ${t}` },
  ],

  // ══════════════════ ŒUF 4 — ÉQUIPER ══════════════════
  [
    { id: 'g_e4_rune', icon: '🔮', metric: 'runeBought', target: 1, mode: 'delta',
      label: (t) => (t > 1 ? `Achète ${t} runes` : 'Achète une rune') },
    { id: 'g_e4_creature', icon: '🐣', metric: 'maxCreatureLevel', step: 2, mode: 'absolute',
      available: (s) => (s.ownedCount || 0) > 0,
      label: (t) => `Monte une créature au niveau ${t}` },
    { id: 'g_e4_stars', icon: '🌟', metric: 'threeStarLevel', target: 1, mode: 'delta',
      available: (s) => (s.deckCount || 0) > 0,
      label: (t) => (t > 1
        ? `Décroche toutes les étoiles sur ${t} niveaux d'Aventure`
        : "Décroche toutes les étoiles sur un niveau d'Aventure") },
    { id: 'g_e4_faveur', icon: '🍀', metric: 'critLevel', partAsc: 0.04, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('faveur', s),
      label: (t) => `Monte la Faveur des Esprits au niveau ${t}` },
    { id: 'g_e4_item', icon: '🔧', metric: 'upgrade:griffeBraisillon', partAsc: 0.05, mode: 'absolute',
      available: (s) => (s.ownedIds || []).includes('braisillon'),
      label: (t) => `Monte Griffe de Braisillon au niveau ${t}` },
  ],

  // ══════════════════ ŒUF 5 — MAÎTRISER ══════════════════
  [
    { id: 'g_e5_hold', icon: '💰', metric: 'coins', partAsc: 0.20, mode: 'absolute',
      label: (t) => `Constitue un trésor de ${fmtQ(t)} pièces` },
    { id: 'g_e5_auto2', icon: '🖐️', metric: 'auto:main', partAsc: 0.18, mode: 'absolute',
      label: (t) => `Possède ${t} Mains Spectrales` },
    { id: 'g_e5_adv', icon: '⚔️', metric: 'advLevelReached', step: 5, mode: 'absolute',
      available: (s) => (s.deckCount || 0) > 0,
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'g_e5_transe', icon: '🔥', metric: 'maxTranseHoldSec', target: 45, cap: 75, mode: 'absolute',
      label: (t) => `Tiens la Transe pendant ${t} secondes` },
    { id: 'g_e5_fuse', icon: '⚗️', metric: 'runeFused', target: 1, mode: 'delta',
      available: (s) => (s.runeBought || 0) >= 2,
      label: (t) => (t > 1 ? `Fusionne ${t} fois des runes` : 'Fusionne 2 runes en 1') },
  ],

  // ══════════════════ ŒUF 6 — FRANCHIR ══════════════════
  // Le dernier effort avant l'Ascension. Les parts sont les plus grosses
  // du groupe : c'est là que le joueur finit de remplir le seuil.
  [
    { id: 'g_e6_coins', icon: '🪙', metric: 'totalEarned', partAsc: 0.30, mode: 'delta',
      label: (t) => `Obtiens ${fmtQ(t)} pièces` },
    { id: 'g_e6_item', icon: '🔧', metric: 'upgrade:crocBouldog', partAsc: 0.12, mode: 'absolute',
      available: (s) => (s.ownedIds || []).includes('bouldog'),
      label: (t) => `Monte Croc de Bouldog au niveau ${t}` },
    { id: 'g_e6_offering', icon: '🕯️', metric: 'offering', target: 1, mode: 'delta',
      label: (t) => (t > 1 ? `Fais ${t} Offrandes` : 'Fais une Offrande') },
    { id: 'g_e6_taps', icon: '👆', metric: 'totalTaps', target: 4000, mode: 'delta',
      label: (t) => `Tape ${fmtQ(t)} fois` },
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
  // ⚠️ Deux familles ajoutées le 17/09.
  //
  // `totalTaps` : le seul défi qui ne dépend d'AUCUNE ressource. Aucun
  // risque de blocage, aucune précondition — il est toujours faisable.
  // Cible dérivée de la cadence de référence, jamais écrite en dur.
  { id: 'tapCount', family: 'tap', icon: '👆', metric: 'totalTaps', target: 1200, mode: 'delta',
    label: (t) => `Tape ${t.toLocaleString('fr-FR')} fois` },
  { id: 'tapCountLong', family: 'tap', icon: '👆', metric: 'totalTaps', target: 4000, mode: 'delta',
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
  { id: 'autoTotalMid', family: 'core', icon: '🔧', metric: 'autoTotal', effortMin: 30, mode: 'absolute',
    label: (t) => `Possède ${fmtQ(t)} auto-clics en tout` },
  { id: 'autoTotalLong', family: 'core', icon: '🔧', metric: 'autoTotal', effortMin: 65, mode: 'absolute',
    label: (t) => `Possède ${fmtQ(t)} auto-clics en tout` },

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
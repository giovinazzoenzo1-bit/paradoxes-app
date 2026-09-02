// Clicker de Créatures — nouveau jeu (pas un port du PWA), premier jeu du
// menu. Thème choisi avec l'utilisateur : créatures à collectionner et
// faire évoluer (esprit gacha/collection), pour viser un public 10-25 ans.
// Roster ENTIÈREMENT ORIGINAL — aucune créature, aucun nom, ne reprend
// Pokémon ou toute autre franchise protégée par le droit d'auteur ; seul
// le PRINCIPE générique (élément, 3 stades d'évolution, rareté) est repris,
// ce qui n'est pas protégeable en soi. Toute la logique ici est pure
// (aucune dépendance UI), testable en isolation.

// Chaque créature a 3 stades (base, évolution 1 à niveau 5, évolution 2 à
// niveau 15). baseIncome = pièces/seconde à niveau 1 du stade de base.

// Génère les 4 compétences d'une créature avec des DÉGÂTS FIXES et un
// COÛT EN ENDURANCE (pas des multiplicateurs) — aligné sur le format
// produit par le générateur de créatures Gemini de l'utilisateur. Le
// multiplicateur de vitesse du défi de tap (voir combatLogic.js)
// s'applique PAR-DESSUS ce nombre au moment du combat. Utilisé au
// combat : le joueur choisit UNE des 4 à chaque tour, tant qu'il a assez
// d'endurance pour se la payer.
function mkSkills(entries) {
  return entries.map(([name, damage, enduranceCost], i) => ({ id: `s${i + 1}`, name, damage, enduranceCost }));
}

// Table de migration : quand une créature est renommée/remplacée par une
// version Gemini (nouvel id), toute sauvegarde existante qui référence
// l'ANCIEN id (dans `owned` ou `deck`) doit être redirigée vers le
// nouveau — sinon `CREATURES.find(id)` renvoie undefined et fait planter
// tout ce qui essaie de lire `.stages`/`.skills`/etc. sur le résultat
// (crash réel rencontré : DeckPicker plantait pour les joueurs ayant déjà
// "braisillon" ou "gouttelin" en collection/deck avant leur remplacement).
// À compléter à chaque remplacement d'une créature d'origine par Gemini.
export const CREATURE_ID_MIGRATIONS = {
  braisillon: 'pyrosile',
  gouttelin: 'caraploof',
  cailloutin: 'bouldog',
  bourgeonin: 'ventis',
  etincelot: 'voltix',
  lumeret: 'luxorbe',
  ombrelin: 'ombrillon',
  frimouss: 'glyphon',
  gemmion: 'fournax',
};

// Applique la migration à un id de créature — renvoie l'id tel quel s'il
// n'y a rien à migrer.
export function migrateCreatureId(id) {
  return CREATURE_ID_MIGRATIONS[id] || id;
}

export const CREATURES = [
  // Remplace Braisillon (29/08) — 1ère créature du roster à venir du
  // générateur Gemini de l'utilisateur, stats explicites (baseHp/etc.)
  // au lieu de la formule par rareté. combatType en minuscules
  // (Gemini a donné "Attaquant"), rarity en minuscules sans accent.
  { id: 'pyrosile', element: 'Feu', rarity: 'commun', baseIncome: 0.15, combatType: 'attaquant',
    baseHp: 10, baseAttack: 3, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Morsure Chaude', 2, 5], ['Cendres Aveuglantes', 1, 10], ['Souffle de Braise', 3, 15], ['Tête Brûlée', 5, 25]]),
    lore: "Ce petit lézard volcanique se nourrit exclusivement de cendres chaudes trouvées près des cratères. Bien que de petite taille, il crache des flammèches capables de brûler gravement ses adversaires. Il est souvent le premier compagnon d'entraînement des jeunes pyromanciens.",
    stages: [
    { name: 'Pyrosile', emoji: '🦎' }, { name: 'Pyrosile', emoji: '🦎' }, { name: 'Pyrosile', emoji: '🦎' },
  ]},
  { id: 'caraploof', element: 'Eau', rarity: 'commun', baseIncome: 0.15, combatType: 'tank',
    baseHp: 15, baseAttack: 2, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Bulle Aqueuse', 1, 5], ['Jet Baveux', 2, 10], ['Charge Coquille', 2, 15], ['Éclaboussure Lourde', 3, 25]]),
    lore: "Caraploof est une petite tortue des ruisseaux dotée d'une coquille très dense qui absorbe parfaitement les chocs. Très lente et peu agressive, elle préfère encaisser les coups plutôt que de fuir, servant souvent de bouclier aux autres créatures de sa mare. On la trouve principalement assoupie sous les nénuphars.",
    stages: [
    { name: 'Caraploof', emoji: '🐢' }, { name: 'Caraploof', emoji: '🐢' }, { name: 'Caraploof', emoji: '🐢' },
  ]},
  { id: 'ventis', element: 'Air', rarity: 'commun', baseIncome: 0.15, combatType: 'attaquant',
    baseHp: 10, baseAttack: 3, baseClickSpeed: 1, baseEndurance: 100,
    // "Bourrasque" renommée en "Bourrasque Légère" — collision avec
    // l'attaque de Brisillon (Air, Rare, toujours présent pour l'instant).
    skills: mkSkills([['Brise Légère', 2, 5], ['Plume Coupante', 3, 10], ['Bourrasque Légère', 4, 15], ['Piqué Tornade', 5, 25]]),
    lore: "Ventis est un petit esprit aviaire formé de courants d'air tourbillonnants qui adore chasser dans les tempêtes. Ses ailes génèrent de violentes bourrasques capables de déséquilibrer n'importe quel agresseur. Bien qu'il soit très commun dans les plaines, son caractère imprévisible en fait un adversaire particulièrement vif.",
    stages: [
    { name: 'Ventis', emoji: '🐦' }, { name: 'Ventis', emoji: '🐦' }, { name: 'Ventis', emoji: '🐦' },
  ]},
  { id: 'bouldog', element: 'Terre', rarity: 'commun', baseIncome: 0.15, combatType: 'tank',
    baseHp: 14, baseAttack: 2, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Coup de Truffe', 1, 5], ['Jet de Cailloux', 2, 10], ['Morsure Terrestre', 2, 15], ['Chute de Gravier', 3, 25]]),
    lore: "Ce petit chien de pierre patrouille inlassablement dans les carrières abandonnées pour protéger son territoire. Son corps fait de rocaille agglomérée lui permet d'encaisser de lourds impacts sans broncher. Bien qu'il soit affectueux avec ses maîtres, il reste un véritable mur de briques face aux ennemis.",
    stages: [
    { name: 'Bouldog', emoji: '🐕' }, { name: 'Bouldog', emoji: '🐕' }, { name: 'Bouldog', emoji: '🐕' },
  ]},
  { id: 'voltix', element: 'Foudre', rarity: 'commun', baseIncome: 0.15, combatType: 'attaquant',
    baseHp: 10, baseAttack: 3, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Étincelle Statique', 2, 5], ['Choc Poilu', 3, 10], ['Morsure Électrique', 4, 15], ['Décharge Flash', 5, 25]]),
    lore: "Voltix est un petit rongeur survolté qui génère de l'électricité statique en frottant sa fourrure. Incapable de tenir en place, il décharge son énergie nerveuse sur tout ce qu'il touche. Bien que faible seul, un groupe de Voltix peut provoquer de sérieuses pannes de courant.",
    stages: [
    { name: 'Voltix', emoji: '🐹' }, { name: 'Voltix', emoji: '🐹' }, { name: 'Voltix', emoji: '🐹' },
  ]},
  { id: 'brisillon', element: 'Air', rarity: 'rare', baseIncome: 0.4, combatType: 'attaquant',
    skills: mkSkills([['Bourrasque', 9, 20], ['Lame de Vent', 17, 20], ['Tourbillon', 26, 20], ['Cyclone', 37, 20]]),
    lore: "Brisillon n'a jamais posé une patte au sol de sa vie. Certains prétendent qu'il est né en plein vol.",
    stages: [
    { name: 'Brisillon', emoji: '🐦' }, { name: 'Tourbillan', emoji: '🦅' }, { name: 'Zéphyrion', emoji: '🕊️' },
  ]},
  { id: 'glyphon', element: 'Magie', rarity: 'commun', baseIncome: 0.15, combatType: 'soutien',
    baseHp: 12, baseAttack: 2, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Onde Runique', 1, 5], ['Poussière de Mana', 2, 10], ['Aura Apaisante', 1, 15], ['Choc Arcanique', 3, 25]]),
    lore: "Glyphon est une petite rune flottante qui s'est imprégnée de magie résiduelle dans les vieilles bibliothèques. Il s'attache souvent aux jeunes sorciers pour les aider à canaliser leurs premiers sorts. Bien qu'il soit fragile, sa présence apaise les esprits et renforce les enchantements de ses alliés.",
    stages: [
    { name: 'Glyphon', emoji: '🔮' }, { name: 'Glyphon', emoji: '🔮' }, { name: 'Glyphon', emoji: '🔮' },
  ]},
  { id: 'ombrillon', element: 'Ténèbres', rarity: 'commun', baseIncome: 0.15, combatType: 'attaquant',
    baseHp: 10, baseAttack: 3, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([["Griffe d'Ombre", 2, 5], ["Jet d'Obscurité", 3, 10], ['Regard Panique', 4, 15], ['Frappe Nocturne', 5, 25]]),
    lore: "Ombrillon est une petite entité née dans les recoins obscurs des vieilles caves. Bien qu'il soit chétif et souvent ignoré, il se nourrit des petites peurs pour gagner en agressivité. Ses frappes furtives surprennent toujours ceux qui s'aventurent sans torche dans le noir.",
    stages: [
    { name: 'Ombrillon', emoji: '🦇' }, { name: 'Ombrillon', emoji: '🦇' }, { name: 'Ombrillon', emoji: '🦇' },
  ]},
  { id: 'luxorbe', element: 'Lumière', rarity: 'commun', baseIncome: 0.15, combatType: 'soutien',
    baseHp: 12, baseAttack: 2, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Rayon Faible', 1, 5], ['Lueur Aveuglante', 2, 10], ['Éclat Chaleureux', 1, 15], ['Flash Purificateur', 3, 25]]),
    lore: "Luxorbe est une petite sphère rayonnante qui flotte dans les forêts anciennes pour guider les voyageurs perdus. Dépourvue de véritable corps physique, elle émet une aura apaisante qui revigore ses compagnons. Bien qu'inoffensive en apparence, sa lumière concentrée peut éblouir quiconque menace la paix des bois.",
    stages: [
    { name: 'Luxorbe', emoji: '✨' }, { name: 'Luxorbe', emoji: '✨' }, { name: 'Luxorbe', emoji: '✨' },
  ]},
  // Dernière créature d'origine du roster remplacée ici (29/08) — à
  // partir de la suivante, le roster GRANDIT au-delà de 11 (plus rien à
  // sacrifier) jusqu'à atteindre les 25 prévues.
  { id: 'fournax', element: 'Feu', rarity: 'peu_commun', baseIncome: 0.15, combatType: 'tank',
    baseHp: 30, baseAttack: 3, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Frappe Cendrée', 2, 10], ['Bouclier de Braise', 3, 15], ['Charge Magmatique', 5, 20], ['Éruption Lourde', 7, 30]]),
    lore: "Fournax est une créature trapue recouverte d'une épaisse carapace de magma refroidi. Très lent, il encaisse les coups en faisant fondre les armes de ses agresseurs au contact de son corps brûlant. Il se place toujours en première ligne pour servir de mur de chaleur impénétrable.",
    stages: [
    { name: 'Fournax', emoji: '🗿' }, { name: 'Fournax', emoji: '🗿' }, { name: 'Fournax', emoji: '🗿' },
  ]},
  // Première créature produite via le générateur Gemini de l'utilisateur
  // (29/08). PV/ATQ reproduits EXACTEMENT par la formule existante
  // (épique + attaquant), vérifié avant intégration — voir combatLogic.js.
  // Pas de stades d'évolution dans le format Gemini pour l'instant (les 3
  // slots répètent la même forme) : à retravailler si des évolutions
  // distinctes sont voulues pour les prochaines créatures.
  { id: 'solarion', element: 'Lumière', rarity: 'epique', baseIncome: 1.0, combatType: 'attaquant',
    skills: mkSkills([
      ['Éclat Aveuglant', 18, 30], ['Rayon Stellaire', 35, 30],
      ["Lame de l'Aurore", 55, 30], ['Éruption Solaire', 85, 30],
    ]),
    lore: "Guerrier forgé dans le cœur d'une étoile mourante. Canalise les rayons solaires concentrés pour calciner ses adversaires en un instant. Son armure dorée absorbe la lumière ambiante pour amplifier sa force de frappe.",
    stages: [
    { name: 'Solarion', emoji: '🌟' }, { name: 'Solarion', emoji: '🌟' }, { name: 'Solarion', emoji: '🌟' },
  ]},
  // Première créature qui AGRANDIT le roster (29/08) — plus rien à
  // remplacer, le roster passe de 11 à 12. Pas de contrainte d'ordre par
  // rapport à la liste des 25 : les créatures suivantes s'ajoutent dans
  // l'ordre où l'utilisateur les envoie.
  { id: 'aquamira', element: 'Eau', rarity: 'peu_commun', baseIncome: 0.2, combatType: 'soutien',
    baseHp: 25, baseAttack: 3, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Onde Apaisante', 2, 10], ['Brume Corallienne', 3, 15], ['Étreinte Aqueuse', 4, 20], ['Geyser Revigorant', 5, 30]]),
    lore: "Aquamira est une méduse cristalline qui flotte gracieusement dans les récifs coralliens sacrés. Ses tentacules diffusent des ondes curatives qui apaisent les blessures de ses alliés au combat. En cas de menace, elle sécrète une brume marine pour désorienter ses adversaires.",
    stages: [
    { name: 'Aquamira', emoji: '🎐' }, { name: 'Aquamira', emoji: '🎐' }, { name: 'Aquamira', emoji: '🎐' },
  ]},
];

// 6 paliers désormais (au lieu de 4). "peu_commun" ET "mythique" sont
// définis mais à poids 0 dans le gacha : AUCUNE des 10 créatures
// actuelles n'a la rareté "peu_commun" (seulement commun/rare/épique/
// légendaire existent pour l'instant), donc lui donner un poids > 0
// ferait planter le tirage (panier vide) — à réactiver dès qu'une
// créature (nouvelle via Gemini, ou une existante reclassée) y est assignée.
// "legendaire" et "mythique" repassent à poids 0 (plus aucune créature
// dedans depuis le remplacement de Gemmion) — "peu_commun" réactivé
// maintenant que Fournax existe (29/08).
export const RARITY_WEIGHTS = { commun: 55, peu_commun: 20, rare: 15, epique: 10, legendaire: 0, mythique: 0 };
export const RARITY_LABEL = {
  commun: 'Commun', peu_commun: 'Peu commun', rare: 'Rare',
  epique: 'Épique', legendaire: 'Légendaire', mythique: 'Mythique',
};
// Couleurs et lettres réalignées sur le style Monster Legends (capture
// de référence fournie par l'utilisateur : badges ronds C/UC/R/E/L/M).
export const RARITY_COLOR = {
  commun: '#e8b923', peu_commun: '#a67c3d', rare: '#d0342c',
  epique: '#4caf50', legendaire: '#9b4fd6', mythique: '#ff8c00',
};
export const RARITY_BADGE_LETTER = {
  commun: 'C', peu_commun: 'UC', rare: 'R', epique: 'E', legendaire: 'L', mythique: 'M',
};

export const EVOLUTION_LEVELS = [1, 5, 15]; // niveau à partir duquel chaque stade s'active

export function stageForLevel(level) {
  if (level >= EVOLUTION_LEVELS[2]) return 2;
  if (level >= EVOLUTION_LEVELS[1]) return 1;
  return 0;
}

// Revenu passif (pièces/seconde) d'une créature possédée, selon son niveau
// et son stade d'évolution (le stade multiplie le revenu de base).
// DEPUIS LA REFONTE : les créatures ne produisent plus de pièces
// automatiquement (seule la boutique d'auto-clics le fait désormais).
// Fonction gardée (le calcul niveau/stade reste utile comme base pour de
// futures stats de combat) mais plus appelée pour la génération de pièces.
const STAGE_MULTIPLIER = [1, 2.2, 5];
export function incomeForCreature(creature, level) {
  const stage = stageForLevel(level);
  const levelBonus = 1 + (level - 1) * 0.12;
  return creature.baseIncome * STAGE_MULTIPLIER[stage] * levelBonus;
}

// Coût (en pièces) pour faire passer une créature possédée du niveau
// `level` à `level+1`.
export function levelUpCost(creature, level) {
  const rarityFactor = { commun: 1, rare: 1.6, epique: 2.6, legendaire: 4.2 }[creature.rarity];
  return Math.round(8 * Math.pow(level, 1.35) * rarityFactor);
}

// Coût d'une invocation (gacha), croissant avec le nombre de créatures
// déjà possédées (chaque nouvelle créature est un peu plus chère).
export function summonCost(ownedCount) {
  return Math.round(15 * Math.pow(1.13, ownedCount));
}

// Coût pour augmenter la puissance de tap (pièces gagnées par appui).
export function tapPowerCost(currentTapPower) {
  return Math.round(20 * Math.pow(1.55, currentTapPower - 1));
}

// ---- Apparitions de créatures sur le bouton de tap ("le cookie") ----
// Toutes les SPAWN_INTERVAL_SEC secondes, une créature apparaît
// brièvement (SPAWN_VISIBLE_SEC) ; si le joueur tape dessus à temps, son
// pouvoir s'active. Non tapée à temps = disparaît sans effet.
export const SPAWN_INTERVAL_SEC = 60; // 1 minute (était 3 minutes)
export const SPAWN_VISIBLE_SEC = 4;

// La RARETÉ détermine l'intensité (multiplicateur de tap + durée) — garde
// une progression simple et lisible, peu importe la créature. Chaque
// CRÉATURE a en plus son propre effet secondaire thématique (son élément),
// donc 10 pouvoirs vraiment distincts plutôt que 4 pouvoirs partagés par
// palier de rareté. 3 familles d'effet secondaire, pour rester
// implémentable simplement :
//  - coins_burst : bonus de pièces immédiat à l'activation
//  - passive_boost : multiplie le revenu passif pendant la durée du pouvoir
//  - discount_next : réduit le coût du prochain achat (tap/invocation/nourrir)
const RARITY_TAP_MULTIPLIER = { commun: 2, rare: 3, epique: 5, legendaire: 10 };
const RARITY_DURATION_SEC = { commun: 10, rare: 10, epique: 15, legendaire: 15 };

export const CREATURE_POWERS = {
  pyrosile: { name: 'Éruption', effectType: 'coins_burst', effectValue: 8 },
  caraploof: { name: 'Flux Montant', effectType: 'passive_boost', effectValue: 2 },
  ventis: { name: 'Éclosion Généreuse', effectType: 'discount_next', effectValue: 0.2 },
  bouldog: { name: 'Fondation', effectType: 'coins_burst', effectValue: 8 },
  voltix: { name: 'Décharge', effectType: 'coins_burst', effectValue: 12 },
  brisillon: { name: 'Bourrasque', effectType: 'passive_boost', effectValue: 2.5 },
  glyphon: { name: 'Conservation', effectType: 'discount_next', effectValue: 0.25 },
  ombrillon: { name: 'Éclipse', effectType: 'coins_burst', effectValue: 25 },
  luxorbe: { name: 'Rayonnement', effectType: 'passive_boost', effectValue: 3 },
  fournax: { name: 'Résonance Cristalline', effectType: 'coins_burst', effectValue: 75 },
  aquamira: { name: 'Marée Curative', effectType: 'passive_boost', effectValue: 2 },
  solarion: { name: 'Éruption Solaire', effectType: 'coins_burst', effectValue: 30 },
};

// Calcule le pouvoir déclenché en tapant une créature apparue. Le bonus de
// pièces (coins_burst) est proportionnel à la puissance de tap actuelle du
// joueur (pas un montant fixe qui deviendrait négligeable en fin de partie).
export function powerForCreature(creature, tapPower) {
  const cfg = CREATURE_POWERS[creature.id];
  const tapMultiplier = RARITY_TAP_MULTIPLIER[creature.rarity];
  const durationSec = RARITY_DURATION_SEC[creature.rarity];
  return {
    name: cfg.name,
    creatureId: creature.id,
    rarity: creature.rarity,
    tapMultiplier,
    durationSec,
    effectType: cfg.effectType,
    effectValue: cfg.effectValue,
    bonusCoins: cfg.effectType === 'coins_burst' ? Math.round(cfg.effectValue * tapPower) : 0,
  };
}

// Détermine si une nouvelle créature doit apparaître, selon le temps
// écoulé depuis la dernière apparition (en millisecondes, via Date.now()
// ou performance.now() — peu importe l'unité tant qu'elle est cohérente
// entre les deux appels).
export function shouldSpawn(lastSpawnMs, nowMs) {
  return nowMs - lastSpawnMs >= SPAWN_INTERVAL_SEC * 1000;
}

// Tire une créature au hasard, mais UNIQUEMENT parmi celles placées dans
// le deck (3 emplacements, potentiellement vides = null) — remplace
// l'ancien tirage sur les 10 créatures (l'ancien système, pondéré par
// rareté, faisait qu'un joueur pouvait tester longtemps sans jamais voir
// certaines créatures, perçu comme un bug). Retourne null si le deck est
// entièrement vide (aucune apparition possible tant que rien n'y est mis).
export function pickFromDeck(deckIds) {
  const validIds = (deckIds || []).filter(Boolean);
  if (validIds.length === 0) return null;
  const id = validIds[Math.floor(Math.random() * validIds.length)];
  return CREATURES.find((c) => c.id === id) || null;
}

// Tire une créature au hasard selon les poids de rareté.
export function rollCreature() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let chosenRarity = 'commun';
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    if (weight <= 0) continue; // ex: "mythique" tant qu'aucune créature n'y est assignée —
    // exclu explicitement plutôt que de compter sur "r < 0" qui peut être
    // atteint par erreur à cause d'imprécisions de virgule flottante
    // après plusieurs soustractions successives (bug réel rencontré et
    // corrigé ici, pas juste une précaution théorique).
    if (r < weight) {
      chosenRarity = rarity;
      break;
    }
    r -= weight;
  }
  const pool = CREATURES.filter((c) => c.rarity === chosenRarity);
  if (pool.length === 0) {
    // Garde-fou : un poids > 0 sans aucune créature de cette rareté ne
    // doit jamais planter le tirage, même par erreur de synchronisation
    // future entre RARITY_WEIGHTS et le roster réel — repli sur "commun".
    const fallback = CREATURES.filter((c) => c.rarity === 'commun');
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// Revenu passif total (pièces/seconde) de toute la collection possédée.
// ownedCreatures : [{ id, level }]
export function totalPassiveIncome(ownedCreatures) {
  let sum = 0;
  for (const owned of ownedCreatures) {
    const creature = CREATURES.find((c) => c.id === owned.id);
    if (creature) sum += incomeForCreature(creature, owned.level);
  }
  return sum;
}

// Gains hors-ligne, plafonnés pour éviter les abus (4h max comptabilisées).
// Prend directement un taux de pièces/s (calculé par l'appelant) plutôt
// que la liste de créatures — les créatures ne produisent plus de revenu
// passif automatique, seuls les générateurs de la boutique d'auto-clics
// en produisent maintenant.
const OFFLINE_CAP_SECONDS = 4 * 3600;
export function offlineEarnings(incomePerSecond, secondsElapsed) {
  const capped = Math.max(0, Math.min(secondsElapsed, OFFLINE_CAP_SECONDS));
  return Math.floor(incomePerSecond * capped);
}

// ---- Faveur des Esprits (coups critiques) ----
// Chance de coup critique à chaque tap, qui grandit avec le niveau
// (achetable), plafonnée pour rester un bonus ponctuel et pas la norme.
// Le multiplicateur du coup grandit lui aussi légèrement avec le niveau.
export function critChance(level) {
  return Math.min(0.3, level * 0.025); // +2.5%/niveau, plafonné à 30%
}
export function critMultiplier(level) {
  return Math.min(10, 5 + level * 0.25); // x5 de base, jusqu'à x10 au niveau max
}
export function critUpgradeCost(level) {
  return Math.round(25 * Math.pow(1.5, level));
}
export function rollCrit(level) {
  return Math.random() < critChance(level);
}

// ---- Transe (combo) ----
// Taper vite et sans interruption fait monter un multiplicateur ; une
// pause plus longue que TRANSE_WINDOW_MS entre deux taps le fait retomber.
export const TRANSE_WINDOW_MS = 1200;
export const TRANSE_STEP = 0.04;
export const TRANSE_MAX_MULTIPLIER = 3;
export function transeMultiplier(comboCount) {
  return Math.min(TRANSE_MAX_MULTIPLIER, 1 + comboCount * TRANSE_STEP);
}
export function transeStillActive(lastTapMs, nowMs) {
  return nowMs - lastTapMs <= TRANSE_WINDOW_MS;
}

// ---- Cible dorée ----
// Apparaît par surprise à intervalle aléatoire (pas fixe, pour garder
// l'effet de surprise), visible brièvement ; tap dessus = gros bonus
// ponctuel proportionnel à la progression du joueur.
export const GOLDEN_MIN_INTERVAL_SEC = 45;
export const GOLDEN_MAX_INTERVAL_SEC = 90;
export const GOLDEN_VISIBLE_SEC = 3;
export function nextGoldenDelaySec() {
  return GOLDEN_MIN_INTERVAL_SEC + Math.random() * (GOLDEN_MAX_INTERVAL_SEC - GOLDEN_MIN_INTERVAL_SEC);
}
export function goldenBonus(tapPower) {
  return Math.round(tapPower * 40);
}

// ---- Familier (auto-clic) ----
// Un compagnon tape pour le joueur en continu — traduit en revenu/s
// supplémentaire proportionnel à la puissance de tap actuelle (pas un
// montant fixe qui deviendrait négligeable en fin de partie).
export function familiarIncome(level, tapPower) {
  return level * tapPower * 0.5;
}
export function familiarUpgradeCost(level) {
  return Math.round(40 * Math.pow(1.6, level));
}

// ---- Sanctuaire (boost global %) ----
// Multiplicateur global appliqué à TOUTE la production (tap ET revenu
// passif), pas juste au tap comme Pacte.
export function sanctuaryMultiplier(level) {
  return 1 + level * 0.05;
}
export function sanctuaryUpgradeCost(level) {
  return Math.round(60 * Math.pow(1.7, level));
}

// ---- Veilleur (gains hors-ligne) ----
export function veilleurOfflineMultiplier(level) {
  return 1 + level * 0.15;
}
export function veilleurUpgradeCost(level) {
  return Math.round(50 * Math.pow(1.6, level));
}

// ---- Ascension (prestige) ----
// Réinitialise la progression contre un bonus PERMANENT (essence), qui
// persiste à travers les résets suivants. Le gain d'essence dépend du
// total de pièces gagnées sur toute la partie (pas juste le solde
// actuel, qui peut avoir été dépensé) — récompense la progression
// globale, pas la thésaurisation.
export const ASCENSION_MIN_LIFETIME_EARNED = 50000; // seuil avant de pouvoir ascensionner
export function ascensionEssenceGain(totalCoinsEarnedLifetime) {
  if (totalCoinsEarnedLifetime < ASCENSION_MIN_LIFETIME_EARNED) return 0;
  return Math.floor(Math.sqrt(totalCoinsEarnedLifetime / 10000));
}
export function essenceBonusMultiplier(essence) {
  return 1 + essence * 0.02; // +2% de production permanente par point d'essence
}

// ---- Rituel (bouton "fausse pub" — pas de vrai SDK pour l'instant) ----
export const RITUAL_COOLDOWN_SEC = 180; // 3 minutes entre 2 utilisations
export function ritualReward(tapPower, passiveIncome) {
  return Math.round(tapPower * 100 + passiveIncome * 120);
}
export function ritualReady(lastUsedMs, nowMs) {
  return nowMs - lastUsedMs >= RITUAL_COOLDOWN_SEC * 1000;
}

// ---- Offrande (dépenser les pièces partagées appCoins de l'appli) ----
export const OFFRANDE_APPCOINS_COST = 10;
export function offrandeReward(tapPower) {
  return Math.round(tapPower * 15);
}

// ---- Système de quêtes + œuf à 4 paliers ----
// Première passe volontairement limitée aux quêtes réalisables DANS le
// clicker (internes + compétence/timing) — les quêtes liées aux autres
// jeux de l'appli (ex: "gagner 5 fois à Puissance 4") demandent une
// couche de stats partagées entre jeux qui n'existe pas encore ; à
// construire séparément avant de les ajouter à ce pool.
export const QUEST_POOL = [
  { id: 'combo25', desc: 'Atteins un multiplicateur de Transe x2,5' },
  { id: 'summon10', desc: 'Invoque 10 créatures' },
  { id: 'crit20', desc: 'Obtiens 20 coups critiques' },
  { id: 'golden3', desc: 'Touche 3 fois la cible dorée' },
  { id: 'earn5000', desc: 'Cumule 5 000 pièces gagnées au total' },
  { id: 'evolve1', desc: "Fais évoluer une créature jusqu'au stade final" },
  { id: 'feed10', desc: "Nourris une créature jusqu'au niveau 10" },
  { id: 'pacte5', desc: 'Fais monter Pacte au niveau 6' },
];

// Tire 4 quêtes au hasard dans le pool (sans répéter celles données en
// exclusion, pour varier d'un cycle d'œuf à l'autre).
export function pickQuestSet(excludeIds = []) {
  const pool = QUEST_POOL.filter((q) => !excludeIds.includes(q.id));
  const source = pool.length >= 4 ? pool : QUEST_POOL; // si pas assez pour exclure, retire du pool complet
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4).map((q) => q.id);
}

export function questLabel(questId) {
  return QUEST_POOL.find((q) => q.id === questId)?.desc || '';
}

// Progression 0-1 d'une quête donnée, à partir des stats du joueur.
// stats attendu : { maxCombo, totalSummons, totalCrits, goldenClaimed,
// totalEarned, maxCreatureLevel, tapPower }
export function questProgress(questId, stats) {
  switch (questId) {
    case 'combo25': return Math.min(1, stats.maxCombo / 2.5);
    case 'summon10': return Math.min(1, stats.totalSummons / 10);
    case 'crit20': return Math.min(1, stats.totalCrits / 20);
    case 'golden3': return Math.min(1, stats.goldenClaimed / 3);
    case 'earn5000': return Math.min(1, stats.totalEarned / 5000);
    case 'evolve1': return Math.min(1, stats.maxCreatureLevel / 15);
    case 'feed10': return Math.min(1, stats.maxCreatureLevel / 10);
    case 'pacte5': return Math.min(1, Math.max(0, stats.tapPower - 1) / 5);
    default: return 0;
  }
}
export function questComplete(questId, stats) {
  return questProgress(questId, stats) >= 1;
}

export const EGG_STAGES = [
  { name: 'Œuf endormi', desc: 'Immobile, terne' },
  { name: 'Œuf frémissant', desc: 'Petits tremblements' },
  { name: 'Œuf fissuré', desc: 'Fissures visibles' },
  { name: 'Œuf lumineux', desc: 'Lueur qui pulse' },
  { name: 'Œuf prêt à éclore', desc: 'Vibre fort, prêt !' },
];
// Nombre de quêtes validées (0-4) -> palier visuel (0-4).
export function eggStageForCompletedCount(completedCount) {
  return Math.max(0, Math.min(4, completedCount));
}

export const HATCH_TAPS_REQUIRED = 500;
export const CAPTURE_TAPS_REQUIRED = 200;

// ---- Boutique d'auto-clics ----
// Remplace l'ancien "Familier" (un seul niveau) par un vrai menu boutique
// à plusieurs générateurs, façon jeu incrémental classique : chaque
// palier a son propre coût et son propre revenu, achetable plusieurs
// fois (le coût grimpe à chaque achat du MÊME palier). Nécessaire suite
// à la décision de retirer le revenu passif automatique des créatures —
// c'est maintenant la seule source de revenu passif du jeu.
export const AUTOCLICKERS = [
  { id: 'esprit', name: 'Esprit Frappeur', emoji: '👻', baseCost: 15, baseIncome: 0.1 },
  { id: 'main', name: 'Main Spectrale', emoji: '🖐️', baseCost: 100, baseIncome: 1 },
  { id: 'automate', name: 'Automate Runique', emoji: '⚙️', baseCost: 1100, baseIncome: 8 },
  { id: 'colonie', name: 'Colonie de Familiers', emoji: '🦊', baseCost: 12000, baseIncome: 47 },
  { id: 'titan', name: 'Titan Mécanique', emoji: '🗿', baseCost: 130000, baseIncome: 260 },
];

// Coût pour acheter UNE unité de plus d'un générateur donné, sachant
// combien on en possède déjà (le coût grimpe à chaque achat du même palier).
export function autoClickerCost(clicker, ownedCount) {
  return Math.round(clicker.baseCost * Math.pow(1.15, ownedCount));
}

// Revenu total/s de tous les générateurs possédés.
// ownedAutoClickers : { esprit: 3, main: 1, ... }
export function totalAutoClickIncome(ownedAutoClickers) {
  let sum = 0;
  for (const clicker of AUTOCLICKERS) {
    const count = ownedAutoClickers[clicker.id] || 0;
    sum += count * clicker.baseIncome;
  }
  return sum;
}

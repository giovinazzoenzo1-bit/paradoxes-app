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
  brisillon: 'aegisolar',
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
  { id: 'aegisolar', element: 'Lumière', rarity: 'rare', baseIncome: 0.4, combatType: 'tank',
    baseHp: 60, baseAttack: 5, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Frappe Rayonnante', 4, 10], ['Bouclier Prisme', 5, 15], ['Halo Réflecteur', 8, 25], ['Jugement Solaire', 12, 35]]),
    lore: "Aegisolar est un imposant golem de marbre blanc infusé de pure lumière céleste. Forgé pour protéger les temples sacrés, il absorbe les attaques ennemies grâce à son lourd bouclier prismatique. On raconte que sa seule présence suffit à repousser les ténèbres les plus tenaces.",
    stages: [
    { name: 'Aegisolar', emoji: '🛡️' }, { name: 'Aegisolar', emoji: '🛡️' }, { name: 'Aegisolar', emoji: '🛡️' },
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
  { id: 'terracroc', element: 'Terre', rarity: 'peu_commun', baseIncome: 0.2, combatType: 'attaquant',
    baseHp: 20, baseAttack: 6, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([["Griffe d'Argile", 4, 10], ['Coup de Silex', 6, 15], ['Morsure Sismique', 8, 20], ['Éboulement Brutal', 12, 30]]),
    lore: "Terracroc est un prédateur bipède recouvert de roches acérées et d'argile durcie. Il chasse frénétiquement dans les canyons arides, utilisant ses lourdes griffes de pierre pour fracasser l'armure de ses proies. Bien qu'il manque d'intelligence, sa force brute en fait un redoutable chasseur d'embuscade.",
    stages: [
    { name: 'Terracroc', emoji: '🐊' }, { name: 'Terracroc', emoji: '🐊' }, { name: 'Terracroc', emoji: '🐊' },
  ]},
  { id: 'zephyrion', element: 'Air', rarity: 'peu_commun', baseIncome: 0.2, combatType: 'soutien',
    baseHp: 25, baseAttack: 3, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Brise Réparatrice', 2, 10], ['Murmure Éolien', 3, 15], ['Bourrasque Protectrice', 4, 20], ["Souffle d'Altitude", 5, 30]]),
    lore: "Zephyrion est un petit nuage cotonneux doué de conscience qui flotte paisiblement au-dessus des hautes cimes. Il utilise des vents doux pour soigner ses alliés et dévier les projectiles ennemis avec une brise protectrice. Toujours serein, il évite les conflits directs mais se révèle indispensable lors des longues batailles.",
    stages: [
    { name: 'Zephyrion', emoji: '☁️' }, { name: 'Zephyrion', emoji: '☁️' }, { name: 'Zephyrion', emoji: '☁️' },
  ]},
  { id: 'brontobloc', element: 'Foudre', rarity: 'peu_commun', baseIncome: 0.2, combatType: 'tank',
    baseHp: 30, baseAttack: 3, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Frappe Aimantée', 2, 10], ['Bouclier Statique', 3, 15], ['Charge Magnétique', 5, 20], ['Onde de Choc Électrique', 7, 30]]),
    lore: "Ce golem massif est composé d'aimants naturels et de minerais conducteurs. Il attire délibérément la foudre lors des orages pour charger son épaisse armure électromagnétique. Sur le champ de bataille, il encaisse les coups tout en renvoyant de puissantes décharges statiques à ses agresseurs.",
    stages: [
    { name: 'Brontobloc', emoji: '🗿' }, { name: 'Brontobloc', emoji: '🗿' }, { name: 'Brontobloc', emoji: '🗿' },
  ]},
  { id: 'malefix', element: 'Magie', rarity: 'peu_commun', baseIncome: 0.2, combatType: 'attaquant',
    baseHp: 20, baseAttack: 6, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Rayon Arcanique', 4, 10], ['Pages Coupantes', 6, 15], ['Malédiction Rapide', 8, 20], ['Explosion Runique', 12, 30]]),
    lore: "Ce grimoire flottant est devenu incontrôlable après avoir absorbé trop d'incantations destructrices. Il virevolte frénétiquement en libérant des salves d'énergie pure sur quiconque tente de le refermer. De nombreux apprentis sorciers ont perdu leurs sourcils en essayant de le dompter.",
    stages: [
    { name: 'Malefix', emoji: '📖' }, { name: 'Malefix', emoji: '📖' }, { name: 'Malefix', emoji: '📖' },
  ]},
  { id: 'nocturis', element: 'Ténèbres', rarity: 'rare', baseIncome: 0.4, combatType: 'soutien',
    baseHp: 45, baseAttack: 4, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Murmure Macabre', 3, 10], ["Voile d'Ombre", 4, 15], ['Pacte Sanglant', 5, 25], ['Éclipse Curative', 7, 35]]),
    lore: "Nocturis est un spectre bienveillant qui hante les anciens cimetières pour guider les âmes égarées. Il utilise les ombres pour tisser des barrières protectrices autour de ses alliés et affaiblir les agresseurs. Sa présence silencieuse apaise les esprits tourmentés lors des batailles nocturnes.",
    stages: [
    { name: 'Nocturis', emoji: '👻' }, { name: 'Nocturis', emoji: '👻' }, { name: 'Nocturis', emoji: '👻' },
  ]},
  { id: 'racinea', element: 'Terre', rarity: 'rare', baseIncome: 0.4, combatType: 'soutien',
    baseHp: 50, baseAttack: 4, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Liane Protectrice', 3, 10], ['Sève Apaisante', 4, 15], ['Racines Entravantes', 5, 25], ['Éclosion Vitale', 7, 35]]),
    lore: "Racinea est un ancien esprit sylvestre dont le corps est tissé de racines entrelacées et d'ambre magique. Elle arpente lentement les sous-bois pour fertiliser les sols arides et panser les blessures de la faune sauvage. Ses bourgeons libèrent un pollen curatif qui revitalise instantanément ses compagnons d'armes.",
    stages: [
    { name: 'Racinea', emoji: '🌳' }, { name: 'Racinea', emoji: '🌳' }, { name: 'Racinea', emoji: '🌳' },
  ]},
  { id: 'runicor', element: 'Magie', rarity: 'rare', baseIncome: 0.4, combatType: 'tank',
    baseHp: 65, baseAttack: 4, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([["Frappe d'Obsidienne", 4, 10], ['Mur Runique', 5, 15], ['Sceau Protecteur', 8, 25], ['Décharge Arcanique', 12, 35]]),
    lore: "Runicor est une imposante gargouille d'obsidienne animée par des rituels oubliés. Incapable de voler à cause de son poids démesuré, elle se plante sur le champ de bataille pour absorber les sortilèges avec son armure impénétrable. Les sceaux incandescents gravés sur sa pierre redirigent violemment la force des impacts vers ses agresseurs.",
    stages: [
    { name: 'Runicor', emoji: '🗿' }, { name: 'Runicor', emoji: '🗿' }, { name: 'Runicor', emoji: '🗿' },
  ]},
  { id: 'braiserose', element: 'Feu', rarity: 'rare', baseIncome: 0.4, combatType: 'soutien',
    baseHp: 45, baseAttack: 4, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Pétale Ardent', 3, 10], ['Nuage de Cendres', 4, 15], ['Chaleur Réconfortante', 5, 25], ['Cautérisation Vitale', 7, 35]]),
    lore: "Cette étrange fleur volcanique s'épanouit uniquement dans les cratères bouillonnants et diffuse une chaleur réconfortante. Ses pétales rougeoyants libèrent des spores curatives capables de cautériser instantanément les blessures de ses alliés. Pacifique par nature, elle utilise sa suie incandescente pour aveugler quiconque menace son groupe.",
    stages: [
    { name: 'Braiserose', emoji: '🌺' }, { name: 'Braiserose', emoji: '🌺' }, { name: 'Braiserose', emoji: '🌺' },
  ]},
  { id: 'abyssorax', element: 'Eau', rarity: 'epique', baseIncome: 1.0, combatType: 'attaquant',
    baseHp: 55, baseAttack: 22, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Morsure Glaciale', 12, 15], ['Lames de Courant', 18, 25], ['Maelström Déchirant', 25, 35], ['Exécution Abyssale', 35, 50]]),
    lore: "Abyssorax est un prédateur des profondes abysses océaniques dont les écailles tranchent comme des rasoirs. Il remonte à la surface uniquement lors des tempêtes titanesques pour traquer des proies à sa démesure. Ses redoutables crocs glacés peuvent transpercer sans effort les coques des navires les plus robustes.",
    stages: [
    { name: 'Abyssorax', emoji: '🦈' }, { name: 'Abyssorax', emoji: '🦈' }, { name: 'Abyssorax', emoji: '🦈' },
  ]},
  { id: 'cumulox', element: 'Air', rarity: 'epique', baseIncome: 1.0, combatType: 'tank',
    baseHp: 110, baseAttack: 10, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Frappe Venteuse', 8, 15], ['Mur de Pression', 12, 25], ['Cyclone Bouclier', 18, 35], ['Rejet Stratosphérique', 25, 50]]),
    lore: "Cumulox est un gigantesque golem formé de nuages denses qui flotte lourdement au-dessus des champs de bataille. Son corps cotonneux, chargé de fortes pressions atmosphériques, lui permet d'absorber les chocs physiques les plus violents sans broncher. Véritable forteresse volante, il s'interpose toujours face au danger pour repousser les ennemis par de puissantes bourrasques.",
    stages: [
    { name: 'Cumulox', emoji: '☁️' }, { name: 'Cumulox', emoji: '☁️' }, { name: 'Cumulox', emoji: '☁️' },
  ]},
  { id: 'voltarel', element: 'Foudre', rarity: 'epique', baseIncome: 1.0, combatType: 'soutien',
    baseHp: 85, baseAttack: 14, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Étincelle Vitale', 8, 15], ['Cocon Magnétique', 12, 25], ['Onde Galvanisante', 18, 35], ['Défibrillation Foudroyante', 25, 50]]),
    lore: "Voltarel est un esprit d'orage majestueux tissé de foudre pure et d'ozone. Bien qu'il possède une puissance destructrice, il préfère canaliser son énergie pour galvaniser le système nerveux de ses alliés et soigner leurs blessures. On dit que sa simple présence électrise le moral des troupes lors des batailles les plus désespérées.",
    stages: [
    { name: 'Voltarel', emoji: '⚡' }, { name: 'Voltarel', emoji: '⚡' }, { name: 'Voltarel', emoji: '⚡' },
  ]},
  { id: 'solstral', element: 'Lumière', rarity: 'legendaire', baseIncome: 2.5, combatType: 'attaquant',
    baseHp: 85, baseAttack: 45, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([["Lame de l'Aube", 20, 15], ['Rayon Perforant', 35, 25], ['Châtiment Solaire', 50, 35], ['Supernova Jugement', 75, 50]]),
    lore: "Solstral est une entité cosmique née de la première aurore, maniant des lances de pure lumière cristallisée. Il parcourt les cieux pour purger les ténèbres ancestrales avec une précision chirurgicale et une force dévastatrice. On dit que son apparition sur le champ de bataille illumine la galaxie entière et aveugle définitivement ses ennemis.",
    stages: [
    { name: 'Solstral', emoji: '🌠' }, { name: 'Solstral', emoji: '🌠' }, { name: 'Solstral', emoji: '🌠' },
  ]},
  { id: 'tartaroth', element: 'Ténèbres', rarity: 'legendaire', baseIncome: 2.5, combatType: 'tank',
    baseHp: 180, baseAttack: 20, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([["Frappe de l'Ombre", 15, 15], ['Mur des Âmes', 25, 25], ['Attraction Funeste', 35, 35], ['Écrasement Abyssal', 50, 50]]),
    lore: "Tartaroth est un béhémoth d'obsidienne forgé dans les fosses les plus sombres pour engloutir toute source de lumière. Véritable trou noir sur le champ de bataille, il absorbe les attaques ennemies tout en se nourrissant de leur désespoir. Sa simple présence dresse un mur impénétrable de ténèbres absolues pour protéger infailliblement ses alliés.",
    stages: [
    { name: 'Tartaroth', emoji: '👹' }, { name: 'Tartaroth', emoji: '👹' }, { name: 'Tartaroth', emoji: '👹' },
  ]},
  // VRAI 25e créneau du plan d'origine (Mythique + Magie + Attaquant,
  // dernier de la liste des 25) — Tartaroth avait été annoncé par erreur
  // comme le 25e/dernier, décalage d'un cran repéré par l'utilisateur.
  { id: 'arcanis', element: 'Magie', rarity: 'mythique', baseIncome: 4.0, combatType: 'attaquant',
    baseHp: 130, baseAttack: 90, baseClickSpeed: 1, baseEndurance: 100,
    skills: mkSkills([['Déchirure Dimensionnelle', 40, 15], ['Implosion de Mana', 65, 25], ['Singularité Arcanique', 95, 35], ['Effacement Réel', 150, 50]]),
    lore: "Arcanis est une entité primordiale née de la première étincelle arcanique de l'univers, manipulant la trame même de la réalité. Il pulvérise ses adversaires en altérant les lois de la magie pour les réduire en pure énergie. Seuls les mages les plus fous osent l'invoquer, risquant d'être consumés par son pouvoir absolu.",
    stages: [
    { name: 'Arcanis', emoji: '🌌' }, { name: 'Arcanis', emoji: '🌌' }, { name: 'Arcanis', emoji: '🌌' },
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
// "mythique" réactivé (30/08) — Arcanis existe enfin, TOUS les paliers
// sont maintenant représentés dans le roster.
export const RARITY_WEIGHTS = { commun: 40, peu_commun: 20, rare: 15, epique: 12, legendaire: 8, mythique: 5 };
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

// Facteur de rareté partagé par tous les coûts d'amélioration.
// 6 paliers (ratio ~x1,6 entre chacun) — "peu_commun" et "mythique"
// avaient été oubliés lors du passage à 6 raretés, ce qui rendait le
// coût NaN et le nourrissage impossible pour toutes les créatures de ces
// deux raretés. Toujours passer par ce mappage, jamais en redéfinir un.
export const RARITY_COST_FACTOR = { commun: 1, peu_commun: 1.3, rare: 1.6, epique: 2.6, legendaire: 4.2, mythique: 6.7 };

// Coût EN GRIFFES pour faire passer une créature du niveau `level` au
// suivant.
//
// Les créatures ne se montent plus du tout avec les pièces du clicker :
// leur seule monnaie d'amélioration est la Griffe, gagnée au combat en
// Aventure. Les deux économies sont ainsi franchement séparées — les
// pièces font tourner le clicker, les Griffes font progresser les
// créatures — au lieu que la même ressource achète tout.
//
// Barème calibré sur le revenu de Griffes du combat (~410 Griffes pour
// les 20 premiers niveaux d'Aventure) : monter une créature COMMUNE
// jusqu'au niveau 25 (le seuil du 1er palier d'évolution) coûte environ
// 270 Griffes. L'ancien barème en pièces (8 × level^1,35) aurait donné
// ~820 Griffes pour le même parcours, soit le double du revenu de
// combat disponible à ce stade.
export function levelUpCost(creature, level) {
  const rarityFactor = RARITY_COST_FACTOR[creature.rarity] || 1;
  return Math.max(1, Math.round(0.5 * Math.pow(level, 1.2) * rarityFactor));
}

// Coût d'une invocation (gacha), croissant avec le nombre de créatures
// déjà possédées (chaque nouvelle créature est un peu plus chère).
export function summonCost(ownedCount) {
  return Math.round(15 * Math.pow(1.13, ownedCount));
}

// ---- Pacte (puissance de tap) ----
//
// ATTENTION à la distinction, source d'erreurs : `tapPower` est le
// NIVEAU du Pacte (entier, +1 par achat, affiché dans la boutique et lu
// par les défis « Pacte niveau 10 »). Les pièces réellement gagnées par
// appui sont `tapDamage(niveau)`, qui ne vaut PAS la même chose.
//
// Un niveau ne rapporte plus qu'un demi-point de dégâts (au lieu de +1),
// et son coût DOUBLE à chaque palier au lieu de croître de 55% : le
// Pacte était la façon la plus rapide de démarrer, il devient un
// investissement qu'on ne peut plus monter indéfiniment au début.
export const TAP_DAMAGE_PER_LEVEL = 0.5;
export function tapDamage(level) {
  const lvl = Number.isFinite(level) ? Math.max(1, level) : 1;
  return 1 + (lvl - 1) * TAP_DAMAGE_PER_LEVEL;
}
export function tapPowerCost(currentTapPower) {
  return Math.round(20 * Math.pow(2, currentTapPower - 1));
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
// Même piège que levelUpCost : ces deux mappages ne connaissaient que 4
// raretés sur 6, donnant undefined (puis NaN en aval) pour les créatures
// Peu Commun/Mythique — corrigé en même temps, avant qu'un joueur tombe
// sur ce bug via une bulle de pouvoir plutôt qu'en le découvrant plus tard.
const RARITY_TAP_MULTIPLIER = { commun: 2, peu_commun: 2.5, rare: 3, epique: 5, legendaire: 10, mythique: 15 };
const RARITY_DURATION_SEC = { commun: 10, peu_commun: 10, rare: 10, epique: 15, legendaire: 15, mythique: 15 };

export const CREATURE_POWERS = {
  pyrosile: { name: 'Éruption', effectType: 'coins_burst', effectValue: 8 },
  caraploof: { name: 'Flux Montant', effectType: 'passive_boost', effectValue: 2 },
  ventis: { name: 'Éclosion Généreuse', effectType: 'discount_next', effectValue: 0.2 },
  bouldog: { name: 'Fondation', effectType: 'coins_burst', effectValue: 8 },
  voltix: { name: 'Décharge', effectType: 'coins_burst', effectValue: 12 },
  aegisolar: { name: 'Bouclier Prisme', effectType: 'passive_boost', effectValue: 2.5 },
  glyphon: { name: 'Conservation', effectType: 'discount_next', effectValue: 0.25 },
  ombrillon: { name: 'Éclipse', effectType: 'coins_burst', effectValue: 25 },
  luxorbe: { name: 'Rayonnement', effectType: 'passive_boost', effectValue: 3 },
  fournax: { name: 'Résonance Cristalline', effectType: 'coins_burst', effectValue: 75 },
  aquamira: { name: 'Marée Curative', effectType: 'passive_boost', effectValue: 2 },
  terracroc: { name: 'Séisme', effectType: 'coins_burst', effectValue: 15 },
  zephyrion: { name: 'Brise Protectrice', effectType: 'passive_boost', effectValue: 2 },
  brontobloc: { name: 'Décharge Statique', effectType: 'coins_burst', effectValue: 15 },
  malefix: { name: 'Explosion Runique', effectType: 'coins_burst', effectValue: 15 },
  nocturis: { name: 'Éclipse Curative', effectType: 'passive_boost', effectValue: 3 },
  racinea: { name: 'Éclosion Vitale', effectType: 'passive_boost', effectValue: 3 },
  runicor: { name: 'Sceau Protecteur', effectType: 'coins_burst', effectValue: 20 },
  braiserose: { name: 'Cautérisation Vitale', effectType: 'passive_boost', effectValue: 3 },
  abyssorax: { name: 'Exécution Abyssale', effectType: 'coins_burst', effectValue: 40 },
  cumulox: { name: 'Rejet Stratosphérique', effectType: 'coins_burst', effectValue: 40 },
  voltarel: { name: 'Défibrillation Foudroyante', effectType: 'passive_boost', effectValue: 4 },
  solstral: { name: 'Supernova Jugement', effectType: 'coins_burst', effectValue: 90 },
  tartaroth: { name: 'Écrasement Abyssal', effectType: 'coins_burst', effectValue: 90 },
  arcanis: { name: 'Effacement Réel', effectType: 'coins_burst', effectValue: 150 },
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

// Tire une creature d'une rarete IMPOSEE (calendrier de connexion, ou
// toute recompense garantie). Meme garde-fou que rollCreature : une
// rarete sans aucune creature ne doit jamais renvoyer undefined et
// planter l'appelant, on retombe sur commun.
export function rollCreatureOfRarity(rarity) {
  const pool = CREATURES.filter((c) => c.rarity === rarity);
  if (pool.length === 0) {
    const fallback = CREATURES.filter((c) => c.rarity === 'commun');
    if (fallback.length === 0) return CREATURES[0];
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
// ---- Coups critiques : deux améliorations DISTINCTES ----
//
// La Faveur des Esprits cumulait chance ET dégâts critiques, ce qui la
// rendait bien trop rentable pour son prix : un seul achat améliorait
// deux axes à la fois. Elle ne donne plus que la CHANCE, et à moitié
// moins par niveau (2,5% -> 1,25%). Les dégâts sont devenus une
// amélioration séparée, avec son propre bouton et son propre coût.
export function critChance(level) {
  return Math.min(0.3, level * 0.0125); // +1,25%/niveau, plafonné à 30%
}
export function critUpgradeCost(level) {
  return Math.round(120 * Math.pow(1.6, level));
}

// Dégâts critiques, désormais indépendants de la chance. Niveau 0 = x2
// (et non plus x5 offert d'emblée par la Faveur) ; chaque niveau ajoute
// +0,5, sans plafond dur mais avec un coût qui grimpe vite.
export function critMultiplier(level) {
  const lvl = Number.isFinite(level) ? Math.max(0, level) : 0;
  return 2 + lvl * 0.5;
}
export function critDamageUpgradeCost(level) {
  return Math.round(200 * Math.pow(1.7, level));
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
// Refonte 02/09 : +5%/niveau à ×1,7 → +2,5%/niveau à ×2,0. Le
// Sanctuaire multiplie TOUT (tap ET passif), donc il compose avec
// chaque autre bonus : c'était le second accélérateur de la courbe
// après les auto-clics. Deux fois moins d'effet, pour un coût qui
// double à chaque niveau.
// Sanctuaire et Veilleur sont désormais PLAFONNÉS à 10 niveaux. Ce sont
// les deux seules améliorations bornées du jeu : elles multiplient
// respectivement toute la production et tous les gains hors-ligne, donc
// les laisser monter sans fin faisait d'elles un passage obligé qui
// écrasait tous les autres achats.
export const SANCTUARY_MAX_LEVEL = 10;
export const VEILLEUR_MAX_LEVEL = 10;

export function sanctuaryMultiplier(level) {
  return 1 + Math.min(SANCTUARY_MAX_LEVEL, Math.max(0, level || 0)) * 0.025;
}
export function sanctuaryUpgradeCost(level) {
  return Math.round(60 * Math.pow(2.0, level));
}
export function sanctuaryMaxed(level) {
  return (level || 0) >= SANCTUARY_MAX_LEVEL;
}

// ---- Veilleur (gains hors-ligne) ----
// Veilleur (gains hors-ligne) : +5%/niveau au lieu de +15%, et coût qui
// DOUBLE à chaque palier au lieu de +60%. Il coûtait 7x moins que le
// Sanctuaire pour un défi qui vient plus tard dans la séquence — l'ordre
// des défis et l'ordre des prix ne se contredisent plus.
export function veilleurOfflineMultiplier(level) {
  return 1 + Math.min(VEILLEUR_MAX_LEVEL, Math.max(0, level || 0)) * 0.05;
}
export function veilleurUpgradeCost(level) {
  return Math.round(150 * Math.pow(2, level));
}
export function veilleurMaxed(level) {
  return (level || 0) >= VEILLEUR_MAX_LEVEL;
}

// ---- Déverrouillage en chaîne des 4 mécaniques historiques ----
//
// Le Pacte est seul visible au départ ; chaque mécanique suivante
// s'ouvre en achetant la précédente :
//
//   Pacte nv 5 -> Faveur des Esprits
//   Faveur nv 1 -> Dégâts critiques
//   Dégâts critiques nv 1 -> Sanctuaire
//   Sanctuaire nv 1 -> Veilleur
//   Pacte nv 10 -> 1er palier de Puissance de tap
//
// Les seuils sont exprimés en NIVEAU AFFICHÉ, comme les défis (« Monte
// Pacte au niveau 10 ») : le Pacte démarre au niveau 1, donc « nv 5 »
// veut dire quatre achats. Mélanger niveaux et nombre d'achats dans les
// conditions était la meilleure façon d'obtenir un décalage de 1
// invisible à la lecture.
//
// Une mécanique verrouillée reste AFFICHÉE mais grisée avec sa
// condition : la boutique ne grandit pas par surprise, le joueur voit
// dès le départ le chemin complet.
export const CORE_UNLOCKS = [
  { id: 'pacte', requires: null },
  { id: 'faveur', requires: { key: 'tapPower', level: 5, label: 'Monte Pacte au niveau 5' } },
  { id: 'critDamage', requires: { key: 'critLevel', level: 1, label: 'Achète 1 Faveur des Esprits' } },
  { id: 'sanctuaire', requires: { key: 'critDamageLevel', level: 1, label: 'Achète 1 Dégâts critiques' } },
  { id: 'veilleur', requires: { key: 'sanctuaryLevel', level: 1, label: 'Achète 1 Sanctuaire' } },
];

export function coreUnlockFor(id) {
  return CORE_UNLOCKS.find((u) => u.id === id) || null;
}

// `state` = { tapPower, critLevel, critDamageLevel, sanctuaryLevel }
export function coreUpgradeUnlocked(id, state) {
  const entry = coreUnlockFor(id);
  if (!entry || !entry.requires) return true;
  const { key, level } = entry.requires;
  return ((state && state[key]) || 0) >= level;
}

export function coreUpgradeRequirement(id) {
  return coreUnlockFor(id)?.requires?.label || '';
}

// ---- Améliorations de TAP (10 paliers, niveaux infinis) ----
//
// Famille dédiée à la puissance de tap, distincte des `UPGRADE_ITEMS`.
// Chaque palier se monte SANS PLAFOND, comme tout le reste du clicker :
// `bonus` est le gain de pièces par tap et PAR NIVEAU, `cost` le prix du
// 1er niveau, `growth` le facteur appliqué à chaque niveau suivant.
//
// Déverrouillage EN CHAÎNE : le 1er palier s'ouvre au niveau 10 de
// Pacte, et chaque palier suivant à partir du **niveau 5 du palier
// précédent**. On monte donc Poignée Ancienne jusqu'à 5 avant de voir
// apparaître Griffe Runique, et ainsi de suite.
//
// Un palier verrouillé reste affiché mais grisé avec sa condition : le
// joueur voit ce qui l'attend au lieu d'une boutique qui grandit sans
// prévenir.
export const TAP_UPGRADES = [
  { id: 'tap1', name: 'Poigne Ancienne', emoji: '✊', bonus: 1, cost: 1200, growth: 1.6 },
  { id: 'tap2', name: 'Gantelet Runique', emoji: '🪄', bonus: 2.5, cost: 16500, growth: 1.62 },
  { id: 'tap3', name: 'Sceau de Puissance', emoji: '🔱', bonus: 12, cost: 153900, growth: 1.64 },
  { id: 'tap4', name: 'Main du Colosse', emoji: '🗿', bonus: 52, cost: 1392000, growth: 1.66 },
  { id: 'tap5', name: 'Éclat Primordial', emoji: '💠', bonus: 245, cost: 12090000, growth: 1.68 },
  { id: 'tap6', name: 'Coeur de Supernova', emoji: '🌟', bonus: 1154, cost: 108900000, growth: 1.7 },
  { id: 'tap7', name: 'Griffe du Vide', emoji: '🕳️', bonus: 5455, cost: 1008000000, growth: 1.72 },
  { id: 'tap8', name: 'Serment Éternel', emoji: '♾️', bonus: 27586, cost: 9324000000, growth: 1.74 },
  { id: 'tap9', name: 'Fracture du Réel', emoji: '⚡', bonus: 137705, cost: 88920000000, growth: 1.76 },
  { id: 'tap10', name: 'Volonté du Paradoxe', emoji: '🌌', bonus: 687500, cost: 836400000000, growth: 1.78 },
];

export const TAP_UPGRADE_FIRST_PACTE_LEVEL = 10;
export const TAP_UPGRADE_UNLOCK_LEVEL = 5;

// Accepte l'ancien format (tableau d'ids achetés une fois) comme
// « niveau 1 pour chacun » : sans ce repli, une sauvegarde d'avant le
// passage aux niveaux perdrait silencieusement ses paliers.
export function normalizeTapUpgrades(value) {
  if (Array.isArray(value)) {
    const out = {};
    value.forEach((id) => { out[id] = 1; });
    return out;
  }
  return value && typeof value === 'object' ? value : {};
}

export function tapUpgradeCost(item, level) {
  return Math.round(item.cost * Math.pow(item.growth || 1.6, level));
}

// Le palier `index` est ouvert si le PRÉCÉDENT a atteint le niveau 5
// (le tout premier dépendant du Pacte). Chaîner sur le niveau du palier
// précédent, et non sur un compteur global, garde la progression lisible
// : le joueur sait toujours exactement quoi monter pour ouvrir la suite.
export function tapUpgradeUnlocked(index, tapPowerLevel, levels) {
  const map = normalizeTapUpgrades(levels);
  if (index === 0) return (tapPowerLevel || 0) >= TAP_UPGRADE_FIRST_PACTE_LEVEL;
  const prev = TAP_UPGRADES[index - 1];
  return (map[prev.id] || 0) >= TAP_UPGRADE_UNLOCK_LEVEL;
}

// Somme des bonus de tap, chaque palier compté à son niveau.
export function tapUpgradeBonus(levels) {
  const map = normalizeTapUpgrades(levels);
  return TAP_UPGRADES.reduce((sum, u) => sum + u.bonus * (map[u.id] || 0), 0);
}

// ---- Améliorations (30/08, refondues le 02/09) ----
// Elles fonctionnent EXACTEMENT comme les 4 mécaniques ci-dessus
// (Pacte/Faveur/Sanctuaire/Veilleur) : un niveau qui monte, un coût qui
// grimpe, un effet qui se cumule à chaque niveau. C'était la demande —
// des améliorations normales prolongeant le clicker, pas une grille
// d'objets à collectionner une fois chacun derrière des cases "???".
//
// Ce qui a été RETIRÉ le 02/09 : l'achat unique, les 4 paliers, et le
// verrouillage "❓ ??? ???" (idem côté auto-clics). Tout est visible dès
// le départ et se débloque naturellement par le prix, comme le reste du
// clicker. `tier` est conservé sur chaque entrée UNIQUEMENT comme ordre
// d'apparition dans la liste (les moins chères d'abord) — plus aucune
// fonction ne s'en sert pour autoriser ou interdire un achat.
//
// `cost` est le prix du 1er niveau ; `effect.value` est l'effet gagné
// PAR NIVEAU. `maxLevel` borne chaque amélioration : sans lui, un +8%
// de production répété à l'infini casserait toute l'économie.
export const UPGRADE_ITEMS = [
  { id: 'griffeBraisillon', name: 'Griffe de Braisillon', emoji: '🔥', tier: 1, cost: 640, effect: { type: 'tapFlat', value: 0.5 }, growth: 1.86, desc: '+0.5 pièce par tap' },
  { id: 'ecailleCaraploof', name: 'Écaille de Caraploof', emoji: '🌊', tier: 1, cost: 960, effect: { type: 'autoClickerPct', value: 0.025 }, growth: 2.16, desc: '+2.5% sur les auto-clics' },
  { id: 'crocBouldog', name: 'Croc de Bouldog', emoji: '🪨', tier: 1, cost: 1440, effect: { type: 'coinPct', value: 0.015 }, growth: 2.22, desc: '+1.5% sur toute la production' },
  { id: 'plumeVentis', name: 'Plume de Ventis', emoji: '🌬️', tier: 1, cost: 2000, effect: { type: 'critChancePct', value: 0.02 }, growth: 2.28, desc: '+2% de chance de coup critique' },
  { id: 'etincelleVoltix', name: 'Étincelle de Voltix', emoji: '⚡', tier: 1, cost: 2800, effect: { type: 'critMultPct', value: 0.05 }, growth: 2.04, desc: '+5% de dégâts critiques' },
  { id: 'eclatLuxorbe', name: 'Éclat de Luxorbe', emoji: '💡', tier: 2, cost: 6400, effect: { type: 'coinPct', value: 0.02 }, growth: 2.22, desc: '+2% sur toute la production' },
  { id: 'ombreOmbrillon', name: "Ombre d'Ombrillon", emoji: '🌑', tier: 2, cost: 8800, effect: { type: 'tapFlat', value: 1 }, growth: 1.86, desc: '+1 pièce par tap' },
  { id: 'runeGlyphon', name: 'Rune de Glyphon', emoji: '🔮', tier: 2, cost: 12000, effect: { type: 'autoClickerPct', value: 0.035 }, growth: 2.16, desc: '+3.5% sur les auto-clics' },
  { id: 'flammeFournax', name: 'Flamme de Fournax', emoji: '🔥', tier: 2, cost: 16000, effect: { type: 'coinPct', value: 0.025 }, growth: 2.22, desc: '+2.5% sur toute la production' },
  { id: 'perleAquamira', name: "Perle d'Aquamira", emoji: '🌊', tier: 2, cost: 20800, effect: { type: 'autoClickerPct', value: 0.04 }, growth: 2.16, desc: '+4% sur les auto-clics' },
  { id: 'pierreTerracroc', name: 'Pierre de Terracroc', emoji: '🪨', tier: 3, cost: 40000, effect: { type: 'tapFlat', value: 1.5 }, growth: 1.86, desc: '+1.5 pièces par tap' },
  { id: 'ventZephyrion', name: 'Vent de Zephyrion', emoji: '🌬️', tier: 3, cost: 52000, effect: { type: 'critChancePct', value: 0.03 }, growth: 2.28, desc: '+3% de chance de coup critique' },
  { id: 'noyauBrontobloc', name: 'Noyau de Brontobloc', emoji: '⚡', tier: 3, cost: 64000, effect: { type: 'critMultPct', value: 0.075 }, growth: 2.04, desc: '+7.5% de dégâts critiques' },
  { id: 'sceauMalefix', name: 'Sceau de Malefix', emoji: '🔮', tier: 3, cost: 80000, effect: { type: 'coinPct', value: 0.03 }, growth: 2.22, desc: '+3% sur toute la production' },
  { id: 'bouclierAegisolar', name: "Bouclier d'Aegisolar", emoji: '✨', tier: 3, cost: 104000, effect: { type: 'autoClickerPct', value: 0.05 }, growth: 2.16, desc: '+5% sur les auto-clics' },
  { id: 'voileNocturis', name: 'Voile de Nocturis', emoji: '🌑', tier: 4, cost: 200000, effect: { type: 'coinPct', value: 0.04 }, growth: 2.22, desc: '+4% sur toute la production' },
  { id: 'racineRacinea', name: 'Racine de Racinea', emoji: '🪨', tier: 4, cost: 256000, effect: { type: 'autoClickerPct', value: 0.06 }, growth: 2.16, desc: '+6% sur les auto-clics' },
  { id: 'glypheRunicor', name: 'Glyphe de Runicor', emoji: '🔮', tier: 4, cost: 320000, effect: { type: 'tapFlat', value: 3 }, growth: 1.86, desc: '+3 pièces par tap' },
  { id: 'petaleBraiserose', name: 'Pétale de Braiserose', emoji: '🔥', tier: 4, cost: 400000, effect: { type: 'critChancePct', value: 0.04 }, growth: 2.28, desc: '+4% de chance de coup critique' },
  { id: 'abysseAbyssorax', name: "Abysse d'Abyssorax", emoji: '🌊', tier: 4, cost: 520000, effect: { type: 'critMultPct', value: 0.1 }, growth: 2.04, desc: '+10% de dégâts critiques' },
];

// Coût du PROCHAIN niveau d'une amélioration. Le facteur vient de
// l'item (`growth`), pas d'une constante partagée : c'est lui qui
// remplace l'ancien plafond de niveau. Un effet qui compose avec tout
// le reste (pourcentage de production) grimpe plus vite qu'un +N par
// tap, donc s'auto-limite sans qu'on ait besoin d'interdire l'achat.
export function upgradeItemCost(item, level) {
  return Math.round(item.cost * Math.pow(item.growth || 1.7, level));
}

// Taux de convergence de la chance de crit : chaque niveau rapporte 75%
// du précédent. Total après N niveaux = value × (1 − r^N) / (1 − r),
// qui converge vers value × 4 — donc les 3 améliorations de crit
// réunies plafonnent à +36%, jamais 100%. Sans ça, retirer le cap de
// niveau rendait le crit garanti et la Faveur des Esprits inutile.
export const CRIT_CHANCE_DECAY = 0.75;
function geometricTotal(value, level, decay) {
  if (level <= 0) return 0;
  return (value * (1 - Math.pow(decay, level))) / (1 - decay);
}

// Additionne les effets de toutes les améliorations, chaque effet
// multiplié par son niveau.
//
// `levels` est un objet { id: niveau }. Les sauvegardes d'AVANT le
// 02/09 stockaient un TABLEAU d'ids achetés : on l'accepte toujours et
// on le lit comme « niveau 1 pour chaque id présent », ce qui conserve
// exactement les bonus déjà acquis par les joueurs existants. Sans ce
// repli, une vieille sauvegarde perdrait silencieusement tous ses
// bonus d'améliorations au premier lancement.
export function upgradeBonuses(levels) {
  const totals = { coinPct: 0, tapFlat: 0, autoClickerPct: 0, critChancePct: 0, critMultPct: 0 };
  const map = normalizeUpgradeLevels(levels);
  UPGRADE_ITEMS.forEach((u) => {
    const lvl = map[u.id] || 0;
    if (lvl <= 0) return;
    // La chance de crit converge (bornée à 100% par nature) ; tout le
    // reste s'additionne linéairement, son coût exponentiel suffisant à
    // le tenir en bride.
    totals[u.effect.type] +=
      u.effect.type === 'critChancePct'
        ? geometricTotal(u.effect.value, lvl, CRIT_CHANCE_DECAY)
        : u.effect.value * lvl;
  });
  return totals;
}

// Convertit l'ancien format (tableau d'ids) OU le nouveau (objet
// id -> niveau) vers le nouveau. Toujours passer par elle avant de lire
// des niveaux venant d'une sauvegarde.
export function normalizeUpgradeLevels(levels) {
  if (Array.isArray(levels)) {
    const out = {};
    levels.forEach((id) => { out[id] = 1; });
    return out;
  }
  return levels && typeof levels === 'object' ? levels : {};
}

// ---- Ascension (prestige) ----
// Réinitialise la progression contre un bonus PERMANENT (essence), qui
// persiste à travers les résets suivants. Le gain d'essence dépend du
// total de pièces gagnées sur toute la partie (pas juste le solde
// actuel, qui peut avoir été dépensé) — récompense la progression
// globale, pas la thésaurisation.
// Refonte 02/09. L'ancien seuil (50 000) et l'ancienne formule
// (√(lifetime/10 000), +2%/essence) dataient d'une économie où le joueur
// gagnait quelques milliers de pièces par heure. Avec les auto-clics, la
// simulation franchissait ce seuil en quelques minutes et rendait des
// milliers de points d'essence — soit plusieurs milliers de pourcents de
// production permanente dès le premier run.
//
// C'est l'Ascension qui porte la longévité du jeu : une course en ligne
// droite finit toujours par s'aplatir (une fois les 15 générateurs
// débloqués, l'empilement seul est logarithmique). Le nouveau seuil est
// calé pour tomber vers 3-4h de jeu, et l'exposant 0,3 fait qu'un run
// deux fois plus long ne rapporte qu'environ 23% d'essence en plus —
// c'est ce qui rend le rebouclage plus payant que l'étirement. Testé à
// 0,4 d'abord : un run d'un mois rendait +18 000% de production
// permanente, ce qui aurait effacé toute la courbe au run suivant.
// Seuil de la PROCHAINE Ascension : 5M, puis 10M, 20M, 40M... Il double
// à chaque fois. Le seuil unique à 100M était hors de portée d'un
// premier run (mesuré à plus de 5h de jeu), donc le défi « Fais
// l'Ascension » du cycle 5 bloquait la séquence.
export const ASCENSION_FIRST_THRESHOLD = 5000000; // 5M
export function ascensionThreshold(ascensionCount) {
  const n = Number.isFinite(ascensionCount) ? Math.max(0, ascensionCount) : 0;
  return ASCENSION_FIRST_THRESHOLD * Math.pow(2, n);
}

// Conservé pour compatibilité d'affichage : c'est le seuil de la 1re.
export const ASCENSION_MIN_LIFETIME_EARNED = ASCENSION_FIRST_THRESHOLD;

export function ascensionEssenceGain(totalCoinsEarnedLifetime, ascensionCount = 0) {
  const threshold = ascensionThreshold(ascensionCount);
  if (totalCoinsEarnedLifetime < threshold) return 0;
  return Math.floor(Math.pow(totalCoinsEarnedLifetime / threshold, 0.3));
}
export const ESSENCE_BONUS_PER_POINT = 0.01;
export function essenceBonusMultiplier(essence) {
  return 1 + essence * ESSENCE_BONUS_PER_POINT; // +1% permanent par point
}

// ---- Récompenses d'Ascension (refonte : Ascension non destructive) ----
//
// L'Ascension ne réinitialise plus QUE l'économie du clicker (pièces,
// Pacte, Faveur, Sanctuaire, Veilleur, auto-clics, améliorations). Elle
// laisse intacts : les créatures possédées, le deck, et toute la
// progression du mode Aventure (niveaux, Griffes, runes). Perdre ses
// monstres et sa campagne rendait le prestige punitif au lieu d'être une
// récompense — et la progression d'Aventure ne vit même pas dans la
// sauvegarde du clicker, la remettre à zéro d'ici aurait été une
// écriture croisée, exactement ce qu'on s'interdit.

// Vitesse de progression gagnée : +30% par Ascension, multiplicatif.
// C'est la vraie récompense de prestige — elle s'applique à toute la
// production du clicker, donc le run suivant est franchement plus rapide
// sans que le joueur ait à tout reconstruire depuis rien.
export const ASCENSION_SPEED_BONUS = 0.3;
export function ascensionSpeedMultiplier(ascensionCount) {
  const n = Number.isFinite(ascensionCount) ? Math.max(0, ascensionCount) : 0;
  return Math.pow(1 + ASCENSION_SPEED_BONUS, n);
}

// Griffes offertes par la n-ième Ascension (n commence à 1).
//
// Le gain suit une RACINE CARRÉE : rapide au début, de plus en plus lent.
//
// Volontairement calibré BAS, et surtout PAS sur « le coût d'une créature
// menée au palier maximum ». Ce repère était mauvais pour deux raisons :
// des paliers d'évolution supplémentaires sont prévus, donc ce plafond
// va bouger ; et se caler dessus revenait à garantir au joueur de tout
// débloquer en N Ascensions, ce qui vide les Griffes de leur valeur.
//
// L'Ascension est un COMPLÉMENT au revenu de Griffes, pas sa source
// principale : celle-ci reste le combat en Aventure (~410 Griffes pour
// les 20 premiers niveaux). Une Ascension donne ici l'équivalent de
// quelques victoires, de quoi débloquer une évolution en attente, pas de
// quoi s'acheter la collection.
export const ASCENSION_GRIFFES_BASE = 60;
export function ascensionGriffesReward(ascensionNumber) {
  const n = Number.isFinite(ascensionNumber) ? Math.max(1, Math.floor(ascensionNumber)) : 1;
  return Math.round(ASCENSION_GRIFFES_BASE * Math.sqrt(n));
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
    { id: 'seq_earn10k', icon: '💰', metric: 'totalEarned', target: 5000, mode: 'delta',
      label: () => 'Obtiens 5 000 pièces' },
    { id: 'seq_pacte15', icon: '🔗', metric: 'tapPower', target: 10, mode: 'absolute',
      label: () => 'Monte Pacte au niveau 10' },
    { id: 'seq_transe30', icon: '🔥', metric: 'maxTranseHoldSec', target: 30, mode: 'absolute',
      label: () => 'Reste en Transe x2,5 pendant 30 secondes' },
    { id: 'seq_golden3', icon: '⭐', metric: 'goldenClaimed', target: 3, mode: 'delta',
      label: () => 'Touche 3 fois la cible dorée' },
  ],
  // --- Cycle 2 : critiques, Offrande, premier combat ---
  [
    { id: 'seq_crit20', icon: '💥', metric: 'totalCrits', target: 20, mode: 'delta',
      label: () => 'Obtiens 20 coups critiques' },
    { id: 'seq_offering2', icon: '🪙', metric: 'offering', target: 2, mode: 'delta',
      label: () => 'Fais 2 Offrandes' },
    { id: 'seq_adv_c1l1', icon: '⚔️', metric: 'advLevelReached', target: 3, mode: 'absolute',
      label: () => 'Termine le chapitre 1, niveau 3' },
    { id: 'seq_esprit10', icon: '👻', metric: 'auto:esprit', target: 10, mode: 'absolute',
      label: () => 'Possède 10 Esprits Frappeurs' },
  ],
  // --- Cycle 3 : pouvoirs, Sanctuaire, revenu passif (5 défis) ---
  [
    { id: 'seq_power5', icon: '✨', metric: 'powerActivated', target: 5, mode: 'delta',
      label: () => 'Active 5 fois un pouvoir de créature' },
    { id: 'seq_adv_c1l10', icon: '⚔️', metric: 'advLevelReached', target: 10, mode: 'absolute',
      label: () => 'Termine le chapitre 1, niveau 10' },
    { id: 'seq_sanct10', icon: '🏛️', metric: 'sanctuaryLevel', target: 10, mode: 'absolute',
      label: () => 'Monte le Sanctuaire au niveau 10' },
    { id: 'seq_hold100k', icon: '🏦', metric: 'coins', target: 100000, mode: 'absolute',
      label: () => 'Aie 100 000 pièces en réserve' },
    { id: 'seq_passive50', icon: '📈', metric: 'passiveIncome', target: 50, mode: 'absolute',
      label: () => 'Atteins 50 pièces par seconde en auto-clic' },
  ],
  // --- Cycle 4 : montée en puissance ---
  [
    { id: 'seq_golden6', icon: '⭐', metric: 'goldenClaimed', target: 6, mode: 'delta',
      label: () => 'Touche 6 fois la cible dorée' },
    { id: 'seq_veilleur10', icon: '🌙', metric: 'veilleurLevel', target: 10, mode: 'absolute',
      label: () => 'Monte le Veilleur au niveau 10' },
    { id: 'seq_crit40', icon: '💥', metric: 'totalCrits', target: 40, mode: 'delta',
      label: () => 'Obtiens 40 coups critiques' },
    { id: 'seq_adv_c2l5', icon: '⚔️', metric: 'advLevelReached', target: 15, mode: 'absolute',
      label: () => 'Termine le chapitre 2, niveau 5' },
  ],
  // --- Cycle 5 : première Ascension ---
  [
    { id: 'seq_offering5', icon: '🪙', metric: 'offering', target: 5, mode: 'delta',
      label: () => 'Fais 5 Offrandes' },
    { id: 'seq_griffe5', icon: '🔥', metric: 'upgrade:griffeBraisillon', target: 5, mode: 'absolute',
      label: () => 'Monte Griffe de Braisillon au niveau 5' },
    { id: 'seq_adv_c2l10', icon: '⚔️', metric: 'advLevelReached', target: 20, mode: 'absolute',
      label: () => 'Termine le chapitre 2, niveau 10' },
    { id: 'seq_ascend1', icon: '🌟', metric: 'ascension', target: 1, mode: 'delta',
      label: () => "Fais l'Ascension" },
  ],
  // --- Cycle 6 : relance après Ascension ---
  [
    { id: 'seq_earn100k', icon: '💰', metric: 'totalEarned', target: 100000, mode: 'delta',
      label: () => 'Regagne 100 000 pièces' },
    { id: 'seq_pacte20', icon: '🔗', metric: 'tapPower', target: 20, mode: 'absolute',
      label: () => 'Monte Pacte au niveau 20' },
    { id: 'seq_rune1', icon: '🛒', metric: 'runeBought', target: 1, mode: 'delta',
      label: () => 'Achète 1 rune en Aventure' },
    { id: 'seq_adv_c3l5', icon: '⚔️', metric: 'advLevelReached', target: 25, mode: 'absolute',
      label: () => 'Termine le chapitre 3, niveau 5' },
  ],
  // --- Cycle 7 : runes et évolution ---
  [
    { id: 'seq_equipRune2', icon: '🪬', metric: 'runeEquipped', target: 2, mode: 'delta',
      label: () => 'Équipe 2 runes sur tes créatures' },
    // Remplacé : le Sanctuaire est plafonné à 10, « niveau 15 » était
    // devenu littéralement impossible et bloquait l'œuf pour toujours.
    { id: 'seq_sanct15', icon: '✊', metric: 'tapUpgrade:tap1', target: 5, mode: 'absolute',
      label: () => 'Monte Poigne Ancienne au niveau 5' },
    { id: 'seq_hold1M', icon: '🏦', metric: 'coins', target: 1000000, mode: 'absolute',
      label: () => 'Aie 1 million de pièces en réserve' },
    { id: 'seq_evolve1', icon: '🧬', metric: 'maxEvolutionTier', target: 1, mode: 'absolute',
      label: () => 'Fais évoluer une créature au palier 1' },
  ],
  // --- Cycle 8 : rythme ---
  [
    { id: 'seq_power10', icon: '✨', metric: 'powerActivated', target: 10, mode: 'delta',
      label: () => 'Active 10 fois un pouvoir de créature' },
    { id: 'seq_main10', icon: '🖐️', metric: 'auto:main', target: 10, mode: 'absolute',
      label: () => 'Possède 10 Mains Spectrales' },
    { id: 'seq_adv_c3l10', icon: '⚔️', metric: 'advLevelReached', target: 30, mode: 'absolute',
      label: () => 'Termine le chapitre 3, niveau 10' },
    { id: 'seq_crit100', icon: '💥', metric: 'totalCrits', target: 100, mode: 'delta',
      label: () => 'Obtiens 100 coups critiques' },
  ],
  // --- Cycle 9 : profondeur ---
  [
    { id: 'seq_hold10M', icon: '🏦', metric: 'coins', target: 10000000, mode: 'absolute',
      label: () => 'Aie 10 millions de pièces en réserve' },
    { id: 'seq_croc10', icon: '🪨', metric: 'upgrade:crocBouldog', target: 10, mode: 'absolute',
      label: () => 'Monte Croc de Bouldog au niveau 10' },
    { id: 'seq_fuse2', icon: '🔮', metric: 'runeFused', target: 2, mode: 'delta',
      label: () => 'Fusionne 2 runes' },
    { id: 'seq_adv_c4l10', icon: '⚔️', metric: 'advLevelReached', target: 40, mode: 'absolute',
      label: () => 'Termine le chapitre 4, niveau 10' },
  ],
  // --- Cycle 10 : seconde Ascension, dernier cycle scripté ---
  [
    { id: 'seq_hold50M', icon: '🏦', metric: 'coins', target: 50000000, mode: 'absolute',
      label: () => 'Aie 50 millions de pièces en réserve' },
    // Remplacé pour la même raison : le Veilleur est plafonné à 10.
    { id: 'seq_veilleur20', icon: '🪄', metric: 'tapUpgrade:tap2', target: 5, mode: 'absolute',
      label: () => 'Monte Gantelet Runique au niveau 5' },
    { id: 'seq_feed30', icon: '🍖', metric: 'maxCreatureLevel', target: 30, mode: 'absolute',
      label: () => 'Nourris une créature jusqu\'au niveau 30' },
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
  { id: 'crit400', family: 'action', icon: '💥', metric: 'totalCrits', target: 400, mode: 'delta',
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
  { id: 'summon30', family: 'action', icon: '🔮', metric: 'totalSummons', target: 30, mode: 'delta',
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
  { id: 'essence5', family: 'collection', icon: '🌟', metric: 'essence', mode: 'absolute', step: 5, minStep: 5,
    available: (s) => (s.essence || 0) > 0,
    label: (t) => `Accumule ${t} points d'essence` },

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
    label: (t) => `Gagne ${t} combats en Aventure` },
  { id: 'advWin10', family: 'adventure', icon: '⚔️', metric: 'battleWon', target: 10, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.battleWon || 0) >= 3,
    label: (t) => `Gagne ${t} combats en Aventure` },
  // Les runes s'achètent avec des Griffes, qui ne s'obtiennent qu'en
  // gagnant des combats : exiger un combat déjà gagné, pas seulement une
  // créature.
  { id: 'advBuyRune1', family: 'adventure', icon: '🛒', metric: 'runeBought', target: 1, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.battleWon || 0) >= 1,
    label: (t) => `Achète ${t} rune en Aventure` },
  { id: 'advBuyRune5', family: 'adventure', icon: '🛒', metric: 'runeBought', target: 5, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.runeBought || 0) >= 1,
    label: (t) => `Achète ${t} runes en Aventure` },
  // On ne peut équiper une rune qu'après en avoir acheté une.
  { id: 'advEquipRune2', family: 'adventure', icon: '🪬', metric: 'runeEquipped', target: 2, mode: 'delta',
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

// Budget de pièces qu'un joueur produit en `minutes` minutes de jeu.
export function questBudget(stats, minutes) {
  return estimatedIncomePerSecond(stats) * 60 * Math.max(1, minutes);
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
export function resolveQuestTarget(quest, stats) {
  if (!quest) return 1;
  if (quest.target) return quest.target; // défi à cible fixe (rythme d'action)
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
export function questProgress(questId, stats, baseline = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return 0;
  const target = targets[questId] || resolveQuestTarget(q, baseline && baseline.totalEarned !== undefined ? baseline : stats);
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
export function questLabel(questId, target) {
  const q = findQuest(questId);
  if (!q) return '';
  return q.label(target || q.target || 1);
}

export function questDetail(questId, stats, baseline = {}, targets = {}) {
  const q = findQuest(questId);
  if (!q) return { icon: '🎯', label: '', progress: 0, target: 1, current: 0, done: false };
  const target = targets[questId] || resolveQuestTarget(q, stats);
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
export function nextQuestSet(index, excludeIds = [], stats = {}) {
  const cycle = sequenceCycle(index);
  if (cycle) {
    const targets = {};
    cycle.forEach((q) => { targets[q.id] = q.target; });
    return { ids: cycle.map((q) => q.id), targets, fromSequence: true };
  }
  return { ...pickQuestSet(excludeIds, stats), fromSequence: false };
}

export const QUEST_SET_SIZE = 4;

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
  const eligible = QUEST_POOL.filter((q) => !q.available || q.available(stats));
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

export const HATCH_TAPS_REQUIRED = 500;
export const CAPTURE_TAPS_REQUIRED = 200;

// ---- Boutique d'auto-clics ----
// Remplace l'ancien "Familier" (un seul niveau) par un vrai menu boutique
// à plusieurs générateurs, façon jeu incrémental classique : chaque
// palier a son propre coût et son propre revenu, achetable plusieurs
// fois (le coût grimpe à chaque achat du MÊME palier). Nécessaire suite
// à la décision de retirer le revenu passif automatique des créatures —
// c'est maintenant la seule source de revenu passif du jeu.
// `tier` (1-3) ne sert plus qu'à l'ORDRE d'affichage dans la boutique
// (02/09) : les 15 générateurs sont tous visibles dès le départ, le prix
// suffit à échelonner la progression. Le verrouillage par palier a été
// retiré en même temps que celui des améliorations.
// Coûts recalibrés le 02/09 : x33 puis +30% sur les prix de base
// (l'Esprit Frappeur passe de 15 à 650) et x4 sur les revenus. Ce couple a été
// trouvé PAR SIMULATION, pas choisi : la cible était « 50 pièces/s de
// revenu passif au bout d'1 heure », et seul ce rapport prix/revenu la
// tient. Monter les prix seuls écrasait la courbe (10/s à 1h), monter
// les revenus seuls la faisait exploser.
export const AUTOCLICKERS = [
  { id: 'esprit', name: 'Esprit Frappeur', emoji: '👻', baseCost: 650, baseIncome: 0.4, tier: 1 },
  { id: 'main', name: 'Main Spectrale', emoji: '🖐️', baseCost: 11120, baseIncome: 4, tier: 1 },
  { id: 'automate', name: 'Automate Runique', emoji: '⚙️', baseCost: 76030, baseIncome: 16, tier: 1 },
  { id: 'colonie', name: 'Colonie de Familiers', emoji: '🦊', baseCost: 723160, baseIncome: 89, tier: 1 },
  { id: 'titan', name: 'Titan Mécanique', emoji: '🗿', baseCost: 6447000, baseIncome: 464, tier: 1 },
  { id: 'golem', name: 'Golem de Cristal', emoji: '💎', baseCost: 56381000, baseIncome: 2373, tier: 2 },
  { id: 'dragonnet', name: 'Dragon Miniature', emoji: '🐉', baseCost: 491482000, baseIncome: 12097, tier: 2 },
  { id: 'phenix', name: 'Phénix Renaissant', emoji: '🔥', baseCost: 4275000000, baseIncome: 61538, tier: 2 },
  { id: 'leviathan', name: 'Léviathan des Abysses', emoji: '🐋', baseCost: 26206000000, baseIncome: 220588, tier: 2 },
  { id: 'gardien', name: 'Gardien Céleste', emoji: '👼', baseCost: 142206000000, baseIncome: 700000, tier: 2 },
  { id: 'titanfoudre', name: 'Titan de Foudre', emoji: '⚡', baseCost: 471753000000, baseIncome: 1358000, tier: 3 },
  { id: 'colosse', name: 'Colosse de Pierre', emoji: '🗻', baseCost: 4630487000000, baseIncome: 7795000, tier: 3 },
  { id: 'oracle', name: 'Oracle Ancien', emoji: '🔯', baseCost: 30473893000000, baseIncome: 30000000, tier: 3 },
  { id: 'seigneurombres', name: 'Seigneur des Ombres', emoji: '🌑', baseCost: 187597288000000, baseIncome: 108000000, tier: 3 },
  { id: 'etoilefilante', name: 'Étoile Filante', emoji: '⭐', baseCost: 1104948027000000, baseIncome: 372000000, tier: 3 },
];

// Coût pour acheter UNE unité de plus d'un générateur donné, sachant
// combien on en possède déjà (le coût grimpe à chaque achat du même palier).
//
// Refonte du 02/09 : 1,15 → 1,25. C'est le levier d'équilibrage le plus
// puissant du jeu, parce qu'il s'applique à la seule source de revenu
// passif. À 1,15, la simulation débloquait les 15 générateurs en 6h et
// la progression devenait complètement plate ensuite ; à 1,25 elle
// s'étale sur un vrai run (3 générateurs à 30min, 6 à 4h, 10 à 12h).
export const AUTOCLICKER_COST_GROWTH = 1.25;
export function autoClickerCost(clicker, ownedCount) {
  return Math.round(clicker.baseCost * Math.pow(AUTOCLICKER_COST_GROWTH, ownedCount));
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

// NOTE D'ORDRE : ce bloc vit en FIN de fichier, pas à côté du reste des
// défis. Il s'exécute au chargement du module et lit `AUTOCLICKERS`, qui
// est déclaré plus bas que la section des défis — le placer près d'elle
// provoquait un « Cannot access 'AUTOCLICKERS' before initialization »
// au premier import. Déplacer ce bloc vers le haut casse le jeu.

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

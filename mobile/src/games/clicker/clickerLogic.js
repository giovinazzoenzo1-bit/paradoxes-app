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

// Coût (en pièces) pour faire passer une créature possédée du niveau
// `level` à `level+1`.
export function levelUpCost(creature, level) {
  // 6 paliers désormais (ratio ~x1,6 entre chaque, cohérent avec la
  // progression déjà en place pour commun→rare→épique→légendaire) —
  // "peu_commun" et "mythique" manquaient ici depuis le passage aux 6
  // paliers de rareté, ce qui rendait le coût NaN (donc le nourrissage
  // impossible) pour TOUTE créature de ces deux raretés, pas seulement
  // les Mythiques.
  const rarityFactor = { commun: 1, peu_commun: 1.3, rare: 1.6, epique: 2.6, legendaire: 4.2, mythique: 6.7 }[creature.rarity];
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
// Refonte 02/09 : +5%/niveau à ×1,7 → +2,5%/niveau à ×2,0. Le
// Sanctuaire multiplie TOUT (tap ET passif), donc il compose avec
// chaque autre bonus : c'était le second accélérateur de la courbe
// après les auto-clics. Deux fois moins d'effet, pour un coût qui
// double à chaque niveau.
export function sanctuaryMultiplier(level) {
  return 1 + level * 0.025;
}
export function sanctuaryUpgradeCost(level) {
  return Math.round(60 * Math.pow(2.0, level));
}

// ---- Veilleur (gains hors-ligne) ----
export function veilleurOfflineMultiplier(level) {
  return 1 + level * 0.15;
}
export function veilleurUpgradeCost(level) {
  return Math.round(50 * Math.pow(1.6, level));
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
export const ASCENSION_MIN_LIFETIME_EARNED = 100000000; // 100M
export function ascensionEssenceGain(totalCoinsEarnedLifetime) {
  if (totalCoinsEarnedLifetime < ASCENSION_MIN_LIFETIME_EARNED) return 0;
  return Math.floor(Math.pow(totalCoinsEarnedLifetime / ASCENSION_MIN_LIFETIME_EARNED, 0.3));
}
export const ESSENCE_BONUS_PER_POINT = 0.01;
export function essenceBonusMultiplier(essence) {
  return 1 + essence * ESSENCE_BONUS_PER_POINT; // +1% permanent par point
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
// ---- Défis de l'œuf (refonte 02/09) ----
//
// Un défi est DÉCLARATIF : il nomme une métrique, un objectif, et un
// mode de lecture. `questProgress()` est générique — ajouter un défi ne
// demande plus de toucher à une seule ligne de logique, seulement
// d'ajouter une entrée dans ce tableau. L'ancien switch géant devenait
// intenable passé une dizaine de défis.
//
// Champs :
//   id      identifiant stable, JAMAIS renommé (il vit dans les sauvegardes)
//   tier    phase de jeu (1-6) — voir QUEST_TIERS juste en dessous
//   icon    pastille de la barre de défi
//   desc    libellé affiché
//   metric  quoi mesurer (voir readMetric)
//   target  valeur à atteindre
//   mode    'absolute' = état atteint ici et maintenant
//           'delta'    = progression DEPUIS le tirage du défi
//
// Le choix du mode n'est pas cosmétique. `delta` sert aux compteurs qui
// ne redescendent jamais (invocations, critiques, combats gagnés) : sans
// lui, un vétéran validerait le défi à l'instant du tirage. `absolute`
// sert aux états que le joueur possède ou pas (niveau d'un Pacte, pièces
// en banque, générateurs achetés) — les avoir déjà EST la preuve de
// progression, et les remettre à zéro n'aurait aucun sens.

// Bornes de `totalEarned` délimitant les 6 phases de jeu. Calées sur la
// courbe MESURÉE en simulation lors de la refonte d'équilibrage (voir
// CLICKER_ADVENTURE_STATE.md), pas choisies à l'œil : un premier jeu de
// seuils « ronds » faisait entrer le joueur en phase 2 au bout de 10
// minutes et en phase 6 au bout d'une journée, ce qui vidait tout le
// contenu des phases hautes en un jour.
//
// Durées visées, joueur régulier : phase 1 ≈ 30 min, phase 2 → 3 h,
// phase 3 → 12 h, phase 4 → 1 j, phase 5 → 5 j, phase 6 au-delà (et
// c'est là que l'Ascension prend le relais).
export const QUEST_TIER_THRESHOLDS = [
  0,
  150000, // ~30 min
  100000000, // ~3 h
  300000000000, // ~12 h
  5000000000000000, // ~1 j
  300000000000000000, // ~5 j
];

// Phase actuelle du joueur (1-6) d'après son total de pièces gagnées.
export function playerQuestTier(stats) {
  const earned = Number.isFinite(stats?.totalEarned) ? stats.totalEarned : 0;
  let tier = 1;
  for (let i = 0; i < QUEST_TIER_THRESHOLDS.length; i++) {
    if (earned >= QUEST_TIER_THRESHOLDS[i]) tier = i + 1;
  }
  return Math.min(6, tier);
}

export const QUEST_POOL = [
  // ---------- Phase 1 : découverte ----------
  { id: 'combo25', tier: 1, icon: '🔥', desc: "Atteins un multiplicateur de Transe x2,5", metric: 'maxCombo', target: 25, mode: 'absolute' },
  { id: 'summon10', tier: 1, icon: '🔮', desc: "Invoque 10 créatures", metric: 'totalSummons', target: 10, mode: 'delta' },
  { id: 'crit20', tier: 1, icon: '💥', desc: "Obtiens 20 coups critiques", metric: 'totalCrits', target: 20, mode: 'delta' },
  { id: 'golden3', tier: 1, icon: '⭐', desc: "Touche 3 fois la cible dorée", metric: 'goldenClaimed', target: 3, mode: 'delta' },
  { id: 'earn5000', tier: 1, icon: '💰', desc: "Gagne 60 000 pièces", metric: 'totalEarned', target: 60000, mode: 'delta' },
  { id: 'pacte5', tier: 1, icon: '🔗', desc: "Fais monter Pacte au niveau 15", metric: 'tapPower', target: 15, mode: 'absolute' },
  { id: 'hold2500', tier: 1, icon: '🏦', desc: "Aie 51 000 pièces en réserve", metric: 'coins', target: 51000, mode: 'absolute' },
  { id: 'auto10', tier: 1, icon: '⚙️', desc: "Possède 55 auto-clics en tout", metric: 'autoTotal', target: 55, mode: 'absolute' },
  { id: 'esprit8', tier: 1, icon: '👻', desc: "Possède 30 Esprits Frappeurs", metric: 'auto:esprit', target: 30, mode: 'absolute' },
  { id: 'own3', tier: 1, icon: '🐣', desc: "Possède 3 créatures différentes", metric: 'ownedCount', target: 3, mode: 'absolute' },

  // ---------- Phase 2 : première accélération ----------
  { id: 'hold50k', tier: 2, icon: '🏦', desc: "Aie 15 millions de pièces en réserve", metric: 'coins', target: 15000000, mode: 'absolute' },
  { id: 'earn250k', tier: 2, icon: '💰', desc: "Gagne 40 millions de pièces", metric: 'totalEarned', target: 40000000, mode: 'delta' },
  { id: 'pacte15', tier: 2, icon: '🔗', desc: "Fais monter Pacte au niveau 30", metric: 'tapPower', target: 30, mode: 'absolute' },
  { id: 'griffe5', tier: 2, icon: '🔥', desc: "Monte Griffe de Braisillon au niveau 15", metric: 'upgrade:griffeBraisillon', target: 15, mode: 'absolute' },
  { id: 'ecaille4', tier: 2, icon: '🌊', desc: "Monte Écaille de Caraploof au niveau 10", metric: 'upgrade:ecailleCaraploof', target: 10, mode: 'absolute' },
  { id: 'sanct8', tier: 2, icon: '🏛️', desc: "Monte le Sanctuaire au niveau 15", metric: 'sanctuaryLevel', target: 15, mode: 'absolute' },
  { id: 'main12', tier: 2, icon: '🖐️', desc: "Possède 45 Mains Spectrales", metric: 'auto:main', target: 45, mode: 'absolute' },
  { id: 'passive100', tier: 2, icon: '📈', desc: "Atteins 49 000 pièces par seconde", metric: 'passiveIncome', target: 49000, mode: 'absolute' },
  { id: 'crit100', tier: 2, icon: '💥', desc: "Obtiens 150 coups critiques", metric: 'totalCrits', target: 150, mode: 'delta' },
  { id: 'summon25', tier: 2, icon: '🔮', desc: "Invoque 40 créatures", metric: 'totalSummons', target: 40, mode: 'delta' },
  { id: 'feed10', tier: 2, icon: '🍖', desc: "Nourris une créature jusqu'au niveau 10", metric: 'maxCreatureLevel', target: 10, mode: 'absolute' },
  { id: 'faveur6', tier: 2, icon: '✨', desc: "Monte la Faveur des Esprits au niveau 6", metric: 'critLevel', target: 6, mode: 'absolute' },

  // ---------- Phase 3 : le million ----------
  { id: 'hold1M', tier: 3, icon: '🏦', desc: "Aie 20 milliards de pièces en réserve", metric: 'coins', target: 20000000000, mode: 'absolute' },
  { id: 'earn10M', tier: 3, icon: '💰', desc: "Gagne 120 milliards de pièces", metric: 'totalEarned', target: 120000000000, mode: 'delta' },
  { id: 'pacte30', tier: 3, icon: '🔗', desc: "Fais monter Pacte au niveau 45", metric: 'tapPower', target: 45, mode: 'absolute' },
  { id: 'croc8', tier: 3, icon: '🪨', desc: "Monte Croc de Bouldog au niveau 20", metric: 'upgrade:crocBouldog', target: 20, mode: 'absolute' },
  { id: 'luxorbe6', tier: 3, icon: '💡', desc: "Monte Éclat de Luxorbe au niveau 15", metric: 'upgrade:eclatLuxorbe', target: 15, mode: 'absolute' },
  { id: 'automate15', tier: 3, icon: '⚙️', desc: "Possède 70 Automates Runiques", metric: 'auto:automate', target: 70, mode: 'absolute' },
  { id: 'auto60', tier: 3, icon: '🔧', desc: "Possède 430 auto-clics en tout", metric: 'autoTotal', target: 430, mode: 'absolute' },
  { id: 'passive10k', tier: 3, icon: '📈', desc: "Atteins 66 millions de pièces par seconde", metric: 'passiveIncome', target: 66000000, mode: 'absolute' },
  { id: 'sanct15', tier: 3, icon: '🏛️', desc: "Monte le Sanctuaire au niveau 25", metric: 'sanctuaryLevel', target: 25, mode: 'absolute' },
  { id: 'own8', tier: 3, icon: '🐣', desc: "Possède 8 créatures différentes", metric: 'ownedCount', target: 8, mode: 'absolute' },
  { id: 'golden15', tier: 3, icon: '⭐', desc: "Touche 20 fois la cible dorée", metric: 'goldenClaimed', target: 20, mode: 'delta' },
  { id: 'veilleur8', tier: 3, icon: '🌙', desc: "Monte le Veilleur au niveau 8", metric: 'veilleurLevel', target: 8, mode: 'absolute' },
  { id: 'evolve1', tier: 3, icon: '🧬', desc: "Fais évoluer une créature jusqu'au stade final", metric: 'maxCreatureLevel', target: 15, mode: 'absolute' },

  // ---------- Phase 4 : industrialisation ----------
  { id: 'hold30M', tier: 4, icon: '🏦', desc: "Aie 120 billions de pièces en réserve", metric: 'coins', target: 120000000000000, mode: 'absolute' },
  { id: 'earn1B', tier: 4, icon: '💰', desc: "Gagne 2 millions de milliards de pièces", metric: 'totalEarned', target: 2000000000000000, mode: 'delta' },
  { id: 'pacte50', tier: 4, icon: '🔗', desc: "Fais monter Pacte au niveau 65", metric: 'tapPower', target: 65, mode: 'absolute' },
  { id: 'colonie20', tier: 4, icon: '🦊', desc: "Possède 100 Colonies de Familiers", metric: 'auto:colonie', target: 100, mode: 'absolute' },
  { id: 'titan12', tier: 4, icon: '🗿', desc: "Possède 90 Titans Mécaniques", metric: 'auto:titan', target: 90, mode: 'absolute' },
  { id: 'auto150', tier: 4, icon: '🔧', desc: "Possède 980 auto-clics en tout", metric: 'autoTotal', target: 980, mode: 'absolute' },
  { id: 'passive1M', tier: 4, icon: '📈', desc: "Atteins 400 milliards de pièces par seconde", metric: 'passiveIncome', target: 400000000000, mode: 'absolute' },
  { id: 'sanct25', tier: 4, icon: '🏛️', desc: "Monte le Sanctuaire au niveau 40", metric: 'sanctuaryLevel', target: 40, mode: 'absolute' },
  { id: 'flamme10', tier: 4, icon: '🔥', desc: "Monte Flamme de Fournax au niveau 30", metric: 'upgrade:flammeFournax', target: 30, mode: 'absolute' },
  { id: 'sceau8', tier: 4, icon: '🔮', desc: "Monte Sceau de Malefix au niveau 25", metric: 'upgrade:sceauMalefix', target: 25, mode: 'absolute' },
  { id: 'own14', tier: 4, icon: '🐣', desc: "Possède 14 créatures différentes", metric: 'ownedCount', target: 14, mode: 'absolute' },
  { id: 'feed30', tier: 4, icon: '🍖', desc: "Nourris une créature jusqu'au niveau 30", metric: 'maxCreatureLevel', target: 30, mode: 'absolute' },
  { id: 'crit1000', tier: 4, icon: '💥', desc: "Obtiens 1 500 coups critiques", metric: 'totalCrits', target: 1500, mode: 'delta' },

  // ---------- Phase 5 : fin de run ----------
  { id: 'hold10B', tier: 5, icon: '🏦', desc: "Aie 390 billions de pièces en réserve", metric: 'coins', target: 390000000000000, mode: 'absolute' },
  { id: 'earn500B', tier: 5, icon: '💰', desc: "Gagne 120 millions de milliards de pièces", metric: 'totalEarned', target: 120000000000000000, mode: 'delta' },
  { id: 'pacte70', tier: 5, icon: '🔗', desc: "Fais monter Pacte au niveau 75", metric: 'tapPower', target: 75, mode: 'absolute' },
  { id: 'golem25', tier: 5, icon: '💎', desc: "Possède 95 Golems de Cristal", metric: 'auto:golem', target: 95, mode: 'absolute' },
  { id: 'phenix15', tier: 5, icon: '🔥', desc: "Possède 75 Phénix Renaissants", metric: 'auto:phenix', target: 75, mode: 'absolute' },
  { id: 'auto400', tier: 5, icon: '🔧', desc: "Possède 1 300 auto-clics en tout", metric: 'autoTotal', target: 1300, mode: 'absolute' },
  { id: 'passive1B', tier: 5, icon: '📈', desc: "Atteins 1,3 billion de pièces par seconde", metric: 'passiveIncome', target: 1300000000000, mode: 'absolute' },
  { id: 'sanct35', tier: 5, icon: '🏛️', desc: "Monte le Sanctuaire au niveau 45", metric: 'sanctuaryLevel', target: 45, mode: 'absolute' },
  { id: 'voile12', tier: 5, icon: '🌑', desc: "Monte Voile de Nocturis au niveau 30", metric: 'upgrade:voileNocturis', target: 30, mode: 'absolute' },
  { id: 'own20', tier: 5, icon: '🐣', desc: "Possède 20 créatures différentes", metric: 'ownedCount', target: 20, mode: 'absolute' },
  { id: 'feed50', tier: 5, icon: '🍖', desc: "Nourris une créature jusqu'au niveau 50", metric: 'maxCreatureLevel', target: 50, mode: 'absolute' },
  { id: 'summon150', tier: 5, icon: '🔮', desc: "Invoque 200 créatures", metric: 'totalSummons', target: 200, mode: 'delta' },

  // ---------- Phase 6 : au-delà / après Ascension ----------
  { id: 'hold1Qa', tier: 6, icon: '🏦', desc: "Aie 1 million de milliards de pièces en réserve", metric: 'coins', target: 1000000000000000, mode: 'absolute' },
  { id: 'essence50', tier: 6, icon: '🌟', desc: "Accumule 50 points d'essence", metric: 'essence', target: 50, mode: 'absolute' },
  { id: 'essence250', tier: 6, icon: '🌟', desc: "Accumule 250 points d'essence", metric: 'essence', target: 250, mode: 'absolute' },
  { id: 'auto900', tier: 6, icon: '🔧', desc: "Possède 2 500 auto-clics en tout", metric: 'autoTotal', target: 2500, mode: 'absolute' },
  { id: 'etoile20', tier: 6, icon: '⭐', desc: "Possède 80 Étoiles Filantes", metric: 'auto:etoilefilante', target: 80, mode: 'absolute' },
  { id: 'oracle30', tier: 6, icon: '🔯', desc: "Possède 120 Oracles Anciens", metric: 'auto:oracle', target: 120, mode: 'absolute' },
  { id: 'passive1T', tier: 6, icon: '📈', desc: "Atteins 50 billions de pièces par seconde", metric: 'passiveIncome', target: 50000000000000, mode: 'absolute' },
  { id: 'sanct50', tier: 6, icon: '🏛️', desc: "Monte le Sanctuaire au niveau 50", metric: 'sanctuaryLevel', target: 50, mode: 'absolute' },
  { id: 'abysse20', tier: 6, icon: '🌊', desc: "Monte Abysse d'Abyssorax au niveau 40", metric: 'upgrade:abysseAbyssorax', target: 40, mode: 'absolute' },
  { id: 'own26', tier: 6, icon: '🐣', desc: "Complète la collection : 26 créatures", metric: 'ownedCount', target: 26, mode: 'absolute' },
  { id: 'feed100', tier: 6, icon: '🍖', desc: "Nourris une créature jusqu'au niveau 100", metric: 'maxCreatureLevel', target: 100, mode: 'absolute' },

  // ---------- Défis Aventure (tous paliers) ----------
  // Ils ne dépendent pas de l'économie du clicker, donc ils restent
  // tirables à toutes les phases — d'où l'absence de `tier`, traitée
  // comme « compatible partout » par pickQuestSet().
  { id: 'advWin3', icon: '⚔️', desc: 'Gagne 3 combats en Aventure', metric: 'battleWon', target: 3, mode: 'delta' },
  { id: 'advWin10', icon: '⚔️', desc: 'Gagne 10 combats en Aventure', metric: 'battleWon', target: 10, mode: 'delta' },
  { id: 'advEquipRune2', icon: '🪬', desc: 'Équipe 2 runes sur tes créatures (Aventure)', metric: 'runeEquipped', target: 2, mode: 'delta' },
  { id: 'advBuyRune1', icon: '🛒', desc: 'Achète 1 rune en Aventure', metric: 'runeBought', target: 1, mode: 'delta' },
  { id: 'advBuyRune5', icon: '🛒', desc: 'Achète 5 runes en Aventure', metric: 'runeBought', target: 5, mode: 'delta' },
];

// Lit une métrique dans l'objet de stats. Les métriques paramétrées
// (`upgrade:<id>`, `auto:<id>`) sont résolues ici plutôt que d'exiger
// une entrée à plat par amélioration — sinon ajouter une amélioration
// obligerait à toucher aussi la couche de stats.
function readMetric(metric, stats) {
  if (!stats) return 0;
  if (metric.startsWith('upgrade:')) {
    const levels = normalizeUpgradeLevels(stats.upgradeLevels);
    return levels[metric.slice(8)] || 0;
  }
  if (metric.startsWith('auto:')) {
    return (stats.autoClickers || {})[metric.slice(5)] || 0;
  }
  const v = stats[metric];
  return Number.isFinite(v) ? v : 0;
}

// Progression 0-1 d'un défi. Générique : plus aucun cas particulier.
// `baseline` = instantané des stats au moment du tirage, utilisé
// uniquement par les défis en mode 'delta' (voir le commentaire du pool).
export function questProgress(questId, stats, baseline = {}) {
  const q = QUEST_POOL.find((x) => x.id === questId);
  if (!q || !q.target) return 0;
  const now = readMetric(q.metric, stats);
  const value = q.mode === 'delta' ? Math.max(0, now - readMetric(q.metric, baseline)) : now;
  return Math.max(0, Math.min(1, value / q.target));
}

export function questComplete(questId, stats, baseline = {}) {
  return questProgress(questId, stats, baseline) >= 1;
}

export function questLabel(questId) {
  return QUEST_POOL.find((q) => q.id === questId)?.desc || '';
}

// Détail affichable d'un défi : icône, libellé, et la fraction
// «courant / objectif» de la barre segmentée. `current` est DÉRIVÉ de
// questProgress() (jamais recalculé à part) : deux sources de vérité
// permettraient à la barre d'afficher 5/5 sur un défi non validé.
export function questDetail(questId, stats, baseline = {}) {
  const q = QUEST_POOL.find((x) => x.id === questId);
  const target = q?.target || 1;
  const progress = questProgress(questId, stats, baseline);
  return {
    icon: q?.icon || '🎯',
    label: q?.desc || '',
    progress,
    target,
    current: Math.min(target, Math.floor(progress * target + 1e-9)),
    done: progress >= 1,
  };
}

export const QUEST_SET_SIZE = 4;

// Tire un jeu de 4 défis adaptés à la phase du joueur.
//
// Le filtrage par phase est le cœur du système : sans lui, un joueur qui
// démarre pouvait tirer « aie 30 000 000 de pièces » et rester bloqué
// pour toujours, l'œuf n'éclosant jamais. On pioche donc dans la phase
// courante ET la précédente (pour garder un défi rapide à cocher), plus
// les défis Aventure qui n'ont pas de phase.
//
// Les niveaux au-dessus sont volontairement exclus : un défi hors de
// portée n'est pas « difficile », il est bloquant. La difficulté vient
// des seuils exigeants À L'INTÉRIEUR de chaque phase.
export function pickQuestSet(excludeIds = [], stats = {}) {
  const tier = playerQuestTier(stats);
  const eligible = QUEST_POOL.filter((q) => !q.tier || (q.tier <= tier && q.tier >= tier - 1));
  let pool = eligible.filter((q) => !excludeIds.includes(q.id));
  // Replis en cascade : jamais moins de 4 défis, quoi qu'il arrive.
  if (pool.length < QUEST_SET_SIZE) pool = eligible;
  if (pool.length < QUEST_SET_SIZE) pool = QUEST_POOL.filter((q) => !q.tier || q.tier <= tier);
  if (pool.length < QUEST_SET_SIZE) pool = QUEST_POOL;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, QUEST_SET_SIZE).map((q) => q.id);
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
export const AUTOCLICKERS = [
  { id: 'esprit', name: 'Esprit Frappeur', emoji: '👻', baseCost: 15, baseIncome: 0.1, tier: 1 },
  { id: 'main', name: 'Main Spectrale', emoji: '🖐️', baseCost: 100, baseIncome: 1, tier: 1 },
  { id: 'automate', name: 'Automate Runique', emoji: '⚙️', baseCost: 1100, baseIncome: 8, tier: 1 },
  { id: 'colonie', name: 'Colonie de Familiers', emoji: '🦊', baseCost: 12000, baseIncome: 47, tier: 1 },
  { id: 'titan', name: 'Titan Mécanique', emoji: '🗿', baseCost: 130000, baseIncome: 260, tier: 1 },
  { id: 'golem', name: 'Golem de Cristal', emoji: '💎', baseCost: 1_400_000, baseIncome: 1400, tier: 2 },
  { id: 'dragonnet', name: 'Dragon Miniature', emoji: '🐉', baseCost: 15_000_000, baseIncome: 7500, tier: 2 },
  { id: 'phenix', name: 'Phénix Renaissant', emoji: '🔥', baseCost: 160_000_000, baseIncome: 40000, tier: 2 },
  { id: 'leviathan', name: 'Léviathan des Abysses', emoji: '🐋', baseCost: 900_000_000, baseIncome: 150000, tier: 2 },
  { id: 'gardien', name: 'Gardien Céleste', emoji: '👼', baseCost: 3_500_000_000, baseIncome: 500000, tier: 2 },
  { id: 'titanfoudre', name: 'Titan de Foudre', emoji: '⚡', baseCost: 15_000_000_000, baseIncome: 1_800_000, tier: 3 },
  { id: 'colosse', name: 'Colosse de Pierre', emoji: '🗻', baseCost: 60_000_000_000, baseIncome: 6_500_000, tier: 3 },
  { id: 'oracle', name: 'Oracle Ancien', emoji: '🔯', baseCost: 250_000_000_000, baseIncome: 24_000_000, tier: 3 },
  { id: 'seigneurombres', name: 'Seigneur des Ombres', emoji: '🌑', baseCost: 1_000_000_000_000, baseIncome: 90_000_000, tier: 3 },
  { id: 'etoilefilante', name: 'Étoile Filante', emoji: '⭐', baseCost: 4_000_000_000_000, baseIncome: 320_000_000, tier: 3 },
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

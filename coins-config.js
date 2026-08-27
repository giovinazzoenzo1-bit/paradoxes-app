/* ============================================================================
   💰 CONFIGURATION DES PIÈCES — c'est TOI qui gères ce fichier
   ============================================================================

   À QUOI ÇA SERT
   Tous les gains de pièces de l'app (tous les jeux) sont centralisés ICI, dans
   UN SEUL fichier. Tu peux changer n'importe quel nombre ci-dessous sans avoir
   besoin de demander à Claude — ça permet d'ajuster l'équilibrage du jeu
   directement, en économisant du temps et des crédits.

   COMMENT MODIFIER UN NOMBRE (étape par étape)
   1. Va sur https://github.com/giovinazzoenzo1-bit/paradoxes-app
   2. Clique sur le fichier "coins-config.js"
   3. Clique sur l'icône crayon ✏️ en haut à droite (« Edit this file »)
   4. Change UNIQUEMENT les nombres qui t'intéressent (jamais le texte autour)
   5. En bas de la page, clique le bouton vert "Commit changes"
   6. Attends 5 à 10 minutes — le site se met à jour tout seul, pas besoin de
      rouvrir une conversation avec Claude pour ça.

   RÈGLES DE SÉCURITÉ (pour ne rien casser)
   - Touche uniquement aux CHIFFRES. Ne supprime jamais une virgule ",", une
     accolade "{ }", ni les deux-points ":".
   - Les temps ("threshold") sont TOUJOURS en secondes (60 = 1 minute).
   - Si tu n'es pas sûr d'une modification, tu peux toujours annuler en
     revenant sur GitHub (onglet "History" du fichier) et restaurer une
     version précédente.
   ============================================================================ */

const COINS_CONFIG = {

  // ❌⭕ MORPION — contre le bot uniquement. Le mode "Contre un ami" ne rapporte plus rien (trop
  // facile de farmer en jouant les 2 côtés soi-même). Le match se gagne au bout de 3 manches
  // remportées (pas 2) — plus aucun gain manche par manche, seulement à la victoire du match.
  morpion: {
    facile_bonus_match: 1,   // pièces si le match complet (3 manches) est gagné en Facile
    normal_bonus_match: 6,   // pièces si le match complet (3 manches) est gagné en Normal
  },

  // 🔴 PUISSANCE 4 — contre le bot uniquement (mode Ami : aucune pièce, voir Morpion)
  puissance4: {
    facile: 2,
    normal: 6,
  },

  // 🔢 2048 — paliers de score, un seul gain possible par palier et par partie
  jeu2048: {
    classique: [
      {score:2000,  coins:3},
      {score:8000,  coins:10},
      {score:20000, coins:25},
      {score:50000, coins:50},
    ],
    rush60s: [
      {score:720,  coins:3},
      {score:880,  coins:6},
      {score:1120, coins:12},
      {score:1440, coins:25},
    ],
  },

  // 🃏 MEMORY — gagné si la grille est finie sous le temps indiqué (threshold en secondes)
  memory: {
    grille_4x4:  {threshold:18,  coins:4},
    grille_6x6:  {threshold:60,  coins:15},
    grille_10x10:{threshold:480, coins:64},
    grille_14x14:{threshold:900, coins:200},
  },

  // 🧩 PUZZLE 15 — seuils basés sur une recherche de temps moyen réel (voir note), 20% plus
  // rapide que la moyenne = pièces. Même récompense sur les 4 tailles (demande explicite).
  puzzle15: {
    taille_4x4: {threshold:190, coins:5}, // moyenne réelle ~4min (confirmée), seuil = 20% plus rapide
    taille_5x5: {threshold:380, coins:5}, // moyenne estimée par extrapolation (moins fiable)
    taille_6x6: {threshold:540, coins:5}, // moyenne estimée par extrapolation (peu fiable, aucune vraie donnée trouvée)
    taille_7x7: {threshold:700, coins:5}, // moyenne estimée par extrapolation (peu fiable, aucune vraie donnée trouvée)
  },

  // 🔢 SUDOKU — gagné si la grille est finie sous le temps indiqué (threshold en secondes)
  sudoku: {
    facile:    {threshold:300, coins:17},
    moyen:     {threshold:480, coins:46},
    difficile: {threshold:720, coins:120},
  },

  // 🔧 NUTS AND BOLTS — le seuil grandit avec le niveau (formule ci-dessous), pas un nombre fixe
  nutsAndBolts: {
    coins_si_reussi_a_temps: 1,
    seuil_base_secondes: 18,      // seuil au niveau 1
    seuil_croissance_par_niveau: 0.35, // ajouté à chaque niveau (niveau 50 ≈ 18 + 50×0.35 ≈ 35s)
  },

  // 🐍 SNAKE — paliers de score, additifs (chaque palier compte une seule fois par partie)
  snake: [
    {score:10, coins:1},
    {score:25, coins:5},
    {score:40, coins:10},
  ],

  // 🐤 FLAPPY BIRD — paliers de score, additifs (chaque palier compte une seule fois par partie)
  flappyBird: [
    {score:8,  coins:1},
    {score:23, coins:3},
    {score:38, coins:5},
  ],

  // 🔤 WORDLE — pièces à la victoire
  wordle: {
    base: 3,             // trouvé aux tentatives 1 à 4
    tentative_5: 5,       // trouvé à la 5e tentative
    tentative_6: 3,       // trouvé à la 6e (dernière) tentative — ramené au niveau de base
  },

};

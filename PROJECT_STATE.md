# Paradoxes & Probabilités — État du projet

> **Pour Claude : lis ce fichier en entier avant de répondre.** Il résume tout le contexte nécessaire pour reprendre le travail sans avoir à relire l'historique de conversation.

## C'est quoi
PWA (Progressive Web App) éducative/ludique : paradoxes de probabilités expliqués simplement + mini-jeux, en français, pensée pour du grand public (12 ans+).

- **URL live** : https://giovinazzoenzo1-bit.github.io/paradoxes-app/
- **Repo** : https://github.com/giovinazzoenzo1-bit/paradoxes-app
- **Stack** : un seul fichier `index.html` (HTML+CSS+JS vanilla, pas de framework), `sw.js` (service worker PWA), `manifest.json`. Hébergé sur GitHub Pages (gratuit).
- **Analytics** : GoatCounter (respectueux vie privée, pas de cookies)

## Workflow de déploiement
- Claude clone/édite le repo dans le sandbox, puis pousse via un **Personal Access Token** (fine-grained, scope "Contents: write", ce seul repo) que l'utilisateur fournit en début de session si besoin.
- **Toujours bumper `CACHE_NAME` dans sw.js** (ex: paradoxes-v18 → v19) à chaque modification, sinon le service worker sert une version périmée.
- **Toujours valider le JS** avec `node --check` avant de push (extraire les balises `<script>` et vérifier la syntaxe).
- ⚠️ **GitHub Pages a un cache CDN de 5 minutes (`max-age=300`)** sur les fichiers servis. Après un push, attendre ~5 min avant de tester, sinon le bandeau de mise à jour peut ne pas apparaître (ce n'est pas un bug de l'app).
- Après usage du token dans `git remote set-url`, toujours le retirer immédiatement après le push (sécurité).

## Fonctionnalités déjà en place
- **20 paradoxes** interactifs avec simulation (Monty Hall, Anniversaires, 2 enfants, Né un mardi, Simpson, Saint-Pétersbourg, Parrondo, Grand Duc de Toscane, Franc-Carreau, Achille et la tortue, 100 prisonniers, Bus qui n'arrive jamais, Ruine du joueur, Braess, Taxi, Corde autour de la Terre, Loi de Benford, Condorcet, Hôtel de Hilbert, Deux enveloppes) — chacun a un écran, une explication (`infoText`), une icône PNG dans `icons/paradox_*.png`
- **Quiz** : 2 modes (Paradoxes / Général avec 3 tranches d'âge), 10 questions chacun, explications après chaque réponse, pas d'auto-avance
- **Mini-jeux** : Wordle, Qui suis-je (pass-and-play, joueurs sauvegardés), 2048 (swipe), Memory (4 difficultés + timer), Puzzle 15, Morpion, Snake (thème Game Boy, high score), Nuts and Bolts (5 niveaux progressifs)
- **Trophées** (système localStorage) + Classement (aperçu avec fausses données, pas de vrai compte encore)
- **Nav bar** 4 onglets (Paradoxes/Jeux/Progrès/Options) qui se cache au scroll
- **Sauvegarde de scroll** par écran + reprise de session au dernier écran ouvert
- **Son/vibration** (3 modes : Sons/Vibreur/Silencieux) pour trophées, records, défaites
- **Musique de fond** générée sur mesure (12s de boucle, 12 Ko), toggle dans Options
- **Pub factice** (bandeau, pas de vraie régie branchée) + bouton "Retirer les pubs" (mock, pas de vrai paiement)
- **Écran Confidentialité** (contenu honnête, pas de RGPD banner encore car pas de vraie pub active)
- Police : Quicksand (titres) + Nunito (texte), thème sombre navy/or

## Pas encore fait (connu, pas oublié)
- 🟥 **Bandeau de consentement RGPD** — nécessaire avant d'activer une vraie régie publicitaire, pas avant
- Tetris et Bataille navale (mini-jeux annoncés "bientôt" dans l'app)
- Traduction complète (sélecteur de langue présent mais seul le français est actif — décision volontaire pour éviter les bugs, voir conversation)
- Vrai système de compte utilisateur (nécessaire pour un vrai classement, pas juste l'aperçu actuel)
- App native (Capacitor) pour vraie pub AdMob et présence App Store — actuellement PWA uniquement

## Bugs connus à vérifier
- (résolu v19) ~~Nuts and Bolts niveau 4 : risque de configuration bloquée~~ → génération avec vérification de solvabilité (BFS sur états canoniques) avant de lancer la partie, voir `nbGenerateSolvableRods()`

## 🟥 Correctif critique v24 : le HTML était servi cache-first, jamais rafraîchi
Cause du problème "aucun changement visible malgré les push" : le fetch handler de `sw.js` servait TOUT en cache-first, y compris le `index.html` lui-même. Résultat : tant que l'utilisateur ne tapait pas explicitement le bandeau jaune "nouvelle version" (qui ne se déclenchait pas de façon fiable, probablement lié au cycle de vie des PWA en mode standalone sur mobile), l'app restait bloquée sur une version périmée indéfiniment, même après avoir fermé/rouvert l'app plusieurs fois.
- **Fix** : le HTML (requêtes de navigation) passe en **network-first** (`fetch(req, {cache:'no-store'})`), ne retombe sur le cache que hors-ligne. Les autres assets (icônes, mp3) restent cache-first pour l'usage hors-ligne.
- **Filet de sécurité ajouté** : bouton "Forcer la mise à jour" dans Options → supprime tous les caches + désenregistre le service worker + recharge.
- Le cache CDN GitHub Pages de 5 min reste incompressible (limite d'hébergement gratuit), mais maintenant après ce délai un simple refresh normal suffit, plus besoin du bandeau.

## 🟥 Correctif v28 : Nuts and Bolts — la génération "garantie solvable" de v27 ne mélangeait jamais les couleurs
Bug signalé par l'utilisateur après v27 : niveaux triviaux, certains résolus en 1 coup, couleurs jamais mélangées dans une même tige.
**Cause racine (erreur de conception v27)** : la méthode "on part de l'état résolu et on joue des coups légaux en arrière" est mathématiquement solvable par construction, MAIS sous la règle "on ne peut poser un écrou que sur une tige vide ou dont le dessus est de la même couleur", il est **mathématiquement impossible qu'une tige contienne 2 couleurs différentes** avec ce type de mélange — donc les tiges restent toujours mono-couleur, seule leur répartition entre tiges change. Le mélange était donc quasi cosmétique.
**Fix v28** : retour à un **vrai mélange aléatoire** (`nbRandomShuffle`, Fisher-Yates sur tous les écrous puis répartition en tiges — les couleurs se retrouvent bien mélangées à l'intérieur d'une même tige, comme il se doit). Le problème inverse refait surface : un mélange 100% aléatoire n'est pas toujours solvable, donc vérification nécessaire.
**Nouveau solveur** : BFS classique remplacé par une recherche **"best-first" avec tas binaire (min-heap)**, priorisée par une heuristique (`nbHeuristic` = nombre de segments de couleur contigus dans l'ensemble des tiges — moins il y en a, plus c'est proche d'être résolu). Explore toujours l'état le plus prometteur en premier au lieu de tout explorer dans l'ordre → converge vers une solution en quelques dizaines de ms même à 9 couleurs, là où le BFS classique explosait en temps de calcul.
**Testé** : 150 générations (3 passes × 50 niveaux) — 0 échec de solvabilité, 0 niveau déjà résolu au départ, mélange réellement multi-couleur par tige confirmé, temps max par génération 229ms (imperceptible).

## v29 : bouton "Niveau suivant ▶" sur Nuts and Bolts
Après une victoire, un bouton "Niveau suivant ▶" apparaît (au-dessus de Recommencer/Changer de niveau) et enchaîne directement sur `nbNew(nbLevel+1)` sans repasser par l'écran de sélection. Caché au niveau 50 (dernier) et à chaque nouveau départ de niveau (`nb-nextlevel-row`).

## v30 : Nuts and Bolts — déplacement de paires en un coup + undo
- **Déplacement automatique des paires** : quand on tape une tige pour poser des écrous, tous les écrous de même couleur consécutifs en haut de la tige source (une paire ou plus) se déplacent d'un seul coup vers la destination, dans la limite de la place disponible (jamais plus de 4 empilés — capacité `NB_CAPACITY` toujours respectée, testé unitairement)
- **Bouton "↩️ Annuler"** : historique jusqu'à 20 coups (`nbHistory`), 1er undo de la partie gratuit, à partir du 2e le bouton devient "↩️📺 Annuler (pub)" et déclenche `mockWatchAd()` avant d'annuler — même pattern que 2048
- Historique et undo réinitialisés à chaque nouveau niveau (`nbNew`)

## v32 : Nouveau mini-jeu — Sudoku
Deuxième nouveau mini-jeu ajouté. 3 difficultés (Facile 40 indices, Moyen 32, Difficile 26).
- **Génération avec solution unique garantie** : grille complète générée par backtracking randomisé, puis retrait de cases une par une (ordre aléatoire) en vérifiant à chaque retrait via un solveur à heuristique MRV (case la plus contrainte en premier, comptage de solutions plafonné à 2) que la solution reste unique — sinon la case est remise. Testé : 3 difficultés, génération 6-10ms, solution unique confirmée à chaque fois.
- Sélection de case + pavé numérique (1-9 + effacer), détection de conflits en temps réel (ligne/colonne/bloc 3×3) surlignée en rouge, victoire quand la grille est pleine et sans conflit
- Cases de départ (indices) non modifiables, visuellement distinguées
- Pas de classement (non demandé), MVP scope à la mécanique de jeu + génération correcte
- 🟨 Icône à générer par l'utilisateur (prompt donné en conversation) → déposer dans `icons/sudoku.png` (300×300px)

## v33 : Sudoku — refonte complète (vies, sons, indice/effacer/undo)
Changement de modèle : la saisie n'est plus juste vérifiée pour absence de conflit, elle est comparée **directement à la solution unique** générée (`sudokuSolution`, conservée en mémoire). Une mauvaise réponse n'est jamais gardée dans la grille (auto-annulée), juste sanctionnée.
- **3 cœurs (vies)** affichés en haut (`sudoku-hearts`), perte d'un cœur à chaque mauvaise réponse, partie perdue à 0 cœur (`sudokuGameOver`, saisie bloquée)
- **3 nouveaux sons** ajoutés au système global `playFeedback()` (réutilisables par d'autres jeux à l'avenir) : `correct` (bonne réponse), `objective` (ligne/colonne/bloc 3×3 complété — son différent, plus satisfaisant), `wrong` (mauvaise réponse, buzzer) — chacun avec son pattern de vibration dédié
- **💡 Indice** : toujours via pub simulée (`mockWatchAd`), jamais gratuit, révèle la bonne valeur sur la case sélectionnée
- **⌫ Effacer** et **↩️ Annuler** : 1er gratuit par partie, puis pub simulée à chaque utilisation (même pattern que 2048/Nuts and Bolts)
- Bouton "effacer" retiré du pavé numérique (qui n'a plus que 1-9), devient un bouton dédié avec la logique pub
- **Testé unitairement** : vies décrémentées correctement, mauvaise réponse non conservée, game over à 3 erreurs, indice pose la bonne valeur, undo/effacer respectent le pattern gratuit-puis-pub

## v34 : Nouveau mini-jeu — Puissance 4
Troisième nouveau mini-jeu. 2 joueurs en local (pass-and-play), grille 7×6, tap sur une colonne pour y faire tomber un jeton.
- Détection de victoire dans les 4 directions (horizontale, verticale, diagonale montante et descendante) à partir du dernier jeton posé, comptage bidirectionnel
- Détection de match nul (grille pleine sans alignement)
- Colonne pleine : le tap est ignoré silencieusement
- **Testé** : victoire horizontale/verticale confirmée via simulation de coups réels ; victoire diagonale (les 2 sens) et absence de faux positif à 3 pions alignés confirmées via plateau construit directement (test unitaire de la fonction `p4CheckWin` isolée)
- Icône déjà fournie par l'utilisateur et placée dans `icons/puissance4.png`
- Pas de classement ni d'IA (non demandé), MVP 2 joueurs locaux uniquement

## Process établi avec l'utilisateur pour les nouveaux mini-jeux
1. Claude donne le prompt image (format identique aux icônes existantes : squircle navy 300×300, style glossy 3D) AVANT ou pendant qu'il code le jeu
2. L'utilisateur génère l'image ailleurs et l'upload dans la conversation
3. Claude recadre proprement (détection des bords du squircle si l'image n'est pas déjà carrée — ne jamais juste resize une image non carrée, ça déforme) puis redimensionne en 300×300 et place dans `icons/<jeu>.png`
4. Claude enchaîne direct sur le prompt image du jeu suivant

## v31 : Nouveau mini-jeu — Solitaire (Klondike)
Premier des nouveaux mini-jeux ajouté (liste complète en tête de fichier). Interaction 100% par tap (cohérent avec le reste de l'app, pas de drag) : taper une carte pour la sélectionner (une suite alternée descendante valide se sélectionne d'un bloc), puis taper la destination.
- Distribution standard Klondike : 7 colonnes (1 à 7 cartes, dernière face visible), pioche, défausse, 4 fondations par couleur
- Pioche → défausse (1 carte à la fois), recyclage de la défausse en pioche quand elle est vide
- Déplacement de suites valides (alternance rouge/noir, rang décroissant) en un tap
- Fondations : Valet As→Roi, une seule carte à la fois
- Colonne vide : seul un Roi (ou suite commençant par un Roi) peut s'y poser
- Compteur de coups, détection de victoire (52 cartes en fondation)
- **Testé unitairement** : distribution (28+24=52, pas de doublon), tirage/recyclage pioche↔défausse, détection victoire, validation des suites (valide/invalide)
- 🟨 Icône à générer par l'utilisateur (prompt fourni en conversation) → déposer dans `icons/solitaire.png` (300×300px)
- Pas de classement (non demandé pour ce jeu), MVP volontairement scope à la mécanique de jeu core

## Roadmap corrective en cours (approche validée le 23/08/2026 : jeu par jeu à 100%, pas phase horizontale)
- **Phase 1 (fait, v19)** : bug Nuts and Bolts niv.4, sons Wordle (lettre correcte/mal placée), bug scroll 2048 au swipe, boutons Snake agrandis + décor plein écran, couleurs dégradées Puzzle15
- **Wordle (fait, v20)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - Sons lettre correcte / mal placée
  - Dictionnaire de validation (`wordleDictionary`, 4448 mots français 5 lettres, extrait du package npm `an-array-of-french-words`, embarqué en dur dans index.html) — le bouton Valider refuse et fait "shake" la ligne + toast si le mot n'existe pas
  - Bouton "📺 Lettre offerte (pub)" — pub simulée (`mockWatchAd()`, overlay générique réutilisable, 4s), révèle la lettre correcte à la prochaine position vide de la ligne en cours
  - ⚠️ Note : le clavier du jeu ne gère pas les accents, donc le dictionnaire est filtré aux mots sans accents/tirets uniquement (4448/336524 mots du corpus complet)
- **Système générique créé (réutilisable pour d'autres jeux)** : `mockWatchAd(durationSec, callback)` — overlay pub simulée avec barre de progression, `#ad-overlay` dans le `<body>`, CSS `.ad-overlay/.ad-box/.ad-progress`
- **Qui suis-je (fait, v21)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - Système "🔎 J'ai oublié ma carte" : liste tous les joueurs, tap sur un nom → écran de confirmation d'identité (anti-spoil, honor system comme le reste du jeu) → révèle la carte de CE joueur uniquement
  - Accessible depuis l'écran d'attente entre deux joueurs et depuis l'écran final "tout le monde a son personnage"
  - État géré via `qsjRecallMode` ('list'|'confirm'|'shown'), n'interfère pas avec le flux normal de distribution des cartes
- **2048 (fait, v22)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - Meilleur score perso affiché en permanence (localStorage `g2048Best`)
  - Message de fin (gagné/perdu) : score + temps de la partie + meilleur perso + meilleur mondial (aperçu fictif `g2048WorldBestMock`, pas de backend réel)
  - Bouton "↩️ Annuler" (historique jusqu'à 20 coups) — 1er undo de la partie gratuit, à partir du 2e le bouton devient "↩️📺 Annuler (pub)" et déclenche `mockWatchAd()` avant d'annuler
- **Memory (fait, v23)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - Nouveau panneau "🏆 Classements" accessible depuis l'écran de choix de difficulté, avec onglets par difficulté (4×4/6×6/10×10/14×14)
  - Classement perso : top 5 temps par difficulté, stocké dans `localStorage` (`memoryScores:<size>`, jusqu'à 10 scores gardés)
  - Classement mondial : aperçu fictif (`memoryWorldMock`, pas de vrai backend) fusionné avec le meilleur temps perso inséré au bon rang
  - Anti-triche v1 : chaque score est signé (`memorySign()`, hash simple) et un score dont la signature ne correspond pas (édité à la main dans localStorage) est silencieusement rejeté du classement ; un score physiquement impossible (moins de coups que de paires, temps trop court) est aussi rejeté (`memoryIsPlausible()`)
  - ⚠️ Limite documentée dans le code : protection client uniquement, dissuade la triche "rapide" via édition directe de localStorage, ne bloque pas quelqu'un qui lit le code source — un vrai anti-triche nécessiterait un backend (Phase 7)
- **Puzzle15 (fait, v25)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour (couleurs dégradées déjà faites en Phase 1) :
  - 4 niveaux de difficulté : 15 (4×4), 24 (5×5), 35 (6×6), 48 (7×7) — écran de sélection de niveau ajouté
  - Génération solvable par construction pour toutes les tailles (mélange via mouvements légaux uniquement, `p15Neighbors(idx,n)` généralisé)
  - Classement "🏆 Classements" avec onglets par niveau : top 5 perso (coups + temps, `localStorage p15Scores:<n>`) + mondial aperçu fictif (`p15WorldMock`) fusionné avec le meilleur perso
  - Grille et police redimensionnées dynamiquement selon le niveau (jusqu'à 48 pièces en 7×7)
- **Snake (fait, v26)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour (boutons agrandis + décor plein écran déjà faits en Phase 1) :
  - Classement mondial affiché à la fin de partie (`snakeRenderWorldboard()`, aperçu fictif `snakeWorldMock` fusionné avec le meilleur score perso, panneau caché au lancement d'une nouvelle partie)
- **Nuts and Bolts (fait, v27)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - **50 niveaux** au lieu de 5, même système de difficulté (nombre de couleurs 3→9 + tiges vides 3→1), organisé en paliers : lvl1-5 (config originale inchangée), lvl6-14 (6 couleurs), lvl15-23 (7 couleurs), lvl24-33 (8 couleurs), lvl34-50 (9 couleurs) — chaque palier se termine à 1 tige vide (le plus dur) puis le palier suivant repart à 3 (respiration avant la couleur en plus)
  - Palette étendue à 9 couleurs distinctes (`nbAllColors`)
  - **Changement majeur de génération** : l'ancien système (mélange 100% aléatoire + vérification BFS de solvabilité) explosait en temps de calcul dès 7-8+ couleurs. Remplacé par une génération **garantie solvable par construction** : on part de l'état résolu et on joue des coups légaux aléatoires (comme le ferait un joueur) — puisque défaire ces coups un par un en partant du dernier est toujours légal, l'état mélangé final est mathématiquement toujours solvable, sans aucune vérification a posteriori. Résultat : génération quasi-instantanée (<1ms) même à 9 couleurs, contre un risque de blocage du thread avec l'ancienne méthode. Testé et confirmé solvable via un solveur BFS indépendant sur échantillons.
  - Écran de sélection : grille de 50 boutons numérotés (verrouillés/déverrouillés selon la progression), remplace l'ancienne liste verticale de 5 boutons
- **Tous les jeux existants sont maintenant à 100%.** Reste uniquement les nouveaux mini-jeux à ajouter un par un (Solitaire, Sudoku, Puissance 4, Flappy Bird en priorité — Ludo, Skip-Bo, Échecs, Billard, Ping-pong plus lourds, à traiter en dernier). Voir la liste complète en tête de fichier.
- **Phase 3 (à faire)** : classements perso (localStorage) — Memory, Puzzle15, Snake, 2048
- **Phase 4 (à faire)** : anti-triche v1 Memory + validation de mot réel pour Wordle (refuser la soumission si le mot n'existe pas)
- **Phase 5 (à faire)** : Nuts and Bolts — passer de 5 à 50 niveaux
- **Phase 6 (à faire)** : nouveaux mini-jeux un par un — Solitaire, Sudoku, Puissance 4, Flappy Bird (raisonnables en vanilla JS) ; Ludo, Skip-Bo, Échecs, Billard, Ping-pong (plus lourds, à traiter en dernier)
- **Phase 7 (bloquant pour tout "classement mondial")** : vrai backend (comptes utilisateurs + base de données) — indispensable avant tout classement mondial réel, actuellement tout est en localStorage local à l'appareil

## Convention de code utile à connaître
- `puzzles` (array JS) = liste des 20 paradoxes, chaque entrée a `id`, `icon` (emoji, fallback), `color`, `title`, `hook`, `odds`
- `infoText` (objet JS) = explications détaillées par `id` de paradoxe
- Icônes réelles : `icons/paradox_{id}.png` (300x300, fond transparent nettoyé depuis des générations Gemini)
- Icônes de jeux : `icons/{nom}.png` (memory, puzzle15, snake, bientot, quisuisje, nutsbolts, g2048, quiz_paradoxes, wordle, quiz_general, morpion)
- Stats utilisateur stockées via `statsGet()`/`statsSet()` (localStorage, clé `userStats`)
- Toujours re-synchroniser `restoreLastScreen()` et le service worker `ASSETS` si un nouvel écran/fichier est ajouté

## Comment générer de nouvelles icônes (workflow établi)
1. Prompt Gemini avec le bloc "style" (flat vector, fond noir uni #000000, pas de scène réaliste, pas de damier de transparence)
2. Claude nettoie le fond (script Python : détection couleur de coin + flood-fill + scipy pour connectivité), recadre en carré si besoin
3. Redimensionne à 300x300, sauvegarde dans `icons/`, référence dans le HTML, ajoute au cache `sw.js`, bump `CACHE_NAME`

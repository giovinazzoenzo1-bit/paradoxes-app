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

## 🟦 RÈGLE GÉNÉRALE (à appliquer systématiquement, sans qu'on ait besoin de le redemander) — validée le 24/08/2026
Pour CHAQUE jeu (existant ou nouveau) :
- **Classement perso + mondial** : si le jeu a un score/temps/coups qui a du sens à comparer → l'ajouter systématiquement (perso en `localStorage`, mondial en aperçu fictif mergé avec le meilleur perso, même pattern que Memory/Puzzle15/Snake/2048). Pour un jeu à score continu simple (pas de niveaux/difficulté), suivre le pattern Snake (classement affiché en fin de partie). Pour un jeu à plusieurs runs/difficultés, suivre le pattern Memory/Puzzle15 (panneau dédié avec onglets, top 5 perso).
- **Undo** : si le jeu s'y prête (actions réversibles, pas de temps réel/réflexe) → l'ajouter avec le pattern établi : 1er gratuit par partie, puis pub simulée (`mockWatchAd`). Ne PAS l'ajouter sur les jeux temps réel/réflexe où ça n'a pas de sens (Flappy Bird, Snake — annuler une collision n'a pas de sens).
- Appliquer ce raisonnement à chaque nouveau jeu ajouté (Ludo, Skip-Bo, Échecs, Billard, Ping-pong) sans attendre une demande explicite à chaque fois.

## v36 : Flappy Bird — classement mondial ajouté (pas d'undo, non pertinent pour ce genre de jeu)
Classement mondial (aperçu, `fbWorldMock`) affiché en fin de partie, même pattern que Snake — le meilleur score perso est fusionné et inséré au bon rang. Pas de bouton undo : un jeu réflexe temps réel où on ne peut pas "annuler" une collision, ça n'a pas de sens (voir règle générale ci-dessus).

## v35 : Nouveau mini-jeu — Flappy Bird
Quatrième et dernier des mini-jeux prioritaires (Solitaire, Sudoku, Puissance 4, Flappy Bird = tous faits). Rendu canvas 300×400, boucle `requestAnimationFrame` avec physique par delta-temps (indépendante du framerate de l'appareil).
- Gravité + impulsion vers le haut au tap ("flap"), tuyaux qui défilent et se génèrent à intervalle régulier, ouverture aléatoire
- Collision sol/plafond + collision précise avec les tuyaux (zone du trou exclue)
- Score +1 par tuyau passé, meilleur score persistant (`localStorage fbBest`)
- Tap n'importe où sur le canvas pour démarrer / voler / rejouer après un game over
- **Testé unitairement** (logique pure, sans rendu) : pas de collision en vol libre, collision sol/plafond, collision précise avec le haut/bas d'un tuyau, pas de collision hors zone du tuyau, physique gravité/flap cohérente sur plusieurs frames
- Icône fournie par l'utilisateur et placée dans `icons/flappybird.png`

**Les 4 mini-jeux prioritaires de la liste originale sont maintenant tous ajoutés.** Restent les mini-jeux plus lourds (physique/règles complexes) à traiter en dernier : Ludo (jeu des chevaux), Skip-Bo, Échecs, Billard, Ping-pong.

## v47 : Nouveau mini-jeu — Ping-pong (Matter.js), avec 2 vrais bugs de fond trouvés et corrigés en test
Neuvième mini-jeu, table plein écran en mode paysage (même astuce CSS de rotation que le Billard), moteur Matter.js (déjà utilisé pour le Billard, zéro poids supplémentaire). 2 modes : 🤖 contre un bot, 👥 entre amis en **temps réel simultané** (contrôle multi-touch : chaque joueur glisse sur sa moitié d'écran, identifié par l'endroit où son doigt touche l'écran en premier). Système de points : premier à 11, victoire par 2 points d'écart (vraie règle du ping-pong, deuce géré).

### 🟥 Bug n°1 (le plus subtil rencontré jusqu'ici) : vitesse transitoire non fiable de Matter.js
En testant l'intégration, la balle s'arrêtait quasiment net à chaque frappe de raquette au lieu de rebondir. Debug poussé : `ball.velocity` lue **pendant** l'événement `collisionStart` reflète un état **transitoire/intermédiaire** du pipeline de résolution interne de Matter (confirmé par un test isolé : la vitesse y apparaît écrasée à ~12% de sa valeur réelle, puis **revient toute seule à la normale la frame suivante** si on n'y touche pas — donc pas une vraie perte d'énergie, juste une valeur de lecture non fiable à ce moment précis). Notre code lisait cette valeur pour calculer le rebond, héritant du problème.
**Correctif à deux volets :**
1. Les raquettes passent en `isSensor:true` — Matter détecte toujours la collision (événements) mais n'applique plus aucune résolution physique automatique dessus ; on gère 100% du rebond nous-mêmes.
2. La vitesse utilisée dans `ppDeflect()` est désormais **capturée juste avant chaque pas physique** (`ppLastBallSpeed`, mise à jour en tout début de `ppAnimate()`) plutôt que relue pendant l'événement de collision.

### 🟥 Bug n°2 : trajectoire dégénérée qui ne se termine jamais
En simulant un match complet (bot vs joueur avec suivi quasi parfait), le score restait bloqué à 0-0 indéfiniment. Cause : si la balle finit par toucher une raquette pile en son centre (`vy=0`) alors que les deux côtés suivent précisément sa position en Y, la trajectoire se fige en un échange **purement horizontal** à `y` constant qui s'auto-entretient à l'infini (chaque frappe retombe encore pile au centre puisque rien ne fait dévier verticalement). Pas un bug de logique de score (`ppCheckScore`/`ppHandlePoint` fonctionnaient très bien, prouvé par test direct) — un état stable dégénéré de la physique.
**Correctif** : léger bruit aléatoire ajouté à l'angle de sortie dans `ppDeflect()` (`± 0.06 rad`), qui rend cette trajectoire figée impossible à maintenir tout en restant imperceptible sur un rebond normal.

### ✅ Validation finale
- 5 matchs très déséquilibrés simulés (perte du côté faible garantie) : les 5 se terminent normalement à 11-0, plus de blocage
- 8 matchs équilibrés simulés (les deux côtés avec la même imprécision) : les 8 se terminent correctement, y compris un cas de deuce réel (12-10), tous les écarts de victoire ≥2 points vérifiés
- Aucun crash sur aucune des 13 parties complètes simulées avec le vrai module `matter-js`

## v46 : Matter.js rapatrié en local — zéro dépendance externe restante dans toute l'app
Suite à la question légitime sur la fiabilité long terme des CDN externes : Matter.js (jusque-là chargé depuis `cdnjs.cloudflare.com`) est maintenant auto-hébergé, exactement comme chess.js.
- Copié depuis le même package npm déjà testé (`matter-js@0.20.0`) → `vendor/matter.min.js` (83 476 octets, **fichier identique bit pour bit** à celui utilisé lors des tests d'intégration du Billard — vérifié par checksum MD5, donc aucune re-validation nécessaire)
- Licence MIT incluse dans `vendor/matter.js.LICENSE`
- `<script src="./vendor/matter.min.js">` remplace le tag CDN dans `index.html`
- `sw.js` simplifié : `vendor/matter.min.js` rejoint la liste principale `ASSETS` (mise en cache atomique standard) — le système `THIRD_PARTY_ASSETS` non-bloquant devenu inutile a été retiré
- **Décision de fond documentée** : pour l'archi actuelle (un seul fichier HTML, pas d'outil de build), l'auto-hébergement est strictement plus robuste que le CDN dès lors qu'on fige une version précise (ce qu'on fait déjà) — le seul avantage du CDN (mises à jour automatiques) ne s'applique pas ici. Ce choix n'a par ailleurs aucun impact sur une éventuelle refonte future avec un vrai outil de build (Webpack/Vite) : les deux approches (CDN ou vendor/) seraient de toute façon remplacées par un vrai `npm install` + bundling à ce moment-là.
- **L'application entière (16 mini-jeux + moteur de paradoxes) ne dépend plus d'aucun service tiers pour fonctionner.** Tout ce qui est nécessaire est soit dans `index.html`, soit dans `vendor/`, soit dans `icons/` — tout versionné dans le repo, tout servi depuis le même domaine GitHub Pages.

## v45 : Échecs — moteur remplacé par chess.js (open source, BSD-2-Clause)
Le moteur maison (déjà validé perft 1-4 exact) est remplacé par **chess.js 1.4.0**, la référence du milieu (utilisée par lichess.org et de très nombreux projets), plus complète que notre implémentation.
- **Auto-hébergé, pas de CDN** : copié localement dans `vendor/chess.esm.js` (~107 Ko, licence BSD-2-Clause incluse dans `vendor/chess.js.LICENSE`) plutôt que chargé depuis un CDN externe. Décision prise après avoir constaté que cdnjs n'héberge qu'une vieille version (0.10.3, API différente/dépréciée snake_case) et n'avoir pas pu vérifier de façon fiable une URL CDN exacte et fonctionnelle pour la version moderne (1.4.0, API camelCase). L'auto-hébergement élimine ce problème : fonctionne hors-ligne comme le reste de l'app, mis en cache directement dans `ASSETS` (pas besoin du système `THIRD_PARTY_ASSETS` non-bloquant utilisé pour Matter.js, puisque ce n'est plus un tiers réseau).
- **Chargement** : `<script type="module">import { Chess } from './vendor/chess.esm.js'; window.Chess = Chess;</script>` — un script module se charge en différé (après le script classique principal), mais comme `Chess` n'est utilisé que dans des fonctions appelées bien plus tard (au clic utilisateur), aucun souci de timing.
- **Ce que ça apporte de plus que notre ancien moteur** (déjà correct, mais moins complet) : nulle par répétition de position, nulle par la règle des 50 coups, nulle par matériel insuffisant — **testé et confirmé** : une position roi-seul-contre-roi-seul est maintenant détectée comme nulle automatiquement, ce que l'ancien moteur ne gérait pas (limitation documentée en v40).
- **IA bot** : conservée telle quelle (minimax + élagage alpha-bêta, profondeur 3, évaluation matérielle simple), adaptée pour utiliser `chess.moves()`/`chess.move()`/`chess.undo()` au lieu de notre `chApplyMove` immutable — plus simple et tout aussi rapide.
- **Undo** : utilise désormais `chess.undo()` nativement (au lieu de notre pile d'historique maison) — même comportement pour l'utilisateur (1er gratuit puis pub, annule le coup du bot + celui du joueur).
- **Testé avec le vrai module copié localement** (pas de mock) : perft 1-4 exacts, interface tap-to-move complète, Fool's Mate détecté de bout en bout, undo natif fonctionnel, et le nouveau cas de nulle par matériel insuffisant confirmé.

## v44 : Billard — moteur physique remplacé par Matter.js (open source, MIT)
Suite à la question légitime de l'utilisateur sur l'usage d'open source pour les mini-jeux : le moteur physique maison (collision bille-bille par décomposition normale/tangentielle, écrit et testé à la main) est remplacé par **Matter.js 0.20.0** (moteur physique 2D open source, MIT, chargé via CDN cdnjs), plus robuste et éprouvé que notre implémentation.
- **Chargement** : `<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js"></script>` juste avant notre script principal. Mis en cache par le service worker pour le hors-ligne, mais **séparément** de `cache.addAll(ASSETS)` (qui est atomique — un souci réseau sur le CDN externe ne doit jamais faire échouer la mise en cache de nos propres fichiers). Voir `THIRD_PARTY_ASSETS` dans `sw.js`.
- **Ce qui change en interne** : chaque bille a maintenant un vrai corps physique Matter (`Matter.Bodies.circle`), les murs sont des rectangles statiques (`Matter.Bodies.rectangle`), les collisions bille-bille et bille-bande sont gérées nativement par Matter (restitution 0.95/0.80, `frictionAir` 0.018 pour la décélération de roulement). Les **8 sous-étapes physiques par frame sont conservées** (anti-tunneling) — **bug découvert en testant l'intégration** : sans sous-étapes, une bille lancée à haute vitesse (60+) traversait purement et simplement les bandes (position finale mesurée à x=-1777, largement hors table) ; avec 8 sous-étapes, aucun tunneling même testé jusqu'à vitesse 100.
- **Ce qui NE change PAS** : nos propres règles du 8-ball (`bilEvaluateShot`, inchangée), la détection des poches (Matter n'a pas de "trous" natifs, toujours un check de distance manuel), le système de visée/puissance/tir en 2 étapes (v43, inchangé), le rendu canvas.
- **Détection du premier contact et des bandes touchées** : désormais via les vrais événements de collision Matter (`Matter.Events.on(engine, 'collisionStart', ...)`) plutôt que notre propre logique de collision — plus fiable.
- **Testé avec le vrai module `matter-js`** (pas de mock) : 16 corps physiques créés au rackage, tir réel via `Matter.Body.setVelocity`, premier contact détecté via les événements Matter, capture en poche avec ajout/retrait correct du monde physique (`Matter.Composite.add/remove`), 10 tirs complets d'affilée sans crash, aucune bille hors limites après simulation.
- Puissance max recalibrée à 45 (au lieu de 69 avec l'ancien moteur) — les courbes de friction/restitution de Matter.js ne sont pas identiques aux nôtres, testé stable jusqu'à 100.

## v43 : Billard — refonte du contrôle en 2 étapes (visée précise + puissance manuelle + bouton Tirer)
Retour utilisateur sur v42 : le geste "élastique" combiné (glisser près de la bille pour viser ET doser la puissance en même temps) était imprécis, impossible d'envoyer la bille exactement où voulu.
**Nouveau flux, complètement séparé :**
1. **Visée** : glisser n'importe où sur TOUTE la table (pas juste une petite zone autour de la bille blanche) pointe la ligne de visée précisément vers le point touché. Toute la largeur/hauteur de la table sert de zone de geste → bien plus de résolution angulaire qu'un petit rayon de glissement limité. L'angle reste mémorisé ("verrouillé") après avoir relâché le doigt, tant qu'on ne retouche pas la table.
2. **Puissance** : jauge verticale dédiée à droite de la table, désormais un vrai slider tactile (`bilPowerBarSet()`) — on tape/glisse directement dessus pour choisir un pourcentage précis (affiché en %), complètement indépendant du geste de visée.
3. **Tir** : bouton rond "🎯 TIRER" sous la jauge, désactivé tant que visée ET puissance (>5%) ne sont pas réglées, déclenche le tir avec l'angle + la puissance choisis (`bilConfirmFire()`).
La ligne de visée (bille fantôme + direction de la bille visée) reste affichée en continu dès qu'un angle est mémorisé, avec la ligne de recul de la queue qui s'allonge visuellement selon la puissance réglée sur la jauge — feedback visuel cohérent entre les deux étapes.
**Testé** : visée seule ne déclenche jamais de tir, bouton Tirer désactivé tant que l'un des deux réglages manque, tir réellement exécuté dans la direction et à la puissance choisies une fois confirmé, visée/puissance réinitialisées après chaque tir (obligation de reviser à chaque coup).

## v42 : Immersion globale + Billard en mode paysage plein écran
### 🟦 Changement global (tous les jeux)
La barre de menu du bas (Paradoxe|Jeux|Trophées|Options) est maintenant **masquée automatiquement dès qu'un jeu est ouvert**, sur les 16 jeux existants sans exception — un seul point de contrôle dans `switchScreen()` (liste blanche des 4 écrans principaux `home`/`game-jeux`/`game-progres`/`game-options`, tout le reste = barre cachée). Seule la flèche "← Retour" de chaque jeu permet de sortir. Aucune modification nécessaire dans chaque jeu individuellement.

### 🟦 Billard : refonte complète, à partir d'une image de référence fournie par l'utilisateur
- **Table plein écran** dans un calque fixe par-dessus toute l'app (`#bil-table-wrap`), plus dans le flux normal de la page
- **Mode paysage forcé même si le téléphone reste physiquement en portrait** : astuce CSS (rotation du conteneur à 90°, `#bil-landscape-box` avec `transform:rotate(90deg)` + dimensions inversées `100vh`/`100vw`) — nécessaire car l'API Screen Orientation (`screen.orientation.lock`) n'est pas disponible sur iOS Safari ; on tente quand même le vrai lock natif en complément (fonctionne sur Android/PWA installée), avec repli CSS systématique. Écouteurs `resize`/`orientationchange` pour réagir si l'utilisateur tourne physiquement son téléphone.
- **Canvas agrandi et rescalé** : 900×450 (au lieu de 340×170), toutes les constantes physiques (rayon bille, rayon poche, distance/puissance max de tir) rescalées ×2.647 en conservant les proportions — **revalidé unitairement à la nouvelle échelle** (génération du rack, premier contact détecté, aucune bille hors limites)
- **Visée avec bille fantôme** (`bilComputeAimPreview()`) : raycast qui trouve la première bille ou bande sur la trajectoire, affiche une ligne pointillée jusqu'au point de contact exact, une "bille fantôme" semi-transparente à la position d'impact, et une ligne indiquant la direction prévue de la bille visée — reproduit l'effet demandé par l'utilisateur (référence : jeu de billard mobile avec ligne de visée + bille fantôme). **Testé** : détection de cible correcte, point de contact à exactement 2 rayons du centre de la cible, jamais hors limites de la table.
- **Jauge de puissance latérale** (`#bil-power-bar`), visible uniquement pendant le glissement, se remplit en temps réel (dégradé vert→jaune→rouge) selon la distance de recul du doigt
- **Design repris de l'image de référence** : rail en bois marron, feutre vert, pochettes noires plus grandes, billes avec reflet glossy (petit cercle blanc semi-transparent), tableau de score en pilule brune arrondie avec onglet de mode au-dessus, boutons ronds blancs retour/reset dans les coins
- ⚠️ **Écart assumé vs la référence** : le tableau de score de la photo montre "TOI vs BOT" (un mode contre une IA) — notre billard n'a pas de bot (physique de simulation de tir trop lourde pour le scope actuel), le tableau affiche donc "Joueur 1 vs Joueur 2" ou "Entraînement" selon le mode réel disponible

## v41 : Nouveau mini-jeu — Billard (8-ball)
Huitième mini-jeu, à partir d'un cahier des charges technique détaillé fourni par l'utilisateur (stack Godot/Unity dans le doc original, **adapté ici en canvas HTML5/JS** pour rester cohérent avec le reste de l'app).
**Physique 2D testée unitairement** : sous-étapes (substepping, 6 par frame) pour éviter le tunneling à haute vitesse (CCD simplifié — confirmé par test : une bille à vitesse très élevée ne traverse jamais une bande), collision bille-bille par décomposition normale/tangentielle avec restitution 0.95 (conservation de la quantité de mouvement vérifiée), rebond sur bande avec restitution 0.80, friction de roulement simplifiée (un seul coefficient — **simplification notée** : le modèle glissement/roulement en 2 phases du cahier des charges, ainsi que l'effet/spin (coulé, rétro, latéral), ne sont pas implémentés, scope jugé trop lourd).
**Règles du 8-ball complètes et testées (9 scénarios)** : attribution du groupe (pleines/rayées) au premier pot légal, faute si bille blanche empochée / aucun contact / mauvais groupe touché en premier / aucune bande touchée après contact sans rien empocher, bille 8 empochée hors-jeu = défaite immédiate (y compris si elle rentre légalement mais qu'une faute simultanée survient), bille en main pour l'adversaire après une faute (placement par tap, avec vérification de chevauchement).
**2 modes** : 🎯 Entraînement solo (aucune règle, la blanche se replace automatiquement si empochée) ; 👥 Pass & Play 2 joueurs (vraies règles, écran de bille en main).
**Contrôle tactile** : glisser-relâcher façon "lance-pierre" (touché n'importe où, glissement en arrière de la blanche pour viser + doser la puissance, relâchement = tir) — **déviation du cahier des charges** qui proposait 2 widgets séparés (visée globale + slider de puissance vertical dédié) ; le geste unique est plus naturel au tactile mobile et c'est ainsi que fonctionnent la plupart des jeux de billard mobiles réels (ex. 8 Ball Pool).
🟥 **Bug de calibration trouvé et corrigé en test** : la puissance max initiale (9) ne permettait pas à la bille blanche de parcourir la table (340px) avant l'arrêt total par friction — calcul de la distance d'arrêt théorique (`v0/6 × 1/(1-friction)`) a révélé qu'il fallait au moins ~26 pour couvrir la table confortablement. Corrigé et revalidé.
**Testé** : mise en place du rack (16 billes, numéros 0-15 tous présents une fois, bille 8 au centre de la 3e rangée), 20 tirs aléatoires pleine puissance sans crash, toutes les billes restent dans les limites de la table.
🟨 Icône à générer par l'utilisateur (prompt donné en conversation) → déposer dans `icons/billiard.png` (300×300px)

## v40 : Nouveau mini-jeu — Échecs
Septième mini-jeu, moteur validé avec la méthode la plus rigoureuse qui existe pour un moteur d'échecs : **perft** (comptage exhaustif des positions atteignables à N coups depuis une position connue, comparé aux valeurs de référence publiées). Résultats obtenus : perft(1)=20, perft(2)=400, perft(3)=8902, perft(4)=197281 — **tous exacts**, ce qui donne une confiance très élevée dans la justesse du générateur de coups (tout bug de règle aurait fait dévier ces chiffres).
- **Règles complètes** : tous les déplacements de pièces, roque (petit/grand, avec toutes les conditions : rien entre les cases, roi pas en échec, ne traverse pas une case attaquée), prise en passant, promotion (auto-dame — simplification notée, pas de choix de la pièce de promotion pour l'instant), détection échec/mat/pat
- **2 modes** : 🤖 Contre un bot (IA minimax + élagage alpha-bêta, profondeur 3, évaluation matérielle simple — testée : capture le matériel gratuit, joue en <150ms) ; 👥 Entre amis en local (les 2 joueurs voient le plateau, pas d'écran caché nécessaire — contrairement aux jeux de cartes, les échecs sont à information complète)
- **Undo** (ajout, cohérent avec la règle générale) : disponible **uniquement contre le bot** (mode pratique/entraînement), annule le coup du bot + le coup du joueur d'un coup pour permettre de reconsidérer une décision — 1er gratuit, puis pub. **Absent en mode entre amis** (compétitif, comme aux vraies échecs — cohérent avec Ludo/Skip-Bo qui n'ont pas d'undo non plus en multijoueur)
- **Classement victoires** contre le bot (perso + mondial aperçu fictif)
- **Testé en profondeur** : perft 1-4 exacts, Fool's Mate (mat le plus rapide) détecté via l'interface complète de bout en bout, prise en passant réelle, roque réel (autorisé et refusé quand la case traversée est attaquée), promotion, pat (stalemate), undo (1er gratuit, historique correctement dépilé)
- ⚠️ Simplifications connues (notées, pas des bugs) : pas de choix de pièce à la promotion (auto-dame), pas de règle des 50 coups ni de nulle par répétition de position (cas rares, omis pour rester dans un scope raisonnable comme la règle de blocage du Ludo)

## v39 : Nouveau mini-jeu — Skip-Bo
Sixième mini-jeu. Règles fidèles au vrai jeu : deck de 162 cartes (144 numérotées 1-12 ×12 exemplaires + 18 jokers Skip-Bo), pioche perso de 30 cartes/joueur, main de 5, 4 piles de construction communes (doivent monter 1→12 dans l'ordre, se vident automatiquement en atteignant 12), 4 piles de défausse perso par joueur. Victoire de manche = vider sa pioche perso en premier ; **match en 2 manches gagnantes** (ajout : le vrai jeu se joue souvent en match, pas en manche unique — plus engageant qu'une seule partie).
- **2 modes** : solo vs 3 bots, ou entre amis 2-4 joueurs local — avec **écran "passe le téléphone"** entre les tours humains en mode amis (main privée, ne doit pas être vue par les autres — inspiré du système déjà en place sur Qui suis-je)
- **Interaction 100% tap direct** (comme demandé) : taper une carte (main, dessus de la pioche perso, ou dessus d'une pile de défausse perso) pour la sélectionner, puis taper une pile de construction pour la jouer si légal (surbrillance verte automatique des piles qui acceptent la carte sélectionnée), ou taper une pile de défausse perso pour y terminer son tour (uniquement possible depuis la main)
- **IA bots** : priorité pioche perso > main > défausses, défausse la carte la plus haute en fin de tour
- **💡 Indice** : toujours via pub simulée, sélectionne automatiquement un coup légal pour que le joueur n'ait plus qu'à taper la pile en surbrillance
- **Classement** (ajout, cohérent avec la règle générale) : matchs gagnés perso (solo vs bots) + mondial aperçu fictif
- **Testé en profondeur** : intégrité du deck (162 cartes, 12 exemplaires par valeur, 18 jokers), règles de pose (refus si valeur incorrecte, jokers toujours acceptés, pile vidée à 12), victoire de manche/match, repioche automatique à 5 pendant le tour, **simulation complète d'un match 4 bots sans crash avec intégrité du deck vérifiée après coup (162 cartes conservées)**

## v38 : Ludo — tap direct sur les pions (au lieu de boutons) + plateau plus visuel
- **Interaction changée** : les pions jouables (en réserve ou sur le plateau) sont maintenant directement tapables — surbrillance pulsante blanche autour du pion + curseur pointer — au lieu de la liste de boutons "Pion 1/2/3/4" précédente. Tap = sélection ET déplacement en un geste.
- Plateau visuellement enrichi : quadrants de réserve plus saturés, cases sûres marquées d'une étoile, cases de départ colorées plus visibles.
- 🟥 Note honnête sur le plateau physique "vrai jeu" (croix classique 15×15 avec 4 bras) : j'ai tenté de reconstruire la géométrie exacte du plateau physique Ludo à partir de la capture d'écran fournie, mais la reconstruction précise (quelle case connecte à quelle autre, entrée exacte des couloirs finaux) s'est avérée trop sujette à erreur à faire de mémoire sans un vrai plan de référence — risque de plateau cassé/incohérent trop élevé. J'ai gardé l'anneau carré de 52 cases (déjà testé et garanti correct géométriquement) plutôt que de risquer un plateau buggé. Si un vrai visuel en croix est important, le mieux serait de fournir un schéma exact (coordonnées case par case) plutôt qu'une capture d'écran d'appli tierce à partir de laquelle il faut deviner la géométrie.
- Tous les tests précédents repassent (solo/bots, multijoueur, capture, victoire) + nouveaux tests sur le tap direct (pion movable seulement pour le joueur actif avec un lancer en attente)

## v37 : Nouveau mini-jeu — Ludo
Cinquième mini-jeu, le plus complexe à ce jour. Moteur de règles classique : anneau partagé de 52 cases, couloir final privé de 6 cases par couleur, 8 cases sûres (4 départs + 4 étoiles), capture d'un pion adverse non protégé, victoire quand les 4 pions d'une couleur sont à la maison.
- **2 modes** : 🤖 Solo contre 3 bots (le joueur est toujours rouge) — IA simple (priorité : sortir de réserve > capturer un adversaire > avancer le pion le plus proche de la maison) ; 👥 Entre amis 2/3/4 joueurs en local (pass-and-play), couleurs actives choisies pour l'équilibre (2 joueurs = coins opposés rouge+bleu, 3 = rouge/vert/jaune, 4 = toutes)
- **Relance de dé** : 1ère relance gratuite par partie, ensuite pub simulée à chaque fois (même pattern que les autres jeux)
- **Classement victoires** (uniquement en solo vs bots, où "toi" a un sens clair) : compteur perso (`localStorage ludoWins`) + mondial aperçu fictif, affiché en fin de partie
- **Plateau simplifié mais fonctionnellement fidèle** : anneau de 52 cases rendu en grille CSS 14×14 (bordure = ring path, généré algorithmiquement et vérifié géométriquement plutôt que recopié à la main — risque d'erreur trop élevé), couloirs finaux et réserves affichés en zones séparées ; sélection des pions à jouer via boutons dédiés (plus fiable au tap que des pions superposés sur le plateau)
- **Testé en profondeur** : géométrie de l'anneau (52 cases uniques, connectées, coins alignés aux couleurs), sortie de réserve, capture (protégée sur case sûre / non protégée ailleurs), victoire + incrément du compteur perso, relance gratuite puis payante, **simulation complète d'une partie 4 bots de bout en bout sans crash** (398 coups jusqu'à victoire)
- ⚠️ Simplification connue : pas de règle de "blocage" (2 pions de la même couleur sur une case qui empêche le passage adverse) — omise pour rester dans un scope raisonnable, notée ici si demandée plus tard

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

## 🟥 BUG CONNU signalé le 24/08 : Ludo — "quelques bugs" (non détaillés par l'utilisateur, à investiguer plus tard)
L'utilisateur a mentionné qu'il y a des bugs sur Ludo mais n'a pas précisé lesquels, et a dit "on verra plus tard". À creuser à la prochaine session si l'utilisateur en reparle — lui demander de préciser quels bugs exactement avant de chercher à l'aveugle.

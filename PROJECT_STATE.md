# Paradoxes & Probabilités — État du projet

> **Pour Claude : lis ce fichier avant de répondre.** Version condensée — ne contient QUE l'essentiel (état actuel + leçons à ne pas réapprendre). Pas d'historique détaillé version par version : voir `git log` si besoin de retracer une décision précise.

## C'est quoi
PWA éducative/ludique : paradoxes de probabilités expliqués simplement + mini-jeux, en français, grand public (12 ans+).
- **URL live** : https://giovinazzoenzo1-bit.github.io/paradoxes-app/
- **Repo** : https://github.com/giovinazzoenzo1-bit/paradoxes-app
- **Stack** : un seul fichier `index.html` (HTML+CSS+JS vanilla), `sw.js` (service worker PWA), `manifest.json`. GitHub Pages.
- **Analytics** : GoatCounter (sans cookies)

## Workflow (toujours appliquer)
- Cloner/éditer dans le sandbox, push via Personal Access Token fine-grained fourni par l'utilisateur en début de session. **Retirer le token du remote juste après le push.**
- **Bumper `CACHE_NAME` dans `sw.js` à chaque modif**, sinon le service worker sert une version périmée.
- **Valider le JS avec `node --check`** avant de push (extraire les blocs `<script>`).
- GitHub Pages a un cache CDN de 5 min — attendre avant de tester après un push.
- Documenter chaque modif dans ce fichier, mais **condensé** : état actuel + limites, pas de récit chronologique.

## Fonctionnalités en place
- **20 paradoxes** interactifs avec simulation (Monty Hall, Anniversaires, 2 enfants, Simpson, Saint-Pétersbourg, Parrondo, etc.) — écran + explication (`infoText`) + icône par paradoxe
- **Quiz** : 2 modes (Paradoxes / Général, 3 tranches d'âge), 10 questions
- **Mini-jeux** : Wordle, Qui suis-je, 2048, Memory, Puzzle 15, Morpion, Snake, Nuts and Bolts, Solitaire, Sudoku, Puissance 4, Flappy Bird, Ludo, Skip-Bo, Échecs, Billard, Ping-pong
- **Trophées** (localStorage) + Classement (aperçu avec données fictives mergées au meilleur score perso, pas de vrai compte)
- Nav bar 4 onglets, sauvegarde de scroll/session, son/vibration (3 modes), musique de fond, pub factice (pas de vraie régie)

## 🟦 Règle générale pour tout jeu (existant ou nouveau)
- **Classement perso + mondial** si le score a du sens à comparer (perso en localStorage, mondial en aperçu fictif fusionné). Score continu simple → pattern Snake. Plusieurs runs/difficultés → pattern Memory/Puzzle15 (onglets, top 5).
- **Undo** si l'action est réversible et hors temps réel : 1er gratuit, puis pub simulée (`mockWatchAd`). Ne pas l'ajouter sur les jeux réflexe (Flappy Bird, Snake).

## État actuel par jeu récemment travaillé

**Ping-pong** — 2D vue de dessus, physique maison (rebond murs haut/bas, pas de rebond latéral — sortie latérale = point au dernier frappeur), vraies règles du ping-pong (service 2 rebonds, faute de filet), victoire à 7 points, 3 difficultés de bot, mode entre amis multi-touch. **Validé par l'utilisateur, considéré réglé.**

**Billard** — mode paysage géré en pivotant le DESSIN canvas (pas le DOM), 8-ball avec vraies règles, mode Bot (IA ghost-ball) avec animation de frappe de la queue, pochettes latérales plus étroites que les coins. Watchdog anti-blocage (try/catch + double garde-fou temporel) ajouté suite à un bug de bot qui bloquait la partie. **Dernier retour utilisateur : "pour l'instant c'est ok"** — pas de nouveau bug remonté depuis, mais pas non plus testé en profondeur post-fix.

**Flappy Bird** — l'oiseau est maintenant un sprite PNG (toucan fourni par l'utilisateur) au lieu d'une forme dessinée, avec légère inclinaison selon la vitesse verticale. Nouveau dossier `sprites/` créé pour les images de jeu (distinct de `icons/` qui reste pour les icônes de menu). Tuyaux : en attente des visuels du frère (voir `ASSETS_SPECS.md`, dimensions réelles documentées pour éviter les devinettes).

**Morpion** — cahier des charges complet lu (Drive, docs "Enzo"=logique et "Flavio"=UI/visuel). Réécrit pour suivre le §1/§2/§4 : match BO3, alternance du 1er joueur, Undo (1 gratuite/manche puis pub pour +2), ligne de victoire animée, anti-spam sur case occupée, streaks locaux, économie de pièces, doublement via pub en fin de match. **Roadmap V2 également traitée** : mode Bot (3 difficultés — Facile aléatoire, Normal bloque/gagne, Expert Minimax imbattable en règle classique) et règle Anti-nul (3 pions max par joueur, le plus ancien disparaît). Limite assumée : Undo désactivé en règle Anti-nul (l'historique un-niveau ne suit pas la rotation des pions) ; Expert+Anti-nul retombe sur l'heuristique Normal (le Minimax classique ne s'applique pas à un plateau qui n'est jamais plein). Pas encore fait : §3 sound design dédié (réutilise les sons génériques), reskin visuel Flavio (assets PNG pas fournis).

**2048** — cahier des charges complet fourni par l'utilisateur et son frère (Drive, docs "Enzo"=logique/monétisation et "Flavio"=UI/visuel), thème cible "néon cyberpunk". Chantier en cours, traité point par point (§ = numéro du cahier des charges "Enzo") :
- ✅ §1 Jeu infini après 2048 (4096, 8192...) au lieu de s'arrêter.
- ✅ §2 Power-ups : Undo (coût aligné sur la spec : 50 pièces ou pub, plus de "1er gratuit"), Marteau Laser (100 pièces/pub, tap une tuile pour la détruire), Swap (75 pièces/pub, tap 2 tuiles adjacentes pour les permuter). Économie de pièces (§4) : 1 pièce de base par fusion + bonus par palier (128:+10, 1024:+50, 2048+:+200), streak de swipes consécutifs avec fusion (x1.5 à 3 coups, x2 à 5 coups).
- ✅ Mode Rush 60s (marqué "future MAJ" dans le cahier des charges mais demandé maintenant par l'utilisateur) : chrono strict de 60s qui descend jusqu'à 0 quoi qu'il arrive (le bonus "+1s par fusion" a été retiré — il neutralisait quasiment la descente en jouant vite, bug remonté par l'utilisateur), **aucun power-up disponible en Rush** (pur challenge, demande explicite), classement séparé du mode Classique (panneau à onglets, perso signé anti-triche + mondial aperçu).
- Reste à faire (dans l'ordre du cahier des charges) : §3 sound design dédié (swipe/fusion basse/fusion haute/erreur/danger/power-up/game over), reskin visuel néon complet (doc "Flavio" : palette, wireframe, animations juice), §5 architecture pub/anti-churn (nécessite de vérifier si une vraie régie existe dans l'app — actuellement pub factice seulement).

## 🟥 Bug connu non résolu
**Ludo** (signalé 24/08) : "quelques bugs", jamais détaillés. Demander à l'utilisateur de préciser avant d'investiguer.

## Leçons techniques à ne pas réapprendre
- `screen.orientation.lock()` est peu fiable (échoue silencieusement sur iOS) — pour un jeu en mode paysage sur téléphone portrait, **pivoter le dessin canvas** (`ctx.setTransform`), jamais le DOM.
- Rotation CSS d'un élément DOM casse `getBoundingClientRect()` → bugs de coordonnées tactiles difficiles à diagnostiquer. Même remède que ci-dessus.
- Mesurer une hauteur dispo via `clientHeight` d'un flex est peu fiable sur mobile → utiliser `visualViewport` moins la hauteur réelle des éléments en flow normal.
- Écouter `visualViewport.resize` en plus de `window.resize`/`orientationchange` (barre d'adresse mobile).
- Dans une simulation physique, une vitesse `NaN` passe silencieusement les checks `<seuil` (toujours faux) → boucle infinie. Toujours valider `isFinite()` avant d'appliquer une vitesse.
- Un `setTimeout` dont le callback lève une exception échoue silencieusement (log console, pas de crash) — si ce callback devait déclencher une action essentielle (ex : tour d'un bot), l'action n'a jamais lieu et l'état reste bloqué. Toujours wrapper la logique de décision d'un bot/IA en `try/catch` avec repli sûr.
- Ne jamais se fier à un rendu/tactile réel non testé depuis ce sandbox (pas de vrai navigateur/device) — le dire explicitement à chaque livraison concernée, et rester réactif aux retours utilisateur avec capture d'écran/vidéo (souvent décisifs pour localiser la vraie cause).

## Pas encore fait (connu)
- Bandeau de consentement RGPD (nécessaire avant une vraie régie pub)
- Tetris et Bataille navale (annoncés "bientôt" dans l'app)
- Traduction complète (sélecteur présent, seul le français actif — volontaire)
- Vrai système de compte utilisateur (nécessaire pour un vrai classement)
- App native (Capacitor) pour vraie pub AdMob / App Store

## Convention de code utile
- `puzzles` (array JS) = les 20 paradoxes (`id`, `icon`, `color`, `title`, `hook`, `odds`) ; `infoText` = explications par `id`
- Icônes paradoxes : `icons/paradox_{id}.png` (300×300, fond transparent). Icônes jeux : `icons/{nom}.png`
- Stats utilisateur : `statsGet()`/`statsSet()` (localStorage, clé `userStats`)
- Toujours resynchroniser `restoreLastScreen()` et `ASSETS` du service worker si nouvel écran/fichier ajouté

## Générer une nouvelle icône
1. Prompt Gemini (flat vector, fond noir uni #000000, pas de scène réaliste)
2. Nettoyage du fond (script Python : détection couleur de coin + flood-fill + scipy), recadrage carré
3. Redimensionner 300×300, sauvegarder dans `icons/`, référencer dans le HTML, ajouter au cache `sw.js`, bumper `CACHE_NAME`

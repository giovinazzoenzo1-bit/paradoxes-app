# Paradoxes & Probabilités — État du projet

> **Pour Claude : lis ce fichier avant de répondre.** Version condensée — ne contient QUE l'essentiel (état actuel + leçons à ne pas réapprendre). Pas d'historique détaillé version par version : voir `git log` si besoin de retracer une décision précise.

## C'est quoi
PWA éducative/ludique : mini-jeux avec monnaie in-game, en français, grand public (12 ans+). 🟥 **Paradoxes masqués depuis le [date] — voir section dédiée ci-dessous, code conservé mais inaccessible depuis l'app.**
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
- **Monnaie in-game globale** (`appCoins`, une seule cagnotte partagée par toute l'app, barre fixe toujours visible en haut de l'écran). Formule de gain pour les jeux avec bot, calibrée sur **120 pièces/heure** : `pièces = 2 × durée_partie(min) ÷ P(victoire)`. Pour les jeux sans bot (score/temps) : paliers fixes atteints une fois par partie. Un vrai Expert imbattable sort de la formule (P=0) : traité comme trophée/diamant hors farm.
  - **Morpion** : 1 Facile / 4 Normal par manche (joueur gagnant seulement) + 1 pièce bonus si BO3 gagné en Facile (mode jugé trop facile pour ne rapporter que des micro-gains).
  - **Puissance 4** : bot ajouté (Facile/Normal, mêmes filets de sécurité try/catch + jeton de session que Morpion/Billard), 5 Facile / 17 Normal.
  - **2048** : ancienne économie par fusion retirée (jugée trop généreuse) → paliers de score, séparés Classique (2000→3 ... 50000→50) / Rush (500→3 ... 3000→25).
  - **Memory** / **Puzzle 15** / **Sudoku** : défi chrono par taille/difficulté (résoudre sous un seuil de temps → pièces), un seul gain par partie.
  - **Nuts and Bolts** : +1 pièce si niveau réussi en moins de 30s (le jeu ne s'arrête jamais au-delà, juste pas de bonus).
  - **Snake** (10→1, 25→5, 40→10) / **Flappy Bird** (5→1, 15→5, 25→10) : paliers de score additifs, un seul gain par palier et par partie.
  - 🟨 **Tous les seuils de temps/score sont des estimations de départ** (méthode 2×durée÷P(réussite), sans simulation possible pour un défi solo humain contrairement à un bot) — à ajuster avec un vrai ressenti de jeu.
  - **Premier retour de test réel intégré** : Memory (4×4 sous 18s / 6×6 sous 60s), 2048 Rush (paliers 900→3/1100→6, suite extrapolée), Nuts and Bolts (seuil devenu progressif avec le niveau au lieu d'un 30s fixe — le vrai souci était que les niveaux faciles se battent trivialement sous n'importe quel seuil fixe), Morpion Facile (plus de gain par manche, seulement 1 pièce si BO3 gagné), Puissance 4 (bot durci : Facile bloque désormais, Normal évite de préparer un coup gagnant adverse — pièces réduites de 30%), Flappy Bird (pièces divisées par 2), Wordle (3 pièces si trouvé, 5 à la 5e tentative, 8 à la 6e). Puzzle 15 pas encore retouché (l'utilisateur n'est pas sûr du seuil, à tester).
  - Ping-pong/Billard ont un bot mais pas encore de pièces branchées — reste à faire.
  - **`coins-config.js`** : fichier séparé (chargé avant le script principal) qui centralise TOUTE la config de pièces — plus aucune valeur codée en dur dans `index.html`. Commenté en français simple avec un mode d'emploi (éditer sur GitHub.com, committer, attendre le déploiement) pour que l'utilisateur ajuste lui-même les chiffres sans repasser par Claude. Chaque jeu affiche désormais clairement son barème (lu dynamiquement depuis ce fichier, donc jamais désynchronisé) dans son panneau de sélection de mode/difficulté.
  - **Plafond anti-abus** : `appCoinsAddLimited(jeu, montant)` limite chaque jeu à 40 pièces/heure max (fenêtre glissante, localStorage par jeu) — accorde le reste de la marge si le montant demandé dépasse, 0 si le plafond est déjà atteint. Tous les points de gain de tous les jeux passent par cette fonction, plus aucun accès direct à `appCoinsAdd()` depuis la logique de jeu.
  - **Mode "Contre un ami" ne rapporte plus rien** (Morpion, Puissance 4) — trop facile de farmer en jouant les 2 côtés soi-même sur le même appareil.
  - **Morpion** : le match se gagne désormais à 3 manches remportées (au lieu de 2/BO3), plus aucun gain par manche — seulement à la victoire du match complet (Facile : 1 pièce, Normal : 6 pièces).
  - Rééquilibrages suite à retours répétés : Puissance 4 -50% (2/6), 2048 Rush seuils -20% (plus facile), Flappy Bird seuils +50% (plus dur), Wordle 6e tentative ramenée à 3 pièces (au lieu de 8), Puissance 4 Facile +30% de difficulté (20% aléatoire au lieu de 30%, évite désormais aussi de laisser un coup gagnant immédiat à l'adversaire).
  - **Phase de test utilisateurs prévue** (plusieurs testeurs, 10 min chacun, objectif : gagner un maximum de pièces + retour sur quels jeux sont trop faciles/durs + suggestions de nouveaux jeux) — résultats attendus, à intégrer dans les prochains rééquilibrages.
  - Jeux réorganisés pour la phase de test : Ping-pong et Billard remontés juste après Flappy Bird (toujours actifs), Quiz reste ensuite. Qui suis-je, Solitaire, Skip-Bo, Ludo, Échecs grisés (opacité réduite, bouton "🔒 Bientôt disponible" non cliquable) — pas supprimés, juste mis en pause le temps des tests.
  - **Ping-pong** : bug corrigé — la raquette du bot n'était jamais recentrée à chaque service, ce qui pouvait la laisser bloquée en position excentrée et faire perdre le match complet au bot. Pièces ajoutées : 2 (Facile) / 5 (Moyen), rien en Difficile pour l'instant. Info affichée sous les boutons de difficulté.
  - **Billard** : 5 pièces si victoire contre le bot (pas de paliers). **Garde-fou supplémentaire "obligation de jouer"** ajouté (`setInterval` 2s) : si c'est au tour du bot sans qu'aucun coup ne soit programmé (bug persistant remonté par l'utilisateur malgré les protections précédentes), le tour est relancé de force. Démarré à l'ouverture de la table, arrêté à la sortie.
  - Lien de partage : le grand titre "Impressionne tes amis..." de l'ancien écran d'accueil (masqué mais toujours dans le HTML brut) a été mis à jour — pouvait fuiter dans les aperçus de lien malgré les meta og:/twitter: déjà corrigées.
  - **Bouton de remise à zéro des pièces** ajouté à côté de la barre en haut (↺, avec confirmation) — réinitialise aussi l'historique du plafond horaire de chaque jeu, pour repartir sur une base neutre (utile pour les tests utilisateurs).

## 🟥 Paradoxes masqués (pas supprimés)
À la demande de l'utilisateur, qui n'est pas sûr de vouloir les retirer définitivement ("on le rajoutera peut-être plus tard mais c'est pas sûr") : **choix délibéré de MASQUER plutôt que SUPPRIMER**, pour rester facilement réversible sans devoir re-coder 20 simulations de paradoxes si l'utilisateur change d'avis.
- Onglet "Paradoxes" retiré de la barre de navigation du bas (reste 3 onglets : Jeux/Progrès/Options, Jeux devient l'écran par défaut à l'ouverture).
- Quiz Paradoxes retiré, seul le Quiz Général reste.
- `restoreLastScreen()` redirige tout ancien accès sauvegardé (accueil ou paradoxe précis) vers Jeux.
- **Le code des 20 écrans de paradoxes (simulations, HTML, JS) reste intégralement dans `index.html`, juste rendu inaccessible** (plus aucun lien n'y mène). Pas de nettoyage de code fait exprès, pour un retour en arrière simple.
- ✅ **Traité** : les 3 trophées paradoxes ("Premier pas", "Curieux", "Collectionneur") ont été retirés de `trophyList` (le check reste dans le code des 20 écrans masqués mais n'est plus référencé). Remplacés par **12 nouveaux trophées**, un par mini-jeu qui n'en avait pas encore (Puzzle 15, Sudoku, Solitaire, Flappy Bird, Morpion, Puissance 4, Ludo, Skip-Bo, Échecs, Billard, Ping-pong, Qui suis-je), tous liés à une vraie victoire/réussite en jeu (pas juste "avoir ouvert l'écran") et vérifiés atteignables. Effet de bord corrigé au passage : le trophée "3 jours de suite" ne se déclenchait que via la visite d'un paradoxe — rattaché à l'ouverture de l'app à la place.
- App renommée **"Paradox"** (title, manifest.json, meta apple-mobile-web-app-title, footer) — les meta og:/twitter: de partage réseaux sociaux ont aussi été réécrites pour ne plus mentionner "paradoxes" (mensonger vu que le contenu est masqué), désormais orientées mini-jeux/pièces.
- ✅ Nom d'app traité (voir juste au-dessus).
  - **Puzzle 15** : seuils recalculés à partir d'une vraie recherche de temps moyen de résolution (confirmé pour 4×4 : "joueur confiant 3-5 min" selon plusieurs sources concordantes ; 5×5/6×6/7×7 extrapolés par ratio de nombre de coups, beaucoup moins fiable faute de données réelles) — seuil = 20% plus rapide que la moyenne, 5 pièces à la clé sur les 4 tailles.
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

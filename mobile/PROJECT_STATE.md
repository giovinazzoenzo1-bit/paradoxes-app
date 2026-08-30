# État — Paradox mobile (React Native / Expo)

> **Pour Claude, en début de session :** lis ce fichier en entier avant d'agir.
> Ne pas lire l'historique Git ni les anciens commits sauf besoin précis.
> Ce fichier est réécrit (pas complété) à chaque mise à jour — il ne contient
> QUE l'état actuel, pas l'historique des bugs déjà réglés.
> Mets-le à jour (overwrite les sections concernées, push) après tout
> changement notable : nouveau jeu porté, dépendance ajoutée/retirée, bug
> résolu, décision d'architecture.

## Repo
- `github.com/giovinazzoenzo1-bit/paradoxes-app`, dossier `mobile/`
- PWA de référence (logique de jeu à porter) : racine du repo, `index.html`
  (~10000 lignes) + `PROJECT_STATE.md` / `ASSETS_SPECS.md` à la racine
- PWA en ligne : giovinazzoenzo1-bit.github.io/paradoxes-app/

## Démarrage rapide d'une nouvelle session Claude
Message type à donner : "Projet Paradox. Lis mobile/PROJECT_STATE.md sur ce
repo, clone avec le token ci-dessous, continue à partir de là." Le token
GitHub à utiliser (permissions Contents/Metadata/Secrets/Workflows en
Read/write, pas Actions) est fourni par l'utilisateur en début de
conversation — ne pas le stocker en clair ici à long terme, il est redonné
à chaque nouvelle session par l'utilisateur lui-même. Le retirer du remote
juste après chaque push.

## Stack actuelle
- Expo SDK 54 (figé — Expo Go du Play Store bloqué dessus, ne pas monter en
  SDK 55+)
- Compte Expo : `paradoxes-app1`, projet : `paradox-1`
- **Pas de react-navigation / react-native-gesture-handler / react-native-screens**
  → retirés définitivement (voir "Décisions figées" ci-dessous)
- Navigation par onglets : switch d'état local dans `App.js` (TABS array),
  pas de lib externe

## Décisions figées (ne pas revenir dessus sans raison forte)
- **Pas de navigation externe.** react-navigation + gesture-handler +
  react-native-screens causaient un blocage permanent du contexte React
  (écran blanc, pas un crash) sur ce build précis. Confirmé par bisection
  méthodique. Solution : navigation par état local (`useState` dans
  `App.js`). Si un futur écran a besoin de navigation empilée (stack), tester
  d'abord en isolation via build APK avant d'adopter une lib.
- **Zone sûre (safe area) gérée une seule fois, dans `App.js`** (paddingTop
  sur le conteneur de contenu, paddingBottom sur la tab bar, via
  `useSafeAreaInsets`). Les écrans individuels (Jeux, Morpion, etc.) n'ont
  PAS à gérer leur propre zone sûre — sinon double-padding ou oublis.
- **Geste de retour : `src/hooks/useBackGesture.js`**, réutilisable, sans
  lib tierce (PanResponder + BackHandler, tous deux natifs de RN, zéro
  risque de réintroduire le bug de navigation). Tout écran de jeu avec un
  `onBack` doit appliquer `{...useBackGesture(onBack)}` sur sa View racine
  pour supporter le swipe bord droit→gauche + bouton retour Android.
- **Grille de jeu (type Morpion) : toujours en lignes explicites**
  (`[0,1,2].map(row => <View flexDirection:row>...)`), jamais en
  `flexWrap` avec une largeur de conteneur calculée à la main — source d'un
  bug réel (grille passée en 2 colonnes au lieu de 3, calcul de padding
  oublié). Les lignes explicites n'ont pas ce risque.
- `newArchEnabled: false` dans app.json (précaution, RN 0.81 reste
  bridgeless par défaut de toute façon)
- **`eas.json` profil `preview` a un `channel: "main"`.** Sans ça, l'APK
  installé ne reçoit JAMAIS les mises à jour publiées par
  `mobile-publish.yml` (qui publie sur la branche `main`) — bug découvert
  et corrigé le 29/08. Si un jour l'appli installée ne se met plus à jour
  toute seule, vérifier ce channel en premier.
- `expo-updates` doit rester en version `~29.0.x` (compatible SDK 54) —
  `npx expo install --fix` peut la faire dériver, vérifier après usage

## Structure du code
- `App.js` — provider pièces + safe area + error boundary + switch d'onglets
- `index.js` — point d'entrée, handler d'erreur JS global (affiche les
  erreurs à l'écran au lieu d'un écran blanc)
- `src/context/CoinsContext.js` — système de pièces (AsyncStorage), port
  fidèle du PWA (plafond 40/h par jeu, fenêtre glissante)
- `src/components/CoinBar.js` — barre de pièces persistante
- `src/components/ErrorBoundary.js` — attrape les erreurs de rendu React,
  les affiche à l'écran (pas de crash silencieux)
- `src/screens/JeuxScreen.js` — liste des jeux (aucun jeu encore porté,
  tous en "À venir")
- `src/screens/ProgresScreen.js`, `OptionsScreen.js` — écrans basiques

## Workflows GitHub Actions
- `mobile-publish.yml` : auto, à chaque push sur `mobile/**` (branche main)
  → publie une EAS Update → visible dans Expo Go en ~15s. **Mode de travail
  quotidien, ne nécessite aucune action de l'utilisateur.**
- `build-apk.yml` : manuel (`workflow_dispatch`, bouton "Run workflow") →
  construit un vrai APK installable. **Seulement pour bugs invisibles dans
  Expo Go, ou avant soumission finale.** Lien fixe :
  github.com/giovinazzoenzo1-bit/paradoxes-app/actions/workflows/build-apk.yml
  Téléchargement : expo.dev/accounts/paradoxes-app1/projects/paradox-1/builds

## Contraintes d'environnement (Claude)
- Pas d'accès réseau direct à expo.dev/api.expo.dev depuis le bac à sable —
  tout passe par GitHub Actions
- Pas d'accès aux logs de build GitHub Actions (domaine blob.core.windows.net
  bloqué) — utiliser un rapport de bug Android (Paramètres → Options
  développeur → Rapport de bug) si besoin de logs natifs profonds
- Token GitHub à insérer dans le remote juste pour le push, puis retirer
  immédiatement après (ne jamais le laisser dans l'historique de commande)

## Étape en cours / prochaine étape
Morpion, Puissance 4, 2048, Memory, Snake, Puzzle 15 et **Sudoku portés et
jouables**. Sudoku : génération avec solution garantie unique (backtracking
+ comptage de solutions, rapide : <15ms même en difficile), 3 vies, conflits
détectés en temps réel. Undo/Effacer : 1 gratuit par partie puis désactivé
(pas de pub). **Indice (Hint) non porté** : 100% payant en pub dans le PWA,
aucune alternative gratuite ou en pièces définie — plutôt que d'inventer un
prix, je ne l'ai pas fait. À trancher avec l'utilisateur si voulu.

Puzzle 15 (taquin) porté juste avant. Puzzle 15 : 4 niveaux (4×4→7×7), mélange garanti résoluble
(mouvements valides depuis l'état trié), dégradé cyan→magenta par tuile
suivant le doc Flavio. **Divergences volontaires PWA > cahier des
charges** : tap simple sur tuile adjacente uniquement (pas de glissement en
bloc pourtant décrit dans le cahier des charges), chronomètre démarre
immédiatement (pas au 1er coup), pas de power-up Undo.

**Avant de porter le jeu suivant, toujours vérifier le dossier Drive
correspondant** (parent : 1NbnNSF_mq0Vi9CsiOHaTp7VzPdVMhtl5) — s'il contient
des docs (Flavio=UI, Enzo=gameplay), les lire et les suivre pour le
design/UX ; s'il est vide, suivre le PWA (`index.html`) comme référence
unique. **Le PWA reste la référence définitive sur les mécaniques déjà
itérées/équilibrées**, même quand un cahier des charges décrit une
mécanique plus riche jamais implémentée (ex: glissement en bloc du Puzzle
15) — toujours vérifier ce qui est RÉELLEMENT dans le JS du PWA, pas
seulement ce que dit le cahier des charges.

**Décision récurrente à reproduire pour chaque futur jeu ayant un
classement dans le PWA : ne pas le porter en V1** (perso signé + mondial
fictif = faible valeur/forte complexité relative). Le mentionner à
l'utilisateur à chaque fois plutôt que de le faire silencieusement.

**Décisions UI globales tranchées (29/08) :**
- **CoinBar visible sur tous les écrans de jeu**, y compris pendant la
  partie (pas seulement les écrans de setup). S'applique à tout futur jeu.
- **Barre d'onglets du bas masquée pendant qu'un jeu est ouvert.**
  Mécanisme : `App.js` garde un état `gameOpen`, transmis en prop
  `onGameOpenChange` à `JeuxScreen`, qui le déclenche via `useEffect` sur son
  `openGame`. Tout futur jeu ajouté à `JeuxScreen` bénéficie de ce mécanisme
  automatiquement (pas besoin de code supplémentaire par jeu).
- **Bouton "Rejouer" systématique en fin de partie.**

**Nuts and Bolts porté et jouable** : 50 niveaux progressifs (3 à 9
couleurs), mélange garanti résoluble par recherche best-first (vérifié
<200ms même niveau 50), progression persistée (AsyncStorage nbMaxLevel).

**Flappy Bird porté et jouable, avec les VRAIS graphismes** (fournis par
le frère de l'utilisateur, via Drive puis re-uploadés directement dans le
chat après échec de copie du base64 Drive — voir note ci-dessous). Physique
par delta-temps identique au PWA, tuyaux texturés (corps carrelé
verticalement + embouchure débordante), inclinaison de l'oiseau selon la
vitesse. Pas de boutique de thèmes ni classement en V1.

**⚠️ Piège technique important (29/08) : ne JAMAIS recopier à la main un
fichier binaire (image) depuis le contenu base64 renvoyé par un outil
(ex: Google Drive download_file_content) — le modèle peut silencieusement
corrompre de longues chaînes base64 en les retapant, produisant un fichier
qui "a l'air" correct mais est tronqué/faux. Vérifié : une image de 72KB
recopiée à la main a donné un fichier de 2KB qui se décodait quand même en
PNG valide (mais faux/tronqué) — piège silencieux, aucune erreur visible
sans vérification de taille. Toujours vérifier la taille du fichier
décodé contre la taille attendue avant de faire confiance à une copie
base64. La méthode fiable : demander à l'utilisateur d'uploader le
fichier DIRECTEMENT dans le chat (pas via Drive) — les fichiers uploadés
atterrissent sur le disque sans repasser par une recopie manuelle de
texte, donc sans risque de corruption.**

**Piège technique additionnel (29/08) : `resizeMode="repeat"` sur Image RN
n'est pas fiable cross-platform** — invisible/cassé sur Android alors qu'il
fonctionne sur iOS. Pour carreler une texture (comme le corps du tuyau
Flappy Bird), toujours empiler manuellement plusieurs copies de l'Image
(voir composant `TiledPipeBody` dans FlappyBirdScreen.js) plutôt que de
compter sur ce resizeMode.

**Wordle porté et jouable — DERNIER JEU DU PWA, LES 10 JEUX SONT
MAINTENANT PORTÉS.** Design néon cyberpunk suivant le doc Flavio,
dictionnaire de 4448 mots extrait programmatiquement (pas retapé à la
main, vérifié identique par comparaison d'ensembles) depuis index.html.
**Un vrai bug corrigé au passage** (pas juste une divergence PWA) :
l'algorithme d'évaluation des lettres du PWA ne décrémentait pas le stock
de lettres du mot cible, donnant un résultat faux avec des lettres en
double dans la proposition — remplacé par le véritable algorithme Wordle
à deux passes.

## Bilan : les 10 jeux du menu PWA sont tous portés en mobile
Morpion, Puissance 4, 2048, Memory, Snake, Puzzle 15, Sudoku,
Nuts and Bolts, Flappy Bird, Wordle.

**Prochaines étapes possibles (à discuter avec l'utilisateur, pas de
décision unilatérale) :**
- Revenir sur les décisions "non porté en V1" si l'utilisateur les
  redemande : classements (perso + mondial fictif) pour tous les jeux à
  chrono/score, boutique de thèmes Flappy Bird, power-ups ad-gated
  (Sudoku Hint, Morpion undo illimité, etc.) — nécessite de discuter
  monétisation/pub d'abord.
- Cohérence visuelle : chaque jeu a été stylé sur sa propre palette suivant
  son cahier des charges Drive (quand il existe) ; pas de design system
  unifié entre les jeux — voulu ou à harmoniser ?
- Build APK de test complet (tous les 10 jeux) avant une éventuelle
  soumission App Store / Play Store.
- Écran Progrès (trophées/stats) : existe dans le PWA (statsRecord*
  functions vues dans plusieurs jeux) mais pas encore porté côté mobile —
  actuellement un écran vide.
- Écran Options : idem, à développer.


## Billard porté (29/08) — hors des 10 jeux du menu principal
Le PWA a AUSSI un Billard 8-ball (866 lignes, le jeu le plus complexe du
PWA) et un Ping-pong, tous deux absents du tableau `gameKeys` suivi par les
stats mais bien présents et fonctionnels dans le PWA. Le Billard est
maintenant porté.

**Décision technique importante :** le PWA utilise Matter.js (moteur
physique tiers) + un vrai `<canvas>`. Pour le mobile, remplacé par :
- Un moteur physique **maison** (`billiardPhysics.js`) : collisions
  cercle-cercle élastiques à masse égale + réflexion cercle-mur, MêMES
  constantes que le PWA (restitution 0.95/0.80, frictionAir 0.018,
  8 sous-étapes/frame, MAX_POWER 45) — pour ne pas introduire une nouvelle
  dépendance native à la compatibilité RN non vérifiée (voir historique de
  crash Bridgeless documenté plus haut).
- Un rendu **100% Views RN** (`BilliardScreen.js`) à la place du canvas —
  même technique de transformation de coordonnées que le PWA
  (`gameToScreen`/`screenToGame` dans `billiardLogic.js`, transliterées de
  `bilGameToCanvas`/`bilCanvasToGame`) pour faire tenir la table 900×450
  tournée "en paysage" dans un écran portrait.
- Règles du 8-ball et IA du bot ("ghost ball") **transliterées fidèlement**
  depuis `bilEvaluateShot`/`bilBotPickShot` — testées unitairement
  (assignation de groupe, fautes, victoire légale/illégale à la bille 8,
  placement de bille valide) avant de pousser.
- Simplifications **cosmétiques uniquement** (gameplay/règles/physique
  100% fidèles) : pas d'animation de recul de queue avant le tir, ligne de
  visée en trait plein au lieu de pointillés, queue en couleur unie au lieu
  d'un dégradé, pas de confettis de victoire.

**Prochaine étape : porter Ping-pong** (dernier jeu du PWA restant, hors
menu principal). Même méthode : lire tout le code PWA d'abord, vérifier
s'il a un cahier des charges Drive, tester la logique avant de pousser.

## Bugs Billard corrigés (29/08) — 4 bugs remontés en une fois, tous réglés
1. **Queue de billard "de travers"** : mélange d'une direction en espace
   jeu avec des coordonnées écran sans passer par la même rotation que le
   reste du rendu. Corrigé en calculant la géométrie de la queue en espace
   jeu D'ABORD, puis en la transformant via `toScreen()` comme tous les
   autres éléments (billes, poches, ligne de visée).
2. **Placement de bille bloqué après une faute** + **jauge de puissance
   capricieuse** : même cause racine, **piège React général important à
   retenir pour tout futur jeu tactile** : un `PanResponder` créé via
   `useRef(PanResponder.create({...})).current` n'est construit qu'UNE
   SEULE FOIS — ses callbacks capturent alors les variables d'état
   (`gameState`, `mode`, `currentPlayer`...) de ce tout premier rendu, et ne
   les voient plus jamais changer ensuite (fermeture figée / stale closure).
   **Solution systématique : ne jamais lire une variable d'état directement
   dans un callback de PanResponder mémorisé par useRef — toujours passer
   par une ref synchronisée à chaque rendu** (`const xRef = useRef(x);
   xRef.current = x;` en haut du corps de la fonction, puis lire
   `xRef.current` dans les callbacks). `useBackGesture.js` n'a pas ce
   problème (il ne dépend d'aucun état réactif), mais tout futur jeu avec
   un PanResponder plus complexe doit appliquer ce pattern dès le départ.
3. **Fausse faute systématique** (le vrai bug le plus sérieux) : le booléen
   `railAfterContact` (bande touchée après contact, condition légale du
   8-ball) n'était JAMAIS mis à jour dans le moteur physique maison — donc
   tout tir qui ne rentrait aucune bille était compté comme faute, même
   quand une bande était légitimement touchée après contact. Corrigé dans
   `stepPhysics` (billiardPhysics.js).

Les 4 corrections ont été testées unitairement (script Node) avant d'être
poussées, notamment la correction #3 avec un scénario de tir réaliste.

**Prochaine étape (inchangée) : porter Ping-pong.**

## Billard passé en vrai mode paysage (29/08)
Suite à un nouveau retour ("table sur le côté, jauge encore buggée"), le
billard tourne maintenant l'ÉCRAN PHYSIQUEMENT en paysage (pas juste un
tour de coordonnées en interne comme le PWA) :
- `expo-screen-orientation` ajouté aux dépendances (module Expo de base,
  déjà inclus dans Expo Go pour le SDK courant — pas besoin de dev client
  custom, contrairement à un vrai module natif tiers).
- Verrouillage paysage au montage de l'écran (`ScreenOrientation.lockAsync`),
  restauration portrait au démontage (retour au reste de l'appli).
- Dimensions lues via `useWindowDimensions()` (réactif à la vraie rotation
  OS) au lieu de `Dimensions.get('window')` figé au chargement du module —
  **cause probable des soucis de proportion/jauge remontés**.
- Nouvelle disposition : barre du haut (retour/mode/score/statut + jauge de
  puissance HORIZONTALE + bouton TIRER), table maximisée en dessous sur
  toute la largeur.
- Geste de retour bord-droit retiré spécifiquement pour cet écran (n'a plus
  de sens en paysage) — boutons Retour visibles à la place.

**Piège à retenir pour tout futur écran avec des dimensions calculées** :
ne jamais utiliser `Dimensions.get('window')` comme CONSTANTE DE MODULE
(calculée une seule fois au chargement) si l'écran peut changer de
dimensions en cours de vie (rotation, mode paysage). Toujours utiliser le
hook `useWindowDimensions()` à l'intérieur du composant pour un
recalcul réactif.

## Billard : 4 corrections supplémentaires (29/08)
1. **Disposition revue** : panneau fixe à droite (score en haut, jauge de
   puissance horizontale + bouton TIRER en dessous), table maximisée à
   gauche. Remplace l'ancienne barre du haut pleine largeur.
2. **Le swipe retour Android fermait l'appli** (pas de handler enregistré
   pour ce jeu) — `BackHandler` ajouté, intercepte le retour matériel/geste
   pour naviguer dans l'écran (table → setup → sortie) au lieu de fermer
   l'appli. **Point d'attention pour tout futur écran hors du flux normal
   JeuxScreen** (billard sort de la logique `onGameOpenChange`/tab bar
   standard à cause du mode paysage) : bien vérifier que le retour
   matériel Android est géré, sinon il ferme l'appli par défaut.
3. **Animation de frappe ajoutée** : la queue recule (déjà visible pendant
   la visée) puis fonce vers la bille en 130ms avant que le tir ne parte
   réellement, comme le PWA — la simplification initiale ("pas
   d'animation") a été explicitement retirée, l'utilisateur la voulait.
4. **Jauge de puissance** : largeur découplée de la largeur de la table
   (fixée à la largeur du panneau) — probable cause du petit bug résiduel.

**Prochaine étape (inchangée) : porter Ping-pong**, dernier jeu du PWA.

## Billard : session reprise après coupure de crédits (29/08) — 4 corrections
1. **Bug réel trouvé et corrigé** : après une faute, le bot plaçait bien la
   bille en main mais ne tirait ensuite JAMAIS — rien ne relançait
   `maybeBotTurn()` après la fin du placement. Ajouté `maybeBotTurnRef` +
   appel différé pour enchaîner placement → tir.
2. **Disposition** : score/mode remontés dans une barre fine au-dessus de
   la table (n'est plus dans le panneau latéral).
3. **Jauge repassée à la verticale** (demande explicite, après l'avoir
   mise à l'horizontale la fois précédente).
4. **Vitesse d'animation recalibrée** : un tir à pleine puissance se
   stabilisait en ~0,45s (quasi instantané, pas beau) car MAX_POWER/
   FRICTION_AIR avaient été copiés tels quels du PWA sans tenir compte du
   fait que notre moteur simplifié (position += vitesse par sous-étape)
   n'a pas la même sémantique que la vraie friction interne de Matter.js.
   Recalibré en gardant le même RATIO puissance/friction (donc la même
   distance totale parcourue à puissance max) mais en ralentissant le
   déroulé dans le temps : MAX_POWER 45→10, FRICTION_AIR 0.018→0.004 —
   testé, un tir à pleine puissance dure maintenant ~3s.

Effet de bord positif : panneau latéral réduit (96px au lieu de 190px) +
score sorti du panneau → table plus large. Zones sûres (`useSafeAreaInsets`)
ajoutées pour ne plus jamais rendre la table sous la barre de gestes
système.

**Prochaine étape (inchangée) : porter Ping-pong**, dernier jeu du PWA.
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

## Billard : 5 corrections supplémentaires (29/08, suite)
1. **Table élargie** : barre du haut réduite (44→34px) + marges resserrées.
   Comme la table était limitée par la HAUTEUR (aspect 2:1, hauteur =
   facteur limitant), libérer de la hauteur libère aussi de la largeur.
2. **Score vraiment centré** en haut : 3 colonnes flex égales (retour à
   gauche, score au centre, statut à droite) au lieu d'un simple alignement
   à gauche à côté du bouton retour.
3. **Bug réel (même piège que la fois précédente, pas encore repéré
   partout)** : la jauge verticale souffrait du MÊME problème de fermeture
   figée que gameState/mode/currentPlayer — `POWER_BAR_H` était capturé par
   le PanResponder créé une seule fois. Corrigé via une ref, même pattern
   que les autres. **À vérifier systématiquement pour toute nouvelle valeur
   utilisée dans un callback PanResponder mémorisé.**
4. **Bug réel important** : viser en sortant du doigt hors de la zone de la
   table faisait n'importe quoi. Cause : `evt.nativeEvent.locationX/Y`
   devient peu fiable dès que le doigt quitte les limites de la vue touchée
   (piège connu de React Native). Corrigé en mesurant la position absolue
   de la table à l'écran (`ref` + `.measure()`) et en utilisant
   `gestureState.moveX/moveY` (toujours fiables, coordonnées absolues)
   moins cette origine. **Pattern à réutiliser pour tout futur geste de
   glissement qui peut sortir de sa vue d'origine.**
5. **Barre de navigation Android masquée** (`expo-navigation-bar`, nouvelle
   dépendance) pendant le billard — géré comme l'orientation (masquée à
   l'entrée, restaurée à la sortie).

**Prochaine étape (inchangée) : porter Ping-pong**, dernier jeu du PWA.

## Barre système masquée pour toute l'appli + vrai bug de la jauge trouvé (29/08)
- **Barre de navigation Android masquée globalement** (déplacé de
  BilliardScreen vers App.js, `AppContent`) — plus d'immersion sur toute
  l'appli, pas seulement le billard. `overlay-swipe` permet quand même de
  la faire réapparaître d'un geste bord d'écran si besoin.
- **Le vrai bug de la jauge (toujours pas résolu après la correction
  précédente)** : la jauge ne fait que 34px de large, donc pendant un
  glissement vertical le doigt sort très facilement de sa zone tactile —
  exactement le même piège RN que celui déjà trouvé et corrigé pour la
  visée sur la table (`evt.nativeEvent.locationY` peu fiable hors des
  limites de la vue). Corrigé avec exactement le même remède : position
  absolue mesurée (`ref` + `.measure()`) + `gestureState.moveY` au lieu de
  `locationY`. Ajouté un `hitSlop` généreux en plus pour plus de tolérance.
  **Ce pattern (mesure + gestureState) est maintenant la référence pour
  TOUT geste de glissement dans une zone tactile étroite — à appliquer
  d'emblée pour tout futur slider/jauge, pas seulement en réaction à un
  bug remonté.**

**Prochaine étape (inchangée) : porter Ping-pong**, dernier jeu du PWA.

## Bot billard amélioré — "avait l'air bête" (29/08)
Vrai problème trouvé : dès qu'aucun tir avec un angle de coupe raisonnable
(< 75,6°) n'existait, le bot ABANDONNAIT complètement et visait la bille la
plus proche avec une puissance générique, sans se soucier d'AUCUNE poche —
d'où l'impression qu'il "ne connaissait pas les règles".

Corrigé avec une recherche en 2 passes dans `botPickShot`
(billiardLogic.js) : essai d'abord avec un angle raisonnable (<63°,
difficulté "normale"), puis seulement si vraiment rien ne convient,
assouplissement à <88° en prenant la meilleure option — le bot vise
désormais TOUJOURS une bille de son groupe vers une poche précise, jamais
un coup au hasard. Imprécision de visée légèrement resserrée (0,09→0,07
rad) et puissance minimum relevée (0,55→0,6×) pour un jeu plus décisif,
sans le rendre parfait (demande explicite : difficulté normale, pas
extrême).

**Prochaine étape (inchangée) : porter Ping-pong**, dernier jeu du PWA.

## Ping-pong porté (29/08) — tous les jeux du PWA sont maintenant portés
Dernier jeu restant (hors menu principal, comme le Billard). Bonne nouvelle
trouvée dans le code source du PWA lui-même : contrairement au billard, ce
jeu reste **volontairement en portrait** ("plus de verrouillage
d'orientation : ça tient dans l'écran du téléphone tel quel") et utilise
déjà une **physique maison** (pas de Matter.js) — donc ce portage évite
TOUTE la complexité rencontrée sur le billard : pas de verrouillage
paysage, pas de barre système à masquer, pas de zones sûres spéciales, pas
de rotation de coordonnées.

**Leçons du billard appliquées d'emblée (pas en réaction à un bug) :**
- Contrôles tactiles : mesure de position absolue (`ref` + `.measure()`) +
  `gestureState.moveX/Y` dès le départ, jamais `locationX/Y`.
- 2 `PanResponder` séparés sur 2 zones fixes (haut/bas) plutôt que du
  multi-touch brut sur une seule vue — évite la complexité du
  `ppActivePointers` du PWA tout en gérant correctement le mode "Entre
  amis" à 2 joueurs sur le même téléphone.
- Toutes les valeurs utilisées dans les callbacks de PanResponder passent
  par des refs (`dimsRef`, `modeRef`, `diffRef`) mises à jour à chaque
  rendu, jamais capturées directement.
- Physique et règles testées unitairement (service, rebond, collision
  raquette, déflexion, règles de score, condition de victoire, IA du bot)
  AVANT d'écrire l'écran.

3 difficultés de bot (facile/moyen/difficile), pièces selon
coins-config.js (rien encore en difficile, comme le PWA). Non porté (même
politique que les autres jeux) : boutique de raquettes cosmétiques,
particules d'impact/tremblement d'écran/étoiles de victoire, classement
mondial fictif.

## 🎉 Bilan complet : tous les jeux du PWA sont portés en mobile (12 au total)
Les 10 du menu principal (Morpion, Puissance 4, 2048, Memory, Snake,
Puzzle 15, Sudoku, Nuts and Bolts, Flappy Bird, Wordle) + Billard +
Ping-pong.

## Boutique de raquettes ajoutée au Ping-pong + style néon (29/08)
Suite à des captures d'écran de référence montrant le style attendu
(carte néon violette, badges, bouton retour circulaire lumineux, boutique
de skins), ajouté ce qui manquait :

- **8 skins de raquette** (identiques à coins-config.js `pingpongPaddles`),
  cosmétique uniquement, persistés via AsyncStorage (`ppOwnedPaddles`/
  `ppSelectedPaddle`), change la couleur de la raquette du joueur en jeu.
- Nouvel écran boutique (bouton flottant sur l'écran de configuration).
- Style visuel retravaillé pour ce jeu spécifiquement (carte néon violette,
  boutons à emoji, bouton retour circulaire lumineux, carte de score
  colorée TOI/BOT) — chaque jeu garde sa propre palette, pas de design
  system unifié (choix déjà assumé, voir plus haut).

**Vrai bug pré-existant corrigé au passage** : `spendCoins` dans
`CoinsContext.js` n'avait encore jamais été utilisé par aucun jeu jusqu'à
cette boutique. Il retournait TOUJOURS `true` (même sans assez de pièces)
à cause d'une course entre un `setState` asynchrone et une relecture
immédiate d'AsyncStorage. Corrigé en vérifiant directement contre l'état
`coins` avant de dépenser — c'était sur le point de devenir un vrai bug
bloquant pour la toute première fonctionnalité qui en dépendait.

## Bilan : les 12 jeux du PWA sont portés, Ping-pong a maintenant sa boutique
Reste ouvert (à discuter) : les autres jeux ayant des boutiques/features
similaires dans le PWA (ex. Flappy Bird avait une boutique de thèmes de
fond, explicitement non portée en V1) pourraient faire l'objet de la même
demande plus tard.

## Ping-pong : 2 corrections (29/08)
1. **Manches de raquette rendues visibles** : la reprise littérale des
   proportions du PWA ne laissait dépasser que ~5% du rayon du cercle —
   quasi invisible sur téléphone. Redessiné pour un manche clairement
   visible (~0,55×rayon qui dépasse), bout arrondi.
2. **Vrai bug de score trouvé et reproduit** (probablement présent aussi
   dans le PWA, jamais remarqué) : quand une raquette rattrape la balle
   dans la marge hors-table généreuse (pour "sauver" une balle large),
   `deflect()` replace la balle juste à côté de la raquette — qui peut
   encore être hors des limites [0,h] à cet instant précis, avant même
   d'avoir bougé avec sa nouvelle vitesse. Comme la vérification du score
   avait lieu dans la MÊME frame juste après la frappe, le point pouvait
   partir au MAUVAIS joueur (celui qui avait fait sortir la balle, au lieu
   de celui qui venait de la sauver) — exactement le symptôme remonté.
   Corrigé en ignorant complètement la vérification de score sur toute
   frame où une frappe vient d'avoir lieu (une balle qui vient d'être
   touchée est par définition "revenue en jeu", pas "sortie"). Bug
   reproduit avec un scénario de test dédié avant correction.

**Bilan à jour : les 12 jeux du PWA sont portés, avec Ping-pong et son
système de raquettes/boutique désormais peaufinés.**

## Ping-pong : score qui avançait de 2 en 2 (29/08)
Course entre deux tâches asynchrones : après un point, `doServe()` (qui
replace la balle en zone neutre) était planifié via `setTimeout(0)`, mais
la boucle d'animation continuait immédiatement via `requestAnimationFrame`
sans aucune garantie que le `setTimeout` s'exécute avant la frame
suivante. Si la frame suivante arrivait en premier, la balle était encore
à sa position "sortie", `checkScore` détectait la MÊME sortie une
deuxième fois, et le point était compté deux fois.

Corrigé avec un verrou (`pointScoredRef`) : dès qu'un point est détecté,
on bloque toute nouvelle vérification de score jusqu'à ce que `doServe()`
ait réellement remis la balle en jeu (et donc levé le verrou).

**Piège à retenir pour tout futur jeu à boucle `requestAnimationFrame`** :
ne jamais supposer qu'un `setTimeout(0)` planifié depuis l'intérieur de la
boucle s'exécutera avant la frame suivante — toujours poser un verrou
explicite si une action a besoin d'être "acquittée" avant de pouvoir se
redéclencher.

## Nouveau jeu : Traceur de Runes (29/08) — PAS un port, création originale
Inspiré du mécanisme observé dans un jeu tiers (Hoora / "Spell Tracer") :
une forme s'affiche, disparaît, le joueur la reproduit du doigt, score =
% de ressemblance. **Univers et noms 100% originaux** (Halo, Flamme,
Bastion, Croisée, Joyau, Marée, Éclair, Étincelle, Éternité, Tourbillon) —
PAS les noms de sorts Harry Potter ("Nox" etc.) vus dans la capture de
référence, protégés par le droit d'auteur. Le mécanisme de jeu en
lui-même n'est pas protégeable, mais les noms/l'univers de la référence
l'étaient.

- 10 formes géométriques générées par code (cercle, triangle, carré,
  étoile, vague, zigzag, spirale, infini, croix, losange).
- Algorithme de score : rééchantillonnage des 2 tracés (référence + joueur)
  en points équidistants le long de leur longueur, comparaison dans les 2
  sens de parcours (le joueur peut tracer à l'envers), distance normalisée
  par la diagonale de la forme. **Calibré empiriquement contre l'exemple
  de la capture d'écran fournie par l'utilisateur** (un cercle tracé à main
  levée, visiblement approximatif, notait 59% "SLOPPY") en testant contre
  des tracés synthétiques bruités jusqu'à obtenir un résultat cohérent
  dans cette fourchette.
- Pièces selon la moyenne des 10 runes (système de plafond horaire existant).
- Toucher : leçons du billard/ping-pong appliquées dès le départ (mesure
  absolue + gestureState, refs pour les callbacks PanResponder).

**Bilan : 13 jeux au total maintenant (12 portés du PWA + ce nouveau).**

## Traceur de Runes : bug de score critique corrigé + animation de dessin (29/08)
Capture d'écran fournie par l'utilisateur : un tracé visiblement excellent
de l'infini notait 0% ("RATÉ"). Vrai bug, pas juste un souci de calibration.

**Cause racine** : le score comparait le tracé du joueur et la forme de
référence point par point, dans l'ordre. Pour les formes FERMÉES (cercle,
infini, étoile, carré, triangle, losange — désormais marquées `closed:
true` dans `RUNES`), rien n'empêche le joueur de commencer à tracer à
n'importe quel endroit de la boucle. Un tracé par ailleurs parfait mais
démarré à un autre point que celui de la paramétrisation interne de la
référence se retrouvait totalement désaligné point à point → score proche
de 0 malgré un tracé visuellement irréprochable.

**Corrigé** : pour les formes fermées, on teste maintenant TOUS les
décalages de point de départ possibles (en plus des 2 sens de parcours
déjà gérés) et on garde le meilleur alignement — calcul unique au
relâchement du doigt, donc coût négligeable (~1ms). Résolution
d'échantillonnage aussi augmentée (48→96 points) pour réduire le bruit de
discrétisation résiduel. Vérifié : un tracé parfait démarré n'importe où
sur la boucle note maintenant 93-96% au lieu de 0-88%, un mauvais tracé
reste bien à 0%.

**Animation de dessin ajoutée** : la forme se trace maintenant elle-même
progressivement (comme le jeu de référence), au lieu d'apparaître d'un
coup. Durée proportionnelle à la complexité de la forme (plus de segments
= plus de temps pour la mémoriser), répond au retour "formes pas trop
compliquées" sans avoir à refondre les formes elles-mêmes.

## Traceur de Runes : le VRAI bug de score trouvé (29/08, suite)
6 captures d'écran fournies par l'utilisateur ont révélé le vrai problème :
Halo (rune 1) scorait juste (76%), mais TOUTES les runes suivantes
donnaient des scores erratiques (Marée à 0% malgré un tracé quasi-parfait
visuellement, Flamme 23%, Bastion 56%, Joyau 40%).

**Cause racine : exactement le même piège de fermeture figée déjà
rencontré (et corrigé) sur le billard et le ping-pong, manqué cette fois
au premier jet.** `finishStroke` dépendait de `runeIndex` (donc recréée à
chaque rune), mais le `PanResponder` du dessin est créé UNE SEULE FOIS via
`useRef` — son `onPanResponderRelease` gardait pour toujours la version de
`finishStroke` de la TOUTE PREMIÈRE rune. Résultat : à partir de la 2e
rune, le tracé du joueur était comparé à la forme de la RUNE 1 (Halo,
cercle) au lieu de sa propre forme — Halo scorait juste car c'était
justement la rune 1. Corrigé avec `finishStrokeRef`, même remède que sur
les jeux précédents. **Ce piège doit être vérifié systématiquement pour
CHAQUE nouveau jeu utilisant un PanResponder mémorisé — ne pas se fier au
fait qu'il a déjà été corrigé ailleurs, le revérifier à chaque fois.**

**Autres corrections demandées :**
- Croix ("Croisée") retirée : nécessitait 2 traits séparés (lever le
  doigt entre la barre verticale et horizontale), incompatible avec le
  principe du jeu (un seul trait continu — lever le doigt déclenche la fin
  du tracé). Remplacée par "Croissant" (arc simple, un seul trait).
- Toutes les formes réduites en taille (cercle 0.38→0.32 de rayon, etc.)
  et la spirale simplifiée (4,2→3 tours), en prenant Marée comme référence
  de la "bonne taille" (citée explicitement par l'utilisateur comme
  exemple à suivre).

## Traceur de Runes : recalibration (29/08, suite) — pas un bug cette fois
4 nouvelles captures fournies. Contrairement au lot précédent, **pas de
bug algorithmique** cette fois (le correctif de fermeture figée a tenu :
les scores variaient bien selon la vraie qualité du tracé). Mais la
sévérité restait trop dure pour un ressenti satisfaisant : des tracés
honnêtes avec coins naturellement arrondis (étoile, éclair) tombaient à
51-58% alors qu'ils "semblaient corrects" à l'œil.

**2 changements :**
1. Sévérité assouplie (`SCORE_K` 700→550) — vérifié qu'un tracé
   franchement mauvais reste bien pénalisé (~9-50%) tandis qu'un effort
   honnête avec l'imprécision naturelle du doigt atteint maintenant 90%+
   au lieu de 40-65%.
2. **Vrai problème trouvé en calibrant** : les formes à très peu de
   sommets (triangle : 4 points, carré/losange : 5 points) réagissaient
   très différemment des formes à courbe (cercle : 49 points) face à la
   même imprécision de tracé, chaque point ayant un poids disproportionné
   sur un si petit nombre. Ajouté un helper `densify()` (ajoute des points
   le long de chaque segment droit, même géométrie, juste plus de points
   pour la décrire) appliqué à triangle/carré/losange/éclair/étoile —
   toutes les formes se comportent maintenant de façon cohérente,
   indépendamment de leur nombre de sommets d'origine.

## Traceur de Runes : refonte complète du système de score (29/08, décision utilisateur)
Après plusieurs allers-retours de captures d'écran, l'utilisateur a
identifié le vrai problème conceptuel : l'ancien système (distance
moyenne point à point + recherche de décalage) pénalisait un simple
DÉCALAGE DE POSITION presque autant qu'une vraie erreur de FORME, sans
qu'on puisse régler leur poids l'un par rapport à l'autre. L'utilisateur
a explicitement refusé un recentrage ("le but du jeu est d'avoir la même
forme ET au même endroit") et a proposé lui-même la solution : **mesurer
le % de recouvrement entre le tracé affiché et le tracé du joueur**, sans
aucun recentrage.

**Nouveau système (COUVERTURE BIDIRECTIONNELLE), qui remplace
entièrement l'ancien :**
- `covRef` : quelle fraction des points de la référence a un point du
  joueur à proximité (a-t-il bien parcouru toute la forme ?)
- `covUser` : quelle fraction des points du joueur a un point de la
  référence à proximité (n'est-il pas sorti du tracé / n'a-t-il pas
  gribouillé à côté ?)
- Score = **minimum** des deux (pas la moyenne — testé : avec la
  moyenne, un tracé ne couvrant que la moitié de la forme notait 76%,
  trop généreux ; avec le minimum, ~53%, correctement pénalisé).
- Tolérance minimale fixe : 0,045 en unités normalisées [0,1] (demande
  explicite : "minim" pour l'instant, à resserrer si besoin plus tard).

**Effet de bord positif** : toute la mécanique de "recherche de décalage
de point de départ" pour les formes fermées (rotateArray, essai de tous
les offsets, SCORE_K, normalisation par la diagonale) est devenue
inutile et a été retirée — la couverture ne se soucie pas de l'ordre des
points, donc l'ancien bug ("l'infini scorait 0% si tracé en démarrant
ailleurs sur la boucle") est désormais structurellement impossible, pas
juste corrigé au cas par cas.

Testé sur 7 scénarios (tracé parfait, décalé, gribouillage aléatoire,
tracé honnête imprécis, mauvaise forme, forme fermée démarrée ailleurs,
tracé partiel) + les 10 runes avec un tracé bruité standard, avant de
pousser.

## Traceur de Runes : tolérance resserrée (29/08, suite)
Captures montrant 2 vrais problèmes avec la tolérance initiale (0,045) :
1. Un gribouillage complet sans rapport avec la forme (Éternité/infini,
   juste des traits diagonaux denses sur la zone) notait 61% "BIEN" —
   la tolérance était trop large, assez de points du gribouillage
   tombaient "par hasard" près d'un point de la référence.
2. Des traits parasites hors de la forme (petit trait sous le triangle,
   au-dessus du carré) étaient noyés dans le score global (96-97% quand
   même) au lieu d'être visiblement pénalisés.

**Resserrée à 0,015** (÷3) — testé contre le scénario exact du
gribouillage (simulé, traits diagonaux denses sur la zone de l'infini) :
tombe à 24% (RATÉ, correct) au lieu de 67% à l'ancienne tolérance.
Vérifié qu'un tracé honnête avec un tremblement de doigt réaliste (~2% du
canevas) reste à 98-100% à cette tolérance, avec une marge confortable
avant dégradation (perceptible seulement en dessous de ~0,01).

## Traceur de Runes : formes remplacées (29/08, suite)
Retour direct : le carré (Bastion) jugé "chiant et pas amusant" (long à
tracer, 4 côtés égaux), l'étoile (Étincelle) jugée "trop compliquée" (5
pointes = 10 sommets). Les deux retirées et remplacées par des formes
courtes et rapides :
- **Coche** (validation, 2 segments) remplace Bastion.
- **Flèche** (2 segments) remplace Étincelle.

Vérifié par la longueur réelle du tracé (pas juste "à l'œil") : Coche
(1,19 unités) et Flèche (0,94) sont plus courtes que Croissant (1,25,
déjà validé comme rapide) et bien plus courtes que Halo/cercle (2,01) —
donc objectivement plus rapides à tracer, pas juste visuellement plus
simples. Roster toujours à 10 formes.

## Traceur de Runes : minuteur, essais, score cumulé (29/08, suite)
Suite aux captures du jeu de référence (Spell Tracer, montrant SCORE
cumulé, CASTS à 3 points, minuteur ~5s) :
- **Tolérance légèrement réassouplie** (0,015→0,02) — retour "un peu
  sévère" sur un tracé de la Coche pourtant raisonnablement proche
  (10%). Vérifié que le gribouillage reste bien pénalisé (~30%, RATÉ) à
  cette valeur.
- **Minuteur de 6 secondes** par tentative de tracé — démarre quand la
  forme disparaît, soumet automatiquement ce qui a été tracé (ou rien) si
  le temps s'épuise. Affiché en haut, passe en rouge sous 2s.
- **3 essais ("chances") par rune** — le MEILLEUR score parmi les
  tentatives est conservé. Écran de résultat : bouton "Réessayer" tant
  qu'il reste des essais, indicateur à points (comme les CASTS de la
  référence).
- **Score cumulé affiché en haut** (là où l'utilisateur avait entouré en
  rouge sur sa capture) — somme littérale des meilleurs % de chaque rune
  terminée (PAS une moyenne), conformément à la demande explicite
  "score=%+%" et au format "SCORE 160" du jeu de référence.

## Traceur de Runes : minuteur en bas + chances liées au temps uniquement (29/08, suite)
2 précisions importantes de l'utilisateur :
1. **Minuteur déplacé en bas**, sous le canevas, avec une barre qui se
   vide (comme le jeu de référence) au lieu d'un petit texte en haut à
   droite.
2. **Correction de comportement importante** : les 3 chances ne se
   déclenchent QUE si le joueur ne termine pas son tracé dans les 6
   secondes — PAS comme un bouton "Réessayer" volontaire s'il n'aime pas
   son résultat. Un tracé terminé à temps (le joueur lève le doigt) est
   désormais définitif et immédiat (vers "Suivant", jamais de bouton
   réessayer). Seul un temps écoulé consomme une chance et relance
   automatiquement le cycle d'affichage de la forme pour un nouvel essai.
   Séparé l'ancien gestionnaire unique `finishStroke` en deux chemins
   distincts (`handleRelease` pour une fin volontaire à temps,
   `handleTimeout` pour un échec par manque de temps) pour que cette
   distinction soit structurelle plutôt que masquée par un simple
   drapeau.

## Nouveau jeu : Élevage (Clicker de créatures), 1er du menu (29/08)
Nouveau jeu (pas un port), placé en PREMIER dans le menu comme demandé.
Thème choisi avec l'utilisateur (par élicitation) : créatures à
collectionner et faire évoluer, esprit gacha, pour viser un public 10-25
ans.

**Roster 100% original** : 10 créatures, 3 stades d'évolution chacune
(niveau 1 → niveau 5 → niveau 15) = 30 formes nommées (ex. Braisillon →
Brasegriffe → Infernouve). Aucun nom, design ou franchise protégée
repris — seul le PRINCIPE générique du genre (élément, rareté, évolution
par niveau) est repris, ce qui n'est pas protégeable. Art en emoji simple
(pas de génération d'image, cohérent avec l'approche 100% Views du reste
de l'appli).

**Boucle de jeu** : tap pour gagner des pièces (puissance de tap
améliorable) → dépenser les pièces en invocations gacha (rareté pondérée
60/25/12/3%) et en nourriture pour faire monter les créatures possédées
en niveau (revenu passif/s croissant, évolution automatique à niveau 5 et
15). Gains hors-ligne calculés au chargement (plafonnés à 4h anti-abus),
bannière "pendant ton absence". **Économie séparée** du système de
pièces `appCoins` partagé du reste de l'appli — un jeu incrémental/idle a
sa propre monnaie persistée via AsyncStorage dédié.

Toutes les formules de coût/revenu sont des fonctions pures dans
`clickerLogic.js`, testées unitairement (distribution de rareté,
progression des coûts, seuils d'évolution, plafond hors-ligne) avant de
construire l'écran.

**Bilan : 15 jeux au total maintenant** (13 précédents + Traceur de
Runes + Élevage).
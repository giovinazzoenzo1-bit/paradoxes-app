# État actuel — Clicker + Aventure

> **Ce fichier est un état ACTUEL, pas un historique.** Contrairement à
> `PROJECT_STATE.md` (qui accumule des sections datées au fil des sessions
> et devient long), celui-ci décrit comment tout fonctionne EN CE MOMENT.
> S'il devient faux après un changement, corrige-le directement plutôt
> que d'ajouter une note en plus. Objectif : qu'une nouvelle session
> Claude puisse lire UNIQUEMENT ce fichier + jeter un œil rapide aux 2
> fichiers de logique (`clickerLogic.js`, `combatLogic.js`) et être
> immédiatement opérationnelle, sans avoir à lire l'historique Git ni
> tout `PROJECT_STATE.md`.

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `mobile/src/games/clicker/clickerLogic.js` | Logique pure du clicker : roster de créatures, rareté, boutique auto-clics, quêtes, œuf. Aucune dépendance UI. |
| `mobile/src/games/clicker/combatLogic.js` | Logique pure du combat : stats, dégâts, chapitres/niveaux, évolution. Aucune dépendance UI. |
| `mobile/src/screens/games/ClickerScreen.js` | Écran principal du clicker (le plus gros fichier, ~1560 lignes). Onglets Tap/Shop/Quêtes/Collection, barre de nav du bas. |
| `mobile/src/screens/games/AdventureScreen.js` | Écran Aventure : liste des 3 créatures du deck, fiche détaillée, carte des chapitres. |
| `mobile/src/screens/games/CombatScreen.js` | L'écran de combat réel (tour par tour + défi de tap + endurance + rotation d'équipe). |
| `mobile/src/screens/games/clickerTheme.js` | Palette `COLORS` partagée entre ClickerScreen et AdventureScreen — **fichier séparé exprès** pour éviter un import circulaire entre les deux écrans. |
| `mobile/ADVENTURE_MODE.md` | Journal de conception du mode Aventure (décisions prises AVANT le code, avec un historique des étapes). Utile pour comprendre le "pourquoi", pas pour l'état actuel. |

## ⚠️ RÈGLES DE SURVIE — à lire avant de toucher au ClickerScreen

Une session entière (03/09) a été perdue sur ces pièges. Ils échouent
tous EN SILENCE : rien ne plante, rien n'apparaît dans les logs, l'écran
s'affiche normalement mais ne répond plus.

### 1. Une vue qui déborde de son parent ne reçoit AUCUN tap (Android)

Contrairement à iOS, il n'y a pas de propagation hors limites. Une zone
tactile partiellement hors de son parent ne répond que sur la portion
encore à l'intérieur.

**La géométrie de la zone de tap est donc sacrée :**

```
tapZone   height: 290  (FIXE — ne jamais passer en flex)
tapButton 260 x 260    (STRICTEMENT < 290)
eggImage  230 x 230    (STRICTEMENT < 260)
```

Règle : **zone > bouton > image, avec une zone de hauteur FIXE.** Ces
valeurs ont bougé 3 fois le 04/09 : 230/210/185 → 260/230/200 (pas assez
visible) → 320/290/260 (a débordé le budget vertical réel de `tapArea`,
poussant le cadre du deck PAR-DESSUS le bouton dev situé juste
au-dessus — `justifyContent:'center'` répartit tout débordement pour
moitié vers le haut) → 290/260/230, stabilisé avec le cadre du deck
rétréci en même temps (72% → 62%). **Le chiffre exact n'est pas ce qui
compte** — l'ordre strict et le caractère FIXE de la zone, si. Mais
CETTE fois, le budget vertical total de `tapArea` (padding + cadre du
deck + tapZone + textes) doit aussi rester sous l'espace flex:1
réellement disponible à l'écran, sous peine de reproduire exactement ce
bug. Le symptôme original (violation de la géométrie stricte) mesuré :
142 clics/s envoyés, 2 à 15 reçus.

### 2. `pointerEvents` en PROP est ignoré (New Architecture, SDK 57)

Doit être dans le STYLE : `style={{ pointerEvents: 'none' }}`. En prop,
la valeur est silencieusement abandonnée et une couche décorative en
absolu avale tous les taps de l'écran.

⚠️ Reste à corriger dans les 4 mini-jeux (CombatScreen, PingPongScreen,
RuneTracerScreen, BilliardScreen) — 19 occurrences.

### 3. Pas de dégradé plein écran sur le ClickerScreen

Un `LinearGradient` en `absoluteFillObject` se recompose à CHAQUE rendu.
Cet écran a 45 `useState` et trois intervalles (1000/300/250 ms) : il se
re-rend en permanence. Résultat mesuré : l'app se fige une seconde et
perd les entrées. `BG_GRADIENT` existe dans le thème mais ne doit servir
que pour de petites surfaces (panneau modal).

### 4. Ne jamais reprendre un commit en bloc

Plusieurs commits mélangent une fonctionnalité et l'ancienne géométrie
de la zone de tap. `git checkout <commit> -- fichier` réintroduit le
bug. Appliquer à la main uniquement ce qui est voulu, puis **vérifier la
géométrie ci-dessus après coup**.

### 5. La cadence réelle de l'utilisateur est ~142 clics/s

Autoclicker mesuré sur un testeur externe. Toutes les simulations
d'équilibrage de ce fichier supposent **5-7 clics/s** : à 142, l'économie
tourne environ 20× plus vite que tout ce qui est écrit ici. Pour tester
la difficulté, régler l'autoclicker à **150 ms**.

Les gains sont regroupés (`pendingGainRef`, vidage 10×/s) précisément
pour encaisser cette cadence : sans cela, `gainCoins` déclenchait 426
mises à jour d'état par seconde, dont 142 re-rendus de toute l'appli via
`trackEvent`.

### 6. Méthode quand quelque chose casse

**Demander à l'utilisateur QUAND ça marchait encore.** Il a identifié le
commit fautif en une phrase là où dix tours de déduction avaient échoué.
Puis restaurer ce commit exact et réappliquer les changements UN PAR UN
avec un test à chaque étape.

Le compteur de diagnostic (afficher la cadence de taps réellement reçue)
a été l'outil décisif : il a prouvé que les taps se perdaient AVANT le
code, ce qui a écarté d'un coup toutes les pistes de performance.

### 7. Ne jamais mélanger `position:'absolute'` isolé et frères en flux normal

**Bug réel (04/09)** : le bouton cadeau (`calBtn`, `position:'absolute',
top:0` dans `tapArea`) et le cadre du deck (flux normal, centré par
`justifyContent:'center'` de `tapArea`) se sont désynchronisés — un
débordement vertical du contenu de `tapArea` a décalé le cadre du deck
(`justifyContent:'center'` répartit l'excédent pour moitié vers le
haut), mais le bouton cadeau, en position absolue, est resté scotché à
son `top:0` réel. Résultat : les deux, censés être à la même hauteur,
se sont retrouvés à ~450px d'écart. Mesuré avec précision par
l'utilisateur (captures annotées d'une règle graduée) avant que la
vraie cause soit trouvée.

**Corrigé structurellement**, pas en ajustant des marges : les deux
sont maintenant dans une même `View` en `flexDirection:'row'`
(`deckTopRow`), donc TOUJOURS à la même hauteur, quel que soit ce qui
se passe ailleurs dans `tapArea`. **Règle** : si deux éléments doivent
rester visuellement alignés, ne jamais isoler l'un des deux en
`position:'absolute'` pendant que l'autre reste dans le flux normal
d'un parent qui centre son contenu — les mettre dans un conteneur flex
commun.

## Navigation générale du Clicker

Barre de navigation en bas de `ClickerScreen.js` : **Shop | Collection | Aventure** (icônes `@expo/vector-icons`, pas d'images externes). L'écran d'accueil (`view === 'tap'`) contient : pièces, revenu/s, **barre de défi**, deck de 3 créatures, l'œuf central.

**L'onglet Quêtes n'existe plus** (02/09) — voir la section « Défis de l'œuf sur l'écran d'accueil » plus bas. Le composant `QuestsView` a été supprimé, ainsi que la valeur `'quests'` de `view`. L'**Ascension**, qui vivait dedans, est désormais en bas de la page « Améliorations » du **Shop**, juste après l'Offrande.

**Style visuel "Juicy"** : fond bleu-violet abysse très sombre (`COLORS.bg = '#07051a'`), éléments d'action avec lueur néon (shadowColor assorti à la couleur de bordure).

## Économie du Clicker

- Les **créatures ne produisent PLUS de pièces automatiquement** (refonte volontaire, en préparation du mode combat). La seule source de revenu passif est la **boutique d'auto-clics** (`AUTOCLICKERS`, 5 paliers : esprit → main → automate → colonie → titan), achetable plusieurs fois, coût croissant ×1,15 par unité déjà possédée.
- Boutons d'amélioration (Pacte, Faveur des Esprits, Sanctuaire, Veilleur, puis Offrande, puis les 20 améliorations de créatures, puis Ascension) : dans l'écran **Shop**, page "Améliorations". Page 2 du Shop = la boutique d'auto-clics (15 générateurs, liste continue).
- **Ascension** (prestige, essence permanente) : vit en bas de la page « Améliorations » du **Shop** (déplacée le 02/09 avec la suppression de l'onglet Quêtes). **C'est elle qui porte la longévité du jeu** — voir la section Équilibrage.
- **Invoquer une créature** (gacha) : vit dans l'onglet **Collection**, pas dans Shop.
- **Rituel** (bonus "pub" gratuit) : une bulle qui apparaît près de l'œuf (comme les pouvoirs de créature), pas un bouton ni une bannière.

## Montée en Expo SDK 57

Expo Go ne supporte **qu'une seule version du SDK à la fois** et se met à
jour tout seul depuis le store. Le passage d'Expo Go au SDK 57 a donc
rendu le projet (SDK 54) impossible à ouvrir, sur Android comme sur iOS.
Sur iPhone il n'existe aucun moyen de réinstaller une ancienne version
d'Expo Go (sideloading interdit), d'où l'obligation de monter le projet.

### Versions

Elles viennent de `bundledNativeModules.json`, extrait du paquet
`expo@57.0.19` lui-même. C'est la table de ce qu'Expo Go **embarque
réellement** — pour un module NATIF, le paquet JS doit correspondre à la
version native du client, sinon les API divergent à l'exécution.

| Paquet | Avant | Après |
|---|---|---|
| expo | ~54.0.36 | **~57.0.19** |
| react-native | 0.81.5 | **0.86.3** |
| react | 19.1.0 | **19.2.3** |
| async-storage | ^3.1.1 | **2.2.0** |
| expo-notifications | ~0.32.12 | **~57.0.16** |
| expo-screen-orientation | ~9.0.9 | **~57.0.2** |
| safe-area-context | ^5.9.1 | **~5.7.0** |

⚠️ **`async-storage` DESCEND de 3.1.1 à 2.2.0**, et c'est volontaire :
c'est la version embarquée dans Expo Go 57. Les 5 méthodes utilisées par
le projet (`getItem`, `setItem`, `removeItem`, `multiRemove`,
`getAllKeys`) existent toutes en 2.2.0, donc aucune sauvegarde n'est
affectée. Même logique pour `safe-area-context`.

### `newArchEnabled: true`, obligatoire

SDK 54 était le dernier à supporter l'ancienne architecture. À partir du
SDK 55 (RN 0.83+), seule la New Architecture existe — laisser `false`
n'est pas une option, l'app ne démarrerait pas.

### `@expo/vector-icons` était une dépendance fantôme

Utilisé dans presque tous les écrans mais **jamais déclaré** dans
`package.json` : il arrivait en transitif d'`expo@54`. Expo 57 ne le tire
plus, et le bundle échouait sur `Unable to resolve "@expo/vector-icons"`.
Ajouté explicitement.

**Règle** : une dépendance dont le code fait un `import` direct doit
figurer dans `package.json`, même si elle « marche » par transitivité —
la transitivité disparaît sans prévenir à la montée de version suivante.

### Vérification faite

`npx expo export` sur **Android ET iOS** : les deux bundles se
construisent. C'est le vrai test, la compilation Babel seule ne suffit
pas à valider une montée de SDK. `expo-doctor` passe 19/21, les 2 échecs
étant des appels réseau à `api.expo.dev` bloqués dans l'environnement de
travail, pas des problèmes de projet.

Aucune API retirée en RN 0.83-0.86 n'est utilisée (vérifié :
`PushNotificationIOS`, `Clipboard`, `ProgressBarAndroid`,
`ViewPropTypes`, `removeEventListener`…).

## Feuille de route illustrations créatures (03/09)

Le frère de l'utilisateur va produire les assets visuels des 26
créatures. Feuille de route complète livrée dans
`mobile/CREATURE_ART_ROADMAP.md` — auto-suffisante, aucune question de
retour prévue.

### Décision technique : Lottie pour les animations

L'utilisateur voulait de vraies animations fluides (pas un enchaînement
de poses statiques comme l'œuf). Avant d'écrire quoi que ce soit dans la
feuille de route, vérifié que ça ne reproduirait pas le crash
`expo-notifications` du 03/09 (module retiré d'Expo Go, plante à
l'import) :

1. **`lottie-react-native` est bien embarqué dans Expo Go 57.0.9**
   (`bundledNativeModules.json` du paquet `expo@57.0.9` : version
   `~7.3.8`) — contrairement à `expo-notifications`, retiré.
2. Le composant natif est enregistré via `codegenNativeComponent`, un
   mécanisme **paresseux** (résolu au rendu, pas à l'import) — différent
   du `requireNativeModule` synchrone qui avait fait planter les
   notifications. Import sûr même si le module natif était absent.
3. **Testé pour de vrai** : un écran temporaire important et **rendant**
   réellement un `LottieView` (avec un JSON minimal valide), bundlé sur
   Android ET iOS via `expo export`. Les deux passent. Le fichier de
   test a été retiré après coup — seul l'ajout de la dépendance
   `lottie-react-native: 7.3.8` (épinglée, même version qu'Expo Go)
   reste dans `package.json`.

### Structure attendue

```
mobile/assets/creatures/<id-creature>/
  stage-0.png / stage-1.png / stage-2.png   (3 illustrations, 1024x1024 min)
  logo.png                                    (icône, 512x512 min)
  anim-idle.json / anim-reaction.json         (Lottie, stade final uniquement)
```

Les 26 dossiers vides (un par créature, nommés par leur `id` exact) sont
déjà créés dans le repo, avec un `.gitkeep` pour être trackés par git
avant que les fichiers n'arrivent.

### Reste à faire côté code (pas encore commencé)

Aucun composant ne charge ces assets pour l'instant — seule
l'infrastructure (dépendance + dossiers + doc) est en place. Quand les
premiers fichiers arriveront : brancher `LottieView` dans
`AdventureScreen.js` (portrait détaillé + grille de deck), avec repli sur
l'emoji existant tant qu'un dossier de créature est vide (ne jamais
`require()` un chemin qui n'existe pas encore, Metro échouerait au
bundling — prévoir une vérification d'existence ou une liste blanche mise
à jour au fur et à mesure des livraisons).

## Mode Aventure en PAYSAGE (02/09)

Tout le mode Aventure bascule en orientation paysage.

`expo-screen-orientation` était déjà installé, donc aucun rebuild natif
n'a été nécessaire. L'appli est déclarée `portrait` dans `app.json` ; le
verrouillage est posé à l'entrée d'`AdventureScreen` et **le portrait est
remis dans le nettoyage de l'effet**.

⚠️ Ce nettoyage est indispensable : sans lui, quitter l'Aventure par le
bouton retour système laisserait le clicker et tout le reste de l'appli
bloqués en paysage, sans autre issue qu'un redémarrage.

### Écran principal

- Les 3 créatures du deck sont **côte à côte**, à parts égales sur toute
  la largeur, avec nom, rareté et niveau.
- L'accès aux **Runes est passé en haut à droite** (même icône), à côté
  du compteur de Griffes.
- **L'ancienne barre du bas a disparu** : en paysage la hauteur est la
  ressource rare, on ne la dépense pas en barre de navigation. Le bouton
  Mode Combat vit maintenant sur la ligne du bas, à droite du conseil.

### Profil de créature (façon Monster Legends, SANS défilement)

**Contrainte structurante : tout tient à l'écran, aucune ScrollView.**
C'est elle qui dicte la mise en page :

- **flex pur** — les hauteurs se partagent l'espace disponible, jamais de
  valeur fixe qui déborderait sur un écran plus court ;
- **textes bornés** par `numberOfLines` — la description se tronque à 3
  lignes au lieu de pousser le reste hors de l'écran, et les noms/stats
  sont tous en une ligne ;
- **2 attaques affichées** sur les listes potentiellement plus longues.

Répartition, calquée sur la référence :

- **Gauche (44%)** : portrait qui occupe tout l'espace restant, puis nom,
  étoiles de palier + niveau, barre de progression vers le prochain
  palier d'évolution, bouton principal (monter de niveau) et bouton
  Évoluer.
- **Droite (56%)** : stats et runes côte à côte sur une rangée, attribut
  et attaques sur la suivante, description en bas.

Les Griffes restent dans le bandeau du haut.

Une première version utilisait deux `ScrollView` indépendantes ; elle a
été remplacée parce que la demande était explicitement de ne rien avoir à
faire défiler.

25 styles portrait devenus morts ont été supprimés.

### Un seul écran responsable de l'orientation d'un mode

`CombatScreen` avait son propre verrouillage paysage, hérité de l'époque
où le combat était le seul écran en paysage. Son nettoyage forçait le
PORTRAIT au démontage : **à la fin d'un combat on revenait à la carte des
chapitres en portrait**, alors que tout le mode Aventure doit rester en
paysage. L'effet d'`AdventureScreen` ne se rejoue pas (dépendances
vides), donc rien ne rétablissait le paysage.

Le verrou a été retiré de `CombatScreen`, qui n'est rendu que depuis
`AdventureScreen`. `BilliardScreen` garde le sien : c'est un jeu
indépendant, lancé depuis le menu.

**Règle** : un seul écran gère l'orientation d'un mode — celui qui
l'ouvre et le ferme. Deux verrous concurrents produisent un conflit
invisible à la compilation, qui ne se voit qu'en jouant.

### Piège : supprimer des styles morts par regex DOTALL

Le nettoyage des 25 styles portrait devenus inutiles a été fait avec une
expression régulière en mode `DOTALL` (`.` capture les retours à la
ligne). Elle a mangé, en plus du style visé, le bloc de constantes
voisin — `LEVEL_NODE_SIZE`, `ROW_HEIGHT`, `WAVE_AMPLITUDE`. L'écran
Combat plantait au démarrage sur « Property 'ROW_HEIGHT' doesn't exist ».

La compilation ne détecte pas ça : une constante manquante est une
`ReferenceError` à l'exécution, pas une erreur de syntaxe.

**Vérification à faire après toute suppression en masse** : comparer la
liste des déclarations de premier niveau (`const`, `function`, exports)
avant et après, et croiser les identifiants en MAJUSCULES utilisés dans
le CODE (commentaires retirés) avec ceux réellement déclarés ou importés.
C'est ce contrôle qui a confirmé qu'il ne manquait rien d'autre dans les
deux écrans.

**Et ne jamais utiliser `DOTALL` pour supprimer un bloc délimité par des
accolades** : le `.*?` traverse les frontières et emporte le voisin. La
bonne méthode, appliquée depuis : parcourir les lignes en **comptant les
accolades**, ce qui ne peut pas dépasser le bloc courant — puis comparer
la liste des déclarations avant/après pour le confirmer.

### Reste à adapter

`ChapterMapScreen`, `RunesScreen`, `RuneFusionScreen` et les overlays
gardent l'en-tête portrait. Ils restent fonctionnels en paysage (la carte
des chapitres positionne ses nœuds en fraction de largeur, elle s'étire
sans casser) mais leur mise en page n'exploite pas la largeur
disponible — à retravailler.

## Défis de l'œuf — séquence de démarrage scriptée (02/09)

Les **10 premiers cycles** ne sont PAS tirés au hasard : ils suivent une
progression écrite à la main (`QUEST_SEQUENCE`, 41 défis), validée avec
l'utilisateur avant implémentation. Elle enseigne les mécaniques dans
l'ordre : tap → Pacte → Transe → cible dorée → critiques → Offrande →
Aventure → auto-clics → pouvoirs → Sanctuaire → Veilleur → Ascension →
runes → évolution → 2e Ascension.

Les cibles y sont **écrites en dur**, contrairement au pool dynamique :
en début de partie le revenu est trop faible et trop instable pour
qu'une cible en « minutes de farm » ait du sens, et on veut que tous les
joueurs vivent exactement la même montée. `nextQuestSet(index, …)`
bascule automatiquement sur le pool dynamique une fois la séquence
épuisée — les deux systèmes coexistent et se lisent pareil côté écran
grâce à `findQuest()`.

- **Nombre de défis par cycle VARIABLE** (4 ou 5, le cycle 3 en a 5).
  L'œuf éclot quand tous ceux du cycle courant sont validés, plus à un
  compte fixe — `QUEST_SET_SIZE` ne vaut plus que pour le pool.
- `sequenceIndex` est persisté et **n'est pas remis à zéro par une
  Ascension** : la séquence est un fil de découverte, on ne rejoue pas
  le tutoriel à chaque prestige.
- **Un défi scripté n'est jamais remplacé** au chargement, même si sa
  précondition semble non remplie : y substituer un défi aléatoire
  casserait l'ordre voulu. Seuls les défis du pool dynamique sont
  revalidés.
- **L'Ascension ne re-tire pas pendant la séquence** : le cycle 5
  contient justement « fais l'Ascension », et re-tirer l'annulerait au
  moment exact où le joueur vient de le réussir.

### 6 métriques construites pour cette séquence

| Métrique | Source |
|---|---|
| `maxTranseHoldSec` | tracker de DURÉE dans `handleTap` — un défi « reste en Transe x2,5 pendant 30 s » ne peut pas se contenter du pic atteint |
| `offering` | `trackEvent('offering')` dans `doOffrande` |
| `powerActivated` | `trackEvent('powerActivated')` dans `claimPower` |
| `ascension` | `trackEvent('ascension')` dans `doAscension` |
| `advLevelReached` | **`trackMax`** (nouveau) publié par `AdventureScreen` |
| `maxEvolutionTier` | dérivé de `owned[].evolutionTier` |

**`trackMax` vs `trackEvent`** : un niveau atteint est un MAXIMUM, pas un
cumul. Rejouer un niveau déjà battu ne doit pas faire progresser un défi
de progression. C'est aussi le seul chemin propre pour qu'un défi du
clicker lise la progression d'Aventure : celle-ci vit dans une sauvegarde
séparée, et l'écrire depuis un autre écran a déjà causé une perte de
progression. **L'Aventure publie, le clicker lit.**

Un niveau d'Aventure s'exprime en niveau GLOBAL (10 par chapitre) :
chapitre 2 niveau 5 = niveau 15.

### Un baseline PAR DÉFI, pas par cycle (bug signalé)

**Bug réel** : les 4 défis d'un cycle partageaient un seul instantané de
départ, pris au tirage. Tout ce que le joueur accumulait en travaillant
le défi 1 comptait donc déjà pour le défi 3 : « obtiens 20 coups
critiques » arrivait à moitié fait, parfois déjà validé. Idem pour la
cible dorée.

`questBaselines` (objet `questId -> instantané`) remplace l'instantané
unique. Le chronomètre d'un défi démarre **au moment exact où il devient
le défi courant**, via un `useEffect` sur `currentChallengeId`. Le
`questBaseline` global reste comme repli pour les sauvegardes antérieures
(`baselineFor(id)`).

**Les métriques de type RECORD demandent en plus une remise à zéro.** Un
baseline ne suffit pas pour `maxTranseHoldSec` et `maxCombo` : un record
de 45 s obtenu avant le défi le validerait d'emblée, et un record de 12 s
ferait afficher une avance que le joueur n'a pas prise pendant ce défi.
Ces deux compteurs sont donc remis à zéro quand leur défi démarre.

`buildQuestStatsSnapshot()` est défini **une seule fois** et sert au
démarrage d'un défi comme au tirage d'un cycle : deux versions
divergentes laisseraient des métriques absentes d'un côté, et un
compteur absent du baseline repart de zéro donc se valide instantanément.

### Décompte de la Transe en temps réel (bug signalé)

La tenue était mesurée uniquement au moment d'un tap. Le compteur
n'avançait donc que par à-coups et, dès que le joueur s'arrêtait, il
restait figé sur sa dernière valeur au lieu de retomber — le défi « tiens
30 secondes » était illisible.

Un `setInterval` de 250 ms fait maintenant deux choses : avancer le
compteur entre les taps, et couper la série dès que la fenêtre de Transe
expire. On conserve le MEILLEUR temps tenu, pas la série en cours :
sinon la barre retomberait à zéro à chaque pause et n'atteindrait la
cible que sur une seule série parfaite, sans jamais montrer de progrès.
La métrique exposée aux défis est arrondie à la seconde entière.

### Une seule fonction de sauvegarde (`buildSaveData`)

**Bug signalé** : le défi « reste en Transe x2,5 pendant 30 secondes »,
une fois validé, redevenait le défi courant après avoir quitté puis
rouvert l'écran.

Cause : il existait **deux objets de sauvegarde distincts** — un pour
l'écriture anti-rebond, un pour la sortie d'écran — à tenir synchronisés
à la main. `maxTranseHoldSec` n'avait été ajouté qu'au premier. En
quittant l'écran, le second écrasait la sauvegarde avec un objet où le
champ manquait ; au retour, le record repassait à 0 et le défi pourtant
réussi redevenait le défi courant.

Les deux appels passent désormais par **`buildSaveData()`**, seule source
de vérité, construite uniquement à partir des refs (donc toujours à jour
quel que soit le moment de l'appel). Toute nouvelle donnée persistée
s'ajoute à un seul endroit.

**Vérification à refaire après tout ajout de champ** : croiser les
`saved.X` lus au chargement avec les clés écrites par `buildSaveData`.
Seuls `familiarLevel` et `purchasedUpgradeIds` doivent apparaître comme
lus-non-écrits — ce sont des champs de migration d'anciens formats.

### Deux corrections liées

- **Le blocage des défis de crit était trop strict.** Signalé par
  l'utilisateur : la Faveur des Esprits ne coûte que 25 pièces au premier
  niveau, soit moins de 5 minutes de tap pour un joueur nu. Le défi est
  donc atteignable dès le départ — il demande juste d'acheter la Faveur
  d'abord. La condition porte désormais sur la capacité à se la payer,
  plus sur le fait de la posséder déjà.
- **La créature capturée est auto-équipée** dans le premier emplacement
  de deck libre. Sans ça, un joueur qui vient de capturer sa première
  créature a une collection mais un deck vide, et l'Aventure refuse de
  démarrer — rendant « termine le chapitre 1 » (cycle 2) infaisable sans
  que rien ne l'explique. Un emplacement déjà occupé n'est jamais
  remplacé : le choix du joueur reste prioritaire. À revoir quand le
  tutoriel existera.

## Ascension non destructive (fait)

L'Ascension ne remet plus à zéro que l'**économie du clicker** : pièces,
Pacte, Faveur, Sanctuaire, Veilleur, auto-clics, améliorations.

**Conservés** : les créatures possédées, le deck, et toute la
progression d'Aventure (niveaux, Griffes, runes). Perdre ses monstres et
sa campagne rendait le prestige punitif au lieu d'être une récompense.
Et la progression d'Aventure vit dans une autre sauvegarde : la remettre
à zéro depuis le clicker aurait été l'écriture croisée qu'on s'interdit.

**Les défis d'œuf continuent à la suite** — ni le cycle en cours ni la
séquence ne sont retirés. Le joueur gardant ses créatures, plus aucun
défi ne devient infaisable, ce qui était la seule raison de re-tirer
auparavant. Les premiers défis sont simplement plus durs à relever avec
une économie repartie de zéro : c'est l'effet voulu.

### Les deux récompenses

**Vitesse : +30% par Ascension, multiplicatif** (`ascensionSpeedMultiplier`
= 1,3^n), appliqué avec les autres multiplicateurs globaux dans
`gainCoins` et `passiveIncome`. C'est ce qui rend le run suivant
nettement plus rapide alors que l'économie repart de zéro. Le compteur
d'Ascensions vient de `DailyContext` (compteur à vie), donc il survit à
tout ce que l'Ascension réinitialise.

**Griffes**, créditées via `PENDING_GRIFFES_KEY` — le clicker n'écrit
jamais dans la sauvegarde d'Aventure, c'est `AdventureScreen` qui
encaisse à sa prochaine ouverture.

### Calibrage du gain de Griffes

Gain en **racine carrée** : rapide au début, de plus en plus lent.
`ASCENSION_GRIFFES_BASE = 60`.

| Ascension | Griffes | Cumul | Équivaut à |
|---|---|---|---|
| 1 | 60 | 60 | 1,5 évolution palier 1 |
| 3 | 104 | 249 | 2,5 runes |
| 5 | 134 | 503 | 5 runes |
| 10 | 190 | 1 349 | 13,5 runes |

**Ne PAS calibrer sur « une créature menée au palier maximum ».** C'était
le premier repère utilisé (base 150) et il est mauvais pour deux
raisons : des paliers d'évolution supplémentaires sont prévus, donc ce
plafond va bouger ; et s'y caler revenait à garantir au joueur de tout
débloquer en N Ascensions, ce qui vide les Griffes de leur valeur.

Le bon repère est le **combat** : ~410 Griffes pour les 20 premiers
niveaux d'Aventure. L'Ascension est un COMPLÉMENT à ce revenu, pas sa
source principale — elle donne l'équivalent de quelques victoires, de
quoi débloquer une évolution en attente, pas de quoi s'acheter la
collection. Les tests vérifient ce rapport plutôt qu'un nombre de
créatures évoluées.

## Outil de dev : valider le défi en cours

Bouton **« 🛠️ Valider ce défi (dev) »** sous la barre de défi, sur
l'écran d'accueil du clicker.

Placé là et non dans Options, contrairement aux autres outils de dev :
ceux-ci posent un drapeau lu au prochain chargement de l'écran concerné,
ce qui obligerait à quitter et rouvrir l'Élevage à chaque défi validé —
inutilisable pour parcourir une séquence de 10 cycles.

**Il ne triche pas sur les stats.** Le défi est ajouté à une liste
`devCompletedIds` plutôt que d'offrir au joueur des coups critiques ou
des pièces qu'il n'a pas gagnés : sinon l'outil de test fausserait
l'équilibrage qu'on mesure juste après.

`isQuestDone(id)` est le point de vérité unique de « ce défi est-il
terminé » — compteur du cycle, défi courant et éclosion passent tous par
lui. Sans ça, un défi validé en dev aurait été terminé pour l'affichage
mais pas pour l'œuf, qui n'aurait jamais éclos.

La liste est persistée et **remise à zéro à chaque nouveau cycle**.

## Amélioration des créatures — 100% en Griffes (fait)

Les créatures ne se montent **plus du tout avec les pièces du clicker**.
Leur seule monnaie d'amélioration est la **Griffe**, gagnée au combat en
Aventure. Les deux économies sont franchement séparées : les pièces font
tourner le clicker, les Griffes font progresser les créatures.

### Déplacement du nourrissage

Le bouton « Nourrir » du clicker (payé en pièces) est **supprimé**. La
montée de niveau vit maintenant dans **Aventure → fiche de créature →
carte « Niveau »** (`LevelUpCard`), juste au-dessus de la carte
Évolution.

Pourquoi là plutôt que de faire descendre les Griffes vers le clicker :
garder une monnaie dans un seul écran évite qu'elle soit débitée à deux
endroits qui ne se voient pas. Même schéma que l'évolution — Aventure
vérifie et débite le coût, puis le clicker persiste le nouveau niveau via
`onLevelUpCreature`, la collection lui appartenant.

La fiche de créature du clicker n'affiche plus de bouton mais **indique
le chemin** et le coût du prochain niveau, plutôt que de laisser un vide.

### Barème (calibré sur le revenu de combat)

`levelUpCost` = `0,5 × niveau^1,2 × facteur de rareté`, en Griffes.
L'ancienne formule en pièces (`8 × niveau^1,35`) aurait donné ~820
Griffes pour amener une commune au niveau 25, soit le double du revenu de
combat disponible à ce stade.

Paliers d'évolution **relevés de 40/100 à 150/400** : depuis que les
niveaux se paient aussi en Griffes, un palier doit rester un vrai jalon
face au coût cumulé des niveaux qui y mènent, sinon il tombe tout seul en
chemin.

| Rareté | Niveau 25 | + palier 1 | Niveau 50 | + palier 2 |
|---|---|---|---|---|
| Commun | 259 | 409 | 1 215 | 1 615 |
| Rare | 414 | 564 | 1 943 | 2 343 |
| Épique | 673 | 823 | 3 160 | 3 560 |
| Mythique | 1 734 | 1 884 | 8 144 | 8 544 |

Repères : le combat rapporte ~410 Griffes sur 20 niveaux, ~840 sur 30,
~2 150 sur 50. Une créature commune menée au palier 1 coûte donc à peu
près 30 niveaux d'Aventure ; le palier 2 est franchement plus loin.

`RARITY_COST_FACTOR` est désormais **exporté et partagé** — c'est le
mappage qui avait été oublié lors du passage à 6 raretés, rendant le coût
NaN pour « peu_commun » et « mythique ». Toujours passer par lui.

### Où se trouve l'amélioration des créatures

Question posée pendant cette MAJ : il n'existe pas de bouton dédié, le
chemin est **Aventure → taper une créature du deck → carte « Évolution »**
(`CreatureDetailScreen` / `EvolutionCard` dans `AdventureScreen.js`).

Le bouton n'apparaît que si la créature atteint le niveau requis
(`EVOLUTION_LEVEL_REQUIREMENT = [0, 25, 50]`) : sous le niveau 25, la
carte affiche seulement « Atteins le niveau 25 pour débloquer ce palier ».
C'est pour cela que l'amélioration semble absente en début de partie.

### Reste à faire

- Refonte de l'**amélioration des créatures** : le système actuel
  plafonne à 2 paliers par créature, donc les Griffes finissent par
  n'avoir plus d'usage. C'est ce plafond qu'il faut lever.
- Revoir **coûts et gains de chaque amélioration** du clicker (gelés
  jusque-là, à la demande de l'utilisateur).

## Défis de l'œuf — cibles dynamiques en « temps de farm » (02/09)

**70 défis.** Un défi ne stocke plus une cible chiffrée mais un **temps
de jeu** (`effortMin`). La cible réelle est calculée **au tirage** à
partir du revenu du joueur, puis **figée** dans la sauvegarde.

### Pourquoi (deux tentatives avant celle-ci)

1. Cibles en dur : « aie 30M de pièces » est un mur infranchissable au
   début et un défi déjà validé trois heures plus tard.
2. Découpage en 6 phases de progression : ça limitait les dégâts, mais à
   l'intérieur d'une même phase le revenu varie déjà d'un facteur 100 —
   l'approximation restait grossière. **Ce système a été supprimé**
   (`QUEST_TIER_THRESHOLDS`, `playerQuestTier` n'existent plus).
3. **Temps de farm** : un défi coûte « environ 25 minutes », ce qui reste
   honnête à toutes les échelles et rend les phases inutiles.

### Comment la cible est calculée

`questBudget(stats, minutes)` = revenu/s estimé × 60 × minutes. Ce budget
est ensuite converti selon la métrique, **en suivant les vraies fonctions
de coût du jeu** plutôt qu'en estimant :

| Métrique | Conversion |
|---|---|
| `totalEarned` | le budget directement |
| `coins` (réserve) | 60% du budget — épargner suppose de ne pas tout réinvestir |
| `passiveIncome` | revenu obtenu si le budget partait dans le meilleur générateur |
| `tapPower`, `sanctuaryLevel`, `veilleurLevel`, `critLevel` | `levelsAffordable()` additionne les coûts réels jusqu'à épuisement |
| `upgrade:<id>`, `auto:<id>`, `autoTotal` | idem, avec `upgradeItemCost` / `autoClickerCost` |
| collection, essence | pas relatif (`step`) : le temps ne s'y convertit pas en pièces |

### Points structurants

- **Figer la cible est indispensable.** Recalculée à chaque rendu, elle
  monterait avec le revenu du joueur et le défi s'éloignerait à mesure
  qu'il progresse, sans jamais se terminer. `questTargets` est persisté
  À CÔTÉ de `activeQuestIds` — les deux voyagent ensemble, sinon le
  prochain chargement résout des objectifs différents.
- **`label` est une FONCTION** de la cible, plus une chaîne figée. Un
  libellé ne peut donc plus mentir sur ce qui est demandé — le piège
  était tombé deux fois (améliorations, puis défis).
- Les défis visant une amélioration ou un générateur précis sont
  **générés depuis `UPGRADE_ITEMS` / `AUTOCLICKERS`** : ajouter une
  amélioration au jeu ajoute automatiquement son défi.
- **`available(stats)`** filtre les défis absurdes : pas de « possède 30
  Étoiles Filantes » à qui n'a pas les moyens du premier générateur, pas
  de défi de crit sans Faveur des Esprits.

### Préconditions : un défi injouable bloque l'œuf POUR TOUJOURS

**Bug réel signalé** après une réinitialisation de progression : le
premier cycle contenait « gagne 3 combats en Aventure » et « équipe une
rune » alors que le joueur n'avait aucune créature. `AdventureScreen`
désactive le bouton de combat quand le deck est vide (« Deck vide ») :
le défi était donc impossible, et l'œuf ne pouvait plus jamais éclore.

C'est la classe de bug la plus grave de ce système : un seul défi
infaisable dans un jeu de 4 gèle définitivement toute la boucle de
progression du clicker. **Tout défi qui dépend d'une mécanique
extérieure au clicker doit porter sa précondition.**

Chaîne de dépendances désormais respectée :

```
créature dans le DECK -> combats gagnés -> Griffes -> achat de rune -> équipement de rune
```

- `deckCount` (créatures réellement placées dans le deck) a été ajouté
  aux stats. C'est LUI qui décide si l'Aventure est jouable, pas
  `ownedCount` : posséder des créatures sans en placer une ne suffit pas.
- `feed*` exige de posséder une créature ; `feed15` exige le niveau 5.
- **Trois filets de sécurité**, parce qu'un seul ne couvre pas tout :
  1. au **tirage** — `available()` écarte les défis injouables ;
  2. au **chargement** — les défis sauvegardés dont la précondition
     n'est plus remplie sont remplacés un par un, les autres étant
     conservés pour ne pas effacer la progression en cours. C'est ce qui
     répare les sauvegardes déjà bloquées ;
  3. à l'**Ascension** — elle vide deck et collection, donc le cycle est
     entièrement retiré (ses cibles chiffrées, calculées sur l'ancien
     revenu, seraient de toute façon absurdes après un reset à zéro).

### Audit des défis de démarrage (suite au signalement suivant)

Un second passage, déclenché par « possède 3 créatures différentes »
proposé à un joueur qui n'en avait aucune, a fait tomber deux autres
familles de défauts. **Un défi n'est valide que si le joueur peut
l'accomplir sans passer par l'œuf que ce défi bloque.**

- 🟥 **`ownedCount` : supprimé du pool.** Les créatures s'obtiennent en
  faisant éclore l'œuf — un défi qui en réclame bloque donc ce qui les
  produit. Le gacha offrait une porte de sortie, mais un défi ne doit
  pas exiger de contourner le système qu'il gèle. `summon*` couvre déjà
  l'invocation, proprement et en mode delta.
- 🟥 **`crit*` était STRICTEMENT impossible** sans Faveur des Esprits :
  `critChance(0)` vaut exactement 0, donc aucun coup critique ne peut
  jamais tomber. Précondition `critLevel >= 1` ajoutée.
- 🟨 `summon*` exige désormais que le budget couvre le coût réel des
  invocations (`summonCost` grimpe avec la collection).
- 🟨 `golden10` exige d'avoir déjà attrapé 3 cibles : elles n'
  apparaissent qu'une fois toutes les 45-90 s, soit une bonne dizaine de
  minutes de présence continue pour dix.

**Méthode à réutiliser** : lister les défis tirables pour un profil
donné, et pour chacun se demander par quelle mécanique concrète le
joueur l'accomplit. Une cible atteignable sur le papier ne suffit pas —
il faut que le chemin existe et ne repasse pas par l'œuf.

Vérifié : 8 profils × 2 000 tirages, **aucun défi infaisable ni né déjà
validé** ; le deck vide bloque l'Aventure même quand des créatures sont
possédées mais non placées ; une sauvegarde contenant un id supprimé
(`own3`) est recomplétée à 4 défis.
- **Variété imposée au tirage** : une seule métrique par défi et au plus
  **2 défis par famille** (economy / core / action / collection /
  upgrade / autoclicker / adventure). Sans ça le tirage sortait quatre
  « monte telle amélioration » d'affilée.
- **La barre des défis 'absolute' se mesure depuis le tirage.** Un défi
  « possède 58 Colosses » proposé à qui en a 50 s'afficherait sinon à
  86% dès la première seconde. `questComplete` reste inchangée : elle
  vaut 1 exactement quand la cible absolue est atteinte.

### Bugs trouvés par les tests pendant cette refonte

- **Défi `delta` validé au tirage** : le plancher « cible > état actuel »
  était appliqué à `totalEarned`, un cumul de toute la partie. Résultat :
  « gagne 162 001 pièces » à un joueur qui en avait gagné 162 000. Le
  plancher ne vaut désormais que pour le mode `absolute`.
- **`autoTotal` non géré** dans le résolveur : il tombait dans le repli
  générique et donnait « possède 1 auto-clics en tout ».
- **Ordre de déclaration** : le bloc qui génère les défis par générateur
  lit `AUTOCLICKERS`, déclaré plus bas dans le fichier. Il vit donc en
  FIN de fichier — le remonter provoque un « Cannot access
  'AUTOCLICKERS' before initialization » à l'import. Un commentaire le
  signale sur place.
- Pluriel français : « Colonie de Familiers » → « Colonies de
  Familiers », pas « Colonies **des** Familiers » (seul le groupe avant
  la préposition s'accorde).

### Durées mesurées (simulation)

Cycle complet de 4 défis : **1,3 h** quand tiré à 4 h de jeu, **2 h**
pour le suivant, **20 h** quand tiré à 1 jour de jeu.

⚠️ La simulation n'achète que ce qui augmente le revenu, ne joue pas à
l'Aventure et ne nourrit pas ses créatures — elle bloque donc
artificiellement sur les défis de combat, de collection et de chance
critique. Ce ne sont pas des blocages réels, mais **ne jamais conclure
d'un blocage en simulation sans vérifier ce que l'IA de test sait
faire**.

## Durcissement du début de partie (02/09, seconde passe)

Constat mesuré avant de toucher quoi que ce soit : **les créatures 1 et
2 tombaient au même moment** (16 min), parce que « 10 Esprits Frappeurs »
coûtait 499 pièces quand le cycle 1 en demandait 16 762. Les 3 premières
créatures s'obtenaient en 1 h 20.

### Ce qui a changé

| Élément | Avant | Après |
|---|---|---|
| Pacte : gain | +1 dégât/niveau | **+0,5** |
| Pacte : coût | ×1,55 | **×2** |
| Faveur des Esprits | chance 2,5%/nv **+ dégâts** | **chance 1,25%/nv seulement**, coût 25 → 120 |
| Dégâts critiques | inclus dans la Faveur | **amélioration séparée** (x2 de base, +0,5/nv) |
| Veilleur | +15%/nv, ×1,6 | **+5%/nv, ×2** |
| Sanctuaire | +2,5%/nv | inchangé |
| Auto-clics | — | **coûts ×33, revenus ×4** |
| Esprit Frappeur | 15 | **500** |

### `tapPower` : niveau ≠ dégâts

Piège introduit ici : `tapPower` est le **NIVEAU** du Pacte (entier, lu
par les défis « Pacte niveau 10 »), tandis que les pièces par appui
valent `tapDamage(niveau)` = `1 + (niveau-1) × 0,5`. Utiliser `tapPower`
directement comme dégâts rend chaque niveau deux fois trop puissant.

### Auto-clics : le couple prix/revenu vient d'une simulation

Cible fixée : **50 pièces/s de revenu PASSIF au bout d'1 heure**. Ni les
prix seuls ni les revenus seuls ne la tiennent — c'est leur rapport qui
compte, et il a fallu balayer les deux :

- prix ×33 seuls → 10/s à 1 h (courbe écrasée)
- revenus ×15 → 342/s à 1 h (explosion)
- **prix ×33 + revenus ×4 → 50/s pile**

Courbe obtenue (joueur tapant 5 fois/s) :

| Temps | Passif/s | Total/s | Cumul |
|---|---|---|---|
| 10 min | 3 | 34 | 15 k |
| 30 min | 16 | 68 | 72 k |
| **1 h** | **50** | 122 | 244 k |
| 2 h | 154 | 257 | 830 k |
| 4 h | 857 | 1 057 | 5,2 M |

L'Ascension (100 M cumulés) demande **plus de 5 h**, ce qui respecte le
« minimum 3-4 h » visé.

### Déverrouillage en chaîne des 4 mécaniques historiques

Le Pacte est seul disponible au départ ; chaque mécanique s'ouvre en
achetant la précédente (`CORE_UNLOCKS`) :

```
Pacte nv 5   -> Faveur des Esprits
Faveur nv 1  -> Dégâts critiques
Dégâts nv 1  -> Sanctuaire
Sanctuaire 1 -> Veilleur
Pacte nv 10  -> 1er palier de Puissance de tap
```

Les seuils sont exprimés en **niveau affiché**, comme les défis (« Monte
Pacte au niveau 10 »). Le Pacte démarrant au niveau 1, « nv 5 » veut dire
quatre achats — mélanger niveaux et nombre d'achats dans les conditions
est la meilleure façon d'obtenir un décalage de 1 invisible à la lecture.

Une mécanique verrouillée reste **affichée mais grisée avec sa
condition** : la boutique ne grandit pas par surprise, le joueur voit dès
le départ le chemin complet. La vérification est refaite **dans chaque
handler d'achat**, pas seulement à l'affichage.

**Le pool dynamique ne propose plus un défi visant une mécanique
verrouillée** (`sanctMid`, `sanctLong`, `veilleurMid`, `faveurMid`,
`crit*`) : le défi serait techniquement réalisable — il suffit de
remonter la chaîne — mais illisible pour un joueur qui ne voit même pas
le bouton. Vérifié : 4 000 tirages pour un débutant, zéro défi verrouillé.

La séquence scriptée reste cohérente sans changement : le cycle 1 monte
le Pacte au niveau 10, ce qui ouvre la Faveur (nv 5) et les paliers de
tap (nv 10) avant que le cycle 2 ne réclame des coups critiques.

### Sanctuaire et Veilleur : plafonnés à 10 niveaux

Ce sont les **deux seules améliorations bornées** du jeu. Elles
multiplient respectivement toute la production et tous les gains
hors-ligne : sans plafond, elles devenaient un passage obligé qui
écrasait tous les autres achats.

⚠️ **Ce plafond a rendu deux défis scriptés littéralement impossibles**
(« Sanctuaire niveau 15 », « Veilleur niveau 20 »), ce qui aurait bloqué
l'œuf pour toujours. Ils ont été remplacés par des défis de paliers de
tap. Les cibles DYNAMIQUES sont également bornées dans
`resolveQuestTarget`, y compris après le plancher relatif de 15% qui
pouvait repasser au-dessus du plafond, et `sanctMid`/`sanctLong`/
`veilleurMid` ne sont plus proposés une fois le maximum atteint.

**Règle qui en découle** : plafonner une amélioration oblige à vérifier
tous les défis qui la visent, scriptés ET dynamiques.

### 10 paliers de tap (`TAP_UPGRADES`)

Chaque palier se monte **sans plafond**, comme le reste du clicker :
`bonus` est le gain par tap ET PAR NIVEAU, `cost` le prix du 1er niveau,
`growth` le facteur par niveau suivant.

Déverrouillage **en chaîne** : le 1er palier s'ouvre au niveau 10 de
Pacte, et chaque palier suivant **au niveau 5 du palier précédent**. On
monte donc Poigne Ancienne jusqu'à 5 pour voir apparaître Griffe
Runique, et ainsi de suite.

Chaîner sur le niveau du palier précédent — plutôt que sur un compteur
global — garde la progression lisible : le joueur sait toujours
exactement quoi monter pour ouvrir la suite. Une version antérieure
comptait les paliers achetés, ce qui rendait les paliers 4 à 10
**mathématiquement inatteignables** (le palier 4 exigeait 15 achats pour
10 paliers existants).

Un palier verrouillé reste **affiché mais grisé, avec sa condition**.
La vérification est refaite **dans l'achat**, pas seulement à
l'affichage : un bouton grisé reste sinon cliquable.

`normalizeTapUpgrades` relit l'ancien format (tableau d'ids achetés une
fois) comme « niveau 1 chacun », sinon une sauvegarde d'avant le passage
aux niveaux perdrait silencieusement ses paliers.

### Piège : une prop manquante casse tout l'écran

Bug rencontré juste après cette MAJ — écran Shop blanc, « Cannot read
property 'includes' of undefined ». Les 4 nouvelles props
(`onBuyCritDamage`, `onBuyTapUpgrade`, `critDamageLevel`, `tapUpgrades`)
n'étaient **jamais passées** à `ShopView` : l'édition automatique visait
`onBuyCrit={buyCritLevel}` alors que le handler s'appelle
`buyCritUpgrade`, et le remplacement a échoué **silencieusement**.

Deux protections ajoutées :
- **Valeurs par défaut** sur la signature de `ShopView`
  (`tapUpgrades = []`, `autoClickers = {}`…) : une prop oubliée dégrade
  l'affichage au lieu de faire tomber l'écran entier.
- **Vérification à faire après tout ajout de prop** : croiser les props
  déclarées par un composant avec celles réellement passées à son rendu.
  C'est ce contrôle qui a confirmé qu'aucun autre composant des deux
  écrans n'était touché.

### Piège : un compteur normalisé qui affiche un nombre faux

Sur un défi « aie 100 000 pièces en réserve », un joueur ayant 46 700
pièces lisait **« 28,0K/100,0K »**. La progression des défis `absolute`
était normalisée depuis l'état au tirage — utile pour qu'un défi
« possède 58 Colosses » proposé à qui en a 50 ne s'affiche pas à 86%
d'emblée, mais le compteur affichait alors une valeur qui ne
correspondait à rien.

Le mode `absolute` affiche désormais **la valeur réelle** :
`progression = valeur / cible`. Une barre qui démarre haut est un moindre
mal face à un compteur qui ment — sur un défi de réserve, le joueur
compare directement au chiffre de sa barre du haut.

### Piège : deux améliorations au nom presque identique

« Griffe Runique » (palier de tap) et « Griffe de Braisillon »
(amélioration de créature) vivaient dans deux sections différentes de la
boutique. Le défi « Monte Griffe de Braisillon au niveau 5 » a été lu
comme visant l'autre, et jugé impossible. Le palier de tap est renommé
**Gantelet Runique**. Un test vérifie qu'aucun nom n'est en double entre
les deux familles.

### Seuil d'Ascension progressif

100M était hors de portée d'un premier run (mesuré à plus de 5h), donc le
défi « Fais l'Ascension » du cycle 5 bloquait la séquence. Le seuil
**double à chaque Ascension** : 5M, 10M, 20M, 40M…
(`ascensionThreshold(n)`). `ascensionEssenceGain` prend maintenant le
compteur d'Ascensions en second argument — sans lui, la 2e serait
proposée dès le seuil de la 1re.

### Piège : les compteurs À VIE survivaient à la réinitialisation

**Bug signalé** : le défi « Termine le chapitre 1, niveau 3 »
n'apparaissait jamais, même après avoir réinitialisé Élevage plusieurs
fois de suite.

Cause : « Réinitialiser Élevage » n'effaçait que `CLICKER_STORAGE_KEY`.
Or les compteurs À VIE (`advLevelReached`, `offering`,
`powerActivated`, `ascension`, `battleWon`, `runeBought`…) vivent dans la
sauvegarde de **DailyContext**. Un joueur ayant battu une fois le niveau
3 gardait donc `advLevelReached >= 3` pour toujours : le défi, en mode
`absolute`, était validé d'office et **sauté à chaque partie neuve**.

`resetLifetimeStats()` est exposé par DailyContext et appelé par la
réinitialisation d'Élevage. Passer par le Context plutôt qu'écrire dans
le stockage depuis Options suit la règle habituelle : l'écran
propriétaire d'une donnée est le seul à l'écrire.

**Règle à retenir** : une donnée persistée AILLEURS que dans la
sauvegarde d'un jeu ne sera pas effacée par la réinitialisation de ce
jeu. Tout compteur ajouté à `lifetimeStats` et lu par un défi doit être
inclus dans cette remise à zéro, sinon le défi correspondant devient
invisible pour toujours.

Les défis en mode `delta` n'étaient pas touchés : ils repartent de leur
baseline, pris au tirage.

### Rythme de clic : l'outil de test change tout

Les mesures d'équilibrage supposent un joueur tapant **5 à 7 fois par
seconde**. Un auto-clicker réglé à 5 ms (200 clics/s) compresse la
courbe d'un facteur ~30 et rend toute conclusion sur la difficulté
inexploitable.

| Clics/s | Intervalle | Créature 1 | Créature 3 | Ascension 5M |
|---|---|---|---|---|
| 3 | 333 ms | 44 min | > 4 h | > 4 h |
| 5 | 200 ms | 28 min | 3,6 h | > 4 h |
| **6,7** | **150 ms** | **21 min** | **2,8 h** | **3,6 h** |
| 10 | 100 ms | 14 min | 2,0 h | 2,6 h |
| 200 | 5 ms | 1 min | 6 min | 9 min |

**Réglage de référence : 150 ms.** C'est le rythme d'un joueur motivé,
et c'est celui sur lequel les cibles sont calées.

### Recalibrage : la difficulté doit CROÎTRE palier après palier

Griffe Runique passe de +5 à **+2,5** et de 11 000 à **16 500**.
Automate Runique passe de 32/s à **16/s** et de 36 670 à **76 030**.
Les paliers suivants suivent la même logique, avec un durcissement
d'autant plus fort qu'on avance.

**Règle posée** : le **ratio coût/revenu** doit être strictement
croissant sur toute la chaîne. C'est lui qui porte la difficulté — chaque
palier rapporte plus, mais coûte proportionnellement encore plus. Les
coûts d'auto-clics sont donc générés par une géométrique,
`coût = revenu × 1625 × 1,71^index`, ancrée sur l'Esprit Frappeur (650
pour 0,4/s) et sur l'Automate demandé à ~76 000 pour 16/s.

Courbe après durcissement (joueur tapant 5 fois/s) : 5/s de passif à
30 min, **20/s à 1 h** (contre 50 avant), 57/s à 2 h, 240/s à 4 h.

### Piège : patcher des littéraux numériques à la regex

Trois passes successives de retouches ont produit des valeurs corrompues
comme `baseCost: 1560_000_000_000` et `baseIncome: 1.35_800_000` : un
remplacement ne visait que le préfixe du nombre et laissait une queue
orpheline derrière, qu'un `%g` en notation exponentielle avait par
ailleurs déjà cassée.

**À faire** : réécrire la ligne entière avec un entier propre plutôt que
substituer un préfixe, capturer largement (`[\d._e+]+`) pour attraper
les littéraux déjà malformés, et vérifier après coup qu'aucun
`base(Cost|Income)` ne contient `_` ni `e`. Le test le contrôle
désormais.

**Et ne pas corriger une table par patchs successifs** : les deux
tentatives de « rattraper le recul » ont chacune produit des ratios
absurdes (jusqu'à 3×10¹⁰). Reconstruire toute la table depuis une règle
explicite est plus court et vérifiable.

### Ordre de la boutique

**Offrande et Ascension sont remontées en haut** de la page
Améliorations. Ce sont les deux actions à fort impact (l'une convertit la
monnaie de l'appli, l'autre relance toute la partie) ; enfouies en bas de
liste sous une vingtaine de boutons, elles passaient inaperçues.

### Défis ajustés

Défi 1 : 10 000 → **5 000 pièces**. Défi 2 : Pacte 15 → **Pacte 10**.
Défi 7 : chapitre 1 niveau 1 → **niveau 3**.

### Prochaine MAJ

Augmenter la difficulté des combats en mode Aventure.

## Équilibrage de l'économie du clicker (refonte 02/09)

Refonte complète des gains et des coûts, faite **à la simulation** et non
à l'intuition. Un script jetable rejouait la partie seconde par seconde
(4 taps/s, 50% du temps actif, achat du meilleur ratio revenu/coût
disponible à chaque instant) sur des horizons de 30 min à 30 jours.

**Diagnostic mesuré avant la refonte** : les 15 auto-clics étaient tous
débloqués en 6 heures, le revenu atteignait 3,4M/s au bout d'une heure,
et entre le 1er et le 7e jour il ne progressait plus que d'un facteur
1,6 — le jeu était plié en une journée puis totalement plat.

**Ce qui a changé** (chaque valeur choisie après balayage de variantes) :

| Levier | Avant | Après | Pourquoi |
|---|---|---|---|
| `AUTOCLICKER_COST_GROWTH` | ×1,15 | **×1,25** | Levier le plus puissant du jeu : il porte la seule source de revenu passif. |
| `sanctuaryMultiplier` | +5%/nv | **+2,5%/nv** | Multiplie tap ET passif, donc compose avec tout le reste. |
| `sanctuaryUpgradeCost` | ×1,7 | **×2,0** | Idem. |
| Coût de base des 20 améliorations | — | **×8** | Elles arrivaient bien trop tôt dans la courbe. |
| `growth` des améliorations | 1,6 uniforme | **1,86 à 2,28, par type d'effet** | Un % sur toute la production doit coûter plus cher qu'un +N par tap. |
| Effet des améliorations | — | **÷2** (sauf crit) | Compensation de la suppression du cap. |
| Seuil d'Ascension | 50 000 | **100 000 000** | L'ancien tombait en quelques minutes. |
| Gain d'essence | √(lifetime/10k) | **(lifetime/seuil)^0,3** | Rendait des milliers de points dès le 1er run. |
| Bonus par essence | +2% | **+1%** | Idem. |

**Courbe obtenue** (simulation, joueur régulier, sans ascension) :

| Temps | Revenu/s | Auto-clics | Amélioration la plus haute |
|---|---|---|---|
| 30 min | 181 | 3/15 | nv 4 |
| 1 h | 735 | 4/15 | nv 6 |
| 4 h | 92k | 6/15 | nv 15 |
| 12 h | 66M | 10/15 | nv 26 |
| 1 j | 233B | 15/15 | nv 39 |

Première Ascension possible vers **4 h**. Une ascension au bout d'un jour
rend ×2,4 de production permanente, au bout d'une semaine ×9,6.

### Suppression du plafond de niveau des améliorations

Le cap à 10 niveaux a été **retiré** (demande explicite). Ce qui rend
l'absence de cap tenable : **l'effet monte linéairement pendant que le
coût monte exponentiellement**, donc le bonus accessible croît comme le
logarithme de la fortune du joueur — même contrat que les auto-clics.

**Sauf la chance de coup critique**, bornée par nature à 100% : elle est
sommée en **série géométrique** (`CRIT_CHANCE_DECAY = 0,75`, chaque
niveau rapporte 75% du précédent) et converge vers **+36% au total, quel
que soit le niveau atteint**. Sans ça, retirer le cap rendait le critique
garanti et la Faveur des Esprits inutile.

### Pièges de cette refonte

- **Ne jamais rééquilibrer ce jeu à l'intuition** : chaque levier compose
  avec les autres (le Sanctuaire multiplie ce que les auto-clics
  produisent, que les `coinPct` remultiplient encore). Trois variantes
  jugées « évidemment suffisantes » ont été mesurées comme quasi sans
  effet avant de trouver la bonne. Rejouer une simulation avant de
  toucher une constante.
- Un effet **borné par nature** (pourcentage d'une chance, part d'un
  total) ne peut pas être empilé linéairement sans cap — il lui faut une
  asymptote, pas un plafond dur.
- Les `desc` des améliorations sont du texte figé : les **régénérer**
  depuis `effect.value` après tout changement de valeur, sinon l'écran
  annonce des chiffres faux (arrivé pendant cette refonte).

## Créatures — schéma de données actuel

26 créatures dans `CREATURES` (les 25 du plan d'origine + Solarion, qui précède ce plan et n'est jamais compté dedans) — **le plan des 25 premières créatures Gemini est TERMINÉ** (29/08-30/08, avec un décalage de comptage d'un cran corrigé en cours de route : Tartaroth avait été annoncé par erreur comme le 25e/dernier, alors qu'Arcanis — Mythique+Magie+Attaquant, exactement le dernier créneau de la liste — était le vrai 25e). Roster d'origine entièrement remplacé, puis agrandi jusqu'à 25 en suivant la répartition prévue (8 commun/6 peu commun/5 rare/3 épique/2 légendaire/1 mythique — **tous les paliers sont désormais représentés**, y compris mythique). Répartition par élément quasi exacte : 3 par élément (Feu/Eau/Air/Terre/Foudre/Magie/Ténèbres), Lumière à 4. Table de migration (`CREATURE_ID_MIGRATIONS`) à consulter pour la correspondance ancien→nouveau id des créatures d'origine remplacées. **Pour toute créature au-delà de ces 25, le processus reste identique** (voir section Workflow Gemini plus bas) : simple ajout, pas de contrainte d'ordre. Champs d'une entrée :

```js
{
  id: 'identifiant_unique',
  element: 'Feu' | 'Eau' | 'Terre' | 'Air' | 'Foudre' | 'Lumière' | 'Ténèbres' | 'Magie',
  rarity: 'commun' | 'peu_commun' | 'rare' | 'epique' | 'legendaire' | 'mythique',
  combatType: 'attaquant' | 'soutien' | 'tank',
  baseIncome: 0.15, // VESTIGE de l'ancien système de revenu passif — plus utilisé pour générer des pièces, gardé pour compatibilité de schéma
  skills: [ { id, name, damage, enduranceCost }, ... ], // exactement 4
  lore: "Histoire courte (1-3 phrases).",
  stages: [ { name, emoji }, { name, emoji }, { name, emoji } ], // 3 stades
}
```

**Important** : les 10 créatures d'origine (toutes remplacées désormais) avaient 3 **noms et dessins distincts** par stade d'évolution (ex: Braisillon → Brasegriffe → Infernouve), débloqués aux niveaux 1/5/15 (`EVOLUTION_LEVELS` dans `clickerLogic.js`, système ANCIEN, plus utilisé par aucune créature actuelle mais toujours défini dans le code). **Toutes les créatures Gemini (les 25) n'ont PAS ce système** — leurs 3 stades répètent le même nom/emoji. Leur évolution passe par un système SÉPARÉ (voir plus bas, "Évolution par palier"), qui ne change pas le nom.

### Rareté (6 paliers)
```
RARITY_WEIGHTS = { commun: 40, peu_commun: 20, rare: 15, epique: 12, legendaire: 8, mythique: 5 }
```
**Tous les paliers sont désormais actifs** (0 crash vérifié sur 300 000 tirages) — c'est la 1ère fois que les 6 sont représentés en même temps. Si un nouveau palier venait à se vider à nouveau (aucune créature dedans), remettre son poids à 0 et rééquilibrer les autres (sinon le tirage gacha peut planter sur un panier vide — un garde-fou existe dans `rollCreature()` mais mieux vaut resynchroniser les poids).

Badges de rareté (façon Monster Legends, affichés à gauche du portrait dans la fiche créature) :
```
RARITY_BADGE_LETTER = { commun: 'C', peu_commun: 'UC', rare: 'R', epique: 'E', legendaire: 'L', mythique: 'M' }
RARITY_COLOR = { commun: doré, peu_commun: bronze, rare: rouge, epique: vert, legendaire: violet, mythique: orange }
```

## Système de combat

### Stats de base par rareté (`combatLogic.js`)
```
RARITY_BASE_STATS = {
  commun:     { hp: 10,  attack: 3,   clickSpeed: 1.0, endurance: 60 },
  peu_commun: { hp: 23,  attack: 6,   clickSpeed: 1.2, endurance: 75 },
  rare:       { hp: 52,  attack: 14,  clickSpeed: 1.4, endurance: 95 },
  epique:     { hp: 119, attack: 29,  clickSpeed: 1.8, endurance: 120 },
  legendaire: { hp: 272, attack: 62,  clickSpeed: 2.2, endurance: 150 },
  mythique:   { hp: 620, attack: 132, clickSpeed: 2.8, endurance: 190 },
}
```
Cette formule ne sert plus QUE de repli pour les créatures qui n'ont pas encore de stats explicites — **depuis Pyrosile (29/08), le système préfère les stats propres à chaque créature** quand elles existent (voir section Workflow Gemini plus bas). Calibrée à l'origine pour reproduire les stats de Solarion (le 1er monstre Gemini) — toujours vraie pour lui puisqu'il n'a pas de champs `baseHp` explicites (repose encore sur cette formule).

### Stats propres à une créature (remplacent la formule par rareté)
Champs optionnels sur une entrée de `CREATURES` : `baseHp`, `baseAttack`, `baseClickSpeed`, `baseEndurance`. **S'ils existent, `combatStatsForCreature`/`combatStatsForCreatureTyped`/`opponentStatsForLevel`/`opponentStatsForLevelTyped` les utilisent directement**, SANS appliquer le multiplicateur de rôle (`MONSTER_TYPES`) par-dessus — Gemini a déjà le rôle en tête au moment de choisir ses chiffres, l'appliquer une 2e fois fausserait tout. Seule la croissance par niveau (`levelMult`/`growth`) continue de s'appliquer sur ces stats de base.

### Modificateurs par rôle de combat
```
MONSTER_TYPES = {
  attaquant: { hpMult: 0.8, attackMult: 1.3 },
  soutien:   { hpMult: 1.0, attackMult: 0.95 },
  tank:      { hpMult: 1.4, attackMult: 0.75 },
}
```
Toujours utiliser `combatStatsForCreatureTyped(creature, level, evolutionTier)` (jamais la version non-typée `combatStatsForCreature`) pour obtenir les vraies stats de combat — sinon le modificateur de rôle n'est pas appliqué (bug réel rencontré et corrigé une fois déjà).

### Le défi de tap (une attaque)
- **25 taps** (`TAP_CHALLENGE_COUNT`) en **12 secondes** (`TAP_CHALLENGE_TIME_LIMIT_SEC`) — 25 au lieu de 50 pour la phase de développement actuelle (demande explicite, à remonter si besoin une fois l'équilibrage validé).
- Vitesse d'exécution → multiplicateur de dégâts : x1 (lent) à x2,5 (rapide, ≤4s), interpolation linéaire entre les deux. Pas complété à temps → x0,5 fixe (jamais 0, l'attaque part toujours).
- **Attaque de secours gratuite** ("Attaque de base", 0 endurance, ~40% de la stat ATQ) toujours disponible même à endurance épuisée — pour joueur ET adversaire IA. Sans ça, un combat pourrait se bloquer si personne ne peut plus rien payer.

### Combat en équipe de 3 (côté joueur) vs équipe adverse de 1 à 3 (30/08)
- Les 3 créatures du **deck actuel du clicker** (même deck que les bulles de pouvoir) combattent, PAS une sélection séparée.
- **Rotation à CHAQUE attaque côté joueur** (pas seulement quand un combattant tombe K.O.) — demande explicite pour varier le combat. Rotation circulaire (`nextLivingIndex()` dans `CombatScreen.js`), saute les combattants K.O.
- **Côté adversaire, rotation UNIQUEMENT au K.O.** (pas à chaque tour comme le joueur) — mécanique volontairement différente, pas demandée pour l'adversaire, pour ne pas inventer une règle non demandée. Un adversaire qui vient de tomber ne riposte pas ce tour-ci.
- **Pile ou face au début du combat** (`opponentGoesFirst()`) : 1 chance sur 2 que l'adversaire attaque en premier, avant même le 1er choix du joueur — résolu une seule fois au montage de l'écran, réutilise le même mécanisme "transition en attente + bouton Continuer" que les tours normaux.
- Défaite quand toute l'équipe du joueur est K.O. ; victoire quand toute l'équipe adverse est K.O.
- **Dégâts d'une compétence mis à l'échelle par le ratio ATQ actuel / ATQ de base** (`scaledSkillDamage` dans `combatLogic.js`) — nourrir/faire évoluer une créature rend VRAIMENT ses attaques plus fortes (avant le 30/08, seule l'attaque de base gratuite utilisait l'ATQ, les compétences avaient des dégâts fixes indépendants du niveau). Ratio = 1 exactement au niveau 1/palier 0 → aucun changement de comportement pour une créature toute neuve.
- **Vitesse de clic** (`clickSpeed`, dépend de la rareté, jamais du niveau) réduit le NOMBRE DE TAPS requis pour le défi (`effectiveTapCount`), pas la fenêtre de temps — de 25 taps (commun) à 10 taps minimum (mythique, plancher de sécurité, jamais trivial).
- **Pas de minuteur automatique entre les tours** — un bug réel a été causé par un `setTimeout` qui pouvait se bloquer silencieusement. Remplacé par un bouton "Continuer" explicite que le joueur doit taper. Ne jamais réintroduire une transition de phase automatique par minuteur dans ce fichier sans un filet de sécurité manuel.

### Chapitres et niveaux
- 10 niveaux par chapitre (`LEVELS_PER_CHAPTER`). Adversaire choisi de façon DÉTERMINISTE — pas aléatoire, même niveau = même adversaire à chaque tentative.
- **Adversaires triés par puissance** (`CREATURES_BY_POWER` dans `combatLogic.js`, calculé une fois au chargement) : le niveau 1 tombe sur la créature la plus faible du roster (PV+ATQ de base), le niveau 26 sur la plus forte, puis ça reboucle — remplace l'ancien ordre arbitraire (ordre de définition dans `CREATURES`).
- **Taille de l'équipe adverse liée au CHAPITRE** (`opponentTeamSize`) : 1 adversaire au chapitre 1, 2 au chapitre 2, 3 à partir du chapitre 3 — mêmes repères que `LEVELS_PER_CHAPTER`, pas de seuil inventé à part.
- **Carte persistante** façon Monster Legends (PAS une tour qu'on redescend en cas de défaite, contrairement à l'idée de départ) : un niveau gagné reste acquis. Défaite = juste réessayer, sans perdre la progression déjà faite.
- Progression (`currentUnlockedLevel`) et ressource **Griffes** stockées dans une sauvegarde SÉPARÉE de celle du clicker (`adventure:state:v1`, gérée dans `AdventureScreen.js`) — pas dans la sauvegarde du clicker classique.

### Évolution par palier (créatures SANS changement de nom — Solarion et futures créatures Gemini)
```
EVOLUTION_LEVEL_REQUIREMENT = [0, 25, 50]   // niveau requis pour débloquer le palier 1, 2
EVOLUTION_STAT_MULTIPLIER   = [1.0, 1.3, 1.7] // boost PV/ATQ/Endurance (jamais la vitesse de clic)
EVOLUTION_GRIFFES_COST      = [0, 40, 100]  // coût en Griffes pour débloquer le palier
```
Pas automatique — le joueur doit avoir le niveau requis ET dépenser les Griffes (bouton dans la fiche créature, écran Aventure). `owned.evolutionTier` (0/1/2) stocké dans la collection du clicker (`ClickerScreen.js`), mais la vérification d'éligibilité + la dépense des Griffes se font côté `AdventureScreen.js` (qui possède l'état Griffes) — le clicker ne fait que persister le palier via `onEvolveCreature`.

## Workflow de création de monstres (Gemini)

L'utilisateur utilise Gemini pour générer de nouveaux monstres, qu'il colle ensuite dans la conversation. **Prompt actuel donné à Gemini** (dernière version en date, 29/08) :

```
Tu es mon créateur de créatures pour mon jeu vidéo iOS/Android.

Éléments possibles : Feu, Eau, Terre, Air, Foudre, Lumière, Ténèbres, Magie
Rareté possibles : Commun, Peu Commun, Rare, Épique, Légendaire, Mythique
Rôles possibles : Attaquant, Tank, Soutien

Quand je te donne (Rareté + Élément + Rôle), crée UN monstre avec :
- Un nom UNIQUE (jamais utilisé dans une réponse précédente)
- Une histoire courte (2-3 phrases)
- 4 attaques au nom unique, avec pour chacune : dégâts + coût en endurance
Si je te donne un nom de monstre alors garde le.

Réponds TOUJOURS dans ce format exact, sans rien ajouter autour :

NOM: [nom]
ELEMENT: [élément]
RARETE: [rareté]
ROLE: [rôle]
HISTOIRE: [2-3 phrases]
ATTAQUE1: [nom] | [dégâts] | [coût endurance]
ATTAQUE2: [nom] | [dégâts] | [coût endurance]
ATTAQUE3: [nom] | [dégâts] | [coût endurance]
ATTAQUE4: [nom] | [dégâts] | [coût endurance]
```
(L'utilisateur a aussi demandé oralement d'ajouter les stats PV/ATQ/vitesse/endurance dans le format — à vérifier dans la conversation en cours si une version plus récente du prompt existe avant d'intégrer un nouveau monstre.)

**Quand l'utilisateur colle une réponse Gemini** :
1. Vérifier qu'aucun nom (créature OU compétence) n'entre en collision avec le roster existant (`CREATURES` dans `clickerLogic.js`) — une collision est déjà arrivée une fois (Solarion vs le 3e stade de Lumeret, renommé en "Astrélios" pour la libérer).
2. Ajouter l'entrée dans `CREATURES` avec `combatType` en minuscules (`attaquant`/`soutien`/`tank`), `rarity` en minuscules sans accent (`epique`, `legendaire`), 3 stades répétant le même nom/emoji (pas de vraies évolutions pour les créatures Gemini).
3. Si Gemini fournit des stats explicites (PV/ATQ/vitesse/endurance), **les utiliser directement** plutôt que la formule par rareté — voir "Point ouvert" ci-dessous pour la validation.
4. Tester (`node -e ...` avec Babel, méthode déjà utilisée partout dans ce projet) avant de pousser : au minimum vérifier que la créature apparaît dans `CREATURES`, que ses 4 compétences ont bien `damage` + `enduranceCost`, et si c'est une rareté à poids 0 (`peu_commun`/`mythique`), remonter son poids dans `RARITY_WEIGHTS`.

## Calendrier de connexion (03/09)

Bouton 🎁 en **position absolue** dans le coin de `tapArea` — surtout pas
dans le flux, sinon il pousse tout le contenu vers le bas (deck compris).
Il ouvre un panneau centré : grille irrégulière 3 petites / 2 grandes / 2
moyennes cases, jour 7 encadré en doré.

| Jour | Récompense |
|---|---|
| 1 | 40 Griffes |
| 2 | 25 pièces d'appli |
| 3 | Créature **Rare** garantie |
| 4 | 80 Griffes |
| 5 | 50 pièces d'appli |
| 6 | 150 Griffes |
| 7 | Skin aléatoire |

Défini dans `DAILY_CALENDAR` (`dailyLogic.js`), boucle sur 7 jours via
`calendarDayForStreak`. Le streak lui-même continue de grimper.

**Les skins n'existent pas.** Le jour 7 crédite un bon
(`PENDING_SKINS_KEY`) avec une alerte qui l'explique, plutôt que de ne
rien donner en silence.

**Canaux de distribution** — même règle que `PENDING_GRIFFES_KEY` :
DailyContext ne touche jamais la sauvegarde d'un autre écran, il dépose
une intention.

- `PENDING_CREATURES_KEY` — tableau JSON de raretés, consommé par le
  clicker au chargement. Une créature déjà possédée monte d'un niveau.
- `PENDING_SKINS_KEY` — compteur de bons.
- Les **pièces d'appli** font exception : `claimStreak` reçoit `addCoins`
  en argument, car seul le Context connaît le type du jour.

⚠️ `claimStreak` est mémoïsé sur `date` seul : `streakRef` et
`streakClaimedDateRef` sont indispensables, sinon il distribue la
récompense du mauvais jour.

⚠️ `COLORS.bad` n'existe pas dans la palette — le bouton utilise
`'#d0342c'` en dur.

## Points ouverts / pas encore tranchés (mis à jour 03/09)

- **Validation des stats Gemini** : toujours pas de garde-fou automatique (±30% autour de la formule par rareté) — accepté tel quel, écarts signalés au cas par cas mais jamais bloqués.
- **Objectifs de collection** ("possède 5 créatures Épiques+" etc.) — idée gardée de côté, jamais commencée.
- **Chapitre/rune "événement" limité dans le temps** — idée gardée de côté, jamais commencée.
- **`sol.png`** (dernier fichier de décor Flappy Bird) — toujours manquant depuis le tout début.
- **Difficulté des combats en Exploration — CORRIGÉ (04/09).** Cause
  réelle confirmée par simulation (`opponentTeamForLevel` + stats
  réelles, joueur fixé à un deck témoin) : `opponentPowerBudget(niveau)`
  était appliqué **PAR adversaire**, pas pour l'équipe entière. Passer de
  1 à 2 puis 3 adversaires (chapitres 2 et 3) MULTIPLIAIT donc la
  puissance totale par la taille d'équipe, en plus de la courbe déjà
  croissante par niveau — ratio mesuré : 1,0 aux niveaux 1-10, saut à 2,3
  au niveau 15 (2e adversaire), 4,9 au 25 et 8,6 au 40 (3e).
  Deux pistes avaient été envisagées ; **mesurées avant de trancher**
  (jamais au jugé) :
  - Lisser l'arrivée du membre supplémentaire sur les 10 niveaux du
    chapitre → repousse le saut mais ne l'annule pas (le total revient au
    même une fois le chapitre traversé).
  - **Diviser le budget par la taille d'équipe courante** (retenue) →
    ratio simulé sans le fix : 0,38 → 0,83 au niveau 11, 1,40 → 2,22 au
    niveau 21. Avec le fix : 0,38 → 0,40 au niveau 11, 0,72 → 0,72 au
    niveau 21 — plus aucun saut, la courbe totale redevient celle
    calibrée à l'origine pour un seul adversaire. Plus d'adversaires reste
    une vraie difficulté tactique (plus de cibles, plus de tours, plus
    d'endurance dépensée), juste sans spike de puissance brute.
  - **Implémenté** : nouvelle fonction `opponentPowerBudgetPerMember(niveau)`
    dans `combatLogic.js` = `opponentPowerBudget(niveau) / opponentTeamSize(niveau)`,
    utilisée à la place de `opponentPowerBudget` dans
    `statsForOpponentCreature`. Aucun appelant (`CombatScreen.js`) n'a
    changé : la taille d'équipe se déduit du niveau, déjà son seul
    paramètre.
  - **Non-régression vérifiée** : puissance totale de l'équipe adverse
    testée strictement croissante sur les niveaux 1 à 150 (0 régression) —
    le bug de la commit 2e0a15e (difficulté qui pouvait reculer) ne
    revient pas avec ce changement.
  - **Reste ouvert** : la courbe de base (`opponentPowerBudget`, +6,2%/
    niveau composé) grossit toujours plus vite que la progression du
    joueur (+8%/niveau **linéaire**, `levelMultiplier`) sur le long terme
    — hors du périmètre de ce fix, qui ne traitait que le saut lié à la
    taille d'équipe. Le cercle vicieux perte→pas de Griffes→pas de niveau
    reste une hypothèse non vérifiée par simulation, à mesurer séparément
    si la difficulté reste ressentie comme trop dure après ce correctif.
- **`pointerEvents` des 4 mini-jeux** — 19 occurrences en prop, donc
  ignorées depuis le SDK 57 (voir Règles de survie).
- **Système de skins** — n'existe pas. Des bons sont déjà distribués par
  le calendrier et attendent d'être échangeables.
- **Assets des créatures** — 26 créatures × 6 fichiers commandés au frère
  de l'utilisateur (`CREATURE_ART_ROADMAP.md`, dossiers déjà créés dans
  `assets/creatures/`). `lottie-react-native` est installé et vérifié
  fonctionnel, mais aucun code ne charge encore ces assets.
- ~~Boutique pour dépenser les Griffes~~ → **FAIT** (système de Runes, voir plus bas).
- ~~"Peu commun"/"Mythique" vides~~ → **FAIT**, les 25 créatures du plan sont là, tous les paliers de rareté représentés.
- ~~Stats inter-jeux~~ → **FAIT** (`DailyContext.js`, voir plus bas).

## Grosse session du 02/09 — résumé pour reprise rapide

Tout ce qui suit a été construit dans UNE session très longue le 2 septembre 2026. Le detail complet (raisonnement, tests, bugs corrigés) est dans le transcript de cette date si besoin, mais voici l'essentiel pour repartir sans tout relire.

### Mode Combat — refonte complète
- **Plein écran, mode PAYSAGE forcé** (`expo-screen-orientation`, verrouillé à l'entrée/sortie de `CombatScreen.js`).
- **Formation façon Monster Legends** : sprites en positionnement absolu (`PLAYER_SLOTS`/`OPPONENT_SLOTS`, fractions d'écran), pas de flexbox — l'actif devant en grand, profondeur derrière.
- **Décor réel** (`mobile/assets/combat/background.jpg`) avec voile sombre par-dessus.
- **Ciblage manuel** de l'adversaire à CHAQUE tour (tap sur un sprite adverse), plus de rotation automatique.
- **Pile ou face** en tout début de combat : 1 chance sur 2 que l'adversaire attaque en premier.
- **Plus de bouton "Continuer"** après une attaque du joueur — transition immédiate et synchrone (pas de minuteur, pour ne pas réintroduire le bug de blocage déjà corrigé une fois).
- **Dégâts flottants** au-dessus de la créature touchée (composant `FloatingDamage`).
- **Récapitulatif de fin de combat** (`CombatResultScreen`) : dégâts infligés/reçus, tours joués, adversaires vaincus, répartition par créature.
- **Équipe adverse** de 1 à 3 selon le chapitre (`opponentTeamSize`), adversaires triés par puissance (`CREATURES_BY_POWER`), difficulté strictement croissante jusqu'au niveau 100+ (`opponentPowerBudget`, découplé de la créature précise piochée — sinon régression de difficulté possible après le niveau 26).
- **Dégâts d'une compétence mis à l'échelle** par le ratio ATQ actuel/ATQ de base (`scaledSkillDamage`) — nourrir/évoluer une créature rend vraiment ses attaques plus fortes.
- **Vitesse de clic** dépend de la rareté (jamais du niveau), réduit le nombre de taps requis (`effectiveTapCount`, plancher à 10).
- **Croissance ATQ/PV par niveau** plafonnée à rendements décroissants après le niveau 50 (`levelMultiplier`).
- **Carte des chapitres** : tracés courbes en pointillés entre les niveaux (Bézier, positions en pixels — attention, un bug de mélange d'unités fraction/pixel avait rendu les points invisibles, corrigé), +6 chapitres de marge affichés à l'avance.
- **Énergie** : 1 vie/20 min, plafond 5, coûte 1 par tentative de combat (pas remboursée en cas de défaite), notification locale programmée pour l'instant où elle sera pleine (`expo-notifications`, protégé par try/catch). Bouton dev "Énergie au max" dans Options.

### Runes — nouveau système complet
- 4 types (Force/Vitalité/Endurance/Célérité), 5 paliers chacun, table de bonus validée avec l'utilisateur avant implémentation (voir `RUNE_BONUS_TABLE` dans `combatLogic.js`).
- Achat aléatoire (100 Griffes), fusion (écran dédié `RuneFusionScreen`, regroupe automatiquement les runes identiques — évite l'ancien système "tape 2 runes" peu intuitif).
- 3 cases d'équipement dans la fiche de chaque créature (Aventure), grisées si vides, sélecteur au tap.
- Bonus réellement appliqués aux stats de combat (`runeBonuses`, 4e paramètre optionnel de `combatStatsForCreatureTyped` — rétrocompatible, aucun changement sans rune équipée).
- Affichage coloré du bonus dans la fiche créature (+X PV en vert, +X ATQ en rouge, etc.).

### Quêtes quotidiennes + streak de connexion — nouveau système complet
- **`src/context/DailyContext.js`** : Context partagé app-wide (enveloppe `App.js`), c'est LA couche de stats inter-jeux qui manquait.
- **Pool mixte de 3 quêtes/jour** (`dailyLogic.js`), tirage déterministe par date, mélange volontaire Clicker/Aventure.
- **Streak neutre** (aucune mention de mode) : 7 paliers de Griffes qui rebouclent, affichage en vrai tableau de 7 jours (pas un compteur qui grimpe).
- Récompenses créditées via drapeau partagé `PENDING_GRIFFES_KEY` (lu par `AdventureScreen.js` à son prochain chargement — JAMAIS d'écriture directe cross-écran, leçon du bug de sauvegarde écrasée plus bas).
- **`lifetimeStats`** (compteurs à vie, jamais remis à zéro) alimente aussi 3 nouvelles quêtes Aventure dans le VIEUX pool de quêtes de l'œuf (`QUEST_POOL` dans `clickerLogic.js`), qui n'en avait aucune à l'origine.

### Cycle de quêtes de l'œuf (clicker) — 2 bugs réels corrigés
1. **Bascule collecte→éclosion parfois bloquée pour toujours** (ref périmée dans un `useEffect`) — corrigé avec un updater fonctionnel qui lit toujours l'état à jour.
2. **Quêtes de type "cumul total" instantanément acquises pour un joueur vétéran** (comparaison à un seuil absolu depuis toujours, pas depuis le tirage) — corrigé avec un `questBaseline` (instantané des stats au moment du tirage), migration douce pour les sauvegardes existantes.

### Défis de l'œuf sur l'écran d'accueil — suppression de l'onglet Quêtes (tout dernier ajout)

Objectif demandé : **supprimer le menu Quêtes du clicker**, pour que le
joueur doive casser le VRAI œuf de l'écran d'accueil afin d'obtenir une
créature — au lieu d'aller taper un second œuf dans un onglet à part.

- **Barre de défi segmentée** (`ChallengeBar` dans `ClickerScreen.js`),
  posée entre la bannière de pouvoir et le deck : libellé du défi
  au-dessus, puis une piste en gélule avec pastille d'icône à gauche,
  segments dorés au milieu, fraction `courant/objectif` à droite. Style
  repris d'une capture Monster Legends fournie par l'utilisateur.
- **Un seul défi affiché à la fois** : le premier non terminé des 4 du
  cycle (`currentChallenge`). Empiler les 4 recréerait exactement
  l'onglet qu'on vient de supprimer. Une ligne « Défi N sur 4 avant
  l'éclosion » sous la barre garde la progression du cycle visible.
- **Nombre de segments plafonné à 6** (`CHALLENGE_MAX_SEGMENTS`) :
  certains objectifs valent 20, 25 ou 5000 — un segment par unité
  donnerait des traits de 2px. Au-delà, un segment vaut plusieurs
  unités, mais la fraction à droite reste toujours la VRAIE valeur.
- **L'œuf central est devenu le seul œuf du jeu** : `handleTap` appelle
  aussi `handleEggTap()` dès que `eggPhase !== 'collecting'`. Le joueur
  ne change ni d'écran ni de geste ; le gain de pièces reste acquis
  pendant l'éclosion (aucune raison de le punir). Le texte sous l'œuf et
  l'emoji basculent selon la phase (🥚 « Tape pour casser l'œuf » →
  💫 « Tape pour capturer la créature »).
- La **même barre** sert de jauge d'éclosion/capture pendant ces phases —
  jamais deux barres concurrentes à l'écran.
- **`questDetail()`** (nouveau, `clickerLogic.js`) fournit icône, libellé
  et fraction. Son `current` est **dérivé de `questProgress()`**, jamais
  recalculé à part : deux sources de vérité auraient permis à la barre
  d'afficher 5/5 sur une quête non validée. Métadonnées `icon`/`target`
  ajoutées sur chaque entrée de `QUEST_POOL` (affichage seulement, aucun
  effet sur le calcul de progression).
- **Overlay de récompense remonté** au niveau de l'écran : la capture
  peut maintenant tomber depuis l'accueil, il serait invisible s'il
  restait dans un sous-composant supprimé.
- **Bug corrigé au passage** : les 4 quêtes à seuil absolu
  (`combo25`/`evolve1`/`feed10`/`pacte5`) lisaient `stats.X` sans
  garde-fou et renvoyaient **NaN** sur un objet de stats incomplet —
  invisible avant, mais la nouvelle barre l'aurait affiché tel quel
  (« NaN/25 »). Helper `abs()` ajouté dans `questProgress()`.
- **Paliers visuels de l'œuf réaffichés sur l'accueil** : `EGG_STAGES`
  existait déjà mais n'était rendu QUE dans l'onglet Quêtes — sa
  suppression avait fait disparaître tout retour sur l'état de l'œuf.
  Le nom du palier s'affiche sous l'œuf, et bordure/lueur/opacité
  s'intensifient palier par palier (`eggStageIndex`), sur l'écran où le
  joueur tape vraiment.
- **Secousse de l'œuf** (`eggShake`) jouée uniquement pendant l'éclosion
  et la capture : sans elle, les centaines de taps nécessaires n'avaient
  aucun retour distinct d'un tap de récolte normal. Séquence courte et
  symétrique qui revient toujours à 0, donc l'œuf ne peut pas rester
  figé de travers si le joueur tape en rafale.
- **Durci** : `eggStageForCompletedCount()` laissait passer NaN
  (`Math.min`/`Math.max` le propagent), ce qui aurait donné
  `EGG_STAGES[NaN]` puis un crash sur `.name`. Non atteignable
  aujourd'hui (`completedQuestCount` vient d'un `.length`), corrigé
  quand même.
- Vérifié par test : 0 divergence entre `questDetail().done` et
  `questComplete()` sur les 11 quêtes, à vide comme à plein ; 2000
  tirages de `pickQuestSet()` tous valides ; palier visuel dans les
  bornes sur 14 entrées limites (négatif, décimal, NaN, null, chaîne) ;
  aucun style orphelin dans les deux sens (20 styles morts de l'ancien
  onglet supprimés).

### Boutique du clicker — 20 améliorations + 15 auto-clics
- **20 améliorations de créatures** (`UPGRADE_ITEMS`) et **15 auto-clics** (`AUTOCLICKERS`), thème créatures/éléments.
- Bonus réellement appliqués : `upgradeBonuses()` agrège tapFlat/coinPct/autoClickerPct/critChancePct/critMultPct, câblé dans `gainCoins`, le tap, le revenu passif (live + hors-ligne).

**Refonte du 02/09 — ce sont maintenant des améliorations NORMALES.**
La première version était une grille d'objets à collectionner (achat
unique, 4 paliers, cases "❓ ??? ???" verrouillées). Ce n'était pas la
demande : il fallait de simples améliorations de plus, dans la
continuité du clicker. Donc :
- **Achat unique → niveaux** : chaque amélioration se monte jusqu'à
  `UPGRADE_MAX_LEVEL` (10), coût ×1,6 par niveau (`upgradeItemCost`,
  même forme que `veilleurUpgradeCost`), effet cumulé par niveau. Elles
  se lisent exactement comme Pacte/Faveur/Sanctuaire/Veilleur, juste
  au-dessus dans la même page.
- **Verrouillage par palier SUPPRIMÉ** des deux côtés :
  `upgradeTierUnlocked()` et `autoClickerTierUnlocked()` n'existent plus.
  Tout est visible dès le départ, listé par coût croissant — dans un
  clicker le prix suffit à échelonner la progression. `tier` survit sur
  les entrées mais ne sert **plus qu'à rien côté règles** (ordre
  historique uniquement).
- **`purchasedUpgradeIds` (tableau d'ids) → `upgradeLevels` (objet
  id→niveau)** dans la sauvegarde. `normalizeUpgradeLevels()` relit
  l'ancien format comme « niveau 1 chacune » : un joueur existant garde
  exactement les bonus qu'il avait, et peut désormais les monter plus
  haut. Vérifié par test : bonus recalculés identiques au centième près.
- `describeUpgradeTotal()` (ClickerScreen) affiche le cumul déjà acquis
  à côté du gain du prochain niveau — les 5 types d'effet n'ayant pas la
  même unité (2 plats, 3 pourcentages), le formatage est par type.
- **À surveiller (équilibrage)** : les 4 améliorations de chance
  critique toutes au niveau 10 donnent +90% de chance de crit cumulée.
  L'écran plafonne bien à 100% (`Math.min(1, …)` dans `handleTap`), donc
  aucun bug — mais en fin de partie la Faveur des Esprits devient
  quasiment inutile. Coût cumulé pour y arriver : plusieurs millions,
  donc c'est un endgame lointain, laissé tel quel pour l'instant.

### Leçons/pièges récurrents à ne pas reproduire
- **Ne jamais écrire directement dans la sauvegarde d'un AUTRE écran** (ex: Options → sauvegarde d'Aventure) — toujours passer par un drapeau/montant en attente, lu et appliqué par l'écran propriétaire à son PROCHAIN chargement. Un vrai bug de "sauvegarde remise à zéro" est arrivé une fois pour cette raison exacte.
- **Toujours vérifier les imports React Native** avant de pousser (`grep` les composants utilisés vs importés) — deux crashs différents cette session (`ScrollView` manquant dans `CombatScreen.js` puis dans un autre écran) venaient d'un import oublié après un changement de style.
- **Ne jamais appeler un `setState` depuis l'intérieur d'un updater d'un AUTRE `setState`** — risque de double déclenchement en mode strict de React (repéré et corrigé sur `fuseRunes`/`equipRune`).
- **Quand une valeur est affichée à côté d'une condition, la dériver de cette condition** — la fraction de la barre de défi vient de `questProgress()` plutôt que d'un recalcul parallèle, sinon barre pleine et quête non validée peuvent diverger.
- **Toujours vérifier qu'une déclaration de fonction n'a pas été accidentellement supprimée** lors d'une édition par bloc (`grep -c "^function NomDeLaFonction"` doit toujours donner 1) — arrivé 2 fois cette session (`FighterSelectOverlay` amputé de sa ligne de signature).


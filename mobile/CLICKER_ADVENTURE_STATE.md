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
tapZone   ANCRÉE : top 0.41*H, bas 0.88*H (hauteur FIXE, calculée une
          fois au chargement du module — surtout pas un flex)
tapButton 290 x 290    (STRICTEMENT < hauteur de zone)
eggImage  250 x 250    (STRICTEMENT < 290)
```

**07/09 — la zone n'a plus de `top`/`height` devinés.** Elle est ancrée
entre le bas du cadre du deck et le haut de la barre de navigation
(`TAP_ZONE_TOP` / `TAP_ZONE_H` en haut de `ClickerScreen.js`). Cause du
bug « on ne peut taper que le haut de l'œuf » signalé ce jour-là :
l'ancienne zone (`top: 0.564*H - 32`, `height: 394`) descendait **sous le
texte d'aide et sous la barre du bas**, qui ont un `zIndex` supérieur
(3 et 5 contre 2) et interceptaient donc tous les taps de la moitié
basse. Descendre l'œuf davantage n'aurait fait qu'aggraver le problème.
L'ancrage garantit que la zone reste dans l'espace libre quelle que soit
la taille d'écran — vérifié par calcul sur 393x851, 360x780 et 412x915 :
marge cliquable de 0,93 à 1,43 cm autour de l'œuf, aucun chevauchement.

`tapHintZone` a aussi reçu `pointerEvents: 'none'` **dans son style** :
purement décoratif, il ne doit jamais voler un tap là où il recouvre la
zone.

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

✅ **Terminé (07/09).** Les 2 dernières occurrences (`CombatScreen.js`,
couche des dégâts flottants et couche centrale) sont passées dans le
style. **Plus aucun `pointerEvents` en prop dans tout le projet.**

La couche centrale était la plus risquée : elle couvre TOUT l'écran de
combat avec `zIndex: 10`, donc si elle interceptait les taps, aucune
créature du terrain n'était sélectionnable. L'effet exact dépendait de
la plateforme (une vue transparente sans gestionnaire ne bloque pas
toujours), ce qui explique que le bug n'ait jamais été signalé en jeu.

Les 17 autres occurrences vivaient dans PingPongScreen / RuneTracerScreen
/ BilliardScreen, **archivés hors de l'appli** — elles ne peuvent plus
nuire, mais ne sont pas corrigées pour autant : si un de ces jeux est un
jour restauré, le problème revient avec lui.

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

**Solution finale (04/09, la vraie)** : même le correctif flex ci-dessus
n'a pas suffi — l'utilisateur a fait remarquer que le rendu réel dans
ExpoGo ne correspond pas à un calcul simple, à cause de l'empilement de
marges/`aspectRatio`/centrage en cascade. **Tout l'écran d'accueil du
Clicker est passé en positionnement 100% ABSOLU** : chaque bloc
(header, pilule de pièces, carte de défi, bouton dev, bannières,
cadeau, cadre du deck, zone de tap, barre du bas) a son propre
`top`/`left` en % fixé DIRECTEMENT sur `styles.screen` (l'écran plein),
sans aucune marge, `flex`, ni centrage en cascade. `tapArea` et
`deckTopRow` ont été supprimés entièrement. Coordonnées obtenues via un
outil de glisser-déposer (widget HTML interactif) que l'utilisateur a
utilisé lui-même pour positionner chaque élément puis renvoyer les %
exacts :

```
Header        left 6.8%   top 0.8%   width 86%
Pièces        left 30.3%  top 9.6%   (largeur fixe 165)
Carte défi    left 6.1%   top 15.7%  width 88%
Bouton dev    left 25.8%  top 30.3%  (largeur auto)
Cadeau        left 1.5%   top 33.4%  (44x44 fixe)
Cadre deck    left 20.8%  top 35.7%  width 75%
Zone de tap   top 56.4%   width 100%
Barre du bas  left 2%     top 90%    width 96%
```

**Correctif du 04/09, après le premier passage en % : bug Yoga confirmé
par mesure.** Un élément `position:'absolute'` qui combine une largeur
en **%** ET `aspectRatio` se rend avec une largeur bien plus petite que
demandée dans ce build ExpoGo (mesuré : 88% demandé → ~74,5% réel, 75%
demandé → ~46% réel) — décalant tout vers la gauche puisque `left`
restait correct mais la largeur, non. La preuve : `coinsPill` (déjà en
largeur FIXE en pixels, sans `aspectRatio` combiné à du %) s'est
toujours rendu correctement centré, contrairement à `challengeCard` et
`deckFrame` (tous deux en % + `aspectRatio`).

**Solution adoptée** : `SCREEN_W`/`SCREEN_H` (`Dimensions.get('window')`,
figées au chargement du module) remplacent TOUS les `left`/`top`/`width`
en % des blocs d'accueil par des pixels calculés (`SCREEN_W * 0.061`
etc.) — plus aucun `%` sur un élément ayant `aspectRatio`. `tapZone`
(width `100%`, pas d'`aspectRatio`) a été vérifié correct et laissé tel
quel : le bug est spécifique à la combinaison %+`aspectRatio`, pas aux %
en général.

**Règle pour la suite** : si l'utilisateur redemande un ajustement de
placement, changer les multiplicateurs (`SCREEN_W * 0.XX`) directement —
ne JAMAIS revenir à des largeurs en `%` sur un élément qui a aussi
`aspectRatio`. Attention au `zIndex` : les overlays modaux (calendrier,
sélecteur de deck, récompense) ont tous `zIndex:20` pour rester
au-dessus des blocs d'accueil (`zIndex` 2 à 5) — tout nouvel élément
plein écran doit reprendre `zIndex:20` ou plus.

## Retrait des mini-jeux (06/09)

Les **13 mini-jeux** (Morpion, Puissance 4, 2048, Memory, Snake, Puzzle 15,
Sudoku, Nuts and Bolts, Flappy Bird, Wordle, Billard, Ping-pong, Traceur de
Runes) ont été **retirés de l'appli**, sur demande explicite : trop de
surface à maintenir en parallèle du Clicker/Aventure.

**Ils ne sont pas supprimés.** Tout leur code est archivé dans
`archive/minigames/` **à la racine du dépôt**, donc hors du dossier
`mobile/` que Metro empaquette : ils n'entrent plus dans le bundle et ne
peuvent plus casser un démarrage. Déplacés avec `git mv`, donc
`git log --follow` marche encore sur chacun. Procédure de restauration
détaillée dans `archive/minigames/README.md`.

Pourquoi la racine du dépôt et pas `mobile/src/_archive/` : Metro prend
`mobile/` comme racine de projet et surveille tout ce qu'il contient. Un
sous-dossier de `mobile/` aurait continué d'être surveillé.

Ce qui a bougé :

| Dossier | De | Vers |
|---|---|---|
| 13 écrans | `mobile/src/screens/games/` | `archive/minigames/screens/` |
| 13 dossiers de logique | `mobile/src/games/` | `archive/minigames/logic/` |
| Sprites Flappy Bird | `mobile/assets/flappybird/` | `archive/minigames/assets/` |

**Gardé volontairement** : les **pièces** (`CoinsContext`, `CoinBar`) —
elles restent en place, une autre monnaie les remplacera plus tard.
`useBackGesture`, `ErrorBoundary`, `clickerTheme` et
`mobile/src/games/clicker/` sont partagés ou propres au Clicker, jamais
touchés.

`JeuxScreen.js` ne liste plus qu'une entrée (Élevage). Il a été **gardé
comme hub** plutôt que de faire pointer l'onglet Jeux directement sur le
Clicker : `JeuxScreen` signale `onGameOpenChange` à `App.js`, qui masque la
barre d'onglets quand un jeu est ouvert. Ouvrir le Clicker d'office aurait
masqué la barre en permanence et rendu les onglets Progrès/Options
inaccessibles.

⚠️ La **PWA à la racine** (`index.html`, `sw.js`, `coins-config.js`,
`PROJECT_STATE.md`) contient aussi ces mini-jeux, en version web. Elle est
indépendante du dossier `mobile/` et **n'a pas été touchée** — le robot de
publication ne réagit qu'aux changements dans `mobile/**`.

## Le Clicker est l'écran RACINE de l'appli (06/09)

Les **3 onglets** (Jeux / Progrès / Options) ont été supprimés : `App.js`
rend désormais `ClickerScreen` directement, l'appli s'ouvre dessus.

- **Options** : bouton ⚙️ en haut à DROITE du menu du Clicker.
- **Quêtes** (ex-onglet Progrès) : bouton 📜 juste sous le cadeau. Pastille
  quand une quête est finie mais pas réclamée.

Les deux ouvrent l'écran correspondant **en surcouche plein écran, montée
depuis `App.js`** — surtout pas depuis `ClickerScreen`. Raison :
`OptionsScreen` importe déjà `STORAGE_KEY` / `BACKUP_KEY` /
`DEV_UNLOCK_ALL_KEY` **depuis** `ClickerScreen`. Si `ClickerScreen`
importait `OptionsScreen` en retour, le cycle d'imports rendrait ces
constantes `undefined` au démarrage — panne silencieuse et pénible à
diagnostiquer. `ClickerScreen` ne reçoit donc que deux callbacks
(`onOpenOptions`, `onOpenQuests`).

`JeuxScreen.js` n'ayant plus d'utilité, il a rejoint
`archive/minigames/screens/` (même logique que les mini-jeux : archivé,
pas supprimé).

**Retour Android** : `useBackGesture` reçoit maintenant une cible
contextuelle — depuis Shop/Collection il ramène au menu du Clicker, depuis
le menu lui-même il n'est pas branché (écran racine, Android ferme l'appli
normalement). Sans cette distinction, un retour Android depuis le Shop
quittait l'appli au lieu de revenir en arrière.

⚠️ Ne pas réintroduire `react-navigation` / `gesture-handler` / `screens`
pour recréer une navigation : ce groupe de libs causait un écran blanc
permanent sur ce build (confirmé par bisection).

### 8. Un conteneur de centrage doit avoir une hauteur EXPLICITE

**Bug réel (07/09), 4 tours de correction avant d'être trouvé.** L'œuf ne
se plaçait jamais où on le demandait : on déplaçait sa zone, il ne bougeait
pas — ou du mauvais montant.

Cause : le `View` intermédiaire qui centrait l'œuf se rendait avec une
**hauteur de ZÉRO**. `justifyContent: 'center'` centrait donc sur rien, et
l'œuf se retrouvait à cheval sur le **bord haut** de la zone au lieu de son
milieu. Il suivait le `top` de la zone, pas son centre : d'où l'impression
que les déplacements « ne marchaient pas ».

**Ni `flex: 1` ni `absoluteFill` (top/bottom à 0) ne lui ont donné de
hauteur.** Seule une hauteur explicite a fonctionné :

```js
tapTouch: { width: '100%', height: TAP_ZONE_H, alignItems: 'center', justifyContent: 'center' }
```

**Méthode qui a permis de trouver.** Trois hypothèses successives (ordre
d'empilement, débordement du parent, image décentrée) ont toutes été
contredites par la mesure. Ce qui a tranché : un `onLayout` sur chaque
niveau, affiché **à l'écran** (les logs CI ne sont pas accessibles depuis
le sandbox). Le relevé `zone y316 h327 · wrap y0 h0 · img y20 h250` a
désigné le coupable en une capture. **Quand deux hypothèses de suite sont
démenties par la mesure, arrêter de déduire et instrumenter.**

Au passage, deux faits utiles sur les PNG d'œufs : l'œuf est parfaitement
centré dans chacun (49,8 % à 50,2 %), mais il n'occupe que **50 % de la
hauteur du fichier** au stade « endormi » (jusqu'à 80 % au stade
« prêt »). Il paraît donc plus petit que sa boîte de 250 dp — normal, ce
n'est pas un bug.

## Fonctionnalités à venir — RAPPELER À L'UTILISATEUR

**https://docs.superhuman.com/d/_dZp6cXSuR5W**

Trois fonctionnalités décidées le 07/09, **à faire plus tard**, que
l'utilisateur a explicitement demandé qu'on lui **reremette en tête** :

1. **Temps d'éclosion des œufs** — taper et regarder des vidéos réduit le
   délai. ⚠️ Piège identifié dès la conception : l'autoclicker de
   l'utilisateur tourne à ~142 taps/s, donc toute réduction linéaire par
   tap fait éclore l'œuf instantanément et casse la mécanique ET l'intérêt
   des vidéos. Prévoir un plafond ou une courbe décroissante.
2. **Mini-boss toutes les ~30 min**. ⚠️ 48 apparitions/jour sans
   notification possible (`expo-notifications` retiré, impossible dans
   Expo Go depuis le SDK 53) : prévoir une **file d'attente** qui
   s'accumule hors ligne, sinon le joueur les rate presque tous.
3. **Gros boss quotidiens et hebdomadaires**.

Les trois servent le même but : le pool actuel n'est fait que de
compteurs de volume, aucun défi ne demande de décision. Les boss
apportent des défis à contrainte et à rendez-vous.

## Défis d'incubation (07/09)

Trois nouveaux événements suivis : `eggHatched`, `hatchVideo`,
`hatchSecondsSaved`. Émis depuis les DEUX chemins (œuf principal et
incubateur), soit 6 points d'appel.

⚠️ **`hatchSecondsSaved` est REGROUPÉ**, jamais émis par tap : il passe
par `pendingHatchSecRef`, vidé 10 fois par seconde par le même cycle que
les pièces. À 142 taps/s, un `trackEvent` par tap déclencherait
142 mises à jour d'état par seconde — exactement l'incident déjà
rencontré sur `gainCoins`. Le vidage final au démontage est là aussi.

⚠️ Un tap sur un œuf **déjà prêt** ne compte pas : le plancher de
`applyTap` fait qu'aucun temps n'est réellement gagné, le compter serait
faux (et permettrait de valider le défi en tapant dans le vide).

**Cibles calées sur le rythme de FIN de partie**, pas de début. Un œuf
prend 10 min à la 1re créature mais 14 h à la 26e : 144 œufs/jour
possibles au début contre **1,7 à la fin**. Viser le début rendrait ces
défis infaisables les derniers jours — d'où « 1 œuf » en quotidien et
« 5 œufs » en hebdomadaire, et non 20 ou 30.

| Type | Défis ajoutés |
|---|---|
| Quotidiens | 1 œuf éclos · 2 vidéos · 600 s gagnées en tapant |
| Hebdomadaires | 5 œufs · 12 vidéos · 3 600 s gagnées |
| Succès | Éclore des œufs (5→300) · Vidéos (10→1 500) |

Pools : 11 quotidiens, 13 hebdomadaires (6 tirés/semaine), 11 succès.

⚠️ **5 vidéos = 20 % × 5 = 100 % du total** : un œuf peut donc être
annulé entièrement à la vidéo, quel que soit sa durée. C'est un levier de
monétisation puissant, mais ça veut aussi dire que le minuteur est
toujours contournable — à surveiller au moment de fixer le prix des
vidéos ou leur disponibilité.

## Document des défis (Superhuman Docs) — À TENIR À JOUR

Tous les défis (quotidiens, hebdomadaires, succès) sont recensés dans un
document partagé avec l'utilisateur :

**https://docs.superhuman.com/d/_dkVLP-SAD6N**

**Consigne permanente de l'utilisateur (07/09)** : à CHAQUE modification
d'un défi dans le code — ajout, retrait, changement d'objectif ou de
récompense — mettre le document à jour dans la foulée. Il sert de source
commune pour discuter des idées ; s'il diverge du code, il ne sert plus
à rien.

L'accès se fait par le connecteur *Superhuman Docs* (lecture **et**
écriture, contrairement au connecteur Google Drive qui est en lecture
seule). Les tableaux sont en markdown, pas en grilles Coda : demande
explicite de l'utilisateur, qui veut tout voir d'un coup à l'écran.

### 9. iOS ≠ Android — deux pièges rencontrés (07/09)

Le jeu a été calibré sur l'Android de l'utilisateur. Testé sur iPhone
par des proches, deux choses cassaient. **À vérifier sur les deux
plateformes avant de considérer un problème d'affichage comme réglé.**

**a) Ne jamais positionner un élément du BAS avec un pourcentage de
`SCREEN_H`.** La barre de navigation était à `top: SCREEN_H * 0.9`. Or
ces éléments vivent dans un conteneur réduit par `paddingTop:
insets.top` (App.js) + le `padding: 14` de `screen`. Avec une encoche,
la marge haute passe de ~24 à ~59dp :

| | Marge haute | Cadre utile | Barre à 90% | Résultat |
|---|---|---|---|---|
| Android | ~24dp | ~728dp | 702dp | visible |
| iPhone | ~59dp | ~765dp | **767dp** | **hors cadre** |

Corrigé par un ancrage `bottom: 0`, vrai sur tout appareil. Idem pour
`tapHintZone`, ancrée au-dessus de la barre. **Et `paddingBottom:
insets.bottom` a été ajouté** : rien ne le faisait, donc la barre
passait sous la barre d'accueil de l'iPhone et devenait pénible à
toucher.

⚠️ `BottomTabBar` est un composant SÉPARÉ : il lui faut son propre
`useSafeAreaInsets()`, celui de `ClickerScreen` n'est pas dans sa portée.

**b) `textAlignVertical` n'existe QUE sur Android.** Sur iOS il est
ignoré en silence, donc tout texte centré ainsi se colle en haut de sa
boîte. Deux occurrences trouvées (montant des pièces, compteur de la
barre de défi) — le montant s'affichait au-dessus de la pilule sur
iPhone. **Centrer un texte avec une VUE parente** (`alignItems` +
`justifyContent`), jamais avec `textAlignVertical`. Plus aucune
occurrence dans le projet.

## Incubateur d'œufs — VERSION 1 (07/09)

Première brique de la refonte décrite dans « Paradox — Fonctionnalités à
venir ». **Volontairement incomplète** : elle sert à tester la mécanique.

**Fichiers** : `src/games/clicker/incubatorLogic.js` (logique pure, sans
React — donc simulable dans Node avant de figer les valeurs) et
`src/screens/games/IncubatorPanel.js` (panneau modal).

**Règles implémentées**, conformes au cahier des charges :

| Règle | Valeur |
|---|---|
| Durée | `10 min × 1,194 ^ (créatures possédées)`, plafond 16 h |
| Tap | −1 seconde, forfaitaire |
| Vidéo | −20 % de la durée totale, 3 maximum par œuf |
| Fin du minuteur | Pas d'éclosion automatique, le joueur revient taper |
| Hors ligne | Horodatage de fin (`endsAt`), jamais un compteur décrémenté |
| Emplacements | 1 seul (le 2e sera un achat en argent réel) |

Courbe vérifiée par simulation : 10 min pour la 1re créature, **14 h 01
pour la 26e**, total 85,5 h — exactement les bornes voulues.

**Sauvegarde dans sa PROPRE clé** (`clicker:incubator:v1`) et pas dans
celle du clicker : une fonctionnalité neuve ne doit pas pouvoir corrompre
la sauvegarde principale. Si elle échoue, le jeu continue sans elle.

**L'œuf PRINCIPAL éclot lui aussi au minuteur (07/09).** La phase
`hatching` ne compte plus 500 taps : elle lance un minuteur identique à
celui de l'incubateur (même module `incubatorLogic`). Le tap retire
1 seconde, un bouton vidéo à droite de l'œuf retire 20 %, le temps
restant s'affiche sous l'œuf **et dans la barre de défi** à la place du
« 5/500 » (`ChallengeBar` accepte un `countLabel` qui remplace
`current/target`). On ne passe à la phase de capture qu'une fois le temps
écoulé. `HATCH_TAPS_REQUIRED` n'est donc plus utilisé.

**La phase de CAPTURE a été supprimée (07/09).** Les 200 taps
supplémentaires après l'éclosion faisaient doublon avec le minuteur :
`eggPhase` ne vaut plus que `'collecting'` ou `'hatching'`, et le
minuteur à zéro donne la créature directement (tirage classique + bonus
de pièces, comme l'ancienne capture).

⚠️ Les états `hatchTaps` et `captureTaps` restent dans la sauvegarde bien
qu'inutilisés : les retirer changerait le format pour un gain nul.

⚠️ Le passage à la créature se fait **hors** de l'updater de `setMainEgg`
(lecture par `mainEggRef`) : déclencher d'autres `setState` depuis un
updater est un effet de bord que React peut exécuter deux fois — ici, ça
aurait donné deux créatures pour un seul œuf.

Les deux œufs (principal et incubateur) partagent la clé
`clicker:incubator:v1`, désormais au format `{ incubating, main }`.
L'ancien format (l'œuf d'incubateur écrit directement) est encore relu
pour ne pas perdre une incubation en cours.

**Le moment du choix (corrigé le 07/09).** Le bouton « Mettre en
incubation » n'apparaît QUE lorsque l'œuf est prêt (`eggPhase ===
'hatching'`, défis terminés) — c'est le seul moment où le joueur a un
arbitrage réel : briser tout de suite, ou différer pour incuber. Le
proposer pendant la phase 'collecting' n'avait aucun sens et le bouton
disparaissait justement au moment utile.

Mettre un œuf en incubation **relance aussitôt un cycle de défis**
(`startNewEggCycle`, extrait de la capture pour être partagé) : le joueur
continue à jouer normalement vers l'œuf suivant pendant que celui-ci
incube, et revient l'ouvrir quand il veut. Un œuf en incubation prime
sur l'affichage : le bouton devient un raccourci vers l'incubateur,
visible quelle que soit la phase.

## Gardien d'œuf (07/09) — EN PLACE

À la fin du minuteur, un gardien apparaît : il faut le battre pour que
l'œuf éclose. Le combat réutilise `CombatScreen` tel quel (3v3), enveloppé
dans `GuardianBattle` qui verrouille le PAYSAGE — `CombatScreen` ne le
fait pas lui-même, il n'était rendu que depuis l'Aventure qui verrouille
déjà pour tout le mode.

| Règle | Valeur |
|---|---|
| Premier gardien | **2e œuf** (`GUARDIAN_FIRST_EGG`) |
| Niveau | Courbe fixe : œuf 2 → niveau 3, œuf 26 → niveau 15 |
| Défaite | Œuf **jamais perdu**, 10 min avant nouvel essai |

⚠️ **Pas de gardien sur le premier œuf** : le joueur n'a encore aucune
créature, il ne pourrait pas combattre. Demande explicite, et c'est aussi
le garde-fou identifié à la conception.

⚠️ **La courbe monte lentement (3 → 15) et non 1 pour 1.** Raison mesurée :
la difficulté de l'Aventure est déjà déséquilibrée en haut de courbe —
ratio puissance adverse/joueur de 1,0 aux niveaux 1-10, mais 2,3 au
niveau 15 et 4,9 au 25. Un gardien « niveau 26 » serait infaisable.
**À revoir quand l'équilibrage des combats sera corrigé** : cette courbe
compense un défaut qui n'a pas vocation à rester.

⚠️ **Le gardien se combat SANS runes** : elles vivent dans la sauvegarde
de l'Aventure, que `ClickerScreen` ne lit pas. À brancher si le
déséquilibre se confirme au test.

`grantHatchedCreature` / `resolveHatch` / `finishGuardianFight` sont
partagés par les DEUX œufs (principal et incubateur) : un seul chemin,
donc pas de variantes qui divergent.

**Ce qui MANQUE encore, volontairement :**
- ⚠️ **Les vraies vidéos** — aucune régie n'est installée. Le bouton
  simule une publicité avec **1 seconde de chargement** (indicateur
  d'activité), pour tester le ressenti et le rythme.
- L'indice de rareté (lueur), et les défis liés à l'incubation.

**Piège évité** : le bouton sous l'œuf vit DANS `tapHintZone`, ancrée en
bas. Deux éléments positionnés séparément se chevauchaient sur iPhone,
la hauteur utile n'y étant pas la même que sur Android (voir règle 9).
La zone est passée en `pointerEvents: 'box-none'` : elle ne capte rien
elle-même, mais le bouton qu'elle contient reste cliquable.

## Tirage des créatures — recalibré le 07/09

**Les œufs ne donnent plus jamais de doublon.** `rollCreature(ownedIds)`
exclut les créatures déjà possédées. Les deux éclosions (œuf principal et
incubateur) passent la collection ; l'**invocation payante appelle sans
argument** et peut donc rendre un doublon, qui monte un niveau — un usage
légitime des pièces, contrairement à un doublon après plusieurs heures
d'attente.

**Poids recalibrés par simulation** (30 000 parties), anciens → nouveaux :

| Rareté | Avant | Après | Créatures |
|---|---|---|---|
| Commun | 40 | **100** | 8 |
| Peu commun | 20 | **45** | 6 |
| Rare | 15 | **20** | 5 |
| Épique | 12 | **8** | 4 |
| Légendaire | 8 | **3** | 2 |
| Mythique | 5 | **1** | 1 |

Les anciens poids donnaient le mythique au **14e œuf** en moyenne, soit à
mi-collection : la fin de partie n'avait plus rien à offrir. Désormais :
commun 1,8 · peu commun 3,8 · rare 7,5 · épique 12,7 · légendaire 18,3 ·
**mythique 22,8** sur 26 œufs (~42 h de jeu).

L'écart n'est pas figé pour autant : **1 joueur sur 10** décroche un
légendaire ou un mythique dans ses 5 premiers œufs.

⚠️ Le poids d'une rareté épuisée **se reporte tout seul** sur les autres
(les raretés sans créature disponible sont exclues du tirage) : c'est ce
qui fait monter la rareté moyenne à mesure que la collection se remplit,
sans table à maintenir.

⚠️ Une fois les 26 obtenues, le tirage retombe sur le roster entier :
l'œuf rend alors un doublon qui monte un niveau, plutôt que rien.

### 10. `flex: 1` sans `minWidth: 0` pousse le voisin hors de la ligne

**Bug réel (07/09)** : à partir du **Pacte niveau 7**, le coût d'achat
devenait invisible dans la boutique, et le restait jusqu'au niveau 10.

Cause : dans une ligne (`flexDirection: 'row'`), Yoga donne par défaut
`minWidth: auto` à un élément `flex: 1`. Le conteneur refuse donc de
rétrécir sous la **largeur intrinsèque de son texte** et pousse son
voisin hors de la ligne. Au niveau 7, le libellé (« Pacte : 7 → 8 ») et
le montant (« 1.3K » au lieu de « 640 ») gagnaient chacun un caractère —
assez pour faire déborder la ligne.

**Correctif** :
```js
colonneGauche: { flex: 1, minWidth: 0, flexShrink: 1 }  // peut se replier
valeurDroite:  { flexShrink: 0 }                        // garde sa largeur
```

Le défaut n'était pas isolé, il touchait **11 emplacements** : les
8 boutons d'achat du Shop, les rangées de quêtes (`questMiddle`), les
lignes de réglages (`rowText`) et la fusion de runes
(`fusionGroupInfo`).

**Règle** : dès qu'une ligne contient un texte extensible ET une valeur
ou un bouton à droite, le texte a besoin de `minWidth: 0` et la valeur de
`flexShrink: 0`. Sans ça, le bug n'apparaît qu'à partir d'une certaine
longueur de contenu — donc bien après la mise en production.

### 11. Une surcouche ne démonte pas l'écran en dessous

**Bug réel (07/09)** : la réinitialisation d'Élevage et celle de l'appli
ne faisaient plus rien. **Régression causée par la suppression des
onglets**, plusieurs jours plus tôt et sans rapport apparent.

- **Avant** : Options était un ONGLET → l'ouvrir démontait
  `ClickerScreen`. Vider le stockage suffisait, l'écran se rechargeait
  ensuite à vide.
- **Depuis** : Options est une SURCOUCHE → `ClickerScreen` reste monté
  avec tout son état en mémoire. Le stockage est bien vidé, puis la
  sauvegarde automatique (anti-rebond 600 ms, plus l'écriture au
  démontage) **réécrit l'ancien état** dès la première action.

⚠️ **Deux pièges supplémentaires découverts au 2e essai** — le premier
correctif ne suffisait pas :

1. **React REND la nouvelle instance AVANT de démonter l'ancienne.**
   Relâcher le verrou pendant le rendu le libérait donc trop tôt :
   l'ancienne instance écrivait quand même pendant son démontage et
   restaurait ce qu'on venait d'effacer. Le verrou se relâche
   maintenant dans l'effet de chargement, qui s'exécute APRÈS ce
   démontage.
2. **Les contextes ne sont JAMAIS remontés par la `key` du Clicker** :
   `CoinsProvider`, `DailyProvider` et `SettingsProvider` vivent
   au-dessus de l'écran. Pièces, quêtes, série et réglages survivaient
   donc à l'effacement et se réécrivaient. La réinitialisation TOTALE
   remonte désormais tout l'arbre via une `key` sur `CoinsProvider`
   (prop `onFullReset`), tandis que la réinitialisation d'Élevage ne
   remonte que le Clicker (`onAfterReset`) — elle ne doit pas toucher au
   quotidien.

**Correctif en deux temps, les deux sont nécessaires :**

1. `disableClickerSave()` — verrou au niveau du MODULE (pas dans l'état
   React), appelé par Options AVANT d'effacer. Il empêche notamment
   l'instance sortante d'écrire pendant son démontage, ce qui
   restaurerait exactement ce qu'on vient d'effacer.
2. `key={clickerKey}` sur `ClickerScreen` dans `App.js`, incrémenté via
   `onAfterReset` → **remontage complet**, donc rechargement depuis le
   stockage vide. Le verrou se libère au rendu de la nouvelle instance.

**Trois autres outils souffraient du même défaut**, corrigés au passage :
la restauration de sauvegarde (qui demandait de relancer l'appli — ce
n'est plus nécessaire) et « Débloquer tous les monstres » (dont le
drapeau n'est lu qu'au chargement). La réinitialisation d'Élevage efface
désormais aussi `clicker:incubator:v1`, sans quoi l'œuf en incubation y
survivait.

**Règle** : dès qu'un écran passe d'onglet à surcouche, vérifier tout ce
qui reposait sur son démontage — chargement, sauvegarde, remise à zéro.
Rien ne signale ce type de rupture, le code continue de compiler.

## Équilibrage du 07/09 — retour de test

Retour d'une joueuse : Aventure trop facile au début, défis du 1er œuf
trop faciles, gardien trop facile.

**Combats ×2.** `opponentPowerBudget` : base 13 → **26**. Confirmé par
mesure AVANT de changer quoi que ce soit : l'équipe du joueur était 2 à
4 fois plus puissante que l'adversaire à TOUS les niveaux jusqu'au 30
(ratio adverse/joueur entre 0,22 et 0,51). Après : 0,5 à 1,0 — des
combats disputés sans devenir infaisables. La croissance (1,062/niveau)
est inchangée, le déséquilibre était sur le point de départ.

⚠️ **Correction d'une erreur de ma part** : j'avais écrit dans le commit
du gardien que la difficulté était déséquilibrée en haut de courbe
(ratios 2,3 au niveau 15, 4,9 au 25). Ces chiffres décrivaient un bug
**déjà corrigé** par la division par la taille d'équipe
(`opponentPowerBudgetPerMember`) — j'avais lu un commentaire d'historique
comme un état actuel. La courbe du gardien (œuf 26 → niveau 15) reste
prudente, mais la justification était fausse.

**Défis +40%, avec DEUX traitements distincts :**

| Type de défi | Levier |
|---|---|
| Quantité (pièces, critiques, Offrandes, Transe…) | cible **×1,4** — 20 défis |
| Niveau (Pacte, Sanctuaire, Veilleur, auto-clics, améliorations) | **prix ×1,4** (`UPGRADE_COST_MULT`), cible inchangée |
| Niveau d'Aventure | rien — les combats sont déjà ×2 |

Gonfler la cible d'un défi « monte Pacte au niveau 10 » aurait changé le
texte sans rien rendre plus exigeant : c'est le coût cumulé qui fait la
difficulté. Il passe de 10 220 à **14 308 pièces**.

`UPGRADE_COST_MULT` s'applique aux 7 formules de coût (Pacte, Sanctuaire,
Veilleur, améliorations de tap, objets, auto-clics, nourrissage) et
multiplie la BASE : la croissance par niveau est intacte.

⚠️ Les libellés des défis contiennent leurs nombres EN DUR. Toute
modification de cible doit changer les deux — vérifié après coup que les
20 libellés citent bien leur nouvelle cible.

### 12. Un défi `absolute` déjà atteint se valide sans être vu

**Bug réel (07/09)**, signalé par une joueuse : le défi de Transe n'est
jamais apparu.

Cause : en mode `absolute`, la progression est `valeur actuelle / cible`.
Si le joueur dépasse déjà la cible au moment du tirage, le défi est
accompli d'emblée et disparaît sans avoir été vu. `maxTranseHoldSec` est
un **record à vie** : avoir tenu une longue Transe une fois, à n'importe
quel moment, suffisait à annuler ce défi pour toujours.

Le mode `delta` n'est pas concerné : il mesure depuis l'instantané pris
au tirage, donc il part toujours de zéro.

**Cas particulier des métriques de type RECORD** (`maxTranseHoldSec`,
`maxCombo`). Un mécanisme de remise à zéro existait DÉJÀ, mais il ne se
déclenchait que pour le défi **courant**. Or `completedQuestCount`
évalue les 4 défis du cycle **à la fois** : un défi déjà « fait » n'est
jamais le premier non terminé, donc il ne devient jamais courant, donc la
remise à zéro ne partait jamais. Le défi de Transe restait invisible pour
toujours dès qu'un record antérieur dépassait la cible.

Corrigé en remettant ces métriques à zéro **au TIRAGE du cycle** (pour
tout le set, pas seulement le défi courant). Ces métriques sont en
conséquence exclues de `questAlreadyDone` : il faut les RÉPARER, pas les
remplacer — sinon on perdrait un défi au lieu de le rendre jouable.

**Correctif** : `questAlreadyDone()` détecte le cas, et `nextQuestSet`
**remplace** ces défis par des défis du pool dynamique, dont la cible est
calculée à partir de l'état courant et se trouve donc forcément devant le
joueur. `pickQuestSet` filtre de la même façon.

⚠️ **Pourquoi remplacer et non relever la cible** : les libellés de la
séquence contiennent leur nombre EN DUR (« ...pendant 42 secondes »).
Relever la cible sans réécrire le texte donnerait un défi qui ment sur
son propre objectif.

Vérifié aux deux extrêmes : un joueur neuf reçoit la séquence scriptée
intacte, un joueur très avancé reçoit des cycles complets et **aucun
défi déjà accompli**.

### 13. Une marge en pourcentage se calcule sur la LARGEUR, même verticale

**Bug réel (11/09)** : les 4 panneaux de la fiche de créature se sont
retrouvés **entièrement vides** — plus aucune statistique, plus aucun
libellé.

Cause : `paddingVertical: '15%'` sur les panneaux thémés. En React Native
comme en CSS, **toute** marge en pourcentage se résout sur la **largeur**
du parent, `paddingVertical` compris. Sur un panneau large de 400 dp,
15 % valaient donc 60 dp en haut ET en bas — le contenu était poussé
hors du cadre.

**Règle** : marges et espacements en PIXELS. Le pourcentage ne convient
que pour une largeur, jamais pour caler quelque chose sur une hauteur.

## Cadres thémés — principe CONTENU D'ABORD (11/09)

📄 **Référence complète : `mobile/THEME_FRAMES.md`** — ratios mesurés,
script de remesure si l'image du cadre change, pièges rencontrés, et
procédure pour ajouter un élément. **À lire avant de toucher à un cadre
thémé.**


**Idée de l'utilisateur, qui a remplacé trois tentatives ratées de ma
part.** On ne fixe plus la taille du cadre pour y comprimer le contenu :
le contenu garde sa taille naturelle et le **cadre se construit autour**.

```
bloc de stats = 4 lignes -> hauteur naturelle H
cadre = H / 0,66  (la bordure occupe ~17% de la hauteur totale)
```

Ratios **mesurés sur l'image** du cadre, pas estimés : bordure de 8,7%
en largeur et ~17% en hauteur. D'où un débordement de 10,5% et 26% de la
taille du contenu (`FRAME_OVERHANG_X/Y` dans `AdventureScreen.js`).

**Pourquoi c'est supérieur aux approches précédentes :**
- Le cadre est en position ABSOLUE, donc hors du flux : il ne compte pas
  dans la hauteur du bloc. La boucle qui interdisait ce système sur la
  légende (plus de marge → plus haut → plus de marge) **n'existe plus**,
  et un composant unique sert les 5 blocs.
- Plus de marges fixes en pixels, qui ne pouvaient pas convenir à
  4 panneaux de tailles différentes.
- Plus de marges en pourcentage, impossibles pour du vertical (règle 13).

Les blocs ne s'étirent plus (`alignItems: 'flex-start'`), et les écarts
entre eux sont les **marges proportionnelles** du composant lui-même —
ce qui empêche par construction le défaut du « treillis » (cadres voisins
qui se chevauchent et fusionnent).

`ThemedPanel`, `ThemedFrame`, `themedBox` et `themedLoreBox` ont été
supprimés avec l'ancien système.

## ⚠️ Un push peut NE PAS déclencher la publication (12/09)

Arrivé une fois : le commit `a2e8f11` est bien monté sur `origin/main`,
avec des fichiers sous `mobile/**`, le workflow était `active`, et
pourtant **aucun run n'a été créé**. Tous les commits avant et après en
ont eu un. Rien de cassé dans la configuration : GitHub a simplement
raté l'événement.

**Symptôme côté utilisateur** : « il n'y a pas de changement » alors que
le code est poussé.

**Vérification** (le sandbox n'a pas accès aux logs, mais l'API oui) :
lister `/actions/runs` et chercher le `head_sha` du dernier commit. S'il
n'apparaît pas, la publication n'a jamais tourné.

**Relance** : depuis le 14/09 le jeton a le droit `actions: write`, donc
on relance directement par l'API — inutile de repousser un commit à vide :

```
POST /repos/giovinazzoenzo1-bit/paradoxes-app/actions/workflows/mobile-publish.yml/dispatches
     {"ref": "main"}      -> 204 attendu
```

Vérifié de bout en bout : déclenchement manuel → `completed / success`.

⚠️ Si la réponse est **403**, c'est que le jeton courant n'a que
`actions: read`. Repli : repousser un commit touchant `mobile/**`.

⚠️ Ne pas conclure trop vite à un bug d'affichage ou de cache Expo quand
l'utilisateur ne voit rien : vérifier D'ABORD qu'un run existe pour le
dernier sha.

## ⚠️ `<Image style={StyleSheet.absoluteFill}>` se dessine à sa taille NATIVE (13/09)

Bug réel : le bouton Inventaire apparaissait ÉNORME (≈480×95 dp) avec son
texte coincé dans le coin haut-gauche, alors que le conteneur faisait
28 dp de haut.

Cause : une `<Image>` **sans `width`/`height` explicites** n'est pas
contrainte de façon fiable par les seuls `left/right/top/bottom: 0` de
`absoluteFill` — elle retombe sur les dimensions natives du fichier
(520×134 ici). Le `Text`, lui, restait dans la boîte du conteneur, d'où
le décalage.

**Deux façons sûres, selon le cas :**
- taille connue → `<Image style={{ position:'absolute', width: W, height: H }}>`
  (c'est ce que font les panneaux Boutique, Forge et Inventaire) ;
- taille dictée par le contenu → **`<ImageBackground>`**, qui se comporte
  comme une `View` : l'image suit la boîte que le texte définit. C'est la
  solution retenue pour la plaque, et déjà celle de `BackButton`.

⚠️ Vérification : chercher `<Image` suivi de `absoluteFill` sans
`width`. Un `TouchableOpacity` ou une `View` en `absoluteFill`, eux, ne
posent aucun problème.

## La croix du panneau d'inventaire a été EFFACÉE de l'asset (13/09)

Elle était **dessinée dans l'image** : aucun placement de bouton ne
pouvait la « remplacer », le `BackButton` se posait juste à côté. Effacée
en recopiant le coin haut-GAUCHE miroité (cadre symétrique, ce coin n'a
pas de croix), puis le `BackButton` occupe la place.

⚠️ Règle : pour remplacer un élément DESSINÉ, il faut modifier l'asset —
le code ne peut que poser par-dessus.

## Carte en PLEIN ÉCRAN (13/09)

Le décor touche les 4 bords : plus de `padding: 14` sur l'écran (il
laissait une bande noire), et l'en-tête est passé **en surcouche**
(`position: absolute`) pour ne plus occuper de place dans le flux.
`pathWidth` vaut désormais la largeur ENTIÈRE de l'écran.

⚠️ **`stretch` et non `cover` pour le décor.** En plein écran le rapport
passe de 2,60 (image) à ~2,17 (écran). Mesuré : avec `cover`, 17 % de la
largeur est rognée et les niveaux 1 et 5 sortent de l'écran (x = −1 et
x = 837). `stretch` remplit exactement, donc une fraction de l'image
reste une fraction de page. Coût : ~20 % d'étirement vertical, invisible
sur ce style illustré.

⚠️ **AUCUN voile derrière l'en-tête.** Essayé pleine largeur (elle
assombrissait le niveau 10), puis deux zones latérales : dans les deux
cas on voyait des **rectangles gris posés sur le décor**. La bonne
réponse est que chaque bouton porte SON PROPRE fond, épousant sa forme :
plaque dorée pour Retour, pastille pour Éléments, pour les Griffes, et
désormais pour l'Énergie aussi (elle n'en avait pas).

⚠️ **Largeur de page MESURÉE, pas `screenWidth`.** Supposer la largeur de
la fenêtre laissait une bande vide à gauche et un débordement à droite
quand le conteneur est décalé (encoche, marge d'un parent). Le
`onLayout` du défilement fournit largeur ET hauteur.

⚠️ **Conflit trouvé par le calcul** : le dernier nœud du tracé C tombait
sous les boutons du coin haut droit une fois en plein écran. Descendu de
0,124 à 0,215 ; écart minimal inchangé (96 dp).

**Liste de contrôle pour tout nouveau décor** (toutes vérifiées pour le
chapitre 2) :
1. rapport de l'image ≈ 2,60 ;
2. filigrane Gemini présent ? (aucun sur le chapitre 2) ;
3. chaque nœud est sur du sol praticable (rayon libre mesuré) ;
4. écart minimal entre 2 nœuds ≥ 46 dp — chapitre 2 : **114 dp** ;
5. aucun croisement entre segments non consécutifs — chapitre 2 : **0** ;
6. aucun nœud sous les boutons de l'en-tête (bord haut < 58 dp et x dans
   la zone gauche 0-134 ou droite 553-853). Un conflit a été trouvé et
   corrigé sur le chapitre 2 : le dernier niveau visait l'îlot haut
   gauche, sous le bouton Retour — déplacé sur le sentier voisin.

## Transition entre chapitres : fondu au défilement (13/09)

Passer d'un ciel bleu (ch.1) à un fond cosmique noir (ch.2) donnait une
couture brutale au glissement. Réglé par un **fondu piloté par la
position de défilement** : chaque page est à pleine opacité quand elle
est centrée et nulle à une page d'écart, donc à mi-glissement les deux
voisines sont à 50 % sur le fond sombre.

`Animated.ScrollView` + `Animated.event(..., { useNativeDriver: true })`
sur `contentOffset.y`, puis `interpolate` de l'opacité par page.

### Pourquoi pas les autres pistes

| Piste | Verdict |
|---|---|
| Transitions peintes par Gemini | ❌ un asset par PAIRE de chapitres ; ajouter ou réordonner un chapitre les casse toutes |
| Barre horizontale entre les pages | ❌ `pagingEnabled` cale son pas sur la hauteur du ScrollView — toute barre entre les pages décale toutes les suivantes |
| Bouton « chapitre suivant » | ❌ évite le problème au lieu de le régler (reste possible comme raccourci) |

⚠️ **Garde-fou sur la ref** : `Animated.ScrollView` transmet sa ref au
ScrollView réel dans les versions récentes, mais l'ancienne API
l'enveloppait derrière `getNode()`. Les deux sont acceptés — un
`scrollTo` introuvable ramènerait silencieusement le joueur en haut de
la carte, exactement le bug déjà corrigé trois fois.

## ⚠️ Tirage de rune offert : RÉÉCRIT (15/09)

Les deux versions précédentes passaient par une clé de stockage : le
Clicker déposait, l'Aventure lisait **et effaçait**, puis gardait le
tirage dans un état LOCAL. Or l'Aventure se démonte dès qu'on revient au
Clicker : le tirage était perdu, et la clé déjà consommée ne le rendait
jamais. D'où « ça ne se débloque toujours pas », signalé deux fois.

**Correctif (3e version, la bonne)** : plus aucun transfert par le
stockage, et surtout plus aucune dépendance à la LISTE DES DÉFIS.

```
freeRuneAvailable = sequenceIndex >= RUNE_CYCLE_INDEX (4) ET tirage pas utilisé
```

⚠️ **Pourquoi pas « le défi est actif »** : `activeQuestIds` est
SAUVEGARDÉ au tirage du cycle. Un joueur arrivé au cycle 5 AVANT l'ajout
de `seq_firstrune` garde une liste qui ne le contient pas — la condition
restait donc fausse à jamais, quelle que soit la suite. C'est ce qui a
fait échouer la 2e version.

La PROGRESSION (`sequenceIndex`), elle, est fiable et rétroactive : elle
rattrape les parties en cours. `clicker:freeRuneUsed:v1` est écrit quand
le tirage sert. **Rien à perdre au démontage.**

**Règle** : ne jamais conditionner une fonctionnalité à une LISTE
sauvegardée qu'on vient de modifier — les parties en cours gardent
l'ancienne. Se raccrocher à un compteur de progression.

**Règle** : un état que deux écrans partagent se déduit d'une source
commune ou se passe en prop — un transfert « dépose puis efface » se
perd dès qu'un écran se démonte au mauvais moment.

## Gardien : pas de récapitulatif, une annonce de créature

Le combat de Gardien saute l'écran de fin d'Aventure (`skipResultScreen`)
et rend la main tout de suite. La vraie récompense est la CRÉATURE qui
éclot, annoncée par son propre panneau : « Félicitations ! Tu as
débloqué X ». Deux écrans de victoire à la suite noyaient l'information.

⚠️ La fin passe par un EFFET, pas par le rendu : appeler `onFinish`
pendant le rendu déclencherait une mise à jour du parent au milieu du
rendu de l'enfant. Et il est placé AVEC les autres Hooks, avant le
`if (phase === 'done')` — vérifié : Hooks jusqu'à la ligne 392, premier
retour du composant à 786.

## Prix des améliorations relevés (15/09)

Coûts de base **×2**, croissances **×1,16** (2,16 → 2,5 et proportionnel
pour les autres paliers).

Mesure : la rentabilisation du PREMIER niveau s'étalait de **7 à 622
minutes** selon l'objet — certains étaient bradés, d'autres non. Le
doublement relève le plancher ; la croissance renchérit surtout
l'EMPILEMENT.

| | Cumul niveau 10, avant → après |
|---|---|
| Griffe de Braisillon | 515 K → 3,3 M (×6,4) |
| Écaille de Caraploof | 2,6 M → 17,1 M (×6,7) |
| Plume de Ventis | 8,3 M → 56,2 M (×6,8) |

⚠️ `UPGRADE_COST_MULT` n'a PAS été touché : il sert aussi à
`levelUpCost`, qu'on avait volontairement baissé. Seuls `cost` et
`growth` des objets bougent.

## ⚠️⚠️ OUTIL D'AUDIT DE LA PROGRESSION — `mobile/tools/audit-quetes.js`

**Le point le plus important du projet** : la séquence compte ~25 œufs ×
4 défis. Personne ne la jouera en entier pour vérifier qu'aucun défi
n'est impossible, absurde ou interminable. Ce script la PARCOURT et la
MESURE à la place.

```
NODE_PATH=<dossier avec @babel/core> node mobile/tools/audit-quetes.js
```

Il charge la VRAIE logique du jeu (pas une copie), simule un joueur qui
progresse cycle après cycle, et applique DEUX critères :

| Critère | Ce qu'il attrape |
|---|---|
| **Temps** estimé par défi | les cibles hors d'échelle |
| **Corvée** (actions répétées) | « invoque 30 créatures » : peu cher, très pénible |

⚠️ **Les deux critères sont nécessaires.** Le temps seul laissait passer
« invoque 30 créatures » (coût dérisoire, 30 appuis successifs). La
corvée seule laisserait passer « accumule 70 millions ».

`proposerCibles()` cherche par dichotomie la plus grande cible tenant
sous un plafond de minutes — l'équilibrage devient mécanique.

### ⚠️ LA VRAIE RÉPONSE : des cibles qui SE CALIBRENT SEULES

Corriger les cibles une par une ne tient pas : chaque changement
d'équilibrage (production, coûts, Ascension) les périme toutes.

Le moteur de calibration EXISTAIT déjà (`resolveQuestTarget` +
`questBudget` = production réelle × minutes d'effort) mais **seul le
pool dynamique l'utilisait**. Les 18 défis de la séquence portant sur des
PIÈCES sont passés dessus : ils déclarent maintenant un `effortMin` au
lieu d'un `target`.

⚠️ **Condition indispensable** : leur libellé doit devenir DYNAMIQUE
(`(t) => ...`). Un libellé à nombre en dur mentirait sur sa propre cible.
C'est ce qui bloquait cette conversion jusqu'ici.

**Effet mesuré sur l'Ascension** — sans une seule valeur écrite en dur :

| Défi | 0 asc | 1 asc | 3 asc | rapport |
|---|---|---|---|---|
| Accumule N pièces | 23 M | 30 M | 51 M | **×2,19** |
| Obtiens N pièces | 39 M | 50 M | 85 M | ×2,18 |

La production monte de 30 % par Ascension, les cibles suivent
exactement. C'est déduit, pas paramétré.

⚠️ Les défis de RYTHME (cibles dorées, critiques, pouvoirs, invocations)
ne peuvent PAS se calibrer sur les pièces : leur rythme n'en dépend pas.
Ils gardent une cible fixe **indexée sur les Ascensions à +20 %,
plafonnée à ×3** — au-delà, un défi d'action durerait plus qu'une
session.

### Résultats : 425 h → 85 h → 22 h

| | Cibles figées | Après correction manuelle | **Auto-calibrées** |
|---|---|---|---|
| Durée de la séquence | 425 h | 85 h | **22 h** |
| Défis hors d'échelle | 12 | 5 | **3** |
| Défis-corvée | 2 | 0 | **0** |

Faisabilité revérifiée : **1080 défis tirés** sur 20 collections
aléatoires × 4 niveaux d'Ascension × 13 cycles → **0 irréalisable**.

Les 3 alertes restantes viennent du plafond d'ÉNERGIE et du plafond de
DIAMANTS, pas des cibles.

### Premier passage : 425 h → 85 h

| | Avant | Après |
|---|---|---|
| Durée totale de la séquence | **425 h** | **85 h** |
| Défis hors d'échelle | 12 | 5 |
| Défis-corvée | 2 | **0** |

Pires cas corrigés : « Pacte niveau 20 » demandait **143 heures** à lui
seul, « accumule 70 millions » 125 h, « Croc de Bouldog niveau 10 » 79 h.

⚠️ **Contrôle de cohérence des LIBELLÉS** : trois défis affichaient un
nombre différent de leur cible réelle (« Active 14 fois » pour une cible
de 10). Les libellés à nombre EN DUR doivent être modifiés avec la
cible ; ceux en `(t) => ...` suivent tout seuls et sont à préférer.

⚠️ Les 5 alertes restantes viennent du plafond d'ÉNERGIE (5 combats par
heure), pas des cibles. Ce n'est pas un défaut de défi.

### Bouton dev « ⏭️ Cycle »

Valide tout le cycle d'un coup. Indispensable pour atteindre la fin de
la séquence en test : sans lui, les bugs des derniers œufs ne seraient
jamais vus.

**Règle** : relancer l'audit après TOUT changement d'équilibrage
(production, coûts, cibles). C'est le filet qui protège le cœur du jeu.

## ⚠️ « Équipe 3 runes » ne se validait pas (15/09)

La référence d'un défi en DELTA était prise au moment où il devient le
défi COURANT — « tout ce qui a été accumulé avant ne compte pas ».

Conséquence : un joueur ayant déjà équipé ses 3 runes plus tôt dans le
cycle voyait le compteur repartir de zéro. Et comme ses 3 emplacements
étaient pleins, il ne POUVAIT PLUS en équiper : défi infaisable sans
deviner qu'il fallait déséquiper puis rééquiper.

**Correctif** : les métriques d'ACTION RARE se comptent depuis le début
du CYCLE (`CYCLE_SCOPED_METRICS`) : `runeBought`, `runeEquipped`,
`runeFused`, `ascension`, `offering`. Ces actions sont rares, coûteuses
et délibérées — les avoir faites pendant le cycle, c'est avoir fait le
travail.

⚠️ Les métriques d'ACCUMULATION (pièces gagnées, critiques, cibles
dorées) GARDENT leur référence par défi. Les passer à la portée du cycle
les validerait toutes seules, le joueur en accumulant en permanence.
Vérifié : elles restent à 0 % dans le scénario où le défi des runes
passe à 100 %.

**Règle** : pour un défi en delta, se demander si l'action est SUBIE
(accumulation continue) ou CHOISIE (action rare). Une action choisie doit
compter sur tout le cycle.

## ⚠️⚠️ DÉFIS IMPOSSIBLES = ŒUF BLOQUÉ À VIE (15/09)

**Le bug le plus grave rencontré.** « Monte Griffe de Braisillon au
niveau 5 » était proposé à un joueur ne possédant pas Pyrosile. Depuis
que les améliorations sont réservées aux créatures possédées, ce défi
est INFAISABLE — et comme l'œuf attend que TOUS les défis du cycle
soient validés, il ne pouvait plus jamais éclore.

### Trois niveaux de correction

1. **`questFeasible(quest, stats)`** réunit la condition propre du défi
   (`available`) ET la possession de la créature requise par une
   amélioration.
2. **Au TIRAGE** d'un cycle : les défis irréalisables sont écartés au
   même titre que les défis déjà accomplis, et remplacés par un défi du
   pool calculé sur l'état courant.
3. **RÉPARATION des cycles DÉJÀ tirés** : un cycle est sauvegardé, donc
   les parties en cours gardaient le défi cassé. Un effet le remplace à
   l'ouverture. ⚠️ Un défi déjà VALIDÉ est conservé même devenu
   infaisable — le joueur l'a mérité.

⚠️ `questStats` expose désormais **`ownedIds`** et pas seulement
`ownedCount` : sans la liste, impossible de savoir si la créature d'une
amélioration est possédée.

⚠️ Le pool dynamique avait bien un `available()` sur ses 35 défis à
risque, mais il ne testait que le PRIX, pas la possession. Il passe
maintenant par `questFeasible` lui aussi.

### Vérification

**2592 défis tirés** — 4 profils de joueur × 12 collections aléatoires ×
13 cycles — **0 irréalisable**.

**Règle** : tout défi qui dépend d'un objet, d'une créature ou d'un
déblocage DOIT passer par `questFeasible`. Un seul défi impossible bloque
l'éclosion définitivement.

## Boutique : améliorations liées aux créatures possédées (15/09)

Chaque amélioration appartient à une CRÉATURE. Celles dont la créature
n'est pas possédée sont **grisées et rejetées en bas de liste**, pas
supprimées : le joueur voit ce qu'il débloquera, et la liste ne se
réorganise pas sous ses yeux à chaque invocation.

Tri : possédées d'abord (par coût croissant), puis les autres.

⚠️ `creatureId` est inscrit EXPLICITEMENT dans `UPGRADE_ITEMS`, pas
déduit du nom. La déduction ratait `griffeBraisillon`, dont la créature
a été remplacée par Pyrosile (voir la table de migration). Vérifié : les
20 améliorations pointent vers une créature existante.

⚠️ `ownedIds` est un `Set` : la liste est parcourue à chaque rendu, un
`find` par ligne serait inutilement coûteux.

## Bouton d'achat de Griffes : sous l'Offrande

Il avait d'abord été placé après le Veilleur, donc **hors écran sans
faire défiler** — le joueur ne le trouvait pas. Remonté juste sous
l'Offrande, à côté de l'autre échange de monnaie.

## Réglages du 14/09 (4)

### ⚠️ Bandeaux de pouvoir : empilés, pas superposés

Les deux bandeaux (pouvoir actif, remise) portaient CHACUN la même
position absolue : deux bandeaux actifs se recouvraient exactement. Et
mesuré, leur cadre (x 31-362, y 350-376) mordait sur le bouton Quêtes
(x 6-68, y 340-401).

**Correctif** : une COLONNE porte la position, les bandeaux n'en ont
plus. Elle gère 1, 2 ou 3 bandeaux sans réglage. Décalée à droite du
bouton Quêtes (x 79-377, 16 dp de marge à droite), texte réduit à 10 et
sur une seule ligne.

### Pouvoirs de créature : +29 % en moyenne

Mesure : la valeur d'un pouvoir = les taps gagnés pendant sa durée.

| Rareté | Avant | Après | Gain |
|---|---|---|---|
| commun | ×2 | **×2,4** | +40 % |
| peu commun | ×2,5 | **×3** | +33 % |
| rare | ×3 | **×3,6** | +30 % |
| épique | ×5 | **×6** | +25 % |
| légendaire | ×10 | **×12** | +22 % |
| mythique | ×15 | **×18** | +21 % |

⚠️ La DURÉE ne bouge pas. Une hausse de durée aurait doublé la valeur
(+62 à +125 % mesurés) — trop pour l'économie.

Les raretés basses gagnent le plus : ce sont elles qui en ont besoin.

### Achat de Griffes dans la boutique du Clicker

Ligne ajoutée là où le joueur a ses pièces sous les yeux. Prix NON fixe :
20 000, 30 000, 40 000… × le rythme des Ascensions.

⚠️ Les Griffes vivent dans l'Aventure : le Clicker dépose le dû dans
`PENDING_GRIFFES_KEY`, encaissé à la prochaine ouverture. **Jamais
d'écriture croisée** dans la sauvegarde de l'autre écran — même canal que
l'Ascension et les défis.

## Animation du Gardien — RETIRÉE (15/09)

Une animation en séquence d'images a été tentée entre les deux manches,
puis **retirée** : le rendu ne convenait pas et ne pouvait pas convenir
par cette voie. Une vidéo PLEIN ÉCRAN est prévue à la place, à fournir
plus tard.

Ce qui a été appris, à garder pour la prochaine tentative :

⚠️ **Un MP4 ne peut pas être transparent** (H.264 n'a pas de canal
alpha), et l'appli n'embarque aucune bibliothèque vidéo — seulement
Lottie. Une vidéo plein écran change la donne : plus besoin de
transparence, donc un lecteur vidéo redevient envisageable (vérifier
alors que le module existe bien dans Expo Go SDK 57 avant de l'utiliser).

⚠️ **Détourage d'un fond noir** : le noir du FOND touche le bord de
l'image, celui des CONTOURS est enfermé dans la silhouette. Un
remplissage depuis les bords les sépare proprement, et ne garder que la
plus grosse composante retire le filigrane Gemini. Aucune retouche
manuelle nécessaire.

⚠️ **Ne jamais forcer une animation dans un canevas CARRÉ** si sa boîte
ne l'est pas : le sujet est réduit d'autant et paraît petit et délavé
(mesuré : 61 % de la hauteur au lieu de 94 %).

⚠️ **Pour allonger une animation, il faut PLUS D'IMAGES, pas une cadence
plus basse** — baisser la cadence produit un RALENTI. Échantillonner à
N i/s et rejouer à N i/s conserve la vitesse d'origine.

⚠️ **Coût** : 10 s d'animation détourée pèsent 4 à 7 Mo en images, contre
13 Mo pour TOUS les assets du jeu. Une vidéo compressée sera bien plus
légère.

La transition entre les deux manches est revenue au texte « LE GARDIEN
SE RELÈVE ». Le reste de la mécanique (bouclier, 2 manches, barre de vie)
est INCHANGÉ.

## Mini-boss : il remplace l'œuf (14/09)

- Le **boss prend la place de l'œuf** pendant le combat.
- **Barre de VIE en bas** : 1 tap = 1 PV, donc **200 PV** pour 200 taps.
  Le joueur voit des PV descendre, pas un compteur monter.
- Menu de victoire : « **Boss vaincu !** » puis le gain de Diamants.

⚠️ **Seule l'IMAGE change**, l'œuf n'est pas démonté. Son palier, ses
animations et sa progression sont donc intacts au retour — c'est ce qui
évite tout bug de changement d'œuf. Même emplacement et même zone
tapable, donc aucune mise en page à revoir.

⚠️ La logique de tap est déjà prévue pour ça : `handleTap` compte le coup
pour le boss PUIS continue son chemin normal (pièces, critiques, minuteur
d'œuf). Rien à modifier.

⚠️ Position de la barre vérifiée par calcul : de 96 à 150 dp depuis le
bas, contre 92 dp pour la barre de navigation — **4 dp de marge**, et
elle passe sous le boss sans le couvrir.

⚠️ Gain de Diamants affiché en DEUX `Text` séparés (icône / nombre). Mêler
un emoji et une valeur dans un même `Text` a déjà fait disparaître le
nombre deux fois (prix du Shop, gains hors-ligne).

## ⚠️ Cible de défi : la définition prime sur la sauvegarde

Les cibles sont figées au tirage du cycle et sauvegardées. Après un
changement d'équilibrage, une partie en cours gardait l'ANCIENNE valeur
alors que le libellé, lui, est recalculé : le défi affichait
« 100 000 pièces » tout en en exigeant **140 000**.

**Correctif** : une cible FIXE (`quest.target`) prime toujours sur la
valeur sauvegardée. Se répare tout seul sur les parties en cours.

⚠️ Seules les cibles CALCULÉES (effort en minutes) restent figées —
sinon elles bougeraient au fil de la partie. Vérifié.

## Revenu passif : SOURCE UNIQUE (14/09)

⚠️ **Trois formules divergentes coexistaient** :

| Usage | Multiplicateurs appliqués |
|---|---|
| Affichage « +N/s » | base × pouvoir × sanctuaire × essence × ascension |
| Tick en jeu | base × pouvoir × bonus auto-clic, puis `gainCoins` rajoutait sanctuaire × essence × ascension × bonus pièces |
| Hors-ligne | base × veilleur × bonus auto-clic |

Le chiffre affiché n'était donc le taux réel **ni en jeu ni hors ligne**,
et le joueur ne pouvait pas rapprocher son gain de ce qu'il lisait —
d'où le signalement « j'ai gagné 300 K alors que je fais 117/s ».

**Correctif** : `passiveRate()` sert aux TROIS. Hors ligne, elle ajoute
le bonus du Veilleur (sa raison d'être) et retire le pouvoir temporaire
d'une créature, qui expire pendant l'absence.

⚠️ Le tick crédite maintenant `pendingGainRef` DIRECTEMENT et ne passe
plus par `gainCoins` : celui-ci rajoute sanctuaire, essence, ascension et
bonus de pièces, déjà inclus dans `passiveRate`. Les compter deux fois
gonflerait le revenu.

⚠️ L'ancienne bannière « Pendant ton absence… » est retirée : elle
faisait doublon avec la nouvelle fenêtre. Elle n'a jamais crédité quoi
que ce soit — vérifié avant de conclure à un double crédit.

**Sur le chiffre signalé** : le taux hors-ligne valait au plus 1,16× le
taux en jeu. 300 000 pièces à ce rythme demandent 27 à 43 minutes, pas
« quelques minutes ». Aucun double crédit trouvé.

## Tirage de rune offert : filet de rattrapage

⚠️ Le dépôt a lieu au TIRAGE du cycle. Un joueur déjà arrivé au défi des
Runes avant l'ajout de la fonctionnalité ne l'a donc jamais reçu — cas
signalé. Un effet rattrape : défi actif et non validé → tirage déposé,
avec `clicker:freeRuneGranted:v1` pour qu'il ne le soit QU'UNE FOIS.

## Correctifs du 14/09 (5)

### ⚠️ Verrou des défis : la sauvegarde DIFFÉRÉE était le trou

Le verrou (`latchedQuestIds`) était correct, mais il ne partait sur
disque qu'avec la sauvegarde principale, **différée de 600 ms**. Valider
un défi, dépenser ses pièces et fermer l'appli dans cette fenêtre
perdait le verrou : au rechargement le défi redevenait « à faire ».
C'est pourquoi le bug est revenu après avoir été « corrigé ».

**Correctif** : clé propre `clicker:latchedQuests:v1`, écrite
**immédiatement** à chaque pose de verrou, et qui fait **autorité** sur
la sauvegarde principale à la lecture (union des deux).

Effacée au tirage d'un nouveau cycle et à l'usage du bouton dev « défi
précédent » — les deux seuls cas où un défi doit redevenir faisable.

**Règle** : toute donnée qu'une fermeture brutale ne doit PAS perdre
s'écrit hors de la sauvegarde différée (voir aussi les horodatages de
boss et les Diamants d'Offrande).

### ⚠️ Montant invisible : le même défaut que les prix de boutique

Le compte rendu hors-ligne affichait la bourse sans le nombre. Emoji et
chiffres étaient dans UNE SEULE chaîne : seul l'emoji était peint.
C'est exactement le défaut déjà rencontré sur les prix du Shop.

**Correctif** : deux `Text` SÉPARÉS dans une rangée, chacun mesuré pour
lui-même. Vérifié que le montant le plus long possible du jeu
(« 142.00No ») tient dans la carte.

**Règle** : ne jamais mêler un emoji et une valeur dans un même `Text`
lorsqu'il s'agit d'un montant.

## Correctifs du 14/09 (4)

### ⚠️ Fenêtres plein écran : la règle

Le compte rendu hors-ligne et les félicitations de défi avaient été
posés DANS `tapZone`. Leur `position: absolute` était donc bornée par ce
conteneur : le voile ne couvrait qu'une bande de l'écran et la carte
apparaissait décalée.

**Règle** : un voile plein écran doit être **frère du contenu**, à la
racine de l'écran — jamais enfant d'une zone.

### Félicitations : petite bulle, sans voile

Réduite à 🎉 + « Défi réussi ! », **sans fond sombre**. Le conteneur
reste plein écran uniquement pour CENTRER la bulle, et se referme au
premier appui.

Ce n'est pas une décision à prendre, juste une bonne nouvelle : un voile
bloquerait le jeu pour rien et masquerait l'œuf, que le joueur veut
justement voir avancer. (Son à ajouter plus tard.)

### ⚠️ Dégâts affichés qui ne suivaient pas le niveau

Les boutons d'attaque affichaient `skill.damage`, la valeur de BASE. Une
créature niveau 40 annonçait donc les mêmes chiffres qu'au niveau 1 :

| Niveau | Affiché avant | Réel |
|---|---|---|
| 1 | 2/3/5/11 | 2/3/5/11 |
| 20 | 2/3/5/11 | **5/8/13/29** |
| 40 | 2/3/5/11 | **8/12/20/44** |

Corrigé en réutilisant `scaledSkillDamage`, **la fonction même qui sert
au calcul du coup** — l'affichage ne peut donc plus diverger des dégâts.

⚠️ Le bouton ET le panneau de détail passent par une seule fonction
(`degatsAffiches`). Deux calculs séparés finiraient par se contredire.

### Libellés

« Aie N pièces en réserve » → « **Accumule** N pièces en réserve »
(4 défis concernés).

## Réglages du 14/09 (3)

| Changement | Détail |
|---|---|
| Veilleur | coût −20 % (total niveau 10 : 214 830 → **171 864**) |
| Défi des Runes | nouveau, au **cycle 5** (après la 4e éclosion) |
| Tirage de rune OFFERT | valide ce défi |
| Achat de Griffes en pièces | 100 🐾, prix ancré sur la production |

### Prix des Griffes : progression simple × Ascensions

`griffesCoinCost = (20 000 + 10 000 × achats) × 1,3^ascensions`

Palier lisible — 20 000, 30 000, 40 000… — le joueur voit tout de suite
ce que coûtera le suivant.

⚠️ **Le facteur d'Ascension n'est pas cosmétique.** Chaque Ascension
multiplie la production par 1,3. Sans lui, le prix serait divisé par 13
en valeur réelle au bout de 10 Ascensions et l'achat deviendrait
gratuit. Le prix suit donc exactement la courbe des gains.

| Achat | 0 ascension | 3 ascensions | 5 ascensions |
|---|---|---|---|
| 1er | 20 000 | 43 940 | 74 259 |
| 2e | 30 000 | 65 910 | 111 388 |
| 10e | 110 000 | 241 670 | 408 422 |

### Félicitations à chaque défi d'éclosion

Petit menu « Défi réussi ! » avec le libellé du défi et l'avancement
(x/4 avant l'éclosion).

⚠️ Branché sur l'effet de VERROU (`latchedQuestIds`), pas sur un test de
complétion : le verrou repère l'instant exact où un défi est atteint et
garantit qu'il ne sera annoncé QU'UNE FOIS, même si sa valeur redescend
ensuite.

### Défi des Runes : un défi EN PLUS, validé par le tirage offert

⚠️ Le cycle 5 compte **5 défis et non 4** : celui des Runes s'AJOUTE, il
ne remplace rien.

⚠️ La rune n'est pas donnée en silence : le joueur reçoit un **tirage
gratuit** qu'il utilise dans la boutique, et c'est cet usage qui valide
le défi. Il découvre donc l'écran des Runes par lui-même, sans rien
dépenser.

Le tirage offert occupe la case « au hasard » de la boutique tant qu'il
n'est pas consommé (l'asset n'a que 3 emplacements mesurés, une 4e case
aurait débordé). Un coût nul s'affiche **GRATUIT** et non « 0 🐾 », qui
se lirait comme un prix.

⚠️ `eggStageForCompletedCount` borne à 4 : 5 défis validés ne sortent pas
de la table des paliers. Vérifié — le cycle 3 avait déjà 5 défis.

### Ascension : ce qu'elle remet à zéro (vérifié dans le code)

| Remis à zéro | Conservé |
|---|---|
| pièces, total gagné | **créatures** |
| Pacte, Faveur, critiques | **deck** |
| Sanctuaire, Veilleur | **toute la progression d'Aventure** |
| auto-clics, améliorations | essence, Griffes (créditées en plus) |
| pouvoir actif, remise | défis d'œuf (le cycle CONTINUE) |

L'Ascension ne touche donc QUE l'économie du clicker. C'est volontaire :
perdre ses monstres et sa campagne rendrait le prestige punitif au lieu
d'être une récompense — et la progression d'Aventure vit dans une autre
sauvegarde, la réinitialiser d'ici serait l'écriture croisée qu'on
s'interdit.

### ⚠️ Cycle d'imports évité de justesse

La clé de la rune offerte avait d'abord été déclarée dans
`ClickerScreen`, que `AdventureScreen` a dû importer — or l'inverse
existait déjà. **Cycle d'imports**, exactement le piège évité en
extrayant `questLogic`.

La clé vit donc dans `questLogic`, déjà importé par les deux écrans dans
un seul sens. **Règle** : toute donnée partagée entre deux écrans se
déclare dans un module de logique, jamais dans l'un des deux.

⚠️ La rune offerte ne compte PAS comme `runeBought` : le défi doit rester
à faire, elle sert à comprendre l'écran, pas à le valider.

## Réglages du 14/09 (2)

| Changement | Valeur |
|---|---|
| PV du PREMIER gardien | **−30 %** (54 → 38, combat 7 → 5 tours) |
| Dégâts du gardien, tous niveaux | **×1,2** |
| Défi « active X pouvoirs » | 7 → **5** |
| Seuil 3 étoiles | `2n+1` → **`2n+2`** |
| Plafond hors-ligne | 2 h + compte rendu avec doublement par pub |
| Aide sur les éléments | ouverte à la 1re visite, croix en haut à droite |

### ⚠️ Le +15 % de dégâts n'est pas atteignable tel quel

Les dégâts du gardien valent **1 à 6 points**, chacun arrondi à l'entier :
les petits pourcentages disparaissent. Mesuré sur 5 niveaux, l'écart
réellement obtenu ne prend que des valeurs discrètes :

| Multiplicateur | Écart réel |
|---|---|
| 1,15 | +6 % |
| **1,2** | **+11 %** |
| 1,25 | +20 % |

Aucun réglage ne donne +15 %. **1,2** est le plus proche par le dessous.

⚠️ Même piège côté stat : appliquer le bonus à `attack` PUIS arrondir
l'absorbait entièrement (2 × 1,15 = 2,3 → 2). L'attaque du gardien est
donc laissée décimale, l'arrondi n'ayant lieu qu'au calcul du coup.

### Seuil 3 étoiles — mesure par profil de joueur

| Seuil | rapide + avantage | rapide seul | moyen | LENT |
|---|---|---|---|---|
| `2n+1` (avant) | 9/9 | **4/9** | 4/9 | 0/9 |
| **`2n+2`** | 9/9 | **8/9** | 8/9 | **4/9** |
| `2n+3` | 9/9 | 9/9 | 9/9 | 8/9 ❌ |

Avant, il fallait la vitesse **ET** l'avantage élémentaire — d'où la
frustration. `2n+2` récompense l'un OU l'autre, sans devenir gratuit :
un joueur lent n'obtient encore que 4 niveaux sur 9.

### Gains hors-ligne

Compte rendu à l'ouverture (durée + montant), bouton « Doubler avec une
pub », puis « Récupérer ». Le montant de base est DÉJÀ crédité : la pub
en ajoute autant. Rien n'est affiché si le gain est nul (session courte
ou horloge reculée).

## Correctifs du 14/09 (soir)

### ⚠️ Carte d'Aventure NOIRE jusqu'au premier glissement

Le fondu entre chapitres lit `scrollY`, alimenté UNIQUEMENT par
`onScroll`. Or un défilement **programmé** n'émet pas cet événement :
`scrollY` restait à 0 alors que le contenu était déjà positionné, donc
la page affichée tombait hors de sa plage d'interpolation → opacité 0.
Le premier glissement du joueur déclenchait enfin `onScroll` et tout
apparaissait.

**Correctif** : `scrollY.setValue(y)` juste après le `scrollTo`.
**Règle** : tout défilement programmé doit synchroniser la valeur animée.

### ⚠️ Défis qui REVIENNENT EN ARRIÈRE

Un défi en mode ABSOLU porte sur une valeur qui peut REDESCENDRE :
« aie 100 000 pièces » se dé-validait dès qu'on dépensait, « atteins 70
pièces/s » dès qu'un bonus temporaire expirait. Le défi repassait alors
en cours — **et le compteur de l'œuf reculait avec lui**.

Les deux symptômes signalés avaient donc la MÊME cause.

**Correctif** : `latchedQuestIds` — un défi atteint une fois reste acquis
pour le cycle. Sauvegardé, remis à zéro au tirage, et levé par le bouton
dev « défi précédent ».

Cible du défi des pièces ramenée de 140 000 à **100 000**.

### Gains hors-ligne : plafond 2 h + anti-changement d'heure

Plafond ramené de 4 h à **2 h**.

⚠️ Le temps hors-ligne se calculait sur l'horloge de l'appareil :
avancer l'heure donnait des pièces, autant de fois qu'on voulait.

**Parade** : `trustedOfflineSeconds` tient une horloge de référence
(`clockMax`) qui **ne recule jamais**. On ne crédite que le temps écoulé
au-delà de ce repère.
- Reculer l'horloge ne rapporte rien.
- Avancer de 10 h consomme d'avance le hors-ligne des 10 h suivantes.

**Vérifié** : joueur normal intact (1 h → 1 h créditée, 6 h → 2 h
plafonnées) ; après un bond de +10 h, plus aucun gain pendant 10 h
réelles.

⚠️ **Limite assumée** : sans serveur ni horloge monotone, on ne peut pas
EMPÊCHER la manipulation — seulement la rendre non rentable.

⚠️ `clockMax` est SAUVEGARDÉ, sinon il repartirait à zéro à chaque
redémarrage et la parade ne servirait à rien.

## Le Gardien — combat en 2 manches (14/09)

Le combat durait **3 tours** et ne coûtait que **9 % des PV** du joueur.
Objectif : l'allonger SANS le rendre punitif.

| | Avant | Après |
|---|---|---|
| Tours | 3 | **7** |
| PV encaissés | 9 % | **22 %** |
| Attaque du gardien | — | **inchangée** |

### Mécanique

- **Bouclier** = 40 % des PV max. Il encaisse AVANT les PV.
- **Manche 1** : s'arrête quand le gardien a perdu la moitié de ses PV.
- **Animation**, puis il récupère **tout** (PV et bouclier).
- **Manche 2** : jusqu'à zéro.
- Total à entamer = 2 × bouclier + 1,5 × PV.

⚠️ **Le 40 % vient d'une mesure, pas d'un réglage au jugé** : à 25 % le
combat restait court (5 tours), à 60 % il dépassait la fourchette visée.
40 % place à 7 tours / 22 %, sans toucher aux dégâts du gardien — c'est
ce qui allonge le combat **sans** le durcir.

⚠️ **Allonger un combat le durcit mécaniquement** (plus de tours = plus
de ripostes). Si un jour on rallonge encore, il faudra baisser l'attaque
du gardien en proportion pour rester neutre.

### Affichage

Barre de PV **pleine largeur en haut**, bouclier juste en dessous,
repère à 50 % qui montre où s'arrête la manche 1. Posée en `position:
absolute` : elle doit occuper toute la largeur quelle que soit la mise
en page du terrain.

⚠️ Vérifié que le bloc (55 dp) ne chevauche pas le sprite agrandi, dont
le bord haut est à 82 dp.

Le gardien est **agrandi de 70 %** (177 dp contre 104 pour une créature)
et recentré, pour qu'il pèse à l'écran.

⚠️ À la reprise, la main revient au JOUEUR (`setPhase('choosing')`) :
sinon il encaisse un coup gratuit juste après l'animation.

## Le Gardien (14/09)

Adversaire du combat qui protège l'éclosion d'un œuf. **Ce n'est PAS une
créature du roster** : on ne peut ni l'obtenir, ni l'invoquer, ni le
faire évoluer.

⚠️ Défini dans `combatLogic.js` (`GUARDIAN_CREATURE`) et **surtout pas**
dans `CREATURES` — sinon il apparaîtrait dans la collection, dans le
gacha et parmi les adversaires d'Aventure, qui se construisent tous à
partir de cette liste.

⚠️ Une seule apparence, donc un seul `stages`. `creatureArtSource`
ramène tout palier demandé au dernier disponible : une entrée d'art
suffit, rien à adapter.

⚠️ Ses compétences sont écrites À PLAT : `mkSkills` est privée à
`clickerLogic`, et l'exporter juste pour ça élargirait sa surface
publique sans raison. Le format produit est reproduit à l'identique.

`CombatScreen` accepte désormais `opponentOverride`. Avant, le combat
d'éclosion tirait une créature du roster au hasard — le joueur
affrontait donc parfois sa propre espèce.

Stats laissées à la formule commune : elles se calent sur le niveau du
gardien comme un adversaire d'Aventure (PV 48 au niveau 1, 99 au niveau
30). Profil de défenseur : un mur à franchir, pas un tueur.

## Sources de Diamants et Offrande (14/09)

| Source | Montant | Fréquence |
|---|---|---|
| Boss de tap | 1 à 3 💎 | plafond 21/jour |
| **Fin de chapitre** | **10 💎** | une seule fois par chapitre |
| Défis quotidiens (les 3 plus durs) | 1 💎 | ~1/jour |
| Défis hebdomadaires | 3 💎 chacun | 18/semaine |
| Succès | 2/5/10/20/40 💎 | une fois par palier |

⚠️ **Fin de chapitre : UNIQUEMENT à la première victoire.** La condition
`levelNumber === currentUnlockedLevel` le garantit — sans elle, rejouer
le niveau 10 en boucle serait une source infinie de Diamants.

⚠️ Les défis ne peuvent pas créditer les Diamants eux-mêmes (ils vivent
dans le Clicker) : ils déposent le dû dans `PENDING_DIAMONDS_KEY`, que le
Clicker encaisse à son ouverture puis EFFACE. Même canal que les Griffes.

### Offrande : récompense refaite

`tapPower × 15` était LINÉAIRE alors que les coûts DOUBLENT. Mesuré :
53 % d'une amélioration au niveau 1, **1 % au niveau 10, 0,002 % au
niveau 20**.

⚠️ Essai intermédiaire ÉCARTÉ : « X minutes de production ». La
production croît bien moins vite que les coûts — la valeur s'effondrait
quand même (0,48 % au niveau 30) tout en étant absurde au début (96
améliorations d'un coup au niveau 1).

Retenu : **30 % de la prochaine amélioration de Pacte**. Seule ancre qui
suit la courbe des coûts par construction. Mesuré : valeur constante à
30 % du niveau 5 au niveau 50, et le plafond de 21 💎/jour vaut ~6
améliorations.

### Diamants d'Offrande autour de l'œuf

⚠️ **Ils n'expirent JAMAIS et sont sauvegardés** (`PENDING_OFFERINGS_KEY`,
clé propre). Le joueur peut enchaîner plusieurs Offrandes et les ramasser
plus tard, y compris après avoir fermé l'appli : le Diamant est déjà
dépensé, perdre la récompense serait un vol. Le montant est figé à la
pose, pas au ramassage.

⚠️ **Placement choisi par RECHERCHE, pas au jugé** : pas de 150°, rayon
qui grandit tous les 4. Avec un pas de 72°, la 6e Offrande retombait
exactement sur la 1re (72 × 5 = 360°). Mesuré sur 12 Offrandes : écart
minimal de 15 % de l'écran pour des bulles de 10,7 % — aucune
superposition.

## ⚠️ « Rendered fewer hooks than expected » — le piège s'est REPRODUIT

Survenu au lancement du premier niveau (14/09). Cause : le `useEffect`
du saut de carte avait été placé **après** le `if (activeBattle) return`
de `ChapterMapScreen`. Dès qu'un combat démarrait, ce Hook n'était plus
appelé — React comptait moins de Hooks d'un rendu à l'autre et plantait.

C'est EXACTEMENT le piège déjà documenté quelques lignes plus haut dans
ce même composant pour l'effet de réarmement. Il s'est reproduit parce
que le nouveau Hook a été écrit près du code qu'il pilote, pas près des
autres Hooks.

**Règle** : dans `ChapterMapScreen`, tout Hook va AVANT
`if (activeBattle)`. Les valeurs dont il a besoin se recalculent sur
place (elles dérivent toutes de `currentUnlockedLevel`) plutôt que
d'être lues plus bas.

**Contrôle automatisable** — pour chaque composant, aucun appel `useX`
de premier niveau ne doit se trouver après un `return` de premier niveau
autre que le dernier. Vérifié sur tout le projet : 0 cas.

## Carte d'Aventure : le saut au bon chapitre (3e écriture)

⚠️ Les deux versions précédentes dépendaient d'un MINUTAGE et sont
retombées en panne :
1. `onLayout` du ScrollView — les pages n'existaient pas encore.
2. `onLayout` de la page du chapitre — **ne se redéclenche pas au retour
   d'un combat** (la mise en page n'a pas changé).

Désormais un EFFET observe hauteur de page, chapitre visé et un JETON
réarmé au retour de combat. Plus aucune course : quand la hauteur est
connue, les pages sont forcément rendues (elles ne le sont que dans ce
cas). Une seconde tentative à la frame suivante couvre un décalage de
contenu tardif.

## Boss de tap : règles d'apparition (14/09)

| | Valeur |
|---|---|
| 1er boss d'une session | **2 min de jeu actif** |
| Suivants | **20 min de jeu actif** |
| Plafond | **2 par heure glissante** (temps RÉEL) |
| Plafond quotidien | 21 💎 (inchangé) |

⚠️ **Le plafond horaire est le garde-fou.** Le compteur de jeu actif
repart à zéro à chaque ouverture : sans lui, fermer et rouvrir toutes
les 2 minutes suffirait à enchaîner les boss et à vider le plafond
quotidien en quelques minutes.

⚠️ **Les horodatages sont SAUVEGARDÉS** et écrits dès l'apparition (pas
à la résolution) : fermer l'appli juste après ne remet rien à zéro.

**Vérifié par simulation** :

| Scénario | Boss |
|---|---|
| session de 5 min | 1 (à la minute 2) |
| session de 25 min | 2 (minutes 2 et 22) |
| session de 3 h | 6 (soit 2/heure) |
| **triche : 30 sessions de 2 min en 1 h** | **2** |
| 4 sessions de 10 min espacées | 4 |

⚠️ **Point d'entrée UNIQUE `spawnBoss()`** : l'apparition normale et le
bouton développeur passent par la même fonction, donc aucun risque que
l'une oublie une étape que l'autre fait (remise à zéro du compteur,
historique, sauvegarde).

Bouton dev « 👹 Boss » dans la rangée d'outils. Il ne dépend pas de
l'état de l'œuf, contrairement aux deux autres.

⚠️ **Piège rencontré en réécrivant ce fichier** : le bloc remplacé
contenait aussi `TAP_BOSS_DAILY_DIAMOND_CAP`, supprimé sans le vouloir
alors qu'il restait UTILISÉ plus bas — l'app aurait planté. Comparer les
exports avant/après est ce qui l'a détecté.

## Offrande ramenée à 1 Diamant (14/09)

À 10, elle coûtait la moitié du plafond QUOTIDIEN de Diamants (21).

⚠️ **Sa récompense reste à revoir** : `offrandeReward` est LINÉAIRE
(`tapPower × 15`) alors que les coûts DOUBLENT à chaque niveau. Mesuré :
l'Offrande vaut 53 % d'une amélioration de Pacte au niveau 1, **1 % au
niveau 10, 0,002 % au niveau 20**. Baisser le prix ne suffit donc pas —
la formule elle-même est à changer (décision en attente).

## ⚠️ Montants invisibles en boutique (14/09) — 2e occurrence, autre cause

Signalé deux fois. **Ce n'était PAS le même bug** que `6cff4ff`
(débordement de ligne) : ce correctif est toujours en place et toutes les
lignes de prix le portent.

### Mesuré sur capture, pas supposé

| Ligne | Libellé | Montant | Pixels dorés à droite |
|---|---|---|---|
| Pacte (estompée) | court | 14.3K | dessiné |
| Sanctuaire | moyen | 168 | **1054** |
| Faveur des Esprits | long | 1.3K | **43** (bruit JPEG) |
| Dégâts critiques | long | 1.7K | **43** |

Le montant réservait bien sa place (~92 px à droite de la bourse) mais
n'était **jamais peint**. Ce n'était donc ni le format ni la longueur du
nombre — une ligne au libellé COURT affichait un montant PLUS long
(14.3K). C'est la **négociation de largeur** entre la colonne gauche et
le montant qui échouait quand le libellé était long.

⚠️ **`flexShrink: 0` ne suffit pas.** La négociation est supprimée, pas
réglée : `minWidth: 84` + `textAlign: 'right'` + `numberOfLines={1}` sur
les 7 montants. La colonne gauche (déjà `minWidth: 0 / flexShrink: 1`)
se replie autour.

### Second bug trouvé en vérifiant la largeur

`formatNum` s'arrêtait au suffixe « T ». Au-delà elle renvoyait
`141976867225561694208.00T` — **27 caractères**. Le coût du Pacte double
à chaque niveau et les niveaux sont illimités : le cas est ATTEIGNABLE.
Échelle complétée jusqu'à « Dc », puis notation exponentielle.

⚠️ **La largeur réservée est justifiée par la mesure** : la chaîne la plus
longue possible sur tout le domaine fait **8 caractères** (« 142.00No »),
soit 77 dp — d'où les 84 dp. Vérifié en exécutant la fonction telle
qu'elle est DANS le fichier, pas une copie.

## Rééquilibrage PvE (14/09) — fin du one-shot

**Signalement** : un joueur bloqué au chapitre 1 niveau 9, « les
créatures adverses tuent mes monstres en un coup », « pas assez de
Griffes ».

⚠️ **Le manque de Griffes était la CONSÉQUENCE, pas la cause.**

### Les deux causes réelles, mesurées

1. **`OPPONENT_ATTACK_MULT` à 5,0.** Les dégâts adverses ne sortent pas
   de cette stat directement : ils valent `dégâts de la compétence ×
   (ATQ actuelle / ATQ de base)`. À 5,0 ce rapport atteignait **8 à 12**,
   et les compétences frappaient à **49/65/98/147 contre 38 PV** au
   niveau 9. Chaque coup tuait. Or **2 étoiles = gagner SANS perdre de
   créature** : mécaniquement impossible, donc plus de progression.
   Le 5,0 avait été posé pour corriger « les adversaires ne font aucun
   dégât », mais la vraie cause était un bug de riposte corrigé depuis.
2. **Le chapitre 1 était le pic de difficulté du jeu.** Le budget était
   divisé par la taille d'équipe : 45 par adversaire au niveau 10, **24
   au niveau 11** — le chapitre 2 était deux fois plus facile.

### Réglages retenus

| Paramètre | Avant | Après |
|---|---|---|
| `OPPONENT_ATTACK_MULT` | 5,0 | **0,3** |
| Budget | 26 × 1,062^n (exponentiel) | **44 × `levelMultiplier(n+3)`** |
| Division par taille d'équipe | ÷ n | **÷ n^0,3** |
| Compétences des 8 communes | ratio dégâts/ATQ 0,85 | **× 1,4 → ratio 1,19** |

⚠️ **Le budget suit désormais la courbe DU JOUEUR** (`levelMultiplier`),
décalée de 3 niveaux — l'économie permet de financer une créature au
niveau de l'étape +3 à +5 (mesuré). L'ancienne courbe exponentielle
donnait à l'adversaire un facteur 2,4 d'avance au niveau 40.

⚠️ **Base 44 et pas plus** : à 50, 56 ou 62, une équipe faible qui ne
monte pas ses créatures tombe à 46-93 % de victoires.

⚠️ **Les communes étaient DÉJÀ inutilisables avant** (0 à 27 % de
victoires selon le niveau) — ce n'était pas une régression du
rééquilibrage. Leur ratio dégâts/ATQ (0,85) était sous celui des peu
communes (1,14) ; le × 1,4 l'aligne.

### Résultats (100 combats par point, modèle exact : compétences, mana, riposte unique)

| | Avant | Après |
|---|---|---|
| 3 communes | 0 à 100 % selon le niveau | **99-100 % partout** |
| Équipe mixte, pire cas | — | **100 % partout** |
| Créatures perdues | jusqu'à 2 sur 3 | **0** |
| Coups encaissés | **1** (one-shot) | **2,1 à 7,8** |
| Durée des combats | 1-4 tours | 2-6 tours |

⚠️ **Le seuil 3 étoiles (2n+1) n'a PAS été touché** : il redevient
atteignable de lui-même. Vérifié qu'il reste mérité — accordé à une
équipe investie, refusé à une équipe faible à tous les niveaux.

⚠️ **Mesuré SANS autoclicker** (référence 4 taps/s, vérifié de 2,5 à
6,7). L'autoclicker ne fait plus gagner que ~0,4 tour : l'équilibrage
ne repose plus sur lui.

## Étoiles de note en image (14/09)

`assets/icons/star.png` remplace les caractères `★`/`☆` partout :
carte des chapitres, écran de fin de combat, et palier d'évolution d'une
créature (2 endroits). Composant commun `StarRow` dans
`AdventureScreen.js`.

⚠️ **Une seule image pour les 3 étoiles.** Les « vides » sont la MÊME
image recolorée par `tintColor: '#4a3a1c'` — silhouette identique. Une
simple baisse d'opacité laissait lire une étoile dorée pâlie, pas une
étoile vide.

⚠️ **Sur la carte, les étoiles passent AU-DESSUS du niveau**, mais
repassent DESSOUS quand il n'y a pas la place (`starsFitAbove`). Sans ce
repli, les niveaux 10 — collés au haut de l'écran — envoyaient leurs
étoiles sous les boutons ou hors de l'écran. **Vérifié sur les 120
niveaux : 6 cas basculent**, tous des niveaux 10.

⚠️ Taille retenue **12 dp** (rangée de 40 dp pour un nœud de 38) après
comparaison : à 13 dp avec un décalage de 15, ce sont **10** niveaux qui
basculaient ; à 11 dp la lisibilité chutait sans gain réel.

⚠️ `HEADER_BOXES` (emprise des boutons en dp) est MESURÉE sur des
captures 2000×923, pas estimée. À remesurer si l'en-tête change.

## Itinéraires : la RÉFÉRENCE, ce sont les tracés de l'auteur (14/09)

Après trois passes de calcul automatique restées imparfaites, l'auteur a
**dessiné le chemin exact** (trait rouge) sur des captures des chapitres
1-8, 10 et 11. `chapterRoutes.js` suit ces traits au pixel. **Ne pas les
recalculer automatiquement.** Les chapitres 9 et 12 restent en calcul
automatique jusqu'à réception de leur tracé.

### Comment lire un tracé annoté (procédure, réutilisable)

1. **Identifier le chapitre par corrélation** avec les fonds, pas à l'œil
   (écart ×4 entre le bon chapitre et le suivant).
2. **Couleur du trait mesurée** : (185, 53, 53), dispersion ±10. Seuil
   de distance 17. ⚠️ La lave et les plantes rouges du ch11 passent le
   seuil : on écarte les morceaux dont le squelette fait moins de 80 px
   (un trait est une ligne, une plante est une tache).
3. **Correspondance capture → page** : captures 2000×923 avec une bande
   noire de 19 px en haut (les 8 dp de `paddingTop` de l'app).
   `u = x / 2000`, `v = (y − 19) / 904`. Vérifiée : 10/10 niveaux sur
   leur pastille sur 9 chapitres.
4. **Niveaux déplacés par le trait** : un niveau à plus de 70 px du
   trait est déplacé sur l'extrémité de trait la plus proche non déjà
   occupée. Trois cas : ch10 niveaux 5 et 10, ch11 niveau 10 (les
   plateformes peintes). Le seuil de 70 évite un faux déplacement quand
   l'auteur commence le trait à côté de la pastille (ch11 niveau 1, à
   50 px).
5. **Plus court chemin contraint SUR le trait** entre niveaux
   consécutifs (coût 1 dessus, 12 à moins de 10 px, 400 ailleurs), puis
   simplification à 4 px de capture (≈ 1,7 dp).
6. ⚠️ **Revérifier l'en-tête pour les niveaux déplacés** : le ch11
   niveau 10 chevauchait le compteur de Griffes de 3 dp — descendu de
   8 dp, il reste sur sa plateforme. Emprise réelle des boutons, mesurée
   sur les captures : Éléments x 584-676 / y 13-43 dp, Griffes+Énergie
   x 687-836 / y 13-44 dp.
7. **Contrôle final** : superposer les pointillés obtenus SUR les captures
   annotées, par-dessus le trait rouge — tout écart saute aux yeux.

### Ce que les passes automatiques ont appris (gardé pour ch9/ch12)

#### Calcul automatique (chapitres sans tracé annoté)

`chapterRoutes.js` : par chapitre, **9 tronçons** (niveau 1→2 … 9→10),
chacun une polyligne en fractions de page. Mesurés sur l'image — même
principe que les plans.

### Construction (4 étapes, chacune corrige un défaut constaté)

1. **Isoler l'ÎLE** par la texture (elle a des contours, le ciel et les
   nuages sont lisses). Sans ça, 30 % du ciel rouge du chapitre 11 était
   pris pour du sol et le chemin passait AU-DESSUS de l'île.
2. **Apprendre la couleur du SENTIER** sur chaque île : disque autour de
   chaque niveau (ils sont posés dessus), en ne gardant que les pixels
   **peu saturés** — l'herbe et l'eau sont saturées, un sentier ne l'est
   pas. Puis **palette de 2 teintes** (k-moyennes) : un sentier mêle
   dalles claires et terre sombre, une couleur unique le ratait.
3. **Seuil choisi AUTOMATIQUEMENT par île** (de 26 à 70 selon l'image).
   ⚠️ Critère : le masque doit **RELIER les niveaux consécutifs**.
   Choisir « le plus petit masque » donnait un réseau minuscule qui ne
   reliait plus rien et le chemin partait hors piste.
4. **Privilégier les voies LARGES.** ⚠️ Défaut constaté : les margelles
   de bassins et les bordures de terrasses sont de la MÊME pierre claire
   que les sentiers, donc le chemin les escaladait et coupait à travers
   les terrasses. Mesuré : sous les niveaux la voie fait **16 à 30 px de
   demi-largeur**, contre une **médiane de 5 à 7** pour l'ensemble du
   masque — le discriminant est donc la largeur, pas la couleur.
5. **Carte de coût** : ~1 sur une voie large (demi-largeur ≥ 11), 25 sur
   une voie moyenne (≥ 6), 90 sur un liseré étroit, 300 hors sentier mais
   sur l'île, 3000 hors de l'île. Puis plus court chemin.

⚠️ **Traversée des vides et cascades** : toute portion hors sentier de
plus de 8 px est remplacée par une **ligne droite** entre son entrée et
sa sortie — on fait comme s'il y avait un pont. Sans ça le chemin
contournait et partait en hors-piste. Des pointillés dans le vide ne
gênent pas, un détour absurde si.

### Rendu

⚠️ Pastilles réparties **également sur chaque tronçon** (~21 dp visés,
pas ajusté à la longueur du tronçon). Un pas constant sur tout le chemin
laissait des tronçons à 2 pastilles et d'autres à 6.

⚠️ Pas de pastille à moins de **27 dp d'un niveau** (elle disparaîtrait
dessous) ni à moins de **14 dp d'une autre** — c'est ce qui supprime les
chevauchements quand le chemin repasse près de lui-même (double
passage).

Les chapitres sans itinéraire gardent l'ancienne courbe.

## Décor par chapitre — méthode (13/09)

`CHAPTER_SCENES[n] = { bg, path }`. Le chapitre 1 a son île
(`adventure/chapter-1.jpg`) ; les chapitres sans décor retombent sur les
4 tracés génériques.

## ⚠️ Nombre de pages affichées, et mémoire des décors (13/09)

**Bug réel** : 12 îles dessinées, mais seulement **7 chapitres visibles**.
`chaptersToShow` valait `currentChapter + 6` — un joueur au chapitre 1
ne voyait donc que 7 pages et tout le travail d'illustration restait
invisible. Corrigé : `Math.max(currentChapter + 6, dernier chapitre
illustré)`. Au-delà du dernier illustré, la règle du +6 reprend, donc
rien n'est retiré à un joueur avancé.

⚠️ **Conséquence à ne pas ignorer** : un ScrollView monte TOUS ses
enfants. Un fond décodé pèse ~2,9 Mo (1400×538 × 4 octets), soit 34 Mo à
12 chapitres et **86 Mo à 30** — intenable.

**Seul le décor des pages voisines est monté** (page courante ±1, suivie
via `onMomentumScrollEnd` / `onScrollEndDrag`) : ~8,6 Mo quel que soit le
nombre de chapitres. Le ±1 est indispensable, c'est la page voisine qui
apparaît pendant le glissement. Avant le premier défilement,
`visiblePage` est nul et l'on se rabat sur la page visée à l'ouverture.

## Chapitres 1 à 8 en place (13/09)

| Ch. | Thème | Plan | Calage |
|---|---|---|---|
| 1 | Forêt | A | 10 plateformes détectées |
| 2 | Ruines de jungle | B | sol praticable |
| 3 | Ruines envahies | C | sol praticable |
| 4 | Île céleste | D | sol praticable |
| 5-8 | Eau (lagons, geysers) | A, B, C, D | 10/8/9/10 sur plateformes |
| 9-10 | Air (pics, moulins) | A, B | 10/10 et 8/10 |
| 11-12 | Feu (lave, cratères) | C, D | 9/10 chacun |

**12 chapitres illustrés** (niveaux 1 à 120). Au-delà, les tracés
génériques prennent le relais sans rien casser.

⚠️ **Détecteur de plateformes revu** : un seuil de couleur absolu ne
marche que sur fond clair. Sur une île de lave ou de cendres, les
plateformes sont sombres. Critère retenu : **plus claires que leur
VOISINAGE** (`lum − flou local > 14`) et peu saturées. C'est ce qui
donne 10/10 sur les pics rocheux et 9/10 sur la lave.

Le plan de chaque île a été **déduit par mesure**, jamais supposé
d'après l'ordre d'envoi. Les 4 derniers étaient sans équivoque :
proximité au bon plan de 0,009 à 0,053, contre 0,09 à 0,17 pour les
autres.

⚠️ **Quand l'IA peint des plateformes, les utiliser directement** :
assigner chaque point du plan à la plateforme libre la plus proche
(seuil 0,085), et ne retomber sur le sol praticable que si aucune n'est
assez près. C'est ce qui donne 10/10 sur les chapitres 5 et 8.

### Procédure définitive pour un nouveau décor

1. **Déduire le plan suivi**, ne pas le supposer d'après l'ordre d'envoi :
   tester les 4 plans contre le masque de sol et garder celui dont le
   plus de points tombent dessus. Chapitres 3 et 4 : **9/10** pour C et
   D respectivement, contre 0 ou 1 pour les autres — sans ambiguïté.
2. **Recaler** chaque point du plan sur le maximum de la carte de
   distance dans un rayon de 90 px (puis 140, 200, 280).
3. **Exclure les zones d'en-tête AVANT la recherche**, pas après. Vérifié
   sur le chapitre 3 : sans exclusion, le recalage remontait le niveau 10
   sous les boutons de droite.
4. Valider : écart min ≥ 46 dp, zéro croisement, aucun nœud sous un
   bouton. Ch.3 : 95 dp / 0 / aucun. Ch.4 : 77 dp / 0 / aucun.

⚠️ **Piège de calcul** sur l'exclusion : un nœud gêne si, EN
COORDONNÉES ÉCRAN, `y − rayon < 58`. Écrire `y + rayon < 58` (mon erreur)
ne bloque rien du tout.

### Deux méthodes de calage selon ce que l'IA a peint

⚠️ **Aucune méthode ne marche sur toutes les îles.** À vérifier à chaque
nouveau décor.

**1. L'île a des PLATEFORMES visibles** (chapitre 1) → les détecter
(zones claires peu saturées, forme constante) et poser un niveau sur
chacune.

**2. L'île n'en a PAS** (chapitre 2 : la détection n'y trouvait que 2
disques) → masque du **sol praticable** (dalles et sentiers : clair, peu
vert, 7% de l'image), puis **sommets de la carte de distance** pour
trouver les emplacements les plus dégagés, puis mise en ordre ascendante
à la main.

⚠️ **L'ORDRE vient TOUJOURS du guide, jamais d'une reconstruction.**
Erreur commise sur le chapitre 2 : j'avais rebâti un ordre ascendant
depuis l'île, ce qui a inversé le sens du parcours (niveau 1 à gauche au
lieu de la droite). Gemini avait pourtant bien suivi le plan — 5 des 10
points du tracé B tombaient déjà sur du sol.

**La bonne méthode** : garder l'ordre du guide et RECALER chaque point
sur le sol le plus dégagé dans un rayon de 90 px (élargi à 140 puis 200
si rien). Sur le chapitre 2, déplacements de 7 à 123 px seulement.

⚠️ L'échec initial du recalage venait de l'algorithme, pas de la
méthode : érosion 15×15 (ne laissait que 0,6% de l'image) et exclusion
mutuelle des points, ce qui faisait sauter certains niveaux de 800 px.
Chercher le **maximum de la carte de distance dans un rayon borné**,
sans exclusion.

### Le chemin n'est JAMAIS peint par l'IA

Une image-guide (ligne rouge + 10 cercles numérotés, même rapport que la
page) est fournie à Gemini, qui peint l'île AUTOUR. Le chemin et les
nœuds restent dessinés en code.

⚠️ **Puis on MESURE les plateformes réellement peintes** et on cale le
tracé dessus — on ne suppose pas que l'IA a suivi le guide. Détection :
zones claires peu saturées, de forme constante (~59×33 px). Sur le
chapitre 1, 10 plateformes trouvées (une 11ᵉ détection était un nuage,
écartée à la vérification visuelle). Gemini avait bien suivi : écart
maximal de 0,03 avec le tracé générique — mais c'est la mesure qui fait
foi.

⚠️ **Rapport de l'image = rapport de la page** (2,602). C'est ce qui
permet de lire les fractions de l'image directement comme fractions de
page.

⚠️ **Convention des tracés changée** : `CHAPTER_PATHS` est désormais en
fractions de page `(u, v depuis le HAUT)`, plus en marges + taille de
nœud. Sans ça, impossible de poser un niveau sur une plateforme peinte,
les deux n'étant pas dans la même unité.

⚠️ Sur un décor clair, la pastille sombre se noie : `levelNodeOnScene` et
`pathDotOnScene` renforcent le contour en blanc.

### ⚠️ Bug trouvé au passage : nœuds décalés de 4 px

Le style `levelNode` avait `width: 46` EN DUR alors que
`LEVEL_NODE_SIZE` valait 38, et c'est la constante qui sert au
positionnement (`left: x - SIZE/2`). Chaque nœud était donc décalé de
4 px. La taille dérive maintenant de la constante.

## Carte des chapitres — une page par chapitre (13/09)

Refonte complète : **un chapitre = une page plein écran**, on change de
chapitre en glissant (`pagingEnabled`), et à l'intérieur d'un chapitre
il n'y a plus AUCUN défilement.

⚠️ **Les pages sont ordonnées À L'ENVERS** : chapitre 1 en BAS, les
suivants AU-DESSUS. Le joueur gravit la carte — pour voir la suite il
monte, il ne descend plus. `chapterPages = [N … 1]`, et l'index du
chapitre courant vaut `chaptersToShow - currentChapter`.

⚠️ De même dans un chapitre : **niveau 1 en bas, niveau 10 en haut**.

⚠️ **`pagingEnabled` cale son pas sur la hauteur du ScrollView.** Chaque
page doit donc mesurer EXACTEMENT cette hauteur, mesurée par `onLayout`.
La moindre marge sur une page ferait dériver toutes les suivantes —
`chapterBlock` n'a plus aucune marge.

⚠️ **Le saut initial est déclenché par le `onLayout` de LA PAGE du
chapitre courant**, qui fournit directement son `y` dans le contenu.
Deux tentatives ont échoué avant : le `onLayout` du ScrollView (les
pages n'existent pas encore, contenu de hauteur 0, position ramenée à 0),
puis `onContentSizeChange` (dépendant de l'état `pageH` propagé au bon
moment). La page qui dit elle-même où elle est ne suppose rien et
n'entre en course avec rien.

⚠️ **Rien n'est rendu tant que `pageH` vaut 0** : les positions se
calculent à partir de la hauteur de page, et à 0 les nœuds partiraient
en coordonnées négatives.

### Les tracés sont POSÉS À LA MAIN — 4 variantes, une par chapitre

`CHAPTER_PATH` : 10 positions en fractions (largeur, hauteur depuis le
bas). Toutes les formules essayées donnaient un mauvais résultat —

| Essai | Défaut |
|---|---|
| Sinusoïde 1 à 2,5 périodes | zigzag mécanique, gros vide au centre |
| Serpentin 5 rangées × 2 | nœuds empilés verticalement, illisible |
| Recherche aléatoire optimisée | meilleur écart, mais le chemin SE CROISE |

Le tracé retenu balaie la largeur, tourne au bord, repart en sens
inverse et monte — un vrai sentier. **Mesuré sur 825×317 : écart minimal
102 dp (nœuds de 38), pas de 150 à 210 dp, ZÉRO croisement de
segments.** Taille de nœud passée de 46 à 38.

⚠️ Les x sont rentrés d'un demi-nœud (`fx * (pathW - NODE) + NODE/2`),
sinon les niveaux des extrémités seraient coupés par le bord.

⚠️ **Critère à vérifier pour tout nouveau tracé** : écart minimal ≥ taille
de nœud + marge, ET aucun croisement entre segments non consécutifs. Un
tracé qui se croise reste illisible même bien espacé.

**`CHAPTER_PATHS` contient 4 tracés**, choisis par
`(chapterNum - 1) % 4` : deux chapitres consécutifs n'ont donc jamais la
même carte.

| Tracé | Allure | Écart min | Croisements |
|---|---|---|---|
| A | balayage gauche → droite | 105 dp | 0 |
| B | miroir, départ à droite | 105 dp | 0 |
| C | triple vague | 79 dp | 0 |
| D | départ au centre, grand tour | 88 dp | 0 |

Les 4 ont été validés aux mêmes critères avant d'être retenus.

Le titre « ⚔️ Combat » est retiré de l'en-tête, et le bouton **Éléments**
quitte le coin bas gauche pour se placer **à gauche des Griffes** : il se
consulte avant un combat, sa place est dans l'en-tête. Son style perd sa
`position: 'absolute'` et son `zIndex`, il est maintenant dans le flux.

Le libellé « Chapitre N » est supprimé (chaque page EST un chapitre) et
remplacé par des **pastilles au bord droit**. Griffes et énergie passent
dans le coin haut droit, avec le reste de l'en-tête.

## Révélation animée des achats (13/09)

Acheter dans la boutique ouvre une surcouche : les pierres obtenues
apparaissent une à une avec un « pop » (échelle 0,2 → 1,18 → 1) et un
halo à leur couleur. Toucher l'écran ferme.

⚠️ **Les 3 achats RENVOIENT les runes tirées** (`[rune]` / `drawn`), et
`null` si l'achat n'a pas eu lieu (Griffes insuffisantes, offre du jour
déjà prise). C'est ce `null` qui empêche l'animation de se déclencher
sur un achat refusé.

⚠️ **UNE seule `Animated.Value` pilote toute la séquence**, chaque pierre
lisant une plage décalée de cette même valeur. Bien plus sûr que N
animations parallèles : aucune désynchronisation possible et un seul
`stop()` à faire au démontage.

⚠️ Les plages d'interpolation doivent être **strictement croissantes**
et rester `< 1`. Vérifié pour 1, 2 et 3 pierres avant de pousser — une
borne non croissante fait planter RN à l'exécution, pas à la compilation.

⚠️ Le halo est **recoloré par `tintColor`** : une seule image
(`glow-gold.png`) sert aux 7 couleurs de runes, puisque `tintColor`
remplace le RVB en gardant l'alpha.

⚠️ La surcouche est rendue **en DERNIER** parmi ses frères : c'est
l'ordre du JSX qui décide de l'empilement, elle doit passer au-dessus de
l'inventaire.

## Les pierres apparaissent aussi dans la boutique (13/09)

L'offre spéciale montre **la pierre du type réellement en vente ce
jour** : le joueur doit voir quelle rune il achète avant de payer. Le
pack montre 3 pierres (exemples — le tirage reste aléatoire sur les 7).
Le tirage à l'unité garde le dé : c'est le hasard qu'il représente.

## ⚠️ Un style empilé APRÈS une boîte mesurée l'écrase (13/09)

Bug réel : le détail de la rune sortait de son cadre. Cause —

```js
<View style={[box(INV_DETAIL_ZONE), styles.invDetailCol]}>
```

`invDetailCol` gardait `width: '34%'` et `marginLeft: 10` de l'ancienne
mise en page en colonnes. Le tableau de styles applique le DERNIER
gagnant : la largeur mesurée (0,244 du panneau) était donc remplacée par
0,34, et la marge décalait le tout. Mesuré sur la capture : **+93 px de
décalage et 40 % trop large**.

⚠️ **Une boîte positionnée par des fractions mesurées ne doit JAMAIS
être suivie d'un style qui redéfinit `width`, `margin` ou `padding`
horizontal.** Vérification automatisable : chercher les empilements
`[box(...), styles.X]` et contrôler que `X` ne porte aucune dimension.

⚠️ Vestige typique : ces propriétés venaient d'une mise en page
abandonnée deux itérations plus tôt. Après un changement de structure,
relire les styles réutilisés, pas seulement le JSX.

Le bouton RETOUR commun remplace la croix dessinée (un seul geste de
sortie), et le bouton d'ouverture de l'inventaire est désormais calé sur
son texte : hauteur 26, padding 14, police 10.

## Pierres runiques dessinées (13/09)

Les 7 emoji sont remplacés par des pierres illustrées
(`assets/icons/runes/{force,vitalite,celerite,dexterite,affinite,butin,resilience}.png`).
Le champ `icon` (emoji) est CONSERVÉ dans `RUNE_TYPES` : une `Alert`
native ne peut pas afficher d'image.

⚠️ **Association vérifiée par la COULEUR, pas par l'ordre des fichiers** :
teintes mesurées 1° (rouge/force), 155° (vert/vitalité), 183°
(cyan/célérité), 268° (violet/dextérité), 22° (orange/affinité), 43°
(doré/butin), saturation 0,11 (argent/résilience). Se fier au seul ordre
d'envoi aurait pu intervertir deux runes sans que rien ne le signale.

⚠️ Les pierres sont utilisées **partout** : grille d'inventaire, choix
d'une rune à équiper, emplacements de la fiche créature. Laisser un
emoji quelque part aurait trahi le reste.

### Texte d'effet en DEUX morceaux

`runeEffectText()` renvoie `{ simple, value }` : une phrase
compréhensible par un enfant, puis le chiffre exact.

| Rune | Phrase | Valeur (niv.5) |
|---|---|---|
| Force | Tes coups font plus mal. | +27% d'attaque |
| Vitalité | Tu as plus de vie. | +32% de vie |
| Célérité | Tes attaques frappent plus fort. | +0,70 de dégâts |
| Dextérité | Moins de tapes pour attaquer. | −60% de tapes |
| Affinité | Très fort contre le bon élément. | +0,45 si avantage |
| Butin | Tu gagnes plus de griffes. | +45% de griffes |
| Résilience | Tu survis à un coup mortel. | 1× par combat, à 30% de vie |

⚠️ La valeur reste tirée de `RUNE_BONUS_TABLE` : la phrase peut être
simplifiée, **le chiffre ne peut pas mentir** après un rééquilibrage.

⚠️ Bouton d'ouverture dimensionné par son TEXTE (hauteur 34, padding
26), pas par la largeur de colonne : à 100% il faisait 379×98 dp.

⚠️ La surcouche utilise le `BackButton` commun, en haut à gauche comme
partout ailleurs — la croix dessinée sur le cadre reste tapable en plus.

## Panneau d'inventaire dédié (13/09)

`inventory-panel.png` (1000×572, ratio 1,748) remplace le cadre en bois.
`collection-panel.png` supprimé, plus rien ne l'utilisait.

| Repère (fractions) | Valeur |
|---|---|
| Zone grille (gauche) | x 0,038-0,704 · y 0,224-0,939 |
| Zone détail (droite) | x 0,719-0,965 · y 0,224-0,939 |
| Plaque de titre | x 0,280-0,680 · y 0,015-0,085 |
| Croix de fermeture | x 0,952-0,998 · y 0,030-0,105 |

⚠️ **Les deux zones intérieures sont SOMBRES, pas des trous** (Gemini ne
les a pas rendues en magenta) : le contenu se pose PAR-DESSUS, il n'y a
rien à détourer à l'intérieur.

⚠️ **La croix dessinée EST le bouton** : un `TouchableOpacity` vide posé
sur ses coordonnées, avec `hitSlop`. Pas de bouton en plus.

⚠️ **Un cadre garde TOUJOURS son ratio.** La version précédente le
forçait dans une boîte `86% × 88%` : ratio 2,12 contre 3,125 natif, soit
**47 % d'étirement** — décor écrasé, bannière décalée. On part de la
place disponible et on DÉDUIT la taille du ratio.

### Effacer un filigrane posé sur un CADRE symétrique

Ici le filigrane chevauchait le coin bas-droit : ni le détourage du fond
ni « la plus grande zone connexe » ne pouvaient l'atteindre. Le cadre
étant symétrique gauche/droite, le coin a été reconstruit en recopiant
**son symétrique miroité** (`src[:, ::-1]` sur la même boîte), avec un
fondu sur les bords.

## Inventaire des runes en surcouche (13/09)

La collection n'est plus dans l'écran : un bouton **plaque en bois**
(`wood-plate.png`) sous la boutique ouvre une **surcouche** avec le
cadre `collection-panel.png` — grille à gauche, détail de la rune
sélectionnée à droite, bouton RETOUR en haut à droite.

⚠️ **Surcouche et non écran séparé** (règle 11) : l'écran Runes n'est
pas démonté, donc la boutique et l'offre du jour sont intactes au
retour.

⚠️ **Le texte d'effet est CALCULÉ depuis `RUNE_BONUS_TABLE`**, la table
que le combat utilise vraiment (`runeEffectText()`). Une description
écrite à la main mentirait dès le premier rééquilibrage. Vérifié sur les
7 types aux niveaux 1 et 5.

⚠️ **Chercher le filigrane DANS TOUTE l'image, pas seulement les coins.**
Sur le chapitre 2 je l'avais déclaré absent après n'avoir regardé que le
coin bas-droit : il était en haut à droite, à moitié caché par un
feuillage. Méthode : comparer chaque pixel à son voisinage flou (et non
à un seuil global), puis monter une planche des 4 coins et VÉRIFIER À
L'ŒIL.

⚠️ **Toujours MESURER le contraste de la marque avant de choisir le
seuil.** Celui qui marche sur un ciel clair rate une marque sur des
nuages blancs. Et près d'un bord d'île, le contraste local explose : le
masque avale alors toute la fenêtre. Dans ce cas, masque circulaire
ciblé, en EXCLUANT les pixels de l'île (vert/brun) — sinon
l'inpainting étale de l'herbe dans le ciel (vu sur le chapitre 10).

⚠️ **Deux façons d'effacer, selon le fond.** Sur une texture (bois,
dalles, feuillage) : recopier une zone voisine, la source étant choisie
par ressemblance des BORDURES. Sur un fond lisse (ciel, nuages) : la
recopie laisse une couture rectangulaire visible — utiliser
`cv2.inpaint` (Telea) sur un masque des seuls pixels de la marque.

⚠️ Le fond de la plaque était **(167, 61, 133)** — un magenta désaturé,
pas le #FF00FF habituel. Un détourage calé en dur sur #FF00FF n'aurait
rien retiré. **Toujours mesurer la couleur de fond** avant de détourer.

L'atelier, seul dans sa colonne depuis que la collection est partie,
passe à 0,95 de la hauteur disponible.

## Assets de l'écran Runes — version large (13/09)

| Asset | Taille | Rôle |
|---|---|---|
| `forge-panel-wide.png` | 900×428 (2,10) | remplace `forge-panel.png` (1,145), trop carré |
| `collection-panel.png` | 900×288 (3,13) | cadre en bois autour de la collection |
| `adventure/runes-bg.jpg` | 1400×594 | fond de forge, plein écran |

⚠️ **Les repères NE SE TRANSPOSENT PAS d'un asset à l'autre.** Tout a été
remesuré sur le panneau large : plaque dorée x 0,362-0,632 · y
0,785-0,895, point de frappe x 0,50 · y 0,420. Réutiliser les anciennes
valeurs aurait posé le marteau à côté de l'enclume.

⚠️ **Le panneau de collection est OPAQUE**, ce n'est pas un cadre à
trous comme la boutique : les runes sont posées PAR-DESSUS, dans la zone
de bois utile (x 0,030-0,970 · y 0,175-0,930), également mesurée.

⚠️ **L'atelier est bridé à 0,55 de la hauteur de colonne**, pas à sa
pleine largeur : avec un ratio de 2,10 il ferait 207 dp de haut et ne
laisserait que ~100 dp à la collection, soit une seule rangée de runes.

### Effacer un filigrane POSÉ SUR une texture

Sur ces trois images le filigrane Gemini est au milieu du décor (dalles,
mur, bois), pas isolé sur le fond : « garder la plus grande zone
connexe » ne peut rien. Méthode : **recopier une zone voisine prise à la
MÊME hauteur**, avec un fondu sur les bords du patch. Le grain est
horizontal sur les trois — prendre la source au-dessus ou en dessous
traverserait un joint de pierre et se verrait.

⚠️ Pour le localiser automatiquement, **exclure d'abord les pixels
magenta** : le fond est plus clair que le décor et sort en tête du
seuillage, ce qui masque le filigrane.

## Atelier de forge + fusion automatique (12/09)

Panneau `forge-panel.png` (enclume + plaque dorée) en HAUT À DROITE de
l'écran Runes ; la plaque dorée **est** le bouton « FUSION AUTOMATIQUE ».
Boutique à gauche, collection sous l'atelier.

### Pourquoi l'animation est en CODE et pas en vidéo

Question posée, tranchée par ces deux points :
- une vidéo imposerait un module natif (`expo-video`) — le projet en
  retire, il n'en ajoute pas ;
- surtout, **la transparence vidéo n'est pas portable** iOS + Android
  (pas d'alpha en MP4, WebM alpha non lu par iOS) : on aurait un
  rectangle opaque autour du marteau.

Deux sprites + `Animated` : aucune dépendance, timing contrôlé, poids
négligeable.

⚠️ Les deux poses sont **empilées et c'est leur OPACITÉ qui bascule**.
Changer la `source` d'une `Image` à chaque coup forcerait un rendu JS,
alors qu'opacité et `transform` partent sur le **driver natif**.

| Repère (fractions de `forge-panel.png`) | Valeur |
|---|---|
| Plaque dorée (bouton) | x 0,255-0,740 · y 0,806-0,907 |
| Point de frappe (enclume) | x 0,50 · y 0,455 |
| Ancrage marteau levé | 0,47 / 0,34 · hauteur 0,44 |
| Ancrage marteau impact | 0,42 / 0,74 · hauteur 0,42 |

⚠️ **L'asset du marteau levé est MIROITÉ** (`FLIP_LEFT_RIGHT` appliqué
au PNG, pas un `scaleX: -1` en style — pas de subtilité d'ordre des
transforms). Sans ça le manche était à gauche au repos (x 0,37) et à
droite à l'impact (x 0,65) : le marteau **changeait de côté** en
frappant. Après miroir, manche à 0,63 et 0,65 — le coup se lit comme un
vrai balancement autour d'une main fixe à droite.

⚠️ **Vérifier un enchaînement de sprites par les CENTROÏDES**, pas à
l'œil : mesurer où sont le manche (bois : R > B+35) et la tête (métal :
|R−B| < 30) dans chaque pose. Si les x sautent d'un côté à l'autre,
l'animation cassera.

### `fuseAllRunes()` — deux partis pris

⚠️ **Les runes ÉQUIPÉES sont exclues.** Une fusion en masse pourrait
déséquiper une créature sans prévenir (2 runes équipées sur 2 créatures
→ une seule survit). Un bouton « tout fusionner » ne doit jamais défaire
ce que le joueur a délibérément mis en place.

⚠️ **Tout se fait en UNE passe de `setState`.** Fusionner paire par
paire relirait `ownedRunes` figé dans la closure à chaque étape et les
fusions s'écraseraient entre elles.

La fusion est appliquée **au clic**, avant l'animation : quitter l'écran
pendant les coups de marteau ne perd rien. Testé : 16 runes niveau 1 du
même type → 15 fusions → 1 rune niveau 5 ; runes équipées intactes ;
2 runes niveau 5 → 0 fusion.

### Fusion manuelle SUPPRIMÉE (12/09)

Bouton, état `fusionOpen`, écran `RuneFusionScreen` et fonction
`fuseRunes` retirés : la fusion automatique couvre le besoin, et garder
l'écran sans point d'entrée aurait laissé ~70 lignes inatteignables.

⚠️ Suppression en masse → **déclarations de premier niveau comparées
avant/après** : 67 → 66, seule `RuneFusionScreen` a disparu, aucune
référence orpheline. 14 styles devenus morts supprimés **par comptage
d'accolades**, jamais par regex DOTALL.

### ⚠️ Ne pas découper ce fichier avec `index("\n## ")`

Cette section `fuseAllRunes()` avait été **effacée par accident** : une
édition remplaçait un bloc allant d'un titre `###` jusqu'au prochain
`##`, ce qui a avalé au passage toutes les sous-sections intermédiaires.
Restaurée ici. Pour remplacer une sous-section, borner au prochain
`###`, pas au prochain `##` — et relire le résultat.

### Écran Runes — disposition de la maquette (12/09)

`boutique 46%` à gauche · `atelier` en haut à droite · `collection`
dessous. Calquée sur la maquette Gemini.

⚠️ **Les ratios des assets ne correspondent PAS à la maquette** : sur
la maquette la boutique est presque carrée (1,02) et l'atelier large
(1,71), alors que mes assets font 1,87 et 1,145. On reproduit donc la
STRUCTURE, chaque panneau prenant la taille maximale que son ratio
permet dans sa zone. La boutique ne remplit pas toute la hauteur de sa
colonne.

⚠️ **L'atelier est contraint par la HAUTEUR, pas la largeur** : à 1,145
il est presque carré, donc à pleine largeur de colonne il mangerait
toute la hauteur et ne laisserait rien à la collection. Formule :
`forgeW = min(largeurColonne, 0,66 × hauteurColonne × ratio)`, la
colonne étant mesurée par `onLayout` (largeur ET hauteur).

Rendu mesuré : boutique 379×202 · atelier 199×174 · collection 434×137.

## Boutique de runes illustrée (12/09)

Panneau Gemini détouré (`assets/icons/runes-shop-panel.png`, 900x482),
posé en HAUT À DROITE de l'écran Runes ; la collection occupe la colonne
de gauche.

⚠️ **Les 3 cases sont de vrais TROUS dans l'image** (alpha à 0) : le
contenu est rendu EN CODE par-dessus, aux fractions mesurées sur
l'asset. Il reste donc modifiable sans repasser par Gemini.

| Repère | Fractions mesurées |
|---|---|
| Bannière (zone lisse) | x 0,330-0,686 · y 0,022-0,125 |
| Cases (y) | 0,2427 → 0,7178 |
| Case 1 / 2 / 3 (x) | 0,077-0,309 / 0,386-0,613 / 0,688-0,922 |
| Légendes (bois, sous les cases) | y 0,735 → 0,905 |

⚠️ **Piège sur la bannière** : le premier relevé (y 0,008-0,058) ne
mesurait que la portion de la plaque dépassant AU-DESSUS du panneau,
détectée en cherchant les lignes dont la largeur opaque est faible. Or
la plaque redescend SUR le bois : la vraie zone lisse fait 0,022-0,125,
soit 20 dp de haut au lieu de 10. Le titre en police 13 était donc
coupé. **Mesurer une plaque par sa COULEUR (gris peu saturé), pas par la
largeur opaque de ses lignes.**

**À REMESURER si l'image change** (script : trous non connectés au bord).

### Les 3 offres

| Offre | Prix | Contenu |
|---|---|---|
| 🎲 Aléatoire | 100 | 1 rune niv.1 |
| 🎒 Pack | **250** | 3 runes niv.1 (−17% contre 300) |
| ✨ Spéciale | **300** | 1 rune **niv.2** d'un type imposé, 1×/jour |

⚠️ **L'offre spéciale est volontairement très avantageuse** : mesuré,
avec 7 types il faut ~14 tirages (1 400 Griffes) pour obtenir 2 runes
d'un type PRÉCIS et pouvoir les fusionner. D'où la limite à **un achat
par jour** — sans elle, elle remplacerait purement et simplement le
tirage à l'unité.

⚠️ Stockée dans sa PROPRE clé (`adventure:runeOffer:v1`), avec la DATE :
une date différente au chargement retire un nouveau type et remet
l'achat à zéro, donc pas de minuteur de minuit à gérer (même schéma que
le boss de tap).

### Détourage d'un PANNEAU — différent d'une icône

Deux écarts par rapport à la méthode des icônes :

⚠️ **Le magenta est AUSSI à l'intérieur** (les cases vides) et n'est pas
connecté au bord. Ici le test de couleur GLOBAL est le bon outil, parce
que le dessin (bois, métal, or) ne contient aucun rose — vérifié avant :
les seuls pixels ambigus sont les transitions de bord.

⚠️ **NE PAS décontaminer les bords sur ce type d'asset.** Retirer la
magenta d'un pixel d'or à moitié transparent le fait virer au **VERT**
(or − magenta = vert), et un liseré vert apparaissait tout autour des
cases. La bonne méthode : seuil FRANC (distance > 170), érosion de 3 px
pour manger l'anneau de transition, puis flou léger — les pixels
restants sont déjà purs, il n'y a rien à corriger.

⚠️ **Le filigrane Gemini était posé SUR le bois**, pas isolé dans un
coin : « garder la plus grande zone connexe » ne pouvait pas l'enlever.
Reconstruit en recopiant une bande de bois prise à la MÊME hauteur
(le grain est horizontal), avec un fondu sur les bords du patch.

## Runes — 7 types (12/09)

| Rune | Effet | Niv.1 → Niv.5 |
|---|---|---|
| ⚔️ Force | +% ATQ | +4% → +27% |
| ❤️ Vitalité | +% PV | +5% → +32% |
| ⚡ Célérité | + multiplicateur de dégâts | +0,10 → +0,70 |
| 🎯 Dextérité | −% taps + dégâts | −12→−60%, +0,05→+0,24 |
| 🔥 **Affinité** | + avantage élémentaire (1,30 de base) | +0,08 → **+0,45** |
| 💰 **Butin** | +% Griffes à la victoire | +8% → **+45%** |
| 🛡️ **Résilience** | survit 1× par combat, à X% des PV max | 6% → **30%** |

**Valeur mesurée au niveau 5** : Force +27% dégâts · Célérité +28% ·
Dextérité +10% · Affinité +9% à +21% selon la part d'attaques jouées en
avantage (c'est voulu : elle récompense le pilotage du deck) ·
Résilience ≈ +30% de PV effectifs une fois par combat · Butin +45% de
Griffes, zéro impact en combat.

⚠️ **Affinité ne touche QUE l'avantage**, pas la pénalité de faiblesse :
c'est une rune offensive, pas une défense déguisée.

⚠️ **Plafonds de cumul** (9 emplacements possibles sur un deck de 3) :
Butin `+100%` max, Résilience `50%` des PV max. Sans eux, 9 runes de
Butin donneraient +405%.

⚠️ **Résilience est appliquée sur les DEUX chemins de dégâts subis** —
la riposte ET le cas où l'adversaire ouvre le combat. Le second avait été
oublié au premier jet : la créature y mourait malgré la rune.

⚠️ `resilienceUsed` est porté par le COMBATTANT, donc la rune se
recharge d'un combat à l'autre mais ne peut pas se déclencher deux fois
dans le même.

### ⚠️ Effet de bord mesuré : la fusion est 1,6× plus lente

La fusion demande 2 runes IDENTIQUES, et le tirage est uniforme sur les
types. Passer de 4 à 7 types dilue donc chaque type.

| Types | Tirages pour une rune niv.5 | Coût |
|---|---|---|
| 4 (avant) | 48 | 4 800 Griffes |
| **7 (maintenant)** | **77** | **7 700 Griffes** |

**Levier si le rythme déplaît** : `RUNE_COST` 100 → **63** rétablit
exactement la cadence d'avant. Non appliqué — décision à prendre.

## Célérité s'applique à TOUTES les attaques (12/09)

L'ancienne exception « sauf attaque de base » a été retirée : elle était
**morte**. `SKILL_MANA_COSTS = [0, 0, 0]` — toutes les attaques
régulières sont gratuites, seul l'ultime consomme la jauge — et côté
joueur `chooseSkill(skill, false)` est le SEUL appel, donc `isBasic`
n'était jamais vrai. La branche `isBasic` ne subsiste que comme repli de
l'IA, lui-même inatteignable puisque toutes ses compétences régulières
sont abordables.

## Runes — la Rune d'Endurance est devenue Dextérité (12/09)

L'Endurance a été **remplacée par le mana le 11/09** : la rune qui la
boostait ne servait donc plus à rien. Remplacée par la **Rune de
Dextérité** 🎯, qui retire un pourcentage des **taps exigés par le défi
de combat** (`effectiveTapCount`).

| Niveau | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Taps en moins | 12% | 24% | 36% | 48% | 60% |
| Bonus de dégâts | +0,05 | +0,10 | +0,14 | +0,19 | +0,24 |

⚠️ **Migration obligatoire, pas cosmétique.** L'écran des runes lit
`RUNE_TYPES[rune.type].icon` **sans garde** : une rune « endurance »
encore en sauvegarde aurait donné `undefined.icon` et fait planter
l'écran. `migrateRunes()` convertit au chargement tout type inconnu en
Dextérité de même niveau — le joueur ne perd rien.

⚠️ Le cumul est borné à **−80%**, et le plancher de 10 taps s'applique
APRÈS la réduction : 3 runes niveau 5 sur un Mythique donnent 10 taps,
jamais 0.

### Pourquoi elle donne AUSSI des dégâts (buff du 12/09)

Première version : réduction de taps seule. Mesuré ensuite — **gain nul
au-dessus de 6,25 taps/s**, car les 25 taps y sont déjà finis sous le
seuil rapide (4 s) et le multiplicateur est donc **déjà à son plafond
x2,50**. Retirer des taps ne pouvait plus rien rapporter.

Un balayage de paramètres l'a confirmé : à 6,7 taps/s le gain plafonne à
**8 % quel que soit le réglage** (seuil, pourcentage, plancher). Le
plafond était la contrainte, pas les valeurs.

**Solution** : une part de la réduction passe en `dmgMultBonus`
(`val × 0,4`), qui est ajouté **APRÈS** le plafond dans `CombatScreen` —
c'est le seul canal encore utile à haute cadence.

| Cadence | Sans rune | Niv.1 | Niv.3 | Niv.5 | Gain niv.5 |
|---|---|---|---|---|---|
| 3,3/s | x1,83 | x2,05 | x2,48 | x2,74 | **+50%** |
| 4,4/s | x2,18 | x2,36 | x2,64 | x2,74 | **+25%** |
| **6,7/s (réglage de test)** | x2,50 | x2,55 | x2,64 | x2,74 | **+10%** |

⚠️ **Aucun seuil global n'a été touché** : les combats sans rune sont
rigoureusement inchangés. Le levier `TAP_CHALLENGE_FAST_THRESHOLD_SEC`
(4 → 2,5 s) reste disponible si l'on veut durcir le défi lui-même, mais
il retoucherait TOUS les combats.

⚠️ Plancher de taps abaissé de 10 à **6** : sinon un Mythique au niveau 5
tombait systématiquement sur le plancher et la rune n'avait plus d'effet
visible sur les créatures rapides.

## Les trois monnaies (11/09)

| Monnaie | Rôle | Gagnée par | Dépensée en |
|---|---|---|---|
| **Pièces** | monnaie douce du Clicker | taps, revenu passif | améliorations, invocations |
| **Griffes** 🐾 | monnaie d'Aventure | combats, quêtes | runes, niveaux de créature |
| **Diamants** 💎 | **premium** | calendrier quotidien | Offrandes |

**Les Diamants sont l'ancienne monnaie partagée des mini-jeux**, devenue
orpheline quand ils ont été archivés. Elle occupait déjà exactement le
rôle d'une premium (rare, gagnée à la connexion, dépensée sur une action
spéciale) : elle a donc été renommée plutôt que d'en créer une nouvelle.

⚠️ **Le boss de tap à venir paie en Diamants** (plafond de 21/jour, voir
le document des fonctionnalités). En convertissant celle-ci, il a déjà sa
monnaie : rien à créer le jour où on le code. Créer une seconde premium
aurait été l'erreur à éviter.

**Boutique de Diamants** (`DiamondShop.js`) — ouverte par la pilule 💎 à
gauche des pièces. 4 offres, qui réutilisent toutes un mécanisme
EXISTANT plutôt que d'en créer un :

| Offre | Coût | Mécanisme réutilisé |
|---|---|---|
| Bourse de pièces | 10 💎 | `gainCoins`, montant calé sur le revenu passif |
| 250 Griffes | 25 💎 | `PENDING_GRIFFES_KEY`, comme les récompenses de quête |
| Énergie pleine | 15 💎 | `DEV_REFILL_ENERGY_KEY`, comme le bouton dev |
| Éclosion immédiate | 40 💎 | met `endsAt` du minuteur à maintenant |

⚠️ Le montant de pièces est **proportionnel au revenu passif** et non
fixe : 1 000 pièces est énorme au début et dérisoire ensuite.

⚠️ **La clé de stockage reste `appCoins`** et les fonctions du contexte
gardent leurs noms (`coins`, `addCoins`, `spendCoins`). Renommer la clé
effacerait le solde de tous les joueurs. **Seul l'affichage parle de
Diamants.**

## Boss de tap (11/09)

Logique dans `src/games/clicker/tapBossLogic.js` (pure, simulable en
Node). Apparaît au hasard toutes les **20-30 min de JEU ACTIF** — pas de
temps réel, sinon il surgirait appli fermée et serait raté d'office.

| Récompense | Temps pour 200 taps | Cadence |
|---|---|---|
| 3 💎 | < 30 s | 6,7 taps/s |
| 2 💎 | < 45 s | 4,4 taps/s |
| 1 💎 | < 60 s | 3,3 taps/s |

⚠️ **Le chrono démarre au PREMIER TAP**, pas à l'apparition : un joueur
qui a posé son téléphone perdrait sinon des secondes sans le savoir.

⚠️ **Le tap compte pour le boss ET rapporte ses pièces normalement.**
Sans ça, un boss surgissant en pleine récolte coûterait 60 secondes de
revenu et le joueur aurait intérêt à l'ignorer — l'inverse de l'effet
recherché.

**Plafond : 21 💎/jour**, stocké avec la DATE (`clicker:tapBoss:v1`).
Une date différente au chargement remet le compteur à zéro, donc pas de
minuteur de minuit à gérer. Au-delà du plafond, le boss rapporte des
**pièces** : il garde un intérêt au lieu de devenir une nuisance.

**Détection de cadence anormale** : écart-type / moyenne des intervalles
entre taps. Mesuré — humain ≈ 0,19 ; autoclicker parfait 0,00 ; avec du
bruit 0,016. Seuil à 0,06, la séparation est nette.

⚠️ Elle pose un **simple drapeau** (`clicker:tapRhythmFlag`) et ne
sanctionne rien. Décidé ainsi parce qu'aujourd'hui aucune donnée ne
remonte (pas de serveur) : le jour où une sanction sera choisie, la
donnée doit déjà exister, sinon il faudra une mise à jour PLUS plusieurs
jours de collecte avant de pouvoir agir.

## Refonte du combat — étape 1 : compétences et mana (11/09)

**Nouveau modèle de compétences** (`buildCreatureSkills` dans
`clickerLogic.js`) : **2 attaques** pour une créature commune, **3** à
partir de rare, **+ 1 coup spécial**.

⚠️ Les NOMS sont ceux qui existaient déjà. Ils avaient été écrits à la
main, créature par créature, et collent à leur thème — en réinventer 90
aurait fait perdre ce travail sans rien apporter. Les 2-3 premières
compétences deviennent les attaques régulières, la dernière (la plus
forte) devient le spécial, à 1,5x ses dégâts.

⚠️ Le modèle est appliqué **après** la définition du tableau
(`CREATURES.forEach`) : `mkSkills` s'exécute dans chaque littéral
d'objet, où la rareté et le type de combat ne sont pas encore connus.

**Le mana REMPLACE l'endurance** (décision du 11/09). Jauge de 0 à 5,
+1 par tour, pour le joueur comme pour les adversaires.

| | Coût |
|---|---|
| Attaque 1 | gratuite — une créature n'est jamais bloquée |
| Attaque 2 | 2💧 |
| Attaque 3 (rare+) | 3💧 |
| **Coup spécial** | jauge **PLEINE** (5💧) |

⚠️ Le spécial exige la jauge pleine, pas seulement son coût : c'est ce
qui en fait un moment attendu plutôt qu'une attaque de plus.

⚠️ Le mana de l'adversaire monte sur une **copie locale** avant son
choix. Passer par `setOpponents` aurait été asynchrone et il aurait
choisi avec la valeur du tour précédent.

**Attaque de ZONE** : la 2e attaque des créatures de type `soutien`
(8 créatures). Frapper large est leur rôle, et ça donne un vrai choix
tactique plutôt qu'un « tape le plus fort ».

**Détail d'une attaque** : appui LONG sur le bouton. L'appui simple
lance l'attaque — sans cette séparation, consulter reviendrait à jouer.

### Reste à faire (étape 2)
- Habillage visuel épuré, **en attente de l'image de champ de bataille**
  (elle conditionne toute la mise en page)
- Sélection de cible au tap : à vérifier au test, le mécanisme existe
  déjà (`targetIndex`)

## Notation en étoiles des combats (12/09)

Principe repris des jeux du genre : les étoiles ne récompensent pas la
victoire, mais la **manière**. Chaque palier ajoute une contrainte.

| ★ | Condition | Ce que ça récompense |
|---|---|---|
| 1 | Gagner | acquis dès que le niveau passe |
| 2 | + **aucune créature perdue** | la préparation : deck et affinités |
| 3 | + **rapidement** | l'efficacité : frapper les faiblesses |

⚠️ Le seuil de rapidité dépend du **nombre d'adversaires**
(`2 × nombre + 1` tours), sinon un niveau à 3 ennemis serait
mécaniquement plus dur à noter qu'un niveau à 1.

Seul le **meilleur** score est conservé (`levelStars` dans la sauvegarde
d'Aventure) : rejouer et faire moins bien ne fait rien perdre.

**Défis liés** : 2 quotidiens, 2 hebdomadaires, 2 succès, sur les
événements `starsEarned` et `threeStarLevel`.

⚠️ `starsEarned` ne compte que le **PROGRÈS** par rapport au meilleur
score précédent du niveau. Sans ça, rejouer un niveau déjà à 3 étoiles
validerait les défis en boucle sur le premier niveau venu.

Affichées en fin de combat et **sous chaque nœud terminé** de la carte,
pour repérer d'un coup d'œil les niveaux à refaire.

## CHANTIER EN COURS — habillage de l'écran Exploration (12/09)

Refonte visuelle en cours, assets générés par l'utilisateur via Gemini
puis détourés ici. **Fait :** décor de fond, bannière de titre, bouton
Combat, bouton retour partagé, 8 cadres de carte par élément, compteurs
de monnaie épurés, **icônes Griffes 🐾 et Diamants 💎**.

**Reste à faire :** rien d'identifié pour l'instant sur ce chantier.

### Icônes Griffes/Diamants — 3 méthodes essayées, 1 seule a marché

Les deux icônes (griffe dorée sur médaillon, gemme sur cadre doré)
arrivent sur fond magenta **avec un halo peint autour** (violet puis
cyan pour la gemme, orangé pour la griffe) — contrairement aux cadres
de carte du 12/09, ce halo n'est **pas juste un dégradé vers le
magenta**, l'IA a peint un vrai anneau lumineux. Ça change tout : les
deux méthodes de détourage déjà documentées dans ce fichier échouent
toutes les deux dessus.

1. ❌ **Remplissage depuis les bords, tolérance en chaîne** (méthode
   existante, cadres de carte) : fuit entièrement à travers le dessin.
   Ces icônes sont peintes à l'aérographe (ombrage doux, dégradés
   continus jusqu'À L'INTÉRIEUR de l'objet), pas en aplats comme les
   cadres — la chaîne de tolérance ne voit aucune vraie paroi et
   engloutit la médaille entière (testé : ne restait que 53×53 px).
2. ❌ **Test de couleur global (distance à la magenta)** : sépare bien
   le fond, MAIS le halo peint (violet/orangé) est proche de la teinte
   magenta et ressort en **frange semi-transparente colorée** une fois
   posé sur un fond non-magenta — visible clairement sur fond sombre.
   La décontamination (retirer la contribution magenta d'un pixel
   translucide) ne corrige rien ici : ce n'est pas un mélange avec le
   fond, c'est une couleur peinte à part entière.
3. ✅ **Mur d'arêtes Canny** — la bonne méthode : détecter les contours
   (`cv2.Canny`, dilatés de 2 px pour fermer les micro-trous), puis
   remplir depuis les 4 coins en utilisant ces arêtes comme des MURS
   que le remplissage ne peut pas franchir. Le contour dur du cadre
   doré/métallique arrête le remplissage net, tout le halo peint (quel
   que soit son ton) reste dehors avec le fond. Reboucher les trous
   internes que la marche des arêtes peut créer
   (`ndimage.binary_fill_holes`), garder la plus grande zone connexe
   (filigrane Gemini toujours isolé), éroder ~1 px + lisser pour l'anti-
   aliasing, décontaminer seulement le dernier pixel de bordure contre
   la magenta.

**À réutiliser en priorité pour tout futur asset à l'aérographe** (ombrage
peint, pas un aplat) : commencer directement par la méthode 3, les
méthodes 1 et 2 restent valables pour les aplats façon cadres de carte.

### Le halo du compteur : pas dans l'image, mais pas des cercles CSS non plus

Décision d'origine : « le halo se fera en code, pas dans l'image » —
confirmée, mais la 1ère implémentation (2-3 `View` superposées, cercle
+ `opacity` + `transform: scale`) donnait des **anneaux concentriques
visibles** (bandes nettes) au lieu d'une vraie lueur : React Native n'a
aucune primitive de flou, superposer des ronds à opacité fixe ne le
remplace pas.

**Corrigé** : un dégradé radial est pré-rendu UNE FOIS en Python (vrai
flou gaussien, `PIL.ImageFilter.GaussianBlur`) et exporté en PNG
(`glow-gold.png` pour les Griffes, `glow-cyan.png` pour les Diamants,
160×160). `CurrencyIcon` l'affiche en `Image` positionnée en absolu
derrière l'icône, à ×2,6 sa taille. Coût d'exécution nul (pas de calcul
au rendu), lueur lisse sur les deux plateformes.

⚠️ Piège rencontré en générant ces 2 PNG : la 1ère version dessinait les
cercles du plus PETIT (opaque) au plus GRAND (quasi transparent) —
`ImageDraw` **remplace** les pixels au lieu de les mélanger, donc le
grand cercle quasi-transparent dessiné EN DERNIER écrasait le centre
opaque déjà tracé. Résultat : alpha à 0 partout, glow invisible. Corrigé
en inversant l'ordre (grand+faible alpha d'abord, petit+alpha fort en
dernier, chaque cercle plus petit que le précédent ne recouvre donc que
son propre centre).

### Fichiers ajoutés

`mobile/assets/icons/runes-gem.png`, `griffes-icon.png` (les icônes),
`glow-gold.png`, `glow-cyan.png` (les halos pré-rendus).

⚠️ **La gemme est l'icône des RUNES, pas des Diamants.** Erreur commise
le 12/09 : « l'icône des gemmes » a été comprise comme la monnaie
premium alors qu'elle désignait le bouton Runes. La gemme sert donc au
**bouton Runes** (en haut à droite de l'Aventure, remplace
`rune-button.png`, supprimé) et au **titre de l'écran Runes**.

**Les Diamants n'ont PAS d'icône dédiée** : ils gardent l'emoji 💎
partout (recharge d'énergie, alertes) et **aucun compteur dans
l'Aventure**. Ne pas « corriger » cela sans demander — c'est l'état
voulu.

Les Griffes, elles, utilisent bien `griffes-icon.png` : compteur
principal (3 emplacements), coûts de niveau/évolution, écran Runes.

### 14. `<Image>` sans `resizeMode` explicite ROGNE en haut/bas (défaut = `cover`, pas `contain`)

**Bug réel signalé par l'utilisateur** : les icônes Griffes/Diamants
posées ci-dessus apparaissaient « mal détourées, coupées en haut et en
bas ». Fausse piste suivie d'abord : passé un long moment à re-vérifier
le détourage lui-même (pixel par pixel, comparaison avec l'image
source) — les fichiers PNG sont corrects, intacts, non rognés. **Le bug
n'était pas dans l'asset, il était dans la balise `<Image>`.**

Cause réelle : 7 occurrences (coûts de niveau/évolution, titre et texte
de l'écran Runes) utilisaient `<Image source={...} style={styles.
inlineCurrencyIcon} />` **sans préciser `resizeMode`**. Or le défaut de
React Native est **`cover`** (remplit toute la boîte en rognant ce qui
dépasse), pas `contain` (réduit l'image entière pour qu'elle tienne).
`diamond-icon.png` est portrait (240×320, pas carré) alors que la boîte
CSS est carrée (14×14 ou 18×18) : `cover` l'agrandissait jusqu'à
remplir la largeur, puis rognait symétriquement le haut ET le bas qui
dépassaient — exactement le symptôme décrit. Simulé et confirmé avant
de corriger (rendu 8× de `cover` vs `contain` à la vraie taille de 18px)
plutôt que de recorriger à l'aveugle une 2e fois.

**Corrigé** : `resizeMode="contain"` ajouté aux 7 occurrences. Le
compteur principal (`CurrencyIcon`) n'était PAS affecté, il précisait
déjà `contain`. Vérifié qu'aucune autre balise `<Image>` du fichier
n'omet `resizeMode` (recherche automatisée sur tout le fichier, zéro
résultat).

⚠️ **Règle générale pour tout le projet** : toute `<Image>` avec une
taille fixe (`width`/`height` en style) doit TOUJOURS préciser
`resizeMode` explicitement. Sans lui, le rendu dépend d'un défaut
silencieux qui ne casse rien à la compilation ni aux tests visuels
rapides (une image carrée ou proche du carré ne montre presque rien),
mais rogne réellement toute image dont le ratio diffère de sa boîte.

### 15. Un dégradé exporté en PNG doit retomber à alpha 0 AVANT son bord

**Bug réel signalé par l'utilisateur (12/09)** : « autour de l'icône ce
n'est pas transparent » — un **carré brun** visible autour du compteur
de Griffes sur l'écran Chapitres.

Cause : le PNG de halo avait **alpha = 25 sur tout son bord** au lieu de
0. Le dégradé radial était simplement coupé net par le bord carré du
fichier. De l'or (#f2c14e) à 10 % d'opacité sur un fond quasi noir donne
exactement ce brun sale, et la coupure suit le carré de l'image.

L'erreur de génération : les cercles concentriques étaient tracés avec
un rayon allant jusqu'à **1,96 × le rayon de base**, soit 140 px dans un
canevas de 256 — ils dépassaient le cadre, donc le dégradé n'avait pas
la place de retomber à zéro.

**Corrigé** : le halo est maintenant calculé en numpy avec une fenêtre
`smoothstep` qui force l'alpha à 0 sur les 30 derniers % du rayon, plus
un `alpha[r >= 1] = 0` explicite. Vérifié après export : bords et coins
à 0.

⚠️ **Deuxième règle apprise au passage : ne JAMAIS flouter les canaux
RVB en même temps que l'alpha.** Un canevas RGBA vide a un RVB **noir**
sous son alpha 0 ; le flou mélange donc la couleur du halo avec ce noir
et sort une lueur terne et sale. La bonne méthode : **RVB constant sur
toute l'image** (la couleur du halo partout, y compris dans les zones
invisibles) et ne faire varier **que l'alpha**.

⚠️ Vérification systématique pour tout futur dégradé exporté :
contrôler `alpha[0].max()`, `alpha[-1].max()`, `alpha[:,0].max()`,
`alpha[:,-1].max()` — les quatre doivent valoir **0**. Un rendu de
contrôle sur fond sombre ne suffit pas toujours à le voir, alors que la
mesure est immédiate.

### Compteurs de monnaie — où ils s'affichent

| Écran | Compteurs |
|---|---|
| Menu principal Aventure | 💎 Diamants · 🐾 Griffes (+) · bouton Runes |
| Carte des Chapitres | 💎 Diamants · 🐾 Griffes (+) · ⚡ Énergie |
| Fiche de créature | 🐾 Griffes seules |

Les **Diamants ont été ajoutés aux deux premiers le 12/09** : ils n'y
figuraient nulle part alors que ce sont eux qui paient la recharge
d'énergie (affichée juste à côté) et l'échange contre des Griffes. Le
joueur voyait le bouton « + » sans jamais savoir s'il avait de quoi
payer.

⚠️ Pas de « + » sur le compteur de Diamants : la boutique de Diamants
vit dans le Clicker (`DiamondShop.js`) et n'est pas atteignable depuis
l'Aventure. Un « + » qui ne mène nulle part serait pire que pas de
bouton.

### Méthode de détourage — À RÉUTILISER (aplats uniquement, voir ci-dessus pour l'aérographe)

Les assets arrivent sur fond **magenta pur** (#FF00FF), demandé

explicitement dans les prompts.

⚠️ **Remplissage depuis les BORDS, jamais un test de couleur global.**
Le cadre Ténèbres a des fissures violet-magenta qu'un test global
effacerait. Le fond est le seul magenta *connecté au bord de l'image*.

⚠️ **Reprendre aussi les petits îlots magenta enfermés** dans le dessin :
le trou au centre de l'anneau de la boussole n'est pas connecté au bord
et survivait au remplissage, laissant un point magenta.

⚠️ **Éroder de 2-3 px avant de lisser** l'alpha : sans ça, les pixels de
transition laissent un liseré violet.

⚠️ **Garder la plus grande zone connexe** : supprime le filigrane Gemini,
toujours isolé dans un coin.

Puis **quantifier à ~150 couleurs** : ces assets sont des aplats, le
poids chute d'un tiers sans perte visible.

### Consignes de prompt qui marchent
Intérieur VIDE · fond magenta pur uni · un seul objet centré · aucun
texte (on l'écrit par-dessus en code) · objet PLEIN sans ajour · mention
explicite « aucune signature, aucun filigrane, aucune étoile ».

⚠️ **Insuffisant à lui seul contre le halo peint** (voir plus haut) :
même avec cette consigne, l'IA a peint un anneau lumineux autour des 2
dernières icônes. Prévoir la méthode 3 (mur d'arêtes) par défaut pour
tout nouvel asset de ce type plutôt que d'espérer un rendu sans halo.

## Cadres de carte par élément (12/09)

Les 8 éléments ont leur cadre (`assets/adventure/frames/`), table dans
`src/screens/games/cardFrames.js`. Bordure mesurée : **13 % en largeur,
10 % en hauteur**.

⚠️ **Détourage par REMPLISSAGE DEPUIS LES BORDS**, pas par test de
couleur global. Le cadre Ténèbres a des fissures violet-magenta qu'un
test global aurait effacées. Le fond est le seul magenta *connecté au
bord* ; l'intérieur du cadre est récupéré à part (zone magenta large et
centrale, non connectée). **Réutiliser cette méthode** pour tout asset
dont l'illustration contient du violet ou du rose.

Le cadre illustré REMPLACE la bordure colorée de rareté — les deux
ensemble faisaient double encadrement.

## Affinités élémentaires (12/09)

Les 26 créatures avaient déjà un `element` **utilisé nulle part** en
combat : le coût de conception était payé sans rien rapporter. Il pilote
désormais les dégâts.

**Cycle à 5** : Feu ▸ Air ▸ Terre ▸ Foudre ▸ Eau ▸ Feu
**Lumière ↔ Ténèbres** : s'amplifient MUTUELLEMENT (+30% dans les deux
sens). Chacun est donc sa propre menace, sans pénalité d'attaque.
**Magie** : totalement neutre, dans les deux sens.

| Relation | Multiplicateur |
|---|---|
| Avantage | **×1,30** (calé sur le jeu de référence : +30%) |
| Faiblesse | **×0,75** |
| Neutre | ×1 |

Appliqué aux **trois** chemins de dégâts : attaque du joueur, riposte
adverse, et le cas où l'adversaire joue en premier.

⚠️ `elementMultiplier` renvoie 1 si un élément manque — une créature sans
élément renseigné ne peut pas faire planter un combat.

L'affinité s'affiche dans le panneau d'attaque, mais **seulement contre
la cible visée** : hors contexte d'un adversaire précis, l'information
n'aurait aucun sens.

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
- **`pointerEvents` en prop dans `CombatScreen`** — 2 occurrences, donc
  ignorées depuis le SDK 57 (voir Règles de survie). Les 17 autres sont
  parties avec les mini-jeux archivés.
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


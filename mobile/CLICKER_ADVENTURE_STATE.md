# Paradox — mémoire du projet

Lu au début de chaque session. Ne contient QUE ce qui évite de repayer
une erreur déjà payée. Le reste se lit dans le code, qui est commenté.

⚠️ Avant d'ajouter quelque chose ici : est-ce que ça empêchera quelqu'un
de refaire une erreur coûteuse ? Sinon, ça va en commentaire dans le
code.

⚠️⚠️ **SI UN BUG NE SE REPRODUIT PAS DANS LE BAC À SABLE, COMMENCER PAR
LA SECTION 5.** Afficher le chiffre dans le jeu avant d'écrire le
moindre correctif. Sept correctifs à l'aveugle le 19/09, tous sur des
causes réelles, aucune n'étant la bonne — un affichage de deux chiffres
a réglé l'affaire en une capture d'écran.

---

## 0. ⚠️ OUVRIR `WIKI_DEFIS.md` = LANCER LE CONTRÔLE

Règle de l'auteur du 20/09 : lire le wiki des défis oblige à lancer le
contrôle complet et à en rapporter le résultat, même sans demande.

Et après TOUTE modification de défi, de prix, de seuil ou de rendement :
contrôle complet, résultat annoncé. Un rouge tu voyage jusqu'à la partie
d'un joueur.

---

## 0. 📋 LIRE D'ABORD `PASSATION.md`

État au 24/09, ordre de démarrage, commandes des contrôles, passes
restantes (2 : prix des paliers ×2,5 · 3 : œuf 7 à valider · 4 :
pouvoirs par le deck) et façon de travailler de l'auteur. Puis ce
fichier, puis `WIKI_DEFIS.md`, puis `A_FAIRE.md`.

---

## 0 bis. 🐞 SIGNALEMENT DES BUGS — comment l'auteur est prévenu

Depuis le 21/09, un joueur bloqué peut prévenir l'auteur. Avant, il était
AVEUGLE : les erreurs s'affichaient sur le téléphone du joueur, jamais
chez lui.

| Quoi | Où |
|---|---|
| **Adresse de réception** | `EMAIL_SIGNALEMENT` dans `src/games/clicker/diagnostic.js` — **la seule ligne à changer** |
| Détection des blocages (pure, testée) | `src/games/clicker/diagnostic.js` |
| Envoi (mail, sinon partage) | `src/signalement.js` |
| Détection automatique, chaque minute | `ClickerScreen.js`, après `currentChallengeId` |
| Bouton « 🐞 Signaler un problème » | Options, fin de la section Jeu |
| Plantages : mémorisés + bouton « Signaler » | `index.js`, le filet de sécurité |

**Ce qui est détecté** : compteur de pièces invalide (bloque l'Ascension
pour toujours), seuil invalide, aucun défi en cours, défi introuvable,
cible ou progression illisible, défi immobile depuis 3 h de jeu actif.

⚠️⚠️ **AUCUN MODULE NATIF AJOUTÉ.** Uniquement `Linking`, `Share` et
`Platform`, qui font partie de React Native. Les modules natifs ont déjà
bloqué le démarrage trois fois. `package.json` n'a pas bougé.

⚠️⚠️ **LE DIAGNOSTIC NE DOIT JAMAIS CASSER LE JEU QU'IL SURVEILLE.** Tout
est enveloppé dans des `try`. Dans `index.js`, chaque dépendance est
chargée À LA DEMANDE dans son propre `try`, et le gestionnaire d'origine
est TOUJOURS appelé : ce fichier est le dernier rempart, s'il plantait on
retomberait sur l'écran blanc muet.

⚠️ Sur une erreur FATALE dans une app publiée, le système peut fermer
l'app avant que le joueur appuie sur « Signaler » : l'erreur est donc
mémorisée et proposée au lancement suivant. La capture FIABLE des
plantages sur le store reste le rôle de Sentry, à ajouter au lancement.

`auditSignalement` vérifie tout ça à chaque contrôle — y compris en
ATTAQUANT le filet de sécurité avec de faux modules cassés exprès.

### Corriger un bug sans passer par le store

**Oui, pour tout ce qui est JavaScript** — défis, équilibrage, logique,
textes, écrans. Chaque push publie une mise à jour (`eas update`), et
l'APK Android, construit par `build-apk.yml` avec `expo-updates` injecté
au moment du build, la reçoit au lancement suivant. On peut aussi
republier une version stable par-dessus une mise à jour fautive.

🟥 **Demande le store** : ajouter un module natif, changer une
permission, monter le SDK. Et il n'existe **aucun build iOS** à ce jour.

---

## 0 ter. 🛡️ DEUX COMMANDES, pas une

```
node mobile/tools/verifier-defis.js       les 36 contrôles
node mobile/tools/verifier-controles.js   la preuve que chacun sait crier
```

La première dit si le jeu est sain. La seconde dit si **les contrôles
eux-mêmes** le sont : un sabotage réel par contrôle, qui doit être
attrapé. Le 21/09, elle a trouvé dix contrôles aveugles aux vrais défis.

---

## 1. La commande avant tout push touchant aux défis

```
NODE_PATH=<dossier avec @babel/core> node mobile/tools/verifier-defis.js
```

22 contrôles + une vérification exhaustive (186 combinaisons) + 14 600 tirages de force brute + l'empreinte. Vert = le
changement peut partir. Chaque contrôle est né d'un bug réel et a été
**prouvé** en réintroduisant ce bug.

⚠️ **Deux instruments qui ne partagent pas leur état ne peuvent pas être
comparés.** Deux fois dans la même session : sur les durées de groupe,
puis sur le coût des défis, où le même défi ressortait « infaisable »
d'un côté et « 0 minute » de l'autre — parce qu'ils ne supposaient pas
le même joueur.

⚠️ Un contrôle non prouvé ne vaut rien. Et une preuve porte sur un défi
PRÉCIS : quand ce défi disparaît, la preuve disparaît avec lui et le
contrôle redevient muet en silence. Arrivé avec `auditModes`.

Ce que l'outil NE voit PAS :
- qu'une métrique est bien **incrémentée** par le jeu (il vérifie
  seulement qu'elle est publiée) ;
- la **mise en page** — pas testable depuis le bac à sable ;
- qu'un défi est **intéressant**.

---

## 2. Les pièges qui bloquent le démarrage

**expo-updates et runtimeVersion.** `app.json` garde
`runtimeVersion: "57.0.0"` **sans** préfixe `exposdk:`, et le projet
reste **sans** `expo-updates`. Les deux ensemble (commit `24ba5c0`) :
- `exposdk:57.0.0` : Expo Go fait `split('.')[0]`, obtient
  « exposdk:57 » qui n'égale jamais « 57 », et rejette toutes les mises
  à jour ;
- `expo-updates` sans `updates.url` : blocage infini sur « Checking for
  new update ».

⚠️ L'APK a besoin d'`expo-updates` pour recevoir les mises à jour. Il
est ajouté **dans le job de build uniquement** (`build-apk.yml`), jamais
committé — le projet reste intact pour Expo Go.

**expo-notifications** : retiré d'Expo Go depuis le SDK 53.

**API d'un module natif** : vérifier qu'elle existe dans la version
installée. `setBehaviorAsync` a été retirée en SDK 57 et plantait
l'appli.

**« Failed to download remote update » sur Android** : bug OUVERT chez
Expo (`expo/expo#50139` et `#50253`), reproduit sur un projet vierge.
Android échoue, iOS passe, même mise à jour. Rien à corriger de notre
côté ; l'APK contourne.

---

## 3. Travailler sans terminal

L'auteur n'a aucun terminal. Un robot GitHub Actions publie à chaque
push sur `main` touchant `mobile/**` ; il ferme et rouvre l'appli.

⚠️ **Les logs GitHub Actions ne sont PAS accessibles depuis le bac à
sable** (hôte hors liste blanche). Pour diagnostiquer, faire écrire
l'information là où le téléphone l'affiche — **voir le protocole
complet en section 5, qui est la méthode à appliquer par défaut sur
tout bug qu'on ne peut pas reproduire ici.**

**La date de publication dans les Options.** `mobile/src/version.js` est
réécrit par le robot avant chaque `eas update` : heure de Paris +
numéro de commit.

⚠️ **Toujours faire vérifier ce numéro avant de conclure qu'un bug
existe.** Trois fois dans la même journée, des « bugs » signalés
étaient l'ancienne version en cache, et j'ai cherché dans le code au
lieu de vérifier le plus simple — une fois en inventant une promotion
temporaire pour faire coller les chiffres.

**eas-cli est figé** à `24.7.0`. Sans numéro, l'outil qui fabrique les
mises à jour changeait tout seul d'une publication à l'autre, sans le
moindre commit.

---

## 4. Les défis : ce qui a coûté le plus cher

### Une cible ne dépend JAMAIS du joueur
C'était le cas de 68 % des défis. Trois conséquences :
1. **un joueur qui paye n'était pas plus avancé** — il achète des
   pièces, son état monte, ses défis deviennent plus durs ;
2. deux joueurs au même endroit voyaient deux jeux différents ;
3. cause commune de la moitié des bugs : défis nés accomplis, cibles
   sous l'acquis, « atteins 4 pièces par seconde » au démarrage, deux
   réserves d'affilée.

Une cible vaut `target` × l'échelle de son **groupe** (nombre
d'Ascensions) : déterministe, identique pour tous, lisible dans le
document de référence.

⚠️ **Seule exception assumée** : « monte une créature +5 niveaux
au-dessus de ta meilleure ». Le niveau des créatures ne repart pas à
zéro et n'a pas de plafond, donc une cible fixe y serait un mur puis un
cadeau. Écrit en `step`, ce qui l'exclut d'`auditCibleSuitLeJoueur`.

⚠️ Un défi à `step` se résout quand il devient COURANT, pas au tirage de
l'œuf — sinon « +5 » se calculait sur un état vieux de plusieurs défis.
Puis il se fige, sinon il fuit devant le joueur.

### La séquence ne substitue JAMAIS
Trois endroits pouvaient retirer un défi — au tirage, au chargement, en
continu pendant la partie — chacun avec sa condition écrite à la main.
Supprimer la première n'a rien changé, les deux autres continuaient.

Tout passe par `peutEtreRemplace(questId)`. `auditSubstitutions` compte
les appels à `pickQuestSet` contre les gardes : c'est le seul moyen de
repérer un quatrième chemin ajouté plus tard.

⚠️ Sans risque de blocage : chaque prérequis du schéma est un défi
**antérieur** du même schéma (Pacte → Faveur → Dégâts critiques →
Sanctuaire → Veilleur) et les défis se jouent dans l'ordre.

### Quatre échelles se multipliaient en silence
`applyRepeatTier` gonflait les cibles à chaque tour de séquence, **en
plus** de l'échelle de groupe et **après** le plafond — donc en le
contournant. Elle produisait « Transe pendant 641 secondes » sur un défi
déclarant 25 s, plafond 45. Neutralisée. L'échelle de groupe est le SEUL
endroit où une cible monte.

### L'empreinte doit couvrir le moteur
`QUEST_DEFS_VERSION` est un hachage de `questDefs.js`. Un correctif du
MOTEUR ne la faisait pas bouger : les défis en cours gardaient l'ancien
tirage et le correctif semblait ne rien faire.
`QUEST_ENGINE_VERSION` (déclarée dans `questDefs.js`, car `questDefs` ne
peut pas importer `questLogic`) entre dans le calcul. **À incrémenter
dès qu'on change la façon dont les défis sont choisis ou résolus.**

⚠️ **`defisEcrits.js` — les vrais défis — n'entre PAS dans l'empreinte**
(elle hache `QUEST_SEQUENCE`, l'ancien modèle). Toute cible ou libellé
changé dans ce fichier exige le bump : sinon l'œuf en cours garde
l'ancienne cible, qui peut être devenue impossible à vie (24/09 :
« Achète 10 niveaux de Poigne » valait 45 000 % du seuil).

### Valider en dev une Ascension doit FAIRE l'Ascension
Sinon le compteur reste à 0, le groupe reste le 1er, et parcourir les 26
œufs au bouton de dev ne teste QUE le groupe 1 — en donnant l'illusion
de tout tester.

### Un défi delta part de zéro quand il COMMENCE
La référence était prise au tirage de l'œuf : tout ce qui était accumulé
sur les défis précédents comptait pour les suivants, et l'œuf éclosait
d'un coup dès qu'un seul défi était validé.

Les métriques de RECORD (Transe, combo) sont en plus remises à zéro, et
un défi de record n'est pas « terminé » tant qu'il n'a pas commencé.

### Les défis d'Aventure et l'œuf en incubation
Le tirage du cycle suivant a lieu dans `startEggIncubation`, **avant**
l'arrivée de la créature. Les défis conditionnés à `ownedCount > 0`
étaient tous écartés : à l'œuf 2, celui qui doit faire découvrir le
mode, le joueur ne le voyait jamais. Ils utilisent `creaturesAVenir`.

### L'Aventure est une CAMPAGNE, pas une économie
Ses niveaux se cumulent d'une Ascension à l'autre, contrairement aux
pièces. La campagne **avance** de `PAS_AVENTURE_PAR_GROUPE` par groupe
(5/10/15, puis 20/25/30). La multiplier donnait « niveau 6 » à un joueur
qui en était au 20e.

### Chiffrer un défi
La cible d'un défi d'achat se cale sur le **coût** des défis voisins du
même œuf. Un niveau ne dit rien, un coût se compare : « Dégâts critiques
niveau 3 » coûtait 918 pièces à un joueur qui en gagne 660 par minute.

⚠️ Sanctuaire et Veilleur **plafonnent à 50**, coût concentré tout en
haut (niveau 20 = 1 259 pièces, niveau 42 = 28 000). Pas d'échelle de
groupe : elle les saturerait dès le 2e.

---

## 5. LA MÉTHODE QUI MARCHE : afficher le chiffre dans le jeu

⚠️ **À faire dès le PREMIER signalement, pas au septième.**

Le 19/09, l'auteur a signalé sept fois que tous les groupes montraient
les mêmes défis. J'ai poussé sept correctifs, tous sur des causes
RÉELLES — cibles figées conservées par la sauvegarde, tirage recevant un
fragment d'état, compteur lu à un instant périmé, champ absent de la
sauvegarde — et **aucune n'était la sienne**.

Ce qui a résolu l'affaire en une capture d'écran : afficher deux
chiffres dans le jeu.

```
A:5 T:-1
```

- `A` = le nombre d'Ascensions au dernier rendu
- `T` = le nombre d'Ascensions enregistré AU MOMENT du tirage des défis

Le `-1` signifiait « aucun tirage n'a jamais eu lieu ». En un coup
d'œil, sept hypothèses éliminées et la vraie cause désignée : les défis
de départ, figés au groupe 0, n'étaient jamais retirés.

### Pourquoi la relecture du code ne suffit pas

⚠️ **Le chemin par lequel une valeur N'ARRIVE PAS est invisible à la
lecture.** On vérifie les chemins qu'on connaît ; jamais celui qu'on a
oublié. Un compteur affiché montre l'ABSENCE ; une relecture, non.

⚠️ Lire un champ absent ne provoque AUCUNE erreur : on obtient
`undefined`, puis zéro par le `|| 0`. Le jeu fonctionnait parfaitement —
pour un joueur qui n'a jamais ascensionné.

### Le protocole, pour tout bug non reproductible dans le bac à sable

1. **Afficher la valeur suspecte dans le jeu** — mode dev, écran
   Options, peu importe : là où le téléphone la montre.
2. **Afficher aussi la valeur AU MOMENT où elle a été utilisée**, pas
   seulement la valeur courante. C'est l'écart entre les deux qui
   désigne le coupable.
3. **Demander la capture** et n'écrire aucun correctif avant de
   l'avoir.
4. **Énumérer à l'avance ce que chaque résultat signifierait.** Si deux
   valeurs possibles mènent au même endroit, le diagnostic est mal
   choisi.
5. Corriger, puis **laisser l'affichage en place** jusqu'à confirmation.

⚠️ Sans cette manipulation, chaque correctif est un coup dans le noir —
et l'auteur a eu raison de dire que je cassais des choses au hasard.

---

## 6. Les pièges de méthode

**L'instrument ment plus souvent que le jeu.** Cinq fois en une session,
la panne était dans l'outil de mesure. Un simulateur appelle les
fonctions DU JEU, il ne les réimplémente jamais.

⚠️ Un `?` dans un tableau de mesures n'est JAMAIS neutre : il veut dire
« je ne sais pas mesurer », pas « rien à signaler ». C'est exactement là
que se cachait un défi trop facile.

⚠️ Le générateur de la liste de référence simulait un joueur qui
n'achetait rien : la liste montrait des défis absents qui étaient bien
là, et a fait croire à des bugs du jeu pendant des heures.

**Un contrôle qui hurle sur des cas normaux cesse d'être lu.**
`auditTropFacile` exclut les défis d'ADRESSE (Transe, Offrande), qui se
mesurent en secondes par nature, et ne compare jamais de part et
d'autre d'une Ascension.

**Du code mort qui peut casser une garantie n'est pas du code mort** :
c'est un piège avec un délai. Le bloc de remplacement du tirage a été
supprimé, pas désactivé.

**Babel ne voit pas un identifiant non importé** : il compile, l'erreur
arrive en plein écran sur le téléphone. `verifier-defis.js` croise les
exports du moteur avec les imports de l'écran.

**Une carte à `aspectRatio` fixe ne grandit pas** : y ajouter un élément
le fait déborder par-dessus le reste.

**Un outil lancé à part échappe au contrôle des contrôles.**
`verif-exhaustive.js` parcourait encore `QUEST_SEQUENCE` (42 anciens
modèles) un mois après la bascule vers `defisEcrits.js` : vert avec un
libellé cassé dans un vrai défi, et exigé par la passation pour pousser.
Branché comme `auditExhaustif`, avec sabotage (24/09).

**Après tout changement de prix : réordonner.** La passe 2 a changé les
coûts sans relancer `reordonner-groupe.js` : défis d'achat moins chers
que le précédent aux A1-A5, 2 avant, 13 après, invisibles sous la
tolérance de 50 %. Mesurer avec la tolérance ZÉRO, pas avec le contrôle.

**Deux instances peuvent partager le bac à sable** (« Réessayer » en
relance une). `git fetch` avant chaque commit, comparer avant de pousser.

**Ne pas ajouter ce qui n'est pas demandé.** Un menu ajouté de ma propre
initiative a produit deux bugs en trois commits avant d'être retiré.

---

## 7. Boutique et Ascensions — les règles qui se tiennent

Quatre barèmes qui ne peuvent PAS bouger séparément :

| | Règle |
|---|---|
| **Bonus d'Ascension** | x2, x2,5, x3... cumulatif (x2, x5, x15, x53, x210) |
| **Seuils** | montent avec le bonus, sinon le groupe se vide |
| **Prix de boutique** | montent avec le bonus (`prixMultiplicateurAscension`) |
| **Rendements** | x5 par palier, prix PROPORTIONNELS au rendement |

⚠️ **UN seul nouveau palier par Ascension.** Avec deux, la boutique
demandait x25 de rendement par groupe quand le seuil ne monte que de x5
à x8 : les paliers s'éloignaient 3 à 5 fois plus vite que le pouvoir
d'achat. Les 15 générateurs couvrent les 15 Ascensions.

⚠️ **Les prix FIXES étaient le pire bug de l'équilibrage.** Le 1er
Esprit coûtait 910 pièces à toutes les Ascensions alors que le revenu
est multiplié par le bonus : 228 secondes de jeu à A0, 1 seconde à A5.
Le joueur remontait toute la boutique en minutes.

⚠️ **`gainCoins` est réservé à ce que le joueur PRODUIT.** Toute
récompense qu'on lui DONNE se crédite directement — sinon le bonus
d'Ascension est compté deux fois (x15 à A3 sur un achat en Diamants).

⚠️ **L'Ascension doit vider `pendingGainRef`.** Les pièces sont versées
toutes les 100 ms ; sans ça, ce qui attendait était recrédité juste
après la remise à zéro.

⚠️ **Un changement d'échelle révèle des bugs anciens sans les créer.**
Les deux points ci-dessus existaient depuis longtemps ; l'ancien bonus
à x1,30 les rendait invisibles.

⚠️ **Deux noms de boutique trop proches = un joueur qui achète le mauvais
article.** « Titan de Foudre » doublonnait « Titan Mécanique » ; renommé
Héraut d'Orage. Un contrôle peut vérifier qu'un nom EXISTE, jamais qu'il
appartient à l'univers du jeu : tout ajout de contenu se valide avec
l'auteur.

---

## 8. Équilibrage

Joueur à la main, 4 taps/s. L'autoclicker de l'auteur (~142/s) est un
outil de test, **jamais** une référence d'équilibrage.

| Groupe | A0 | A1 | A2 | A3 | A4 | A5 |
|---|---|---|---|---|---|---|
| Durée (sim, 24/09) | 3,0 h | 3,9 h | 4,3 h | 6,2 h | 6,8 h | 8,1 h |

Ce sont les `DUREES_CIBLES` de `audit-quetes.js` (±15 %) : elles gardent
le rythme, elles ne le décident pas.

Gains hors ligne plafonnés à **15 % du seuil de l'Ascension en cours**
(`OFFLINE_MAX_SHARE`). Le plafond de 2 h ne bornait que le TEMPS, pas la
VALEUR : une nuit rendait jusqu'à 106 % de l'Ascension.

⚠️ `ASCENSION_THRESHOLDS` est une table de 14 valeurs **mesurées**. Tout
changement d'équilibrage la périme.

### Les paliers de tap ÉTAIENT l'économie (24/09)

Croissance ×2,5 par niveau (demande de l'auteur, était 1,45). Mesuré
avant : le tap faisait **96 à 100 %** de la production à tous les groupes,
les générateurs 0 à 4 %. Le simulateur n'achetait que 4 générateurs sur
15 ; les défis forçaient les autres.

⚠️ **×2,5 SEUL = A2 à 17 h au lieu de 4,3, A3-A5 ×2,5.** Aucune croissance
au-dessus de 1,45 ne gardait les durées : les paliers 3-10 (bonus 4 à
512) plafonnent et rien ne prend le relais. Une valeur demandée par
l'auteur se mesure quand même AVANT d'être poussée — la session d'avant
l'avait écrite sans mesurer, puis annulée.

Le levier de compensation est `AJUSTEMENT_ASCENSION` (seuil + prix
ensemble), remesuré par **dichotomie groupe par groupe, en boucle** : la
surprime des paliers lit les seuils des groupes suivants, donc l'A2
déplace l'A1 et l'A0. Trois pièges rencontrés en l'appliquant :

1. **L'ajustement ne touche pas les prix fixes** (Pacte, Faveur, Dégâts
   critiques, Sanctuaire, Veilleur). L'A0 est donc non compensable (86 %
   de son budget) et passe de 2,2 à 3,0 h — assumé, c'est l'effet direct
   de la demande. Et à l'A2 (÷5), « 9 niveaux de Pacte » devenait 12 % du
   seuil pour +9 tap sur 2 300 : `auditCoutCroissant` l'a vu, cibles
   ramenées à leur poids d'avant (2,9 %).
2. **Les parts des paliers sont quantifiées ×2,5 et invariantes à
   l'ajustement** : seule une combinaison de niveaux finaux tient le
   budget 80-100 %, et c'est le niveau FINAL qui compte (60 % du cumul).
3. **Le joueur « en avance » d'`auditPlafondAchats` dépend de la pente** :
   +15 % de niveaux valait pour 1,45 ; à ×2,5 il possédait 118 % du seuil
   sur un article. L'avance est lue dans `growth` (1,15 → 1,045).

Après : tap/clic à l'A2 1 068 (7 886 avant), passif 0 à 14 %. Les
générateurs restent faibles : chantier suivant, pas celui-ci.

4. ⚠️⚠️ **Changer l'économie périme les cibles d'ÉTAT écrites.** Les
   « Mets N de côté » et « Atteins N/s » ont un floor écrit calé sur la
   production simulée (de côté = 94 s de production à la fin de l'œuf ;
   passif = 80 % de l'atteignable). Après la passe 2, le tap divisé par
   2 à 7 laissait « Mets 32 M de côté » à 7 fois l'étalon (11 min de
   production au lieu de 5), et AUCUN contrôle ne le voyait :
   `auditFaisableAuMoment` ne juge que le passif. Deux instances ont
   poussé la même passe sans le faire, alors que la passation l'écrivait
   en toutes lettres. Désormais : `auditCoteEtalon`, et tout changement
   de prix, de rendement ou de croissance recalcule les 40 cibles d'état
   (A1-A5 ; l'A0 est réglé à la main avec l'auteur).

5. ⚠️ **Deux instances d'une même conversation peuvent pousser.** Le
   « Réessayer » de l'auteur a lancé une seconde instance qui a poussé la
   passe 2 pendant que la première la faisait aussi. Toujours `git fetch`
   avant de commiter, et comparer avant de pousser un doublon.

⚠️ **Les pauses d'énergie se comptent, elles ne se cadencent pas.** Le
simulateur en créditait une toutes les 10 min de jeu actif, soit 17 à
25 par groupe, pour une règle de l'auteur à 9 par Ascension : le nombre
de recharges dépend des combats à faire, pas du temps passé à taper.
Poids mesuré : 10 % sur la durée de l'A0. Toute mesure faite avec
l'ancien modèle est périmée (`H.pausesParGroupe`).

**Ouvert** : `auditTropFacile` est rouge sur les groupes 2 à 5 — des
défis encore trop faciles, à caler œuf par œuf avec la règle du §4.

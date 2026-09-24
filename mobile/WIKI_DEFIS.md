# Wiki des défis — Paradox

> # 🛑 STOP — LIRE CE FICHIER VAUT ORDRE DE CONTRÔLER
>
> **Tu viens d'ouvrir ce wiki. Avant toute autre chose, lance :**
>
> ```
> NODE_PATH=<dossier avec @babel/core> node mobile/tools/verifier-defis.js
> ```
>
> **Et rapporte le résultat à l'auteur, même s'il ne l'a pas demandé.**
>
> Ce n'est pas une suggestion. L'auteur l'a posé comme règle le 20/09 :
> « quand je te demande de lire le wiki, tu dois obligatoirement faire un
> contrôle 100 % ».
>
> ⚠️ **Pourquoi.** On ouvre ce fichier pour vérifier une règle avant de
> modifier un défi. C'est exactement le moment où un défaut introduit
> plus tôt est encore réparable — et le moment où on l'oublie le plus
> facilement, l'esprit occupé par le changement en cours.
>
> ⚠️ **Sans qu'on le demande non plus.** Après TOUTE modification de
> défi, de prix, de seuil ou de rendement : contrôle complet, et le
> résultat annoncé. Un rouge tu, c'est une cassure qui voyage jusqu'à la
> partie d'un joueur.


Un tableau par FAMILLE de défis. Les défis se répètent d'une Ascension à l'autre : ce document décrit la règle, pas chaque occurrence.

---

## 📌 RÈGLES POSÉES PAR L'AUTEUR — à relire avant TOUT changement de défi

Cette section est la première à consulter. Chaque règle vient d'une
demande explicite ; ne pas la respecter, c'est refaire une erreur déjà
payée.

| Règle | Depuis |
|---|---|
| **Paliers de tap : ×2,5 par niveau** (comme le Pacte, ×2). Un palier plafonne vers le niveau 7-10 : démarreur, pas moteur. Les défis « Achète N niveaux » se calent en **part du seuil** (final 7/8 · 8/9 · 10/9 · 10/10 · 10/10 de l'A1 à l'A5) ; l'ajustement par Ascension est remesuré par dichotomie, puis les **cibles d'état sont recalculées** (passif = 80 % de l'atteignable à l'œuf, de côté = 94 s de production — contrôle `auditCoteEtalon`) | 24/09 |
| **Jamais deux défis d'ACHAT d'affilée**, y compris d'un œuf au suivant | 20/09 |
| **Aucun défi d'AVENTURE dans l'œuf 1** — le joueur n'a pas de créature | 20/09 |
| Le **premier défi du jeu** est celui des pièces, pas un achat | 20/09 |
| Le **deuxième défi du jeu est le Pacte** — départ du tuto | 20/09 |
| Jamais deux défis de la **même métrique** dans le même œuf | 20/09 |
| Un défi doit être **faisable au moment où il ARRIVE**, pas en fin de groupe | 21/09 |
| Pacte, Faveur, Dégâts critiques : **« Achète N »** (delta). Sanctuaire et Veilleur : « au niveau N » (ils plafonnent) | 21/09 |
| Le texte et le mode disent la même chose : **« Achète » = delta, « au niveau » = absolu** | 21/09 |
| Un défi d'achat demande **ce qui manque pour le TOTAL prévu**, calculé quand il APPARAÎT — jamais plus que la cible écrite, jamais moins de 1 | 21/09 |
| Un défi de **record** (Transe, taps d'affilée) ne se valide que lorsqu'il est **affiché** | 21/09 |
| Les taps d'affilée comptent **depuis l'apparition du défi**, pas depuis le début de la série | 21/09 |
| La 2ᵉ Transe d'un groupe n'est **jamais plus courte** que la 1re | 21/09 |
| L'**œuf 1 de l'Ascension 0** est fixé par l'auteur : il échappe à l'ordre des coûts | 21/09 |
| Le mini-boss s'annonce : **« ⚠️ Attention, boss en approche » 3 · 2 · 1** | 21/09 |
| **Aucun défi ne se valide avant d'être APPARU**, quelle que soit sa métrique | 21/09 |
| Un seul défi d'achat ne coûte **jamais plus de 60 %** du seuil — Pacte, Faveur et Dégâts critiques compris | 21/09 |
| Les **étapes d'un même article gardent leur ordre** : il décide quels niveaux chaque défi couvre | 21/09 |
| Tout nouveau contrôle arrive **avec son sabotage** dans `verifier-controles.js` | 21/09 |
| **Pièces de côté = 5 min de production** au moment où le défi arrive (étalon de l'auteur : 18 000 au défi 11) | 21/09 |
| Taps d'affilée : **140 → 180 à l'A0**, puis montée continue jusqu'à **400** à l'A5 | 21/09 |
| **+35 %** sur les 3 premiers exemplaires des générateurs **que chaque Ascension demande** — jamais tous | 21/09 |
| Une cible **hors achats ne redescend jamais** dans un groupe | 21/09 |
| Chaque Ascension reste à **±15 % de sa durée cible** | 21/09 |
| Un défi d'ÉTAT se recalcule à son apparition : passif **+20 %**, Aventure **+5 niveaux**, de côté **+5 min de production**, Sanctuaire/Veilleur **+2** | 21/09 |
| Les achats sont **répartis sur tout le groupe**, jamais tassés au début | 21/09 |
| **8 défis par œuf** (« le joueur aura l'impression de mériter son œuf ») : les 2 ajoutés sont des **activités**, jamais des achats | 21/09 |
| Un étalonnage ne s'accroche **jamais à un identifiant** de défi : en secondes, ou en valeur | 21/09 |
| Transe et cible dorée **montent petit à petit**, en chaîne continue sur les 6 Ascensions | 21/09 |
| Un palier de tap n'est **jamais fermé** : avant son Ascension, il coûte la **racine de l'écart de seuil** en plus | 21/09 |
| Ajustement par Ascension sur le **seuil ET les prix** ensemble (règle des 90 % intacte) | 21/09 |
| Les **3 premiers œufs** ne donnent jamais mieux qu'une créature **rare** | 21/09 |
| Un **générateur** est cher avant l'Ascension qui le demande, comme les paliers — jamais fermé | 21/09 |
| Deux défis de passif par groupe : **facile à l'œuf 2, exigeant à l'œuf 6** | 21/09 |
| Les défis de **taps d'affilée** vont de 120 à 400, jamais moins | 20/09 |
| Un **record** repart de zéro au tirage — jamais l'exploit d'avant | 20/09 |
| L'**œuf 1 est un tutoriel** : ses défis sont volontairement rapides | 20/09 |
| Les défis d'achat disent **« Achète N »**, jamais « Possède N » | 20/09 |
| Un défi d'achat ne réclame **jamais plus que ce qui reste** dans le groupe | 20/09 |
| Le **bonus d'un palier de tap double** à chaque palier : 1, 2, 4, 8… | 20/09 |
| **7 œufs de 6 défis** par Ascension, soit 42 défis | 20/09 |
| **2 nouveaux générateurs + 2 nouveaux paliers de tap** par Ascension | 19/09 |
| Les anciens articles **reviennent** dans les défis des Ascensions suivantes | 19/09 |
| Chaque achat est **scindé en deux étapes** dans des œufs différents | 20/09 |
| Les cibles d'un même article **ne redescendent jamais** dans un groupe | 20/09 |
| Le **coût** d'un défi d'achat ne redescend JAMAIS dans un groupe | 20/09 |
| Les défis d'achat d'un groupe coûtent **80 à 100 %** de son seuil | 20/09 |
| Tout article **atteignable** est demandé par au moins un défi | 20/09 |
| Aucun défi ne **précède le déblocage** de son sujet | 20/09 |
| Le **seuil se déduit du coût** des défis, pas l'inverse | 20/09 |
| Durées visées : **2,8 / 3,5 / 5 / 6,5 / 8 / 10 h** au tap à la main | 20/09 |
| Hors ligne **standard** : autoclickers × 25 % × temps, 2 h max, **sans plancher** | 21/09 |
| Toute valeur qui décide de l'Ascension doit rester un **nombre fini** | 21/09 |
| Le **diagnostic ne doit jamais casser** le jeu qu'il surveille | 21/09 |
| Toute mesure passe par **`simulerGroupe`**, jamais une simulation à part | 20/09 |
| Une cible ÉCRITE (`fige: true`) ne se recalcule jamais | 20/09 |
| Le **document est régénéré** après tout changement de défi | 20/09 |
| Sanctuaire et Veilleur gardent « monte au niveau N » — ils plafonnent | 20/09 |
| Les défis d'achat consomment **90 % du seuil**, 10 % de farm final | 19/09 |
| La difficulté **monte à chaque Ascension**, sans jamais redescendre | 19/09 |
| Un défi d'achat se repère à sa **métrique**, jamais à son texte | 20/09 |
| Les noms d'articles ne vivent QUE dans `clickerLogic.js` | 20/09 |
| Un nombre de pièces ne veut rien dire **hors de son Ascension** | 19/09 |

⚠️ **Le document de la conversation** surligne les défis d'ACHAT en
rouge et ceux d'AVENTURE en vert, dans des blocs `diff` — Markdown n'a
aucune autre façon d'afficher de la couleur.

---

### 🎲 Comment les défis sont tirés

**La liste est écrite à l'avance.** `QUEST_SEQUENCE` contient les 7 œufs
de 6 défis, dans cet ordre. Aucun tirage au sort.

Ce qui est **calculé au moment où l'œuf est distribué** :

| | |
|---|---|
| La **cible** | base × échelle du groupe, puis FIGÉE pour cet œuf |
| L'**article** visé par un défi d'achat | selon le numéro d'Ascension |
| L'**ordre** dans l'œuf | réarrangé pour alterner achats et autres défis |

Exemple : le défi des pièces porte `target: 750`. Au groupe 0 il demande
750, au groupe 1 → 9 000, au groupe 3 → 530 000.

⚠️ **« ACHÈTE N » et non « POSSÈDE N ».** En mode absolu, un défi
demandant 5 Esprits était déjà rempli si un défi précédent en avait fait
acheter 5 — il s'annulait tout seul. En mode delta, le compteur part de
zéro quand le défi commence.

---

### 🧰 LES CONTRÔLES — quoi lancer, et quoi faire quand c'est rouge

```
NODE_PATH=<dossier avec @babel/core> node mobile/tools/verifier-defis.js
```

Trente-deux contrôles. Vert = le changement peut partir. Chacun est né
d'un bug réel et a été **prouvé** en réintroduisant ce bug.

#### Les contrôles de GROUPE — les plus précieux

Ils regardent l'enchaînement, pas le défi isolé. **Une cassure naît
rarement dans un défi ; elle naît dans leur suite.**

| Contrôle | Si c'est rouge |
|---|---|
| `auditBudgetGroupe` | Recalculer le seuil : `coût des achats du groupe / 0,90`. Ne jamais ajuster les défis pour coller au seuil — c'est le seuil qui suit. |
| `auditCoutCroissant` | Réordonner le groupe en simulant : à chaque étape, prendre l'achat le moins cher **au moment où on le prend**. Trier sur les prix unitaires ne suffit pas. |
| `auditPlafondAchats` | Vérifier que `plafondAchatsGroupe` lit bien `defisEcrits.js`. Sinon, baisser la cible du défi visé. |
| `auditDureeCroissante` | Monter le seuil du groupe qui retombe. C'est **lui** qui fait foi sur les durées, pas les outils de travail. |
| `auditEquilibreFamilles` | Remplacer un défi de la famille en excès par un de la famille manquante. |
| `auditArticlesOrphelins` | Un article n'est demandé nulle part : lui donner un défi, ou vérifier qu'il est bien hors du contenu écrit. |
| `auditPrerequisTenus` | Déplacer le défi APRÈS celui qui débloque son sujet — ou relever la cible de ce dernier. |
| `auditFaisableAuMoment` | Le défi réclame plus que ce que le joueur a **à l'endroit où il tombe**. Le déplacer plus tard, ou baisser sa cible au niveau atteint à ce moment-là. |

#### Les contrôles de DÉFI

| Contrôle | Si c'est rouge |
|---|---|
| `auditMetriquesIncrementees` | **Danger maximal.** Une métrique que le jeu n'augmente jamais bloque l'œuf pour toujours. Vérifier l'écriture dans l'écran, ou corriger la table des métriques dérivées. |
| `auditInfaisable` | La cible dépasse 60 % du seuil : la baisser. |
| `auditTropFacile` | Cible trop basse ou déjà acquise : la relever, ou changer la famille du défi. |
| `auditAchatsColles` | Deux achats se suivent : intercaler un défi d'une autre famille. |
| `auditDefisEcrits` | Structure du fichier cassée : 6 défis par œuf, identifiants uniques, Ascension en dernier. |
| `auditMetriquesIncrementees` (bis) | ⚠️ Il dit qu'une métrique EXISTE, pas qu'elle mesure ce que son libellé annonce. « Enchaîne N taps » lisait le MULTIPLICATEUR de Transe pendant des semaines : le contrôle était vert, le défi mentait. **Relire le libellé contre la métrique à chaque ajout.** |
| `auditSignalement` | Le détecteur rate une panne, crie sur un état sain, ou **le filet de sécurité d'`index.js` plante**. Ce dernier cas est le plus grave : sans filet, une erreur au démarrage redevient un écran blanc muet. Remettre chaque dépendance du filet dans son propre `try`. |
| `auditDocConforme` | Le document remis à l'auteur ne dit plus ce que le jeu affiche : **régénérer le document**, ou trouver le recalcul qui s'applique par-dessus une cible figée. |
| `auditLibelles` · `auditLibelleSansArticle` | Le texte ne dit pas la vraie cible, ou ne nomme pas son article. |

#### Les contrôles de CODE

Ils lisent la source, pas les données. Ils attrapent ce qu'aucun test de
logique ne voit.

| Contrôle | Si c'est rouge |
|---|---|
| `auditEtatComplet` | Un appel au moteur reçoit un fragment d'état. Passer l'état complet — un fragment ne lève aucune erreur, il rend des zéros. |
| `auditInstantanesAJour` | Un instantané lit une valeur capturée au rendu. Lire la `ref`. |
| `auditResetSurChangement` | La sauvegarde réimpose l'ancien état après une mise à jour. Conditionner à `defsChangees`. |
| `auditNomsEnDur` | Un nom d'article est écrit ailleurs que dans `clickerLogic.js`. |
| `auditSubstitutions` | Un chemin retire un défi sans passer par `peutEtreRemplace`. |
| `auditTamponsAscension` · `auditRecompenseDoublee` | Des pièces survivent à l'Ascension, ou le bonus est compté deux fois. |

### ⏱️⏱️ LE SIMULATEUR EST CALÉ SUR LES CHRONOS RÉELS (21/09)

⚠️⚠️ **Mes durées étaient fausses d'un facteur 2,5.** Le simulateur
calculait le tap SANS la Transe (×3 après 50 taps), SANS les critiques
(×1,26 au début de l'A0, ×2,78 à la fin) et SANS les pouvoirs de créature
(×12 pendant 15 s par minute) — alors que le jeu multiplie les trois.
L'auteur : « je vais mettre 1 h 05 pour finir l'A0, tu t'es trompé dans
tes calculs ». Il avait raison.

Empiler ces facteurs donnerait ×14 et une Ascension en 12 minutes, ce qui
serait faux aussi : le joueur passe du temps dans les menus, la boutique
et l'Aventure, ne tient pas la Transe en continu, n'attrape pas toutes les
bulles. **On ne devine donc pas : un seul coefficient, `facteurJoueurReel`
= ×2,48 sur le tap, CALÉ sur ses chronos.**

| Point de mesure | Simulé | Mesuré |
|---|---|---|
| Défi 17 | 25 min | 20 min (avec pubs) |
| Défi 32 | 48 min | 50 min |
| A0 complète | 65 min | 65 min |

**Durées réelles : 1,1 / 1,1 / 1,4 / 2,9 / 3,3 / 4,2 h — 14 h au total**,
et non 35,7 h. À revoir dès qu'un chrono contredit le simulateur.

⚠️ Conséquence à trancher : le jeu dure 14 h, pas les 35,7 h annoncées.
Étirer jusqu'aux cibles d'origine (2,8 / 3,5 / 5 / 6,5 / 8 / 10 h)
multiplierait tous les seuils par ~2,5. **Décision de l'auteur.**

⚠️ Autre conséquence mesurée : avec le simulateur juste, un joueur optimal
n'achète PRESQUE AUCUN générateur avant l'A2 — le tap écrase tout. Les
défis de passif de l'A0 et de l'A1 tombent à « Atteins 2 pièces par
seconde ». Le chantier « rendre les autoclickers utiles » est chiffré.

### ⏱️ Mesure réelle de l'auteur (21/09)

**20 minutes pour atteindre le défi 17** de l'Ascension 0, en comptant 2
vidéos pour les œufs et 2 pour 7 niveaux d'Aventure. Son verdict : « on
est vraiment pas mal ». Le simulateur donne 3,0 h pour les 42 défis de
l'A0 — les premiers œufs, tutoriel compris, sont volontairement rapides.
Prochaine mesure prévue : les défis suivants, chronométrés.

### ⚠️ Étendre une demande « à la suite logique » : MESURER d'abord

Le 21/09, « +35 % sur les 3 premiers Esprits et Mains » a d'abord été
étendu à TOUS les générateurs de TOUTES les Ascensions. Mesuré : l'A1
tombait de 3,4 h à 2,7 h (sous l'A0), l'A2 de 5,0 h à 3,4 h. Le
simulateur achète au plus rentable ; renchérir tous les générateurs lui
faisait délaisser de vieux générateurs peu utiles, et il accélérait.
Ciblée sur les générateurs que chaque Ascension DEMANDE (lus dans le
fichier des défis), la hausse garde les durées. `auditDureeCible` et
`auditMajorationPrix` le tiennent désormais.

⚠️ Le wiki listait les générateurs par Ascension de travers (A1 : «
Automate + Colonie » ; le fichier demande Esprit + Main). **On lit le
fichier, jamais le wiki**, pour savoir ce qu'un groupe demande.

### 🛡️ LE CONTRÔLE DES CONTRÔLES — à lancer avec le reste

```
NODE_PATH=<dossier avec @babel/core> node mobile/tools/verifier-controles.js
```

Pour **chaque** contrôle de la suite, un **sabotage réel** dans les
fichiers du jeu — le défaut précis qu'il doit attraper. On l'applique, on
lance le contrôle seul, il DOIT crier, on restaure. Les fichiers sont
comparés **octet par octet** à la fin : un sabotage oublié serait publié
au prochain push.

**Pourquoi il existe** : le 21/09, il a trouvé que **dix contrôles
lisaient encore les anciens modèles de défis**, abandonnés la veille. Ils
restaient verts quoi qu'on écrive dans les vrais défis. Et
`auditInfaisable` ne calculait pas le coût du Pacte, de la Faveur ni des
Dégâts critiques : un défi à 40 niveaux de Pacte passait sans alerte —
et le contrôle réparé a aussitôt trouvé un défi réel à **74 % du seuil**.

⚠️⚠️ **RÈGLE : tout nouveau contrôle arrive AVEC son sabotage** dans
`verifier-controles.js`. Sinon ce dernier échoue : « lancé par la suite,
mais JAMAIS prouvé ». Un contrôle qui n'a jamais crié ne vaut rien — il
ressemble à un contrôle satisfait.

⚠️ Un sabotage « PÉRIMÉ » (son repère a disparu du code) est un échec,
pas un passe-droit : il force à le tenir à jour.

### 🔒 La suite est blindée

- **Une panne n'est jamais couverte par la tolérance.** Avant, un
  contrôle qui PLANTAIT comptait pour une anomalie : avec une tolérance
  de 22, il passait au vert en silence.
- **Un contrôle introuvable** (renommé, supprimé) est un échec.
- **Un contrôle qui existe sans tourner** est un échec — sauf s'il figure
  dans `RETRAITES`, avec sa raison écrite. Retirer un contrôle devient une
  décision, jamais un oubli.

| Retiré | Raison |
|---|---|
| `auditPool` | le pool de remplacement ne sert plus aucun joueur |
| `auditRemplacements`, `auditHorsSchema`, `audit` | comparaient aux anciens modèles |
| `auditCiblesFixes` | couvert par `auditCibleSuitLeJoueur`, rebranché |
| `auditAscension` | couvert par le budget, les durées et `auditFaisableAuMoment` |
| `auditAvailable` | les défis écrits n'ont plus de condition ; couvert par `auditPrerequisTenus` |

### ⚠️ Trois règles de méthode pour les contrôles eux-mêmes

**Un contrôle non prouvé ne vaut rien.** On le vérifie en réintroduisant
le bug : s'il reste vert, il ne sert à rien.

**Un contrôle qui hurle sur des cas normaux cesse d'être lu.** Plusieurs
ont dû être restreints après coup — ils signalaient leur propre
documentation, ou des situations inatteignables.

**Deux instruments qui ne partagent pas leur état ne peuvent pas être
comparés.** Ce piège a coûté du temps trois fois. En cas de désaccord,
c'est le contrôle de la suite qui fait foi.

### 🔍 Le contrôle du coût croissant

Idée de l'auteur : « le défi 152 est plus cher que le 156 alors qu'il est
avant — est-ce que ton calculateur pourrait dénoncer ce genre de
malfaçon ? »

Oui. `auditCoutCroissant` calcule le **coût réel** de chaque défi
d'achat — pas sa cible, pas son rang — en tenant le compte de ce que le
joueur a déjà acheté dans le groupe, et refuse tout défi moins cher que
le précédent.

⚠️ Il a trouvé **34 défis mal placés** du premier coup, dont un à 19
millions au groupe 0 — soit 46 fois le seuil de l'Ascension. Un défi
infaisable que les autres contrôles ne voyaient pas, parce qu'ils
regardaient chaque défi isolément sans tenir le compte des achats
précédents.

⚠️ Trier sur le coût « à froid » ne suffit pas : acheter le 10e
exemplaire coûte plus cher que le 3e. Le tri se fait donc en SIMULANT le
groupe, en prenant à chaque étape l'achat le moins cher **au moment où
on le prend**.

---

### 📏 UN SEUL SIMULATEUR

`simulerGroupe(ascension, tapsParSec)` dans `audit-quetes.js`. Tout
l'appelle : `duree.js`, `auditDureeCroissante`, toute mesure future.

⚠️ **Il y en avait deux, et ils se contredisaient** : 2,9 h et 9,4 h pour
le même groupe. J'ai cherché le défaut dans l'équilibrage pendant
plusieurs passes alors qu'il était dans mes instruments — l'un ignorait
les paliers de tap, l'autre les achetait **sans vérifier qu'ils sont
VERROUILLÉS** tant que le Pacte n'est pas au niveau 10. Le second
rendait le jeu sept fois plus rapide qu'il ne l'est.

⚠️ **Un contrôle qui mesure avec son propre instrument ne contrôle que
lui-même.** Ne jamais recoder une simulation à côté : appeler celle-ci.

### 🌙 Le hors ligne : le calcul standard des idle games

```
gain = production des AUTOCLICKERS × 25 % × temps d'absence
       plafonné à 2 heures, sans plancher
```

**Vérifié le 21/09** chez Cookie Clicker (5 % pendant 1 h au départ,
jusqu'à 91 % une fois tout amélioré), Idle Miner Tycoon (~10 %, doublable
par une pub) et AdVenture Capitalist (100 % avec les managers). **Le
pourcentage varie énormément ; une seule constante vaut chez tous : le
hors ligne ne compte que la production AUTOMATIQUE, jamais le tap.**

⚠️ J'avais affirmé le 19/09 que « la plupart font 25 % sur 2 h » sans
l'avoir vérifié. Faux : il n'y a pas de pourcentage standard. Le 25 % est
un choix, au milieu de la fourchette.

⚠️⚠️ **JAMAIS DE PLANCHER EN PART DU SEUIL.** Le 20/09 j'en avais posé un :
il a versé 1,5 milliard à un joueur qui produisait 337 pièces/s.

⚠️⚠️ **LE RISQUE CACHÉ : BLOQUER L'ASCENSION POUR TOUJOURS.** Le gain
s'ajoute à `totalEarned`, qui décide de l'Ascension. Un seul `NaN` le
rendrait `NaN` pour toujours — il est sauvegardé — et `NaN >= seuil` est
toujours faux : le joueur ne pourrait plus jamais ascensionner, sans
message d'erreur. **L'auteur ne peut pas vérifier ce cas lui-même.**
`offlineEarnings` rend donc TOUJOURS un entier fini, positif ou nul ;
`auditHorsLigne` l'attaque avec vingt entrées pourries à chaque
contrôle.

### ⏱️ Régler la DURÉE d'un groupe

**Le levier :** multiplier les PRIX des articles que ce groupe vise ET
son SEUIL par le même facteur multiplie sa durée d'autant. Le joueur
achète le même matériel k fois plus cher, produit au même rythme, et met
k fois plus longtemps.

⚠️ **Ne toucher qu'au seuil ne marche pas** : la durée monte, mais les
défis d'achat ne valent plus que 90/k % du seuil et le joueur passe le
groupe sur un seul défi. Les deux barèmes bougent ENSEMBLE.

⚠️ **Lire dans le fichier quels articles un groupe vise**, ne jamais le
déduire d'un index. Le déduire donnait un décalage d'un groupe : je
multipliais les prix du Léviathan en croyant agir sur l'Ascension 4, qui
vise en fait Golem, Dragon et Phénix. Le groupe ne réagissait pas, et
j'ai cherché ailleurs pendant plusieurs passes.

⚠️ **Amortir la correction à 45 %.** Les groupes ne sont pas
indépendants — les défis d'un groupe visent aussi des articles du
précédent — donc une correction franche fait osciller les voisins. Avec
l'amortissement, six passes suffisent.

⚠️ **Le seuil se recalcule à CHAQUE passe** (coût / 0,90), sinon le
budget dérive pendant qu'on poursuit la durée.

### ⏳ Mesurer AU MOMENT où le défi arrive

⚠️⚠️ **Le piège qui a coûté le plus cher le 21/09, deux fois le même
jour.** Mesurer l'état du joueur en FIN de groupe décrit quelqu'un qui a
DÉJÀ tout fait — jamais celui qui reçoit le défi.

- Le hors ligne affichait 72 % du seuil au dernier instant, 0,1 % en
  moyenne.
- « Atteins 29 000 pièces par seconde » était « atteignable » avec
  1,6 million par seconde en fin de groupe. À l'œuf 2, où il tombait, le
  joueur avait **zéro**.

**Le profil réel du passif** : il reste à zéro pendant deux œufs — le
joueur achète du tap, plus rentable en début de groupe — puis explose à
partir du troisième. Un défi de passif précoce ne peut donc demander que
ce que donnent quelques générateurs bon marché.

⚠️ `auditFaisableAuMoment` compare la cible à l'état du joueur **à la fin
de l'œuf où le défi tombe**. Référence : le plus grand du passif simulé
et de celui de trois exemplaires du générateur **le moins cher** — pas
du plus productif sous un seuil de coût, qui laissait passer des paliers
hauts aux dernières Ascensions.

⚠️ **Un libellé ne doit jamais écrire son nombre en dur.** La cible du
défi valait 10 et le texte disait encore « 29 000 » : le joueur aurait
lu un défi impossible pour un défi à sa portée.

### ⚡ PROCHAIN CHANTIER — les pouvoirs, idée de l'auteur (21/09)

« Tu vas ajouter le compteur sur l'œuf. Quand le joueur appuie une
première fois sur le deck, la créature apparaît autour de l'œuf ; quand
il appuie une dernière fois, ça active le pouvoir. Pour les créatures
mythiques, le temps d'attente est bien plus long que pour une peu
commune, pour équilibrer les pouvoirs cheatés des mythiques. »

- Compte à rebours affiché SUR L'ŒUF ;
- 1er appui sur le deck : la créature apparaît autour de l'œuf ;
- 2e appui : le pouvoir s'active ;
- temps de recharge selon la rareté.

✅ **DÉCIDÉ (21/09) : le deck REMPLACE complètement la bulle** qui
apparaît toutes les 60 s. L'auteur : « ça fait juste en sorte que le
joueur reste 1 min de plus, puis 45 s, puis 3 min — rétention max ». Le
pouvoir n'est plus un hasard à saisir en 4 secondes : c'est un rendez-vous
que le joueur attend, et la recharge est la raison de rester.

⚠️ Points à trancher en ouvrant le chantier, AVANT de coder :
  - un compte à rebours par créature du deck, ou un seul partagé ;
  - ce qui se passe si le joueur quitte l'écran pendant l'activation ;
  - les défis « Active N fois un pouvoir » : ils comptent les
    activations par le deck (vérifier `powerActivated`) ;
  - la recharge continue-t-elle hors ligne ?
Mesurer ensuite la durée des Ascensions : le gain moyen du tap change.

Proposition à MESURER avant d'appliquer (gain moyen du tap = 1 + durée ÷
recharge × (multiplicateur − 1), pouvoir de 15 s) : commun ×2,4 toutes
les 60 s → ×1,35 ; mythique ×18 toutes les 5 min → ×1,85 ; légendaire
×12 toutes les 3 min → ×1,92. Les raretés deviennent comparables au lieu
d'écraser la partie.

### ⏱️ Chronos de l'auteur, 3e passage (21/09) — avec pubs d'œufs, énergie au max en mode dev

1 œuf en 7 min · 2 à 10 min · 3 à 21 min · 4 à 31 min (300 000 pièces
en poche, 100 000 en moins d'une minute de tap, 37 pièces par tap) ·
Sceau de Puissance acheté à 26 min. Il avait tiré une ÉPIQUE en première
créature et une MYTHIQUE à l'œuf 3, et acheté la Colonie et l'Automate
(prévus pour l'A2) dès l'œuf 3 grâce à elles. Corrigé : rareté plafonnée
à « rare » jusqu'à l'œuf 3, générateurs chers avant leur heure.

### ⏱️ Chronos de l'auteur, 2e passage (21/09, en speedrun, œufs passés au bouton pub dev)

2 premiers œufs en 11 min · 3 œufs à 25 min · défi 32 à 41 min — et
**Ascension possible dès le défi 32 sur 56**.

⚠️⚠️ CAUSE MESURÉE : les paliers de tap. Un palier se débloque quand le
précédent atteint le niveau 5, et ils sont si bon marché que l'auteur
avait l'Éclat Primordial (prévu pour l'A2, +16/tap) dès l'œuf 3 de
l'A0, pour 2,3 % du seuil. Et les prix de base à partir du palier 7 sont
CASSÉS : Fracture du Réel (+256/tap) coûte 24 845, moins que la Griffe
du Vide (+64/tap, 25 472), elle-même moins que le Serment (40 763).
Prix par +1 de tap : de 6 065 (palier 3) à 557 (palier 7).
➡️ CORRIGÉ le jour même, sur le modèle de l'auteur tiré de Hero Heroes
Clicker (« ne pas les fermer, mais monter le premier achat vachement
haut » ; le prochain objet y coûte ~22 min de production) : un palier
coûte son prix normal à partir de l'Ascension dont les défis le
demandent, et la RACINE de l'écart de seuil en plus avant. À l'A0 : les
paliers 3-4 à 14-22 % du seuil, 5 à 8 à 190-300 %. Ajustement par
Ascension (1 · 1,3 · 1 · 1,7 · 1,9 · 1,9) sur seuil ET prix pour garder
des durées en montée : **2,6 / 3,4 / 4,3 / 5,9 / 6,7 / 8,0 h, 31 h au
total** (contre 14 h avant). ⚠️ Les prix de BASE des paliers 7 à 10 sont
toujours mal ordonnés entre eux (Fracture moins chère que Griffe) ; la
surprime les rend inaccessibles avant leur heure, mais la courbe reste à
redresser.

Transe et cible dorée : les clones ×2 donnaient 30 → 45 → 90 → 180 s
et 3 → 9 → 18 → 36. Remplacés par des chaînes continues : Transe +8 %
par défi (30 → 180 s sur les 24), cible dorée calée sur les repères de
l'auteur (5 à l'œuf 3, ~9 vers l'œuf 10), 65 au maximum.

### 🥚 8 défis par œuf (21/09)

**Pourquoi des activités et pas des achats** : ajouter des étapes d'achat
cassait l'échelle des coûts validée par l'auteur — cloner le plus gros
palier multipliait le budget par 1 900, et de petites étapes créaient des
écarts qu'une boucle de réparation faisait OSCILLER. Deux activités par
œuf (combats, cibles dorées, critiques, pièces de côté…) donnent le
sentiment de mériter l'œuf sans toucher au budget : seuils et durées
inchangés.

Outil : `mobile/tools/ajouter-defis.py`. Il évite chaque piège mesuré —
pas de libellé figé cloné, clones qui montent (×2) au-dessus du
précédent, plafonds humains (400 taps, 180 s), 7 exemplaires maximum par
métrique et par groupe, aucun Pacte (sa règle « 6 + 3 = 9 » est celle de
l'auteur). Dans le tutoriel : « 20 coups critiques » et « pièces de
côté » — un pouvoir y serait impossible, le joueur n'a pas de créature.

⚠️ L'étalonnage « de côté » s'accrochait à l'identifiant du défi 11 : le
réordonnancement l'a renommé, et l'étalon s'est rabattu sur le tutoriel,
fixé à 18 000 pièces après un défi 1 à 750. Étalon désormais en SECONDES
(94 s de production, la valeur de ses 18 000).

⚠️ `auditTropFacile` ne juge plus les records ni les défis d'état : le
jeu les recalcule à leur apparition. Juger leur cible écrite donnait 15
fausses alarmes au passage à 8 défis. Défis d'origine signalés : 21, leur
niveau d'avant.

### 🎯 Tous les défis s'adaptent au joueur

**Demande de l'auteur (21/09)**, après « Atteins 2 pièces par seconde »
alors qu'il en produisait 27 : « ce défi est complètement useless. Il
faut le même système de calcul pour TOUS les types de défis. »

| Type de défi | Règle à l'apparition | Son exemple |
|---|---|---|
| Achat | ce qui manque pour le total prévu | 4 Pactes déjà → en demande 2 |
| Revenu/seconde | **+20 %** de la production actuelle | 27/s → **32/s** |
| Aventure | **+5 niveaux** | chap 1 niv 10 → **chap 2 niv 5** |
| Pièces de côté | ce qu'il a **+ 5 min de production** | 47 000 → 97 000, ou 59 000 s'il tape peu |
| Sanctuaire, Veilleur | +2 niveaux, plafonné à 50 | |
| Records, taps à vie, créature | repartent de zéro / +5 | |

⚠️ Ces cibles ne peuvent que MONTER, jamais descendre sous la valeur
écrite, et restent atteignables par construction : +20 % de passif
s'achète, +5 niveaux se jouent, 5 minutes s'attendent.

⚠️ Un défi d'état qui s'adapte ne peut plus avoir de libellé à texte
figé : `auditLibelles` le refuse. C'est ainsi qu'on a découvert que les
18 défis d'Aventure affichaient un chapitre ÉCRIT EN DUR — « chapitre 1,
niveau 15 » au lieu de « chapitre 2, niveau 5 ».

### 📉 Les achats répartis sur tout le groupe

Mesuré le 21/09, dans LES SIX Ascensions : le dernier défi d'achat
tombait au 32e sur 42, et 90 % du budget était réclamé entre le 24e et le
36e. L'auteur finissait ses défis puis farmait 41 % du seuil sans rien à
faire — « pas bon pour la rétention ». L'outil de réordonnancement plaçait
les achats le plus TÔT possible ; il les répartit désormais régulièrement.
Dernier achat : défi 39-40.

### 💰 La règle du TOTAL pour les défis d'achat

**La règle de l'auteur**, mot pour mot : « On doit acheter 9 Pactes pour
accomplir l'A0 en tout. Il faut demander un TOTAL de 6 Pactes au défi 2,
et 3 de plus au 24. Si le joueur a déjà 6 Pactes au 2, le défi ne lui en
demandera qu'1 seul, et seulement 2 au 24. »

```
cible = min(cible écrite, max(1, total prévu − ce que le joueur a))
```

Le **total prévu** d'un défi = ce que les défis précédents du groupe font
acheter + sa propre cible.

| Ascension 0 — Pacte | Défi 2 | Défi 24 |
|---|---|---|
| Joueur au rythme | Achète **6** | Achète **3** → total 9 |
| 4 Pactes achetés d'avance | Achète **2** | Achète **3** |
| 6 Pactes déjà au défi 2 | Achète **1** | Achète **2** |

⚠️⚠️ **CALCULÉE AU MOMENT OÙ LE DÉFI APPARAÎT**, jamais seulement à la
distribution de l'œuf. Le 21/09, la cible était figée à la distribution,
quand le joueur n'avait encore rien acheté : il achetait 4 Pactes pendant
le défi 1, et le défi 2 lui en demandait 6 DE PLUS — 25 000 pièces à
taper en début de partie. La fonction était juste ; c'est son **appel**
qui manquait. `auditCibleBudget` vérifie désormais que l'écran l'appelle
au bon endroit.

⚠️ J'avais d'abord remplacé cette règle par un calcul « selon le coût »,
plus compliqué, qui donnait d'autres chiffres (1 au lieu de 2). L'auteur
avait déjà posé la règle du total : c'est elle qui fait foi.

**Garanties**, vérifiées sur chacun des 252 défis : un entier entre 1 et
la cible écrite ; jamais plus pour un joueur plus avancé ; aucun plantage
sur un état pourri. Seuls les achats **sans niveau maximum** sont
concernés — le Sanctuaire et le Veilleur gardent « monte au niveau N ».

### ⚠️ Régénérer `defisEcrits.js` : ne JAMAIS sérialiser un libellé

Le 21/09, un outil a réécrit le fichier en recopiant `String(q.label)`
depuis le module CHARGÉ — c'est-à-dire le code **après** sa
transformation par Babel. `fmtQ` est devenu `(0, _questFormat.fmtQ)`,
un nom qui n'existe pas dans l'app : **chaque défi de revenu passif
aurait planté à l'affichage**. La compilation passait — le code est
syntaxiquement valide.

➡️ On modifie **le texte source**, ligne par ligne. Le module chargé sert
à CALCULER, jamais à ÉCRIRE. `auditDefisEcrits` refuse toute trace de
code transformé et exécute chaque libellé.

⚠️ Un outil de réordonnancement doit lire les définitions **du moteur**
(`estDefiAchat`, `familleDe`, `plafondFamille`) : ma première version
recopiait sa propre idée d'un « achat », oubliait le Sanctuaire et le
Veilleur, et collait des achats les uns aux autres.

### 🧮 Le calculateur d'achats

Un joueur qui a beaucoup investi ne doit jamais se retrouver bloqué.

**Le problème.** Le prix d'un générateur monte de **25 % par
exemplaire** : le 20e coûte 87 fois le premier. Un défi disant « achète
5 de plus » est donc trivial pour un joueur en retard et **impossible**
pour un joueur en avance. Exactement l'inverse de ce qu'on veut.

**La règle.** On sait à l'avance combien le GROUPE ENTIER demandera —
c'est la somme des cibles de ses défis visant cet article. Si le joueur
en possède déjà autant, le défi ne réclame plus qu'**un** exemplaire.

À l'Ascension 0, le groupe demande **16 Esprits Frappeurs** au total :

| Le joueur en a | Le défi en demande |
|---|---|
| 0 | 3 |
| 7 | 3 |
| 13 | 3 |
| **15** | **1** |
| 30 | **1** |

⚠️ **L'adaptation ne peut que RÉDUIRE la demande, jamais l'augmenter.**
Un joueur en retard voit donc toujours la cible annoncée dans le
document. C'est ce qui la distingue des anciennes cibles dynamiques,
qui fuyaient devant le joueur.

⚠️ Ce que le plafond garantit, c'est qu'on ne demande qu'UN exemplaire —
pas que cet exemplaire soit bon marché. Un joueur à 24 Esprits paie 55 %
du seuil pour le 25e : c'est le prix de son propre sur-investissement.

---

### ⚠️ Deux pièges rencontrés en appliquant ces règles

**Un facteur appliqué à des valeurs déjà ajustées compose l'erreur.**
Une dizaine de recalibrages successifs avaient aplati toute l'échelle :
rendements de 0,23 à 2,7 sur quinze paliers, bonus de tap tombés à
0,005 — que le jeu affiche « +0 » puisqu'il arrondit. Reconstruire
depuis les PRINCIPES vaut mieux que corriger une n-ième fois.

**Une règle correcte sur le papier peut produire une échelle plate.**
Aligner le bonus de tap sur la « valeur au coin dépensé » du générateur
de même rang donnait 1 PARTOUT, parce que les paliers de tap coûtent
bien moins cher que les générateurs. Toujours vérifier la sortie, pas
seulement le raisonnement.

---

## Comment lire ce wiki

| Colonne | Ce que ça veut dire |
|---|---|
| **Par groupe** | Combien de fois ce défi apparaît dans les 7 œufs d'une Ascension |
| **Sur 26 œufs** | Combien de fois au total avant d'avoir les 26 créatures |
| **Cible de départ** | La valeur au tout début du jeu, avant toute Ascension |
| **Plafond** | La cible ne monte jamais au-delà, même après dix Ascensions |
| **Progression** | Comment la cible monte d'une Ascension à la suivante |

---

## 🎯 LA MÉTHODE — comment fixer les prix (règle de l'auteur)

**Le budget d'une Ascension, c'est son seuil.** Tout se calcule à partir de là.

### En trois étapes

**1. Le budget des défis d'achat = 90 % du seuil.**
Il en reste **10 %** que le joueur doit farmer pour lancer son Ascension.

**2. Ce budget se répartit en pourcentages entre les défis d'achat.**

| Œuf | Défi d'achat | Étape |
|---|---|---|
| 1 | Générateur le plus **ancien** | 1re |
| 2 | Générateur le plus ancien | **2e** |
| 3 | Générateur du milieu · palier de tap récent | 1re · 2e |
| 4 | Palier de tap ancien | 1re **et** 2e |
| 5 | Générateur le plus **récent** · générateur du milieu | 1re · 2e |
| 6 | Générateur le plus récent | **2e** |
| 7 | Palier de tap récent | 1re |

**13 à 15 défis d'achat par Ascension**, sur 42 défis au total.

Ils se répartissent ainsi :

| Nature | Nombre |
|---|---|
| Générateurs (3 articles × 2 étapes) | 6 |
| Paliers de tap (2 articles × 2 étapes) | 4 |
| Pacte | 2 |
| Sanctuaire et Veilleur | 2 |

⚠️ **Un défi d'achat se repère à sa MÉTRIQUE, jamais à son texte.** Le
repérer sur le libellé ratait « Monte le Sanctuaire », « Monte le
Veilleur » et tout ce qui ne commence pas par un mot connu — quatre défis
oubliés sur quatorze.

⚠️ **CHAQUE ACHAT EST SCINDÉ EN DEUX ÉTAPES**, placées dans des œufs
différents. L'auteur : « acheter 15 Esprits d'un coup peut être
décourageant, alors qu'en acheter 7 puis 8 plus tard, le joueur a le
temps de gagner des pièces entre les deux ». L'objectif final est le
même, l'effort est mieux réparti.

⚠️ Le coût se compte sur la cible FINALE, pas sur la somme des deux
étapes — la seconde ne paie que les exemplaires supplémentaires.
Confondre les deux m'a fait mesurer 289 % du seuil là où il n'y en avait
que 88.

⚠️ **L'ordre suit le COÛT : du moins cher au plus cher.** Le joueur vient
de tout perdre à l'Ascension — on ne lui demande pas son défi le plus
lourd au 3e défi du groupe. Mesuré avant correction : l'œuf 1 coûtait
31 % du seuil et l'œuf 7 seulement 13 %, exactement l'inverse.

⚠️ **Les cibles sont UNIFORMES** (3 exemplaires, niveau 5). C'est le
PALIER visé qui porte la progression du coût, pas la quantité. Faire
varier les deux les compose et casse l'ordre.

**3. Le prix de chaque article se déduit de sa part et de la cible du défi.**

### Exemple à l'Ascension 0 — seuil 421 000

| | |
|---|---|
| Budget des défis d'achat | 379 000 (90 %) |
| Reste à farmer | **42 000 (10 %)** |
| Part du générateur le plus récent | 22 % → 83 000 |
| Cible du défi | 2 exemplaires |
| **Prix de l'article** | **41 500 pièce** |

### Pourquoi ce dernier farm est VOULU

Le joueur doit sentir qu'il lui reste **un petit effort** avant une grosse récompense. Si l'Ascension tombe toute cuite en finissant le dernier défi, il perd ce moment — et avec lui une raison de revenir.

⚠️ À l'inverse, si ce reste est trop grand (30 % ou plus), il passe des heures sur un seul défi et décroche.

➡️ **La fourchette est 5 % à 15 %.** En dessous c'est offert, au-dessus c'est décourageant.

### Pourquoi la méthode est solide

- 🟩 **Le joueur ne peut jamais être bloqué** : le budget est calculé depuis le seuil qu'il atteindra de toute façon.
- 🟩 **Ajouter ou retirer un défi** ne demande que de redistribuer les pourcentages. Le total reste calé.
- 🟩 **Chaque Ascension se règle toute seule** : c'est le même calcul avec un seuil plus grand.

### ⚠️ Ce qui n'est PAS un problème

**Dépenser n'éloigne jamais de l'Ascension.** Le seuil compte les pièces GAGNÉES, pas celles qui restent en poche. Mesuré : le joueur dépense déjà 82 à 100 % du seuil pendant un groupe et ascensionne quand même — c'est justement en dépensant qu'il produit assez pour y arriver.

### Où on en est

| Ascension | Défis d'achat | Farm final |
|---|---|---|
| A1 | 84 % | 16 % |
| A3 | 91 % | 9 % |
| A5 | 88 % | 12 % |

Et l'ordre dans le groupe, à l'Ascension 5 :

| Œuf | Défi | Coût |
|---|---|---|
| 1 | Possède 5 Phénix Renaissants | 12 % |
| 3 | Possède 5 Léviathans des Abysses | 14 % |
| 4 | Monte Volonté du Paradoxe au niveau 8 | 18 % |
| 5 | Possède 5 Gardiens Célestes | 22 % |
| 7 | Monte Fracture du Réel au niveau 8 | 25 % |

---

## 💰 Gagner des pièces

### 🪙 Obtiens 750 pièces

Gagne des pièces, par le tap ou le passif. Le compteur repart de zéro au début du défi.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 2 | ~7 | 750 | aucun | pieces |

### 💰 Mets 25 000 pièces de côté

Garde des pièces EN RÉSERVE sans les dépenser. C'est ton solde qui compte, pas ce que tu as gagné.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 3 | ~11 | 25000 | aucun | pieces |

---

## ⚙️ Revenu passif

### ⚙️ Atteins 7 pièces par seconde

Achète des générateurs jusqu'à atteindre ce revenu par seconde.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 7 | aucun | pieces |

---

## 👻 Acheter des générateurs

### 👻 Possède 6 Esprits Frappeurs

Achète le générateur le plus ANCIEN des trois visés — le moins cher, donc le plus nombreux.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 8 | 6 | unites |

### ⚙️ Possède 2 Mains Spectrales

Achète le générateur le PLUS RÉCENT de ton Ascension. Son prix est calé pour que deux exemplaires coûtent un défi.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 2 | 2 | unites |

### ⚙️ Possède 4 Esprits Frappeurs

Achète le générateur juste en dessous du plus récent.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 4 | 4 | unites |

---

## ✊ Améliorer la frappe

### 🔗 Monte Pacte au niveau 7

Monte le Pacte dans la boutique. Chaque niveau double son prix.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 2 | ~7 | 7 | 24 | niveau |

### ✊ Monte la Faveur des Esprits au niveau 8

Monte le premier palier de tap de ton Ascension. Au tout début du jeu, vise la Faveur des Esprits.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 8 | 9 | niveau |

### 🪄 Monte les Dégâts critiques au niveau 7

Monte le second palier de tap de ton Ascension. Au tout début, vise les Dégâts critiques.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 10 | 7 | niveau |

---

## 🍀 Critiques

### 🍀 Monte la Faveur des Esprits au niveau 8

Monte la Faveur des Esprits — elle augmente ta CHANCE de coup critique.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 8 | 20 | niveau |

### 💢 Monte les Dégâts critiques au niveau 10

Monte les Dégâts critiques — ils augmentent la PUISSANCE du coup critique.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 10 | 24 | niveau |

### 💥 Obtiens 200 coups critiques

Tape jusqu'à déclencher ce nombre de coups critiques. Monter la Faveur accélère beaucoup.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 200 | aucun | actions |

---

## 👆 Taper

### 👆 Atteins 1 500 taps au total

Tape, simplement. ⚠️ Ce défi s'adapte : il te reste toujours au moins 200 à 300 taps à faire.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 1500 | aucun | actions |

### 🔥 Enchaîne 30 taps sans pause

Enchaîne des taps SANS PAUSE. Un arrêt remet le compteur à zéro.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 30 | 50 | actions |

---

## 🔥 Transe et pouvoirs

### 🔥 Reste en Transe x2,5 pendant 25 secondes

Tiens la Transe sans interruption. Le record repart à zéro à chaque tirage de défi.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 2 | ~7 | 25 | 150 | transe |

### ✨ Active 5 fois un pouvoir

Active un pouvoir de créature en Aventure.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 5 | aucun | actions |

---

## ⭐ Cibles dorées

### ⭐ Touche 3 fois la cible dorée

Touche la cible dorée qui traverse l'écran.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 2 | ~7 | 3 | aucun | actions |

---

## ⚔️ Aventure

### ⚔️ Termine le chapitre 1, niveau 5

Termine ce niveau d'Aventure. C'est le plus long défi de chaque œuf.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 3 | ~11 | 5 | aucun | aventure |

### 🗡️ Gagne 4 combats en Aventure

Gagne des combats en Aventure. Demande une créature dans ton deck.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 2 | ~7 | 4 | aucun | aventure |

### 🌟 Décroche toutes les étoiles sur un niveau d'Aventure

Décroche les trois étoiles sur un niveau d'Aventure.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 1 | aucun | aventure |

---

## 🐣 Créatures et runes

### 🐣 Monte une créature au niveau 6

⚠️ Monte une créature +5 niveaux AU-DESSUS de ta meilleure, au moment où le défi commence.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | — | aucun | +5 au-dessus de toi |

### 🔮 Achète une rune

Achète une rune dans la boutique d'Aventure.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 1 | aucun | fixe |

---

## 🏛️ Sanctuaire et Veilleur

### 🏛️ Monte le Sanctuaire au niveau 42

Monte le Sanctuaire. ⚠️ Il PLAFONNE au niveau 50.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 42 | aucun | fixe |

### 🌙 Monte le Veilleur au niveau 40

Monte le Veilleur. ⚠️ Il PLAFONNE au niveau 50.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 40 | aucun | fixe |

---

## 🕯️ Offrande et Ascension

### 🕯️ Fais une Offrande

Fais une Offrande à l'autel.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | 1 | aucun | fixe |

### 🌟 Fais ta 1re Ascension

Atteins le seuil de pièces, puis ascensionne. Ce défi clôt toujours le groupe.

| Par groupe | Sur 26 œufs | Cible de départ | Plafond | Progression |
|---|---|---|---|---|
| 1 | ~3 | — | aucun | +5 au-dessus de toi |

---

## ⚠️ Ce qu'il faut savoir avant de changer un chiffre

### Les deux seuls défis qui s'adaptent au joueur
Tous les autres affichent la **même cible pour tout le monde**. Ces deux-là sont des exceptions voulues :

| Défi | Règle |
|---|---|
| 🐣 Monte une créature | toujours **+5 niveaux** au-dessus de ta meilleure |
| 👆 Atteins N taps | il te reste toujours **200 à 300 taps** à faire |

### Trois barèmes qui bougent ENSEMBLE
Changer l'un sans les autres casse le jeu :

| | |
|---|---|
| **Bonus d'Ascension** | ×2, ×5, ×15, ×53, ×210 |
| **Seuil d'Ascension** | doit monter autant, sinon le groupe se vide |
| **Prix de boutique** | montent avec le bonus, sinon tout devient gratuit |

### Deux générateurs et deux paliers de tap par Ascension

| Ascension | Générateurs | Paliers de tap |
|---|---|---|
| A1 | Esprit · Main Spectrale | Poigne · Gantelet |
| A2 | Automate · Colonie | Sceau · Poing de Granit |
| A3 | Titan · Golem | Éclat · Supernova |
| A4 | Dragon · Phénix | Griffe du Vide · Serment |
| A5 | Léviathan · Gardien | Fracture · Volonté |

⚠️ Le verrou est le **prix**, pas une condition. À son Ascension, deux exemplaires coûtent un défi ; à l'Ascension d'avant, trois à six fois plus.

### Règles de composition d'un œuf
- **7 œufs** par Ascension, **6 défis** chacun — soit **42 défis par groupe**
- Jamais deux défis de la même famille dans le même œuf
- L'**Ascension** est toujours le dernier défi du 7e œuf
- Un défi ne doit **jamais** coûter plus de **60 %** du seuil de son Ascension

### Où s'arrête le jeu
La collection compte **26 créatures**. Le joueur les a toutes pendant sa **5e Ascension**. Au-delà les défis continuent, mais les œufs ne donnent plus rien de neuf — c'est là que doit arriver l'écran de fin.

### Durées mesurées (joueur à la main, 4 taps/s)

| A0 | A1 | A2 | A3 | A4 | A5 |
|---|---|---|---|---|---|
| 1,6 h | 1,9 h | 2,2 h | 2,8 h | 3,4 h | 4,4 h |

---

## 🛠️ Si tu veux changer un objectif

1. Dis-moi la **part du seuil** visée, pas un nombre de pièces
2. Ou donne-moi un exemple concret à une Ascension précise — je cale le barème pour que ça tombe juste, sans toucher aux autres
3. Je mesure **avant** et **après**, et je te montre l'écart

⚠️ Un nombre de pièces ne veut rien dire hors de son Ascension : 10 millions valent 1,7 % du seuil à A5, et 2 300 % à A1.

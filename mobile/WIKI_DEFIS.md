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
| **Jamais deux défis d'ACHAT d'affilée**, y compris d'un œuf au suivant | 20/09 |
| **Aucun défi d'AVENTURE dans l'œuf 1** — le joueur n'a pas de créature | 20/09 |
| Le **premier défi du jeu** est celui des pièces, pas un achat | 20/09 |
| Le **deuxième défi du jeu est le Pacte** — départ du tuto | 20/09 |
| Jamais deux défis de la **même métrique** dans le même œuf | 20/09 |
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
| Hors ligne : **moyenne 3-5 %** du seuil, **pic 7 %** max, pour 2 h | 20/09 |
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

#### Les contrôles de DÉFI

| Contrôle | Si c'est rouge |
|---|---|
| `auditMetriquesIncrementees` | **Danger maximal.** Une métrique que le jeu n'augmente jamais bloque l'œuf pour toujours. Vérifier l'écriture dans l'écran, ou corriger la table des métriques dérivées. |
| `auditInfaisable` | La cible dépasse 60 % du seuil : la baisser. |
| `auditTropFacile` | Cible trop basse ou déjà acquise : la relever, ou changer la famille du défi. |
| `auditAchatsColles` | Deux achats se suivent : intercaler un défi d'une autre famille. |
| `auditDefisEcrits` | Structure du fichier cassée : 6 défis par œuf, identifiants uniques, Ascension en dernier. |
| `auditMetriquesIncrementees` (bis) | ⚠️ Il dit qu'une métrique EXISTE, pas qu'elle mesure ce que son libellé annonce. « Enchaîne N taps » lisait le MULTIPLICATEUR de Transe pendant des semaines : le contrôle était vert, le défi mentait. **Relire le libellé contre la métrique à chaque ajout.** |
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

### 🌙 Le hors ligne : 3 à 5 % du seuil

Le gain vaut ce que produit le passif, **borné entre 3 % et 5 % du seuil
de l'Ascension en cours**, au prorata du temps écoulé (2 h pleines).

| Plancher | Plafond ponctuel | MOYENNE visée |
|---|---|---|
| 3 % | 7 % | **3 à 5 %** |

Mesuré : moyennes de 3,0 à 4,0 % selon le groupe, pics jusqu'à 7 %.
Pour une absence plus courte, au prorata : 1,2 % à 30 min, 2,5 % à 1 h.

⚠️ **C'est la MOYENNE du groupe qui doit tenir dans 3-5 %**, pas chaque
instant. Un pic au moment où le joueur a tout acheté est légitime — c'est
même ce qui récompense son investissement. Avec un plafond à 5 %, tous
les groupes restaient collés au plancher et monter ses générateurs ne
changeait rien au hors ligne.

⚠️ **Un simple TAUX ne peut pas marcher.** À 25 % du passif, l'apport
moyen allait de 0,1 % du seuil à l'Ascension 1 à 4,4 % à l'Ascension 2.
Pour amener tout le monde à 4 %, il aurait fallu un taux de 668 % sur un
groupe et 23 % sur le suivant — le passif moyen est trop irrégulier.

⚠️⚠️ **NE JAMAIS MESURER LE HORS LIGNE SUR LE PASSIF DE FIN DE GROUPE.**
C'est l'auteur qui a relevé l'erreur : « le joueur n'obtient pas le
maximum dès le début, il commence à 0 ». À l'Ascension 1, le hors ligne
couvrait 72 % du seuil pour qui se déconnectait au tout dernier instant,
et **0,1 % en moyenne**. Mesurer la fin surestimait l'apport d'un facteur
plusieurs centaines, et j'ai annoncé ce chiffre faux avant qu'il me
corrige.

`auditHorsLigne` mesure à cinq moments du groupe, pas seulement à la fin.

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

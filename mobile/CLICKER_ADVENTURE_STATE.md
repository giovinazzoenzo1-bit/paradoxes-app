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

### Piège : un bouton autour d'un élément en POSITION ABSOLUE (26/09)
Symptôme : le panneau du défi passait bien au vert, mais l'appui « Valider »
ne faisait RIEN. Cause : le panneau (`challengeCard`) est en position
absolue ; enveloppé tel quel dans un `TouchableOpacity`, le bouton avait une
taille de ZÉRO — le panneau s'affichait hors de sa zone, et un appui hors de
la zone d'un bouton ne lui est jamais transmis (aucune erreur, rien à la
compilation). Règle : c'est le BOUTON qui porte la position et la taille,
l'élément le remplit (`width/height: '100%'`). `auditValidation` le vérifie,
avec un sabotage qui reproduit le bug.

### L'Aventure est calibrée par simulation (24/09)
Décision de l'auteur : niveau N de l'Aventure ≈ créatures niveau N pour
gagner 2 combats sur 3. `AVENTURE_MULTIPLICATEURS` (combatLogic, 40
valeurs) multiplie PV et attaque des adversaires ; elle est CALCULÉE par
`tools/calibrer-aventure.js --ecrire` — ne jamais la retoucher à la main.
Avant : un deck de niveau 2 gagnait au niveau 40. Après : 61-81 % à son
niveau ; ±2 niveaux ≈ ∓20-40 points. Pièges mesurés : pas de lissage entre
niveaux (chaque niveau a ses adversaires), côté facile de la dichotomie,
decks de référence alignés sur la collection d'un nouveau joueur.

### Les sorts (24/09)
Chaque créature a UN sort payé en mana (SORT_DE_CREATURE, SORTS, EFFETS) ;
les ennemis de l'Aventure aussi (`actionAdversaire`), pas le Gardien. Tout
dans combatLogic ; UNE boucle de simulation (`simulerCombat`) reproduit
l'écran ; le Gardien se cale sur le MEILLEUR style (avec / sans sorts).
Ligne d'états à côté des barres de PV (`iconesEtats`).

### Un seul moteur de combat (24/09)
Toute règle du combat vit dans `combatLogic` (coup, riposte adverse et
du Gardien, zone, encaissement, qui riposte, prochaine créature vivante)
et CombatScreen comme les simulateurs l'appellent. Une nouvelle mécanique
(bouclier, poison…) s'y ajoute UNE fois ; l'empreinte des règles restées
dans l'écran (ordre du tour, animations) refuse un push non revérifié.
Bug trouvé en le faisant : la mana adverse n'était jamais gardée.

### Le Gardien se cale sur le deck — par SIMULATION (24/09)
Demande : « parfait à l'œuf 2, trop facile après ; qu'il gagne 1/3 pour
que les joueurs doivent améliorer leurs créatures ». Mesuré avant : il ne
gagnait JAMAIS (œufs 2 à 40). `combatLogic` : photo des 3 meilleures
créatures au début de l'œuf, calibrage au lancement (`calibrerGardien`),
attaques de zone. Mesuré après : 17 à 39 % sur 33 decks.

⚠️ Écarté, mesuré : une FORMULE (25 à 78 % à puissance égale), la
formule de l'auteur (PV + attaque, Gardien copiant le deck : 0 à 47 %,
moyenne 14 %), corriger PV et attaque ensemble (le taux saute d'un tour
entier), le milieu de dichotomie sur des coups de 2-3 PV. On corrige
l'ATTAQUE seule, et on garde le côté facile d'un palier.

⚠️ Photo v2 : le deck JOUÉ, pas les 3 meilleures de la collection (qui
affichaient un Gardien 6-7 points au-dessus du deck, « compliqué à
rattraper à haut niveau »). Marge `margeGardien` : 5 % jusqu'à 100 de
puissance, 2 % dès 700 (vers 500, +12 points ≈ 1,7 montée de niveau au
lieu de +25). Gardien affiché = deck × marge,
calé pour qu'un deck de cette puissance gagne 2 fois sur 3. Passée à
1,05 à la demande de l'auteur (« à 2 points d'écart on gagne encore »).

⚠️⚠️ UNE SEULE SOURCE DE RÈGLES : coup, riposte, zone, encaissement sont
dans `combatLogic` et CombatScreen les appelle. Le reste (premier coup,
rotation, mana) est entre les marqueurs « RÈGLES DU COMBAT » :
`auditGardienEmpreinte` refuse le push s'il change. Ne mettre à jour
`EMPREINTE_COMBAT` qu'APRÈS avoir revérifié `simulerCombatGardien`.

### Une règle anti-triche se branche sur l'ÉTAT, pas sur les boutons (24/09)
Bug signalé par l'auteur : changer de créature dans le deck donnait un
pouvoir immédiat, en boucle. Deux chemins mènent au deck (écran principal
et menu Exploration), plus le remplissage automatique : la règle vit
dans `rechargesApresChangementDeck`, appliquée par un effet sur l'état du
deck — un futur chemin ne peut pas l'oublier. `auditRechargeDeck` vérifie
la règle ET son câblage.

### Le nombre d'œufs par Ascension est LU, jamais `× 7` (24/09)
`OEUFS_PAR_GROUPE = [6, 6, 7, 7, 7, 7]` depuis la suppression de l'œuf 7
de l'A0 et de l'A1. Toute position passe par `debutGroupe`,
`groupeDeOeuf`, `tailleGroupe`, `oeufsDuGroupe` ; `auditStructureOeufs`
crie si la table ne correspond plus au fichier.

⚠️ La sauvegarde garde un index GLOBAL d'œuf : changer la disposition
change l'œuf qu'il désigne (un joueur de l'A2 passait dans l'A3). Elle
enregistre donc sa disposition, et `migrerIndexOeuf` convertit. Toute
future modification du nombre d'œufs passe par là.

⚠️ Bug trouvé en le faisant : `SEQUENCE_LENGTH` valait 7 (œufs d'UNE
Ascension) et servait de « longueur de la séquence ». Dès l'A1, la
taille attendue d'un œuf tombait à 4 au lieu de 8 : chaque réouverture
de l'app refaisait le tirage et recalculait les cibles adaptatives. Une
constante qui change de sens garde son nom — et ment en silence.

⚠️ `git status` se lit EN ENTIER. Une tentative interrompue a laissé
13 fichiers modifiés ; `git status -sb | head -1` n'affiche que la
branche et les cachait.

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

**Plusieurs copies de Claude peuvent écrire en même temps** (« Réessayer »
après une réponse coupée, ou deux conversations) : quatre fois le 24/09.
Première commande de toute réponse qui écrit : `sh mobile/tools/garde.sh
prendre <étiquette>`, `rendre` après le push. Et aucune attente de
publication (`sleep`) dans une réponse : les longues sont celles qui se
coupent.

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

**Poigne Ancienne est l'exception** (24/09, demande de l'auteur : « montable
à l'A0, pas trop cheatée ») : 1er niveau à l'A0 = moitié du Pacte 10→11,
×1,45, mesuré sur une grille. 8 niveaux à l'A0 au lieu de 5, rythme
inchangé. Sa 2e étape de l'A1 passe de 2 à 4 niveaux (coût croissant).

⚠️ **Un réordonnancement peut déplacer des défis d'ÉTAT.** Pour corriger
un seul coût, il avait envoyé « Atteins 21/s » à l'œuf 1 de l'A1, où le
passif repart de zéro. Si un seul défi gêne, ajuster SA cible est plus
sûr que tout réordonner — puis mesurer à tolérance zéro.

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


## 26/09 — Test réel de l'auteur : l'économie des Griffes était mal répartie

**Le test** (énergie au maximum en mode développeur) : une seule créature,
Terracroc, montée de 1 à 59 en 20 minutes grâce à 603 Griffes de quêtes et
succès (4 fois les combats) ; Aventure poussée jusqu'au niveau 26 ; puis
3 défaites sur 4 alors que l'écran affichait « puissance 156, conseillée 142 ».

**Causes réelles (trois erreurs du simulateur, pas du jeu) :**
1. **La « naissance à 80 % » n'a JAMAIS été codée dans le jeu** : le jeu fait
   naître au niveau 1 (`addCreatureToOwned`). Seul le simulateur la supposait
   → la difficulté était calculée pour un jeu plus facile (A4-A5 : moins de
   4 victoires sur 10 dans le vrai jeu). Simulateur aligné : `naissance: 0`.
2. **Le joueur simulé s'interdisait de monter au-dessus du niveau d'Aventure
   + 1** : le jeu n'a aucun plafond et un vrai joueur dépense tout. Le plafond
   cachait jusqu'à 19 000 Griffes non dépensées en A2. Plafond retiré.
3. **Les quêtes étaient modélisées à 315 Griffes par jour, étalées** ; en
   vrai, les hebdomadaires (« 20 étoiles » 245, « 6 niveaux parfaits » 260…)
   tombent toutes au début.

**Correction (décision de l'auteur) :** les récompenses des quêtes du jour
et de la semaine suivent le niveau d'Aventure (`recompenseQuete` dans
combatLogic : ×1 au niveau 25, ×0,24 au niveau 5, ×17 au niveau 100). Une
seule règle pour le versement (DailyContext), l'affichage (Progrès) et le
simulateur. Succès et calendrier inchangés. Contrôle `auditQuetesNiveau`.

**Recalibrage** sur 60 joueurs (le calibrage sur 40 laissait l'A1 à 5,0
victoires sur 10, sous la limite du contrôle) : 0 bloqué, 5,4 à 6,5 victoires
sur 10 dans toutes les Ascensions, cran −60 % du filet rare (≤ 0,13 fois par
joueur). Les créatures passent au-dessus du niveau d'Aventure en A2 (environ
+27), puis en dessous dès l'A3 (les meilleures naissent au niveau 1).

**Mesure sur la « puissance »** (reste à corriger) : à puissance égale
(≈ 150), 3 créatures gagnent à 100 % au niveau 26, une créature seule à 55 %.
La formule ne voit pas le nombre de créatures. L'auteur veut GARDER la
puissance (plus parlante qu'un pourcentage) mais la rendre juste.

**Piège à retenir :** un simulateur qui suppose une règle du jeu doit la
LIRE dans le jeu, jamais la recopier. Vérifier dans le code du jeu que
chaque hypothèse du simulateur existe vraiment.


## 26/09 — 2e test réel (nouvelle partie, Caraploof) : le début était injouable

**Le test :** Caraploof (commune, tank) niveau 1 perd le niveau 1 ; montée
au niveau 14, elle bloque au niveau 3. « À puissance égale je perds à tous
les coups » ; « le bouclier ne marche pas, aucune icône ».

**Causes réelles :**
1. **Bouclier** = 45 % des PV DÉJÀ perdus : lancé PV pleins, il valait 0 —
   mana perdue, aucune icône. Le joueur simulé ne le lançait que blessé, d'où
   l'écart. Correction : minimum 20 % des PV max (`EFFETS.bouclierMinimum`).
   Le Soin a la même logique (30 % des PV perdus) mais un soin à PV pleins
   est normalement inutile.
2. **Le joueur de référence du calibrage était trop fort au début** : il
   dépense tout avant chaque combat (≈ niveau 15 au niveau 3) et le 30e rang
   laissait tomber les malchanceux du 1er œuf. Or les 1res créatures sont très
   inégales : au niveau 1, Ventis gagnait 2 %, Terracroc 100 %.
3. **Mesure clé** : le niveau 3 (Voltix, 51 PV) était plus dur que le niveau 5
   pour Caraploof niveau 14 (31 PV) : ce n'était pas le multiplicateur mais
   la composition des ennemis face à une créature faible.

**Correction (décision de l'auteur) :**
- **Option A** : le calibrage vise les 10 % les PLUS malchanceux à 6/10
  (`CENTILE = 0.10`) → moyenne ≈ 8,2 à 8,9 victoires sur 10, malchanceux
  3,3 à 6,6, 0 bloqué, filet presque jamais au-delà de −20 %.
- **Chapitre 1 = apprentissage** (`plafondsApprentissage` dans
  calibrer-parcours.js) : niveaux 1 à 10 plafonnés pour que CHAQUE 1re
  créature possible (raretés du 1er œuf lues dans le jeu : commune à rare)
  gagne avec les Griffes d'un débutant (1res victoires seulement) : 9/10 au
  niveau 1 avec une créature niveau 1, 8/10 ensuite. Contrôle
  `auditApprentissage` + sabotage.
- **Mur voulu au niveau 11** (2 ennemis dont une épique) : une créature
  seule y perd (MESURÉ 0 %) ; le calibrage suppose les œufs 2 et 3 éclos.
  L'écran de défaite le DIT : « 🥚 1 créature contre 2 adversaires : fais
  éclore ton prochain œuf » (prop `nbCreatures`).

**Piège à retenir :** calibrer sur un joueur qui joue parfaitement
(dépense tout, sorts au bon moment) rend le jeu trop dur pour un humain qui
découvre. Toujours vérifier le DÉBUTANT : créature neuve, pas encore
améliorée, première créature la plus faible.


## 26/09 — 3e test réel : bloqué au chapitre 2 niveau 3 avec 2 créatures

**Le test :** Bouldog niveau 14 bloque au niveau 11 (voulu : 2 ennemis) ;
monté au niveau 34 (422 Griffes), toujours bloqué → 2e œuf → passe 11, puis
12 après amélioration, mais bloque au niveau 13 malgré « puissance 57,
conseillée 55 ». Remarque de l'auteur : si c'est si serré, pas de Griffes
pour les runes (sans compter les packs contre pièces).

**Cause réelle :** le joueur de référence était trop riche et trop avancé :
- il faisait éclore chaque œuf dès son défi d'Aventure atteint (3 créatures
  dès le niveau 9) — or les autres défis de l'œuf (clicker) prennent du
  temps : l'auteur n'en avait que 2 au niveau 13 ;
- il comptait 3 packs contre pièces dès le niveau 1 (300 Griffes en A0).

**Correction :** joueur de référence réaliste (simulateur) — `retardOeufs: 1`
(un œuf de retard, tous rattrapés en fin d'Ascension), `packsParAsc: 0` (les
packs deviennent un bonus), 3 runes achetées par Ascension. Recalibrage :
8,1 à 8,9 victoires sur 10, malchanceux 3,5 à 6,4, 0 bloqué ; l'équipe de
l'auteur passe les niveaux 11 à 15 à 99-100 % (niveau 13 : 0 % avant).

**Constat qui reste :** les combats ont très peu de hasard — pour une
équipe donnée, un niveau se gagne presque toujours ou se perd presque
toujours. Une équipe faible (Bouldog 20 + Ventis 10) tombe encore sur des
murs (niveaux 13, 15 : 0 %) que seul le filet (après 5 défaites) fait passer.

**Filet rapide (26/09, décision de l'auteur) :** aide après 3, 5 et 7 défaites de suite (−20, −40, −60 %), au lieu de 5, 7 et 10. La difficulté normale ne change pas (le calibrage mesure sans filet) ; l'anti-triche (90 % de la meilleure équipe) reste. Contrôle `auditFilet`.


## 26/09 — Verrou de fin d'Ascension + bouton d'Ascension (décisions de l'auteur)

**Constat (4e test) :** avec 2 créatures, l'auteur passait le niveau 25 puis se
faisait écraser au 26 (conseillée 87 → 103, Arcanis mythique). Cause : le
niveau 25 est la FIN de l'Ascension 0 ; dès le 26, l'Aventure est calibrée
pour des joueurs qui ont fait leur Ascension (6 œufs). Rien ne l'arrêtait ni
ne l'expliquait.

**1. Verrou d'Aventure.** `niveauMaxAventure(ascensionCount)` (questLogic),
LU dans les défis par la même règle que le simulateur : 25, 60, 101, 144,
185, 227, puis aucun verrou. Posé aux 3 entrées de ChapterMapScreen (carte :
nœud 🌟 + message ; « Niveau suivant » ; lancement du combat, AVANT de
consommer l'énergie). Calculé sur le compteur d'Ascensions RÉEL (prop
`ascensionCount` = lifetimeStats.ascension) : il monte dès l'Ascension faite.

**Pièges évités (exigence : aucun joueur bloqué) :**
- défis « Atteins le niveau N » : tous ≤ la fin de leur Ascension (contrôlé) ;
- « Gagne N combats » : chaque victoire compte, rejouer inclus → faisable ;
- « 3 étoiles sur un niveau » ne compte que les NOUVEAUX niveaux à 3 étoiles :
  si tout est déjà étoilé jusqu'au verrou, il devenait IMPOSSIBLE (œuf et
  Ascension bloqués). Garde-fou : l'Aventure publie `troisEtoilesJusquA`
  (préfixe de niveaux à 3 étoiles, trackMax, aussi au chargement) ; si ce
  préfixe atteint le verrou, le défi se valide (`plusRienAEtoiler`). Mesure
  ajoutée aux DEUX photos de statistiques des défis.

**2. Bouton d'Ascension.** Achetable seulement si le défi « Fais ta Ne
Ascension » est le défi EN COURS et pas encore réussi (`defiAscensionEnCours`),
en plus du seuil de pièces. Cause réelle : une Ascension faite plus tôt saute
au 1er œuf du groupe suivant — les œufs restants étaient PERDUS ; faite sur un
défi déjà réussi (partie décalée), elle sauterait un groupe entier. Grisé,
le bouton explique : « Débloquée par le défi « Fais ta Ne Ascension » ».

Contrôles `auditVerrouAventure` et `auditBoutonAscension` + 4 sabotages.


## 26/09 — Puissance EXACTE (« pixel perfect », demande de l'auteur)

**Constat :** la formule √(PV × dégâts) ne voyait ni le nombre de créatures,
ni les sorts, ni les éléments, ni les runes (« 156 contre 142 » en vert pour
3 défaites sur 4 ; « 57 contre 58 » pour 0 % de victoires au niveau 19).

**Correction :** « ta puissance » se MESURE en rejouant le vrai combat
(`puissanceAventure`, `puissanceFaceAuGardien`, combatLogic) : référence ×
le plus grand facteur d'ennemis que TON équipe bat encore à la cible (6/10
en Aventure, 2/3 face au Gardien). Donc « ta puissance ≥ conseillée » ⇔ « tu
gagnes au moins la cible », exact par construction. Verdict et couleur sur
100 combats au niveau réel (30 laissaient un raté au ras du seuil), arrondi
qui ne trahit jamais le seuil (`chiffreExact`), hasard à graine (même équipe
→ même chiffre), en différé (« … » le temps du calcul, ≈ 50 ms dans node).
Stats des créatures et tables d'ennemis INCHANGÉES. **Élixir EXCLU**
(décision de l'auteur) ; le filet de sécurité reste compté (il change
vraiment le combat). 3 affichages : aperçu d'un niveau, pastille du menu
Aventure, « Ton deck » face au Gardien. Contrôle `auditPuissanceExacte`
(recomptage indépendant de 200 combats) + 2 sabotages.

## 26/09 — Incident : deux copies de Claude sur le même dépôt

Le message de l'auteur a été relancé (« Réessayer » sur mobile après des
réponses trop longues) : une copie coupée avait laissé la puissance exacte à
moitié écrite (non poussée), et les deux copies avaient pris la MÊME
étiquette de verrou (« R-puissance ») → le garde ne voyait rien. Reprise
selon la règle (verrou > 10 min, travail relu en entier) ; l'Élixir, compté
par la copie coupée, retiré. **garde.sh corrigé : le SCRIPT ajoute un
suffixe aléatoire** (« R-puissance#a3f9 ») — une copie « au hasard » choisit
le même. Réutiliser EXACTEMENT l'étiquette affichée. Testé sur un clone :
une 2e copie avec la même étiquette est arrêtée. Et : découper les gros
chantiers en réponses courtes.


## 26/09 — Écran de défaite sur la MÊME mesure exacte

« Il te manquait X niveaux » et « retente ta chance » venaient encore de
l'ANCIENNE formule : ils pouvaient contredire la puissance exacte affichée
juste avant le combat. Désormais (`niveauxManquantsExact`, combatLogic) : la
chance au niveau réel se mesure EXACTEMENT comme l'aperçu
(`victoiresAuNiveau` : même graine, 100 combats, meilleur des deux styles,
filet du combat compté, Élixir EXCLU). 0 niveau ⇔ ta puissance ≥ conseillée
(« pas de chance cette fois, retente ! » dit vrai) ; sinon X = le PLUS PETIT
nombre de niveaux (évolutions comprises, `monterEquipe`) qui fait passer à
6/10. Calcul en différé à la défaite (« Analyse de ton combat… », ≈ 0,3 s
dans node au niveau 19). Contrôle `auditDefaite` : cohérence avec l'aperçu,
X suffit et X − 1 non ; 2 sabotages. `auditPuissanceExacte` couvre désormais
les 227 niveaux et toutes les raretés.


## 26/09 — Écran de défaite : tout visible sans défiler (demande de l'auteur)

MESURÉ : en paysage (≈ 390 points de haut), la défaite avec aides demandait
≈ 520 points — diagnostic sur 4-5 lignes dans une colonne de 168 points et
5 boutons empilés. Nouvelle mise en page (`compact` = défaite avec aides) :
bandeau réduit (largeur max 400), diagnostic SOUS le récapitulatif (colonne
large, 1 ligne par phrase), aides en grille 2 × 2 (titre + prix sur 2
lignes, « Monter mes créatures » en vert car gratuit), « Retour à la carte »
en dessous → ≈ 290 points. Victoire et défaite sans aides (Gardien)
inchangées. Le ScrollView reste en filet pour les très petits écrans.


## 27/09 — Menu principal redessiné (images Gemini de l'auteur)

Cible : une maquette Gemini du menu (mêmes textes que le jeu, habillés
d'images). 19 images générées sur fond magenta, déposées dans
`design/a-integrer/01-menu-principal` (ordre = heure d'enregistrement,
vérifiée par le format et le contenu), détourées (`design/outils/detourer.py`)
puis réduites à leur taille d'affichage dans `mobile/assets/menu/` (2,5 Mo
contre 12 Mo bruts).

Remplacements dans ClickerScreen : fond ; ⚙️ → roue dentée en bois ; « 💎 N »
→ cadre + cristal ; pilule de pièces → planche + sac ; caisse, 📜 → parchemin,
🥚 → petit nid ; nouveau cadre du deck (centres des 3 cases MESURÉS sur
l'image : 22,2 / 49,4 / 76,4 %, à 55,5 %) ; grand nid DERRIÈRE l'œuf ;
panneau de défi reconstruit (cadre vide + médaillon étoile + 6 segments
vides OU pleins, posés dans la rainure mesurée à 42-70 % de la hauteur) ;
barre de navigation en bois + cadre de pierre + icône séparée.
La lueur rouge de la caisse était PEINTE dans l'ancienne image : elle est
faite par le code (glow-gold teinté), seulement quand la récompense du jour
est à prendre. Anciennes images (icons/…) laissées en place, plus utilisées
par le menu.

**Banc de capture** : il applique maintenant la même transformation que
Metro (const/let → var) — sinon une lecture anticipée inoffensive sur le
téléphone (« Cannot access 'view' before initialization ») bloquait le rendu
web du menu. Scène `scenes/menu.jsx` (les 3 fournisseurs d'App.js), format
portrait 390 × 844.


## 27/09 — Retours de l'auteur sur le menu + 3 créatures

- **Nid sous l'œuf (cause réelle)** : image en position absolue avec seulement
  largeur + `aspectRatio` → sur le téléphone, le nid tombait ≈ 130 points
  trop bas (hauteur d'origine de l'image retenue), alors que le navigateur du
  banc appliquait la proportion. **Piège à retenir : jamais d'`aspectRatio`
  seul sur une `Image` en absolu — hauteur explicite.** Nid aligné aussi sur le
  décalage horizontal de l'œuf (tapTouch : translateX 13).
- Caisse (48) et parchemin (42) réduits ; zone tactile inchangée (62).
- Compte à rebours du pouvoir AU-DESSUS de l'œuf retiré (doublon : il reste
  sur la case du deck).
- **Glyphon, Ombrillon, Maléfix** (dessins du frère de l'auteur) ajoutés à
  `CREATURE_ART`. Leurs dessins n'occupaient que 23 à 65 % de l'image (norme
  en jeu MESURÉE : 57 / 72 / 84 % selon le stade) → recadrés et remis à la
  norme depuis les originaux 1024 px, progression bébé → adulte gardée.
  Scène de banc `scenes/creatures.jsx` (rendu par le vrai CreatureArt).

- **Œuf +30 % (27/09, demande de l'auteur)** : `EGG_SIZE` / `EGG_BUTTON`
  (325 / 350 sur les écrans ≥ 844) calculés depuis la zone pour garder la
  RÈGLE ABSOLUE « zone > bouton > image » sur tout écran (vérifié : 667 → œuf
  250, 780 → 298). Nid, particules et bouton suivent la même taille.
- **Nid DANS le conteneur de l'œuf** (tapTouch) : calculé à part, il se
  retrouvait 2-3 mm à droite sur téléphone (l'œuf y est au centre exact de
  l'écran, sans les 13 points de décalage du code). Dans le même conteneur,
  il partage centrage et décalage sur tout appareil.


## 27/09 — BUG DE TAP (3e apparition) : cause réelle et règle

**Symptômes (auteur, téléphone)** : 2 ou 3 taps perdus sur 4-5, selon
l'endroit, aussi à l'autoclicker ; loin de l'œuf, presque plus rien.
**Cause réelle** : chaque « +X » apparaît AU POINT TOUCHÉ (locationX/Y de
l'élément touché) et reste 0,7 s, posé PAR-DESSUS la zone de l'œuf SANS être
transparent au toucher → les taps suivants au même endroit tombaient sur le
texte, jamais sur l'œuf. Le grand nid et l'œuf agrandis ont multiplié les
cas où le « +X » atterrit sous le doigt.
**Preuve** : banc tactile (`tools/capture/taps.mjs`, 20 taps à 150 ms en 5
endroits) avec `EMULE_TOUCHER=1` (le navigateur ne fournit pas locationX :
le banc l'imite comme le téléphone, sans toucher au code de l'appli) :
10 à 12 / 20 avant, 20 / 20 après. `tools/capture/sonde.mjs` montre
l'élément sous le tap suivant.
**Correction** : les « +X » dans un calque transparent au toucher **PAR LE
STYLE** (`style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}`), et
chaque « +X » aussi.
**⚠️ Incident de reprise (27/09)** : une 1re version (copie coupée, non
envoyée) écrivait `pointerEvents="none"` en PROPRIÉTÉ. Le navigateur du banc
l'appliquait (20/20), mais le TÉLÉPHONE l'ignore depuis le SDK 57 (commit
5defa31) : ce calque couvrant toute la zone aurait bloqué TOUS les taps —
MESURÉ une fois le banc rendu fidèle : 0 à 1 tap compté sur 20. Le banc
retire désormais la propriété `pointerEvents` avant rendu (comme l'appareil).
Après correction : **20 / 20 aux 5 endroits** (centre, bas de l'œuf, nid,
gauche, droite de la zone).
**RÈGLES** : (1) tout ce qui est posé sur la zone de l'œuf sans être un bouton
est transparent au toucher ; (2) `pointerEvents` TOUJOURS dans le style,
jamais en propriété — 10 propriétés traînaient, toutes converties. Contrôles
`auditZoneTapLibre` et `auditPointerEventsStyle` + sabotages.
Hors de la zone de l'œuf (trop haut, trop bas), un tap ne compte pas : c'est
voulu (la zone s'arrête avant le texte d'aide et la barre du bas).
(1re apparition, 07/09 : texte d'aide et barre du bas par-dessus la zone.)

## 27/09 — Deck agrandi

Cadre 55 → 62 % de l'écran (centré, à 6 points de la caisse), cases et
créatures 26 → 46 points (avant : 15-22 points visibles). Scène de banc
`scenes/deck.jsx` (vrai DeckRow exposé à la volée par le banc).


## 27/09 — Bouton « Valider » du défi réussi (images Gemini de l'auteur)

Prompts 20 (bouton en bois doré, émail émeraude) et 21 (médaillon coche en
lianes). Déposées dans `01-menu-principal/` (rangées dans `valider/`),
détourées, réduites (`assets/menu/bouton-valider.png`, `medaillon-coche.png`).
État RÉUSSI : médaillon coche à la place de l'étoile ; le bouton illustré
« Valider » (pulsation douce, pilote natif) remplace le texte du bas ; le
voile vert devient un liseré doré discret. La structure protégée du
26/09 (le TouchableOpacity porte la position, le panneau le remplit) est
INCHANGÉE : tout le panneau reste le bouton. Scène de banc `scenes/defi.jsx`.


## 27/09 — Effets de tap stylés + icônes des bulles (étape 1 de 2)

- **Effet de tap** (`TapEffect`) : flash d'impact, onde de choc, 6 étincelles,
  « +X » qui rebondit et monte — orange et plus grand sur un critique, et
  l'œuf tremble. Tout sur le PILOTE NATIF, greffé sur le « +X » existant
  (aucun état de plus par tap). Onde et étincelles réservées aux vrais taps
  (5e paramètre `tap` de spawnPopup) : les messages « Pouvoir déjà actif »,
  gains… gardent le texte seul. Calque et effet transparents au toucher PAR
  LE STYLE. Sonde de taps : **20 / 20 aux 5 endroits** avec les effets.
- **⚠️ Piège évité : ne JAMAIS appeler `handleEggTap` pour un effet visuel.**
  Elle secoue l'œuf MAIS, pendant l'éclosion, retire 1 s au minuteur : un
  critique aurait retiré 2 s. Le critique fait la secousse seule, écrite en
  place.
- **Bulles** : pierre runique (Rituel, ex-bougie 🕯️) et gland doré (bonus doré,
  ex-✨), images Gemini de l'auteur (prompts 22-23). Popup du Rituel : 🌿.
- Scène de banc `scenes/tap.jsx` (effets relancés en boucle, figés à mi-course).

**Étape 2 (faite, 27/09)** : mise en scène des pouvoirs.
- Activation (`PowerCastEffect`, 1,3 s) : flash de la couleur de l'élément
  (`COULEUR_ELEMENT`, 8 éléments), la créature surgit en grand (180) avec
  « ⚡ nom du pouvoir ! ».
- Pendant le pouvoir : aura douce de l'élément derrière l'œuf (`PowerAura`,
  glow teinté qui pulse) ; la créature se poste CONTRE le dessin de l'œuf
  (`PowerAttacker`, ≈ 30 % de sa largeur depuis le centre — pas le bord de
  l'image, qui a une marge transparente) et BONDIT sur lui à chaque tap
  (`attaqueAnim`, relancée par handleTap : pilote natif, aucun état par tap) ;
  l'impact du tap prend la couleur de l'élément (6e paramètre de spawnPopup).
- Tout est transparent au toucher par le style ; sonde de taps 20 / 20.
- Scène de banc `scenes/pouvoir.jsx` (format téléphone 390 × 844 : l'œuf se
  cale sur la hauteur d'écran, une petite fenêtre fausse les proportions).

- **Bulles SANS rond (27/09, demande de l'auteur)** : créature du pouvoir,
  gland doré, pierre runique, diamant d'Offrande — ni fond, ni bordure, ni
  halo ; créature 64 points, icônes 50. Scène de banc `scenes/bulles.jsx`.
- **Fenêtre « 🎉 Défi réussi ! » retirée** (demande de l'auteur) : purement
  décorative (ouverte à la validation, fermée d'un toucher, aucun autre
  effet) ; le panneau (bouton Valider, médaillon coche) suffit.
- **Ménage** : 41 images brutes déjà intégrées et validées retirées de
  `design/a-integrer` (récupérables dans l'historique Git).

**Retours de l'auteur sur les pouvoirs (27/09)** :
- Le flash rectangulaire (limité à la zone de l'œuf) laissait voir ses bords
  → `PowerFlash` sur TOUT l'écran (bords = ceux du téléphone), sous l'œuf et
  les panneaux ; autour de la créature qui surgit, halo en dégradé de 14
  disques presque transparents (6 laissaient voir des anneaux).
- La créature n'attaque plus que de la gauche : elle APPARAÎT AU TAP, à un
  endroit différent autour de l'œuf (côtés, dessus, diagonales, jamais
  par-dessous), fonce, recule, s'efface — UNE seule, qui se replace à chaque
  tap (`lancerAttaque`) ; RETOURNÉE du côté droit pour regarder l'œuf.
  ⚠️ Arrêter les animations du tap précédent avant de repartir : à 150 ms,
  l'ancien fondu effaçait la nouvelle apparition.


## 27/09 — Fenêtres du thème forêt (victoires, choix d'éclosion)

Images Gemini de l'auteur (prompts 26-30 : panneau, bannière, couronne de
laurier, cristal, sablier) dans `assets/fenetres/`. Composant PARTAGÉ
`screens/games/fenetreBois.js` : `FenetreBois` (panneau + bannière à cheval
sur le bord du haut, titre) et `BoutonBois` (bois doré, émail vert / rouge /
bleu — rouge et bleu recolorés par le code sur l'émail seulement ; le bouton
PORTE sa taille, l'image le remplit). Utilisé pour : mini boss vaincu / enfui,
Gardien vaincu / victorieux, boutons « Affronter le gardien » (rouge),
« Mettre en incubation » (bleu, sablier), « Faire éclore » (vert), attente du
nouvel essai (rouge désactivé). Scène de banc `scenes/fenetres.jsx`.
Reste : le menu de l'incubateur (IncubatorPanel) dans le même style.
Aussi corrigé : défi terminé = 6 segments dorés (le remplissage se calculait
sur la cible) ; case des pièces 140.

**Retours de l'auteur sur les fenêtres (27/09)** :
- **Boutons trop étroits, texte qui déborde, décor visible derrière** — cause
  réelle : `paddingHorizontal: '17%'` sur l'ImageBackground du bouton. Sur
  TÉLÉPHONE, l'image intérieure (absolue, largeur « 100 % ») se calcule sur la
  largeur MOINS ces marges → ≈ 66 % du bouton, calée à gauche ; le navigateur
  du banc, lui, l'étirait sur toute la largeur. **Piège à retenir : jamais de
  marge en % sur un ImageBackground ; image de fond à taille EXPLICITE en
  nombres, texte dans sa propre boîte.** `BoutonBois` réécrit ainsi.
- **Fenêtre « Nouvelle créature ! »** (révélation après éclosion) : la
  créature en grand au centre (170), nom, rareté, bouton « Super ! ».
- **Menu de l'incubateur** (IncubatorPanel) dans le style forêt : bannière,
  croix de fermeture (`onFermer`), sablier à côté du temps restant, boutons
  dorés (vidéo en saphir, éclosion en émeraude ou rubis) ; logique inchangée.
- **Piège (2 fois)** : insérer un import APRÈS un import d'une seule ligne —
  pas après la 1re ligne d'un import sur plusieurs lignes (le compilateur
  l'attrape, mais ça coûte un aller-retour).
Scène de banc `scenes/fenetres2.jsx` (créature, incubateur en cours, prêt).

**2e retour de l'auteur sur les fenêtres (27/09)** :
- **Fenêtres superposées** (« Gardien vaincu ! » par-dessus « Nouvelle
  créature ! ») → UNE à la fois : la créature attend la fermeture du Gardien,
  le mini boss attend les deux.
- **Pastille ronde « 12 % » dans l'incubateur** — cause réelle : barre à
  `width: '100%'` d'un bloc SANS largeur fixe (centré par le panneau) ; sur
  téléphone, le calcul tourne en rond et la barre se réduit à son texte (le
  navigateur, lui, la dessinait). → pourcentage + petite barre de largeur en
  NOMBRES (`MINI_BARRE_L`).
- **Vert sur les côtés du bouton rouge** — cause réelle : la recoloration ne
  prenait que le RECTANGLE central de l'émail ; ses bouts arrondis restaient
  verts. → recoloration de l'émail d'UN SEUL TENANT (plus grande zone verte
  connexe, trous bouchés) ; les feuilles, morceaux séparés, restent vertes.
- **Titre « Incubateur » trop bas** → zone du titre en NOMBRES et
  `includeFontPadding: false` (marge de police d'Android).
- ⚠️ **RÈGLE (3 bugs du même genre ce jour)** : dans ces fenêtres, tailles et
  positions en NOMBRES — pas de % sur un ImageBackground, ni de `width: '100%'`
  dans un bloc sans largeur fixe. Le banc (navigateur) ne reproduit PAS ces
  écarts : seul le téléphone les montre.

**3e retour (27/09)** : titres des bannières remontés d'≈ 14 points (zone
`hBanniere × 0.24`, hauteur `× 0.42`) ; **taille du texte des boutons
CALCULÉE** (`BoutonBois` : largeur de l'émail ≈ 66 % ÷ longueur visible du
texte, émojis comptés ×1,4 ; 10 à 15 pour le texte, sous-texte sur 2 lignes
s'il tomberait sous 9) — `adjustsFontSizeToFit` ne réduit rien sur le
téléphone Android de l'auteur. « Nouvel essai » raccourci, bouton
d'incubation élargi (74 % de l'écran).

**4e retour (27/09) — finitions** :
- Texte des boutons centré sur l'ÉMAIL et non sur l'image (émail mesuré :
  30 à 80 % de la hauteur, centre à 55 % → `paddingTop: h × 0,1`) ; c'est
  pour ça que les 3 lignes d'« Affronter le gardien » débordaient en haut.
  Bouton plus haut : 80 (écran principal), 70 (incubateur).
- Bouton bleu : « Mettre en incubation » seul (plus de temps ni d'icône).
- Minuteur sous l'œuf aligné sur l'œuf : `DECALAGE_OEUF_X` (13, ≈ 2 mm,
  réglage du 06/09) PARTAGÉ par tapTouch et eggTimer — le minuteur restait
  centré sur l'écran.
- Incubateur : ligne « taps · durée initiale » retirée.


## 27/09 — Menus secondaires : Paramètres (1er sur 4)

Méthode (voir design/a-integrer/PLAN.md) : maquette Gemini de l'écran entier
(IMAGE 1 = nouveau menu principal, IMAGE 2 = l'ancien menu), puis pièces
découpées case par case. Les 4 maquettes sont reçues (Paramètres, Boutique,
Quêtes, Calendrier).

**Kit partagé des grands menus** (`fenetreBois.js`, images `assets/fenetres/`) :
`BanniereTitre` (la bannière seule, aussi utilisée par FenetreBois),
`GrandPanneau` (panneau vertical + bannière + croix ronde en bois ;
`largeurInterieure(l)` pour le contenu), `LigneReglage` (planche moussue +
`Interrupteur` : rail en bois, bouton rond émeraude / gris), `BoutonLarge`
(cadre doré, émail vert / rouge ; émail mesuré centré à 49 %). Bouton gris =
pierre désaturée seule ; bouton large rouge = émail recoloré d'un seul tenant.
Paramètres (OptionsScreen) branché dessus, logique inchangée. Scène de banc
`scenes/parametres.jsx`.

⚠️ **Piège évité** : un remplacement (ligne présente 2 fois : la zone qui
défile existe aussi dans le panneau développeur) a arrêté le script APRÈS
une écriture partielle — l'écran appelait des composants non importés.
**Le compilateur ne le voit pas** (un nom inconnu compile). Repartir de la
sauvegarde et tout refaire d'un bloc, puis vérifier que chaque nom utilisé
est déclaré.

**Boutique (2e sur 4, 27/09)** : DiamondShop sur le kit (GrandPanneau,
planche, cristal) + pièces 37-44 : plaque du solde, bouton de prix (bleu vif
si achetable, estompé sinon — le doré de la maquette n'avait pas de règle),
ruban d'angle « Meilleure offre » (champ `badge` des offres, posé sur
l'énergie comme la maquette validée), icônes d'offre dans `assets/boutique/`.
⚠️ **Icône des Griffes manquante** (image 39 non reçue ; les suivantes étaient
décalées d'un numéro — rangées par CONTENU) : tuile provisoire dessinée par le
code avec 🐾, à remplacer (clé `griffes` de ICONES). Scène `scenes/boutique.jsx`.

**Quêtes (3e sur 4, 27/09)** : ProgresScreen sur le kit + pièces 45-51 dans
`assets/fenetres/` (onglets actif / inactif, planche dorée, rail et
remplissage de barre, plaque de récompense, pattes). Onglets déplacés EN HAUT
(maquette validée) ; « Quotidiennement » → « Quotidien » (tenait en 8 pts).
Ligne de quête : planche normale + barre + plaque « +N » (pattes) ; à
récupérer → planche DORÉE + BoutonLarge « Récupérer » (`sansMarge`) ;
récupérée → estompée « ✓ ». Les quêtes récompensent TOUJOURS en Griffes.
Scène `scenes/quetes.jsx` (vraies quêtes du jour, à zéro au banc).

**Calendrier (4e sur 4, 27/09) — les menus du menu principal sont TOUS
refaits.** DailyCalendarModal sur FenetreBois + pièces 52-55
(`assets/calendrier/` : petite case, case large, icône œuf, icône palette) ;
même grille 3 + 2 + 2 ; icône selon le TYPE de récompense (`CAL_ICONES` :
griffes → pattes, appCoins → cristal, creature → œuf, skin → palette) ; jour
pris = VOILE sombre + médaillon coché par-dessus (une transparence de toute la
case éteignait aussi le médaillon) ; jour du jour = liseré doré ; barre dorée ;
BoutonLarge « RÉCUPÉRER LE JOUR N ». Kit : `largeurInterieureFenetre(l)`.
Scène `scenes/calendrier.jsx` (?scene=calendrier / calendrier-pris).
- FenetreBois : croix ronde EN BOIS (image FERMER), dessinée APRÈS la
  bannière (sinon la queue du ruban passait par-dessus).
- ⚠️ Piège évité : un commentaire `//` posé dans du JSX s'afficherait comme du
  TEXTE à l'écran — toujours `{/* … */}` dans le JSX.


## 27/09 — Effets de validation + lueur du pouvoir prêt

- **Validation** (Boutique : achat ; Quêtes : récupérer ; Calendrier : jour) :
  `vibrerSucces(vibrations)` (Vibration de React Native, comme le coup
  critique, seulement si le réglage Vibrations est activé) + `EffetRecompense`
  (éclat doré au centre, gain qui monte). **Plus de fenêtres blanches de
  réussite** (« Acheté ! », « Récompense ! », « Créature Rare ! », « Bon pour
  un skin ») ; la fenêtre d'ERREUR « Aucun œuf en incubation » reste.
  Calendrier : hook d'état déclaré AVANT l'arrêt anticipé (ordre des hooks).
- **Lueur du pouvoir prêt** (`LueurPouvoir`) : halo rond cyan des champignons
  (`#62faeb`, mesuré sur le fond) qui respire + 4 étoiles « + » qui
  s'allument à tour de rôle. Dans la case du deck (pouvoir prêt) et derrière
  la créature qui se balade autour de l'œuf.
  Mesuré au banc (sonde d'opacité) : 1re version trop discrète (pointe à
  0,45) → palier allumé, étoiles plus grandes, halo cyan ; en « + » (tournées
  de 45°, elles ressemblaient à une croix de fermeture). Le caractère « ✦ »
  était soupçonné à tort : l'animation tournait, c'était le contraste.
- ⚠️ Piège : `cut -c` sur une sortie accentuée peut couper un caractère en deux
  (sortie illisible) — lire avec Python.

**Combats (27/09)** : les ADVERSAIRES regardent vers la gauche — marqueur
explicite `adversaire: true` à l'appel de renderSprite (CombatScreen), miroir
`MIROIR` (scaleX −1) sur l'IMAGE seule via la prop `style` de CreatureArt
(et sur l'émoji des créatures pas encore dessinées), à l'intérieur de
l'animation du bond (mouvement inchangé) ; ni le nom ni les PV ne sont
retournés. L'aperçu avant combat (adversaire seul, centré) n'est pas retourné.
Scène `scenes/miroir.jsx`.

**Lueur du pouvoir prêt — 2e version (retour de l'auteur, 27/09)** : « on voit
des ronds de plus en plus grands » (disques empilés = marches visibles) et
« le truc qui tourne » (étoiles allumées à tour de rôle) déplaisaient.
→ **Vraies images de dégradé radial** générées par script
(`assets/fenetres/lueur-cyan.png` et `lueur-cyan-coeur.png` : gaussienne
nulle au bord, 256 niveaux de transparence + grain anti-escalier, couleur
des champignons INCLUSE — pas de tintColor, peu fiable) ; plus rien ne
tourne : le halo respire (1,8 s) et le cœur clair vacille sur un rythme
irrégulier. Deck 78 points (déborde sur l'anneau de pierre), bulle 98.
**RÈGLE : pour un dégradé, une image générée — jamais des disques empilés.**
Reste en disques empilés : le halo de la créature qui surgit à l'activation
(`HALO_DISQUES`, couleur selon l'élément) — même remède possible (une image
par élément) si l'auteur le demande.


## 27/09 — Boutique en ARBRE de compétences « dans l'espace » (étape 1 sur 3)

`screens/games/ArbreBoutique.js` remplace l'affichage de la boutique
(`BoutiqueArbre Secours={ShopView}` : **si l'arbre plante, l'ancienne liste
s'affiche** — filet d'erreur React).
- **Disposition** : Ascension au centre (anneau de progression vers le seuil),
  Griffes à gauche, Offrande à droite, Reliques dessous (ouvre le panneau des
  20 objets de créatures) ; en haut Pacte → Faveur / Dégâts critiques → 10
  améliorations sur 2 branches (plus loin = plus cher ; 1er verrou de chaque
  branche en « ??? », les suivants cachés) ; en bas Sanctuaire / Veilleur puis
  15 auto-clics sur 3 racines, révélés 2 par 2.
- **Économie INCHANGÉE** : mêmes fonctions de prix / verrou / achat que
  ShopView (importées de clickerLogic ; achats = les MÊMES props). L'achat
  relit le nœud FRAIS (pas de fermeture périmée).
- **Moteur maison** (⚠️ PAS de react-native-gesture-handler : cause de l'écran
  blanc, voir index.js) : PanResponder + Animated ; glisser, pincer (zoom
  autour des doigts, coordonnées pageX − position de la carte), élan borné
  sur le pilote natif, boutons + / − / recentrer ; ZÉRO rendu React pendant
  un geste ; nœuds et branches mémorisés (le jeu rafraîchit ses chiffres
  souvent). Parallaxe : 2 couches d'étoiles générées (0,2 et 0,4 de la
  vitesse). Détail selon le zoom (< 0,66 : médaillons seuls). Ouverture à
  0,78. Décor généré par script : `assets/arbre/`.
- Banc : scène `scenes/arbre.jsx`. ⚠️ Au banc, un glisser à la SOURIS qui
  démarre sur un nœud ouvre le nœud (le navigateur ne transfère pas la main
  comme un téléphone) : démarrer les essais dans le vide. Le pincement à 2
  doigts et la fluidité réelle ne se testent QUE sur téléphone.
- **Étape 2 (Gemini)** : grand arbre en 2 images, médaillons, médaillon
  Ascension, plaque de prix, icônes. **Étape 3** : branches qui s'illuminent à
  l'achat, lucioles, effets.

**Arbre — retours de l'auteur (27/09)** : « très fluide » ✅ (moteur maison
validé sur téléphone). Corrigé :
- **Plein écran** : racine en absolu sur tout l'écran (zIndex 4, sous la barre
  de navigation à 5) ; l'arbre repose le BackButton (prop `onRetour`), soldes
  en plaques de bois (plaque-solde + cristal), bannière « Améliorations ».
  L'Ascension s'ouvre à 57 % de la hauteur (l'en-tête ne recouvre pas l'arbre).
- **Noms toujours sous les nœuds, prix en pastille dessous** (`prix-or` /
  `prix-gris` = bouton de prix de la Boutique, émail recoloré) ; texte
  COMPENSÉ au zoom (×1 à ×1,8 selon ZOOM_DEPART / échelle, palier au dixième,
  rendu seulement quand le palier change) ; ZOOM_MIN 0,5 ; plus de masquage
  selon le zoom.
- **Fiche centrée** dans une FenetreBois (en bas, son bouton passait sous la
  barre) ; **toucher l'Ascension ouvre TOUJOURS sa fiche** avec « Faire
  l'Ascension » (grisé tant qu'elle n'est pas débloquée) — plus d'Ascension
  directe au toucher (action irréversible).
- Boutons + / − / ◎ = boutons ronds émeraude du kit ; Reliques dans une
  FenetreBois.
- ⚠️ Piège (script) : délimiter un bloc par un motif générique (`});`) peut
  attraper une fin BEAUCOUP plus loin → toujours la vraie ligne de fin, et
  vérifier ce qui suit. Et une vérification « nom présent ≥ 2 fois » est
  fausse pour un style (`styles.X` + `X:`) ou une prop reçue : vérifier
  usages ⊂ définitions.

**Arbre — chevauchement (retour de l'auteur, 27/09)** : MESURÉ par un
vérificateur (nœuds + noms réels sur 1-2 lignes + pastilles, pire cas tout
visible) : 28 collisions au zoom d'ouverture, 41 dézoomé. Recherche
exhaustive de l'écartement : ×1,4 en largeur et ×2,05 en hauteur (la plus
petite hauteur sans collision, en gardant l'arbre étroit pour un téléphone
tenu droit), Griffes / Offrande ramenées à ±200 → **0 collision**. Toile
1056 × 3287.
- **Source UNIQUE** : `src/games/clicker/arbreDisposition.js` (toile, zooms,
  modèle d'étiquette, positions, chaînes), lue par l'arbre ET par le contrôle.
- **Contrôle `auditArbreSansChevauchement`** (+ sabotage : Faveur collée au
  Pacte → crie) : 0 collision au zoom de référence et dézoomé au maximum,
  tout dans la toile, une place pour chaque amélioration.
- Ouverture à 0,6 (tout le cœur visible) ; **textes calés sur ZOOM_TEXTE_REF
  0,78**, séparé du zoom d'ouverture (sinon baisser l'ouverture rapetisse les
  textes).

**Mode développeur (27/09)** : « 💰 +10³⁰ pièces (Élevage) » dans Options →
clé `DEV_ADD_COINS_KEY` (MONTANT CUMULÉ), lue au chargement du Clicker, ajoutée
au SOLDE seulement (pas au total gagné : l'Ascension reste honnête), puis
remontage immédiat comme « Débloquer tous les monstres ». 10³⁰ = plus haut
palier affichable (« No ») ; mesuré : aucune somme ne permet de « tout
acheter » (Pacte nv 200 = 6,75e61). Aussi « 💎 +1 000 Diamants ».

**Arbre LOGIQUE (2e version, retours de l'auteur, 27/09)** :
- Branches = thèmes ET dépendances réelles : « PUISSANCE DE TAP » = Pacte →
  les 10 améliorations en UNE chaîne (règle du jeu : chacune s'ouvre au niveau
  TAP_UPGRADE_UNLOCK_LEVEL de la précédente, la 1re au niveau
  TAP_UPGRADE_FIRST_PACTE_LEVEL du Pacte) ; « CRITIQUES » = Pacte → Faveur
  des Esprits (chance) → Dégâts critiques (force) ; « AUTO-CLICS » = les 15 en
  une chaîne par prix ; « PASSIF » = Sanctuaire → Veilleur ; Reliques à part.
  Titres de branche peints sur la carte (TITRES).
- **Ligne de GAIN** sous chaque nom (calculée par les fonctions du jeu, rien
  en dur : critChance / critMultiplier en différence d'un niveau, etc.) ; sur
  un nœud verrouillé, la CONDITION pour l'ouvrir (« 🔒 Poigne Ancienne nv 5 »,
  coreUpgradeRequirement pour les bases).
- **La pastille de prix achète aussi** (conteneur d'étiquette en 'box-none').
- Zoom maximum 3. Disposition recherchée par script (outil local
  disposition_logique.py → arbreDisposition.js) : la plus compacte sans
  collision parmi 24 valides ; toile 1220 × 4215.
- L'audit anti-chevauchement modélise maintenant la ligne de gain et les
  titres ; sabotage recalé (Faveur collée au Pacte).

**Arbre — 3e version, COURONNES (retours de l'auteur, 27/09)** : les longues
chaînes déplaisaient (« tout sur une seule branche ») ; son image de
référence (éléments en arcs autour de l'Ascension) retenue. Même logique de
déblocage, mais la chaîne SERPENTE de couronne en couronne (outil local
disposition_couronnes2.py) : en haut 3 / 5 / 5 (Poigne, PACTE au sommet,
Faveur ; Gantelet … Dégâts critiques au bout ; les 5 dernières), en bas 4 / 5
/ 6 auto-clics (couronnes qui s'élargissent) ; ouverture ±45°, rayon de
chaque couronne calculé pour l'espace des étiquettes. Toile 1712 × 2401 (au
lieu de 4215 de haut), 0 collision. Reliques / Passif sur les côtés
(x ±560, hors écran à l'ouverture : se révèlent en glissant).
- **Fiche = vrai menu** : fond presque opaque (rgba 0,94), FenetreBois
  élargie : médaillon, niveau, « Ce que ça rapporte » / « Pour le débloquer »,
  détail, barre de progression (Ascension), bouton d'achat.
- **Reliques** : GrandPanneau, prix en pastilles dorées / grises qui achètent
  (le style de prix était devenu brun foncé : invisible sur le bois) ; texte
  tiré de l'effet (`describeUpgradeEffect`) — 4 reliques sans champ desc
  affichaient « null » ; verrouillée : « Nécessite <créature> ».
- ⚠️ **Piège évité : `describeUpgradeTotal` n'est PAS exportée** par
  clickerLogic (interne à ClickerScreen) — l'importer aurait planté le panneau
  au téléphone, la compilation passant. **Vérifier que chaque nom importé
  existe VRAIMENT** (fait : 33 + 13 imports de l'arbre).
- Sabotage de l'audit anti-chevauchement rendu INDÉPENDANT des coordonnées
  (étiquettes élargies à 420 → 48 collisions) : l'ancien (Faveur collée au
  Pacte) se périmait à chaque disposition — la suite l'a signalé « aveugle ».
- Verrou : `garde.sh forcer` utilisé après avoir VÉRIFIÉ que les 2 fichiers
  signalés étaient mes propres modifications (scène de banc + lien du banc).

**Dézoom « à fond » (27/09)** : ZOOM_MIN 0,18 (l'arbre entier tient dans
l'écran) ; la compensation des textes s'ARRÊTE à ZOOM_COMPENSATION_MIN 0,5
(en dessous, tout rétrécit ensemble : aucun nouveau chevauchement, l'audit
teste toujours la compensation maximale).

⚠️ **Ordre des auto-clics** (constat du 27/09, rien modifié) : l'arbre (comme
l'ancienne boutique) les trie par PRIX DE BASE, mais le prix RÉEL inclut une
surprime « avant l'heure » (palier 3) : à l'Ascension 0, Héraut d'Orage
(2,0e9) passe avant Golem de Cristal (3,1e8), Colosse de Pierre (5,4e9) avant
Gardien Céleste (5,1e9). Proposé à l'auteur : trier par prix réel à
l'Ascension courante (stable pendant une Ascension).

**Arbre — 4e version, 8 DÉPARTS (validée par l'auteur, 27/09 : « deux
échelles = deux cordes, pas un arbre »)** : structure RÉELLE du jeu —
PUISSANCE DE TAP (Pacte + 10, tronc en zigzag), CRITIQUES (Faveur, depuis
l'Ascension → Dégâts critiques, reliques de chance / force en rameaux vers
l'extérieur), FORCE DES CRÉATURES (4 reliques de tap), Griffes / Offrande,
PASSIF (Sanctuaire → Veilleur, 5 reliques de production en éventail tourné
vers l'extérieur), 3 RACINES d'auto-clics par palier (`tier` ; triés par prix
de base = prix réel dans un palier ; chacune révélée 2 par 2), RELIQUES
D'AUTO-CLICS. **Les 20 reliques sont dans l'arbre** (verrouillées « ??? » +
« Nécessite <créature> ») ; nœud et panneau Reliques séparés RETIRÉS.
- Familles lues dans les données par `reliquesParFamille()` /
  `autoClicsParPalier()` (arbreDisposition.js, source unique arbre + audit ;
  import de clickerLogic avec EXTENSION .js : exigée par Node, acceptée par
  Metro).
- Générateur local `disposition_8.py` + recherche : 0 collision, toile
  2342 × 3590 (paramètres notés dans le fichier). Compensation des textes
  plafonnée à 0,6 ; ZOOM_MIN 0,16 (l'arbre remplit la largeur) ; ouverture
  0,55.
- Audit réécrit : reliques par famille, 3 paliers, CHAQUE relique et auto-clic
  doit avoir sa place ; sabotage robuste (étiquettes 420 → 45 collisions).


## 27/09 — Boutique : l'ARBRE est ABANDONNÉ, cap sur le GRIMOIRE

L'auteur : l'arbre à 8 départs « trop le bordel ». Leçon : 53 éléments
visibles à la fois avec des lignes = illisible quelle que soit la
disposition. Choix parmi 3 concepts (Échoppe, Constellations, Grimoire —
design/a-integrer/02-boutique/PROMPTS-CONCEPTS.md) : **le Grimoire** (livre
ouvert : chapitre illustré à gauche, 5 éléments à droite avec médaillon,
nom, gain, sceau de cire = prix ; marque-pages par chapitre ; sceau de
l'Ascension sous le livre). En attendant, l'ARBRE reste en place
(fonctionnel) avec l'ancienne liste en filet.
Plan : 5 chapitres (Force du tap, Critiques, Auto-clics par palier,
Sanctuaire, Reliques) ; 1re double page = illustration + 5, suivantes = 5 + 5 ;
pages tournées au glisser (rotateY, pilote natif) ; Griffes / Offrande à côté
du sceau de l'Ascension. Images : série 1 = 6 pièces (56-61), série 2 = 6
PLANCHES de 9 icônes (52 éléments) découpées automatiquement par cellules.

**Grimoire : IMAGES en portrait, LIVRE ouvert normalement (précision de l'auteur)** : les images Gemini sont en 9:16 (comme l'appli) mais le livre garde sa forme de maquette (pages gauche / droite, plus large que haut) — pas de livre retourné (rendu médiocre). Prompts 56-61 réécrits en conséquence.

**Grimoire construit (27/09)** : `screens/games/GrimoireBoutique.js` remplace
l'arbre dans la boutique (filet : l'ancienne liste). Pièces 56-61 reçues DANS
L'ORDRE INVERSE (rangées par contenu) ; sceau de prix ROND (badge) ; planche
des illustrations découpée par CELLULES 2 × 3 ; halos rosés repeints en OR
(le fantôme garde son rose) ; 5 marque-pages par rotation de teinte ; sceau
gris « pas assez ».
- Zones d'écriture MESURÉES sur l'image du livre (28 % de sa largeur chacune)
  → livre affiché 1,18 × l'écran (seules les couvertures dépassent),
  marque-pages sur la tranche HAUTE (icône de chapitre), 4 éléments par page,
  encre foncée sur parchemin. 1re double page d'un chapitre = intro + 4,
  suivantes 4 + 4 ; flèches, glisser, numéro « n / N » sur étiquette ; le
  livre enchaîne les chapitres.
- Modèle NON dupliqué : `construireNoeuds` (arbre) ; fiche `FicheElement`
  extraite de l'arbre et partagée.
- Chapitres : source unique `games/clicker/grimoireChapitres.js` + contrôle
  **auditGrimoireComplet** (chaque élément achetable une seule fois ;
  sabotage : Dégâts critiques retirés → crie).
- ⚠️ **Piège : `pointerEvents: 'box-none'` DANS LE STYLE est ignoré par le
  banc (navigateur)** : une couche plein écran animée recouvrait les
  marque-pages (clic sans effet). Remède : UNE couche par page, à la taille
  de la page — ne jamais poser de couche plein écran « transparente au
  toucher » par-dessus des boutons.
- Série 2 (icônes) : 6 planches de 9 (prompts 62-67).

**Icônes du Grimoire (27/09)** : 6 planches Gemini de 9 (prompts 62-67),
reçues dans l'ORDRE INVERSE (comme la série 1 — l'envoi groupé de l'auteur
inverse l'ordre : TOUJOURS identifier par le contenu). Découpées par cellules
3 × 3 ; chaque icône associée à son élément par NOM EXACT dans les données
(identifiants internes trompeurs : « griffeBrais » = Griffe de Pyrosile,
« titanfoudre » = Héraut d'Orage). 54 icônes (52 éléments + pièce +
diamant) dans `assets/grimoire/icones/`, carte GÉNÉRÉE
`screens/games/grimoireIcones.js` (clé = identifiant du modèle).
Affichées dans les médaillons du livre, sous le livre, dans l'en-tête
(pièce) et dans la fiche (`fiche.icone`, partagée avec l'arbre). Un élément
verrouillé garde le cadenas (mystère). Verrou de relique raccourci :
« 🔒 <créature> ».

**Grimoire — 2e version (retours de l'auteur, 27/09)** :
- **Chevauchement des cadres dessinés** : zones d'écriture re-mesurées HORS
  ORNEMENTS (masque : tout ce qui n'est pas parchemin clair ; plus grand
  rectangle sans ornement à 6 px, méthode de l'histogramme). Livre ×1,35
  l'écran ; le sceau de l'Ascension monte au centre de l'en-tête ; Griffes /
  Offrande = 6e chapitre « Comptoir » (coffre, marque-page argent) ; le niveau
  passe en badge sur le médaillon.
- **Vraie page qui se tourne** : feuilles `page-gauche.png` / `page-droite.png`
  découpées du livre (papier jusqu'au DOS) ; deux faces SŒURS (recto = page
  quittée, verso = page d'arrivée) qui pivotent autour du dos
  (perspective + translateX ±l/2 + rotateY, backfaceVisibility hidden), ombre
  au passage, 640 ms ; dessous, la page d'arrivée. ⚠️ Faces sœurs, pas
  imbriquées : sur téléphone, la 3D d'un parent ne se propage pas aux enfants.
- **Achats clairs** : le BOUTON DE PRIX (cire rouge à bord doré, pièce dorée ;
  gris si pas assez) achète ; toucher l'élément ouvre sa fiche ; « +1 » doré
  qui s'envole à l'achat.
- Banc : `scenes/grimoire-lent.jsx` = animations ×5 plus lentes (sinon les
  captures, trop lentes, ratent la page en train de tourner).


## ⚠️ 27/09 — RETOUR DU BUG DES TAPS (clicker + achats) : cause réelle et garde

Symptôme (auteur) : « le problème de tap est revenu, sur le clicker et même
quand on veut acheter des items ». Enquête (mesures, pas d'hypothèse
retenue sans preuve) :
- ÉCARTÉ : calculs lourds avec le mode développeur — prix / dégâts en moins
  de 7 µs même au niveau 100 000 ; aucune boucle de rattrapage dans la logique.
- CAUSE : la zone de tap était un **TouchableOpacity onPress={handleTap}**.
  Le 03/09, le diagnostic avait PROUVÉ qu'il jette les taps rapides (cycle
  d'appui complet attendu : 142 envoyés/s, 2 à 15 reçus) → correctif 17f73f9
  (répondeur : tap au CONTACT). Le même jour, la remise à l'identique d'une
  version confirmée (abd69b9) a EMPORTÉ ce correctif. À 150 ms il tenait
  tant que le téléphone avait de la marge ; les effets ajoutés depuis (onde de
  choc, étincelles, créature qui attaque à chaque tap, lueurs) l'ont fait
  décrocher. Même défaut sur les boutons d'achat (TouchableOpacity / onPress,
  hérités de l'ancienne boutique) ; et le « +1 » d'achat restait à l'écran,
  invisible (risque d'intercepter le toucher suivant).
- CORRECTIF : zone de tap = `View` au répondeur (`onStartShouldSetResponder`
  + `onResponderGrant={handleTap}`), réappliqué tel quel, commentaire
  d'histoire dans le code ; boutons de prix du Grimoire en `Pressable
  onPressIn` ; « +1 » dans une View transparente au toucher, RETIRÉ à la fin.
- **GARDE PERMANENTE : `auditZoneTapAuContact`** (+ sabotage = remettre le
  TouchableOpacity d'aujourd'hui → crie). NE JAMAIS remettre onPress sur la
  zone de tap. Sonde de taps 20 / 20 aux 5 endroits.

**Grimoire (même jour)** : chapitre « Comptoir » RETIRÉ (l'auteur : trop de
pages, et l'achat de Griffes n'était plus mis en avant) — Griffes, le sceau
de l'Ascension et Offrande reviennent SOUS le livre (HORS_LIVRE) ; livre
×1,22 ; boutons de prix au contact là aussi.

**Grimoire — retouches (retours de l'auteur, 27/09)** :
- **Magenta en haut du livre** : contour mi-transparent teinté par le fond.
  Méthode MESURÉE : papier / cuir / or = tons chauds (rouge ≥ vert, vert −
  bleu ≥ 23 ; le rose résiduel est ≤ 12) → dans une bande de 10 px au
  contour, tout pixel hors de cette palette prend la couleur du pixel chaud
  propre le plus proche (seuil 18) ; + les taches magenta franc partout
  (452 px cachés en bas du dos). Livre, feuilles, sceaux, médaillon nettoyés.
- **Sceau de l'Ascension** : version OR VIF (`sceau-ascension-or.png`), halo
  doré qui respire (`lueur-or.png`), « ASCENSION » en petites capitales à
  empattements (police système : Georgia / serif) crème cerclée de brun.
- **Ordre des auto-clics** : le jeu n'impose AUCUN ordre (pas de règle de
  déblocage) ; la révélation PAR PALIER héritée de l'arbre montrait le 1er de
  chaque palier dès le départ (Dragon Miniature acheté avant tout). → UNE
  file dans l'ordre des PRIX RÉELS de l'Ascension en cours (stable : vérifié
  Asc 0, 1, 3), révélée 2 par 2 (possédés, suivant, « ??? ») ; un auto-clic
  déjà possédé hors ordre reste visible. Vérifié au banc : partie neuve →
  « Esprit Frappeur · ??? » ; Dragon possédé → tout jusqu'au Phénix + « ??? ».


## 27/09 — Boutique : 4 améliorations (accord de l'auteur sur les 5)

1. **Pastilles sur les marque-pages** : ⭐ dorée si le chapitre contient
   l'achat conseillé, point cyan s'il contient un achat possible.
2. **Étoile « Conseillé »** : `games/clicker/conseilBoutique.js` (pur) —
   revenu/s avec les FORMULES DU JEU (taps au rythme de référence 6,7/s,
   Transe au plafond ×3, espérance critique, multiplicateurs de gain,
   passiveRate) ; meilleur (gain/s ÷ prix) parmi les achats abordables du
   livre. Mesuré : ~1,3 ms sur ordinateur → MÉMORISÉ (signature : niveaux +
   achats possibles), pas recalculé à chaque rafraîchissement des pièces.
   Contrôle **auditConseilBoutique** (+ sabotage : revenu passif oublié).
3. **×1 / ×10 / MAX** : ACHAT GROUPÉ dans ClickerScreen (`coutGroupe` :
   prix de CHAQUE niveau additionné, arrêt au 1er niveau trop cher ou au
   maximum, paiement UNIQUE, remise sur le 1er niveau seulement). ⚠️ Pièges
   évités : (a) appeler une fonction d'achat n fois aurait payé n fois le prix
   du 1er niveau (refs / état mis à jour au rendu suivant ; 4 fonctions
   lisaient même l'état figé) ; (b) l'ancienne liste branche ces fonctions sur
   onPress, qui passe l'ÉVÉNEMENT → quantité VALIDÉE (`quantiteAchat`).
   Le modèle porte `cout(j)` / `estMax(j)` ; le livre affiche le vrai total.
4. **Progression vers le déblocage** : « 🔒 Pacte 3/5 », « 🔒 Poigne
   Ancienne 3/5 » (CORE_UNLOCKS.requires + règles des améliorations).
- ⚠️ Piège REVU : l'en-tête en bande pleine largeur « box-none » recouvrait le
  sélecteur (même cause que les marque-pages) → RETOUR et soldes en deux
  éléments séparés. RÈGLE : jamais de bande plein écran « transparente au
  toucher » au-dessus de boutons.

⚠️ **ANOMALIE D'ÉQUILIBRAGE (signalée, NON corrigée — à mesurer)** : le
Sanctuaire complet (50 niveaux) coûte 85 933 pièces pour +25 % de TOUTE la
production ; le commentaire du Veilleur annonce « 171 864 pièces pour le
niveau 10 » alors qu'il en coûte quelques centaines → ces deux prix semblent
divisés par ~300 (remise à l'échelle de l'économie ?). Le conseil le voit :
il recommande le Sanctuaire en milieu de partie. À traiter en séance
d'équilibrage, PAR SIMULATION.

5. Sons : envoi SÉPARÉ (nouvelle dépendance).

**5. Sons de la boutique (27/09, envoi SÉPARÉ)** : `expo-audio` ajouté —
version d'Expo Go 57 lue dans `bundledNativeModules.json` d'expo@57.0.9
(`~57.0.3`, verrouillé en 57.0.5). ⚠️ Piège évité : npm, pour satisfaire la
dépendance « pair » `expo-asset` d'expo-audio, REMONTAIT expo-asset
(57.0.16 → 57.0.18) et expo-constants (57.0.17 → 57.0.20, partie native) →
les deux FIGÉS à leur version actuelle (exactes, `--save-exact`) ; comparaison
complète du verrou : seul expo-audio ajouté, AUCUNE version changée ;
`npm ci --dry-run` (commande du robot) OK. Sons SYNTHÉTISÉS (assets/sons/
page.wav, achat.wav, aucun droit tiers). `screens/games/sonsBoutique.js` :
require STATIQUE (Metro l'embarque) mais exécuté à la demande dans un
try/catch → si le module natif faisait défaut, jeu SANS son, pas de plantage.
Réglage « Sons » (SettingsContext `sons`, interrupteur dans Paramètres).
Banc : doublure expo-audio (stubs/natifs.js) + chargement des .wav.


## ⚠️ 02/10 — PLANTAGE « Cannot find native module 'ExpoAudio' » : cause et garde

Rapport de l'auteur (Android 36, build ada8fa3) : erreur FATALE dès qu'un son
de la boutique devait jouer. Cause réelle, en deux temps :
1. L'Android de l'auteur n'utilise PAS Expo Go mais l'APPLI CONSTRUITE
   `app.paradox.mobile` (identifiant de app.json), bâtie AVANT l'ajout du son :
   son binaire n'embarque PAS le module natif ExpoAudio (expo-audio appelle
   requireNativeModule('ExpoAudio') dès son chargement).
2. Ma « protection » (require à la demande dans un try/catch) était
   INOPÉRANTE : un module chargé à la demande passe par `guardedLoadModule` de
   Metro, qui rattrape l'erreur LUI-MÊME et la déclare FATALE
   (`ErrorUtils.reportFatalError`) — le try/catch appelant ne la voit jamais
   (vérifié dans metro-runtime 0.84.5, la version du projet).
CORRECTIF : `requireOptionalNativeModule('ExpoAudio')` (expo-modules-core
57.0.15 : renvoie null, ne lève pas) AVANT de charger expo-audio, chargé
seulement si le module natif existe. Sans lui : pas de son, aucun plantage.
**GARDE : `auditModulesNatifsProteges`** (+ sabotage) — pour TOUT module natif
optionnel (expo-audio, expo-haptics) : jamais d'import statique, require
conditionné par requireOptionalNativeModule. **RÈGLE : un try/catch autour
d'un require ne protège RIEN avec Metro.**
Conséquence : sur l'appli construite actuelle, les sons resteront muets jusqu'à
une NOUVELLE construction native incluant expo-audio ; dans Expo Go 57 (qui
l'inclut), ils jouent.


## 02/10 — Boutique, étape 1 de la suite : VOIR ce que rapporte chaque achat

- En-tête du Grimoire : « 👆 X /tap » (valeur MOYENNE d'un tap, critiques
  comprises, HORS Transe) et « ⚙️ Y /s » (revenu passif) — deux mesures
  séparées : un « revenu par seconde » unique (taps au rythme de référence)
  aurait trompé un joueur qui ne tape pas.
- À l'achat, le VRAI gain s'envole dans sa bonne unité (« +2,8/tap »,
  « +3,5/s », les deux pour le Sanctuaire), calculé AVANT l'achat pour la
  quantité achetée (×1 / ×10 / MAX).
- conseilBoutique découpé : `valeurTap` + `revenuPassif` (revenuParSeconde
  INCHANGÉ, vérifié au millième) ; `etatApres(e, delta, q)`.
  auditConseilBoutique étendu : chaque achat change la BONNE unité (Pacte →
  tap seulement, auto-clic → passif seulement), 10 niveaux ≈ 10 × 1 ; sabotage
  recalé sur la nouvelle ligne.
- En-tête : sélecteur et cadre des gains placés dans l'espace LIBRE calculé
  (largeur − 268 : 92 pts sur un Android de 360) — mesuré sans chevauchement à
  360 / 390 / 412.
- Banc : un clic INSTANTANÉ (souris enfoncée / relâchée au même instant) ne
  déclenche pas un Pressable onPressIn dans le navigateur — tester avec un
  appui de ~150 ms (le téléphone, lui, déclenche au contact).


## 02/10 — Ménage : l'arbre abandonné est SUPPRIMÉ

- Modèle des éléments déplacé dans `games/clicker/boutiqueModele.js` (PUR,
  testable), SANS les positions de l'arbre — PROUVÉ identique (ancien modèle
  reconstitué vs nouveau, sur 3 parties types : 31 / 39 / 53 éléments,
  prix, états, gains, prix des niveaux suivants identiques).
- Fiche détaillée → `screens/games/ficheElement.js` (avec ses 10 styles,
  relevés automatiquement) ; familles → `games/clicker/boutiqueFamilles.js`.
- Supprimés : ArbreBoutique.js, arbreDisposition.js, la scène de banc de
  l'arbre, le contrôle auditArbreSansChevauchement et son sabotage
  (déclarations comparées avant / après : seules les siennes ont disparu).
- Banc : textTransform uppercase n'affecte PAS textContent — chercher le
  texte réel (« Ce que ça rapporte »), pas sa forme affichée.

**02/10 — Boutique, étapes 2 et 3** :
- **Silhouettes mystères** : un élément verrouillé montre l'icône peinte en
  SILHOUETTE (tintColor sombre) + petit cadenas en coin, dans le livre et dans
  la fiche ; le nom reste « ??? » (+ condition / créature nécessaire).
- **Badge « NOUVEAU »** : éléments débloqués jamais affichés, mémoire
  AsyncStorage `boutique:vus:v1` ; à la 1re ouverture, tout ce qui est DÉJÀ
  débloqué compte comme vu ; un élément affiché 1,5 s sur la double page
  devient « vu ». Marque-pages : « ! » rouge (nouveau) > ⭐ (conseil) > •
  (achat possible). Badge en haut à gauche du médaillon, étoile en bas à
  gauche, niveau en bas à droite (mesuré : plus de chevauchement avec le nom).
  Vérifié au banc : 1 badge + 1 « ! » à 0,6 s, 0 à 2,8 s.

**02/10 — Boutique, étapes 4 et 5** :
- **Sceau de l'Ascension** : « PRÊTE ! » (le sceau pulse ×1,09, halo vif) ;
  seuil atteint mais défi « Fais ta Nᵉ Ascension » non lancé → « 🔒 DÉFI »
  (cas qui expliquait des blocages incompris) ; sinon le POURCENTAGE (une
  décimale sous 10 % : « 0,5 % » plutôt qu'un « 0 % » décourageant). Le
  multiplicateur actuel reste dans la fiche.
- **Appui maintenu = rafale** : 1er achat au contact, puis après 0,38 s doigt
  posé, un achat toutes les 0,11 s (élément et offre relus FRAIS à chaque
  fois) ; arrêt au relâcher, en tournant la page, au démontage, ou dès que
  ce n'est plus abordable (sans ouvrir de fiche) ; vibration et son 1 fois
  sur 4. Pages, Griffes et Offrande. Mesuré au banc : 10 achats en 1,5 s,
  0 après le relâcher. Contrôle **auditRafaleArretee** (+ sabotage).

**02/10 — Boutique, étape 6 : OUVERTURE ANIMÉE du livre** (image 68 :
`assets/grimoire/couverture.png`, étoile runique, dos à gauche). Couverture
gardée à ses PROPORTIONS NATURELLES (585 × 807, rapport 0,725 vs 0,558 pour la
moitié du livre — l'écraser aurait ovalisé l'étoile) : son surplus de largeur
tombe hors de l'écran à droite. Scène d'ouverture (0,12 s + 0,9 s) : moitié
droite du livre dessous, couverture 0 → −180° autour du dos, revers =
`livre-gauche.png` (moitié gauche EXACTE du livre ouvert) qui se pose 180 → 0°
(les deux faces sont de tranche à mi-course : la différence de largeur ne se
voit pas) ; puis le vrai livre (images identiques : aucun saut), textes et
marque-pages en fondu (0,22 s). Aucun calque plein écran : chaque onglet et
chaque page dans sa propre vue. Vérifié : séquence image par image (scène
ralentie) ; après ouverture, marque-pages, glisser et achat fonctionnent.


## 02/10 — Collection : « Album de cartes » (concept retenu par l'auteur)

Maquette : design/a-integrer/03-collection-et-deck/concepts/1790968948748.jpg.
Pièces Gemini 69-73 (reçues dans l'ordre INVERSE, identifiées par contenu) →
`assets/collection/` : album.png, abri-deck.png, oeuf-souche.png, dos-carte.png,
emplacement-vide.png, ruban-{8 éléments}.png (teinte depuis le rouge),
gemme-{6 raretés}.png ; mesures dans `assets/collection/mesures.json`.
Réutilisés : cadres de cartes par élément (assets/adventure/frames/).
Nettoyage des contours, par pièce : tons chauds (album, dos, emplacement) ;
« magenta-ité » min(R,B)−G > 25 au contour (abri, œuf : mousse verte et
cailloux bleus — mesuré : ≤ 15 à l'intérieur, ~60 au contour) ; gemmes :
pourtour RETIRÉ (3 px) avec MARGE transparente (sinon le bord de l'image
compte comme « dedans » → barres verticales) — la gemme violette ressemble
au magenta, un tri par couleur l'aurait abîmée.
Emplacements de l'abri : contraste trop faible pour une détection → lus sur
une GRILLE graduée (5 %).

**Moteur de livre COMMUN** : `screens/games/livreTourne.js` (useLivreTourne,
doublePage, FaceTournante) extrait du Grimoire ; Grimoire rebranché et
vérifié (page en 3D image par image, marque-pages, glisser, achat).
auditRafaleArretee suit la nouvelle forme (avantTour → arreterRafaleRef).
Banc : un glisser qui DÉMARRE sur un bouton n'est pas repris par le
navigateur (artefact de banc, identique avant / après).

**Album de cartes — 1re version en ligne (02/10)** : `screens/games/CollectionAlbum.js`,
branché à la place de CollectionView (qui reste le filet de sécurité, comme
ShopView pour le Grimoire). Mise en page calculée pour tenir entre les soldes
(126) et la barre du bas (ÉCRAN − 152), mise à l'échelle si l'écran est court.
- Abri du DECK : le VRAI deck (3 emplacements) ; toucher un emplacement →
  `onOuvrirEmplacement` = setPickerSlot (DeckPicker, zIndex 20, par-dessus).
- Album : pages construites par `games/clicker/albumPages.js` (PUR) — une
  page par élément, 4 cartes max, triées par rareté ; doubles pages par 2 ;
  pages qui tournent avec le moteur COMMUN (feuilles album-feuille-*.png).
- Cartes : cadre de l'élément (cardFrames, bordure mesurée 13 % / 10 %) +
  CreatureArt + nom ; niveau en BADGE dans le coin (sous la carte, il passait
  à la ligne et écrasait le titre de la page) ; gemmes de rareté ; inconnue =
  dos de carte, ne s'ouvre pas. Toucher une carte → CreatureDetail.
- Rubans d'éléments (8) : sautent à la page ; ceux des pages affichées
  ressortent ; police réduite pour LUMIÈRE / TÉNÈBRES.
- Œuf doré : halo par le code (lueur-or), « Invoquer » + prix (grisé si trop
  cher) → doSummon.
- Contrôle **auditAlbumComplet** (+ sabotage : élément « Magie » retiré →
  ses créatures disparaissent) : chaque créature UNE fois, ≤ 4 cartes par
  page, un ruban par élément — protège les 17 créatures à venir.
- Vérifié au banc (scène `collection.jsx`) : rubans, glisser dans les deux
  sens, fiche, carte inconnue, emplacement du deck, invocation, page en 3D.


## 02/10 — Album de cartes FIDÈLE À LA MAQUETTE : publié (branche `album-fidele` fusionnée)

Retour de l'auteur : « pas du tout le même menu ». 10 différences relevées et
corrigées : barre du haut de l'écran principal AUSSI sur la Collection
(diamants, pièces, revenu, réglages ; RETOUR sous les diamants) ; fiche d'une
créature posée par ClickerScreen au plan 10 (calque de l'album au plan 2,
sous la barre du haut) ; 8 cartes par double page, éléments MÉLANGÉS, sans
titre (albumPages : une seule suite) ; cartes hautes (icône d'élément, cadre,
image ou SILHOUETTE « ? », bandeau nom / Niv. / gemmes) ; onglets pointus
dessinés par le code ; ABRI LARGE (pièce 76, cadre PAYSAGE ; affiché 2,3:1,
cartes du deck à la hauteur de son intérieur) ; album (affiché 1,25:1) posé
sur la GRANDE SOUCHE (pièce 75) ; œuf doré (découpé de la 71, ombre ovale,
halo) devant elle, « Invoquer » et « … Po » en grand dessous.
⚠️ Leçons : (1) un prompt en cadre PORTRAIT donne des objets HAUTS — pour un
objet large, cadre PAYSAGE 16:9 ; (2) résidus magenta SOMBRES : mesurer la
magenta-ité RELATIVE à la luminosité, puis recolorer tout pixel encore rose
(pointes de fougères) ; (3) toujours COMPARER CÔTE À CÔTE avec la maquette
avant de publier (la 1re version ne l'avait pas été).
Images retirées de l'appli (originaux dans design/) : 1er abri, abri carré,
œuf au nid, dos de carte, 8 rubans.

**02/10 — Collection, retouches de l'auteur** : œuf RETIRÉ (demande de l'auteur ;
« Invoquer » + prix restent sur l'avant de la souche, toute la souche
invoque) — images orbe-oeuf / ombre-ovale et animation du halo supprimées.
Marque-pages : image 77 (les 8 en UNE planche, sans texte) — dessinés pointe à
GAUCHE par Gemini → RETOURNÉS (pointe à droite, comme la maquette) ; contour :
pourtour retiré (2 px, avec marge) puis tons chauds sur la bande de 6 px (le
cadre est doré pour les 8 : le violet de la Magie, intérieur, est épargné) ;
texte du code, taille selon la longueur (8 / 7 / 6,5 / 6 pts : aucun nom
tronqué à 360, 390, 412). auditAlbumComplet exige l'image de chaque onglet
(prouvé : image Magie retirée → crie).

**02/10 — Collection : souche et intérieur des cartes (retour de l'auteur)** :
- SOUCHE en 3 tranches (fougères 22 % | tronc | fougères 22 %) : seul le tronc
  s'élargit → plateau ≥ largeur de l'album (comme la maquette), fougères et
  cailloux non déformés ; largeur ≥ 1,18 × écran (les côtés débordent).
- CARTES : la créature occupait ~57 % × 71 % de son image 512 (marges) →
  `games/clicker/cadrageCreatures.js` (GÉNÉRÉ : zone dessinée de chaque image,
  9 créatures / 27 images ; défaut pour les créatures à venir) ; la carte zoome
  dessus (94 % de la largeur / 90 % de la hauteur de la fenêtre, posée en bas).
  Fond : dégradé de l'élément (fond-carte-*.png, généré) ; inconnue = voile
  sombre + silhouette (si image) + « ? ». ⚠️ Piège : nombres numpy écrits
  `np.float64(…)` dans le JS généré → convertir en float avant d'écrire.


## 02/10 — Bug des taps signalé ENCORE : DIAGNOSTIC sur téléphone (pas de 3e supposition)

Historique : 2 causes déjà corrigées (« +X » qui avalaient les taps, f88479b ;
TouchableOpacity, 9657e54 — contrôle toujours vert) ; rien de nouveau posé
au-dessus de l'œuf depuis le 02/10 → bug probablement JAMAIS entièrement
résolu (l'auteur n'avait pas confirmé). Le banc (navigateur rapide) ne le
reproduit pas (30 taps / 150 ms → 30 comptés).
→ `games/clicker/diagnosticTaps.js` + section du rapport « Signaler un
problème » : touchers sur l'œuf (capteur en phase de CAPTURE à la racine,
`onStartShouldSetResponderCapture`, renvoie TOUJOURS false — contrôle
**auditCapteurTapsNeutre** + sabotage), taps comptés (handleTap), durée du
traitement, figements d'images > 100 ms (horloge requestAnimationFrame).
⚠️ ImageBackground passe ses props à l'IMAGE, pas à sa vue : le capteur est
une View qui l'ENTOURE.
LECTURE : perdus > 0 avec peu de figements → élément qui intercepte / touchers
qui se chevauchent ; beaucoup de figements → le téléphone sature (alléger
les effets par tap). Retirer l'horloge d'images une fois le bug compris.

⚠️ 02/10 — ERREUR DE PROCÉDURE corrigée : le diagnostic a été poussé alors que
les suites étaient ROUGES (étapes séparées par « ; » au lieu de « && »).
Causes : (1) import `./diagnosticTaps.js` dans diagnostic.js → auditSignalement
ajoute lui-même « .js » → importer SANS extension ; (2) le sabotage de
auditZoneTapAuContact visait la ligne EXACTE de la zone de tap, que la mesure
de la zone a modifiée → repère PÉRIMÉ (contrôle aveugle). RÈGLE : toute
modification d'une ligne visée par un sabotage → mettre le repère à jour ;
l'envoi se CONDITIONNE au vert des deux suites (&&), jamais « ; ».


## ✅ 03/10 — Bug des taps : 3e CAUSE trouvée PAR LA MESURE et corrigée

Rapport de l'auteur (diagnostic, 74 s) : 1 648 touchers sur l'œuf (~22/s : PAS
l'autoclicker seul — précision de l'auteur : autoclicker + ses doigts pendant
15 s, puis un pouvoir de créature et 6 DOIGTS à la fois pendant ~15 s ; ma
remarque « autoclicker bien plus rapide que 150 ms » était FAUSSE,
l'équilibrage à 150 ms reste la référence), 1 021 comptés → 627 PERDUS (38 %) ;
traitement d'un tap 0,1 ms, 54 images/s en moyenne → PAS une saturation.
CAUSE : touchers CHEVAUCHÉS — plusieurs doigts (et l'autoclicker) touchent
avant que les autres aient relâché ;
la zone comptait sur onResponderGrant (début du GESTE seulement) ; les
touchers suivants arrivent en onResponderStart, que personne n'écoutait.
REPRODUIT au banc (`tools/capture/chevauchement.mjs` : vrais événements
tactiles multiples via le protocole du navigateur, identifiants de doigts
recyclés — limite de 16) : 40 chevauchés → 24 comptés (18 perdus, ~43 %).
CORRECTIF : onResponderStart={handleTap} (chaque toucher, le 1er compris) +
onResponderTerminationRequest={() => false} (garder le geste) → 42 / 42, et
la sonde des taps simples reste à 20 / 20 (aucun double compte).
auditZoneTapAuContact : exige onResponderStart, INTERDIT onResponderGrant
pour compter ; 2 sabotages (TouchableOpacity ; retour au début du geste).
Le diagnostic reste en place (à retirer quand l'auteur confirme).

À suivre : le pire figement (4 441 ms) a pu venir de l'activation du POUVOIR
(plutôt que du lancement) — à vérifier avec l'auteur au prochain rapport.


## 03/10 — Bug des taps CONFIRMÉ CORRIGÉ + saccades réduites (rendus −49 %)

Rapport de l'auteur après le correctif onResponderStart : 1 058 touchers, 1 055
comptés (0 % perdus) ; mais 128 figements (> 100 ms) en 44 s à ~24 taps/s.
Mesuré au banc (`/tmp/mesure-rendus` : 50 touchers chevauchés en 2 s, compteur
de rendus `noterRendu`) : 237 rendus COMPLETS de l'écran (≈ 2,4 par tap) ;
au repos 3,5 / s. Trois sources, corrigées une à une, MESURÉES :
1. un rendu par tap → taps REGROUPÉS par fenêtre de 100 ms (`handleTap` reçoit
   l'heure exacte + la position, `traiterTap` = ancienne logique avec
   `instant` ; 1er tap après un calme traité IMMÉDIATEMENT) : 237 → 221 ;
2. les « +X » ajoutés PUIS retirés (700 ms) redessinaient tout l'écran →
   calque AUTONOME `CoucheEffetsTap` (état local, ref.ajouter) : → 175 ;
   (fenêtre 70 → 100 ms : → 167) ;
3. les pièces versées par le minuteur de 100 ms dans un 2e rendu → versées à
   la FIN DE CHAQUE LOT (même rendu ; trackEvent une fois par lot) : → 120.
Vérifié : sonde 20 / 20, chevauchés 42 / 42, pièces 0 → 38 après 25 taps.
Fausses pistes ÉCARTÉES par vérification : mode strict (banc en production),
effet sur `trackEvent` (useCallback([]) : stable), sauvegarde (différée).
auditZoneTapLibre suit le nouveau calque (`<CoucheEffetsTap ref=… />`).
Rapport suivant de l'auteur (46 s) : 916 touchers, 900 comptés (2 %, doigts sur
d'autres éléments) → l'auteur : « je pense qu'on est bon ». ⚠️ Ce rapport venait
du build fade2dd (AVANT l'optimisation a2fbdf0) : ses 115 figements sont ceux
d'avant ; l'effet de l'optimisation sur téléphone n'est pas encore mesuré.
DÉCISION : le diagnostic des taps RESTE dans le rapport « Signaler un
problème » (coût négligeable, chiffres précis au prochain souci). Toujours lire
le « Build » d'un rapport avant de conclure.

✅ 03/10 — OPTIMISATION CONFIRMÉE SUR LE TÉLÉPHONE (rapport, build a2fbdf0,
32 s, ~16 touchers/s) : 523 touchers, 522 comptés (0 %) ; 218 lots (2,4 taps /
lot) ; 376 rendus (11,8 / s) ; FIGEMENTS > 100 ms : 0 sur 1 716 images
(contre 115-128 avant) ; ~54 images/s. Bug des taps + saccades : CLOS.


## 03/10 — EXPLORATION : hub « Ponton céleste » (maquette de l'auteur, « exactement les mêmes proportions »)

⚠️ L'écran Exploration est en PAYSAGE (AdventureScreen verrouille l'orientation)
et n'a PAS de barre du bas : les premiers prompts (portrait + barre du bas)
étaient faux. Menu ÉPURÉ demandé, créatures sur 3 PILOTIS.
Images (design/a-integrer/05-aventure-carte/concepts/) : 1791027757766 =
MAQUETTE ; 1791027955149 = décor seul (pilotis vides ; Gemini y a laissé le
bandeau du titre, au même endroit que la pièce → recouvert) ; 1791027962317 =
pièces sur magenta (titre, « + », Changer, COMBAT), AUX PLACES de la maquette.
Implémentation (AdventureScreen, rendu du hub) : décor 16:9 posé ENTIER au
centre = SCÈNE ; autour, le même décor FLOUTÉ (blurRadius) ; chaque élément en
FRACTIONS de la scène (constante HUB, mesurée sur grille 2,5 % + boîtes exactes
des pièces). Créatures DEBOUT sur les pilotis : pieds au dessus mesuré (50,5 %),
hauteur 13 %, cadrage (cadrageCreatures) ; « + » doré seulement sur un pilotis
VIDE (Gemini en avait peint sous les créatures aussi) ; lueurs = lueur-or.
Logique INCHANGÉE : fiche, sélecteur (pilotis vide / Changer), COMBAT → carte
des niveaux, Runes, achat de Griffes, élixir, puissance colorée, RETOUR.
Banc : scène `exploration.jsx` (sauvegarde injectée via window.__memoireBanc,
exposée dans stubs/natifs.js ; « ?vide=1 » = deck vide) ; ouvrir EXPLORATION
puis passer la fenêtre en 844×390. 6 boutons vérifiés.
Contrôle **auditHubExploration** (+ sabotage : gemme des Runes débranchée).

**03/10 — Hub de l'Exploration, retouches de l'auteur** : RETOUR « 100 fois trop
gros » → réduit à [0.015, 0.025, 0.100, 0.075] de la scène (≈ 59 × 20 au banc ;
la maquette l'avait à 13,5 % de la largeur) ; COMBAT SCINTILLE un peu : composant
`BoutonCombat` (lueur qui respire + 3 étincelles ✦ tour à tour, boucle de 2,8 s,
moteur natif ; animations DANS le composant : ni rendu de l'écran, ni hook après
les retours anticipés d'AdventureScreen).
⚠️ BANC : `Animated.loop` avec useNativeDriver: true NE TOURNE PAS dans le
navigateur (le module natif manque : la boucle native ne démarre pas). Pour
vérifier une boucle, variante de scène qui force useNativeDriver: false
(Animated.timing enveloppé), comme pour les scènes « lentes ».


## ⚠️ 03/10 — BUG RÉCIDIVÉ : <Image> à la taille D'ORIGINE sur téléphone

Capture de l'auteur : le panneau RETOUR du hub de l'Exploration s'étalait sur la
moitié de l'écran (texte coincé dans son coin). CAUSE : <Image style=
{StyleSheet.absoluteFill}> — sur TÉLÉPHONE, React Native donne d'office à une
Image la taille D'ORIGINE de son fichier ; les 4 bords à 0 ne l'écrasent pas.
Le NAVIGATEUR du banc ne le montre pas (l'image y remplit son parent) → banc
« juste », téléphone faux. C'est EXACTEMENT le bug du 13/09 (f12767b, bouton
d'inventaire géant) — la leçon n'était qu'un COMMENTAIRE, sans contrôle, et
l'historique n'a pas été consulté avant d'écrire le hub.
RÈGLE : une <Image> qui remplit son parent a une LARGEUR ET une HAUTEUR
explicites (ex. styles.hubPleineImage : width/height '100%'), ou passe par
ImageBackground (il retransmet largeur/hauteur à son image interne : sûr).
GARDE : **auditImagesTailleExplicite** (tout src/, commentaires retirés : Image /
Animated.Image en absoluteFill, aux 4 bords écrits à la main, ou par un style
nommé qui remplit — sans `width`) + 2 sabotages. Corrigés : RETOUR et le fond
flouté du hub (qui se posait aussi à sa taille d'origine, calé en haut à gauche).


## 03/10 — Hub de l'Exploration : plein écran + créatures nettes (retour de l'auteur)

1. « Bordures sur les côtés » = les bandes floutées (décor 16:9 posé entier sur
   un écran 2,17:1). → Le décor COUVRE l'écran (`cadresExploration` : fond
   « cover », rogné en haut/bas ou sur les côtés) ; pilotis, créatures, « + »,
   « Changer » ATTACHÉS au décor (F) ; l'interface (R) garde les tailles de la
   maquette ramenées à la HAUTEUR de l'écran (ou à sa largeur si < 16:9) et
   s'ACCROCHE aux bords : RETOUR gauche, compteurs + Runes droite, titre haut
   centre, COMBAT bas centre. Vérifié : 891×411 (téléphone de l'auteur),
   731×411 (16:9), 1024×768 (tablette) — pas de bande, pas de chevauchement.
   Le bandeau du titre INCRUSTÉ dans le décor dépassait une fois rogné → effacé
   (ciel : reconstitution OpenCV Telea ; feuillage : copie MIROIR du feuillage
   voisin, fondu 90 px ; raccord bas 8 px).
2. « Créatures pixelisées » : sur Android, une image (fichier local, ex. mise à
   jour EAS) est décodée à la taille de son 1er CADRE ; l'Exploration se dessine
   d'abord en PORTRAIT puis tourne → décodée en petit, puis agrandie. →
   `resizeMethod="scale"` (pleine résolution) dans CreatureArt (toutes les
   créatures du jeu) et sur les 10 images du hub. Le banc (navigateur) ne le
   montre pas.
⚠️ Repères de sabotage mis à jour (ligne des Runes, ligne de l'image RETOUR) :
toute ligne visée par un sabotage qui change → repère à jour AVANT les suites.

**03/10 — Boutons du hub FLOUS : résolution trop faible (MESURÉ)** — écran de
l'auteur 2340 px : COMBAT 332 px affiché à 471 px (×1,4), titre 303 → 430
(×1,4), Changer 148 → 255 (×1,7) ; « + » et RETOUR nets (réduits). Les pièces
viennent d'une image Gemini de 1376 px : aucun réglage de code n'y ajoute du
détail → prompts 10-12 (une pièce PAR image, remplissant la largeur, même
conversation que la maquette). EN ATTENTE. RETOUR « un tout petit peu plus
gros » : [0.015, 0.022, 0.115, 0.080] (≈ 74 × 24 au format de l'auteur).
RÈGLE : avant d'intégrer une pièce, comparer sa largeur en px à sa largeur
AFFICHÉE en px physiques sur un grand téléphone (≈ 2,6 px par dp).

**03/10 — Pièces HD du hub installées (prompts 10-12)** : COMBAT 1144 px, titre
1180, Changer 1059 → affichées 467 / 465 / 304 px : RÉDUITES, nettes. Arrivées
dans l'ordre INVERSE (identifiées au contenu). Proportions réelles conservées
(HUB_RAPPORT_PIECE) : COMBAT à la hauteur de la maquette ; titre et Changer à
la LARGEUR de la maquette (à hauteur gardée, les 3 Changer se touchaient).
⚠️ Le titre et Changer HD ont CHANGÉ DE COULEURS (bois foncé, lettres dorées ;
maquette : titre clair à lettres brunes, Changer brun-rouge à lettres crème) →
prompts 13-14 facultatifs (couleurs exactes) proposés à l'auteur.


## 03/10 — Illustrations : Luxorbe et Fournax (11 / 26) + OUTIL d'intégration

Déposées par l'auteur dans design/a-integrer/creatures/{luxorbe,fournax}/
(p1-p3, 1024 × 1024 transparents, dessin 3-13 % du cadre). Luxorbe = renard
blanc à queues dorées (Lumière, commun) ; Fournax = golem-fournaise (Feu, peu
commun). Ordre des stades confirmé par la SURFACE (2,6/5,0/10,8 ; 3,1/6,7/12,5).
OUTIL `mobile/tools/integrer-creature.py <id>` (procédé du 19/09, MESURÉ sur
les 9 créatures en place) : ordre par surface ; recadrage puis cadre 512
CENTRÉ, plus grand côté 56 / 73 / 84 % (stades 0/1/2) ; compression palette
libimagequant (pip install imagequant) acceptée si écart VISIBLE (couleur ×
opacité) ≤ 3,0, cœur opaque intact (≤ 0,1 %), aucun pixel qui apparaît/
disparaît (α 0 ↔ ≥ 16) — le critère du 19/09 n'était PAS documenté, celui-ci
l'est (6 / 6 acceptées : 380 Ko au lieu de 1,2 Mo ; octree refusé : 4,0-4,7) ;
branchement dans CreatureArt ; `tools/generer-cadrage.py` (cadrageCreatures.js
régénéré : 11 créatures, 33 images). Contrôle **auditCadrageCreatures** (3
stades présents + cadrage pour chaque créature illustrée) + sabotage.
Feuille de route : section « 0. État des illustrations ». Banc : scène
`nouvelles-creatures.jsx` ; `exploration.jsx?nouvelles=1` (Luxorbe, Pyrosile,
Fournax sur les pilotis). Ménage : clé `aventure` en double dans
verifier-controles.js (ajoutée par moi le 03/10) retirée.


## 03/10 — Aventure : mesure de contrôle (l'auteur : « il me semble qu'on est bon »)

Vérifié dans le code : Griffes à la 1re victoire SEULEMENT (AdventureScreen
l. ~861 : gain si le niveau combattu = currentUnlockedLevel) ; packs de
Griffes contre pièces codés (morceau B du 26/09). ⚠️ J'avais proposé de les
« coder » en lisant trop vite A_FAIRE (section des décisions, faites dans la
section suivante) : TOUJOURS vérifier dans le code avant d'annoncer un manque.
Simulation (300 joueurs, option A : les 10 % les plus malchanceux ≈ 6/10) :
moyenne 8,0 à 8,9 / 10 ; 10 % malchanceux 6,3 / 5,1 / 4,1 / 4,6 / 6,4 / 6,8 ;
filet −20 % 6,16 fois par joueur à l'A2 ; 0 bloqué ; dans les limites
d'auditParcours. Décision : on n'y touche pas ; l'A2 à surveiller (tests réels).
NB : la colonne « retard » du simulateur compare le NUMÉRO du niveau
d'Aventure à la moyenne des niveaux des créatures (2 échelles) : ne pas s'en
servir comme « niveaux de retard ».


## 03/10 — Carte des niveaux : RETOUR commun + halo du niveau en cours

Retour de l'auteur sur ma liste : étoiles et cadenas EXISTENT déjà (mon banc
les cachait : ⚠️ le stub Ionicons du banc dessine « ● » pour TOUTE icône —
coche, cadenas… : ne jamais conclure à l'absence d'une icône sur le banc).
Fait : `PanneauRetour` (composant commun hub + carte : même panneau, taille
ramenée à la hauteur de l'écran, 74 × 24 au format de l'auteur ; dans la rangée
de l'en-tête de la carte, l'espaceur garde les compteurs à droite) ;
`HaloNiveauCourant` (lueur dorée qui respire derrière la pastille du niveau en
cours ; l'ombre `shadow…` de levelNodeCurrent ne s'affiche que sur iPhone).
Banc : `exploration.jsx?progression=1` (niveaux 1-3 gagnés, 4 en cours ; clé
adventure:state:v2 injectée).
Proposé ensuite : l'écran de COMBAT (attaques peu lisibles, mana invisible,
créature qui flotte, badge d'élément, abandon sans confirmation), puis
l'aperçu de niveau (panneau bleu uni hors style).


## 03/10 — Aperçu de niveau : maquette « Le médaillon » RETENUE (pièces attendues)

Maquette : design/a-integrer/06-aventure-apercu/concepts/1791046913494.jpg
(paysage). MESURES (fractions de la maquette, grille 2,5 %) : RETOUR 1,5-14 ×
1-8 (→ PanneauRetour commun) ; titre 35-65 × 8,5-17 ; grand médaillon
42,5-57 × 20,5-47,5 (rond) ; plaque adversaire 39,5-60,5 × 47-53,5 ; puissance
(texte vert/orange/rouge) ~55-59 ; 3 petits médaillons d'équipe 36-44,5 /
45,5-54,5 / 55-63,5 × 61-77 ; COMBATTRE 37,5-62 × 81-92 ; énergie 93-97 ;
en haut à droite : Éléments 69,5-80,5, Griffes 82-91,5, énergie 92,5-98 (× 3-9)
= l'en-tête de la CARTE, déjà là. Pièces demandées (prompts PROMPTS-PIECES.md) :
plaque SANS texte (aussi pour l'adversaire), médaillon VIDE (aussi pour
l'équipe), COMBATTRE. À FAIRE à l'arrivée : FighterSelectOverlay au nouveau
dessin, logique INCHANGÉE (onClose, onStart, « Deck vide », énergie à 0 :
📺 +1 et 💎, fiche au toucher d'une créature) ; 2-3 adversaires = 2-3
médaillons côte à côte ; fond : l'île du CHAPITRE floutée et assombrie (la
maquette montre le ponton du hub, car Gemini avait l'Exploration en image 3).


## 03/10 — Aperçu « Le médaillon » : PUBLIÉ (branche `apercu-medaillon` fusionnée)

Aperçu de niveau « Le médaillon » ÉCRIT sur la branche (FighterSelectOverlay :
fond = île du chapitre floutée, PanneauRetour, composant `Medaillon` (anneau
doré de Gemini + disque de bois taillé dans son cartouche, créature zoomée et
découpée en rond, œuf si vide), titre et plaque de l'adversaire (taille du nom
selon sa longueur), puissance colorée, 3 médaillons d'équipe (fiche au
toucher), COMBATTRE doré (bouton du hub, texte effacé, réécrit par le code ;
DECK VIDE / PLUS D'ÉNERGIE ; 📺 +1 et 💎 à sa droite à énergie nulle), énergie ;
bloc centré verticalement sur les écrans hauts). Les pièces reçues ne collaient
pas à la maquette (cartouche haut, anneau sans disque, COMBATTRE foncé) ;
effacer « EXPLORATION » de la planche a échoué (bordure intérieure détruite).
FAIT : plaque du titre (prompt 4 : planche fine à bouts pointus, 1300 px, étirée
aux proportions de la maquette) sous le titre ET le nom de l'adversaire.
⚠️ PIÈGE : une marge en POURCENTAGE (`paddingHorizontal: '9%'`) se rapporte au
PARENT (ici l'écran : 80 pts) → titre tronqué « Cha… », nom invisible ; marges
en POINTS calculées sur la plaque. Titre et nom : taille selon leur LONGUEUR
(« Chapitre 12 · Niveau 10 » tient aussi). Vérifié : 891×411, 731×411,
tablette ; médaillon d'équipe → fiche ; textes entiers.

**03/10 — Aperçu : titre et nom de l'adversaire « pas centrés »** (retour de
l'auteur, invisible au banc) : sur Android, un <Text> d'une ligne
(numberOfLines) prend toute la largeur de son conteneur et s'aligne à GAUCHE
par défaut ; le navigateur le resserre au centre. → textAlign: 'center' +
alignSelf: 'stretch' EXPLICITES (apercuTitre, apercuNom). RÈGLE : tout texte
centré dans un cadre porte textAlign: 'center' (ne pas compter sur alignItems).

⚠️ **03/10 — Textes des planches décalés à DROITE sur Android** (capture de
l'auteur, invisible au banc) : le cadre avait une marge intérieure ; l'image
absolue en width '100%' posée dedans prend, sur Android, la largeur SANS la
marge tout en restant calée à gauche → image décalée d'une marge vers la
gauche, texte centré dans le cadre → texte « à droite » (12 et 18 pts mesurés
= les marges). RÈGLE : JAMAIS de marge intérieure sur un conteneur qui porte une
image absolue « pleine » ; mettre la marge sur le TEXTE (marginHorizontal).
COMBATTRE : texte centré à 55 % du bouton et plus petit (mesuré sur la maquette).


## 03/10 — Combat : maquette « Le bandeau de combat » RETENUE (pièces attendues)

Maquette : design/a-integrer/07-combat/concepts/1791102918928.jpg (paysage).
MESURES (fractions, grille 2,5 %) : bandeau 2-98,5 × 0-15 ; panneaux joueur
4-14,5 / 15,5-26 / 27-37,5 × 3-14 ; message de tour 40-60 × 4-9 ; panneaux
adversaires 63-74 / 74,5-85 / 86-97 × 3-14 (badge d'élément rond à leur gauche,
63-66 × 2-7) ; créatures du joueur au sol à gauche (devant : 13-26 × 50-71,
derrière : 27-33 et 36-42 × 44-60), adversaire 67-73 × 52-64 ; dégâts « -4 »
67-72 × 39-46 ; carte NORMAL 24-49,5 × 79-96,5 (onglet 31-43 × 77-82) ; carte
SPÉCIAL 51-75,5 × 79-96,5 (onglet 57-69) ; Recharge 77-85,5 × 82-96.
Écarts voulus : HEALTH / ELEMENT (anglais) retirés ; « ✕ » ajouté (Gemini l'a
oublié), style médaillon ; noms réels. Pièces demandées : bandeau vide,
panneau vide (×6), carte bois vide (NORMAL et SPÉCIAL dispo), carte pierre
grise vide + cadenas (SPÉCIAL sans mana), bouton Recharge. Décor : le pré actuel.


## 03/10 — Combat « Le bandeau de combat » PUBLIÉ (+ bug du défi de taps)

Pièces reçues (ordre INVERSE ; Gemini a ajouté des éléments non demandés dans
3 images : bandeau rempli, petit Recharge) → découpées par ÉLÉMENT ; panneau =
grand cadre à onglet (pas le petit panneau) ; carte pierre = contour seul.
Assemblage : élargies aux proportions de la maquette en 9 MORCEAUX (coins
gardés, onglet recollé à sa taille) ; intérieur de la pierre = bois de la carte
passé en gris ; intérieur du panneau = bois. assets/combat/{bandeau, panneau,
carte-bois, carte-pierre, recharge}.png. Étiquettes NORMAL / SORT / SPÉCIAL sur
la planche de l'aperçu (les onglets Gemini sont trop fins pour du texte).
CombatScreen : renderSprite({ sansJauges }) → noms, vie, mana et pastille
d'affinité passent dans le BANDEAU (panneaux : nom, vie CHIFFRÉE, mana ;
actif/cible en lueur ; badge d'élément cerclé de la couleur d'affinité,
emoji clair (🌙 pour les Ténèbres : 🌑 invisible) ; toucher un panneau
adversaire = chooseTarget). Message de tour au centre du bandeau. Places du
terrain (PLAYER/OPPONENT_SLOTS) reprises de la maquette, sous le bandeau. « ✕ »
en médaillon (confirmQuit existait déjà), badges et barre du Gardien sous le
bandeau. Cartes : bois si jouable, pierre grise sinon ; NORMAL d'abord.
⚠️ BUG ANCIEN CORRIGÉ : pendant le défi de taps, l'anneau du compteur (plan 10)
était AU-DESSUS de la zone qui compte (tapEverywhere, plan 8) et AVALAIT les
taps posés au centre (0 compté sur 30 au banc). → anneau + titre + chrono en
pointerEvents 'none' (style) ; bandeau 'none' pendant le défi ; panneaux sans
action jamais capteurs. Contrôle **auditDefiTapsLibre** + sabotage. Vérifié :
20 taps sur l'anneau = 20 comptés ; 30 taps → Ombrillon 35 → 25.
⚠️ BANC : en CSS, un enfant en pointer-events:auto capte même sous un parent
en none (le navigateur garde la barre de vie captrice) ; sur téléphone, 'none'
s'applique à tout le sous-arbre. NB verifier-controles : F.combat = la LOGIQUE
(combatLogic.js) ; l'ÉCRAN = F.combatEcran.


## 03/10 — JAUGE DE FRAPPE : PUBLIÉE (branche `jauge-frappe` fusionnée)

Décision de l'auteur : remplacer le défi de taps du combat (25 taps commune →
9 mythique en 12 s, ×2,5 sous 4 s ; équilibrage calé sur son autoclicker =
toujours ×2,5) par une JAUGE : aiguille aller-retour 1,1 s, UN tap, zone
« parfait » ×2,5 (largeur par rareté : 12/14/16/19/22/26 %, + Dextérité / sort
Vitesse), « bien » ×1,8 (±8 %), raté ×1, pas de tap en 6 s ×0,5. Étapes
validées par l'auteur : 1) jauge pour tous ; 2) personnalité par élément
(réglages de la même jauge) ; 3) spéciaux « signature » par élément.
FAIT sur la branche : moteur (largeurZoneParfait, positionAiguille,
resultatJauge, multiplicateurJauge, multJaugeMoyen / multJaugeTire —
simulations : erreur de timing ~ normale, référence 60 ms ; degatsDuJoueur
prend le multiplicateur), écran (JaugeFrappe dessinée par la même formule,
tap au DÉBUT du toucher : onResponderGrant ; verdict PARFAIT/BIEN/RATÉ/TROP
TARD), textes (sort Vitesse, Rune de Dextérité), auditJaugeFrappe + 2
sabotages, empreinte du Gardien (6d37904e, auditGardienCalibre vert),
Aventure RECALCULÉE par calibrer-parcours (ennemis −1,9 %, conseillée −3,2 %).
Testé au banc : parfait −17, raté −4, trop tard −2 (×2,5 / ×1 / ×0,5).
BLOQUANT : auditPuissanceExacte, cas réel de l'auteur (niveau 16, Bouldog 34
+ Ventis 13 = 2 COMMUNES, gagné à 100 % à l'autoclicker) : simulé 64 %
(parfait à chaque coup), 58 % (40 ms), 43 % (60 ms), 18 % (90 ms) → la
jauge pénalise fortement un joueur moyen avec des communes. DÉCISION
attendue de l'auteur : sévérité (zones plus larges / « bien » plus payant)
avant de fusionner.

**03/10 — Jauge PUBLIÉE, réglage « références »** (question de l'auteur : « il
existe un code open source ? ») : la barre d'adresse existe en open source
(qb-skillbar, ox_lib — mods GTA RP, JavaScript ; rien pour React Native) ; le
code fait ~50 lignes ; le vrai travail = les CHIFFRES, ancrés sur des
références : « Perfect » ±55-65 ms, « Good » ±280-330 ms volontairement
indulgent (jeux de rythme). → « parfait » inchangé (commune ±66 ms), « bien »
±280 ms (JAUGE_MARGE_BIEN 0.255) payé ×2,0. Commune, joueur moyen (90 ms) :
91 % du coup max, quasi aucun raté (avant : 84 %, 9 % de ratés).
Aventure RECALCULÉE (calibrer-parcours, 80 joueurs × 10 essais). 300 joueurs :
A0 9,1/7,1 · A1 8,5/5,6 · A2 9,0/6,4 · A3 9,0/6,1 · A4 8,7/6,4 · A5 8,6/6,9 ;
0 bloqué ; filet moins sollicité. DÉCISION de l'auteur (« publie ») : garder les
malchanceux à 6/10 → moyenne ~9 → alarme « trop facile » d'auditParcours 9,2 →
9,5, et 60 joueurs (30 échouait AU HASARD près des bornes).
⏸️ auditPuissanceExacte : cas du niveau 16 (« 100 % réel », mesuré à
l'autoclicker sous l'ancien défi) EN ATTENTE — À RE-MESURER par l'auteur avec la
jauge. Il était le SEUL piège de l'ancienne formule brute → contrôle devenu
AVEUGLE → remplacé par un piège indépendant : « chiffre ≥ conseillée ⇔ vert »
sur l'échantillon (prouvé : sous sabotage, niveau 112 « 1071 / 994 » orange).
Banc : parfait −10, bien −9, trop tard −3. 80 contrôles verts, 102 sabotages.
LEÇON : mettre un cas en attente peut rendre un contrôle AVEUGLE — toujours
relancer verifier-controles et remplacer le piège perdu.

**03/10 — Jauge : « parfait » DIVISÉ PAR 2** (test de l'auteur : « la vitesse est
bonne mais trop facile, je l'ai à tous les coups »). JAUGE_LARGEUR_PARFAIT
commun 0.06 (±33 ms, le « Perfect » des jeux de rythme exigeants) → mythique
0.13 ; « bien » inchangé (±280 ms, ×2,0). Très précis (30 ms) : 73 % de parfaits
en commune, 86 % en rare, 96-98 % en légendaire/mythique (avantage voulu de la
rareté) ; référence (60 ms) ×2,21 en commune ; moyen (90 ms) ≥ ×2,14.
auditJaugeFrappe : plancher « commune jouable » ×2,2 → ×2,1 (mon seuil).
Aventure RECALCULÉE à 150 joueurs × 10 essais : à 80, l'estimation des 10 %
malchanceux reposait sur 8 joueurs et creusait l'A3 à 3,8/10 (simulateur
DÉTERMINISTE : creux réel de la table, pas du bruit de mesure). Résultat
300 joueurs : A0 9,1/6,9 · A1 8,9/5,9 · A2 9,0/6,6 · A3 9,1/6,5 · A4 8,7/7,1 ·
A5 8,5/7,2 ; 0 bloqué. RÈGLE : calibrer-parcours avec ≥ 150 joueurs.
Sabotage d'auditApprentissage PÉRIMÉ (repère exact « 0.39, 0.61, 0.62 » =
valeurs de la table, changées par le calibrage) → réécrit par MOTIF (3e valeur
×5, quelle qu'elle soit). RÈGLE : un sabotage qui vise une TABLE CALCULÉE se
fait par motif, jamais par valeur exacte. 80 contrôles verts, 102 sabotages.

**03/10 — Jauge HABILLÉE** (l'auteur : « on est bien là », veut un meilleur design
Gemini ou réutiliser l'existant) : RÉUTILISÉ la planche de l'aperçu
(exploration/plaque-titre.png) comme CADRE (étirée 6,7:1) ; aiguille et zones
dans le SILLON intérieur (inset 8,5 % × 27 %) qui vaut 0 → 1 (même fraction que
le verdict : seule la largeur de référence change) ; « bien » ambre,
« parfait » or + reflet, lueur dorée DERRIÈRE le sillon (déborde sur le cadre),
aiguille dorée à tête en losange. Aucune nouvelle pièce Gemini nécessaire.


## 03/10 — EFFETS DE COMBAT, étape 1 : l'IMPACT (publié)

Inventaire avant : élan d'attaque (avec temps d'arrêt de 160 ms, 12/09) et
chiffres flottants rouges ; RIEN d'autre (lottie-react-native installé le 03/09
mais JAMAIS utilisé, compatibilité Expo Go 57 jamais vérifiée, style plat ≠
peint → écarté). Ajouté (CombatScreen) : à l'instant où l'élan TOUCHE
(IMPACT_MS 270 = 160 de recul + 110 de détente ; avant, chiffres affichés au
DÉPART de l'élan) : éclat BLANC de la silhouette (CreatureArt teintée,
seulement si illustrée), anneau + étincelles (Impact, couche coucheImpacts),
secousse de tout l'écran (racine en Animated.View), vibration, chiffres selon
le verdict (STYLE_COUP : PARFAIT doré 32 qui jaillit, BIEN blanc, RATÉ gris,
riposte rouge-orange 180 ms après). Moteur NATIF sur téléphone, JS au banc (ND).
CORRECTIF : quand l'adversaire frappait le premier, une 2e ligne remettait un
NOMBRE au lieu de { amount, index } → le chiffre sur ta créature ne
s'affichait jamais. expo-haptics ~57.0.1 ajouté (version LUE dans
expo@57.0.9/bundledNativeModules.json ; lock : seul expo-haptics 57.0.3 ajouté,
rien d'autre ne bouge → npm ci) ; API vérifiée (impactAsync, ImpactFeedbackStyle).
⚠️ Chargé PROTÉGÉ (auditModulesNatifsProteges l'a exigé) : même motif que
sonsBoutique (requireOptionalNativeModule('ExpoHaptics') puis
« natif ? require('expo-haptics') : null ») — l'appli construite peut ne pas
l'embarquer. Banc : doublure expo-haptics qui NOTE les vibrations
(window.__vibrations) ; requireOptionalNativeModule y répond « présent » pour
ExpoHaptics seulement. Empreinte du Gardien : cec6444e (affichage seul).
Contrôle auditEffetsCombat + sabotage. Testé : PARFAIT → « heavy » puis riposte
« light » ; éclat, anneau, étincelles, « -10 » doré. 81 contrôles, 103 sabotages.
ÉTAPE 2 (images reçues : design/a-integrer/07-combat/effets/A et B, fond NOIR) :
effets par élément — lumière → transparence (alpha = luminosité), animés par le code.


## 03/10 — Combat : la riposte À VUE, le coup final visible, élan plus long (publié)

Retours de l'auteur : on ne voyait pas l'attaque des ennemis ; la dernière
attaque n'apparaissait pas (écran de fin immédiat) ; élan trop court.
Cause : finishChallenge calculait ton coup ET la riposte au même instant, puis
passait AUSSITÔT à 'choosing' ou 'done' (choix du 02/09 : pas de minuteur,
après le blocage du 01/09, 7e43465). Fait :
- élan VERS la cible (62 % du chemin, dx/dy dans l'état `lunge`, détente 150 ms,
  IMPACT_MS 310) ; ta créature puis l'ADVERSAIRE (riposte à RIPOSTE_MS 950,
  quand ton élan est revenu ; ses dégâts et effets à SON impact) ;
- SUITE calculée puis appliquée APRÈS les animations : phase 'resolving',
  transitionRef + appliquerTransition (UNE seule fois), minuteur posé/nettoyé
  par un useEffect, ET toucher de DÉBLOCAGE après la durée prévue (ignoré
  pendant l'animation) — ce qui manquait le 01/09. Coup final : +700 ms.
  Contrôle auditTransitionCombat + sabotage (toucher retiré).
- ⚠️ BUG TROUVÉ AU MOUCHARD : la riposte s'arrêtait 41 ms après son départ.
  Les élans partagent `lungeAnim` ; quand la créature précédente cesse d'être
  « en élan », sa transformation se DÉTACHE ; sans autre attache, Animated
  ARRÊTE l'animation en cours (celle de l'élan suivant, lancée juste avant) ;
  sa fin effaçait l'élan. → l'animation démarre dans un useEffect APRÈS la mise
  à jour de l'écran ; chaque élan a son NUMÉRO (une fin n'efface que le sien).
  RÈGLE : ne jamais démarrer une animation sur une valeur partagée AVANT le
  rendu qui change ses attaches.
Testé au banc : victoire en 3 tours, fin 1,65 s après le dernier tap ; défaite
(chapitre 3) en 10 tours, fin 2,56 s après ; aucun blocage ; capture : l'ennemi
bondit jusqu'à ta créature. Empreinte du Gardien 72f5fa26 (déroulé seul ;
calibrage vert). 82 contrôles, 104 sabotages.


## 03/10 — Combat : riposte À TOUR DE RÔLE, PV retirés À L'IMPACT, effets d'ÉLÉMENT (publié)

Retours de l'auteur : plus d'effets ; élan encore un peu plus long ; dégâts
retirés AVANT l'animation ; seul l'adversaire visé ripostait.
- Élan : 75 % du chemin (avant 62 %).
- Effets d'ÉLÉMENT (étape 2) : 8 images Gemini sur fond NOIR (fichiers A/B
  arrivés INVERSÉS → renommés), lumière → transparence (alpha = max(R,G,B),
  couleur restituée), 360 px, libimagequant : 356 Ko au total
  (assets/combat/effets/{feu,eau,terre,air,foudre,lumiere,tenebres,magie}.png).
  À l'impact, l'effet de l'élément de l'ATTAQUANT grossit, tourne et s'efface
  (×2,1 en PARFAIT) ; ÉCLAIR blanc plein écran en PARFAIT (EclairEcran).
- PV AFFICHÉS GELÉS jusqu'à l'impact (pvGeles / pvAffiche) : ⚠️ les réfs
  (fightersRef, opponentsRef…) sont recopiées de l'état à CHAQUE rendu — retarder
  l'ÉTAT les aurait faussées. Logique et état immédiats ; seul l'affichage garde
  l'ancienne valeur ('o2', 'p0'…) ; dégel à l'impact ; la suite dégèle tout.
  Mesuré au banc : 28/28 à 91 ms, 18/28 après l'impact.
- RIPOSTE À TOUR DE RÔLE : choisirRiposteur(adversaires, cible, rang) (0,1,2,0…,
  saute les K.O. ; sans rang = ancienne règle) — écran (riposteRangRef, aussi
  au 1er coup adverse) ET simulerCombat (rangRiposte). MESURÉ : l'Aventure
  devenait plus dure (A5 8,5 → 7,2 de moyenne ; malchanceux sous 6) → RECALCULÉE
  (150 × 10) : A0 9,2/7,1 · A1 9,1/6,9 · A2 9,1/7,2 · A3 8,8/5,6 · A4 8,7/6,6 ·
  A5 8,6/7,1 ; 0 bloqué. Empreinte du Gardien f477fc07 (calibrage vert).
  Contrôle auditRiposteTourDeRole + sabotage. 83 contrôles, 105 sabotages.


## 03/10 — EFFETS DE COMBAT, étape 3 : sorts, spécial, K.O. (publié)

EffetSort (SORT_VISUEL, 12 types) joué sur la bonne créature : bouclier (bulle
bleue + « +X »), soin (étincelles vertes + « +X »), boost / vitesse /
provocation (anneaux), pacte (gouttes), poison (bulles), marque (viseur),
exécution (taillade), zone (onde + effet d'élément sur CHAQUE ennemi touché),
spécial (AssombrirEcran + onde dorée + secousse 14 + vibration forte), K.O.
(« K.O. » + poussière, sur toute créature tombée sous un coup, une riposte ou
le 1er coup adverse). Sources : evenements de lancerSort (bouclier, soin,
boost : cible + valeur) ; les autres par l'id du sort. Soutien joué au
LANCEMENT (~200 ms), offensifs à l'IMPACT. CORRECTIF : un sort SANS coup
(part 0 : soin, bouclier…) ne fait plus bondir la créature vers l'ennemi.
EffetSort EXPORTÉ pour la scène de banc tools/capture/scenes/effets-sorts.jsx
(les 12 visuels en pleine animation). Banc : K.O. final (flammes de Fournax,
« -17 », « K.O. »). auditEffetsCombat étendu (sorts, assombrissement, éclair
transparents au toucher). Empreinte du Gardien 67e439ef. 83 contrôles, 105 sabotages.


## 03/10 — Rune de Dextérité → RUNE D'ARCANE (publié)

Choix de l'auteur parmi 3 (Arcane, Vampirisme, Épines — les 2 autres GARDÉES
pour les prochaines mises à jour, A_FAIRE). RUNE_BONUS_TABLE.arcane =
[1, 1, 2, 2, 3] points de mana au DÉPART (runeBonuses → stats.manaDepart) ;
manaDeDepart(stats) = min(MANA_MAX, MANA_DEPART + manaDepart), PARTAGÉ :
CombatScreen (créatures du joueur) ET simulerCombat. Plus aucune trace du type
« dexterite » ; migrateRunes : tout type disparu (endurance 11/09, dexterite
03/10) devient une ARCANE du même niveau (testé au banc : une Dextérité niv. 3
s'affiche « Rune d'Arcane · Niveau 3 / 5 · +2 mana au départ »). Icône : la
pierre violette aux cercles dorés (copiée en arcane.png), couleur #b98cff.
Simulateur de parcours : les runes y sont achetées mais SANS effet en combat →
calibrage inchangé. Contrôle auditRuneArcane + sabotage. Banc :
exploration.jsx?runes=1 (sauvegarde avec une ancienne Dextérité).
⚠️ LEÇON : un heredoc Python avec une ERREUR DE SYNTAXE n'exécute RIEN (même les
écritures du début) — toujours vérifier la sortie du script avant de passer à la suite.

**03/10 — Icône dédiée de la Rune d'Arcane installée** (Gemini : pierre violette, cristal
de mana doré). Déposée dans 11-runes-et-forge/actuel/ (l'auteur était dans le
sous-dossier). Détourage PRUDENT : la pierre est VIOLETTE (proche du magenta) →
nettoyage limité au liseré extérieur (4 px) et au VRAI magenta (R, B > 165, G < 125),
jamais le critère « min(R,B) − G » qui aurait rongé le violet. 189 × 256 (comme
les autres). RÈGLE : pièce violette ou rose → nettoyage restreint au vrai magenta.


## 05/10 — Écran de FIN DE COMBAT « Le médaillon du héros » (publié)

Concept A choisi (victoire concepts/1791176466040.jpg, défaite 1791177173743.jpg).
⚠️ Le travail avait été écrit par une tentative PRÉCÉDENTE de cette conversation,
qui a PLANTÉ avant d'enregistrer (verrou « R-fin-de-combat#6b45 » laissé pris,
CombatScreen modifié, assets/combat/fin/ non suivis). Repris tel quel (verrou
repris avec SA PROPRE étiquette), vérifié : noms non définis (analyse Babel),
styles, images → aucun manque ; banc victoire + défaite sans erreur.
RÈGLE : à la reprise, `git status` + verrou AVANT tout — un travail non
enregistré peut être le sien (tentative plantée), ne jamais l'écraser.
Contenu : herosFin (créature au plus de dégâts : perFighterDamage), FIN_IMG
(étoile, lauriers — pièces Gemini, ordre INVERSÉ à l'arrivée —, bouton-bois,
bouton doré = bouton-combattre-vierge AVEC son emblème d'épées, or bronzé maison :
l'or jaune de la maquette n'est qu'une interprétation de Gemini), FIN_V / FIN_D
(mesures), PieceTexte, BoutonFin, RecapPlaque, EtoileFin (grises si non gagnées),
MedaillonHeros (terne en défaite). Contrôle auditEcranFin (aucune action perdue,
props passées) + sabotage ; motifs : un texte avec ${…} → [\s\S]{0,140}?, pas [^}]*.
85 contrôles verts, 107 sabotages.

**05/10 — Victoire PLUS COLORÉE** (l'auteur : « étoiles plus jaunes et qui brillent ;
plus coloré, les joueurs aiment ça » ; la défaite est BIEN, inchangée).
Étoile ravivée (teinte, saturation, luminosité des pixels dorés ; ombrage gardé)
→ jaune franc ; bouton-dore-vif.png (face dorée claire SEULE ravivée, pondérée par la
luminosité : le bois de l'emblème garde son brun — un 1er essai sans pondération
l'avait rendu vert olive). EtoileFin : lueur qui PULSE (×2,7) + scintillement ✦
décalé par étoile (boucles arrêtées au démontage). MedaillonHeros : soleil de rayons
(effet « Lumière ») qui tourne en 22 s derrière (victoire). Confettis multicolores
(46, chute régulière 3,2-5 s) : couche ET pièces transparentes au toucher
(testé : « Retour à la carte » touché en pleine chute → écran quitté). Plus de
voile en victoire ; titre jaune vif ; récapitulatif or / rose-rouge / bleu clair.
auditEcranFin étendu (confettis) + sabotage. 85 contrôles, 108 sabotages.


## 05/10 — BUG : RETOUR de l'aperçu de niveau ne marchait pas (corrigé, publié)

Vu par l'auteur. Reproduit au banc (document.elementFromPoint au centre de
RETOUR → la barre de la CARTE, 891 × 38, zIndex 20). CAUSE : mapHeader est en
zIndex 20 depuis le 13/09 (271ca21, barre flottante) ; l'aperçu « Le médaillon »
(03/10, d978d66) a mis RETOUR en haut à gauche, mais sa racine apercuRacine
était en zIndex 15 → la barre, invisible derrière le fond opaque de l'aperçu,
AVALAIT les touchers du haut de l'écran. Mon test du 03/10 n'avait pas touché
RETOUR. CORRECTIF : apercuRacine zIndex 30. Seule fenêtre concernée
(elemHelpBackdrop déjà à 40). Contrôle auditApercuAuDessus (aperçu > barre) +
sabotage. RÈGLE : toute fenêtre posée sur la carte → zIndex > mapHeader ; et
TOUCHER chaque bouton d'un écran neuf au banc (elementFromPoint), pas seulement
le regarder. 86 contrôles, 109 sabotages.

**05/10 — Nouveau FOND de la VICTOIRE** (l'auteur : « plus joyeux, qui donne envie de
gagner » ; l'ancien = la carte en automne) : vallée de printemps en fête (Gemini :
arc-en-ciel, fanions, fleurs, château, centre dégagé) → assets/combat/fin/fond-victoire.jpg
(1376 × 768, 153 Ko), FIN_IMG.fondVictoire, ImageBackground en VICTOIRE seulement
(resizeMethod « scale ») ; la défaite garde VICTORY_BG + voile froid (validée).


## 06/10 — Mail « run failed » : le site GitHub PAGES, pas la publication de l'appli

Vérifié par l'API GitHub (api.github.com/…/actions/runs, /jobs, /check-runs/…/annotations,
ACCESSIBLES depuis le bac à sable avec le jeton, contrairement aux journaux complets) :
toutes les exécutions de « Publier l'appli mobile (EAS Update) » ont RÉUSSI ; l'échec
du 05/10 à 19:51 est « pages build and deployment » sur un envoi de fichiers : « The
job was not acquired by Runner of type hosted even after multiple attempts » = panne
passagère de GitHub (aucune machine) ; l'exécution suivante a réussi. Rien à corriger.
Avertissement relevé dans les annotations : « ubuntu-latest » → Ubuntu 26 le
19/10/2026 → les 2 robots (mobile-publish, build-apk) FIGÉS sur ubuntu-24.04
(leur système actuel ; même règle qu'eas-cli figé le 18/09).
RÈGLE : un mail d'échec → lister les exécutions par l'API AVANT tout diagnostic
(quel robot ? quel commit ? quelle étape ? annotations).


## 06/10 — Fiche créature : pièces découpées (non branchées encore)

Concept A (élément discret, concepts/1791226761508.jpg). Pièces (ordre INVERSÉ à
l'arrivée) → mobile/assets/fiche/ : socles/{feu,eau,terre,air,foudre,lumiere,
tenebres,magie}.png (grille 4 × 2 : plus grande composante par case, noms anglais
retirés), tuile.png, onglet.png, cadre.png.
⚠️ CADRE : Gemini « embellissait » le cadre ; prompt de RETOUCHE (« garde ce cadre,
efface le reste ») → forme juste MAIS or tirant au rose (G −17) et mise en page
légèrement déplacée (12 % de recouvrement : pas superposable). Le détourage magenta
d'un cadre FIN rosit tout (presque tous ses pixels sont des bords). SOLUTION : cadre
découpé dans la MAQUETTE D'ORIGINE (fond = forêt sombre dehors, bleu pâle dedans,
aucun magenta) : côtés = colonnes/lignes portant un trait doré CONTINU (≥ 60 % du
plus long ; les bords des tuiles, courts, ne comptent pas), bande de 26 px,
transparence = score « doré » (R+G)/2 − B. RÈGLES : (1) pièce fine → découper dans
la maquette si son entourage n'a pas sa couleur ; (2) bords rosés OPAQUES → les
reprendre aussi (bande 2,5 px) ; (3) lueurs semi-transparentes LÉGITIMES (socles
Magie, Ténèbres) → seul le VRAI magenta du bord ; (4) volutes semi-transparentes
peintes SUR le magenta (socle Air) → retirer la composante magenta (G = (R+B)/2).


## 06/10 — FICHE CRÉATURE « à la Clash of Clans » (publié)

CreatureDetailScreen RÉÉCRIT (AdventureScreen) d'après la maquette A (élément
discret) : FICHE (mesures en fractions, placement R() accroché aux bords comme le
hub), FICHE_IMG (cadre de la maquette, tuile et onglet en 3 TRANCHES — bouts mis à
l'échelle par la hauteur, milieu étiré : la maquette est plus trapue que les pièces
Gemini —, médaillon + lauriers, bouton or vif, 8 socles). En-tête : Griffes, titre
(badge de rareté, nom du stade, « Niveau N », étoiles d'évolution), barre « N /
palier », croix. Gauche : fond bleu pâle RENTRÉ de 2,5 % (sinon il dépassait de la
baguette), lueur douce (HUB_IMG.lueur), SOCLE de l'élément (largeur de la maquette,
aplati à 1,75 : 1 car les socles Gemini sont plus épais), créature dont le BAS du
cadrage (CADRAGE_CREATURES) se pose sur le plateau (30 % du socle). Onglets : Stats
(Vie et Attaque avec bonus des runes et barre vers le palier, Rôle, Élément, Fort /
Faible contre via elementMultiplier), Attaques (competencesAvecSort, ordre du combat
: normal, sort avec coût en mana, spécial), Runes (3 emplacements : toucher = retirer
ou ouvrir RunePickerOverlay). Bas : note du palier, histoire, MedaillonNiveau (sa
PROPRE pulsation : PulsingButton grossit depuis son coin), bouton ÉVOLUER si éligible.
Aucune action perdue (testé au banc : onglets, équiper / retirer une rune, niveau 3 → 4
avec 2 Griffes, croix → hub). Polices : adjustsFontSizeToFit ne marche PAS au banc
(web) → tailles réduites pour tenir partout. Contrôle auditFicheCreature + sabotage.
87 contrôles, 110 sabotages. Reste : l'écran « Changer » (choix d'équipe) à restyler.


## 06/10 — Menus des créatures et page des Griffes (publié)

Demandes de l'auteur. (1) « CHANGER » = DeckPicker.js, UN composant utilisé en
PORTRAIT (DECK de la Collection, ClickerScreen) et en PAYSAGE (hub de l'Exploration) :
refait avec les pièces de la fiche (planche de titre, croix dorée, cartes = créature
sur le SOCLE de son élément dans le cadre doré, la créature ACTUELLE entourée d'or,
celles « déjà en jeu » estompées, onglet « Vider cet emplacement ») ; 3 colonnes en
portrait, 6 en paysage (useWindowDimensions) ; zIndex 50. (2) COLLECTION → NOUVELLE
FICHE : un seul aiguillage dans ClickerScreen (effet : view 'collection' + créature
choisie → ficheAventure + view 'adventure') ; AdventureScreen reçoit ficheInitiale
(detailCreatureId de départ) et onFermerFicheInitiale (la croix ramène à la
Collection) ; l'Exploration bascule seule en paysage puis en portrait. Sert aussi
après une INVOCATION. L'ancienne fiche verticale (CreatureDetail : attaques + histoire,
aucune action) n'est plus affichée. Piège évité : dépendances de l'effet SANS
`owned` (déclaré plus bas → lu avant déclaration) → réf ownedPourFicheRef.
(3) PAGE « OBTENIR DES GRIFFES » (BoutiqueGriffes) à la place de la boîte de dialogue
du système : 2 cartes (pack en pièces, taille selon l'Ascension ; pack en Diamants),
achats qui renvoient vrai / faux (message dans la page). Posée sur les 4 branches
de l'Exploration (fiche, carte des chapitres — dont combat et défaite —, runes, hub)
par une enveloppe PERMANENTE avecBoutique (si elle n'apparaissait qu'à l'ouverture,
l'écran dessous serait RECRÉÉ : combat perdu). « + » ajouté sur la fiche. Pas de
<Modal> (aucune dans le projet ; sur iPhone elle repasse en portrait sans réglage).
Banc : menu.jsx?toutes=1 (clé de dev unlockAll). Testés : Changer (2 sens, choisir
ferme), Collection → fiche Pyrosile → croix → Collection, page des Griffes (2 achats :
messages « Pas assez… », croix). Sabotage « point 5 » d'auditDefaite PÉRIMÉ (il visait
l'ancienne boîte de dialogue, indentée de 12 espaces) → recalé sur le nouvel achat.
Contrôle auditMenusCreatures + sabotage. 88 contrôles, 111 sabotages.


## 06/10 — Inventaire du design + PRIORITÉ 1 : fenêtres maison (publié)

INVENTAIRE (demande de l'auteur, design à 100 % hors illustrations des créatures) :
déjà au nouveau style = menu, boutique, calendrier, Collection, paramètres, quêtes
(ProgresScreen), incubateur, grimoire, défis ; hub, aperçu, combat, fins de combat,
fiche, Changer, page des Griffes, Runes (boutique, forge, inventaire). RESTE (priorité
2) : la CARTE DES CHAPITRES — ronds noirs des niveaux (médaillons de pierre) et
pastilles du haut (Éléments, Griffes, énergie) → 1 ou 2 pièces Gemini.
FAIT (priorité 1, pièces existantes) : src/components/FenetreJeu.js (corps = carte de
bois au liseré d'or ou panneau du bandeau de combat, image dimensionnée par onLayout —
jamais absoluteFill —, planche de titre à cheval, taille du titre selon sa LONGUEUR,
croix dorée, BoutonBois = onglet en 3 tranches) ; src/components/DialogueJeu.js
(afficherDialogue(titre, message, boutons) = même usage qu'Alert.alert, HÔTE unique
<HoteDialogue /> à la racine d'App.js, REPLI sur Alert sans hôte). Remplacés : « Quitter
le combat ? », « Diamants insuffisants » et « Énergie pleine » (énergie), « 🌟 Ascension
requise », « 🧪 Élixir de faiblesse » (+ son résultat), « Aucun œuf en incubation » ;
« 🐾 +X Griffes » → son texte (« de quoi monter X de N niveaux ») s'affiche DANS la page
des Griffes (messageGriffesRef ; les lignes « annoncerGriffes(GRIFFES_PACK); return true; »
gardées pour le sabotage du point 5). Aide des éléments (cycle en pastilles) et choix d'une
rune (avec l'EFFET de chaque rune) dans la fenêtre maison. Ligne de DIAGNOSTIC du combat
(12/09) retirée. RESTENT natives : réglages rares des Options, et les 2 alertes de SÉCURITÉ
(« Tu sembles bloqué », « erreur ») — doivent marcher interface cassée. Banc : l'hôte est
ajouté aux scènes exploration, menu, boutique (elles n'ont pas App.js). Contrôle
auditDialoguesJeu + sabotage (hôte retiré). 89 contrôles, 112 sabotages.


## 06/10 — BUG : les achats de la page des Griffes ne marchaient pas (corrigé, publié)

Vu par l'auteur (« bouton ne marche pas »). Au banc, les tuiles de prix réagissaient (le
navigateur respecte pointer-events:none sur une <img>). CAUSE : dans chaque carte, le cadre
doré était dessiné APRÈS (donc par-dessus) la tuile de prix, avec un style pointerEvents
'none' sur l'<Image> → sur le TÉLÉPHONE, ce style n'est pas fiable sur une Image : le cadre
recevait le toucher et le remontait à la carte (ses parents), jamais à la tuile (sa sœur).
CORRECTIF : cadre dessiné AVANT la tuile, enveloppé dans une <View> au style pointerEvents
'none'. Les 19 autres Images à pointerEvents 'none' vérifiées : dessous les boutons, dans
un bouton, ou sur des zones sans bouton (aucun autre bouton mort signalé). RÈGLE : une
<Image> ne doit JAMAIS être dessinée par-dessus un bouton ; si un décor doit passer devant,
l'envelopper dans une <View> au style pointerEvents 'none'. Contrôle auditGriffesBoutons
+ sabotage. 90 contrôles, 113 sabotages.


## 06/10 — Design, PRIORITÉ 2 : la carte des chapitres (publié) → DESIGN À 100 %

Médaillons de niveau (pièce Gemini de l'auteur, 1 image, 3 états) → assets/carte/
medaillon-{verrou,courant,gagne}.png (256 px) : CARTE_IMG, dessinés DANS le bouton du
niveau (38 pts, le médaillon déborde de 4 pts) — gagné (coche dorée gravée), en cours
(rebord doré + numéro gravé en brun, sur le halo existant), verrouillé (cadenas gravé),
Ascension requise (cadenas + 🌟 en coin). Les disques vert fluo / bleu nuit ont disparu.
CapsuleBois (onglet au liseré d'or en 3 tranches, mesuré par onLayout, fond SOUS le contenu
dans une View transparente au toucher) : compteur de Griffes partagé (carte, runes, fiche,
page des Griffes) avec le « + » DORÉ (plus-dore.png), bouton « 🔥 Éléments », énergie
(⚡ n/5 + compte à rebours) ; pastilles du hub (Puissance, élixir, Griffes — HUB.griffes
élargie à gauche : 0.808, sinon le montant était coupé). Testés : niveaux en cours et gagné
→ aperçu, Éléments → aide, « + » doré (hub, carte) → page des Griffes. Contrôle
auditCarteChapitres + sabotage. 91 contrôles, 114 sabotages.
DESIGN À 100 % (hors illustrations des créatures, la partie du frère). Prochain : les SONS.


## 06/10 — Plafond FERME : 4 packs de Griffes en PIÈCES par Ascension (publié)

Rappel de l'auteur (« on avait dit 4 par Ascension avec les pièces, pas de limite avec les
Diamants »). Avant : limite DOUCE par le prix seulement (GRIFFES_PACK_FRACTIONS 10 %, 15 %,
20 %, 60 % du seuil d'Ascension, puis 300 % au 5e) — aucun blocage. Maintenant :
GRIFFES_PIECES_MAX_PAR_ASCENSION = 4 + achatsGriffesPiecesRestants(n) dans clickerLogic,
appliqués aux 4 points d'achat : Grimoire (boutiqueModele : « n/4 », état « max », bouton
inactif), boutique de secours ShopView (même gestionnaire, bouton inactif + « encore n/4 »),
gestionnaire commun buyGriffesWithCoinsFromShop (filet), page « Obtenir des Griffes » de
l'Exploration (« Acheter · encore n/4 », puis « Limite atteinte » + message). Le compteur
griffesCoinBuys repart à zéro à chaque Ascension (déjà en place). Diamants SANS limite.
Pas de remesure : le simulateur ne modélise aucun 5e achat (le prix le rendait déjà hors
de portée). ⚠️ Le chargeur des gardes (load) ne sait pas charger boutiqueModele.js (imports
avec « .js ») → règle vérifiée dans le texte. Contrôle auditLimiteGriffesPieces + sabotage.
92 contrôles, 115 sabotages.


## 06/10 — BUG : « petit bug juste après que la page a tourné » (Collection ET boutique)

Moteur COMMUN livreTourne.js (d'où les 2 écrans). CAUSE : fin de l'animation =
setPosition(vers) + setTour(null) (appliqués à l'image SUIVANTE par React) +
angle.setValue(0) (pilote natif : INSTANTANÉ) → pendant 1-2 images, les feuilles encore
montées revenaient à leur position de DÉPART : l'ancienne page de droite réapparaissait.
CORRECTIF : plus de remise à zéro à la fin (l'angle reste à 1 = feuilles à l'arrivée,
identiques à la nouvelle page posée dessous) ; `tourner` remet déjà à 0 au départ du tour
suivant (anciennes feuilles démontées). RÈGLE : ne jamais remettre à zéro une valeur
animée par le pilote natif dans le même instant qu'un changement d'état React qui démonte
ce qu'elle anime. Contrôle auditTourneSansSaut (commentaires ignorés) + sabotage.
93 contrôles, 116 sabotages.


## 07/10 — LES SONS DU JEU : 29 sons ElevenLabs intégrés (publié)

Source : ElevenLabs « Sound Effects », plan Starter (licence commerciale À VIE sur ce qui est
généré pendant l'abonnement ; le gratuit exige une mention). ⚠️ La MUSIQUE d'ElevenLabs est
INTERDITE pour les jeux vidéo commerciaux sur Starter/Creator/Pro/Scale (Eleven Music terms)
→ musiques via PIXABAY Music (licence : commercial, sans mention, jeu autorisé).
Dépôt : design/a-integrer/17-sons (noms laissés par ElevenLabs = début du prompt, tronqué à
20 caractères ; identification par préfixe de mots — ATTENTION lot 4 : « light » vs
« lightning » à départager par le début du dernier mot partiel).
Traitement (ffmpeg + numpy) : mono 44,1 kHz, silences coupés (-50 dB du pic, 15 ms avant,
60 ms après), volume perçu harmonisé (RMS actif -18 dBFS, interface -22, pic ≤ -1 dBFS),
fondus 4 / 25 ms, MP3 96 kb/s → mobile/assets/sons/<nom>.mp3 (350 Ko les 29). page.wav et
achat.wav (synthétisés le 27/09) remplacés.
Lecteur : sonsBoutique.js (chargement PROTÉGÉ inchangé) : SONS (29), VOLUME par son (défaut
0,8), SON_ELEMENT, jouerSonLimite (pour le coup critique). Branchements (tous avec le réglage
« Sons ») : COMBAT (hors zone sous empreinte) — montrerVerdict → jauge-parfait ;
effetsImpact → impact-parfait / impact-normal / rate + son de l'ÉLÉMENT de l'attaquant (pas
sur un raté) ; effetSort → sort-soin / sort-bouclier (bouclier, boost, vitesse, provocation,
pacte) / sort-attaque (poison, marque, exécution, zone) / ko ; le SPÉCIAL au lancement via
useEffect(assombriKey) ; fin de combat → victoire / defaite, chaque étoile → etoile (onPop).
FenetreJeu → fenetre ; BoutonBois → bouton ; niveau, évolution (Exploration) ; page des
Griffes → achat / refus ; resolveHatch → eclosion ; calendrier et quêtes → recompense ;
Grimoire et Album → page / achat (fichiers remplacés). Banc : le combat automatisé ne résout
pas les coups (jauge absente au banc) — comportement IDENTIQUE avant / après les sons
(comparé), aucune erreur. Contrôle auditSonsJeu + sabotage ; auditLimiteGriffesPieces
accepte le son de refus. 94 contrôles, 117 sabotages.
RESTE : lot 4 (17 prompts dans 17-sons/LISEZMOI : boss/Gardien, cris des créatures, Ascension,
runes, spécial prêt, élixir, énergie, coup critique bridé) ; musiques Pixabay (menu, combat,
boss, option aventure).


## 07/10 — Sons, LOT 4 + l'étoile dorée (publié) : 46 sons en tout

17 sons de plus (241 Ko ; « light » / « lightning » départagés par le préfixe du dernier mot
tronqué) : ascension, boss-apparition, boss-vaincu, creature-<élément> (8), crit (cible -24,
volume 0,35, jouerSonLimite 1,5 s), elixir, energie, rune-fusion, rune-tirage, special-pret.
SON_CREATURE (élément → cri). Branchements : combat — entrée du GARDIEN de l'œuf
(guardianEggNumber > 0 ; pas d'écran de fin : sa défaite enchaîne sur l'éclosion), « spécial
prêt » (mana du combattant actif qui ATTEINT MANA_MAX, via manaPrecRef) ; Exploration —
tirages de runes (gratuit, simple, pack, offre) et fusion via avecSon(fn, nom, réussi) (son
SEULEMENT si l'action réussit), énergie (Diamants, vidéo), cri de la créature à l'ouverture de
sa fiche ; jeu de l'œuf (sonsJeuRef, lue par les minuteries) — Boss (annonce 3-2-1 →
boss-apparition ; résultat → boss-vaincu ou defaite), ÉTOILE DORÉE (apparition → etoile ;
récolte → recompense), coup critique (bridé), Ascension, pouvoir du deck (special-pret), cri
de la créature qui apparaît autour de l'œuf, rituel et offrande (recompense), invocation et
éclosion (eclosion), élixir.
⚠️ PIÈGE ÉVITÉ (2 fois) : un son posé en TÊTE de fonction sonne même quand la fonction REFUSE
l'action. Pris par auditBoutonAscension (doAscension n'ouvre que la confirmation → son dans
confirmAscension), puis vérifié partout : étoile dorée, pouvoir (2 vérifications), rituel,
offrande, invocation (pièces) → sons APRÈS les vérifications ; l'éclosion dans
grantHatchedCreature (resolveHatch lance d'abord le combat du Gardien s'il en faut un).
RÈGLE : un son se pose sur le CHEMIN DE LA RÉUSSITE, jamais avant un « if (…) return ».
auditSonsJeu : 46 sons + l'ordre vérification → son. 94 contrôles, 117 sabotages.
RESTE : musiques Pixabay (menu, combat, boss, option aventure).


## 07/10 — MUSIQUES + sons du LOT 5 (publié) : 57 bruitages + 4 musiques

MUSIQUES (Pixabay, noms d'origine non renommés → attribuées par leur titre) : menu = « epic and
magic mood » (60 s), aventure = « fantasy adventure quest » (209 s), combat = « samurai loop »
(72 s), boss = « final battle II epic cinematic » (121 s). Traitées : silences coupés, volume
harmonisé (RMS -21 dBFS), fondus 0,6 s / 1,2 s (boucle sans à-coup), mono 80 kb/s (≈ 4,5 Mo
les 4). Module src/screens/games/musique.js : PILE (useMusique(nom, réglage) en haut d'écran ;
MusiqueActive pour un état — le Boss du jeu de l'œuf) ; seule la musique du haut joue, la
précédente REPREND au retour ; VOLUME_MUSIQUE ≤ 0,3 (« pas trop fortes »), loop ; pause en
arrière-plan (AppState) ; réglage « Musique » séparé (SettingsContext, Paramètres) ; accès
protégé partagé (sonsBoutique.audioDisponible). Chaque bruitage a son propre lecteur : rien
ne coupe la musique. Pile : menu (ClickerScreen) → aventure (AdventureScreen) → combat
(CombatScreen ; boss pour le Gardien) ; boss (Boss du jeu de l'œuf).
LOT 5 (11) : etoile-doree-apparition / -recolte (remplacent etoile / recompense), bulle-apparition
/ bulle-eclatee (la bulle au gland doré = le « rituel » ; ⚠️ 2 prompts au même début → noms
identiques une fois tronqués : départagés par l'ordre de génération ET la répartition de
l'énergie — le « pop » met 91 % de son énergie dans ses 120 premières ms ; l'attaque seule
TROMPAIT), defi-valide, hors-ligne (récupération + doublement), video-acceleration (œuf du nid
et incubateur, APRÈS vérification), rune-equipee, offrande, boss-coup (bridé 220 ms), retour
(BackButton et PanneauRetour). La « bougie » n'existe plus (remplacée par l'étoile dorée).
Gardes : auditSonsJeu (57, lot 5 ; 2 anciennes vérifications de l'étoile dorée retirées) ;
auditMusique + sabotage. 95 contrôles, 118 sabotages.
APK du 06/10 : build RÉUSSI (run 37506374270) — lien dans le résumé du robot et sur expo.dev.
Avertissement GitHub : actions/checkout@v4 et setup-node@v4 forcés de Node 20 vers Node 24
(à mettre à jour un jour, sans urgence).


## 08/10 — Stade = évolution · Reliques possédées seulement · Puissance du hub (publié)

1. STADE (image + nom) = PALIER D'ÉVOLUTION (décision de l'auteur : « le nouveau skin doit se
mériter ») : stadeVisuel(evolutionTier) dans clickerLogic (0 de base, 1 après l'évolution du
niveau 25, 2 après celle du 50 ; bornée). Remplace stageForLevel(level) (5 et 15) PARTOUT à
l'affichage : Exploration (hub, fiche, aperçu), écran principal (deck, pouvoir, anciennes vues),
Album, combat (le combattant porte désormais evolutionTier — hors zone sous empreinte), Changer.
stageForLevel ne reste que pour incomeForCreature (ancien calcul de revenu). AUCUN effet de jeu :
la force en combat dépend déjà du palier, séparément. ⚠️ Visible pour les parties en cours : une
créature de niveau ≥ 5 non évoluée reprend sa forme de base. Contrôle auditStadeEvolution
(+ sabotage : stade figé à 0).
2. GRIMOIRE, RELIQUES : seulement celles qu'on POSSÈDE (créature obtenue) — filtre d'AFFICHAGE
(visible(cle, id)) ; le catalogue CHAPITRES_GRIMOIRE reste complet (auditGrimoireComplet). Un
chapitre sans relique garde sa page d'introduction. Contrôle auditReliquesPossedees + sabotage.
3. HUB : pastille « Puissance » élargie à gauche jusqu'au titre (HUB.puissance x 0,615) + texte
qui rétrécit (adjustsFontSizeToFit) — la puissance était coupée au-delà d'un certain nombre.
97 contrôles, 120 sabotages.


## 08/10 — PUISSANCE AFFICHÉE : une seule, qui monte à chaque niveau (publié)

Signalé par l'auteur : « j'augmente le niveau et ça ne bouge pas », « 3 chiffres différents »,
« au Gardien, plus je monte, plus ça baisse ». MESURÉ (vrai moteur) : (1) PV / attaque ARRONDIS
(attaque de 2 à 6) → paliers ; mesure du hub par simulation → léger hasard (34 → 33) ;
(2) hub et Gardien MESURÉS contre des adversaires différents, runes comptées en Exploration
seulement ; (3) le Gardien se RECALE sur le deck à chaque œuf (photo au démarrage du chrono) et
durcit d'œuf en œuf → écart -1, -4, -6 aux niveaux 10, 20, 30. DÉCISION de l'auteur : garder la
règle du Gardien (« c'est grâce à ça qu'un joueur peut payer pour avancer plus facilement ») ;
faire l'AFFICHAGE (option A) ; le chiffre du Gardien se calcule au DÉMARRAGE DU CHRONO et ne
bouge plus (déjà le cas : startIncubation + avecPhotoGardien ; désormais garanti).
FAIT : combatLogic — statsContinues (formule de combatStatsForCreatureTyped SANS arrondi ;
expose _base et _facteurs : refaire le double arrondi redonne EXACTEMENT les stats du jeu,
28 080 valeurs, 0 écart) ; puissanceAffichee = ×10 √(ΣPV × dégâts moyens) sur ces stats :
monte STRICTEMENT à chaque niveau (26 créatures, 1 → 60), évolution, rune (équipe test :
323, 338, 354… ; Pyrosile seul +5 par niveau) ; mesureFaceAuGardien renvoie AUSSI la chance
(r.victoires, déjà calculée et jetée) — puissanceFaceAuGardien lui délègue. Écrans : hub
(« Puissance N », couleur = chance mesurée), aperçu (« Ta puissance N · X % de victoire » au
lieu de « conseillée »), menu du Gardien (« Gardien G · Ton deck N · X % de victoire », G =
gardienAffiche(photo) → figé), résultat du Gardien. puissanceDeck reste INTERNE (photo,
calibrage, anti-triche). Côté Gardien, pas de runes (elles ne jouent pas contre lui).
Contrôle auditPuissanceAffichee + sabotage (stats arrondies → 16 cris). 98 contrôles, 121 sabotages.


## 08/10 — GARDIEN : 80 % pour qui atteint son chiffre · chance stable · effort en niveaux (publié)

Signalé par l'auteur : défaite à 9615 contre un Gardien à 9610 ; « le prochain demande 9807 » ;
« le pourcentage doit changer ». ANALYSE : (a) un Gardien est FIGÉ par œuf, même après défaite
(applyGuardianDefeat ne fait qu'ajouter retryAt) ; 9807 = 9615 × 1,02 = l'AUTRE œuf (nid ou
incubateur), photographié plus tard ; (b) atteindre le chiffre = 67 % (cible 1/3) ; (c) chance
mesurée sur 100 combats avec un hasard tiré du deck (niveaux compris) → monter d'un niveau
rejouait d'AUTRES combats → baisses (56 → 55, 59 → 54).
CALCUL (à redire simplement) : chiffre du Gardien = puissance du deck au démarrage du chrono
(3 créatures, sans runes) × marge (+5 % → +2 % selon la puissance) ; sa force est réglée pour
qu'un deck qui ATTEINT ce chiffre gagne 8 fois sur 10.
DÉCISION de l'auteur : 80 % → GUARDIAN_WIN_TARGET 1/3 → 1/5. MESURÉ (vrai moteur, 4 photos,
niv. 8 à 60) : deck qui atteint le chiffre → 78 / 85 / 85 / 87 % ; photo seule → 62 à 79 % ;
effort +3 à +15 niveaux. chanceFaceAuGardien : 300 combats, meilleure des 2 façons de jouer,
hasard FIXÉ par le Gardien (graineGardien) → mêmes combats d'un niveau à l'autre ; ~12 ms.
Affichée arrondie à 5 % (les baisses résiduelles de 1 point deviennent invisibles).
niveauxPourAtteindre(membres, cible) : niveaux à gagner (créature la plus rentable d'abord).
Menu : « Gardien G · Ton deck N · X % de victoire · ≈ K niveaux à gagner ». Les œufs en cours
gardent leur photo, mais leur Gardien est recalibré à 1/5 au combat (calibrage fait au combat).
Gardes : auditGardienCalibre recalé (fenêtre ±12 points AUTOUR de la cible + la cible doit
valoir EXACTEMENT 1/5 — sinon une fenêtre qui suit la constante suivrait aussi une fraude) ;
auditGardien80 (+ sabotage). 99 contrôles, 122 sabotages.
⚠️ Bac à sable réinitialisé en cours de session : dépôt recloné, outils réinstallés
(/home/claude/babel-env : @babel/core, preset-env, preset-react, traverse, parser ;
/tmp/cap : npm install du package.json de tools/capture).


## 08/10 — CLÉ GITHUB : renouvelée (l'ancienne avait EXPIRÉ)

Symptôme : push refusé (« Invalid username or token »), API /user → 401 « Bad credentials ».
Vérifié : AUCUNE clé dans le dépôt ni son historique (recherche du préfixe des clés dans tout l'historique) → simple
EXPIRATION (les clés « fine-grained » ont une date de fin). Nouvelle clé fournie par l'auteur
le 08/10 : elle vit dans les INSTRUCTIONS DU PROJET CLAUDE (texte de démarrage de session),
JAMAIS dans le dépôt (GitHub révoque automatiquement toute clé qui y apparaît).
Remote à configurer après un reclonage : https://x-access-token:<CLÉ>@github.com/... (la forme
https://<CLÉ>@github.com prend la clé pour un identifiant et échoue sans terminal).
Si un push échoue en « Bad credentials » : clé expirée → demander à l'auteur de la régénérer
(https://github.com/settings/personal-access-tokens ; droits Contents RW, Workflows RW,
Actions R ; dépôt paradoxes-app seulement).


## 08/10 — Gardien : réflexion « en Griffes » (EN ATTENTE du test de l'auteur — rien de codé)

Constat de l'auteur : +2 % à 9421 = 210 de puissance ≈ 500 Griffes, « énorme ». MESURÉ (simulateur
de parcours, joueur gratuit, toutes sources) — Griffes gagnées PAR ŒUF : A0 193 · A1 1 083 ·
A2 5 005 · A3 7 651 · A4 8 816 · A5 10 707. La marge actuelle (+2 à +5 %) coûte : A0 25 % · A1
16 % · A2 28 % · A3 74 % · A4 111 % · A5 134 % des Griffes gagnées pendant un œuf → un MUR
qui grandit en fin de jeu. Coût d'1 niveau au niv. 60 : commune 36 G … légendaire 152 G …
mythique 242 G (3 niveaux mythiques : 738 G). L'auteur : « 2 à 6 niveaux au niveau 60, c'est
super compliqué ».
Options proposées : A. « 1 niveau » sur la créature la MOINS CHÈRE à monter du deck (recommandée :
simple, toujours faisable, « ≈ 1 niveau à gagner ») ; B. 5 % des Griffes gagnées pendant un œuf
(≈ 1 à 2 niveaux ; dépend d'un revenu simulé). DÉCISION : l'auteur TESTE d'abord ; on garde la
règle actuelle (marge 2-5 %, 80 % en atteignant le chiffre) en attendant.
Piste de l'auteur : une AUTRE SOURCE DE GRIFFES pour un joueur vraiment bloqué (niveau d'Aventure
infaisable…). Voir A_FAIRE.


## 08/10 — GARDIEN : l'effort en GRIFFES (règle de l'auteur, publié)

L'auteur : « une fois que le Gardien a calculé le niveau de mon deck, je veux qu'il se calibre à
(Griffes moyennes gagnées par combat × X %), pareil pour chaque Ascension ; on ajustera ».
RÈGLE (combatLogic) : GRIFFES_PAR_COMBAT = [36, 171, 748, 1035, 1330, 1527] (A0…A5, au-delà A5 ;
MESURÉ : simulateur de parcours, 40 joueurs, Griffes gagnées ÷ combats) ; EFFORT_GARDIEN = 0,25
(LE réglage) ; griffesEffortGardien(asc) ; deckApresEffort(membres, griffes) = Griffes dépensées
AU MIEUX en niveaux (puissance par Griffe), avec la fraction du niveau suivant ;
gardienDeLaPhoto(membres, asc) → { puissance (= chiffre affiché), membres (= deck de calibrage) }.
Calibrage : calibrageGardienSur(deck après effort, base, { marge: 1 }) → qui ATTEINT le chiffre gagne
~8 fois sur 10. La marge (+2 à +5 %) ne sert plus au Gardien.
PHOTO : retient l'Ascension du démarrage du chrono (asc) ; les anciennes photos la reçoivent UNE
fois sans être reprises (sansAsc) ; cache de calibrage indexé aussi par asc.
MESURÉ (4 stades A0→A3) : 9 / 43 / 187 / 259 Griffes, 1 à 2 niveaux ; chance SANS rien faire
76-86 % ; au chiffre 75-95 %. Selon X : 50 % → 59-84 % sans rien ; 100 % → 49-81 % ; 200 % →
48-77 % (à haut niveau, quelques niveaux changent peu l'issue). Chance affichée « ≥ 95 % » au-delà
de 95 (le hasard résiduel faisait osciller 95 / 100 : 97,7 → 95,7 mesuré).
POUR AJUSTER : changer EFFORT_GARDIEN ET la valeur attendue dans auditGardienGriffes (sinon il crie,
c'est voulu). Si l'économie change, recalculer GRIFFES_PAR_COMBAT (le contrôle compare au simulateur,
±35 %). Gardes : auditGardienGriffes (+ sabotage EFFORT 3), auditGardien80 et
auditPuissanceAffichee adaptés. 100 contrôles, 123 sabotages.


## 08/10 — GARDIEN : budget A + B (règle de l'auteur, publié)

Raisonnement de l'auteur : compter ce que le joueur PEUT récupérer (sinon un joueur malin laisse ses
récompenses en attente au moment de la photo), plus ce qu'il gagnera en avançant ; ne PAS compter le
solde (C) : un futur achat « plus de Griffes par combat » rendrait la séparation acheté / gagné
ingérable, et un jeu qui pousse à dépenser rend le solde négligeable (« si le joueur garde quelques
Griffes, pas grave ; s'il n'en a pas assez, il paiera ou farmera »).
BUDGET (figé dans la photo au démarrage du chrono) = A + B :
- A = griffesRecuperables (dailyLogic, fonction PURE, recompenseQuete passée en paramètre) : quêtes
  du jour / de la semaine terminées non réclamées, paliers de succès atteints non réclamés (plusieurs
  possibles), calendrier du jour en Griffes non pris ; fourni par DailyContext (griffesARecuperer) ;
  + la FILE d'attente (PENDING_GRIFFES_KEY, Griffes réclamées pas encore versées), lue UNE fois juste
  après le démarrage du chrono (ajouterFileAuBudget, drapeau `file`).
- B = primesProchainsNiveaux(advLevelReached, 3) (combatLogic) : primes des 3 prochaines 1res
  victoires d'Aventure au taux de BASE (un bonus payant n'est jamais compté).
Gardien = deckApresEffort(photo, budget) ; calibré (marge 1) sur ce deck → ~80 % pour qui l'atteint.
Photos sans budget (œufs en cours au moment de la mise à jour) : ancienne règle, 25 % des Griffes
moyennes d'un combat de leur Ascension (budgetDeLaPhoto). Le payeur garde son avantage sur le Gardien
EN COURS (chiffre figé) et en Exploration ; aucun joueur ne garde d'avance sur les Gardiens SUIVANTS
(ils suivent le deck — règle voulue). ⚠️ Piège de test rencontré : le succès « a_level » se base sur
advLevelReached — un cas de test qui lui donne sa cible ÉCRASE le niveau d'Aventure (les quêtes
valent alors plus) ; la garde utilise un succès d'une autre statistique.
Gardes : auditGardienGriffes (A exact sur cas construits, B, budget dans la photo, file aux 2
démarrages, contexte) + sabotage « budget à zéro ». 100 contrôles, 124 sabotages.


## 08/10 — Défaite AU-DESSUS du Gardien (capture : 9 698 contre 9 617) — message honnête (publié)

MESURÉ : la précision au tap ne change presque rien à la chance (60 / 90 / 120 ms → 79 à 88 % au
chiffre du Gardien : la marge du « bien » est large) → le calibrage est juste ; cette défaite à ~82 %
= malchance (1 sur 5-6). Défaut corrigé : le message disait « Améliore tes créatures » alors que le
deck dépassait le Gardien → désormais « Pas de chance cette fois : ton deck dépasse le Gardien (X % de
victoire). Retente ta chance ! » (resultatGardien.chance = chance mesurée face à CE Gardien, arrondie à
5 %). Contrôle dans auditGardien80 + sabotage ; auditPuissanceAffichee accepte le champ chance.
EN ATTENTE (décision de l'auteur) : cible 80 % → 90 % ? MESURÉ : à 90 %, au chiffre 87-90 %, SANS
rien faire 85-90 % (le Gardien ne bloque presque plus) ; à 80 % : au chiffre 75-85 %, sans rien 72-84 %.


## 08/10 — BUG DE FOND du Gardien : chance « meilleur cas » → MINIMUM garanti (publié)

3e défaite de l'auteur au-dessus du chiffre (« ton pourcentage est complètement faux »). 3 défaites
de suite à ~80 % ≈ 1 % de probabilité → recherche d'un écart RÉEL, pas de défense du calcul.
Vérifié et ÉCARTÉ : Gardien du vrai combat = même niveau / même calibrage que la simulation ;
2 manches du boss (bouclier, relève à PV pleins) bien simulées ; précision au tap (60-120 ms)
quasi sans effet. TROUVÉ : la chance dépend fortement de la FAÇON DE JOUER — MESURÉ au chiffre du
Gardien : niv. 45 : sorts 59 % / sans sorts 79 % ; niv. 100 : sorts 82 % / sans 69 %. Or
calibrerGardien gardait le Gardien calibré contre le MEILLEUR style (facteur d'attaque le plus
fort) et chanceFaceAuGardien affichait le MAX des deux : un « meilleur cas » présenté comme une
promesse. CORRECTIF : calibrage sur le style le MOINS efficace (le Gardien le plus faible des deux)
et chance affichée = MIN des deux. MESURÉ après : au chiffre, affiché 78-85 % ; CHAQUE style
≥ 74 % (sorts 74-92 %, sans sorts 80-98 %). RÈGLE : une chance affichée au joueur est un MINIMUM
(le pire style raisonnable), jamais un meilleur cas. auditGardienCalibre mesure désormais le
Gardien contre le pire style (plancher 5 % : 8 % mesuré contre 3 communes niv. 1, paliers) + sabotage
« recalibré sur le meilleur style ». 100 contrôles, 126 sabotages.
⚠️ La chance du HUB / de l'aperçu (puissanceAventure → mesurerEquipe) prend encore le MAX des styles :
à aligner si l'auteur le souhaite.


## 08/10 — Chiffre du Gardien FIGÉ PAR ÉCRIT (capture : 9 915 au menu, 9 901 au résultat) — publié

CAUSE : le chiffre n'était pas stocké mais RECALCULÉ à chaque affichage depuis la photo ; la formule
a changé 3 fois dans la journée (marge → 25 % → A + B) et la file d'attente s'ajoute quelques ms
après le démarrage → un même œuf pouvait montrer 2 chiffres. (mainEggRef est resynchronisé à chaque
rendu : pas la cause.) CORRECTIF : photoGardien ÉCRIT `gardien` (= deckApresEffort(membres, budget)
.puissance) avec le budget ; ajouterFileAuBudget réécrit budget + gardien ensemble (drapeau file) ;
les photos sans chiffre le reçoivent UNE fois (sansChiffre → figer : budget via budgetDeLaPhoto,
puis gardien) ; gardienAffiche RELIT photo.gardien en priorité. Le calibrage utilise le même budget
écrit. RÈGLE : une valeur promise au joueur (« figée ») doit être STOCKÉE, jamais recalculée — sinon
toute évolution de formule la fait bouger. auditGardienGriffes (+ sabotage : relecture supprimée).
100 contrôles, 127 sabotages.


## 08/10 — Gardien : la CHANCE comme seul repère + JOURNAL de preuve (publié)

L'auteur (captures : défaite à 9 698 contre 9 617 ; victoire à 9 781 contre 9 915) : « ça ne va pas,
il faut trouver une solution » ; puis, sceptique : « c'est déjà ce qu'on avait essayé et c'est un fail ».
ANALYSE : 2 chiffres de FORMULE (Gardien figé sur la photo, deck actuel) ne peuvent pas être à la fois
figés ET exacts : un combat dépend aussi des sorts, éléments, rôles, des 2 manches, et de la composition
(qui peut changer après la photo). DÉCISION : face au Gardien, UN seul repère, MESURÉ :
- menu : « ⚔️ X % de victoire · ≈ N niveaux pour 80 % » (plus de « Gardien X · Ton deck Y ») ;
- niveauxPourChance(membres, gStats, 0,8, 40) (combatLogic) : niveaux MESURÉS par simulation (suite de
  niveaux à la créature la plus rentable + dichotomie, ≈ 7 mesures, 60-130 ms) — vérifié à la frontière :
  75 % à 6 / 80 % à 7 ; 78 % à 2 / 81 % à 3 ; 78 % à 19 / 83 % à 20 ;
- résultat : « 🎯 Tu avais X % de chances », message de malchance dès 80 % ;
- JOURNAL (AsyncStorage gardien:journal, 50 derniers : chance annoncée + résultat réel), résumé à l'écran
  de fin : « Tes N derniers Gardiens : X % annoncés en moyenne · Y gagnés » → la PREUVE (ou l'écart
  à corriger : recaler alors la simulation sur la vraie façon de jouer de l'auteur — précision, sorts).
Le Gardien reste figé (budget A + B, chiffre écrit dans la photo) ; la « Puissance » reste au hub
(progression). Gardes : auditGardien80 (niveaux mesurés + frontière, journal, malchance dès 80 %),
auditPuissanceAffichee (ligne du menu) ; sabotages recalés. 100 contrôles, 127 sabotages.


## 08/10 — JOURNAL DES COMBATS pour Claude (menu dev) — publié

L'auteur (journal : 6 Gardiens, 74 % annoncés, 4 gagnés) : « mon cerveau surchauffe, rien n'est
précis ; je vais recommencer le jeu ; crée un bouton pour te donner l'historique et les infos qui te
permettront de bien calculer » (menu dev des Paramètres).
src/screens/games/journalCombat.js : debutCombat (mode, niveau, œuf, élixir, équipe {id, rareté, niv,
palier, runes}, stats du Gardien), noterVerdict (parfait / bien / rate / absent → la VRAIE précision au
tap se déduit des verdicts et des largeurs de zone par rareté), noterAttaque (coups / ripostes),
noterSort (type@côté), noterSpecial, finCombat (issue, durée ; Gardien : chance annoncée, chiffre,
puissance du deck, Ascension ; Exploration : étoiles) → AsyncStorage dev:journalCombats (40 derniers).
Crochets HORS de la zone des règles (montrerVerdict, effetsImpact, effetSort, assombriKey, montage).
Menu dev : « 📤 Envoyer mes données de combat à Claude » (Share.share d'un JSON : résumé + journal des
Gardiens + journal des combats) et « 🗑️ Vider les journaux de combat ». À L'ARRIVÉE DES DONNÉES :
estimer la précision réelle (σ) depuis les verdicts, le taux d'usage des sorts / spéciaux, comparer
chance annoncée / résultats, puis recaler la simulation (erreurMs, politique) sur l'auteur.
Contrôle auditJournalDev (+ sabotage) ; auditSonsJeu accepte noterSpecial. 101 contrôles, 128 sabotages.


## 08/10 — GARDIEN, RÈGLE FINALE : « les Griffes de tes 3 prochains combats, réparties » (publié)

DONNÉES de l'auteur (menu dev, 26 combats) : annonces de chance JUSTES (Gardiens 0 % perdu, 5 % perdu,
80 / 95 / 95 / 100 % gagnés ; Brier 0,008) ; précision au tap MESURÉE 42 ms (IC 95 % : 36-49) contre
60 ms pour le joueur simulé → les % affichés sont un MINIMUM pour lui ; style : quasi sans sorts (8 sorts,
7 spéciaux / 126 attaques). PROBLÈME RÉEL : œuf 6 → 1 478, œuf 7 → 1 802 pour le même deck (1 499) :
« 10 combats au lieu de 3 ». CAUSE MESURÉE : budget A + B ≈ 255 G (≈ 114 G de primes + ≈ 140 G de
récompenses en attente) dépensé « AU MIEUX » (tout sur Aegisolar niv. 9, 8 G le niveau → +16 niveaux,
+20 %). Même faute que le « meilleur style » : supposer le joueur PARFAIT.
RÈGLE FINALE (décision de l'auteur) : budget = primesProchainsNiveaux(niveau d'Aventure, 3) — les Griffes
des 3 PROCHAINES 1res victoires, taux de base — réparties ÉQUITABLEMENT (deckApresEffortEquitable : part
égale par créature, le reste passe à la suivante, reliquat aux niveaux les moins chers) ; plus de A (les
récompenses en attente ne comptent plus ; ajouterFileAuBudget supprimé). Cas de l'auteur : 114 G →
Aegisolar 13 / Terracroc 34 / Racinea 27, 110 G dépensés, Gardien 1 613 (+7,6 %) au lieu de 1 802.
⚠️ « +2 niveaux par créature » REJETÉ : vrai sur ce deck (Aegisolar bon marché), faux en général.
Calibrage, photo, anciennes photos et affichage de secours : tous sur la répartition équitable.
auditGardienGriffes (cas exact de l'auteur, budget jamais dépassé, chaque créature servie, pas de file)
+ sabotage recalé. 101 contrôles, 128 sabotages. L'auteur remet l'appli à zéro et reteste.


## 08/10 — VALIDATION de la simulation sur les VRAIS combats de l'auteur (2 envois, 10 Gardiens)

Méthode : chaque combat de Gardien REJOUÉ en simulation avec l'équipe exacte et les PV / attaque RÉELS du
Gardien (notés par le journal), 600 combats par style. Résultat : les % annoncés = ceux des rejeux (±5 points) ;
victoires ATTENDUES 5,4 / 10, RÉELLES 7 / 10 (écart ≈ 1,5 écart-type : chance un peu favorable) ; score de
Brier 0,09 (0,25 = pile ou face). Sa précision réelle (42 ms au lieu de 60) et son style (quasi sans sorts)
ne déplacent les % que de ≤ 5 points → la méthode actuelle (60 ms, style le moins efficace) reste juste pour lui.
Règle finale (« 3 prochains combats, répartis ») : œufs 3, 4, 5 battus en quelques combats d'Exploration.
Note : 2 Gardiens « œuf 3 » à 563 et 579 = ses 2 œufs (nid et incubateur), chacun avec SA photo — eggNumber
vient du nombre de créatures possédées, commun aux 2 œufs. Pas un bug.


## 08/10 — « ≈ N niveaux pour 80 % » dit OÙ les mettre (publié)

Test de l'auteur : « le Gardien demande 8 niveaux, j'ai dû en faire plus de 12 ». CAUSE MESURÉE (ses vrais
Gardiens) : niveauxPourChance met chaque niveau sur la créature au plus fort gain de puissance (souvent TOUJOURS
la même : Aegisolar) ; répartis, il en faut 2 à 3 fois plus (œuf 5 : 4 « au mieux » contre 7 répartis ; œuf 3 :
2 contre 7). CORRECTIF (le plus simple et le plus utile) : planPourChance (combatLogic) renvoie { niveaux,
plus: [{ id, plus }] } ; le menu affiche « ≈ 4 niveaux pour 80 % (Aegisolar +4) » (2 créatures au plus, nom
du STADE : c.stages[stade].name — ⚠️ stages[i] est un OBJET { name, emoji }, d'où un « [object Object] »
attrapé au test). Suivre le plan : œuf 5 → 90 %. niveauxPourChance délègue à planPourChance. Gardes :
auditGardien80 (plan transmis, nom du stade, plan = total annoncé) ; sabotage « plan non transmis ».
101 contrôles, 128 sabotages.


## 08/10 — Menu « Gardien de l'œuf » avant le combat (publié)

Demande de l'auteur : les informations du Gardien dans un menu qui s'ouvre au toucher de « Affronter le
gardien », croix pour annuler, bouton en bas pour confirmer. FenetreJeu (planche de titre, croix dorée,
zIndex 3000 : au-dessus de l'incubateur) + BoutonBois des fenêtres maison, importé sous le nom BoutonBoisJeu
(⚠️ ClickerScreen a déjà un BoutonBois : celui de fenetreBois). Contenu : « 🎯 X % de victoire » ; si < 80 % :
« Pour atteindre 80 % : » + une ligne par créature du plan (« ⬆️ Aegisolar +4 niveaux ») + « Monte-les dans
l'Exploration » ; plan introuvable : « Améliore tes créatures… » ; ≥ 80 % : « ✅ Tu es prêt ! » ; « ⚔️ Combattre »
→ resolveHatch('main') ou hatchIncubatedEgg(). Nid : onPress → setConfirmGardien('main') ; incubateur :
prop onAffronterGardien (IncubatorPanel l'appelle quand un Gardien est requis). Le sous-texte du bouton
devient court : « ⚔️ X % de victoire · touche pour voir le plan ». Vu au banc (scène temporaire, non
gardée). Gardes : auditGardien80 (menu, 2 boutons, incubateur), auditPuissanceAffichee ; sabotage « le nid
relance le combat sans le menu ». 101 contrôles, 129 sabotages.


## 09/10 — ATTAQUES DE SOUTIEN : toute l'équipe participe (règle de combat, publié)

TEST de l'auteur (journal, 27 combats) : Brontobloc SEUL, monté au niveau 36 (467 G : succès + quêtes ≈ 150 G/jour
dès le niveau 10 + primes), a fini tout le chapitre 1 (niveaux 1-25). Plafond de niveau proposé puis REJETÉ par
l'auteur (« on décale juste le problème : même avec 3 créatures, il suffira de monter une seule »). CAUSE RÉELLE :
à chaque tour, UNE seule créature frappait (rotation) → 3 créatures ne frappaient pas plus fort qu'une ;
concentrer restait toujours optimal.
RÈGLE (décision de l'auteur) : après le coup de la créature active, CHAQUE autre créature VIVANTE frappe la même
cible (ou le 1er ennemi vivant) avec SOUTIEN_FRACTION = 0,5 de son attaque normale (meilleureAttaque, ×JAUGE_MULT.bien,
sans jauge, sans sort, SANS consommer ses bonus : frapper / modifierCoup avec consommer = false). Contre le Gardien :
modifierCoup + coupSurGardien (bouclier, manches) ; une relève déclenchée par un soutien = comme celle du coup actif
(pas de riposte, la même créature rejoue). Règle PARTAGÉE coupsDeSoutien (combatLogic), appelée par simulerCombat
ET par CombatScreen (zone des règles) → EMPREINTE_COMBAT 94f9492c. Visuel : un petit impact « soutien » par
coéquipier (430 ms + 150 ms × rang), sans vibration ni son d'élément. Journal : soutiens comptés à part.
RECALIBRAGE (même outil, mêmes cibles) : calibrer-parcours 40 × 8, 0 bloqué, 31 s → AVENTURE_MULTIPLICATEURS :
niveaux 1-10 INCHANGÉS (apprentissage), ensuite ×1,25 à ×1,34 (médianes par Ascension) ; PUISSANCE_CONSEILLEE
régénérée (maximum courant). MESURÉ après : Brontobloc seul niv. 36 → 99 % au niveau 15, 81 % au 20, 0 % au 25 (avant :
100 / 100 / 51) ; trio niv. 21 (385 G, moins cher) → 100 / 100 / 0 au 25 (le 25 demande des évolutions) ; avant
recalibrage, à prix égal : trio 92 % contre solo 51 % au niveau 25. Parcours gratuit (40 joueurs) : 0 bloqué de A0 à
A5, ~15 % de jours en plus par Ascension.
Chance au Gardien : CHANCE_GARDIEN_COMBATS 300 → 600 ; chanceStabilisee (affichage qui ne redescend pas par
simple bruit, ≤ 5 points, quand le deck progresse ; mémorisé par œuf), appliquée au bouton ET au menu.
Gardes : auditSoutienEquipe (+ sabotage « soutien à zéro »), auditGardien80 (série VISIBLE stabilisée),
auditSonsJeu (exception soutien). 102 contrôles, 130 sabotages.

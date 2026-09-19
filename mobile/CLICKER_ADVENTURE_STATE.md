# Paradox — mémoire du projet

Lu au début de chaque session. Ne contient QUE ce qui évite de repayer
une erreur déjà payée. Le reste se lit dans le code, qui est commenté.

⚠️ Avant d'ajouter quelque chose ici : est-ce que ça empêchera quelqu'un
de refaire une erreur coûteuse ? Sinon, ça va en commentaire dans le
code.

---

## 1. La commande avant tout push touchant aux défis

```
NODE_PATH=<dossier avec @babel/core> node mobile/tools/verifier-defis.js
```

16 contrôles + 14 600 tirages de force brute + l'empreinte. Vert = le
changement peut partir. Chaque contrôle est né d'un bug réel et a été
**prouvé** en réintroduisant ce bug.

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
l'information là où le téléphone l'affiche.

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

## 5. Les pièges de méthode

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

**Ne pas ajouter ce qui n'est pas demandé.** Un menu ajouté de ma propre
initiative a produit deux bugs en trois commits avant d'être retiré.

---

## 6. Équilibrage

Joueur à la main, 4 taps/s. L'autoclicker de l'auteur (~142/s) est un
outil de test, **jamais** une référence d'équilibrage.

| Groupe | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Durée | 8,1 h | 9,1 h | 11,5 h | 19,6 h |

Gains hors ligne plafonnés à **15 % du seuil de l'Ascension en cours**
(`OFFLINE_MAX_SHARE`). Le plafond de 2 h ne bornait que le TEMPS, pas la
VALEUR : une nuit rendait jusqu'à 106 % de l'Ascension.

⚠️ `ASCENSION_THRESHOLDS` est une table de 14 valeurs **mesurées**. Tout
changement d'équilibrage la périme.

**Ouvert** : `auditTropFacile` est rouge sur les groupes 2 à 5 — des
défis encore trop faciles, à caler œuf par œuf avec la règle du §4.

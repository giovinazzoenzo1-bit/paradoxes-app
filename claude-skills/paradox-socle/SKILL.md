---
name: paradox-socle
description: Socle obligatoire pour TOUT travail sur Projet Paradox (repo paradoxes-app, dossier mobile/, jeu React Native / Expo SDK 57). Contient la procédure de démarrage de session, les interdits techniques qui cassent le démarrage de l'app, la façon de publier, et les vérifications à faire après chaque édition. Déclenche ce skill dès que la conversation mentionne Paradox, paradoxes-app, le clicker, le mode Aventure, les créatures, les runes, l'œuf, Expo Go, ou n'importe quel fichier de mobile/ — même si l'utilisateur ne demande qu'une petite correction. Si un autre skill Paradox (créatures, aventure, équilibrage) s'applique aussi, applique les deux — celui-ci passe en premier.
---

# Projet Paradox — socle de session

Jeu mobile React Native / Expo SDK 57. Repo `giovinazzoenzo1-bit/paradoxes-app`,
tout le jeu est dans `mobile/`.

L'utilisateur **n'a aucun terminal**. Il travaille à 100 % sur téléphone et
ouvre l'app via Expo Go. Ne lui donne jamais de commande à taper : c'est toi
qui clones, codes, testes et pousses. Lui ferme et rouvre Expo Go.

## 1. Démarrage de session — dans cet ordre

1. Cloner le repo avec le token fourni par l'utilisateur dans son message de
   départ (jeton personnel GitHub, ne jamais l'écrire en dur dans un fichier
   du repo ni dans un skill).
2. Lire `mobile/CLICKER_ADVENTURE_STATE.md` **en entier** (~3400 lignes).
   C'est l'état à jour + les décisions + la liste des pièges déjà rencontrés.
   Le lire par morceaux si besoin, mais le lire en entier : les pièges les
   plus coûteux sont au milieu et à la fin.
3. Jeter un œil à `mobile/src/games/clicker/clickerLogic.js` et
   `mobile/src/games/clicker/combatLogic.js` si la tâche touche aux règles
   du jeu.
4. **Ne rien coder avant d'avoir fait 1 à 3.**

Autres docs, à ouvrir seulement si la tâche les concerne :
`ADVENTURE_MODE.md` (le « pourquoi » du mode Aventure),
`CREATURE_ART_ROADMAP.md` (illustrations), `THEME_FRAMES.md` (cadres),
`PROJECT_STATE.md` (historique daté, long, rarement utile).

## 2. Avant de corriger un bug — non négociable

Ce projet a vu revenir **trois fois** les mêmes bugs (écran blanc, blocage
« Checking for new update », runtimeVersion). Chercher d'abord :

```
git log --all --oneline --grep="<mot-clé>" -i
```

Le message du correctif explique en général pourquoi ne pas refaire l'erreur.
Chercher avant de déduire fait gagner des heures ; déduire d'abord en a déjà
coûté une session entière.

Si le bug est nouveau : **demander à l'utilisateur quand ça marchait encore.**
Il a déjà identifié le commit fautif en une phrase là où dix tours de
déduction avaient échoué. Puis restaurer ce commit et réappliquer les
changements un par un.

## 3. Interdits durs — ils cassent le démarrage de l'app

- 🟥 Ne jamais réintroduire `expo-updates` ni un `runtimeVersion` du type
  `exposdk:...`. Voir commit `63b68ff` et suivants : blocage au lancement.
- 🟥 Rester en **SDK 57**. Les deux téléphones sont sur Expo Go 57 et iOS ne
  peut pas redescendre.
- 🟥 `expo-notifications` est retiré (supprimé d'Expo Go depuis le SDK 53).
- 🟥 Avant d'appeler une API d'un module natif, vérifier qu'elle existe dans
  la version installée. `setBehaviorAsync` a été retirée en SDK 57 et faisait
  planter l'app. Vérifier dans `node_modules`, pas de mémoire.
- 🟥 `newArchEnabled: true` est obligatoire, ne pas y toucher.

## 4. Vérifications après édition

Chacune correspond à un bug réellement arrivé dans ce projet :

- **Ajout d'une prop à un composant** → croiser les props déclarées et les
  props réellement passées. Une prop manquante a déjà cassé tout un écran.
- **Suppression en masse** → comparer les déclarations de premier niveau
  avant/après : `grep -c "^function NomDeLaFonction"` doit toujours donner 1.
  Deux fonctions ont déjà été amputées de leur signature.
- **Changement de styles ou d'imports** → croiser les composants React Native
  utilisés et importés. Deux crashs sont venus d'un `ScrollView` non importé.
- 🟥 **Jamais de regex DOTALL** pour supprimer un bloc entre accolades.
- 🟥 **Jamais de patch de littéraux numériques à la regex** : ça touche des
  valeurs homonymes ailleurs dans le fichier.
- Ne jamais écrire directement dans la sauvegarde d'un autre écran : passer
  par un drapeau en attente, lu par l'écran propriétaire à son prochain
  chargement.
- Ne jamais appeler un `setState` depuis l'updater d'un autre `setState`.

Tester en sandbox avant de pousser avec `node -e ...` + Babel (méthode déjà
utilisée partout dans ce projet), au minimum sur la logique pure.

## 5. Publication

Un robot GitHub Actions publie automatiquement à chaque push sur `main`
touchant `mobile/**` (`.github/workflows/mobile-publish.yml`).

Les **logs GitHub Actions ne sont pas accessibles depuis le sandbox**. Pour
diagnostiquer, faire écrire l'information dans le message d'update (visible
sur le téléphone) ou s'appuyer sur le gestionnaire d'erreurs global de
`index.js`.

Si l'utilisateur dit « il n'y a pas de changement » :
1. Vérifier **d'abord** qu'un run existe pour le dernier sha via l'API
   GitHub (`/actions/runs`, chercher le `head_sha`). C'est déjà arrivé que
   GitHub rate l'événement (commit `a2e8f11`).
2. `workflow_dispatch` par l'API renvoie 403 (le jeton n'a pas
   `actions: write`). La seule relance fiable est de repousser un commit
   touchant `mobile/**`.
3. Ne conclure à un cache Expo qu'après ces deux vérifications.

Un fichier hors de `mobile/**` ne déclenche aucune publication : c'est le bon
endroit pour la documentation et l'outillage qui ne concernent pas l'app.

## 6. Fin de tâche — mise à jour de la doc

Mettre à jour `mobile/CLICKER_ADVENTURE_STATE.md` à chaque changement
structurant, en écrivant **la cause réelle** du bug corrigé, pas juste le
symptôme. C'est un état actuel, pas un historique : si une section devient
fausse, la corriger sur place plutôt qu'ajouter une note en dessous.

## 7. Ton attendu

L'utilisateur veut des réponses courtes, tranchées, actionnables, avec un
code couleur 🟩 validé / 🟥 à éviter / 🟨 à surveiller / 🟦 contexte. Pas de
blabla, pas de remplissage, pas de question en fin de réponse sauf si une
info manque vraiment. S'il propose une mauvaise idée, le dire et proposer la
version corrigée.

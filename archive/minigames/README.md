# Mini-jeux archivés (retirés de l'appli le 06/09)

Les 13 mini-jeux ont été **retirés de l'application** mais **pas supprimés** :
tout leur code est ici, intact, avec son historique Git complet (déplacés avec
`git mv`, donc `git log --follow` fonctionne sur chaque fichier).

**Raison du retrait** : trop de surface à maintenir en parallèle du
Clicker/Aventure, qui est devenu le cœur du jeu.

## Pourquoi ce dossier est à la RACINE du dépôt

Metro (l'empaqueteur d'Expo) prend `mobile/` comme racine de projet. Tout ce
qui est **hors de `mobile/`** n'est ni surveillé ni empaqueté, même par
accident. C'est ce qui garantit que ces fichiers :

- n'entrent plus dans le bundle de l'appli,
- ne peuvent plus provoquer d'erreur au démarrage,
- ne ralentissent plus le rechargement à chaud.

Les mettre dans un sous-dossier de `mobile/` (genre `mobile/src/_archive/`)
n'aurait PAS suffi : Metro les aurait toujours surveillés.

## Ce qu'il y a ici

| Dossier | Contenu | Emplacement d'origine |
|---|---|---|
| `screens/` | Les 13 écrans de jeu | `mobile/src/screens/games/` |
| `logic/` | La logique de chaque jeu (1 dossier par jeu) | `mobile/src/games/` |
| `assets/flappybird/` | Sprites de Flappy Bird (seul jeu avec des assets) | `mobile/assets/flappybird/` |

Jeux concernés : Morpion, Puissance 4, 2048, Memory, Snake, Puzzle 15, Sudoku,
Nuts and Bolts, Flappy Bird, Wordle, Billard, Ping-pong, Traceur de Runes.

## Restaurer un jeu (ou tous)

Rien n'a été modifié à l'intérieur des fichiers : les imports relatifs qu'ils
contiennent (`../../components/CoinBar`, `../../context/CoinsContext`,
`../../hooks/useBackGesture`, `./clickerTheme`, etc.) sont exactement ceux
d'avant et **redeviennent valides dès que les fichiers retrouvent leur
emplacement d'origine**. Il n'y a donc aucun chemin à corriger.

Pour restaurer, il faut :

1. Remettre l'écran voulu dans `mobile/src/screens/games/`.
2. Remettre son dossier de logique dans `mobile/src/games/`.
3. Pour Flappy Bird uniquement, remettre `assets/flappybird/` dans
   `mobile/assets/`.
4. Dans `mobile/src/screens/JeuxScreen.js`, remettre les deux choses
   supprimées pour ce jeu :
   - la ligne d'import de l'écran, en haut ;
   - son entrée dans le tableau `GAMES` ;
   - son bloc `if (openGame === '<clé>') { return <XxxScreen onBack={...} />; }`.

Le détail exact de ce qui a été retiré de `JeuxScreen.js` est visible avec :

```
git show <commit-du-retrait> -- mobile/src/screens/JeuxScreen.js
```

## Ce qui a été gardé dans l'appli

- **Les pièces** (`CoinsContext`, `CoinBar`) : conservées telles quelles. Elles
  seront remplacées par une autre monnaie plus tard.
- `useBackGesture`, `ErrorBoundary`, `clickerTheme` : partagés, toujours
  utilisés par le Clicker/Aventure.
- `mobile/src/games/clicker/` : logique du Clicker, de l'Aventure et des
  quêtes quotidiennes — n'a jamais fait partie des mini-jeux.

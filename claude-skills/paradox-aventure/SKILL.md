---
name: paradox-aventure
description: Design et code des écrans de Projet Paradox — mode Aventure, carte des chapitres, décors, fiches de créature, écran de combat, boutique, inventaire, runes, incubateur, et tous les pièges d'affichage React Native déjà rencontrés sur ce projet. Déclenche ce skill dès qu'il est question de modifier un écran, une mise en page, un cadre, un décor, un chapitre, une transition, une surcouche, l'orientation paysage, ou dès qu'un symptôme visuel est signalé — écran blanc, zone qui ne répond plus au tap, élément coupé, superposition, décalage. Applique-le en plus du skill paradox-socle.
---

# Écrans et mode Aventure

Fichiers concernés : `ClickerScreen.js` (~3900 lignes), `AdventureScreen.js`
(~3100), `CombatScreen.js` (~1100), plus `clickerTheme.js`, `cardFrames.js`,
`elementThemes.js`.

⚠️ `clickerTheme.js` est un fichier séparé **exprès** pour éviter un import
circulaire entre ClickerScreen et AdventureScreen. Ne pas y toucher.

Lire les sections « RÈGLES DE SURVIE » et les 15 pièges numérotés de
`mobile/CLICKER_ADVENTURE_STATE.md` avant de modifier un écran. Ils échouent
tous **en silence** : rien ne plante, rien n'apparaît dans les logs, l'écran
s'affiche normalement mais ne répond plus.

## Les pièges qui coûtent une session

- 🟥 **Une vue qui déborde de son parent ne reçoit aucun tap sur Android.**
  C'est la première hypothèse à tester quand une zone ne répond plus.
- 🟥 **`pointerEvents` en prop est ignoré** (New Architecture, SDK 57). Le
  mettre dans le style.
- 🟥 **Pas de dégradé plein écran** sur le ClickerScreen.
- 🟥 **Ne jamais mélanger** un `position:'absolute'` isolé avec des frères en
  flux normal.
- 🟥 Un conteneur de centrage doit avoir une **hauteur explicite**.
- 🟥 `flex: 1` sans `minWidth: 0` pousse le voisin hors de la ligne.
- 🟥 Une marge en pourcentage se calcule sur la **largeur**, même verticale.
- 🟥 Une surcouche ne démonte pas l'écran en dessous : ses timers et ses
  effets continuent de tourner.
- 🟥 `<Image>` sans `resizeMode` explicite rogne en haut/bas.
- 🟥 `<Image style={StyleSheet.absoluteFill}>` se dessine à sa taille native.
- 🟥 Un style empilé après une boîte mesurée l'écrase.
- 🟦 iOS et Android divergent : deux pièges distincts documentés au 07/09.
- 🟦 Un seul écran est responsable de l'orientation d'un mode (Aventure est
  en paysage). Ne pas répartir cette responsabilité.

## Méthode quand quelque chose casse

1. Demander à l'utilisateur **quand ça marchait encore**.
2. Restaurer ce commit exact, réappliquer les changements un par un avec un
   test à chaque étape.
3. Si le doute porte sur les entrées utilisateur, poser un **compteur de
   diagnostic** visible à l'écran (cadence de taps réellement reçue). Cet
   outil a déjà écarté d'un coup toutes les pistes de performance en
   prouvant que les taps se perdaient avant le code.
4. Les logs Actions ne sont pas lisibles depuis le sandbox : faire écrire
   l'info de diagnostic dans le message d'update, visible sur le téléphone.

## Carte et chapitres

Chapitres 1 à 8 en place, une page par chapitre, transition par fondu au
défilement. Procédure définitive pour un nouveau décor et les deux méthodes
de calage selon ce que l'IA a peint : section « Décor par chapitre — méthode »
du fichier d'état. Points à ne pas redécouvrir :

- Le chemin n'est **jamais** peint par l'IA, il est posé à la main.
- Les tracés sont posés à la main, 4 variantes, une par chapitre.
- Surveiller le nombre de pages affichées et la mémoire des décors.
- Un décalage de 4 px sur les nœuds a déjà été trouvé : vérifier l'alignement
  après tout changement de décor.

## Édition de ces gros fichiers

- 🟥 Ne jamais découper le fichier de logique par `index("\n## ")`.
- 🟥 Jamais de regex DOTALL pour supprimer un bloc entre accolades.
- Après toute suppression en masse : comparer les déclarations de premier
  niveau avant/après (`grep -c "^function X"` doit donner 1).
- Après tout ajout de prop : croiser props déclarées et props passées.
- Après tout changement de style : croiser composants React Native utilisés
  et importés.
- Ne jamais reprendre un commit en bloc.

## Fin de tâche

Mettre à jour la section concernée de `CLICKER_ADVENTURE_STATE.md`, en
décrivant la cause réelle si un bug d'affichage a été corrigé. Si un nouveau
piège apparaît, l'ajouter à la liste numérotée.

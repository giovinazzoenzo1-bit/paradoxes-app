---
name: paradox-creatures
description: Pipeline complet des créatures de Projet Paradox — création d'un monstre, intégration d'une réponse Gemini collée par l'utilisateur, stats et rareté, noms de compétences, et illustrations (génération, détourage, intégration des assets). Déclenche ce skill dès qu'il est question d'ajouter, modifier, dessiner, illustrer, détourer, équilibrer ou renommer une créature, un monstre, un sprite, une carte de créature, une évolution, un roster, une rareté ou un élément — y compris quand l'utilisateur colle simplement un bloc de texte au format NOM / ELEMENT / RARETE / ROLE sans rien demander d'autre. Applique-le en plus du skill paradox-socle.
---

# Créatures — données et illustrations

Deux voies distinctes, souvent demandées ensemble. Identifier laquelle est
demandée avant de commencer : la voie A ne touche que la logique, la voie B
ne touche que les assets.

Lire avant : la section « Workflow de création de monstres (Gemini) », la
section « Créatures — schéma de données actuel » et la section « Système de
combat » de `mobile/CLICKER_ADVENTURE_STATE.md`, plus
`mobile/CREATURE_ART_ROADMAP.md` si la tâche touche à l'illustration.

---

## Voie A — intégrer une créature (données)

L'utilisateur génère ses monstres avec Gemini et colle la réponse brute.
Format attendu : `NOM / ELEMENT / RARETE / ROLE / HISTOIRE / ATTAQUE1..4`
avec pour chaque attaque `nom | dégâts | coût endurance`.

⚠️ Une version plus récente du prompt Gemini peut inclure les stats
PV/ATQ/vitesse/endurance. Vérifier ce que contient réellement le bloc collé
avant d'appliquer la formule par rareté.

Étapes :

1. **Collisions de noms.** Vérifier qu'aucun nom de créature **ni de
   compétence** n'existe déjà dans `CREATURES` (`clickerLogic.js`). C'est
   déjà arrivé (Solarion vs le 3e stade de Lumeret, renommé « Astrélios »).
   Une collision de nom de compétence est plus discrète et tout aussi
   cassante.
2. **Ajouter l'entrée** dans `CREATURES` avec :
   - `combatType` en minuscules : `attaquant` / `soutien` / `tank`
   - `rarity` en minuscules **sans accent** : `commun`, `peu_commun`, `rare`,
     `epique`, `legendaire`, `mythique`
   - 3 stades répétant le même nom et le même emoji (les créatures Gemini
     n'ont pas de vraies évolutions)
   - 4 compétences, chacune avec `damage` **et** `enduranceCost`
3. **Stats** : si Gemini fournit des stats explicites, les utiliser telles
   quelles plutôt que la formule par rareté de `combatLogic.js`.
4. **Poids de tirage** : si la rareté est à poids 0 dans `RARITY_WEIGHTS`
   (`peu_commun`, `mythique`), la créature ne sortira jamais. Remonter le
   poids ou le signaler explicitement à l'utilisateur.
5. **Tester avant de pousser**, en `node -e` + Babel :
   - la créature apparaît bien dans `CREATURES`
   - ses 4 compétences ont `damage` + `enduranceCost`
   - son tirage est possible avec les poids actuels
6. Si la créature change la puissance moyenne du roster, enchaîner sur le
   skill `paradox-equilibrage` avant de pousser.

---

## Voie B — illustrations et assets

Assets dans `mobile/assets/creatures/`, `combat/`, `adventure/`, `themes/`,
`icons/`. Décisions déjà prises : Lottie pour les animations, structure
décrite dans `CREATURE_ART_ROADMAP.md`.

Pièges d'affichage déjà payés, à appliquer systématiquement :

- 🟥 `<Image>` sans `resizeMode` explicite **rogne en haut et en bas** : le
  défaut est `cover`, pas `contain`. Toujours l'écrire.
- 🟥 `<Image style={StyleSheet.absoluteFill}>` se dessine à sa **taille
  native**, pas à la taille du parent. Passer par des dimensions explicites.
- 🟥 Un dégradé exporté en PNG doit retomber à **alpha 0 avant son bord**,
  sinon une arête visible apparaît sur le téléphone.
- 🟥 Un style empilé **après** une boîte mesurée l'écrase.

Détourage — deux méthodes, ne pas les confondre :

- **Aplats de couleur** : méthode de détourage standard décrite dans la
  section « Méthode de détourage » du fichier d'état.
- **Aérographe / dégradés doux** : méthode différente, décrite juste
  au-dessus dans le même fichier. Utiliser la mauvaise laisse un halo.
- **Filigrane sur un cadre symétrique** ou **posé sur une texture** : deux
  procédures distinctes, documentées. Ne pas improviser.

Prompt de génération : les consignes qui marchent sont listées dans la
section « Consignes de prompt qui marchent ». Les réutiliser telles quelles
plutôt que d'en réécrire un.

Vérifier enfin qu'un asset attendu par le code existe vraiment : la croix du
panneau d'inventaire avait été effacée de l'asset lui-même, pas du code.

---

## Règle de fin

Après ajout d'une créature ou d'un asset, mettre à jour la section
correspondante de `CLICKER_ADVENTURE_STATE.md` (roster, poids de rareté,
liste des fichiers ajoutés) avant de pousser.

---
name: paradox-equilibrage
description: Équilibrage chiffré de Projet Paradox — difficulté des combats en Aventure, dégâts, PV, endurance, mana, courbe de progression, prix de la boutique, gains de Griffes/Diamants, seuils d'Ascension, cibles des défis de l'œuf, poids de rareté. Impose de MESURER par simulation avant de changer une valeur. Déclenche ce skill dès qu'une valeur numérique du jeu doit bouger, dès que l'utilisateur dit que c'est trop dur, trop facile, trop lent, trop cher, qu'il bloque à un niveau ou à un chapitre, ou qu'il demande de revoir une courbe, un ratio, un barème ou un gain. Applique-le en plus du skill paradox-socle.
---

# Équilibrage — mesurer avant de toucher

Règle centrale du projet : **les leviers se composent, l'intuition se
trompe.** Plusieurs recalibrages ont déjà été faits à l'aveugle puis annulés.
Aucune valeur ne bouge sans mesure avant/après.

Logique pure, sans dépendance UI, donc simulable directement en sandbox :
`mobile/src/games/clicker/clickerLogic.js` et
`mobile/src/games/clicker/combatLogic.js`.

## Protocole obligatoire

1. **Extraire les formules réelles** du code, pas de mémoire. Repérer tous
   les leviers qui touchent la grandeur visée (stats de rareté, modificateurs
   de rôle, affinités élémentaires, runes, niveau, chapitre, nombre
   d'adversaires, améliorations achetées).
2. **Écrire un simulateur** en `node -e` + Babel qui importe la logique
   réelle et sort un tableau : niveau → puissance joueur, puissance adverse,
   ratio, temps de combat estimé.
3. **Mesurer l'état actuel** et le présenter à l'utilisateur sous forme de
   tableau avant toute proposition.
4. **Changer UN levier à la fois**, re-mesurer, comparer. Deux leviers
   changés ensemble rendent le résultat ininterprétable.
5. **Ne pousser que si la courbe cible est atteinte** sur toute la plage
   testée, pas seulement au point qui posait problème.
6. Consigner la mesure avant/après dans `CLICKER_ADVENTURE_STATE.md`.

## Constantes de calibrage

- 🟦 Les tests de l'utilisateur supposent un **autoclicker à 150 ms**, soit
  ≈ 6,7 clics/s. Tout l'équilibrage est calé sur ce rythme. Une mesure faite
  à un autre rythme n'est pas comparable.
- 🟦 Le rythme de clic manuel réel mesuré est très supérieur ponctuellement :
  ne pas équilibrer dessus, mais le garder en tête pour les bornes hautes.
- 🟦 La difficulté doit **croître palier après palier**, jamais par marche.

## Chantier en cours — difficulté des combats en Aventure

Mesures actuelles du ratio puissance adverse / puissance joueur :

| Niveau | Ratio |
|---|---|
| 1–10 | 1,0 |
| 15 | 2,3 |
| 25 | 4,9 |
| 40 | 8,6 |

Cause identifiée : l'arrivée du 2e puis du 3e adversaire (chapitres 2 et 3)
n'est compensée par rien côté joueur.

Hypothèse à vérifier par simulation : **cercle vicieux** — perdre → pas de
Griffes → pas de montée de niveau → perdre. Si la simulation le confirme, le
correctif doit casser la boucle (gain minimal en cas de défaite, ou montée
garantie), pas seulement baisser les stats adverses.

Leviers disponibles, à tester un par un :
- stats de base par rareté (`combatLogic.js`)
- modificateurs par rôle de combat
- courbe de niveau des adversaires par chapitre
- nombre d'adversaires par chapitre
- gains de Griffes par combat et barème d'amélioration des créatures
- affinités élémentaires, runes (Célérité s'applique à toutes les attaques,
  Dextérité donne aussi des dégâts depuis le buff du 12/09)

⚠️ Effet de bord déjà mesuré : la fusion de runes est 1,6× plus lente depuis
le passage à 7 types. En tenir compte dans toute simulation de revenu.

## Interdits

- 🟥 Ne jamais patcher des littéraux numériques à la regex : ça touche des
  valeurs homonymes ailleurs dans le fichier. Piège déjà rencontré.
- 🟥 Ne jamais annoncer un équilibrage « ressenti » sans tableau de mesure.
- 🟥 Ne jamais rendre un défi injouable : une précondition non atteignable
  bloque l'œuf **pour toujours**. Vérifier la faisabilité de chaque cible
  dynamique avant de pousser.
- 🟥 Ne pas dériver deux fois la même valeur en parallèle : une valeur
  affichée à côté d'une condition doit venir de cette condition.

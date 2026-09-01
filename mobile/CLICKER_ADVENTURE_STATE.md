# État actuel — Clicker + Aventure

> **Ce fichier est un état ACTUEL, pas un historique.** Contrairement à
> `PROJECT_STATE.md` (qui accumule des sections datées au fil des sessions
> et devient long), celui-ci décrit comment tout fonctionne EN CE MOMENT.
> S'il devient faux après un changement, corrige-le directement plutôt
> que d'ajouter une note en plus. Objectif : qu'une nouvelle session
> Claude puisse lire UNIQUEMENT ce fichier + jeter un œil rapide aux 2
> fichiers de logique (`clickerLogic.js`, `combatLogic.js`) et être
> immédiatement opérationnelle, sans avoir à lire l'historique Git ni
> tout `PROJECT_STATE.md`.

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `mobile/src/games/clicker/clickerLogic.js` | Logique pure du clicker : roster de créatures, rareté, boutique auto-clics, quêtes, œuf. Aucune dépendance UI. |
| `mobile/src/games/clicker/combatLogic.js` | Logique pure du combat : stats, dégâts, chapitres/niveaux, évolution. Aucune dépendance UI. |
| `mobile/src/screens/games/ClickerScreen.js` | Écran principal du clicker (le plus gros fichier, ~1560 lignes). Onglets Tap/Shop/Quêtes/Collection, barre de nav du bas. |
| `mobile/src/screens/games/AdventureScreen.js` | Écran Aventure : liste des 3 créatures du deck, fiche détaillée, carte des chapitres. |
| `mobile/src/screens/games/CombatScreen.js` | L'écran de combat réel (tour par tour + défi de tap + endurance + rotation d'équipe). |
| `mobile/src/screens/games/clickerTheme.js` | Palette `COLORS` partagée entre ClickerScreen et AdventureScreen — **fichier séparé exprès** pour éviter un import circulaire entre les deux écrans. |
| `mobile/ADVENTURE_MODE.md` | Journal de conception du mode Aventure (décisions prises AVANT le code, avec un historique des étapes). Utile pour comprendre le "pourquoi", pas pour l'état actuel. |

## Navigation générale du Clicker

Barre de navigation en bas de `ClickerScreen.js` : **Shop | Quêtes | Collection | Aventure** (icônes `@expo/vector-icons`, pas d'images externes). L'écran d'accueil (`view === 'tap'`) est volontairement épuré : pièces, revenu/s, deck de 3 créatures, l'œuf central. Tout le reste vit dans les 4 onglets.

**Style visuel "Juicy"** : fond bleu-violet abysse très sombre (`COLORS.bg = '#07051a'`), éléments d'action avec lueur néon (shadowColor assorti à la couleur de bordure).

## Économie du Clicker

- Les **créatures ne produisent PLUS de pièces automatiquement** (refonte volontaire, en préparation du mode combat). La seule source de revenu passif est la **boutique d'auto-clics** (`AUTOCLICKERS`, 5 paliers : esprit → main → automate → colonie → titan), achetable plusieurs fois, coût croissant ×1,15 par unité déjà possédée.
- Boutons d'amélioration (Pacte, Faveur des Esprits, Sanctuaire, Veilleur, puis Offrande en dernier) : dans l'écran **Shop**, page "Améliorations". Page 2 du Shop = la boutique d'auto-clics.
- **Ascension** (prestige, essence permanente) : vit dans l'onglet **Quêtes**, pas dans Shop.
- **Invoquer une créature** (gacha) : vit dans l'onglet **Collection**, pas dans Shop.
- **Rituel** (bonus "pub" gratuit) : une bulle qui apparaît près de l'œuf (comme les pouvoirs de créature), pas un bouton ni une bannière.

## Créatures — schéma de données actuel

11 créatures dans `CREATURES` — le roster d'origine est en cours de remplacement progressif par des créatures générées via Gemini (l'utilisateur colle une réponse à la fois, je remplace la créature correspondante). Déjà remplacées : **pyrosile** (ex-braisillon, commun/feu/attaquant). Champs d'une entrée :

```js
{
  id: 'identifiant_unique',
  element: 'Feu' | 'Eau' | 'Terre' | 'Air' | 'Foudre' | 'Lumière' | 'Ténèbres' | 'Magie',
  rarity: 'commun' | 'peu_commun' | 'rare' | 'epique' | 'legendaire' | 'mythique',
  combatType: 'attaquant' | 'soutien' | 'tank',
  baseIncome: 0.15, // VESTIGE de l'ancien système de revenu passif — plus utilisé pour générer des pièces, gardé pour compatibilité de schéma
  skills: [ { id, name, damage, enduranceCost }, ... ], // exactement 4
  lore: "Histoire courte (1-3 phrases).",
  stages: [ { name, emoji }, { name, emoji }, { name, emoji } ], // 3 stades
}
```

**Important** : les 10 créatures d'origine ont 3 **noms et dessins distincts** par stade d'évolution (ex: Braisillon → Brasegriffe → Infernouve), débloqués aux niveaux 1/5/15 (`EVOLUTION_LEVELS` dans `clickerLogic.js`, système ANCIEN). **Solarion et les futures créatures Gemini n'ont PAS ce système** — leurs 3 stades répètent le même nom/emoji. Leur évolution passe par un système SÉPARÉ (voir plus bas, "Évolution par palier"), qui ne change pas le nom.

### Rareté (6 paliers)
```
RARITY_WEIGHTS = { commun: 70, peu_commun: 0, rare: 18, epique: 9, legendaire: 3, mythique: 0 }
```
`peu_commun` et `mythique` sont à **poids 0** — aucune créature actuelle n'a ces raretés. Dès qu'une créature (nouvelle via Gemini, ou une existante reclassée) obtient cette rareté, remonter son poids dans `RARITY_WEIGHTS` (sinon le tirage gacha peut planter sur un panier vide — un garde-fou existe dans `rollCreature()` mais mieux vaut resynchroniser les poids).

Badges de rareté (façon Monster Legends, affichés à gauche du portrait dans la fiche créature) :
```
RARITY_BADGE_LETTER = { commun: 'C', peu_commun: 'UC', rare: 'R', epique: 'E', legendaire: 'L', mythique: 'M' }
RARITY_COLOR = { commun: doré, peu_commun: bronze, rare: rouge, epique: vert, legendaire: violet, mythique: orange }
```

## Système de combat

### Stats de base par rareté (`combatLogic.js`)
```
RARITY_BASE_STATS = {
  commun:     { hp: 10,  attack: 3,   clickSpeed: 1.0, endurance: 60 },
  peu_commun: { hp: 23,  attack: 6,   clickSpeed: 1.2, endurance: 75 },
  rare:       { hp: 52,  attack: 14,  clickSpeed: 1.4, endurance: 95 },
  epique:     { hp: 119, attack: 29,  clickSpeed: 1.8, endurance: 120 },
  legendaire: { hp: 272, attack: 62,  clickSpeed: 2.2, endurance: 150 },
  mythique:   { hp: 620, attack: 132, clickSpeed: 2.8, endurance: 190 },
}
```
Cette formule ne sert plus QUE de repli pour les créatures qui n'ont pas encore de stats explicites — **depuis Pyrosile (29/08), le système préfère les stats propres à chaque créature** quand elles existent (voir section Workflow Gemini plus bas). Calibrée à l'origine pour reproduire les stats de Solarion (le 1er monstre Gemini) — toujours vraie pour lui puisqu'il n'a pas de champs `baseHp` explicites (repose encore sur cette formule).

### Stats propres à une créature (remplacent la formule par rareté)
Champs optionnels sur une entrée de `CREATURES` : `baseHp`, `baseAttack`, `baseClickSpeed`, `baseEndurance`. **S'ils existent, `combatStatsForCreature`/`combatStatsForCreatureTyped`/`opponentStatsForLevel`/`opponentStatsForLevelTyped` les utilisent directement**, SANS appliquer le multiplicateur de rôle (`MONSTER_TYPES`) par-dessus — Gemini a déjà le rôle en tête au moment de choisir ses chiffres, l'appliquer une 2e fois fausserait tout. Seule la croissance par niveau (`levelMult`/`growth`) continue de s'appliquer sur ces stats de base.

### Modificateurs par rôle de combat
```
MONSTER_TYPES = {
  attaquant: { hpMult: 0.8, attackMult: 1.3 },
  soutien:   { hpMult: 1.0, attackMult: 0.95 },
  tank:      { hpMult: 1.4, attackMult: 0.75 },
}
```
Toujours utiliser `combatStatsForCreatureTyped(creature, level, evolutionTier)` (jamais la version non-typée `combatStatsForCreature`) pour obtenir les vraies stats de combat — sinon le modificateur de rôle n'est pas appliqué (bug réel rencontré et corrigé une fois déjà).

### Le défi de tap (une attaque)
- **25 taps** (`TAP_CHALLENGE_COUNT`) en **12 secondes** (`TAP_CHALLENGE_TIME_LIMIT_SEC`) — 25 au lieu de 50 pour la phase de développement actuelle (demande explicite, à remonter si besoin une fois l'équilibrage validé).
- Vitesse d'exécution → multiplicateur de dégâts : x1 (lent) à x2,5 (rapide, ≤4s), interpolation linéaire entre les deux. Pas complété à temps → x0,5 fixe (jamais 0, l'attaque part toujours).
- **Attaque de secours gratuite** ("Attaque de base", 0 endurance, ~40% de la stat ATQ) toujours disponible même à endurance épuisée — pour joueur ET adversaire IA. Sans ça, un combat pourrait se bloquer si personne ne peut plus rien payer.

### Combat en équipe de 3
- Les 3 créatures du **deck actuel du clicker** (même deck que les bulles de pouvoir) combattent, PAS une sélection séparée.
- **Rotation à CHAQUE attaque** (pas seulement quand un combattant tombe K.O.) — demande explicite pour varier le combat. Rotation circulaire (`nextLivingIndex()` dans `CombatScreen.js`), saute les combattants K.O.
- Défaite seulement quand les 3 sont K.O.
- **Pas de minuteur automatique entre les tours** — un bug réel a été causé par un `setTimeout` qui pouvait se bloquer silencieusement. Remplacé par un bouton "Continuer" explicite que le joueur doit taper. Ne jamais réintroduire une transition de phase automatique par minuteur dans ce fichier sans un filet de sécurité manuel.

### Chapitres et niveaux
- 10 niveaux par chapitre (`LEVELS_PER_CHAPTER`). Adversaire choisi de façon DÉTERMINISTE (`opponentForLevel`, cycle sur le roster) — pas aléatoire, même niveau = même adversaire à chaque tentative.
- **Carte persistante** façon Monster Legends (PAS une tour qu'on redescend en cas de défaite, contrairement à l'idée de départ) : un niveau gagné reste acquis. Défaite = juste réessayer, sans perdre la progression déjà faite.
- Progression (`currentUnlockedLevel`) et ressource **Griffes** stockées dans une sauvegarde SÉPARÉE de celle du clicker (`adventure:state:v1`, gérée dans `AdventureScreen.js`) — pas dans la sauvegarde du clicker classique.

### Évolution par palier (créatures SANS changement de nom — Solarion et futures créatures Gemini)
```
EVOLUTION_LEVEL_REQUIREMENT = [0, 25, 50]   // niveau requis pour débloquer le palier 1, 2
EVOLUTION_STAT_MULTIPLIER   = [1.0, 1.3, 1.7] // boost PV/ATQ/Endurance (jamais la vitesse de clic)
EVOLUTION_GRIFFES_COST      = [0, 40, 100]  // coût en Griffes pour débloquer le palier
```
Pas automatique — le joueur doit avoir le niveau requis ET dépenser les Griffes (bouton dans la fiche créature, écran Aventure). `owned.evolutionTier` (0/1/2) stocké dans la collection du clicker (`ClickerScreen.js`), mais la vérification d'éligibilité + la dépense des Griffes se font côté `AdventureScreen.js` (qui possède l'état Griffes) — le clicker ne fait que persister le palier via `onEvolveCreature`.

## Workflow de création de monstres (Gemini)

L'utilisateur utilise Gemini pour générer de nouveaux monstres, qu'il colle ensuite dans la conversation. **Prompt actuel donné à Gemini** (dernière version en date, 29/08) :

```
Tu es mon créateur de créatures pour mon jeu vidéo iOS/Android.

Éléments possibles : Feu, Eau, Terre, Air, Foudre, Lumière, Ténèbres, Magie
Rareté possibles : Commun, Peu Commun, Rare, Épique, Légendaire, Mythique
Rôles possibles : Attaquant, Tank, Soutien

Quand je te donne (Rareté + Élément + Rôle), crée UN monstre avec :
- Un nom UNIQUE (jamais utilisé dans une réponse précédente)
- Une histoire courte (2-3 phrases)
- 4 attaques au nom unique, avec pour chacune : dégâts + coût en endurance
Si je te donne un nom de monstre alors garde le.

Réponds TOUJOURS dans ce format exact, sans rien ajouter autour :

NOM: [nom]
ELEMENT: [élément]
RARETE: [rareté]
ROLE: [rôle]
HISTOIRE: [2-3 phrases]
ATTAQUE1: [nom] | [dégâts] | [coût endurance]
ATTAQUE2: [nom] | [dégâts] | [coût endurance]
ATTAQUE3: [nom] | [dégâts] | [coût endurance]
ATTAQUE4: [nom] | [dégâts] | [coût endurance]
```
(L'utilisateur a aussi demandé oralement d'ajouter les stats PV/ATQ/vitesse/endurance dans le format — à vérifier dans la conversation en cours si une version plus récente du prompt existe avant d'intégrer un nouveau monstre.)

**Quand l'utilisateur colle une réponse Gemini** :
1. Vérifier qu'aucun nom (créature OU compétence) n'entre en collision avec le roster existant (`CREATURES` dans `clickerLogic.js`) — une collision est déjà arrivée une fois (Solarion vs le 3e stade de Lumeret, renommé en "Astrélios" pour la libérer).
2. Ajouter l'entrée dans `CREATURES` avec `combatType` en minuscules (`attaquant`/`soutien`/`tank`), `rarity` en minuscules sans accent (`epique`, `legendaire`), 3 stades répétant le même nom/emoji (pas de vraies évolutions pour les créatures Gemini).
3. Si Gemini fournit des stats explicites (PV/ATQ/vitesse/endurance), **les utiliser directement** plutôt que la formule par rareté — voir "Point ouvert" ci-dessous pour la validation.
4. Tester (`node -e ...` avec Babel, méthode déjà utilisée partout dans ce projet) avant de pousser : au minimum vérifier que la créature apparaît dans `CREATURES`, que ses 4 compétences ont bien `damage` + `enduranceCost`, et si c'est une rareté à poids 0 (`peu_commun`/`mythique`), remonter son poids dans `RARITY_WEIGHTS`.

## Points ouverts / pas encore tranchés

- **Validation des stats Gemini** : le système accepte maintenant les stats explicites par créature (`baseHp` etc., voir section dédiée plus haut), mais **aucun garde-fou de cohérence n'est codé** — l'utilisateur avait demandé une validation contre une fourchette raisonnable (±30% autour de la formule par rareté) plutôt qu'une acceptation silencieuse. Écart déjà repéré une fois (Pyrosile : endurance 100 donnée par Gemini vs 60 attendu par la formule, +67%, signalé à l'utilisateur mais pas bloqué). Toujours pas de garde-fou automatique — à construire si les écarts deviennent fréquents ou gênants.
- **Boutique pour dépenser les Griffes** au-delà de l'évolution — pas construite.
- **"Peu commun" et "Mythique"** : toujours aucune créature classée dedans.
- **Stats inter-jeux** (pour débloquer les quêtes liées aux autres jeux de l'appli comme Puissance 4) — brique technique jamais commencée.

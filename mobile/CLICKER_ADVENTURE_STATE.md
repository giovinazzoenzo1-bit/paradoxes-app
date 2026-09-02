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

Barre de navigation en bas de `ClickerScreen.js` : **Shop | Collection | Aventure** (icônes `@expo/vector-icons`, pas d'images externes). L'écran d'accueil (`view === 'tap'`) contient : pièces, revenu/s, **barre de défi**, deck de 3 créatures, l'œuf central.

**L'onglet Quêtes n'existe plus** (02/09) — voir la section « Défis de l'œuf sur l'écran d'accueil » plus bas. Le composant `QuestsView` a été supprimé, ainsi que la valeur `'quests'` de `view`. L'**Ascension**, qui vivait dedans, est désormais en bas de la page « Améliorations » du **Shop**, juste après l'Offrande.

**Style visuel "Juicy"** : fond bleu-violet abysse très sombre (`COLORS.bg = '#07051a'`), éléments d'action avec lueur néon (shadowColor assorti à la couleur de bordure).

## Économie du Clicker

- Les **créatures ne produisent PLUS de pièces automatiquement** (refonte volontaire, en préparation du mode combat). La seule source de revenu passif est la **boutique d'auto-clics** (`AUTOCLICKERS`, 5 paliers : esprit → main → automate → colonie → titan), achetable plusieurs fois, coût croissant ×1,15 par unité déjà possédée.
- Boutons d'amélioration (Pacte, Faveur des Esprits, Sanctuaire, Veilleur, puis Offrande, puis les 20 améliorations de créatures, puis Ascension) : dans l'écran **Shop**, page "Améliorations". Page 2 du Shop = la boutique d'auto-clics (15 générateurs, liste continue).
- **Ascension** (prestige, essence permanente) : vit en bas de la page « Améliorations » du **Shop** (déplacée le 02/09 avec la suppression de l'onglet Quêtes).
- **Invoquer une créature** (gacha) : vit dans l'onglet **Collection**, pas dans Shop.
- **Rituel** (bonus "pub" gratuit) : une bulle qui apparaît près de l'œuf (comme les pouvoirs de créature), pas un bouton ni une bannière.

## Créatures — schéma de données actuel

26 créatures dans `CREATURES` (les 25 du plan d'origine + Solarion, qui précède ce plan et n'est jamais compté dedans) — **le plan des 25 premières créatures Gemini est TERMINÉ** (29/08-30/08, avec un décalage de comptage d'un cran corrigé en cours de route : Tartaroth avait été annoncé par erreur comme le 25e/dernier, alors qu'Arcanis — Mythique+Magie+Attaquant, exactement le dernier créneau de la liste — était le vrai 25e). Roster d'origine entièrement remplacé, puis agrandi jusqu'à 25 en suivant la répartition prévue (8 commun/6 peu commun/5 rare/3 épique/2 légendaire/1 mythique — **tous les paliers sont désormais représentés**, y compris mythique). Répartition par élément quasi exacte : 3 par élément (Feu/Eau/Air/Terre/Foudre/Magie/Ténèbres), Lumière à 4. Table de migration (`CREATURE_ID_MIGRATIONS`) à consulter pour la correspondance ancien→nouveau id des créatures d'origine remplacées. **Pour toute créature au-delà de ces 25, le processus reste identique** (voir section Workflow Gemini plus bas) : simple ajout, pas de contrainte d'ordre. Champs d'une entrée :

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

**Important** : les 10 créatures d'origine (toutes remplacées désormais) avaient 3 **noms et dessins distincts** par stade d'évolution (ex: Braisillon → Brasegriffe → Infernouve), débloqués aux niveaux 1/5/15 (`EVOLUTION_LEVELS` dans `clickerLogic.js`, système ANCIEN, plus utilisé par aucune créature actuelle mais toujours défini dans le code). **Toutes les créatures Gemini (les 25) n'ont PAS ce système** — leurs 3 stades répètent le même nom/emoji. Leur évolution passe par un système SÉPARÉ (voir plus bas, "Évolution par palier"), qui ne change pas le nom.

### Rareté (6 paliers)
```
RARITY_WEIGHTS = { commun: 40, peu_commun: 20, rare: 15, epique: 12, legendaire: 8, mythique: 5 }
```
**Tous les paliers sont désormais actifs** (0 crash vérifié sur 300 000 tirages) — c'est la 1ère fois que les 6 sont représentés en même temps. Si un nouveau palier venait à se vider à nouveau (aucune créature dedans), remettre son poids à 0 et rééquilibrer les autres (sinon le tirage gacha peut planter sur un panier vide — un garde-fou existe dans `rollCreature()` mais mieux vaut resynchroniser les poids).

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

### Combat en équipe de 3 (côté joueur) vs équipe adverse de 1 à 3 (30/08)
- Les 3 créatures du **deck actuel du clicker** (même deck que les bulles de pouvoir) combattent, PAS une sélection séparée.
- **Rotation à CHAQUE attaque côté joueur** (pas seulement quand un combattant tombe K.O.) — demande explicite pour varier le combat. Rotation circulaire (`nextLivingIndex()` dans `CombatScreen.js`), saute les combattants K.O.
- **Côté adversaire, rotation UNIQUEMENT au K.O.** (pas à chaque tour comme le joueur) — mécanique volontairement différente, pas demandée pour l'adversaire, pour ne pas inventer une règle non demandée. Un adversaire qui vient de tomber ne riposte pas ce tour-ci.
- **Pile ou face au début du combat** (`opponentGoesFirst()`) : 1 chance sur 2 que l'adversaire attaque en premier, avant même le 1er choix du joueur — résolu une seule fois au montage de l'écran, réutilise le même mécanisme "transition en attente + bouton Continuer" que les tours normaux.
- Défaite quand toute l'équipe du joueur est K.O. ; victoire quand toute l'équipe adverse est K.O.
- **Dégâts d'une compétence mis à l'échelle par le ratio ATQ actuel / ATQ de base** (`scaledSkillDamage` dans `combatLogic.js`) — nourrir/faire évoluer une créature rend VRAIMENT ses attaques plus fortes (avant le 30/08, seule l'attaque de base gratuite utilisait l'ATQ, les compétences avaient des dégâts fixes indépendants du niveau). Ratio = 1 exactement au niveau 1/palier 0 → aucun changement de comportement pour une créature toute neuve.
- **Vitesse de clic** (`clickSpeed`, dépend de la rareté, jamais du niveau) réduit le NOMBRE DE TAPS requis pour le défi (`effectiveTapCount`), pas la fenêtre de temps — de 25 taps (commun) à 10 taps minimum (mythique, plancher de sécurité, jamais trivial).
- **Pas de minuteur automatique entre les tours** — un bug réel a été causé par un `setTimeout` qui pouvait se bloquer silencieusement. Remplacé par un bouton "Continuer" explicite que le joueur doit taper. Ne jamais réintroduire une transition de phase automatique par minuteur dans ce fichier sans un filet de sécurité manuel.

### Chapitres et niveaux
- 10 niveaux par chapitre (`LEVELS_PER_CHAPTER`). Adversaire choisi de façon DÉTERMINISTE — pas aléatoire, même niveau = même adversaire à chaque tentative.
- **Adversaires triés par puissance** (`CREATURES_BY_POWER` dans `combatLogic.js`, calculé une fois au chargement) : le niveau 1 tombe sur la créature la plus faible du roster (PV+ATQ de base), le niveau 26 sur la plus forte, puis ça reboucle — remplace l'ancien ordre arbitraire (ordre de définition dans `CREATURES`).
- **Taille de l'équipe adverse liée au CHAPITRE** (`opponentTeamSize`) : 1 adversaire au chapitre 1, 2 au chapitre 2, 3 à partir du chapitre 3 — mêmes repères que `LEVELS_PER_CHAPTER`, pas de seuil inventé à part.
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

## Points ouverts / pas encore tranchés (mis à jour 02/09)

- **Validation des stats Gemini** : toujours pas de garde-fou automatique (±30% autour de la formule par rareté) — accepté tel quel, écarts signalés au cas par cas mais jamais bloqués.
- **Objectifs de collection** ("possède 5 créatures Épiques+" etc.) — idée gardée de côté, jamais commencée.
- **Chapitre/rune "événement" limité dans le temps** — idée gardée de côté, jamais commencée.
- **`sol.png`** (dernier fichier de décor Flappy Bird) — toujours manquant depuis le tout début.
- ~~Boutique pour dépenser les Griffes~~ → **FAIT** (système de Runes, voir plus bas).
- ~~"Peu commun"/"Mythique" vides~~ → **FAIT**, les 25 créatures du plan sont là, tous les paliers de rareté représentés.
- ~~Stats inter-jeux~~ → **FAIT** (`DailyContext.js`, voir plus bas).

## Grosse session du 02/09 — résumé pour reprise rapide

Tout ce qui suit a été construit dans UNE session très longue le 2 septembre 2026. Le detail complet (raisonnement, tests, bugs corrigés) est dans le transcript de cette date si besoin, mais voici l'essentiel pour repartir sans tout relire.

### Mode Combat — refonte complète
- **Plein écran, mode PAYSAGE forcé** (`expo-screen-orientation`, verrouillé à l'entrée/sortie de `CombatScreen.js`).
- **Formation façon Monster Legends** : sprites en positionnement absolu (`PLAYER_SLOTS`/`OPPONENT_SLOTS`, fractions d'écran), pas de flexbox — l'actif devant en grand, profondeur derrière.
- **Décor réel** (`mobile/assets/combat/background.jpg`) avec voile sombre par-dessus.
- **Ciblage manuel** de l'adversaire à CHAQUE tour (tap sur un sprite adverse), plus de rotation automatique.
- **Pile ou face** en tout début de combat : 1 chance sur 2 que l'adversaire attaque en premier.
- **Plus de bouton "Continuer"** après une attaque du joueur — transition immédiate et synchrone (pas de minuteur, pour ne pas réintroduire le bug de blocage déjà corrigé une fois).
- **Dégâts flottants** au-dessus de la créature touchée (composant `FloatingDamage`).
- **Récapitulatif de fin de combat** (`CombatResultScreen`) : dégâts infligés/reçus, tours joués, adversaires vaincus, répartition par créature.
- **Équipe adverse** de 1 à 3 selon le chapitre (`opponentTeamSize`), adversaires triés par puissance (`CREATURES_BY_POWER`), difficulté strictement croissante jusqu'au niveau 100+ (`opponentPowerBudget`, découplé de la créature précise piochée — sinon régression de difficulté possible après le niveau 26).
- **Dégâts d'une compétence mis à l'échelle** par le ratio ATQ actuel/ATQ de base (`scaledSkillDamage`) — nourrir/évoluer une créature rend vraiment ses attaques plus fortes.
- **Vitesse de clic** dépend de la rareté (jamais du niveau), réduit le nombre de taps requis (`effectiveTapCount`, plancher à 10).
- **Croissance ATQ/PV par niveau** plafonnée à rendements décroissants après le niveau 50 (`levelMultiplier`).
- **Carte des chapitres** : tracés courbes en pointillés entre les niveaux (Bézier, positions en pixels — attention, un bug de mélange d'unités fraction/pixel avait rendu les points invisibles, corrigé), +6 chapitres de marge affichés à l'avance.
- **Énergie** : 1 vie/20 min, plafond 5, coûte 1 par tentative de combat (pas remboursée en cas de défaite), notification locale programmée pour l'instant où elle sera pleine (`expo-notifications`, protégé par try/catch). Bouton dev "Énergie au max" dans Options.

### Runes — nouveau système complet
- 4 types (Force/Vitalité/Endurance/Célérité), 5 paliers chacun, table de bonus validée avec l'utilisateur avant implémentation (voir `RUNE_BONUS_TABLE` dans `combatLogic.js`).
- Achat aléatoire (100 Griffes), fusion (écran dédié `RuneFusionScreen`, regroupe automatiquement les runes identiques — évite l'ancien système "tape 2 runes" peu intuitif).
- 3 cases d'équipement dans la fiche de chaque créature (Aventure), grisées si vides, sélecteur au tap.
- Bonus réellement appliqués aux stats de combat (`runeBonuses`, 4e paramètre optionnel de `combatStatsForCreatureTyped` — rétrocompatible, aucun changement sans rune équipée).
- Affichage coloré du bonus dans la fiche créature (+X PV en vert, +X ATQ en rouge, etc.).

### Quêtes quotidiennes + streak de connexion — nouveau système complet
- **`src/context/DailyContext.js`** : Context partagé app-wide (enveloppe `App.js`), c'est LA couche de stats inter-jeux qui manquait.
- **Pool mixte de 3 quêtes/jour** (`dailyLogic.js`), tirage déterministe par date, mélange volontaire Clicker/Aventure.
- **Streak neutre** (aucune mention de mode) : 7 paliers de Griffes qui rebouclent, affichage en vrai tableau de 7 jours (pas un compteur qui grimpe).
- Récompenses créditées via drapeau partagé `PENDING_GRIFFES_KEY` (lu par `AdventureScreen.js` à son prochain chargement — JAMAIS d'écriture directe cross-écran, leçon du bug de sauvegarde écrasée plus bas).
- **`lifetimeStats`** (compteurs à vie, jamais remis à zéro) alimente aussi 3 nouvelles quêtes Aventure dans le VIEUX pool de quêtes de l'œuf (`QUEST_POOL` dans `clickerLogic.js`), qui n'en avait aucune à l'origine.

### Cycle de quêtes de l'œuf (clicker) — 2 bugs réels corrigés
1. **Bascule collecte→éclosion parfois bloquée pour toujours** (ref périmée dans un `useEffect`) — corrigé avec un updater fonctionnel qui lit toujours l'état à jour.
2. **Quêtes de type "cumul total" instantanément acquises pour un joueur vétéran** (comparaison à un seuil absolu depuis toujours, pas depuis le tirage) — corrigé avec un `questBaseline` (instantané des stats au moment du tirage), migration douce pour les sauvegardes existantes.

### Défis de l'œuf sur l'écran d'accueil — suppression de l'onglet Quêtes (tout dernier ajout)

Objectif demandé : **supprimer le menu Quêtes du clicker**, pour que le
joueur doive casser le VRAI œuf de l'écran d'accueil afin d'obtenir une
créature — au lieu d'aller taper un second œuf dans un onglet à part.

- **Barre de défi segmentée** (`ChallengeBar` dans `ClickerScreen.js`),
  posée entre la bannière de pouvoir et le deck : libellé du défi
  au-dessus, puis une piste en gélule avec pastille d'icône à gauche,
  segments dorés au milieu, fraction `courant/objectif` à droite. Style
  repris d'une capture Monster Legends fournie par l'utilisateur.
- **Un seul défi affiché à la fois** : le premier non terminé des 4 du
  cycle (`currentChallenge`). Empiler les 4 recréerait exactement
  l'onglet qu'on vient de supprimer. Une ligne « Défi N sur 4 avant
  l'éclosion » sous la barre garde la progression du cycle visible.
- **Nombre de segments plafonné à 6** (`CHALLENGE_MAX_SEGMENTS`) :
  certains objectifs valent 20, 25 ou 5000 — un segment par unité
  donnerait des traits de 2px. Au-delà, un segment vaut plusieurs
  unités, mais la fraction à droite reste toujours la VRAIE valeur.
- **L'œuf central est devenu le seul œuf du jeu** : `handleTap` appelle
  aussi `handleEggTap()` dès que `eggPhase !== 'collecting'`. Le joueur
  ne change ni d'écran ni de geste ; le gain de pièces reste acquis
  pendant l'éclosion (aucune raison de le punir). Le texte sous l'œuf et
  l'emoji basculent selon la phase (🥚 « Tape pour casser l'œuf » →
  💫 « Tape pour capturer la créature »).
- La **même barre** sert de jauge d'éclosion/capture pendant ces phases —
  jamais deux barres concurrentes à l'écran.
- **`questDetail()`** (nouveau, `clickerLogic.js`) fournit icône, libellé
  et fraction. Son `current` est **dérivé de `questProgress()`**, jamais
  recalculé à part : deux sources de vérité auraient permis à la barre
  d'afficher 5/5 sur une quête non validée. Métadonnées `icon`/`target`
  ajoutées sur chaque entrée de `QUEST_POOL` (affichage seulement, aucun
  effet sur le calcul de progression).
- **Overlay de récompense remonté** au niveau de l'écran : la capture
  peut maintenant tomber depuis l'accueil, il serait invisible s'il
  restait dans un sous-composant supprimé.
- **Bug corrigé au passage** : les 4 quêtes à seuil absolu
  (`combo25`/`evolve1`/`feed10`/`pacte5`) lisaient `stats.X` sans
  garde-fou et renvoyaient **NaN** sur un objet de stats incomplet —
  invisible avant, mais la nouvelle barre l'aurait affiché tel quel
  (« NaN/25 »). Helper `abs()` ajouté dans `questProgress()`.
- **Paliers visuels de l'œuf réaffichés sur l'accueil** : `EGG_STAGES`
  existait déjà mais n'était rendu QUE dans l'onglet Quêtes — sa
  suppression avait fait disparaître tout retour sur l'état de l'œuf.
  Le nom du palier s'affiche sous l'œuf, et bordure/lueur/opacité
  s'intensifient palier par palier (`eggStageIndex`), sur l'écran où le
  joueur tape vraiment.
- **Secousse de l'œuf** (`eggShake`) jouée uniquement pendant l'éclosion
  et la capture : sans elle, les centaines de taps nécessaires n'avaient
  aucun retour distinct d'un tap de récolte normal. Séquence courte et
  symétrique qui revient toujours à 0, donc l'œuf ne peut pas rester
  figé de travers si le joueur tape en rafale.
- **Durci** : `eggStageForCompletedCount()` laissait passer NaN
  (`Math.min`/`Math.max` le propagent), ce qui aurait donné
  `EGG_STAGES[NaN]` puis un crash sur `.name`. Non atteignable
  aujourd'hui (`completedQuestCount` vient d'un `.length`), corrigé
  quand même.
- Vérifié par test : 0 divergence entre `questDetail().done` et
  `questComplete()` sur les 11 quêtes, à vide comme à plein ; 2000
  tirages de `pickQuestSet()` tous valides ; palier visuel dans les
  bornes sur 14 entrées limites (négatif, décimal, NaN, null, chaîne) ;
  aucun style orphelin dans les deux sens (20 styles morts de l'ancien
  onglet supprimés).

### Boutique du clicker — 20 améliorations + 15 auto-clics
- **20 améliorations de créatures** (`UPGRADE_ITEMS`) et **15 auto-clics** (`AUTOCLICKERS`), thème créatures/éléments.
- Bonus réellement appliqués : `upgradeBonuses()` agrège tapFlat/coinPct/autoClickerPct/critChancePct/critMultPct, câblé dans `gainCoins`, le tap, le revenu passif (live + hors-ligne).

**Refonte du 02/09 — ce sont maintenant des améliorations NORMALES.**
La première version était une grille d'objets à collectionner (achat
unique, 4 paliers, cases "❓ ??? ???" verrouillées). Ce n'était pas la
demande : il fallait de simples améliorations de plus, dans la
continuité du clicker. Donc :
- **Achat unique → niveaux** : chaque amélioration se monte jusqu'à
  `UPGRADE_MAX_LEVEL` (10), coût ×1,6 par niveau (`upgradeItemCost`,
  même forme que `veilleurUpgradeCost`), effet cumulé par niveau. Elles
  se lisent exactement comme Pacte/Faveur/Sanctuaire/Veilleur, juste
  au-dessus dans la même page.
- **Verrouillage par palier SUPPRIMÉ** des deux côtés :
  `upgradeTierUnlocked()` et `autoClickerTierUnlocked()` n'existent plus.
  Tout est visible dès le départ, listé par coût croissant — dans un
  clicker le prix suffit à échelonner la progression. `tier` survit sur
  les entrées mais ne sert **plus qu'à rien côté règles** (ordre
  historique uniquement).
- **`purchasedUpgradeIds` (tableau d'ids) → `upgradeLevels` (objet
  id→niveau)** dans la sauvegarde. `normalizeUpgradeLevels()` relit
  l'ancien format comme « niveau 1 chacune » : un joueur existant garde
  exactement les bonus qu'il avait, et peut désormais les monter plus
  haut. Vérifié par test : bonus recalculés identiques au centième près.
- `describeUpgradeTotal()` (ClickerScreen) affiche le cumul déjà acquis
  à côté du gain du prochain niveau — les 5 types d'effet n'ayant pas la
  même unité (2 plats, 3 pourcentages), le formatage est par type.
- **À surveiller (équilibrage)** : les 4 améliorations de chance
  critique toutes au niveau 10 donnent +90% de chance de crit cumulée.
  L'écran plafonne bien à 100% (`Math.min(1, …)` dans `handleTap`), donc
  aucun bug — mais en fin de partie la Faveur des Esprits devient
  quasiment inutile. Coût cumulé pour y arriver : plusieurs millions,
  donc c'est un endgame lointain, laissé tel quel pour l'instant.

### Leçons/pièges récurrents à ne pas reproduire
- **Ne jamais écrire directement dans la sauvegarde d'un AUTRE écran** (ex: Options → sauvegarde d'Aventure) — toujours passer par un drapeau/montant en attente, lu et appliqué par l'écran propriétaire à son PROCHAIN chargement. Un vrai bug de "sauvegarde remise à zéro" est arrivé une fois pour cette raison exacte.
- **Toujours vérifier les imports React Native** avant de pousser (`grep` les composants utilisés vs importés) — deux crashs différents cette session (`ScrollView` manquant dans `CombatScreen.js` puis dans un autre écran) venaient d'un import oublié après un changement de style.
- **Ne jamais appeler un `setState` depuis l'intérieur d'un updater d'un AUTRE `setState`** — risque de double déclenchement en mode strict de React (repéré et corrigé sur `fuseRunes`/`equipRune`).
- **Quand une valeur est affichée à côté d'une condition, la dériver de cette condition** — la fraction de la barre de défi vient de `questProgress()` plutôt que d'un recalcul parallèle, sinon barre pleine et quête non validée peuvent diverger.
- **Toujours vérifier qu'une déclaration de fonction n'a pas été accidentellement supprimée** lors d'une édition par bloc (`grep -c "^function NomDeLaFonction"` doit toujours donner 1) — arrivé 2 fois cette session (`FighterSelectOverlay` amputé de sa ligne de signature).


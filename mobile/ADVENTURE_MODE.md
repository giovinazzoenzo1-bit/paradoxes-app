# Mode Aventure / Combat — Design (pas encore codé)

> Ce fichier capture toutes les décisions prises AVANT de coder quoi que
> ce soit. Rien ci-dessous n'est implémenté pour l'instant — voir
> "Ordre d'ajout" tout en bas pour la marche à suivre.
> Inspiration visuelle : Monster Legends (captures fournies par
> l'utilisateur — carte de niveaux en chapitres avec sentier, fiche
> créature avec onglets Info/Compétences/Skins/Reliques).

## Décisions de fond (déjà tranchées)

- **Pas de capture pour l'instant** — le combat n'ajoute aucune nouvelle
  créature. Le gacha classique (Invoquer une créature) reste l'unique
  façon d'agrandir la collection. Évite d'avoir à dessiner/équilibrer un
  nouveau roster tout de suite.
- **Adversaires** : les 10 créatures existantes, pilotées par IA, stats
  mises à l'échelle selon le niveau/chapitre (pas de nouveau roster à
  dessiner pour l'instant).
- **Récompense de victoire** : une nouvelle ressource dédiée au combat,
  nom provisoire **"Griffes"** (à confirmer/changer) — dépensable plus
  tard dans une boutique de combat qui reste à concevoir.
- **Débloqué dès la 1ère créature obtenue** (cohérent avec ce qui a été
  dit dès le tout début du projet de mode combat).

## Structure de progression

- **Chapitres façon Monster Legends** : 1 chapitre = 10 niveaux.
  Noms des chapitres à trouver plus tard (pas bloquant pour coder).
- Difficulté croissante à chaque niveau — les stats de l'adversaire
  montent avec le numéro de niveau/chapitre.
- Écran combat : les niveaux s'enchaînent avec un tracé/sentier visuel
  (voir capture Monster Legends — pastilles reliées par un chemin, avec
  des étoiles de progression). Les ennemis spécifiques à chaque niveau
  seront ajoutés plus tard — pour l'instant, structure de la carte
  seulement.

## Écran principal du mode Aventure

- Affiche les **3 créatures du deck actuel** au centre de l'écran
  (réutilise le même deck que les bulles de pouvoir du clicker — pas de
  sélection séparée à gérer).
- Cliquer sur une créature → ouvre sa **page détail** (voir plus bas).
- **Barre en bas** de cet écran, pour les futurs modes de jeu qu'on
  ajoutera avec le temps. Pour l'instant, un seul item dedans :
  **"Mode Combat des chapitres"**.

## Page détail d'une créature (au clic, depuis l'écran principal)

Inspirée de l'onglet "Info" de Monster Legends — à minima :
- Histoire / lore de la créature
- Compétences (à définir — probablement liées aux pouvoirs de bulle déjà
  existants dans `CREATURE_POWERS`, ou de nouvelles compétences propres
  au combat, à trancher au moment de coder cet écran)
- Niveau actuel (déjà existant : `owned.level`)
- Rareté (déjà existant : `creature.rarity`)

## Mécanique de combat (déjà entièrement tranchée)

- **1 créature du joueur** (choisie avant de lancer le combat, PAS un
  changement automatique en cours de route) contre **1 adversaire IA**
  par niveau.
- **Un tour** :
  1. Le joueur tape pour lancer une attaque → défi de **50 taps** dans
     une fenêtre de **10-15 secondes**.
  2. La **vitesse d'exécution** détermine un multiplicateur de dégâts
     (lent/proche de la limite → x1, très rapide → jusqu'à x2.5,
     formule exacte à définir en codant la logique).
  3. Si les 50 taps ne sont pas complétés dans le temps imparti,
     l'attaque part quand même mais affaiblie (pas de coup perdu, juste
     un dégât réduit).
  4. L'adversaire riposte **automatiquement** selon ses propres stats
     (pas de tap demandé pour la défense — sinon un combat devient trop
     long).
  5. On répète jusqu'à ce que les PV d'un des deux camps tombent à 0.
- **Pas de soin entre les niveaux** d'une même tentative de montée — les
  PV restent ceux de la fin du niveau précédent, ce qui crée une vraie
  tension à mesure qu'on avance. Une défaite fait redescendre à l'étage
  1 pour la prochaine tentative, mais les récompenses déjà gagnées
  pendant la montée restent acquises.
- **Stats de combat** (PV, Attaque) dépendent de la **rareté** de la
  créature (commune → légendaire, plus fort) et de son **niveau actuel**
  (celui qu'on monte déjà en la nourrissant dans le clicker classique —
  ça donne enfin une 2e utilité concrète à ce système, au-delà de
  l'évolution visuelle).

## Ordre d'ajout (optimisé pour faciliter le codage)

Chaque étape doit être testable/livrable indépendamment, comme pour
toutes les fonctionnalités précédentes du clicker — pas de gros bloc
monolithique d'un coup.

1. ✅ **Logique pure de combat** (`combatLogic.js`, façon `clickerLogic.js`)
   — formules de PV/Attaque par rareté+niveau, formule du multiplicateur
   de dégâts selon la vitesse des 50 taps, schéma de numérotation
   chapitre/niveau, mise à l'échelle des stats adverses par niveau.
   Rien à l'écran encore, juste des fonctions testables.
   **FAIT** (29/08) — `mobile/src/games/clicker/combatLogic.js`, testé
   de bout en bout (stats, chapitres, adversaires déterministes,
   multiplicateur de vitesse, résolution de tours, combat complet
   simulé jusqu'à victoire).
2. ✅ **Écran principal Aventure** — remplace le placeholder "bientôt
   disponible" actuel (déclenché depuis la barre du bas). Affiche les 3
   créatures du deck + la barre du bas avec "Mode Combat des chapitres"
   pour l'instant seul item. Pas besoin de logique de combat pour cette
   étape, juste de l'affichage.
   **FAIT** (29/08) — `mobile/src/screens/games/AdventureScreen.js`,
   câblé depuis la barre du bas du clicker (`view === 'adventure'`, en
   retour anticipé pour ne pas empiler deux headers/deux barres de nav).
   Clic sur une créature = aperçu léger (pas encore la fiche complète,
   c'est l'étape 3). Palette `COLORS` extraite dans `clickerTheme.js`
   pour éviter un import circulaire entre les deux écrans.
3. **Page détail créature** — ouverte au clic sur une des 3. Surtout de
   l'affichage, réutilise les données déjà existantes (roster, niveau,
   rareté). Compétences peuvent rester un placeholder "à venir" à cette
   étape si pas encore tranché.
4. **Carte des chapitres/niveaux** (le sentier façon Monster Legends) —
   uniquement la structure visuelle de progression (niveaux
   verrouillés/débloqués/complétés), sans le vrai combat derrière —
   taper un niveau peut afficher un placeholder le temps de l'étape 5.
5. **Écran de combat réel** (le système de tour + défi de 50 taps) — la
   pièce la plus complexe, s'appuie sur tout ce qui précède. PV, tours,
   victoire/défaite, application des récompenses.
6. **Ressource "Griffes"** — ajout au modèle de données, persistance,
   affichage du gain à la victoire. La boutique pour la dépenser viendra
   dans une passe encore plus tardive, pas incluse dans cet ordre.

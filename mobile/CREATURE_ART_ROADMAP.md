# Feuille de route — Illustrations et animations des créatures

Document unique, pensé pour ne nécessiter aucune question de retour. Tout ce
qui est nécessaire pour produire les fichiers dans le bon format, au bon
endroit, est ici. S'il manque une info malgré tout, mets une note dans le
nom du fichier plutôt que d'attendre une réponse — Enzo pourra ajuster après.

---

## 1. Ce qu'il y a à faire

**26 créatures × 3 stades d'évolution = 78 illustrations statiques.**

Chaque créature a en plus **2 animations Lottie** (voir section 3), donc
**52 animations** en plus des 78 images. Total : 78 images + 52 animations.

Chaque créature a aussi **1 logo/icône** (voir section 4) — soit dans son
design final, soit un symbole distinct qui la représente en miniature.
Total : 26 logos.

---

## 2. La liste complète des 26 créatures

| ID (nom de dossier) | Palier 1 | Palier 2 | Palier 3 | Rareté | Élément | Rôle |
|---|---|---|---|---|---|---|
| `pyrosile` | Pyrosile | Pyrosile | Pyrosile | Commun | Feu | attaquant |
| `caraploof` | Caraploof | Caraploof | Caraploof | Commun | Eau | tank |
| `ventis` | Ventis | Ventis | Ventis | Commun | Air | attaquant |
| `bouldog` | Bouldog | Bouldog | Bouldog | Commun | Terre | tank |
| `voltix` | Voltix | Voltix | Voltix | Commun | Foudre | attaquant |
| `aegisolar` | Aegisolar | Aegisolar | Aegisolar | Rare | Lumière | tank |
| `glyphon` | Glyphon | Glyphon | Glyphon | Commun | Magie | soutien |
| `ombrillon` | Ombrillon | Ombrillon | Ombrillon | Commun | Ténèbres | attaquant |
| `luxorbe` | Luxorbe | Luxorbe | Luxorbe | Commun | Lumière | soutien |
| `fournax` | Fournax | Fournax | Fournax | Peu commun | Feu | tank |
| `solarion` | Solarion | Solarion | Solarion | Épique | Lumière | attaquant |
| `aquamira` | Aquamira | Aquamira | Aquamira | Peu commun | Eau | soutien |
| `terracroc` | Terracroc | Terracroc | Terracroc | Peu commun | Terre | attaquant |
| `zephyrion` | Zephyrion | Zephyrion | Zephyrion | Peu commun | Air | soutien |
| `brontobloc` | Brontobloc | Brontobloc | Brontobloc | Peu commun | Foudre | tank |
| `malefix` | Malefix | Malefix | Malefix | Peu commun | Magie | attaquant |
| `nocturis` | Nocturis | Nocturis | Nocturis | Rare | Ténèbres | soutien |
| `racinea` | Racinea | Racinea | Racinea | Rare | Terre | soutien |
| `runicor` | Runicor | Runicor | Runicor | Rare | Magie | tank |
| `braiserose` | Braiserose | Braiserose | Braiserose | Rare | Feu | soutien |
| `abyssorax` | Abyssorax | Abyssorax | Abyssorax | Épique | Eau | attaquant |
| `cumulox` | Cumulox | Cumulox | Cumulox | Épique | Air | tank |
| `voltarel` | Voltarel | Voltarel | Voltarel | Épique | Foudre | soutien |
| `solstral` | Solstral | Solstral | Solstral | Légendaire | Lumière | attaquant |
| `tartaroth` | Tartaroth | Tartaroth | Tartaroth | Légendaire | Ténèbres | tank |
| `arcanis` | Arcanis | Arcanis | Arcanis | Mythique | Magie | attaquant |


**Lecture du tableau** :
- Chaque créature a 3 formes qui changent d'apparence selon son niveau
  (elle grandit/évolue visuellement, PAS juste plus grosse — un vrai
  changement de design comme dans Pokémon ou Monster Legends).
- La **rareté** donne la couleur de bordure/badge déjà en place dans l'app
  (tu n'as pas à t'en soucier, juste à t'en inspirer si tu veux) :
  - Commun `#e8b923` (doré terne)
  - Peu commun `#a67c3d` (bronze)
  - Rare `#d0342c` (rouge)
  - Épique `#4caf50` (vert)
  - Légendaire `#9b4fd6` (violet)
  - Mythique `#ff8c00` (orange vif)
- L'**élément** et le **rôle** (attaquant / tank / soutien) sont des
  indications de caractère, pas des contraintes strictes — un Tank Terre
  doit lire "lourd, robuste", un Attaquant Foudre doit lire "rapide,
  agressif". Utilise-les comme direction artistique, pas comme cahier des
  charges rigide.

---

## 3. Les illustrations statiques (78 fichiers)

### Format exact

- **Fichier** : PNG, fond **transparent** (pas de fond blanc, pas de fond
  de couleur — vérifie avec un aperçu sur fond sombre avant d'exporter,
  car un fond presque blanc à 1% d'opacité reste invisible à l'œil sur un
  fond blanc mais se voit sur fond sombre).
- **Dimensions** : minimum **1024×1024 px**, carré. L'app redimensionne
  automatiquement plus petit selon l'écran, jamais plus grand — pars
  large, jamais l'inverse.
- **Cadrage** : la créature doit être **centrée**, avec une marge d'environ
  10% de chaque côté (ne colle pas le dessin aux bords). L'app affiche
  parfois la créature dans un cercle ou une petite case, donc évite les
  détails importants tout contre les bords qui seraient rognés.
- **Style** : cohérent d'une créature à l'autre — même niveau de détail,
  même type d'éclairage (ex : toujours une lumière venant du même angle),
  pour que la collection ait l'air d'un seul jeu et pas d'un patchwork.

### Nommage et emplacement — RÈGLE STRICTE

Chaque créature a son propre dossier, déjà créé dans le projet :

```
mobile/assets/creatures/<id>/
```

Dans chaque dossier, **exactement ces 3 fichiers** :

```
mobile/assets/creatures/pyrosile/stage-0.png
mobile/assets/creatures/pyrosile/stage-1.png
mobile/assets/creatures/pyrosile/stage-2.png
```

`stage-0` = palier 1 (la forme la plus jeune), `stage-2` = palier 3 (la
forme finale). Remplace `pyrosile` par l'ID exact de la créature, tel
qu'écrit dans la colonne « ID » du tableau ci-dessus (toujours en
minuscules, sans accent, sans espace — copie-colle-le directement pour
éviter toute faute).

**Aucune variation dans le nom n'est acceptée** : pas de majuscule, pas de
`stage0` sans tiret, pas de `.jpg` — le code qui charge ces images
cherchera exactement `stage-0.png`, `stage-1.png`, `stage-2.png`.

---

## 4. Le logo / l'icône de créature (26 fichiers)

En plus des 3 illustrations, chaque créature a **1 logo** — une version
simplifiée, symbolique, utilisée en petit (liste, badge, bouton). Pense
« logo de club de sport » plutôt que « portrait détaillé » : silhouette
reconnaissable même à 40×40 px, peu de détails fins.

### Format

- PNG, fond transparent, **carré**, minimum **512×512 px**.
- Peut être basé sur le stade final (`stage-2`) simplifié, ou un symbole
  totalement distinct qui représente la créature (une griffe, une flamme
  stylisée, etc.) — au choix artistique.

### Nommage et emplacement

```
mobile/assets/creatures/<id>/logo.png
```

---

## 5. Les animations (52 fichiers, 2 par créature)

### Ce que c'est

Une **vraie animation vectorielle fluide**, au format **Lottie**. Pas une
suite d'images qui s'enchaînent — un mouvement continu, comme les
animations qu'on trouve dans les apps modernes.

**Techniquement confirmé compatible** : ce format tourne nativement dans
l'app, aucune limitation.

### Ce dont tu as besoin (logiciel)

- **Adobe After Effects**, avec l'extension gratuite **Bodymovin**
  (ou son successeur, le plugin **LottieFiles pour After Effects**) —
  cherche « Bodymovin After Effects plugin » ou « LottieFiles Creator ».
  C'est gratuit et c'est l'outil standard pour produire ce format.
- Alternative si tu n'as pas After Effects : le site
  **lottiefiles.com** propose un éditeur en ligne pour créer des
  animations directement, sans logiciel à installer.

### Les 2 animations par créature

1. **`idle`** — animation de repos, en boucle. La créature respire,
   cligne des yeux, bouge légèrement une oreille/aile/queue. Discrète,
   pensée pour tourner en continu sans fatiguer l'œil.
2. **`reaction`** — animation courte (1 à 2 secondes), déclenchée quand le
   joueur **touche** la créature dans le menu Aventure. Plus marquée :
   sursaut, grognement, clin d'œil, flash de son élément — quelque chose
   qui donne l'impression que la créature répond au contact.

Ces 2 animations sont produites **pour le stade final de chaque créature
uniquement** (`stage-2`), pas pour les 3 stades — la créature jeune reste
en image statique, seule sa forme évoluée s'anime pleinement. Ça limite le
travail à 52 animations au lieu de 156, en concentrant l'effort sur les
formes que le joueur regarde le plus longtemps (fin de progression).

### Format exact du fichier

- Export **JSON Lottie standard** (PAS le format `.lottie` compressé —
  le fichier `.json` classique, celui que Bodymovin produit par défaut).
- Canevas carré, minimum **512×512 px** dans After Effects avant export.
- Durée libre, mais reste sous **3 secondes** pour `idle` (en boucle) et
  sous **2 secondes** pour `reaction` (jouée une fois).
- Fond transparent (ne mets pas de calque de fond coloré dans la
  composition).

### Nommage et emplacement

```
mobile/assets/creatures/<id>/anim-idle.json
mobile/assets/creatures/<id>/anim-reaction.json
```

---

## 6. Résumé — ce qu'il doit y avoir dans chaque dossier à la fin

```
mobile/assets/creatures/pyrosile/
  stage-0.png
  stage-1.png
  stage-2.png
  logo.png
  anim-idle.json
  anim-reaction.json
```

**6 fichiers par créature × 26 créatures = 156 fichiers au total.**

---

## 7. Comment livrer le travail

Le plus simple : dépose les fichiers **directement dans les bons
dossiers**, qui existent déjà dans le projet
(`mobile/assets/creatures/<id>/`), puis préviens Enzo — c'est lui qui
s'occupe de la publication, il n'y a rien d'autre à faire côté technique.

Il n'est pas nécessaire de tout livrer d'un coup : une créature complète
(6 fichiers) à la fois est parfait, ça permet de tester au fur et à mesure.

---

## 8. En cas de doute

- **Rien à demander avant de commencer** : ce document couvre le format,
  les emplacements, les noms de fichiers et le nombre exact attendu.
- Si un choix artistique n'est pas couvert ici (pose, expression,
  éclairage précis d'une créature) : c'est un choix libre, fais au
  jugement. La cohérence entre les 26 créatures compte plus que le
  respect d'une règle qui n'existe pas.

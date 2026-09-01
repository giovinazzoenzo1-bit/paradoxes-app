# Specs techniques des assets visuels — à lire avant de dessiner quoi que ce soit

> Ce fichier donne les dimensions RÉELLES lues dans le code, pas des suppositions. Si tu (ou ton Claude) as besoin d'une dimension qui n'est pas ici, demande-la à la session Claude qui a accès au repo — ne devine jamais depuis une session sans accès au code, même si elle répond avec assurance.

## Convention générale
- Toutes les images d'ambiance/décor/personnages de jeu vont dans `sprites/`, fond transparent (PNG).
- Les icônes de menu (300×300, fond transparent) restent dans `icons/`, pas concernées par ce fichier.
- Chaque entrée ci-dessous précise : la taille exacte utilisée dans le code, si l'image est étirée/répétée/fixe, et le fichier attendu.

## Flappy Bird
- Canvas de jeu : 300 × 400 px (CSS px, indépendant de la résolution écran)
- Tous les assets sont dans `sprites/flappybird/` (dossier dédié, pour rester facile à gérer à mesure que d'autres jeux accumulent leurs propres sprites).
- **Oiseau** : `sprites/flappybird/bird_toucan.png` — en place. Dessiné à une largeur de `FB_BIRD_RADIUS*3.4` ≈ 47px, hauteur dérivée automatiquement du ratio de l'image (pas de déformation).
- **Tuyaux** : en place, mais **uniquement pour le thème "classique"** de la boutique de fonds (les 5 autres thèmes n'ont pas encore leurs propres assets, ils gardent un remplissage couleur uni) :
  - `sprites/flappybird/pipe_body.png` — 52×42px, corps répétable (tuilé verticalement par le code, dernière tuile recadrée proprement, jamais étirée/déformée).
  - `sprites/flappybird/pipe_cap.png` — 60×24px, embouchure posée une fois à l'ouverture de chaque tuyau, dépasse de 4px de chaque côté du corps (60 = 52 + 2×4).
  - Si de nouveaux thèmes (coucher de soleil, désert, nuit, espace, néon — voir `coins-config.js` → `flappyBirdThemes`) reçoivent leurs propres textures un jour, même format exact à respecter (52×42 et 60×24).
- **Décor arrière-plan** (intégré le 29/08, mobile/assets/flappybird/) — 6 couches empilées derrière les tuyaux/l'oiseau, dans l'ordre (fond en premier = tout au fond) :
  - `fond.png` — 300×400px, ciel+mer+pont, **fixe** (ne défile jamais), plaque tout le canvas.
  - `nuages.png` — 600×130px, en haut de l'écran, défilement en boucle très lent (~12px/s en unités BASE).
  - `ville.png` — 600×80px, pied ancré à y=266, défilement lent (~28px/s).
  - `arbres.png` — 600×114px réel (annoncé 600×110 dans les consignes, léger débord normal pour une silhouette découpée), pied ancré à y=355. **N'utilise PAS de défilement** : oscillation de la bande entière ±2px, comme demandé (pas besoin d'images multiples pour un simple effet de vent).
  - `herbe_1/2/3.png` — 600×98px réel chacune (annoncé 600×40 — les brins d'herbe débordent largement du "cadre" nominal, image ancrée par le BAS du canvas plutôt que y=360 pour cette raison). Défilement rapide, calé sur `PIPE_SPEED` (140px/s en unités BASE) pour rester synchro avec le rythme du jeu. Animation d'image en aller-retour (1→2→3→2→1→2→3…), 150ms par image, jamais en boucle sèche.
  - Toutes les bandes en 600px de large se répètent horizontalement à l'infini (deux copies translatées en boucle) — le raccord doit être fait dans le fichier source, pas géré côté code.
  - **`sol.png` (600×140, y=260 au bas, défilement rapide) — MANQUANT.** Seuls 7 des 8 fichiers annoncés dans les consignes ont été reçus ; le 8e envoi était une capture d'écran des consignes elles-mêmes, pas une image. Pas de couche "sol" affichée pour l'instant — à ajouter dès réception du vrai fichier (composant `FlappyBackground` dans `FlappyBirdScreen.js` déjà prêt à l'accueillir, juste rajouter un `<ScrollingStrip>` de plus).

## 2048
- Grille 4×4, cellules carrées (ratio 1:1), thème cible "néon cyberpunk" (cahier des charges du 26/08). Voir doc "Flavio" sur le Drive pour la palette hex détaillée par palier de tuile.
- Pas encore de sprites (tuiles actuellement en CSS pur, couleurs de fond). Si le reskin visuel passe par des images plutôt que du CSS, redemander les dimensions exactes de la grille au moment de coder cette partie (dépend de la taille d'écran, pas fixe en px).

## Ping-pong / Billard
- Canvas redimensionné dynamiquement selon l'écran (pas de taille fixe en px) — tout sprite doit être vectoriel ou en résolution suffisamment haute pour être redimensionné sans perte, pas calé sur une taille précise.

---
**Règle à suivre à chaque fois qu'un jeu passe de formes dessinées (Canvas) à des sprites images** : mettre à jour la section correspondante ici avec les dimensions exactes AVANT de transmettre la demande à un artiste ou une autre session Claude.

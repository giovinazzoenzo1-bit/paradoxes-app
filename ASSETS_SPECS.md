# Specs techniques des assets visuels — à lire avant de dessiner quoi que ce soit

> Ce fichier donne les dimensions RÉELLES lues dans le code, pas des suppositions. Si tu (ou ton Claude) as besoin d'une dimension qui n'est pas ici, demande-la à la session Claude qui a accès au repo — ne devine jamais depuis une session sans accès au code, même si elle répond avec assurance.

## Convention générale
- Toutes les images d'ambiance/décor/personnages de jeu vont dans `sprites/`, fond transparent (PNG).
- Les icônes de menu (300×300, fond transparent) restent dans `icons/`, pas concernées par ce fichier.
- Chaque entrée ci-dessous précise : la taille exacte utilisée dans le code, si l'image est étirée/répétée/fixe, et le fichier attendu.

## Flappy Bird
- Canvas de jeu : 300 × 400 px (CSS px, indépendant de la résolution écran)
- **Oiseau** : `sprites/flappybird_toucan.png` — déjà en place. Dessiné à une largeur de `FB_BIRD_RADIUS*3.4` ≈ 47px, hauteur dérivée automatiquement du ratio de l'image (pas de déformation). Peut être remplacé par un autre PNG au même nom sans toucher au code.
- **Tuyaux** : PAS ENCORE de sprite — rectangles de couleur unie pour l'instant. Largeur fixe 52px, mais **hauteur variable à chaque apparition** (position de l'ouverture aléatoire), écart vertical entre les deux tuyaux = 130px.
  - 🟥 Une image à hauteur fixe ne peut PAS remplacer ça telle quelle — il faut soit une texture 52px de large répétable verticalement (le code la boucle pour couvrir n'importe quelle hauteur), soit une embouchure fixe + un corps répétable séparés. Prévenir Claude avant de dessiner pour caler le format exact.

## 2048
- Grille 4×4, cellules carrées (ratio 1:1), thème cible "néon cyberpunk" (cahier des charges du 26/08). Voir doc "Flavio" sur le Drive pour la palette hex détaillée par palier de tuile.
- Pas encore de sprites (tuiles actuellement en CSS pur, couleurs de fond). Si le reskin visuel passe par des images plutôt que du CSS, redemander les dimensions exactes de la grille au moment de coder cette partie (dépend de la taille d'écran, pas fixe en px).

## Ping-pong / Billard
- Canvas redimensionné dynamiquement selon l'écran (pas de taille fixe en px) — tout sprite doit être vectoriel ou en résolution suffisamment haute pour être redimensionné sans perte, pas calé sur une taille précise.

---
**Règle à suivre à chaque fois qu'un jeu passe de formes dessinées (Canvas) à des sprites images** : mettre à jour la section correspondante ici avec les dimensions exactes AVANT de transmettre la demande à un artiste ou une autre session Claude.

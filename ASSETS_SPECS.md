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

## 2048
- Grille 4×4, cellules carrées (ratio 1:1), thème cible "néon cyberpunk" (cahier des charges du 26/08). Voir doc "Flavio" sur le Drive pour la palette hex détaillée par palier de tuile.
- Pas encore de sprites (tuiles actuellement en CSS pur, couleurs de fond). Si le reskin visuel passe par des images plutôt que du CSS, redemander les dimensions exactes de la grille au moment de coder cette partie (dépend de la taille d'écran, pas fixe en px).

## Ping-pong / Billard
- Canvas redimensionné dynamiquement selon l'écran (pas de taille fixe en px) — tout sprite doit être vectoriel ou en résolution suffisamment haute pour être redimensionné sans perte, pas calé sur une taille précise.

---
**Règle à suivre à chaque fois qu'un jeu passe de formes dessinées (Canvas) à des sprites images** : mettre à jour la section correspondante ici avec les dimensions exactes AVANT de transmettre la demande à un artiste ou une autre session Claude.

# Banc de capture (outil de Claude)

Rend les VRAIS écrans du jeu en web (react-native-web) dans un navigateur
invisible, à la taille d'un téléphone en paysage, pour VOIR une mise en page
avant de l'envoyer. Jamais importé par l'appli.

    cd mobile/tools/capture && npm i
    node build.mjs scenes/resultat.jsx
    node capture.mjs defaite victoire          # TAILLE=800x360 pour un petit Android

- Les modules natifs sont remplacés par des doublures (`stubs/natifs.js`).
- Les composants non exportés sont exposés À LA VOLÉE par `build.mjs` (le code
  de l'appli n'est pas modifié).
- La capture mesure le débordement vertical : 0 px = rien à faire défiler.
- Fidélité ≈ 95 % : mise en page, tailles et textes justes ; polices, émojis et
  ombres un peu différents d'iOS / Android.

- Le code de l'appli passe par la MÊME transformation que Metro (const/let → var, JSX) : le rendu web se comporte comme le téléphone.
- Scènes : `scenes/resultat.jsx` (fin de combat, paysage), `scenes/menu.jsx` (menu principal, `TAILLE=390x844`).

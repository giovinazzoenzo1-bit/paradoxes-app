# État — Paradox mobile (React Native / Expo)

> **Pour Claude, en début de session :** lis ce fichier en entier avant d'agir.
> Ne pas lire l'historique Git ni les anciens commits sauf besoin précis.
> Ce fichier est réécrit (pas complété) à chaque mise à jour — il ne contient
> QUE l'état actuel, pas l'historique des bugs déjà réglés.
> Mets-le à jour (overwrite les sections concernées, push) après tout
> changement notable : nouveau jeu porté, dépendance ajoutée/retirée, bug
> résolu, décision d'architecture.

## Repo
- `github.com/giovinazzoenzo1-bit/paradoxes-app`, dossier `mobile/`
- PWA de référence (logique de jeu à porter) : racine du repo, `index.html`
  (~10000 lignes) + `PROJECT_STATE.md` / `ASSETS_SPECS.md` à la racine
- PWA en ligne : giovinazzoenzo1-bit.github.io/paradoxes-app/

## Démarrage rapide d'une nouvelle session Claude
Message type à donner : "Projet Paradox. Lis mobile/PROJECT_STATE.md sur ce
repo, clone avec le token ci-dessous, continue à partir de là." Le token
GitHub à utiliser (permissions Contents/Metadata/Secrets/Workflows en
Read/write, pas Actions) est fourni par l'utilisateur en début de
conversation — ne pas le stocker en clair ici à long terme, il est redonné
à chaque nouvelle session par l'utilisateur lui-même. Le retirer du remote
juste après chaque push.

## Stack actuelle
- Expo SDK 54 (figé — Expo Go du Play Store bloqué dessus, ne pas monter en
  SDK 55+)
- Compte Expo : `paradoxes-app1`, projet : `paradox-1`
- **Pas de react-navigation / react-native-gesture-handler / react-native-screens**
  → retirés définitivement (voir "Décisions figées" ci-dessous)
- Navigation par onglets : switch d'état local dans `App.js` (TABS array),
  pas de lib externe

## Décisions figées (ne pas revenir dessus sans raison forte)
- **Pas de navigation externe.** react-navigation + gesture-handler +
  react-native-screens causaient un blocage permanent du contexte React
  (écran blanc, pas un crash) sur ce build précis. Confirmé par bisection
  méthodique. Solution : navigation par état local (`useState` dans
  `App.js`). Si un futur écran a besoin de navigation empilée (stack), tester
  d'abord en isolation via build APK avant d'adopter une lib.
- `newArchEnabled: false` dans app.json (précaution, RN 0.81 reste
  bridgeless par défaut de toute façon)
- `expo-updates` doit rester en version `~29.0.x` (compatible SDK 54) —
  `npx expo install --fix` peut la faire dériver, vérifier après usage

## Structure du code
- `App.js` — provider pièces + safe area + error boundary + switch d'onglets
- `index.js` — point d'entrée, handler d'erreur JS global (affiche les
  erreurs à l'écran au lieu d'un écran blanc)
- `src/context/CoinsContext.js` — système de pièces (AsyncStorage), port
  fidèle du PWA (plafond 40/h par jeu, fenêtre glissante)
- `src/components/CoinBar.js` — barre de pièces persistante
- `src/components/ErrorBoundary.js` — attrape les erreurs de rendu React,
  les affiche à l'écran (pas de crash silencieux)
- `src/screens/JeuxScreen.js` — liste des jeux (aucun jeu encore porté,
  tous en "À venir")
- `src/screens/ProgresScreen.js`, `OptionsScreen.js` — écrans basiques

## Workflows GitHub Actions
- `mobile-publish.yml` : auto, à chaque push sur `mobile/**` (branche main)
  → publie une EAS Update → visible dans Expo Go en ~15s. **Mode de travail
  quotidien, ne nécessite aucune action de l'utilisateur.**
- `build-apk.yml` : manuel (`workflow_dispatch`, bouton "Run workflow") →
  construit un vrai APK installable. **Seulement pour bugs invisibles dans
  Expo Go, ou avant soumission finale.** Lien fixe :
  github.com/giovinazzoenzo1-bit/paradoxes-app/actions/workflows/build-apk.yml
  Téléchargement : expo.dev/accounts/paradoxes-app1/projects/paradox-1/builds

## Contraintes d'environnement (Claude)
- Pas d'accès réseau direct à expo.dev/api.expo.dev depuis le bac à sable —
  tout passe par GitHub Actions
- Pas d'accès aux logs de build GitHub Actions (domaine blob.core.windows.net
  bloqué) — utiliser un rapport de bug Android (Paramètres → Options
  développeur → Rapport de bug) si besoin de logs natifs profonds
- Token GitHub à insérer dans le remote juste pour le push, puis retirer
  immédiatement après (ne jamais le laisser dans l'historique de commande)

## Étape en cours / prochaine étape
Navigation stabilisée, appli vide fonctionnelle (pièces + 3 écrans). 
**Prochaine étape : porter le premier mini-jeu (Morpion) depuis `index.html`
vers `mobile/src/screens/`, en réutilisant la logique de jeu déjà validée du
PWA sans la réinventer.**

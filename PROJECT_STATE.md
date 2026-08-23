# Paradoxes & Probabilités — État du projet

> **Pour Claude : lis ce fichier en entier avant de répondre.** Il résume tout le contexte nécessaire pour reprendre le travail sans avoir à relire l'historique de conversation.

## C'est quoi
PWA (Progressive Web App) éducative/ludique : paradoxes de probabilités expliqués simplement + mini-jeux, en français, pensée pour du grand public (12 ans+).

- **URL live** : https://giovinazzoenzo1-bit.github.io/paradoxes-app/
- **Repo** : https://github.com/giovinazzoenzo1-bit/paradoxes-app
- **Stack** : un seul fichier `index.html` (HTML+CSS+JS vanilla, pas de framework), `sw.js` (service worker PWA), `manifest.json`. Hébergé sur GitHub Pages (gratuit).
- **Analytics** : GoatCounter (respectueux vie privée, pas de cookies)

## Workflow de déploiement
- Claude clone/édite le repo dans le sandbox, puis pousse via un **Personal Access Token** (fine-grained, scope "Contents: write", ce seul repo) que l'utilisateur fournit en début de session si besoin.
- **Toujours bumper `CACHE_NAME` dans sw.js** (ex: paradoxes-v18 → v19) à chaque modification, sinon le service worker sert une version périmée.
- **Toujours valider le JS** avec `node --check` avant de push (extraire les balises `<script>` et vérifier la syntaxe).
- ⚠️ **GitHub Pages a un cache CDN de 5 minutes (`max-age=300`)** sur les fichiers servis. Après un push, attendre ~5 min avant de tester, sinon le bandeau de mise à jour peut ne pas apparaître (ce n'est pas un bug de l'app).
- Après usage du token dans `git remote set-url`, toujours le retirer immédiatement après le push (sécurité).

## Fonctionnalités déjà en place
- **20 paradoxes** interactifs avec simulation (Monty Hall, Anniversaires, 2 enfants, Né un mardi, Simpson, Saint-Pétersbourg, Parrondo, Grand Duc de Toscane, Franc-Carreau, Achille et la tortue, 100 prisonniers, Bus qui n'arrive jamais, Ruine du joueur, Braess, Taxi, Corde autour de la Terre, Loi de Benford, Condorcet, Hôtel de Hilbert, Deux enveloppes) — chacun a un écran, une explication (`infoText`), une icône PNG dans `icons/paradox_*.png`
- **Quiz** : 2 modes (Paradoxes / Général avec 3 tranches d'âge), 10 questions chacun, explications après chaque réponse, pas d'auto-avance
- **Mini-jeux** : Wordle, Qui suis-je (pass-and-play, joueurs sauvegardés), 2048 (swipe), Memory (4 difficultés + timer), Puzzle 15, Morpion, Snake (thème Game Boy, high score), Nuts and Bolts (5 niveaux progressifs)
- **Trophées** (système localStorage) + Classement (aperçu avec fausses données, pas de vrai compte encore)
- **Nav bar** 4 onglets (Paradoxes/Jeux/Progrès/Options) qui se cache au scroll
- **Sauvegarde de scroll** par écran + reprise de session au dernier écran ouvert
- **Son/vibration** (3 modes : Sons/Vibreur/Silencieux) pour trophées, records, défaites
- **Musique de fond** générée sur mesure (12s de boucle, 12 Ko), toggle dans Options
- **Pub factice** (bandeau, pas de vraie régie branchée) + bouton "Retirer les pubs" (mock, pas de vrai paiement)
- **Écran Confidentialité** (contenu honnête, pas de RGPD banner encore car pas de vraie pub active)
- Police : Quicksand (titres) + Nunito (texte), thème sombre navy/or

## Pas encore fait (connu, pas oublié)
- 🟥 **Bandeau de consentement RGPD** — nécessaire avant d'activer une vraie régie publicitaire, pas avant
- Tetris et Bataille navale (mini-jeux annoncés "bientôt" dans l'app)
- Traduction complète (sélecteur de langue présent mais seul le français est actif — décision volontaire pour éviter les bugs, voir conversation)
- Vrai système de compte utilisateur (nécessaire pour un vrai classement, pas juste l'aperçu actuel)
- App native (Capacitor) pour vraie pub AdMob et présence App Store — actuellement PWA uniquement

## Bugs connus à vérifier
- Nuts and Bolts niveau 4 (5 couleurs, seulement 2 tiges vides) : risque de configuration bloquée car le mélange est aléatoire, pas de vérification de solvabilité

## Convention de code utile à connaître
- `puzzles` (array JS) = liste des 20 paradoxes, chaque entrée a `id`, `icon` (emoji, fallback), `color`, `title`, `hook`, `odds`
- `infoText` (objet JS) = explications détaillées par `id` de paradoxe
- Icônes réelles : `icons/paradox_{id}.png` (300x300, fond transparent nettoyé depuis des générations Gemini)
- Icônes de jeux : `icons/{nom}.png` (memory, puzzle15, snake, bientot, quisuisje, nutsbolts, g2048, quiz_paradoxes, wordle, quiz_general, morpion)
- Stats utilisateur stockées via `statsGet()`/`statsSet()` (localStorage, clé `userStats`)
- Toujours re-synchroniser `restoreLastScreen()` et le service worker `ASSETS` si un nouvel écran/fichier est ajouté

## Comment générer de nouvelles icônes (workflow établi)
1. Prompt Gemini avec le bloc "style" (flat vector, fond noir uni #000000, pas de scène réaliste, pas de damier de transparence)
2. Claude nettoie le fond (script Python : détection couleur de coin + flood-fill + scipy pour connectivité), recadre en carré si besoin
3. Redimensionne à 300x300, sauvegarde dans `icons/`, référence dans le HTML, ajoute au cache `sw.js`, bump `CACHE_NAME`

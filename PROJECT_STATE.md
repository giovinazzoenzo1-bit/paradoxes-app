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
- (résolu v19) ~~Nuts and Bolts niveau 4 : risque de configuration bloquée~~ → génération avec vérification de solvabilité (BFS sur états canoniques) avant de lancer la partie, voir `nbGenerateSolvableRods()`

## 🟥 Correctif critique v24 : le HTML était servi cache-first, jamais rafraîchi
Cause du problème "aucun changement visible malgré les push" : le fetch handler de `sw.js` servait TOUT en cache-first, y compris le `index.html` lui-même. Résultat : tant que l'utilisateur ne tapait pas explicitement le bandeau jaune "nouvelle version" (qui ne se déclenchait pas de façon fiable, probablement lié au cycle de vie des PWA en mode standalone sur mobile), l'app restait bloquée sur une version périmée indéfiniment, même après avoir fermé/rouvert l'app plusieurs fois.
- **Fix** : le HTML (requêtes de navigation) passe en **network-first** (`fetch(req, {cache:'no-store'})`), ne retombe sur le cache que hors-ligne. Les autres assets (icônes, mp3) restent cache-first pour l'usage hors-ligne.
- **Filet de sécurité ajouté** : bouton "Forcer la mise à jour" dans Options → supprime tous les caches + désenregistre le service worker + recharge.
- Le cache CDN GitHub Pages de 5 min reste incompressible (limite d'hébergement gratuit), mais maintenant après ce délai un simple refresh normal suffit, plus besoin du bandeau.

## Roadmap corrective en cours (approche validée le 23/08/2026 : jeu par jeu à 100%, pas phase horizontale)
- **Phase 1 (fait, v19)** : bug Nuts and Bolts niv.4, sons Wordle (lettre correcte/mal placée), bug scroll 2048 au swipe, boutons Snake agrandis + décor plein écran, couleurs dégradées Puzzle15
- **Wordle (fait, v20)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - Sons lettre correcte / mal placée
  - Dictionnaire de validation (`wordleDictionary`, 4448 mots français 5 lettres, extrait du package npm `an-array-of-french-words`, embarqué en dur dans index.html) — le bouton Valider refuse et fait "shake" la ligne + toast si le mot n'existe pas
  - Bouton "📺 Lettre offerte (pub)" — pub simulée (`mockWatchAd()`, overlay générique réutilisable, 4s), révèle la lettre correcte à la prochaine position vide de la ligne en cours
  - ⚠️ Note : le clavier du jeu ne gère pas les accents, donc le dictionnaire est filtré aux mots sans accents/tirets uniquement (4448/336524 mots du corpus complet)
- **Système générique créé (réutilisable pour d'autres jeux)** : `mockWatchAd(durationSec, callback)` — overlay pub simulée avec barre de progression, `#ad-overlay` dans le `<body>`, CSS `.ad-overlay/.ad-box/.ad-progress`
- **Qui suis-je (fait, v21)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - Système "🔎 J'ai oublié ma carte" : liste tous les joueurs, tap sur un nom → écran de confirmation d'identité (anti-spoil, honor system comme le reste du jeu) → révèle la carte de CE joueur uniquement
  - Accessible depuis l'écran d'attente entre deux joueurs et depuis l'écran final "tout le monde a son personnage"
  - État géré via `qsjRecallMode` ('list'|'confirm'|'shown'), n'interfère pas avec le flux normal de distribution des cartes
- **2048 (fait, v22)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - Meilleur score perso affiché en permanence (localStorage `g2048Best`)
  - Message de fin (gagné/perdu) : score + temps de la partie + meilleur perso + meilleur mondial (aperçu fictif `g2048WorldBestMock`, pas de backend réel)
  - Bouton "↩️ Annuler" (historique jusqu'à 20 coups) — 1er undo de la partie gratuit, à partir du 2e le bouton devient "↩️📺 Annuler (pub)" et déclenche `mockWatchAd()` avant d'annuler
- **Memory (fait, v23)** — TOUS les correctifs demandés sont faits, jeu à considérer 100% à jour :
  - Nouveau panneau "🏆 Classements" accessible depuis l'écran de choix de difficulté, avec onglets par difficulté (4×4/6×6/10×10/14×14)
  - Classement perso : top 5 temps par difficulté, stocké dans `localStorage` (`memoryScores:<size>`, jusqu'à 10 scores gardés)
  - Classement mondial : aperçu fictif (`memoryWorldMock`, pas de vrai backend) fusionné avec le meilleur temps perso inséré au bon rang
  - Anti-triche v1 : chaque score est signé (`memorySign()`, hash simple) et un score dont la signature ne correspond pas (édité à la main dans localStorage) est silencieusement rejeté du classement ; un score physiquement impossible (moins de coups que de paires, temps trop court) est aussi rejeté (`memoryIsPlausible()`)
  - ⚠️ Limite documentée dans le code : protection client uniquement, dissuade la triche "rapide" via édition directe de localStorage, ne bloque pas quelqu'un qui lit le code source — un vrai anti-triche nécessiterait un backend (Phase 7)
- **Prochain jeu à traiter à 100% avant de passer au suivant** : à définir avec l'utilisateur (candidats restants : Puzzle15, Snake, Nuts and Bolts, + nouveaux mini-jeux)
- **Phase 3 (à faire)** : classements perso (localStorage) — Memory, Puzzle15, Snake, 2048
- **Phase 4 (à faire)** : anti-triche v1 Memory + validation de mot réel pour Wordle (refuser la soumission si le mot n'existe pas)
- **Phase 5 (à faire)** : Nuts and Bolts — passer de 5 à 50 niveaux
- **Phase 6 (à faire)** : nouveaux mini-jeux un par un — Solitaire, Sudoku, Puissance 4, Flappy Bird (raisonnables en vanilla JS) ; Ludo, Skip-Bo, Échecs, Billard, Ping-pong (plus lourds, à traiter en dernier)
- **Phase 7 (bloquant pour tout "classement mondial")** : vrai backend (comptes utilisateurs + base de données) — indispensable avant tout classement mondial réel, actuellement tout est en localStorage local à l'appareil

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

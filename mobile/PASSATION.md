# PASSATION — Paradox Clicker (24/09/2026)

À coller au début d'une nouvelle conversation, avec le token GitHub.
Ce fichier est la mémoire courte ; la longue est dans `CLICKER_ADVENTURE_STATE.md` et `WIKI_DEFIS.md`.

## 1. Démarrage de session — dans cet ordre, sans rien coder avant

```
git clone https://<TOKEN>@github.com/giovinazzoenzo1-bit/paradoxes-app.git
cd paradoxes-app
mkdir -p /home/claude/auditenv && cd /home/claude/auditenv && npm init -y >/dev/null && npm i @babel/core @babel/preset-env @babel/preset-react >/dev/null && cd -
```
1. Lire **en entier** `mobile/CLICKER_ADVENTURE_STATE.md`, puis `mobile/WIKI_DEFIS.md`, puis `mobile/A_FAIRE.md`.
2. Lancer les contrôles et rapporter le résultat :
```
export NODE_PATH=/home/claude/auditenv/node_modules
node mobile/tools/verifier-defis.js        # les 41 contrôles du jeu
node mobile/tools/verifier-controles.js    # la preuve que chaque contrôle sait crier (43 sabotages)
node mobile/tools/verif-exhaustive.js      # 252 combinaisons de tirage
node mobile/tools/duree.js                 # durée simulée de chaque Ascension
python3 mobile/tools/generer-doc.py        # régénère mobile/DEFIS_PARADOX.md (vérifié par auditDocConforme)
```
3. Avant de corriger un bug : `git log --all --oneline --grep="<mot>" -i` — l'historique a souvent la réponse.

## 2. Contraintes absolues
- Expo SDK 57, Expo Go ; **jamais** `expo-updates` ni `runtimeVersion` dans le dépôt (commits 63b68ff…) ; `expo-notifications` retiré.
- L'auteur n'a **aucun terminal** : c'est Claude qui pousse ; un robot GitHub Actions publie à chaque push sur `main` touchant `mobile/**` (≈2 min ; vérifier `completed success` via l'API `actions/runs`).
- Jamais de module natif ajouté (a bloqué le démarrage 3 fois). Vérifier qu'une API existe dans la version installée avant de l'appeler.
- **Rien n'est poussé sans** : suite verte + contrôle des contrôles (0 aveugle, 0 périmé, fichiers intacts) + `verif-exhaustive` + compilation Babel de tous les `.js`.
- Tout nouveau contrôle arrive **avec son sabotage** dans `verifier-controles.js`.
- Le fichier des défis (`defisEcrits.js`) se modifie **en éditant le texte source**, jamais en resérialisant un module chargé (code transformé → plantage). Outils : `reordonner-groupe.js <groupe>`, `ajouter-defis.py`.
- Mettre à jour `WIKI_DEFIS.md` / `CLICKER_ADVENTURE_STATE.md` à chaque changement structurant, avec la **cause réelle** des bugs, et `A_FAIRE.md` pour toute demande future de l'auteur.
- Message de commit = récit complet (cause, mesure, décision) : c'est la mémoire du projet.

## 3. État au 24/09 (dernier commit : voir `git log -1` — passe 2 poussée)
- **336 défis** écrits un par un : 6 Ascensions × 7 œufs × **8 défis** (`mobile/src/games/clicker/defisEcrits.js`, source de vérité). Document : `mobile/DEFIS_PARADOX.md`.
- **Tous les défis s'adaptent à l'apparition** : achat → ce qui manque pour le total prévu (règle du total de l'auteur) ; revenu/s → +20 % ; pièces de côté → +5 min de production ; Aventure → +5 niveaux ; Sanctuaire/Veilleur → +2 (plafond 50) ; records → repartent de zéro ; jamais calculés sur un passif boosté par un pouvoir.
- Simulateur `simulerGroupe` (dans `audit-quetes.js`) **calé sur les chronos réels** : `H.facteurJoueurReel = 2,48` sur le tap (Transe, critiques, pouvoirs). Durées : **3,0 / 3,9 / 4,3 / 6,2 / 6,8 / 8,1 h**, mesurées avec **9 pauses d'énergie de 1 h 15 par groupe** (`H.pausesParGroupe`, règle de l'auteur).
- Économie : paliers de tap et générateurs **jamais fermés, chers avant leur heure** (racine de l'écart de seuil, `PALIER_TAP_ASCENSION`, `GENERATEUR_ASCENSION`) ; +35 % sur les 3 premiers exemplaires des générateurs de chaque Ascension ; ajustement par Ascension `AJUSTEMENT_ASCENSION = [1, 0.868, 0.187, 0.618, 0.690, 0.720]` sur seuil ET prix (remesuré par dichotomie le 24/09 pour la croissance ×2,5 des paliers ; il ne touche PAS les prix fixes Pacte/Faveur/Dégâts critiques/Sanctuaire/Veilleur).
- Hors ligne : autoclickers × 25 % × temps, 2 h max, **sans plancher** (`offlineEarnings`).
- Rareté plafonnée à **rare** pour les 3 premiers œufs. Combats ≤ 5 par défi. Transe, cibles dorées, pouvoirs : chaînes douces sur 6 Ascensions.
- Signalement des bugs : bouton dans les Options + détection automatique + filet d'`index.js` → mail à `EMAIL_SIGNALEMENT` (une seule ligne, dans `diagnostic.js`).
- Chronos de l'auteur (4e passage, pubs d'œufs) : 1 œuf 7 min · 2 à 13 · 3 à 24 · 4 à 40 · 5 à 60 · 6 à 1 h 18 (« vraiment bien »).

## 4. Les passes restantes (demandées par l'auteur, à faire une par conversation)

### Passe 2 — paliers de tap ×2,5 — FAITE (24/09)
`growth` 1,45 → **2,5** sur les 10 paliers, Pacte intact. Mesuré avant : le tap faisait 96-100 % de la production, générateurs morts ; ×2,5 seul mettait l'A2 à 17 h. Compensé par `AJUSTEMENT_ASCENSION` (dichotomie), 24 cibles de défis recalées (paliers en part du seuil : niveau final 7/8 · 8/9 · 10/9 · 10/10 · 10/10 ; Pacte A2 9→6, A3 13→11 ; Dégâts critiques A2 19→17 ; Golems A3 5→9), `QUEST_ENGINE_VERSION` 58, `auditPlafondAchats` lit la pente. Budgets 88 / 89 / 85 / 82 / 86 %.
⚠️ **A0 non compensable** (prix fixes = 86 % de son budget) : 2,2 → **3,0 h** en sim (~1 h 30 réel pour l'auteur au lieu de 1 h 05). Effet direct de sa demande, **à confirmer par lui**.
⚠️ Transition : un joueur en cours de groupe A1+ avec des paliers achetés à 1,45 se verra demander 1 niveau au nouveau prix ; une Ascension remet les paliers à zéro.
Non fait, reporté : les coûts de BASE des paliers 7 à 10 mal ordonnés (Fracture +256/tap moins chère que Griffe +64) — à ×2,5 ils ne pèsent que 14-22 % du seuil à l'A4-A5 contre 47-52 % à l'A1-A3 ; règle d'origine « prix ∝ bonus », à mesurer.

### Passe 3 — supprimer l'œuf 7 (À VALIDER par l'auteur)
« L'œuf 7 de l'A0 fout la merde de partout » (défi 52 = 2 achats critiques ≈ 1,3 M ; ascension déjà possible avant). Idem œuf 14 (A1). Passer à 6 œufs par Ascension change la collection (26 créatures → finies pendant l'A4) et l'outil de réordonnancement lit la taille d'œuf dans le fichier, mais `nbOeufs`, `OEUFS_PAR_ASCENSION`, `generer-doc.py` et les contrôles supposent 7. Alternative si refus : plafonner le coût d'un seul défi (< 15 % du seuil).

### Passe 4 — les pouvoirs par le deck
Décidé : **remplace la bulle**. Compte à rebours sur l'œuf ; 1er appui sur le deck = la créature apparaît autour de l'œuf ; 2e appui = activation ; recharge selon la rareté (proposition mesurée : commun ×2,4 / 60 s, légendaire ×12 / 3 min, mythique ×18 / 5 min). Recommandations : un compte à rebours par créature, pouvoir maintenu si on quitte l'écran, `powerActivated` compte les activations du deck, recharge qui tourne hors ligne. Recalibrer ensuite `facteurJoueurReel`.

## 5. L'auteur — comment travailler avec lui
- Réponses **courtes, structurées, code couleur** 🟩🟥🟨🟦, une recommandation tranchée ; pas de question sauf strictement nécessaire.
- Il teste sur son téléphone et donne des **chronos** : ce sont les mesures de référence. Il speedrun parfois (pubs d'œufs, énergie max en dev) : le dire dans les calibrations.
- Il refuse ce qui n'est pas mesuré ; il repère les défis « inutiles » (déjà remplis) et les « abusés ».
- Quand une réponse plante, c'est la taille de la conversation : **une passe par conversation**, et vérifier `git status` en arrivant (une tentative ratée peut avoir laissé des fichiers modifiés non mesurés — c'est arrivé le 24/09).

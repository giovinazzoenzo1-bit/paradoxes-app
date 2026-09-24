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

## 3. État au 24/09 (dernier commit : b3ea6aa)
- **336 défis** écrits un par un : 6 Ascensions × 7 œufs × **8 défis** (`mobile/src/games/clicker/defisEcrits.js`, source de vérité). Document : `mobile/DEFIS_PARADOX.md`.
- **Tous les défis s'adaptent à l'apparition** : achat → ce qui manque pour le total prévu (règle du total de l'auteur) ; revenu/s → +20 % ; pièces de côté → +5 min de production ; Aventure → +5 niveaux ; Sanctuaire/Veilleur → +2 (plafond 50) ; records → repartent de zéro ; jamais calculés sur un passif boosté par un pouvoir.
- Simulateur `simulerGroupe` (dans `audit-quetes.js`) **calé sur les chronos réels** : `H.facteurJoueurReel = 2,48` sur le tap (Transe, critiques, pouvoirs). Durées : **2,3 / 3,9 / 4,3 / 6,2 / 6,8 / 8,1 h**.
- Économie : paliers de tap et générateurs **jamais fermés, chers avant leur heure** (racine de l'écart de seuil, `PALIER_TAP_ASCENSION`, `GENERATEUR_ASCENSION`) ; +35 % sur les 3 premiers exemplaires des générateurs de chaque Ascension ; ajustement par Ascension `AJUSTEMENT_ASCENSION = [1, 1.3, 1, 1.7, 1.9, 1.9]` sur seuil ET prix.
- Hors ligne : autoclickers × 25 % × temps, 2 h max, **sans plancher** (`offlineEarnings`).
- Rareté plafonnée à **rare** pour les 3 premiers œufs. Combats ≤ 5 par défi. Transe, cibles dorées, pouvoirs : chaînes douces sur 6 Ascensions.
- Signalement des bugs : bouton dans les Options + détection automatique + filet d'`index.js` → mail à `EMAIL_SIGNALEMENT` (une seule ligne, dans `diagnostic.js`).
- Chronos de l'auteur (4e passage, pubs d'œufs) : 1 œuf 7 min · 2 à 13 · 3 à 24 · 4 à 40 · 5 à 60 · 6 à 1 h 18 (« vraiment bien »).

## 4. Les passes restantes (demandées par l'auteur, à faire une par conversation)

### Passe 2 — prix des paliers de tap
Constat de l'auteur : Pacte 10→11 coûte 34 K pour +1 par tap ; Poigne Ancienne 5,4 K pour le même +1 ; Gantelet 7 K par niveau pour +2. Demande : **croissance par niveau ×2,5** (actuel `growth: 1.45` dans `TAP_UPGRADES`), « pareil pour les suivants ».
Aussi : les coûts de BASE des paliers 7 à 10 sont mal ordonnés (Fracture +256/tap moins chère que Griffe +64) — règle d'origine « même valeur au coin » : prix ∝ bonus.
Chaîne obligatoire : changer → `auditBudgetGroupe` (achats = 80-100 % du seuil) → seuils = coût/0,90 → `reordonner-groupe.js` sur les groupes touchés → recalcul des défis d'état (règle passif : 80 % de l'atteignable à l'œuf, montante ; règle de côté : 94 s de production à l'arrivée, +15 % mini entre deux) → `DUREES_CIBLES` → `generer-doc.py` → contrôles → push. **Mesurer avant d'appliquer** ; les sabotages qui citent la formule de prix deviennent périmés, les mettre à jour.

### Passe 3 — supprimer l'œuf 7 (À VALIDER par l'auteur)
« L'œuf 7 de l'A0 fout la merde de partout » (défi 52 = 2 achats critiques ≈ 1,3 M ; ascension déjà possible avant). Idem œuf 14 (A1). Passer à 6 œufs par Ascension change la collection (26 créatures → finies pendant l'A4) et l'outil de réordonnancement lit la taille d'œuf dans le fichier, mais `nbOeufs`, `OEUFS_PAR_ASCENSION`, `generer-doc.py` et les contrôles supposent 7. Alternative si refus : plafonner le coût d'un seul défi (< 15 % du seuil).

### Passe 4 — les pouvoirs par le deck
Décidé : **remplace la bulle**. Compte à rebours sur l'œuf ; 1er appui sur le deck = la créature apparaît autour de l'œuf ; 2e appui = activation ; recharge selon la rareté (proposition mesurée : commun ×2,4 / 60 s, légendaire ×12 / 3 min, mythique ×18 / 5 min). Recommandations : un compte à rebours par créature, pouvoir maintenu si on quitte l'écran, `powerActivated` compte les activations du deck, recharge qui tourne hors ligne. Recalibrer ensuite `facteurJoueurReel`.

## 5. L'auteur — comment travailler avec lui
- Réponses **courtes, structurées, code couleur** 🟩🟥🟨🟦, une recommandation tranchée ; pas de question sauf strictement nécessaire.
- Il teste sur son téléphone et donne des **chronos** : ce sont les mesures de référence. Il speedrun parfois (pubs d'œufs, énergie max en dev) : le dire dans les calibrations.
- Il refuse ce qui n'est pas mesuré ; il repère les défis « inutiles » (déjà remplis) et les « abusés ».
- Quand une réponse plante, c'est la taille de la conversation : **une passe par conversation**, et vérifier `git status` en arrivant (une tentative ratée peut avoir laissé des fichiers modifiés non mesurés — c'est arrivé le 24/09).

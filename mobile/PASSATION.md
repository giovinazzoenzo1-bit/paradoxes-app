# PASSATION — Paradox Clicker (24/09/2026)

À coller au début d'une nouvelle conversation, avec le token GitHub.
Ce fichier est la mémoire courte ; la longue est dans `CLICKER_ADVENTURE_STATE.md` et `WIKI_DEFIS.md`.

## 1. Démarrage de session — dans cet ordre, sans rien coder avant

```
git clone https://<TOKEN>@github.com/giovinazzoenzo1-bit/paradoxes-app.git
cd paradoxes-app
mkdir -p /home/claude/auditenv && cd /home/claude/auditenv && npm init -y >/dev/null && npm i @babel/core @babel/preset-env @babel/preset-react >/dev/null && cd -
```
0. **Garde anti-doublon, à CHAQUE réponse qui écrit** : `sh mobile/tools/garde.sh prendre <étiquette>` en première commande, `rendre` après le push. STOP = ne rien écrire et prévenir l'auteur. Aucune attente de publication (`sleep`) dans une réponse : vérifier `actions/runs` au message suivant.
1. Lire **en entier** `mobile/CLICKER_ADVENTURE_STATE.md`, puis `mobile/WIKI_DEFIS.md`, puis `mobile/A_FAIRE.md`.
2. Lancer les contrôles et rapporter le résultat :
```
export NODE_PATH=/home/claude/auditenv/node_modules
node mobile/tools/verifier-defis.js        # les 44 contrôles du jeu (dont l'exhaustif et la structure des œufs)
node mobile/tools/verifier-controles.js    # la preuve que chaque contrôle sait crier (46 sabotages)
node mobile/tools/verif-exhaustive.js      # les 322 VRAIS défis (il testait les 42 anciens modèles avant le 24/09)
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

## 3 bis. CHANTIER EN COURS — le Gardien se cale sur le deck (24/09)
Demande : « parfait à l'œuf 2, trop facile ensuite ; attaques de zone pas toujours ; qu'il se recalibre souvent ; qu'il gagne 1/3 » + puissance du deck affichée (avant le combat, et en permanence dans le menu Aventure). MESURÉ avant : le Gardien ne gagnait JAMAIS (œufs 2 à 40).
- **2a FAIT (moteur, non branché)** : `combatLogic.js` — `puissanceDeck` (√(PV × dégâts), affichage) ; règles PARTAGÉES `coupSurGardien`, `riposteGardien` (zone : 1 riposte sur 4, 60 % aux autres), `encaisser`, `degatsDuJoueur` ; `simulerCombatGardien` ; `calibrerGardien` (départ à puissance égale, puis correctif de l'ATTAQUE seule, 400 combats, côté facile sur les paliers) ; `calibrageGardienSur` (jamais d'exception, sinon ancien Gardien). Mesuré sur 33 decks : 17 à 39 %, centré 31 %, ≤ 0,15 s. Contrôle `auditGardienCalibre` + sabotage.
- **2b-1 FAIT** : CombatScreen appelle les règles partagées pour le Gardien (coup, riposte, zone avec bannière « 🌀 », Résilience et K.O. des créatures touchées par la zone) ; prop `guardianCalibrage` (absent = ancien Gardien) ; marqueurs « RÈGLES DU COMBAT » + `auditGardienEmpreinte` (empreinte du passage, sabotage prouvé). Mettre à jour `EMPREINTE_COMBAT` UNIQUEMENT après avoir revérifié que `simulerCombatGardien` suit.
- **2b-2 À FAIRE** : calibrage au début de chaque œuf à partir de l'œuf 3 (l'œuf 2 garde l'ancien Gardien), stocké dans l'œuf, calculé en différé ; puissance Gardien / deck affichée avant le combat ; puissance du deck dans le menu Aventure ; EMPREINTE des règles restées dans CombatScreen (rotation, mana, premier coup) sous contrôle, pour que la simulation ne dérive jamais en silence.

## 4. Les passes restantes (demandées par l'auteur — dans la MÊME conversation, décision du 24/09)

### Passe 2 — paliers de tap ×2,5 — FAITE (24/09)
`growth` 1,45 → **2,5** sur les 10 paliers, Pacte intact. Mesuré avant : le tap faisait 96-100 % de la production, générateurs morts ; ×2,5 seul mettait l'A2 à 17 h. Compensé par `AJUSTEMENT_ASCENSION` (dichotomie), 24 cibles de défis recalées (paliers en part du seuil : niveau final 7/8 · 8/9 · 10/9 · 10/10 · 10/10 ; Pacte A2 9→6, A3 13→11 ; Dégâts critiques A2 19→17 ; Golems A3 5→9), `QUEST_ENGINE_VERSION` 58, `auditPlafondAchats` lit la pente. Budgets 88 / 89 / 85 / 82 / 86 %.
⚠️ **A0 non compensable** (prix fixes = 86 % de son budget) : 2,2 → **3,0 h** en sim (~1 h 30 réel pour l'auteur au lieu de 1 h 05). Effet direct de sa demande, **à confirmer par lui**.
⚠️ Transition : un joueur en cours de groupe A1+ avec des paliers achetés à 1,45 se verra demander 1 niveau au nouveau prix ; une Ascension remet les paliers à zéro.
**Complément (24/09, 2e commit)** : la chaîne prévue ici demandait aussi le **recalcul des défis d'état** — ni l'une ni l'autre des deux instances ne l'avait fait. Mesuré : les cibles « Mets N de côté » valaient 2 à 7 fois l'étalon (94 s de production) aux A2-A5, le tap ayant été divisé par 2 à 7 ; les floors de passif étaient à 8-17 % de l'atteignable. **40 cibles recalculées** (passif = 80 % de l'atteignable à la fin de l'œuf, croissant ; de côté = 94 s de production, +15 % mini entre deux), A0 intact. Nouveau contrôle `auditCoteEtalon` + sabotage. `QUEST_ENGINE_VERSION` 59.
**Clôture de la chaîne (24/09, 3e commit)** : le **réordonnancement** n'avait été lancé par aucune instance. Mesuré : 2 défis d'achat moins chers que le précédent aux A1-A5 avant la passe 2, **13 après** (la tolérance de 50 % d'`auditCoutCroissant` les laissait passer). `reordonner-groupe.js` 1 à 5 → **1** (A1, ×0,85) ; A0 intacte ; contenu identique par groupe ; aucun défi d'état ne change d'œuf (les 40 cibles restent justes). L'outil renomme les identifiants selon l'œuf : `QUEST_ENGINE_VERSION` 60. Et `verif-exhaustive.js` testait les **anciens modèles** (vert avec un libellé cassé dans un vrai défi) : il lit `DEFIS_ECRITS`, et `auditExhaustif` le branche dans la suite avec son sabotage.
⚠️ **À TRANCHER PAR L'AUTEUR — le rythme de ses 6 premiers œufs.** Le simulateur retrouve son chrono avec l'ancien réglage (2,6 M gagnés en 75 min à 6,7 taps/s sans pause ; lui : 6 œufs et 2,6 M en 78 min). Avec ×2,5 : **101 min** pour les mêmes 2,6 M (×1,35), donc ses 6 œufs validés passent vers **~1 h 40**. Mécanique : moins de gros scores = moins de pièces par minute. Pour garder 1 h 18 avec ×2,5, il faut baisser d'environ 25 % le coût des défis d'achat de l'A0 (œufs 2 à 6, tutoriel intact) ; à faire avec la passe 3, qui reconstruit l'A0 de toute façon.

Non fait, reporté : les coûts de BASE des paliers 7 à 10 mal ordonnés — mesuré le 24/09 : les prix EFFECTIFS à leur Ascension sont croissants (3 k → 8,4 M), seule la dépense par +1 tap ne l'est pas (42 k à l'A3, 16-21 k aux A4-A5) ; poids réel 0,1-0,5 % du seuil au niveau 5. Règle d'origine « prix ∝ bonus », à mesurer si l'auteur le veut.

### Passe 3 — supprimer l'œuf 7 de l'A0 et de l'A1 — FAITE (24/09)
Décision de l'auteur : « oui fais ça », « en réalité je veux juste un décalage ». `OEUFS_PAR_GROUPE = [6, 6, 7, 7, 7, 7]` (40 œufs, 322 défis) : A0 et A1 = leurs œufs 1-6 à l'identique + l'Ascension en fin d'œuf 6 (9 défis) ; A2-A5 identiques. Seuil inchangé : achats 43 % (A0) et 30 % (A1) du seuil, bornes propres dans `auditBudgetGroupe`. Toute position d'œuf passe par `debutGroupe` / `groupeDeOeuf` / `tailleGroupe` ; la sauvegarde garde sa disposition et `migrerIndexOeuf` la convertit (un joueur de l'ancien œuf 7 retombe sur l'œuf 6, qui porte l'Ascension). Bug ancien corrigé au passage : dès l'A1, chaque réouverture recalculait les cibles de l'œuf en cours (`SEQUENCE_LENGTH` = 7 servait de taille de séquence). `QUEST_ENGINE_VERSION` 61. Nouveau contrôle `auditStructureOeufs` + sabotage.
Mesuré à l'A0, au rythme de l'auteur (6,7 taps/s, sans pause) : **1 h 55** (6 œufs ~1 h 41 + ~15 min de farm), contre 1 h 43 avec l'œuf 7 avant le ×2,5. ⚠️ L'A1 n'a pas de chrono : son œuf 7 portait 57 % des achats, le farm après l'œuf 6 y sera plus long qu'à l'A0 — à mesurer par l'auteur.

Historique de la demande :
« L'œuf 7 de l'A0 fout la merde de partout » (défi 52 = 2 achats critiques ≈ 1,3 M ; ascension déjà possible avant). Idem œuf 14 (A1). Passer à 6 œufs par Ascension change la collection (26 créatures → finies pendant l'A4) et l'outil de réordonnancement lit la taille d'œuf dans le fichier, mais `nbOeufs`, `OEUFS_PAR_ASCENSION`, `generer-doc.py` et les contrôles supposent 7. Alternative si refus : plafonner le coût d'un seul défi (< 15 % du seuil).

**Poigne Ancienne recalculée (24/09)** : 1er niveau à l'A0 = moitié du Pacte 10→11 (21,5 k), ×1,45 — 8 niveaux à l'A0, rythme de l'auteur inchangé ; 2e étape A1 2 → 4 ; `auditPoigneA0` + sabotage ; `QUEST_ENGINE_VERSION` 62.

### Passe 4 — les pouvoirs par le deck
Décidé : **remplace la bulle**. Compte à rebours sur l'œuf ; 1er appui sur le deck = la créature apparaît autour de l'œuf ; 2e appui = activation ; recharge selon la rareté (proposition mesurée : commun ×2,4 / 60 s, légendaire ×12 / 3 min, mythique ×18 / 5 min). Recommandations : un compte à rebours par créature, pouvoir maintenu si on quitte l'écran, `powerActivated` compte les activations du deck, recharge qui tourne hors ligne. Recalibrer ensuite `facteurJoueurReel`.

## 5. L'auteur — comment travailler avec lui
- Réponses **courtes, structurées, code couleur** 🟩🟥🟨🟦, une recommandation tranchée ; pas de question sauf strictement nécessaire.
- Il teste sur son téléphone et donne des **chronos** : ce sont les mesures de référence. Il speedrun parfois (pubs d'œufs, énergie max en dev) : le dire dans les calibrations.
- Il refuse ce qui n'est pas mesuré ; il repère les défis « inutiles » (déjà remplis) et les « abusés ».
- **Il reste sur UNE conversation** (abonnement Max, refus explicite d'en changer, 24/09). Réponses courtes : peu de commandes, sorties filtrées à quelques lignes, jamais de fichier entier affiché, pas d'attente de publication. Une réponse coupée relance une copie (« Réessayer ») : c'est `garde.sh` qui protège le dépôt.

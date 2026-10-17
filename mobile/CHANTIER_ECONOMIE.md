# CHANTIER « ÉCONOMIE PAR ASCENSION » + OBJETS v2 — cahier des charges (18/10)

> À lire EN ENTIER au début de la conversation, juste après `CLICKER_ADVENTURE_STATE.md`.
> Tout ce qui n'est pas marqué **PROPOSITION** est une décision de l'auteur. Les PROPOSITIONS se valident
> AVANT de coder, toutes ensemble, chiffrées (section 3).

---

## 0. Déjà en ligne — ne pas refaire

| Version | Contenu |
|---|---|
| c21ea8e | Rapport « Signaler un problème » : diagnostic du chrono des défis (il s'arrêtait après l'œuf 1). **En attente** d'un rapport de l'auteur après 2-3 défis d'un nouvel œuf → lire « Mesures enregistrées il y a… », les « ↪ » et « Erreur du chrono », puis corriger la cause. |
| 171476f | Verrou de fin d'Ascension en Aventure **retiré** ; énergie max **8** (recharge 20 min inchangée). |
| 67c9479 · e5f32d7 | Calculateur de défis EN JEU (`src/games/clicker/calculDefis.js`), branché à l'apparition du défi. Temps visé : **2 min** par défi à l'œuf 1, **3,5** à l'œuf 2, **5** dès l'œuf 3, puis **+0,75 tous les 3 œufs** (14 min à l'œuf 40). |
| 44faffd | Fausses pubs de 15 s : +1 poudre (Runes), Tap ×2 pendant 2 min (écran principal, exclu de la photo des défis), « Achète une rune » compte depuis l'apparition du défi. |
| e7b81e0 | Logos des pubs (`assets/pubs/`, index `src/components/iconesPubs.js`). |
| branche `calculateur-defis-v23` | Outil de MESURE (joueur à 7 taps/s qui fait les défis dans `simulerGroupe`). ⚠️ Son `tempsViseOeuf` garde un ancien réglage : il doit APPELER `calculDefis.tempsViseOeuf` et `cibleCalculee`. |

---

## 1. Constat mesuré (18/10)

**Prix « avant l'heure » trop faibles.** La surprime actuelle (`surprimeAvantLHeure`, racine de l'écart de seuil) ne fait que ×2 pour l'Ascension suivante. Niveau 1 vu UNE Ascension trop tôt, en part du seuil du moment :

| Objet (Ascension prévue) | Vu à | Prix niv. 1 | Part du seuil |
|---|---|---|---|
| Gantelet d'Obsidienne (A1) | A0 | 6 032 | 0,2 % (niv. 2 : 0,5 %) |
| Sceau de Puissance (A2) | A1 | 168 486 | 1,4 % |
| Poing de Granit (A2) | A1 | 269 588 | 2,3 % |
| Éclat / Coeur (A3) | A2 | 565 k / 903 k | 0,3 / 0,5 % |
| Griffe / Serment (A4) | A3 | 711 k / 1,1 M | 0,0 % |
| Fracture / Volonté (A5) | A4 | 3,1 M / 5,0 M | 0,0 % |
| Générateurs en avance | — | — | 0,2 à 20 % |

Preuve : le joueur de référence finit l'A0 avec **Gantelet niveau 5** et **2 niveaux de Sceau de Puissance** (objet de l'A2).

**Répartition actuelle des objets** (règle de l'auteur du 20/09 « 2 par Ascension » respectée seulement de l'A2 à l'A5) :
A0 = 2 générateurs (Esprit, Main), 0 palier · A1 = 2 paliers (Poigne, Gantelet), **0 générateur** · A2-A5 = 2 + 2.

**Sanctuaire / Veilleur** (prix FIXES, sans bonus d'Ascension → dérisoires dès l'A1) :
Sanctuaire +0,5 % de production par niveau, max 50 (×1,25), 0 → 50 = 85 933 pièces.
Veilleur +1 % de gains hors ligne par niveau, max 50 (×1,5), 0 → 50 = 171 865 pièces.
Seuils : A0 3,1 M · A1 11,6 M · A2 190 M · A3 13 Md · A4 60 Md · A5 370 Md.

**Critiques actuels** : Faveur +1,25 % de chance par niveau (plafond 30 % au niveau 24) ; Dégâts critiques ×2 + 0,5 par niveau. Prix fixes (120 × 1,6^n et 200 × 1,7^n).

---

## 2. Décisions de l'auteur

### 2.1 Deux paliers de tap + deux générateurs PAR Ascension

La Poigne Ancienne fait partie de l'A0, comme la Main Spectrale. Tout se décale d'un cran :

| Ascension | Paliers de tap | Générateurs |
|---|---|---|
| A0 | Poigne Ancienne (+ le Pacte) | Esprit Frappeur, Main Spectrale |
| A1 | Gantelet d'Obsidienne, Sceau de Puissance | Automate Runique, Colonie de Familiers |
| A2 | Poing de Granit, Éclat Primordial | Titan Mécanique, Golem de Cristal |
| A3 | Coeur de Supernova, Griffe du Vide | Dragon Miniature, Phénix Renaissant |
| A4 | Serment Éternel, Fracture du Réel | Léviathan des Abysses, Gardien Céleste |
| A5 | Volonté du Paradoxe + **1 palier à créer** | Héraut d'Orage, Colosse de Pierre |

`PALIER_TAP_ASCENSION` et `GENERATEUR_ASCENSION` (clickerLogic.js) changent en conséquence ; le contrôle `auditMajorationPrix` vérifie qu'ils correspondent aux défis.

### 2.2 Objet d'une Ascension future : visible, jamais grisé, juste très cher

- Prévu pour l'Ascension **suivante** : niveau 1 ≥ **60 % du seuil actuel** (atteignable en farmant beaucoup en fin de groupe) ; niveau 2 **jamais** atteignable (> 100 % du seuil).
- Prévu **2 Ascensions plus loin ou plus** : ≥ **3 × le seuil actuel** (hors de portée, pas fermé).
- Même règle pour les générateurs.
- À l'Ascension qui l'ouvre : **pas de baisse brutale** — c'est le **bonus d'Ascension** qui le rend abordable (une baisse directe ferait acheter en masse dès l'A1 → chiffres exorbitants).

### 2.3 Défis d'achat

- Chaque Ascension demande d'améliorer **SES** objets (ses 2 paliers et ses 2 générateurs).
- A1 : « améliorer Gantelet et le suivant » (Sceau de Puissance), **plus d'avalanche de défis de Pacte**.
- Les cibles restent calculées par `calculDefis` (temps visé) : seul l'OBJET de chaque défi change dans `defisEcrits.js`.

### 2.4 Sanctuaire / Veilleur

- **Un défi chacun par Ascension**, placé vers le début de l'Ascension.
- A0 : niveau **42** (Sanctuaire) et **40** (Veilleur), comme aujourd'hui.
- **Dès l'A1 : niveau 50 directement** (le maximum) — « ça ne coûte pas cher à partir de l'A1 ».

### 2.5 Nouveaux objets « v2 », placés SOUS les originaux dans le Grimoire

- **Faveur v2** : débloquée à l'**A1**. Chance de coup critique très basse : **0,05 % au niveau 1, +0,025 % par niveau**. Le coup donne **×10** (« super critique »).
- **Dégâts critiques v2** : débloqués à l'A1, renforcent ce super critique (effet exact : PROPOSITION 3).
- **Niveaux limités par Ascension** : 1 à 2 niveaux chacun à l'A1, 2 à 3 de plus à l'A2, « etc. » (chiffres : PROPOSITION 1).
- **Animation du super critique : BLEUE, « pétante, stylée »** (différente du critique normal).
- **Sanctuaire v2** et **Veilleur v2** : même principe, stats **beaucoup moins fortes**, **beaucoup plus chers**.

---

## 3. PROPOSITIONS à faire valider AVANT de coder (toutes ensemble, chiffrées)

1. **Plafond de niveaux des v2** (cumulé) : A1 2 · A2 5 · A3 8 · A4 11 · A5 14 (+3 par Ascension). Au-delà, le bouton affiche « Niveau max de cette Ascension ».
2. **Super critique** : tirage SÉPARÉ, fait avant le critique normal ; s'il tombe, gain × multiplicateur v2 (pas de cumul avec le critique normal). Chance à 14 niveaux : 0,375 %.
3. **Dégâts critiques v2** : ×10 tant qu'on n'en a pas, puis +2 par niveau (×12, ×14…), mêmes plafonds que la Faveur v2.
4. **Sanctuaire v2** : +0,1 % de production par niveau (5 fois moins que l'original) ; **Veilleur v2** : +0,2 % de gains hors ligne par niveau ; mêmes plafonds par Ascension.
5. **Prix des v2** : niveau 1 ≈ 30 % du seuil de l'Ascension en cours, ×2,5 par niveau, et SUIVENT le bonus d'Ascension (jamais de prix fixe : c'est ce qui rend les originaux dérisoires).
6. **11e palier de tap** (A5) : nom, emoji, bonus ×2 du précédent, prix sur la rampe ; logo Gemini (règles de `design/a-integrer/18-pubs/PROMPTS.md`).
7. **Seuils plus chers** : déduits de la chaîne de défis (calculateur étape 2), sur un deck malchanceux, ÷ 0,9 — ampleur à montrer au simulateur.
8. **Logos des v2** (Faveur v2, Dégâts v2, Sanctuaire v2, Veilleur v2) : prompts Gemini fond magenta, dans le même style que les originaux.

---

## ✅ ÉTAT : CHANTIER CODÉ, CONTRÔLÉ ET PUBLIÉ — détail et causes dans CLICKER_ADVENTURE_STATE.md (« CHANTIER ÉCONOMIE »).
- 5 (prix des légendaires) : tranché — 4 / 6 / 8 % du seuil puis +2 points, × coefficient (×1 → A2, ×½ A3, ×¼ A4+), « go coefficient ».
- Les 3 défis bloquants (section 7) : réglés — arrondi des défis de revenu/s + BASCULE automatique des achats trop gros.
- Noms retenus : Faveur / Dégâts / Sanctuaire / Veilleur légendaires ; critique légendaire (popup bleue).

## 3 bis. DÉCISIONS DE L'AUTEUR (17/10) — remplacent les PROPOSITIONS de la section 3

- **Seuils d'abord (n°7)** : MESURÉ — depuis le calculateur de défis, le joueur gagnait 4,5 × (A0) à 243 × (A2) l'ancien seuil
  avant la fin de sa chaîne → le seuil ne freinait plus personne et tout « % du seuil » était faux. Seuil = pièces gagnées en fin
  de chaîne **+ 10 min de production** (pas « ÷ 0,9 » : 35 à 59 min de farm pour tous aux A4-A5), deck malchanceux (10e centile,
  20 suites d'œufs), point fixe avec le plancher 2.2. Outil `mobile/tools/mesure-seuils.js` — À RELANCER après chaque changement
  de défis, de prix ou d'objets. Remarque de l'auteur : on ne peut de toute façon pas ascensionner sans le défi de fin d'Ascension.
- **Conflit 2.2 tranché** : « niveau 1 ≥ 60 % du seuil avant l'heure » GARDÉ ; à l'Ascension qui l'ouvre, le prix redevient NORMAL
  (la règle « pas de baisse brutale » est levée : sinon l'objet coûtait 28 % du seuil au niveau 1, ses défis devenaient infaisables).
- **1** plafond v2 : A1 2 · A2 5 · A3 8 · A4 11 · A5 14 (+3 par Ascension), niveaux PERMANENTS (jamais remis à zéro).
- **2** « **critique légendaire** » : tirage séparé, il S'AJOUTE au critique normal (multiplie le coup, critique compris),
  animation BLEUE différente du critique normal.
- **3** Dégâts v2 : ×10, puis +2 par niveau. Le critique légendaire DOIT entrer dans `calculDefis.productionReference`
  (espérance p × (mult − 1)) — sinon les défis deviennent trop faciles.
- **4** Sanctuaire v2 : **+0,2 %** de production par niveau. Veilleur v2 GARDÉ : +0,2 % de gains hors ligne par niveau.
- **5** Prix des v2 : idée de l'auteur « 4 à 8 % du seuil », achetables du milieu à la fin de chaque Ascension — MESURE et
  proposition dans la conversation du 17/10 (en attente de réponse).
- **6** 11e palier : **Couronne de l'Origine** 👑, bonus 1 024, prix ×2 Volonté (79 506 de base), ×2,5 par niveau.
- **8** Logos : prompts Gemini 93 à 97 dans `design/a-integrer/02-boutique/PROMPTS-V2.md`.
- « Atteins X pièces par seconde » : DOIT être calculé par le calculateur (il l'est) — la cible sort 3 à 8 × trop longue aux
  A3-A5 (mesuré) : cause à trouver avec les défis bloquants (section 7).

## 4. Ordre de travail (chaque étape MESURÉE avant la suivante)

1. Branche à part. Répartition 2.1 + prix 2.2 → **mesurer** au simulateur (outil v2.3 réaligné sur `calculDefis`) : ce que le joueur achète à chaque Ascension, durée des groupes, taille des cibles en pièces à l'A1 et à l'A2. Montrer les chiffres à l'auteur.
2. Défis d'achat 2.3 + Sanctuaire / Veilleur 2.4 dans `defisEcrits.js` → régénérer `DEFIS_PARADOX.md` (generer-doc.py) → mesurer.
3. Objets v2 (logique pure dans clickerLogic, Grimoire, plafonds par Ascension, animation bleue) → `productionReference` de `calculDefis` doit compter le super critique (espérance p × (mult − 1)) → mesurer.
4. Contrôles (section 5) + sabotages.
5. Rituel complet : compilation, portée, `verifier-defis` vert, **6 passes** de `verifier-controles` (0-71, 71-106, 106-142, 142-190, 190-230, 230-fin), sonde des taps 20/20, Exploration, capture de l'écran → publier → mémoire.

---

## 5. Contrôles à écrire ou réécrire

- `auditMajorationPrix` / surprime : nouvelle règle (60 % du seuil, niveau 2 jamais, 3 × le seuil au-delà, pas de baisse brutale à l'ouverture).
- `auditPoigneA0` : la Poigne est désormais un objet de l'A0.
- Nouveau `auditObjetsParAscension` : exactement 2 paliers + 2 générateurs par Ascension (A5 : selon le 11e palier).
- `auditBudgetGroupe`, ordre des coûts, `auditCalculateurDefis` (le super critique compte dans la production).
- Nouveau `auditSuperCritique` : 0,05 % + 0,025 % par niveau, ×10, plafonds par Ascension, prix qui suivent le bonus d'Ascension, animation bleue branchée.
- Sanctuaire / Veilleur : 42 / 40 à l'A0, 50 dès l'A1, un seul défi chacun par Ascension.
- Un sabotage par garantie ; toute ligne visée par un sabotage déjà existant → mettre son repère à jour.

---

## 6. Pièges connus, utiles pour ce chantier

- **Trois barèmes bougent ensemble** : seuils, prix, rendements. En bouger un seul casse les deux autres.
- `calculDefis` lit les **prix réels** (`coutNiveauAchat`) : toute nouvelle règle de prix change les cibles → re-mesurer.
- Les prix **fixes** (Sanctuaire, Veilleur, Faveur, Dégâts critiques) deviennent dérisoires en fin de jeu : les v2 doivent suivre le bonus d'Ascension.
- Le **Tap ×2 de la pub** est un bonus temporaire exclu exprès de la photo des défis ; les **pièces d'Offrande** sont protégées.
- « Réessayer » relance une 2e copie : ne jamais l'utiliser ; écrire « continue ». Vérifier `.git/verrou-claude` et `pgrep node` au début.
- Une 1re victoire en Aventure n'est plus bloquée par un verrou : ne pas en remettre sans plafonner le « +5 niveaux » des défis.

---

## 7. Autres chantiers en attente (ne pas oublier)

- **Les 3 défis bloquants** : « Atteins 32 pièces par seconde » (œuf 12, 49 h à cause du « +20 % » d'avant), revenu/s de l'œuf 26 (39 min), « Achète 1 niveau de Volonté du Paradoxe » (72 min, un niveau trop cher).
- **Calculateur, étape 2** : seuils déduits de la chaîne ; étoile « Conseillé » sur `productionReference` ; simulateur qui appelle `cibleCalculee` (contrôle « chaque défi ≈ temps visé ±20 % ») ; liste « 1 item > 2 × budget » ; contrôle « 2 h hors ligne < 100 % d'un défi ».
- **Rapport** : lire la capture de l'auteur (diagnostic c21ea8e), corriger la cause.
- **Logos** : 87, 89, 90, 91, 92 à générer ; coffre (88) à refaire (lueur rose).
- **Bug** : un œuf en train d'éclore bloque l'œuf suivant.
- **Idée** : défis sous forme de mini-jeux de clic (rétention).

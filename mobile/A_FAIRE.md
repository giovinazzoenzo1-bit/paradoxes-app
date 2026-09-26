# À FAIRE — demandes de l'auteur à ne pas oublier

> Fichier demandé le 21/09 : « à chaque fois que je te demande un truc
> dans l'avenir, ajoute-le à un fichier exprès pour pas que j'oublie ».
> Une ligne par demande, avec la date. On raye quand c'est fait.

## Équilibrage
- [ ] 24/09 — **Coûts de base des paliers 7 à 10** : prix effectifs croissants (3 k → 8,4 M), mais la dépense par +1 tap n'est pas monotone (42 k à l'A3, 16-21 k aux A4-A5). Poids 0,1-0,5 % du seuil au niveau 5 : faible. Règle « prix ∝ bonus », à faire seulement si tu le veux.

## Tests de l'auteur (« une autre fois »)
- [ ] 24/09 — **Chronos A0 + A1** : heure de fin de l'œuf 6, puis de l'Ascension, pour chacune. L'A1 n'a jamais été mesurée depuis la suppression de l'œuf 7.
- [ ] 24/09 — **Gardien** : nombre de victoires / défaites, et l'écart de puissance affiché colle-t-il à la difficulté ressentie ?
- [ ] 24/09 — **Pouvoirs du deck** : rythme bon, trop rapide ou trop lent ?
- [ ] Ensuite (Claude) : recaler le simulateur sur ces chronos (les pouvoirs du deck donnent +10 à +25 % en début de partie) ; décider du décalage de l'œuf 7 pour A2-A5 selon le farm après l'œuf 6 de l'A1.
- [ ] À surveiller : Gardien à haut niveau sans amélioration ; défis « Active N pouvoirs » des dernières Ascensions avec un deck plein de mythiques (moins d'activations par minute).

## Structure

## Faits (à rayer au fur et à mesure)
- [x] 21/09 — Combats : jamais plus de 5 par défi, tous les groupes.
- [x] 21/09 — Pouvoirs : 18 → 11 à l'œuf 6, 36 → 12 au défi 50, montée douce ensuite.
- [x] 21/09 — Défis adaptatifs : jamais calculés sur un passif boosté par un pouvoir.
- [x] 21/09 — Paliers de tap : croissance ×2,5 par niveau (Pacte intact), 24 défis recalés, ajustement par Ascension remesuré. Fait le 24/09 — ⚠️ A0 passe de 2,2 à 3,0 h (sim), effet direct de la demande, à confirmer.
- [x] 21/09 — Simulateur : 9 pauses hors ligne de 1 h 15 par Ascension, réparties sur le groupe (`H.pausesParGroupe`). Fait le 24/09.
- [x] 24/09 — Passe 2, complément : 40 cibles d'état (passif, de côté) recalculées sur la nouvelle économie ; contrôle `auditCoteEtalon` ajouté.
- [x] 21/09 — Œuf 7 supprimé à l'A0 et à l'A1 (« juste un décalage ») : l'Ascension ferme l'œuf 6, seuil inchangé ; le défi 52 part avec. Fait le 24/09.
- [x] 24/09 — **Poigne Ancienne** recalculée : « bien de pouvoir la up à A0, mais pas trop cheaté ». 1er niveau = moitié du Pacte 10→11, ×1,45 : 8 niveaux à l'A0, rythme inchangé.
- [x] 21/09 — Gardien : se cale sur les 3 meilleures créatures au début de chaque œuf (gagne ~1 fois sur 3, mesuré 17-39 %), attaques de zone 1 fois sur 4, puissance affichée avant le combat et dans l'Aventure ; œuf 2 inchangé. Fait le 24/09.
- [x] 21/09 — Pouvoirs par le deck : appui = la créature apparaît autour de l'œuf, 2e appui = pouvoir, appui long = changer de créature ; recharge par rareté (commune 1 min … mythique 4 min 30) ; compte à rebours sur l'œuf ; plus de bulle. Fait le 24/09.
- [x] 21/09 — Griffes : succès ÷10 (15/40/100/250/600 : l'A0 donnait 7 150 Griffes ≈ 360 combats, désormais 715), hebdos ÷4 (≈ 1 200/semaine, 43 % du revenu du combat), quotidiens inchangés ; contrôle `auditGriffesBonus`. Fait le 24/09.

### Décisions de l'auteur (24/09, après le calibrage de l'Aventure)
- [x] **Gardien : on n'y touche pas** — il reste calé sur le deck du joueur (photo à chaque œuf). Pas de plafond : « le système ajoute des défis de niveau de créature automatiquement ».
- [ ] **Élixir de faiblesse** (à acheter dans le SHOP DIAMANT) : ennemis −10 % pendant 5 combats, affiché avec un compteur. S'applique APRÈS le calibrage (Aventure ET Gardien). ⚠️ Plafond −10 % : MESURÉ, −20 % = 100 % de victoires et efface 4 niveaux de retard (12 % -> 88 %).
- [ ] **Monétisation (plus tard)** : jamais d'avantage caché lié au montant payé ; packs de Griffes + consommables affichés. Prérequis : build native (EAS) + comptes développeur (Expo Go ne permet pas d'encaisser).

### Monétisation et ressenti de la pression (26/09) — validé par l'auteur
- [x] **Élixir de faiblesse** (push 1) : shop diamant, 30 💎 (PRIX PROVISOIRE), ennemis −10 % pendant 5 combats, Aventure ET Gardien, appliqué APRÈS le calibrage, sauvegardé, pastille 🧪 dans l'Aventure et badge en combat.
- [x] **Puissance conseillée** avant chaque combat (push 1), en vert / orange / rouge. ⚠️ Calculée sur les decks de référence ACTUELS (2 rares + 1 épique, ≈ 2 victoires sur 3) : à suivre quand on recalibrera l'Aventure pour le joueur gratuit.
- [x] **Push 2 FAIT** — écran de défaite : « Il te manquait environ X niveaux » (calcul vrai), 3 boutons (monter mes créatures · pack de Griffes 💎 · Élixir 💎 ou +1 énergie contre vidéo), « Tu y étais presque ! » seulement si c'est vrai ; + point 5 : l'achat se ressent tout de suite (message d'effet, puissance +X %).
- [ ] **Pack de départ** — décision de l'auteur (26/09) : ce sera une offre PAYANTE (argent réel), réglée juste avant la sortie du jeu (build native). Rien à coder avant.

### Économie des Griffes et Aventure (26/09) — décisions de l'auteur, à reprendre APRÈS les pushs 2-3
- Naissance des nouvelles créatures à **80 %** du niveau de la meilleure (il veut garder 80 %).
- **Aucune Griffe en rejouant un niveau déjà gagné** (seule la 1re victoire paie) — à coder.
- **3 packs de Griffes contre pièces par Ascension** (4 pour un acharné) — prix à recalculer pour le garantir ; taille des packs selon l'Ascension (+75/A validable).
- Joueur gratuit : **6 victoires sur 10** ; ~2 niveaux de retard par Ascension ; petit payeur ~7,5/10.
- Mesuré : succès réels ≈ 3 840 Griffes sur la partie (pas 13 065) ; les coûts ont des « événements » (A3 : meilleures créatures) — une formule fixe ne donne pas un manque parfaitement régulier.

### Défis (APRÈS l'Aventure)
- [ ] **10 défis d'Aventure doublés** par `ajouter-defis.py` le 23/09 (commit e66fd45) : A1 30→60→120 … A5 →360 ; remettre de 5 en 5 (35/40, 50/55, 65/70, 80/85, 95/100) + corriger l'outil + contrôle (≤ +10 niveaux d'un œuf à l'autre).
- [ ] Règle de l'auteur : on garde « Gagne 4 combats », et **le défi de combat suivant demande 6 combats** (une barre d'énergie + 1 → vidéo).

### Aventure calibrée sur le PARCOURS du joueur gratuit (26/09) — morceau A FAIT
- [x] Simulateur de parcours complet (`tools/simulateur-parcours.js`) + calibrage sur le parcours (`tools/calibrer-parcours.js`) : le joueur UN PEU MALCHANCEUX (30e centile) gagne 6 fois sur 10 (option 2 de l'auteur). Vérifié : 0 joueur bloqué sur 60, ≈ 6 victoires sur 10 à chaque Ascension ; les 10 % les moins chanceux ≈ 2/10 jusqu'à l'A3 (le filet les fait passer), 5/10 ensuite.
- [x] Garantie sur les œufs (`GARANTIE_OEUFS`) : 1 Rare au 6e, 2 au 12e, 1 Épique au 16e, 2 au 22e — RIEN n'est forcé si le joueur a déjà la rareté (demande de l'auteur). NB : le 22e est toujours déjà satisfait (19 créatures seulement sous Épique).
- [x] Filet de sécurité (`FILET_SECURITE`) : 5 / 7 / 10 défaites de suite → −20 / −40 / −60 %, ce niveau seulement, anti-triche 90 % du meilleur deck possible, badge 🛟, compteur sauvegardé.
- [x] Griffes réglage A (`griffesReward`), à la PREMIÈRE victoire seulement ; « Niveau déjà gagné : pas de Griffes ».
- [x] Tables 140 niveaux : `AVENTURE_MULTIPLICATEURS` + `PUISSANCE_CONSEILLEE` ; `auditParcours` (30 joueurs, à chaque push) remplace l'ancien contrôle.
- [x] **Morceau B FAIT** : packs contre pièces — prix = part du SEUIL de l'Ascension (10 / 15 / 20 % puis 60 % le 4e, 300 % au-delà : 3 packs ≈ 15 à 70 min de production de fin d'Ascension, le 4e ≈ 20 à 95 min de plus), taille 100 + 75 × Ascension, compteur remis à zéro à chaque Ascension (+ remise à zéro unique des anciennes sauvegardes). `auditPacks` + 3 sabotages.
- [ ] Ensuite : défis (10 cibles doublées ; « défi suivant = 6 combats »), puis recaler le simulateur sur les chronos réels de l'auteur.


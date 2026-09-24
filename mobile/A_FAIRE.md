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

// ════════════════════════════════════════════════════════════════════
//  MODÈLE DES ÉLÉMENTS DE LA BOUTIQUE (02/10) — fonctions PURES
// ════════════════════════════════════════════════════════════════════
// Prix, états, gains, verrous, achats de chaque élément du Grimoire. Déplacé
// de l'ancien fichier de l'arbre (abandonné), SANS ses positions ; résultat
// prouvé identique (comparaison ancien / nouveau sur 3 parties types, 02/10).
// Économie INCHANGÉE : mêmes fonctions de prix / verrou / achat que ShopView.
import {
  TAP_UPGRADES, UPGRADE_ITEMS, AUTOCLICKERS, TAP_DAMAGE_PER_LEVEL, CREATURES, describeUpgradeEffect,
  tapPowerCost, critUpgradeCost, critDamageUpgradeCost, sanctuaryUpgradeCost, sanctuaryMaxed,
  veilleurUpgradeCost, veilleurMaxed, tapUpgradeCost, tapUpgradeUnlocked, upgradeItemCost,
  autoClickerCost, griffesCoinCost, taillePackGriffes, coreUpgradeUnlocked, ascensionSpeedMultiplier,
  ascensionThreshold, OFFRANDE_APPCOINS_COST, SANCTUARY_MAX_LEVEL, VEILLEUR_MAX_LEVEL,
  coreUpgradeRequirement, critChance, critMultiplier, offrandeReward, SANCTUARY_BONUS_PER_LEVEL, VEILLEUR_BONUS_PER_LEVEL,
  TAP_UPGRADE_UNLOCK_LEVEL, TAP_UPGRADE_FIRST_PACTE_LEVEL, CORE_UNLOCKS,
} from './clickerLogic.js';
import { reliquesParFamille, FAMILLES_RELIQUES, autoClicsParPalier, PALIERS_AUTO } from './boutiqueFamilles.js';

// ── Le modèle : chaque élément avec son prix, son état, son GAIN, son achat ──
// La ligne de GAIN dit ce que rapporte l'élément ; sur un élément verrouillé,
// ce qu'il faut faire pour l'ouvrir (« 🔒 Pacte 3/5 »). `cout(j)` / `estMax(j)`
// : prix et limite des niveaux suivants (×10 / MAX) ; `delta` : ce que change
// un niveau (conseil, gain réel). Aucun nombre écrit en dur : tout vient des
// fonctions et constantes du jeu. (Nom hérité de l'arbre : « nœuds » = éléments.)
function construireNoeuds(p) {
  const f = p.formatNum || ((n) => String(Math.round(n)));
  const nb = (x, d = 2) => Number(x.toFixed(d)).toString().replace('.', ',');
  const remise = p.applyDiscount || ((c) => c);
  const coreState = { tapPower: p.tapPower, critLevel: p.critLevel, critDamageLevel: p.critDamageLevel, sanctuaryLevel: p.sanctuaryLevel };
  const debloque = (id) => coreUpgradeUnlocked(id, coreState);
  const etat = (verrou, max, prix, solde) => (verrou ? 'verrouille' : max ? 'max' : solde >= prix ? 'achetable' : 'cher');
  const N = [];
  const ajouter = (n) => N.push({ taille: 76, devise: 'pieces', allume: false, ...n });
  const exigence = (id) => `🔒 ${coreUpgradeRequirement(id)}`;
  // Progression CHIFFRÉE vers le déblocage (données CORE_UNLOCKS), courte pour
  // la ligne de gain : « 🔒 Pacte 3/5 ». La phrase complète reste en fiche.
  const NOM_COURT = { tapPower: 'Pacte', critLevel: 'Faveur', critDamageLevel: 'Dégâts crit.', sanctuaryLevel: 'Sanctuaire' };
  const progres = (id) => {
    const u = CORE_UNLOCKS.find((x) => x.id === id); const r = u && u.requires;
    if (!r) return exigence(id);
    return `🔒 ${NOM_COURT[r.key] || r.key} ${Math.min(coreState[r.key] || 0, r.level)}/${r.level}`;
  };

  // ── Centre : Ascension, Griffes (gauche), Offrande (droite)
  const seuil = ascensionThreshold(p.ascensionCount);
  ajouter({
    id: 'ascension', taille: 150, emoji: '🌟', nom: 'Ascension',
    niveau: p.ascensionCount > 0 ? `×${ascensionSpeedMultiplier(p.ascensionCount).toFixed(2)}` : '',
    gain: `prochaine ×${nb(ascensionSpeedMultiplier(p.ascensionCount + 1))}`,
    etat: p.ascensionReady ? 'achetable' : 'cher', prix: null, onPress: p.ascensionReady ? p.onAscend : null,
    progres: seuil > 0 ? Math.min(1, (p.totalEarned || 0) / seuil) : 0, allume: true,
    detail: p.ascensionReady
      ? 'Remet ton économie à zéro — tu gardes tes créatures et l\'Aventure.'
      : !p.defiAscensionEnCours
        ? `Débloquée par le défi « Fais ta ${p.ascensionCount + 1}${p.ascensionCount === 0 ? 're' : 'e'} Ascension ».`
        : `Gagne encore ${f(Math.max(0, seuil - (p.totalEarned || 0)))} pièces au total pour débloquer.`,
  });
  const prixGriffes = griffesCoinCost(p.griffesCoinBuys, p.ascensionCount);
  ajouter({ id: 'griffes', taille: 88, emoji: '🐾', nom: `${taillePackGriffes(p.ascensionCount)} Griffes`,
    gain: 'pour l\'Aventure', prix: prixGriffes, etat: etat(false, false, prixGriffes, p.coins), onPress: p.onBuyGriffesWithCoins, allume: true,
    detail: 'Des Griffes pour faire progresser tes créatures en Aventure. Le pack suivant coûtera plus cher.' });
  ajouter({ id: 'offrande', taille: 88, emoji: '💎', nom: 'Offrande', devise: 'diamants',
    gain: `≈ +${f(offrandeReward(p.tapPower))} pièces`, prix: OFFRANDE_APPCOINS_COST, etat: etat(false, false, OFFRANDE_APPCOINS_COST, p.sharedCoins),
    onPress: p.onOffrande, allume: true, detail: `Échange ${OFFRANDE_APPCOINS_COST} diamant${OFFRANDE_APPCOINS_COST > 1 ? 's' : ''} contre un bonus de pièces.` });

  // ── PUISSANCE DE TAP : Pacte → les 10 améliorations en UNE chaîne (chacune
  // s'ouvre au niveau 5 de la précédente : la branche montre la dépendance).
  const prixPacte = remise(tapPowerCost(p.tapPower));
  ajouter({ id: 'pacte', emoji: '🔗', nom: 'Pacte', niveau: `${p.tapPower}`,
    gain: `+${nb(TAP_DAMAGE_PER_LEVEL, 1)} / tap / nv`, prix: prixPacte, etat: etat(false, false, prixPacte, p.coins), onPress: p.onBuyTapPower, cout: (j) => tapPowerCost(p.tapPower + j), delta: { tapPower: 1 }, allume: p.tapPower > 1,
    detail: `+${nb(TAP_DAMAGE_PER_LEVEL, 1)} pièce par tap à chaque niveau.` });
  let prochainVerrou = false;
  TAP_UPGRADES.forEach((item, i) => {
    const niveau = (p.tapUpgrades && p.tapUpgrades[item.id]) || 0;
    const ouvert = tapUpgradeUnlocked(i, p.tapPower, p.tapUpgrades);
    if (!ouvert) { if (prochainVerrou) return; prochainVerrou = true; } // seul le PROCHAIN verrou est montré
    const prix = remise(tapUpgradeCost(item, niveau, p.ascensionCount));
    const avant = i > 0 ? ((p.tapUpgrades && p.tapUpgrades[TAP_UPGRADES[i - 1].id]) || 0) : 0;
    const condition = i === 0 ? `🔒 Pacte ${Math.min(p.tapPower, TAP_UPGRADE_FIRST_PACTE_LEVEL)}/${TAP_UPGRADE_FIRST_PACTE_LEVEL}` : `🔒 ${TAP_UPGRADES[i - 1].name} ${Math.min(avant, TAP_UPGRADE_UNLOCK_LEVEL)}/${TAP_UPGRADE_UNLOCK_LEVEL}`;
    ajouter({ id: item.id,
      emoji: item.emoji, nom: item.name, niveau: `nv ${niveau}`, prix, etat: etat(!ouvert, false, prix, p.coins),
      gain: ouvert ? `+${f(item.bonus)} / tap / nv` : condition,
      onPress: (q) => p.onBuyTapUpgrade(item.id, q), cout: (j) => tapUpgradeCost(item, niveau + j, p.ascensionCount), delta: { tapUpgrades: item.id }, allume: niveau > 0,
      detail: ouvert ? `+${f(item.bonus)} par tap et par niveau${niveau > 0 ? ` · actuellement +${f(item.bonus * niveau)}` : ''}.` : condition });
  });

  // ── CRITIQUES : Faveur des Esprits (chance) → Dégâts critiques (force)
  const prixFaveur = remise(critUpgradeCost(p.critLevel));
  const okFaveur = debloque('faveur');
  ajouter({ id: 'faveur', emoji: '✨', nom: 'Faveur des Esprits', niveau: `nv ${p.critLevel}`,
    gain: okFaveur ? `+${nb((critChance(p.critLevel + 1) - critChance(p.critLevel)) * 100)} % crit / nv` : progres('faveur'),
    prix: prixFaveur, etat: etat(!okFaveur, false, prixFaveur, p.coins), onPress: p.onBuyCrit, cout: (j) => critUpgradeCost(p.critLevel + j), delta: { critLevel: 1 }, allume: p.critLevel > 0,
    detail: okFaveur ? `${nb(critChance(p.critLevel) * 100)} % de chance de coup critique.` : exigence('faveur') });
  const prixCrit = remise(critDamageUpgradeCost(p.critDamageLevel));
  const okCrit = debloque('critDamage');
  ajouter({ id: 'critDamage', emoji: '💥', nom: 'Dégâts critiques', niveau: `nv ${p.critDamageLevel}`,
    gain: okCrit ? `+${nb(critMultiplier(p.critDamageLevel + 1) - critMultiplier(p.critDamageLevel), 1)} force crit / nv` : progres('critDamage'),
    prix: prixCrit, etat: etat(!okCrit, false, prixCrit, p.coins), onPress: p.onBuyCritDamage, cout: (j) => critDamageUpgradeCost(p.critDamageLevel + j), delta: { critDamageLevel: 1 }, allume: p.critDamageLevel > 0,
    detail: okCrit ? `Coup critique ×${nb(critMultiplier(p.critDamageLevel), 1)}.` : exigence('critDamage') });

  // ── PASSIF : Sanctuaire → Veilleur
  const maxS = sanctuaryMaxed(p.sanctuaryLevel); const prixS = remise(sanctuaryUpgradeCost(p.sanctuaryLevel)); const okS = debloque('sanctuaire');
  ajouter({ id: 'sanctuaire', emoji: '🏛️', nom: 'Sanctuaire', niveau: `${p.sanctuaryLevel}/${SANCTUARY_MAX_LEVEL}`,
    gain: okS ? `+${nb(SANCTUARY_BONUS_PER_LEVEL * 100, 1)} % production / nv` : progres('sanctuaire'),
    prix: prixS, etat: etat(!okS, maxS, prixS, p.coins), onPress: p.onBuySanctuary, cout: (j) => sanctuaryUpgradeCost(p.sanctuaryLevel + j), estMax: (j) => sanctuaryMaxed(p.sanctuaryLevel + j), delta: { sanctuaryLevel: 1 }, allume: p.sanctuaryLevel > 0,
    detail: okS ? 'Augmente TOUTE ta production (tap + passif).' : exigence('sanctuaire') });
  const maxV = veilleurMaxed(p.veilleurLevel); const prixV = remise(veilleurUpgradeCost(p.veilleurLevel)); const okV = debloque('veilleur');
  ajouter({ id: 'veilleur', emoji: '🌙', nom: 'Veilleur', niveau: `${p.veilleurLevel}/${VEILLEUR_MAX_LEVEL}`,
    gain: okV ? `+${nb(VEILLEUR_BONUS_PER_LEVEL * 100, 1)} % hors-ligne / nv` : progres('veilleur'),
    prix: prixV, etat: etat(!okV, maxV, prixV, p.coins), onPress: p.onBuyVeilleur, cout: (j) => veilleurUpgradeCost(p.veilleurLevel + j), estMax: (j) => veilleurMaxed(p.veilleurLevel + j), allume: p.veilleurLevel > 0,
    detail: okV ? 'Augmente tes gains quand tu ne joues pas.' : exigence('veilleur') });

  // ── AUTO-CLICS : UNE seule file, dans l'ORDRE DES PRIX RÉELS de
  // l'Ascension en cours (1er achat), révélée 2 par 2 : les possédés, le
  // suivant (achetable), puis un « ??? ». Retour de l'auteur (27/09) :
  // révélés par palier en parallèle, le 1er de chaque palier était visible dès
  // le départ (Dragon Miniature acheté avant tout le reste). Le jeu n'impose
  // aucun ordre (aucune règle de déblocage) : c'est cette révélation qui le
  // donne. Positions de l'arbre : inchangées (racine du palier).
  const file = [...AUTOCLICKERS].sort((x, y) => autoClickerCost(x, 0, p.ascensionCount) - autoClickerCost(y, 0, p.ascensionCount));
  let dernier = -1;
  file.forEach((c, i) => { if (((p.autoClickers && p.autoClickers[c.id]) || 0) > 0) dernier = i; });
  file.forEach((c, ordre) => {
    if (ordre > dernier + 2) return;
    const possede = (p.autoClickers && p.autoClickers[c.id]) || 0;
    const mystere = ordre === dernier + 2 && possede === 0;
    const precedent = ordre > 0 ? file[ordre - 1] : null;
    const prix = remise(autoClickerCost(c, possede, p.ascensionCount));
    ajouter({ id: c.id, ordre,
      emoji: c.emoji, nom: c.name, niveau: possede > 0 ? `×${possede}` : '', prix, etat: etat(mystere, false, prix, p.coins),
      gain: mystere ? `🔒 achète ${precedent.name}` : `+${nb(c.baseIncome, 1)} /s chacun`,
      onPress: (q) => p.onBuyAutoClicker(c.id, q), cout: (j) => autoClickerCost(c, possede + j, p.ascensionCount), delta: { autoClickers: c.id }, allume: possede > 0,
      detail: mystere ? `🔒 Achète d'abord ${precedent.name}.` : `Possédé : ${possede} · +${nb(c.baseIncome, 1)}/s chacun.` });
  });

  // ── RELIQUES : DANS l'arbre, rangées par famille d'effet ; verrouillées
  // (« ??? » + la créature nécessaire) tant qu'on n'a pas la créature.
  // Parent : Faveur (chance de critique), Dégâts critiques (force), Veilleur
  // (production, en éventail) ; les autres familles forment leur branche.
  const possedees = new Set((p.owned || []).map((o) => o.id));
  const familles = reliquesParFamille();
  FAMILLES_RELIQUES.forEach((f) => {
    (familles[f] || []).forEach((item, i) => {
      const creature = CREATURES.find((c) => c.id === item.creatureId);
      const nomCreature = creature ? creature.stages[0].name : '???';
      const ok = possedees.has(item.creatureId);
      const niveau = (p.upgradeLevels && p.upgradeLevels[item.id]) || 0;
      const prix = remise(upgradeItemCost(item, niveau));
      ajouter({ id: 'relique:' + item.id, taille: 70,
        emoji: item.emoji, nom: item.name, niveau: `nv ${niveau}`, prix, etat: etat(!ok, false, prix, p.coins),
        // Court (« Nécessite Zephyrion » était coupé sur les pages du grimoire) ;
        // la phrase complète reste dans la fiche.
        gain: ok ? `${describeUpgradeEffect(item)} / nv` : `🔒 ${nomCreature}`,
        onPress: (q) => p.onBuyUpgradeItem(item.id, q), cout: (j) => upgradeItemCost(item, niveau + j), delta: { upgradeLevels: item.id }, allume: niveau > 0,
        detail: ok ? `Relique de ${nomCreature} : ${describeUpgradeEffect(item)} par niveau.` : `🔒 Obtiens ${nomCreature} pour débloquer cette relique.` });
    });
  });
  return N;
}

export { construireNoeuds };

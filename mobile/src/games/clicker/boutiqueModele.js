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
  achatsGriffesPiecesRestants, GRIFFES_PIECES_MAX_PAR_ASCENSION,
  ascensionThreshold, seuilAscension, OFFRANDE_APPCOINS_COST, SANCTUARY_MAX_LEVEL, VEILLEUR_MAX_LEVEL,
  coreUpgradeRequirement, critChance, critMultiplier, offrandeReward, SANCTUARY_BONUS_PER_LEVEL, VEILLEUR_BONUS_PER_LEVEL,
  TAP_UPGRADE_UNLOCK_LEVEL, TAP_UPGRADE_FIRST_PACTE_LEVEL, CORE_UNLOCKS,
  LEGENDAIRES, plafondLegendaire, prixLegendaire, chanceLegendaire, multiplicateurLegendaire,
  SANCTUAIRE_V2_PAR_NIVEAU, VEILLEUR_V2_PAR_NIVEAU,
  COIN_SCALE,
} from './clickerLogic.js';
import { oeufDuDefiAscension } from './questLogic.js';

// 💎 30/10 (demande de l'auteur) — UN DIAMANT EN PIÈCES : le taux UNIQUE du jeu, celui de la « Bourse de pièces » (10 💎 = 10 min
// de revenu passif, 500 pièces au moins) → 1 💎 = 1 min de revenu passif (50 pièces au moins). Sert à la Bourse ET au complément
// en Diamants quand les pièces manquent pour un achat du Grimoire (jamais deux taux : l'un serait toujours plus avantageux).
export const PIECES_MIN_PAR_DIAMANT = 50 * COIN_SCALE;
export function piecesParDiamant(passifParSec) { return Math.max(PIECES_MIN_PAR_DIAMANT, Math.round((Number(passifParSec) || 0) * 60)); }
// Les Diamants pour couvrir ce qui MANQUE (arrondi au-dessus : au moins 1 dès qu'il manque une pièce).
export function diamantsPourPieces(manque, passifParSec) { return manque > 0 ? Math.max(1, Math.ceil(manque / piecesParDiamant(passifParSec))) : 0; }
// Ce qu'on peut compléter en Diamants : un élément payé en PIÈCES, trop cher (ni verrouillé, ni au max) ; jamais l'Ascension,
// l'Offrande (payée en Diamants) ni les Griffes contre pièces (la boutique de Diamants les vend déjà à son propre prix).
// 💎 31/10 (demande de l'auteur) — BONUS DU MOMENT de la boutique de Diamants (20 💎 chacun) : Tap ×2 et remise du Grimoire,
// 5 minutes, qui PROLONGENT un bonus en cours (jamais ×4, jamais remise sur remise).
export const REMISE_MOMENT_PART = 0.2;
export const BOOST_MOMENT_MIN = 5;
export function completableEnDiamants(n) {
  return !!n && n.etat === 'cher' && n.devise !== 'diamants' && n.prix != null && !!n.onPress && n.id !== 'ascension' && n.id !== 'griffes' && n.id !== 'offrande';
}
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
  // 31/10 : REMISE DU MOMENT (−20 % · 5 min) sur le prix BRUT de CHAQUE niveau, AVANT la remise d'un seul achat (`remise`) —
  // même ordre que l'écran (coutGroupe) : le prix affiché est le prix payé, à la pièce près, en ×1, ×10 et MAX.
  const brut = p.remiseMoment || ((c) => c);
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
  const seuil = seuilAscension(p.ascensionCount); // PORTE de l'Ascension (joueur lent), pas l'échelle des prix
  ajouter({
    id: 'ascension', taille: 150, emoji: '🌟', nom: 'Ascension',
    niveau: p.ascensionCount > 0 ? `×${ascensionSpeedMultiplier(p.ascensionCount).toFixed(2)}` : '',
    gain: `prochaine ×${nb(ascensionSpeedMultiplier(p.ascensionCount + 1))}`,
    etat: p.ascensionReady ? 'achetable' : 'cher', prix: null, onPress: p.ascensionReady ? p.onAscend : null,
    progres: seuil > 0 ? Math.min(1, (p.totalEarned || 0) / seuil) : 0, allume: true,
    detail: p.ascensionReady
      ? 'Remet ton économie à zéro — tu gardes tes créatures et l\'Aventure.'
      : !p.defiAscensionEnCours
        // Demande de l'auteur : un seuil atteint AVANT le défi ne doit pas avoir l'air d'une Ascension « validée ».
        ? ((p.totalEarned || 0) >= seuil
          ? `Seuil atteint ✓ — l'Ascension s'ouvre avec son défi (œuf ${oeufDuDefiAscension(p.ascensionCount)}).`
          : `Débloquée par le défi « Fais ta ${p.ascensionCount + 1}${p.ascensionCount === 0 ? 're' : 'e'} Ascension » (œuf ${oeufDuDefiAscension(p.ascensionCount)}).`)
        : `Gagne encore ${f(Math.max(0, seuil - (p.totalEarned || 0)))} pièces au total pour débloquer.`,
  });
  const prixGriffes = griffesCoinCost(p.griffesCoinBuys, p.ascensionCount);
  const resteGriffes = achatsGriffesPiecesRestants(p.griffesCoinBuys); // 4 par Ascension (06/10)
  ajouter({ id: 'griffes', taille: 88, emoji: '🐾', nom: `${p.packGriffes != null ? p.packGriffes : taillePackGriffes([])} Griffes`, // 16/10 : 2 niveaux de la créature moyenne
    niveau: `${GRIFFES_PIECES_MAX_PAR_ASCENSION - resteGriffes}/${GRIFFES_PIECES_MAX_PAR_ASCENSION}`,
    gain: 'pour l\'Aventure', prix: prixGriffes, etat: etat(false, resteGriffes === 0, prixGriffes, p.coins), onPress: resteGriffes > 0 ? p.onBuyGriffesWithCoins : null, allume: true,
    detail: resteGriffes > 0
      ? `Des Griffes pour faire progresser tes créatures en Aventure. ${GRIFFES_PIECES_MAX_PAR_ASCENSION} packs en pièces par Ascension (encore ${resteGriffes}) ; le suivant coûtera plus cher. Les Diamants n'ont pas de limite.`
      : `Limite atteinte : ${GRIFFES_PIECES_MAX_PAR_ASCENSION} packs en pièces par Ascension. Reviens après ta prochaine Ascension, ou passe par les Diamants (sans limite).` });
  ajouter({ id: 'offrande', taille: 88, emoji: '💎', nom: 'Offrande', devise: 'diamants',
    gain: `≈ +${f(offrandeReward(p.tapPower))} pièces`, prix: OFFRANDE_APPCOINS_COST, etat: etat(false, false, OFFRANDE_APPCOINS_COST, p.sharedCoins),
    onPress: p.onOffrande, allume: true, detail: `Échange ${OFFRANDE_APPCOINS_COST} diamant${OFFRANDE_APPCOINS_COST > 1 ? 's' : ''} contre un bonus de pièces.` });

  // ── PUISSANCE DE TAP : Pacte → les 10 améliorations en UNE chaîne (chacune
  // s'ouvre au niveau 5 de la précédente : la branche montre la dépendance).
  const prixPacte = remise(brut(tapPowerCost(p.tapPower)));
  ajouter({ id: 'pacte', emoji: '🔗', nom: 'Pacte', niveau: `${p.tapPower}`,
    gain: `+${nb(TAP_DAMAGE_PER_LEVEL, 1)} / tap / nv`, prix: prixPacte, etat: etat(false, false, prixPacte, p.coins), onPress: p.onBuyTapPower, cout: (j) => brut(tapPowerCost(p.tapPower + j)), delta: { tapPower: 1 }, allume: p.tapPower > 1,
    detail: `+${nb(TAP_DAMAGE_PER_LEVEL, 1)} pièce par tap à chaque niveau.` });
  let prochainVerrou = false;
  TAP_UPGRADES.forEach((item, i) => {
    const niveau = (p.tapUpgrades && p.tapUpgrades[item.id]) || 0;
    const ouvert = tapUpgradeUnlocked(i, p.tapPower, p.tapUpgrades);
    if (!ouvert) { if (prochainVerrou) return; prochainVerrou = true; } // seul le PROCHAIN verrou est montré
    const prix = remise(brut(tapUpgradeCost(item, niveau, p.ascensionCount)));
    const avant = i > 0 ? ((p.tapUpgrades && p.tapUpgrades[TAP_UPGRADES[i - 1].id]) || 0) : 0;
    const condition = i === 0 ? `🔒 Pacte ${Math.min(p.tapPower, TAP_UPGRADE_FIRST_PACTE_LEVEL)}/${TAP_UPGRADE_FIRST_PACTE_LEVEL}` : `🔒 ${TAP_UPGRADES[i - 1].name} ${Math.min(avant, TAP_UPGRADE_UNLOCK_LEVEL)}/${TAP_UPGRADE_UNLOCK_LEVEL}`;
    ajouter({ id: item.id,
      emoji: item.emoji, nom: item.name, niveau: `nv ${niveau}`, prix, etat: etat(!ouvert, false, prix, p.coins),
      // 17/10 : bonus à virgule (Poigne +1,5) — formatNum arrondissait à « +1 » ; sous 1 000, `nb` écrit « 1,5 ».
      gain: ouvert ? `+${(item.bonus < 1000 ? nb(item.bonus, 1) : f(item.bonus))} / tap / nv` : condition,
      onPress: (q) => p.onBuyTapUpgrade(item.id, q), cout: (j) => brut(tapUpgradeCost(item, niveau + j, p.ascensionCount)), delta: { tapUpgrades: item.id }, allume: niveau > 0,
      detail: ouvert ? `+${(item.bonus < 1000 ? nb(item.bonus, 1) : f(item.bonus))} par tap et par niveau${niveau > 0 ? ` · actuellement +${(item.bonus * niveau < 1000 ? nb(item.bonus * niveau, 1) : f(item.bonus * niveau))}` : ''}.` : condition });
  });

  // ── CRITIQUES : Faveur des Esprits (chance) → Dégâts critiques (force)
  // 17/10 — OBJETS LÉGENDAIRES (clickerLogic.LEGENDAIRES) : sous leur original, niveaux permanents, plafond par Ascension,
  // prix selon le rang de l'achat dans l'Ascension. Verrouillés à l'A0 (« s'ouvre à ta 1re Ascension »).
  const ajouterLegendaire = (id) => {
    const d = LEGENDAIRES.find((x) => x.id === id);
    const leg = p.legendaires || {};
    const niveau = leg[id] || 0;
    const rang = (p.legendairesAsc || {})[id] || 0;
    const plafond = plafondLegendaire(p.ascensionCount);
    const prix = remise(brut(prixLegendaire(rang, p.ascensionCount)));
    const manque = d.requiert && !((leg[d.requiert] || 0) > 0) ? LEGENDAIRES.find((x) => x.id === d.requiert) : null;
    const verrou = plafond === 0 || !!manque;
    const max = !verrou && niveau >= plafond;
    const effet = {
      faveurV2: `+${nb((chanceLegendaire(niveau + 1) - chanceLegendaire(niveau)) * 100, 3)} % légendaire / nv`,
      critDamageV2: `+${nb(multiplicateurLegendaire(niveau + 1) - multiplicateurLegendaire(niveau), 0)} force légendaire / nv`,
      sanctuaireV2: `+${nb(SANCTUAIRE_V2_PAR_NIVEAU * 100, 1)} % production / nv`,
      veilleurV2: `+${nb(VEILLEUR_V2_PAR_NIVEAU * 100, 1)} % hors-ligne / nv`,
    }[id];
    const actuel = {
      faveurV2: `${nb(chanceLegendaire(niveau) * 100, 3)} % de chance de critique LÉGENDAIRE (×${multiplicateurLegendaire(leg.critDamageV2)}, en plus du critique normal).`,
      critDamageV2: `Le critique légendaire fait ×${multiplicateurLegendaire(niveau)}.`,
      sanctuaireV2: `+${nb(SANCTUAIRE_V2_PAR_NIVEAU * 100 * niveau, 1)} % sur TOUTE ta production.`,
      veilleurV2: `+${nb(VEILLEUR_V2_PAR_NIVEAU * 100 * niveau, 1)} % sur tes gains hors ligne.`,
    }[id];
    const condition = plafond === 0 ? '🔒 Ascension 1' : manque ? `🔒 ${manque.nom} 1` : null;
    ajouter({ id, emoji: d.emoji, nom: d.nom, niveau: `${niveau}/${plafond}`, prix, etat: etat(verrou, max, prix, p.coins),
      gain: condition || (max ? `max de l'Ascension` : effet),
      onPress: verrou || max ? null : (q) => p.onBuyLegendaire(id, q),
      cout: (j) => brut(prixLegendaire(rang + j, p.ascensionCount)), estMax: (j) => niveau + j >= plafond,
      delta: { legendaires: id }, allume: niveau > 0,
      detail: plafond === 0 ? '🔒 S\'ouvre à ta 1re Ascension. Ses niveaux ne seront jamais remis à zéro.'
        : manque ? `🔒 Achète d'abord 1 niveau de ${manque.nom}.`
        : `${actuel} Permanent : l'Ascension ne le remet jamais à zéro. Jusqu'au niveau ${plafond} à cette Ascension${max ? ' — atteint : +3 niveaux à la prochaine' : ''}.` });
  };

  const prixFaveur = remise(brut(critUpgradeCost(p.critLevel)));
  const okFaveur = debloque('faveur');
  ajouter({ id: 'faveur', emoji: '✨', nom: 'Faveur des Esprits', niveau: `nv ${p.critLevel}`,
    gain: okFaveur ? `+${nb((critChance(p.critLevel + 1) - critChance(p.critLevel)) * 100)} % crit / nv` : progres('faveur'),
    prix: prixFaveur, etat: etat(!okFaveur, false, prixFaveur, p.coins), onPress: p.onBuyCrit, cout: (j) => brut(critUpgradeCost(p.critLevel + j)), delta: { critLevel: 1 }, allume: p.critLevel > 0,
    detail: okFaveur ? `${nb(critChance(p.critLevel) * 100)} % de chance de coup critique.` : exigence('faveur') });
  ajouterLegendaire('faveurV2');
  const prixCrit = remise(brut(critDamageUpgradeCost(p.critDamageLevel)));
  const okCrit = debloque('critDamage');
  ajouter({ id: 'critDamage', emoji: '💥', nom: 'Dégâts critiques', niveau: `nv ${p.critDamageLevel}`,
    gain: okCrit ? `+${nb(critMultiplier(p.critDamageLevel + 1) - critMultiplier(p.critDamageLevel), 1)} force crit / nv` : progres('critDamage'),
    prix: prixCrit, etat: etat(!okCrit, false, prixCrit, p.coins), onPress: p.onBuyCritDamage, cout: (j) => brut(critDamageUpgradeCost(p.critDamageLevel + j)), delta: { critDamageLevel: 1 }, allume: p.critDamageLevel > 0,
    detail: okCrit ? `Coup critique ×${nb(critMultiplier(p.critDamageLevel), 1)}.` : exigence('critDamage') });
  ajouterLegendaire('critDamageV2');

  // ── PASSIF : Sanctuaire → Veilleur
  const maxS = sanctuaryMaxed(p.sanctuaryLevel); const prixS = remise(brut(sanctuaryUpgradeCost(p.sanctuaryLevel))); const okS = debloque('sanctuaire');
  ajouter({ id: 'sanctuaire', emoji: '🏛️', nom: 'Sanctuaire', niveau: `${p.sanctuaryLevel}/${SANCTUARY_MAX_LEVEL}`,
    gain: okS ? `+${nb(SANCTUARY_BONUS_PER_LEVEL * 100, 1)} % production / nv` : progres('sanctuaire'),
    prix: prixS, etat: etat(!okS, maxS, prixS, p.coins), onPress: p.onBuySanctuary, cout: (j) => brut(sanctuaryUpgradeCost(p.sanctuaryLevel + j)), estMax: (j) => sanctuaryMaxed(p.sanctuaryLevel + j), delta: { sanctuaryLevel: 1 }, allume: p.sanctuaryLevel > 0,
    detail: okS ? 'Augmente TOUTE ta production (tap + passif).' : exigence('sanctuaire') });
  ajouterLegendaire('sanctuaireV2');
  const maxV = veilleurMaxed(p.veilleurLevel); const prixV = remise(brut(veilleurUpgradeCost(p.veilleurLevel))); const okV = debloque('veilleur');
  ajouter({ id: 'veilleur', emoji: '🌙', nom: 'Veilleur', niveau: `${p.veilleurLevel}/${VEILLEUR_MAX_LEVEL}`,
    gain: okV ? `+${nb(VEILLEUR_BONUS_PER_LEVEL * 100, 1)} % hors-ligne / nv` : progres('veilleur'),
    prix: prixV, etat: etat(!okV, maxV, prixV, p.coins), onPress: p.onBuyVeilleur, cout: (j) => brut(veilleurUpgradeCost(p.veilleurLevel + j)), estMax: (j) => veilleurMaxed(p.veilleurLevel + j), allume: p.veilleurLevel > 0,
    detail: okV ? 'Augmente tes gains quand tu ne joues pas.' : exigence('veilleur') });
  ajouterLegendaire('veilleurV2');

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
    const prix = remise(brut(autoClickerCost(c, possede, p.ascensionCount)));
    ajouter({ id: c.id, ordre,
      emoji: c.emoji, nom: c.name, niveau: possede > 0 ? `×${possede}` : '', prix, etat: etat(mystere, false, prix, p.coins),
      gain: mystere ? `🔒 achète ${precedent.name}` : `+${nb(c.baseIncome, 1)} /s chacun`,
      onPress: (q) => p.onBuyAutoClicker(c.id, q), cout: (j) => brut(autoClickerCost(c, possede + j, p.ascensionCount)), delta: { autoClickers: c.id }, allume: possede > 0,
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
      const prix = remise(brut(upgradeItemCost(item, niveau)));
      ajouter({ id: 'relique:' + item.id, taille: 70,
        emoji: item.emoji, nom: item.name, niveau: `nv ${niveau}`, prix, etat: etat(!ok, false, prix, p.coins),
        // Court (« Nécessite Zephyrion » était coupé sur les pages du grimoire) ;
        // la phrase complète reste dans la fiche.
        gain: ok ? `${describeUpgradeEffect(item)} / nv` : `🔒 ${nomCreature}`,
        onPress: (q) => p.onBuyUpgradeItem(item.id, q), cout: (j) => brut(upgradeItemCost(item, niveau + j)), delta: { upgradeLevels: item.id }, allume: niveau > 0,
        detail: ok ? `Relique de ${nomCreature} : ${describeUpgradeEffect(item)} par niveau.` : `🔒 Obtiens ${nomCreature} pour débloquer cette relique.` });
    });
  });
  return N;
}

export { construireNoeuds };

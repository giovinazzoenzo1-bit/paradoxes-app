// CALCULATEUR DE GRIFFES (11/10, demande de l'auteur) — « à n'importe quel moment du jeu, à quel niveau devraient être
// nos créatures ? » : Griffes CUMULÉES étape par étape, SOURCE PAR SOURCE (primes, défis, succès, calendrier, shop), puis
// le niveau atteint en dépensant TOUT, avec les RÈGLES DU JEU (coût d'un niveau, naissance à 80 %, palier de dizaine).
// Sert aussi à placer les offres payantes : on voit où le joueur gratuit manque de Griffes.
//
//   node mobile/tools/calculateur-griffes.js [étape max = 40] [profil = actif|normal]
//
// HYPOTHÈSES (à corriger avec les vraies données de l'auteur) — toutes ICI, rien de caché plus bas :
// ⚠️ Les MONTANTS viennent du jeu (primes, défis, succès, calendrier, packs) : changer le jeu met le calculateur à jour.
const HYP = {
  combatsParEtape: 1.3,            // défaites comprises (rapports de l'auteur : 1,1 à 1,3)
  combatsParJour: 41,              // énergie : 5 + 3 par heure × 12 h de jeu
  etoilesParEtape: 2.2,            // rapports de l'auteur : ~2,1
  troisEtoilesParEtape: 0.45,
  // Succès « Élevage » (dépendent du clicker, pas de l'Aventure) : étape à laquelle chaque palier tombe.
  // Profil « actif » = l'auteur (autoclicker 150 ms, clicker en parallèle) ; « normal » = moitié moins vite.
  succesClicker: {
    a_crit: [3, 20, 60], a_coins: [2, 8, 25], a_summon: [10, 40], a_power: [5, 25],
    a_offering: [10, 30], a_hatchVideo: [10, 45],
  },
  // Shop (pièces) : 4 packs par Ascension, achetés dès que les pièces le permettent (étapes ci-dessous).
  packsPieces: { actif: [6, 12, 18, 24], normal: [12, 24] },
  packsDiamants: 0,                // PAYANT : 0 pour le joueur gratuit
};

const A = require('./audit-quetes.js');
const K = A.load('combatLogic'); const L = A.load('clickerLogic'); const D = A.load('dailyLogic');
const S = require('./simulateur-parcours.js'); const R = S.REGLAGES;

// Courbe d'ennemis PROPOSÉE (11/10, demandes de l'auteur) : montante à chaque étape, +2 niveaux par chapitre, boss +3, et
// JAMAIS de baisse après un boss (« les autres ennemis doivent être au même niveau voire plus »).
function niveauEnnemiPropose(n, parChapitre = 2, boss = 3) {
  let niv = 0;
  for (let k = 1; k <= n; k++) {
    const base = k + parChapitre * Math.floor((k - 1) / 10) + (k % 10 === 0 ? boss : 0);
    niv = Math.max(niv, base);
  }
  return niv;
}
// opts.facteurs : multiplie chaque source (1 = jeu actuel) ; opts.ennemi : courbe d'ennemis (défaut : table du jeu).
function calculer(etapeMax = 40, profil = 'actif', opts = {}) {
  const F = { primes: 1, defis: 1, succes: 1, calendrier: 1, shop: 1, ...(opts.facteurs || {}) };
  const vitesse = profil === 'actif' ? 1 : 2;
  // Œufs : étape où éclot la 2e, la 3e… créature (comme le simulateur : œuf k au seuil k + retard).
  const eclosions = R.niveauxOeufs.slice(1 + R.retardOeufs).map((x) => Math.max(1, x));
  const lignes = [];
  const cumul = { primes: 0, defis: 0, succes: 0, calendrier: 0, shop: 0, ascension: 0 };
  const dejaSucces = new Set(); let griffes = 0; let niveauxAchetes = 0;
  const creatures = [{ niv: 1 }]; // la 1re créature
  let jourPrecedent = 0;
  for (let n = 1; n <= etapeMax; n++) {
    // 1) Prime de 1re victoire (+25 % dès l'étape 30)
    const prime = K.griffesReward(n) * F.primes; cumul.primes += prime; griffes += prime;
    // 2) Jours écoulés → défis quotidiens (3) et hebdo (6/7 par jour) + calendrier
    const jour = Math.floor((n * HYP.combatsParEtape) / HYP.combatsParJour) + 1;
    for (let j = jourPrecedent + 1; j <= jour; j++) {
      // Défis : récompense DU JEU (recompenseQuete) — 3 quotidiens (35 en moyenne), 6 hebdo (201 en moyenne) par semaine.
      const q = (3 * K.recompenseQuete(35, n) + (6 / 7) * K.recompenseQuete(201, n)) * F.defis;
      cumul.defis += q; griffes += q;
      // Calendrier : la table DU JEU (DAILY_CALENDAR), Griffes seulement.
      const c = D.DAILY_CALENDAR[(j - 1) % D.DAILY_CALENDAR.length];
      const cal = (c && c.type === 'griffes' ? c.amount : 0) * F.calendrier;
      cumul.calendrier += cal; griffes += cal;
    }
    jourPrecedent = jour;
    // 3) Succès (paliers 15 / 40 / 100 / 250 / 600 Griffes)
    const stats = {
      advLevelReached: n, starsEarned: n * HYP.etoilesParEtape, threeStarLevel: n * HYP.troisEtoilesParEtape,
      eggHatched: eclosions.filter((e) => e <= n).length, creatureFed: niveauxAchetes,
      runeFused: Math.floor(n / 6), ascension: n > 25 ? 1 : 0,
    };
    for (const def of D.ACHIEVEMENTS) {
      for (let t = 0; t < def.tiers.length; t++) {
        const cle = def.id + ':' + t; if (dejaSucces.has(cle)) continue;
        const clicker = HYP.succesClicker[def.id];
        const atteint = clicker ? (clicker[t] != null && clicker[t] * vitesse <= n) : (stats[def.stat] || 0) >= def.tiers[t];
        if (atteint) { dejaSucces.add(cle); const r = D.ACHIEVEMENT_TIER_REWARDS[t] * F.succes; cumul.succes += r; griffes += r; }
      }
    }
    // 4) Shop (pièces) et récompense d'Ascension
    // 16/10 : le pack en pièces = 2 niveaux de la créature MOYENNE du deck (les 3 meilleures du joueur simulé).
    if ((HYP.packsPieces[profil] || []).includes(n)) { const p = L.taillePackGriffes(creatures.map((c) => c.niv).sort((a, b) => b - a).slice(0, 3)) * F.shop; cumul.shop += p; griffes += p; }
    if (n === 26) { const r = (A.C.ascensionGriffesReward ? A.C.ascensionGriffesReward(1) : 0) || 0; cumul.ascension += r; griffes += r; }
    // 5) Éclosions : naissance à 80 % (règle du jeu)
    eclosions.forEach((e) => { if (e === n && creatures.length < 6) creatures.push({ niv: L.niveauDeNaissance(creatures.map((c) => c.niv), 'commun') }); });
    // 6) Dépense de TOUTES les Griffes : la plus faible du deck d'abord, palier de dizaine (règle du jeu)
    const deck = () => creatures.slice().sort((a, b) => b.niv - a.niv).slice(0, 3);
    for (let garde = 0; garde < 5000; garde++) {
      const d = deck(); const max = L.niveauMaxEquipe(d.map((c) => c.niv));
      const cible = d.filter((c) => c.niv < max).sort((a, b) => a.niv - b.niv)[0];
      if (!cible) break;
      const cout = L.levelUpCost({ rarity: 'commun' }, cible.niv);
      if (cout > griffes) break;
      griffes -= cout; cible.niv++; niveauxAchetes++;
    }
    const d = deck().map((c) => c.niv);
    lignes.push({ n, jour, ...Object.fromEntries(Object.entries(cumul).map(([k, v]) => [k, Math.round(v)])),
      total: Math.round(Object.values(cumul).reduce((a, b) => a + b, 0)), reste: Math.round(griffes), deck: d,
      ennemis: opts.ennemi ? [opts.ennemi(n)] : K.equipeEnnemie(n).map((m) => m.niveau) });
  }
  return lignes;
}

if (require.main === module) {
  const max = Number(process.argv[2] || 40), profil = process.argv[3] || 'actif';
  console.log(`Calculateur de Griffes — profil « ${profil} », étapes 1 à ${max}`);
  console.log('étape | jour | primes | défis | succès | calendrier | shop | TOTAL cumulé | niveaux du deck (tout dépensé) | ennemis');
  for (const x of calculer(max, profil)) {
    if (x.n % 5 && x.n !== 1 && x.n !== 11 && x.n !== 21 && x.n !== 31) continue;
    console.log([x.n, x.jour, x.primes, x.defis, x.succes, x.calendrier, x.shop, x.total, x.deck.join('/'), x.ennemis.join('/')].join(' | '));
  }
}
module.exports = { calculer, HYP, niveauEnnemiPropose };

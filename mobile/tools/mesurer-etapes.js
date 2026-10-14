// FORCE RÉELLE DE CHAQUE ÉTAPE (11/10) — pour le système de difficulté par fenêtres : la puissance affichée ne voit ni les
// sorts ni les effets d'équipe (zone, provocation, soins) ; on mesure donc, une fois pour toutes, chaque composition d'étape en
// vrais combats (6 équipes types, joueur normal 60 ms), placée là où la formule prédit 50 %, et on en tire un facteur :
// f > 1 = l'étape est plus dure que sa puissance ne le dit. Résultat : combatLogic.FACTEUR_ETAPE.
//   node mobile/tools/mesurer-etapes.js 1 30   (par morceaux : < 300 s par commande) → /tmp/facteurs-etapes.json (cumulé)
const fs = require('fs');
const A = require('./audit-quetes.js'); const K = A.load('combatLogic'); const C = A.C;
const PENTE = { '1v1': 9.157, '2v1': 12.888, '2v2': 10.542, '3v2': 14.222, '3v3': 18.379 }; // régressions logistiques du 11/10
const PANEL = [['bouldog', 'voltix', 'ombrillon'], ['pyrosile', 'caraploof', 'ventis'], ['glyphon', 'luxorbe', 'bouldog'],
  ['fournax', 'aquamira', 'zephyrion'], ['terracroc', 'brontobloc', 'malefix'], ['ventis', 'pyrosile', 'luxorbe']];
const g = (id) => C.CREATURES.find((c) => c.id === id);
// 17/10 : deck du modèle jusqu'à l'étape 310 (avant 120 : au-delà, le DERNIER deck servait pour toutes les étapes) — vérifié :
// les 120 premières lignes sont identiques (0 différence), les mesures 1-60 ne bougent pas.
const DECKS = require('./calculateur-griffes.js').calculer(310, 'actif').map((x) => x.deck);
function mesurer(n, combatsParEquipe = 40) {
  const compo = K.equipeEnnemie(n).map((m) => ({ creature: m.creature, evolutionTier: m.evolutionTier }));
  // NBJ (11/10, fin) : forcer le nombre de créatures du joueur (ex. 3 contre 2 au chapitre 2 → FACTEUR_ETAPE_3V2).
  const nbE = compo.length, nbJ = process.env.NBJ ? Number(process.env.NBJ) : Math.max(nbE, n <= 10 ? Math.min(2, 3) : nbE), cle = `${nbJ}v${nbE}`;
  // Niveau du deck = celui du CALCULATEUR DE GRIFFES à cette étape (profil actif) — mesurer à « 10 + 2 × étape » (niveau 90 à
  // l'étape 40) faussait les étapes avancées : les sorts en % des PV ne pèsent pas pareil (MESURÉ : 10 points d'écart).
  const deckCalc = DECKS[Math.max(0, n - 2)] || DECKS[DECKS.length - 1];
  const evo = compo[0].evolutionTier || 0, niv = Math.max(1, Math.round(deckCalc.reduce((t, x) => t + x, 0) / deckCalc.length));
  let v = 0, t = 0;
  for (const ids of PANEL) {
    const membres = ids.slice(0, nbJ).map((id) => ({ creature: g(id), ownedLevel: niv, evolutionTier: evo, equippedRunes: [] }));
    const P = K.puissanceAffichee(membres);
    const L = K.niveauPourDifficulte(n, P, 4, nbJ, { sansFacteur: true }); // là où la formule seule prédit 50 %
    const eq = membres.map((m) => ({ creature: m.creature, stats: K.combatStatsForCreatureTyped(m.creature, niv, evo, []) }));
    const EE = compo.map((m) => ({ creature: m.creature, stats: K.combatStatsForCreatureTyped(m.creature, L, m.evolutionTier, []) }));
    let s = (n * 7919 + ids.join('').length) >>> 0; const alea = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
    for (let i = 0; i < combatsParEquipe; i++) { t++; if (K.simulerCombat(eq, EE, { alea, politique: K.choixJoueur, erreurMs: 60 }).gagne) v++; }
  }
  const w = Math.min(0.97, Math.max(0.03, v / t));
  return +Math.exp((0 - Math.log(w / (1 - w))) / (PENTE[cle] || PENTE['3v3'])).toFixed(3); // logit(50 %) = 0
}
// 17/10 — MESURE AFFINÉE (étapes 61 et plus ; bug « je gagne tout à partir de l'étape 80 ») : la mesure simple ci-dessus place
// les ennemis là où la formule SANS facteur prédit 50 % ; quand l'équipe test y gagne ≥ 97 % ou ≤ 3 %, le facteur est TRONQUÉ
// (0,828 / 1,208 en 3 contre 3 — MESURÉ : étapes 67, 69, 100 ; et 27, 29, 37, 39, 40 dans la table 1-60). Ici : les ennemis sont
// REPLACÉS avec le facteur trouvé et remesurés (au plus 4 fois, jusqu'à |logit| < 0,4), et l'écart d'ARRONDI du niveau (entier)
// est retiré : ln f = moyenne ln(R / R*) − logit(w) / pente, R = puissance du deck / puissance brute des ennemis au niveau joué,
// R* = rapport visé au cran 4 (celui du calculateur, correction comprise). Même panel, même deck du modèle, même joueur (60 ms).
function mesurerAffine(n, combatsParEquipe = 160, iterations = 4) {
  const compo = K.equipeEnnemie(n).map((m) => ({ creature: m.creature, evolutionTier: m.evolutionTier }));
  const nbE = compo.length, nbJ = process.env.NBJ ? Number(process.env.NBJ) : Math.max(nbE, n <= 10 ? 2 : nbE), cle = `${nbJ}v${nbE}`;
  const pente = PENTE[cle] || PENTE['3v3'];
  const ratios = K.RATIOS_DIFFICULTE[cle] || K.RATIOS_DIFFICULTE[`${Math.min(3, nbE)}v${Math.min(3, nbE)}`] || K.RATIOS_DIFFICULTE['3v3'];
  const rVise = ratios[4] * (K.CORRECTION_DIFFICULTE[4] || 1);
  const deckCalc = DECKS[Math.max(0, n - 2)] || DECKS[DECKS.length - 1];
  const evo = compo[0].evolutionTier || 0, niv = Math.max(1, Math.round(deckCalc.reduce((t, x) => t + x, 0) / deckCalc.length));
  const brute = (L) => K.puissanceAffichee(compo.map((m) => ({ ...m, ownedLevel: L, equippedRunes: [] })));
  let f = 1, res = null;
  for (let it = 1; it <= iterations; it++) {
    let v = 0, t = 0, lnR = 0;
    for (const ids of PANEL) {
      const membres = ids.slice(0, nbJ).map((id) => ({ creature: g(id), ownedLevel: niv, evolutionTier: evo, equippedRunes: [] }));
      const P = K.puissanceAffichee(membres), cible = P / rVise;
      // Même recherche que le calculateur (niveauEtAffaiblissement) : estimation logarithmique, puis ±4 niveaux.
      const L0 = Math.max(1, Math.round(1 + Math.log(Math.max(1e-9, cible / Math.max(1, f * brute(1)))) / Math.log(K.CROISSANCE_NIVEAU)));
      let L = L0, e = Infinity;
      for (let x = Math.max(1, L0 - 4); x <= L0 + 4; x++) { const d = Math.abs(Math.log(f * brute(x) / cible)); if (d < e) { e = d; L = x; } }
      lnR += Math.log(P / brute(L));
      const eq = membres.map((m) => ({ creature: m.creature, stats: K.combatStatsForCreatureTyped(m.creature, niv, evo, []) }));
      const EE = compo.map((m) => ({ creature: m.creature, stats: K.combatStatsForCreatureTyped(m.creature, L, m.evolutionTier, []) }));
      let s = (n * 7919 + ids.join('').length + it * 104729) >>> 0; const alea = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
      for (let i = 0; i < combatsParEquipe; i++) { t++; if (K.simulerCombat(eq, EE, { alea, politique: K.choixJoueur, erreurMs: 60 }).gagne) v++; }
    }
    const w = Math.min(0.97, Math.max(0.03, v / t)), z = Math.log(w / (1 - w));
    res = { facteur: +Math.exp(lnR / PANEL.length - Math.log(rVise) - z / pente).toFixed(3), victoires: +(v / t).toFixed(3), iterations: it };
    if (Math.abs(z) < 0.4) break;
    f = res.facteur;
  }
  return res;
}
if (require.main === module) {
  const F = process.env.NBJ ? `/tmp/facteurs-etapes-${process.env.NBJ}j.json` : '/tmp/facteurs-etapes.json';
  const res = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};
  // AFFINE=1 (17/10) : mesure affinée (160 combats par équipe), sinon la mesure simple d'origine.
  for (let n = Number(process.argv[2]); n <= Number(process.argv[3]); n++) res[n] = process.env.AFFINE ? mesurerAffine(n).facteur : mesurer(n);
  fs.writeFileSync(F, JSON.stringify(res));
  console.log('étapes mesurées : ' + Object.keys(res).length + ' · ' + Object.entries(res).filter(([n]) => n >= Number(process.argv[2]) && n <= Number(process.argv[3])).map(([n, f]) => n + ':' + f).join(' '));
}
module.exports = { mesurer, mesurerAffine };

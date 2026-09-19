// Mise en forme des libellés de défis. AUCUNE logique de jeu ici.
//
// ⚠️ Fichier séparé pour que `questDefs.js` (les DONNÉES) puisse écrire
// ses libellés sans importer le moteur — ce qui créerait un cycle.

// ⚠️ Formatage FRANÇAIS, vérifié défi par défi le 19/09.
//
// Trois défauts corrigés, tous visibles par le joueur :
//  - « 1.3 millions » : point décimal anglais au lieu de la virgule ;
//  - « 1.3 millions » : pluriel alors que le nombre est inférieur à 2 ;
//  - « 1,3 million pièces » : il manque le « de ».
//
// Le pluriel d'un grand nombre suit le nombre qui le précède : on écrit
// « 1,3 million » et « 2,6 millions ».
const grandNombre = (v, diviseur, singulier, pluriel) => {
  const q = v / diviseur;
  const texte = q.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  return `${texte} ${q >= 2 ? pluriel : singulier}`;
};

export const fmtQ = (n) => {
  const v = Math.round(n);
  if (v >= 1e15) return grandNombre(v, 1e15, 'million de milliards', 'millions de milliards');
  if (v >= 1e12) return grandNombre(v, 1e12, 'billion', 'billions');
  if (v >= 1e9) return grandNombre(v, 1e9, 'milliard', 'milliards');
  if (v >= 1e6) return grandNombre(v, 1e6, 'million', 'millions');
  return v.toLocaleString('fr-FR');
};

export const qtyQ = (n, noun) => (Math.round(n) >= 1e6 ? `${fmtQ(n)} de ${noun}` : `${fmtQ(n)} ${noun}`);

const NIVEAUX_PAR_CHAPITRE = 10;

export function describeAdventureLevel(niveau) {
  const n = Math.max(1, Math.round(niveau || 1));
  const chapitre = Math.ceil(n / NIVEAUX_PAR_CHAPITRE);
  const dans = ((n - 1) % NIVEAUX_PAR_CHAPITRE) + 1;
  return `chapitre ${chapitre}, niveau ${dans}`;
}

// Arrondi « lisible » : un défi doit annoncer 25 000, pas 24 137.
export function roundQuestTarget(n) {
  if (!Number.isFinite(n) || n <= 0) return 1;
  if (n < 10) return Math.max(1, Math.round(n));
  // ⚠️ Exact jusqu'à 30, pas arrondi au multiple de 5.
  //
  // Les cibles de NIVEAU vivent dans cette plage, et leur coût DOUBLE à
  // chaque niveau : quadrupler le budget n'ajoute que 2 niveaux. Arrondi
  // au multiple de 5, 10 / 11 / 12 devenaient tous « 10 » — le joueur
  // voyait le même défi après chaque Ascension alors que la cible
  // montait réellement.
  if (n < 30) return Math.max(1, Math.round(n));
  if (n < 100) return Math.round(n / 5) * 5;
  const exp = Math.floor(Math.log10(n));
  const step = Math.pow(10, exp - 1);
  return Math.round(n / step) * step;
}

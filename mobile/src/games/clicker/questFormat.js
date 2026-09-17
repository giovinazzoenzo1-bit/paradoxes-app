// Mise en forme des libellés de défis. AUCUNE logique de jeu ici.
//
// ⚠️ Fichier séparé pour que `questDefs.js` (les DONNÉES) puisse écrire
// ses libellés sans importer le moteur — ce qui créerait un cycle.

export const fmtQ = (n) => {
  const v = Math.round(n);
  if (v >= 1e15) return `${+(v / 1e15).toFixed(1)} millions de milliards`;
  if (v >= 1e12) return `${+(v / 1e12).toFixed(1)} billions`;
  if (v >= 1e9) return `${+(v / 1e9).toFixed(1)} milliards`;
  if (v >= 1e6) return `${+(v / 1e6).toFixed(1)} millions`;
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
  if (n < 100) return Math.round(n / 5) * 5;
  const exp = Math.floor(Math.log10(n));
  const step = Math.pow(10, exp - 1);
  return Math.round(n / step) * step;
}

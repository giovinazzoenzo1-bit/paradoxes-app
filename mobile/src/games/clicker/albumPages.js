// ════════════════════════════════════════════════════════════════════
//  PAGES DE L'ALBUM DE CARTES (Collection, 02/10) — fonctions PURES
// ════════════════════════════════════════════════════════════════════
// Une (ou plusieurs) page(s) par élément, 4 cartes par page, créatures
// triées par rareté ; doubles pages = pages prises deux par deux.
// Contrôle auditAlbumComplet : chaque créature UNE fois (les 17 créatures à
// venir aussi : un élément mal écrit la ferait disparaître sans bruit).
import { CREATURES } from './clickerLogic.js';

// Ordre des rubans (maquette de l'auteur) ; noms EXACTS des éléments du jeu.
export const ORDRE_ELEMENTS = ['Feu', 'Eau', 'Terre', 'Air', 'Foudre', 'Lumière', 'Ténèbres', 'Magie'];
export const RANG_RARETE = { commun: 1, peu_commun: 2, rare: 3, epique: 4, legendaire: 5, mythique: 6 };
export const CARTES_PAR_PAGE = 4;

export function construireAlbum(creatures = CREATURES) {
  const pages = [];
  ORDRE_ELEMENTS.forEach((element) => {
    const liste = creatures.filter((c) => c.element === element).sort((a, b) => (RANG_RARETE[a.rarity] || 0) - (RANG_RARETE[b.rarity] || 0));
    for (let i = 0; i < liste.length; i += CARTES_PAR_PAGE) pages.push({ element, ids: liste.slice(i, i + CARTES_PAR_PAGE).map((c) => c.id) });
  });
  const planches = [];
  for (let k = 0; k < pages.length; k += 2) planches.push([pages[k], pages[k + 1] || null]);
  const debut = {}; // 1re double page de chaque élément (rubans)
  planches.forEach((pl, p) => pl.forEach((page) => { if (page && debut[page.element] === undefined) debut[page.element] = p; }));
  return { chapitres: [{ planches }], debut, pages };
}

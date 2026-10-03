// ════════════════════════════════════════════════════════════════════
//  PAGES DE L'ALBUM DE CARTES (Collection, 02/10) — fonctions PURES
// ════════════════════════════════════════════════════════════════════
// Une suite de cartes (éléments dans l'ordre des onglets, rareté croissante),
// 4 cartes par page, 8 par double page — comme la maquette de l'auteur.
// Contrôle auditAlbumComplet : chaque créature UNE fois (les 17 créatures à
// venir aussi : un élément mal écrit la ferait disparaître sans bruit).
import { CREATURES } from './clickerLogic.js';

// Ordre des rubans (maquette de l'auteur) ; noms EXACTS des éléments du jeu.
export const ORDRE_ELEMENTS = ['Feu', 'Eau', 'Terre', 'Air', 'Foudre', 'Lumière', 'Ténèbres', 'Magie'];
export const RANG_RARETE = { commun: 1, peu_commun: 2, rare: 3, epique: 4, legendaire: 5, mythique: 6 };
export const CARTES_PAR_PAGE = 4;

export function construireAlbum(creatures = CREATURES) {
  // UNE seule suite de cartes (maquette de l'auteur : 8 cartes par double page,
  // éléments MÉLANGÉS, pas de titre) : éléments dans l'ordre des onglets,
  // rareté croissante dans chaque élément ; découpée par 4.
  const suite = [];
  ORDRE_ELEMENTS.forEach((element) => {
    creatures.filter((c) => c.element === element)
      .sort((a, b) => (RANG_RARETE[a.rarity] || 0) - (RANG_RARETE[b.rarity] || 0))
      .forEach((c) => suite.push(c));
  });
  const pages = [];
  for (let i = 0; i < suite.length; i += CARTES_PAR_PAGE) pages.push({ ids: suite.slice(i, i + CARTES_PAR_PAGE).map((c) => c.id) });
  const planches = [];
  for (let k = 0; k < pages.length; k += 2) planches.push([pages[k], pages[k + 1] || null]);
  // Onglet d'un élément → double page de sa 1re carte.
  const debut = {};
  suite.forEach((c, i) => { if (debut[c.element] === undefined) debut[c.element] = Math.floor(i / (2 * CARTES_PAR_PAGE)); });
  return { chapitres: [{ planches }], debut, pages };
}

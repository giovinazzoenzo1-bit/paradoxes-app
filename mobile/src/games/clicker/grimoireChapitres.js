// ════════════════════════════════════════════════════════════════════
//  CHAPITRES DU GRIMOIRE (boutique) — source UNIQUE (27/09)
// ════════════════════════════════════════════════════════════════════
// Lue par le livre (screens/games/GrimoireBoutique.js) ET par le contrôle
// auditGrimoireComplet (tools/audit-quetes.js) : TOUT élément achetable doit
// figurer dans un chapitre, une seule fois. Aucune dépendance à l'affichage.
// Les listes sont COMPLÈTES ; le livre ne montre que ce que le modèle révèle
// (le livre se remplit au fil de la partie).
import { TAP_UPGRADES } from './clickerLogic.js';
import { reliquesParFamille, FAMILLES_RELIQUES, autoClicsParPalier, PALIERS_AUTO } from './arbreDisposition.js';

export const CHAPITRES_GRIMOIRE = [
  { cle: 'tap', titre: 'Force du tap', intro: 'Chaque tap rapporte plus de pièces.',
    ids: () => ['pacte', ...TAP_UPGRADES.map((u) => u.id)] },
  { cle: 'critiques', titre: 'Critiques', intro: 'Des coups critiques plus fréquents et plus forts.',
    ids: () => ['faveur', 'critDamage'] },
  { cle: 'auto', titre: 'Auto-clics', intro: 'Des esprits qui récoltent pour toi, même sans taper.',
    ids: () => { const r = autoClicsParPalier(); return PALIERS_AUTO.flatMap((t) => (r[t] || []).map((c) => c.id)); } },
  { cle: 'sanctuaire', titre: 'Sanctuaire', intro: 'Toute ta production, et tes gains hors-ligne.',
    ids: () => ['sanctuaire', 'veilleur'] },
  { cle: 'reliques', titre: 'Reliques', intro: 'Les pouvoirs de tes créatures. Chaque relique s\'ouvre avec sa créature.',
    ids: () => { const r = reliquesParFamille(); return FAMILLES_RELIQUES.flatMap((f) => (r[f] || []).map((i) => 'relique:' + i.id)); } },
];
// Hors du livre, sous lui : le sceau de l'Ascension, Griffes et Offrande.
export const SOUS_LE_LIVRE = ['ascension', 'griffes', 'offrande'];

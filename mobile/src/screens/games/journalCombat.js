// ════════════════════════════════════════════════════════════════════
//  JOURNAL DES COMBATS (08/10) — pour calibrer sur la VRAIE façon de jouer
// ════════════════════════════════════════════════════════════════════
// Demande de l'auteur : « un bouton qui me permet de te donner l'historique et des informations qui te
// permettront de bien calculer comme il faut » (menu dev des Paramètres). À chaque combat : l'équipe,
// le mode (Gardien / Exploration), les verdicts de jauge (→ la vraie précision au tap), les sorts et
// spéciaux utilisés, les coups, la durée, le résultat — et, pour le Gardien, la chance annoncée.
// Branché UNIQUEMENT sur des crochets HORS de la zone des règles du combat (verdict, impact, sort, spécial).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const JOURNAL_COMBATS_KEY = 'dev:journalCombats';
const MAX = 40;
let enCours = null;

export function debutCombat(info) {
  enCours = { debut: Date.now(), ...(info || {}), verdicts: { parfait: 0, bien: 0, rate: 0, absent: 0 }, attaques: 0, ripostes: 0, sorts: {}, speciaux: 0 };
}
export function noterVerdict(v) { if (enCours && enCours.verdicts[v] != null) enCours.verdicts[v] += 1; }
export function noterAttaque(cle) { if (!enCours) return; if (cle === 'riposte') enCours.ripostes += 1; else enCours.attaques += 1; }
export function noterSort(type, cote) { if (!enCours || !type) return; const k = `${type}@${cote || '?'}`; enCours.sorts[k] = (enCours.sorts[k] || 0) + 1; }
export function noterSpecial() { if (enCours) enCours.speciaux += 1; }

export async function finCombat(issue, extra = {}) {
  if (!enCours) return;
  const c = { ...enCours, ...(extra || {}), issue, duree: Math.round((Date.now() - enCours.debut) / 1000) };
  enCours = null;
  try {
    const raw = await AsyncStorage.getItem(JOURNAL_COMBATS_KEY);
    const l = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(JOURNAL_COMBATS_KEY, JSON.stringify([...(Array.isArray(l) ? l : []), c].slice(-MAX)));
  } catch (e) { /* jamais bloquant */ }
}

export async function lireJournalCombats() {
  try { const raw = await AsyncStorage.getItem(JOURNAL_COMBATS_KEY); const l = raw ? JSON.parse(raw) : []; return Array.isArray(l) ? l : []; } catch (e) { return []; }
}

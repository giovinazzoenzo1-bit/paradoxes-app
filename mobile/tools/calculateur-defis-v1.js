// CALCULATEUR DE DÉFIS v1 (17/10) — HORS DU JEU : ne modifie rien, lit les défis réels et propose de nouvelles cibles.
// Principe : chaque œuf doit demander le MÊME temps de jeu (cible par œuf, réglable). Rapport r = temps visé / temps actuel
// de l'œuf (durée mesurée de l'Ascension ÷ nombre d'œufs). Défis de quantité (taps, pièces, revenu, cible dorée, achats) : × r.
// Inchangés : défis d'Aventure (réglés par la difficulté de l'Aventure), records d'adresse (Transe, taps d'affilée), cibles de 1.
process.chdir('/home/claude/paradoxes-app/mobile/tools');
const A = require('/home/claude/paradoxes-app/mobile/tools/audit-quetes.js'); const D = A.load('defisEcrits');
const MIN_PAR_OEUF = Number(process.env.MIN || 48);
const H = [2.9, 3.6, 4.2, 6.3, 6.9, 8.2], OEUFS = [6, 6, 7, 7, 7, 7];
const doc = require('fs').readFileSync('../DEFIS_PARADOX.md', 'utf8').split('\n');
const lignes = []; let asc = -1, oeuf = 0;
for (const l of doc) {
  let m = l.match(/^## Après (\d+) Ascension/); if (m) { asc = Number(m[1]); continue; }
  m = l.match(/^### ŒUF (\d+)\s+→\s+(.+)$/); if (m) { oeuf = Number(m[1]); continue; }
  m = l.match(/^([-+ ]) *(\d+)\. (.+)$/); if (m && asc >= 0) lignes.push({ n: Number(m[2]), type: m[1], asc, oeuf, texte: m[3].trim() });
}
const tous = D.DEFIS_ECRITS.flat();
if (tous.length !== lignes.length) throw new Error(`liste ${lignes.length} ≠ fichier ${tous.length}`);
const joli = (x) => (x >= 1000 ? Number(x.toPrecision(2)) : Math.max(1, Math.round(x)));
const fr = (x) => Number(x).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
const RECORDS = /transe|streak|combo|affil/i;
const res = lignes.map((l, i) => {
  const q = tous[i], r = MIN_PAR_OEUF / (H[l.asc] * 60 / OEUFS[l.asc]);
  const t = q.target;
  let v1 = t, note = '';
  if (l.type === '+') note = 'Aventure : inchangé';
  else if (RECORDS.test(q.metric || '')) note = 'record : inchangé';
  else if (/Ascension|Sanctuaire|Veilleur/.test(l.texte)) note = 'structure / niveau : inchangé';
  else if (!(t > 1)) note = 'inchangé';
  else v1 = joli(t * r);
  return { ...l, actuel: t, v1, note, r };
});
module.exports = { res, MIN_PAR_OEUF, H, OEUFS };
if (require.main === module) {
  const nb = res.filter((x) => x.v1 !== x.actuel).length;
  console.log(`${res.length} défis · ${nb} changent · cible ${MIN_PAR_OEUF} min par œuf · r par Ascension : ` + H.map((h, a) => (MIN_PAR_OEUF / (h * 60 / OEUFS[a])).toFixed(2)).join(' / '));
  for (const n of [1, 5, 9, 41, 160, 300]) { const x = res[n - 1]; console.log(n, x.texte, '·', fr(x.actuel), '→', fr(x.v1), x.note); }
}

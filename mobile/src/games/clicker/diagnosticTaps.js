// ════════════════════════════════════════════════════════════════════
//  DIAGNOSTIC DES TAPS (02/10) — mesures EN DIRECT sur le téléphone
// ════════════════════════════════════════════════════════════════════
// Le bug des taps perdus a eu deux causes déjà corrigées (« +X » qui avalaient
// les taps, 27/09 ; bouton qui attendait la fin de l'appui, 02/10) et l'auteur
// le voit encore. Le banc (navigateur rapide) ne le reproduit pas : on MESURE
// sur le téléphone, comme le 03/09. ClickerScreen remplit, le rapport
// « Signaler un problème » lit (diagnostic.js).
// - touchers : tout toucher qui COMMENCE dans la zone de l'œuf (capteur en
//   phase de capture à la racine : il voit le toucher même si un autre élément
//   le prend, et ne le prend JAMAIS lui-même) ;
// - comptés : appels de handleTap ;
// - figements : images de plus de 100 ms (le fil JS sature).
export const mesuresTaps = {
  touchers: 0, horsZone: 0, comptes: 0, dureeTotale: 0, dureePire: 0,
  images: 0, figements: 0, pireFigement: 0, debut: 0,
};
if (typeof window !== 'undefined') window.__mesuresTaps = mesuresTaps; // banc

export function noterToucher(dansZone) {
  if (!mesuresTaps.debut) mesuresTaps.debut = Date.now();
  if (dansZone) mesuresTaps.touchers += 1; else mesuresTaps.horsZone += 1;
}
export function noterTap(dureeMs) {
  mesuresTaps.comptes += 1; mesuresTaps.dureeTotale += dureeMs;
  if (dureeMs > mesuresTaps.dureePire) mesuresTaps.dureePire = dureeMs;
}
export function noterImage(ecartMs) {
  mesuresTaps.images += 1;
  if (ecartMs > 100) { mesuresTaps.figements += 1; if (ecartMs > mesuresTaps.pireFigement) mesuresTaps.pireFigement = ecartMs; }
}

export function lignesDiagnosticTaps(m = mesuresTaps) {
  const perdus = Math.max(0, m.touchers - m.comptes);
  const pct = m.touchers ? Math.round((100 * perdus) / m.touchers) : 0;
  const duree = m.debut ? Math.round((Date.now() - m.debut) / 1000) : 0;
  return [
    `Diagnostic des taps (depuis ${duree} s) :`,
    `- Touchers sur l'œuf : ${m.touchers} · taps comptés : ${m.comptes} · perdus : ${perdus} (${pct} %)`,
    `- Touchers ailleurs : ${m.horsZone}`,
    `- Traitement d'un tap : moyenne ${m.comptes ? (m.dureeTotale / m.comptes).toFixed(1) : 0} ms · pire ${m.dureePire} ms`,
    `- Figements (> 100 ms) : ${m.figements} sur ${m.images} images · pire ${m.pireFigement} ms`,
  ];
}

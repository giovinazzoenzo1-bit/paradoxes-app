// Test de taps : 20 taps toutes les 150 ms (rythme de l'autoclicker de
// l'auteur) à plusieurs endroits de la zone de l'œuf, et on compte les taps
// RÉELLEMENT pris en compte (un « +X » apparaît pour chacun).
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const b = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
const p = await b.newPage();
// TACTILE (comme un téléphone) : le jeu reçoit alors la position du doigt
// (locationX/Y) — à la souris, il ne la reçoit pas et place le « +X » ailleurs.
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await p.goto('file://' + path.join(ICI, 'out/index.html'));
await new Promise((r) => setTimeout(r, 2500));
await p.evaluate(() => {
  window.__plus = 0;
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const t = (n.textContent || '').trim(); if (/^\+\d/.test(t)) window.__plus++; } })
    .observe(document.body, { childList: true, subtree: true });
});
const H = 844, W = 390, haut = H * 0.429, zone = H * 0.419, cx = W / 2 + 13, cy = haut + zone / 2;
const endroits = [['centre de l\'œuf', cx, cy], ['bas de l\'œuf', cx, cy + 110], ['nid', cx + 90, cy + 140], ['zone, à gauche', 100, haut + 40], ['zone, à droite', 340, haut + 60]];
for (const [nom, x, y] of endroits) {
  await p.evaluate(() => { window.__plus = 0; });
  // Léger écart de quelques pixels entre deux taps, comme un vrai doigt
  // (ou un autoclicker de téléphone) : jamais exactement le même point.
  const ecarts = [[0, 0], [3, 6], [-4, 9], [2, 4], [-2, 7]];
  for (let i = 0; i < 20; i++) { const [dx, dy] = ecarts[i % ecarts.length]; await p.touchscreen.tap(x + dx, y + dy); await new Promise((r) => setTimeout(r, 150)); }
  await new Promise((r) => setTimeout(r, 300));
  console.log(nom.padEnd(18) + ' : ' + (await p.evaluate(() => window.__plus)) + ' / 20 taps comptés');
  await new Promise((r) => setTimeout(r, 900));
}
await b.close();

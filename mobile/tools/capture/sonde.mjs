import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const b = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await p.goto('file://' + path.join(ICI, 'out/index.html'));
await new Promise((r) => setTimeout(r, 2500));
const H = 844, haut = H * 0.429, zone = H * 0.419, cx = 390 / 2 + 13, cy = haut + zone / 2;
for (const [nom, x, y] of [['zone, à gauche', 100, haut + 40], ['centre de l\'œuf', cx, cy], ['nid', cx + 90, cy + 140]]) {
  await p.touchscreen.tap(x, y);
  await new Promise((r) => setTimeout(r, 60));
  const r = await p.evaluate((x, y) => {
    const plus = [...document.querySelectorAll('div,span')].filter((e) => /^\+\d/.test((e.textContent || '').trim()) && e.children.length === 0);
    const d = plus[plus.length - 1]; const rc = d && d.getBoundingClientRect();
    const dessus = document.elementFromPoint(x + 3, y + 6);
    return { plus: rc ? `+X à x ${Math.round(rc.left)}-${Math.round(rc.right)}, y ${Math.round(rc.top)}-${Math.round(rc.bottom)}` : 'aucun +X',
             dessous: dessus ? `${dessus.tagName} « ${(dessus.textContent || '').trim().slice(0, 12)} » pointer-events ${getComputedStyle(dessus).pointerEvents}` : '?' };
  }, x, y);
  console.log(`${nom} (tap à ${Math.round(x)}, ${Math.round(y)}) : ${r.plus} · sous le tap suivant : ${r.dessous}`);
  await new Promise((r) => setTimeout(r, 900));
}
await b.close();

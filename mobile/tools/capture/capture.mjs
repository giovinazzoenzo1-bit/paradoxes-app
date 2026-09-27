import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const [largeur, hauteur] = (process.env.TAILLE || '844x390').split('x').map(Number);
const b = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
for (const scene of process.argv.slice(2)) {
  const p = await b.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.setViewport({ width: largeur, height: hauteur, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(ICI, 'out/index.html') + '?scene=' + scene);
  await new Promise((r) => setTimeout(r, 1500));
  const deborde = await p.evaluate(() => { const els = [...document.querySelectorAll('div')]; return Math.max(...els.map((e) => e.scrollHeight - e.clientHeight)); });
  await p.screenshot({ path: path.join(ICI, 'out', scene + '.png') });
  console.log(scene + ' : capture OK · plus grand débordement vertical ' + deborde + ' px' + (erreurs.length ? ' · ERREURS : ' + erreurs.join(' | ').slice(0, 300) : ''));
}
await b.close();

// SONDE DE L'EXPLORATION (17/10) — plantage « Object is not a function » en touchant EXPLORATION sur le téléphone (APK) :
// aucun contrôle n'ouvrait l'écran d'Exploration. Cette sonde rend la VRAIE appli (scène exploration), touche le bouton
// EXPLORATION du menu, puis ouvre l'aperçu d'une étape, et échoue (code 1) à la moindre erreur de page.
//   node build.mjs scenes/exploration.jsx && node ouvrir-exploration.mjs      (→ « Exploration : OK » attendu)
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
const ICI = path.dirname(fileURLToPath(import.meta.url));
const b = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
const p = await b.newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(e.message));
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
await p.goto('file://' + path.join(ICI, 'out/index.html') + '?scene=progression=3');
await new Promise((r) => setTimeout(r, 1500));
const toucher = async (motif) => {
  const box = await p.evaluate((m) => {
    const re = new RegExp(m, 'i');
    const el = [...document.querySelectorAll('div')].reverse().find((e) => re.test((e.textContent || '').trim()) && e.children.length === 0);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, motif);
  if (!box) return false;
  await p.mouse.click(box.x, box.y);
  await new Promise((r) => setTimeout(r, 1500));
  return true;
};
const vu = [];
vu.push('menu ' + (await toucher('^EXPLORATION$') ? 'touché' : 'INTROUVABLE'));
await p.screenshot({ path: path.join(ICI, 'out', 'exploration-ouverte.png') });
await b.close();
const ok = erreurs.length === 0 && vu.every((v) => !v.includes('INTROUVABLE'));
console.log('Exploration : ' + (ok ? 'OK' : 'ÉCHEC') + ' · ' + vu.join(' · ') + (erreurs.length ? ' · ERREURS : ' + erreurs.join(' | ').slice(0, 400) : ''));
process.exit(ok ? 0 : 1);

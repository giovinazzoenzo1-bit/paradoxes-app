// Banc (03/10) : autoclicker RAPIDE à touchers CHEVAUCHÉS (vrais événements tactiles
// multiples, identifiants de doigts recyclés). Lancer après build de scenes/menu.jsx :
//   node chevauchement.mjs "libellé"   → touchers vus / comptés / perdus.
// Avant le correctif onResponderStart : 40 → 24 comptés (18 perdus, ~ les 38 % du téléphone).
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });
await p.goto('file://' + process.cwd() + '/out/index.html?scene=menu'); await new Promise((r) => setTimeout(r, 2500));
const cdp = await p.target().createCDPSession();
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const avant = await p.evaluate(() => ({ ...window.__mesuresTaps }));
// Autoclicker RAPIDE : un toucher toutes les 45 ms, chacun TENU 70 ms → ils se chevauchent.
const N = 40, PERIODE = 45, TENU = 70, X = 195, Y = 470;
const actifs = new Map(); let prochain = 0; const t0 = Date.now(); let id = 0; const evts = [];
for (let i = 0; i < N; i++) evts.push({ t: i * PERIODE, type: 'debut', id: i + 1 }, { t: i * PERIODE + TENU, type: 'fin', id: i + 1 });
evts.sort((a, c) => a.t - c.t || (a.type === 'fin' ? -1 : 1));
for (const e of evts) {
  const reste = e.t - (Date.now() - t0); if (reste > 0) await attendre(reste);
  if (e.type === 'debut') { actifs.set(e.id, { x: X + (e.id % 3), y: Y, id: e.id % 4 }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...actifs.values()] }); }
  else { actifs.delete(e.id); await cdp.send('Input.dispatchTouchEvent', { type: actifs.size ? 'touchEnd' : 'touchEnd', touchPoints: [...actifs.values()] }); }
}
await attendre(400);
const m = await p.evaluate(() => ({ ...window.__mesuresTaps }));
console.log(`${process.argv[2]} : ${N} touchers chevauchés (1 / ${PERIODE} ms, tenus ${TENU} ms) → touchers vus sur l'œuf ${m.touchers - avant.touchers} · comptés ${m.comptes - avant.comptes} · perdus ${m.touchers - avant.touchers - (m.comptes - avant.comptes)}`);
await b.close();

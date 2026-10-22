import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
// 🧪 FIN DE COMBAT (21/10) : joue un combat du Gardien jusqu'au bout (bouton de test « Gagner le combat ») et crie si React
// plante (erreur #300/#310 = hooks après un retour anticipé — le plantage réel du 21/10 : AUCUN test n'allait jusqu'à la fin
// d'un combat). ⚠️ Le banc tourne en React de PRODUCTION : les messages sont abrégés (« Minified React error #300 »).
// Usage : node finir-combat.mjs  (après build.mjs scenes/combat-niveaux.jsx)
import path from 'path';
import { fileURLToPath } from 'url';
const ICI = path.dirname(fileURLToPath(import.meta.url)), params = process.argv[2] || '?scene=n110&gardien=1&tuto=1';
const b = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
const p = await b.newPage(); const erreurs = []; p.on('pageerror', (e) => erreurs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 120)); });
await p.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
await p.goto('file://' + ICI + '/out/index.html' + params);
await new Promise((r) => setTimeout(r, 3000));
const box = await p.evaluate(() => { const el = [...document.querySelectorAll('div')].reverse().find((e) => /Gagner le combat/.test((e.textContent || '').trim()) && e.children.length === 0); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
if (box) { await p.mouse.click(box.x, box.y); await new Promise((r) => setTimeout(r, 3500)); }
const hooks = erreurs.filter((e) => /fewer hooks|more hooks|error #300|error #310|invariant=300|invariant=310/i.test(e));
console.log(!box ? 'Fin de combat : bouton « Gagner le combat » introuvable' : erreurs.length ? `Fin de combat : ${erreurs.length} ERREUR(S) — ${erreurs.join(' | ').slice(0, 220)}` : 'Fin de combat : OK (aucune erreur)');
if (!box || erreurs.length) process.exitCode = 1;
await b.close();

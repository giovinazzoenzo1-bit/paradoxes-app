#!/usr/bin/env python3
"""Régénère src/games/clicker/cadrageCreatures.js (zone dessinée de chaque image
de créature, mesurée sur l'alpha) — à relancer après tout ajout d'illustration
(integrer-creature.py le fait). Contrôle : auditCadrageCreatures."""
import os, re
import numpy as np
from PIL import Image
RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
s = open(os.path.join(RACINE, 'mobile/src/components/CreatureArt.js'), encoding='utf8').read()
cad = {}
for chemin, cid, st in re.findall(r"require\('([^']+/creatures/([a-z0-9_]+)/stage-(\d)\.png)'\)", s):
    a = np.asarray(Image.open(os.path.normpath(os.path.join(RACINE, 'mobile/src/components', chemin))).convert('RGBA'))
    ys, xs = np.nonzero(a[..., 3] > 30); H, W = a.shape[:2]
    cad.setdefault(cid, {})[int(st)] = [float(round(xs.min() / W, 3)), float(round(ys.min() / H, 3)), float(round((xs.max() + 1) / W, 3)), float(round((ys.max() + 1) / H, 3))]
f = lambda v: '[' + ', '.join(f'{x:g}' for x in v) + ']'
L = ["// ════════════════════════════════════════════════════════════════════",
     "//  CADRAGE DES CRÉATURES (GÉNÉRÉ par tools/generer-cadrage.py — ne pas modifier à la main)",
     "// ════════════════════════════════════════════════════════════════════",
     "// Zone réellement dessinée de chaque image (fractions x0, y0, x1, y1), mesurée",
     "// sur l'alpha. Les images 512 × 512 ont de grandes marges : l'Album et le hub",
     "// de l'Exploration zooment dessus. Créature absente (à venir) : zoom par défaut.",
     "export const CADRAGE_CREATURES = {"]
for cid in sorted(cad): L.append(f"  {cid}: {{ {', '.join(f'{k}: {f(v)}' for k, v in sorted(cad[cid].items()))} }},")
L += ["};", "export const CADRAGE_DEFAUT = [0.2, 0.12, 0.8, 0.9];", ""]
open(os.path.join(RACINE, 'mobile/src/games/clicker/cadrageCreatures.js'), 'w', encoding='utf8').write('\n'.join(L))
print(f'cadrage régénéré : {len(cad)} créatures, {sum(len(v) for v in cad.values())} images')

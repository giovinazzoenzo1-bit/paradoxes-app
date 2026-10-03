#!/usr/bin/env python3
"""Intègre les illustrations d'une créature (03/10) — procédé du 19/09 (Voltix,
Aegisolar), MESURÉ sur les 9 créatures en place :
  1. les 3 images de design/a-integrer/creatures/<id>/ sont ORDONNÉES par la
     surface du dessin (une créature qui évolue grandit), pas par leur nom ;
  2. mise au FORMAT du projet : recadrées sur leur contenu, puis remises dans un
     cadre 512 × 512 transparent, CENTRÉES, plus grand côté = 56 / 73 / 84 %
     du cadre (moyennes mesurées des stades 0 / 1 / 2) ;
  3. COMPRESSION palette (libimagequant) acceptée si l'écart VISIBLE ≤ 3,0, le
     cœur opaque intact et rien n'apparaît/disparaît (sinon PNG plein optimisé) ;
  4. branchement dans src/components/CreatureArt.js (entrée CREATURE_ART) ;
  5. régénération de src/games/clicker/cadrageCreatures.js (tools/generer-cadrage.py).
Usage : python3 mobile/tools/integrer-creature.py <id> [<id> …]   (depuis la racine du dépôt)
"""
import os, re, sys, glob, subprocess
import numpy as np
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CIBLES = (0.56, 0.73, 0.84)  # plus grand côté du dessin, stades 0 / 1 / 2
TAILLE = 512

def boite(a):
    ys, xs = np.nonzero(a[..., 3] > 30)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def mettre_au_format(im, cible):
    a = np.asarray(im.convert('RGBA'))
    x0, y0, x1, y1 = boite(a)
    dessin = im.convert('RGBA').crop((x0, y0, x1, y1))
    k = cible * TAILLE / max(dessin.size)
    dessin = dessin.resize((max(1, round(dessin.width * k)), max(1, round(dessin.height * k))), Image.LANCZOS)
    cadre = Image.new('RGBA', (TAILLE, TAILLE), (0, 0, 0, 0))
    cadre.alpha_composite(dessin, ((TAILLE - dessin.width) // 2, (TAILLE - dessin.height) // 2))
    return cadre

def compresser(im, chemin):
    """Palette (libimagequant, moteur de pngquant ; pip install imagequant) acceptée si :
    - écart VISIBLE moyen ≤ 3,0 (couleur × opacité : un bord presque transparent ne
      montre presque rien de sa couleur) ;
    - cœur opaque intact (α = 255 → < 240 : au plus 0,1 % des pixels opaques) ;
    - rien n'apparaît ni ne disparaît (α 0 ↔ ≥ 16 : aucun pixel).
    Sinon : PNG plein optimisé. (Le critère du 19/09 n'avait pas été documenté.)"""
    try:
        import imagequant
    except ImportError:
        im.save(chemin, optimize=True); return 'PNG plein (imagequant absent : pip install imagequant)'
    q = imagequant.quantize_pil_image(im, dithering_level=1.0, max_colors=256)
    a = np.asarray(im).astype(float); b = np.asarray(q.convert('RGBA')).astype(float)
    pa = a[..., :3] * a[..., 3:4] / 255; pb = b[..., :3] * b[..., 3:4] / 255
    vis = (a[..., 3] > 0) | (b[..., 3] > 0)
    ecart = np.abs(pa - pb)[vis].mean()
    opaques = (a[..., 3] == 255).sum()
    coeur = ((a[..., 3] == 255) & (b[..., 3] < 240)).sum()
    sauts = (((a[..., 3] == 0) & (b[..., 3] >= 16)) | ((b[..., 3] == 0) & (a[..., 3] >= 16))).sum()
    if ecart <= 3.0 and coeur <= 0.001 * max(1, opaques) and sauts == 0:
        q.save(chemin, optimize=True)
        return f'palette (écart visible {ecart:.2f}, cœur {int(coeur)}, sauts 0)'
    im.save(chemin, optimize=True)
    return f'PNG plein (écart visible {ecart:.2f}, cœur {int(coeur)}, sauts {int(sauts)})'

def brancher(cid):
    p = os.path.join(RACINE, 'mobile/src/components/CreatureArt.js'); s = open(p, encoding='utf8').read()
    if re.search(rf"^  {cid}: \[", s, re.M): return 'déjà branchée'
    entree = f"  {cid}: [\n" + ''.join(f"    require('../../assets/creatures/{cid}/stage-{k}.png'),\n" for k in range(3)) + "  ],\n"
    repere = "  // Le Gardien : une seule apparence."
    assert s.count(repere) == 1, 'repère du Gardien introuvable dans CreatureArt.js'
    open(p, 'w', encoding='utf8').write(s.replace(repere, entree + repere, 1)); return 'branchée'

def integrer(cid):
    src = sorted(glob.glob(os.path.join(RACINE, f'design/a-integrer/creatures/{cid}/*.png')))
    assert len(src) == 3, f'{cid} : 3 images attendues, {len(src)} trouvées'
    ims = [Image.open(f).convert('RGBA') for f in src]
    surfaces = [(np.asarray(im)[..., 3] > 30).mean() for im in ims]
    ordre = sorted(range(3), key=lambda i: surfaces[i])
    dest = os.path.join(RACINE, f'mobile/assets/creatures/{cid}'); os.makedirs(dest, exist_ok=True)
    print(f'{cid} : ordre par surface → ' + ' < '.join(f"{os.path.basename(src[i])} ({surfaces[i]*100:.1f} %)" for i in ordre))
    for st, i in enumerate(ordre):
        out = os.path.join(dest, f'stage-{st}.png')
        print(f'   stage-{st} : {compresser(mettre_au_format(ims[i], CIBLES[st]), out)} · {os.path.getsize(out)//1024} Ko')
    print('   CreatureArt :', brancher(cid))

if __name__ == '__main__':
    for cid in sys.argv[1:]: integrer(cid)
    subprocess.run([sys.executable, os.path.join(RACINE, 'mobile/tools/generer-cadrage.py')], check=True)

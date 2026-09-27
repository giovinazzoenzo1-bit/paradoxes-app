"""Détourage des images Gemini sur fond magenta (#FF00FF), JPG compris.

    python3 design/outils/detourer.py <dossier> nom1 nom2 ...

Les images du dossier sont prises dans l'ordre de leur nom (= heure
d'enregistrement sur le téléphone) et associées aux noms donnés, dans
l'ordre des prompts. Le nom « fond » garde l'image entière (JPG).
Sortie : <dossier>/detoures/ (PNG transparents, recadrés ; hors Git).

Méthode : « magenta-ité » k = min(R, B) − G (haute pour le fond, basse pour
bois, mousse, pierre, or, bleu) → transparence douce entre k = 70 et 190
(tolère la compression JPG), puis on RETIRE la part de magenta mélangée aux
pixels du bord (sinon liseré rose), et on recadre au contenu (+ 6 px).
"""
import os, sys
import numpy as np
from PIL import Image

def detourer(dossier, noms):
    sortie = os.path.join(dossier, 'detoures'); os.makedirs(sortie, exist_ok=True)
    fichiers = sorted(f for f in os.listdir(dossier) if f.lower().endswith(('.jpg', '.jpeg', '.png')))
    if len(fichiers) != len(noms):
        raise SystemExit(f'{len(fichiers)} images pour {len(noms)} noms : ordre impossible à garantir')
    M = np.array([255., 0., 255.])
    for f, nom in zip(fichiers, noms):
        im = Image.open(os.path.join(dossier, f)).convert('RGB')
        if nom == 'fond':
            im.save(os.path.join(sortie, 'fond.jpg'), quality=86, optimize=True); continue
        a = np.asarray(im).astype(np.float32)
        k = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
        alpha = 1 - np.clip((k - 70) / 120, 0, 1)
        al = np.clip(alpha, 1e-3, 1)[..., None]
        fg = np.where(alpha[..., None] > 0.98, a, np.clip((a - (1 - al) * M) / al, 0, 255))
        img = Image.fromarray(np.dstack([fg, alpha * 255]).astype(np.uint8), 'RGBA')
        bb = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
        if bb:
            m = 6; img = img.crop((max(0, bb[0] - m), max(0, bb[1] - m), min(img.width, bb[2] + m), min(img.height, bb[3] + m)))
        img.save(os.path.join(sortie, nom + '.png'), optimize=True)
    return sortie

if __name__ == '__main__':
    print(detourer(sys.argv[1], sys.argv[2:]))

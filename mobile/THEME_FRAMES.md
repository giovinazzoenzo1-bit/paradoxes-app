# Cadres thémés — règle de dimensionnement

Référence pour tout écran habillé d'un thème d'élément (Feu, Eau, Air…).
**À lire avant de toucher à un cadre ou à un panneau thémé.**

---

## Le principe : CONTENU D'ABORD

On ne fixe **jamais** la taille d'un cadre pour y comprimer du contenu.
C'est l'inverse : le contenu garde sa taille naturelle, et le cadre se
construit autour.

```
bloc de stats = 4 lignes  ->  hauteur naturelle H
cadre         = H / 0,66      (la bordure mange ~17% de la hauteur totale)
```

Exemple concret : une légende de 4 lignes fait 1,2 cm de haut → le cadre
doit mesurer 1,2 / 0,66 ≈ **1,8 cm**, soit 0,3 cm qui dépassent en haut
et 0,3 cm en bas.

---

## Les ratios, mesurés et non estimés

Mesurés sur `assets/themes/feu/panel-frame.png` en cherchant la plus
longue plage transparente au centre :

| | Bordure | Contenu utile |
|---|---|---|
| Largeur | 8,7 % de chaque côté | 82,6 % |
| Hauteur | ~17 % de chaque côté | 66 % |

D'où, dans `AdventureScreen.js` :

```js
const FRAME_OVERHANG_X = 0.105;  // (1/0,826 - 1) / 2
const FRAME_OVERHANG_Y = 0.26;   // (1/0,66  - 1) / 2
```

Le cadre déborde donc de **10,5 % de la largeur** et **26 % de la
hauteur** du contenu, de chaque côté.

⚠️ **Si l'image du cadre change, il faut remesurer.** Le script :

```python
from PIL import Image
import numpy as np
a = np.array(Image.open('panel-frame.png').convert('RGBA'))
al = a[:, :, 3]; h, w = al.shape
def hole(v):                       # plus longue plage transparente
    best = (0, 0, 0); s = None
    for i, x in enumerate(v):
        if x < 40:
            if s is None: s = i
        else:
            if s is not None and i - s > best[2]: best = (s, i - 1, i - s)
            s = None
    if s is not None and len(v) - s > best[2]: best = (s, len(v) - 1, len(v) - s)
    return best[0], best[1]
x0, x1 = hole(al[h // 2]); y0, y1 = hole(al[:, w // 2])
print(f'bordure largeur {100*x0/w:.1f}%  hauteur {100*y0/h:.1f}%')
```

---

## Le composant

`ThemedBlock` (dans `AdventureScreen.js`) applique tout ça :

1. Mesure son contenu via `onLayout`
2. Positionne le cadre en **absolu**, débordant des ratios ci-dessus
3. S'octroie des **marges égales au débordement**, pour que le cadre
   n'empiète pas sur les blocs voisins

```jsx
<ThemedBlock theme={theme} style={styles.monBloc}>
  ...contenu...
</ThemedBlock>
```

---

## Les trois pièges déjà rencontrés

**1. Le cadre DOIT être en position absolue.** S'il compte dans le flux,
sa taille dépend du contenu dont la taille dépend du cadre : boucle
infinie. C'est ce qui obligeait auparavant à traiter la légende à part.

**2. Jamais de marge en POURCENTAGE pour du vertical.** En React Native
comme en CSS, toute marge en pourcentage se résout sur la **largeur** du
parent — `paddingVertical: '15%'` inclus. Un essai a vidé les quatre
panneaux de tout leur contenu.

**3. Jamais d'écart fixe entre deux blocs thémés.** Si le débordement du
cadre dépasse l'écart, les cadres voisins se chevauchent et fusionnent en
un treillis continu. Ce sont les marges proportionnelles du composant qui
doivent assurer l'espacement.

---

## Ajouter un élément

Seul le **fond** change d'un élément à l'autre. Cadre, bouton et
emplacement de rune sont en pierre neutre et **partagés** (constante
`NEUTRAL` dans `elementThemes.js`) : 12 images au total, pas 56.

1. Générer le fond (voir les prompts en fin de conversation : intérieur
   vide, fond magenta uni, un seul objet centré)
2. Le placer dans `assets/themes/<element>/bg.jpg`
3. Ajouter l'entrée dans `THEMES` de `elementThemes.js`

Un élément sans thème retombe automatiquement sur l'apparence unie — rien
ne casse tant que la série est incomplète.

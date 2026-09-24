# Génère le document des défis remis à l'auteur, DEFIS_PARADOX.md.
#   python3 mobile/tools/generer-doc.py          (depuis la racine du dépôt)
# Il lance liste.js (qui lit le jeu) et met en forme. La copie du dépôt,
# mobile/DEFIS_PARADOX.md, est celle que lit `auditDocConforme` ; une copie
# est aussi déposée dans /mnt/user-data/outputs/ si ce dossier existe.
import os, re, subprocess, sys
RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env = dict(os.environ); env.setdefault('NODE_PATH', '/home/claude/auditenv/node_modules'); env['NB_OEUFS'] = '42'
r = subprocess.run(['node', os.path.join(RACINE, 'mobile/tools/liste.js')], capture_output=True, text=True, env=env, cwd=RACINE)
src = r.stdout
# ⚠️ Jamais un document vide en silence : le 24/09, un document de 20
# lignes a été écrit et POUSSÉ avec un contrôle rouge.
if r.returncode != 0 or src.count('GROUPE') < 6:
    sys.stderr.write('liste.js a échoué ou n\'a rien rendu :\n' + r.stderr[-800:] + '\n'); sys.exit(1)
T = 8
out = ['# Défis Paradox — la liste\n', "> 🔴 **Rouge = défis d'ACHAT.**  🟢 **Vert = défis d'AVENTURE.**\n",
       "_Document **vérifié contre le jeu** par `auditDocConforme`._\n",
       "_⚠️ **Les chiffres ci-dessous sont des planchers.** Chaque défi se recalcule au moment où il apparaît, selon ce que tu as déjà : achat → seulement ce qui manque pour le total prévu ; revenu/s → +20 % ; pièces de côté → + 5 min de production ; Aventure → +5 niveaux ; records → repartent de zéro._\n",
       "## ⚠️ Repère Ascension → œufs\n", "| Après | Œufs | Défis |", "|---|---|---|"]
for a in range(6):
    out.append("| %d Ascension%s | %d-%d | %d-%d |" % (a, 's' if a > 1 else '', a*7+1, a*7+7, a*7*T+1, (a+1)*7*T))
out += ["", "_**7 œufs de %d défis** par Ascension. La collection s'arrête à la **26e créature** — pendant la 5e Ascension._\n" % T]
grp = -1; bloc = []
def vider():
    global bloc
    if bloc: out.append('```diff'); out.extend(bloc); out.append('```'); bloc = []
for l in src.split('\n'):
    l = l.rstrip()
    if not l.strip() or set(l.strip()) <= set('═') or l.strip().startswith('──'): continue
    if l.startswith('GROUPE'): vider(); grp += 1; out.append('\n---\n\n## Après %d Ascension%s' % (grp, 's' if grp > 1 else '')); continue
    if l.strip().startswith('ŒUF'): vider(); out.append('\n### ' + l.strip()); continue
    if l.strip().startswith('➜') or l.startswith('TOTAL'): continue
    tag = 'ACHAT' if l.startswith('ACHAT') else ('AVENT' if l.startswith('AVENT') else None)
    t = ' '.join(l.replace('ACHAT', '', 1).replace('AVENT', '', 1).split()); t = re.sub(r'\s+\d+ min$', '', t); t = re.sub(r'\s+\?$', '', t)
    if not re.match(r'^\d+\.', t): continue
    bloc.append(('- ' if tag == 'ACHAT' else '+ ' if tag == 'AVENT' else '  ') + t)
vider()
texte = '\n'.join(out)
open(os.path.join(RACINE, 'mobile/DEFIS_PARADOX.md'), 'w').write(texte)
if os.path.isdir('/mnt/user-data/outputs'): open('/mnt/user-data/outputs/defis-paradox.md', 'w').write(texte)
print('  document généré : mobile/DEFIS_PARADOX.md')

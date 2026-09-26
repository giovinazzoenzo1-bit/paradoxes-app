# ════════════════════════════════════════════════════════════════════
#  AJOUTER DEUX DÉFIS PAR ŒUF (6 -> 8) — généré depuis le TEXTE SOURCE
# ════════════════════════════════════════════════════════════════════
# Demande de l'auteur (21/09) : « 8 défis par œuf, le joueur aura
# l'impression de mériter son œuf ».
#
# Chaque piège de la première tentative a sa parade ici :
#  - achats ajoutés = PETITES étapes (1 niveau, 2 générateurs). Cloner le
#    plus gros palier multipliait le budget par 1900 (coûts exponentiels) ;
#  - jamais de libellé à TEXTE FIGÉ cloné avec une autre cible : il
#    afficherait l'ancien nombre ;
#  - plafonds humains : 400 taps d'affilée, 180 s de Transe ;
#  - aucune métrique au-delà de 7 exemplaires par groupe (un par œuf) ;
#  - familles dans leurs plafonds x 7 œufs ;
#  - l'œuf 1 de l'A0 (tutoriel figé) : un pouvoir puis 2 Esprits,
#    activité AVANT achat, jamais d'Aventure.
import re, sys
P = sys.argv[1] if len(sys.argv) > 1 else 'mobile/src/games/clicker/defisEcrits.js'
L = open(P).read().split('\n')
# ⚠️ GARDE (24/09) : outil à usage unique du 21/09 (6 -> 8 défis par
# œuf), écrit pour 7 œufs par groupe (`range(7)`). Depuis la suppression
# de l'œuf 7 de l'A0 et de l'A1, la structure n'est plus uniforme : le
# relancer décalerait les défis d'un groupe dans l'autre. Il refuse.
_m = re.search(r'OEUFS_PAR_GROUPE = \[([^\]]*)\]', '\n'.join(L))
if not _m or set(x.strip() for x in _m.group(1).split(',')) != {'7'}:
    sys.exit("ajouter-defis.py : structure non uniforme (OEUFS_PAR_GROUPE) — outil à usage unique, ne pas relancer.")
FAMILLE = {'coins':'economie','totalEarned':'economie','passiveIncome':'economie',
  'maxTapStreak':'rythme','maxTranseHoldSec':'rythme','goldenClaimed':'rythme','powerActivated':'rythme',
  'totalCrits':'rythme','totalTaps':'rythme','advLevelReached':'aventure','battleWon':'aventure',
  'threeStarLevel':'aventure','runeBought':'runes','maxCreatureLevel':'creatures','offering':'offrande',
  'ascension':'ascension'}
PLAF = {'economie':2,'rythme':3,'aventure':2,'runes':1,'creatures':1,'offrande':1,'ascension':1,'boutique':4}
LIMITE = {'maxTapStreak':400,'maxTranseHoldSec':180}
def achat(m): return m.startswith(('auto:','tapUpgrade:')) or m in ('tapPower','critLevel','critDamageLevel','sanctuaryLevel','veilleurLevel')
def fam(m): return 'boutique' if achat(m) else FAMILLE.get(m,'autre')
blocs=[]
for i,l in enumerate(L):
    m=re.search(r"\{ id: '(a(\d)e(\d)_[^']+)', icon: '([^']*)', metric: '([^']+)'",l)
    if m:
        blocs.append({'i':i,'id':m.group(1),'g':int(m.group(2)),'e':int(m.group(3))-1,'icon':m.group(4),
          'metric':m.group(5),'target':int(re.search(r'target: (\d+)',L[i+1]).group(1)),
          'ligne2':L[i+1],'label':L[i+2]})
ajouts=[]
for g in range(6):
    dg=[b for b in blocs if b['g']==g]
    compte={}; famc={}
    for b in dg:
        compte[b['metric']]=compte.get(b['metric'],0)+1; famc[fam(b['metric'])]=famc.get(fam(b['metric']),0)+1
    dernier={}
    for b in dg: dernier[b['metric']]=b
    # Achats candidats : sans plafond (delta), et libellé paramétré.
    mA=[m for m in dict.fromkeys(b['metric'] for b in dg)
        if achat(m) and m != 'tapPower' and "mode: 'delta'" in dernier[m]['ligne2'] and 'label: t =>' in dernier[m]['label']]
    # ⚠️ JAMAIS d'étape de Pacte ajoutée : ses paliers sont fixés par
    # l'auteur (« 9 Pactes pour l'A0 : 6 au défi 2, 3 au 24 »). Une étape
    # de plus cassait sa règle — `auditCibleBudget` l'a vu.
    mB=[m for m in dict.fromkeys(b['metric'] for b in dg)
        # ⚠️ Pas de « Obtiens N pièces » cloné : son seul modèle à l'A0 est
        # celui du tutoriel (750), et ses clones valaient 5 secondes de jeu.
        if not achat(m) and m not in ('ascension','totalTaps','maxCreatureLevel','totalEarned')
        and 'label: t =>' in dernier[m]['label'] and 'step' not in dernier[m]['ligne2']]
    ka=kb=0
    haut={}  # plus haute cible déjà donnée à chaque métrique clonée
    for e in range(7):
        if g==0 and e==0:
            # Œuf tutoriel : un pouvoir, puis 2 Esprits.
            # ⚠️ PAS de pouvoir : il faut une créature, et le joueur n'en a
            # aucune dans l'œuf 1. Des coups critiques, possibles dès
            # l'achat de la Faveur (défi 4).
            cr=[b for b in dg if b['metric']=='totalCrits']
            co=[b for b in dg if b['metric']=='coins']
            if cr and co:
                ajouts.append((g,e,'crits0',cr[0],20))
                ajouts.append((g,e,'cote0',co[0],500))
                compte['totalCrits']+=1; compte['coins']+=1
                famc['rythme']+=1; famc['economie']=famc.get('economie',0)+1
            continue
        for _ in range(len(mB)):
            m=mB[kb%len(mB)]; kb+=1
            if compte[m]<7 and famc.get(fam(m),0)<PLAF.get(fam(m),2)*7: break
        else: m=None
        if m:
            src=dernier[m]; t=int(round(max(src['target'],haut.get(m,0))*2))
            # ⚠️ 26/09 : JAMAIS de doublement pour un NIVEAU (advLevelReached) —
            # le doublement a fabriqué 10 défis « chapitre 12 … 36 » (commit e66fd45).
            if m=='advLevelReached': t=int(max(src['target'],haut.get(m,0)))+5
            if m in LIMITE: t=min(t,LIMITE[m])
            haut[m]=t
            ajouts.append((g,e,'plusB',src,max(1,t))); compte[m]+=1; famc[fam(m)]=famc.get(fam(m),0)+1
        for _ in range(len(mB)):
            m=mB[kb%len(mB)]; kb+=1
            if compte[m]<7 and famc.get(fam(m),0)<PLAF.get(fam(m),2)*7: break
        else: m=None
        if m:
            src=dernier[m]; t=int(round(max(src['target'],haut.get(m,0))*2))
            # ⚠️ 26/09 : JAMAIS de doublement pour un NIVEAU (advLevelReached) —
            # le doublement a fabriqué 10 défis « chapitre 12 … 36 » (commit e66fd45).
            if m=='advLevelReached': t=int(max(src['target'],haut.get(m,0)))+5
            if m in LIMITE: t=min(t,LIMITE[m])
            haut[m]=t
            ajouts.append((g,e,'plusC',src,max(1,t))); compte[m]+=1; famc[fam(m)]=famc.get(fam(m),0)+1
sortie=[]; i=0
while i<len(L):
    mm=re.match(r'  // ── Ascension (\d+) · œuf (\d+) ──',L[i])
    if mm:
        g,e=int(mm.group(1)),int(mm.group(2))-1
        sortie.append(L[i]); i+=1
        while i<len(L) and L[i]!='  ],': sortie.append(L[i]); i+=1
        for (gg,ee,suff,src,t) in [a for a in ajouts if a[0]==g and a[1]==e]:
            sortie.append("    { id: 'a%de%d_%s', icon: '%s', metric: '%s',"%(g,e+1,suff,src['icon'],src['metric']))
            sortie.append(re.sub(r'target: \d+','target: %d'%t,src['ligne2']))
            sortie.append(src['label'])
        sortie.append('  ],'); i+=1; continue
    sortie.append(L[i]); i+=1
open(P,'w').write('\n'.join(sortie))
print('  défis ajoutés :',len(ajouts))

// ════════════════════════════════════════════════════════════════════
//  RÉORDONNER UN GROUPE DE DÉFIS — l'outil, rangé dans le projet
// ════════════════════════════════════════════════════════════════════
//
//   node mobile/tools/reordonner-groupe.js <groupe>
//
// Cherche, parmi des milliers d'ordres, celui qui respecte TOUTES les
// règles de l'auteur à la fois : achats à coût croissant, jamais deux
// achats d'affilée, jamais deux fois la même métrique dans un œuf,
// plafonds de famille, Pacte 10 avant les paliers de tap, Ascension en
// dernier. L'œuf 1 de l'Ascension 0 (le tutoriel) n'est jamais touché.
//
// ⚠️⚠️ TROIS LEÇONS PAYÉES LE 21/09 — chacune a cassé le jeu une fois :
//  1. Il édite le TEXTE SOURCE, bloc par bloc. Jamais `String(q.label)`
//     d'un module chargé : c'est du code transformé par Babel, qui aurait
//     fait planter chaque défi de revenu passif.
//  2. Il lit les définitions DU MOTEUR (`estDefiAchat`, `familleDe`,
//     `plafondFamille`, `coutNiveauAchat`) : une copie oubliait le
//     Sanctuaire et le Veilleur, et collait des achats.
//  3. Les défis d'un MÊME TYPE gardent leur ordre — achats ET autres.
//     Mélangés, ils redescendaient (140 puis 120 taps) et les étapes
//     d'un achat s'inversaient (un défi à 75 % du seuil).
//
// Après usage : `verifier-defis.js` ET `verifier-controles.js`.
// Réordonne un groupe en déplaçant les BLOCS DE TEXTE SOURCE, jamais du
// code régénéré à partir d'un module chargé (leçon du 21/09).
const fs=require('fs');
const A=require(require('path').join(__dirname,'audit-quetes.js'));
const Q=A.Q;const D=A.load('defisEcrits');
const F=require('path').join(__dirname,'../src/games/clicker/defisEcrits.js');
const src=fs.readFileSync(F,'utf8');const lignes=src.split('\n');
const GROUPE=Number(process.argv[2]||0);
// Blocs source : 3 lignes par défi, repérés par leur id.
const bloc={};
lignes.forEach((l,i)=>{const m=l.match(/id: '([^']+)'/);if(m)bloc[m[1]]=lignes.slice(i,i+3);});
const NIV=['tapPower','critLevel','critDamageLevel'];
// ⚠️ La définition d'un achat vient DU MOTEUR (`estDefiAchat`), pas d'une
// copie : ma première version oubliait le Sanctuaire et le Veilleur, et
// collait des achats les uns aux autres.
const achat=(m)=>Q.estDefiAchat({metric:m},{});
const adaptable=(m)=>Q.estAchatAdaptable(m);
const g=GROUPE;
const oeufs=D.DEFIS_ECRITS.slice(g*7,g*7+7);
// L'œuf 1 de l'Ascension 0 est FIGÉ : c'est le tutoriel de l'auteur.
const fixe = g===0 ? oeufs[0] : null;
const tous=(fixe?oeufs.slice(1):oeufs).flat();
const pos={};
if(fixe) fixe.forEach(q=>{if(achat(q.metric)){const d=pos[q.metric]??Q.niveauDeBase(q.metric);pos[q.metric]=d+(q.mode==='delta'?q.target:Math.max(0,q.target-d));}});
const cout=(q)=>{if(!achat(q.metric))return 0;const d=pos[q.metric]??Q.niveauDeBase(q.metric);let c=0;
  for(let i=d;i<d+q.target;i++)c+=Q.coutNiveauAchat(q.metric,i,g);return c;};
const prendre=(q)=>{if(!achat(q.metric))return;const d=pos[q.metric]??Q.niveauDeBase(q.metric);pos[q.metric]=d+q.target;};
function construire(alea){
  const posL={...pos0};
  const coutUn=(m,i)=>m==='sanctuaryLevel'?A.C.sanctuaryUpgradeCost(i):m==='veilleurLevel'?A.C.veilleurUpgradeCost(i):Q.coutNiveauAchat(m,i,g);
  const aAcheter=(q,d)=>q.mode==='delta'?q.target:Math.max(0,q.target-d);
  const coutL=(q)=>{if(!achat(q.metric))return 0;const d=posL[q.metric]??Q.niveauDeBase(q.metric);let c=0;
    for(let i=d;i<d+aAcheter(q,d);i++)c+=coutUn(q.metric,i);return c;};
  const prendreL=(q)=>{if(!achat(q.metric))return;const d=posL[q.metric]??Q.niveauDeBase(q.metric);posL[q.metric]=d+aAcheter(q,d);};
  let achats=tous.filter(q=>achat(q.metric));
  const autres=tous.filter(q=>!achat(q.metric));
  const ascL=autres.filter(q=>q.metric==='ascension');
  // ⚠️⚠️ AUCUN MÉLANGE AU HASARD des défis hors achats. La version du
  // 21/09 les mélangeait : « Enchaîne 140 taps » passait après « 120 »,
  // l'Aventure « niveau 10 » avant « niveau 5 », les pièces de côté 150 000
  // avant 25 000. Les défis d'un même type gardent leur ordre ; seuls des
  // types DIFFÉRENTS s'entrelacent.
  let reste=autres.filter(q=>q.metric!=='ascension');
  const ordre=[];
  let prec = fixe ? achat(fixe[fixe.length-1].metric) : false;
  let pacteFait = (posL.tapPower||1) >= 10;
  while(achats.length||reste.length){
    const oeufCourant=Math.floor(ordre.length/6);
    const dansOeuf=new Set(ordre.slice(oeufCourant*6).map(q=>q.metric));
    if(!prec&&achats.length){
      // ⚠️ Les étapes d'un MÊME article gardent leur ordre prévu : c'est
      // lui qui décide quels niveaux chaque défi couvre. Les inverser
      // donnait les niveaux bon marché au petit défi et laissait au grand
      // les plus chers — 75 % du seuil pour un seul défi.
      const premierDeSonArticle=(q)=>achats.find(x=>x.metric===q.metric)===q;
      const ouverts=achats.filter(q=>premierDeSonArticle(q)&&(pacteFait||!q.metric.startsWith('tapUpgrade:'))&&!dansOeuf.has(q.metric));
      const repli=achats.filter(q=>premierDeSonArticle(q));
      const liste=(ouverts.length?ouverts:(repli.length?repli:achats)).map(q=>({q,c:coutL(q)})).sort((a,b)=>a.c-b.c);
      const k=alea&&liste.length>1&&Math.random()<0.35?1:0;
      const b=liste[k].q;
      achats=achats.filter(q=>q!==b);prendreL(b);if((posL.tapPower||1)>=10)pacteFait=true;ordre.push(b);prec=true;
    } else if(reste.length){
      const tetes=reste.filter(q=>reste.find(x=>x.metric===q.metric)===q&&!dansOeuf.has(q.metric));
      const choix=tetes.length?(alea?tetes[Math.floor(Math.random()*tetes.length)]:tetes[0]):reste.find(q=>reste.find(x=>x.metric===q.metric)===q);
      reste=reste.filter(q=>q!==choix);ordre.push(choix);prec=false;
    } else {const q=achats.shift();prendreL(q);ordre.push(q);prec=true;}
  }
  ordre.push(...ascL);
  return ordre;
}
// Jugement IDENTIQUE à auditCoutCroissant : même coût, même tolérance,
// même exemption du tutoriel.
function violations(ordre){
  const seq=(fixe?fixe:[]).concat(ordre);
  const posV={};let prec=null;let v=0;let pire=0;
  seq.forEach((q,idx)=>{
    if(!achat(q.metric)&&!['sanctuaryLevel','veilleurLevel'].includes(q.metric))return;
    const d=posV[q.metric]??Q.niveauDeBase(q.metric);
    const n=q.mode==='delta'?q.target:Math.max(0,q.target-d);
    let c=0;for(let i=d;i<d+n;i++){c+= q.metric==='sanctuaryLevel'?A.C.sanctuaryUpgradeCost(i)
      : q.metric==='veilleurLevel'?A.C.veilleurUpgradeCost(i) : Q.coutNiveauAchat(q.metric,i,g);}
    posV[q.metric]=d+n;
    if(c<=0)return;
    const tuto=g===0&&idx<6;
    if(!tuto&&prec&&c<prec*0.5){v++;pire=Math.max(pire,prec/c);}
    prec=c;
  });
  return v*1000+pire;
}
// Autres contraintes vérifiées sur chaque candidat : 6 par œuf,
// alternance achat / autre, pas deux fois la même métrique dans un œuf.
function valide(ordre){
  const seq=(fixe?fixe:[]).concat(ordre);
  for(let e=0;e<7;e++){const o=seq.slice(e*6,e*6+6);const ms=o.map(q=>q.metric);
    if(new Set(ms).size!==ms.length)return false;
    // ⚠️ Plafonds de famille lus DANS LE MOTEUR, pas recopiés.
    const cpt={};for(const m of ms){const f=Q.familleDe(m);cpt[f]=(cpt[f]||0)+1;if(cpt[f]>Q.plafondFamille(f))return false;}}
  for(let i=1;i<seq.length;i++)if(achat(seq[i].metric)&&achat(seq[i-1].metric))return false;
  return seq[seq.length-1].metric==='ascension';
}
const pos0={...pos};
let meilleur=construire(false), score=valide(meilleur)?violations(meilleur):1e12;
for(let t=0;t<6000;t++){const c=construire(true);if(!valide(c))continue;const sc=violations(c);if(sc<score){score=sc;meilleur=c;}}
console.log('meilleur ordre : '+Math.floor(score/1000)+' écart(s) de coût restant(s)');
const ordre=meilleur;
const nouveaux=(fixe?[fixe]:[]).concat([0,1,2,3,4,5,6].slice(0,fixe?6:7).map(k=>ordre.slice(k*6,k*6+6)));
// Réécriture : on remplace le contenu de chaque œuf du groupe par les
// blocs source, id recalé sur la nouvelle position.
const sortie=[];let i=0;
while(i<lignes.length){
  const m=lignes[i].match(/── Ascension (\d+) · œuf (\d+) ──/);
  if(m&&Number(m[1])===g){
    const e=Number(m[2])-1;
    sortie.push(lignes[i]);sortie.push('  [');
    const vus={};
    nouveaux[e].forEach(q=>{
      const base=q.id.replace(/^a\d+e\d+_/,'').replace(/\d+$/,'');
      vus[base]=(vus[base]||0)+1;
      const nid='a'+g+'e'+(e+1)+'_'+(vus[base]>1?base+vus[base]:base);
      const b=bloc[q.id].slice();b[0]=b[0].replace("id: '"+q.id+"'","id: '"+nid+"'");
      sortie.push(...b);
    });
    // saute l'ancien contenu jusqu'à la fermeture de l'œuf
    i+=2;while(i<lignes.length&&lignes[i]!=='  ],')i++;
    sortie.push('  ],');i++;continue;
  }
  sortie.push(lignes[i]);i++;
}
fs.writeFileSync(F,sortie.join('\n'));
console.log('groupe '+g+' réordonné depuis le texte source');

// ⚠️⚠️ LES DEUX INSTRUMENTS NE MESURENT PAS LA MÊME CHOSE.
//
// Ce fichier additionne l'effort de CHAQUE défi pris séparément, à
// production figée au moment où il commence. C'est utile pour repérer
// un défi trop long ou trop court PAR RAPPORT À SES VOISINS.
//
// Ce n'est PAS la durée d'un groupe : en jeu, les défis avancent
// ENSEMBLE pendant que l'économie grossit. Le simulateur d'économie
// (`mobile/tools/duree.js`) donne la vraie durée — 1,6 à 4,4 h par
// groupe — et c'est lui qui fait foi sur ce point.
//
// Les avoir confondus a fait croire à des groupes de 280 000 heures.
// DEUX MESURES, DEUX USAGES.
// ⚠️ FORMAT .md attendu par l'auteur (19/09) :
//  - chaque défi porte son NUMÉRO en gras, sans tiret de liste ;
//  - la numérotation est CONTINUE sur les 26 œufs, pas remise à zéro par
//    œuf : c'est ainsi qu'il désigne un défi (« le défi 13 »), et deux
//    numérotations différentes nous ont déjà fait parler de deux choses
//    en croyant parler de la même.
'use strict';
// Liste COMPLÈTE des défis, œuf par œuf, sur les 26 créatures.
// Les cibles sont celles que le jeu produira réellement : on simule le
// joueur qui avance, on lit les cibles à l'instant du tirage.
const A = require(require('path').join(__dirname, 'audit-quetes.js'));
const { Q, C, production, minutesPour, etatInitial, appliquer, passiveOnly } = A;

const s = etatInitial();
s.ownedIds = [];
s.ownedCount = 0;
s.deckCount = 0;

let totalMin = 0;
let numero = 0;
let minGroupe = 0;
let gagneGroupe = 0;

for (let oeuf = 0; oeuf < Number(process.env.NB_OEUFS || 26); oeuf++) {
  const groupe = Math.floor(oeuf / 6);
  if (oeuf % 6 === 0) {
    const seuil = C.ascensionThreshold(s.ascension || 0);
    console.log(`\n${'═'.repeat(64)}`);
    console.log(`GROUPE ${groupe + 1} — objectif : Ascension ${(s.ascension || 0) + 1} `
      + `(${seuil.toLocaleString('fr-FR')} pièces)`);
    console.log('═'.repeat(64));
    minGroupe = 0; gagneGroupe = 0;
  }
  // ⚠️ Le joueur simulé SUIT la chaîne de déblocage : dès que le Pacte
  // atteint 5, il achète la Faveur des Esprits puis les Dégâts
  // critiques, ce qui ouvre le Sanctuaire puis le Veilleur. Sans ça la
  // liste montrait ces défis comme absents alors qu'ils sont bien dans
  // le schéma — ils étaient juste remplacés faute de déblocage.
  if ((s.tapPower || 1) >= 5) {
    s.critLevel = Math.max(1, s.critLevel || 0);
    s.critDamageLevel = Math.max(1, s.critDamageLevel || 0);
  }
  const set = Q.nextQuestSet(oeuf, [], s);
  const creature = C.CREATURES[Math.min(oeuf, C.CREATURES.length - 1)];
  const nom = creature ? (creature.stages && creature.stages[0] && creature.stages[0].name) || creature.id : '?';
  console.log(`\n  ŒUF ${oeuf + 1}  →  ${nom}`);
  let minOeuf = 0;
  set.ids.forEach((id) => {
    const q = Q.findQuest(id);
    if (!q) { console.log('    ?? ' + id); return; }
    const cible = Q.effectiveQuestTarget(id, s, set.targets || {});
    const min = minutesPour(q, cible, s);
    const t = min == null ? '   ?' : Math.round(min) + ' min';
    numero += 1;
    // ⚠️ Un défi d'ACHAT se repère à sa MÉTRIQUE, jamais à son texte.
    // Le repérage sur le libellé ratait « Monte le Sanctuaire », « Monte
    // le Veilleur » et tout ce qui ne commence pas par un mot connu.
    const met = Q.metriqueDuDefi(q, s) || '';
    const achat = met.startsWith('auto:') || met.startsWith('tapUpgrade:')
      || ['tapPower', 'critLevel', 'critDamageLevel', 'sanctuaryLevel', 'veilleurLevel'].includes(met);
    // ⚠️ Les défis d'AVENTURE sont marqués aussi : l'auteur les veut en
    // vert dans le document, comme les achats en rouge.
    const aventure = ['advLevelReached', 'battleWon', 'threeStarLevel',
      'powerActivated', 'runeBought', 'runeFused', 'maxCreatureLevel'].includes(met);
    const tag = achat ? 'ACHAT' : (aventure ? 'AVENT' : '     ');
    console.log(`${tag}  ${String(numero).padStart(3)}. ${q.icon}  ${Q.questLabel(id, null, s, set.targets || {}).padEnd(46)} ${String(t).padStart(7)}`);
    if (min != null) {
      const gagne = production(s) * 60 * min;
      s.totalEarned = (s.totalEarned || 0) + gagne;
      gagneGroupe += gagne;
      minOeuf += min;
    }
    appliquer(q, cible, s);
    // La créature de l'œuf arrive à l'éclosion : elle rend l'Aventure et
    // les objets de créature jouables au cycle suivant.
  });
  const nouvelle = C.CREATURES[Math.min(oeuf, C.CREATURES.length - 1)];
  if (nouvelle && !s.ownedIds.includes(nouvelle.id)) s.ownedIds.push(nouvelle.id);
  s.ownedCount = s.ownedIds.length;
  s.deckCount = Math.min(3, s.ownedCount);
  s.passiveIncome = passiveOnly(s);
  minGroupe += minOeuf;
  totalMin += minOeuf;
  console.log(`    ${'─'.repeat(58)} ${Math.round(minOeuf)} min`);
  if (oeuf % 6 === 5) {
    console.log(`\n  ➜ GROUPE ${groupe + 1} : effort cumulé ${Math.round(minGroupe)} min `
      + `(${(minGroupe / 60).toFixed(1)} h) · ${Math.round(gagneGroupe).toLocaleString('fr-FR')} pièces gagnées`);
  }
}
console.log(`\n${'═'.repeat(64)}`);
console.log(`TOTAL 26 ŒUFS : ${Math.round(totalMin)} min (${(totalMin / 60).toFixed(1)} h) · `
  + `${s.ascension} Ascensions`);

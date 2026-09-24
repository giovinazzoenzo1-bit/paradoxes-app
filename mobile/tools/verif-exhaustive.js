'use strict';
// ════════════════════════════════════════════════════════════════════
//  VÉRIFICATION EXHAUSTIVE — chaque défi, à chaque Ascension
// ════════════════════════════════════════════════════════════════════
//
// Demandée par l'auteur après avoir vu « Possède 45 Titans de Foudre ».
// On ne cherche pas un bug précis : on passe TOUT en revue.
//
// Pour chaque défi de la séquence, à chaque groupe de 0 à 5 :
//   1. la métrique se résout-elle sur quelque chose de RÉEL ?
//   2. la cible est-elle un nombre fini, positif, atteignable ?
//   3. le libellé est-il COMPLET — pas de « undefined », pas de trou,
//      pas de « un article », accord au pluriel correct ?
//   4. l'article demandé existe-t-il vraiment dans la boutique ?
//   5. le défi est-il réalisable dans l'état où il est distribué ?
const A = require('/home/claude/paradoxes-app/mobile/tools/audit-quetes.js');
const { Q, C } = A;

const GROUPES = [0, 1, 2, 3, 4, 5];
// ⚠️⚠️ LES VRAIS DÉFIS, PAS LES ANCIENS MODÈLES (24/09).
//
// Cet outil parcourait `QUEST_SEQUENCE` : les 42 modèles d'AVANT la
// bascule vers `defisEcrits.js`. Il annonçait « 252 combinaisons, aucune
// anomalie » sur des défis que le joueur ne reçoit plus — et la passation
// en faisait une condition pour pousser. Prouvé : un libellé cassé dans
// un vrai défi (« Achète undefined niveaux ») le laissait VERT.
//
// Il parcourt désormais les 56 défis écrits de CHAQUE groupe, dans leur
// propre groupe (un défi de l'A3 n'est jamais distribué à l'A0) : 336
// combinaisons. Même sabotage : il crie.
const D = A.load('defisEcrits');
const OEUFS = 7;
const defisDuGroupe = (g) => D.DEFIS_ECRITS.slice(g * OEUFS, g * OEUFS + OEUFS);
const NB_PAR_GROUPE = defisDuGroupe(0).flat().length;
const anomalies = [];
const ajoute = (gravite, groupe, id, quoi, detail) =>
  anomalies.push({ gravite, groupe, id, quoi, detail });

// État d'un joueur AU MOMENT où il aborde le défi : il a fini les
// précédents, donc il possède ce qu'ils demandaient.
function etatPour(groupe) {
  return {
    ascension: groupe,
    tapPower: 12, sanctuaryLevel: 20, veilleurLevel: 15,
    critLevel: 8, critDamageLevel: 10,
    coins: 1e6, totalEarned: 5e6, passiveIncome: 500,
    autoClickers: { esprit: 6, main: 4 }, upgradeLevels: {},
    tapUpgrades: { tap1: 3 }, essence: 0,
    ownedCount: 6, creaturesAVenir: 6, deckCount: 3,
    advLevelReached: 10 + groupe * 15, maxCreatureLevel: 12,
    totalTaps: 3000, totalCrits: 80, goldenClaimed: 12,
    maxTranseHoldSec: 0, maxCombo: 10, powerActivated: 5,
    offering: 2, runeBought: 2, runeFused: 1, threeStarLevel: 2,
    battleWon: 12, ascensionCount: groupe,
  };
}

const NOMS_BOUTIQUE = new Set([
  ...C.AUTOCLICKERS.map((a) => a.name),
  ...C.TAP_UPGRADES.map((t) => t.name),
]);

console.log('\n' + '═'.repeat(76));
console.log('  VÉRIFICATION EXHAUSTIVE — ' + NB_PAR_GROUPE
  + ' défis x ' + GROUPES.length + ' groupes');
console.log('═'.repeat(76));

GROUPES.forEach((groupe) => {
  const s = etatPour(groupe);
  defisDuGroupe(groupe).forEach((cycle, oeuf) => {
    cycle.forEach((q) => {
      const metric = Q.metriqueDuDefi(q, s);

      // 1. La métrique existe-t-elle ?
      if (!metric) {
        ajoute('🟥', groupe, q.id, 'métrique vide', 'le défi ne vise rien');
        return;
      }
      if (metric.startsWith('auto:')) {
        const g = C.AUTOCLICKERS.find((x) => x.id === metric.slice(5));
        if (!g) ajoute('🟥', groupe, q.id, 'générateur inexistant', metric);
      }
      if (metric.startsWith('tapUpgrade:')) {
        const t = C.TAP_UPGRADES.find((x) => x.id === metric.slice(11));
        if (!t) ajoute('🟥', groupe, q.id, 'palier de tap inexistant', metric);
      }

      // 2. La cible.
      let cible;
      try { cible = Q.resolveQuestTarget(q, s); } catch (e) {
        ajoute('🟥', groupe, q.id, 'erreur au calcul de la cible', e.message);
        return;
      }
      if (!Number.isFinite(cible)) ajoute('🟥', groupe, q.id, 'cible non finie', String(cible));
      else if (cible <= 0) ajoute('🟥', groupe, q.id, 'cible nulle ou négative', String(cible));
      else if (cible !== Math.round(cible)) ajoute('🟨', groupe, q.id, 'cible non entière', String(cible));

      // 3. Le libellé.
      let texte;
      try { texte = q.label(cible, metric); } catch (e) {
        ajoute('🟥', groupe, q.id, 'erreur au libellé', e.message);
        return;
      }
      if (!texte || !texte.trim()) ajoute('🟥', groupe, q.id, 'libellé vide', '');
      else {
        if (/undefined|NaN|null|\[object/.test(texte)) ajoute('🟥', groupe, q.id, 'libellé cassé', texte);
        if (/un article/.test(texte)) ajoute('🟥', groupe, q.id, "libellé sans l'article", texte);
        if (/\s{2,}/.test(texte)) ajoute('🟨', groupe, q.id, 'double espace', texte);
        if (/\d\s*\.\d/.test(texte)) ajoute('🟨', groupe, q.id, 'nombre à virgule', texte);
        // Le nombre affiché doit être la cible, pas autre chose.
        //
        // ⚠️ Il faut savoir lire les nombres ABRÉGÉS. Première version :
        // « 1,3 million de pièces » était lu comme « 1 » et « 3 », donc
        // signalé à tort sur 11 défis parfaitement corrects. Un
        // vérificateur qui ne comprend pas le format qu'il vérifie
        // fabrique du bruit — et le bruit fait ignorer les vraies
        // alertes.
        const ECHELLES = [
          [/millions? de milliards/, 1e15], [/billions?/, 1e12],
          [/milliards?/, 1e9], [/millions?/, 1e6],
        ];
        const lisNombre = (t) => {
          const m = t.match(/([\d\u202f\u00a0 ]+(?:,\d+)?)\s*([a-zéè ]*)/);
          if (!m) return [];
          const brut = parseFloat(m[1].replace(/[\u202f\u00a0 ]/g, '').replace(',', '.'));
          const suite = t.slice(m.index);
          const ech = ECHELLES.find(([re]) => re.test(suite));
          return [ech ? brut * ech[1] : brut];
        };
        const nombres = lisNombre(texte).filter((x) => x > 0);
        if (nombres.length && !nombres.some((n) => Math.abs(n - cible) <= Math.max(1, cible * 0.06))
            && !/fois|secondes|niveau/.test(texte)) {
          ajoute('🟨', groupe, q.id, 'le libellé ne dit pas la cible', `${texte} (cible ${cible})`);
        }
        // 4. Si le libellé nomme un article, il doit exister.
        if (metric.startsWith('auto:') || metric.startsWith('tapUpgrade:')) {
          const connu = [...NOMS_BOUTIQUE].some((nom) => {
            const racine = nom.split(' ')[0].replace(/[sxz]$/i, '');
            return texte.includes(racine);
          });
          if (!connu) ajoute('🟥', groupe, q.id, 'article introuvable en boutique', texte);
        }
      }

      // 5. LE COÛT est vérifié AILLEURS, sur la vraie progression.
      //
      // ⚠️ Ce fichier part d'un état FIGÉ, le même à tous les groupes.
      // Calculer un coût là-dessus faisait ressortir « infaisable » des
      // défis que `auditInfaisable` — qui rejoue la séquence et sait ce
      // que le joueur possède — mesure comme normaux. Deux instruments
      // qui ne partagent pas leur état ne peuvent pas être comparés :
      // c'est le piège qui a coûté le plus de temps dans ce projet.
      //
      // Le coût est donc contrôlé par `auditInfaisable`, et ce fichier
      // s'en tient à ce qu'il peut juger sans état : la FORME des défis.

      // 6. Réalisable ?
      try {
        if (typeof q.available === 'function' && !q.available(s)) {
          ajoute('🟨', groupe, q.id, 'non déblocable dans cet état', texte || q.id);
        }
      } catch (e) {
        ajoute('🟥', groupe, q.id, 'erreur dans la condition', e.message);
      }
    });
  });
});

// ---- Rapport --------------------------------------------------------
const parQuoi = {};
anomalies.forEach((a) => {
  const cle = `${a.gravite} ${a.quoi}`;
  (parQuoi[cle] = parQuoi[cle] || []).push(a);
});
if (!anomalies.length) {
  console.log('\n  ✅ AUCUNE ANOMALIE sur les '
    + GROUPES.reduce((n, g) => n + defisDuGroupe(g).flat().length, 0) + ' combinaisons testées.\n');
} else {
  Object.entries(parQuoi).sort().forEach(([cle, liste]) => {
    console.log(`\n  ${cle} — ${liste.length} cas`);
    liste.slice(0, 6).forEach((a) => {
      console.log(`      A${a.groupe}  ${a.id.padEnd(14)} ${String(a.detail).slice(0, 60)}`);
    });
    if (liste.length > 6) console.log(`      … et ${liste.length - 6} autres`);
  });
  console.log('');
}

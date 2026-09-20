// ⚠️ `QUEST_DEFS_VERSION` est déclarée EN FIN DE FICHIER : elle se
// calcule à partir de QUEST_SEQUENCE et QUEST_POOL, qui doivent donc
// être évalués avant. La placer ici lève « Cannot access before
// initialization » au démarrage de l'appli.


// ════════════════════════════════════════════════════════════════
//  LES DÉFIS — ce fichier ne contient QUE leur définition.
// ════════════════════════════════════════════════════════════════
//
// Aucun calcul, aucune progression, aucune validation : tout cela vit
// dans `questLogic.js`. Pour ajouter ou régler un défi, c'est ICI et
// nulle part ailleurs.
//
// Chaque défi déclare :
//   id       identifiant unique
//   metric   CE QU'ON MESURE (doit exister dans `questStats`)
//   target   cible fixe        ─┐ une seule des trois
//   effortMin cible calculée   ─┤ (`validateQuests` le vérifie)
//   step     cible relative    ─┘
//   mode     'absolute' (valeur totale) ou 'delta' (depuis le tirage)
//   label    (t) => texte — JAMAIS de nombre en dur, toujours dérivé
//            de la cible, sinon le texte ment dès qu'un réglage bouge
//
import {
  AUTOCLICKERS,
  SANCTUARY_MAX_LEVEL,
  UPGRADE_ITEMS,
  TAP_UPGRADES,
  VEILLEUR_MAX_LEVEL,
  coreUpgradeUnlocked,
  critChance,
  critUpgradeCost,
  summonCost,
} from './clickerLogic';
import { fmtQ, qtyQ, describeAdventureLevel } from './questFormat';
import { questBudget } from './questBudget';

// ⚠️ La créature d'un objet se DÉDUIT de `UPGRADE_ITEMS`, jamais écrite
// en dur dans un `available`. « Griffe de Braisillon » appartient en
// réalité à `pyrosile` : la condition `ownedIds.includes('braisillon')`
// était toujours FAUSSE, donc le défi n'était jamais tiré et se faisait
// remplacer en silence par un défi du pool. Aucun contrôle ne le voyait.




export const EGG_STAGES = [
  { name: 'Œuf endormi', desc: 'Immobile, terne' },
  { name: 'Œuf frémissant', desc: 'Petits tremblements' },
  { name: 'Œuf fissuré', desc: 'Fissures visibles' },
  { name: 'Œuf lumineux', desc: 'Lueur qui pulse' },
  { name: 'Œuf prêt à éclore', desc: 'Vibre fort, prêt !' },
];


// ---- Système de quêtes + œuf à 4 paliers ----
// Première passe volontairement limitée aux quêtes réalisables DANS le
// clicker (internes + compétence/timing) — les quêtes liées aux autres
// jeux de l'appli (ex: "gagner 5 fois à Puissance 4") demandent une
// couche de stats partagées entre jeux qui n'existe pas encore ; à
// construire séparément avant de les ajouter à ce pool.
// ---- Séquence de démarrage (défis fixes) ----
//
// Les premiers cycles d'œuf ne sont PAS tirés au hasard : ils suivent une
// progression écrite à la main, qui sert de fil conducteur au début de
// partie. Elle enseigne les mécaniques dans l'ordre (tap → Pacte →
// Transe → cible dorée → critiques → Offrande → Aventure → auto-clics →
// pouvoirs → Sanctuaire → Veilleur → Ascension).
//
// Cibles ÉCRITES EN DUR ici, contrairement au pool dynamique : au tout
// début de partie le revenu du joueur est trop faible et trop instable
// pour qu'une cible calculée en « minutes de farm » ait du sens, et on
// veut surtout que tous les joueurs vivent exactement la même montée.
// Une fois la séquence terminée, le jeu bascule automatiquement sur le
// pool dynamique (voir `pickQuestSet`), qui lui s'adapte au revenu.
//
// Le nombre de défis par cycle est VARIABLE (4 ou 5) : l'œuf éclot quand
// tous ceux du cycle en cours sont validés, pas à un compte fixe.
//
// Un niveau d'Aventure est exprimé en niveau GLOBAL : 10 niveaux par
// chapitre (`LEVELS_PER_CHAPTER`), donc chapitre 2 niveau 5 = niveau 15.
// ⚠️ DÉFIS D'AVENTURE : progression de +5 NIVEAUX d'un défi au suivant.
//
// Les derniers sautaient de +10 (20 → 30 → 40), ce qui plaçait le défi
// très au-delà du joueur : il était au chapitre 4 niveau 1 quand le défi
// exigeait le chapitre 4 niveau 10. Tout nouveau défi de ce type reprend
// ce pas de +5.
// ⚠️⚠️ ÉCHELLES PAR GROUPE — comment une cible fixe monte d'un groupe
// d'Ascension au suivant.
//
// Un groupe = une Ascension. L'indice 0 est le premier groupe.
// Ces tables sont MESURÉES sur le simulateur d'économie, pas devinées,
// et elles sont les mêmes pour tous les joueurs.
//
// L'intention : le joueur doit SENTIR qu'il va plus vite après une
// Ascension, alors que les cibles ont objectivement grossi. C'est le cas
// parce que sa production monte plus vite que les cibles — mesuré, la
// durée d'un groupe ne passe que de 1,6 h à 2,8 h entre le 1er et le 4e,
// pendant que les cibles en pièces sont multipliées par 22.
//
// ⚠️ Les gains HORS LIGNE sont pris en compte : 2 h de production à
// taux réduit (`OFFLINE_RATE`), soit environ un œuf d'avance. Les cibles
// en pièces sont calées pour que ça reste un coup de pouce.
// ⚠️⚠️ DÉFIS DONT L'ARTICLE CHANGE À CHAQUE ASCENSION.
//
// Plan de l'auteur : 4 articles de boutique se découvrent par Ascension
// — 2 paliers de tap, 2 générateurs. A1 ouvre Poigne + Gantelet +
// Automate + Colonie, A2 Sceau + Main du Colosse + Titan + Golem, etc.
//
// Le schéma des 6 œufs est le MÊME à chaque groupe : un défi doit donc
// pouvoir viser un article différent selon le numéro d'Ascension. D'où
// `metriqueParGroupe`, résolue au tirage.
//
// ⚠️ Sans ça, aucun défi ne parlait jamais de l'Automate Runique, de la
// Colonie, de la Poigne ni du Gantelet : le joueur ne découvrait pas la
// moitié de sa boutique.
// ⚠️ `rang` 0 vise le 1er générateur découvert au groupe, `rang` 1 le
// PRÉCÉDENT — pas le second du groupe.
//
// Mesuré : deux paliers d'un même groupe sont séparés d'un facteur 3 en
// prix. Les demander tous les deux dans le même budget rendait le
// second infaisable dès A3 (« Possède 6 Phénix » = 5x le seuil). Viser
// le palier d'en dessous garde deux défis d'achat distincts par groupe,
// tous deux réalisables, et le joueur découvre quand même le nouveau
// palier par le premier défi.
export function generateurDuGroupe(rang) {
  return (groupe) => {
    // A0 ouvre les deux premiers générateurs, puis 2 par Ascension.
    // ⚠️ Au groupe 0 le joueur n'a que les deux premiers générateurs :
    // reculer de 2 ou 3 crans renverrait un palier qu'il n'a pas encore
    // les moyens d'acheter. On borne donc au plus haut palier ouvert.
    // ⚠️ `rang` 0 vise le palier le PLUS RÉCENT du groupe, `rang` 1 celui
    // d'en dessous. Reculer davantage rendait les défis dérisoires :
    // mesuré, « Possède 6 Esprits Frappeurs » tombait à 0 minute dès le
    // 2e groupe parce que les bas paliers ne coûtent plus rien.
    // ⚠️⚠️ UN SEUL nouveau palier par Ascension, pas deux.
    //
    // Avec deux, le palier visé à A5 était le Héraut d'Orage (11e) : «
    // possède 3 Hérauts d'Orage » alors que le joueur en est au Golem.
    // L'auteur l'a dit ainsi — « le défi approprié à ce moment-là serait
    // possède 4 Golems de Cristal ». Avec un palier par groupe, A5 tombe
    // exactement sur le Golem.
    //
    // Deux paliers par groupe demandaient x25 de rendement quand le
    // seuil ne monte que de x5 à x8 : la boutique s'éloignait toujours.
    // Un seul palier par groupe la fait suivre, et les 15 générateurs
    // couvrent les 15 Ascensions du barème.
    const plusHaut = groupe;
    const i = Math.max(0, Math.min(AUTOCLICKERS.length - 1, plusHaut - rang));
    const item = AUTOCLICKERS[Math.min(i, AUTOCLICKERS.length - 1)];
    return item ? `auto:${item.id}` : null;
  };
}

export function palierDeTapDuGroupe(rang) {
  return (groupe) => {
    // ⚠️ Au groupe 0, AUCUN palier de tap n'est ouvert : le premier exige
    // Pacte 10, que le joueur n'atteint qu'au 2e groupe. On rabat donc
    // sur le Pacte lui-même, qui est bien l'amélioration de tap du
    // moment.
    //
    // ⚠️ Rendre `null` ne marcherait PAS : la séquence ne substitue
    // jamais, donc le défi resterait dans l'œuf sans article — il
    // s'affichait « Monte un article au niveau 5 » et se validait seul.
    if (groupe < 1) return 'tapPower';
    const i = (groupe - 1) * 2 + rang;
    const item = TAP_UPGRADES[Math.min(i, TAP_UPGRADES.length - 1)];
    return item ? `tapUpgrade:${item.id}` : null;
  };
}

export const ECHELLES_GROUPE = {
  // Pièces, réserves, revenu par seconde : suivent le seuil d'Ascension,
  // qui est lui-même mesuré (500 K · 1,3 M · 3,2 M · 11 M · 41 M · 200 M).
  pieces: [1, 12, 90, 700, 4200, 13333],
  // Niveaux d'amélioration : le coût double par niveau, donc la cible ne
  // peut monter que de quelques crans — au-delà elle devient un mur.
  // ⚠️ Relevée le 19/09 : [1, 1,15, 1,3...] était trop faible. Le coût
  // d'un niveau DOUBLE, mais le revenu du joueur est multiplié par ~10
  // à chaque groupe : il faut donc environ +3,3 niveaux par groupe pour
  // garder le même effort. Mesuré — à l'ancienne échelle, « Monte Pacte
  // au niveau 9 » tombait à 3 minutes au 3e groupe.
  // ⚠️ Les défis concernés portent un `capAbsolu` : le coût d'un niveau
  // DOUBLE, donc au-delà d'une vingtaine de niveaux le prix explose
  // (Pacte 24 = 700 millions de pièces). L'échelle fait monter la cible,
  // le plafond absolu l'empêche de devenir un mur.
  niveau: [1, 1.45, 1.9, 2.4, 2.8, 3.14],
  // Nombre d'unités d'un générateur : les paliers supérieurs prennent le
  // relais, donc la quantité du palier bas ne doit pas exploser.
  // ⚠️ Relevée le 19/09, même raison que `niveau`. Le prix d'un
  // générateur monte de 25 % par exemplaire, et le revenu du joueur est
  // multiplié par ~10 par groupe : il peut donc s'en offrir une dizaine
  // de plus à chaque fois. L'ancienne échelle demandait 7 Esprits au 2e
  // groupe — bouclé en 3 minutes.
  // ⚠️⚠️ PAS D'ÉCHELLE SUR LE NOMBRE D'EXEMPLAIRES.
  //
  // Le prix d'un générateur monte de 25 % à chaque exemplaire : 50
  // unités coûtent 21 000 fois la première. Demander « 50 Golems » au 3e
  // groupe revenait donc à demander 10 000 fois le seuil de l'Ascension
  // — l'auteur a mis 20 minutes à acheter UN Titan quand le défi en
  // réclamait 45.
  //
  // La difficulté d'un groupe vient du PALIER visé, qui change à chaque
  // Ascension, pas de la quantité. Une dizaine d'exemplaires reste la
  // bonne mesure à tous les niveaux.
  // ⚠️ Relevée sur les chiffres de l'auteur : il veut 25 exemplaires au
  // 5e groupe là où la table plate en donnait 10. Mesuré — 25 Mains
  // Spectrales coûtent 9,7 % du seuil à A5, l'effort visé.
  unites: [1, 1.3, 1.6, 1.9, 2.2, 2.5],
  // Actions répétées (critiques, taps, dorées, pouvoirs) : le joueur ne
  // tape pas plus vite après une Ascension. On monte doucement, sinon le
  // défi devient une corvée de durée pure.
  // ⚠️ Relevée : l'auteur veut 14 cibles dorées au 5e groupe contre 8,
  // et 130 secondes de Transe contre 25. Les deux défis partagent cette
  // échelle, qui porte désormais la montée des défis d'ADRESSE.
  actions: [1, 1.7, 2.5, 3.3, 4, 4.67],
  // ⚠️ Échelle propre à la tenue de Transe : l'auteur la veut à 130
  // secondes au 5e groupe, là où les autres défis d'adresse montent
  // moins vite. Tenir une Transe longue est un geste, pas un cumul.
  transe: [1, 1.8, 2.7, 3.6, 4.4, 5.2],
  // Combats et niveaux d'Aventure : bornés par l'ÉNERGIE, pas par
  // l'économie. Une Ascension ne rend pas l'énergie plus rapide, donc
  // ces cibles bougent à peine.
  // ⚠️ MULTIPLIER l'Aventure était une erreur : c'est une CAMPAGNE, pas
  // une économie. Le joueur GARDE ses niveaux après une Ascension, donc
  // multiplier « termine le niveau 5 » par 1,2 donne 6 à un joueur qui
  // en est au 20e — mesuré, 96 % du défi déjà acquis. La campagne doit
  // AVANCER : voir `PAS_AVENTURE_PAR_GROUPE`.
  aventure: [1, 1, 1, 1, 1, 1],
};

// ⚠️ De combien la campagne d'Aventure avance à chaque groupe.
//
// Les trois défis de niveau d'un groupe visent 5, 10 et 15. Au groupe
// suivant ils visent 20, 25 et 30, et ainsi de suite : la campagne
// continue là où elle s'est arrêtée. C'est une ADDITION, pas un facteur,
// parce que les niveaux d'Aventure se cumulent d'une Ascension à
// l'autre — contrairement aux pièces, qui repartent de zéro.
export const PAS_AVENTURE_PAR_GROUPE = 15;

// Au-delà de la table, on prolonge au dernier rapport mesuré.
export function echelleGroupe(nom, groupe) {
  const table = ECHELLES_GROUPE[nom];
  if (!table) return 1;
  const g = Math.max(0, Math.floor(groupe || 0));
  if (g < table.length) return table[g];
  const dernier = table[table.length - 1];
  const avant = table[table.length - 2] || 1;
  return dernier * Math.pow(dernier / avant, g - table.length + 1);
}

// Nom lisible d'un article de boutique à partir de sa métrique.
const nomArticle = (metric, pluriel) => {
  if (!metric) return 'un article';
  // ⚠️ Pluriel appliqué au NOM COMPLET : « 25 Automates Runiques », pas
  // « 25 Automate Runique ». Les noms sont composés de deux mots qui
  // s'accordent tous les deux.
  // ⚠️ On n'accorde QUE les mots avant un complément introduit par
  // « de » / « du ». « Golems de Cristal », pas « Golems de Cristals ».
  const accorde = (nom) => {
    if (!pluriel) return nom;
    const mots = nom.split(' ');
    // ⚠️ Une apostrophe COLLE au mot suivant : « d'Orage » est un seul
    // mot pour `split(' ')`. Sans ce test, « Héraut d'Orage » donnait
    // « Hérauts d'Orages ».
    const complement = (m) => ['de', 'du', 'des'].includes(m.toLowerCase())
      || /^d[’']/.test(m);
    const coupure = mots.findIndex(complement);
    const fin = coupure === -1 ? mots.length : coupure;
    // ⚠️ Les mots déjà terminés par s, x ou z sont invariables :
    // « Phénix », pas « Phénixs ».
    const invariable = (m) => /[sxz]$/i.test(m);
    return mots.map((m, i) => (i < fin && m.length > 2 && !invariable(m) ? `${m}s` : m)).join(' ');
  };
  if (metric.startsWith('auto:')) {
    const a = AUTOCLICKERS.find((x) => x.id === metric.slice(5));
    return a ? accorde(a.name) : metric;
  }
  const t = TAP_UPGRADES.find((x) => x.id === metric.slice(11));
  return t ? t.name : metric;
};

export const QUEST_SEQUENCE = [
  // ══════════════════ ŒUF 1 — DÉMARRER ══════════════════
  // Ni Aventure ni Rune : au tout premier œuf le joueur n'a AUCUNE
  // créature, donc pas de deck, donc pas de combat ni de Griffes. Un
  // défi injouable bloquerait l'œuf pour toujours. Retiré du SCHÉMA
  // plutôt que traité en cas particulier du premier groupe.
  //
  // Mesuré : un joueur arrive au bout de cet œuf avec ~14 000 pièces
  // gagnées, Pacte 8, 3 Esprits Frappeurs, 2 pièces/s de passif.
  [
    // L'ACCROCHE. Le tout premier défi du jeu doit se boucler en 2-3
    // minutes, sinon le joueur décroche avant d'avoir compris le bouton.
    // ⚠️ En PART DU SEUIL, plus en multiplicateur. L'échelle `pieces`
    // donnait 300 000 pièces au 5e groupe, soit 0,08 % d'un seuil à 12,2
    // milliards — un défi qui se validait tout seul. Une part suit le
    // barème des seuils sans aucun facteur à deviner.
    // ⚠️ Cible du 5e groupe fixée par l'auteur : 10 millions de pièces.
    // L'échelle `pieces` est calée pour y arriver depuis 750.
    //
    // ⚠️ Il sait que cela ne fait que 0,08 % du seuil d'Ascension — je le
    // lui ai mesuré. C'est SON arbitrage : un défi d'entrée d'œuf doit
    // rester rapide, la difficulté du groupe étant portée par les
    // quatre autres.
    { id: 'g1_coins', icon: '🪙', metric: 'totalEarned', target: 750, echelle: 'pieces', mode: 'delta',
      label: (t) => `Obtiens ${qtyQ(t, 'pièces')}` },
    // ⚠️ `cap` OBLIGATOIRE sur le Pacte : son coût DOUBLE par niveau,
    // donc un seul cran de trop coûte le double du précédent. Sans
    // plafond, le plancher « plus que l'acquis » le faisait grimper d'œuf
    // en œuf jusqu'au niveau 34 — mesuré, 18 millions de minutes pour un
    // seul défi.
    // ⚠️ 6 -> 7 après le réalignement des prix de boutique. Le joueur
    // gagne désormais plus vite, donc Pacte 6 (2 604 pièces) tombait à
    // 3 minutes. Le niveau 7 en coûte 5 292, soit sept fois le défi de
    // pièces voisin du même œuf — l'ordre de grandeur voulu.
    { id: 'g1_pacte', icon: '🔗', metric: 'tapPower', target: 7, capAbsolu: 24, echelle: 'niveau', mode: 'absolute',
      label: (t) => `Monte Pacte au niveau ${t}` },
    // ⚠️ DEUX défis d'achat par groupe, pas quatre.
    //
    // Essayé : quatre défis visant chacun un palier différent du groupe.
    // Impossible à équilibrer — les paliers sont séparés d'un facteur 3
    // en prix, donc les hauts sont infaisables et les bas dérisoires
    // (mesuré : « 6 Phénix » = 5x le seuil, « 8 Esprits » = 0 minute).
    // Les deux défis d'achat qui suivent le groupe sont `g3_gen1` et
    // `g5_gen2` ; ce créneau-ci reste un défi de RYTHME.
    // ⚠️ Ce créneau a porté quatre variantes avant de revenir ici,
    // toutes écartées PAR LA MESURE :
    //   - un défi d'achat suivant le groupe : dérisoire dès A2, parce
    //     que les paliers bas ne coûtent plus rien ;
    //   - les dorées, puis les taps : troisième défi de RYTHME dans un
    //     œuf qui en compte déjà deux ;
    //   - les critiques : doublon avec l'œuf 2 ;
    //   - la réserve de pièces : deuxième défi d'ÉCONOMIE de l'œuf.
    //
    // L'Esprit Frappeur en dur reste la moins mauvaise option : c'est le
    // premier générateur du jeu, l'œuf 1 est le seul endroit où il est
    // encore cher, et il n'entre en conflit avec aucune autre famille.
    { id: 'g1_esprit', icon: '👻', metriqueParGroupe: generateurDuGroupe(4), target: 10, capAbsolu: 25,
      echelle: 'unites', mode: 'absolute',
      label: (t, m) => `Possède ${t} ${nomArticle(m, t > 1)}` },
    // ⚠️ `cap` OBLIGATOIRE sur une tenue de Transe : sans lui le plancher
    // « +15 % au-dessus de l'acquis » l'a déjà poussée à 641 secondes.
    { id: 'g1_transe', icon: '🔥', metric: 'maxTranseHoldSec', target: 25, cap: 150, echelle: 'transe', mode: 'absolute',
      label: (t) => `Reste en Transe x2,5 pendant ${t} secondes` },
    { id: 'g1_golden', icon: '⭐', metric: 'goldenClaimed', target: 3, echelle: 'actions', mode: 'delta',
      label: (t) => (t > 1 ? `Touche ${t} fois la cible dorée` : 'Touche la cible dorée') },
  ],

  // ══════════════════ ŒUF 2 — PREMIERS COMBATS ══════════════════
  // La première créature est arrivée et s'équipe seule : l'Aventure
  // devient jouable, et avec elle les Griffes.
  // Mesuré en fin d'œuf : ~36 000 gagnés, 6 pièces/s, Pacte 9, 1 Main.
  [
    { id: 'g2_passif', icon: '⚙️', metric: 'passiveIncome', target: 7, echelle: 'pieces', mode: 'absolute',
      label: (t) => `Atteins ${qtyQ(t, 'pièces')} par seconde` },
    // 1er maillon de la chaîne de boutique : Pacte 5 -> Faveur ->
    // Dégâts critiques -> Sanctuaire -> Veilleur. Chaque maillon est un
    // défi, dans l'ordre, sinon le suivant n'est pas débloqué et le pool
    // le remplace (bug du 19/09, 8 défis sur 12 œufs remplacés).
    { id: 'g2_faveur', icon: '🍀', metric: 'critLevel', target: 8, capAbsolu: 20, echelle: 'niveau', mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('faveur', s),
      label: (t) => `Monte la Faveur des Esprits au niveau ${t}` },
    { id: 'g2_adv', icon: '⚔️', metric: 'advLevelReached', target: 5, echelle: 'aventure', mode: 'absolute',
      // ⚠️ `creaturesAVenir` et non `ownedCount` : au tirage, la créature
      // de l'œuf précédent est encore EN INCUBATION. Voir le commentaire
      // dans `questStats`.
      available: (s) => (s.creaturesAVenir || s.ownedCount || 0) > 0,
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    // ⚠️ 30 -> 45. Le contrôle le mesurait à 1 minute parce qu'il suppose
    // la Faveur déjà montée ; avec la Faveur au niveau 1, 30 critiques
    // prennent 6 minutes. 45 place le défi autour de 9 minutes, dans
    // l'ordre de grandeur des autres défis de l'œuf.
    // ⚠️ 45 -> 200. Ce défi arrive APRÈS celui de la Faveur des Esprits
    // (niveau 8), qui fait passer la chance de critique de 1 % à 10 % :
    // 45 critiques ne demandaient plus que 2 minutes. Chiffré à la
    // chance RÉELLE au moment où le défi se joue, pas à celle du début
    // de l'œuf.
    { id: 'g2_crits', icon: '💥', metric: 'totalCrits', target: 200, echelle: 'actions', mode: 'delta',
      label: (t) => `Obtiens ${t} coup${t > 1 ? 's' : ''} critique${t > 1 ? 's' : ''}` },
    // ⚠️ Compté sur le TOTAL de taps de la partie, pas depuis le début
    // du défi.
    //
    // En `delta`, un joueur qui avait déjà tapé 600 fois devait en faire
    // 800 DE PLUS. En `absolute`, la cible est un total : il lui en
    // reste 200. `minStep` garantit qu'il en reste toujours au moins 200
    // à faire, même à un joueur qui en a déjà des milliers — sinon le
    // défi naîtrait accompli.
    // ⚠️ `totalTaps` est déjà pris par l'œuf 1 : ce créneau vise les
    // combats, la seule famille encore libre dans cet œuf.
    { id: 'g2_taps', icon: '🗡️', metric: 'battleWon', target: 4, echelle: 'aventure', mode: 'delta',
      available: (s) => (s.creaturesAVenir || s.ownedCount || 0) > 0,
      label: (t) => `Gagne ${t} combat${t > 1 ? 's' : ''} en Aventure` },
    // ⚠️ Le 1er palier de tap du groupe. Nul avant la 1re Ascension :
    // le premier palier exige Pacte 10, que le joueur n'atteint qu'au 2e
    // groupe. `available` le retire donc proprement au groupe 0.
    // ⚠️ Ce créneau devait porter le 1er PALIER DE TAP du groupe, pour
    // que le joueur découvre Poigne, Gantelet, Sceau... Reporté : le
    // premier palier exige Pacte 10, que le joueur n'atteint qu'à l'œuf
    // 6 du groupe 0. Un défi placé ici ne pourrait pas être rempli, et
    // comme la séquence ne substitue plus, il bloquerait l'œuf.
    //
    // À traiter avec le déplacement du créneau APRÈS le défi de Pacte,
    // ou en avançant l'ouverture du premier palier.
    // Même raison : ce créneau redevient un défi d'ACTION.
    { id: 'g2_main', icon: '👆', metric: 'totalTaps', target: 1500, minStep: 300,
      echelle: 'actions', mode: 'absolute',
      label: (t) => `Atteins ${fmtQ(t)} taps au total` },
  ],

  // ══════════════════ ŒUF 3 — S'ÉQUIPER ══════════════════
  // Mesuré en fin d'œuf : ~86 000 gagnés, 20 pièces/s, 6 Esprits,
  // 4 Mains.
  [
    { id: 'g3_reserve', icon: '💰', metric: 'coins', partAsc: 0.10, mode: 'absolute',
      label: (t) => `Mets ${qtyQ(t, 'pièces')} de côté` },
    // 2e maillon : ouvert par la Faveur de l'œuf 2, ouvre le Sanctuaire.
    // ⚠️ Niveau 3 -> 9. À 3, le défi coûtait 918 pièces à un joueur qui
    // en gagne 660 par MINUTE : bouclé en une minute vingt. Le niveau 9
    // coûte 33 400 pièces, soit l'ordre de grandeur du défi voisin de
    // l'œuf (25 000 mis de côté).
    //
    // ⚠️ RÈGLE à appliquer à tout défi d'achat : sa cible se cale sur le
    // COÛT des défis voisins du même œuf, pas sur un niveau qui « fait
    // bien ». Un niveau ne dit rien, un coût se compare.
    // ⚠️ Niveau 10 : 57 100 pièces, soit deux fois le défi voisin du même
    // œuf (25 000 mis de côté). Le coût DOUBLE à chaque niveau, donc
    // viser 14 le faisait passer à 480 000 pièces et 205 minutes — un
    // mur au milieu du 3e œuf. Deux crans de trop suffisent à casser un
    // défi quand le coût double.
    { id: 'g3_critdmg', icon: '💢', metric: 'critDamageLevel', target: 10, capAbsolu: 24, echelle: 'niveau', mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('critDamage', s),
      label: (t) => `Monte les Dégâts critiques au niveau ${t}` },
    { id: 'g3_adv', icon: '⚔️', metric: 'advLevelReached', target: 10, echelle: 'aventure', mode: 'absolute',
      // ⚠️ `creaturesAVenir` et non `ownedCount` : au tirage, la créature
      // de l'œuf précédent est encore EN INCUBATION. Voir le commentaire
      // dans `questStats`.
      available: (s) => (s.creaturesAVenir || s.ownedCount || 0) > 0,
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    { id: 'g3_pouvoirs', icon: '✨', metric: 'powerActivated', target: 5, echelle: 'actions', mode: 'delta',
      label: (t) => (t > 1 ? `Active ${t} fois un pouvoir` : 'Active un pouvoir') },
    // ⚠️ 6 -> 10. Le joueur en possède DÉJÀ 5 depuis l'œuf 1 : viser 6
    // ne demandait qu'un seul achat, une minute. 10 unités coûtent
    // l'ordre de grandeur du budget de l'œuf.
    // ⚠️ Vise le 1er générateur DÉCOUVERT à cette Ascension, pas un
    // générateur figé : Esprit Frappeur au départ, puis Automate,
    // Titan, Dragon... C'est ainsi que le joueur découvre sa boutique.
    { id: 'g3_gen1', icon: '⚙️', metriqueParGroupe: generateurDuGroupe(0),
      target: 5, capAbsolu: 8, echelle: 'unites', mode: 'absolute',
      label: (t, m) => `Possède ${t} ${nomArticle(m, t > 1)}` },
  ],

  // ══════════════════ ŒUF 4 — LA COLLECTION ══════════════════
  // L'œuf le plus tourné vers l'Aventure : rune, créature, étoiles.
  // Mesuré en fin d'œuf : ~170 000 gagnés, Pacte 10.
  [
    { id: 'g4_rune', icon: '🔮', metric: 'runeBought', target: 1, mode: 'delta',
      label: (t) => (t > 1 ? `Achète ${t} runes` : 'Achète une rune') },
    // ⚠️ SEUL défi volontairement RELATIF au joueur, et c'est un choix
    // assumé de l'auteur, pas un reste de l'ancien système.
    //
    // Une cible fixe ne marche pas ici : le niveau des créatures ne
    // repart PAS à zéro après une Ascension et n'a pas de plafond, donc
    // « niveau 15 » est un mur au début et un défi offert plus tard.
    // « +5 au-dessus de ta meilleure créature » garde le même sens à
    // tous les stades de la partie, et c'est lisible dans le document :
    // la règle y est écrite, même si le nombre affiché varie.
    //
    // ⚠️ `step` et non `target` : c'est ce qui le fait sortir du contrôle
    // `auditCibleSuitLeJoueur`, qui exige l'inverse pour tous les autres.
    { id: 'g4_creature', icon: '🐣', metric: 'maxCreatureLevel', step: 5, mode: 'absolute',
      // ⚠️ `creaturesAVenir` et non `ownedCount` : au tirage, la créature
      // de l'œuf précédent est encore EN INCUBATION. Voir le commentaire
      // dans `questStats`.
      available: (s) => (s.creaturesAVenir || s.ownedCount || 0) > 0,
      label: (t) => `Monte une créature au niveau ${t}` },
    { id: 'g4_etoiles', icon: '🌟', metric: 'threeStarLevel', target: 1, echelle: 'aventure', mode: 'delta',
      // ⚠️ `creaturesAVenir` et non `ownedCount` : au tirage, la créature
      // de l'œuf précédent est encore EN INCUBATION. Voir le commentaire
      // dans `questStats`.
      available: (s) => (s.creaturesAVenir || s.ownedCount || 0) > 0,
      label: (t) => (t > 1
        ? `Décroche toutes les étoiles sur ${t} niveaux d'Aventure`
        : "Décroche toutes les étoiles sur un niveau d'Aventure") },
    // 3e maillon : ouvert par les Dégâts critiques de l'œuf 3.
    // ⚠️ Niveau 5 -> 42, et PAS d'échelle de groupe.
    //
    // Le coût du Sanctuaire est concentré tout en haut : le niveau 20 ne
    // coûte que 1 259 pièces, le 42 en coûte 28 000. Viser 5 revenait à
    // demander zéro effort. Et comme la mécanique PLAFONNE à 50, une
    // échelle de groupe la saturerait dès le 2e groupe — elle n'en a
    // donc pas : le joueur repart de zéro à chaque Ascension et refait
    // le même chemin, ce qui est déjà une progression.
    { id: 'g4_sanct', icon: '🏛️', metric: 'sanctuaryLevel', target: 42, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('sanctuaire', s) && (s.sanctuaryLevel || 0) < SANCTUARY_MAX_LEVEL,
      label: (t) => `Monte le Sanctuaire au niveau ${t}` },
    // Le 2e palier de tap du groupe : Gantelet, puis Main du Colosse,
    // Supernova, Serment... Chaque palier exige 5 niveaux du précédent,
    // et le défi de l'œuf 2 les lui fait justement acheter.
    // Même report que le créneau de l'œuf 2.
    { id: 'g4_coins', icon: '🪙', metric: 'totalEarned', partAsc: 0.14, mode: 'delta',
      label: (t) => `Obtiens ${qtyQ(t, 'pièces')}` },
  ],

  // ══════════════════ ŒUF 5 — MONTER EN PUISSANCE ══════════════════
  // Mesuré en fin d'œuf : ~300 000 gagnés, 134 pièces/s de revenu.
  [
    { id: 'g5_reserve', icon: '💰', metric: 'coins', partAsc: 0.2, mode: 'absolute',
      label: (t) => `Mets ${qtyQ(t, 'pièces')} de côté` },
    // 5 -> 6 : le joueur en a déjà 4 à ce stade, viser 5 n'était qu'un
    // achat. 6 correspond au budget de l'œuf.
    // Le 2e générateur du groupe : Main Spectrale, puis Colonie, Golem,
    // Phénix, Gardien...
    { id: 'g5_gen2', icon: '⚙️', metriqueParGroupe: generateurDuGroupe(1),
      target: 10, capAbsolu: 14, echelle: 'unites', mode: 'absolute',
      label: (t, m) => `Possède ${t} ${nomArticle(m, t > 1)}` },
    { id: 'g5_adv', icon: '⚔️', metric: 'advLevelReached', target: 15, echelle: 'aventure', mode: 'absolute',
      // ⚠️ `creaturesAVenir` et non `ownedCount` : au tirage, la créature
      // de l'œuf précédent est encore EN INCUBATION. Voir le commentaire
      // dans `questStats`.
      available: (s) => (s.creaturesAVenir || s.ownedCount || 0) > 0,
      label: (t) => `Termine le ${describeAdventureLevel(t)}` },
    // 4e et dernier maillon : ouvert par le Sanctuaire de l'œuf 4.
    // ⚠️ Même correction que le Sanctuaire : coût concentré en haut,
    // mécanique plafonnée à 50, donc pas d'échelle de groupe. Le niveau
    // 40 coûte 42 800 pièces, cohérent avec les 90 000 mis de côté
    // demandés dans le même œuf.
    { id: 'g5_veilleur', icon: '🌙', metric: 'veilleurLevel', target: 40, mode: 'absolute',
      available: (s) => coreUpgradeUnlocked('veilleur', s) && (s.veilleurLevel || 0) < VEILLEUR_MAX_LEVEL,
      label: (t) => `Monte le Veilleur au niveau ${t}` },
    { id: 'g5_transe', icon: '🔥', metric: 'maxTranseHoldSec', target: 45, cap: 80, mode: 'absolute',
      label: (t) => `Tiens la Transe pendant ${t} secondes` },
  ],

  // ══════════════════ ŒUF 6 — FRANCHIR ══════════════════
  // Le dernier effort. Mesuré : le joueur y passe de 300 000 à 500 000
  // pièces gagnées, et l'Ascension demande le reste.
  [
    { id: 'g6_coins', icon: '🪙', metric: 'totalEarned', partAsc: 0.3, mode: 'delta',
      label: (t) => `Obtiens ${qtyQ(t, 'pièces')}` },
    { id: 'g6_pacte', icon: '🔗', metric: 'tapPower', target: 10, capAbsolu: 23, echelle: 'niveau', mode: 'absolute',
      label: (t) => `Monte Pacte au niveau ${t}` },
    { id: 'g6_combats', icon: '🗡️', metric: 'battleWon', target: 5, echelle: 'aventure', mode: 'delta',
      // ⚠️ `creaturesAVenir` et non `ownedCount` : au tirage, la créature
      // de l'œuf précédent est encore EN INCUBATION. Voir le commentaire
      // dans `questStats`.
      available: (s) => (s.creaturesAVenir || s.ownedCount || 0) > 0,
      label: (t) => `Gagne ${t} combat${t > 1 ? 's' : ''} en Aventure` },
    { id: 'g6_offrande', icon: '🕯️', metric: 'offering', target: 1, mode: 'delta',
      label: (t) => (t > 1 ? `Fais ${t} Offrandes` : 'Fais une Offrande') },
    // ⚠️ `step: 1` et NON une cible en dur. Il n'existait que deux défis
    // d'Ascension (`target: 1` et `target: 2`) : passé la 2e, plus aucun
    // défi n'en demandait et la séquence cessait de structurer le jeu.
    { id: 'g6_ascend', icon: '🌟', metric: 'ascension', step: 1, mode: 'absolute',
      label: (t) => `Fais ta ${t}${t === 1 ? 're' : 'e'} Ascension` },
  ],
];
// ⚠️ AUCUN défi ne doit dépendre de l'INVOCATION.
//
// Les créatures viennent des ŒUFS ; le bouton « Invoquer » est destiné
// aux développeurs. Un défi « Invoque N créatures » serait donc
// INFAISABLE pour un joueur — et un seul défi infaisable bloque
// l'éclosion DÉFINITIVEMENT.
//
// `summon10` et `summon30` ont été retirés pour cette raison (15/09).
export const QUEST_POOL = [
  // ---------- Économie générale ----------
  { id: 'earnShort', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 10, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'earnMid', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 25, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'earnLong', family: 'economy', icon: '💰', metric: 'totalEarned', effortMin: 60, mode: 'delta',
    label: (t) => `Gagne ${qtyQ(t, 'pièces')}` },
  { id: 'holdLong', family: 'economy', icon: '🏦', metric: 'coins', effortMin: 75, mode: 'absolute',
    label: (t) => `Mets ${qtyQ(t, 'pièces')} de côté` },
  { id: 'passiveMid', family: 'economy', icon: '📈', metric: 'passiveIncome', effortMin: 30, mode: 'absolute',
    label: (t) => `Atteins ${qtyQ(t, 'pièces')} par seconde` },
  { id: 'passiveLong', family: 'economy', icon: '📈', metric: 'passiveIncome', effortMin: 70, mode: 'absolute',
    label: (t) => `Atteins ${qtyQ(t, 'pièces')} par seconde` },

  // ---------- Mécaniques historiques ----------
  // ⚠️ Deux familles ajoutées le 17/09.
  //
  // `totalTaps` : le seul défi qui ne dépend d'AUCUNE ressource. Aucun
  // risque de blocage, aucune précondition — il est toujours faisable.
  // Cible dérivée de la cadence de référence, jamais écrite en dur.
  // ⚠️ « Tape 600 fois » et « Tape 2 000 fois » SUPPRIMÉS du pool.
  //
  // L'auteur n'a jamais demandé ces défis et les a vus apparaître dans
  // son œuf : le pool comble les trous du schéma, et ces deux-là s'y
  // glissaient. Le seul défi de taps du jeu est celui du schéma
  // (`g2_taps`), écrit noir sur blanc dans le document de référence.
  //
  // ⚠️ RÈGLE : le pool ne doit contenir QUE des défis que l'auteur a
  // validés. Tout ce qui n'est pas dans le document de référence n'a
  // rien à faire dans un œuf de la séquence.
  // `threeStarLevel` : se règle avec les combats DÉJÀ faits pour les
  // défis de niveau d'Aventure — de la variété sans une énergie de plus.
  // ⚠️ Exige un deck : la précondition d'Aventure s'applique.
  // ⚠️ Libellé SANS le nombre « 3 ». Première écriture : « Obtiens 3
  // étoiles sur un niveau » — `auditLibelles()` l'a signalé à raison, le
  // 3 désigne les étoiles et la cible vaut 1 NIVEAU. Deux nombres
  // différents dans la même phrase, c'est exactement ce que le contrôle
  // doit refuser, et c'est ainsi qu'un joueur lit une cible fausse.
  // `available` : sans deck, l'Aventure est injouable et l'œuf bloque.
  { id: 'advThreeStar', family: 'adventure', icon: '🌟', metric: 'threeStarLevel', target: 1, mode: 'delta',
    available: (s) => (s.deckCount || 0) > 0,
    label: (t) => (t > 1
      ? `Décroche toutes les étoiles sur ${t} niveaux d'Aventure`
      : "Décroche toutes les étoiles sur un niveau d'Aventure") },
  { id: 'pacteMid', family: 'core', icon: '🔗', metric: 'tapPower', effortMin: 20, mode: 'absolute',
    label: (t) => `Fais monter Pacte au niveau ${t}` },
  { id: 'pacteLong', family: 'core', icon: '🔗', metric: 'tapPower', effortMin: 50, mode: 'absolute',
    label: (t) => `Fais monter Pacte au niveau ${t}` },
  { id: 'sanctMid', family: 'core', icon: '🏛️', metric: 'sanctuaryLevel', effortMin: 25, mode: 'absolute',
    available: (s) => coreUpgradeUnlocked('sanctuaire', s) && (s.sanctuaryLevel || 0) < SANCTUARY_MAX_LEVEL,
    label: (t) => `Monte le Sanctuaire au niveau ${t}` },
  { id: 'sanctLong', family: 'core', icon: '🏛️', metric: 'sanctuaryLevel', effortMin: 55, mode: 'absolute',
    available: (s) => coreUpgradeUnlocked('sanctuaire', s) && (s.sanctuaryLevel || 0) < SANCTUARY_MAX_LEVEL,
    label: (t) => `Monte le Sanctuaire au niveau ${t}` },
  { id: 'veilleurMid', family: 'core', icon: '🌙', metric: 'veilleurLevel', effortMin: 20, mode: 'absolute',
    available: (s) => coreUpgradeUnlocked('veilleur', s) && (s.veilleurLevel || 0) < VEILLEUR_MAX_LEVEL,
    label: (t) => `Monte le Veilleur au niveau ${t}` },
  { id: 'faveurMid', family: 'core', icon: '✨', metric: 'critLevel', effortMin: 20, mode: 'absolute',
    available: (s) => coreUpgradeUnlocked('faveur', s),
    label: (t) => `Monte la Faveur des Esprits au niveau ${t}` },
  // ⚠️ « Possède N auto-clics EN TOUT » SUPPRIMÉ.
  //
  // Un total ne dit rien au joueur : il ne sait pas quoi acheter, et
  // deux chemins très différents valident le même défi. Un générateur
  // NOMMÉ (« Possède 4 Mains Spectrales ») indique la cible et pousse
  // vers un palier précis de la boutique. Tous les défis de génération
  // passent par `auto:<id>`.

  // ---------- Rythme d'action (cibles FIXES) ----------
  // Ces défis ne coûtent pas de pièces mais du temps de jeu actif : les
  // convertir en budget n'aurait aucun sens.
  { id: 'combo25', family: 'action', icon: '🔥', metric: 'maxCombo', target: 25, cap: 60, mode: 'absolute',
    label: () => 'Atteins un multiplicateur de Transe x2,5' },
  { id: 'combo30', family: 'action', icon: '🔥', metric: 'maxCombo', target: 30, cap: 80, mode: 'absolute',
    available: (s) => (s.maxCombo || 0) >= 20,
    label: () => 'Atteins un multiplicateur de Transe x3' },
  // `critChance(0)` vaut exactement 0 : sans Faveur des Esprits, aucun
  // coup critique ne peut tomber. Mais le 1er niveau ne coûte que 25
  // pièces — le défi est donc parfaitement atteignable dès le début, il
  // demande juste d'acheter la Faveur d'abord. On ne le bloque donc que
  // pour un joueur qui n'a pas encore de quoi se la payer.
  { id: 'crit20', family: 'action', icon: '💥', metric: 'totalCrits', target: 20, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && ((s.critLevel || 0) >= 1 || (s.coins || 0) >= critUpgradeCost(0) || questBudget(s, 5) >= critUpgradeCost(0)),
    label: (t) => `Obtiens ${t} coup${t > 1 ? 's' : ''} critique${t > 1 ? 's' : ''}` },
  { id: 'crit100', family: 'action', icon: '💥', metric: 'totalCrits', target: 100, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && (s.critLevel || 0) >= 2,
    label: (t) => `Obtiens ${t} coup${t > 1 ? 's' : ''} critique${t > 1 ? 's' : ''}` },
  { id: 'crit400', family: 'action', icon: '💥', metric: 'totalCrits', target: 200, mode: 'delta',
    available: (s) => coreUpgradeUnlocked('faveur', s) && (s.critLevel || 0) >= 5,
    label: (t) => `Obtiens ${t} coup${t > 1 ? 's' : ''} critique${t > 1 ? 's' : ''}` },
  { id: 'golden3', family: 'action', icon: '⭐', metric: 'goldenClaimed', target: 3, mode: 'delta',
    label: (t) => (t > 1 ? `Touche ${t} fois la cible dorée` : 'Touche la cible dorée') },
  // La cible dorée n'apparaît qu'une fois toutes les 45-90 secondes :
  // 10 captures demandent une bonne dizaine de minutes de présence
  // continue. Réservé à un joueur qui en a déjà attrapé.
  { id: 'golden10', family: 'action', icon: '⭐', metric: 'goldenClaimed', target: 10, mode: 'delta',
    available: (s) => (s.goldenClaimed || 0) >= 3,
    label: (t) => (t > 1 ? `Touche ${t} fois la cible dorée` : 'Touche la cible dorée') },
  // L'invocation coûte des pièces et son prix grimpe avec la
  // collection : inutile de proposer 10 invocations à qui n'a pas de
  // quoi en payer une seule.

  // ---------- Collection (pas monétaire : pas relatif) ----------
  // PAS de défi « possède N créatures différentes » : les créatures
  // s'obtiennent en faisant éclore l'œuf, que ce défi bloquerait — une
  // dépendance circulaire. Le gacha offre bien une porte de sortie, mais
  // un défi ne doit pas exiger de contourner le système qu'il gèle.
  // `summon*` couvre déjà l'invocation, proprement et en mode delta.
  // Nourrir suppose d'avoir au moins une créature à nourrir.
  { id: 'feed5', family: 'collection', icon: '🍖', metric: 'maxCreatureLevel', mode: 'absolute', step: 5, minStep: 5,
    available: (s) => (s.ownedCount || 0) >= 1,
    label: (t) => `Nourris une créature jusqu'au niveau ${t}` },
  { id: 'feed15', family: 'collection', icon: '🍖', metric: 'maxCreatureLevel', mode: 'absolute', step: 15, minStep: 15,
    available: (s) => (s.ownedCount || 0) >= 1 && (s.maxCreatureLevel || 0) >= 5,
    label: (t) => `Nourris une créature jusqu'au niveau ${t}` },

  // ---------- Défis Aventure ----------
  //
  // BUG RÉEL (signalé après une réinitialisation de progression) : ces
  // défis étaient proposés à un joueur tout neuf, qui recevait « gagne 3
  // combats » et « équipe une rune » alors qu'il n'avait AUCUNE créature.
  // Le bouton Combattre d'AdventureScreen est désactivé quand le deck
  // est vide (« Deck vide ») : l'œuf devenait donc définitivement
  // inéclosable. Chaque défi porte maintenant sa vraie précondition, et
  // la chaîne complète est respectée :
  //   créature dans le deck -> combats -> Griffes -> achat de rune ->
  //   équipement de rune
  { id: 'advWin3', family: 'adventure', icon: '⚔️', metric: 'battleWon', target: 3, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1,
    label: (t) => `Gagne ${t} combats en Exploration` },
  { id: 'advWin10', family: 'adventure', icon: '⚔️', metric: 'battleWon', target: 4, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.battleWon || 0) >= 3,
    label: (t) => `Gagne ${t} combats en Exploration` },
  // Les runes s'achètent avec des Griffes, qui ne s'obtiennent qu'en
  // gagnant des combats : exiger un combat déjà gagné, pas seulement une
  // créature.
  { id: 'advBuyRune1', family: 'adventure', icon: '🛒', metric: 'runeBought', target: 1, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.battleWon || 0) >= 1,
    label: (t) => `Achète ${t} rune en Aventure` },
  { id: 'advBuyRune5', family: 'adventure', icon: '🛒', metric: 'runeBought', target: 2, mode: 'delta',
    available: (s) => (s.deckCount || 0) >= 1 && (s.runeBought || 0) >= 1,
    label: (t) => `Achète ${t} runes en Aventure` },
  // On ne peut équiper une rune qu'après en avoir acheté une.
  { id: 'advEquipRune2', family: 'adventure', icon: '🪬', metric: 'runesEquipped', target: 2, mode: 'absolute',
    available: (s) => (s.deckCount || 0) >= 1 && (s.runeBought || 0) >= 1,
    label: (t) => `Équipe ${t} runes sur tes créatures (Aventure)` },
];

// ⚠️⚠️ VERSION DES DÉFINITIONS — CALCULÉE, plus jamais à la main.
//
// Les défis sont VERROUILLÉS au tirage : leur cible est figée quand
// l'œuf les distribue, puis persistée. C'est voulu — sans ça la cible
// suivrait le porte-monnaie du joueur et s'éloignerait sans fin. Mais ça
// veut dire qu'un changement ici n'a AUCUN effet sur l'œuf en cours.
//
// Ce numéro le règle : au chargement, s'il diffère de celui de la
// sauvegarde, les défis de l'œuf en cours sont retirés au sort avec les
// nouvelles définitions (le reste de la partie n'est pas touché).
//
// ⚠️ Il était écrit à la main, et c'était le SEUL point de la chaîne
// qu'aucun contrôle ne couvrait : l'oublier en ajoutant un défi, et
// l'auteur ne voit pas son changement — il croit à un bug de
// publication. C'est arrivé le 17/09.
//
// Il se calcule maintenant à partir de la STRUCTURE des défis : ids,
// métriques, modes, cibles, parts, pas et plafonds. Ajouter, retirer ou
// régler un défi change le numéro tout seul.
//
// Les LIBELLÉS ne sont volontairement pas dans le calcul : ils sont des
// fonctions de la cible, donc un texte modifié s'affiche correctement
// sans qu'il faille retirer les défis au sort.
// ⚠️⚠️ VERSION DU MOTEUR DE TIRAGE — à INCRÉMENTER dès qu'on change la
// façon dont les défis sont CHOISIS dans `questLogic.js`, ou dont leur
// cible est RÉSOLUE.
//
// L'empreinte ci-dessous se calcule sur les DÉFINITIONS. Un correctif du
// MOTEUR ne la faisait donc pas bouger : le 19/09, la séquence a cessé
// de substituer les défis du schéma, mais l'auteur a continué de voir
// l'ancien tirage — un défi du pool à la place de la Faveur des Esprits.
// Le correctif était bien dans son appli et ne s'appliquait qu'au
// PROCHAIN œuf.
//
// ⚠️ La constante vit ICI et non dans `questLogic.js` : `questDefs` ne
// peut pas importer `questLogic`, qui l'importe déjà. Cycle d'imports.
//
// ⚠️ L'oublier, c'est reproduire ce bug : un correctif invisible, et des
// heures passées à chercher dans les défis au lieu du moteur.
export const QUEST_ENGINE_VERSION = 22;

function empreinteDefis() {
  const morceaux = [];
  const decrire = (q) => morceaux.push([
    q.id, q.metric, q.mode,
    q.target == null ? '' : q.target,
    q.partAsc == null ? '' : q.partAsc,
    q.effortMin == null ? '' : q.effortMin,
    q.step == null ? '' : q.step,
    q.cap == null ? '' : q.cap,
  ].join('|'));
  QUEST_SEQUENCE.forEach((cycle) => cycle.forEach(decrire));
  QUEST_POOL.forEach(decrire);
  // ⚠️ La version du MOTEUR entre dans l'empreinte : changer la façon
  // dont les défis sont choisis doit aussi faire retirer ceux en cours.
  // Sans ça, un correctif du moteur reste invisible sur l'œuf courant —
  // bug du 19/09.
  const texte = morceaux.join(';') + '|moteur:' + QUEST_ENGINE_VERSION;
  // Hachage simple et stable (djb2). Pas de dépendance, même résultat
  // sur tous les téléphones.
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h * 33) ^ texte.charCodeAt(i)) >>> 0;
  return h;
}

export const QUEST_DEFS_VERSION = empreinteDefis();

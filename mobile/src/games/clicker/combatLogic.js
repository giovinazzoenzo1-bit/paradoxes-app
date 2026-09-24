// Logique pure du mode Aventure / Combat — voir mobile/ADVENTURE_MODE.md
// pour le design complet. Aucun écran ne dépend encore de ce fichier :
// c'est l'étape 1 du plan de construction (fonctions testables d'abord).
import { CREATURES, MANA_MAX, MANA_PER_TURN } from './clickerLogic';

// ---- Stats de combat par rareté ----
// Recalibré (29/08) à partir d'un exemple réel produit par le
// générateur Gemini de l'utilisateur : Solarion (Épique, Attaquant,
// PV95/ATQ38). En retirant le modificateur de type Attaquant (x0,8 PV /
// x1,3 ATQ), on obtient la base "équilibrée" épique ≈ PV119/ATQ29, qui
// sert d'ancrage à toute la progression ci-dessous (ratio géométrique
// ~x2,28 PV / ~x2,13 ATQ par palier, en partant de commun=PV10/ATQ3
// comme précisé dans le prompt Gemini). "mythique" défini mais pas
// encore utilisé par aucune créature.
export const RARITY_BASE_STATS = {
  commun: { hp: 10, attack: 3, clickSpeed: 1.0, endurance: 60 },
  peu_commun: { hp: 23, attack: 6, clickSpeed: 1.2, endurance: 75 },
  rare: { hp: 52, attack: 14, clickSpeed: 1.4, endurance: 95 },
  epique: { hp: 119, attack: 29, clickSpeed: 1.8, endurance: 120 },
  legendaire: { hp: 272, attack: 62, clickSpeed: 2.2, endurance: 150 },
  mythique: { hp: 620, attack: 132, clickSpeed: 2.8, endurance: 190 },
};

// Stats de combat d'une créature possédée par le joueur, selon sa
// rareté et son niveau ACTUEL (celui qu'on monte déjà en la nourrissant
// dans le clicker classique — ça lui donne enfin une 2e utilité).
// Croissance des PV/Attaque par niveau — linéaire (+8%/niveau) jusqu'au
// niveau 50, puis ralentie (+2%/niveau) au-delà. Sans ce ralentissement,
// une seule créature beaucoup nourrie grandirait sans limite (×8,9 à
// niveau 100, ×16,9 à niveau 200...), largement plus vite que la
// progression des adversaires en Aventure (liée au niveau de CHAPITRE,
// pas au niveau de la créature) — un grind extrême pouvait tout
// déséquilibrer. Le seuil de 50 reprend un repère déjà existant dans le
// jeu (2e palier d'évolution).
export function levelMultiplier(level) {
  if (level <= 50) return 1 + (level - 1) * 0.08;
  const atFifty = 1 + 49 * 0.08; // = 4,92 — valeur exacte au niveau 50
  return atFifty + (level - 50) * 0.02;
}

// Si la créature a ses propres stats de base (fournies par Gemini —
// champs baseHp/baseAttack/baseClickSpeed/baseEndurance), on les utilise
// TELLES QUELLES plutôt que la formule par rareté — Gemini connaît déjà
// le rôle de la créature au moment de choisir ses chiffres, pas la peine
// d'appliquer un multiplicateur de type par-dessus (risque de double
// application). Repli sur la formule uniquement pour les créatures qui
// n'ont pas encore été régénérées par Gemini.
export function combatStatsForCreature(creature, level) {
  const base = creature.baseHp != null
    ? { hp: creature.baseHp, attack: creature.baseAttack, clickSpeed: creature.baseClickSpeed, endurance: creature.baseEndurance }
    : RARITY_BASE_STATS[creature.rarity];
  const levelMult = levelMultiplier(level);
  return {
    hp: Math.round(base.hp * levelMult),
    attack: Math.round(base.attack * levelMult),
    // La vitesse de clic ne monte PAS avec le niveau (sinon le défi de
    // tap deviendrait trivial en fin de partie) — seule l'endurance suit
    // la même progression que PV/Attaque.
    //
    // TOUJOURS dérivée de la rareté (RARITY_BASE_STATS), jamais de la
    // valeur donnée par Gemini pour cette créature précise : Gemini a
    // systématiquement renvoyé "1" pour cette stat sur les 26 créatures
    // intégrées jusqu'ici (contrairement à PV/ATQ/Endurance qui varient
    // vraiment), la rendant plate et sans intérêt. La progression par
    // rareté (1,0 → 1,2 → 1,4 → 1,8 → 2,2 → 2,8) est déjà cohérente et
    // logique, on s'y appuie systématiquement à la place.
    clickSpeed: RARITY_BASE_STATS[creature.rarity].clickSpeed,
    endurance: Math.round(base.endurance * levelMult),
  };
}

// ---- Chapitres / niveaux ----
export const LEVELS_PER_CHAPTER = 10;

export function chapterForLevel(levelNumber) {
  return Math.ceil(levelNumber / LEVELS_PER_CHAPTER);
}
// Position du niveau DANS son chapitre (1 à 10).
export function levelIndexInChapter(levelNumber) {
  return ((levelNumber - 1) % LEVELS_PER_CHAPTER) + 1;
}

// Score de puissance approximatif d'une créature (PV+ATQ de base) — sert
// UNIQUEMENT à ordonner les adversaires du plus faible au plus fort, pas
// utilisé pour le combat réel (qui utilise toujours les vraies stats
// mises à l'échelle par niveau/évolution/type).
function powerScore(creature) {
  const base = creature.baseHp != null
    ? { hp: creature.baseHp, attack: creature.baseAttack }
    : RARITY_BASE_STATS[creature.rarity];
  return base.hp + base.attack;
}

// Roster trié une seule fois au chargement du module (30/08) — les
// adversaires apparaissent maintenant du plus faible au plus fort à
// mesure qu'on avance dans les niveaux, au lieu de suivre l'ordre
// arbitraire de définition dans CREATURES.
const CREATURES_BY_POWER = [...CREATURES].sort((a, b) => powerScore(a) - powerScore(b));

// Choix de l'adversaire pour un niveau donné — déterministe (pas
// aléatoire), pour que le même niveau donne toujours le même adversaire
// d'une tentative à l'autre. Cycle sur le roster TRIÉ PAR PUISSANCE
// (voir CREATURES_BY_POWER) : le niveau 1 tombe sur la créature la plus
// faible, le niveau 26 sur la plus forte, puis ça reboucle (mais les
// stats continuent de grossir avec le niveau via opponentStatsForLevel,
// donc même une créature "faible" qui revient plus tard reste un vrai défi).
export function opponentForLevel(levelNumber) {
  const idx = (levelNumber - 1) % CREATURES_BY_POWER.length;
  return CREATURES_BY_POWER[idx];
}

// Taille de l'équipe adverse selon le CHAPITRE (pas le niveau brut) — 1
// adversaire au chapitre 1, 2 au chapitre 2, 3 à partir du chapitre 3.
// Reprend le même repère que le reste du système (LEVELS_PER_CHAPTER),
// pas un seuil arbitraire inventé à part.
export function opponentTeamSize(levelNumber) {
  const chapter = chapterForLevel(levelNumber);
  if (chapter <= 1) return 1;
  if (chapter === 2) return 2;
  return 3;
}

// Équipe adverse complète pour un niveau donné — plusieurs créatures
// DIFFÉRENTES (pas 3x la même), toujours déterministe. Le décalage (+9,
// +18) pris dans le roster trié par puissance pour varier les membres
// sans avoir besoin d'un vrai tirage aléatoire.
// ---- Le Gardien ----
//
// Adversaire du combat qui protège l'éclosion d'un œuf. Ce n'est PAS une
// créature du roster : on ne peut ni l'obtenir, ni l'invoquer, ni le
// faire évoluer. Il est donc défini ici et pas dans `CREATURES`, sinon
// il apparaîtrait dans la collection, le gacha et les adversaires
// d'Aventure.
//
// Une seule apparence, d'où un unique `stages`. `creatureArtSource`
// ramène tout palier demandé au dernier disponible, donc une entrée
// suffit.
//
// Stats laissées à la formule commune (`statsForOpponentCreatureTyped`)
// : elles se calent sur le niveau du gardien, exactement comme un
// adversaire d'Aventure. Le profil PV/ATQ est celui d'un défenseur —
// c'est un mur qu'on doit franchir, pas un tueur.
// Le PREMIER gardien était trop long à abattre : ses PV sont réduits de
// 30 %. Uniquement le premier — les suivants restent à pleine valeur,
// c'est une rampe d'entrée, pas un affaiblissement général.
export const GUARDIAN_FIRST_HP_REDUCTION = 0.3;
// Dégâts relevés à TOUS les niveaux : le combat dure plus longtemps
// depuis les 2 manches, il doit aussi se faire sentir.
//
// ⚠️ Valeur 1,2 pour un effet RÉEL de +11 %, et non 1,15.
//
// Les dégâts du gardien valent 1 à 6 points : chacun est arrondi à
// l'entier, ce qui absorbe les petits pourcentages. Mesuré sur 5 niveaux
// de gardien, l'écart réellement obtenu ne prend que des valeurs
// discrètes : 1,15 → +6 %, 1,2 → +11 %, 1,25 → +20 %. Il n'existe pas de
// réglage donnant exactement +15 %, 1,2 en est le plus proche par le
// dessous.
export const GUARDIAN_DAMAGE_BOOST = 1.2;

// ---- Montée des dégâts à partir du 5e œuf ----
//
// ⚠️ MESURÉ : les dégâts du Gardien STAGNENT (2,8 en moyenne jusqu'au
// 5e œuf, 4,3 ensuite). Sa montée de niveau ne suffit pas, parce que sa
// part d'attaque dans le budget est faible et que l'arrondi à l'entier
// absorbe le reste.
//
// À partir du 5e œuf, ses dégâts montent donc d'eux-mêmes, EN PLUS du
// pourcentage global déjà appliqué (`GUARDIAN_DAMAGE_BOOST`).
export const GUARDIAN_RAMP_FROM_EGG = 5;
// ⚠️ 1,04 et non 1,12. MESURÉ : à 1,12 la part des PV du joueur passait
// de 26 % au 5e œuf à 115 % au 20e — le combat devenait perdable, alors
// que perdre son œuf après des heures d'incubation est précisément ce
// qu'on s'interdit.
//
// Les PV du joueur montent d'environ 8 % par niveau de créature, soit
// ~1 niveau par œuf. Une montée de 4 % par œuf suit cette croissance et
// garde le combat entre 26 % et 42 % des PV du 5e au 20e œuf : le
// Gardien se durcit sans jamais devenir un mur.
export const GUARDIAN_RAMP_PER_EGG = 1.04;

export function guardianEggRamp(eggNumber) {
  const n = Math.max(0, Math.floor(eggNumber || 0) - GUARDIAN_RAMP_FROM_EGG + 1);
  return Math.pow(GUARDIAN_RAMP_PER_EGG, n);
}

// Stats du Gardien : la formule commune, plus les ajustements ci-dessus.
// `baseLevel` est le niveau du tout premier gardien, `eggNumber` le
// numéro de l'œuf qu'il protège.
export function guardianStats(levelNumber, baseLevel, eggNumber = 0) {
  const st = statsForOpponentCreatureTyped(GUARDIAN_CREATURE, levelNumber);
  const premier = baseLevel != null && levelNumber <= baseLevel;
  return {
    ...st,
    hp: Math.max(1, Math.round(st.hp * (premier ? 1 - GUARDIAN_FIRST_HP_REDUCTION : 1))),
    // ⚠️ PAS d'arrondi ici. La stat d'attaque du gardien vaut 2 ou 3 :
    // arrondir absorbait entièrement le +15 % (2 × 1,15 = 2,3 → 2). Or
    // les dégâts réels valent `compétence × attaque / attaque de base`,
    // donc une attaque décimale propage bien le bonus jusqu'au coup.
    attack: st.attack * GUARDIAN_DAMAGE_BOOST * guardianEggRamp(eggNumber),
  };
}

export const GUARDIAN_SHIELD_RATIO = 0.4;   // bouclier = 40 % des PV max
export const GUARDIAN_PHASE1_HP_LOSS = 0.5; // la manche 1 s'arrête à -50 % PV
export const GUARDIAN_PHASES = 2;

// Le bouclier encaisse AVANT les PV. Renvoie l'état après un coup.
export function applyGuardianDamage({ hp, shield }, damage) {
  const onShield = Math.min(shield, damage);
  const rest = damage - onShield;
  return { hp: Math.max(0, hp - rest), shield: shield - onShield };
}

// ---- Le Gardien se cale sur le deck (24/09) ----
//
// L'auteur : « les dégâts du gardien sont parfaits pour l'œuf 2, mais
// après, trop facile de le tuer ; des attaques de zone mais pas toujours ;
// qu'il se recalibre souvent ; qu'il gagne 1/3 pour que les joueurs
// doivent améliorer leurs créatures ». Et : « un calcul pour évaluer la
// puissance, écrite avant de pouvoir combattre », le deck évalué en
// permanence dans le menu Aventure.
//
// MESURÉ avant (simulateur, 2 000 combats par œuf) : le Gardien ne
// gagnait JAMAIS, de l'œuf 2 à l'œuf 40 ; l'équipe finissait avec 82 à
// 95 % de ses PV. Dès l'œuf 3 on combat à 2 puis 3 créatures (3 fois les
// PV) et sa force suivait le numéro d'œuf, pas l'équipe.
//
// ⚠️ UNE FORMULE NE SUFFIT PAS : à puissance égale (√(PV × dégâts) des
// deux côtés), le Gardien gagnait de 25 à 78 % selon le deck —
// gaspillage des gros coups à la manche 1, arrondis, coups perdus sur une
// créature presque morte. Le jeu SIMULE donc le combat contre le deck du
// début de l'œuf, et règle le Gardien pour qu'il en gagne
// GUARDIAN_WIN_TARGET. La puissance (√(PV × dégâts)) sert à l'AFFICHAGE.
//
// ⚠️⚠️ UNE SEULE SOURCE DE RÈGLES : le coup du joueur, la riposte (zone
// comprise) et l'encaissement sont ICI, et CombatScreen les appelle. Ce
// que la simulation reproduit en plus (rotation, mana, premier coup) est
// sous empreinte : `auditGardienCalibre` crie si le combat change sans
// que la simulation suive.

// Tap de référence : le rythme de l'auteur (autoclicker 150 ms), sur
// lequel tout l'équilibrage est calé.
export const PUISSANCE_TAPS_PAR_SEC = 6.7;
export const GUARDIAN_WIN_TARGET = 1 / 3;
// Marge (demande de l'auteur après test, 24/09 : « baisse la différence,
// joueur 50 – gardien 52 ; à haut niveau c'est vraiment compliqué d'up
// les créatures pour atteindre la puissance requise »). Le Gardien est
// calé pour qu'un deck de puissance (deck du début de l'œuf × MARGE) le
// batte 2 fois sur 3, et sa puissance AFFICHÉE vaut deck × MARGE : un
// petit effort visible et atteignable, plus un mur.
export const GUARDIAN_POWER_MARGIN = 1.04;
// Attaque de zone (« pas toujours ») : une riposte sur quatre ; la cible
// prend le coup entier, les autres créatures vivantes 60 % de ce coup.
export const GUARDIAN_AOE_CHANCE = 0.25;
export const GUARDIAN_AOE_RATIO = 0.6;
// Le calibrage part d'un Gardien à la MÊME puissance que le deck (la
// formule donne l'ordre de grandeur), puis la simulation affine un
// correctif. MESURÉ : partir des stats de niveau demandait ×10 dès l'œuf
// 20 et dépassait toute borne à l'œuf 40 (le Gardien de base y est
// dérisoire). Bornes du correctif : un FILET — la formule ne se trompe
// pas d'un facteur 4 ; un correctif collé à une borne = simulation
// cassée (le contrôle le dit).
export const GUARDIAN_CORRECTION_MIN = 0.25;
export const GUARDIAN_CORRECTION_MAX = 4;

// Dégâts moyens d'un tour : meilleure compétence, et la spéciale une
// fois tous les MANA_MAX / MANA_PER_TURN tours, au tap de référence.
function degatsMoyensDuTour(creature, stats) {
  const skills = creature.skills || [];
  const meilleur = skills.filter((k) => !k.special).reduce((m, k) => Math.max(m, k.damage), 0);
  const spe = skills.find((k) => k.special);
  const cycle = MANA_MAX / MANA_PER_TURN;
  const brut = spe ? ((cycle - 1) * meilleur + spe.damage) / cycle : meilleur;
  const taps = effectiveTapCount(stats.clickSpeed, stats.tapReductionPct || 0);
  const mult = damageMultiplierForTime(taps / PUISSANCE_TAPS_PAR_SEC, true) + (stats.dmgMultBonus || 0);
  return brut * attackRatio(creature, stats.attack) * GLOBAL_DAMAGE_BOOST * mult;
}

const statsDuMembre = (m) => combatStatsForCreatureTyped(m.creature, m.ownedLevel || m.level || 1,
  m.evolutionTier || 0, m.equippedRunes || []);

// Puissance d'un deck, pour l'affichage : √(PV totaux × dégâts moyens
// d'un tour). Monte avec les niveaux, les évolutions et les runes.
// `membres` : la forme envoyée au combat — [{ creature, ownedLevel,
// evolutionTier, equippedRunes }] (`level` accepté aussi).
export function puissanceDeck(membres) {
  const f = (membres || []).filter((m) => m && m.creature).map((m) => {
    const st = statsDuMembre(m);
    return { pv: st.hp, dmg: degatsMoyensDuTour(m.creature, st) };
  });
  if (!f.length) return 0;
  const pv = f.reduce((t, x) => t + x.pv, 0);
  const dmg = f.reduce((t, x) => t + x.dmg, 0) / f.length;
  return Math.round(Math.sqrt(pv * dmg));
}

// Puissance du Gardien sur la même échelle : il doit abattre ΣPV, on
// doit lui retirer 2,3 fois ses PV (boucliers et deux manches).
const GARDIEN_PV_EFFECTIFS = GUARDIAN_SHIELD_RATIO + GUARDIAN_PHASE1_HP_LOSS + 1 + GUARDIAN_SHIELD_RATIO;
// La zone frappe les AUTRES créatures vivantes en plus de la cible.
export function facteurZone(nbCombattants) {
  return 1 + GUARDIAN_AOE_CHANCE * GUARDIAN_AOE_RATIO * Math.max(0, (nbCombattants || 1) - 1);
}
export function puissanceGardien(stats, nbCombattants = 3) {
  const G = GUARDIAN_CREATURE;
  const moyen = G.skills.reduce((t, k) => t + k.damage, 0) / G.skills.length;
  const coup = moyen * attackRatio(G, stats.attack) * GLOBAL_DAMAGE_BOOST;
  return Math.round(Math.sqrt(GARDIEN_PV_EFFECTIFS * stats.hp * coup * facteurZone(nbCombattants)));
}

// ---- Les règles partagées avec CombatScreen ----

// Coup du joueur : bouclier d'abord ; la manche 1 s'arrête à
// −GUARDIAN_PHASE1_HP_LOSS, puis le Gardien se relève à PV pleins avec un
// nouveau bouclier. `releve` : la manche vient de basculer (l'écran joue
// l'animation, et ce tour-là il ne riposte pas) ; `plancher` : les PV à
// afficher pendant l'animation.
export function coupSurGardien({ hp, shield, phase, maxHp }, degats) {
  const apres = applyGuardianDamage({ hp, shield }, degats);
  if (phase === 1) {
    const plancher = Math.ceil(maxHp * (1 - GUARDIAN_PHASE1_HP_LOSS));
    if (apres.hp <= plancher) {
      return { hp: maxHp, shield: Math.round(maxHp * GUARDIAN_SHIELD_RATIO), phase: 2, maxHp, releve: true, plancher };
    }
    return { hp: apres.hp, shield: apres.shield, phase: 1, maxHp, releve: false };
  }
  return { hp: apres.hp, shield: apres.shield, phase: 2, maxHp, releve: false };
}

// Riposte : une compétence au hasard ; GUARDIAN_AOE_CHANCE du temps,
// attaque de ZONE. Renvoie les dégâts par combattant (0 = pas touché).
export function riposteGardien(gStats, combattants, cible, alea = Math.random) {
  const G = GUARDIAN_CREATURE;
  const competence = G.skills[Math.floor(alea() * G.skills.length)];
  const brut = scaledSkillDamage(competence, G, gStats.attack);
  const zone = alea() < GUARDIAN_AOE_CHANCE;
  const degats = combattants.map((c, i) => {
    if (!c || c.hp <= 0 || (i !== cible && !zone)) return 0;
    const part = i === cible ? 1 : GUARDIAN_AOE_RATIO;
    return Math.max(1, Math.round(brut * elementMultiplier(G.element, c.creature.element) * part));
  });
  return { competence, zone, degats };
}

// Encaisser un coup. La Résilience (une fois par combat) laisse la
// créature debout à une part de ses PV max.
export function encaisser(c, degats) {
  let hp = Math.max(0, c.hp - degats);
  let resilienceUsed = !!c.resilienceUsed;
  const res = (c.stats && c.stats.resiliencePct) || 0;
  if (hp <= 0 && degats > 0 && res > 0 && !resilienceUsed) {
    hp = Math.max(1, Math.round(c.stats.hp * res));
    resilienceUsed = true;
  }
  return { hp, resilienceUsed };
}

// Dégâts du coup du joueur (compétence, temps du défi de taps, élément).
export function degatsDuJoueur(competence, combattant, cibleCreature, secondes, complet) {
  const mult = damageMultiplierForTime(secondes, complet) + (combattant.stats.dmgMultBonus || 0);
  const brut = competence.isBasic ? competence.damage
    : scaledSkillDamage(competence, combattant.creature, combattant.stats.attack);
  const elem = elementMultiplier(combattant.creature.element, cibleCreature.element,
    combattant.stats.affinityBonus || 0);
  return Math.max(1, Math.round(computePlayerDamage(brut, mult) * elem));
}

// ---- La simulation et le calibrage ----

// Tirages reproductibles (même graine = mêmes combats).
function aleaGraine(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function graineDuDeck(membres) {
  let h = 2166136261;
  (membres || []).forEach((m) => {
    const s = m && m.creature ? `${m.creature.id}:${m.ownedLevel || m.level || 1}:${m.evolutionTier || 0};` : '-;';
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  });
  return h >>> 0;
}

// Combattants préparés UNE fois par calibrage : stats, meilleure
// compétence, spéciale, taps. MESURÉ : les recalculer à chacun des
// milliers de combats simulés coûtait l'essentiel du temps.
// `marge` : PV et attaque multipliés (le deck « + MARGE » du calibrage).
function preparerCombattants(membres, marge = 1) {
  return (membres || []).filter((m) => m && m.creature).map((m) => {
    const brutes = statsDuMembre(m);
    const stats = marge === 1 ? brutes : { ...brutes, hp: brutes.hp * marge, attack: brutes.attack * marge };
    const skills = m.creature.skills || [];
    return {
      creature: m.creature,
      stats,
      meilleure: skills.filter((k) => !k.special).sort((a, b) => b.damage - a.damage)[0] || null,
      speciale: skills.find((k) => k.special) || null,
      taps: effectiveTapCount(stats.clickSpeed, stats.tapReductionPct || 0),
    };
  });
}

// ⚠️ REPRODUIT CombatScreen pour ce qui n'est pas partagé (passage sous
// empreinte, voir `auditGardienEmpreinte`) : rotation à chaque tour vers
// la créature vivante suivante (+MANA_PER_TURN à celle qui entre),
// spéciale à mana pleine sinon la meilleure compétence, 50 % de chances
// que le Gardien frappe en premier, pas de riposte le tour où il se
// relève. Renvoie true si le JOUEUR gagne.
function simulerPrepares(prepares, gStats, tapsParSec, alea) {
  const f = prepares.map((p) => ({ ...p, hp: p.stats.hp, mana: 0, resilienceUsed: false }));
  if (!f.length) return false;
  let g = { hp: gStats.hp, shield: Math.round(gStats.hp * GUARDIAN_SHIELD_RATIO), phase: 1, maxHp: gStats.hp };
  const suivante = (i) => {
    for (let k = 1; k <= f.length; k++) { const j = (i + k) % f.length; if (f[j].hp > 0) return j; }
    return -1;
  };
  const subir = (cible) => {
    riposteGardien(gStats, f, cible, alea).degats.forEach((d, i) => { if (d > 0) Object.assign(f[i], encaisser(f[i], d)); });
  };
  let act = 0;
  f[0].mana = Math.min(MANA_MAX, MANA_PER_TURN);
  if (alea() < 0.5) {
    subir(act);
    if (f[act].hp <= 0) { act = suivante(act); if (act < 0) return false; }
  }
  for (let tour = 0; tour < 500; tour++) {
    const x = f[act];
    const spe = x.speciale && x.mana >= MANA_MAX ? x.speciale : null;
    const comp = spe || x.meilleure;
    if (!comp) return false;
    if (spe) x.mana -= spe.manaCost || MANA_MAX;
    g = coupSurGardien(g, degatsDuJoueur(comp, x, GUARDIAN_CREATURE, x.taps / tapsParSec, true));
    if (g.releve) continue;
    if (g.hp <= 0) return true;
    subir(act);
    const nx = suivante(act);
    if (nx < 0) return false;
    act = nx;
    f[act].mana = Math.min(MANA_MAX, f[act].mana + MANA_PER_TURN);
  }
  return false;
}

export function simulerCombatGardien(membres, gStats,
  { tapsParSec = PUISSANCE_TAPS_PAR_SEC, alea = Math.random, marge = 1 } = {}) {
  return simulerPrepares(preparerCombattants(membres, marge), gStats, tapsParSec, alea);
}

export function guardianStatsScaled(base, k) {
  return { ...base, hp: Math.max(1, Math.round(base.hp * k)), attack: Math.max(1, base.attack * k) };
}

// Le facteur à appliquer aux stats de niveau du Gardien pour qu'il gagne
// GUARDIAN_WIN_TARGET des combats contre CE deck. Départ : le Gardien à
// puissance égale ; puis dichotomie logarithmique sur le correctif de
// son ATTAQUE seule, avec les MÊMES tirages à chaque essai (graine du
// deck) : réponse stable et reproductible.
// ⚠️ MESURÉ : corriger PV et attaque ensemble laissait des decks entre 3
// et 60 % — des PV en plus ajoutent UN TOUR ENTIER au combat d'un coup,
// le taux saute. Les PV restent ceux de la formule ; l'attaque varie en
// continu. 400 combats : 150 laissaient ±10 points.
export function calibrerGardien(membres, baseStats,
  { essais = 400, cible = GUARDIAN_WIN_TARGET, marge = GUARDIAN_POWER_MARGIN } = {}) {
  const n = (membres || []).filter((m) => m && m.creature).length || 1;
  const p0 = puissanceGardien(baseStats, n);
  const depart = p0 > 0 ? puissanceDeck(membres) * marge / p0 : 1;
  const graine = graineDuDeck(membres);
  const prepares = preparerCombattants(membres, marge);
  const tauxGardien = (c) => {
    const st = { ...guardianStatsScaled(baseStats, depart), attack: Math.max(1, baseStats.attack * depart * c) };
    const alea = aleaGraine(graine);
    let g = 0;
    for (let i = 0; i < essais; i++) if (!simulerPrepares(prepares, st, PUISSANCE_TAPS_PAR_SEC, alea)) g++;
    return g / essais;
  };
  let lo = Math.log(GUARDIAN_CORRECTION_MIN), hi = Math.log(GUARDIAN_CORRECTION_MAX);
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (tauxGardien(Math.exp(mid)) > cible) hi = mid; else lo = mid;
  }
  // ⚠️ `lo`, pas le milieu : le plus fort réglage MESURÉ sous la cible.
  // Aux bas niveaux, les coups valent 2 ou 3 PV : le taux avance par
  // paliers, et le milieu tombait sur le palier du dessus (Gardien à
  // 50-57 % contre des communes niveau 1). En cas de palier, le côté
  // facile.
  const correction = Math.exp(lo);
  return { facteurPv: depart, facteurAttaque: depart * correction, correction };
}

// Les stats de combat du Gardien pour un calibrage donné.
export function guardianStatsCalibrees(baseStats, { facteurPv, facteurAttaque }) {
  return { ...baseStats, hp: Math.max(1, Math.round(baseStats.hp * facteurPv)),
    attack: Math.max(1, baseStats.attack * facteurAttaque) };
}

// Pour le JEU : jamais d'exception. En cas d'échec, facteur 1 = l'ancien
// Gardien (stats de niveau).
export function calibrageGardienSur(membres, baseStats) {
  const ancien = { facteurPv: 1, facteurAttaque: 1 };
  try {
    const r = calibrerGardien(membres, baseStats);
    const ok = [r.facteurPv, r.facteurAttaque].every((x) => Number.isFinite(x) && x > 0);
    return ok ? { facteurPv: r.facteurPv, facteurAttaque: r.facteurAttaque } : ancien;
  } catch (e) {
    return ancien;
  }
}

export const GUARDIAN_CREATURE = {
  id: 'gardien',
  element: 'Lumière',
  rarity: 'epique',
  combatType: 'defenseur',
  baseHp: 90,
  baseAttack: 12,
  baseClickSpeed: 1.4,
  baseEndurance: 130,
  // Écrites à plat : `mkSkills` est PRIVÉE à clickerLogic. L'exporter
  // juste pour ici élargirait sa surface publique sans raison ; le
  // format produit est simplement reproduit à l'identique
  // (id / name / damage / enduranceCost).
  skills: [
    { id: 's1', name: 'Griffe du Gardien', damage: 8, enduranceCost: 5 },
    { id: 's2', name: 'Rugissement', damage: 11, enduranceCost: 10 },
    { id: 's3', name: 'Garde Dorée', damage: 15, enduranceCost: 15 },
    { id: 's4', name: 'Jugement du Tigre', damage: 22, enduranceCost: 25 },
  ],
  lore: "Nul ne franchit le seuil d'un œuf sans l'avoir affronté.",
  // Combat en DEUX MANCHES avec bouclier (14/09).
  //
  // Le combat durait 3 tours et ne coûtait que 9 % des PV du joueur —
  // expédié. Objectif : l'allonger SANS le rendre punitif.
  //
  // Les dégâts entament d'abord le bouclier, puis les PV. La manche 1
  // s'arrête quand le gardien a perdu la moitié de ses PV ; la manche 2
  // lui rend TOUT (PV et bouclier) et doit aller jusqu'à zéro.
  //
  // Total à entamer = 2 × bouclier + 1,5 × PV.
  //
  // Bouclier à 40 % des PV, valeur CHOISIE PAR MESURE : le combat passe
  // de 3 à 6 tours et de 9 % à 22 % des PV encaissés, sans toucher à
  // l'attaque du gardien. À 25 % c'était encore trop court (5 tours), à
  // 60 % on dépassait la fourchette visée.
  boss: true,
  stages: [{ name: 'Gardien', emoji: '🐯' }],
};

export function opponentTeamForLevel(levelNumber) {
  const size = opponentTeamSize(levelNumber);
  const team = [];
  for (let i = 0; i < size; i++) {
    const idx = (levelNumber - 1 + i * 9) % CREATURES_BY_POWER.length;
    team.push(CREATURES_BY_POWER[idx]);
  }
  return team;
}

// Qui attaque en premier — 1 chance sur 2 que ce soit l'adversaire,
// comme demandé. Fonction séparée (plutôt qu'un Math.random() en ligne
// dans l'écran) pour rester testable.
export function opponentGoesFirst() {
  return Math.random() < 0.5;
}

// Stats de l'adversaire pour un niveau donné — grossissent avec le
// numéro de niveau (pas avec un "niveau nourri" comme le joueur, ça n'a
// pas de sens pour une IA). Croissance volontairement un peu plus
// marquée que celle du joueur pour garder un vrai défi à mesure qu'on
// monte les chapitres.
// Stats d'une créature adverse ARBITRAIRE à un niveau donné — extrait de
// opponentStatsForLevel pour pouvoir calculer les stats de PLUSIEURS
// adversaires différents au même niveau (équipe adverse à partir du
// chapitre 2), pas seulement l'unique adversaire renvoyé par
// opponentForLevel. opponentStatsForLevel devient un simple cas
// particulier de cette fonction plus générale.
// Budget de puissance (PV+ATQ combinés) PUR par niveau — indépendant de
// la créature précisément piochée à ce niveau. Sans ça (ancienne
// version : dégâts dérivés directement des stats de base de la
// créature), la difficulté pouvait RECULER : le cycle des 26 créatures
// repart du début après le niveau 26, et si une créature "faible" (PV+ATQ
// de base ~13) réapparaît à un niveau élevé, sa croissance par niveau ne
// suffit pas toujours à dépasser une créature "forte" (~220) apparue à un
// niveau plus bas — repéré par un vrai test (niveau 70 plus faible que
// niveau 60). Calibré pour retomber presque exactement sur les stats
// réelles de Solarion/Solstral aux niveaux où ils apparaissaient déjà,
// donc aucun changement perceptible en tout début de partie.
// Base DOUBLÉE le 07/09 (13 -> 26), sur retour de test « mode Aventure
// trop facile au début » — et confirmé par mesure : avant ce changement,
// l'équipe du joueur était 2 à 4 fois plus puissante que l'adversaire à
// TOUS les niveaux jusqu'au 30 (ratio adverse/joueur mesuré entre 0,22 et
// 0,51). Le facteur 2 ramène ce ratio autour de 0,45-1,0, donc des
// combats réellement disputés sans jamais devenir infaisables.
//
// La croissance (1,062/niveau) est inchangée : le déséquilibre était sur
// le NIVEAU de départ, pas sur la pente.
// Rééquilibrage PvE du 14/09 — voir CLICKER_ADVENTURE_STATE.md.
//
// La courbe suit désormais EXACTEMENT celle du joueur (`levelMultiplier`),
// décalée de 3 niveaux : l'économie permet de financer une créature au
// niveau de l'étape +3 à +5 (mesuré). Le rapport de puissance reste donc
// constant par construction, et le ralentissement après le niveau 50 est
// hérité sans avoir à l'écrire deux fois.
//
// L'ancienne courbe (26 × 1,062^n) était EXPONENTIELLE alors que le
// joueur progresse LINÉAIREMENT : au niveau 40 l'adversaire avait pris
// un facteur 2,4 d'avance.
//
// Base 44 choisie par simulation : au-delà (50, 56, 62) une équipe
// faible qui ne monte pas ses créatures descend à 46-93% de victoires.
function opponentPowerBudget(levelNumber) {
  return 44 * levelMultiplier(levelNumber + 3);
}

// Budget PAR MEMBRE de l'équipe adverse — le budget ci-dessus reste la
// courbe totale voulue pour l'équipe adverse à ce niveau (celle calibrée
// à l'origine pour un seul adversaire, chapitre 1). Sans division, passer
// à 2 puis 3 adversaires (chapitres 2 et 3) MULTIPLIAIT la puissance
// totale par la taille d'équipe en plus de la courbe déjà croissante —
// ratio puissance adverse/joueur mesuré : 1,0 aux niveaux 1-10, un saut à
// 2,3 au niveau 15 rien qu'à l'arrivée du 2e adversaire, 4,9 au niveau 25
// et 8,6 au niveau 40 avec le 3e. Diviser par la taille d'équipe courante
// restaure la courbe totale d'origine : plus d'adversaires = plus de
// cibles et de tours à jouer (vraie difficulté tactique), mais sans
// spike de puissance brute à l'entrée de chaque chapitre.
// ⚠️ Division par la RACINE de la taille d'équipe, pas par la taille.
// Diviser par la taille entière faisait du CHAPITRE 1 le pic de
// difficulté du jeu : le niveau 11 (2 adversaires) était DEUX FOIS plus
// facile que le niveau 10 (mesuré : 45 de budget par adversaire au
// niveau 10, 24 au niveau 11). L'exposant 0,3 ramène ce recul à 15%,
// tout en évitant que la puissance TOTALE double d'un coup à l'entrée
// d'un chapitre.
function opponentPowerBudgetPerMember(levelNumber) {
  return opponentPowerBudget(levelNumber) / Math.pow(opponentTeamSize(levelNumber), 0.3);
}

// Multiplicateur d'attaque des adversaires. Ne touche QUE l'attaque :
// les PV restent pilotés par le budget de puissance.
// Relevé à 5,0 (12/09, second passage — était 1,5 puis 2,5) : à 1,5 les adversaires ne faisaient
// toujours quasi aucun dégât. La cause principale était ailleurs (ils ne
// ripostaient que s'ils survivaient, voir CombatScreen), mais même
// corrigée, leurs coups restaient trop faibles face aux PV du joueur.
// ---- Affinités élémentaires (12/09) ----
//
// Les 26 créatures avaient déjà un `element` (Feu, Eau, Air, Terre,
// Foudre, Lumière, Magie, Ténèbres) qui n'était utilisé NULLE PART en
// combat. Le coût de conception était payé, il ne rapportait rien.
//
// Cycle à 5 : Feu > Air > Terre > Foudre > Eau > Feu.
// Lumière et Ténèbres se dominent MUTUELLEMENT (aucun des deux n'est
// avantagé par défaut, ils se contrent l'un l'autre).
// Magie est neutre : ni avantage ni faiblesse, dans les deux sens.
const ELEMENT_BEATS = {
  Feu: ['Air'],
  Air: ['Terre'],
  Terre: ['Foudre'],
  Foudre: ['Eau'],
  Eau: ['Feu'],
  'Lumière': ['Ténèbres'],
  'Ténèbres': ['Lumière'],
  Magie: [],
};

export const ELEMENT_ADVANTAGE_MULT = 1.3;   // +30%, calé sur la référence
export const ELEMENT_WEAKNESS_MULT = 0.75;   // -25%

// Multiplicateur de dégâts de `attackerElement` contre `defenderElement`.
// Renvoie 1 si l'un des deux manque ou est neutre — jamais d'erreur sur
// une créature dont l'élément ne serait pas renseigné.
// `affinityBonus` vient des Runes d'Affinité de l'attaquant (0 par
// défaut : un appel sans rune se comporte exactement comme avant). Il ne
// s'applique QUE sur l'avantage — être fort contre un élément devient
// plus payant, mais une faiblesse reste une faiblesse.
export function elementMultiplier(attackerElement, defenderElement, affinityBonus = 0) {
  if (!attackerElement || !defenderElement) return 1;
  if ((ELEMENT_BEATS[attackerElement] || []).includes(defenderElement)) {
    return ELEMENT_ADVANTAGE_MULT + Math.max(0, affinityBonus);
  }
  if ((ELEMENT_BEATS[defenderElement] || []).includes(attackerElement)) return ELEMENT_WEAKNESS_MULT;
  return 1;
}

export function elementRelation(attackerElement, defenderElement) {
  const m = elementMultiplier(attackerElement, defenderElement);
  if (m > 1) return 'fort';
  if (m < 1) return 'faible';
  return 'neutre';
}

// ---- Notation en étoiles (12/09) ----
//
// Principe repris des jeux du genre (Summoners War, AFK Arena...) : les
// étoiles ne récompensent pas la victoire elle-même, mais la MANIÈRE.
// Chaque palier ajoute une contrainte de plus en plus exigeante :
//
//   1 ★ = gagner. Toujours acquis dès que le niveau est passé.
//   2 ★ = gagner SANS PERDRE une seule créature. Récompense la
//         préparation : bon deck, bonnes affinités élémentaires.
//   3 ★ = gagner sans perte ET VITE. Récompense l'efficacité : frapper
//         les faiblesses plutôt que d'user l'adversaire.
//
// Le seuil de rapidité dépend du NOMBRE d'adversaires, sinon un niveau
// à 3 ennemis serait mécaniquement plus dur à noter qu'un niveau à 1.
// Assoupli de `2n+1` à `2n+2` le 14/09 : 3 étoiles étaient trop dures.
//
// Mesuré sur 9 niveaux, par profil de joueur :
//   2n+1 : rapide AVEC avantage élémentaire 9/9, mais rapide SEUL 4/9 —
//          il fallait les DEUX, d'où la frustration.
//   2n+2 : rapide seul 8/9, joueur moyen 8/9, LENT 4/9.
//   2n+3 : lent 8/9 — l'étoile ne se mérite plus.
// `2n+2` récompense donc jouer vite OU avec l'avantage, sans exiger les
// deux, tout en restant hors de portée d'un jeu approximatif.
export function maxRoundsForThreeStars(opponentCount) {
  return 2 * Math.max(1, opponentCount) + 2;
}

export function starsForBattle(stats, opponentCount) {
  if (!stats) return 1;
  let stars = 1;
  if ((stats.fightersFainted || 0) === 0) stars = 2;
  if (stars === 2 && (stats.rounds || 0) <= maxRoundsForThreeStars(opponentCount)) stars = 3;
  return stars;
}

// ⚠️ RAMENÉ DE 5,0 À 0,3 le 14/09. C'était la cause du blocage signalé
// (« les créatures adverses tuent mes monstres en un coup »).
//
// Les dégâts adverses ne sortent PAS directement de cette stat : ils
// valent `dégâts de la compétence × (ATQ actuelle / ATQ de base)`. Avec
// le multiplicateur à 5, ce rapport atteignait 8 à 12, et les
// compétences frappaient à 49/65/98/147 contre 38 PV au niveau 9 —
// chaque coup tuait. Conséquence : 2 étoiles (gagner SANS perdre de
// créature) devenait mécaniquement impossible, donc pas de progression.
//
// Le 5,0 avait été posé pour corriger « les adversaires ne font aucun
// dégât », mais la vraie cause était un bug de riposte (corrigé depuis,
// voir CombatScreen) ; le multiplicateur, lui, était resté.
//
// Mesuré après changement : 2,1 à 7,8 coups encaissés selon le niveau,
// plus aucun one-shot, et l'autoclicker ne fait plus gagner que ~0,4
// tour — l'équilibrage ne repose plus sur lui.
export const OPPONENT_ATTACK_MULT = 0.3;

export function statsForOpponentCreature(creature, levelNumber) {
  const base = creature.baseHp != null
    ? { hp: creature.baseHp, attack: creature.baseAttack, clickSpeed: creature.baseClickSpeed, endurance: creature.baseEndurance }
    : RARITY_BASE_STATS[creature.rarity];
  const growth = 1 + (levelNumber - 1) * 0.15;

  // PV/ATQ viennent du budget de puissance PUR (garantit une croissance
  // strictement monotone), réparti selon le PROFIL propre de la
  // créature (une créature à dominante PV dans son propre roster reste
  // relativement plus "tanky" qu'ATQ une fois remise à l'échelle) —
  // garde la saveur de chaque créature sans dépendre de sa magnitude
  // absolue, qui variait trop d'une créature à l'autre pour rester
  // cohérente une fois le cycle des 26 créatures repris depuis le début.
  const budget = opponentPowerBudgetPerMember(levelNumber);
  const hpRatio = base.hp / Math.max(1, base.hp + base.attack);

  return {
    hp: Math.max(1, Math.round(budget * hpRatio)),
    // ATQ relevée de 50% (12/09, demande de l'utilisateur). Appliquée
    // ICI et non sur le budget : relever le budget aurait aussi gonflé
    // les PV, allongeant les combats au lieu de les rendre plus mordants.
    attack: Math.max(1, Math.round(budget * (1 - hpRatio) * OPPONENT_ATTACK_MULT)),
    // Voir combatStatsForCreature : toujours dérivée de la rareté, jamais
    // de la valeur Gemini (systématiquement 1, donc plate/inutile).
    clickSpeed: RARITY_BASE_STATS[creature.rarity].clickSpeed,
    endurance: Math.round(base.endurance * growth),
  };
}

// Cas particulier : stats de l'UNIQUE adversaire renvoyé par
// opponentForLevel (gardé pour compatibilité, les niveaux à équipe
// adverse multiple utilisent statsForOpponentCreature directement).
export function opponentStatsForLevel(levelNumber) {
  return statsForOpponentCreature(opponentForLevel(levelNumber), levelNumber);
}

// Version typée (avec modificateur de rôle) pour une créature adverse
// arbitraire — même règle que côté joueur : pas de multiplicateur de
// type pour les créatures Gemini (déjà pris en compte par Gemini lui-même).
export function statsForOpponentCreatureTyped(creature, levelNumber) {
  const base = statsForOpponentCreature(creature, levelNumber);
  const typeMod = creature.baseHp != null ? { hpMult: 1, attackMult: 1 } : (MONSTER_TYPES[creature.combatType] || MONSTER_TYPES.attaquant);
  return {
    hp: Math.round(base.hp * typeMod.hpMult),
    attack: Math.round(base.attack * typeMod.attackMult),
    clickSpeed: base.clickSpeed,
    endurance: base.endurance,
  };
}

// ---- Défi de tap (attaque du joueur) ----
// 25 pour l'instant (au lieu de 50) — demande explicite pour la phase de
// développement, plus rapide à tester en boucle. À remonter à 50 si
// besoin une fois l'équilibrage validé.
export const TAP_CHALLENGE_COUNT = 25;
export const TAP_CHALLENGE_TIME_LIMIT_SEC = 12; // fenêtre pour compléter les 50 taps
export const TAP_CHALLENGE_FAST_THRESHOLD_SEC = 4; // en dessous = multiplicateur max
export const TAP_CHALLENGE_MIN_MULTIPLIER = 1; // complété mais lentement
export const TAP_CHALLENGE_MAX_MULTIPLIER = 2.5; // complété très vite
export const TAP_CHALLENGE_INCOMPLETE_MULTIPLIER = 0.5; // pas fini à temps, attaque affaiblie

// Nombre de taps RÉELLEMENT requis pour la créature active, réduit selon
// sa vitesse de clic (1,0 à 2,8 selon la rareté) — "réduit le temps réel
// nécessaire" comme demandé : moins de taps à faire = fini plus vite en
// temps réel, PAS une fenêtre de temps raccourcie (qui deviendrait vite
// physiquement impossible à haute vitesse). Plancher à 10 taps pour que
// le mini-jeu garde un minimum de sens même pour un Mythique (2,8 → 9
// arrondi, mais plafonné à 10) — pas de créature "quasi gratuite".
// Plancher abaissé de 10 à 6 : avec la Dextérité au niveau 5 (-60%), un
// Mythique tombait sinon systématiquement sur le plancher et la rune
// n'avait plus aucun effet visible sur les créatures rapides.
export const TAP_CHALLENGE_MIN_COUNT = 6;
// `tapReductionPct` vient des Runes de Dextérité équipées (0 par défaut,
// donc un appel sans rune se comporte exactement comme avant). Le
// plancher de 10 taps s'applique APRÈS la réduction : une créature très
// rapide bardée de runes ne peut pas descendre en dessous.
export function effectiveTapCount(clickSpeed, tapReductionPct = 0) {
  const base = Math.round(TAP_CHALLENGE_COUNT / clickSpeed);
  const reduced = Math.round(base * (1 - Math.max(0, Math.min(0.8, tapReductionPct))));
  return Math.max(TAP_CHALLENGE_MIN_COUNT, reduced);
}

// Multiplicateur de dégâts selon le temps mis pour les 50 taps.
// - Pas complété dans le temps imparti -> multiplicateur réduit fixe
//   (l'attaque part quand même, juste affaiblie, jamais annulée).
// - Complété en moins de TAP_CHALLENGE_FAST_THRESHOLD_SEC -> multiplicateur max.
// - Complété pile à la limite -> multiplicateur min.
// - Entre les deux -> interpolation linéaire.
export function damageMultiplierForTime(elapsedSec, completed) {
  if (!completed) return TAP_CHALLENGE_INCOMPLETE_MULTIPLIER;
  if (elapsedSec <= TAP_CHALLENGE_FAST_THRESHOLD_SEC) return TAP_CHALLENGE_MAX_MULTIPLIER;
  if (elapsedSec >= TAP_CHALLENGE_TIME_LIMIT_SEC) return TAP_CHALLENGE_MIN_MULTIPLIER;
  const t =
    (elapsedSec - TAP_CHALLENGE_FAST_THRESHOLD_SEC) /
    (TAP_CHALLENGE_TIME_LIMIT_SEC - TAP_CHALLENGE_FAST_THRESHOLD_SEC);
  return TAP_CHALLENGE_MAX_MULTIPLIER - t * (TAP_CHALLENGE_MAX_MULTIPLIER - TAP_CHALLENGE_MIN_MULTIPLIER);
}

// ---- Mise à l'échelle des dégâts par la stat ATQ (30/08) ----
// Chaque compétence a ses propres dégâts fixes (donnés par Gemini), mais
// ils doivent grandir avec le niveau et l'évolution de la créature —
// sinon nourrir/faire évoluer une créature n'a AUCUN effet sur ses
// dégâts réels en combat (seule l'attaque de base gratuite utilisait
// l'ATQ jusqu'ici). Le ratio ATQ actuel / ATQ de base sert de facteur
// d'échelle appliqué à CHAQUE compétence, en plus (pas à la place) du
// multiplicateur de vitesse de tap déjà existant.
//
// Stable par construction : au niveau 1 sans évolution, ratio = 1 →
// comportement identique à avant ce changement pour toute créature
// existante. Le ratio grandit ensuite avec `levelMultiplier` (déjà
// plafonné à rendements décroissants après le niveau 50) et le
// multiplicateur d'évolution — aucune nouvelle courbe à équilibrer,
// on réutilise les garde-fous déjà en place.
export function baseAttackFor(creature) {
  return creature.baseAttack != null ? creature.baseAttack : RARITY_BASE_STATS[creature.rarity].attack;
}

export function attackRatio(creature, currentAttack) {
  const base = baseAttackFor(creature);
  return base > 0 ? currentAttack / base : 1;
}

// Dégâts d'une compétence, mis à l'échelle par le ratio ATQ actuel/ATQ de
// base — à appliquer sur les VRAIES compétences (skill.damage), jamais
// sur l'attaque de base gratuite (déjà dérivée directement de l'ATQ
// actuel, l'appliquer ici la compterait deux fois).
// +10 % de dégâts pour TOUT LE MONDE (15/09), joueur comme adversaires.
//
// ⚠️ Appliqué ICI, dans la fonction commune, et pas des deux côtés
// séparément : les deux camps passent par `scaledSkillDamage`, donc un
// seul point de modification garantit qu'aucun des deux n'est oublié.
//
// ⚠️ Un bonus IDENTIQUE des deux côtés ne change PAS l'issue des
// combats : il raccourcit les échanges d'environ 9 %, sans toucher à
// l'équilibre. L'équilibrage mesuré (ratio adverse/joueur, nombre de
// tours, étoiles) reste donc valable.
export const GLOBAL_DAMAGE_BOOST = 1.10;

export function scaledSkillDamage(skill, creature, currentAttack) {
  return skill.damage * attackRatio(creature, currentAttack) * GLOBAL_DAMAGE_BOOST;
}

// ---- Résolution d'un tour ----
export function computePlayerDamage(attackerAttack, multiplier) {
  return Math.max(1, Math.round(attackerAttack * multiplier));
}

// Un tour complet : le joueur attaque (dégâts déjà calculés en amont via
// computePlayerDamage), puis si l'adversaire survit, il riposte
// automatiquement. Retourne les nouveaux PV des deux côtés + l'issue.
export function resolveRound(playerHp, opponentHp, opponentAttack, playerDamage) {
  const newOpponentHp = Math.max(0, opponentHp - playerDamage);
  if (newOpponentHp <= 0) {
    return { playerHp, opponentHp: 0, dmgToOpponent: playerDamage, dmgToPlayer: 0, outcome: 'win' };
  }
  const dmgToPlayer = Math.max(1, Math.round(opponentAttack));
  const newPlayerHp = Math.max(0, playerHp - dmgToPlayer);
  return {
    playerHp: newPlayerHp,
    opponentHp: newOpponentHp,
    dmgToOpponent: playerDamage,
    dmgToPlayer,
    outcome: newPlayerHp <= 0 ? 'lose' : 'ongoing',
  };
}

// ---- Récompense (ressource "Griffes", nom provisoire) ----
export function griffesReward(levelNumber) {
  return 5 + Math.floor(levelNumber * 1.5);
}

// ---- Énergie (30/08) — 1 vie toutes les 20 min, plafond à 5 ----
// Coûte 1 énergie pour LANCER un combat (pas remboursé en cas de
// défaite — c'est bien "1 vie par tentative", pas "1 vie par victoire").
export const ENERGY_MAX = 5;
export const ENERGY_REGEN_MS = 20 * 60 * 1000; // 20 minutes

// Recalcule l'énergie actuelle à partir du dernier timestamp connu — le
// même principe que les gains hors-ligne du clicker (temps écoulé /
// intervalle = nombre de "ticks"), mais plafonné à ENERGY_MAX.
//
// Point important : si le plafond est atteint, `lastUpdateAt` est
// RESYNCHRONISÉ sur `now` plutôt que de garder un vieux timestamp avec
// un surplus de temps "non consommé" — sinon, dès que le joueur dépense
// à nouveau de l'énergie, ce surplus se traduirait par un remplissage
// instantané injustifié (l'énergie doit recommencer à compter 20 min
// PLEINES à partir du moment où elle redescend sous le plafond, pas
// bénéficier d'un arriéré accumulé pendant qu'elle était déjà pleine).
export function computeEnergyRegen(storedEnergy, lastUpdateAt, now) {
  if (storedEnergy >= ENERGY_MAX) return { energy: ENERGY_MAX, lastUpdateAt: now };
  const elapsed = now - lastUpdateAt;
  const ticks = Math.floor(elapsed / ENERGY_REGEN_MS);
  if (ticks <= 0) return { energy: storedEnergy, lastUpdateAt };
  const newEnergy = Math.min(ENERGY_MAX, storedEnergy + ticks);
  if (newEnergy >= ENERGY_MAX) return { energy: ENERGY_MAX, lastUpdateAt: now };
  return { energy: newEnergy, lastUpdateAt: lastUpdateAt + ticks * ENERGY_REGEN_MS };
}

// Millisecondes avant le PROCHAIN point d'énergie (0 si déjà plein).
export function msUntilNextEnergy(storedEnergy, lastUpdateAt, now) {
  if (storedEnergy >= ENERGY_MAX) return 0;
  const elapsed = now - lastUpdateAt;
  const remainder = elapsed % ENERGY_REGEN_MS;
  return ENERGY_REGEN_MS - remainder;
}

// ---- Évolution par palier (créatures au format Gemini, SANS changement
// de nom — contrairement aux 10 créatures d'origine qui ont 3 noms/
// dessins distincts par stade). Contrairement au niveau (qui monte en
// nourrissant avec des pièces), l'évolution est un choix DÉLIBÉRÉ du
// joueur, débloqué par le niveau ET payé en Griffes gagnées au combat
// (et plus tard via certaines quêtes) — pas automatique.
export const EVOLUTION_LEVEL_REQUIREMENT = [0, 25, 50]; // niveau requis pour le palier 1, 2
export const EVOLUTION_STAT_MULTIPLIER = [1.0, 1.3, 1.7]; // boost de PV/ATQ/Endurance par palier
// Coût en Griffes pour débloquer un palier d'évolution. Nettement
// relevé (40/100 -> 150/400) depuis que les NIVEAUX se paient eux aussi
// en Griffes : un palier doit rester un vrai jalon face au coût cumulé
// des niveaux qui y mènent, sinon il tombe tout seul en chemin.
export const EVOLUTION_GRIFFES_COST = [0, 150, 400];

export function canEvolve(currentTier, ownedLevel) {
  const nextTier = currentTier + 1;
  if (nextTier > 2) return false;
  return ownedLevel >= EVOLUTION_LEVEL_REQUIREMENT[nextTier];
}
export function evolutionCost(currentTier) {
  const nextTier = currentTier + 1;
  return nextTier > 2 ? null : EVOLUTION_GRIFFES_COST[nextTier];
}

// ---- Type de monstre (Attaquant / Soutien / Tank) ----
// Chaque créature a maintenant, en plus de sa rareté, un TYPE de combat
// qui modifie ses stats de base : le Tank encaisse plus mais frappe
// moins fort, l'Attaquant l'inverse, le Soutien reste équilibré (sa
// valeur est censée venir de ses compétences, pas de stats brutes).
export const MONSTER_TYPES = {
  attaquant: { label: 'Attaquant', hpMult: 0.8, attackMult: 1.3 },
  soutien: { label: 'Soutien', hpMult: 1.0, attackMult: 0.95 },
  tank: { label: 'Tank', hpMult: 1.4, attackMult: 0.75 },
};

// Version de combatStatsForCreature qui applique EN PLUS le modificateur
// du type — remplace l'ancienne fonction dans les nouveaux usages (le
// choix du type se fait maintenant par créature, pas par rareté seule).
// ---- Runes (30/08) — table validée avec l'utilisateur avant implémentation ----
// 4 types, 5 paliers chacun, progression à rendements légèrement
// décroissants (même logique que le plafond de croissance de l'ATQ par
// niveau) pour qu'un palier 5 reste fort sans devenir abusé.
export const RUNE_BONUS_TABLE = {
  force: [0.04, 0.08, 0.13, 0.19, 0.27], // % bonus ATQ
  vitalite: [0.05, 0.10, 0.16, 0.23, 0.32], // % bonus PV
  // L'Endurance a été REMPLACÉE par le mana le 11/09 : la rune qui la
  // boostait ne servait plus à rien. Remplacée par la Dextérité, qui
  // retire un % des taps exigés par le défi de combat.
  dexterite: [0.12, 0.24, 0.36, 0.48, 0.60], // % de taps en MOINS sur le défi
  celerite: [0.10, 0.20, 0.35, 0.50, 0.70], // bonus ADDITIF sur le multiplicateur de dégâts (x2,5 de base)
  // --- 12/09 : 3 runes ajoutées pour sortir du "tout offensif" ---
  // Affinité : s'ajoute au multiplicateur d'AVANTAGE élémentaire (1,30
  // de base). Ne touche PAS la pénalité de faiblesse — c'est une rune
  // offensive qui récompense la composition du deck, pas une défense.
  // Valeurs hautes assumées : elle ne sert que sur une partie des
  // échanges, contrairement à Force qui vaut à chaque coup.
  affinite: [0.08, 0.16, 0.25, 0.35, 0.45],
  // Butin : % de Griffes en plus à la victoire. Aucune incidence sur le
  // combat lui-même, donc elle peut être généreuse sans déséquilibrer.
  butin: [0.08, 0.16, 0.25, 0.35, 0.45],
  // Résilience : survit UNE fois par combat à un coup fatal, et repart
  // avec ce % de ses PV max. Déterministe exprès — une chance de
  // déclenchement aléatoire se vit comme une injustice quand elle rate.
  resilience: [0.06, 0.10, 0.15, 0.22, 0.30],
};

// Plafonds de cumul. Les 3 créatures du deck ont 3 emplacements chacune,
// soit 9 runes possibles : sans plafond, 9 Butin niveau 5 donneraient
// +405% de Griffes et 9 Résilience feraient repartir à pleins PV.
export const BUTIN_MAX_BONUS = 1.0;       // +100% de Griffes au maximum
export const RESILIENCE_MAX_PCT = 0.5;    // renaissance à 50% des PV au maximum

// Additionne les bonus de TOUTES les runes équipées (jusqu'à 3) sur une
// créature — plusieurs runes du même type s'additionnent simplement
// entre elles (pas de rendements décroissants supplémentaires entre
// runes, seulement au sein de la progression de palier d'UNE rune).
export function runeBonuses(equippedRunes) {
  const totals = {
    atkPct: 0, hpPct: 0, tapReductionPct: 0, dmgMultBonus: 0,
    affinityBonus: 0, butinPct: 0, resiliencePct: 0,
  };
  (equippedRunes || []).forEach((r) => {
    if (!r) return;
    const table = RUNE_BONUS_TABLE[r.type];
    if (!table) return;
    const val = table[Math.max(0, Math.min(4, r.level - 1))];
    if (r.type === 'force') totals.atkPct += val;
    else if (r.type === 'vitalite') totals.hpPct += val;
    else if (r.type === 'dexterite') {
      totals.tapReductionPct += val;
      // Part du bonus qui passe en dégâts. Nécessaire, pas décoratif :
      // au-dessus de 6,25 taps/s le défi est DÉJÀ complété sous le seuil
      // rapide, donc le multiplicateur est à son plafond x2,5 et retirer
      // des taps ne rapporte plus rien (mesuré). `dmgMultBonus` est
      // ajouté APRÈS le plafond dans CombatScreen, c'est donc le seul
      // canal qui reste utile à haute cadence. Coefficient 0,4 : la
      // Célérité (+0,70 au niveau 5) reste la rune de référence sur cet
      // axe, la Dextérité n'y est que secondaire.
      totals.dmgMultBonus += val * 0.4;
    }
    else if (r.type === 'celerite') totals.dmgMultBonus += val;
    else if (r.type === 'affinite') totals.affinityBonus += val;
    else if (r.type === 'butin') totals.butinPct += val;
    else if (r.type === 'resilience') totals.resiliencePct += val;
  });
  return totals;
}

export function combatStatsForCreatureTyped(creature, level, evolutionTier = 0, equippedRunes = []) {
  const base = combatStatsForCreature(creature, level);
  // Le multiplicateur de type ne s'applique QUE pour les créatures qui
  // suivent encore la formule par rareté — les créatures avec des stats
  // Gemini explicites (baseHp défini) ont déjà leur rôle pris en compte
  // par Gemini au moment de choisir les chiffres, l'appliquer ici
  // reviendrait à le compter deux fois.
  const typeMod = creature.baseHp != null ? { hpMult: 1, attackMult: 1 } : (MONSTER_TYPES[creature.combatType] || MONSTER_TYPES.attaquant);
  const evoMult = EVOLUTION_STAT_MULTIPLIER[evolutionTier] || 1;
  // 4e paramètre optionnel, défaut [] — un appel existant sans runes
  // (partout ailleurs dans le code pour l'instant) donne des bonus nuls
  // et reproduit EXACTEMENT le comportement d'avant, aucune régression.
  const bonus = runeBonuses(equippedRunes);
  return {
    hp: Math.round(base.hp * typeMod.hpMult * evoMult * (1 + bonus.hpPct)),
    attack: Math.round(base.attack * typeMod.attackMult * evoMult * (1 + bonus.atkPct)),
    // La vitesse de clic n'est jamais boostée par l'évolution — le défi
    // de tap ne doit pas devenir plus dur à réussir en évoluant, seule
    // la PUISSANCE des attaques doit grandir.
    clickSpeed: base.clickSpeed,
    endurance: Math.round(base.endurance * evoMult),
    // Exposé pour que CombatScreen l'ajoute au plafond du multiplicateur
    // de vitesse de tap (Rune de Célérité) — pas une vraie "stat" au
    // sens PV/ATQ/Endurance, juste transporté avec le reste.
    dmgMultBonus: bonus.dmgMultBonus,
    // Réduction du nombre de taps exigés (Rune de Dextérité). Transporté
    // comme dmgMultBonus : ce n'est pas une stat, CombatScreen l'utilise
    // pour calculer le défi de tap.
    tapReductionPct: bonus.tapReductionPct,
    // Runes du 12/09 — transportées avec les stats, comme dmgMultBonus.
    affinityBonus: bonus.affinityBonus,
    resiliencePct: Math.min(RESILIENCE_MAX_PCT, bonus.resiliencePct),
  };
}

// Bonus de Griffes apporté par TOUTES les runes de Butin du deck.
// Prend la liste à plat des runes équipées sur les 3 créatures.
export function butinBonus(allEquippedRunes) {
  const b = runeBonuses(allEquippedRunes).butinPct;
  return Math.min(BUTIN_MAX_BONUS, b);
}

// Même chose pour l'adversaire IA (stats déjà mises à l'échelle par
// niveau via opponentStatsForLevel, puis modifiées par le type).
export function opponentStatsForLevelTyped(levelNumber) {
  return statsForOpponentCreatureTyped(opponentForLevel(levelNumber), levelNumber);
}

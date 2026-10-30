// 💳 MOMENTS DES OFFRES QUI SURGISSENT (30/10). Proposition de Claude (règles + 7 moments) ; l'auteur a répondu « continue »
// sans trier les moments (le sélecteur ne s'affichait pas) → les 7 moments de la proposition, tels quels.
// ⚠️ Une 1re copie coupée avait écrit « Sans pubs NON retenu » par l'auteur : FAUX, l'auteur n'avait rien retiré — rétabli.
//
// RÈGLES :
//  - 1 offre par jour AU PLUS (jour du téléphone) ;
//  - écran principal seulement, au 1er moment calme : mêmes garde-fous que les mini-jeux (aucune fenêtre, aucun conseil du
//    tuto, pas de défi de continuité, 4 min de répit à l'ouverture) — appliqués par ClickerScreen (minuterie des offres) ;
//  - jamais une offre déjà achetée ou indisponible (`achetable` d'achats.js, passé dans le contexte) ;
//  - « Plus tard » ferme la fenêtre, l'offre reste en boutique ;
//  - plusieurs moments le même jour : le 1er de PRIORITE passe ; les autres attendent le LENDEMAIN s'ils sont encore
//    d'actualité, puis s'effacent ;
//  - ⚠️ PAS DE FAUSSE URGENCE : une minuterie (`finA`) SEULEMENT quand l'offre expire vraiment — l'affaire du jour, à
//    minuit. Un compte à rebours sur une offre qui reste en boutique = pratique commerciale trompeuse (interdite en UE) et
//    risque au contrôle des stores.
//
// MOMENTS (par priorité) :
//  🎁 demarrage : 1re victoire en Exploration → Pack de démarrage (s'ouvre UNE fois en tout ; attend tant qu'il est achetable)
//  🌟 ascension : juste après une Ascension → Pack d'Ascension
//  🐯 gardien   : défaite contre le Gardien → Pack du Gardien (tant qu'un Gardien bloque encore un œuf)
//  🐾 bloque    : 3 défaites de suite sur une même étape → Poignée de Griffes (tant que l'étape n'est pas gagnée) ;
//                 l'offre surgit au retour sur l'écran principal
//  🥚 oeufs     : tous les 3 œufs éclos → Pack de progression
//  🚫 pubs      : 3e pub REGARDÉE dans la journée (écran de pub de 15 s : Tap ×2, poudre — FaussePub) → Sans pubs
//  ⏰ affaire   : aucune autre offre dans la journée, après 15 min de jeu → Affaire du jour (minuterie jusqu'à minuit)
//
// Tout ce qui décide est PUR (testé par auditOffresMoments) ; la mémoire est À PART de la partie (`offres:v1`) : une
// Ascension ne l'efface pas, sinon le plafond d'1 offre par jour et le 🎁 « une seule fois » sauteraient.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLE_OFFRES = 'offres:v1';
export const PRIORITE = ['demarrage', 'ascension', 'gardien', 'bloque', 'oeufs', 'pubs'];
export const PRODUIT_DU_MOMENT = {
  demarrage: 'pack_demarrage', ascension: 'pack_ascension', gardien: 'pack_gardien', bloque: 'griffes_3',
  oeufs: 'pack_progression', pubs: 'sans_pubs', affaire: 'affaire_jour',
};
export const OEUFS_PAR_OFFRE = 3;
export const DEFAITES_BLOQUE = 3;
export const PUBS_PAR_OFFRE = 3; // la 3e pub regardée du jour (pas la 4e, ni les suivantes)
export const AFFAIRE_APRES_SEC = 15 * 60;
// Un moment tout frais prouve que le joueur est là (il vient de perdre, d'ascensionner…) : pas besoin d'attendre un tap.
export const PRESENCE_MOMENT_MS = 2 * 60 * 1000;
// Écart minimum entre une offre et un mini-jeu, dans les deux sens (jamais deux fenêtres qui s'enchaînent).
export const CALME_MINI_JEU_MS = 60 * 1000;
// Le 🎁 n'expire pas : c'est l'offre de bienvenue, elle attend tant qu'elle n'est ni vue ni achetée.
export const MOMENTS_SANS_EXPIRATION = ['demarrage'];

// Jours du TÉLÉPHONE (heure locale).
export function jourDe(t) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function numeroJour(t) { const d = new Date(t); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
export function minuitSuivant(t) { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); }

export const ETAT_OFFRES_VIDE = {
  jourMontre: null,    // jour où une offre a surgi (le plafond)
  attente: {},         // moment → { a: heure, info }
  demarrageNote: false, // le 🎁 s'est ouvert (une seule fois en tout)
  oeufsEclos: 0,       // compteur des éclosions (le 🥚 tous les 3)
  jourPubs: null, pubsDuJour: 0, // pubs regardées dans la journée (le 🚫 à la 3e)
  jourActif: null, secondesActives: 0, // temps de jeu du jour (l'⏰)
  journal: [],         // 30 dernières offres montrées { m, id, a, issue } — données pour la suite
};

// 30/10 (auteur : « ne mets pas "3 vidéos regardées aujourd'hui" ou ce genre de trucs ») : AUCUNE phrase sur ce que le joueur a
// fait (pubs, œufs, défaites, Gardien, Ascension). Seulement ce qui décrit L'OFFRE : bienvenue (une fois) et affaire (minuit).
export function accrocheDuMoment(m) {
  if (m === 'demarrage') return 'Offre de bienvenue · une seule fois';
  if (m === 'affaire') return 'Change à minuit';
  return '';
}

// La présentation d'un moment (pur ; sert aussi au test du menu 🛠️). La minuterie SEULEMENT pour l'affaire du jour.
export function offreDuMoment(m, info = null, t = Date.now(), a = null) {
  return { moment: m, id: PRODUIT_DU_MOMENT[m], info: info || null, a, accroche: accrocheDuMoment(m, info),
    finA: m === 'affaire' ? minuitSuivant(t) : null };
}

// Un moment arrive (pur). Le même moment remplace l'ancien (heure fraîche, nouvelle info). Le 🎁 ne s'ouvre qu'une fois.
export function noterMomentPur(e, m, info = null, t = Date.now()) {
  if (!PRIORITE.includes(m)) return e;
  let n = e;
  if (m === 'demarrage') { if (e.demarrageNote) return e; n = { ...e, demarrageNote: true }; }
  return { ...n, attente: { ...(n.attente || {}), [m]: { a: t, info: info || null } } };
}

// Un œuf éclot (pur) : tous les OEUFS_PAR_OFFRE, le moment 🥚.
export function noterOeufPur(e, t = Date.now()) {
  const n = (e.oeufsEclos || 0) + 1;
  const e2 = { ...e, oeufsEclos: n };
  return n % OEUFS_PAR_OFFRE === 0 ? noterMomentPur(e2, 'oeufs', { oeufs: n }, t) : e2;
}

// Une pub REGARDÉE jusqu'au bout (pur) : compteur du jour, remis à zéro au changement de jour ; à la 3e, le moment 🚫.
export function noterPubPur(e, t = Date.now()) {
  const j = jourDe(t);
  const n = e.jourPubs === j ? (e.pubsDuJour || 0) + 1 : 1;
  const e2 = { ...e, jourPubs: j, pubsDuJour: n };
  return n === PUBS_PAR_OFFRE ? noterMomentPur(e2, 'pubs', { pubs: n }, t) : e2;
}

// Encore d'actualité ? ctx = { gardienBloque: bool, etapeGagnee: (n) => bool, achetable: (id) => bool }.
// Le jour même ou le lendemain (sauf le 🎁) ; le 🐯 tant qu'un Gardien bloque ; le 🐾 tant que l'étape n'est pas gagnée.
export function momentValable(m, entree, ctx, t = Date.now()) {
  if (!entree) return false;
  if (!MOMENTS_SANS_EXPIRATION.includes(m) && numeroJour(t) - numeroJour(entree.a) > 1) return false;
  if (m === 'gardien' && !(ctx && ctx.gardienBloque)) return false;
  if (m === 'bloque' && (!entree.info || !entree.info.etape || (ctx && ctx.etapeGagnee && ctx.etapeGagnee(entree.info.etape)))) return false;
  return true;
}

// L'offre à montrer MAINTENANT (pur) — null si le jour est déjà pris ou si rien n'est d'actualité ni achetable.
export function choisirOffre(e, ctx, t = Date.now()) {
  if (e.jourMontre === jourDe(t)) return null; // 1 offre par jour, pas plus
  const ok = (id) => !!(ctx && ctx.achetable && ctx.achetable(id));
  for (const m of PRIORITE) {
    const entree = (e.attente || {})[m];
    if (momentValable(m, entree, ctx, t) && ok(PRODUIT_DU_MOMENT[m])) return offreDuMoment(m, entree.info, t, entree.a);
  }
  // ⏰ En secours : rien d'autre aujourd'hui, et 15 min de jeu dans la journée.
  if (e.jourActif === jourDe(t) && (e.secondesActives || 0) >= AFFAIRE_APRES_SEC && ok(PRODUIT_DU_MOMENT.affaire)) {
    return offreDuMoment('affaire', null, t, null);
  }
  return null;
}

// L'offre a surgi (pur) : le jour est pris, son moment est consommé, les moments périmés s'effacent, le journal la note.
export function apresAffichagePur(e, choix, ctx, t = Date.now()) {
  const attente = {};
  for (const [m, x] of Object.entries(e.attente || {})) if (m !== choix.moment && momentValable(m, x, ctx, t)) attente[m] = x;
  return { ...e, jourMontre: jourDe(t), attente,
    journal: [...(e.journal || []), { m: choix.moment, id: choix.id, a: t, issue: null }].slice(-30) };
}

// Ce que le joueur en a fait (pur) : 'achat' ou 'ferme', sur la dernière offre montrée.
export function noterIssuePur(e, issue) {
  const j = (e.journal || []).slice();
  if (!j.length || j[j.length - 1].issue) return e;
  j[j.length - 1] = { ...j[j.length - 1], issue };
  return { ...e, journal: j };
}

// Temps de jeu du jour (pur), remis à zéro au changement de jour.
export function compterSecondesPur(e, s, t = Date.now()) {
  const j = jourDe(t);
  return e.jourActif === j ? { ...e, secondesActives: (e.secondesActives || 0) + s } : { ...e, jourActif: j, secondesActives: s };
}

// ── Mémoire (à part de la partie) ──
let etat = { ...ETAT_OFFRES_VIDE };
let charge = false;
let promesse = null;
let derniereSauvegarde = 0;
export function chargerOffres() {
  if (!promesse) {
    promesse = (async () => {
      try { const brut = await AsyncStorage.getItem(CLE_OFFRES); if (brut) etat = { ...ETAT_OFFRES_VIDE, ...JSON.parse(brut) }; } catch (e) { /* état vide */ }
      charge = true;
      return etat;
    })();
  }
  return promesse;
}
function sauver() {
  derniereSauvegarde = Date.now();
  AsyncStorage.setItem(CLE_OFFRES, JSON.stringify(etat)).catch(() => { /* la session garde l'état */ });
}
// ⚠️ Un moment noté AVANT la fin de la lecture serait écrasé par elle : tout attend le chargement.
// (Appelées sans await depuis le jeu : tout est dans un try — une erreur ici ne doit JAMAIS remonter jusqu'au jeu.)
export async function noterMoment(m, info = null) {
  try {
    await chargerOffres();
    const n = noterMomentPur(etat, m, info, Date.now());
    if (n !== etat) { etat = n; sauver(); }
  } catch (e) { /* le moment est perdu, le jeu continue */ }
}
export async function noterOeufEclos() { try { await chargerOffres(); etat = noterOeufPur(etat, Date.now()); sauver(); } catch (e) { /* idem */ } }
export async function noterPubVue() { try { await chargerOffres(); etat = noterPubPur(etat, Date.now()); sauver(); } catch (e) { /* idem */ } }
export function offreAMontrer(ctx, t = Date.now()) { return charge ? choisirOffre(etat, ctx, t) : null; }
export function noterOffreMontree(choix, ctx, t = Date.now()) { if (!charge || !choix) return; etat = apresAffichagePur(etat, choix, ctx, t); sauver(); }
export function noterIssueOffre(issue) { if (!charge) return; const n = noterIssuePur(etat, issue); if (n !== etat) { etat = n; sauver(); } }
export function compterSecondeActive(t = Date.now()) {
  if (!charge) return;
  etat = compterSecondesPur(etat, 1, t);
  if (t - derniereSauvegarde > 30000) sauver();
}
export function etatOffres() { return etat; }

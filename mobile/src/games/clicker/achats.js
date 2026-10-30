// 💳 ACHATS EN ARGENT RÉEL (22/10, validé par l'auteur : « go » sur le catalogue de 6 produits).
// ⚠️ MODE TEST tant que les comptes Google Play / Apple / RevenueCat ne sont pas ouverts : l'achat est SIMULÉ (fenêtre de
// confirmation « mode test », aucun débit). Le jour J : MODE_ACHATS = 'revenuecat' et `acheter()` appelle RevenueCat —
// le reste du jeu (catalogue, droits, crédits) ne bouge pas. Les identifiants `id` seront ceux des produits des stores.
//
// Ce que donne chaque produit :
//  - pack_demarrage (une seule fois) : Diamants + Griffes, très avantageux — déclenche le 1er achat ;
//  - sans_pubs : les bonus des pubs sont donnés SANS regarder la pub (tous les boutons « pub » du jeu) ;
//  - doubleur : TOUTES les pièces ×2, pour toujours (point de passage unique `gainCoins`) ;
//  - pass_mensuel : 30 jours de récompenses ×2 sur les défis du jour et de la semaine (renouvelable) ;
//  - diamants_* : packs de Diamants, bonus croissant.
//  (6ᵉ famille : les offres limitées de 24 h — à venir, même mécanique.)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { levelUpCost } from './clickerLogic';

export const MODE_ACHATS = 'test'; // 'revenuecat' quand les comptes seront branchés
export const CLE_ACHATS = 'achats:v1';
export const PASS_JOURS = 30;
export const PASS_MULT_DEFIS = 2;
export const DOUBLEUR_MULT = 2;

// 💎 30/10 — DIAMANTS CALÉS SUR LE GRATUIT (demande de l'auteur : « les achats donnent beaucoup trop de Diamants »).
// MESURÉ avec les règles du jeu (auditAchats le recalcule) : un joueur gagne AU PLUS ≈ 29 💎 par jour (boss du tap 21 au
// plafond, calendrier 5, défi du jour 1, défis de la semaine 0,9, mini-jeux ≈ 1 par heure) ; ≈ 18 💎 pour un joueur moyen ;
// + 1 001 💎 de succès, une fois en tout. RÈGLE : 0,99 € = UNE journée max de Diamants gratuits (30 💎) ; les gros packs
// gardent leur bonus (+12 % … +50 % par euro). Tout a été divisé par ≈ 2,67 (80 → 30 💎 ; packs et affaire du jour idem).
// ⚠️ Les IDENTIFIANTS ne bougent pas (ce seront ceux des stores) : le chiffre de `diamants_80` n'est plus la quantité.
// 30/10 (auteur) : jamais « N niveaux » affiché pour des Griffes — le joueur voit la QUANTITÉ réelle (contenuReel).
export const PRODUITS = [
  { id: 'pack_demarrage', famille: 'bienvenue', unique: true, prix: '1,99 €', icone: '🎁', titre: 'Pack de démarrage',
    desc: '160 Diamants + 2 000 Griffes · une seule fois', contenu: { diamants: 160, griffes: 2000 }, badge: '×6 de valeur' },
  { id: 'sans_pubs', famille: 'avantage', unique: true, prix: '4,99 €', icone: '🚫', titre: 'Sans pubs',
    desc: 'Tous les bonus des pubs, sans les regarder', droit: 'sansPubs' },
  { id: 'doubleur', famille: 'avantage', unique: true, prix: '7,99 €', icone: '🪙', titre: 'Pièces ×2',
    desc: 'Toutes tes pièces doublées, pour toujours', droit: 'doubleur', badge: 'Le plus rentable' },
  { id: 'pass_mensuel', famille: 'avantage', unique: false, prix: '4,99 €', icone: '📜', titre: 'Pass des Défis (30 jours)',
    desc: 'Récompenses ×2 sur les défis du jour et de la semaine', droit: 'pass' },
  // ── 22/10 (auteur : « on peut tout ajouter », calculé sur la progression) — tout dans la boutique pour l'instant ; les
  // moments où ils surgiront seront décidés ensuite. Contenu ADAPTATIF : `niveaux` = les Griffes de N niveaux de TA
  // meilleure créature à partir de son niveau actuel (même unité que les défis) ; `minutesPieces` = N minutes de ton revenu
  // passif (crédité DIRECT, jamais via gainCoins : il ne doit pas être re-multiplié — règle du 19/09).
  { id: 'pack_progression', famille: 'offres', prix: '2,99 €', icone: '🥚', titre: 'Pack de progression',
    desc: 'Tous les 3 œufs · Griffes + 55 💎 + 1 h de pièces', contenu: { niveaux: 12, diamants: 55, minutesPieces: 60 } },
  { id: 'pack_ascension', famille: 'offres', prix: '4,99 €', icone: '🌟', titre: "Pack d'Ascension",
    desc: 'Après chaque Ascension · Griffes + 150 💎 + 4 h de pièces', contenu: { niveaux: 25, diamants: 150, minutesPieces: 240 }, badge: 'Repars fort' },
  { id: 'pack_gardien', famille: 'offres', prix: '2,99 €', icone: '🐯', titre: 'Pack du Gardien',
    desc: 'Pour battre le Gardien · Griffes + 75 💎', contenu: { niveaux: 10, diamants: 75 } },
  { id: 'affaire_jour', famille: 'offres', prix: '0,99 €', icone: '⏰', titre: 'Affaire du jour', unParJour: true,
    desc: 'Change chaque jour · une fois par jour', variantes: [{ diamants: 55 }, { niveaux: 6 }, { minutesPieces: 60, diamants: 20 }] },
  { id: 'griffes_3', famille: 'griffes', prix: '0,99 €', icone: '🐾', titre: 'Poignée de Griffes', desc: 'Des Griffes pour ta meilleure créature', contenu: { niveaux: 3 } },
  { id: 'griffes_18', famille: 'griffes', prix: '4,99 €', icone: '🐾', titre: 'Sac de Griffes', desc: 'Des Griffes pour ta meilleure créature', contenu: { niveaux: 18 } },
  { id: 'griffes_40', famille: 'griffes', prix: '9,99 €', icone: '🐾', titre: 'Coffre de Griffes', desc: 'Des Griffes pour ta meilleure créature', contenu: { niveaux: 40 }, badge: 'Populaire' },
  { id: 'griffes_90', famille: 'griffes', prix: '19,99 €', icone: '🐾', titre: 'Trésor de Griffes', desc: 'Des Griffes pour ta meilleure créature', contenu: { niveaux: 90 }, badge: 'Meilleure valeur' },
  { id: 'diamants_80', famille: 'diamants', prix: '0,99 €', icone: '💎', titre: '30 Diamants', desc: 'Une poignée', contenu: { diamants: 30 } },
  { id: 'diamants_450', famille: 'diamants', prix: '4,99 €', icone: '💎', titre: '170 Diamants', desc: '+12 % offerts', contenu: { diamants: 170 } },
  { id: 'diamants_950', famille: 'diamants', prix: '9,99 €', icone: '💎', titre: '360 Diamants', desc: '+19 % offerts', contenu: { diamants: 360 }, badge: 'Populaire' },
  { id: 'diamants_2000', famille: 'diamants', prix: '19,99 €', icone: '💎', titre: '760 Diamants', desc: '+25 % offerts', contenu: { diamants: 760 } },
  { id: 'diamants_5500', famille: 'diamants', prix: '49,99 €', icone: '💎', titre: '2 080 Diamants', desc: '+37 % offerts', contenu: { diamants: 2080 } },
  { id: 'diamants_12000', famille: 'diamants', prix: '99,99 €', icone: '💎', titre: '4 550 Diamants', desc: '+50 % offerts', contenu: { diamants: 4550 }, badge: 'Meilleure valeur' },
];
export function produit(id) { return PRODUITS.find((p) => p.id === id) || null; }

// ── Droits (mémoire à part de la partie : une Ascension ou une remise à zéro ne les efface JAMAIS) ──
const ETAT_VIDE = { sansPubs: false, doubleur: false, passJusqua: 0, demarrageAchete: false, affaireJour: null, premiersAchats: {}, journal: [],
  avantage: { griffes: 0, combats: 0, fenetreFin: null } };
let etat = { ...ETAT_VIDE };
const abonnes = new Set();
export function abonnerAchats(fn) { abonnes.add(fn); return () => abonnes.delete(fn); }
export async function chargerAchats() {
  try { const brut = await AsyncStorage.getItem(CLE_ACHATS); if (brut) etat = { ...ETAT_VIDE, ...JSON.parse(brut) }; } catch (e) { /* droits vides */ }
  abonnes.forEach((fn) => { try { fn(droitsAchats()); } catch (e) { /* démonté */ } });
  return droitsAchats();
}
export function droitsAchats(maintenant = Date.now()) {
  return { sansPubs: !!etat.sansPubs, doubleur: !!etat.doubleur, passActif: (etat.passJusqua || 0) > maintenant,
    passJusqua: etat.passJusqua || 0, demarrageAchete: !!etat.demarrageAchete };
}
// Multiplicateurs lus par le jeu (sans rien importer d'autre).
export function multiplicateurPieces() { return etat.doubleur ? DOUBLEUR_MULT : 1; }
export function multiplicateurDefis() { return (etat.passJusqua || 0) > Date.now() ? PASS_MULT_DEFIS : 1; }

// Un produit peut-il être acheté (les « une seule fois » déjà pris ne le peuvent plus) ?
export function jourCle(maintenant = Date.now()) { const d = new Date(maintenant); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
// Numéro du jour LOCAL (change à minuit du téléphone) — la rotation des variantes de l'affaire du jour (30/10).
export function jourNumero(maintenant = Date.now()) { const d = new Date(maintenant); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
// « Premier achat ×2 » (22/10, précision de l'auteur) : UNE SEULE FOIS EN TOUT — le tout premier pack de Diamants acheté, quel
// qu'il soit, donne le double ; ensuite plus aucun (le ruban disparaît de tous les packs).
export function premierAchatDouble(id) {
  const p = produit(id); if (!p || p.famille !== 'diamants') return false;
  return !Object.keys(etat.premiersAchats || {}).some((k) => { const q = produit(k); return q && q.famille === 'diamants'; });
}
export function achetable(id, maintenant = Date.now()) {
  const p = produit(id); if (!p) return false;
  if (p.unParJour) return etat.affaireJour !== jourCle(maintenant);
  if (p.id === 'pack_demarrage') return !etat.demarrageAchete;
  if (p.droit === 'sansPubs') return !etat.sansPubs;
  if (p.droit === 'doubleur') return !etat.doubleur;
  return true;
}

// Applique les DROITS d'un achat réussi (le contenu — Diamants, Griffes — est crédité par l'écran qui a acheté).
export function appliquerDroits(e, id, maintenant = Date.now()) {
  const p = produit(id); if (!p) return e;
  const n = { ...e, journal: [...(e.journal || []), { id, a: maintenant, mode: MODE_ACHATS }].slice(-50) };
  if (p.id === 'pack_demarrage') n.demarrageAchete = true;
  if (p.droit === 'sansPubs') n.sansPubs = true;
  if (p.droit === 'doubleur') n.doubleur = true;
  if (p.droit === 'pass') n.passJusqua = Math.max(maintenant, e.passJusqua || 0) + PASS_JOURS * 86400 * 1000; // s'ajoute s'il est encore actif
  if (p.unParJour) n.affaireJour = jourCle(maintenant);
  if (p.famille === 'diamants') n.premiersAchats = { ...(e.premiersAchats || {}), [id]: true };
  return n;
}

// ── Contenu ADAPTATIF (22/10) : ce que donne VRAIMENT un produit pour CE joueur, maintenant ──
// ctx = { creature (def de sa meilleure créature), niveau (son niveau), passifParSec }.
export function griffesPourNiveaux(ctx, n) {
  if (!ctx || !ctx.creature || !(n > 0)) return 0;
  let s = 0; for (let k = 0; k < n; k++) s += levelUpCost(ctx.creature, Math.max(1, ctx.niveau || 1) + k);
  return Math.round(s);
}
export function contenuReel(id, ctx, maintenant = Date.now()) {
  const p = produit(id); if (!p) return {};
  // 30/10 : la variante change à MINUIT DU TÉLÉPHONE (jour local), comme l'achat « une fois par jour » (jourCle) — l'offre qui
  // surgit annonce « Change à minuit » avec sa minuterie : elle doit dire vrai (avant : minuit UTC, 1 à 2 h plus tard en France).
  const base = p.variantes ? p.variantes[jourNumero(maintenant) % p.variantes.length] : (p.contenu || {});
  const r = {};
  if (base.diamants) r.diamants = base.diamants * (premierAchatDouble(id) ? 2 : 1);
  if (base.griffes) r.griffes = base.griffes;
  if (base.niveaux) r.griffes = (r.griffes || 0) + Math.max(base.niveaux * 10, griffesPourNiveaux(ctx, base.niveaux));
  if (base.minutesPieces) r.pieces = Math.max(1000, Math.round(((ctx && ctx.passifParSec) || 0) * 60 * base.minutesPieces));
  return r;
}

// ── 💳 AVANTAGE DES GRIFFES PAYÉES (22/10, règles de l'auteur) ──
// Les Griffes ACHETÉES restent « hors photo » (combatLogic.photoFenetre, options.griffesPayees) pendant un nombre de combats
// d'Aventure proportionnel au prix : 3 par euro, 5 au moins par achat, 300 au plus au total (≈ 100 € d'achats). Chaque combat
// joué (gagné ou perdu) en retire un. À 0 : les Griffes reviennent EN DOUCEUR — moitié à la fenêtre (5 étapes) suivante,
// tout à celle d'après — pour éviter un mur de difficulté. Seul effet : le niveau des ennemis à la photo. Rien d'autre.
export const COMBATS_PAR_EURO = 3;
export const COMBATS_MIN_ACHAT = 5;
export const COMBATS_MAX_TOTAL = 300;
export function prixEnEuros(p) { return parseFloat(String((p && p.prix) || '0').replace(',', '.')) || 0; }
export function combatsPourPrix(euros) { return Math.max(COMBATS_MIN_ACHAT, Math.round(euros * COMBATS_PAR_EURO)); }
// Pur (testable) : l'avantage après un achat contenant `griffes` Griffes, payé `euros`.
export function avantageApresAchat(av, euros, griffes) {
  const a = av || { griffes: 0, combats: 0, fenetreFin: null };
  if (!(griffes > 0)) return a;
  return { griffes: (a.griffes || 0) + griffes, combats: Math.min(COMBATS_MAX_TOTAL, (a.combats || 0) + combatsPourPrix(euros)), fenetreFin: null };
}
// Pur : un combat d'Aventure joué dans la fenêtre `fenetre` (le dernier combat note la fenêtre de fin).
export function avantageApresCombat(av, fenetre) {
  const a = av || { griffes: 0, combats: 0, fenetreFin: null };
  if (!(a.combats > 0)) return a;
  const combats = a.combats - 1;
  return { ...a, combats, fenetreFin: combats === 0 ? fenetre : a.fenetreFin };
}
// Pur : les Griffes à garder hors de la photo de la fenêtre `k` (tout pendant l'avantage, ½ juste après, puis 0).
export function griffesHorsPhoto(av, k) {
  const a = av || {}; const g = Math.max(0, a.griffes || 0);
  if (!g) return 0;
  if (a.combats > 0) return g;
  if (a.fenetreFin == null) return 0;
  if (k <= a.fenetreFin) return g; // la fenêtre où l'avantage s'est terminé : sa photo était déjà prise avec l'avantage
  if (k === a.fenetreFin + 1) return Math.round(g / 2);
  return 0;
}
export function griffesPayeesPourFenetre(k) { return griffesHorsPhoto(etat.avantage, k); }
export function combatsAvantage() { return Math.max(0, (etat.avantage && etat.avantage.combats) || 0); }
async function sauver() { try { await AsyncStorage.setItem(CLE_ACHATS, JSON.stringify(etat)); } catch (e) { /* la session garde l'état */ } }
export async function noterAvantageGriffes(id, griffes) {
  const a = avantageApresAchat(etat.avantage, prixEnEuros(produit(id)), griffes);
  if (a === etat.avantage) return; etat = { ...etat, avantage: a }; await sauver();
}
export async function compterCombatAvantage(fenetre) {
  const a = avantageApresCombat(etat.avantage, fenetre);
  if (a === etat.avantage) return; etat = { ...etat, avantage: a }; await sauver();
}

// ── Le fournisseur de paiement ──
// Mode test : rien n'est débité, l'achat « réussit » (la confirmation « mode test » est affichée AVANT par l'écran).
// Mode RevenueCat (plus tard) : Purchases.purchaseStoreProduct(...) puis lecture des droits — même valeur de retour.
export async function acheter(id) {
  const p = produit(id);
  if (!p || !achetable(id)) return { ok: false, raison: 'indisponible' };
  if (MODE_ACHATS !== 'test') return { ok: false, raison: 'paiement non branché' };
  etat = appliquerDroits(etat, id);
  try { await AsyncStorage.setItem(CLE_ACHATS, JSON.stringify(etat)); } catch (e) { /* le droit vaut pour la session */ }
  abonnes.forEach((fn) => { try { fn(droitsAchats()); } catch (e) { /* démonté */ } });
  return { ok: true, produit: p };
}

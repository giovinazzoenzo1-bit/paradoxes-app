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

export const MODE_ACHATS = 'test'; // 'revenuecat' quand les comptes seront branchés
export const CLE_ACHATS = 'achats:v1';
export const PASS_JOURS = 30;
export const PASS_MULT_DEFIS = 2;
export const DOUBLEUR_MULT = 2;

export const PRODUITS = [
  { id: 'pack_demarrage', famille: 'bienvenue', unique: true, prix: '1,99 €', icone: '🎁', titre: 'Pack de démarrage',
    desc: '500 Diamants + 2 000 Griffes · une seule fois', contenu: { diamants: 500, griffes: 2000 }, badge: '×6 de valeur' },
  { id: 'sans_pubs', famille: 'avantage', unique: true, prix: '4,99 €', icone: '🚫', titre: 'Sans pubs',
    desc: 'Tous les bonus des pubs, sans les regarder', droit: 'sansPubs' },
  { id: 'doubleur', famille: 'avantage', unique: true, prix: '7,99 €', icone: '🪙', titre: 'Pièces ×2',
    desc: 'Toutes tes pièces doublées, pour toujours', droit: 'doubleur', badge: 'Le plus rentable' },
  { id: 'pass_mensuel', famille: 'avantage', unique: false, prix: '4,99 €', icone: '📜', titre: 'Pass des Défis (30 jours)',
    desc: 'Récompenses ×2 sur les défis du jour et de la semaine', droit: 'pass' },
  { id: 'diamants_80', famille: 'diamants', prix: '0,99 €', icone: '💎', titre: '80 Diamants', desc: 'Une poignée', contenu: { diamants: 80 } },
  { id: 'diamants_450', famille: 'diamants', prix: '4,99 €', icone: '💎', titre: '450 Diamants', desc: '+12 % offerts', contenu: { diamants: 450 } },
  { id: 'diamants_950', famille: 'diamants', prix: '9,99 €', icone: '💎', titre: '950 Diamants', desc: '+19 % offerts', contenu: { diamants: 950 }, badge: 'Populaire' },
  { id: 'diamants_2000', famille: 'diamants', prix: '19,99 €', icone: '💎', titre: '2 000 Diamants', desc: '+25 % offerts', contenu: { diamants: 2000 } },
  { id: 'diamants_5500', famille: 'diamants', prix: '49,99 €', icone: '💎', titre: '5 500 Diamants', desc: '+37 % offerts', contenu: { diamants: 5500 } },
  { id: 'diamants_12000', famille: 'diamants', prix: '99,99 €', icone: '💎', titre: '12 000 Diamants', desc: '+50 % offerts', contenu: { diamants: 12000 }, badge: 'Meilleure valeur' },
];
export function produit(id) { return PRODUITS.find((p) => p.id === id) || null; }

// ── Droits (mémoire à part de la partie : une Ascension ou une remise à zéro ne les efface JAMAIS) ──
const ETAT_VIDE = { sansPubs: false, doubleur: false, passJusqua: 0, demarrageAchete: false, journal: [] };
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
export function achetable(id) {
  const p = produit(id); if (!p) return false;
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
  return n;
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

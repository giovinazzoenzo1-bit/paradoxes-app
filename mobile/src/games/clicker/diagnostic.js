import { lignesDiagnosticTaps } from './diagnosticTaps';
// ════════════════════════════════════════════════════════════════════
//  DIAGNOSTIC — détecter un joueur bloqué, et rédiger son rapport
// ════════════════════════════════════════════════════════════════════
//
// Demandé par l'auteur le 21/09 : « avons-nous le moyen de savoir si un
// joueur est bloqué à cause d'un bug ? Un système de retour
// d'information, comme ça on peut régler dans les meilleurs délais. »
//
// Avant ce fichier, l'auteur était AVEUGLE : le gestionnaire d'erreurs
// affichait l'erreur sur le téléphone du joueur, jamais chez lui.
//
// ⚠️⚠️ CE FICHIER EST PUR : aucun import, ni React, ni React Native, ni
// module natif. C'est voulu, pour deux raisons :
//   - les modules natifs ont déjà bloqué le démarrage de l'app trois
//     fois (écran blanc, « Checking for new update ») ;
//   - un fichier pur se TESTE dans le bac à sable. L'auteur ne peut pas
//     vérifier ce code sur son téléphone : c'est `auditSignalement` qui
//     le fait à sa place, à chaque contrôle.
// Les appels natifs (ouvrir le mail, partager) vivent à part, dans
// `src/signalement.js`, et restent minimes.

// ⚠️ L'ADRESSE DE RÉCEPTION N'EXISTE QU'ICI. L'auteur la changera plus
// tard : c'est la seule ligne à modifier. `auditSignalement` refuse
// qu'elle apparaisse ailleurs dans le code — une copie ne suivrait pas
// le changement, et les rapports partiraient vers l'ancienne adresse
// sans que personne s'en aperçoive.
export const EMAIL_SIGNALEMENT = 'giovinazzoenzo1@gmail.com';

// Clés de stockage. L'instantané est réécrit chaque minute par l'écran
// de jeu : si ce dernier plante, les Options peuvent encore en faire un
// rapport, vieux d'une minute au plus.
export const DIAGNOSTIC_INSTANTANE_KEY = 'diagnostic:instantane';
// 17/10 (auteur) : mesures de jeu pour le rapport (temps, rythme de tap, Transe, défis chronométrés…), écrites par l'écran de jeu.
export const MESURES_JEU_KEY = 'diagnostic:mesures:v1';
// 18/10 (section 5) : le chrono des défis s'arrêtait après l'œuf 1 sans erreur visible — la dernière erreur du chrono est gardée ici.
export const MESURES_ERREUR_KEY = 'diagnostic:mesures:erreur:v1';
export const DIAGNOSTIC_ERREUR_KEY = 'diagnostic:derniereErreur';

// Un défi sans AUCUN progrès pendant trois heures de jeu ACTIF (appli
// ouverte) est suspect. Mesuré : un œuf dure 25 min à 1,5 h selon
// l'Ascension, pour six défis menés en parallèle — trois heures sur un
// seul défi, c'est plus de deux œufs entiers. Au-dessous, on
// importunerait un joueur qui économise simplement pour un achat.
export const STAGNATION_ALERTE_SEC = 3 * 3600;

// Plafond du corps du mail. Certaines applis de messagerie tronquent un
// lien `mailto:` trop long ; au-delà, le rapport arriverait coupé.
export const RAPPORT_LONGUEUR_MAX = 1800;

const fini = (v) => typeof v === 'number' && Number.isFinite(v);

// ---- Suivi de stagnation --------------------------------------------
//
// `suivi` : l'état précédent, { [idDéfi]: { current, stagneSec } }.
// `defis` : les défis en cours, [{ id, current, done }].
// `dtSec` : temps de jeu ACTIF écoulé depuis le dernier appel.
//
// Rend un NOUVEL objet — rien n'est modifié en place. Un défi qui a
// bougé, qui est terminé, ou qui vient d'apparaître repart de zéro.
export function suivreStagnation(suivi, defis, dtSec) {
  const suite = {};
  const pas = fini(dtSec) && dtSec > 0 ? dtSec : 0;
  (defis || []).forEach((d) => {
    if (!d || !d.id) return;
    const prec = suivi && suivi[d.id];
    const immobile = prec && !d.done && fini(d.current) && prec.current === d.current;
    suite[d.id] = {
      current: d.current,
      stagneSec: immobile ? prec.stagneSec + pas : 0,
    };
  });
  return suite;
}

// ---- Détection -------------------------------------------------------
//
// `etat` : {
//   coins, totalEarned, seuil,
//   defis: [{ id, label, current, target, progress, done, trouve }],
//   suivi,          // résultat de suivreStagnation
// }
//
// Rend une liste de problèmes { code, texte }. Le `code` est stable :
// il sert à ne proposer chaque problème qu'UNE fois par session.
//
// ⚠️ Chaque règle correspond à une panne qui BLOQUE le joueur, pas à une
// simple bizarrerie — un faux positif pousse un joueur sain à signaler
// un problème qui n'existe pas, et finit par faire ignorer les vrais.
export function detecterBlocages(etat) {
  const pb = [];
  const e = etat || {};
  // Le compteur qui décide de l'Ascension. `NaN >= seuil` est toujours
  // faux : un compteur invalide rend l'Ascension impossible POUR
  // TOUJOURS, puisqu'il est sauvegardé.
  if (!fini(e.totalEarned) || e.totalEarned < 0) {
    pb.push({ code: 'totalEarned', texte: "Le compteur de pièces gagnées est invalide : l'Ascension est impossible." });
  }
  if (!fini(e.coins) || e.coins < 0) {
    pb.push({ code: 'coins', texte: 'Le solde de pièces est invalide.' });
  }
  if (!fini(e.seuil) || e.seuil <= 0) {
    pb.push({ code: 'seuil', texte: "Le seuil d'Ascension est invalide." });
  }
  const defis = Array.isArray(e.defis) ? e.defis : [];
  if (!defis.length) {
    pb.push({ code: 'aucunDefi', texte: "Aucun défi en cours : l'œuf ne peut pas éclore." });
  }
  defis.forEach((d) => {
    const nom = (d && (d.label || d.id)) || '?';
    if (!d || d.trouve === false) {
      pb.push({ code: 'inconnu:' + (d && d.id), texte: 'Défi introuvable : « ' + nom + ' ».' });
      return;
    }
    if (!fini(d.target) || d.target <= 0) {
      pb.push({ code: 'cible:' + d.id, texte: 'Cible invalide pour « ' + nom + ' ».' });
    }
    if (!d.done && !fini(d.current)) {
      pb.push({ code: 'progression:' + d.id, texte: 'Progression illisible pour « ' + nom + ' ».' });
    }
    const s = e.suivi && e.suivi[d.id];
    if (!d.done && s && s.stagneSec >= STAGNATION_ALERTE_SEC) {
      const h = Math.floor(s.stagneSec / 3600);
      pb.push({ code: 'stagnation:' + d.id,
        texte: 'Aucun progrès sur « ' + nom + ' » depuis ' + h + ' h de jeu.' });
    }
  });
  return pb;
}

// ---- Rédaction du rapport -------------------------------------------
//
// Texte court et lisible, à coller dans un mail. Tout ce qu'il faut pour
// reproduire le problème sans rien demander au joueur : version exacte,
// position dans le jeu, défis et leur avancement, problèmes détectés,
// dernière erreur.
const nombre = (v) => (fini(v) ? String(Math.round(v)) : String(v));

export function construireRapport({ instantane, derniereErreur, appareil, build, mesures = null } = {}) {
  const i = instantane || {};
  const b = build || {};
  const lignes = [];
  lignes.push('Paradox — rapport de problème');
  lignes.push('Build : ' + (b.sha || '?') + ' (' + (b.time || '?') + ')');
  if (appareil) lignes.push('Appareil : ' + appareil);
  lignes.push('Instantané : ' + (i.at ? new Date(i.at).toISOString() : 'aucun'));
  lignes.push('');
  lignes.push('Ascension : ' + nombre(i.ascension) + ' · Œuf : ' + nombre((i.oeuf || 0) + 1));
  lignes.push('Pièces : ' + nombre(i.coins) + ' · Gagnées : ' + nombre(i.totalEarned)
    + ' · Seuil : ' + nombre(i.seuil));
  const pb = Array.isArray(i.problemes) ? i.problemes : [];
  lignes.push('');
  lignes.push('Problèmes détectés : ' + (pb.length ? '' : 'aucun'));
  pb.forEach((p) => lignes.push('- ' + p.texte));
  lignes.push('');
  lignesDiagnosticTaps().forEach((l) => lignes.push(l));
  const defis = Array.isArray(i.defis) ? i.defis : [];
  lignes.push('');
  lignes.push('Défis en cours :');
  defis.forEach((d) => {
    const pct = fini(d.progress) ? Math.round(d.progress * 100) + ' %' : '?';
    lignes.push('- ' + (d.done ? '[fait] ' : '') + (d.label || d.id) + ' — ' + pct
      + ' (' + nombre(d.current) + '/' + nombre(d.target) + ')');
  });
  // 17/10 (auteur) : MESURES DE JEU — pour vérifier le calculateur de défis par un test manuel (temps réel de chaque défi).
  const m = mesures;
  if (m && typeof m === 'object') {
    const duree = (s) => Math.floor((s || 0) / 60) + ' min ' + Math.round((s || 0) % 60) + ' s';
    lignes.push('');
    lignes.push('Mesures de jeu :');
    lignes.push('- Temps de jeu actif : ' + duree(m.tempsJeuSec) + ' · ouvertures : ' + (m.sessions || 0) + ' · par ouverture : ' + duree((m.tempsJeuSec || 0) / Math.max(1, m.sessions || 1)));
    if (m.rythmeCalcul > 0) lignes.push('- Rythme retenu par le calculateur de défis : ' + Number(m.rythmeCalcul).toFixed(1).replace('.', ',') + ' taps/s (fenêtres de 500 taps)');
    lignes.push('- Taps : ' + (m.taps || 0) + ' · rythme moyen : ' + (m.tapsActifsSec > 0 ? (m.taps / m.tapsActifsSec).toFixed(1).replace('.', ',') : '?') + ' taps/s · en Transe : ' + (m.transeSec > 0 ? (m.tapsTranse / m.transeSec).toFixed(1).replace('.', ',') : '?') + ' taps/s');
    lignes.push('- Transe : ' + (m.transes || 0) + ' fois · durée moyenne : ' + (m.transes ? Math.round(m.transeSec / m.transes) : 0) + ' s · record : ' + Math.round(m.transeMax || 0) + ' s');
    lignes.push('- Pièces par tap (moyenne) : ' + (m.taps ? Math.round(m.piecesTaps / m.taps) : 0) + ' · revenu passif : ' + nombre(m.revenuPassif || 0) + ' /s');
    lignes.push('- Cible dorée : ' + (m.doreesApparues || 0) + ' apparues · ' + (m.doreesTouchees || 0) + ' touchées');
    lignes.push('- Hors ligne : ' + (m.horsLigneRetours || 0) + ' retours · ' + nombre(m.horsLignePieces || 0) + ' pièces');
    lignes.push('- Défi en cours : ' + (m.defiLabel || m.defiId || '?') + ' depuis ' + duree((m.tempsJeuSec || 0) - (m.defiDebut || 0)));
    lignes.push('- Temps réel des derniers défis :');
    (Array.isArray(m.historique) ? m.historique : []).forEach((h) => lignes.push('  · ' + (h.label || h.id) + ' : ' + duree(h.sec)));
    // 18/10 (diagnostic, section 5) : le rapport ne chronométrait que l'œuf 1. Fraîcheur des mesures, passages du chrono
    // (heure · défi quitté → défi suivant, ∅ = aucun) et dernière erreur : la cause se lit sur une seule capture.
    lignes.push('- Mesures enregistrées il y a : ' + (Number.isFinite(m.ageSec) ? duree(m.ageSec) : '?'));
    (Array.isArray(m.suivi) ? m.suivi : []).forEach((x) => lignes.push('  ↪ ' + (x.h || '?') + ' · ' + (x.de || '∅') + ' → ' + (x.vers || '∅')));
    if (m.erreurChrono) lignes.push('- Erreur du chrono : ' + m.erreurChrono);
  }
  if (derniereErreur && derniereErreur.message) {
    lignes.push('');
    lignes.push('Dernière erreur' + (derniereErreur.fatal ? ' (fatale)' : '') + ' : '
      + String(derniereErreur.message));
    if (derniereErreur.stack) lignes.push(String(derniereErreur.stack).split('\n').slice(0, 3).join('\n'));
  }
  lignes.push('');
  lignes.push('(Écris ici ce que tu faisais au moment du problème.)');
  let texte = lignes.join('\n');
  // ⚠️ Tronqué en GARDANT la fin, qui invite le joueur à décrire ce
  // qu'il faisait — c'est souvent l'information la plus utile.
  if (texte.length > RAPPORT_LONGUEUR_MAX) {
    const fin = '\n…\n(Écris ici ce que tu faisais au moment du problème.)';
    texte = texte.slice(0, RAPPORT_LONGUEUR_MAX - fin.length) + fin;
  }
  return texte;
}

// ---- Lien mail --------------------------------------------------------
//
// ⚠️ Retours à la ligne en `\r\n` : c'est la forme qu'attend la norme des
// liens `mailto:` ; certaines applis collent tout sur une ligne sinon.
export function lienMailto(sujet, corps, destinataire = EMAIL_SIGNALEMENT) {
  const s = encodeURIComponent(String(sujet || ''));
  const c = encodeURIComponent(String(corps || '').replace(/\r?\n/g, '\r\n'));
  return 'mailto:' + destinataire + '?subject=' + s + '&body=' + c;
}

// Sujet court, avec le code du premier problème : l'auteur trie ses
// mails d'un coup d'œil.
export function sujetRapport(problemes, build) {
  const p = Array.isArray(problemes) && problemes.length ? problemes[0].code : 'manuel';
  const sha = (build && build.sha) || '?';
  return 'Paradox — problème [' + p + '] — build ' + sha;
}

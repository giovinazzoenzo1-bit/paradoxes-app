import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Animated } from 'react-native';
import { COLORS } from './clickerTheme';
import { FenetreBois, BoutonBois, SABLIER } from './fenetreBois';
import {
  remainingMs, isReady, progressRatio, formatRemaining,
  canWatchVideo, MAX_VIDEOS_PER_EGG, VIDEO_REDUCTION_RATIO, TAP_REDUCTION_MS,
  guardianRetryRemainingMs,
} from '../../games/clicker/incubatorLogic';

const EGG_IMG = require('../../../assets/egg/egg-2-fissure.png');

// Panneau de l'incubateur — VERSION 1 (07/09), pour tester la mécanique.
// Même gabarit modal que les menus Quêtes et Paramètres.
//
// Le gardien d'œuf (combat à la fin du minuteur) n'est PAS dans cette
// version : ici l'éclosion donne directement la créature. Il viendra
// s'intercaler entre « minuteur à zéro » et « éclosion ».
export default function IncubatorPanel({ egg, onTap, onWatchVideo, onHatch, onBack, guardianRequired, guardianInfo = null }) {
  // Ré-affichage chaque seconde. Le minuteur lui-même ne dépend PAS de
  // ce timer : tout est calculé depuis l'horodatage de fin, donc fermer
  // l'appli ne fait rien perdre. Ce tick ne sert qu'à rafraîchir
  // l'affichage tant que le panneau est ouvert.
  const [, setTick] = useState(0);
  // Fausse publicité : 1 seconde de chargement pour imiter le temps
  // d'affichage d'une vraie régie. Aucune régie n'est installée dans le
  // projet — ce délai sert à tester le ressenti et le rythme.
  const [adLoading, setAdLoading] = useState(false);
  // Secousse de l'œuf à chaque tap. Séquence courte et symétrique qui
  // revient toujours à 0 : impossible que l'œuf reste figé de travers
  // si le joueur tape en rafale (même schéma que l'œuf du Clicker).
  const shake = useRef(new Animated.Value(0)).current;
  const doShake = () => {
    shake.stopAnimation(() => {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]).start();
    });
  };
  const adTimerRef = useRef(null);
  useEffect(() => () => { if (adTimerRef.current) clearTimeout(adTimerRef.current); }, []);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const ready = isReady(egg, now);
  const pct = Math.round(progressRatio(egg, now) * 100);

  const handleVideo = () => {
    if (adLoading) return;
    setAdLoading(true);
    // Le nettoyage à la fermeture (plus haut) évite un setState sur un
    // composant démonté si le joueur ferme le panneau pendant la
    // seconde de chargement.
    adTimerRef.current = setTimeout(() => {
      adTimerRef.current = null;
      setAdLoading(false);
      onWatchVideo();
    }, 1000);
  };

  return (
    <View style={styles.backdrop}>
      {/* Zone cliquable DERRIÈRE le panneau : taper à côté ferme. Posée
          en absolu et non en parent, sinon un tap sur le panneau
          fermerait aussi le menu. */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onBack} />

      {/* 27/09 (demande de l'auteur) : fenêtre du thème forêt. */}
      <FenetreBois titre="Incubateur" onFermer={onBack} largeur={320}>

        <View style={styles.body}>
          {!egg ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🥚</Text>
              <Text style={styles.emptyText}>
                Aucun œuf en incubation.{'\n'}
                Utilise le bouton sous l'œuf, sur l'écran principal, pour en mettre un.
              </Text>
            </View>
          ) : (
            <>
              {/* Zone de tap volontairement plus large que l'image :
                  l'œuf ne remplit pas tout son cadre (les PNG ont de
                  grandes marges transparentes), taper juste à côté doit
                  compter. */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { doShake(); (ready ? onHatch : onTap)(); }}
                style={styles.eggWrap}
              >
                <Animated.Image
                  source={EGG_IMG}
                  style={[styles.eggImg, {
                    transform: [
                      { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
                      { scale: shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.04, 1, 1.04] }) },
                    ],
                  }]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <View style={styles.timerRow}>
                <Image source={SABLIER} style={styles.timerSablier} resizeMode="contain" />
                <Text style={[styles.timer, ready && styles.timerReady]}>
                  {formatRemaining(remainingMs(egg, now))}
                </Text>
              </View>

              {/* 27/09 (retour de l'auteur) : le pourcentage, puis une petite
                  barre de chargement dessous. Largeurs en NOMBRES : la barre
                  à « 100 % » d'un bloc sans largeur fixe se réduisait, sur
                  téléphone, à une pastille ronde autour du texte. */}
              <Text style={[styles.pctTexte, ready && styles.pctTexteFini]}>{pct} %</Text>
              <View style={styles.miniBarre}>
                <View style={[styles.miniBarreRemplie, { width: Math.round((MINI_BARRE_L - 2) * pct / 100) }, ready && styles.miniBarreFinie]} />
              </View>

              {ready ? (
                // Après une défaite contre le gardien, l'œuf reste : seul
                // le délai avant nouvel essai bloque le bouton.
                guardianRetryRemainingMs(egg, now) > 0 ? (
                  <BoutonBois couleur="rouge" desactive largeur={250} hauteur={58} texte="⚔️ Nouvel essai" sousTexte={`dans ${formatRemaining(guardianRetryRemainingMs(egg, now))}`} />
                ) : (
                  // Rouge quand c'est un gardien, vert quand l'œuf éclot
                  // directement : même code couleur que l'écran
                  // principal, la même action doit se reconnaître au
                  // premier coup d'œil des deux côtés.
                  <BoutonBois
                    couleur={guardianRequired ? 'rouge' : 'vert'}
                    largeur={250}
                    hauteur={60}
                    texte={guardianRequired ? '⚔️ Affronter le gardien' : '🐣 Faire éclore'}
                    sousTexte={guardianRequired && guardianInfo ? guardianInfo : null}
                    onPress={onHatch}
                  />
                )
              ) : (
                <>
                  <Text style={styles.hint}>
                    Tape l'œuf pour gagner {TAP_REDUCTION_MS / 1000} seconde par tap.
                  </Text>
                  <BoutonBois
                    couleur="bleu"
                    largeur={250}
                    hauteur={56}
                    desactive={!canWatchVideo(egg) || adLoading}
                    onPress={handleVideo}
                    texte={`📺 Vidéo : −${Math.round(VIDEO_REDUCTION_RATIO * 100)} %`}
                    sousTexte={`${egg.videosUsed || 0} / ${MAX_VIDEOS_PER_EGG} vidéos`}
                  >
                    {adLoading ? (
                      <View style={styles.adLoadingRow}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.adLoadingText}>Publicité…</Text>
                      </View>
                    ) : null}
                  </BoutonBois>
                </>
              )}

              <Text style={styles.stats}>
                {egg.tapsUsed || 0} taps · durée initiale {formatRemaining(egg.totalMs)}
              </Text>
            </>
          )}
        </View>
      </FenetreBois>
    </View>
  );
}

const MINI_BARRE_L = 170;
const styles = StyleSheet.create({
  pctTexte: { color: '#ffe6a8', fontSize: 14, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  pctTexteFini: { color: COLORS.good },
  miniBarre: { width: MINI_BARRE_L, height: 9, borderRadius: 5, backgroundColor: 'rgba(20,12,6,0.9)', borderWidth: 1, borderColor: '#9a7440', overflow: 'hidden', marginTop: 4, marginBottom: 12 },
  miniBarreRemplie: { height: 7, borderRadius: 4, backgroundColor: '#f2c14e' },
  miniBarreFinie: { backgroundColor: COLORS.good },
  // 27/09 : sablier à côté du temps restant (thème forêt).
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  timerSablier: { width: 22, height: 34 },
  // `position: absolute` + `zIndex: 30` : sans ça le panneau se rendait
  // DERRIÈRE les éléments du Clicker, qui sont eux-mêmes en absolu avec
  // des zIndex de 3 à 5 (signalé sur capture le 07/09). Les autres
  // surcouches du jeu utilisent 20, on passe au-dessus.
  backdrop: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  panel: {
    width: '100%', maxHeight: '82%',
    backgroundColor: COLORS.bg, borderRadius: 18,
    borderWidth: 2, borderColor: COLORS.border, overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.panelLight,
    borderBottomWidth: 2, borderBottomColor: COLORS.border,
  },
  panelTitle: { color: COLORS.text, fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: {
    position: 'absolute', right: 12, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border,
  },
  closeBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '900' },

  body: { padding: 16, alignItems: 'center' },

  emptyWrap: { paddingVertical: 30, alignItems: 'center' },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { color: COLORS.muted, fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 20 },

  eggWrap: { width: 230, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  eggImg: { width: 150, height: 150 },

  timer: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginBottom: 10 },
  timerReady: { color: COLORS.good },

  barTrack: {
    width: '100%', height: 22, borderRadius: 11, backgroundColor: '#0a1a28',
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', justifyContent: 'center', marginBottom: 14,
  },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.action },
  // Centrage vertical par la VUE parente (`barTrack`), jamais par
  // `textAlignVertical` qui n'existe que sur Android (voir Règles de
  // survie : le montant des pièces se collait en haut sur iPhone).
  barLabel: {
    color: COLORS.text, fontSize: 11, fontWeight: '900', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 2,
  },

  hint: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 10 },

  videoBtn: {
    width: '100%', paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(46,127,184,0.18)', borderWidth: 1.5, borderColor: COLORS.neonCyan,
  },
  videoBtnDisabled: { backgroundColor: 'transparent', borderColor: COLORS.border },
  videoBtnText: { color: COLORS.neonCyan, fontSize: 13, fontWeight: '800' },
  videoBtnTextDisabled: { color: COLORS.muted },

  hatchBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: COLORS.good,
  },
  hatchBtnText: { color: '#062b18', fontSize: 15, fontWeight: '900' },
  hatchBtnGuardian: {
    backgroundColor: 'rgba(217,48,37,0.9)', borderWidth: 2, borderColor: '#ff6b5e',
    shadowColor: '#ff2d2d', shadowOpacity: 0.8, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  hatchBtnGuardianText: { color: '#fff' },
  guardianInfo: { color: '#FFE9A8', fontSize: 11, marginTop: 3, textAlign: 'center' },
  hatchBtnWaiting: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.border },
  hatchBtnWaitingText: { color: COLORS.muted, fontSize: 13, fontWeight: '800' },

  adLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adLoadingText: { color: COLORS.neonCyan, fontSize: 13, fontWeight: '800' },

  stats: { color: COLORS.muted, fontSize: 10, marginTop: 12, textAlign: 'center' },
});

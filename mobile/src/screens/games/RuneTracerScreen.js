// Traceur de Runes — nouveau jeu (pas un port du PWA). Principe : une
// forme ("rune") s'affiche brièvement, disparaît, le joueur doit la
// reproduire du doigt le plus fidèlement possible ; le score est un % de
// similarité entre le tracé du joueur et la forme de référence. Univers et
// noms 100% originaux (voir runeTracerLogic.js) — pas de sorts Harry
// Potter, qui sont une propriété intellectuelle protégée.
//
// Règle des essais (précisée par l'utilisateur) : les 3 "chances" ne se
// déclenchent QUE si le joueur ne termine pas son tracé dans le temps
// imparti (6s) — PAS parce qu'il n'aime pas son résultat. Concrètement :
// - Le joueur lève le doigt à temps -> tracé accepté tel quel, définitif,
//   pas de bouton "Réessayer" (seulement "Suivant").
// - Le temps s'épuise avant qu'il ait fini -> une chance est consommée,
//   la forme se remontre automatiquement pour un nouvel essai, jusqu'à
//   épuisement des 3 chances (le dernier essai, réussi ou non, devient
//   alors le résultat définitif).
// Minuteur affiché en BAS avec une barre qui se vide (comme le jeu de
// référence), pas en haut.
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, useWindowDimensions } from 'react-native';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import { RUNES, scoreTrace, ratingForScore } from '../../games/runetracer/runeTracerLogic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#0d0a1f',
  panel: '#1a1438',
  border: '#3a2f6b',
  guide: '#3ec6f0',
  drawn: '#f5c542',
  text: '#eef0f6',
  muted: '#9088b8',
  action: '#f5c542',
};

const SHOW_HOLD_DURATION = 450;
const FADE_DURATION = 350;
const TIMEOUT_MSG_DURATION = 900; // durée d'affichage du message "temps écoulé" avant relance
const DRAW_TIME_LIMIT = 6; // secondes pour tracer
const MAX_ATTEMPTS = 3; // "chances" par rune — uniquement en cas de temps écoulé
const RATING_COLOR = {
  PARFAIT: '#00E676',
  'TRÈS BIEN': '#4fd18a',
  BIEN: '#3ec6f0',
  APPROXIMATIF: '#f5c542',
  RATÉ: '#FF5252',
};

function coinsForAverage(avg) {
  if (avg >= 90) return 8;
  if (avg >= 75) return 5;
  if (avg >= 60) return 3;
  if (avg >= 40) return 1;
  return 0;
}

function dimsForRune(rune) {
  const segments = rune.points.length;
  const duration = Math.max(1100, Math.min(2600, 700 + segments * 22));
  return { duration };
}

export default function RuneTracerScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);
  const { width: WIN_W, height: WIN_H } = useWindowDimensions();

  const [phase, setPhase] = useState('setup'); // setup|showing|fading|drawing|timeout|result|final
  const [runeIndex, setRuneIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [lastScore, setLastScore] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [totalScore, setTotalScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DRAW_TIME_LIMIT);
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const phaseRef = useRef('setup');
  phaseRef.current = phase;
  const runeIndexRef = useRef(0);
  runeIndexRef.current = runeIndex;
  const userPointsRef = useRef([]);
  const timeoutRef = useRef(null);
  const gameIdRef = useRef(0);
  const attemptsLeftRef = useRef(MAX_ATTEMPTS);
  const timerIntervalRef = useRef(null);
  const drawStartRef = useRef(0);

  const canvasSize = Math.min(WIN_W - 40, WIN_H - 320, 400);

  const canvasViewRef = useRef(null);
  const canvasOriginRef = useRef({ x: 0, y: 0 });
  const handleCanvasLayout = () => {
    if (canvasViewRef.current && canvasViewRef.current.measure) {
      canvasViewRef.current.measure((x, y, w, h, pageX, pageY) => {
        canvasOriginRef.current = { x: pageX, y: pageY };
      });
    }
  };

  const revealProgressRef = useRef(0);
  const revealRafRef = useRef(null);
  const revealStartRef = useRef(0);

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const handleTimeoutRef = useRef(null);

  const startDrawTimer = useCallback(() => {
    drawStartRef.current = performance.now();
    setTimeLeft(DRAW_TIME_LIMIT);
    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      const elapsed = (performance.now() - drawStartRef.current) / 1000;
      const remain = Math.max(0, DRAW_TIME_LIMIT - elapsed);
      setTimeLeft(remain);
      if (remain <= 0) {
        stopTimer();
        handleTimeoutRef.current();
      }
    }, 100);
  }, []);

  const animateReveal = useCallback(() => {
    const dims = dimsForRune(RUNES[runeIndexRef.current]);
    const t = Math.min(1, (performance.now() - revealStartRef.current) / dims.duration);
    revealProgressRef.current = t;
    bump();
    if (t < 1) {
      revealRafRef.current = requestAnimationFrame(animateReveal);
    } else {
      timeoutRef.current = setTimeout(() => {
        setPhase('fading');
        timeoutRef.current = setTimeout(() => {
          setPhase('drawing');
          startDrawTimer();
        }, FADE_DURATION);
      }, SHOW_HOLD_DURATION);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDrawTimer]);

  // Relance le cycle affichage→disparition→dessin pour un nouvel essai
  // (utilisé uniquement après un temps écoulé, pas de bouton manuel).
  const beginShowPhase = useCallback(() => {
    userPointsRef.current = [];
    setLastScore(null);
    setPhase('showing');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (revealRafRef.current) cancelAnimationFrame(revealRafRef.current);
    stopTimer();
    revealProgressRef.current = 0;
    revealStartRef.current = performance.now();
    revealRafRef.current = requestAnimationFrame(animateReveal);
  }, [animateReveal]);

  const startRune = useCallback(
    (index) => {
      attemptsLeftRef.current = MAX_ATTEMPTS;
      setAttemptsLeft(MAX_ATTEMPTS);
      setRuneIndex(index);
      beginShowPhase();
    },
    [beginShowPhase]
  );

  const startGame = useCallback(() => {
    gameIdRef.current++;
    setScores([]);
    setTotalScore(0);
    startRune(0);
  }, [startRune]);

  const backToSetup = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (revealRafRef.current) cancelAnimationFrame(revealRafRef.current);
    stopTimer();
    gameIdRef.current++;
    setPhase('setup');
  };

  // Finalise DÉFINITIVEMENT le résultat de cette rune (tracé terminé à
  // temps, OU dernière chance épuisée) — pas de retour en arrière possible.
  const finalizeAttempt = useCallback(() => {
    const rune = RUNES[runeIndexRef.current];
    const score = scoreTrace(rune.points, userPointsRef.current);
    setLastScore(score);
    setPhase('result');
  }, []);
  const finalizeAttemptRef = useRef(finalizeAttempt);
  finalizeAttemptRef.current = finalizeAttempt;

  // Le joueur a levé le doigt lui-même, À TEMPS -> définitif, pas de retour
  // en arrière possible même s'il n'aime pas le résultat.
  const handleRelease = useCallback(() => {
    if (phaseRef.current !== 'drawing') return;
    stopTimer();
    finalizeAttemptRef.current();
  }, []);
  const handleReleaseRef = useRef(handleRelease);
  handleReleaseRef.current = handleRelease;

  // Le temps s'est épuisé AVANT que le joueur ait fini -> consomme une
  // chance ; s'il en reste, relance automatiquement un nouvel essai (avec
  // un bref message) ; sinon, le tracé partiel devient le résultat définitif.
  const handleTimeout = useCallback(() => {
    if (phaseRef.current !== 'drawing') return;
    attemptsLeftRef.current = Math.max(0, attemptsLeftRef.current - 1);
    setAttemptsLeft(attemptsLeftRef.current);
    if (attemptsLeftRef.current > 0) {
      setPhase('timeout');
      timeoutRef.current = setTimeout(() => {
        beginShowPhase();
      }, TIMEOUT_MSG_DURATION);
    } else {
      finalizeAttemptRef.current();
    }
  }, [beginShowPhase]);
  handleTimeoutRef.current = handleTimeout;

  const goNext = () => {
    const finalScoreForRune = lastScore || 0;
    setTotalScore((s) => s + finalScoreForRune);
    const newScores = [...scores, finalScoreForRune];
    setScores(newScores);
    const next = runeIndex + 1;
    if (next >= RUNES.length) {
      setPhase('final');
      const avg = newScores.reduce((a, b) => a + b, 0) / newScores.length;
      const gain = coinsForAverage(avg);
      if (gain > 0) addCoinsLimited('runetracer', gain);
    } else {
      startRune(next);
    }
  };

  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;

  const drawResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current === 'drawing',
      onMoveShouldSetPanResponder: () => phaseRef.current === 'drawing',
      onPanResponderGrant: (evt, gestureState) => {
        userPointsRef.current = [];
        const x = (gestureState.x0 - canvasOriginRef.current.x) / canvasSizeRef.current;
        const y = (gestureState.y0 - canvasOriginRef.current.y) / canvasSizeRef.current;
        userPointsRef.current.push({ x, y });
        bump();
      },
      onPanResponderMove: (evt, gestureState) => {
        const x = (gestureState.moveX - canvasOriginRef.current.x) / canvasSizeRef.current;
        const y = (gestureState.moveY - canvasOriginRef.current.y) / canvasSizeRef.current;
        userPointsRef.current.push({ x, y });
        bump();
      },
      onPanResponderRelease: () => handleReleaseRef.current(),
    })
  ).current;

  if (phase === 'setup') {
    return (
      <View style={styles.screen} {...panHandlers}>
        <CoinBar />
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Retour</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.title}>✨ Traceur de Runes</Text>
        </View>
        <View style={styles.introPanel}>
          <Text style={styles.introText}>
            Une rune s'affiche quelques secondes puis disparaît. Reproduis-la du doigt le plus
            fidèlement possible en {DRAW_TIME_LIMIT}s.
          </Text>
          <Text style={styles.introText}>
            {MAX_ATTEMPTS} chances si le temps s'épuise avant que tu finisses — mais un tracé
            terminé à temps est définitif, pas de retour en arrière.
          </Text>
          <TouchableOpacity style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>Commencer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === 'final') {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const gain = coinsForAverage(avg);
    return (
      <View style={styles.screen} {...panHandlers}>
        <CoinBar />
        <View style={styles.header}>
          <TouchableOpacity onPress={backToSetup} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>✨ Traceur de Runes</Text>
        </View>
        <View style={styles.introPanel}>
          <Text style={styles.finalScoreLabel}>SCORE TOTAL</Text>
          <Text style={styles.finalScore}>{totalScore}</Text>
          <Text style={[styles.finalRating, { color: RATING_COLOR[ratingForScore(avg)] }]}>
            {ratingForScore(avg)} · {avg}% de moyenne
          </Text>
          {gain > 0 && <Text style={styles.coinGain}>🪙 +{gain} pièces</Text>}
          <TouchableOpacity style={styles.startBtn} onPress={startGame}>
            <Text style={styles.startBtnText}>🔁 Rejouer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const rune = RUNES[runeIndex];
  const showShape = phase === 'showing' || phase === 'fading';

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={backToSetup} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{totalScore}</Text>
        </View>
      </View>
      <Text style={styles.runeCounter}>RUNE {runeIndex + 1} / {RUNES.length}</Text>

      <View style={styles.progressRow}>
        {RUNES.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= runeIndex && styles.progressDotDone]} />
        ))}
      </View>

      <Text style={styles.runeName}>{rune.name}</Text>
      <Text style={styles.runeDesc}>{rune.desc}</Text>
      <View style={styles.diffBadge}>
        <Text style={styles.diffBadgeText}>{rune.difficulty}</Text>
      </View>

      <View style={styles.canvasWrap}>
        <View
          ref={canvasViewRef}
          onLayout={handleCanvasLayout}
          style={[styles.canvas, { width: canvasSize, height: canvasSize }]}
          {...(phase === 'drawing' ? drawResponder.panHandlers : {})}
        >
          <View pointerEvents="none" style={styles.canvasGuideBorder} />

          {showShape && (
            <View pointerEvents="none" style={{ opacity: phase === 'fading' ? 0.15 : 1 }}>
              {segmentsFor(revealedPoints(rune.points, revealProgressRef.current), canvasSize).map((seg, i) => (
                <Segment key={i} {...seg} color={COLORS.drawn} thickness={5} glow />
              ))}
            </View>
          )}

          {phase === 'drawing' &&
            segmentsFor(userPointsRef.current, canvasSize).map((seg, i) => (
              <Segment key={i} {...seg} color={COLORS.drawn} thickness={5} glow />
            ))}

          {phase === 'timeout' && (
            <View style={styles.timeoutOverlay} pointerEvents="none">
              <Text style={styles.timeoutText}>⏱ Temps écoulé !</Text>
              <Text style={styles.timeoutSubtext}>Nouvel essai…</Text>
            </View>
          )}

          {phase === 'result' && (
            <>
              {segmentsFor(rune.points, canvasSize).map((seg, i) => (
                <Segment key={'ref' + i} {...seg} color={COLORS.guide} thickness={3} />
              ))}
              {segmentsFor(userPointsRef.current, canvasSize).map((seg, i) => (
                <Segment key={'usr' + i} {...seg} color={COLORS.drawn} thickness={5} glow />
              ))}
            </>
          )}
        </View>
      </View>

      {phase === 'showing' && <Text style={styles.hintText}>Mémorise la forme…</Text>}

      {phase === 'drawing' && (
        <View style={styles.timerSection}>
          <Text style={styles.hintText}>À toi de tracer !</Text>
          <View style={styles.timeBarTrack}>
            <View
              style={[
                styles.timeBarFill,
                { width: `${(timeLeft / DRAW_TIME_LIMIT) * 100}%` },
                timeLeft <= 2 && styles.timeBarFillUrgent,
              ]}
            />
          </View>
          <View style={styles.timerFooterRow}>
            <Text style={styles.chancesLabel}>CHANCES</Text>
            <View style={styles.castsRow}>
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <View key={i} style={[styles.castDot, i < MAX_ATTEMPTS - attemptsLeft && styles.castDotUsed]} />
              ))}
            </View>
            <Text style={styles.timerText}>{timeLeft.toFixed(1)}s</Text>
          </View>
        </View>
      )}

      {phase === 'result' && lastScore !== null && (
        <View style={styles.resultPanel}>
          <Text style={styles.resultScore}>{lastScore}%</Text>
          <Text style={[styles.resultRating, { color: RATING_COLOR[ratingForScore(lastScore)] }]}>{ratingForScore(lastScore)}</Text>
          <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
            <Text style={styles.nextBtnText}>{runeIndex + 1 >= RUNES.length ? 'Voir le résultat' : 'Suivant →'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function revealedPoints(points, progress) {
  if (progress >= 1) return points;
  if (progress <= 0) return [points[0]];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const target = total * progress;
  const result = [points[0]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (acc + segLen >= target) {
      const t = segLen < 1e-9 ? 0 : (target - acc) / segLen;
      result.push({ x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t });
      return result;
    }
    acc += segLen;
    result.push(points[i]);
  }
  return points;
}

function segmentsFor(points, size) {
  const segs = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const x1 = a.x * size, y1 = a.y * size, x2 = b.x * size, y2 = b.y * size;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segs.push({ x: x1, y: y1, len, angle });
  }
  return segs;
}

function Segment({ x, y, len, angle, color, thickness, glow }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y - thickness / 2,
        width: len,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: '0 50%',
        shadowColor: glow ? color : undefined,
        shadowOpacity: glow ? 0.9 : 0,
        shadowRadius: glow ? 6 : 0,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },

  scoreBox: { marginLeft: 'auto', alignItems: 'flex-end' },
  scoreLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  scoreValue: { color: COLORS.text, fontSize: 20, fontWeight: '900' },

  runeCounter: { color: COLORS.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 4 },

  progressRow: { flexDirection: 'row', gap: 4, marginTop: 4, marginBottom: 10 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2a2350' },
  progressDotDone: { backgroundColor: COLORS.guide },

  runeName: { color: COLORS.guide, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  runeDesc: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 2 },
  diffBadge: { alignSelf: 'center', backgroundColor: 'rgba(62,198,240,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 6 },
  diffBadgeText: { color: COLORS.guide, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  canvasWrap: { alignItems: 'center', marginTop: 12 },
  canvas: { backgroundColor: COLORS.panel, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  canvasGuideBorder: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20 },

  timeoutOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  timeoutText: { color: '#FF5252', fontSize: 22, fontWeight: '900' },
  timeoutSubtext: { color: COLORS.muted, fontSize: 13, fontWeight: '700', marginTop: 6 },

  hintText: { color: COLORS.muted, textAlign: 'center', fontSize: 12, fontWeight: '700' },

  // Minuteur en BAS avec barre qui se vide, comme demandé
  timerSection: { marginTop: 12, alignItems: 'stretch' },
  timeBarTrack: { height: 10, borderRadius: 5, backgroundColor: '#241d42', overflow: 'hidden', marginTop: 8 },
  timeBarFill: { height: '100%', backgroundColor: COLORS.guide, borderRadius: 5 },
  timeBarFillUrgent: { backgroundColor: '#FF5252' },
  timerFooterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  chancesLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  timerText: { color: COLORS.text, fontSize: 13, fontWeight: '800', marginLeft: 'auto' },

  castsRow: { flexDirection: 'row', gap: 8, marginLeft: 10 },
  castDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#2a2350', borderWidth: 1, borderColor: COLORS.border },
  castDotUsed: { backgroundColor: '#FF5252', borderColor: '#FF5252' },

  resultPanel: { alignItems: 'center', marginTop: 14 },
  resultScore: { color: COLORS.text, fontSize: 36, fontWeight: '900' },
  resultRating: { fontSize: 14, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  nextBtn: { backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 26, marginTop: 14 },
  nextBtnText: { color: '#241a00', fontSize: 14, fontWeight: '800' },

  introPanel: { marginTop: 24, alignItems: 'center', paddingHorizontal: 8 },
  introText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  startBtn: { backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 20 },
  startBtnText: { color: '#241a00', fontSize: 15, fontWeight: '800' },
  finalScoreLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  finalScore: { color: COLORS.text, fontSize: 56, fontWeight: '900', marginTop: 4 },
  finalRating: { fontSize: 15, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  coinGain: { color: COLORS.action, fontSize: 14, fontWeight: '800', marginTop: 10 },
});

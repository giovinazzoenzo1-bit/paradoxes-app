// Traceur de Runes — nouveau jeu (pas un port du PWA). Principe : une
// forme ("rune") s'affiche brièvement, disparaît, le joueur doit la
// reproduire du doigt le plus fidèlement possible ; le score est un % de
// similarité entre le tracé du joueur et la forme de référence. Univers et
// noms 100% originaux (voir runeTracerLogic.js) — pas de sorts Harry
// Potter, qui sont une propriété intellectuelle protégée.
// Leçons retenues des jeux précédents appliquées dès le départ :
// - Position tactile mesurée en absolu (ref + .measure()) + gestureState,
//   jamais locationX/Y.
// - Toute valeur lue dans un callback PanResponder mémorisé passe par une
//   ref à jour, jamais une variable d'état capturée.
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

const SHOW_HOLD_DURATION = 450; // pause une fois la forme entièrement dessinée
const FADE_DURATION = 350;
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

// Durée du dessin progressif proportionnelle à la complexité de la forme
// (nombre de segments) — une forme simple (croix, triangle) se trace vite,
// une forme plus riche (étoile, spirale) a plus de temps pour rester
// lisible. Répond au retour "formes pas trop compliquées" : au moins
// autant de temps que nécessaire pour bien la mémoriser.
function dimsForRune(rune) {
  const segments = rune.points.length;
  const duration = Math.max(1100, Math.min(2600, 700 + segments * 22));
  return { duration };
}

export default function RuneTracerScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);
  const { width: WIN_W, height: WIN_H } = useWindowDimensions();

  const [phase, setPhase] = useState('setup');
  const [runeIndex, setRuneIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [lastScore, setLastScore] = useState(null);
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const phaseRef = useRef('setup');
  phaseRef.current = phase;
  const runeIndexRef = useRef(0);
  runeIndexRef.current = runeIndex;
  const userPointsRef = useRef([]);
  const timeoutRef = useRef(null);
  const gameIdRef = useRef(0);

  const canvasSize = Math.min(WIN_W - 40, WIN_H - 340, 420);

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

  // Anime le dessin progressif de la forme (comme le vrai jeu de référence :
  // la forme se trace elle-même trait par trait, plutôt que d'apparaître
  // d'un coup) — demande explicite de l'utilisateur.
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
        timeoutRef.current = setTimeout(() => setPhase('drawing'), FADE_DURATION);
      }, SHOW_HOLD_DURATION);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRune = useCallback((index) => {
    userPointsRef.current = [];
    setLastScore(null);
    setRuneIndex(index);
    setPhase('showing');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (revealRafRef.current) cancelAnimationFrame(revealRafRef.current);
    revealProgressRef.current = 0;
    revealStartRef.current = performance.now();
    revealRafRef.current = requestAnimationFrame(animateReveal);
  }, [animateReveal]);

  const startGame = useCallback(() => {
    gameIdRef.current++;
    setScores([]);
    startRune(0);
  }, [startRune]);

  const backToSetup = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (revealRafRef.current) cancelAnimationFrame(revealRafRef.current);
    gameIdRef.current++;
    setPhase('setup');
  };

  const finishStroke = useCallback(() => {
    if (phaseRef.current !== 'drawing') return;
    const rune = RUNES[runeIndex];
    const score = scoreTrace(rune.points, userPointsRef.current, rune.closed);
    setLastScore(score);
    setScores((prev) => [...prev, score]);
    setPhase('result');
  }, [runeIndex]);

  const goNext = () => {
    const next = runeIndex + 1;
    if (next >= RUNES.length) {
      setPhase('final');
      const total = [...scores];
      const avg = total.reduce((a, b) => a + b, 0) / total.length;
      const gain = coinsForAverage(avg);
      if (gain > 0) addCoinsLimited('runetracer', gain);
    } else {
      startRune(next);
    }
  };

  const drawResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => phaseRef.current === 'drawing',
      onMoveShouldSetPanResponder: () => phaseRef.current === 'drawing',
      onPanResponderGrant: (evt, gestureState) => {
        userPointsRef.current = [];
        const x = (gestureState.x0 - canvasOriginRef.current.x) / canvasSize;
        const y = (gestureState.y0 - canvasOriginRef.current.y) / canvasSize;
        userPointsRef.current.push({ x, y });
        bump();
      },
      onPanResponderMove: (evt, gestureState) => {
        const x = (gestureState.moveX - canvasOriginRef.current.x) / canvasSize;
        const y = (gestureState.moveY - canvasOriginRef.current.y) / canvasSize;
        userPointsRef.current.push({ x, y });
        bump();
      },
      onPanResponderRelease: () => finishStroke(),
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
            fidèlement possible — ton score est le % de ressemblance avec le tracé original.
          </Text>
          <Text style={styles.introText}>10 runes par manche, difficulté croissante.</Text>
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
          <Text style={styles.finalScore}>{avg}%</Text>
          <Text style={[styles.finalRating, { color: RATING_COLOR[ratingForScore(avg)] }]}>{ratingForScore(avg)}</Text>
          <Text style={styles.introText}>Moyenne sur les 10 runes.</Text>
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
        <Text style={styles.runeCounter}>RUNE {runeIndex + 1} / {RUNES.length}</Text>
      </View>

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
      {phase === 'drawing' && <Text style={styles.hintText}>À toi de tracer !</Text>}

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

// Retourne la portion du tracé de référence correspondant à la fraction
// "progress" (0..1) de sa LONGUEUR (pas juste du nombre de points, sinon
// des segments très courts/longs feraient avancer le dessin de façon
// irrégulière) — donne l'effet "la forme se trace elle-même" demandé.
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  runeCounter: { color: COLORS.muted, fontSize: 12, fontWeight: '800', marginLeft: 'auto', letterSpacing: 1 },

  progressRow: { flexDirection: 'row', gap: 4, marginTop: 4, marginBottom: 10 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2a2350' },
  progressDotDone: { backgroundColor: COLORS.guide },

  runeName: { color: COLORS.guide, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  runeDesc: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 2 },
  diffBadge: { alignSelf: 'center', backgroundColor: 'rgba(62,198,240,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  diffBadgeText: { color: COLORS.guide, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  canvasWrap: { alignItems: 'center', marginTop: 16 },
  canvas: { backgroundColor: COLORS.panel, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  canvasGuideBorder: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20 },

  hintText: { color: COLORS.muted, textAlign: 'center', marginTop: 12, fontSize: 12, fontWeight: '700' },

  resultPanel: { alignItems: 'center', marginTop: 14 },
  resultScore: { color: COLORS.text, fontSize: 36, fontWeight: '900' },
  resultRating: { fontSize: 14, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  nextBtn: { backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 26, marginTop: 14 },
  nextBtnText: { color: '#241a00', fontSize: 14, fontWeight: '800' },

  introPanel: { marginTop: 24, alignItems: 'center', paddingHorizontal: 8 },
  introText: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  startBtn: { backgroundColor: COLORS.action, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 20 },
  startBtnText: { color: '#241a00', fontSize: 15, fontWeight: '800' },
  finalScore: { color: COLORS.text, fontSize: 48, fontWeight: '900', marginTop: 12 },
  finalRating: { fontSize: 16, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  coinGain: { color: COLORS.action, fontSize: 14, fontWeight: '800', marginTop: 10 },
});

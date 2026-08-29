// Billard 8-ball — port fidèle des RÈGLES et de l'IA du PWA (index.html),
// avec un moteur physique maison à la place de Matter.js (voir
// billiardPhysics.js) et un rendu 100% Views RN à la place du <canvas>
// (voir billiardLogic.js pour les transformations de coordonnées, mêmes
// formules que bilGameToCanvas/bilCanvasToGame). Simplifications visuelles
// assumées (gameplay/règles/physique 100% fidèles, seul le "polish" cosmétique
// est allégé) :
//  - Pas d'animation de recul de queue avant le tir (130ms dans le PWA) — le
//    tir part directement au appui sur TIRER.
//  - Ligne de visée en trait plein semi-transparent au lieu de pointillés
//    (RN ne supporte pas nativement les traits pointillés arbitraires).
//  - Queue de billard en couleur unie au lieu d'un dégradé bois.
//  - Pas de confettis/étoiles de victoire animées.
// Coins-config.js : 5 pièces si victoire contre le bot (mode "bot" only,
// comme le PWA).
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import {
  TABLE_W,
  TABLE_H,
  BALL_R,
  POCKETS,
  MAX_POWER,
  stepPhysics,
  checkPockets,
  allStopped,
  setupRack,
} from '../../games/billiard/billiardPhysics';
import {
  evaluateShot,
  computeAimPreview,
  botPickShot,
  botPlaceCuePos,
  isValidCuePlacement,
  gameToScreen,
  screenToGame,
} from '../../games/billiard/billiardLogic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#141721',
  wood: '#6b4226',
  felt: '#1f7a45',
  pocket: '#111111',
  text: '#eef0f6',
  muted: '#8d93ab',
  action: '#f5b942',
};

const COINS_WIN = 5;
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const CONTROL_W = 64;
const HEADER_H = 90;
const STATUS_H = 24;
const AVAIL_W = SCREEN_W - 24 - CONTROL_W;
const AVAIL_H = SCREEN_H - HEADER_H - STATUS_H - 140;
let TABLE_AREA_H = AVAIL_H;
let TABLE_AREA_W = TABLE_AREA_H * (TABLE_H / TABLE_W);
if (TABLE_AREA_W > AVAIL_W) {
  TABLE_AREA_W = AVAIL_W;
  TABLE_AREA_H = TABLE_AREA_W * (TABLE_W / TABLE_H);
}
const SCALE = TABLE_AREA_W / TABLE_H;
const RAIL_W = 16 * SCALE;

function toScreen(gx, gy) {
  return gameToScreen(gx, gy, SCALE, TABLE_AREA_W, TABLE_AREA_H, true);
}

export default function BilliardScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const panHandlers = useBackGesture(onBack);

  const [phase, setPhase] = useState('setup');
  const [mode, setMode] = useState('solo');
  const [gameState, setGameState] = useState('aim');
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [playerGroups, setPlayerGroups] = useState({ 1: null, 2: null });
  const [groupsAssigned, setGroupsAssigned] = useState(false);
  const [status, setStatus] = useState('');
  const [power, setPower] = useState(0);
  const [aimDir, setAimDir] = useState(null);
  const [, setRenderTick] = useState(0);
  const [endInfo, setEndInfo] = useState(null);

  const ballsRef = useRef([]);
  const aimingActiveRef = useRef(false);
  const rafRef = useRef(null);
  const shotFactsRef = useRef(null);
  const ownRemainingSnapshotRef = useRef(0);
  const gameIdRef = useRef(0);
  const botTimeoutRef = useRef(null);
  const shotStartRef = useRef(0);

  const bump = () => setRenderTick((t) => t + 1);

  const respawnCue = (pos) => {
    const cue = ballsRef.current[0];
    cue.pocketed = false;
    cue.pos = { x: pos.x, y: pos.y };
    cue.vel = { x: 0, y: 0 };
  };

  const turnLabel = (player) => (mode === 'bot' && player === 2 ? 'BOT' : `Joueur ${player}`);

  const startGame = useCallback((selectedMode) => {
    gameIdRef.current++;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    ballsRef.current = setupRack();
    setMode(selectedMode);
    setGameState('aim');
    setCurrentPlayer(1);
    setPlayerGroups({ 1: null, 2: null });
    setGroupsAssigned(false);
    setEndInfo(null);
    setAimDir(null);
    setPower(0);
    setStatus(selectedMode === 'solo' ? 'Entraînement libre' : 'Tour : Joueur 1');
    setPhase('table');
    bump();
  }, []);

  const backToSetup = () => {
    gameIdRef.current++;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase('setup');
  };

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    },
    []
  );

  const showEndgame = useCallback(
    (winnerPlayer, reason) => {
      if (mode === 'bot' && winnerPlayer === 1) {
        addCoinsLimited('billard', COINS_WIN);
      }
      const label = mode === 'bot' ? (winnerPlayer === 1 ? 'TU GAGNES !' : 'LE BOT GAGNE') : `JOUEUR ${winnerPlayer} GAGNE !`;
      setEndInfo({ label, reason });
    },
    [mode, addCoinsLimited]
  );

  const fireShotRef = useRef(null);

  const maybeBotTurn = useCallback(() => {
    if (mode !== 'bot') return;
    const gid = gameIdRef.current;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    botTimeoutRef.current = setTimeout(() => {
      if (gid !== gameIdRef.current) return;
      setCurrentPlayer((cp) => {
        if (cp !== 2) return cp;
        setGameState((gs) => {
          if (gs === 'placing') {
            const pos = botPlaceCuePos(ballsRef.current);
            respawnCue(pos);
            setStatus(`Tour : ${turnLabel(2)}`);
            bump();
            return 'aim';
          }
          if (gs === 'aim') {
            setGroupsAssigned((ga) => {
              setPlayerGroups((pg) => {
                const group = ga ? pg[2] : null;
                let shot;
                try {
                  shot = botPickShot(ballsRef.current, group);
                  if (!shot || !isFinite(shot.dir.x) || !isFinite(shot.dir.y) || !isFinite(shot.power)) throw new Error('invalid');
                } catch (e) {
                  shot = { dir: { x: 0, y: -1 }, power: MAX_POWER * 0.4 };
                }
                fireShotRef.current(shot.dir.x * shot.power, shot.dir.y * shot.power);
                return pg;
              });
              return ga;
            });
          }
          return gs;
        });
        return cp;
      });
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onShotSettled = useCallback(() => {
    if (mode === 'solo') {
      if (ballsRef.current[0].pocketed) respawnCue({ x: TABLE_W * 0.25, y: TABLE_H / 2 });
      setGameState('aim');
      setStatus('Entraînement libre');
      bump();
      return;
    }
    setCurrentPlayer((cp) => {
      setGroupsAssigned((ga) => {
        setPlayerGroups((pg) => {
          const currentGroup = ga ? pg[cp] : null;
          const res = evaluateShot(currentGroup, ga, {
            ...shotFactsRef.current,
            ownGroupBallsRemainingBeforeShot: ownRemainingSnapshotRef.current,
          });
          let newGA = ga;
          let newPG = pg;
          if (res.assignGroup && !ga) {
            newGA = true;
            newPG = { ...pg, [cp]: res.assignGroup, [cp === 1 ? 2 : 1]: res.assignGroup === 'solid' ? 'stripe' : 'solid' };
          }
          if (res.gameOver) {
            const winnerPlayer = res.winner === 'player' ? cp : cp === 1 ? 2 : 1;
            showEndgame(winnerPlayer, res.reason);
            setGroupsAssigned(newGA);
            return newPG;
          }
          if (ballsRef.current[0].pocketed) respawnCue({ x: TABLE_W * 0.25, y: TABLE_H / 2 });
          let nextPlayer = cp;
          if (res.foul) {
            nextPlayer = cp === 1 ? 2 : 1;
            setGameState('placing');
            setStatus(`🟥 Faute (${res.reason}) — bille en main, tape la table (${turnLabel(nextPlayer)})`);
          } else if (res.continueTurn) {
            setGameState('aim');
            setStatus(`🟩 Rejoue, ${turnLabel(cp)}`);
          } else {
            nextPlayer = cp === 1 ? 2 : 1;
            setGameState('aim');
            setStatus(`Tour : ${turnLabel(nextPlayer)}`);
          }
          setCurrentPlayer(nextPlayer);
          setGroupsAssigned(newGA);
          bump();
          setTimeout(() => maybeBotTurn(), 0);
          return newPG;
        });
        return ga;
      });
      return cp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, showEndgame, maybeBotTurn]);

  const animateRef = useRef(null);
  const animate = useCallback(() => {
    stepPhysics(ballsRef.current, shotFactsRef.current);
    checkPockets(ballsRef.current, shotFactsRef.current);
    bump();
    const stuck = performance.now() - shotStartRef.current > 6000;
    if (allStopped(ballsRef.current) || stuck) {
      if (stuck) ballsRef.current.forEach((b) => { if (!b.pocketed) b.vel = { x: 0, y: 0 }; });
      onShotSettled();
    } else {
      rafRef.current = requestAnimationFrame(animateRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onShotSettled]);
  animateRef.current = animate;

  const fireShot = useCallback((vx, vy) => {
    if (!isFinite(vx) || !isFinite(vy)) {
      vx = 0;
      vy = -8;
    }
    ballsRef.current[0].vel = { x: vx, y: vy };
    shotFactsRef.current = { firstContactGroup: null, cueScratched: false, pocketedBalls: [], railAfterContact: false, ballBallContacts: new Set(), railContacts: new Set() };
    setPlayerGroups((pg) => {
      setGroupsAssigned((ga) => {
        setCurrentPlayer((cp) => {
          const currentGroup = ga ? pg[cp] : null;
          ownRemainingSnapshotRef.current = currentGroup ? ballsRef.current.filter((b) => b.group === currentGroup && !b.pocketed).length : 0;
          return cp;
        });
        return ga;
      });
      return pg;
    });
    setGameState('sim');
    setAimDir(null);
    setPower(0);
    shotStartRef.current = performance.now();
    rafRef.current = requestAnimationFrame(animateRef.current);
  }, []);
  fireShotRef.current = fireShot;

  const confirmFire = () => {
    if (!aimDir || power <= MAX_POWER * 0.05 || gameState !== 'aim') return;
    fireShot(aimDir.x * power, aimDir.y * power);
  };

  const tryPlaceCue = (pos) => {
    if (!isValidCuePlacement(ballsRef.current, pos)) return;
    respawnCue(pos);
    setGameState('aim');
    setStatus(`Tour : ${turnLabel(currentPlayer)}`);
    bump();
  };

  const canInteract = !(mode === 'bot' && currentPlayer === 2);

  const updateAim = (pos) => {
    const cue = ballsRef.current[0];
    const dx = pos.x - cue.pos.x;
    const dy = pos.y - cue.pos.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    setAimDir({ x: dx / len, y: dy / len });
  };

  const tablePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => canInteract && (gameState === 'aim' || gameState === 'placing'),
      onMoveShouldSetPanResponder: () => canInteract && gameState === 'aim',
      onPanResponderGrant: (evt) => {
        if (gameState === 'placing') return;
        const pos = screenToGame(evt.nativeEvent.locationX, evt.nativeEvent.locationY, SCALE, TABLE_AREA_W, TABLE_AREA_H, true);
        aimingActiveRef.current = true;
        updateAim(pos);
      },
      onPanResponderMove: (evt) => {
        if (!aimingActiveRef.current) return;
        const pos = screenToGame(evt.nativeEvent.locationX, evt.nativeEvent.locationY, SCALE, TABLE_AREA_W, TABLE_AREA_H, true);
        updateAim(pos);
      },
      onPanResponderRelease: (evt) => {
        aimingActiveRef.current = false;
        if (gameState === 'placing') {
          const pos = screenToGame(evt.nativeEvent.locationX, evt.nativeEvent.locationY, SCALE, TABLE_AREA_W, TABLE_AREA_H, true);
          tryPlaceCue(pos);
        }
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ).current;

  const POWER_BAR_H = 160;
  const setPowerFromBar = (y) => {
    const frac = Math.max(0, Math.min(1, 1 - y / POWER_BAR_H));
    setPower(frac * MAX_POWER);
  };

  const powerBarResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameState === 'aim',
      onMoveShouldSetPanResponder: () => gameState === 'aim',
      onPanResponderGrant: (evt) => setPowerFromBar(evt.nativeEvent.locationY),
      onPanResponderMove: (evt) => setPowerFromBar(evt.nativeEvent.locationY),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Text style={styles.title}>🎱 Billard</Text>
        </View>
        <View style={styles.setupPanel}>
          <TouchableOpacity style={styles.modeCard} onPress={() => startGame('solo')}>
            <Text style={styles.modeTitle}>🎯 Entraînement</Text>
            <Text style={styles.modeDesc}>Solo libre, sans règles ni adversaire.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeCard} onPress={() => startGame('bot')}>
            <Text style={styles.modeTitle}>🤖 Contre le bot</Text>
            <Text style={styles.modeDesc}>🪙 {COINS_WIN} pièces si tu gagnes.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeCard} onPress={() => startGame('pass')}>
            <Text style={styles.modeTitle}>🧑‍🤝‍🧑 Pass & Play</Text>
            <Text style={styles.modeDesc}>2 joueurs, un seul téléphone.</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const balls = ballsRef.current;
  const cue = balls[0];
  const preview = aimDir && gameState === 'aim' ? computeAimPreview(balls, cue, aimDir.x, aimDir.y) : null;
  const cueScreen = cue && !cue.pocketed ? toScreen(cue.pos.x, cue.pos.y) : null;

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={backToSetup} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.modeBadge}>{mode === 'solo' ? 'ENTRAÎNEMENT' : mode === 'bot' ? 'VS BOT' : 'PASS & PLAY'}</Text>
      </View>

      {mode !== 'solo' && (
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreText, currentPlayer === 1 && styles.scoreActive]}>
            Joueur 1 {playerGroups[1] ? `(${playerGroups[1] === 'solid' ? 'Pleines' : 'Rayées'})` : ''}
          </Text>
          <Text style={styles.vs}>VS</Text>
          <Text style={[styles.scoreText, currentPlayer === 2 && styles.scoreActive]}>
            {mode === 'bot' ? 'Bot' : 'Joueur 2'} {playerGroups[2] ? `(${playerGroups[2] === 'solid' ? 'Pleines' : 'Rayées'})` : ''}
          </Text>
        </View>
      )}

      <Text style={styles.status} numberOfLines={2}>{status}</Text>

      <View style={styles.tableRow}>
        <View style={[styles.tableArea, { width: TABLE_AREA_W, height: TABLE_AREA_H }]} {...tablePanResponder.panHandlers}>
          <View style={styles.felt} pointerEvents="none" />

          {POCKETS.map((p, i) => {
            const s = toScreen(p.x, p.y);
            const r = p.r * SCALE;
            return <View key={i} pointerEvents="none" style={[styles.pocket, { left: s.x - r, top: s.y - r, width: r * 2, height: r * 2, borderRadius: r }]} />;
          })}

          {preview && cueScreen && (
            <>
              <AimLine from={cueScreen} to={toScreen(preview.end.x, preview.end.y)} />
              <GhostBall center={toScreen(preview.end.x, preview.end.y)} r={BALL_R * SCALE} />
              {preview.targetBall && (
                <AimLine
                  from={toScreen(preview.targetBall.pos.x, preview.targetBall.pos.y)}
                  to={toScreen(preview.targetBall.pos.x + preview.targetDir.x * 50, preview.targetBall.pos.y + preview.targetDir.y * 50)}
                  thin
                />
              )}
              <CueStick cueScreen={cueScreen} dir={aimDir} pullback={30 + (power / MAX_POWER) * 90} scale={SCALE} />
            </>
          )}

          {balls.map((ball, i) => {
            if (ball.pocketed) return null;
            const s = toScreen(ball.pos.x, ball.pos.y);
            const r = BALL_R * SCALE;
            return (
              <View key={i} pointerEvents="none" style={[styles.ball, { left: s.x - r, top: s.y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: ball.color }]}>
                {ball.group === 'stripe' && <View style={[styles.stripeCenter, { width: r * 1.1, height: r * 1.1, borderRadius: r * 0.55 }]} />}
                <View style={[styles.glossy, { width: r * 0.56, height: r * 0.56, borderRadius: r * 0.28, left: r * 0.28, top: r * 0.28 }]} />
              </View>
            );
          })}
        </View>

        <View style={styles.controlCol}>
          <View style={styles.powerBarWrap} {...powerBarResponder.panHandlers}>
            <View style={[styles.powerBarFill, { height: `${(power / MAX_POWER) * 100}%` }]} />
          </View>
          <Text style={styles.powerPct}>{Math.round((power / MAX_POWER) * 100)}%</Text>
          <TouchableOpacity
            style={[styles.fireBtn, !(aimDir && power > MAX_POWER * 0.05 && gameState === 'aim') && styles.fireBtnDisabled]}
            onPress={confirmFire}
            disabled={!(aimDir && power > MAX_POWER * 0.05 && gameState === 'aim')}
          >
            <Text style={styles.fireBtnText}>TIRER</Text>
          </TouchableOpacity>
        </View>
      </View>

      {endInfo && (
        <View style={styles.endOverlay}>
          <Text style={styles.endTitle}>{endInfo.label}</Text>
          <Text style={styles.endReason}>{endInfo.reason}</Text>
          <TouchableOpacity style={styles.replayBtn} onPress={() => startGame(mode)}>
            <Text style={styles.replayBtnText}>🔁 Rejouer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.changeModeBtn} onPress={backToSetup}>
            <Text style={styles.changeModeBtnText}>Changer de mode</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function AimLine({ from, to, thin }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: from.x,
        top: from.y - (thin ? 1 : 1.5),
        width: len,
        height: thin ? 2 : 3,
        backgroundColor: 'rgba(180,255,220,0.6)',
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: '0 50%',
      }}
    />
  );
}

function GhostBall({ center, r }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: center.x - r,
        top: center.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        backgroundColor: 'rgba(255,255,255,0.35)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.7)',
      }}
    />
  );
}

function CueStick({ cueScreen, dir, pullback, scale }) {
  const len = 170 * scale;
  const backX = cueScreen.x - dir.x * pullback * scale;
  const backY = cueScreen.y - dir.y * pullback * scale;
  const tipX = cueScreen.x - dir.x * (pullback + 170) * scale;
  const tipY = cueScreen.y - dir.y * (pullback + 170) * scale;
  const dx = tipX - backX;
  const dy = tipY - backY;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: backX,
        top: backY - 3.5,
        width: len,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#c9a06e',
        transform: [{ rotate: `${angle}deg` }],
        transformOrigin: '0 50%',
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  modeBadge: { color: COLORS.action, fontSize: 12, fontWeight: '800', marginLeft: 'auto' },

  setupPanel: { marginTop: 8, gap: 12 },
  modeCard: { backgroundColor: '#1c2032', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2f45' },
  modeTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  modeDesc: { color: COLORS.muted, fontSize: 12, marginTop: 4 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
  scoreText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  scoreActive: { color: COLORS.action },
  vs: { color: COLORS.muted, fontSize: 10 },

  status: { color: COLORS.text, textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 6, minHeight: 30 },

  tableRow: { flexDirection: 'row', marginTop: 6, gap: 8, alignSelf: 'center' },
  tableArea: { backgroundColor: COLORS.wood, borderRadius: 8, overflow: 'hidden' },
  felt: {
    position: 'absolute',
    left: RAIL_W,
    top: RAIL_W,
    right: RAIL_W,
    bottom: RAIL_W,
    backgroundColor: COLORS.felt,
    borderRadius: 4,
  },
  pocket: { position: 'absolute', backgroundColor: COLORS.pocket },
  ball: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  stripeCenter: { position: 'absolute', backgroundColor: '#f4f1ea' },
  glossy: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)' },

  controlCol: { width: CONTROL_W, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 },
  powerBarWrap: {
    width: 28,
    height: 160,
    backgroundColor: '#1c2032',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2f45',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  powerBarFill: { backgroundColor: '#FF5252', width: '100%' },
  powerPct: { color: COLORS.muted, fontSize: 10, marginTop: 4, marginBottom: 10 },
  fireBtn: { backgroundColor: COLORS.action, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 10 },
  fireBtnDisabled: { opacity: 0.35 },
  fireBtnText: { color: '#1a1300', fontSize: 12, fontWeight: '900' },

  endOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '35%',
    backgroundColor: '#1c2032',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2f45',
  },
  endTitle: { color: COLORS.action, fontSize: 20, fontWeight: '900' },
  endReason: { color: COLORS.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },
  replayBtn: { marginTop: 16, backgroundColor: '#00E676', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  replayBtnText: { color: '#04120c', fontSize: 15, fontWeight: '800' },
  changeModeBtn: { marginTop: 10, paddingVertical: 6 },
  changeModeBtnText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
});

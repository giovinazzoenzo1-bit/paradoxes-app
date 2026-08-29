// Billard 8-ball — port fidèle des RÈGLES et de l'IA du PWA (index.html),
// avec un moteur physique maison à la place de Matter.js (voir
// billiardPhysics.js) et un rendu 100% Views RN à la place du <canvas>.
// Mode PAYSAGE réel (pas un simple tour de coordonnées comme le PWA) :
// verrouillage physique de l'orientation de l'écran via
// expo-screen-orientation à l'entrée du jeu, restauré en portrait à la
// sortie — retour utilisateur explicite ("la table est sur le côté, pas
// ouf"). Dimensions lues via useWindowDimensions (réactif à la vraie
// rotation), le tableau n'a donc plus besoin d'être "tourné" par calcul :
// TABLE_W (900, long axe) correspond à la largeur écran, TABLE_H (450,
// court axe) à la hauteur écran, directement.
// Simplifications visuelles assumées (gameplay/règles/physique 100%
// fidèles, seul le "polish" cosmétique est allégé) :
//  - Pas d'animation de recul de queue avant le tir.
//  - Ligne de visée en trait plein semi-transparent au lieu de pointillés.
//  - Queue de billard en couleur unie au lieu d'un dégradé bois.
//  - Pas de confettis/étoiles de victoire animées.
// Coins-config.js : 5 pièces si victoire contre le bot.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
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
const TOP_H = 96; // hauteur réservée en haut (retour/mode/score/statut/jauge+tirer)

export default function BilliardScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const { width: WIN_W, height: WIN_H } = useWindowDimensions();

  // Verrouille l'écran en paysage à l'entrée du billard, restaure le
  // portrait (comportement normal du reste de l'appli) à la sortie.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Table non tournée : on est en vrai paysage, TABLE_W (long axe) suit la
  // largeur écran, TABLE_H (court axe) suit la hauteur restante.
  const availW = WIN_W - 24;
  const availH = WIN_H - TOP_H - 12;
  let tableAreaW = availW;
  let tableAreaH = tableAreaW * (TABLE_H / TABLE_W);
  if (tableAreaH > availH) {
    tableAreaH = availH;
    tableAreaW = tableAreaH * (TABLE_W / TABLE_H);
  }
  const scale = tableAreaW / TABLE_W;
  const railW = 16 * scale;

  const toScreen = useCallback((gx, gy) => gameToScreen(gx, gy, scale, tableAreaW, tableAreaH, false), [scale, tableAreaW, tableAreaH]);

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

  // Refs synchronisées à chaque rendu : nécessaires car les PanResponder
  // sont créés UNE SEULE FOIS via useRef (pour ne pas perdre un geste en
  // cours), donc leurs callbacks doivent lire l'état via ces refs plutôt
  // que directement les variables d'état (sinon fermeture figée - bug déjà
  // rencontré et corrigé une première fois, voir PROJECT_STATE.md).
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const currentPlayerRef = useRef(currentPlayer);
  currentPlayerRef.current = currentPlayer;
  const dimsRef = useRef({ scale, tableAreaW, tableAreaH });
  dimsRef.current = { scale, tableAreaW, tableAreaH };

  const bump = () => setRenderTick((t) => t + 1);

  const respawnCue = (pos) => {
    const cue = ballsRef.current[0];
    cue.pocketed = false;
    cue.pos = { x: pos.x, y: pos.y };
    cue.vel = { x: 0, y: 0 };
  };

  const turnLabel = (player) => (mode === 'bot' && player === 2 ? 'BOT' : `J${player}`);

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
            setStatus(`🟥 Faute (${res.reason}) — bille en main`);
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
    setStatus(`Tour : ${turnLabel(currentPlayerRef.current)}`);
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
      onStartShouldSetPanResponder: () => {
        const canAct = !(modeRef.current === 'bot' && currentPlayerRef.current === 2);
        return canAct && (gameStateRef.current === 'aim' || gameStateRef.current === 'placing');
      },
      onMoveShouldSetPanResponder: () => {
        const canAct = !(modeRef.current === 'bot' && currentPlayerRef.current === 2);
        return canAct && gameStateRef.current === 'aim';
      },
      onPanResponderGrant: (evt) => {
        const d = dimsRef.current;
        if (gameStateRef.current === 'placing') return;
        const pos = screenToGame(evt.nativeEvent.locationX, evt.nativeEvent.locationY, d.scale, d.tableAreaW, d.tableAreaH, false);
        aimingActiveRef.current = true;
        updateAim(pos);
      },
      onPanResponderMove: (evt) => {
        if (!aimingActiveRef.current) return;
        const d = dimsRef.current;
        const pos = screenToGame(evt.nativeEvent.locationX, evt.nativeEvent.locationY, d.scale, d.tableAreaW, d.tableAreaH, false);
        updateAim(pos);
      },
      onPanResponderRelease: (evt) => {
        aimingActiveRef.current = false;
        if (gameStateRef.current === 'placing') {
          const d = dimsRef.current;
          const pos = screenToGame(evt.nativeEvent.locationX, evt.nativeEvent.locationY, d.scale, d.tableAreaW, d.tableAreaH, false);
          tryPlaceCue(pos);
        }
      },
    })
  ).current;

  // Jauge de puissance HORIZONTALE (mieux adaptée au paysage : large bande
  // au-dessus de la table plutôt qu'une colonne étroite sur le côté).
  const POWER_BAR_W = Math.max(120, tableAreaW - 90);
  const powerBarWRef = useRef(POWER_BAR_W);
  powerBarWRef.current = POWER_BAR_W;
  const setPowerFromBar = (x) => {
    const frac = Math.max(0, Math.min(1, x / powerBarWRef.current));
    setPower(frac * MAX_POWER);
  };
  const powerBarResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameStateRef.current === 'aim',
      onMoveShouldSetPanResponder: () => gameStateRef.current === 'aim',
      onPanResponderGrant: (evt) => setPowerFromBar(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => setPowerFromBar(evt.nativeEvent.locationX),
    })
  ).current;

  if (phase === 'setup') {
    return (
      <View style={styles.screen}>
        <CoinBar />
        <View style={styles.setupHeader}>
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
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={backToSetup} style={styles.backBtnSmall}>
          <Text style={styles.backText}>← {mode === 'solo' ? 'ENTRAÎNEMENT' : mode === 'bot' ? 'VS BOT' : 'PASS'}</Text>
        </TouchableOpacity>

        {mode !== 'solo' && (
          <Text style={styles.scoreText} numberOfLines={1}>
            <Text style={currentPlayer === 1 ? styles.scoreActive : null}>J1{playerGroups[1] ? `(${playerGroups[1] === 'solid' ? 'Pl' : 'Ra'})` : ''}</Text>
            {'  vs  '}
            <Text style={currentPlayer === 2 ? styles.scoreActive : null}>{mode === 'bot' ? 'Bot' : 'J2'}{playerGroups[2] ? `(${playerGroups[2] === 'solid' ? 'Pl' : 'Ra'})` : ''}</Text>
          </Text>
        )}

        <Text style={styles.status} numberOfLines={1}>{status}</Text>

        <View style={styles.powerRow}>
          <View style={[styles.powerBarWrap, { width: POWER_BAR_W }]} {...powerBarResponder.panHandlers}>
            <View style={[styles.powerBarFill, { width: `${(power / MAX_POWER) * 100}%` }]} />
            <Text style={styles.powerPct}>{Math.round((power / MAX_POWER) * 100)}%</Text>
          </View>
          <TouchableOpacity
            style={[styles.fireBtn, !(aimDir && power > MAX_POWER * 0.05 && gameState === 'aim') && styles.fireBtnDisabled]}
            onPress={confirmFire}
            disabled={!(aimDir && power > MAX_POWER * 0.05 && gameState === 'aim')}
          >
            <Text style={styles.fireBtnText}>TIRER</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tableWrap}>
        <View style={[styles.tableArea, { width: tableAreaW, height: tableAreaH }]} {...tablePanResponder.panHandlers}>
          <View style={[styles.felt, { left: railW, top: railW, right: railW, bottom: railW }]} pointerEvents="none" />

          {POCKETS.map((p, i) => {
            const s = toScreen(p.x, p.y);
            const r = p.r * scale;
            return <View key={i} pointerEvents="none" style={[styles.pocket, { left: s.x - r, top: s.y - r, width: r * 2, height: r * 2, borderRadius: r }]} />;
          })}

          {preview && cueScreen && (
            <>
              <AimLine from={cueScreen} to={toScreen(preview.end.x, preview.end.y)} />
              <GhostBall center={toScreen(preview.end.x, preview.end.y)} r={BALL_R * scale} />
              {preview.targetBall && (
                <AimLine
                  from={toScreen(preview.targetBall.pos.x, preview.targetBall.pos.y)}
                  to={toScreen(preview.targetBall.pos.x + preview.targetDir.x * 50, preview.targetBall.pos.y + preview.targetDir.y * 50)}
                  thin
                />
              )}
              <CueStick cuePos={cue.pos} dir={aimDir} pullback={30 + (power / MAX_POWER) * 90} toScreen={toScreen} />
            </>
          )}

          {balls.map((ball, i) => {
            if (ball.pocketed) return null;
            const s = toScreen(ball.pos.x, ball.pos.y);
            const r = BALL_R * scale;
            return (
              <View key={i} pointerEvents="none" style={[styles.ball, { left: s.x - r, top: s.y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: ball.color }]}>
                {ball.group === 'stripe' && <View style={[styles.stripeCenter, { width: r * 1.1, height: r * 1.1, borderRadius: r * 0.55 }]} />}
                <View style={[styles.glossy, { width: r * 0.56, height: r * 0.56, borderRadius: r * 0.28, left: r * 0.28, top: r * 0.28 }]} />
              </View>
            );
          })}
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

function CueStick({ cuePos, dir, pullback, toScreen }) {
  const backGame = { x: cuePos.x - dir.x * pullback, y: cuePos.y - dir.y * pullback };
  const tipGame = { x: cuePos.x - dir.x * (pullback + 170), y: cuePos.y - dir.y * (pullback + 170) };
  const back = toScreen(backGame.x, backGame.y);
  const tip = toScreen(tipGame.x, tipGame.y);
  const dx = tip.x - back.x;
  const dy = tip.y - back.y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: back.x,
        top: back.y - 3.5,
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
  screen: { flex: 1, backgroundColor: COLORS.bg },
  setupHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },

  setupPanel: { padding: 16, gap: 12 },
  modeCard: { backgroundColor: '#1c2032', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2f45' },
  modeTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  modeDesc: { color: COLORS.muted, fontSize: 12, marginTop: 4 },

  topBar: {
    height: TOP_H,
    paddingHorizontal: 10,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  backBtnSmall: { paddingVertical: 4, paddingHorizontal: 6 },
  scoreText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  scoreActive: { color: COLORS.action },
  status: { color: COLORS.text, fontSize: 11, fontWeight: '700', flex: 1, textAlign: 'center' },

  powerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  powerBarWrap: {
    height: 26,
    backgroundColor: '#1c2032',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#2a2f45',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  powerBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#FF5252' },
  powerPct: { color: COLORS.text, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  fireBtn: { backgroundColor: COLORS.action, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  fireBtnDisabled: { opacity: 0.35 },
  fireBtnText: { color: '#1a1300', fontSize: 12, fontWeight: '900' },

  tableWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tableArea: { backgroundColor: COLORS.wood, borderRadius: 8, overflow: 'hidden' },
  felt: { position: 'absolute', backgroundColor: COLORS.felt, borderRadius: 4 },
  pocket: { position: 'absolute', backgroundColor: COLORS.pocket },
  ball: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  stripeCenter: { position: 'absolute', backgroundColor: '#f4f1ea' },
  glossy: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)' },

  endOverlay: {
    position: 'absolute',
    left: '25%',
    right: '25%',
    top: '30%',
    backgroundColor: '#1c2032',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2f45',
  },
  endTitle: { color: COLORS.action, fontSize: 18, fontWeight: '900' },
  endReason: { color: COLORS.muted, fontSize: 11, marginTop: 6, textAlign: 'center' },
  replayBtn: { marginTop: 14, backgroundColor: '#00E676', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 20 },
  replayBtnText: { color: '#04120c', fontSize: 14, fontWeight: '800' },
  changeModeBtn: { marginTop: 8, paddingVertical: 6 },
  changeModeBtnText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
});

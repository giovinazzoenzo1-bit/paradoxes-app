// Billard 8-ball — port fidèle des RÈGLES et de l'IA du PWA (index.html),
// moteur physique maison (billiardPhysics.js — constantes de puissance/
// friction recalibrées pour un tir qui se joue sur ~2s au lieu de ~0,45s,
// voir ce fichier), rendu 100% Views RN. Mode PAYSAGE réel (rotation
// physique via expo-screen-orientation), dimensions lues via
// useWindowDimensions (réactif) ET zones sûres (useSafeAreaInsets) pour ne
// jamais laisser la table déborder sous la barre de gestes système —
// bug remonté ("table trop haute, coupée en bas").
// Disposition : barre fine en haut (retour/mode/score, "Bot vs Joueur"),
// jauge de puissance VERTICALE + bouton TIRER dans un panneau étroit à
// droite, table maximisée sur le reste de l'espace.
// Bouton/geste retour Android intercepté (BackHandler) pour naviguer dans
// l'écran plutôt que fermer l'appli.
// Animation de frappe : la queue recule (visible pendant la visée) puis
// fonce vers la bille en ~130ms avant que le tir ne parte réellement.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, useWindowDimensions, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
const PANEL_W = 96; // panneau étroit : juste la jauge verticale + TIRER
const TOP_BAR_H = 44; // barre fine du haut : retour/mode/score
const STRIKE_DURATION = 130;

export default function BilliardScreen({ onBack }) {
  const { addCoinsLimited } = useCoins();
  const { width: WIN_W, height: WIN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const [phase, setPhase] = useState('setup');
  const [mode, setMode] = useState('solo');
  const [gameState, setGameState] = useState('aim'); // 'aim' | 'strike' | 'sim' | 'placing'
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [playerGroups, setPlayerGroups] = useState({ 1: null, 2: null });
  const [groupsAssigned, setGroupsAssigned] = useState(false);
  const [status, setStatus] = useState('');
  const [power, setPower] = useState(0);
  const [aimDir, setAimDir] = useState(null);
  const [, setRenderTick] = useState(0);
  const [endInfo, setEndInfo] = useState(null);

  // Bouton/geste retour Android : navigue dans l'écran (table -> setup ->
  // quitte le jeu) plutôt que de laisser le système fermer l'appli.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phaseRef.current === 'table') {
        backToSetupRef.current();
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onBack]);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const backToSetupRef = useRef(() => {});

  // Table non tournée (vrai paysage) : TABLE_W (long axe) = largeur
  // dispo, TABLE_H (court axe) = hauteur dispo. Zones sûres (insets)
  // soustraites pour ne jamais déborder sous la barre de gestes système.
  const availW = WIN_W - PANEL_W - insets.left - insets.right - 16;
  const availH = WIN_H - TOP_BAR_H - insets.top - insets.bottom - 12;
  let tableAreaW = availW;
  let tableAreaH = tableAreaW * (TABLE_H / TABLE_W);
  if (tableAreaH > availH) {
    tableAreaH = availH;
    tableAreaW = tableAreaH * (TABLE_W / TABLE_H);
  }
  const scale = tableAreaW / TABLE_W;
  const railW = 16 * scale;

  const toScreen = useCallback((gx, gy) => gameToScreen(gx, gy, scale, tableAreaW, tableAreaH, false), [scale, tableAreaW, tableAreaH]);

  const ballsRef = useRef([]);
  const aimingActiveRef = useRef(false);
  const rafRef = useRef(null);
  const strikeRafRef = useRef(null);
  const strikeRef = useRef(null); // {dirX,dirY,power,startTime,fromDist,toDist}
  const shotFactsRef = useRef(null);
  const ownRemainingSnapshotRef = useRef(0);
  const gameIdRef = useRef(0);
  const botTimeoutRef = useRef(null);
  const shotStartRef = useRef(0);

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
    if (strikeRafRef.current) cancelAnimationFrame(strikeRafRef.current);
    strikeRef.current = null;
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

  const backToSetup = useCallback(() => {
    gameIdRef.current++;
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (strikeRafRef.current) cancelAnimationFrame(strikeRafRef.current);
    strikeRef.current = null;
    setPhase('setup');
  }, []);
  backToSetupRef.current = backToSetup;

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (strikeRafRef.current) cancelAnimationFrame(strikeRafRef.current);
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
  const startStrikeRef = useRef(null);

  const maybeBotTurnRef = useRef(() => {});
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
            // Bug corrigé : rien ne relançait le bot pour qu'il tire une
            // fois la bille replacée après une faute — il restait "figé"
            // en attente indéfiniment. On enchaîne directement vers le tir.
            setTimeout(() => maybeBotTurnRef.current(), 0);
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
                startStrikeRef.current(shot.dir.x, shot.dir.y, shot.power);
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
  maybeBotTurnRef.current = maybeBotTurn;

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

  // ---- Animation de frappe (queue qui fonce vers la bille avant le tir) ----
  const animateStrike = useCallback(() => {
    if (!strikeRef.current) return;
    const t = Math.min(1, (performance.now() - strikeRef.current.startTime) / STRIKE_DURATION);
    bump();
    if (t < 1) {
      strikeRafRef.current = requestAnimationFrame(animateStrike);
    } else {
      const { dirX, dirY, power: p } = strikeRef.current;
      strikeRef.current = null;
      fireShotRef.current(dirX * p, dirY * p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startStrike = useCallback((dirX, dirY, p) => {
    const powerFrac = p / MAX_POWER;
    strikeRef.current = {
      dirX,
      dirY,
      power: p,
      startTime: performance.now(),
      fromDist: 30 + powerFrac * 90,
      toDist: BALL_R + 2,
    };
    setGameState('strike');
    aimingActiveRef.current = false;
    strikeRafRef.current = requestAnimationFrame(animateStrike);
  }, [animateStrike]);
  startStrikeRef.current = startStrike;

  const confirmFire = () => {
    if (!aimDir || power <= MAX_POWER * 0.05 || gameState !== 'aim') return;
    startStrike(aimDir.x, aimDir.y, power);
  };

  const tryPlaceCue = (pos) => {
    if (!isValidCuePlacement(ballsRef.current, pos)) return;
    respawnCue(pos);
    setGameState('aim');
    setStatus(`Tour : ${turnLabel(currentPlayerRef.current)}`);
    bump();
  };

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

  // Jauge VERTICALE (demande explicite), hauteur FIXE (liée au panneau, pas
  // à la table) — l'ancien couplage à une dimension de la table provoquait
  // un léger bug visuel/tactile résiduel signalé par l'utilisateur.
  const POWER_BAR_H = Math.max(120, availH - 70);
  const setPowerFromBar = (y) => {
    const frac = Math.max(0, Math.min(1, 1 - y / POWER_BAR_H));
    setPower(frac * MAX_POWER);
  };
  const powerBarResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameStateRef.current === 'aim',
      onMoveShouldSetPanResponder: () => gameStateRef.current === 'aim',
      onPanResponderGrant: (evt) => setPowerFromBar(evt.nativeEvent.locationY),
      onPanResponderMove: (evt) => setPowerFromBar(evt.nativeEvent.locationY),
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
  const showAimVisuals = aimDir && gameState === 'aim';
  const preview = showAimVisuals ? computeAimPreview(balls, cue, aimDir.x, aimDir.y) : null;
  const cueScreen = cue && !cue.pocketed ? toScreen(cue.pos.x, cue.pos.y) : null;

  let stickDir = null;
  let stickPullback = 0;
  if (gameState === 'aim' && aimDir) {
    stickDir = aimDir;
    stickPullback = 30 + (power / MAX_POWER) * 90;
  } else if (gameState === 'strike' && strikeRef.current) {
    const s = strikeRef.current;
    const t = Math.min(1, (performance.now() - s.startTime) / STRIKE_DURATION);
    stickDir = { x: s.dirX, y: s.dirY };
    stickPullback = s.fromDist + (s.toDist - s.fromDist) * t;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={backToSetup} style={styles.topBackBtn}>
          <Text style={styles.backText}>← {mode === 'solo' ? 'Entraînement' : mode === 'bot' ? 'VS Bot' : 'Pass & Play'}</Text>
        </TouchableOpacity>

        {mode !== 'solo' && (
          <Text style={styles.scoreTextTop} numberOfLines={1}>
            <Text style={currentPlayer === 1 ? styles.scoreActive : null}>Joueur 1{playerGroups[1] ? ` (${playerGroups[1] === 'solid' ? 'Pleines' : 'Rayées'})` : ''}</Text>
            {'   vs   '}
            <Text style={currentPlayer === 2 ? styles.scoreActive : null}>{mode === 'bot' ? 'Bot' : 'Joueur 2'}{playerGroups[2] ? ` (${playerGroups[2] === 'solid' ? 'Pleines' : 'Rayées'})` : ''}</Text>
          </Text>
        )}

        <Text style={styles.statusTop} numberOfLines={1}>{status}</Text>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.tableWrap}>
          <View style={[styles.tableArea, { width: tableAreaW, height: tableAreaH }]} {...tablePanResponder.panHandlers}>
            <View style={[styles.felt, { left: railW, top: railW, right: railW, bottom: railW }]} pointerEvents="none" />

            {POCKETS.map((p, i) => {
              const s = toScreen(p.x, p.y);
              const r = p.r * scale;
              return <View key={i} pointerEvents="none" style={[styles.pocket, { left: s.x - r, top: s.y - r, width: r * 2, height: r * 2, borderRadius: r }]} />;
            })}

            {showAimVisuals && preview && cueScreen && (
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
              </>
            )}

            {stickDir && cueScreen && (
              <CueStick cuePos={cue.pos} dir={stickDir} pullback={stickPullback} toScreen={toScreen} />
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

        <View style={styles.panel}>
          <Text style={styles.powerPctLabel}>{Math.round((power / MAX_POWER) * 100)}%</Text>
          <View style={[styles.powerBarWrap, { height: POWER_BAR_H }]} {...powerBarResponder.panHandlers}>
            <View style={[styles.powerBarFill, { height: `${(power / MAX_POWER) * 100}%` }]} />
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
    height: TOP_BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2f45',
  },
  topBackBtn: { paddingVertical: 4 },
  scoreTextTop: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  statusTop: { color: COLORS.text, fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },

  mainRow: { flex: 1, flexDirection: 'row' },
  tableWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tableArea: { backgroundColor: COLORS.wood, borderRadius: 8, overflow: 'hidden' },
  felt: { position: 'absolute', backgroundColor: COLORS.felt, borderRadius: 4 },
  pocket: { position: 'absolute', backgroundColor: COLORS.pocket },
  ball: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  stripeCenter: { position: 'absolute', backgroundColor: '#f4f1ea' },
  glossy: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)' },

  panel: {
    width: PANEL_W,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#2a2f45',
  },
  scoreActive: { color: COLORS.action },

  powerBarWrap: {
    width: 34,
    backgroundColor: '#1c2032',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#2a2f45',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  powerBarFill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FF5252' },
  powerPctLabel: { color: COLORS.text, fontSize: 11, fontWeight: '800' },
  fireBtn: { backgroundColor: COLORS.action, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  fireBtnDisabled: { opacity: 0.35 },
  fireBtnText: { color: '#1a1300', fontSize: 13, fontWeight: '900' },

  endOverlay: {
    position: 'absolute',
    left: '25%',
    right: PANEL_W + 24,
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

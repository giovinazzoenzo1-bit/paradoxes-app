// Ping-pong — port fidèle du PWA. Contrairement au billard, reste 100% en
// PORTRAIT (choix du PWA lui-même) : aucun verrouillage d'orientation,
// aucune zone sûre spéciale, aucune barre système à masquer — on évite
// toute la complexité rencontrée sur le billard. Contrôle tactile DIRECT
// (la raquette suit le doigt), donc pas de calcul de "direction de visée"
// non plus. On applique quand même d'emblée le pattern retenu du billard
// pour toute zone de glissement (mesure de position absolue + coordonnées
// de geste plutôt que locationX/Y) pour éviter par avance ce type de bug.
// Simplifications volontaires (gameplay/physique/règles 100% fidèles) :
// pas de particules d'impact, pas de tremblement d'écran, pas d'étoiles de
// victoire, pas de boutique de raquettes (cosmétique), pas de classement
// mondial fictif — même politique que les autres jeux portés.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, useWindowDimensions } from 'react-native';
import BackButton from '../../components/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoins } from '../../context/CoinsContext';
import CoinBar from '../../components/CoinBar';
import {
  DIFFS,
  WIN_SCORE,
  TRAIL_LEN,
  paddleRadius,
  ballRadius,
  makeBall,
  makePaddle,
  clampPaddle,
  serve,
  stepBall,
  tryPaddleHit,
  deflect,
  checkScore,
  checkWin,
  botUpdate,
} from '../../games/pingpong/pingpongLogic';
import useBackGesture from '../../hooks/useBackGesture';

const COLORS = {
  bg: '#141721',
  felt: '#5cb04e',
  line: '#14140f',
  text: '#eef0f6',
  muted: '#8d93ab',
  action: '#f5b942',
  player: '#ef6461',
  playerDark: '#b8433f',
  opp: '#3ec6f0',
  oppDark: '#1c8fb8',
};

// Boutique de raquettes — cosmétique uniquement, aucun effet sur le jeu.
// Identique à coins-config.js (pingpongPaddles) du PWA.
const PADDLES = [
  { id: 'classique', name: 'Classique', color: '#ef6461', colorDark: '#b8433f', price: 0 },
  { id: 'ocean', name: 'Océan', color: '#3ec6f0', colorDark: '#1c8fb8', price: 15 },
  { id: 'emeraude', name: 'Émeraude', color: '#4fd18a', colorDark: '#2c9c5f', price: 15 },
  { id: 'violet', name: 'Violet Néon', color: '#b96bff', colorDark: '#7d3fc9', price: 25 },
  { id: 'rose', name: 'Rose Bonbon', color: '#ff6fb0', colorDark: '#c94080', price: 25 },
  { id: 'or', name: 'Or Royal', color: '#f5d76e', colorDark: '#c9a227', price: 40 },
  { id: 'noir', name: 'Noir Mat', color: '#3a3a42', colorDark: '#1c1c22', price: 40 },
  { id: 'arcenciel', name: 'Arc-en-ciel', color: '#ff6fb0', colorDark: '#7d3fc9', price: 75, gradient: true },
];
const DEFAULT_PADDLE = PADDLES[0];

export default function PingPongScreen({ onBack }) {
  const { addCoinsLimited, spendCoins, coins } = useCoins();
  const panHandlers = useBackGesture(onBack);
  const { width: WIN_W, height: WIN_H } = useWindowDimensions();

  const [phase, setPhase] = useState('setup');
  const [mode, setMode] = useState('bot');
  const [diff, setDiff] = useState('moyen');
  const [scoreYou, setScoreYou] = useState(0);
  const [scoreOpp, setScoreOpp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [endInfo, setEndInfo] = useState(null);
  const [ownedPaddles, setOwnedPaddles] = useState(['classique']);
  const [selectedPaddleId, setSelectedPaddleId] = useState('classique');

  useEffect(() => {
    (async () => {
      try {
        const owned = await AsyncStorage.getItem('ppOwnedPaddles');
        const parsed = owned ? JSON.parse(owned) : ['classique'];
        if (!parsed.includes('classique')) parsed.push('classique');
        setOwnedPaddles(parsed);
      } catch (e) {
        setOwnedPaddles(['classique']);
      }
      const selected = await AsyncStorage.getItem('ppSelectedPaddle');
      if (selected) setSelectedPaddleId(selected);
    })();
  }, []);

  const playerSkin = PADDLES.find((s) => s.id === selectedPaddleId) || DEFAULT_PADDLE;

  const buyPaddle = async (skin) => {
    if (ownedPaddles.includes(skin.id)) return;
    const ok = await spendCoins(skin.price);
    if (!ok) return;
    const next = [...ownedPaddles, skin.id];
    setOwnedPaddles(next);
    await AsyncStorage.setItem('ppOwnedPaddles', JSON.stringify(next));
    setSelectedPaddleId(skin.id);
    await AsyncStorage.setItem('ppSelectedPaddle', skin.id);
  };

  const equipPaddle = async (id) => {
    setSelectedPaddleId(id);
    await AsyncStorage.setItem('ppSelectedPaddle', id);
  };
  const [, setRenderTick] = useState(0);

  const bump = () => setRenderTick((t) => t + 1);

  // Espace disponible pour le "canvas" (table + marge hors-table où les
  // raquettes peuvent poursuivre la balle) — recalculé à chaque rendu
  // depuis useWindowDimensions (réactif), pas une constante figée.
  const availW = WIN_W - 24;
  const availH = WIN_H - 150;
  const tableW = Math.round(availW * 0.73);
  const tableH = Math.round(availH * 0.62);
  const offX = Math.round(availW * 0.12);
  const offY = Math.round(availH * 0.08);
  const canvasW = tableW + offX * 2;
  const canvasH = tableH + offY * 2;
  const overhang = offX * 0.85;

  const ballRef = useRef(makeBall(tableW, tableH));
  const playerRef = useRef(makePaddle(tableW, tableH, true));
  const oppRef = useRef(makePaddle(tableW, tableH, false));
  const trailRef = useRef([]);
  const lastHitterRef = useRef('opp');
  const targetBouncedRef = useRef(false);
  const targetZoneRef = useRef('top');
  const overRef = useRef(true);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const comboRef = useRef(0);
  const gameIdRef = useRef(0);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const diffRef = useRef(diff);
  diffRef.current = diff;
  const dimsRef = useRef({ tableW, tableH, offX, offY, overhang });
  dimsRef.current = { tableW, tableH, offX, offY, overhang, canvasW, canvasH };

  const resetTargetBounce = (hitter) => {
    targetBouncedRef.current = false;
    targetZoneRef.current = hitter === 'player' ? 'top' : 'bottom';
  };

  // Verrou anti-double-comptage : doServe() (qui replace la balle en zone
  // neutre) est planifié via setTimeout(0), mais la boucle d'animation,
  // elle, continue immédiatement via requestAnimationFrame — rien ne
  // garantit que le setTimeout s'exécute AVANT la frame suivante. Si la
  // frame suivante arrivait en premier, la balle était encore à sa
  // position "sortie" au moment de la revérification, et checkScore
  // détectait la MÊME sortie une deuxième fois -> le score avançait de 2
  // en 2 au lieu de 1 en 1 (bug remonté). Ce verrou bloque toute nouvelle
  // vérification de score dès qu'un point vient d'être détecté, jusqu'à ce
  // que doServe() remette réellement la balle en jeu.
  const pointScoredRef = useRef(false);

  const doServe = (towardOpp) => {
    const { tableW: w, tableH: h } = dimsRef.current;
    const { lastHitter, targetZone } = serve(ballRef.current, w, h, towardOpp);
    trailRef.current = [];
    if (modeRef.current === 'bot') {
      oppRef.current.x = w / 2;
      oppRef.current.vx = 0;
    }
    lastHitterRef.current = lastHitter;
    targetZoneRef.current = targetZone;
    targetBouncedRef.current = false;
    pointScoredRef.current = false;
  };

  // Refs miroir pour lire le score courant dans les callbacks sans risquer
  // une fermeture figée (même précaution que sur le billard).
  const scoreYouRef = useRef(0);
  scoreYouRef.current = scoreYou;
  const scoreOppRef = useRef(0);
  scoreOppRef.current = scoreOpp;

  const endGame = useCallback(
    (winner) => {
      overRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const won = winner === 'player';
      if (modeRef.current === 'bot' && won) {
        const gain = DIFFS_COINS[diffRef.current];
        if (gain) addCoinsLimited('pingpong', gain);
      }
      setEndInfo({ won, label: won ? 'TU GAGNES !' : modeRef.current === 'bot' ? 'LE BOT GAGNE' : 'JOUEUR 2 GAGNE' });
    },
    [addCoinsLimited]
  );

  const handlePoint = useCallback(
    (scorer) => {
      if (scorer === 'player') {
        setScoreYou((s) => {
          const ns = s + 1;
          const w = checkWin(ns, scoreOppRef.current);
          if (w) setTimeout(() => endGame(w), 0);
          else setTimeout(() => doServe(true), 0);
          return ns;
        });
      } else {
        comboRef.current = 0;
        setCombo(0);
        setScoreOpp((s) => {
          const ns = s + 1;
          const w = checkWin(scoreYouRef.current, ns);
          if (w) setTimeout(() => endGame(w), 0);
          else setTimeout(() => doServe(false), 0);
          return ns;
        });
      }
    },
    [endGame]
  );



  const loopRef = useRef(null);
  const loop = useCallback(
    (now) => {
      if (overRef.current) return;
      const dt = Math.min((now - lastTimeRef.current) / 1000, 1 / 30);
      lastTimeRef.current = now;
      const { tableW: w, tableH: h, overhang: oh } = dimsRef.current;

      if (modeRef.current === 'bot') {
        botUpdate(oppRef.current, ballRef.current, dt, DIFFS[diffRef.current], w, h);
      } else {
        oppRef.current.vx *= 0.9;
        oppRef.current.vy *= 0.9;
      }
      playerRef.current.vx *= 0.92;
      playerRef.current.vy *= 0.92;

      const bounced = stepBall(ballRef.current, dt, w, h);
      if (bounced && bounced.withinTable && bounced.zone === targetZoneRef.current) {
        targetBouncedRef.current = true;
      }
      trailRef.current.push({ x: ballRef.current.x, y: ballRef.current.y });
      if (trailRef.current.length > TRAIL_LEN) trailRef.current.shift();

      let hitBy = null;
      if (tryPaddleHit(playerRef.current, ballRef.current, true)) hitBy = 'player';
      else if (tryPaddleHit(oppRef.current, ballRef.current, false)) hitBy = 'opp';
      if (hitBy) {
        const isPlayer = hitBy === 'player';
        const paddle = isPlayer ? playerRef.current : oppRef.current;
        const { powerBoost } = deflect(paddle, ballRef.current, isPlayer, w, h, DIFFS[diffRef.current]);
        lastHitterRef.current = hitBy;
        resetTargetBounce(hitBy);
        if (isPlayer) {
          if (powerBoost > 0.55) {
            comboRef.current++;
            setCombo(comboRef.current);
          } else {
            comboRef.current = 0;
            setCombo(0);
          }
        }
      }

      // Bug corrigé : quand une raquette rattrape la balle dans la marge
      // hors-table (débordement autorisé pour "sauver" une balle large),
      // deflect() repositionne la balle tout près de la raquette — donc
      // potentiellement TOUJOURS hors des limites [0,h] à cet instant
      // précis, avant même d'avoir eu le temps de repartir avec sa
      // nouvelle vitesse. Si on vérifiait le score dans la même frame,
      // cette position encore "dehors" pouvait déclencher un point pour
      // le MAUVAIS joueur — typiquement le point revenait à celui qui
      // avait fait sortir la balle, au lieu de celui qui venait de la
      // sauver. On ne vérifie donc le score QUE si aucune frappe n'a eu
      // lieu cette frame (une balle qui vient d'être touchée est par
      // définition "revenue en jeu", pas "sortie").
      if (!hitBy && !pointScoredRef.current) {
        const scorer = checkScore(ballRef.current, w, h, targetBouncedRef.current, lastHitterRef.current);
        if (scorer) {
          pointScoredRef.current = true;
          handlePoint(scorer);
        }
      }

      bump();
      if (!overRef.current) rafRef.current = requestAnimationFrame(loopRef.current);
    },
    [handlePoint]
  );
  loopRef.current = loop;

  const startGame = useCallback((selectedMode) => {
    gameIdRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const { tableW: w, tableH: h } = dimsRef.current;
    setMode(selectedMode);
    ballRef.current = makeBall(w, h);
    playerRef.current = makePaddle(w, h, true);
    oppRef.current = makePaddle(w, h, false);
    trailRef.current = [];
    comboRef.current = 0;
    setCombo(0);
    setScoreYou(0);
    setScoreOpp(0);
    setEndInfo(null);
    overRef.current = false;
    setPhase('table');
    doServe(Math.random() < 0.5);
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loopRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToSetup = useCallback(() => {
    gameIdRef.current++;
    overRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase('setup');
  }, []);

  useEffect(() => () => {
    overRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // ---- Entrées tactiles : la raquette suit le doigt directement. Zone
  // basse = toujours le joueur ; zone haute = joueur 2 seulement en mode
  // "amis" (2 PanResponder distincts sur 2 zones fixes plutôt qu'un
  // multi-touch complexe sur une seule vue — chaque raquette est de toute
  // façon confinée à sa propre moitié). Position ABSOLUE mesurée +
  // gestureState (pas locationX/Y) dès le départ, leçon retenue du
  // billard.
  //
  // Chaque zone (haut/bas) est mesurée individuellement via .measure(), ce
  // qui donne directement son origine absolue à l'écran — donc
  // (absX - origineZone) donne déjà des coordonnées LOCALES À CETTE ZONE
  // (0..canvasW, 0..canvasH/2), qu'il suffit ensuite de replacer dans
  // l'espace "table" (0..tableW, 0..tableH) en retirant les marges hors-
  // table (offX/offY) et, pour la zone du bas, en ajoutant canvasH/2
  // (puisque cette zone commence à mi-hauteur du canvas).
  const makePaddleResponder = (paddleRef, isPlayer, zoneOriginRef) => {
    const lastRef = { current: { x: 0, y: 0, t: 0 } };
    const updateFromAbs = (absX, absY) => {
      const { tableW: w, tableH: h, offX, offY, overhang: oh, canvasH } = dimsRef.current;
      const zoneLocalX = absX - zoneOriginRef.current.x;
      const zoneLocalY = absY - zoneOriginRef.current.y;
      const canvasLocalY = isPlayer ? zoneLocalY + canvasH / 2 : zoneLocalY;
      const x = zoneLocalX - offX;
      const y = canvasLocalY - offY;

      const now = performance.now();
      const dt = Math.max(1, now - lastRef.current.t);
      const p = paddleRef.current;
      p.vx = ((x - lastRef.current.x) / dt) * 1000;
      p.vy = ((y - lastRef.current.y) / dt) * 1000;
      const midY = h / 2;
      p.x = x;
      if (isPlayer) p.y = Math.max(midY + p.r * 1.05, Math.min(h + offY * 0.8, y));
      else p.y = Math.max(-offY * 0.8, Math.min(midY - p.r * 1.05, y));
      clampPaddle(p, w, oh);
      lastRef.current = { x, y, t: now };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        lastRef.current = { x: paddleRef.current.x, y: paddleRef.current.y, t: performance.now() };
        updateFromAbs(gestureState.x0, gestureState.y0);
      },
      onPanResponderMove: (evt, gestureState) => updateFromAbs(gestureState.moveX, gestureState.moveY),
    });
  };

  const bottomZoneOriginRef = useRef({ x: 0, y: 0 });
  const bottomZoneViewRef = useRef(null);
  const topZoneOriginRef = useRef({ x: 0, y: 0 });
  const topZoneViewRef = useRef(null);

  const playerResponder = useRef(makePaddleResponder(playerRef, true, bottomZoneOriginRef)).current;
  const oppResponder = useRef(makePaddleResponder(oppRef, false, topZoneOriginRef)).current;

  const handleBottomLayout = () => {
    if (bottomZoneViewRef.current && bottomZoneViewRef.current.measure) {
      bottomZoneViewRef.current.measure((x, y, w, h, pageX, pageY) => {
        bottomZoneOriginRef.current = { x: pageX, y: pageY };
      });
    }
  };
  const handleTopLayout = () => {
    if (topZoneViewRef.current && topZoneViewRef.current.measure) {
      topZoneViewRef.current.measure((x, y, w, h, pageX, pageY) => {
        topZoneOriginRef.current = { x: pageX, y: pageY };
      });
    }
  };

  if (phase === 'setup') {
    const gain = DIFFS_COINS[diff];
    const DIFF_EMOJI = { facile: '😔', moyen: '🙂', difficile: '🔥' };
    return (
      <View style={styles.screen} {...panHandlers}>
        <CoinBar />
        <View style={styles.header}>
          {onBack && (
            <BackButton onPress={onBack} />
          )}
        </View>
        <Text style={styles.title}>🏓 Ping-pong</Text>

        <View style={styles.neonCard}>
          <Text style={styles.sectionLabel}>DIFFICULTÉ DU BOT</Text>
          <View style={styles.diffRow}>
            {Object.keys(DIFFS).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.diffBtn, diff === d && styles.diffBtnActive]}
                onPress={() => setDiff(d)}
              >
                <Text style={[styles.diffBtnText, diff === d && styles.diffBtnTextActive]}>
                  {DIFF_EMOJI[d]} {DIFFS[d].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.coinInfo}>{gain ? `🪙 ${gain} pièces si tu gagnes.` : '🟨 Pas encore de pièces sur cette difficulté.'}</Text>

          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>MODE</Text>
          <TouchableOpacity style={styles.modeBtn} onPress={() => startGame('bot')}>
            <Text style={styles.modeBtnText}>🤖 Contre le bot</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeBtn} onPress={() => startGame('amis')}>
            <Text style={styles.modeBtnText}>🧑‍🤝‍🧑 Entre amis (1 téléphone, 2 doigts)</Text>
          </TouchableOpacity>

          <Text style={styles.hintText}>
            Glisse ta raquette pour la placer. Plus ton doigt bouge vite au moment de l'impact, plus le tir part
            fort — reste tranquille pour un tir placé, précis.
          </Text>

          <TouchableOpacity style={styles.shopFab} onPress={() => setPhase('shop')}>
            <Text style={styles.shopFabEmoji}>🏓</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === 'shop') {
    return (
      <View style={styles.screen} {...panHandlers}>
        <CoinBar />
        <BackButton onPress={() => setPhase('setup')} />
        <Text style={styles.title}>🏓 Ping-pong</Text>

        <View style={styles.neonCard}>
          <BackButton onPress={() => setPhase('setup')} />
          <Text style={styles.shopTitle}>🏓 BOUTIQUE DE RAQUETTES</Text>
          <Text style={styles.shopSubtitle}>Cosmétique uniquement — juste pour le style, aucun effet sur le jeu.</Text>
          <Text style={styles.shopCoins}>🪙 Pièces{'   '}<Text style={{ color: COLORS.action }}>{coins}</Text></Text>

          <View style={styles.shopGrid}>
            {PADDLES.map((skin) => {
              const owned = ownedPaddles.includes(skin.id);
              const equipped = selectedPaddleId === skin.id;
              return (
                <View key={skin.id} style={[styles.shopCard, equipped && styles.shopCardEquipped]}>
                  <View style={[styles.shopSwatch, { backgroundColor: skin.color, borderColor: skin.colorDark }]} />
                  <View style={[styles.shopHandle, { backgroundColor: skin.colorDark }]} />
                  <Text style={styles.shopName}>{skin.name}</Text>
                  {equipped ? (
                    <Text style={styles.shopOwnedTag}>✅ Équipée</Text>
                  ) : owned ? (
                    <TouchableOpacity style={styles.shopActionBtn} onPress={() => equipPaddle(skin.id)}>
                      <Text style={styles.shopActionText}>Équiper</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.shopActionBtn} onPress={() => buyPaddle(skin)}>
                      <Text style={styles.shopActionText}>🪙 {skin.price}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  const ball = ballRef.current;
  const player = playerRef.current;
  const opp = oppRef.current;
  const lift = ball.z * 0.6;

  return (
    <View style={styles.screen} {...panHandlers}>
      <CoinBar />
      <View style={styles.gameHeader}>
        <TouchableOpacity onPress={backToSetup} style={styles.circleBackBtn}>
          <Text style={styles.circleBackBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.scoreCard}>
          <Text style={styles.diffBadge}>{mode === 'bot' ? DIFFS[diff].label : 'ENTRE AMIS'}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabelPlayer}>TOI</Text>
            <Text style={styles.scoreValue}>{scoreYou}</Text>
            <Text style={styles.scoreVs}>VS</Text>
            <Text style={styles.scoreValue}>{scoreOpp}</Text>
            <Text style={styles.scoreLabelOpp}>{mode === 'bot' ? 'BOT' : 'J2'}</Text>
          </View>
        </View>
      </View>
      {combo >= 3 && <Text style={styles.comboText}>🔥 x{combo}</Text>}

      <View style={styles.canvasWrap}>
        <View style={[styles.canvas, { width: canvasW, height: canvasH }]}>
          <View
            ref={topZoneViewRef}
            onLayout={handleTopLayout}
            style={{ position: 'absolute', left: 0, top: 0, width: canvasW, height: canvasH / 2 }}
            {...(mode === 'amis' ? oppResponder.panHandlers : {})}
          />
          <View
            ref={bottomZoneViewRef}
            onLayout={handleBottomLayout}
            style={{ position: 'absolute', left: 0, top: canvasH / 2, width: canvasW, height: canvasH / 2 }}
            {...playerResponder.panHandlers}
          />

          <View pointerEvents="none" style={{ position: 'absolute', left: offX, top: offY, width: tableW, height: tableH, backgroundColor: COLORS.felt, borderWidth: 3, borderColor: COLORS.line }}>
            <View style={{ position: 'absolute', left: tableW / 2 - 1, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.85)' }} />
            <View style={{ position: 'absolute', left: 0, top: tableH / 2 - 2, width: tableW, height: 3, backgroundColor: '#fff' }} />
          </View>

          {trailRef.current.map((t, i) => {
            const a = (i + 1) / trailRef.current.length;
            const r = ball.r * a * 0.85;
            return (
              <View
                key={i}
                pointerEvents="none"
                style={{ position: 'absolute', left: offX + t.x - r, top: offY + t.y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: `rgba(255,255,255,${a * 0.35})` }}
              />
            );
          })}

          <Paddle p={opp} offX={offX} offY={offY} color={COLORS.opp} colorDark={COLORS.oppDark} isPlayer={false} />
          <Paddle p={player} offX={offX} offY={offY} color={playerSkin.color} colorDark={playerSkin.colorDark} isPlayer />

          <View pointerEvents="none" style={{ position: 'absolute', left: offX + ball.x - ball.r + ball.r * 0.15, top: offY + ball.y - ball.r + ball.r * 0.15, width: ball.r * 2, height: ball.r * 2, borderRadius: ball.r, backgroundColor: 'rgba(0,0,0,0.18)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: offX + ball.x - ball.r, top: offY + ball.y - lift - ball.r, width: ball.r * 2, height: ball.r * 2, borderRadius: ball.r, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.line }} />
        </View>
      </View>

      {endInfo && (
        <View style={styles.endOverlay}>
          <Text style={styles.endMedal}>{endInfo.won ? '🥇' : '🥈'}</Text>
          <Text style={styles.endTitle}>{endInfo.label}</Text>
          <Text style={styles.endScore}>{scoreYou} — {scoreOpp}</Text>
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

// Manche nettement plus visible que le port initial (qui reprenait tel
// quel les proportions du PWA : à peine 5% du rayon dépassait du cercle,
// quasi invisible sur un écran de téléphone) — demande explicite de
// l'utilisateur pour plus de réalisme. Le manche part de l'intérieur du
// cercle (léger chevauchement pour un raccord propre) et dépasse
// nettement en dessous/au-dessus, avec un bout arrondi.
function Paddle({ p, offX, offY, color, colorDark, isPlayer }) {
  const handleW = p.r * 0.42;
  const handleLen = p.r * 0.9; // longueur totale, dont une partie chevauche le cercle
  const overlap = p.r * 0.35; // portion cachée sous le cercle, pour un raccord propre
  const dir = isPlayer ? 1 : -1;
  const handleTop = offY + p.y + dir * (p.r - overlap);
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left: offX + p.x - p.r + p.r * 0.12, top: offY + p.y - p.r + p.r * 0.12, width: p.r * 2, height: p.r * 2, borderRadius: p.r, backgroundColor: 'rgba(0,0,0,0.16)' }} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: offX + p.x - handleW / 2,
          top: dir > 0 ? handleTop : handleTop - handleLen,
          width: handleW,
          height: handleLen,
          borderRadius: handleW / 2,
          backgroundColor: colorDark,
        }}
      />
      <View pointerEvents="none" style={{ position: 'absolute', left: offX + p.x - p.r, top: offY + p.y - p.r, width: p.r * 2, height: p.r * 2, borderRadius: p.r, backgroundColor: color, borderWidth: Math.max(2, p.r * 0.14), borderColor: COLORS.line }} />
    </>
  );
}

const DIFFS_COINS = { facile: 2, moyen: 5 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 12 },

  // Carte néon violette du setup/boutique — se démarque du reste de
  // l'appli (style propre à ce jeu, comme le néon cyberpunk de Wordle ou
  // le vert billard), suivant la référence visuelle demandée.
  neonCard: {
    backgroundColor: '#241a42',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#4a3a7a',
    shadowColor: '#7d3fc9',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },

  sectionLabel: { color: '#c9bce8', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  diffRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  diffBtn: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  diffBtnActive: { backgroundColor: COLORS.action },
  diffBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  diffBtnTextActive: { color: '#1a1300' },
  coinInfo: { color: '#c9bce8', fontSize: 11, marginTop: 10 },

  modeBtn: { backgroundColor: COLORS.action, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  modeBtnText: { color: '#1a1300', fontSize: 14, fontWeight: '800' },
  hintText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 18, lineHeight: 16 },

  shopFab: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.opp,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.opp,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  shopFabEmoji: { fontSize: 24 },

  shopTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  shopSubtitle: { color: '#c9bce8', fontSize: 11, marginTop: 4 },
  shopCoins: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginTop: 10 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  shopCard: {
    width: '31%',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  shopCardEquipped: { borderColor: '#00E676', borderWidth: 2 },
  shopSwatch: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, marginBottom: 2 },
  shopHandle: { width: 12, height: 16, borderRadius: 3, marginBottom: 6 },
  shopName: { color: COLORS.text, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  shopOwnedTag: { color: '#00E676', fontSize: 10, fontWeight: '800', marginTop: 6 },
  shopActionBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, marginTop: 6 },
  shopActionText: { color: COLORS.text, fontSize: 11, fontWeight: '800' },

  gameHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  circleBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.opp,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.opp,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  circleBackBtnText: { color: COLORS.opp, fontSize: 18, fontWeight: '900' },
  scoreCard: { flex: 1, backgroundColor: '#1c2032', borderRadius: 16, paddingVertical: 8, alignItems: 'center' },
  diffBadge: { color: COLORS.action, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 2 },
  scoreLabelPlayer: { color: COLORS.player, fontSize: 12, fontWeight: '800' },
  scoreLabelOpp: { color: COLORS.opp, fontSize: 12, fontWeight: '800' },
  scoreValue: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  scoreVs: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  comboText: { color: '#FF7043', textAlign: 'center', fontSize: 13, fontWeight: '900', marginTop: 2 },

  canvasWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  canvas: { position: 'relative' },

  endOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '30%',
    backgroundColor: '#1c2032',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2f45',
  },
  endMedal: { fontSize: 40 },
  endTitle: { color: COLORS.action, fontSize: 18, fontWeight: '900', marginTop: 6 },
  endScore: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  replayBtn: { marginTop: 16, backgroundColor: '#00E676', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  replayBtnText: { color: '#04120c', fontSize: 15, fontWeight: '800' },
  changeModeBtn: { marginTop: 10, paddingVertical: 6 },
  changeModeBtnText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
});


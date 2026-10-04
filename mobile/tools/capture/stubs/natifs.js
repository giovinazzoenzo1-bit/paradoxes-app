// Doublures web des modules natifs (banc de capture Paradox).
import React from 'react';
import { View, Text } from 'react-native';
export const StatusBar = () => null;
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const SafeAreaView = View;
export const SafeAreaProvider = ({ children }) => children;
export const lockAsync = async () => {};
export const unlockAsync = async () => {};
export const OrientationLock = { LANDSCAPE: 1, PORTRAIT_UP: 2 };
export const setVisibilityAsync = async () => {};
export const setBehaviorAsync = async () => {};
export const setBackgroundColorAsync = async () => {};
const Icone = ({ size = 16, color = '#fff' }) => React.createElement(Text, { style: { fontSize: size * 0.8, color } }, '●');
export const Ionicons = Icone;
export const MaterialCommunityIcons = Icone;
export const FontAwesome5 = Icone;
const memoire = {};
// Banc (03/10) : une scène peut y glisser une sauvegarde AVANT le rendu (window.__memoireBanc).
if (typeof window !== 'undefined') window.__memoireBanc = memoire;
const AsyncStorage = { getItem: async (k) => (k in memoire ? memoire[k] : null), setItem: async (k, v) => { memoire[k] = v; }, removeItem: async (k) => { delete memoire[k]; }, multiGet: async (ks) => ks.map((k) => [k, memoire[k] ?? null]), getAllKeys: async () => Object.keys(memoire) };
export default AsyncStorage;
export const LottieView = () => null;
// expo-audio (sons de la boutique) : lecteur factice, le banc ne joue pas de son.
export const createAudioPlayer = () => ({ volume: 1, play() {}, pause() {}, seekTo: async () => {}, remove() {} });
// expo-modules-core : au banc, aucun module natif (les sons restent muets).
// Banc : seul ExpoHaptics est « présent » (sa doublure, sans danger, NOTE les vibrations).
export const requireOptionalNativeModule = (nom) => (nom === 'ExpoHaptics' ? {} : null);
export const requireNativeModule = (nom) => { throw new Error(`Cannot find native module '${nom}'`); };
// expo-haptics (03/10) : chaque vibration demandée est NOTÉE (window.__vibrations) pour les tests du banc.
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft' };
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' };
const noterVibration = (v) => { if (typeof window !== 'undefined') (window.__vibrations = window.__vibrations || []).push(v); };
export const impactAsync = async (style) => noterVibration(style);
export const notificationAsync = async (type) => noterVibration('notif:' + type);
export const selectionAsync = async () => noterVibration('selection');

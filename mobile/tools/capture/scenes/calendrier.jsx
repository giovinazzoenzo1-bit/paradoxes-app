import React from 'react';
import { createRoot } from 'react-dom/client';
import { ImageBackground } from 'react-native';
import { DailyCalendarModal } from '../../../src/screens/games/ClickerScreen';
import { DAILY_CALENDAR } from '../../../src/games/clicker/dailyLogic';
// ?scene=calendrier : jour 2 à récupérer ; calendrier-pris : jour 5 déjà récupéré.
const vue = new URLSearchParams(location.search).get('scene') || 'calendrier';
const pris = vue === 'calendrier-pris';
createRoot(document.getElementById('root')).render(
  <ImageBackground source={require('../../../assets/menu/fond.jpg')} style={{ flex: 1 }} resizeMode="cover">
    <DailyCalendarModal calendar={DAILY_CALENDAR} currentDay={pris ? 5 : 2} alreadyClaimedToday={pris} onClaim={() => {}} onClose={() => {}} />
  </ImageBackground>,
);

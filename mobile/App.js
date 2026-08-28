import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { CoinsProvider } from './src/context/CoinsContext';
import JeuxScreen from './src/screens/JeuxScreen';
import ProgresScreen from './src/screens/ProgresScreen';
import OptionsScreen from './src/screens/OptionsScreen';

const Tab = createBottomTabNavigator();

const navTheme = {
  dark: true,
  colors: {
    primary: '#f5b942',
    background: '#11131c',
    card: '#1c2032',
    text: '#eef0f6',
    border: '#2a2f45',
    notification: '#f5b942',
  },
};

export default function App() {
  return (
    <CoinsProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#f5b942',
            tabBarInactiveTintColor: '#8d93ab',
            tabBarStyle: { backgroundColor: '#1c2032', borderTopColor: '#2a2f45' },
            tabBarIcon: () => {
              const icons = { Jeux: '🎮', Progrès: '🏆', Options: '⚙️' };
              return <Text style={{ fontSize: 18 }}>{icons[route.name]}</Text>;
            },
          })}
        >
          <Tab.Screen name="Jeux" component={JeuxScreen} />
          <Tab.Screen name="Progrès" component={ProgresScreen} />
          <Tab.Screen name="Options" component={OptionsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </CoinsProvider>
  );
}

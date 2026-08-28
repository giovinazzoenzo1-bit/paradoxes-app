import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useCoins } from '../context/CoinsContext';

export default function CoinBar() {
  const { coins, resetCoins } = useCoins();

  const handleReset = () => {
    Alert.alert(
      'Remettre les pièces à zéro ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: resetCoins },
      ]
    );
  };

  return (
    <View style={styles.bar}>
      <Text style={styles.icon}>🪙</Text>
      <Text style={styles.value}>{coins}</Text>
      <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
        <Text style={styles.resetText}>↺</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#1c2032',
    borderWidth: 1,
    borderColor: '#2a2f45',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  icon: { fontSize: 15, marginRight: 6 },
  value: { fontSize: 14, fontWeight: '800', color: '#f5b942' },
  resetBtn: { marginLeft: 6, paddingHorizontal: 4 },
  resetText: { fontSize: 15, color: '#8d93ab' },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { COLORS } from './clickerTheme';

// Boutique de Diamants (11/09) — premier écran où dépenser la monnaie
// premium. Même gabarit modal que les menus Quêtes et Paramètres.
//
// Les 4 offres réutilisent des mécanismes DÉJÀ en place plutôt que d'en
// créer : crédit de Griffes par la clé partagée, recharge d'énergie par
// le même drapeau que le mode développeur, éclosion instantanée par le
// minuteur de l'incubateur. Aucun système neuf, donc aucune nouvelle
// surface de bug.
export const DIAMOND_OFFERS = [
  {
    id: 'coins',
    icon: '💰',
    title: 'Bourse de pièces',
    desc: "L'équivalent d'environ 10 minutes de revenu passif",
    cost: 10,
  },
  {
    id: 'griffes',
    icon: '🐾',
    title: '250 Griffes',
    desc: 'Crédités à ta prochaine ouverture du mode Exploration',
    cost: 25,
  },
  {
    id: 'energy',
    icon: '⚡',
    title: 'Énergie pleine',
    desc: "Recharge l'énergie d'Exploration au maximum",
    // Aligné sur ENERGY_DIAMOND_COST d'AdventureScreen : deux prix
    // différents pour la même chose serait incompréhensible.
    cost: 5,
  },
  {
    id: 'hatch',
    icon: '🥚',
    title: 'Éclosion immédiate',
    desc: "Termine le minuteur de l'œuf en incubation",
    cost: 40,
  },
];

export default function DiamondShop({ diamonds, onBuy, onBack, incubatingEgg }) {
  const [busy, setBusy] = useState(null);

  const handleBuy = async (offer) => {
    if (busy || diamonds < offer.cost) return;
    // L'éclosion immédiate est la seule offre qui puisse ne servir à
    // rien : sans œuf en incubation, le joueur paierait pour rien.
    if (offer.id === 'hatch' && !incubatingEgg) {
      Alert.alert('Aucun œuf en incubation', "Mets d'abord un œuf dans l'incubateur.");
      return;
    }
    setBusy(offer.id);
    const label = await onBuy(offer);
    setBusy(null);
    if (label) Alert.alert('Acheté !', label);
  };

  return (
    <View style={styles.backdrop}>
      {/* Zone cliquable DERRIÈRE le panneau : taper à côté ferme. En
          absolu et non en parent, sinon taper le panneau fermerait. */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onBack} />

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>💎 Boutique</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.balanceRow}>
          <Text style={styles.balanceText}>💎 {diamonds} Diamants</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {DIAMOND_OFFERS.map((offer) => {
            const affordable = diamonds >= offer.cost;
            return (
              <View key={offer.id} style={styles.offerRow}>
                <View style={styles.offerIconWrap}>
                  <Text style={styles.offerIcon}>{offer.icon}</Text>
                </View>
                <View style={styles.offerMiddle}>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.offerDesc} numberOfLines={2}>{offer.desc}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.buyBtn, !affordable && styles.buyBtnDisabled]}
                  onPress={() => handleBuy(offer)}
                  disabled={!affordable || busy === offer.id}
                >
                  <Text style={[styles.buyBtnText, !affordable && styles.buyBtnTextDisabled]}>
                    💎 {offer.cost}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <Text style={styles.footnote}>
            Les Diamants s'obtiennent dans le calendrier quotidien (bouton 🎁).
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  panel: {
    width: '100%', maxHeight: '82%',
    backgroundColor: COLORS.bg, borderRadius: 18,
    borderWidth: 2, borderColor: COLORS.border, overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.panelLight,
    borderBottomWidth: 2, borderBottomColor: COLORS.border,
  },
  panelTitle: { color: COLORS.text, fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: {
    position: 'absolute', right: 12, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border,
  },
  closeBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '900' },

  balanceRow: {
    alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  balanceText: { color: '#7fdcff', fontSize: 15, fontWeight: '900' },

  body: { padding: 12 },

  offerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.panel,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    padding: 10, marginBottom: 10,
  },
  offerIconWrap: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.panelLight,
    borderWidth: 1.5, borderColor: '#7fdcff',
    marginRight: 10,
  },
  offerIcon: { fontSize: 20 },
  // `minWidth: 0` : sans ça le texte pousse le bouton hors de la ligne
  // (règle de survie n°10).
  offerMiddle: { flex: 1, minWidth: 0, marginRight: 10 },
  offerTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  offerDesc: { color: COLORS.muted, fontSize: 10, fontWeight: '600', marginTop: 3 },

  buyBtn: {
    minWidth: 62, paddingVertical: 10, paddingHorizontal: 10, flexShrink: 0,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2a7fa8',
  },
  buyBtnDisabled: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.border },
  buyBtnText: { color: '#eaf9ff', fontSize: 13, fontWeight: '900' },
  buyBtnTextDisabled: { color: COLORS.muted },

  footnote: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, Dimensions } from 'react-native';
import { COLORS } from './clickerTheme';
import { GrandPanneau, largeurInterieure, CRISTAL } from './fenetreBois';

// 27/09 : Boutique du thème forêt (pièces Gemini 37-44 de l'auteur, kit
// partagé fenetreBois). Tailles en NOMBRES (règle du 27/09).
const { width: ECRAN_L, height: ECRAN_H } = Dimensions.get('window');
const PANNEAU_L = Math.min(Math.round(ECRAN_L * 0.94), 400);
const PANNEAU_H = Math.round(Math.min(ECRAN_H * 0.78, PANNEAU_L / 0.56));
const INTERIEUR = largeurInterieure(PANNEAU_L);
const LIGNE_H = 80;
const PLANCHE = require('../../../assets/fenetres/planche.png');
const PLAQUE = require('../../../assets/fenetres/plaque-solde.png');
const BOUTON_PRIX = require('../../../assets/fenetres/bouton-prix.png');
const RUBAN = require('../../../assets/fenetres/ruban-angle.png');
// ⚠️ Icône des Griffes pas encore reçue (image 39 manquante le 27/09) :
// tuile provisoire dessinée par le code avec l'émoji de l'offre.
const ICONES = {
  coins: require('../../../assets/boutique/icone-bourse.png'),
  energy: require('../../../assets/boutique/icone-energie.png'),
  elixir: require('../../../assets/boutique/icone-elixir.png'),
  hatch: require('../../../assets/boutique/icone-eclosion.png'),
};

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
    badge: 'Meilleure offre',
  },
  {
    id: 'elixir',
    icon: '🧪',
    title: 'Élixir de faiblesse',
    desc: 'Ennemis −10 % pendant tes 5 prochains combats (Aventure et Gardien)',
    // Prix provisoire (26/09) : à fixer avec l'auteur.
    cost: 30,
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

      <GrandPanneau titre="Boutique" largeur={PANNEAU_L} hauteur={PANNEAU_H} onFermer={onBack}>
        <View style={styles.plaque}>
          <Image source={PLAQUE} resizeMode="stretch" style={styles.plaqueImage} />
          <Image source={CRISTAL} resizeMode="contain" style={styles.plaqueCristal} />
          <Text style={styles.balanceText} numberOfLines={1}>{diamonds} Diamants</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          {DIAMOND_OFFERS.map((offer) => {
            const affordable = diamonds >= offer.cost;
            return (
              <View key={offer.id} style={styles.offerRow}>
                <Image source={PLANCHE} resizeMode="stretch" style={styles.offerPlanche} />
                {ICONES[offer.id] ? (
                  <Image source={ICONES[offer.id]} resizeMode="contain" style={styles.offerIconImg} />
                ) : (
                  <View style={styles.offerIconWrap}>
                    <Text style={styles.offerIcon}>{offer.icon}</Text>
                  </View>
                )}
                <View style={styles.offerMiddle}>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.offerDesc} numberOfLines={2}>{offer.desc}</Text>
                </View>
                {/* Bleu quand on peut acheter, estompé sinon. Le bouton PORTE sa
                    taille, l'image a une taille explicite. */}
                <TouchableOpacity
                  style={[styles.buyBtn, !affordable && styles.buyBtnDisabled]}
                  onPress={() => handleBuy(offer)}
                  disabled={!affordable || busy === offer.id}
                >
                  <Image source={BOUTON_PRIX} resizeMode="stretch" style={styles.buyBtnImage} />
                  <View style={styles.buyBtnLigne}>
                    <Image source={CRISTAL} resizeMode="contain" style={styles.buyBtnCristal} />
                    <Text style={styles.buyBtnText}>{offer.cost}</Text>
                  </View>
                </TouchableOpacity>
                {offer.badge ? (
                  <View style={styles.ruban}>
                    <Image source={RUBAN} resizeMode="contain" style={styles.rubanImage} />
                    <Text style={styles.rubanTexte} numberOfLines={2}>{offer.badge}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <Text style={styles.footnote}>
            Les Diamants s'obtiennent dans le calendrier quotidien (bouton 🎁).
          </Text>
        </ScrollView>
      </GrandPanneau>
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
  balanceText: { color: '#9fe6ff', fontSize: 16, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },

  body: { padding: 12 },

  offerRow: { width: INTERIEUR, height: LIGNE_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Math.round(INTERIEUR * 0.05), marginBottom: 8 },
  offerIconWrap: { width: 52, height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b352e', borderWidth: 3, borderColor: '#6d6358', marginRight: 10 },
  offerIcon: { fontSize: 24 },
  // `minWidth: 0` : sans ça le texte pousse le bouton hors de la ligne
  // (règle de survie n°10).
  offerMiddle: { flex: 1, minWidth: 0, marginRight: 10 },
  offerTitle: { color: '#fff7e0', fontSize: 14, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  offerDesc: { color: '#e6d6b0', fontSize: 10, fontWeight: '600', marginTop: 3, includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 },

  buyBtn: { width: 74, height: 46, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  buyBtnDisabled: { opacity: 0.5 },
  buyBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 3 },

  plaque: { width: 210, height: 46, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  plaqueImage: { position: 'absolute', left: 0, top: 0, width: 210, height: 46 },
  plaqueCristal: { width: 16, height: 30, marginRight: 8 },
  offerPlanche: { position: 'absolute', left: 0, top: 0, width: INTERIEUR, height: LIGNE_H },
  offerIconImg: { width: 54, height: 54, marginRight: 10 },
  buyBtnImage: { position: 'absolute', left: 0, top: 0, width: 74, height: 46 },
  buyBtnLigne: { flexDirection: 'row', alignItems: 'center' },
  buyBtnCristal: { width: 11, height: 21, marginRight: 4 },
  ruban: { position: 'absolute', right: -4, top: -4, width: 56, height: 56 },
  rubanImage: { position: 'absolute', left: 0, top: 0, width: 56, height: 56 },
  rubanTexte: { position: 'absolute', left: 12, top: 17, width: 44, color: '#fff', fontSize: 7, fontWeight: '900', textAlign: 'center', transform: [{ rotate: '45deg' }], includeFontPadding: false },
  footnote: { color: '#dccbaa', fontSize: 10, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 },
});

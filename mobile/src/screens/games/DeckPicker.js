// Sélecteur de deck — extrait dans son propre fichier (29/08) pour être
// réutilisable à la fois depuis ClickerScreen (écran principal, DeckRow, en
// PORTRAIT) ET AdventureScreen (hub de l'Exploration, en PAYSAGE) — SANS créer
// d'import circulaire entre les deux écrans (même piège déjà rencontré avec
// COLORS, voir clickerTheme.js).
// 06/10 (demande de l'auteur) : refait avec les pièces de la fiche créature — chaque
// créature sur le SOCLE de son élément dans le cadre doré, planche de titre, croix
// dorée, onglet de bois. S'adapte à l'orientation (3 colonnes en portrait, 6 en paysage).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, useWindowDimensions } from 'react-native';
import { CREATURES, RARITY_COLOR, stadeVisuel } from '../../games/clicker/clickerLogic';
import { CADRAGE_CREATURES, CADRAGE_DEFAUT } from '../../games/clicker/cadrageCreatures';
import CreatureArt from '../../components/CreatureArt';

const PIECES = {
  cadre: require('../../../assets/fiche/cadre.png'),
  plaque: require('../../../assets/exploration/plaque-titre.png'),
  lueur: require('../../../assets/grimoire/lueur-or.png'),
  onglet: { g: require('../../../assets/fiche/onglet-g.png'), m: require('../../../assets/fiche/onglet-m.png'), d: require('../../../assets/fiche/onglet-d.png'), capG: 48, capD: 48, h: 236 },
  socles: {
    Feu: require('../../../assets/fiche/socles/feu.png'),
    Eau: require('../../../assets/fiche/socles/eau.png'),
    Terre: require('../../../assets/fiche/socles/terre.png'),
    Air: require('../../../assets/fiche/socles/air.png'),
    Foudre: require('../../../assets/fiche/socles/foudre.png'),
    'Lumière': require('../../../assets/fiche/socles/lumiere.png'),
    'Ténèbres': require('../../../assets/fiche/socles/tenebres.png'),
    Magie: require('../../../assets/fiche/socles/magie.png'),
  },
};
const RAPPORT_PLAQUE = 1300 / 313;

// Une carte : la créature posée sur le PLATEAU de son socle (bas du cadrage), dans le cadre doré.
function CarteCreature({ largeur, creature, tier, actuelle, ailleurs, onPress }) {
  const stage = stadeVisuel(tier);
  const display = creature.stages[stage];
  const L = largeur; const Hc = L * 1.02;
  const socleL = L * 0.74; const socleH = socleL / 1.75;
  const socleTop = Hc * 0.9 - socleH; const plateau = socleTop + socleH * 0.3;
  const c = (CADRAGE_CREATURES[creature.id] && CADRAGE_CREATURES[creature.id][stage]) || CADRAGE_DEFAUT;
  const S = Math.min((Hc * 0.46) / (c[3] - c[1]), (L * 0.78) / (c[2] - c[0]));
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ width: L, marginBottom: 8, opacity: ailleurs ? 0.55 : 1 }}>
      <View style={{ width: L, height: Hc }}>
        <View style={[styles.interieur, { left: L * 0.03, top: L * 0.03, width: L * 0.94, height: Hc - L * 0.06 }]}>
          <Image source={PIECES.lueur} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: L * 0.94, height: Hc * 0.75, opacity: 0.85 }} />
        </View>
        <Image source={PIECES.socles[creature.element] || PIECES.socles['Lumière']} resizeMethod="scale" resizeMode="stretch"
          style={{ position: 'absolute', left: (L - socleL) / 2, top: socleTop, width: socleL, height: socleH }} />
        <View style={{ position: 'absolute', left: L / 2 - ((c[0] + c[2]) / 2) * S, top: plateau - c[3] * S, width: S, height: S, pointerEvents: 'none' }}>
          <CreatureArt creatureId={creature.id} stageIndex={stage} emoji={display.emoji} size={S} emojiStyle={{ fontSize: S * 0.5, textAlign: 'center' }} />
        </View>
        <Image source={PIECES.cadre} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: L, height: Hc, pointerEvents: 'none' }} />
        {actuelle && <View style={[styles.actuelle, { width: L, height: Hc }]} />}
      </View>
      <Text style={[styles.nom, { color: RARITY_COLOR[creature.rarity] || '#fff3d6' }]} numberOfLines={1}>{display.name}</Text>
      {ailleurs && <Text style={styles.ailleurs}>déjà en jeu</Text>}
    </TouchableOpacity>
  );
}

// Choix de quelle créature possédée occupe l'emplacement tapé. Une
// créature déjà dans un autre emplacement peut être choisie — elle sera
// simplement retirée de l'autre emplacement (pas de doublon dans le deck).
export function DeckPicker({ slotIndex, deck, owned, onPick, onClear, onClose }) {
  const { width: W, height: H } = useWindowDimensions();
  const paysage = W > H;
  const cols = paysage ? 6 : 3;
  const marge = paysage ? Math.max(24, W * 0.06) : 16; const gap = 10;
  const carteL = Math.floor((W - 2 * marge - gap * (cols - 1)) / cols);
  const plaqueL = Math.min(W * (paysage ? 0.42 : 0.82), 520); const plaqueH = plaqueL / RAPPORT_PLAQUE;
  const haut = paysage ? 8 : 44;
  const valides = owned.filter((o) => CREATURES.some((c) => c.id === o.id)); // garde-fou : un id devenu invalide est ignoré
  const ongletH = paysage ? 44 : 48; const ongletK = ongletH / PIECES.onglet.h;
  return (
    <View style={styles.overlay}>
      <View style={{ position: 'absolute', left: W / 2 - plaqueL / 2, top: haut, width: plaqueL, height: plaqueH }}>
        <Image source={PIECES.plaque} resizeMethod="scale" resizeMode="stretch" style={{ position: 'absolute', left: 0, top: 0, width: plaqueL, height: plaqueH }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.titre, { fontSize: Math.round(plaqueH * 0.3) }]} numberOfLines={1}>Emplacement {slotIndex + 1}</Text>
          <Text style={[styles.sousTitre, { fontSize: Math.round(plaqueH * 0.17) }]} numberOfLines={1}>Choisis une créature</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.fermer, { top: haut + 4, right: paysage ? 18 : 12 }]} onPress={onClose} activeOpacity={0.8}>
        <Text style={styles.fermerTexte}>✕</Text>
      </TouchableOpacity>
      {/* maxHeight sur ce View englobant, PAS sur le ScrollView lui-même (peu fiable en RN). */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: haut + plaqueH + 8, bottom: 0 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: marge, paddingBottom: 30 }}>
          {valides.length === 0 ? (
            <Text style={styles.vide}>Tu ne possèdes encore aucune créature — invoque-en une d'abord !</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gap }}>
              {valides.map((o) => {
                const creature = CREATURES.find((c) => c.id === o.id);
                return (
                  <CarteCreature key={o.id} largeur={carteL} creature={creature} tier={o.evolutionTier}
                    actuelle={deck[slotIndex] === o.id} ailleurs={deck.includes(o.id) && deck[slotIndex] !== o.id}
                    onPress={() => onPick(o.id)} />
                );
              })}
            </View>
          )}
          {deck[slotIndex] && (
            <TouchableOpacity onPress={onClear} activeOpacity={0.85} style={{ alignSelf: 'center', width: 260, height: ongletH, marginTop: 8 }}>
              <View style={{ position: 'absolute', left: 0, top: 0, width: 260, height: ongletH, flexDirection: 'row' }}>
                <Image source={PIECES.onglet.g} resizeMethod="scale" resizeMode="stretch" style={{ width: PIECES.onglet.capG * ongletK, height: ongletH }} />
                <Image source={PIECES.onglet.m} resizeMethod="scale" resizeMode="stretch" style={{ flex: 1, height: ongletH }} />
                <Image source={PIECES.onglet.d} resizeMethod="scale" resizeMode="stretch" style={{ width: PIECES.onglet.capD * ongletK, height: ongletH }} />
              </View>
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={styles.vider}>Vider cet emplacement</Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // zIndex 50 : AU-DESSUS de toute barre (leçon du bouton RETOUR du 05/10).
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, backgroundColor: 'rgba(4,8,12,0.86)' },
  titre: { color: '#fff3d6', fontWeight: '900', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
  sousTitre: { color: '#f3dcae', fontWeight: '800', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
  fermer: { position: 'absolute', width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: '#d6a64d', backgroundColor: '#6b4521', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  fermerTexte: { color: '#ffe9a8', fontSize: 22, fontWeight: '900', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false },
  interieur: { position: 'absolute', backgroundColor: '#cfe7ee', borderRadius: 8, overflow: 'hidden' },
  actuelle: { position: 'absolute', left: 0, top: 0, borderRadius: 10, borderWidth: 3, borderColor: '#ffd96a', pointerEvents: 'none' },
  nom: { fontSize: 13, fontWeight: '900', marginTop: 4, textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 3 },
  ailleurs: { color: '#c9d4dc', fontSize: 10, fontStyle: 'italic', marginTop: 1, textAlign: 'center', alignSelf: 'stretch' },
  vide: { color: '#f1e2c4', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  vider: { color: '#ffb1a6', fontSize: 15, fontWeight: '900', textAlign: 'center', alignSelf: 'stretch', includeFontPadding: false, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3 },
});

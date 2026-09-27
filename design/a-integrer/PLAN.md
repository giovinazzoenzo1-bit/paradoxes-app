# Plan de design Paradox

Chaque dossier = une section de l'appli : sa fiche (`LISEZMOI.md`), ses images actuelles (`actuel/`) et son lien d'envoi. **Aucun renommage** : Claude reconnaît chaque image par son format et son contenu. Dossier HORS de `mobile/` : un envoi ne publie rien.

## Interface

| Dossier | Contenu | Images actuelles |
|---|---|---|
| `00-icone-et-demarrage` | Icône de l'appli, icône Android, écran de démarrage | 4 |
| `01-menu-principal` | Écran principal (clicker) : fond, navigation, ressources, Ascension | 9 |
| `02-boutique` | Boutique (pièces et diamants) : packs, Élixir, Griffes | 1 |
| `03-collection-et-deck` | Collection des créatures et choix du deck : cadres de cartes par élément | 10 |
| `04-oeufs-incubateur` | Œufs et éclosion (5 états de l'œuf) | 5 |
| `05-aventure-carte` | Carte de l'Aventure : un décor par chapitre, bandeau de titre | 14 |
| `06-aventure-apercu` | Aperçu d'un niveau avant le combat : bouton Combattre, puissance | 1 |
| `07-combat` | Combat : champ de bataille, barres de PV et de mana, boutons d'attaque et de sorts | 1 |
| `08-fin-de-combat` | Victoire et défaite : fonds, bandeaux, cadre du récapitulatif, étoiles | 5 |
| `09-gardien` | Combat du Gardien : décor et bandeau | 0 |
| `10-defis-progres` | Défis, quêtes, succès, calendrier | 0 |
| `11-runes-et-forge` | Runes (7 types), boutique et forge | 14 |
| `12-icones-communes` | Icônes partagées : Griffes, pièces, diamants, retour, halos | 5 |
| `13-themes-elements` | Thème visuel par élément (fond, bouton, cadre, emplacement de rune) | 4 |

## Créatures (6/26 dessinées)

| Créature | Rareté | Élément | Sort | État |
|---|---|---|---|---|
| Bouldog | commun | Terre | provocation | ✅ 3 stades dessinés |
| Caraploof | commun | Eau | bouclier | ✅ 3 stades dessinés |
| Glyphon | commun | Magie | marque | 🟥 à créer (3 stades) |
| Luxorbe | commun | Lumière | soin | 🟥 à créer (3 stades) |
| Ombrillon | commun | Ténèbres | execution | 🟥 à créer (3 stades) |
| Pyrosile | commun | Feu | zone | ✅ 3 stades dessinés |
| Ventis | commun | Air | zone | ✅ 3 stades dessinés |
| Voltix | commun | Foudre | zone | ✅ 3 stades dessinés |
| Aquamira | peu commun | Eau | soin | 🟥 à créer (3 stades) |
| Brontobloc | peu commun | Foudre | provocation | 🟥 à créer (3 stades) |
| Fournax | peu commun | Feu | poison | 🟥 à créer (3 stades) |
| Malefix | peu commun | Magie | pacte | 🟥 à créer (3 stades) |
| Terracroc | peu commun | Terre | pacte | 🟥 à créer (3 stades) |
| Zephyrion | peu commun | Air | vitesse | 🟥 à créer (3 stades) |
| Aegisolar | rare | Lumière | bouclier | ✅ 3 stades dessinés |
| Braiserose | rare | Feu | boost | 🟥 à créer (3 stades) |
| Nocturis | rare | Ténèbres | marque | 🟥 à créer (3 stades) |
| Racinea | rare | Terre | vitesse | 🟥 à créer (3 stades) |
| Runicor | rare | Magie | bouclier | 🟥 à créer (3 stades) |
| Abyssorax | epique | Eau | execution | 🟥 à créer (3 stades) |
| Cumulox | epique | Air | poison | 🟥 à créer (3 stades) |
| Solarion | epique | Lumière | zone | 🟥 à créer (3 stades) |
| Voltarel | epique | Foudre | boost | 🟥 à créer (3 stades) |
| Solstral | legendaire | Lumière | execution | 🟥 à créer (3 stades) |
| Tartaroth | legendaire | Ténèbres | poison | 🟥 à créer (3 stades) |
| Arcanis | mythique | Magie | pacte | 🟥 à créer (3 stades) |

## Méthode

1. Claude écrit les prompts Gemini de la section (format, cadrage, style cohérent).
2. Tu génères, puis tu déposes les images dans le dossier (lien dans sa fiche).
3. Claude les récupère, les identifie, les optimise, les intègre dans `mobile/assets/` et capture le rendu avant / après.
4. Tu valides ; Claude vide les images intégrées du dossier.

// ⚠️⚠️ FICHIER RÉÉCRIT À CHAQUE PUBLICATION par .github/workflows/
// mobile-publish.yml, juste avant `eas update`.
//
// Pourquoi il existe : l'auteur n'a aucun moyen de savoir si son
// téléphone a bien chargé la dernière mise à jour. Le 19/09, il a passé
// une heure à signaler des « bugs » de défis qui étaient en réalité
// l'ancienne version encore en cache — trois fois dans la même journée.
// Afficher la date du dernier envoi dans les Options règle ça d'un coup
// d'œil.
//
// ⚠️ Les valeurs ci-dessous sont celles du DÉPÔT, pas d'une publication.
// Si l'appli affiche « version locale », c'est qu'elle tourne sur un
// bundle qui n'est pas passé par le robot — donc pas à jour.
export const BUILD_SHA = 'local';
export const BUILD_TIME = 'version locale';

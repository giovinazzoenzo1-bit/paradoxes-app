#!/bin/sh
# ════════════════════════════════════════════════════════════════════
#  GARDE ANTI-DOUBLON — première commande de toute réponse qui écrit
# ════════════════════════════════════════════════════════════════════
#
#   sh mobile/tools/garde.sh prendre <étiquette>   avant chaque écriture
#   sh mobile/tools/garde.sh rendre  <étiquette>   après le push
#   sh mobile/tools/garde.sh forcer  <étiquette>   reprendre la main (copie morte, vérifiée)
#
# ⚠️ LE 24/09, QUATRE FOIS, DEUX COPIES DE CLAUDE ONT TRAVAILLÉ EN MÊME
# TEMPS SUR CE DÉPÔT. « Réessayer » après une réponse coupée relance une
# copie dans le même bac à sable, pendant que l'ancienne tourne parfois
# encore ; et deux conversations ont fait la passe 2 en parallèle. Une
# copie a trouvé 13 fichiers à moitié écrits par une autre ; une autre a
# refait une passe déjà poussée, dont l'auteur n'avait jamais vu la
# réponse.
#
# « prendre » refuse (code 1) si une AUTRE copie a écrit le verrou il y a
# moins de 10 minutes. À la première prise d'une réponse, il refuse aussi
# si des fichiers sont modifiés (copie coupée : les RELIRE et les MESURER,
# jamais les écraser) ou si GitHub a avancé (une copie a poussé : lire son
# commit, puis `git pull --ff-only`). Le verrou vit dans .git/ : jamais
# commité, jamais publié.
cd "$(dirname "$0")/../.." || exit 2
V=.git/verrou-claude
[ -n "$2" ] || { echo "usage : garde.sh prendre|rendre|forcer <étiquette>"; exit 2; }
case "$1" in
  prendre|forcer)
    git fetch -q origin 2>/dev/null
    proprio=$(cat "$V" 2>/dev/null)
    # ⚠️ 26/09 : deux copies de Claude (message relancé par « Réessayer »)
    # avaient pris la MÊME étiquette « R-puissance » : chacune se croyait
    # propriétaire, le garde ne voyait rien. Le hasard vient désormais du
    # SCRIPT (une copie « au hasard » choisit le même suffixe) : sans « # »,
    # l'étiquette reçoit un suffixe aléatoire. RÉUTILISER EXACTEMENT
    # l'étiquette affichée (prendre, rendre). Un verrou déjà tenu sous une
    # ancienne étiquette sans « # » reste reprenable par elle.
    case "$2" in
      *'#'*) ;;
      *) if [ "$proprio" != "$2" ]; then set -- "$1" "$2#$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')"; fi ;;
    esac
    if [ "$1" = prendre ] && [ -n "$proprio" ] && [ "$proprio" != "$2" ]; then
      age=$(( $(date +%s) - $(stat -c %Y "$V") ))
      if [ "$age" -lt 600 ]; then
        echo "STOP : la copie « $proprio » travaille (verrou écrit il y a ${age} s)"; exit 1
      fi
    fi
    if [ "$1" = forcer ]; then
      echo "FORCÉ : $(git status --short | wc -l) fichier(s) modifié(s) · local $(git log -1 --format=%h) · GitHub $(git log -1 --format=%h origin/main)"
    elif [ "$proprio" != "$2" ]; then
      n=$(git status --short | wc -l)
      if [ "$n" -gt 0 ]; then echo "STOP : $n fichier(s) modifié(s) par une copie coupée — les relire avant tout"; exit 1; fi
      if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
        echo "STOP : local $(git log -1 --format=%h) ≠ GitHub $(git log -1 --format=%h origin/main) — lire le commit, puis git pull --ff-only"; exit 1
      fi
    fi
    echo "$2" > "$V"; echo "OK : verrou « $2 » — réutilise EXACTEMENT cette étiquette" ;;
  rendre)
    if [ "$(cat "$V" 2>/dev/null)" = "$2" ]; then rm -f "$V"; echo "verrou rendu"; else echo "verrou pas à nous : laissé"; fi ;;
  *) echo "usage : garde.sh prendre|rendre|forcer <étiquette>"; exit 2 ;;
esac

#!/usr/bin/env bash
# Buduje obrazy Dockera LOKALNIE na Macu (pod linux/amd64) i przerzuca gotowe
# warstwy na dropleta cortex-next: docker build -> docker save -> rsync ->
# docker load -> sprzątanie po obu stronach. Ten sam wzorzec co
# devops/playbooks/roles/app-deployment/tasks/docker_images.yml, tylko z
# `docker build` zamiast `docker pull`: serwer nie ma dostępu ani do repo git,
# ani do GHCR i świadomie nie ma tam leżeć żadne poświadczenie.
#
# DLACZEGO to w ogóle powstało: `docker compose up --build` NA SERWERZE raz już
# położył całego hosta na OOM. Compose buduje serwisy równolegle, a `next build`
# sam w sobie potrafi zająć kilka GB — na dropleta wchodziło to razem z Caddy,
# Keycloakiem, chatem i cortex-proxy, które na nim mieszkają w sieci
# `run_default`. Serwer ma być wyłącznie środowiskiem URUCHOMIENIOWYM; ciężar
# builda bierze Mac (M4, 10 rdzeni, 24 GB RAM).
#
# DLACZEGO emulacja amd64 tu nie boli (ZMIERZONE na tym Macu, nie oszacowane):
# Docker Desktop na Apple Silicon tłumaczy amd64 przez Rosettę, nie przez QEMU,
# więc narzut jest kilkudziesięcioprocentowy, a nie kilkukrotny. Buildy
# `--no-cache`, linux/amd64:
#   services/document-parser/unoserver   91 s
#   services/geo-score-calculator      36,7 s   (natywny arm64: 24,8 s -> x1,5)
#   services/document-parser             17 s
#   Dockerfile (Next.js, cały)          323 s   (w tym ~120 s straconych na
#                                                retry po zapchanym dysku VM)
# Rozstrzygające: sam `pnpm run build` w emulacji zajął 166,8 s, a NA SERWERZE
# natywnie zajmował 228 s. Ten Mac buduje amd64 SZYBCIEJ niż droplet, mimo
# emulacji — i robi to nie ryzykując położeniem hosta.
#
# CZEGO TU CELOWO NIE MA:
#  * kompresji tara — `docker save` zapisuje warstwy JUŻ zgzipowane przez
#    containerd. Zmierzone: obraz 520 MB -> tar 129 MB, a ponowny `gzip -1`
#    ścina z tego 1 MB w 2 s. Kompresowanie to czysta strata czasu.
#    Realne rozmiary transferu: sam cortex-frontend (+migrate) 557 MB,
#    komplet czterech obrazów 939 MB.
#  * pliku override podmieniającego `build:` na `image:` — okazał się zbędny.
#    Compose nadaje budowanym obrazom nazwę `<projekt>-<usługa>:latest`, gdzie
#    <projekt> to nazwa katalogu; ten skrypt taguje DOKŁADNIE tak samo, a
#    `docker compose up -d` buduje wyłącznie wtedy, gdy obrazu NIE MA lokalnie
#    (zweryfikowane realnym `compose up`). Override wymagałby dopisania trzeciego
#    pliku do COMPOSE_FILE w .env na serwerze i nic by nie kupił: `pull_policy:
#    never` obok `build:` NIE blokuje builda (też sprawdzone — Compose i tak
#    zbudował). Jedyne, co realnie chroni serwer, to nie pisać `--build`.
set -euo pipefail

REMOTE_HOST="cortex-next"
# Nazwa katalogu na serwerze (względem $HOME) — ta sama, którą stawia
# sync-cortex-next.sh. Jest jednocześnie nazwą projektu Compose, a więc
# prefiksem nazw obrazów. Jeśli katalog na serwerze się zmieni, ta zmienna MUSI
# pójść za nim — inaczej Compose nie rozpozna wgranych obrazów i zacznie budować
# u siebie, czyli wróci dokładnie ten OOM, przed którym ten skrypt chroni.
REMOTE_DIR="cortex-frontend-experiment"
PROJECT="$REMOTE_DIR"
PLATFORM="linux/amd64"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Usługi z docker-compose.yml, które mają `build:`. `migrate` NIE jest tu
# osobno: dzieli z cortex-frontend ten sam Dockerfile i kontekst, więc leci
# jako drugi tag tego samego builda (patrz niżej). `postgres` ma gotowy obraz
# z Docker Huba i serwer ciągnie go sam. `template-python-service` siedzi za
# profilem `python-template` i nie startuje z domyślnego `compose up`.
ALL_SERVICES="cortex-frontend geo-score-calculator document-parser-backend document-parser-unoserver"

context_for() {
  case "$1" in
    cortex-frontend)           echo "." ;;
    geo-score-calculator)      echo "services/geo-score-calculator" ;;
    document-parser-backend)   echo "services/document-parser" ;;
    document-parser-unoserver) echo "services/document-parser/unoserver" ;;
    *) return 1 ;;
  esac
}

usage() {
  cat <<EOF
Użycie: $(basename "$0") [--prune] [all | <usługa> ...]

  Bez argumentów albo z "all" — buduje i wysyła wszystkie cztery obrazy.
  Podanie usług ogranicza robotę do nich (na co dzień zmienia się sam
  cortex-frontend, a serwisy Pythona stoją tygodniami bez zmian).

Usługi: $ALL_SERVICES
  cortex-frontend obejmuje TAKŻE usługę \`migrate\` — to ten sam obraz,
  budowany raz i tagowany dwa razy.

  --prune   po wgraniu kasuje na serwerze osierocone (dangling) obrazy,
            czyli poprzednie wersje tych tagów. Domyślnie WYŁĄCZONE, bo
            \`docker image prune\` działa na całego demona, a na tym hoście
            stoją też cudze stacki (Caddy, Keycloak, chat, cortex-proxy).

Przed wysyłką zsynchronizuj drzewo (docker-compose.yml, .env czyta serwer,
nie obraz):  ./scripts/sync-cortex-next.sh        <- BEZ --build
Po wysyłce:  ssh $REMOTE_HOST 'cd ~/$REMOTE_DIR && docker compose up -d'
EOF
}

PRUNE=0
SELECTED=""
for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --prune)   PRUNE=1 ;;
    all)       SELECTED="$ALL_SERVICES" ;;
    -*)        echo "Nieznana opcja: $arg" >&2; usage >&2; exit 2 ;;
    *)
      if ! context_for "$arg" >/dev/null 2>&1; then
        echo "Nieznana usługa: $arg" >&2; usage >&2; exit 2
      fi
      SELECTED="$SELECTED $arg"
      ;;
  esac
done
[ -n "$SELECTED" ] || SELECTED="$ALL_SERVICES"

# Ten sam ciąg, który CI wstrzykuje jako VERSION -> NEXT_PUBLIC_SHELL_VERSION,
# żeby na wdrożonym środowisku dało się powiedzieć, z którego commita jest
# powłoka. `dev` gdy katalog nie jest repo gita.
VERSION="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo dev)"

# --provenance=false: bez tego buildx dokłada manifest atestacji i obraz staje
# się listą manifestów zamiast zwykłego obrazu jednoplatformowego — po stronie
# `docker save`/`docker load` niepotrzebna komplikacja.
#
# Realny tryb awarii, na który się tu nadziałem przy weryfikacji: build umiera
# na ENOSPC, ale NIE dlatego, że brakuje miejsca na Macu (host ma ~250 GB) —
# kończy się wirtualny dysk maszyny Docker Desktop (62 GB, dzielone ze
# WSZYSTKIMI obrazami i cache'em builda na tej maszynie), a każdy przebudowany
# obraz zostawia po sobie osierocony poprzedni.
build_or_die() {
  if ! docker build "$@"; then
    echo "" >&2
    echo "Build padł. Jeśli w logu wyżej jest ENOSPC / 'no space left on device'," >&2
    echo "to dysk WIRTUALKI Docker Desktop, nie Maca. Zwolnij i powtórz:" >&2
    echo "  docker builder prune -f && docker image prune -f" >&2
    exit 1
  fi
}

echo "==> Build ($PLATFORM), commit $VERSION"
IMAGES=""
for svc in $SELECTED; do
  ctx="$(context_for "$svc")"
  img="$PROJECT-$svc:latest"
  echo ""
  echo "--- $svc -> $img  (kontekst: $ctx)"
  if [ "$svc" = "cortex-frontend" ]; then
    migrate_img="$PROJECT-migrate:latest"
    build_or_die --platform "$PLATFORM" --provenance=false \
      --build-arg "VERSION=$VERSION" \
      -t "$img" -t "$migrate_img" "$REPO_DIR/$ctx"
    IMAGES="$IMAGES $img $migrate_img"
  else
    build_or_die --platform "$PLATFORM" --provenance=false \
      -t "$img" "$REPO_DIR/$ctx"
    IMAGES="$IMAGES $img"
  fi
done

# Jeden tar na wszystko, nie plik per obraz jak w Ansible: `docker save` z wieloma
# referencjami zapisuje WSPÓLNE warstwy raz. Zweryfikowane: tar z samym
# cortex-frontend i tar z cortex-frontend + migrate mają IDENTYCZNE 557 MB —
# drugi tag jest darmowy. Oba serwisy Pythona dzielą z kolei python:3.12-slim.
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL_TAR="/tmp/cortex-next-images-$STAMP.tar"
REMOTE_TAR="cortex-next-images-$STAMP.tar"
trap 'rm -f "$LOCAL_TAR"' EXIT

echo ""
echo "==> docker save ->$IMAGES"
# shellcheck disable=SC2086  # $IMAGES ma się rozbić na osobne argumenty
docker save $IMAGES -o "$LOCAL_TAR"
TAR_MB=$(( $(wc -c < "$LOCAL_TAR") / 1048576 ))
echo "    $LOCAL_TAR = ${TAR_MB} MB"

# Pre-flight jak w referencyjnym docker_images.yml, tylko po stronie serwera —
# to on jest ciasny. `docker load` potrzebuje miejsca na tar ORAZ na rozpakowane
# warstwy, stąd zapas x3. Zapchany dysk na tym droplecie boli tak samo jak OOM.
echo ""
echo "==> Miejsce na $REMOTE_HOST (ssh, read-only)"
AVAIL_MB="$(ssh "$REMOTE_HOST" "df -Pm / | awk 'NR==2 {print \$4}'")"
NEED_MB=$(( TAR_MB * 3 ))
echo "    wolne: ${AVAIL_MB} MB, potrzebne z zapasem: ${NEED_MB} MB"
if [ "$AVAIL_MB" -lt "$NEED_MB" ]; then
  echo "PRZERWANE: za mało miejsca na $REMOTE_HOST." >&2
  echo "Zwolnij je (np. ssh $REMOTE_HOST 'docker image prune -f') i powtórz." >&2
  exit 1
fi

# rsync, nie scp: --partial pozwala dokończyć przerwany transfer wielosetmegowego
# tara zamiast zaczynać od zera. Bez -z — patrz nagłówek, warstwy są już zgzipowane.
echo ""
echo "==> Transfer -> $REMOTE_HOST:~/$REMOTE_TAR"
rsync -a --partial --progress "$LOCAL_TAR" "$REMOTE_HOST:$REMOTE_TAR"

echo ""
echo "==> docker load na $REMOTE_HOST"
# shellcheck disable=SC2029  # $REMOTE_TAR ma się rozwinąć lokalnie, to nasza nazwa pliku
ssh "$REMOTE_HOST" "docker load -i $REMOTE_TAR && rm -f $REMOTE_TAR"

if [ "$PRUNE" -eq 1 ]; then
  echo ""
  echo "==> docker image prune -f na $REMOTE_HOST"
  ssh "$REMOTE_HOST" "docker image prune -f"
fi

echo ""
echo "Gotowe. Wgrane obrazy:$IMAGES"
cat <<EOF

Teraz na serwerze (BEZ --build — obrazy już tam są, Compose ich użyje):
  ./scripts/sync-cortex-next.sh
  ssh $REMOTE_HOST 'cd ~/$REMOTE_DIR && docker compose up -d'
EOF

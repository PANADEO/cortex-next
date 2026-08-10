#!/usr/bin/env bash
# Wysyła na instancję serwerową to, czego serwer realnie potrzebuje do
# URUCHOMIENIA stacku: dwa pliki compose. Nic więcej — obrazy przychodzą osobno
# przez scripts/ship-images-cortex-next.sh (build na Macu pod linux/amd64,
# docker save → rsync → docker load), a `.env` żyje wyłącznie na serwerze i nie
# jest tu ruszany.
#
# Dlaczego nie całe drzewo źródeł: docker-compose.server.yml kasuje wszystkie
# sekcje `build:` i przypina gotowe obrazy, więc serwer nie ma czego budować.
# Żaden serwis nie montuje plików z hosta (zero bind mountów, wyłącznie wolumeny
# nazwane i tmpfs), więc źródła byłyby tam 440 MB martwego balastu — i kuszącą
# okazją, żeby jednak coś zbudować na maszynie, która raz już padła na OOM.
#
# Git na serwerze celowo nie istnieje: te boksy nie mają i nie mają mieć
# poświadczeń do repozytoriów.
#
#   ./scripts/sync-cortex-next.sh                      # domyślnie cortex-next
#   ./scripts/sync-cortex-next.sh --host demo-next --dir cortex-frontend
set -euo pipefail

REMOTE_HOST="cortex-next"
REMOTE_DIR="cortex-frontend-experiment"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --host) REMOTE_HOST="$2"; shift 2 ;;
    --dir)  REMOTE_DIR="$2";  shift 2 ;;
    -h|--help)
      echo "Użycie: $(basename "$0") [--host <alias-ssh>] [--dir <katalog-na-serwerze>]"
      echo "  domyślnie: --host $REMOTE_HOST --dir $REMOTE_DIR"
      echo ""
      echo "UWAGA: <katalog-na-serwerze> musi się zgadzać z IMAGE_PREFIX w .env"
      echo "tamtej instancji — to nazwa projektu Compose, a więc prefiks nazw obrazów."
      exit 0 ;;
    *) echo "Nieznany argument: $1" >&2; exit 2 ;;
  esac
done

ssh "$REMOTE_HOST" "mkdir -p ~/$REMOTE_DIR"

rsync -avz \
  "$LOCAL_DIR/docker-compose.yml" \
  "$LOCAL_DIR/docker-compose.server.yml" \
  "$REMOTE_HOST:$REMOTE_DIR/"

echo ""
echo "Pliki compose wysłane do $REMOTE_HOST:~/$REMOTE_DIR"
echo "Obrazy: ./scripts/ship-images-cortex-next.sh --host $REMOTE_HOST --dir $REMOTE_DIR"
echo "Start:  ssh $REMOTE_HOST 'cd ~/$REMOTE_DIR && docker compose up -d'"

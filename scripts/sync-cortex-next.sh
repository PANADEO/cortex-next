#!/usr/bin/env bash
# Wysyła na droplet cortex-next to, czego serwer realnie potrzebuje do URUCHOMIENIA
# stacku: oba pliki compose. Nic więcej — obrazy przychodzą osobno przez
# scripts/ship-images-cortex-next.sh (build na Macu pod linux/amd64, docker save
# → rsync → docker load), a `.env` żyje wyłącznie na serwerze i nie jest tu
# ruszany.
#
# Dlaczego nie całe drzewo źródeł, jak wcześniej: docker-compose.cortex-next.yml
# kasuje wszystkie sekcje `build:` i przypina gotowe obrazy po nazwie, więc
# serwer nie ma czego budować. Żaden serwis nie montuje plików z hosta (zero
# bind mountów, wyłącznie wolumeny nazwane i tmpfs), więc źródła na serwerze
# byłyby 440 MB martwego balastu — i kuszącą okazją, żeby jednak coś tam zbudować.
#
# Git na serwerze celowo nie istnieje: ten box nie ma i nie ma mieć poświadczeń
# do repozytoriów.
set -euo pipefail

REMOTE_HOST="cortex-next"
REMOTE_DIR="cortex-frontend-experiment"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ssh "$REMOTE_HOST" "mkdir -p ~/$REMOTE_DIR"

rsync -avz \
  "$LOCAL_DIR/docker-compose.yml" \
  "$LOCAL_DIR/docker-compose.cortex-next.yml" \
  "$REMOTE_HOST:$REMOTE_DIR/"

echo ""
echo "Pliki compose wysłane do $REMOTE_HOST:~/$REMOTE_DIR"
echo "Obrazy: ./scripts/ship-images-cortex-next.sh"
echo "Start:  ssh $REMOTE_HOST 'cd ~/$REMOTE_DIR && docker compose up -d'"

#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${PI_DATA_DIR:-$HOME/PiConsoleData}"

cd "$PROJECT_DIR"
export PI_DATA_DIR="$DATA_DIR"

echo "[*] 停止 Pi Console..."
docker compose -f docker-compose.local.yml --profile search down 2>/dev/null || \
    docker compose -f docker-compose.local.yml down 2>/dev/null || true

echo "[OK] Pi Console 已停止"
echo "    数据保留在: $DATA_DIR"
echo "    如需清除数据: rm -rf $DATA_DIR"

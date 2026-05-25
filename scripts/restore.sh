#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${PI_DATA_DIR:-$HOME/PiConsoleData}"
BACKUP_DIR="$DATA_DIR/backups"

if [ -z "${1:-}" ]; then
    echo "用法: bash scripts/restore.sh <备份名称>"
    echo ""
    echo "可用备份:"
    ls -1 "$BACKUP_DIR" 2>/dev/null | sed 's/^/  /' || echo "  (无)"
    exit 1
fi

BACKUP_NAME="$1"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

if [ ! -d "$BACKUP_PATH" ]; then
    echo "[!] 备份不存在: $BACKUP_PATH"
    exit 1
fi

echo "================================"
echo "  Pi Console - 数据恢复"
echo "================================"
echo "备份: $BACKUP_PATH"
echo ""
read -p "确认恢复? 当前数据将被覆盖 (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "取消"
    exit 0
fi

cd "$PROJECT_DIR"
export PI_DATA_DIR="$DATA_DIR"

PG_USER=$(grep '^POSTGRES_USER=' .env.local 2>/dev/null | cut -d= -f2- || echo "pi")
PG_DB=$(grep '^POSTGRES_DB=' .env.local 2>/dev/null | cut -d= -f2- || echo "pi_console")

echo "[1/3] 确保 PostgreSQL 运行..."
docker compose -f docker-compose.local.yml up -d postgres
sleep 3

if [ -f "$BACKUP_PATH/database.sql" ]; then
    echo "[2/3] 恢复数据库..."
    docker compose -f docker-compose.local.yml exec -T postgres \
        psql -U "$PG_USER" -d "$PG_DB" < "$BACKUP_PATH/database.sql" > /dev/null 2>&1
    echo "  数据库恢复完成"
else
    echo "[2/3] 未找到数据库备份，跳过"
fi

if [ -d "$BACKUP_PATH/exports" ]; then
    echo "[3/3] 恢复 exports..."
    cp -r "$BACKUP_PATH/exports/"* "$DATA_DIR/exports/" 2>/dev/null || true
    echo "  exports 恢复完成"
else
    echo "[3/3] 未找到 exports 备份，跳过"
fi

if [ -f "$BACKUP_PATH/.env.local.bak" ]; then
    echo "[*] 配置备份存在于 $BACKUP_PATH/.env.local.bak"
    echo "    如需恢复: cp $BACKUP_PATH/.env.local.bak .env.local"
fi

echo ""
echo "================================"
echo "  恢复完成，请重启服务:"
echo "  bash scripts/stop.sh && bash scripts/start.sh"
echo "================================"

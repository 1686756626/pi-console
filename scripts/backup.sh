#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${PI_DATA_DIR:-$HOME/PiConsoleData}"
BACKUP_DIR="$DATA_DIR/backups"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="pi-console-$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

mkdir -p "$BACKUP_PATH"

echo "================================"
echo "  Pi Console - 数据备份"
echo "================================"
echo "备份到: $BACKUP_PATH"
echo ""

cd "$PROJECT_DIR"
export PI_DATA_DIR="$DATA_DIR"

PG_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env.local 2>/dev/null | cut -d= -f2- || echo "pi_local_dev")
PG_USER=$(grep '^POSTGRES_USER=' .env.local 2>/dev/null | cut -d= -f2- || echo "pi")
PG_DB=$(grep '^POSTGRES_DB=' .env.local 2>/dev/null | cut -d= -f2- || echo "pi_console")

echo "[1/3] 导出 PostgreSQL..."
docker compose -f docker-compose.local.yml exec -T postgres \
    pg_dump -U "$PG_USER" "$PG_DB" > "$BACKUP_PATH/database.sql" 2>/dev/null && \
    echo "  数据库备份: $(wc -l < "$BACKUP_PATH/database.sql") 行" || \
    echo "  [!] 数据库备份失败（可能服务未启动）"

echo "[2/3] 备份 exports 目录..."
if [ -d "$DATA_DIR/exports" ] && [ "$(ls -A "$DATA_DIR/exports" 2>/dev/null)" ]; then
    cp -r "$DATA_DIR/exports" "$BACKUP_PATH/exports"
    echo "  exports: $(find "$BACKUP_PATH/exports" -type f | wc -l) 个文件"
else
    echo "  exports: 空，跳过"
fi

echo "[3/3] 备份配置..."
cp .env.local "$BACKUP_PATH/.env.local.bak" 2>/dev/null || true

TOTAL_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
echo ""
echo "================================"
echo "  备份完成"
echo "================================"
echo "  路径: $BACKUP_PATH"
echo "  大小: $TOTAL_SIZE"
echo ""
echo "  恢复: bash scripts/restore.sh $BACKUP_NAME"
echo "================================"

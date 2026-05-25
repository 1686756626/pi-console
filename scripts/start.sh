#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${PI_DATA_DIR:-$HOME/PiConsoleData}"

cd "$PROJECT_DIR"

if [ ! -f .env.local ]; then
    echo "[!] .env.local 不存在，从模板创建..."
    cp .env.local.example .env.local
    echo "[!] 请编辑 .env.local 填入真实配置后重新运行"
    echo "    必填项: GLM_API_KEY, PI_API_TOKEN, WORKER_SECRET"
    exit 1
fi

export PI_DATA_DIR="$DATA_DIR"
mkdir -p "$DATA_DIR"/{postgres,redis,exports,agents,backups}

echo "================================"
echo "  Pi Console - Mac 本地启动"
echo "================================"
echo "数据目录: $DATA_DIR"
echo ""

if [ -z "${PI_API_TOKEN:-}" ]; then
    PI_API_TOKEN=$(grep '^PI_API_TOKEN=' .env.local | cut -d= -f2-)
fi
if [ -z "${PI_API_TOKEN:-}" ] || [ "$PI_API_TOKEN" = "your-secret-token-here" ]; then
    echo "[!] 警告: PI_API_TOKEN 未设置或仍为默认值"
    echo "    建议在 .env.local 中设置强密码 token"
    echo ""
fi

ENABLE_SEARCH="${1:-}"
if [ "$ENABLE_SEARCH" = "--with-search" ]; then
    echo "[*] 启用 SearXNG 搜索引擎..."
    COMPOSE_PROFILES=search docker compose -f docker-compose.local.yml up -d --build
else
    echo "[*] 启动核心服务 (不包含 SearXNG, 如需请加 --with-search)..."
    docker compose -f docker-compose.local.yml up -d --build
fi

echo ""
echo "等待服务就绪..."
sleep 5

bash "$SCRIPT_DIR/healthcheck.sh"

echo ""
echo "================================"
echo "  启动完成"
echo "================================"
echo "  Web UI:    http://localhost:${WEB_PORT:-5173}"
echo "  API:       http://localhost:${API_PORT:-7001}"
echo "  API Token: 见 .env.local 中的 PI_API_TOKEN"
echo ""
echo "  访问 Web UI 时会自动带上 token"
echo "  手动测试: curl -H 'X-API-Token: YOUR_TOKEN' http://localhost:${API_PORT:-7001}/api/pipelines"
echo "================================"

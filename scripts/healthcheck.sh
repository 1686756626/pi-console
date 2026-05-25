#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${PI_DATA_DIR:-$HOME/PiConsoleData}"

cd "$PROJECT_DIR"
export PI_DATA_DIR="$DATA_DIR"

PASS=0
FAIL=0
WARN=0

check() {
    local name="$1"
    local result="$2"
    if [ "$result" = "ok" ]; then
        echo "  [OK] $name"
        PASS=$((PASS + 1))
    elif [ "$result" = "warn" ]; then
        echo "  [!!] $name"
        WARN=$((WARN + 1))
    else
        echo "  [FAIL] $name"
        FAIL=$((FAIL + 1))
    fi
}

echo "================================"
echo "  Pi Console - 健康检查"
echo "================================"
echo ""

echo "[1] Docker..."
if docker info > /dev/null 2>&1; then
    check "Docker daemon" "ok"
else
    check "Docker daemon 未运行" "fail"
    echo ""
    echo "请先启动 Docker Desktop"
    exit 1
fi

echo ""
echo "[2] 服务容器..."
SERVICES="postgres redis api worker web"
for svc in $SERVICES; do
    STATUS=$(docker compose -f docker-compose.local.yml ps --format json 2>/dev/null \
        | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        d = json.loads(line)
        if d.get('Service') == '$svc' or d.get('Name','').endswith('-$svc'):
            print(d.get('Health','') or d.get('Status',''))
            break
    except: pass
" 2>/dev/null || echo "unknown")
    if echo "$STATUS" | grep -qi "healthy\|running\|up"; then
        check "$svc" "ok"
    elif echo "$STATUS" | grep -qi "unhealthy"; then
        check "$svc (unhealthy)" "fail"
    else
        check "$svc (未启动)" "fail"
    fi
done

echo ""
echo "[3] API 连通性..."
API_PORT=$(grep '^API_PORT=' .env.local 2>/dev/null | cut -d= -f2- || echo "7001")
API_TOKEN=$(grep '^PI_API_TOKEN=' .env.local 2>/dev/null | cut -d= -f2-)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Token: $API_TOKEN" \
    "http://localhost:$API_PORT/api/pipelines" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    check "API 响应 ($HTTP_CODE)" "ok"
elif [ "$HTTP_CODE" = "401" ]; then
    check "API 认证失败 (401, token 不匹配)" "fail"
else
    check "API 不可达 (HTTP $HTTP_CODE)" "fail"
fi

echo ""
echo "[4] Web UI..."
WEB_PORT=$(grep '^WEB_PORT=' .env.local 2>/dev/null | cut -d= -f2- || echo "5173")
WEB_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:$WEB_PORT" 2>/dev/null || echo "000")
if [ "$WEB_CODE" = "200" ]; then
    check "Web UI ($WEB_CODE)" "ok"
else
    check "Web UI 不可达 (HTTP $WEB_CODE)" "fail"
fi

echo ""
echo "[5] 数据库连接..."
DB_CHECK=$(docker compose -f docker-compose.local.yml exec -T postgres \
    pg_isready -U "$(grep '^POSTGRES_USER=' .env.local 2>/dev/null | cut -d= -f2- || echo 'pi')" \
    2>/dev/null || echo "fail")
if echo "$DB_CHECK" | grep -q "accepting"; then
    check "PostgreSQL" "ok"
else
    check "PostgreSQL 连接失败" "fail"
fi

echo ""
echo "[6] 数据目录..."
if [ -d "$DATA_DIR" ]; then
    check "数据目录 ($DATA_DIR)" "ok"
    for sub in postgres redis exports agents backups; do
        if [ -d "$DATA_DIR/$sub" ]; then
            check "  $sub/" "ok"
        else
            check "  $sub/ (缺失)" "warn"
        fi
    done
else
    check "数据目录不存在: $DATA_DIR" "fail"
fi

echo ""
echo "[7] 安全配置..."
if [ -n "$API_TOKEN" ] && [ "$API_TOKEN" != "your-secret-token-here" ]; then
    check "PI_API_TOKEN 已设置" "ok"
else
    check "PI_API_TOKEN 未设置或为默认值" "warn"
fi

GLM_KEY=$(grep '^GLM_API_KEY=' .env.local 2>/dev/null | cut -d= -f2-)
if [ -n "$GLM_KEY" ] && [ "$GLM_KEY" != "your-glm-api-key-here" ]; then
    check "GLM_API_KEY 已设置" "ok"
else
    check "GLM_API_KEY 未设置" "fail"
fi

echo ""
echo "================================"
echo "  结果: $PASS 通过 / $WARN 警告 / $FAIL 失败"
echo "================================"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi

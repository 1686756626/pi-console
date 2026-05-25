# Pi Console

Agent 控制台系统，替代 QwenPaw + Obsidian 工作流。

## 架构

```
React 前端 (Vite build → 后端 serve 静态文件)
    ↓ proxy /api
FastAPI 后端 (7002)  ←→  SQLite (dev) / PostgreSQL (prod)
        ↑
Node.js Worker       ←→  GLM-5.1 API (内置 web_search)
        ↑
n8n (5678)           — 定时触发流水线
Docmost (3000)       — 文档系统（替代 Obsidian）
Dify (8080)          — RAG 知识库
```

## 快速开始

### 本地开发（SQLite，零外部依赖）

```bash
# 后端
cd backend
pip install -r requirements.txt
DATABASE_URL="sqlite+aiosqlite:///./pi_console.db" \
  GLM_API_KEY=your-key \
  uvicorn app.main:app --port 7002

# Worker（需要 GLM API key）
cd worker
npm install && npm run build
GLM_API_KEY=your-key \
  API_BASE_URL=http://localhost:7002 \
  WORKER_SECRET=change-me \
  node dist/index.js

# 前端开发
cd webui
npm install
npm run dev        # 开发模式，proxy /api → 7002

# 或构建后由后端 serve
cd webui && npm run build
# 后端自动 serve webui/dist/ 下的静态文件
```

### Docker Compose（完整栈，需要 4 核 8GB+）

```bash
cp .env.example .env
# 编辑 .env 填入密钥
docker compose up -d
```

## 配置密钥

编辑 `.env` 文件：

```
GLM_API_KEY=your-key-here
WORKER_SECRET=your-secret-here
CORS_ORIGINS=*                          # 开发用 *，生产改为具体域名
DATABASE_URL=sqlite+aiosqlite:///./pi_console.db   # 或 postgresql+asyncpg://...
```

Docker Compose 额外密钥：

```
DOCMOST_SECRET=openssl-rand-hex-32
DIFY_SECRET_KEY=openssl-rand-hex-32
PLUGIN_DAEMON_KEY=openssl-rand-hex-16
```

## 如何运行测试流水线

1. 打开 WebUI
2. 控制台或运行页面选择流水线，点击"运行流水线"
3. Run 创建后状态为 `waiting_confirmation`
4. 点击"确认执行"，Worker 开始执行各步骤
5. 运行详情页实时显示步骤状态和产出

## 如何查看失败原因和重试

1. 运行详情页，失败步骤显示红色错误信息
2. 点击"重试"按钮重新执行该步骤
3. Worker 日志中也有详细错误信息

## 如何导出 Markdown

- 文档页面：点击每条文档右侧的下载按钮
- 运行详情页：展开步骤产出，点击"导出"
- 按日期导出新闻：`GET /api/exports/news?date=2026-05-24`

## 确认流程

创建 Run 后，系统不会立即执行，而是进入 `waiting_confirmation` 状态。
用户需要在运行详情页点击"确认执行"，Worker 才会开始处理步骤。
高风险操作（写入文档库、发布）必须经过确认。

## 停止

```bash
# Docker Compose
docker compose down

# 本地开发
# Ctrl+C 停止后端和 Worker
```

## 备份

```bash
# SQLite
cp backend/pi_console.db backup/pi_console_$(date +%Y%m%d).db

# PostgreSQL
docker compose exec postgres pg_dump -U pi pi_console > backup.sql
```

## 恢复

```bash
# SQLite
cp backup/pi_console_YYYYMMDD.db backend/pi_console.db

# PostgreSQL
cat backup.sql | docker compose exec -T postgres psql -U pi pi_console
```

## 回滚到旧系统

Pi Console 不会修改 QwenPaw 配置或 Obsidian 文件。
直接停止 Pi Console 服务即可恢复旧工作流。

## Agents

| Agent | 说明 | 工具 |
|-------|------|------|
| news-curator | 搜索并整理国内外新闻 | search_web, save_artifact |
| researcher | 基于新闻生成研究报告 | save_artifact |
| deep-researcher | 多源交叉深度研究 | search_web, save_artifact |
| writer | 基于研究材料生成文章草稿 | save_artifact |
| zhihu-writer | 生成知乎风格文章 | search_web, save_artifact |
| journal-summarizer | 学术论文/长文摘要 | search_web, save_artifact |

## Pipelines

| ID | 名称 | 步骤 |
|----|------|------|
| standard | 标准流水线 | 新闻采集 → 研究分析 → 文章写作 |
| deep-research | 深度研究流水线 | 多源深度研究 → 知乎写作 |
| full-spectrum | 全链路流水线 | 新闻采集 → 深度研究 → 学术摘要 → 知乎写作 |
| quick-summary | 快速摘要流水线 | 新闻采集 → 摘要整理 |

## API 接口

```
GET  /api/dashboard              今日总览
GET  /api/agents                  Agent 列表
GET  /api/runs                    运行列表
POST /api/runs                    创建运行（需确认后才执行）
GET  /api/runs/{id}               运行详情
GET  /api/plans/{id}              计划详情
POST /api/plans/{id}/confirm      确认执行
POST /api/plans/{id}/cancel       取消执行
POST /api/steps/{id}/retry        重试步骤
GET  /api/artifacts               产物列表
GET  /api/artifacts/{id}/export   导出 Markdown
GET  /api/documents               文档索引（含来源 Run）
GET  /api/news                    新闻列表
POST /api/news/refresh            触发新闻刷新
GET  /api/exports/news?date=      按日期导出新闻
POST /api/webhook/trigger         Webhook 触发（需 X-Webhook-Secret）
```

## 服务端口

| 服务 | 端口 | 用途 |
|------|------|------|
| Pi Console API | 7002 | 后端 API + 前端静态文件 |
| n8n | 5678 | 工作流自动化 |
| Docmost | 3000 | 文档系统 |
| Dify | 8080 | AI 平台 |

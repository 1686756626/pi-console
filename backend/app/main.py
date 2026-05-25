import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, engine
from app.models.models import Base
from app.models.models import Agent, Space, PipelineModel
from app.api import agents, plans, steps, artifacts, news, documents, dashboard, internal, rag, docmost, webhook, exports, wiki, tags, memos, checkpoints, pipelines, scheduler, knowledge, audit, mcp_servers, memories, chat, today, today_ai, materials, writing, writing_ai, review
from app.middleware.audit import AuditMiddleware
from app.middleware.auth import AuthMiddleware

audit_logger = logging.getLogger("pi_console.audit")
audit_logger.setLevel(logging.DEBUG)
audit_logger.addHandler(
    logging.FileHandler(
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "audit.log"),
        encoding="utf-8",
    )
)

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "webui", "dist")


async def _init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for col, ctype, default in [
            ("model_name", "VARCHAR", "'glm-5.1'"),
            ("temperature", "FLOAT", "0.7"),
            ("max_tokens", "INTEGER", "8192"),
        ]:
            try:
                await conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE agents ADD COLUMN {col} {ctype} DEFAULT {default}"
                    )
                )
            except Exception:
                pass
        try:
            await conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE spaces ADD COLUMN sidebar_order INTEGER DEFAULT 0"
                )
            )
        except Exception:
            pass
        try:
            await conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE agents ADD COLUMN mcp_server_ids TEXT DEFAULT NULL"
                )
            )
        except Exception:
            pass
        for col in ["transport", "command_json", "env_json"]:
            default = "'streamable_http'" if col == "transport" else "NULL"
            ctype = "VARCHAR" if col == "transport" else "TEXT"
            try:
                await conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE mcp_servers ADD COLUMN {col} {ctype} DEFAULT {default}"
                    )
                )
            except Exception:
                pass
        for col, ctype in [
            ("prompt_template", "TEXT"), ("input_key", "VARCHAR(100)"),
            ("output_key", "VARCHAR(100)"), ("condition", "VARCHAR(200)"),
            ("parallel_group", "VARCHAR(50)"), ("temperature_override", "FLOAT"),
            ("max_tokens_override", "INTEGER"),
        ]:
            try:
                await conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE pipeline_steps ADD COLUMN {col} {ctype} DEFAULT NULL"
                    )
                )
            except Exception:
                pass
        for col, ctype in [
            ("prompt_template", "TEXT"), ("input_key", "VARCHAR(100)"),
            ("output_key", "VARCHAR(100)"), ("condition", "VARCHAR(200)"),
        ]:
            try:
                await conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE plan_steps ADD COLUMN {col} {ctype} DEFAULT NULL"
                    )
                )
            except Exception:
                pass
        await conn.execute(
            __import__("sqlalchemy").text(
                "UPDATE agents SET model_name='glm-5.1' WHERE model_name IS NULL"
            )
        )
    async with async_session() as db:
        from sqlalchemy import select
        result = await db.execute(select(Agent))
        if not result.scalars().first():
            seeds = [
                Agent(id="news-curator", name="新闻采集", role="news-curator",
                       description="搜索并整理国内外近期新闻，生成新闻摘要。",
                       tools=["web_search", "save_artifact", "knowledge_query"]),
                Agent(id="researcher", name="研究分析", role="researcher",
                       description="基于新闻素材，生成结构化研究报告。",
                       tools=["web_search", "save_artifact", "knowledge_query", "save_memory"]),
                Agent(id="deep-researcher", name="深度研究", role="deep-researcher",
                       description="多源交叉深度研究，产出全面的分析报告。",
                       tools=["web_search", "save_artifact", "knowledge_query", "call_agent", "save_memory", "recall_memory"]),
                Agent(id="writer", name="文章写作", role="writer",
                       description="基于研究材料，生成文章草稿。",
                       tools=["save_artifact", "knowledge_query", "recall_memory"]),
                Agent(id="zhihu-writer", name="知乎写作", role="zhihu-writer",
                       description="将研究成果转化为知乎风格文章，附引用来源。",
                       tools=["web_search", "save_artifact", "knowledge_query"]),
                Agent(id="journal-summarizer", name="学术摘要", role="journal-summarizer",
                       description="将学术论文和长文分析提炼为结构化摘要。",
                       tools=["web_search", "save_artifact", "knowledge_query"]),
            ]
            for s in seeds:
                db.add(s)
            await db.commit()

        result = await db.execute(select(Space).where(Space.slug == "default"))
        if not result.scalar_one_or_none():
            db.add(Space(name="默认空间", slug="default", description="所有文档", icon="D"))
            await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _init_db()
    from app.scheduler import start_scheduler, stop_scheduler
    await start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Pi Console API",
    version="0.1.0",
    lifespan=lifespan,
)

import os
allowed = os.getenv("CORS_ORIGINS", "*")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.getLogger("pi_console").error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": "internal_error", "detail": str(exc)})


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)
app.add_middleware(AuthMiddleware)

app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(pipelines.router, prefix="/api", tags=["pipelines"])
app.include_router(agents.router, prefix="/api", tags=["agents"])
app.include_router(plans.router, prefix="/api", tags=["plans"])
app.include_router(steps.router, prefix="/api", tags=["steps"])
app.include_router(artifacts.router, prefix="/api", tags=["artifacts"])
app.include_router(news.router, prefix="/api", tags=["news"])
app.include_router(documents.router, prefix="/api", tags=["documents"])
app.include_router(internal.router, prefix="/api/internal/worker", tags=["worker"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(docmost.router, prefix="/api/docmost", tags=["docmost"])
app.include_router(webhook.router, prefix="/api/webhook", tags=["webhook"])
app.include_router(exports.router, prefix="/api/exports", tags=["exports"])
app.include_router(wiki.router, prefix="/api/wiki", tags=["wiki"])
app.include_router(tags.router, prefix="/api", tags=["tags"])
app.include_router(memos.router, prefix="/api", tags=["memos"])
app.include_router(checkpoints.router, prefix="/api", tags=["checkpoints"])
app.include_router(scheduler.router, prefix="/api", tags=["scheduler"])
app.include_router(knowledge.router, prefix="/api", tags=["knowledge"])
app.include_router(audit.router, prefix="/api", tags=["audit"])
app.include_router(mcp_servers.router, prefix="/api", tags=["mcp"])
app.include_router(memories.router, prefix="/api", tags=["memories"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(today.router, prefix="/api", tags=["today"])
app.include_router(today_ai.router, prefix="/api", tags=["today-ai"])
app.include_router(materials.router, prefix="/api", tags=["materials"])
app.include_router(writing.router, prefix="/api", tags=["writing"])
app.include_router(writing_ai.router, prefix="/api", tags=["writing-ai"])
app.include_router(review.router, prefix="/api", tags=["review"])

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

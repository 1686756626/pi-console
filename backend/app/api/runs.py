from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import Artifact, Confirmation, ConfirmationStatus, Plan, PlanStep, Run, RunStatus, StepStatus
from app.schemas import RunResponse, RunBrief, PipelineCreate

PIPELINES = {
    "standard": {
        "label": "标准流水线",
        "description": "新闻采集 -> 研究分析 -> 文章写作",
        "steps": [
            {"agent_id": "news-curator", "title": "采集整理近期新闻",
             "description": "搜索本周国内外新闻，整理摘要。"},
            {"agent_id": "researcher", "title": "生成研究报告",
             "description": "基于采集新闻，生成结构化研究材料。"},
            {"agent_id": "writer", "title": "撰写文章草稿",
             "description": "基于研究报告，生成 Markdown 文章草稿。"},
        ],
    },
    "deep-research": {
        "label": "深度研究流水线",
        "description": "深度研究 -> 知乎写作",
        "steps": [
            {"agent_id": "deep-researcher", "title": "多源深度研究",
             "description": "搜索多个信息源，交叉验证，产出深度研究报告。"},
            {"agent_id": "zhihu-writer", "title": "撰写知乎文章",
             "description": "将研究成果转化为知乎风格文章，附引用来源。"},
        ],
    },
    "full-spectrum": {
        "label": "全链路流水线",
        "description": "新闻采集 -> 深度研究 -> 学术摘要 -> 知乎写作",
        "steps": [
            {"agent_id": "news-curator", "title": "采集整理近期新闻",
             "description": "搜索本周国内外新闻，整理摘要。"},
            {"agent_id": "deep-researcher", "title": "深入分析关键议题",
             "description": "对关键新闻议题进行多源交叉研究。"},
            {"agent_id": "journal-summarizer", "title": "摘要学术视角",
             "description": "查找并摘要相关学术论文或深度分析。"},
            {"agent_id": "zhihu-writer", "title": "撰写知乎文章",
             "description": "整合研究与摘要，产出知乎文章。"},
        ],
    },
    "quick-summary": {
        "label": "快速摘要流水线",
        "description": "新闻采集 -> 摘要整理",
        "steps": [
            {"agent_id": "news-curator", "title": "采集新闻要点",
             "description": "搜索近期新闻标题和关键事件。"},
            {"agent_id": "journal-summarizer", "title": "摘要关键发现",
             "description": "将采集新闻提炼为结构化摘要。"},
        ],
    },
}

router = APIRouter()


@router.get("/pipelines")
async def list_pipelines():
    return [
        {
            "id": key,
            "label": cfg["label"],
            "description": cfg["description"],
            "steps": cfg["steps"],
        }
        for key, cfg in PIPELINES.items()
    ]


@router.post("/runs", response_model=RunResponse, status_code=201)
async def create_run(body: PipelineCreate, db: AsyncSession = Depends(get_db)):
    pipeline = PIPELINES.get(body.pipeline_id)
    if not pipeline:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown pipeline: {body.pipeline_id}")

    now = datetime.utcnow()
    run = Run(
        name=body.name or pipeline["label"],
        status=RunStatus.WAITING_CONFIRMATION,
        trigger_type=body.trigger_type,
    )
    db.add(run)
    await db.flush()

    plan = Plan(
        run_id=run.id,
        title=f"Plan for {run.name}",
        status=RunStatus.WAITING_CONFIRMATION,
        created_by_agent_id=None,
    )
    db.add(plan)
    await db.flush()

    step_summary = ", ".join(s["title"] for s in pipeline["steps"])
    confirmation = Confirmation(
        run_id=run.id,
        plan_id=plan.id,
        status=ConfirmationStatus.WAITING,
        question=f"确认执行流水线「{pipeline['label']}」？共 {len(pipeline['steps'])} 步：{step_summary}",
    )
    db.add(confirmation)

    for i, step_def in enumerate(pipeline["steps"]):
        step = PlanStep(
            plan_id=plan.id,
            step_order=i + 1,
            title=step_def["title"],
            description=step_def["description"],
            status=StepStatus.TODO,
            agent_id=step_def["agent_id"],
        )
        db.add(step)

    await db.commit()

    result = await db.execute(
        select(Run)
        .where(Run.id == run.id)
        .options(selectinload(Run.plans).selectinload(Plan.steps))
    )
    return result.scalar_one()


@router.get("/runs", response_model=list[RunBrief])
async def list_runs(status: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Run).order_by(Run.created_at.desc())
    if status:
        q = q.where(Run.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Run)
        .where(Run.id == run_id)
        .options(selectinload(Run.plans).selectinload(Plan.steps))
    )
    run = result.scalar_one_or_none()
    if not run:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/runs/batch-cancel")
async def batch_cancel_runs(body: dict, db: AsyncSession = Depends(get_db)):
    ids = body.get("ids", [])
    if not ids:
        return {"cancelled": 0}
    from sqlalchemy import update
    result = await db.execute(
        update(Run)
        .where(Run.id.in_(ids))
        .where(Run.status.in_([RunStatus.PENDING, RunStatus.RUNNING, RunStatus.WAITING_CONFIRMATION]))
        .values(status=RunStatus.CANCELLED, ended_at=datetime.utcnow())
    )
    await db.commit()
    return {"cancelled": result.rowcount}


@router.post("/runs/batch-delete")
async def batch_delete_runs(body: dict, db: AsyncSession = Depends(get_db)):
    ids = body.get("ids", [])
    if not ids:
        return {"deleted": 0}
    from sqlalchemy import delete as sql_delete
    await db.execute(sql_delete(Confirmation).where(Confirmation.run_id.in_(ids)))
    steps = await db.execute(select(PlanStep).join(Plan).where(Plan.run_id.in_(ids)))
    step_ids = [s.id for s in steps.scalars().all()]
    if step_ids:
        await db.execute(sql_delete(Artifact).where(Artifact.plan_step_id.in_(step_ids)))
    await db.execute(sql_delete(PlanStep).join(Plan).where(Plan.run_id.in_(ids)))
    await db.execute(sql_delete(Plan).where(Plan.run_id.in_(ids)))
    result = await db.execute(sql_delete(Run).where(Run.id.in_(ids)))
    await db.commit()
    return {"deleted": result.rowcount}

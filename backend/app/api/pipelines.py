from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import PipelineModel, PipelineStepModel, Run, RunStatus, Plan, PlanStep, StepStatus, Confirmation, ConfirmationStatus
from app.schemas import (
    PipelineResponse, PipelineCreateRequest, PipelineUpdateRequest,
    RunResponse,
)

router = APIRouter()


HARDCODED_PIPELINES = {
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


def _get_pipeline_data(db: AsyncSession, pipeline_id: str):
    if pipeline_id in HARDCODED_PIPELINES:
        return HARDCODED_PIPELINES[pipeline_id]
    return None


async def resolve_pipeline(db: AsyncSession, pipeline_id: str):
    db_pipeline = await db.get(PipelineModel, pipeline_id)
    if db_pipeline:
        result = await db.execute(
            select(PipelineModel)
            .where(PipelineModel.id == pipeline_id)
            .options(selectinload(PipelineModel.steps))
        )
        p = result.scalar_one()
        return {
            "label": p.label,
            "description": p.description,
            "steps": [
                {
                    "agent_id": s.agent_id, "title": s.title,
                    "description": s.description,
                    "prompt_template": s.prompt_template,
                    "input_key": s.input_key, "output_key": s.output_key,
                    "condition": s.condition, "parallel_group": s.parallel_group,
                    "temperature_override": s.temperature_override,
                    "max_tokens_override": s.max_tokens_override,
                }
                for s in p.steps
            ],
        }
    hardcoded = _get_pipeline_data(db, pipeline_id)
    if hardcoded:
        return hardcoded
    return None


@router.get("/pipelines")
async def list_pipelines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PipelineModel).options(selectinload(PipelineModel.steps)).order_by(PipelineModel.created_at)
    )
    db_pipelines = result.scalars().all()
    custom = [
        {
            "id": p.id,
            "label": p.label,
            "description": p.description,
            "steps": [
                {
                    "id": s.id, "step_order": s.step_order,
                    "agent_id": s.agent_id, "title": s.title,
                    "description": s.description,
                    "prompt_template": s.prompt_template,
                    "input_key": s.input_key, "output_key": s.output_key,
                    "condition": s.condition, "parallel_group": s.parallel_group,
                    "temperature_override": s.temperature_override,
                    "max_tokens_override": s.max_tokens_override,
                }
                for s in p.steps
            ],
            "is_custom": True,
        }
        for p in db_pipelines
    ]
    builtin = [
        {
            "id": key,
            "label": cfg["label"],
            "description": cfg["description"],
            "steps": cfg["steps"],
            "is_custom": False,
        }
        for key, cfg in HARDCODED_PIPELINES.items()
    ]
    return custom + builtin


def _step_from_input(step, pipeline_id, step_order):
    return PipelineStepModel(
        pipeline_id=pipeline_id,
        step_order=step_order,
        agent_id=step.agent_id,
        title=step.title,
        description=step.description,
        prompt_template=getattr(step, "prompt_template", None),
        input_key=getattr(step, "input_key", None),
        output_key=getattr(step, "output_key", None),
        condition=getattr(step, "condition", None),
        parallel_group=getattr(step, "parallel_group", None),
        temperature_override=getattr(step, "temperature_override", None),
        max_tokens_override=getattr(step, "max_tokens_override", None),
    )


@router.post("/pipelines", response_model=PipelineResponse, status_code=201)
async def create_pipeline(data: PipelineCreateRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.get(PipelineModel, data.id)
    if existing:
        raise HTTPException(status_code=409, detail="Pipeline ID already exists")
    pipeline = PipelineModel(
        id=data.id,
        label=data.label,
        description=data.description,
    )
    db.add(pipeline)
    await db.flush()
    for i, step in enumerate(data.steps):
        db.add(_step_from_input(step, pipeline.id, i + 1))
    await db.commit()
    result = await db.execute(
        select(PipelineModel).where(PipelineModel.id == pipeline.id).options(selectinload(PipelineModel.steps))
    )
    return result.scalar_one()


@router.put("/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(pipeline_id: str, data: PipelineUpdateRequest, db: AsyncSession = Depends(get_db)):
    pipeline = await db.get(PipelineModel, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if data.label is not None:
        pipeline.label = data.label
    if data.description is not None:
        pipeline.description = data.description
    if data.steps is not None:
        from sqlalchemy import delete as sql_delete
        await db.execute(sql_delete(PipelineStepModel).where(PipelineStepModel.pipeline_id == pipeline_id))
        for i, step in enumerate(data.steps):
            db.add(_step_from_input(step, pipeline_id, i + 1))
    await db.commit()
    result = await db.execute(
        select(PipelineModel).where(PipelineModel.id == pipeline_id).options(selectinload(PipelineModel.steps))
    )
    return result.scalar_one()


@router.delete("/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db)):
    pipeline = await db.get(PipelineModel, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.delete(pipeline)
    await db.commit()
    return {"deleted": True, "id": pipeline_id}


@router.post("/pipelines/{pipeline_id}/duplicate", response_model=PipelineResponse, status_code=201)
async def duplicate_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db)):
    pipeline_data = await resolve_pipeline(db, pipeline_id)
    if not pipeline_data:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    new_id = f"{pipeline_id}-copy-{datetime.utcnow().strftime('%H%M%S')}"
    existing = await db.get(PipelineModel, new_id)
    while existing:
        new_id = f"{pipeline_id}-copy-{datetime.utcnow().strftime('%H%M%S%f')}"
        existing = await db.get(PipelineModel, new_id)

    pipeline = PipelineModel(
        id=new_id,
        label=f"{pipeline_data['label']} (副本)",
        description=pipeline_data.get("description"),
    )
    db.add(pipeline)
    await db.flush()
    for i, step in enumerate(pipeline_data["steps"]):
        db.add(PipelineStepModel(
            pipeline_id=new_id,
            step_order=i + 1,
            agent_id=step["agent_id"],
            title=step["title"],
            description=step.get("description"),
            prompt_template=step.get("prompt_template"),
            input_key=step.get("input_key"),
            output_key=step.get("output_key"),
            condition=step.get("condition"),
            parallel_group=step.get("parallel_group"),
            temperature_override=step.get("temperature_override"),
            max_tokens_override=step.get("max_tokens_override"),
        ))
    await db.commit()
    result = await db.execute(
        select(PipelineModel).where(PipelineModel.id == new_id).options(selectinload(PipelineModel.steps))
    )
    return result.scalar_one()


@router.post("/runs", response_model=RunResponse, status_code=201)
async def create_run(body: dict, db: AsyncSession = Depends(get_db)):
    pipeline_id = body.get("pipeline_id", "standard")
    name = body.get("name")
    trigger_type = body.get("trigger_type", "manual")

    pipeline_data = await resolve_pipeline(db, pipeline_id)
    if not pipeline_data:
        raise HTTPException(status_code=400, detail=f"Unknown pipeline: {pipeline_id}")

    now = datetime.utcnow()
    run = Run(
        name=name or pipeline_data["label"],
        status=RunStatus.WAITING_CONFIRMATION if trigger_type == "manual" else RunStatus.PENDING,
        trigger_type=trigger_type,
        started_at=now if trigger_type != "manual" else None,
    )
    db.add(run)
    await db.flush()

    plan = Plan(
        run_id=run.id,
        title=f"Plan for {run.name}",
        status=run.status,
        created_by_agent_id=None,
    )
    db.add(plan)
    await db.flush()

    if trigger_type == "manual":
        step_summary = ", ".join(s["title"] for s in pipeline_data["steps"])
        confirmation = Confirmation(
            run_id=run.id,
            plan_id=plan.id,
            status=ConfirmationStatus.WAITING,
            question=f"确认执行流水线「{pipeline_data['label']}」？共 {len(pipeline_data['steps'])} 步：{step_summary}",
        )
        db.add(confirmation)

    for i, step_def in enumerate(pipeline_data["steps"]):
        step = PlanStep(
            plan_id=plan.id,
            step_order=i + 1,
            title=step_def["title"],
            description=step_def["description"],
            status=StepStatus.TODO,
            agent_id=step_def["agent_id"],
            prompt_template=step_def.get("prompt_template"),
            input_key=step_def.get("input_key"),
            output_key=step_def.get("output_key"),
            condition=step_def.get("condition"),
        )
        db.add(step)

    await db.commit()

    result = await db.execute(
        select(Run)
        .where(Run.id == run.id)
        .options(selectinload(Run.plans).selectinload(Plan.steps))
    )
    return result.scalar_one()


@router.get("/runs", response_model=list[RunResponse])
async def list_runs(status: str | None = None, db: AsyncSession = Depends(get_db)):
    from app.schemas import RunBrief
    from sqlalchemy import select as sa_select
    from sqlalchemy.orm import selectinload
    q = sa_select(Run).order_by(Run.created_at.desc()).options(selectinload(Run.plans).selectinload(Plan.steps))
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
    from app.models.models import Artifact
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

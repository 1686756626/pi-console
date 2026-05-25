from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.models import Plan, PlanStep, Run, RunStatus, StepStatus
from app.api.pipelines import resolve_pipeline
from app.schemas import RunResponse

router = APIRouter()


class WebhookTrigger(BaseModel):
    pipeline_id: str = "standard"
    name: str | None = None
    params: dict | None = None


def _verify_webhook_secret(x_webhook_secret: str = Header(...)):
    secret = getattr(settings, "worker_secret", "")
    if not secret or x_webhook_secret != secret:
        raise HTTPException(status_code=403, detail="无效的 webhook 密钥")


@router.post("/trigger", response_model=RunResponse)
async def webhook_trigger(
    body: WebhookTrigger,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_verify_webhook_secret),
):
    pipeline = await resolve_pipeline(db, body.pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=400, detail=f"未知流水线: {body.pipeline_id}")

    now = datetime.utcnow()
    run = Run(
        name=body.name or pipeline["label"],
        status=RunStatus.PENDING,
        trigger_type="webhook",
        started_at=now,
    )
    db.add(run)
    await db.flush()

    plan = Plan(
        run_id=run.id,
        title=f"{run.name} - 执行计划",
        status=RunStatus.PENDING,
    )
    db.add(plan)
    await db.flush()

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


@router.get("/pipelines")
async def webhook_list_pipelines(db: AsyncSession = Depends(get_db)):
    from app.api.pipelines import HARDCODED_PIPELINES
    return [
        {
            "id": key,
            "label": cfg["label"],
            "description": cfg["description"],
            "agent_flow": [s["agent_id"] for s in cfg["steps"]],
        }
        for key, cfg in HARDCODED_PIPELINES.items()
    ]

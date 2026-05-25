from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.models import Artifact, PlanStep, Run, RunStatus, StepStatus
from app.schemas import ArtifactCreate, ArtifactResponse, StepUpdate, PlanStepResponse

router = APIRouter()


def _verify_worker_secret(x_worker_secret: str = Header(...)):
    if x_worker_secret != settings.worker_secret:
        raise HTTPException(status_code=403, detail="Invalid worker secret")


@router.post("/step-update", response_model=PlanStepResponse)
async def update_step_status(
    body: StepUpdate,
    step_id: str = None,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_verify_worker_secret),
):
    step = await db.get(PlanStep, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    if body.status:
        step.status = body.status
        if body.status == "running":
            step.started_at = datetime.utcnow()
        elif body.status in ("succeeded", "failed", "skipped"):
            step.ended_at = datetime.utcnow()
    if body.error_message is not None:
        step.error_message = body.error_message
    if body.output_artifact_id is not None:
        step.output_artifact_id = body.output_artifact_id

    await db.commit()
    await db.refresh(step)
    return step


@router.post("/artifact", response_model=ArtifactResponse, status_code=201)
async def create_artifact(
    body: ArtifactCreate,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_verify_worker_secret),
):
    artifact = Artifact(**body.model_dump())
    db.add(artifact)
    await db.flush()

    if body.plan_step_id:
        step = await db.get(PlanStep, body.plan_step_id)
        if step:
            step.output_artifact_id = artifact.id

    await db.commit()
    await db.refresh(artifact)
    return artifact


@router.get("/pending-tasks")
async def get_pending_tasks(
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_verify_worker_secret),
):
    result = await db.execute(
        select(Run)
        .where(Run.status == RunStatus.RUNNING)
        .options(selectinload(Run.plans))
        .order_by(Run.created_at)
        .limit(10)
    )
    runs = result.scalars().all()
    tasks = []
    for run in runs:
        plan_ids = [p.id for p in run.plans]
        if not plan_ids:
            continue
        step_result = await db.execute(
            select(PlanStep)
            .where(PlanStep.plan_id.in_(plan_ids))
            .where(PlanStep.status == StepStatus.TODO)
            .order_by(PlanStep.step_order)
            .limit(1)
        )
        step = step_result.scalar_one_or_none()
        if step:
            tasks.append({
                "run_id": str(run.id),
                "run_name": run.name,
                "step_id": str(step.id),
                "step_order": step.step_order,
                "step_title": step.title,
                "agent_id": step.agent_id,
            })
    return {"tasks": tasks}


@router.post("/run/{run_id}/status")
async def update_run_status(
    run_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_verify_worker_secret),
):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if "status" in body:
        run.status = body["status"]
    if "error_message" in body:
        run.error_message = body["error_message"]
    if body.get("status") in ("succeeded", "failed", "cancelled"):
        run.ended_at = datetime.utcnow()

    await db.commit()
    return {"ok": True}


@router.get("/run/{run_id}/artifacts", response_model=list[ArtifactResponse])
async def get_run_artifacts(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(_verify_worker_secret),
):
    result = await db.execute(
        select(Artifact)
        .where(Artifact.run_id == run_id)
        .order_by(Artifact.created_at)
    )
    return result.scalars().all()

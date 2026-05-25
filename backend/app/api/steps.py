from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import PlanStep, StepStatus
from app.schemas import StepRetryResponse, PlanStepResponse

router = APIRouter()


@router.post("/steps/{step_id}/retry", response_model=StepRetryResponse)
async def retry_step(step_id: str, db: AsyncSession = Depends(get_db)):
    step = await db.get(PlanStep, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    step.status = StepStatus.TODO
    step.error_message = None
    step.started_at = None
    step.ended_at = None
    await db.commit()
    await db.refresh(step)
    return StepRetryResponse(step=step, message="Step reset for retry")


@router.patch("/steps/{step_id}", response_model=PlanStepResponse)
async def update_step(step_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    step = await db.get(PlanStep, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    if "status" in body:
        step.status = body["status"]
        if body["status"] == "running":
            step.started_at = datetime.utcnow()
        elif body["status"] in ("succeeded", "failed", "skipped"):
            step.ended_at = datetime.utcnow()
    if "error_message" in body:
        step.error_message = body["error_message"]
    if "output_artifact_id" in body:
        step.output_artifact_id = body["output_artifact_id"]

    await db.commit()
    await db.refresh(step)
    return step

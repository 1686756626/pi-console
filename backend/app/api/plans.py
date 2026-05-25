from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import Confirmation, ConfirmationStatus, Plan, Run, RunStatus
from app.schemas import PlanResponse, ConfirmAction, ConfirmationResponse

router = APIRouter()


@router.get("/plans/{plan_id}", response_model=PlanResponse)
async def get_plan(plan_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Plan)
        .where(Plan.id == plan_id)
        .options(selectinload(Plan.steps))
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.post("/plans/{plan_id}/confirm", response_model=ConfirmationResponse)
async def confirm_plan(plan_id: str, body: ConfirmAction, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Plan).where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    now = datetime.utcnow()

    confirmation = Confirmation(
        run_id=plan.run_id,
        plan_id=plan.id,
        status=ConfirmationStatus.APPROVED,
        question=f"确认执行计划: {plan.title}",
        response=body.response,
        responded_at=now,
    )
    db.add(confirmation)

    plan.status = RunStatus.RUNNING

    run = await db.get(Run, plan.run_id)
    if run:
        run.status = RunStatus.RUNNING
        run.started_at = now

    await db.commit()
    await db.refresh(confirmation)
    return confirmation


@router.post("/plans/{plan_id}/cancel", response_model=PlanResponse)
async def cancel_plan(plan_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Plan)
        .where(Plan.id == plan_id)
        .options(selectinload(Plan.steps))
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan.status = RunStatus.CANCELLED

    run = await db.get(Run, plan.run_id)
    if run:
        run.status = RunStatus.CANCELLED
        run.ended_at = datetime.utcnow()

    await db.commit()
    return plan

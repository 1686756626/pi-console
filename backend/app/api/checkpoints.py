from __future__ import annotations

import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.models import Run, RunCheckpoint, RunStatus
from ..database import get_db

router = APIRouter(prefix="/checkpoints", tags=["checkpoints"])


@router.get("/{run_id}")
async def get_checkpoints(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RunCheckpoint)
        .where(RunCheckpoint.run_id == run_id)
        .order_by(RunCheckpoint.step_index)
    )
    checkpoints = result.scalars().all()
    return [
        {
            "id": c.id,
            "run_id": c.run_id,
            "step_index": c.step_index,
            "step_status": c.step_status,
            "input_data": c.input_data,
            "output_data": c.output_data,
            "error_message": c.error_message,
            "started_at": c.started_at.isoformat() if c.started_at else None,
            "ended_at": c.ended_at.isoformat() if c.ended_at else None,
            "created_at": c.created_at.isoformat(),
        }
        for c in checkpoints
    ]


@router.post("/{run_id}/snapshot")
async def save_snapshot(run_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    step_index = data.get("step_index", 0)
    result = await db.execute(
        select(RunCheckpoint).where(
            RunCheckpoint.run_id == run_id,
            RunCheckpoint.step_index == step_index,
        )
    )
    cp = result.scalar_one_or_none()
    if cp:
        cp.step_status = data.get("step_status", cp.step_status)
        if "output_data" in data:
            cp.output_data = json.dumps(data["output_data"]) if isinstance(data["output_data"], dict) else data["output_data"]
        if "error_message" in data:
            cp.error_message = data["error_message"]
        if data.get("step_status") == "running" and not cp.started_at:
            cp.started_at = datetime.utcnow()
        if data.get("step_status") in ("succeeded", "failed"):
            cp.ended_at = datetime.utcnow()
    else:
        cp = RunCheckpoint(
            id=str(uuid.uuid4()),
            run_id=run_id,
            step_index=step_index,
            step_status=data.get("step_status", "todo"),
            input_data=json.dumps(data.get("input_data")) if isinstance(data.get("input_data"), dict) else data.get("input_data"),
            output_data=json.dumps(data.get("output_data")) if isinstance(data.get("output_data"), dict) else data.get("output_data"),
            error_message=data.get("error_message"),
            started_at=datetime.utcnow() if data.get("step_status") == "running" else None,
            ended_at=datetime.utcnow() if data.get("step_status") in ("succeeded", "failed") else None,
        )
        db.add(cp)
    await db.commit()
    return {"ok": True, "step_index": step_index}


@router.post("/{run_id}/replay")
async def replay_from_checkpoint(run_id: str, db: AsyncSession = Depends(get_db)):
    run_result = await db.execute(select(Run).where(Run.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(404)

    result = await db.execute(
        select(RunCheckpoint)
        .where(RunCheckpoint.run_id == run_id)
        .order_by(RunCheckpoint.step_index)
    )
    checkpoints = result.scalars().all()

    failed_idx = None
    for i, cp in enumerate(checkpoints):
        if cp.step_status == "failed":
            failed_idx = i
            break

    if failed_idx is not None:
        for cp in checkpoints[failed_idx:]:
            cp.step_status = "todo"
            cp.output_data = None
            cp.error_message = None
            cp.started_at = None
            cp.ended_at = None
        run.status = RunStatus.RUNNING
        run.error_message = None
    else:
        run.status = RunStatus.RUNNING
        run.error_message = None

    await db.commit()
    return {"ok": True, "replay_from": failed_idx or 0}

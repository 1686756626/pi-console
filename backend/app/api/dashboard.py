from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Artifact, Run, RunStatus
from app.schemas import ArtifactResponse, DashboardResponse, RunBrief

router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    running = await db.execute(select(func.count()).select_from(Run).where(Run.status == RunStatus.RUNNING))
    failed = await db.execute(select(func.count()).select_from(Run).where(Run.status == RunStatus.FAILED))
    waiting = await db.execute(select(func.count()).select_from(Run).where(Run.status == RunStatus.WAITING_CONFIRMATION))

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_artifacts = await db.execute(
        select(func.count()).select_from(Artifact).where(Artifact.created_at >= today)
    )

    latest_runs_result = await db.execute(
        select(Run).order_by(Run.created_at.desc()).limit(5)
    )
    latest_artifacts_result = await db.execute(
        select(Artifact).order_by(Artifact.created_at.desc()).limit(5)
    )

    return DashboardResponse(
        running_count=running.scalar() or 0,
        failed_count=failed.scalar() or 0,
        waiting_confirmation_count=waiting.scalar() or 0,
        today_artifacts_count=today_artifacts.scalar() or 0,
        latest_runs=[RunBrief.model_validate(r) for r in latest_runs_result.scalars().all()],
        latest_artifacts=[ArtifactResponse.model_validate(a) for a in latest_artifacts_result.scalars().all()],
    )

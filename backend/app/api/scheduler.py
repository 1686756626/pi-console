from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import ScheduledJob

router = APIRouter()


class JobCreate(BaseModel):
    name: str
    pipeline_id: str
    cron_expression: str
    enabled: bool = True
    run_config: str | None = None


class JobUpdate(BaseModel):
    name: str | None = None
    cron_expression: str | None = None
    enabled: bool | None = None
    run_config: str | None = None


@router.get("/scheduler/jobs")
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledJob).order_by(ScheduledJob.created_at))
    jobs = result.scalars().all()
    return [
        {
            "id": j.id,
            "name": j.name,
            "pipeline_id": j.pipeline_id,
            "cron_expression": j.cron_expression,
            "enabled": j.enabled,
            "last_run_at": j.last_run_at.isoformat() if j.last_run_at else None,
            "next_run_at": j.next_run_at.isoformat() if j.next_run_at else None,
            "run_config": j.run_config,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "updated_at": j.updated_at.isoformat() if j.updated_at else None,
        }
        for j in jobs
    ]


@router.post("/scheduler/jobs", status_code=201)
async def create_job(body: JobCreate, db: AsyncSession = Depends(get_db)):
    from apscheduler.triggers.cron import CronTrigger
    try:
        CronTrigger.from_crontab(body.cron_expression)
    except Exception:
        raise HTTPException(status_code=400, detail="无效的 cron 表达式")

    job = ScheduledJob(
        name=body.name,
        pipeline_id=body.pipeline_id,
        cron_expression=body.cron_expression,
        enabled=body.enabled,
        run_config=body.run_config,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.scheduler import add_job
    if body.enabled:
        add_job(job)

    return {"id": job.id, "name": job.name, "created": True}


@router.patch("/scheduler/jobs/{job_id}")
async def update_job(job_id: str, body: JobUpdate, db: AsyncSession = Depends(get_db)):
    job = await db.get(ScheduledJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")

    if body.name is not None:
        job.name = body.name
    if body.cron_expression is not None:
        from apscheduler.triggers.cron import CronTrigger
        try:
            CronTrigger.from_crontab(body.cron_expression)
        except Exception:
            raise HTTPException(status_code=400, detail="无效的 cron 表达式")
        job.cron_expression = body.cron_expression
    if body.enabled is not None:
        job.enabled = body.enabled
    if body.run_config is not None:
        job.run_config = body.run_config

    await db.commit()
    await db.refresh(job)

    from app.scheduler import refresh_job
    refresh_job(job)

    return {"id": job.id, "updated": True}


@router.delete("/scheduler/jobs/{job_id}")
async def delete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(ScheduledJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")

    from app.scheduler import remove_job
    remove_job(job_id)

    await db.delete(job)
    await db.commit()
    return {"deleted": True, "id": job_id}


@router.post("/scheduler/jobs/{job_id}/trigger")
async def trigger_job(job_id: str, db: AsyncSession = Depends(get_db)):
    job = await db.get(ScheduledJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")

    from app.scheduler import execute_job
    await execute_job(job.id)
    return {"triggered": True, "job_id": job_id}


@router.get("/scheduler/jobs/{job_id}/executions")
async def list_executions(job_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.models import JobExecution
    result = await db.execute(
        select(JobExecution)
        .where(JobExecution.job_id == job_id)
        .order_by(JobExecution.started_at.desc())
        .limit(20)
    )
    executions = result.scalars().all()
    return [
        {
            "id": e.id,
            "job_id": e.job_id,
            "run_id": e.run_id,
            "status": e.status,
            "started_at": e.started_at.isoformat() if e.started_at else None,
            "ended_at": e.ended_at.isoformat() if e.ended_at else None,
            "error_message": e.error_message,
        }
        for e in executions
    ]

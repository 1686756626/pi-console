import json
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import async_session
from app.models.models import ScheduledJob

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def execute_job(job_id: str):
    async with async_session() as db:
        job = await db.get(ScheduledJob, job_id)
        if not job:
            logger.error(f"[scheduler] Job {job_id} not found")
            return

        from app.models.models import JobExecution
        execution = JobExecution(
            job_id=job_id,
            status="running",
        )
        db.add(execution)

        logger.info(f"[scheduler] Executing: {job.name} (pipeline: {job.pipeline_id})")

        try:
            from app.api.pipelines import resolve_pipeline
            from app.models.models import Run, Plan, PlanStep, StepStatus

            pipeline_data = await resolve_pipeline(db, job.pipeline_id)
            if not pipeline_data:
                execution.status = "failed"
                execution.error_message = f"Pipeline {job.pipeline_id} not found"
                execution.ended_at = datetime.utcnow()
                job.last_run_at = datetime.utcnow()
                await db.commit()
                return

            now = datetime.utcnow()
            run = Run(
                name=f"[定时] {job.name}",
                status="running",
                trigger_type="scheduled",
                started_at=now,
            )
            db.add(run)
            await db.flush()

            execution.run_id = run.id

            plan = Plan(
                run_id=run.id,
                title=f"Plan for {run.name}",
                status="running",
            )
            db.add(plan)
            await db.flush()

            for i, step_def in enumerate(pipeline_data["steps"]):
                step = PlanStep(
                    plan_id=plan.id,
                    step_order=i + 1,
                    title=step_def["title"],
                    description=step_def["description"],
                    status=StepStatus.TODO,
                    agent_id=step_def["agent_id"],
                )
                db.add(step)

            execution.status = "succeeded"
            execution.ended_at = datetime.utcnow()
            job.last_run_at = now
            await db.commit()
            logger.info(f"[scheduler] Run {run.id} created successfully")

        except Exception as e:
            execution.status = "failed"
            execution.error_message = str(e)[:500]
            execution.ended_at = datetime.utcnow()
            job.last_run_at = datetime.utcnow()
            await db.commit()
            logger.error(f"[scheduler] Execution failed: {e}")


def add_job(job: ScheduledJob):
    if not job.enabled:
        return
    try:
        trigger = CronTrigger.from_crontab(job.cron_expression)
        scheduler.add_job(
            execute_job,
            trigger=trigger,
            id=job.id,
            args=[job.id],
            replace_existing=True,
        )
        logger.info(f"[scheduler] 注册定时任务: {job.name} ({job.cron_expression})")
    except Exception as e:
        logger.error(f"[scheduler] 注册失败: {e}")


def remove_job(job_id: str):
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass


def refresh_job(job: ScheduledJob):
    remove_job(job.id)
    if job.enabled:
        add_job(job)


async def start_scheduler():
    async with async_session() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(ScheduledJob).where(ScheduledJob.enabled == True)
        )
        jobs = result.scalars().all()
        for job in jobs:
            add_job(job)

    if not scheduler.running:
        scheduler.start()
        logger.info(f"[scheduler] 调度器已启动，共 {len(jobs)} 个定时任务")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[scheduler] 调度器已停止")

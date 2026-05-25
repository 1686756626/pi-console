from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import NewsItem, Run, RunStatus, Plan, PlanStep, StepStatus
from app.schemas import NewsItemResponse, NewsItemCreate, NewsItemUpdate

router = APIRouter()


@router.get("/news", response_model=list[NewsItemResponse])
async def list_news(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NewsItem).order_by(NewsItem.created_at.desc()).limit(100))
    return result.scalars().all()


@router.get("/news/{news_id}", response_model=NewsItemResponse)
async def get_news(news_id: str, db: AsyncSession = Depends(get_db)):
    news = await db.get(NewsItem, news_id)
    if not news:
        raise HTTPException(status_code=404, detail="新闻不存在")
    return news


@router.patch("/news/{news_id}", response_model=NewsItemResponse)
async def update_news(news_id: str, body: NewsItemUpdate, db: AsyncSession = Depends(get_db)):
    news = await db.get(NewsItem, news_id)
    if not news:
        raise HTTPException(status_code=404, detail="新闻不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(news, k, v)
    await db.commit()
    await db.refresh(news)
    return news


@router.post("/news", response_model=list[NewsItemResponse], status_code=201)
async def create_news_items(items: list[NewsItemCreate], db: AsyncSession = Depends(get_db)):
    created = []
    for item in items:
        news = NewsItem(**item.model_dump())
        db.add(news)
        created.append(news)
    await db.commit()
    for n in created:
        await db.refresh(n)
    return created


@router.post("/news/refresh")
async def refresh_news(db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    run = Run(
        name="新闻采集",
        status=RunStatus.PENDING,
        trigger_type="manual",
        started_at=now,
    )
    db.add(run)
    await db.flush()

    plan = Plan(
        run_id=run.id,
        title="新闻采集 - 执行计划",
        status=RunStatus.PENDING,
    )
    db.add(plan)
    await db.flush()

    step = PlanStep(
        plan_id=plan.id,
        step_order=1,
        title="采集整理近期新闻",
        description="搜索本周国内外新闻，整理摘要。",
        status=StepStatus.TODO,
        agent_id="news-curator",
    )
    db.add(step)
    await db.commit()

    result = await db.execute(
        select(Run)
        .where(Run.id == run.id)
        .options(selectinload(Run.plans).selectinload(Plan.steps))
    )
    run_obj = result.scalar_one()
    return {
        "message": "新闻采集任务已创建，Worker 将自动执行。",
        "run_id": run_obj.id,
        "status": run_obj.status,
    }

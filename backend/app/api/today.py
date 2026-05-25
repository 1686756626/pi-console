from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import (
    NewsItem, Memo, Page, Artifact, Run, WritingProject, WritingDraft, WritingMaterial,
    Space,
)
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/today/overview")
async def today_overview(db: AsyncSession = Depends(get_db)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    news_count = await db.scalar(
        select(func.count(NewsItem.id)).where(NewsItem.created_at >= today)
    )
    memo_count = await db.scalar(
        select(func.count(Memo.id)).where(Memo.created_at >= today)
    )
    page_count = await db.scalar(
        select(func.count(Page.id)).where(Page.updated_at >= today)
    )
    artifact_count = await db.scalar(
        select(func.count(Artifact.id)).where(Artifact.created_at >= today)
    )
    run_count = await db.scalar(
        select(func.count(Run.id)).where(Run.created_at >= today)
    )
    active_writing = await db.scalar(
        select(func.count(WritingProject.id)).where(
            WritingProject.status.in_(["topic", "gathering", "outline", "drafting"])
        )
    )

    recent_news = (await db.execute(
        select(NewsItem).order_by(desc(NewsItem.created_at)).limit(5)
    )).scalars().all()

    recent_memos = (await db.execute(
        select(Memo).order_by(desc(Memo.created_at)).limit(3)
    )).scalars().all()

    pending_writing = (await db.execute(
        select(WritingProject).where(
            WritingProject.status.in_(["topic", "gathering", "outline", "drafting"])
        ).order_by(desc(WritingProject.updated_at)).limit(5)
    )).scalars().all()

    suggestions = []
    if news_count == 0:
        suggestions.append({"type": "action", "message": "今日尚未采集新闻，可以触发一次新闻采集", "action": "refresh_news"})
    if active_writing == 0:
        suggestions.append({"type": "idea", "message": "当前没有进行中的写作项目，可以从今日素材中选题", "action": "new_writing"})
    if memo_count == 0:
        suggestions.append({"type": "reminder", "message": "今天还没记备忘，有什么想法可以随时记录", "action": "new_memo"})
    if artifact_count > 0:
        suggestions.append({"type": "review", "message": f"今日有 {artifact_count} 条新产出，可以检查是否有值得入库的内容", "action": "review_artifacts"})

    return {
        "date": today.isoformat(),
        "stats": {
            "news": news_count or 0,
            "memos": memo_count or 0,
            "pages_updated": page_count or 0,
            "artifacts": artifact_count or 0,
            "runs": run_count or 0,
            "writing_active": active_writing or 0,
        },
        "recent_news": [
            {"id": n.id, "title": n.title, "source": n.source, "summary": n.summary, "created_at": n.created_at.isoformat()}
            for n in recent_news
        ],
        "recent_memos": [
            {"id": m.id, "content": m.content[:200], "pinned": m.pinned, "created_at": m.created_at.isoformat()}
            for m in recent_memos
        ],
        "pending_writing": [
            {"id": w.id, "title": w.title, "status": w.status, "updated_at": w.updated_at.isoformat()}
            for w in pending_writing
        ],
        "suggestions": suggestions,
    }


@router.get("/today/stats-trend")
async def stats_trend(days: int = 7, db: AsyncSession = Depends(get_db)):
    result = []
    for i in range(days - 1, -1, -1):
        day = (datetime.now() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        next_day = day + timedelta(days=1)

        news = await db.scalar(select(func.count(NewsItem.id)).where(
            and_(NewsItem.created_at >= day, NewsItem.created_at < next_day)
        ))
        memos = await db.scalar(select(func.count(Memo.id)).where(
            and_(Memo.created_at >= day, Memo.created_at < next_day)
        ))
        artifacts = await db.scalar(select(func.count(Artifact.id)).where(
            and_(Artifact.created_at >= day, Artifact.created_at < next_day)
        ))
        runs = await db.scalar(select(func.count(Run.id)).where(
            and_(Run.created_at >= day, Run.created_at < next_day)
        ))

        result.append({
            "date": day.strftime("%m-%d"),
            "news": news or 0,
            "memos": memos or 0,
            "artifacts": artifacts or 0,
            "runs": runs or 0,
        })

    return result

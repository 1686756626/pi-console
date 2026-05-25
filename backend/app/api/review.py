from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta

from app.database import get_db
from app.models.models import NewsItem, Memo, Page, Artifact, Run, WritingProject

router = APIRouter()


@router.get("/review/daily")
async def daily_review(days: int = 7, db: AsyncSession = Depends(get_db)):
    result = []
    for i in range(days - 1, -1, -1):
        day = (datetime.now() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        next_day = day + timedelta(days=1)
        day_str = day.strftime("%Y-%m-%d")

        news = (await db.execute(
            select(NewsItem).where(and_(NewsItem.created_at >= day, NewsItem.created_at < next_day))
            .order_by(desc(NewsItem.created_at)).limit(10)
        )).scalars().all()

        memos = (await db.execute(
            select(Memo).where(and_(Memo.created_at >= day, Memo.created_at < next_day))
            .order_by(desc(Memo.created_at)).limit(10)
        )).scalars().all()

        runs = (await db.execute(
            select(Run).where(and_(Run.created_at >= day, Run.created_at < next_day))
            .order_by(desc(Run.created_at)).limit(10)
        )).scalars().all()

        pages_updated = (await db.execute(
            select(Page).where(and_(Page.updated_at >= day, Page.updated_at < next_day))
            .order_by(desc(Page.updated_at)).limit(10)
        )).scalars().all()

        writing = (await db.execute(
            select(WritingProject).where(and_(WritingProject.updated_at >= day, WritingProject.updated_at < next_day))
        )).scalars().all()

        result.append({
            "date": day_str,
            "today": datetime.now().strftime("%Y-%m-%d") == day_str,
            "summary": {
                "news_count": len(news),
                "memo_count": len(memos),
                "run_count": len(runs),
                "pages_updated_count": len(pages_updated),
                "writing_updated_count": len(writing),
            },
            "news": [{"id": n.id, "title": n.title, "source": n.source} for n in news[:5]],
            "memos": [{"id": m.id, "content": m.content[:100]} for m in memos[:5]],
            "runs": [{"id": r.id, "name": r.name, "status": r.status} for r in runs[:5]],
            "pages": [{"id": p.id, "title": p.title} for p in pages_updated[:5]],
            "writing": [{"id": w.id, "title": w.title, "status": w.status} for w in writing[:5]],
        })

    return result


@router.get("/review/insights")
async def review_insights(db: AsyncSession = Depends(get_db)):
    week_ago = datetime.now() - timedelta(days=7)

    total_runs = await db.scalar(select(func.count(Run.id)).where(Run.created_at >= week_ago))
    failed_runs = await db.scalar(select(func.count(Run.id)).where(and_(Run.created_at >= week_ago, Run.status == "failed")))
    total_news = await db.scalar(select(func.count(NewsItem.id)).where(NewsItem.created_at >= week_ago))
    total_memos = await db.scalar(select(func.count(Memo.id)).where(Memo.created_at >= week_ago))
    total_artifacts = await db.scalar(select(func.count(Artifact.id)).where(Artifact.created_at >= week_ago))
    total_writing = await db.scalar(select(func.count(WritingProject.id)).where(WritingProject.created_at >= week_ago))
    completed_writing = await db.scalar(select(func.count(WritingProject.id)).where(
        and_(WritingProject.created_at >= week_ago, WritingProject.status == "published")
    ))

    insights = []
    if failed_runs and total_runs and failed_runs / total_runs > 0.3:
        insights.append({"type": "warning", "message": f"本周运行失败率 {failed_runs}/{total_runs}，建议检查 Agent 配置"})
    if total_news and total_news < 5:
        insights.append({"type": "info", "message": "本周新闻采集较少，可以增加采集频率"})
    if total_memos and total_memos < 3:
        insights.append({"type": "reminder", "message": "本周备忘较少，多用备忘记录灵感"})
    if total_writing and (not completed_writing or completed_writing == 0):
        insights.append({"type": "encourage", "message": "本周有写作项目但尚未完成，加油"})
    if total_artifacts and total_artifacts > 10:
        insights.append({"type": "review", "message": f"本周产出 {total_artifacts} 条内容，值得整理入库"})

    return {
        "period": "7d",
        "stats": {
            "runs": total_runs or 0,
            "failed_runs": failed_runs or 0,
            "news": total_news or 0,
            "memos": total_memos or 0,
            "artifacts": total_artifacts or 0,
            "writing_started": total_writing or 0,
            "writing_completed": completed_writing or 0,
        },
        "insights": insights,
    }

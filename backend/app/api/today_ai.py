import logging
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import NewsItem, Memo, Artifact, Run, WritingProject

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/today/ai-suggestions")
async def ai_suggestions(db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timedelta

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)

    news = (await db.execute(
        select(NewsItem).order_by(desc(NewsItem.created_at)).limit(8)
    )).scalars().all()

    memos = (await db.execute(
        select(Memo).order_by(desc(Memo.created_at)).limit(5)
    )).scalars().all()

    active_writing = (await db.execute(
        select(WritingProject).where(
            WritingProject.status.in_(["topic", "gathering", "outline", "drafting"])
        ).order_by(desc(WritingProject.updated_at)).limit(5)
    )).scalars().all()

    recent_runs = (await db.execute(
        select(Run).order_by(desc(Run.created_at)).limit(5)
    )).scalars().all()

    recent_artifacts = (await db.execute(
        select(Artifact).where(Artifact.created_at >= yesterday).limit(5)
    )).scalars().all()

    news_block = "\n".join(
        f"- [{n.source or '未知来源'}] {n.title}: {(n.summary or '')[:100]}"
        for n in news[:8]
    ) or "暂无新闻"

    memos_block = "\n".join(
        f"- {m.content[:120]}"
        for m in memos[:5]
    ) or "暂无备忘"

    writing_block = "\n".join(
        f"- [{w.status}] {w.title} (方向: {w.topic or '未设定'})"
        for w in active_writing[:5]
    ) or "暂无进行中的写作"

    runs_block = "\n".join(
        f"- [{r.status}] {r.name} ({r.created_at.strftime('%m-%d %H:%M')})"
        for r in recent_runs[:5]
    ) or "暂无最近运行"

    artifacts_block = "\n".join(
        f"- [{a.type}] {a.title}"
        for a in recent_artifacts[:5]
    ) or "暂无最近产出"

    today_stats = (
        f"新闻: {len(news)}条 | 备忘: {len(memos)}条 | "
        f"活跃写作: {len(active_writing)}个 | 最近运行: {len(recent_runs)}次 | "
        f"最近24h产出: {len(recent_artifacts)}个"
    )

    has_failed = any(r.status in ("failed", "error") for r in recent_runs)

    system = (
        "你是一位文科学习与写作助手。根据用户当前的工作台数据，给出 1-3 条具体可执行的建议。\n\n"
        "要求:\n"
        "1. 每条建议必须包含: 标题（8字内）、具体行动内容（20-40字）、推荐的页面路径\n"
        "2. 用 JSON 数组格式输出，每项结构: {\"title\": \"...\", \"message\": \"...\", \"action\": \"...\"}\n"
        "3. action 只能是: refresh_news / new_writing / new_memo / review_artifacts / continue_writing / check_runs\n"
        "4. 不要输出 JSON 以外的内容\n"
        "5. 建议要有针对性，基于实际数据给出，避免泛泛而谈"
    )

    user_msg = (
        f"当前工作台数据:\n\n"
        f"## 今日统计\n{today_stats}\n\n"
        f"## 最新新闻\n{news_block}\n\n"
        f"## 最近备忘\n{memos_block}\n\n"
        f"## 进行中写作\n{writing_block}\n\n"
        f"## 最近运行\n{runs_block}\n\n"
        f"## 最近产出\n{artifacts_block}\n\n"
    )

    if has_failed:
        user_msg += "注意: 有运行失败的记录，建议先排查。\n"

    try:
        async with httpx.AsyncClient(timeout=60) as hc:
            resp = await hc.post(
                f"{settings.glm_base_url}/chat/completions",
                json={
                    "model": settings.glm_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": 0.8,
                    "max_tokens": 1024,
                },
                headers={
                    "Authorization": f"Bearer {settings.glm_api_key}",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code != 200:
                logger.error("GLM API error %d: %s", resp.status_code, resp.text[:200])
                return {"suggestions": _fallback_suggestions(news, memos, active_writing, has_failed)}

            import json
            text = resp.json()["choices"][0]["message"]["content"]
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[-1].rsplit("```", 1)[0]
            suggestions = json.loads(text)
            if not isinstance(suggestions, list):
                suggestions = [suggestions]
            return {"suggestions": suggestions[:3]}

    except Exception as e:
        logger.error("AI suggestions failed: %s", e)
        return {"suggestions": _fallback_suggestions(news, memos, active_writing, has_failed)}


def _fallback_suggestions(news, memos, writing, has_failed):
    suggestions = []
    if len(news) == 0:
        suggestions.append({"title": "采集新闻", "message": "今日尚未采集新闻，触发一次新闻采集获取最新素材", "action": "refresh_news"})
    if len(writing) == 0:
        suggestions.append({"title": "开始写作", "message": "当前没有进行中的写作项目，可以从素材中选题开始", "action": "new_writing"})
    elif len(writing) > 0:
        suggestions.append({"title": "继续写作", "message": f"有 {len(writing)} 个写作项目进行中，选择一个继续推进", "action": "continue_writing"})
    if has_failed:
        suggestions.append({"title": "检查运行", "message": "有运行失败记录，建议排查错误原因", "action": "check_runs"})
    if len(memos) == 0:
        suggestions.append({"title": "记录想法", "message": "今天还没有记录备忘，随时记录灵感和想法", "action": "new_memo"})
    return suggestions[:3]

from __future__ import annotations

import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.models import Tag, TagOnMemo, TagOnNews, TagOnPage, TagSource
from ..database import get_db

router = APIRouter(prefix="/tags", tags=["tags"])


def normalize_tag(name: str) -> str:
    return re.sub(r"[\s_\-]+", "", name).lower()


@router.get("")
async def list_tags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tag).order_by(Tag.usage_count.desc()))
    return [
        {
            "id": t.id,
            "name": t.name,
            "normalized_name": t.normalized_name,
            "color": t.color,
            "description": t.description,
            "usage_count": t.usage_count,
            "created_at": t.created_at.isoformat(),
        }
        for t in result.scalars().all()
    ]


@router.post("")
async def create_tag(data: dict, db: AsyncSession = Depends(get_db)):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(400, "name is required")
    normalized = normalize_tag(name)
    existing = await db.execute(select(Tag).where(Tag.normalized_name == normalized))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "tag already exists")
    tag = Tag(
        id=str(uuid.uuid4()),
        name=name,
        normalized_name=normalized,
        color=data.get("color"),
        description=data.get("description"),
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return {
        "id": tag.id,
        "name": tag.name,
        "normalized_name": tag.normalized_name,
        "color": tag.color,
        "description": tag.description,
        "usage_count": 0,
        "created_at": tag.created_at.isoformat(),
    }


async def get_or_create_tag(db: AsyncSession, name: str, source: str = TagSource.AI) -> Tag:
    normalized = normalize_tag(name)
    result = await db.execute(select(Tag).where(Tag.normalized_name == normalized))
    tag = result.scalar_one_or_none()
    if not tag:
        tag = Tag(id=str(uuid.uuid4()), name=name, normalized_name=normalized)
        db.add(tag)
        await db.flush()
    return tag


async def attach_tags_to_page(db: AsyncSession, page_id: str, tag_names: list[str], source: str = TagSource.AI):
    await db.execute(TagOnPage.__table__.delete().where(
        TagOnPage.__table__.c.page_id == page_id,
        TagOnPage.__table__.c.attached_by == source,
    ))
    for name in tag_names:
        tag = await get_or_create_tag(db, name, source)
        existing = await db.execute(
            select(TagOnPage).where(
                TagOnPage.page_id == page_id,
                TagOnPage.tag_id == tag.id,
            )
        )
        if not existing.scalar_one_or_none():
            db.add(TagOnPage(id=str(uuid.uuid4()), page_id=page_id, tag_id=tag.id, attached_by=source))
            tag.usage_count = (tag.usage_count or 0) + 1
    await db.flush()


async def attach_tags_to_news(db: AsyncSession, news_id: str, tag_names: list[str], source: str = TagSource.AI):
    await db.execute(TagOnNews.__table__.delete().where(
        TagOnNews.__table__.c.news_id == news_id,
        TagOnNews.__table__.c.attached_by == source,
    ))
    for name in tag_names:
        tag = await get_or_create_tag(db, name, source)
        existing = await db.execute(
            select(TagOnNews).where(
                TagOnNews.news_id == news_id,
                TagOnNews.tag_id == tag.id,
            )
        )
        if not existing.scalar_one_or_none():
            db.add(TagOnNews(id=str(uuid.uuid4()), news_id=news_id, tag_id=tag.id, attached_by=source))
            tag.usage_count = (tag.usage_count or 0) + 1
    await db.flush()


async def get_tags_for_page(db: AsyncSession, page_id: str) -> list[str]:
    result = await db.execute(
        select(Tag.name)
        .join(TagOnPage, TagOnPage.tag_id == Tag.id)
        .where(TagOnPage.page_id == page_id)
    )
    return [r[0] for r in result.all()]


async def get_tags_for_news(db: AsyncSession, news_id: str) -> list[str]:
    result = await db.execute(
        select(Tag.name)
        .join(TagOnNews, TagOnNews.tag_id == Tag.id)
        .where(TagOnNews.news_id == news_id)
    )
    return [r[0] for r in result.all()]


@router.post("/ai-tag/{target_type}/{target_id}")
async def ai_tag_item(target_type: str, target_id: str, db: AsyncSession = Depends(get_db)):
    import httpx

    if target_type not in ("page", "news"):
        raise HTTPException(400, "target_type must be page or news")

    if target_type == "page":
        from ..models.models import Page
        result = await db.execute(select(Page).where(Page.id == target_id))
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(404)
        text = f"标题: {item.title}\n内容: {(item.content or '')[:2000]}"
    else:
        from ..models.models import NewsItem
        result = await db.execute(select(NewsItem).where(NewsItem.id == target_id))
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(404)
        text = f"标题: {item.title}\n摘要: {(item.summary or '')[:1000]}"

    prompt = f"""请分析以下内容，给出3-5个标签（中文），只返回JSON数组格式如 ["标签1","标签2"]。

内容：
{text[:2000]}"""

    import os
    from app.config import settings
    if not settings.glm_api_key:
        raise HTTPException(500, "GLM_API_KEY not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.glm_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.glm_api_key}"},
            json={
                "model": settings.glm_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 200,
            },
        )
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "[]")
        import json
        try:
            tags = json.loads(content)
            if not isinstance(tags, list):
                tags = []
        except json.JSONDecodeError:
            match = re.search(r'\[.*?\]', content, re.DOTALL)
            tags = json.loads(match.group()) if match else []

    if target_type == "page":
        await attach_tags_to_page(db, target_id, tags, TagSource.AI)
    else:
        await attach_tags_to_news(db, target_id, tags, TagSource.AI)
        from ..models.models import NewsItem
        await db.execute(
            NewsItem.__table__.update()
            .where(NewsItem.__table__.c.id == target_id)
            .values(tagging_status="success")
        )

    await db.commit()
    return {"tags": tags}

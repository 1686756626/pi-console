from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.models import Memo, MemoVisibility, Tag, TagOnMemo, TagSource
from ..database import get_db

router = APIRouter(prefix="/memos", tags=["memos"])


def extract_tags_from_content(content: str) -> list[str]:
    return list(set(re.findall(r"#([^\s#]+)", content)))


@router.get("")
async def list_memos(
    date: str | None = None,
    tag: str | None = None,
    pinned_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = select(Memo).order_by(desc(Memo.pinned), desc(Memo.created_at)).limit(limit)
    if date:
        day_start = datetime.strptime(date, "%Y-%m-%d")
        day_end = day_start + timedelta(days=1)
        q = q.where(and_(Memo.created_at >= day_start, Memo.created_at < day_end))
    if tag:
        q = q.join(TagOnMemo).join(Tag).where(Tag.normalized_name == re.sub(r"[\s_\-]+", "", tag).lower())
    if pinned_only:
        q = q.where(Memo.pinned == True)
    result = await db.execute(q)
    memos = result.scalars().all()

    out = []
    for m in memos:
        tag_result = await db.execute(
            select(Tag.name).join(TagOnMemo).where(TagOnMemo.memo_id == m.id)
        )
        tags = [r[0] for r in tag_result.all()]
        out.append({
            "id": m.id,
            "content": m.content,
            "visibility": m.visibility,
            "pinned": m.pinned,
            "tags_extracted": m.tags_extracted,
            "parent_id": m.parent_id,
            "source": m.source,
            "tags": tags,
            "created_at": m.created_at.isoformat(),
            "updated_at": m.updated_at.isoformat(),
        })
    return out


@router.post("")
async def create_memo(data: dict, db: AsyncSession = Depends(get_db)):
    content = data.get("content", "").strip()
    if not content:
        raise HTTPException(400, "content is required")

    extracted = extract_tags_from_content(content)
    memo = Memo(
        id=str(uuid.uuid4()),
        content=content,
        visibility=data.get("visibility", "private"),
        pinned=data.get("pinned", False),
        tags_extracted=extracted,
        parent_id=data.get("parent_id"),
        source=data.get("source", "web"),
    )
    db.add(memo)

    if data.get("tags"):
        from ..api.tags import get_or_create_tag
        for tag_name in data["tags"]:
            tag = await get_or_create_tag(db, tag_name, TagSource.HUMAN)
            db.add(TagOnMemo(id=str(uuid.uuid4()), memo_id=memo.id, tag_id=tag.id, attached_by=TagSource.HUMAN))
    elif extracted:
        from ..api.tags import get_or_create_tag
        for tag_name in extracted:
            tag = await get_or_create_tag(db, tag_name, TagSource.AI)
            db.add(TagOnMemo(id=str(uuid.uuid4()), memo_id=memo.id, tag_id=tag.id, attached_by=TagSource.AI))

    await db.commit()
    await db.refresh(memo)

    tag_result = await db.execute(
        select(Tag.name).join(TagOnMemo).where(TagOnMemo.memo_id == memo.id)
    )
    tags = [r[0] for r in tag_result.all()]

    return {
        "id": memo.id,
        "content": memo.content,
        "visibility": memo.visibility,
        "pinned": memo.pinned,
        "tags_extracted": memo.tags_extracted,
        "parent_id": memo.parent_id,
        "source": memo.source,
        "tags": tags,
        "created_at": memo.created_at.isoformat(),
        "updated_at": memo.updated_at.isoformat(),
    }


@router.patch("/{memo_id}")
async def update_memo(memo_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Memo).where(Memo.id == memo_id))
    memo = result.scalar_one_or_none()
    if not memo:
        raise HTTPException(404)

    if "content" in data:
        memo.content = data["content"]
        memo.tags_extracted = extract_tags_from_content(data["content"])
    if "visibility" in data:
        memo.visibility = data["visibility"]
    if "pinned" in data:
        memo.pinned = data["pinned"]

    await db.commit()

    tag_result = await db.execute(
        select(Tag.name).join(TagOnMemo).where(TagOnMemo.memo_id == memo.id)
    )
    tags = [r[0] for r in tag_result.all()]

    return {
        "id": memo.id,
        "content": memo.content,
        "visibility": memo.visibility,
        "pinned": memo.pinned,
        "tags_extracted": memo.tags_extracted,
        "parent_id": memo.parent_id,
        "source": memo.source,
        "tags": tags,
        "created_at": memo.created_at.isoformat(),
        "updated_at": memo.updated_at.isoformat(),
    }


@router.delete("/{memo_id}")
async def delete_memo(memo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Memo).where(Memo.id == memo_id))
    memo = result.scalar_one_or_none()
    if not memo:
        raise HTTPException(404)
    await db.delete(memo)
    await db.commit()
    return {"ok": True}


@router.get("/daily-review")
async def daily_review(date: str | None = None, db: AsyncSession = Depends(get_db)):
    target_date = datetime.strptime(date, "%Y-%m-%d") if date else datetime.utcnow()
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    memos_result = await db.execute(
        select(Memo).where(and_(Memo.created_at >= day_start, Memo.created_at < day_end))
        .order_by(desc(Memo.pinned), desc(Memo.created_at))
    )
    memos = memos_result.scalars().all()

    from ..models.models import Artifact
    artifacts_result = await db.execute(
        select(Artifact).where(and_(Artifact.created_at >= day_start, Artifact.created_at < day_end))
        .order_by(desc(Artifact.created_at)).limit(20)
    )
    artifacts = artifacts_result.scalars().all()

    from ..models.models import Run
    runs_result = await db.execute(
        select(Run).where(and_(Run.created_at >= day_start, Run.created_at < day_end))
        .order_by(desc(Run.created_at)).limit(20)
    )
    runs = runs_result.scalars().all()

    from ..models.models import Page
    pages_result = await db.execute(
        select(Page).where(and_(Page.updated_at >= day_start, Page.updated_at < day_end))
        .order_by(desc(Page.updated_at)).limit(20)
    )
    pages = pages_result.scalars().all()

    return {
        "date": day_start.strftime("%Y-%m-%d"),
        "memos": [
            {
                "id": m.id, "content": m.content, "pinned": m.pinned,
                "tags_extracted": m.tags_extracted,
                "created_at": m.created_at.isoformat(),
            }
            for m in memos
        ],
        "artifacts": [
            {"id": a.id, "type": a.type, "title": a.title, "created_at": a.created_at.isoformat()}
            for a in artifacts
        ],
        "runs": [
            {"id": r.id, "name": r.name, "status": r.status, "created_at": r.created_at.isoformat()}
            for r in runs
        ],
        "pages_updated": [
            {"id": p.id, "title": p.title, "updated_at": p.updated_at.isoformat()}
            for p in pages
        ],
    }

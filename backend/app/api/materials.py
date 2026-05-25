from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import NewsItem, Memo, Page, Artifact, Space, KnowledgeDocument

router = APIRouter()


class MaterialQuery(BaseModel):
    type: str | None = None
    keyword: str | None = None
    limit: int = 50


@router.get("/materials")
async def list_materials(type: str | None = None, keyword: str | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)):
    results = {"news": [], "memos": [], "pages": [], "artifacts": [], "knowledge": []}

    if not type or type == "news":
        q = select(NewsItem).order_by(desc(NewsItem.created_at)).limit(limit)
        if keyword:
            q = q.where(or_(NewsItem.title.ilike(f"%{keyword}%"), NewsItem.summary.ilike(f"%{keyword}%")))
        rows = (await db.execute(q)).scalars().all()
        results["news"] = [
            {"id": n.id, "title": n.title, "summary": n.summary, "source": n.source,
             "url": n.url, "tags": n.tags, "created_at": n.created_at.isoformat()}
            for n in rows
        ]

    if not type or type == "memos":
        q = select(Memo).order_by(desc(Memo.created_at)).limit(limit)
        if keyword:
            q = q.where(Memo.content.ilike(f"%{keyword}%"))
        rows = (await db.execute(q)).scalars().all()
        results["memos"] = [
            {"id": m.id, "content": m.content, "pinned": m.pinned,
             "tags_extracted": m.tags_extracted, "created_at": m.created_at.isoformat()}
            for m in rows
        ]

    if not type or type == "pages":
        q = select(Page).where(Page.content != "").order_by(desc(Page.updated_at)).limit(limit)
        if keyword:
            q = q.where(or_(Page.title.ilike(f"%{keyword}%"), Page.content.ilike(f"%{keyword}%")))
        rows = (await db.execute(q)).scalars().all()
        results["pages"] = [
            {"id": p.id, "title": p.title, "content_preview": (p.content or "")[:200],
             "space_id": p.space_id, "updated_at": p.updated_at.isoformat()}
            for p in rows
        ]

    if not type or type == "artifacts":
        q = select(Artifact).order_by(desc(Artifact.created_at)).limit(limit)
        if keyword:
            q = q.where(Artifact.title.ilike(f"%{keyword}%"))
        rows = (await db.execute(q)).scalars().all()
        results["artifacts"] = [
            {"id": a.id, "title": a.title, "type": a.type,
             "content_preview": (a.markdown_content or "")[:200],
             "created_at": a.created_at.isoformat()}
            for a in rows
        ]

    if not type or type == "knowledge":
        q = select(KnowledgeDocument).order_by(desc(KnowledgeDocument.created_at)).limit(limit)
        if keyword:
            q = q.where(KnowledgeDocument.title.ilike(f"%{keyword}%"))
        rows = (await db.execute(q)).scalars().all()
        results["knowledge"] = [
            {"id": d.id, "title": d.title, "source_type": d.source_type,
             "chunk_count": d.chunk_count, "status": d.status,
             "created_at": d.created_at.isoformat()}
            for d in rows
        ]

    counts = {
        "news": len(results["news"]),
        "memos": len(results["memos"]),
        "pages": len(results["pages"]),
        "artifacts": len(results["artifacts"]),
        "knowledge": len(results["knowledge"]),
    }

    return {"counts": counts, "items": results}


@router.get("/materials/search")
async def search_materials(q: str, db: AsyncSession = Depends(get_db)):
    pattern = f"%{q}%"
    results = []

    news = (await db.execute(
        select(NewsItem).where(or_(NewsItem.title.ilike(pattern), NewsItem.summary.ilike(pattern)))
        .order_by(desc(NewsItem.created_at)).limit(10)
    )).scalars().all()
    for n in news:
        results.append({"id": n.id, "type": "news", "title": n.title, "snippet": (n.summary or "")[:150], "created_at": n.created_at.isoformat()})

    memos = (await db.execute(
        select(Memo).where(Memo.content.ilike(pattern))
        .order_by(desc(Memo.created_at)).limit(10)
    )).scalars().all()
    for m in memos:
        results.append({"id": m.id, "type": "memo", "title": m.content[:60], "snippet": m.content[:150], "created_at": m.created_at.isoformat()})

    pages = (await db.execute(
        select(Page).where(or_(Page.title.ilike(pattern), Page.content.ilike(pattern)))
        .order_by(desc(Page.updated_at)).limit(10)
    )).scalars().all()
    for p in pages:
        results.append({"id": p.id, "type": "page", "title": p.title, "snippet": (p.content or "")[:150], "created_at": p.updated_at.isoformat()})

    artifacts = (await db.execute(
        select(Artifact).where(Artifact.title.ilike(pattern))
        .order_by(desc(Artifact.created_at)).limit(10)
    )).scalars().all()
    for a in artifacts:
        results.append({"id": a.id, "type": "artifact", "title": a.title, "snippet": (a.markdown_content or "")[:150], "created_at": a.created_at.isoformat()})

    return {"query": q, "results": results}

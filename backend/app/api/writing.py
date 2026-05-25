from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import WritingProject, WritingDraft, WritingMaterial, NewsItem, Memo, Page, Artifact

router = APIRouter()


class ProjectCreate(BaseModel):
    title: str
    topic: str | None = None


class ProjectUpdate(BaseModel):
    title: str | None = None
    topic: str | None = None
    status: str | None = None
    outline: str | None = None
    final_content: str | None = None
    tags: list[str] | None = None


class MaterialAdd(BaseModel):
    source_type: str
    source_id: str | None = None
    title: str
    snippet: str | None = None
    relevance_note: str | None = None


class DraftCreate(BaseModel):
    content: str
    label: str | None = None


@router.get("/writing/projects")
async def list_projects(status: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(WritingProject).order_by(desc(WritingProject.updated_at))
    if status:
        q = q.where(WritingProject.status == status)
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": p.id, "title": p.title, "topic": p.topic, "status": p.status,
            "outline": p.outline, "tags": p.tags,
            "created_at": p.created_at.isoformat(), "updated_at": p.updated_at.isoformat(),
        }
        for p in rows
    ]


@router.post("/writing/projects", status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    p = WritingProject(title=body.title, topic=body.topic, status="topic")
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"id": p.id, "title": p.title, "status": p.status}


@router.get("/writing/projects/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")

    drafts = (await db.execute(
        select(WritingDraft).where(WritingDraft.project_id == project_id).order_by(desc(WritingDraft.version))
    )).scalars().all()

    materials = (await db.execute(
        select(WritingMaterial).where(WritingMaterial.project_id == project_id).order_by(desc(WritingMaterial.created_at))
    )).scalars().all()

    return {
        "id": p.id, "title": p.title, "topic": p.topic, "status": p.status,
        "outline": p.outline, "final_content": p.final_content, "tags": p.tags,
        "created_at": p.created_at.isoformat(), "updated_at": p.updated_at.isoformat(),
        "drafts": [
            {"id": d.id, "version": d.version, "content": d.content, "label": d.label, "created_at": d.created_at.isoformat()}
            for d in drafts
        ],
        "materials": [
            {"id": m.id, "source_type": m.source_type, "source_id": m.source_id,
             "title": m.title, "snippet": m.snippet, "relevance_note": m.relevance_note,
             "created_at": m.created_at.isoformat()}
            for m in materials
        ],
    }


@router.patch("/writing/projects/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return {"id": p.id, "title": p.title, "status": p.status}


@router.delete("/writing/projects/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")
    await db.delete(p)
    await db.commit()
    return {"deleted": True}


@router.post("/writing/projects/{project_id}/drafts", status_code=201)
async def create_draft(project_id: str, body: DraftCreate, db: AsyncSession = Depends(get_db)):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")

    max_ver = await db.scalar(
        select(func.max(WritingDraft.version)).where(WritingDraft.project_id == project_id)
    )
    version = (max_ver or 0) + 1

    d = WritingDraft(project_id=project_id, version=version, content=body.content, label=body.label)
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return {"id": d.id, "version": d.version, "label": d.label}


@router.post("/writing/projects/{project_id}/materials", status_code=201)
async def add_material(project_id: str, body: MaterialAdd, db: AsyncSession = Depends(get_db)):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")
    m = WritingMaterial(project_id=project_id, **body.model_dump())
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return {"id": m.id, "title": m.title}


@router.post("/writing/projects/{project_id}/auto-gather")
async def auto_gather(project_id: str, db: AsyncSession = Depends(get_db)):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")

    keyword = p.topic or p.title
    pattern = f"%{keyword}%"

    existing_ids = set(
        row[0] for row in
        (await db.execute(
            select(WritingMaterial.source_id).where(WritingMaterial.project_id == project_id)
        )).all()
    )

    gathered = []

    news = (await db.execute(
        select(NewsItem).where(or_(NewsItem.title.ilike(pattern), NewsItem.summary.ilike(pattern)))
        .limit(10)
    )).scalars().all()
    for n in news:
        if n.id not in existing_ids:
            m = WritingMaterial(project_id=project_id, source_type="news", source_id=n.id,
                                title=n.title, snippet=(n.summary or "")[:300])
            db.add(m)
            gathered.append({"type": "news", "title": n.title})

    memos = (await db.execute(
        select(Memo).where(Memo.content.ilike(pattern)).limit(5)
    )).scalars().all()
    for me in memos:
        mid = f"memo:{me.id}"
        if mid not in existing_ids:
            m = WritingMaterial(project_id=project_id, source_type="memo", source_id=me.id,
                                title=me.content[:60], snippet=me.content[:300])
            db.add(m)
            gathered.append({"type": "memo", "title": me.content[:60]})

    pages = (await db.execute(
        select(Page).where(or_(Page.title.ilike(pattern), Page.content.ilike(pattern)))
        .limit(5)
    )).scalars().all()
    for pg in pages:
        if pg.id not in existing_ids:
            m = WritingMaterial(project_id=project_id, source_type="page", source_id=pg.id,
                                title=pg.title, snippet=(pg.content or "")[:300])
            db.add(m)
            gathered.append({"type": "page", "title": pg.title})

    await db.commit()
    return {"gathered": len(gathered), "items": gathered}


from sqlalchemy import or_  # noqa: E402 - needed for ilike queries above

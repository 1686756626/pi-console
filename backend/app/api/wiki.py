from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Artifact, Page, Space, PageRevision
from app.schemas import SpaceResponse, SpaceCreate, PageResponse, PageCreate, PageUpdate

router = APIRouter()


@router.get("/spaces", response_model=list[SpaceResponse])
async def list_spaces(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Space).order_by(Space.created_at))
    spaces = result.scalars().all()
    resp = []
    for s in spaces:
        count_result = await db.execute(
            select(func.count()).where(Page.space_id == s.id)
        )
        count = count_result.scalar() or 0
        d = SpaceResponse.model_validate(s)
        d.page_count = count
        resp.append(d)
    return resp


@router.post("/spaces", response_model=SpaceResponse, status_code=201)
async def create_space(body: SpaceCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Space).where(Space.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="slug 已存在")
    space = Space(**body.model_dump())
    db.add(space)
    await db.commit()
    await db.refresh(space)
    return space


@router.delete("/spaces/{space_id}")
async def delete_space(space_id: str, db: AsyncSession = Depends(get_db)):
    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="空间不存在")
    pages = await db.execute(select(Page).where(Page.space_id == space_id))
    for p in pages.scalars().all():
        await db.delete(p)
    await db.delete(space)
    await db.commit()
    return {"ok": True}


@router.get("/spaces/{space_id}/pages")
async def list_pages(space_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Page)
        .where(Page.space_id == space_id)
        .order_by(Page.created_at)
    )
    pages = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "space_id": str(p.space_id),
            "parent_id": str(p.parent_id) if p.parent_id else None,
            "title": p.title,
            "content": None,
            "source_artifact_id": str(p.source_artifact_id) if p.source_artifact_id else None,
            "source_run_id": str(p.source_run_id) if p.source_run_id else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in pages
    ]


@router.get("/pages/{page_id}", response_model=PageResponse)
async def get_page(page_id: str, db: AsyncSession = Depends(get_db)):
    page = await db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="页面不存在")
    return page


@router.post("/pages", response_model=PageResponse, status_code=201)
async def create_page(body: PageCreate, db: AsyncSession = Depends(get_db)):
    space = await db.get(Space, body.space_id)
    if not space:
        raise HTTPException(status_code=400, detail="空间不存在")
    page = Page(**body.model_dump())
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return page


@router.patch("/pages/{page_id}", response_model=PageResponse)
async def update_page(page_id: str, body: PageUpdate, db: AsyncSession = Depends(get_db)):
    page = await db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="页面不存在")

    if body.title is not None or body.content is not None:
        max_rev = await db.execute(
            select(func.max(PageRevision.revision_number)).where(PageRevision.page_id == page_id)
        )
        rev_num = (max_rev.scalar() or 0) + 1
        revision = PageRevision(
            page_id=page_id,
            revision_number=rev_num,
            title=page.title,
            content=page.content,
        )
        db.add(revision)

    if body.title is not None:
        page.title = body.title
    if body.content is not None:
        page.content = body.content
    page.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(page)
    return page


@router.delete("/pages/{page_id}")
async def delete_page(page_id: str, db: AsyncSession = Depends(get_db)):
    page = await db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="页面不存在")
    children = await db.execute(select(Page).where(Page.parent_id == page_id))
    for child in children.scalars().all():
        child.parent_id = page.parent_id
    await db.delete(page)
    await db.commit()
    return {"ok": True}


@router.post("/import-artifacts", response_model=list[PageResponse])
async def import_artifacts(body: dict, db: AsyncSession = Depends(get_db)):
    space_id = body.get("space_id")
    artifact_ids = body.get("artifact_ids", [])
    if not space_id or not artifact_ids:
        raise HTTPException(status_code=400, detail="需要 space_id 和 artifact_ids")

    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="空间不存在")

    result = await db.execute(select(Artifact).where(Artifact.id.in_(artifact_ids)))
    artifacts = result.scalars().all()

    pages = []
    for a in artifacts:
        existing = await db.execute(
            select(Page).where(Page.source_artifact_id == a.id)
        )
        if existing.scalar_one_or_none():
            continue
        page = Page(
            space_id=space_id,
            title=a.title,
            content=a.markdown_content or "",
            source_artifact_id=a.id,
            source_run_id=a.run_id,
        )
        db.add(page)
        pages.append(page)

    await db.commit()
    for p in pages:
        await db.refresh(p)
    return pages


@router.get("/search")
async def search_pages(q: str, db: AsyncSession = Depends(get_db)):
    if not q.strip():
        return []
    like = f"%{q}%"
    result = await db.execute(
        select(Page).where(Page.title.ilike(like) | Page.content.ilike(like))
        .order_by(Page.updated_at.desc()).limit(20)
    )
    pages = result.scalars().all()
    space_ids = {p.space_id for p in pages}
    spaces = {}
    if space_ids:
        sr = await db.execute(select(Space).where(Space.id.in_(space_ids)))
        for s in sr.scalars().all():
            spaces[s.id] = s.name
    return [
        {
            "id": p.id,
            "title": p.title,
            "space_id": p.space_id,
            "space_name": spaces.get(p.space_id, ""),
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "snippet": (p.content or "")[:150],
        }
        for p in pages
    ]


@router.get("/pages/{page_id}/revisions")
async def list_revisions(page_id: str, db: AsyncSession = Depends(get_db)):
    page = await db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="页面不存在")
    result = await db.execute(
        select(PageRevision)
        .where(PageRevision.page_id == page_id)
        .order_by(PageRevision.revision_number.desc())
        .limit(50)
    )
    revisions = result.scalars().all()
    return [
        {
            "id": r.id,
            "page_id": r.page_id,
            "revision_number": r.revision_number,
            "title": r.title,
            "content_length": len(r.content) if r.content else 0,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in revisions
    ]


@router.get("/pages/{page_id}/revisions/{revision_id}")
async def get_revision(page_id: str, revision_id: str, db: AsyncSession = Depends(get_db)):
    revision = await db.get(PageRevision, revision_id)
    if not revision or revision.page_id != page_id:
        raise HTTPException(status_code=404, detail="版本不存在")
    return {
        "id": revision.id,
        "page_id": revision.page_id,
        "revision_number": revision.revision_number,
        "title": revision.title,
        "content": revision.content,
        "created_at": revision.created_at.isoformat() if revision.created_at else None,
    }


@router.post("/pages/{page_id}/revisions/{revision_id}/restore")
async def restore_revision(page_id: str, revision_id: str, db: AsyncSession = Depends(get_db)):
    page = await db.get(Page, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="页面不存在")
    revision = await db.get(PageRevision, revision_id)
    if not revision or revision.page_id != page_id:
        raise HTTPException(status_code=404, detail="版本不存在")

    max_rev = await db.execute(
        select(func.max(PageRevision.revision_number)).where(PageRevision.page_id == page_id)
    )
    rev_num = (max_rev.scalar() or 0) + 1
    backup = PageRevision(
        page_id=page_id,
        revision_number=rev_num,
        title=page.title,
        content=page.content,
    )
    db.add(backup)

    page.title = revision.title
    page.content = revision.content
    page.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(page)
    return {"restored": True, "page": {"id": page.id, "title": page.title}}

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Artifact, Run
from app.schemas import ArtifactResponse

router = APIRouter()


@router.get("/documents")
async def list_documents(
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Artifact).order_by(Artifact.created_at.desc())
    if type:
        q = q.where(Artifact.type == type)
    result = await db.execute(q.limit(200))
    artifacts = result.scalars().all()

    run_ids = {a.run_id for a in artifacts if a.run_id}
    runs_map = {}
    if run_ids:
        run_result = await db.execute(select(Run).where(Run.id.in_(run_ids)))
        for r in run_result.scalars().all():
            runs_map[str(r.id)] = r.name

    items = []
    for a in artifacts:
        d = ArtifactResponse.model_validate(a).model_dump()
        d["run_name"] = runs_map.get(a.run_id) if a.run_id else None
        items.append(d)
    return items

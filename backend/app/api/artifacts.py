from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Artifact
from app.schemas import ArtifactResponse, ArtifactCreate

router = APIRouter()


@router.get("/artifacts", response_model=list[ArtifactResponse])
async def list_artifacts(
    type: str | None = None,
    run_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Artifact).order_by(Artifact.created_at.desc())
    if type:
        q = q.where(Artifact.type == type)
    if run_id:
        q = q.where(Artifact.run_id == run_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/artifacts", response_model=ArtifactResponse, status_code=201)
async def create_artifact(body: ArtifactCreate, db: AsyncSession = Depends(get_db)):
    artifact = Artifact(**body.model_dump())
    db.add(artifact)
    await db.commit()
    await db.refresh(artifact)
    return artifact


@router.get("/artifacts/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(artifact_id: str, db: AsyncSession = Depends(get_db)):
    artifact = await db.get(Artifact, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact


@router.get("/artifacts/{artifact_id}/export")
async def export_artifact(artifact_id: str, db: AsyncSession = Depends(get_db)):
    artifact = await db.get(Artifact, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    content = artifact.markdown_content or ""
    filename = f"{artifact.title.replace(' ', '_')}.md"
    return PlainTextResponse(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

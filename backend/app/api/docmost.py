import os
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Artifact

router = APIRouter()

EXPORTS_DIR = os.environ.get("EXPORTS_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "exports"))


@router.get("/status")
async def docmost_status():
    from app.config import settings
    configured = bool(settings.docmost_api_token)
    if configured:
        return {"configured": True, "mode": "docmost", "url": settings.docmost_url}
    os.makedirs(EXPORTS_DIR, exist_ok=True)
    return {"configured": True, "mode": "local", "url": None, "exports_dir": EXPORTS_DIR}


class DocmostPublishRequest(BaseModel):
    artifact_ids: list[str] = []
    space_id: str = ""


class DocmostPageResponse(BaseModel):
    artifact_id: str
    title: str
    page_id: str | None = None
    page_url: str | None = None
    error: str | None = None


def _sanitize_filename(title: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', '', title)
    name = name.replace(' ', '_')
    return name[:80]


def _save_local(artifact: Artifact) -> DocmostPageResponse:
    os.makedirs(EXPORTS_DIR, exist_ok=True)
    filename = _sanitize_filename(artifact.title) + ".md"
    filepath = os.path.join(EXPORTS_DIR, filename)

    content = f"# {artifact.title}\n\n"
    content += f"> 导出时间: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}\n"
    content += f"> 类型: {artifact.type}\n\n"
    if artifact.markdown_content:
        content += artifact.markdown_content

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    return DocmostPageResponse(
        artifact_id=str(artifact.id),
        title=artifact.title,
        page_id=filename,
        page_url=f"/api/artifacts/{artifact.id}/export",
    )


@router.post("/publish", response_model=list[DocmostPageResponse])
async def publish_to_docmost(
    body: DocmostPublishRequest,
    db: AsyncSession = Depends(get_db),
):
    from app.config import settings

    if not body.artifact_ids:
        raise HTTPException(status_code=400, detail="请选择要发布的文档")

    result = await db.execute(
        select(Artifact).where(Artifact.id.in_(body.artifact_ids))
    )
    artifacts = result.scalars().all()

    if not settings.docmost_api_token:
        responses = []
        for artifact in artifacts:
            if not artifact.markdown_content:
                responses.append(DocmostPageResponse(
                    artifact_id=str(artifact.id),
                    title=artifact.title,
                    error="文档无内容",
                ))
                continue
            responses.append(_save_local(artifact))
        return responses

    import httpx

    docmost_url = settings.docmost_url
    responses_list: list[DocmostPageResponse] = []
    async with httpx.AsyncClient(timeout=30) as client:
        for artifact in artifacts:
            if not artifact.markdown_content:
                responses_list.append(DocmostPageResponse(
                    artifact_id=str(artifact.id),
                    title=artifact.title,
                    error="文档无内容",
                ))
                continue

            content = artifact.markdown_content
            content = re.sub(r"^#{1,6}\s+.*$", "", content, count=1, flags=re.MULTILINE).strip()

            try:
                payload: dict = {"title": artifact.title, "content": content}
                if body.space_id:
                    payload["spaceId"] = body.space_id

                resp = await client.post(
                    f"{docmost_url}/api/pages",
                    headers={
                        "Authorization": f"Bearer {settings.docmost_api_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                page_id = data.get("id", "")
                responses_list.append(DocmostPageResponse(
                    artifact_id=str(artifact.id),
                    title=artifact.title,
                    page_id=page_id,
                    page_url=f"{docmost_url}/p/{page_id}",
                ))
            except Exception as e:
                responses_list.append(DocmostPageResponse(
                    artifact_id=str(artifact.id),
                    title=artifact.title,
                    error=str(e),
                ))

    return responses_list

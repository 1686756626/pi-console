import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Artifact

router = APIRouter()


class RAGQuery(BaseModel):
    query: str
    top_k: int = 5


class RAGResponse(BaseModel):
    answer: str
    sources: list[dict] = []
    mode: str = "local"


class KnowledgeUpload(BaseModel):
    artifact_ids: list[str] = []


def _simple_search(query: str, artifacts: list[Artifact], top_k: int) -> list[Artifact]:
    keywords = re.findall(r"[\w\u4e00-\u9fff]{2,}", query.lower())
    scored: list[tuple[float, Artifact]] = []
    for a in artifacts:
        if not a.markdown_content:
            continue
        text = f"{a.title} {a.markdown_content}".lower()
        score = sum(text.count(kw) for kw in keywords)
        if score > 0:
            scored.append((score, a))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [a for _, a in scored[:top_k]]


async def _local_query(body: RAGQuery, db: AsyncSession) -> RAGResponse:
    result = await db.execute(
        select(Artifact)
        .where(Artifact.markdown_content.isnot(None))
        .order_by(Artifact.created_at.desc())
        .limit(200)
    )
    all_artifacts = result.scalars().all()

    matched = _simple_search(body.query, all_artifacts, body.top_k)

    if not matched:
        matched = all_artifacts[:body.top_k]

    context_parts = []
    for a in matched:
        snippet = (a.markdown_content or "")[:1500]
        context_parts.append(f"## {a.title} [{a.type}]\n{snippet}")

    context = "\n\n---\n\n".join(context_parts)

    return RAGResponse(
        answer=context or "未找到相关内容。",
        sources=[{"title": a.title, "id": str(a.id), "type": a.type} for a in matched],
        mode="local",
    )


async def _dify_query(body: RAGQuery) -> RAGResponse:
    import httpx
    from app.config import settings

    dify_base = settings.dify_api_url
    dify_key = settings.dify_knowledge_api_key

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{dify_base}/v1/chat-messages",
            headers={"Authorization": f"Bearer {dify_key}"},
            json={
                "inputs": {},
                "query": body.query,
                "user": "pi-console",
                "response_mode": "blocking",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return RAGResponse(
            answer=data.get("answer", ""),
            sources=[
                {"title": s.get("title", ""), "url": s.get("url", "")}
                for s in data.get("metadata", {}).get("retriever_resources", [])
            ],
            mode="dify",
        )


@router.post("/query", response_model=RAGResponse)
async def query_knowledge(body: RAGQuery, db: AsyncSession = Depends(get_db)):
    from app.config import settings

    if settings.dify_knowledge_api_key:
        try:
            return await _dify_query(body)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Dify 请求失败: {str(e)}")

    return await _local_query(body, db)


@router.post("/sync-artifacts")
async def sync_artifacts_to_knowledge(body: KnowledgeUpload, db: AsyncSession = Depends(get_db)):
    from app.config import settings

    if not settings.dify_knowledge_api_key or not settings.dify_dataset_id:
        result = await db.execute(
            select(Artifact).where(Artifact.id.in_(body.artifact_ids))
        )
        artifacts = result.scalars().all()
        return {
            "mode": "local",
            "message": "Dify 未配置，数据已在本地可用",
            "artifacts": [{"title": a.title, "id": str(a.id)} for a in artifacts],
        }

    import httpx

    dify_base = settings.dify_api_url
    dify_key = settings.dify_knowledge_api_key
    dataset_id = settings.dify_dataset_id

    result = await db.execute(
        select(Artifact).where(Artifact.id.in_(body.artifact_ids))
    )
    artifacts = result.scalars().all()

    synced = []
    async with httpx.AsyncClient(timeout=60) as client:
        for artifact in artifacts:
            if not artifact.markdown_content:
                continue
            try:
                resp = await client.post(
                    f"{dify_base}/v1/datasets/{dataset_id}/document/create-by-text",
                    headers={"Authorization": f"Bearer {dify_key}"},
                    json={
                        "data": artifact.markdown_content,
                        "indexing_technique": "high_quality",
                        "process_rule": {"mode": "automatic"},
                        "name": artifact.title,
                    },
                )
                resp.raise_for_status()
                synced.append({"artifact_id": str(artifact.id), "title": artifact.title})
            except Exception as e:
                synced.append({"artifact_id": str(artifact.id), "error": str(e)})

    return {"mode": "dify", "synced": synced}

import json
import math
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete as sql_delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, engine
from app.models.models import KnowledgeDocument, KnowledgeChunk, Artifact, Page

router = APIRouter()

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


class KnowledgeAddRequest(BaseModel):
    source_type: str
    source_ids: list[str] = []


class KnowledgeQueryRequest(BaseModel):
    query: str
    top_k: int = 5


def chunk_text(content: str) -> list[str]:
    if not content:
        return []
    paragraphs = re.split(r'\n\n+', content)
    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) > CHUNK_SIZE and current:
            chunks.append(current.strip())
            current = current[-CHUNK_OVERLAP:] + "\n\n" + para
        else:
            current = current + "\n\n" + para if current else para
    if current.strip():
        chunks.append(current.strip())
    return [c for c in chunks if len(c.strip()) > 20]


@router.get("/knowledge/documents")
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "source_type": d.source_type,
            "source_id": d.source_id,
            "title": d.title,
            "status": d.status,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.get("/knowledge/documents/{doc_id}/content")
async def get_document_content(doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(KnowledgeDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    chunks_result = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.document_id == doc_id)
        .order_by(KnowledgeChunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()
    content = "\n\n---\n\n".join(c.content for c in chunks)
    return {
        "id": doc.id,
        "title": doc.title,
        "source_type": doc.source_type,
        "source_id": doc.source_id,
        "content": content,
        "chunk_count": len(chunks),
    }


@router.post("/knowledge/documents")
async def add_documents(body: KnowledgeAddRequest, db: AsyncSession = Depends(get_db)):
    added = []
    for source_id in body.source_ids:
        title = ""
        content = ""

        if body.source_type == "artifact":
            artifact = await db.get(Artifact, source_id)
            if not artifact or not artifact.markdown_content:
                continue
            title = artifact.title
            content = artifact.markdown_content
        elif body.source_type == "page":
            page = await db.get(Page, source_id)
            if not page or not page.content:
                continue
            title = page.title
            content = page.content
        else:
            continue

        existing = await db.execute(
            select(KnowledgeDocument).where(
                KnowledgeDocument.source_type == body.source_type,
                KnowledgeDocument.source_id == source_id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        doc = KnowledgeDocument(
            source_type=body.source_type,
            source_id=source_id,
            title=title,
            status="indexing",
        )
        db.add(doc)
        await db.flush()

        chunks = chunk_text(content)
        for i, chunk_content in enumerate(chunks):
            chunk = KnowledgeChunk(
                document_id=doc.id,
                chunk_index=i,
                content=chunk_content,
            )
            db.add(chunk)

        doc.chunk_count = len(chunks)
        doc.status = "indexed"
        added.append({"id": doc.id, "title": title, "chunks": len(chunks)})

    await db.commit()

    await _rebuild_fts(db)

    return {"added": added, "total": len(added)}


@router.delete("/knowledge/documents/{doc_id}")
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(KnowledgeDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    await db.delete(doc)
    await db.commit()

    await _rebuild_fts(db)

    return {"deleted": True, "id": doc_id}


def _tokenize(text: str) -> list[str]:
    tokens = []
    ascii_words = re.findall(r'[a-zA-Z0-9]{2,}', text.lower())
    tokens.extend(ascii_words)
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)
    for i in range(len(chinese_chars) - 1):
        tokens.append(chinese_chars[i] + chinese_chars[i + 1])
    if len(chinese_chars) == 1:
        tokens.append(chinese_chars[0])
    return tokens


def _bm25_score(query_tokens: list[str], doc_tokens: list[str], avgdl: float, N: int, df: dict[str, int], k1: float = 1.5, b: float = 0.75) -> float:
    dl = len(doc_tokens)
    score = 0.0
    for qt in query_tokens:
        if qt not in df:
            continue
        n_qi = df.get(qt, 0)
        idf = math.log((N - n_qi + 0.5) / (n_qi + 0.5) + 1.0)
        tf = doc_tokens.count(qt)
        numerator = tf * (k1 + 1)
        denominator = tf + k1 * (1 - b + b * dl / max(avgdl, 1))
        score += idf * numerator / denominator
    return score


@router.post("/knowledge/query")
async def query_knowledge(body: KnowledgeQueryRequest, db: AsyncSession = Depends(get_db)):
    if not body.query.strip():
        return {"results": []}

    query_tokens = _tokenize(body.query)
    if not query_tokens:
        return {"results": []}

    chunks_result = await db.execute(select(KnowledgeChunk))
    all_chunks = chunks_result.scalars().all()

    if not all_chunks:
        return {"results": []}

    chunk_token_lists = [(chunk, _tokenize(chunk.content)) for chunk in all_chunks]
    corpus_lengths = [len(tokens) for _, tokens in chunk_token_lists]
    avgdl = sum(corpus_lengths) / len(corpus_lengths) if corpus_lengths else 1

    df: dict[str, int] = {}
    for _, tokens in chunk_token_lists:
        for t in set(tokens):
            df[t] = df.get(t, 0) + 1

    N = len(chunk_token_lists)
    scored = []
    for chunk, tokens in chunk_token_lists:
        score = _bm25_score(query_tokens, tokens, avgdl, N, df)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_chunks = scored[: body.top_k]

    if not top_chunks:
        return {"results": []}

    doc_ids = [c.document_id for _, c in top_chunks]
    docs_result = await db.execute(
        select(KnowledgeDocument).where(KnowledgeDocument.id.in_(doc_ids))
    )
    docs = {d.id: d for d in docs_result.scalars().all()}

    results = []
    seen = set()
    for score, chunk in top_chunks:
        doc = docs.get(chunk.document_id)
        if not doc or chunk.document_id in seen:
            continue
        seen.add(chunk.document_id)
        results.append({
            "document_id": doc.id,
            "title": doc.title,
            "source_type": doc.source_type,
            "source_id": doc.source_id,
            "chunk_index": chunk.chunk_index,
            "content": chunk.content[:500],
            "score": round(score, 4),
        })

    return {"results": results}


@router.post("/knowledge/reindex")
async def reindex_all(db: AsyncSession = Depends(get_db)):
    await _rebuild_fts(db)

    docs_result = await db.execute(select(KnowledgeDocument))
    docs = docs_result.scalars().all()

    reindexed = 0
    for doc in docs:
        source_content = ""
        if doc.source_type == "artifact":
            artifact = await db.get(Artifact, doc.source_id)
            if artifact:
                source_content = artifact.markdown_content or ""
        elif doc.source_type == "page":
            page = await db.get(Page, doc.source_id)
            if page:
                source_content = page.content or ""

        if not source_content:
            continue

        await db.execute(
            sql_delete(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)
        )
        chunks = chunk_text(source_content)
        for i, chunk_content in enumerate(chunks):
            chunk = KnowledgeChunk(
                document_id=doc.id,
                chunk_index=i,
                content=chunk_content,
            )
            db.add(chunk)
        doc.chunk_count = len(chunks)
        doc.status = "indexed"
        reindexed += 1

    await db.commit()
    return {"reindexed": reindexed}


async def _rebuild_fts(db: AsyncSession):
    pass

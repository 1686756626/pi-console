import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import AgentMemory

router = APIRouter()


class MemoryCreateRequest(BaseModel):
    agent_id: str
    key: str
    content: str
    category: str = "fact"


class MemoryQueryRequest(BaseModel):
    agent_id: str
    query: str
    limit: int = 20


@router.get("/memories/{agent_id}")
async def list_memories(agent_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentMemory)
        .where(AgentMemory.agent_id == agent_id)
        .order_by(AgentMemory.updated_at.desc())
    )
    memories = result.scalars().all()
    return [
        {
            "id": m.id,
            "agent_id": m.agent_id,
            "key": m.key,
            "content": m.content,
            "category": m.category,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        }
        for m in memories
    ]


@router.post("/memories")
async def create_memory(body: MemoryCreateRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(AgentMemory).where(
            AgentMemory.agent_id == body.agent_id,
            AgentMemory.key == body.key,
        )
    )
    mem = existing.scalar_one_or_none()
    if mem:
        mem.content = body.content
        mem.category = body.category
    else:
        mem = AgentMemory(
            agent_id=body.agent_id,
            key=body.key,
            content=body.content,
            category=body.category,
        )
        db.add(mem)
    await db.commit()
    return {"id": mem.id, "key": mem.key, "saved": True}


@router.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    mem = await db.get(AgentMemory, memory_id)
    if not mem:
        raise HTTPException(status_code=404, detail="记忆不存在")
    await db.delete(mem)
    await db.commit()
    return {"deleted": True}


@router.post("/memories/search")
async def search_memories(body: MemoryQueryRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentMemory).where(AgentMemory.agent_id == body.agent_id)
    )
    all_memories = result.scalars().all()

    if not all_memories:
        return {"memories": []}

    query_lower = body.query.lower()
    query_words = set(re.findall(r'[a-zA-Z0-9]{2,}', query_lower))
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', query_lower)
    for i in range(len(chinese_chars) - 1):
        query_words.add(chinese_chars[i] + chinese_chars[i + 1])

    scored = []
    for mem in all_memories:
        text = f"{mem.key} {mem.content}".lower()
        score = sum(1 for w in query_words if w in text)
        if mem.key.lower() in query_lower or query_lower in mem.key.lower():
            score += 10
        if score > 0:
            scored.append((score, mem))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[: body.limit]

    return {
        "memories": [
            {
                "id": m.id,
                "key": m.key,
                "content": m.content,
                "category": m.category,
                "score": s,
            }
            for s, m in top
        ]
    }

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete as sql_delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import ChatSession, ChatMessage

router = APIRouter()


class CreateSessionRequest(BaseModel):
    agent_id: str
    title: str = "新对话"


class UpdateSessionRequest(BaseModel):
    title: str


class AppendMessagesRequest(BaseModel):
    messages: list[dict]


@router.get("/chat/sessions")
async def list_sessions(agent_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.agent_id == agent_id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        msg_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == s.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()
        out.append({
            "id": s.id,
            "agent_id": s.agent_id,
            "title": s.title,
            "last_message": last_msg.content[:80] if last_msg else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })
    return out


@router.post("/chat/sessions")
async def create_session(body: CreateSessionRequest, db: AsyncSession = Depends(get_db)):
    session = ChatSession(
        agent_id=body.agent_id,
        title=body.title,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {
        "id": session.id,
        "agent_id": session.agent_id,
        "title": session.title,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
    }


@router.get("/chat/sessions/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = msg_result.scalars().all()
    return {
        "id": session.id,
        "agent_id": session.agent_id,
        "title": session.title,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }


@router.patch("/chat/sessions/{session_id}")
async def update_session(session_id: str, body: UpdateSessionRequest, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    session.title = body.title
    session.updated_at = datetime.utcnow()
    await db.commit()
    return {"id": session.id, "title": session.title}


@router.delete("/chat/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    await db.delete(session)
    await db.commit()
    return {"deleted": True}


@router.post("/chat/sessions/{session_id}/messages")
async def append_messages(session_id: str, body: AppendMessagesRequest, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    for msg in body.messages:
        m = ChatMessage(
            session_id=session_id,
            role=msg.get("role", "user"),
            content=msg.get("content", ""),
        )
        db.add(m)

    session.updated_at = datetime.utcnow()
    await db.commit()
    return {"saved": True, "count": len(body.messages)}

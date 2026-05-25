import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Agent
from app.schemas import AgentResponse, AgentUpdate, AgentCreate

router = APIRouter()

AGENTS_DIR = os.environ.get(
    "AGENTS_DIR",
    str(Path(__file__).resolve().parent.parent.parent.parent / "agents"),
)


@router.get("/agents", response_model=list[AgentResponse])
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).order_by(Agent.created_at))
    return result.scalars().all()


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str, data: AgentUpdate, db: AsyncSession = Depends(get_db)
):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/agents/{agent_id}/system-prompt")
async def get_system_prompt(agent_id: str):
    agent_file = os.path.join(AGENTS_DIR, f"{agent_id}.md")
    if not os.path.isfile(agent_file):
        raise HTTPException(status_code=404, detail="System prompt file not found")
    with open(agent_file, "r", encoding="utf-8") as f:
        content = f.read()
    return {"agent_id": agent_id, "content": content}


@router.put("/agents/{agent_id}/system-prompt")
async def update_system_prompt(agent_id: str, body: dict):
    content = body.get("content", "")
    agent_file = os.path.join(AGENTS_DIR, f"{agent_id}.md")
    os.makedirs(os.path.dirname(agent_file), exist_ok=True)
    with open(agent_file, "w", encoding="utf-8") as f:
        f.write(content)
    return {"agent_id": agent_id, "content": content, "saved": True}


@router.post("/agents", response_model=AgentResponse, status_code=201)
async def create_agent(data: AgentCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.get(Agent, data.id)
    if existing:
        raise HTTPException(status_code=409, detail="Agent ID already exists")
    agent = Agent(
        id=data.id,
        name=data.name,
        role=data.role,
        description=data.description,
        tools=data.tools or ["save_artifact"],
        model_name=data.model_name,
        temperature=data.temperature,
        max_tokens=data.max_tokens,
        runtime=data.runtime,
        mcp_server_ids=data.mcp_server_ids,
    )
    db.add(agent)
    default_prompt = f"# {data.name}\n\n你是一个名为「{data.name}」的 AI 智能体。{data.description or ''}\n\n请完成用户描述的任务。"
    agent_file = os.path.join(AGENTS_DIR, f"{data.id}.md")
    os.makedirs(os.path.dirname(agent_file), exist_ok=True)
    with open(agent_file, "w", encoding="utf-8") as f:
        f.write(default_prompt)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()
    agent_file = os.path.join(AGENTS_DIR, f"{agent_id}.md")
    if os.path.isfile(agent_file):
        os.remove(agent_file)
    return {"deleted": True, "id": agent_id}


@router.post("/agents/{agent_id}/test-run")
async def test_run_agent(agent_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    agent_file = os.path.join(AGENTS_DIR, f"{agent_id}.md")
    if not os.path.isfile(agent_file):
        raise HTTPException(status_code=404, detail="Agent not found")

    prompt_text = body.get("prompt", "")
    messages = body.get("messages", [])
    if not prompt_text and not messages:
        raise HTTPException(status_code=400, detail="prompt or messages is required")

    if prompt_text:
        messages = [{"role": "user", "content": prompt_text}]

    agent = await db.get(Agent, agent_id)

    from starlette.responses import StreamingResponse
    from app.runner import run_agent_stream

    return StreamingResponse(
        run_agent_stream(
            agent_id,
            messages,
            model_name=agent.model_name if agent else None,
            temperature=agent.temperature if agent else None,
            max_tokens=agent.max_tokens if agent else None,
            agent_tools=agent.tools if agent else None,
            mcp_server_ids=agent.mcp_server_ids if agent else None,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import McpServer
from app.mcp_client import mcp_list_tools, mcp_call_tool, mcp_tool_to_openai_tool

logger = logging.getLogger(__name__)

router = APIRouter()


class McpServerCreate(BaseModel):
    name: str
    url: str
    headers: dict | None = None
    enabled: bool = True
    transport: str = "streamable_http"
    command: list[str] | None = None
    env: dict | None = None


class McpServerUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    headers: dict | None = None
    enabled: bool | None = None
    transport: str | None = None
    command: list[str] | None = None
    env: dict | None = None


class McpServerResponse(BaseModel):
    id: str
    name: str
    url: str
    headers: dict | None = None
    enabled: bool
    tools: list[dict] | None = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class McpToolCallRequest(BaseModel):
    tool_name: str
    arguments: dict


def _server_to_response(srv: McpServer) -> dict:
    tools = None
    if srv.tools_json:
        try:
            tools = json.loads(srv.tools_json)
        except json.JSONDecodeError:
            pass
    headers = None
    if srv.headers_json:
        try:
            headers = json.loads(srv.headers_json)
        except json.JSONDecodeError:
            pass
    command = None
    if srv.command_json:
        try:
            command = json.loads(srv.command_json)
        except json.JSONDecodeError:
            pass
    env = None
    if srv.env_json:
        try:
            env = json.loads(srv.env_json)
        except json.JSONDecodeError:
            pass
    return {
        "id": srv.id,
        "name": srv.name,
        "url": srv.url,
        "headers": headers,
        "enabled": srv.enabled,
        "transport": srv.transport,
        "command": command,
        "env": env,
        "tools": tools,
        "created_at": srv.created_at.isoformat() if srv.created_at else "",
        "updated_at": srv.updated_at.isoformat() if srv.updated_at else "",
    }


@router.get("/mcp/servers")
async def list_servers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(McpServer).order_by(McpServer.created_at))
    servers = result.scalars().all()
    return [_server_to_response(s) for s in servers]


@router.post("/mcp/servers", status_code=201)
async def create_server(data: McpServerCreate, db: AsyncSession = Depends(get_db)):
    srv = McpServer(
        name=data.name,
        url=data.url,
        headers_json=json.dumps(data.headers) if data.headers else None,
        enabled=data.enabled,
        transport=data.transport,
        command_json=json.dumps(data.command) if data.command else None,
        env_json=json.dumps(data.env) if data.env else None,
    )
    db.add(srv)
    await db.commit()
    await db.refresh(srv)

    if srv.enabled:
        await _refresh_tools(srv, db)

    return _server_to_response(srv)


@router.get("/mcp/servers/{server_id}")
async def get_server(server_id: str, db: AsyncSession = Depends(get_db)):
    srv = await db.get(McpServer, server_id)
    if not srv:
        raise HTTPException(404, "MCP server not found")
    return _server_to_response(srv)


@router.put("/mcp/servers/{server_id}")
async def update_server(
    server_id: str, data: McpServerUpdate, db: AsyncSession = Depends(get_db)
):
    srv = await db.get(McpServer, server_id)
    if not srv:
        raise HTTPException(404, "MCP server not found")

    if data.name is not None:
        srv.name = data.name
    if data.url is not None:
        srv.url = data.url
    if data.headers is not None:
        srv.headers_json = json.dumps(data.headers)
    if data.enabled is not None:
        srv.enabled = data.enabled
    if data.transport is not None:
        srv.transport = data.transport
    if data.command is not None:
        srv.command_json = json.dumps(data.command)
    if data.env is not None:
        srv.env_json = json.dumps(data.env)

    await db.commit()
    await db.refresh(srv)

    needs_refresh = data.url is not None or data.headers is not None or data.enabled is True
    if needs_refresh and srv.enabled:
        await _refresh_tools(srv, db)

    return _server_to_response(srv)


@router.delete("/mcp/servers/{server_id}")
async def delete_server(server_id: str, db: AsyncSession = Depends(get_db)):
    srv = await db.get(McpServer, server_id)
    if not srv:
        raise HTTPException(404, "MCP server not found")
    await db.delete(srv)
    await db.commit()
    return {"deleted": True, "id": server_id}


@router.post("/mcp/servers/{server_id}/refresh")
async def refresh_tools(server_id: str, db: AsyncSession = Depends(get_db)):
    srv = await db.get(McpServer, server_id)
    if not srv:
        raise HTTPException(404, "MCP server not found")
    await _refresh_tools(srv, db)
    return _server_to_response(srv)


@router.post("/mcp/servers/{server_id}/call")
async def call_tool(server_id: str, data: McpToolCallRequest, db: AsyncSession = Depends(get_db)):
    srv = await db.get(McpServer, server_id)
    if not srv:
        raise HTTPException(404, "MCP server not found")
    if not srv.enabled:
        raise HTTPException(400, "MCP server is disabled")

    headers = _parse_json(srv.headers_json)
    command = _parse_json(srv.command_json)
    env = _parse_json(srv.env_json)

    result = await mcp_call_tool(
        srv.url, data.tool_name, data.arguments,
        headers=headers,
        transport=srv.transport,
        command=command,
        env=env,
    )
    return {"result": result}


def _parse_json(text: str | None) -> dict | list | None:
    if text:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    return None


async def _refresh_tools(srv: McpServer, db: AsyncSession):
    headers = _parse_json(srv.headers_json)
    command = _parse_json(srv.command_json)
    env = _parse_json(srv.env_json)

    try:
        tools = await mcp_list_tools(
            srv.url, headers=headers,
            transport=srv.transport, command=command, env=env,
        )
        srv.tools_json = json.dumps(tools)
        logger.info(f"Refreshed MCP tools for '{srv.name}': {[t['name'] for t in tools]}")
    except Exception as e:
        logger.error(f"Failed to refresh MCP tools for '{srv.name}': {e}")
        srv.tools_json = json.dumps([])
    await db.commit()
    await db.refresh(srv)


async def get_all_mcp_tools(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(McpServer).where(McpServer.enabled == True))
    servers = result.scalars().all()

    all_tools = []
    for srv in servers:
        if not srv.tools_json:
            continue
        try:
            tools = json.loads(srv.tools_json)
        except json.JSONDecodeError:
            continue
        for t in tools:
            openai_tool = mcp_tool_to_openai_tool(t)
            openai_tool["_mcp_server_id"] = srv.id
            openai_tool["_mcp_server_url"] = srv.url
            openai_tool["_mcp_headers"] = _parse_json(srv.headers_json)
            openai_tool["_mcp_transport"] = srv.transport
            openai_tool["_mcp_command"] = _parse_json(srv.command_json)
            openai_tool["_mcp_env"] = _parse_json(srv.env_json)
            all_tools.append(openai_tool)

    return all_tools


async def execute_mcp_tool(
    server_url: str,
    tool_name: str,
    arguments: dict,
    headers: dict | None = None,
    transport: str = "streamable_http",
    command: list[str] | None = None,
    env: dict | None = None,
) -> str:
    return await mcp_call_tool(
        server_url, tool_name, arguments,
        headers=headers, transport=transport, command=command, env=env,
    )

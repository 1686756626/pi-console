import asyncio
import json
import logging
import os
import httpx

logger = logging.getLogger(__name__)

_stdio_processes: dict[str, asyncio.subprocess.Process] = {}


async def mcp_list_tools(
    server_url: str,
    headers: dict | None = None,
    transport: str = "streamable_http",
    command: list[str] | None = None,
    env: dict | None = None,
) -> list[dict]:
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}

    if transport == "stdio" and command:
        result = await _stdio_request(server_url, payload, command, env)
    else:
        result = await _http_request(f"{server_url}/mcp", payload, headers)

    if "error" in result:
        raise RuntimeError(f"MCP tools/list error: {result['error']}")
    return result.get("result", {}).get("tools", [])


async def mcp_call_tool(
    server_url: str,
    tool_name: str,
    arguments: dict,
    headers: dict | None = None,
    transport: str = "streamable_http",
    command: list[str] | None = None,
    env: dict | None = None,
) -> str:
    call_payload = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments},
    }

    if transport == "stdio" and command:
        result = await _stdio_request(server_url, call_payload, command, env)
    else:
        req_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if headers:
            req_headers.update(headers)

        async with httpx.AsyncClient(timeout=60.0) as client:
            init_payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
            init_resp = await client.post(
                f"{server_url}/mcp", json=init_payload, headers=req_headers
            )
            session_id = init_resp.headers.get("mcp-session-id", "")

            call_headers = {**req_headers}
            if session_id:
                call_headers["Mcp-Session-Id"] = session_id

            resp = await client.post(
                f"{server_url}/mcp", json=call_payload, headers=call_headers
            )
            result = _parse_sse_response(resp.text)

    if "error" in result:
        err = result["error"]
        return f"[MCP tool error: {err.get('message', str(err))}]"

    content_items = result.get("result", {}).get("content", [])
    if not content_items:
        return "[MCP tool returned empty result]"

    is_error = result.get("result", {}).get("isError", False)
    texts = [item.get("text", "") for item in content_items if item.get("type") == "text"]
    combined = "\n".join(texts)
    if is_error:
        logger.warning(f"MCP tool '{tool_name}' returned error: {combined[:200]}")
    return combined


async def _http_request(url: str, payload: dict, headers: dict | None = None) -> dict:
    req_headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    if headers:
        req_headers.update(headers)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers=req_headers)
        return _parse_sse_response(resp.text)


async def _stdio_request(
    server_id: str, payload: dict, command: list[str], env: dict | None = None
) -> dict:
    proc = _stdio_processes.get(server_id)
    if proc is None or proc.returncode is not None:
        full_env = {**os.environ}
        if env:
            full_env.update(env)
        proc = await asyncio.create_subprocess_exec(
            *command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=full_env,
        )
        _stdio_processes[server_id] = proc

        try:
            init_payload = {"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "pi-console", "version": "0.1.0"},
            }}
            init_json = json.dumps(init_payload) + "\n"
            proc.stdin.write(init_json.encode())
            await proc.stdin.drain()
            init_line = await asyncio.wait_for(proc.stdout.readline(), timeout=10)
            json.loads(init_line.decode().strip())
        except Exception as e:
            logger.error(f"Stdio MCP init failed: {e}")
            proc.kill()
            _stdio_processes.pop(server_id, None)
            return {"error": {"message": f"Stdio MCP init failed: {e}"}}

    msg_json = json.dumps(payload) + "\n"
    proc.stdin.write(msg_json.encode())
    await proc.stdin.drain()

    try:
        resp_line = await asyncio.wait_for(proc.stdout.readline(), timeout=60)
        return json.loads(resp_line.decode().strip())
    except asyncio.TimeoutError:
        return {"error": {"message": "Stdio MCP timeout"}}
    except Exception as e:
        return {"error": {"message": f"Stdio MCP error: {e}"}}


def cleanup_stdio_processes():
    for sid, proc in _stdio_processes.items():
        if proc.returncode is None:
            proc.kill()
    _stdio_processes.clear()


def _parse_sse_response(text: str) -> dict:
    for line in text.split("\n"):
        if line.startswith("data:"):
            data_str = line[5:].strip()
            if data_str:
                try:
                    return json.loads(data_str)
                except json.JSONDecodeError:
                    continue
    return {"error": {"message": f"No valid JSON in SSE response: {text[:200]}"}}


def mcp_tool_to_openai_tool(mcp_tool: dict) -> dict:
    schema = mcp_tool.get("inputSchema", {"type": "object", "properties": {}})
    return {
        "type": "function",
        "function": {
            "name": mcp_tool["name"],
            "description": mcp_tool.get("description", ""),
            "parameters": schema,
        },
    }

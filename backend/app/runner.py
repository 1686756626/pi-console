import json
import logging
import os
import asyncio
from datetime import datetime
from pathlib import Path
from sqlalchemy import select

from app.config import settings

logger = logging.getLogger(__name__)

AGENTS_DIR = os.environ.get(
    "AGENTS_DIR",
    str(Path(__file__).resolve().parent.parent / "agents"),
)

GLM_BASE_URL = settings.glm_base_url
GLM_API_KEY = settings.glm_api_key
GLM_MODEL = settings.glm_model

BUILTIN_TOOL_DEFINITIONS = {
    "save_artifact": {
        "type": "function",
        "function": {
            "name": "save_artifact",
            "description": "保存一段内容为产出物（artifact）。当你完成了一篇文章、报告、摘要等重要内容时使用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "产出物标题"},
                    "content": {"type": "string", "description": "产出物内容（Markdown 格式）"},
                    "artifact_type": {
                        "type": "string",
                        "enum": ["news", "research_report", "article_draft", "journal_summary"],
                        "description": "产出物类型",
                    },
                },
                "required": ["title", "content"],
            },
        },
    },
    "knowledge_query": {
        "type": "function",
        "function": {
            "name": "knowledge_query",
            "description": "从知识库中检索与查询相关的文档片段。使用 BM25 算法进行语义匹配，返回最相关的 top_k 个结果。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索查询文本"},
                    "top_k": {"type": "integer", "description": "返回结果数量，默认 5", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    "call_agent": {
        "type": "function",
        "function": {
            "name": "call_agent",
            "description": "调用另一个智能体执行任务并返回结果。可以将当前任务委托给具有不同专长的智能体处理。",
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {"type": "string", "description": "要调用的智能体 ID"},
                    "prompt": {"type": "string", "description": "传递给目标智能体的任务描述"},
                },
                "required": ["agent_id", "prompt"],
            },
        },
    },
    "execute_code": {
        "type": "function",
        "function": {
            "name": "execute_code",
            "description": "在沙箱中执行 Python 代码并返回输出结果。适用于数据分析、计算、文本处理等场景。执行超时 30 秒，无网络访问。",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "要执行的 Python 代码"},
                },
                "required": ["code"],
            },
        },
    },
    "save_memory": {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "将信息保存到持久记忆中，供未来对话使用。适用于记住用户偏好、重要事实、任务上下文等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "记忆的键名（用于检索时匹配）"},
                    "content": {"type": "string", "description": "要保存的记忆内容"},
                    "category": {"type": "string", "enum": ["preference", "fact", "context", "instruction"], "description": "记忆类别"},
                },
                "required": ["key", "content", "category"],
            },
        },
    },
    "recall_memory": {
        "type": "function",
        "function": {
            "name": "recall_memory",
            "description": "从持久记忆中检索之前保存的信息。可以通过关键词搜索相关记忆。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索记忆的关键词"},
                    "limit": {"type": "integer", "description": "返回结果数量上限，默认 10", "default": 10},
                },
                "required": ["query"],
            },
        },
    },
}


def _get_system_prompt(agent_id: str) -> str:
    agent_file = os.path.join(AGENTS_DIR, f"{agent_id}.md")
    if os.path.isfile(agent_file):
        with open(agent_file, "r", encoding="utf-8") as f:
            return f.read()
    return f"你是一个有用的 AI 智能体，名为 {agent_id}。"


async def _get_tools_for_agent(
    agent_tools: list[str] | None, mcp_server_ids: list[str] | None = None
) -> tuple[list[dict], dict]:
    from app.database import async_session
    from app.api.mcp_servers import get_all_mcp_tools

    openai_tools = []
    tool_meta = {}

    if agent_tools:
        for t in agent_tools:
            if t in BUILTIN_TOOL_DEFINITIONS:
                td = BUILTIN_TOOL_DEFINITIONS[t]
                openai_tools.append(td)
                tool_meta[t] = {"type": "builtin"}

    async with async_session() as db:
        mcp_tools = await get_all_mcp_tools(db)

    for mt in mcp_tools:
        server_id = mt.get("_mcp_server_id", "")
        if mcp_server_ids is not None:
            if server_id not in mcp_server_ids:
                continue
        elif server_id:
            continue
        fname = mt["function"]["name"]
        openai_tools.append(mt)
        tool_meta[fname] = {
            "type": "mcp",
            "server_url": mt.get("_mcp_server_url", ""),
            "headers": mt.get("_mcp_headers"),
        }

    return openai_tools, tool_meta


async def _handle_tool_call(tool_name: str, tool_args: dict, tool_meta: dict, agent_id: str = "") -> str:
    meta = tool_meta.get(tool_name, {})

    if meta.get("type") == "builtin":
        if tool_name == "save_artifact":
            title = tool_args.get("title", "未命名")
            content = tool_args.get("content", "")
            return json.dumps({"saved": True, "title": title, "length": len(content)})
        if tool_name == "knowledge_query":
            return await _builtin_knowledge_query(tool_args)
        if tool_name == "call_agent":
            return await _builtin_call_agent(tool_args, tool_meta)
        if tool_name == "execute_code":
            return await _builtin_execute_code(tool_args)
        if tool_name == "save_memory":
            tool_args["_agent_id"] = agent_id
            return await _builtin_save_memory(tool_args)
        if tool_name == "recall_memory":
            tool_args["_agent_id"] = agent_id
            return await _builtin_recall_memory(tool_args)
        return f"[未知内置工具: {tool_name}]"

    if meta.get("type") == "mcp":
        from app.api.mcp_servers import execute_mcp_tool
        server_url = meta.get("server_url", "")
        headers = meta.get("headers")
        transport = meta.get("transport", "streamable_http")
        command = meta.get("command")
        env = meta.get("env")
        try:
            return await execute_mcp_tool(
                server_url, tool_name, tool_args,
                headers=headers, transport=transport, command=command, env=env,
            )
        except Exception as e:
            logger.error(f"MCP tool '{tool_name}' execution failed: {e}")
            return f"[MCP 工具 '{tool_name}' 执行失败: {str(e)}]"

    return f"[未知工具: {tool_name}]"


async def _eval_condition(condition: str, context_map: dict[str, str]) -> bool:
    expr = condition.strip().lower()
    if expr in ("true", "1", "yes"):
        return True
    if expr in ("false", "0", "no"):
        return False
    if "==" in expr:
        left, right = expr.split("==", 1)
        left = left.strip()
        right = right.strip().strip("\"'")
        val = context_map.get(left, "")
        return val.lower() == right
    if "!=" in expr:
        left, right = expr.split("!=", 1)
        left = left.strip()
        right = right.strip().strip("\"'")
        val = context_map.get(left, "")
        return val.lower() != right
    if "contains" in expr:
        parts = expr.split("contains", 1)
        key = parts[0].strip()
        substr = parts[1].strip().strip("\"'")
        val = context_map.get(key, "")
        return substr in val.lower()
    for key in context_map:
        if key.lower() in expr and context_map.get(key, ""):
            return True
    return False


async def _builtin_knowledge_query(tool_args: dict) -> str:
    import math
    import re
    from sqlalchemy import select as sa_select
    from app.database import async_session
    from app.models.models import KnowledgeChunk, KnowledgeDocument

    query = tool_args.get("query", "")
    top_k = tool_args.get("top_k", 5)
    if not query.strip():
        return json.dumps({"results": [], "message": "查询不能为空"})

    def _tokenize(text: str) -> list[str]:
        tokens = []
        tokens.extend(re.findall(r'[a-zA-Z0-9]{2,}', text.lower()))
        chinese_chars = re.findall(r'[\u4e00-\u9fff]', text)
        for i in range(len(chinese_chars) - 1):
            tokens.append(chinese_chars[i] + chinese_chars[i + 1])
        if len(chinese_chars) == 1:
            tokens.append(chinese_chars[0])
        return tokens

    def _bm25(query_tokens, doc_tokens, avgdl, N, df, k1=1.5, b=0.75):
        dl = len(doc_tokens)
        score = 0.0
        for qt in query_tokens:
            if qt not in df:
                continue
            n_qi = df.get(qt, 0)
            idf = math.log((N - n_qi + 0.5) / (n_qi + 0.5) + 1.0)
            tf = doc_tokens.count(qt)
            score += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / max(avgdl, 1)))
        return score

    query_tokens = _tokenize(query)
    if not query_tokens:
        return json.dumps({"results": [], "message": "无法解析查询"})

    async with async_session() as db:
        chunks_result = await db.execute(sa_select(KnowledgeChunk))
        all_chunks = chunks_result.scalars().all()

    if not all_chunks:
        return json.dumps({"results": [], "message": "知识库为空"})

    chunk_token_lists = [(chunk, _tokenize(chunk.content)) for chunk in all_chunks]
    avgdl = sum(len(t) for _, t in chunk_token_lists) / len(chunk_token_lists)
    df: dict[str, int] = {}
    for _, tokens in chunk_token_lists:
        for t in set(tokens):
            df[t] = df.get(t, 0) + 1

    N = len(chunk_token_lists)
    scored = []
    for chunk, tokens in chunk_token_lists:
        score = _bm25(query_tokens, tokens, avgdl, N, df)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    if not top:
        return json.dumps({"results": [], "message": "未找到相关内容"})

    doc_ids = [c.document_id for _, c in top]
    async with async_session() as db:
        docs_result = await db.execute(
            sa_select(KnowledgeDocument).where(KnowledgeDocument.id.in_(doc_ids))
        )
        docs = {d.id: d for d in docs_result.scalars().all()}

    results = []
    for score, chunk in top:
        doc = docs.get(chunk.document_id)
        results.append({
            "title": doc.title if doc else "未知",
            "source_type": doc.source_type if doc else "",
            "content": chunk.content[:500],
            "score": round(score, 4),
        })

    return json.dumps({"results": results, "total": len(results)}, ensure_ascii=False)


async def _builtin_call_agent(tool_args: dict, parent_tool_meta: dict) -> str:
    target_agent_id = tool_args.get("agent_id", "")
    prompt = tool_args.get("prompt", "")
    if not target_agent_id or not prompt:
        return json.dumps({"error": "agent_id 和 prompt 不能为空"})

    from app.database import async_session
    from app.models.models import Agent

    async with async_session() as db:
        agent = await db.get(Agent, target_agent_id)
    if not agent:
        return json.dumps({"error": f"智能体 '{target_agent_id}' 不存在"})
    if not agent.enabled:
        return json.dumps({"error": f"智能体 '{agent.name}' 已禁用"})

    result = await run_agent_with_tools(
        agent_id=target_agent_id,
        prompt_or_messages=prompt,
        agent_tools=agent.tools,
        mcp_server_ids=agent.mcp_server_ids,
        model_name=agent.model_name,
        temperature=agent.temperature,
        max_tokens=min(agent.max_tokens or 4096, 4096),
        max_tool_rounds=3,
    )

    if result.get("success"):
        return json.dumps({
            "agent_id": target_agent_id,
            "agent_name": agent.name,
            "result": result.get("content", "")[:3000],
            "artifacts_count": len(result.get("artifacts", [])),
        }, ensure_ascii=False)
    else:
        return json.dumps({
            "agent_id": target_agent_id,
            "agent_name": agent.name,
            "error": result.get("error", "未知错误"),
        }, ensure_ascii=False)


async def _builtin_execute_code(tool_args: dict) -> str:
    import subprocess
    import tempfile

    code = tool_args.get("code", "")
    if not code.strip():
        return json.dumps({"error": "代码不能为空"})
    if len(code) > 10000:
        return json.dumps({"error": "代码长度超过 10000 字符限制"})

    forbidden = ["import os", "import sys", "import subprocess", "import socket",
                 "import http", "import urllib", "import requests", "__import__",
                 "open(", "exec(", "eval(", "compile("]
    for kw in forbidden:
        if kw in code:
            return json.dumps({"error": f"代码包含不允许的操作: {kw}"})

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
        f.write(code)
        f.flush()
        tmp_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            "python3", tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            return json.dumps({"error": "执行超时（30秒）"})

        result = {
            "exit_code": proc.returncode,
            "stdout": stdout.decode("utf-8", errors="replace")[:5000],
        }
        err = stderr.decode("utf-8", errors="replace")
        if err.strip():
            result["stderr"] = err[:2000]
        return json.dumps(result, ensure_ascii=False)
    finally:
        import os as _os
        _os.unlink(tmp_path)


async def _builtin_save_memory(tool_args: dict) -> str:
    from app.database import async_session
    from app.models.models import AgentMemory

    key = tool_args.get("key", "")
    content = tool_args.get("content", "")
    category = tool_args.get("category", "fact")
    agent_id = tool_args.get("_agent_id", "")

    if not key or not content:
        return json.dumps({"error": "key 和 content 不能为空"})

    async with async_session() as db:
        from sqlalchemy import select as sa_select
        existing = await db.execute(
            sa_select(AgentMemory).where(
                AgentMemory.agent_id == agent_id,
                AgentMemory.key == key,
            )
        )
        mem = existing.scalar_one_or_none()
        if mem:
            mem.content = content
            mem.category = category
        else:
            mem = AgentMemory(
                agent_id=agent_id,
                key=key,
                content=content,
                category=category,
            )
            db.add(mem)
        await db.commit()

    return json.dumps({"saved": True, "key": key}, ensure_ascii=False)


async def _builtin_recall_memory(tool_args: dict) -> str:
    import re
    from app.database import async_session
    from app.models.models import AgentMemory
    from sqlalchemy import select as sa_select

    query = tool_args.get("query", "")
    limit = tool_args.get("limit", 10)
    agent_id = tool_args.get("_agent_id", "")

    async with async_session() as db:
        result = await db.execute(
            sa_select(AgentMemory).where(AgentMemory.agent_id == agent_id)
        )
        all_memories = result.scalars().all()

    if not all_memories:
        return json.dumps({"memories": [], "message": "暂无记忆"})

    query_lower = query.lower()
    query_words = set(re.findall(r'[a-zA-Z0-9]{2,}', query_lower))
    chinese_chars = re.findall(r'[\u4e00-\u9fff]', query_lower)
    for i in range(len(chinese_chars) - 1):
        query_words.add(chinese_chars[i] + chinese_chars[i + 1])

    scored = []
    for mem in all_memories:
        text = f"{mem.key} {mem.content}".lower()
        score = 0
        for w in query_words:
            if w in text:
                score += 1
        if mem.key.lower() in query_lower or query_lower in mem.key.lower():
            score += 10
        if score > 0:
            scored.append((score, mem))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:limit]

    memories = [
        {"key": m.key, "content": m.content, "category": m.category}
        for _, m in top
    ]

    return json.dumps({"memories": memories, "total": len(memories)}, ensure_ascii=False)


async def _call_llm(
    messages: list[dict],
    model: str,
    temperature: float,
    max_tokens: int,
    tools: list[dict] | None = None,
    stream: bool = False,
    timeout: int = 120,
) -> dict:
    import httpx

    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools:
        payload["tools"] = tools

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{GLM_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {GLM_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code != 200:
            return {"error": f"API error {resp.status_code}: {resp.text[:200]}"}
        return resp.json()


async def run_agent_with_tools(
    agent_id: str,
    prompt_or_messages: str | list[dict],
    agent_tools: list[str] | None = None,
    mcp_server_ids: list[str] | None = None,
    model_name: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    max_tool_rounds: int = 5,
):
    system_prompt = _get_system_prompt(agent_id)

    if isinstance(prompt_or_messages, str):
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt_or_messages},
        ]
    else:
        messages = [{"role": "system", "content": system_prompt}] + prompt_or_messages

    openai_tools, tool_meta = await _get_tools_for_agent(agent_tools, mcp_server_ids=mcp_server_ids)
    tools = openai_tools if openai_tools else None
    model = model_name or GLM_MODEL
    temp = temperature or 0.7
    tokens = max_tokens or 8192

    full_text = ""
    artifacts = []

    for round_num in range(max_tool_rounds + 1):
        result = await _call_llm(messages, model, temp, tokens, tools=tools, stream=False, timeout=120)

        if "error" in result:
            return {"success": False, "content": full_text, "error": result["error"], "artifacts": artifacts}

        message = result.get("choices", [{}])[0].get("message", {})
        content = message.get("content", "") or ""
        tool_calls = message.get("tool_calls", [])

        if content:
            full_text += content

        if not tool_calls:
            break

        messages.append(message)

        for tc in tool_calls:
            func = tc.get("function", {})
            tool_name = func.get("name", "")
            tool_args_str = func.get("arguments", "{}")

            try:
                tool_args = json.loads(tool_args_str) if isinstance(tool_args_str, str) else tool_args_str
            except json.JSONDecodeError:
                tool_args = {}

            logger.info(f"[runner] Tool call: {tool_name}({json.dumps(tool_args, ensure_ascii=False)[:100]})")

            tool_result = await _handle_tool_call(tool_name, tool_args, tool_meta, agent_id=agent_id)

            if tool_name == "save_artifact" and tool_args.get("content"):
                artifacts.append({
                    "title": tool_args.get("title", "未命名"),
                    "content": tool_args.get("content", ""),
                    "type": tool_args.get("artifact_type", "research_report"),
                })

            messages.append({
                "role": "tool",
                "tool_call_id": tc.get("id", ""),
                "content": tool_result,
            })

    return {"success": True, "content": full_text, "artifacts": artifacts}


async def run_agent_stream(
    agent_id: str,
    prompt_or_messages: str | list[dict],
    model_name: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    agent_tools: list[str] | None = None,
    mcp_server_ids: list[str] | None = None,
    timeout_seconds: int = 120,
):
    import httpx

    system_prompt = _get_system_prompt(agent_id)

    if isinstance(prompt_or_messages, str):
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt_or_messages},
        ]
    else:
        messages = [{"role": "system", "content": system_prompt}] + prompt_or_messages

    openai_tools, tool_meta = await _get_tools_for_agent(agent_tools, mcp_server_ids=mcp_server_ids)
    tools = openai_tools if openai_tools else None
    model = model_name or GLM_MODEL
    temp = temperature or 0.7
    tokens = max_tokens or 4096

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": temp,
        "max_tokens": tokens,
    }
    if tools:
        payload["tools"] = tools

    yield f"data: {json.dumps({'type': 'start', 'agent_id': agent_id})}\n\n"

    full_text = ""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{GLM_BASE_URL}/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {GLM_API_KEY}",
                    "Content-Type": "application/json",
                },
            ) as resp:
                if resp.status_code != 200:
                    error_body = await resp.aread()
                    yield f"data: {json.dumps({'type': 'error', 'message': f'API error {resp.status_code}: {error_body.decode()[:200]}'})}\n\n"
                    return

                tool_calls_buffer = {}
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        choice = chunk.get("choices", [{}])[0]
                        delta = choice.get("delta", {})

                        content = delta.get("content", "")
                        if content:
                            full_text += content
                            yield f"data: {json.dumps({'type': 'delta', 'content': content})}\n\n"

                        tc_deltas = delta.get("tool_calls", [])
                        for tc in tc_deltas:
                            idx = tc.get("index", 0)
                            if idx not in tool_calls_buffer:
                                tool_calls_buffer[idx] = {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
                            if tc.get("id"):
                                tool_calls_buffer[idx]["id"] = tc["id"]
                            if tc.get("function", {}).get("name"):
                                tool_calls_buffer[idx]["function"]["name"] += tc["function"]["name"]
                            if tc.get("function", {}).get("arguments"):
                                tool_calls_buffer[idx]["function"]["arguments"] += tc["function"]["arguments"]

                        finish_reason = choice.get("finish_reason")
                        if finish_reason == "tool_calls" and tool_calls_buffer:
                            all_tc_data = []
                            for idx in sorted(tool_calls_buffer.keys()):
                                tc_data = tool_calls_buffer[idx]
                                all_tc_data.append(tc_data)
                                func = tc_data["function"]
                                tool_name = func["name"]
                                try:
                                    tool_args = json.loads(func["arguments"])
                                except json.JSONDecodeError:
                                    tool_args = {}

                                yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'args': tool_args}, ensure_ascii=False)}\n\n"

                                tool_result = await _handle_tool_call(tool_name, tool_args, tool_meta, agent_id=agent_id)

                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc_data["id"],
                                    "content": tool_result,
                                })

                            messages.insert(
                                len(messages) - len(all_tc_data),
                                {"role": "assistant", "content": "", "tool_calls": all_tc_data},
                            )

                            yield f"data: {json.dumps({'type': 'tool_result', 'message': '工具已执行，继续生成...'}, ensure_ascii=False)}\n\n"

                            tool_calls_buffer = {}

                            sub_payload = {
                                "model": model,
                                "messages": messages,
                                "stream": True,
                                "temperature": temp,
                                "max_tokens": tokens,
                            }

                            async with client.stream(
                                "POST",
                                f"{GLM_BASE_URL}/chat/completions",
                                json=sub_payload,
                                headers={
                                    "Authorization": f"Bearer {GLM_API_KEY}",
                                    "Content-Type": "application/json",
                                },
                            ) as resp2:
                                if resp2.status_code != 200:
                                    break
                                async for line2 in resp2.aiter_lines():
                                    if not line2.startswith("data: "):
                                        continue
                                    d2 = line2[6:]
                                    if d2.strip() == "[DONE]":
                                        break
                                    try:
                                        c2 = json.loads(d2)
                                        delta2 = c2.get("choices", [{}])[0].get("delta", {})
                                        ct2 = delta2.get("content", "")
                                        if ct2:
                                            full_text += ct2
                                            yield f"data: {json.dumps({'type': 'delta', 'content': ct2})}\n\n"
                                    except json.JSONDecodeError:
                                        continue
                    except json.JSONDecodeError:
                        continue

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'done', 'full_text': full_text})}\n\n"


async def execute_pipeline_step(
    agent_id: str,
    agent_tools: list[str] | None = None,
    mcp_server_ids: list[str] | None = None,
    agent_model: str | None = None,
    agent_temperature: float | None = None,
    agent_max_tokens: int | None = None,
    prompt: str = "",
    timeout_seconds: int = 120,
):
    result = await run_agent_with_tools(
        agent_id=agent_id,
        prompt_or_messages=prompt,
        agent_tools=agent_tools,
        mcp_server_ids=mcp_server_ids,
        model_name=agent_model,
        temperature=agent_temperature,
        max_tokens=agent_max_tokens,
        max_tool_rounds=5,
    )
    return result


async def run_pipeline(run_id: str):
    from app.database import async_session
    from app.models.models import Run, RunStatus, Plan, PlanStep, StepStatus, Artifact, Agent

    async with async_session() as db:
        result = await db.execute(select(Run).where(Run.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            return

        run.status = RunStatus.RUNNING
        run.started_at = datetime.utcnow()
        await db.commit()

        plan_result = await db.execute(select(Plan).where(Plan.run_id == run_id))
        plan = plan_result.scalar_one_or_none()
        if not plan:
            run.status = RunStatus.FAILED
            run.error_message = "No plan found"
            run.ended_at = datetime.utcnow()
            await db.commit()
            return

        steps_result = await db.execute(
            select(PlanStep).where(PlanStep.plan_id == plan.id).order_by(PlanStep.step_order)
        )
        steps = steps_result.scalars().all()

        context = ""
        context_map: dict[str, str] = {}
        for step in steps:
            agent = await db.get(Agent, step.agent_id)

            if step.condition:
                try:
                    cond_result = _eval_condition(step.condition, context_map)
                    if not cond_result:
                        step.status = StepStatus.SKIPPED
                        step.ended_at = datetime.utcnow()
                        await db.commit()
                        continue
                except Exception:
                    pass

            step.status = StepStatus.RUNNING
            step.started_at = datetime.utcnow()
            await db.commit()

            prompt = ""
            if step.prompt_template:
                prompt = step.prompt_template
                for key, val in context_map.items():
                    prompt = prompt.replace(f"{{{{{key}}}}}", val)
                prompt = prompt.replace("{{context}}", context)
                prompt = prompt.replace("{{previous_output}}", context)
            else:
                prompt = step.description or step.title
                if context:
                    prompt = f"以下是前序步骤的产出:\n\n{context}\n\n---\n\n当前任务: {prompt}"

            result_data = await execute_pipeline_step(
                agent_id=step.agent_id,
                agent_tools=agent.tools if agent else None,
                mcp_server_ids=agent.mcp_server_ids if agent else None,
                agent_model=agent.model_name if agent else None,
                agent_temperature=agent.temperature if agent else None,
                agent_max_tokens=agent.max_tokens if agent else None,
                prompt=prompt,
                timeout_seconds=120,
            )

            if result_data.get("success"):
                step.status = StepStatus.SUCCEEDED
                step.ended_at = datetime.utcnow()

                main_content = result_data.get("content", "")
                saved_artifacts = result_data.get("artifacts", [])

                if saved_artifacts:
                    context = saved_artifacts[-1]["content"]
                    for art in saved_artifacts:
                        artifact = Artifact(
                            run_id=run_id,
                            plan_step_id=step.id,
                            type=art.get("type", "research_report"),
                            title=art["title"],
                            path_or_url="",
                            markdown_content=art["content"],
                        )
                        db.add(artifact)
                        await db.flush()
                        if not step.output_artifact_id:
                            step.output_artifact_id = artifact.id
                else:
                    context = main_content
                    artifact = Artifact(
                        run_id=run_id,
                        plan_step_id=step.id,
                        type="research_report",
                        title=step.title,
                        path_or_url="",
                        markdown_content=main_content,
                    )
                    db.add(artifact)
                    await db.flush()
                    step.output_artifact_id = artifact.id

                output_content = saved_artifacts[-1]["content"] if saved_artifacts else main_content
                if step.output_key:
                    context_map[step.output_key] = output_content
                context = output_content
            else:
                step.status = StepStatus.FAILED
                step.error_message = result_data.get("error", "Unknown error")
                step.ended_at = datetime.utcnow()
                run.status = RunStatus.FAILED
                run.error_message = f"Step {step.step_order} ({step.title}) failed: {step.error_message}"
                run.ended_at = datetime.utcnow()
                await db.commit()
                return

            await db.commit()

        run.status = RunStatus.SUCCEEDED
        run.ended_at = datetime.utcnow()
        plan.status = "succeeded"
        await db.commit()

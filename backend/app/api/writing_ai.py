import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import WritingProject, WritingDraft

logger = logging.getLogger(__name__)
router = APIRouter()

GLM_BASE = getattr(settings, "glm_api_key", None) and "https://open.bigmodel.cn/api/coding/paas/v4" or ""
GLM_KEY = getattr(settings, "glm_api_key", "")
GLM_MODEL = "glm-5.1"


async def _glm_single_turn(system: str, user: str, max_tokens: int = 4096) -> str:
    async with httpx.AsyncClient(timeout=120) as hc:
        resp = await hc.post(
            f"{GLM_BASE}/chat/completions",
            json={
                "model": GLM_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.7,
                "max_tokens": max_tokens,
            },
            headers={
                "Authorization": f"Bearer {GLM_KEY}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"GLM API error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def _build_materials_block(materials: list) -> str:
    if not materials:
        return "（暂无已采集素材）"
    parts = []
    for m in materials[:15]:
        src = m.source_type
        title = m.title
        snippet = (m.snippet or "")[:300]
        parts.append(f"[{src}] {title}\n{snippet}")
    return "\n\n".join(parts)


class SkeletonRequest(BaseModel):
    style: str | None = None


@router.post("/writing/projects/{project_id}/ai/skeleton")
async def ai_skeleton(
    project_id: str,
    body: SkeletonRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")

    materials = _load_materials(p)
    style_note = ""
    if body and body.style:
        style_note = f"\n文章风格倾向: {body.style}"

    system = (
        "你是一位资深的文科写作导师。根据用户给出的选题方向和已有素材，"
        "生成一个结构化的论点骨架。输出 Markdown 格式，包含：\n"
        "1. 核心论点（一句话）\n"
        "2. 分论点（3-5 个，每个配一段论证思路）\n"
        "3. 建议的素材引用点\n"
        "4. 潜在的逻辑陷阱提醒"
    )
    user_msg = (
        f"标题: {p.title}\n"
        f"选题方向: {p.topic or '(未填)'}\n"
        f"已有提纲: {p.outline or '(未填)'}\n"
        f"{style_note}\n\n"
        f"已采集素材:\n{_build_materials_block(materials)}"
    )

    result = await _glm_single_turn(system, user_msg)
    return {"skeleton": result}


@router.post("/writing/projects/{project_id}/ai/counter-arguments")
async def ai_counter_arguments(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")

    outline = p.outline or ""
    if not outline:
        raise HTTPException(400, "请先撰写提纲再生成反方观点")

    system = (
        "你是一位批判性思维专家。根据用户的文章提纲，生成针对性的反方观点和反驳建议。"
        "输出 Markdown 格式，包含：\n"
        "1. 对每个主要论点的可能反对意见（2-3 个）\n"
        "2. 反驳策略和建议\n"
        "3. 需要加强论证的薄弱环节\n"
        "4. 可能的逻辑谬误预警"
    )
    user_msg = f"标题: {p.title}\n选题: {p.topic or '(未填)'}\n\n文章提纲:\n{outline}"

    result = await _glm_single_turn(system, user_msg)
    return {"counter_arguments": result}


class DraftGenRequest(BaseModel):
    label: str | None = None
    focus: str | None = None


@router.post("/writing/projects/{project_id}/ai/generate-draft")
async def ai_generate_draft(
    project_id: str,
    body: DraftGenRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")

    if not p.outline:
        raise HTTPException(400, "请先撰写提纲再生成草稿")

    materials = _load_materials(p)
    focus_note = ""
    if body and body.focus:
        focus_note = f"\n特别关注: {body.focus}"

    system = (
        "你是一位专业的中文写作助手。根据提纲和素材，撰写完整的文章草稿。"
        "要求：\n"
        "- 使用 Markdown 格式\n"
        "- 逻辑清晰，论据充分\n"
        "- 适当引用素材中的信息\n"
        "- 控制在 2000-4000 字\n"
        "- 语言风格: 学术但不晦涩，适合受过高等教育的读者"
    )
    user_msg = (
        f"标题: {p.title}\n"
        f"选题: {p.topic or '(未填)'}\n"
        f"{focus_note}\n\n"
        f"提纲:\n{p.outline}\n\n"
        f"参考素材:\n{_build_materials_block(materials)}"
    )

    result = await _glm_single_turn(system, user_msg, max_tokens=8192)

    label = (body.label if body else None) or "AI 生成草稿"
    from sqlalchemy import func
    max_ver = await db.scalar(
        select(func.max(WritingDraft.version)).where(WritingDraft.project_id == project_id)
    )
    next_ver = (max_ver or 0) + 1
    draft = WritingDraft(
        project_id=project_id,
        version=next_ver,
        content=result,
        label=label,
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return {"draft_id": draft.id, "version": next_ver, "label": label, "content": result}


class CheckRequest(BaseModel):
    check_type: str = Field(default="all", description="fact | logic | style | all")
    draft_content: str | None = None


@router.post("/writing/projects/{project_id}/ai/check")
async def ai_check(
    project_id: str,
    body: CheckRequest,
    db: AsyncSession = Depends(get_db),
):
    p = await db.get(WritingProject, project_id)
    if not p:
        raise HTTPException(404, "项目不存在")

    content = body.draft_content
    if not content:
        result = await db.execute(
            select(WritingDraft)
            .where(WritingDraft.project_id == project_id)
            .order_by(WritingDraft.version.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()
        if not latest:
            raise HTTPException(400, "没有可检查的草稿")
        content = latest.content

    checks = []
    ct = body.check_type
    if ct in ("fact", "all"):
        checks.append("fact")
    if ct in ("logic", "all"):
        checks.append("logic")
    if ct in ("style", "all"):
        checks.append("style")

    if not checks:
        checks = ["fact", "logic", "style"]

    PROMPTS = {
        "fact": (
            "你是事实核查专家。检查文章中的事实性声明，标注：\n"
            "1. 可能有误的事实陈述（列出原文和疑点）\n"
            "2. 缺少来源支撑的数据或引用\n"
            "3. 可能过时的信息\n"
            "4. 核查建议（如何验证每个疑点）"
        ),
        "logic": (
            "你是逻辑分析专家。检查文章的逻辑结构，标注：\n"
            "1. 逻辑跳跃或推论不充分的地方\n"
            "2. 可能的因果倒置或混淆\n"
            "3. 以偏概全或过度概括\n"
            "4. 论证链断裂的位置\n"
            "5. 加强建议"
        ),
        "style": (
            "你是文本风格审查专家。检查文章的写作质量，标注：\n"
            "1. 冗余或啰嗦的段落\n"
            "2. 用词不当或可优化的表达\n"
            "3. 段落衔接和过渡问题\n"
            "4. 节奏和可读性建议\n"
            "5. 修改示例"
        ),
    }

    results = {}
    for check_name in checks:
        system = PROMPTS[check_name]
        user_msg = (
            f"标题: {p.title}\n选题: {p.topic or '(未填)'}\n\n"
            f"文章内容:\n{content[:8000]}"
        )
        try:
            results[check_name] = await _glm_single_turn(system, user_msg)
        except Exception as e:
            results[check_name] = f"检查失败: {str(e)}"

    return {"checks": results}


def _load_materials(p):
    return getattr(p, "materials", []) or []

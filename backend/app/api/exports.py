from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Artifact, Page, Space

router = APIRouter()


@router.get("/news")
async def export_news(
    date: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Artifact).where(Artifact.type == "news").order_by(Artifact.created_at.desc())
    if date:
        q = q.where(Artifact.created_at >= f"{date}T00:00:00").where(
            Artifact.created_at < f"{date}T23:59:59"
        )
    result = await db.execute(q.limit(10))
    artifacts = result.scalars().all()

    if not artifacts:
        raise HTTPException(status_code=404, detail="没有找到新闻数据")

    lines = [f"# 新闻整理 {date or '最新'}\n"]
    for a in artifacts:
        lines.append(f"## {a.title}\n")
        lines.append(f"- 时间: {a.created_at.strftime('%Y-%m-%d %H:%M')}\n")
        if a.markdown_content:
            for line in a.markdown_content.split("\n"):
                if not line.startswith("#"):
                    lines.append(f"{line}\n")
        lines.append("\n")

    filename = f"news_{date or 'latest'}.md"
    return PlainTextResponse(
        content="".join(lines),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/zip")
async def export_zip(
    scope: str = "all",
    db: AsyncSession = Depends(get_db),
):
    import io
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if scope in ("all", "wiki"):
            spaces_result = await db.execute(select(Space))
            spaces = spaces_result.scalars().all()
            for space in spaces:
                pages_result = await db.execute(
                    select(Page).where(Page.space_id == space.id)
                )
                pages = pages_result.scalars().all()
                for page in pages:
                    content = f"# {page.title}\n\n{page.content or ''}"
                    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in page.title)
                    zf.writestr(f"wiki/{space.name}/{safe_name}.md", content)

        if scope in ("all", "artifacts"):
            arts_result = await db.execute(
                select(Artifact).order_by(Artifact.created_at.desc())
            )
            artifacts = arts_result.scalars().all()
            for a in artifacts:
                content = a.markdown_content or f"# {a.title}\n\n(无内容)"
                safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in a.title)
                zf.writestr(f"artifacts/{a.type}/{safe_name}.md", content)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=pi-console-export.zip"},
    )

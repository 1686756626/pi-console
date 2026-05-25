from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import NewsItem
from app.schemas import NewsItemResponse, NewsItemCreate, NewsItemUpdate

router = APIRouter()


@router.get("/news", response_model=list[NewsItemResponse])
async def list_news(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NewsItem).order_by(NewsItem.created_at.desc()).limit(100))
    return result.scalars().all()


@router.get("/news/{news_id}", response_model=NewsItemResponse)
async def get_news(news_id: str, db: AsyncSession = Depends(get_db)):
    news = await db.get(NewsItem, news_id)
    if not news:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="新闻不存在")
    return news


@router.patch("/news/{news_id}", response_model=NewsItemResponse)
async def update_news(news_id: str, body: NewsItemUpdate, db: AsyncSession = Depends(get_db)):
    news = await db.get(NewsItem, news_id)
    if not news:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="新闻不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(news, k, v)
    await db.commit()
    await db.refresh(news)
    return news


@router.post("/news", response_model=list[NewsItemResponse], status_code=201)
async def create_news_items(items: list[NewsItemCreate], db: AsyncSession = Depends(get_db)):
    created = []
    for item in items:
        news = NewsItem(**item.model_dump())
        db.add(news)
        created.append(news)
    await db.commit()
    for n in created:
        await db.refresh(n)
    return created


@router.post("/news/refresh")
async def refresh_news():
    return {"message": "News refresh triggered. Worker will pick up the task."}

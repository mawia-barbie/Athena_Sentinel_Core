from fastapi import APIRouter, Depends, Query, HTTPException, Request
from typing import Optional
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.threat_service import get_feed, search_threats, list_threats, create_threat
import logging

router = APIRouter()
logger = logging.getLogger("app.api.routes.threats")

@router.get('/feed')
async def api_feed(limit: int = Query(50, ge=1, le=500), since: Optional[int] = None, db: AsyncSession = Depends(get_db), request: Request = None):
    logger.info("GET /api/threats/feed from=%s limit=%s", request.client.host if request and request.client else 'unknown', limit)
    items = await get_feed(db, limit=limit, since=since)
    return [ {"id": i.id, "title": i.title, "description": i.description, "type": i.type, "severity": i.severity, "source": i.source, "tags": i.tags, "timestamp": int(i.created_at.timestamp()*1000) } for i in items ]

# register the list endpoint for both the prefix without a trailing slash and with one
@router.get('', include_in_schema=False)
@router.get('/')
async def api_list(type: Optional[str] = None, limit: int = Query(50, ge=1, le=500), offset: int = 0, db: AsyncSession = Depends(get_db), request: Request = None):
    logger.info("GET /api/threats list type=%s limit=%s offset=%s", type, limit, offset)
    items = await list_threats(db, type_=type, limit=limit, offset=offset)
    return {"items": [ {"id": i.id, "title": i.title, "description": i.description, "type": i.type, "severity": i.severity, "source": i.source, "tags": i.tags, "timestamp": int(i.created_at.timestamp()*1000) } for i in items ], "total": len(items)}

@router.get('/search')
async def api_search(q: str, limit: int = Query(50, ge=1, le=500), offset: int = 0, db: AsyncSession = Depends(get_db), request: Request = None):
    logger.info("GET /api/threats/search q=%s limit=%s", q, limit)
    items = await search_threats(db, q, limit=limit, offset=offset)
    return {"items": [ {"id": i.id, "title": i.title, "description": i.description, "type": i.type, "severity": i.severity, "source": i.source, "tags": i.tags, "timestamp": int(i.created_at.timestamp()*1000) } for i in items ], "total": len(items)}

@router.post('/')
async def api_create(payload: dict, db: AsyncSession = Depends(get_db), request: Request = None):
    logger.info("POST /api/threats create payload_keys=%s", list(payload.keys()))
    title = payload.get('title')
    if not title:
        raise HTTPException(status_code=422, detail='title required')
    t = await create_threat(db, title=title, description=payload.get('description',''), type_=payload.get('type','Unknown'), severity=payload.get('severity','Low'), source=payload.get('source'), tags=payload.get('tags', []))
    return {"id": t.id}

@router.post('/scrape')
async def trigger_scrape(db: AsyncSession = Depends(get_db)):
    """Manually trigger a scrape run and return created items."""
    logger.info("POST /api/threats/scrape triggered")
    from app.services.scraper import scrape_once
    created = await scrape_once()
    return {"created": created}

@router.get('/latest')
async def api_latest(limit: int = Query(20, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    """Return latest threats ordered by created_at DESC"""
    items = await list_threats(db, limit=limit, offset=0)
    return [ { 'id': i.id, 'title': i.title, 'severity': i.severity, 'source': i.source, 'created_at': i.created_at.isoformat() if getattr(i, 'created_at', None) else None, 'tags': i.tags, 'url': i.url } for i in items ]

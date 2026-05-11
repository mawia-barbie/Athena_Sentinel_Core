import logging
from typing import List, Optional
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.threat import Threat

logger = logging.getLogger("app.services.threat_service")

async def create_threat(db: AsyncSession, title: str, description: str, type_: str, severity: str, source: str = None, tags: Optional[list] = None, external_id: Optional[str] = None, source_url: Optional[str] = None):
    logger.info("Creating threat title=%s type=%s severity=%s external_id=%s", title, type_, severity, external_id)
    t = Threat(title=title, description=description, type=type_, severity=severity, source=source, url=source_url, external_id=external_id, tags=tags or [])
    db.add(t)
    await db.commit()
    await db.refresh(t)
    logger.info("Created threat id=%s", t.id)
    # structured new threat logging
    try:
        now = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
        logger.info("NEW THREAT ADDED | source=%s | severity=%s | title=%s | time=%s", source or 'unknown', severity, title, now)
    except Exception:
        pass
    # broadcast to websocket clients via lazy import to avoid circular imports
    try:
        import importlib
        live_feed = importlib.import_module('app.api.routes.live_feed')
        broadcast = getattr(live_feed, 'broadcast_threat_event', None)
        if broadcast:
            await broadcast({"id": t.id, "title": t.title, "type": t.type, "severity": t.severity, "source": t.source, "tags": t.tags, "timestamp": int(t.created_at.timestamp()*1000)})
    except Exception as e:
        logger.warning("Failed to broadcast threat event (lazy import): %s", e)
    return t

async def get_feed(db: AsyncSession, limit: int = 50, since: Optional[int] = None):
    q = select(Threat).order_by(Threat.created_at.desc()).limit(limit)
    if since:
        # since is expected as epoch milliseconds
        from datetime import datetime, timezone
        dt = datetime.fromtimestamp(since/1000.0, tz=timezone.utc)
        q = select(Threat).where(Threat.created_at > dt).order_by(Threat.created_at.desc()).limit(limit)
    res = await db.execute(q)
    items = res.scalars().all()
    logger.info("get_feed returned %s items", len(items))
    return items

async def search_threats(db: AsyncSession, qstr: str, limit: int = 50, offset: int = 0):
    q = select(Threat).where(Threat.title.ilike(f"%{qstr}%") | Threat.description.ilike(f"%{qstr}%")).order_by(desc(Threat.created_at)).limit(limit).offset(offset)
    res = await db.execute(q)
    items = res.scalars().all()
    logger.info("search_threats q=%s returned %s items", qstr, len(items))
    return items

async def list_threats(db: AsyncSession, type_: Optional[str] = None, limit: int = 50, offset: int = 0):
    q = select(Threat)
    if type_:
        q = q.where(Threat.type == type_)
    q = q.order_by(Threat.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(q)
    items = res.scalars().all()
    logger.info("list_threats type=%s returned %s items", type_, len(items))
    return items

async def metrics(db: AsyncSession):
    # total threats
    total_q = await db.execute(select(func.count(Threat.id)))
    total = total_q.scalar_one()
    # most common type
    type_q = await db.execute(select(Threat.type, func.count(Threat.id)).group_by(Threat.type).order_by(desc(func.count(Threat.id))).limit(1))
    most = type_q.first()
    most_type = most[0] if most else None
    # recent alerts (within 1 hour, severity High)
    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_q = await db.execute(select(func.count(Threat.id)).where(Threat.created_at >= cutoff).where(Threat.severity == 'High'))
    recent = recent_q.scalar_one()
    # freshness metrics
    last_q = await db.execute(select(Threat.created_at).order_by(Threat.created_at.desc()).limit(1))
    last = last_q.scalar_one_or_none()
    last_iso = last.isoformat() if last else None
    # counts
    hour_cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    day_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    q_hour = await db.execute(select(func.count(Threat.id)).where(Threat.created_at >= hour_cutoff))
    threats_last_hour = q_hour.scalar_one()
    q_day = await db.execute(select(func.count(Threat.id)).where(Threat.created_at >= day_cutoff))
    threats_last_24h = q_day.scalar_one()
    # scraper status (healthy/stale)
    stale_threshold = timedelta(minutes=30)
    if last and (datetime.now(timezone.utc) - last) > stale_threshold:
        scraper_status = 'stale'
    else:
        scraper_status = 'healthy'
    logger.info("metrics total=%s most=%s recentHigh=%s last_ingested=%s threats_last_hour=%s threats_last_24h=%s status=%s", total, most_type, recent, last_iso, threats_last_hour, threats_last_24h, scraper_status)
    return {"total": total, "mostCommon": most_type or 'N/A', "recentAlerts": recent, "last_ingested_at": last_iso, "threats_last_hour": threats_last_hour, "threats_last_24h": threats_last_24h, "scraper_status": scraper_status}

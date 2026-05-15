from fastapi import APIRouter, Depends, Query
from datetime import datetime
from typing import Optional
from app.services.threat_service import type_distribution, list_threats, vulnerability_distribution
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get('/type-distribution')
async def type_dist(days: int = Query(7, ge=1, le=365), db: AsyncSession = Depends(get_db)):
    """Return counts per threat type for the last `days` days."""
    dist = await type_distribution(db, days=days)
    return { 'since': datetime.utcnow().isoformat(), 'days': days, 'counts': dist }


@router.get('/timeline')
async def timeline(limit: int = Query(50, ge=1, le=500), db: AsyncSession = Depends(get_db)):
    """Return recent threats (for timeline view)."""
    items = await list_threats(db, limit=limit, offset=0)
    now = int(datetime.utcnow().timestamp() * 1000)
    return [ { 'id': i.id, 'title': i.title, 'source': i.source, 'severity': i.severity, 'timestamp': int(i.created_at.timestamp()*1000), 'url': i.url } for i in items ]


@router.get('/vulnerabilities')
async def recent_vulnerabilities(limit: int = Query(20, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    """Return recent threats classified as Vulnerability with external_id (CVE) and url for specificity."""
    items = await list_threats(db, type_='Vulnerability', limit=limit, offset=0)
    return [ { 'id': i.id, 'external_id': i.external_id, 'title': i.title, 'created_at': i.created_at.isoformat() if getattr(i, 'created_at', None) else None, 'url': i.url, 'severity': i.severity } for i in items ]


@router.get('/vulnerability-distribution')
async def vuln_dist(days: int = Query(7, ge=1, le=365), limit: int = Query(20, ge=1, le=200), db: AsyncSession = Depends(get_db)):
    dist = await vulnerability_distribution(db, days=days, limit=limit)
    return { 'since': datetime.utcnow().isoformat(), 'days': days, 'items': dist }

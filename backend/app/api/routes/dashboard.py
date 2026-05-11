from fastapi import APIRouter, Query, Depends
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.threat_service import metrics as threat_metrics
import logging

router = APIRouter()
logger = logging.getLogger("app.api.routes.dashboard")

@router.get('/stats')
async def get_stats():
    # Example aggregate stats - replace with DB queries later
    return {"total": 123, "mostCommon": "Ransomware", "recentAlerts": 5}

@router.get('/threats')
async def list_threats(limit: int = Query(50, ge=1, le=500), tag: Optional[str] = None):
    # Return mock threat entries
    now = int(datetime.utcnow().timestamp() * 1000)
    sample = [
        {"id": 1, "title": "CVE-2024-1234: Example vuln", "description": "Sample vulnerability discovered in package foo", "source": "CVE", "severity": "High", "tags": ["CVE"], "timestamp": now - 1000 * 60 * 5},
        {"id": 2, "title": "Phishing campaign targeting banks", "description": "Mass phishing emails using domain xyz", "source": "Security Blog", "severity": "Medium", "tags": ["Phishing"], "timestamp": now - 1000 * 60 * 30},
        {"id": 3, "title": "New ransomware strain", "description": "Ransomware X deploys novel loader", "source": "ThreatFeed", "severity": "High", "tags": ["Ransomware", "Malware"], "timestamp": now - 1000 * 60 * 60},
    ]
    if tag:
        filtered = [t for t in sample if tag in t.get('tags', [])]
    else:
        filtered = sample
    return filtered[:limit]

@router.get('/metrics')
async def get_metrics(db: AsyncSession = Depends(get_db)):
    """Return real dashboard metrics from threats service."""
    try:
        m = await threat_metrics(db)
        logger.info("GET /api/dashboard/metrics returned %s", m)
        return m
    except Exception as e:
        logger.exception("Failed to get metrics: %s", e)
        return {"total": 0, "mostCommon": 'N/A', "recentAlerts": 0}

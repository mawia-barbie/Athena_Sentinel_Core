from fastapi import APIRouter, HTTPException
from typing import List

router = APIRouter()

@router.get("/", tags=["alerts"])
async def list_alerts():
    """Return a minimal list of alerts (mocked) so the router can be included during startup."""
    return {"alerts": []}

@router.get("/{alert_id}", tags=["alerts"])
async def get_alert(alert_id: int):
    """Return a single mock alert by id."""
    # In the real implementation this would query the DB
    if alert_id <= 0:
        raise HTTPException(status_code=400, detail="invalid alert id")
    return {"alert_id": alert_id, "status": "mock", "severity": "low"}

@router.post("/", tags=["alerts"])
async def create_alert(payload: dict):
    """Create a mock alert. Replace with DB-backed creation later."""
    # validate minimal shape
    title = payload.get("title") if isinstance(payload, dict) else None
    if not title:
        raise HTTPException(status_code=422, detail="title is required")
    return {"alert_id": 1, "title": title, "status": "created"}

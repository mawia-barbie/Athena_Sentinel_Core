from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get('/overview')
async def overview():
    # Mock distribution data
    return {
        'distribution': {
            'Ransomware': 40,
            'Exploit': 35,
            'Phishing': 25
        }
    }

@router.get('/timeline')
async def timeline():
    now = int(datetime.utcnow().timestamp() * 1000)
    return [
        {'id': 1, 'title': 'CVE-2024-1234', 'source': 'CVE', 'severity': 'High', 'timestamp': now - 1000*60*60},
        {'id': 2, 'title': 'Ransomware campaign', 'source': 'ThreatFeed', 'severity': 'High', 'timestamp': now - 1000*60*30},
        {'id': 3, 'title': 'Phishing spike', 'source': 'Blog', 'severity': 'Medium', 'timestamp': now - 1000*60*10},
    ]

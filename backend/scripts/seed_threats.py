"""Seed script to populate the threats table with sample data."""
import asyncio
from app.core.database import AsyncSessionLocal, engine
from app.models.threat import Threat

SAMPLES = [
    ("CVE-2024-1234: Example vuln", "Sample vulnerability discovered in package foo", "CVE", "High", "CVE"),
    ("Phishing campaign targeting banks", "Mass phishing emails using domain xyz", "Phishing", "Medium", "Security Blog"),
    ("New ransomware strain", "Ransomware X deploys novel loader", "Ransomware", "High", "ThreatFeed"),
]

async def seed():
    async with AsyncSessionLocal() as session:
        for title, desc, type_, sev, src in SAMPLES:
            t = Threat(title=title, description=desc, type=type_, severity=sev, source=src, tags=[type_])
            session.add(t)
        await session.commit()
        print('seeded')

if __name__ == '__main__':
    asyncio.run(seed())

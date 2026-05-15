"""Backfill threat types using scraper inference logic.
Run from project root (backend):
  python scripts/backfill_types.py
This script updates Threat.type for existing rows that are currently 'News', 'CVE', 'Unknown' or NULL.
"""
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.threat import Threat

async def main():
    from app.services.scraper import infer_type_from_text
    updated = 0
    total = 0
    print('Starting backfill_types...')
    async with AsyncSessionLocal() as db:
        q = select(Threat).where(Threat.type.in_(['News', 'CVE', 'Unknown']))
        res = await db.execute(q)
        rows = res.scalars().all()
        total = len(rows)
        print(f'Found {total} candidate rows to re-evaluate')
        for t in rows:
            try:
                text = (t.title or '') + '\n' + (t.description or '')
                tags = t.tags or []
                new_type = infer_type_from_text(text, tags)
                if new_type != t.type:
                    print(f'Updating id={t.id} from {t.type} -> {new_type}')
                    t.type = new_type
                    await db.commit()
                    updated += 1
            except Exception as e:
                print('Failed to process', t.id, e)
                try:
                    await db.rollback()
                except Exception:
                    pass
    print(f'Done. Total examined: {total}. Updated: {updated}')

if __name__ == '__main__':
    asyncio.run(main())

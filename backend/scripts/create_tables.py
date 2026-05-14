# This script ensures database tables exist (dev helper).
# Run in the project's root with the backend venv active:
# python backend/scripts/create_tables.py

import asyncio
import logging
from sqlalchemy import text
from app.core.database import engine, Base

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('create_tables')

async def main():
    try:
        async with engine.begin() as conn:
            logger.info('Connected to DB, creating all tables from models (if missing)')
            await conn.run_sync(Base.metadata.create_all)

            # list tables to confirm
            q = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
            tables = [r[0] for r in q.fetchall()]
            logger.info('Public tables: %s', tables)

            if 'threats' in tables:
                logger.info('Table "threats" exists')
            else:
                logger.warning('Table "threats" NOT found after create_all')

    except Exception as e:
        logger.exception('Error ensuring tables: %s', e)

if __name__ == '__main__':
    asyncio.run(main())

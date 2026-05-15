from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from app.core.database import engine, Base
import logging
import time
from http import HTTPStatus
import asyncio
from app.services.scraper import scraper_loop


# basic logging for the app
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
)
# ensure uvicorn access/error loggers are visible at INFO level
logging.getLogger('uvicorn.access').setLevel(logging.INFO)
logging.getLogger('uvicorn.error').setLevel(logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.APP_NAME)

# CORS - register immediately after app creation so preflight/OPTIONS are handled by CORSMiddleware
_allowed_origins = [str(o) for o in settings.CORS_ORIGINS]
# include 127.0.0.1 variants commonly used during dev
for host in ("127.0.0.1", "0.0.0.0"):
    for port in (5173, 3000):
        origin = f"http://{host}:{port}"
        if origin not in _allowed_origins:
            _allowed_origins.append(origin)

# Use a permissive, dev-safe regex to match localhost/127.0.0.1 on any port so the middleware reliably echoes the Origin header during development.
_allow_origin_regex = r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("CORS configured: allow_origins=%s allow_origin_regex=%s", _allowed_origins, _allow_origin_regex)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    client = request.client.host if request.client else 'unknown'
    try:
        response = await call_next(request)
    except Exception as exc:
        process_time = time.time() - start_time
        logger.exception("%s %s %s error (%.3fs): %s", request.method, request.url.path, client, process_time, exc)
        raise
    process_time = time.time() - start_time
    status = response.status_code
    try:
        reason = HTTPStatus(status).phrase
    except Exception:
        reason = ''
    logger.info("%s %s %s %s %s %.3fs", request.method, request.url.path, status, reason, client, process_time)
    return response

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Include routers
import app.api.routes.auth as auth
import app.api.routes.dashboard as dashboard
import app.api.routes.live_feed as live_feed
import app.api.routes.alerts as alerts
import app.api.routes.analytics as analytics
import app.api.routes.ai as ai

from app.api.routes import threats_router



app.include_router(auth.router, prefix='/api/auth')
app.include_router(dashboard.router, prefix='/api/dashboard')
app.include_router(live_feed.router, prefix='/api/live')
app.include_router(alerts.router, prefix='/api/alerts')
app.include_router(analytics.router, prefix='/api/analytics')
app.include_router(ai.router, prefix='/api/ai')
app.include_router(threats_router, prefix='/api/threats')


print("THREATS ROUTER REGISTERED")


# include threats router (explicit include requested)
# try:
#     import app.api.routes.threats as threats
#     if getattr(threats, 'router', None):
#         app.include_router(threats.router, prefix='/api/threats')
#         logger.info('Included /api/threats routes')
#     else:
#         logger.warning('Imported threats module but no router attribute found')
# except Exception as e:
#     logger.exception('Failed to include threats router: %s', e)
#     # Attempt fallback: check package-level import which may expose 'threats' attribute
#     try:
#         import app.api.routes as routes_pkg
#         t = getattr(routes_pkg, 'threats', None)
#         if t and getattr(t, 'router', None):
#             app.include_router(t.router, prefix='/api/threats')
#             logger.info('Included /api/threats routes via package fallback')
#         else:
#             logger.warning('Fallback: threats router still not available on app.api.routes')
#     except Exception as e2:
#         logger.exception('Fallback include failed: %s', e2)

@app.on_event('startup')
async def startup():
    # create tables (synchronously for initial scaffolding)
    created_ok = False
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        created_ok = True
        logger.info("Database tables ensured (create_all succeeded)")
    except Exception as e:
        # log the error and do NOT continue to start the scraper — require developer to fix DB/migrations
        logger.exception("Could not create database tables on startup; skipping scraper startup and schema patches: %s", e)

    # -- ensure dev-time compatibility: add recently-introduced columns if they don't exist
    if created_ok:
        try:
            from sqlalchemy import text
            async with engine.begin() as conn:
                for col, ddl in [
                    ("external_id", "ALTER TABLE threats ADD COLUMN external_id VARCHAR;"),
                    ("url", "ALTER TABLE threats ADD COLUMN url VARCHAR;"),
                    ("tags", "ALTER TABLE threats ADD COLUMN tags JSONB;")
                ]:
                    try:
                        q = await conn.execute(text(
                            "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='threats' AND column_name = :col)"
                        ), {"col": col})
                        exists = q.scalar()
                        if not exists:
                            logger.info('Adding missing column %s to threats table', col)
                            await conn.execute(text(ddl))
                    except Exception as inner:
                        logger.debug('Error checking/adding column %s: %s', col, inner)
        except Exception as e:
            logger.debug('Schema compatibility check skipped: %s', e)
    else:
        logger.warning('Skipping schema compatibility checks because DB initialization failed')

    # start scraper background task only if DB tables were ensured
    if created_ok:
        try:
            app.state.scraper_task = asyncio.create_task(scraper_loop(interval=60))
        except Exception as e:
            logger.warning('Could not start scraper loop: %s', e)
    else:
        logger.warning('Scraper loop not started because DB initialization failed. Run migrations or ensure DB is reachable.')

    # Log registered routes for debugging
    try:
        from fastapi.routing import APIRoute
        logger.info("Registered routes:")
        for route in app.router.routes:
            try:
                methods = getattr(route, 'methods', None)
                path = getattr(route, 'path', None) or getattr(route, 'url', None)
                name = getattr(route, 'name', None)
                if methods:
                    logger.info("  %s %s -> %s", ','.join(sorted(methods)), path, name)
                else:
                    # websocket or other
                    logger.info("  %s -> %s", type(route).__name__, path)
            except Exception:
                logger.exception('Error inspecting route')
    except Exception as e:
        logger.warning('Failed to list routes: %s', e)

@app.on_event('shutdown')
async def shutdown():
    # cancel background scraper task if running
    task = getattr(app.state, 'scraper_task', None)
    if task:
        task.cancel()
        try:
            await task
        except Exception:
            pass

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.get('/api/_routes')
async def debug_routes():
    """Return a list of registered routes for debugging (methods and paths)."""
    out = []
    for route in app.router.routes:
        methods = getattr(route, 'methods', None)
        path = getattr(route, 'path', None) or getattr(route, 'path_regex', None) or getattr(route, 'url', None)
        name = getattr(route, 'name', None)
        if methods:
            out.append({ 'methods': sorted(list(methods)), 'path': path, 'name': name })
        else:
            out.append({ 'type': type(route).__name__, 'path': path })
    return out

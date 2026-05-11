from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from app.core.database import get_db
from app.schemas.user import UserCreate, UserLogin, UserRead
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging

router = APIRouter()

logger = logging.getLogger("app.api.routes.auth")

@router.post('/register', status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    logger.info("POST /api/auth/register username=%s", payload.username)
    # password policy enforced by pydantic constr + additional checks if needed
    user = User(username=payload.username, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        logger.warning("Register failed - username exists: %s", payload.username)
        raise HTTPException(status_code=400, detail='Username already exists')
    logger.info("User registered id=%s username=%s", user.id, user.username)
    return {'id': user.id, 'username': user.username}

@router.post('/login')
async def login(payload: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    logger.info("POST /api/auth/login username=%s", payload.username)
    q = await db.execute(select(User).where(User.username == payload.username))
    user = q.scalars().first()
    if not user or not verify_password(payload.password, user.password_hash):
        logger.warning("Login failed for username=%s", payload.username)
        raise HTTPException(status_code=400, detail='Invalid credentials')
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    response.set_cookie('refresh_token', refresh, httponly=True, samesite='lax')
    logger.info("User logged in id=%s username=%s", user.id, user.username)
    return {'access_token': access, 'token_type': 'bearer'}

@router.post('/refresh')
async def refresh(response: Response, refresh_token: Optional[str] = Cookie(None)):
    logger.info("POST /api/auth/refresh cookie_present=%s", bool(refresh_token))
    if not refresh_token:
        raise HTTPException(status_code=401, detail='Missing refresh token')
    payload = decode_token(refresh_token)
    if not payload:
        logger.warning("Refresh token invalid")
        raise HTTPException(status_code=401, detail='Invalid token')
    sub = payload.get('sub')
    access = create_access_token(str(sub))
    logger.info("Refresh issued for sub=%s", sub)
    return {'access_token': access, 'token_type': 'bearer'}

@router.post('/logout')
async def logout(response: Response):
    logger.info("POST /api/auth/logout")
    response.delete_cookie('refresh_token')
    return {'msg': 'ok'}

@router.get('/me')
async def me(token: Optional[str] = None):
    logger.info("GET /api/auth/me token_present=%s", bool(token))
    # In a production app you'd use dependency to extract token from Authorization header
    if not token:
        raise HTTPException(status_code=401, detail='Unauthorized')
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail='Invalid token')
    return {'sub': payload.get('sub')}

"""Schemas package for app — expose schema classes for convenient imports.

Adding this file makes `app.schemas` a proper Python package so imports like
`from app.schemas.user import UserCreate` and `from app.schemas import UserCreate` work.
"""

from .user import UserCreate, UserLogin, UserRead

__all__ = ["UserCreate", "UserLogin", "UserRead"]

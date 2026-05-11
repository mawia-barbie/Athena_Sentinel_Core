from pydantic import BaseModel, constr
from typing import Optional

class UserCreate(BaseModel):
    username: constr(min_length=3, max_length=64)
    password: constr(min_length=8)

class UserLogin(BaseModel):
    username: str
    password: str

class UserRead(BaseModel):
    id: int
    username: str
    bio: Optional[str] = None
    profile_image: Optional[str] = None

    class Config:
        orm_mode = True

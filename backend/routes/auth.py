"""Authentication routes: register, login, me."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.base import get_session
from backend.models.user import User
from backend.utils.deps import get_current_user
from backend.utils.security import create_access_token, hash_password, verify_password

logger = logging.getLogger(__name__)
router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str | None = None

    @classmethod
    def from_user(cls, u: User) -> "UserOut":
        return cls(id=u.id, email=u.email, display_name=u.display_name)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_session)) -> AuthResponse:
    email = req.email.lower().strip()

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already registered")

    user = User(
        email=email,
        password_hash=hash_password(req.password),
        display_name=(req.display_name or "").strip() or None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info("auth: registered user=%s", user.id)
    token = create_access_token(sub=user.id)
    return AuthResponse(access_token=token, user=UserOut.from_user(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_session)) -> AuthResponse:
    email = req.email.lower().strip()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid email or password")

    logger.info("auth: login user=%s", user.id)
    token = create_access_token(sub=user.id)
    return AuthResponse(access_token=token, user=UserOut.from_user(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.from_user(user)

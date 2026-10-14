"""Single-owner sessions. Only hashes of opaque bearer tokens reach SQLite."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from contextvars import ContextVar
from getpass import getpass

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Integer, String, case, delete
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Mapped, mapped_column
from starlette.concurrency import run_in_threadpool

from app.config import production, web_origins
from app.database import Base, SessionLocal

owner_context: ContextVar[bool] = ContextVar("owner_context", default=False)
password_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Route templates, not arbitrary GET paths. New API routes are private by default.
PUBLIC_READ_ROUTES = frozenset(
    {
        "/health",
        "/api/auth/session",
        "/api/albums",
        "/api/albums/summary",
        "/api/albums/facets",
        "/api/albums/{album_id}",
        "/api/albums/{album_id}/revisions",
        "/api/albums/{album_id}/revisions/{revision_id}",
        "/api/artists",
        "/api/artists/{artist_id}",
        "/api/artists/{artist_id}/tracks",
        "/api/favorite-songs",
        "/api/favorite-songs/{entry_id}",
    }
)


class OwnerSession(Base):
    __tablename__ = "owner_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[int] = mapped_column(Integer, index=True)
    credential_hash: Mapped[str] = mapped_column(String(64))


class LoginThrottle(Base):
    __tablename__ = "login_throttle"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    window_start: Mapped[int] = mapped_column(Integer)
    attempts: Mapped[int] = mapped_column(Integer)


def cookie_name() -> str:
    return "__Host-aftertone_session" if production() else "aftertone_session"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def csrf_token(token: str) -> str:
    return digest("aftertone-csrf:" + token)


def owner_hash() -> str:
    return os.getenv("AFTERTONE_OWNER_PASSWORD_HASH", "")


def session_lifetime() -> int:
    return int(os.getenv("AFTERTONE_SESSION_SECONDS", "43200"))


def current_owner(request: Request) -> bool:
    token = request.cookies.get(cookie_name(), "")
    if not token or len(token) > 128 or not owner_hash():
        return False
    with SessionLocal() as session:
        row = session.get(OwnerSession, digest(token))
        return bool(
            row
            and row.expires_at > int(time.time())
            and hmac.compare_digest(row.credential_hash, digest(owner_hash()))
        )


async def public_context(request: Request):
    # An async dependency sets context before FastAPI enters worker threads.
    authenticated = await run_in_threadpool(current_owner, request)
    route = request.scope["route"].path
    public_read = request.method == "GET" and route in PUBLIC_READ_ROUTES
    login = request.method == "POST" and route == "/api/auth/login"
    frontend = request.method == "GET" and route == "/{path:path}"
    if not (public_read or login or frontend):
        # Keep origin/CSRF enforcement for all writes, including future endpoints.
        await run_in_threadpool(require_owner, request)
    if (
        not authenticated
        and route == "/api/artists"
        and (
            "active" in request.query_params
            or request.query_params.get("unused", "false").lower()
            in {"true", "1", "on", "yes", "t", "y"}
        )
    ):
        raise HTTPException(401, "Owner login required for artist maintenance filters.")
    if (
        not authenticated
        and request.url.path in {"/api/albums", "/api/albums/summary"}
        and request.query_params.get("revisit", "false").lower()
        in {"true", "1", "on", "yes", "t", "y"}
    ):
        raise HTTPException(401, "Owner login required for private revisit filters.")
    token = owner_context.set(authenticated)
    try:
        yield
    finally:
        owner_context.reset(token)


def check_origin(request: Request) -> None:
    if request.headers.get("origin") not in web_origins():
        raise HTTPException(403, "Untrusted request origin.")


def require_owner(request: Request) -> None:
    if not current_owner(request):
        raise HTTPException(401, "Owner login required.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        check_origin(request)
        expected = csrf_token(request.cookies[cookie_name()])
        if not hmac.compare_digest(
            request.headers.get("x-csrf-token", "").encode(), expected.encode()
        ):
            raise HTTPException(403, "Invalid CSRF token.")


def throttle_login() -> None:
    # One global account budget cannot be bypassed with spoofed forwarding headers.
    now = int(time.time())
    with SessionLocal() as session:
        stmt = insert(LoginThrottle).values(id=1, window_start=now, attempts=1)
        expired = LoginThrottle.window_start <= now - 300
        stmt = stmt.on_conflict_do_update(
            index_elements=[LoginThrottle.id],
            set_={
                "window_start": case((expired, now), else_=LoginThrottle.window_start),
                "attempts": case((expired, 1), else_=LoginThrottle.attempts + 1),
            },
        ).returning(LoginThrottle.attempts)
        attempts = session.scalar(stmt)
        session.commit()
    if attempts > 10:
        raise HTTPException(
            429,
            "Too many login attempts. Try again in five minutes.",
            headers={"Retry-After": "300"},
        )


class LoginInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=1024)


@router.post("/login")
def login(payload: LoginInput, request: Request, response: Response) -> dict:
    check_origin(request)  # Protect login itself against login CSRF.
    throttle_login()
    configured = owner_hash()
    if not configured:
        raise HTTPException(503, "Owner login is not configured.")
    try:
        password_hasher.verify(configured, payload.password)
    except (VerificationError, InvalidHashError) as error:
        raise HTTPException(401, "Invalid credentials.") from error
    token = secrets.token_urlsafe(32)
    with SessionLocal() as session:
        # Logging in revokes previous sessions; bounds storage and prevents fixation.
        session.execute(delete(OwnerSession))
        session.add(
            OwnerSession(
                token_hash=digest(token),
                expires_at=int(time.time()) + session_lifetime(),
                credential_hash=digest(configured),
            )
        )
        session.commit()
    response.set_cookie(
        cookie_name(),
        token,
        max_age=session_lifetime(),
        httponly=True,
        secure=production(),
        samesite="strict",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"authenticated": True, "csrf_token": csrf_token(token)}


@router.get("/session")
def session_status(request: Request, response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store"
    authenticated = current_owner(request)
    return {
        "authenticated": authenticated,
        "csrf_token": csrf_token(request.cookies[cookie_name()]) if authenticated else None,
    }


@router.post("/logout", dependencies=[Depends(require_owner)])
def logout(request: Request, response: Response) -> dict:
    with SessionLocal() as session:
        session.execute(
            delete(OwnerSession).where(
                OwnerSession.token_hash == digest(request.cookies[cookie_name()])
            )
        )
        session.commit()
    response.delete_cookie(
        cookie_name(), httponly=True, secure=production(), samesite="strict", path="/"
    )
    return {"authenticated": False}


if __name__ == "__main__":
    password = getpass("New owner password (at least 16 characters): ")
    if len(password) < 16 or password != getpass("Confirm password: "):
        raise SystemExit("Password too short or confirmation did not match.")
    print(password_hasher.hash(password))

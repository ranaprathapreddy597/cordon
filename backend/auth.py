"""Authentication module for Cordon Control Plane.

Supports two modes:
  - 'open'     : No auth required (local development)
  - 'supabase' : JWT token validation via Supabase Auth
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# API Key helpers
# ---------------------------------------------------------------------------

def generate_api_key() -> tuple[str, str]:
    """Return (raw_key, hashed_key)."""
    raw = f"crd_{secrets.token_urlsafe(32)}"
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Supabase JWT validation
# ---------------------------------------------------------------------------

def _decode_supabase_jwt(token: str) -> dict:
    """Decode and verify a Supabase JWT token."""
    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ---------------------------------------------------------------------------
# Current user dependency
# ---------------------------------------------------------------------------

def get_current_user_id(request: Request, db: Session = Depends(get_db)) -> str | None:
    """Extract user identity from request.

    In 'open' mode returns None (no auth).
    In 'supabase' mode expects either:
      - Authorization: Bearer <jwt>
      - X-API-Key: crd_xxx
    """
    if settings.auth_mode == "open":
        return None

    # Try API key first
    api_key = request.headers.get("x-api-key")
    if api_key:
        from backend.models import ApiKey
        hashed = hash_api_key(api_key)
        key_row = db.query(ApiKey).filter(ApiKey.key_hash == hashed, ApiKey.revoked == False).first()
        if not key_row:
            raise HTTPException(status_code=401, detail="Invalid API key")
        key_row.last_used_at = _utcnow()
        db.commit()
        return key_row.user_id

    # Try Bearer JWT
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = _decode_supabase_jwt(token)
        return payload.get("sub")

    raise HTTPException(status_code=401, detail="Authentication required")


def get_optional_user_id(request: Request, db: Session = Depends(get_db)) -> str | None:
    """Same as get_current_user_id but never raises — for optional auth."""
    if settings.auth_mode == "open":
        return None
    try:
        return get_current_user_id(request, db)
    except HTTPException:
        return None

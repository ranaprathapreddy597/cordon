from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from backend.config import settings

logger = logging.getLogger(__name__)

db_url = settings.database_url

# Supabase pooler requires sslmode=require
connect_args: dict = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif "supabase" in db_url and "sslmode" not in db_url:
    db_url = db_url + ("&" if "?" in db_url else "?") + "sslmode=require"

engine = create_engine(
    db_url,
    future=True,
    pool_pre_ping=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

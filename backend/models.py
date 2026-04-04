from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    agent_name: Mapped[str] = mapped_column(String(255), index=True)
    environment: Mapped[str] = mapped_column(String(64), default="local")
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="running", index=True)
    budget_limit_usd: Mapped[float] = mapped_column(Float, default=0.0)
    max_steps: Mapped[int] = mapped_column(Integer, default=0)
    max_runtime_seconds: Mapped[int] = mapped_column(Integer, default=0)
    spend_total_usd: Mapped[float] = mapped_column(Float, default=0.0)
    token_input_total: Mapped[int] = mapped_column(Integer, default=0)
    token_output_total: Mapped[int] = mapped_column(Integer, default=0)
    event_count: Mapped[int] = mapped_column(Integer, default=0)
    llm_calls: Mapped[int] = mapped_column(Integer, default=0)
    tool_calls: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    chaos_events: Mapped[int] = mapped_column(Integer, default=0)
    pii_events: Mapped[int] = mapped_column(Integer, default=0)
    max_latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    reliability_score: Mapped[float] = mapped_column(Float, default=100.0)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    kill_switch_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    recommendations_json: Mapped[str] = mapped_column(Text, default="[]")
    tags_json: Mapped[str] = mapped_column(Text, default="[]")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    chaos_profile_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    events: Mapped[list["Event"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="Event.sequence",
    )


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(64), ForeignKey("runs.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer, index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    phase: Mapped[str] = mapped_column(String(64), default="observe")
    level: Mapped[str] = mapped_column(String(32), default="info")
    title: Mapped[str] = mapped_column(String(255), default="")
    prompt: Mapped[str] = mapped_column(Text, default="")
    response: Mapped[str] = mapped_column(Text, default="")
    tool_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    pii_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    chaos_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    chaos_strategy: Mapped[str | None] = mapped_column(String(128), nullable=True)
    risk_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    run: Mapped[Run] = relationship(back_populates="events")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(255), default="Default")
    key_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(12), default="")
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    metric: Mapped[str] = mapped_column(String(64))  # spend, reliability, risk, errors
    operator: Mapped[str] = mapped_column(String(8))  # gt, lt, gte, lte, eq
    threshold: Mapped[float] = mapped_column(Float)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_type: Mapped[str] = mapped_column(String(32), default="webhook")  # webhook, email
    notify_target: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

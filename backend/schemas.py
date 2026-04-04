from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class BudgetPolicy(BaseModel):
    limit_usd: float | None = Field(default=None, ge=0)
    max_steps: int | None = Field(default=None, ge=1)
    max_runtime_seconds: int | None = Field(default=None, ge=1)


class ChaosProfile(BaseModel):
    enabled: bool = False
    tool_error_rate: float = Field(default=0.0, ge=0, le=1)
    llm_error_rate: float = Field(default=0.0, ge=0, le=1)
    latency_jitter_ms: int = Field(default=0, ge=0, le=60000)
    prompt_injection_rate: float = Field(default=0.0, ge=0, le=1)


class RunStartRequest(BaseModel):
    agent_name: str = Field(min_length=1, max_length=255)
    environment: str = "local"
    provider: str | None = None
    model: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    budget: BudgetPolicy | None = None
    chaos_profile: ChaosProfile | None = None


class RunStartResponse(BaseModel):
    run_id: str
    status: str
    budget: BudgetPolicy
    chaos_profile: ChaosProfile


class EventIngestRequest(BaseModel):
    run_id: str
    event_type: Literal["llm_call", "tool_call", "chaos_injection", "guardrail", "note", "error", "system"]
    phase: str = "observe"
    level: Literal["debug", "info", "warning", "error"] = "info"
    title: str = ""
    prompt: str = ""
    response: str = ""
    tool_name: str | None = None
    provider: str | None = None
    model: str | None = None
    latency_ms: int = Field(default=0, ge=0)
    cost_usd: float | None = Field(default=None, ge=0)
    tokens_in: int = Field(default=0, ge=0)
    tokens_out: int = Field(default=0, ge=0)
    success: bool = True
    chaos_applied: bool = False
    chaos_strategy: str | None = None
    risk_label: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class BudgetState(BaseModel):
    spend_total_usd: float
    spend_ratio: float
    limit_usd: float
    event_count: int
    max_steps: int


class EventIngestResponse(BaseModel):
    status: str
    run_status: str
    reliability_score: float
    risk_score: float
    budget_state: BudgetState
    kill_switch_triggered: bool
    recommendations: list[str]


class RunCompleteRequest(BaseModel):
    status: Literal["completed", "failed", "killed_by_budget", "stopped"] = "completed"
    summary: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


# --- New schemas for Wave 1-3 features ---

class ApiKeyCreate(BaseModel):
    name: str = Field(default="Default", min_length=1, max_length=255)


class ApiKeyResponse(BaseModel):
    id: int
    name: str
    key_prefix: str
    raw_key: str | None = None  # Only returned on creation
    created_at: str
    last_used_at: str | None = None
    revoked: bool = False


class AlertRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    metric: Literal["spend", "reliability", "risk", "errors", "latency"]
    operator: Literal["gt", "lt", "gte", "lte", "eq"]
    threshold: float
    notify_type: Literal["webhook", "email"] = "webhook"
    notify_target: str = ""


class AlertRuleResponse(BaseModel):
    id: int
    name: str
    metric: str
    operator: str
    threshold: float
    enabled: bool
    notify_type: str
    notify_target: str
    created_at: str

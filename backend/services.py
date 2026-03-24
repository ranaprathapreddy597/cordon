from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from typing import Any

from backend.models import Event, Run


EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:(?:\+?\d{1,3})?[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}")
PASSWORD_RE = re.compile(r"(?i)(password|passwd|secret|api[_-]?key)\s*(?:is|=|:)\s*['\"]?([^\s'\",;]+)")
CARD_RE = re.compile(r"\b(?:\d[ -]*?){13,19}\b")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def json_dumps(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True)


def json_loads(value: str, default: Any) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def truncate_text(value: str, limit: int = 1600) -> str:
    if len(value) <= limit:
        return value
    return f"{value[:limit - 3]}..."


def redact_text(value: str) -> tuple[str, bool]:
    if not value:
        return "", False

    original = value
    value = EMAIL_RE.sub("[REDACTED_EMAIL]", value)
    value = PHONE_RE.sub("[REDACTED_PHONE]", value)
    value = CARD_RE.sub("[REDACTED_CARD]", value)
    value = PASSWORD_RE.sub(lambda m: f"{m.group(1)}=[REDACTED_SECRET]", value)
    return value, value != original


def estimate_cost_usd(provider: str | None, model: str | None, tokens_in: int, tokens_out: int) -> float:
    catalog = {
        ("openai", "gpt-4.1-mini"): (0.40, 1.60),
        ("openai", "gpt-4.1-nano"): (0.10, 0.40),
        ("openai", "gpt-5-mini"): (0.25, 2.00),
        ("anthropic", "claude-3-5-haiku-latest"): (0.80, 4.00),
        ("anthropic", "claude-sonnet-4-0"): (3.00, 15.00),
    }
    key = ((provider or "").lower(), (model or "").lower())
    prompt_rate, completion_rate = catalog.get(key, (0.50, 2.00))
    return round(((tokens_in / 1_000_000) * prompt_rate) + ((tokens_out / 1_000_000) * completion_rate), 6)


def _spend_ratio(run: Run) -> float:
    if run.budget_limit_usd <= 0:
        return 0.0
    return min(run.spend_total_usd / run.budget_limit_usd, 3.0)


def compute_scores(run: Run) -> tuple[float, float]:
    risk = 0.0
    risk += min(run.error_count * 12.0, 36.0)
    risk += min(run.chaos_events * 5.0, 20.0)
    risk += min(run.pii_events * 30.0, 40.0)
    risk += min(_spend_ratio(run) * 25.0, 25.0)
    risk += 8.0 if run.max_latency_ms >= 4000 else 0.0
    risk += 6.0 if run.status == "failed" else 0.0
    risk += 12.0 if run.status == "killed_by_budget" else 0.0
    if run.event_count:
        risk += min((run.error_count / run.event_count) * 40.0, 15.0)
    risk = max(0.0, min(100.0, risk))
    reliability = max(0.0, min(100.0, 100.0 - (risk * 0.9)))
    return round(reliability, 1), round(risk, 1)


def build_recommendations(run: Run) -> list[str]:
    items: list[str] = []
    spend_ratio = _spend_ratio(run)
    if run.pii_events:
        items.append("Enable stricter prompt/output redaction before traces leave the agent runtime.")
    if run.error_count and run.error_count >= max(2, math.ceil(run.event_count * 0.15)):
        items.append("Add retry budgets and idempotent tool wrappers for unstable tool or provider calls.")
    if spend_ratio >= 0.75:
        items.append("Introduce a smaller routing model for planner or judge steps before using premium models.")
    if run.chaos_events and run.error_count:
        items.append("Add fallback providers and exponential backoff so chaos failures do not cascade.")
    if run.max_latency_ms >= 4000:
        items.append("Set tighter timeouts and parallelize non-dependent tool calls to reduce tail latency.")
    if not items:
        items.append("Current run looks healthy. Expand coverage with prompt injection and timeout chaos profiles.")
    return items[:4]


def build_summary(run: Run) -> str:
    spend_ratio = _spend_ratio(run) * 100
    return (
        f"{run.agent_name} finished with {run.reliability_score:.1f}/100 reliability, "
        f"{run.risk_score:.1f}/100 risk, ${run.spend_total_usd:.4f} spend, "
        f"{run.error_count} errors, {run.chaos_events} chaos events, and {spend_ratio:.0f}% budget usage."
    )


def serialize_run(run: Run) -> dict[str, Any]:
    return {
        "id": run.id,
        "agent_name": run.agent_name,
        "environment": run.environment,
        "provider": run.provider,
        "model": run.model,
        "status": run.status,
        "budget_limit_usd": run.budget_limit_usd,
        "max_steps": run.max_steps,
        "max_runtime_seconds": run.max_runtime_seconds,
        "spend_total_usd": round(run.spend_total_usd, 6),
        "token_input_total": run.token_input_total,
        "token_output_total": run.token_output_total,
        "event_count": run.event_count,
        "llm_calls": run.llm_calls,
        "tool_calls": run.tool_calls,
        "error_count": run.error_count,
        "chaos_events": run.chaos_events,
        "pii_events": run.pii_events,
        "max_latency_ms": run.max_latency_ms,
        "reliability_score": run.reliability_score,
        "risk_score": run.risk_score,
        "kill_switch_reason": run.kill_switch_reason,
        "summary": run.summary,
        "recommendations": json_loads(run.recommendations_json, []),
        "tags": json_loads(run.tags_json, []),
        "metadata": json_loads(run.metadata_json, {}),
        "chaos_profile": json_loads(run.chaos_profile_json, {}),
        "created_at": run.created_at.isoformat(),
        "updated_at": run.updated_at.isoformat(),
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


def serialize_event(event: Event) -> dict[str, Any]:
    return {
        "id": event.id,
        "run_id": event.run_id,
        "sequence": event.sequence,
        "event_type": event.event_type,
        "phase": event.phase,
        "level": event.level,
        "title": event.title,
        "prompt": event.prompt,
        "response": event.response,
        "tool_name": event.tool_name,
        "provider": event.provider,
        "model": event.model,
        "latency_ms": event.latency_ms,
        "cost_usd": event.cost_usd,
        "tokens_in": event.tokens_in,
        "tokens_out": event.tokens_out,
        "success": event.success,
        "pii_detected": event.pii_detected,
        "chaos_applied": event.chaos_applied,
        "chaos_strategy": event.chaos_strategy,
        "risk_label": event.risk_label,
        "metadata": json_loads(event.metadata_json, {}),
        "created_at": event.created_at.isoformat(),
    }

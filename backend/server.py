from __future__ import annotations

import csv
import io
import json
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from backend.auth import generate_api_key, get_current_user_id, get_optional_user_id, hash_api_key
from backend.config import settings
from backend.database import Base, engine, get_db
from backend.models import AlertRule, ApiKey, Event, Run
from backend.schemas import (
    AlertRuleCreate,
    AlertRuleResponse,
    ApiKeyCreate,
    ApiKeyResponse,
    BudgetPolicy,
    ChaosProfile,
    EventIngestRequest,
    EventIngestResponse,
    RunCompleteRequest,
    RunStartRequest,
    RunStartResponse,
)
from backend.services import (
    build_recommendations,
    build_summary,
    compute_scores,
    estimate_cost_usd,
    json_dumps,
    json_loads,
    redact_text,
    serialize_event,
    serialize_run,
    truncate_text,
    utcnow,
)


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, run_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(run_id, []).append(ws)

    def disconnect(self, run_id: str, ws: WebSocket):
        if run_id in self.active:
            self.active[run_id] = [c for c in self.active[run_id] if c is not ws]
            if not self.active[run_id]:
                del self.active[run_id]

    async def broadcast(self, run_id: str, data: dict):
        for ws in self.active.get(run_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_run_or_404(db: Session, run_id: str) -> Run:
    run = db.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


def _apply_run_scores(run: Run) -> None:
    run.reliability_score, run.risk_score = compute_scores(run)
    run.recommendations_json = json_dumps(build_recommendations(run))
    run.summary = build_summary(run)
    run.updated_at = utcnow()


# ---------------------------------------------------------------------------
# Health & catalog
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "version": settings.version, "environment": settings.environment}


@app.get(f"{settings.api_prefix}/catalog")
def catalog() -> dict[str, object]:
    return {
        "default_budget_limit_usd": settings.default_budget_limit_usd,
        "default_max_steps": settings.default_max_steps,
        "default_runtime_limit_seconds": settings.default_runtime_limit_seconds,
        "recommended_llm_roles": {
            "planner": ["openai:gpt-4.1-mini", "anthropic:claude-3-5-haiku-latest"],
            "judge": ["openai:gpt-4.1-nano", "anthropic:claude-3-5-haiku-latest"],
            "critical_actions": ["openai:gpt-5-mini", "anthropic:claude-sonnet-4-0"],
        },
    }


# ---------------------------------------------------------------------------
# Run CRUD
# ---------------------------------------------------------------------------

@app.post(f"{settings.api_prefix}/runs/start", response_model=RunStartResponse)
def start_run(
    payload: RunStartRequest,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_optional_user_id),
) -> RunStartResponse:
    budget = payload.budget or BudgetPolicy(
        limit_usd=settings.default_budget_limit_usd,
        max_steps=settings.default_max_steps,
        max_runtime_seconds=settings.default_runtime_limit_seconds,
    )
    chaos_profile = payload.chaos_profile or ChaosProfile()
    run = Run(
        id=uuid.uuid4().hex,
        user_id=user_id,
        agent_name=payload.agent_name,
        environment=payload.environment,
        provider=payload.provider,
        model=payload.model,
        budget_limit_usd=budget.limit_usd or settings.default_budget_limit_usd,
        max_steps=budget.max_steps or settings.default_max_steps,
        max_runtime_seconds=budget.max_runtime_seconds or settings.default_runtime_limit_seconds,
        tags_json=json_dumps(payload.tags),
        metadata_json=json_dumps(payload.metadata),
        chaos_profile_json=json_dumps(chaos_profile.model_dump()),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    _apply_run_scores(run)
    db.add(run)
    db.commit()
    return RunStartResponse(
        run_id=run.id,
        status=run.status,
        budget=BudgetPolicy(
            limit_usd=run.budget_limit_usd,
            max_steps=run.max_steps,
            max_runtime_seconds=run.max_runtime_seconds,
        ),
        chaos_profile=chaos_profile,
    )


@app.post(f"{settings.api_prefix}/events/ingest", response_model=EventIngestResponse)
async def ingest_event(payload: EventIngestRequest, db: Session = Depends(get_db)) -> EventIngestResponse:
    run = _get_run_or_404(db, payload.run_id)
    if run.status not in {"running", "stopped"}:
        raise HTTPException(status_code=409, detail=f"Run is already {run.status}")

    safe_prompt, prompt_redacted = redact_text(payload.prompt) if settings.enable_redaction else (payload.prompt, False)
    safe_response, response_redacted = redact_text(payload.response) if settings.enable_redaction else (payload.response, False)
    pii_detected = prompt_redacted or response_redacted
    estimated_cost = payload.cost_usd
    if estimated_cost is None:
        estimated_cost = estimate_cost_usd(payload.provider or run.provider, payload.model or run.model, payload.tokens_in, payload.tokens_out)

    event = Event(
        run_id=run.id,
        sequence=run.event_count + 1,
        event_type=payload.event_type,
        phase=payload.phase,
        level=payload.level,
        title=payload.title or payload.event_type.replace("_", " ").title(),
        prompt=truncate_text(safe_prompt),
        response=truncate_text(safe_response),
        tool_name=payload.tool_name,
        provider=payload.provider or run.provider,
        model=payload.model or run.model,
        latency_ms=payload.latency_ms,
        cost_usd=estimated_cost,
        tokens_in=payload.tokens_in,
        tokens_out=payload.tokens_out,
        success=payload.success,
        pii_detected=pii_detected,
        chaos_applied=payload.chaos_applied,
        chaos_strategy=payload.chaos_strategy,
        risk_label=payload.risk_label,
        metadata_json=json_dumps(payload.metadata),
        created_at=utcnow(),
    )
    db.add(event)

    run.event_count += 1
    run.spend_total_usd = round(run.spend_total_usd + estimated_cost, 6)
    run.token_input_total += payload.tokens_in
    run.token_output_total += payload.tokens_out
    run.max_latency_ms = max(run.max_latency_ms, payload.latency_ms)
    if payload.event_type == "llm_call":
        run.llm_calls += 1
    if payload.event_type == "tool_call":
        run.tool_calls += 1
    if payload.event_type == "chaos_injection" or payload.chaos_applied:
        run.chaos_events += 1
    if payload.event_type == "error" or not payload.success or payload.level == "error":
        run.error_count += 1
    if pii_detected:
        run.pii_events += 1

    runtime_seconds = (utcnow() - run.created_at).total_seconds()
    kill_reason: str | None = None
    if run.budget_limit_usd > 0 and run.spend_total_usd > run.budget_limit_usd:
        kill_reason = "budget_limit_exceeded"
    elif run.max_steps > 0 and run.event_count >= run.max_steps:
        kill_reason = "step_limit_exceeded"
    elif run.max_runtime_seconds > 0 and runtime_seconds >= run.max_runtime_seconds:
        kill_reason = "runtime_limit_exceeded"

    if kill_reason:
        run.status = "killed_by_budget"
        run.kill_switch_reason = kill_reason
        run.completed_at = utcnow()

    _apply_run_scores(run)
    db.commit()
    db.refresh(run)

    spend_ratio = 0.0
    if run.budget_limit_usd > 0:
        spend_ratio = round(run.spend_total_usd / run.budget_limit_usd, 4)

    # Broadcast to WebSocket subscribers
    event_data = serialize_event(event)
    await manager.broadcast(run.id, {
        "type": "event",
        "event": event_data,
        "run_status": run.status,
        "spend_total_usd": round(run.spend_total_usd, 6),
        "reliability_score": run.reliability_score,
        "risk_score": run.risk_score,
    })

    return EventIngestResponse(
        status="accepted",
        run_status=run.status,
        reliability_score=run.reliability_score,
        risk_score=run.risk_score,
        budget_state={
            "spend_total_usd": round(run.spend_total_usd, 6),
            "spend_ratio": spend_ratio,
            "limit_usd": run.budget_limit_usd,
            "event_count": run.event_count,
            "max_steps": run.max_steps,
        },
        kill_switch_triggered=bool(kill_reason),
        recommendations=build_recommendations(run),
    )


@app.post(f"{settings.api_prefix}/runs/{{run_id}}/complete")
def complete_run(run_id: str, payload: RunCompleteRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    run = _get_run_or_404(db, run_id)
    if run.status == "running":
        run.status = payload.status
    if payload.summary:
        run.summary = payload.summary
    if payload.metadata:
        current = json_loads(run.metadata_json or "{}", {})
        current.update(payload.metadata)
        run.metadata_json = json_dumps(current)
    run.completed_at = utcnow()
    _apply_run_scores(run)
    db.commit()
    db.refresh(run)
    return {"status": run.status, "run": serialize_run(run)}


# ---------------------------------------------------------------------------
# Dashboard overview
# ---------------------------------------------------------------------------

@app.get(f"{settings.api_prefix}/dashboard/overview")
def dashboard_overview(db: Session = Depends(get_db)) -> dict[str, object]:
    runs = list(db.scalars(select(Run).order_by(desc(Run.created_at)).limit(25)))
    totals = db.execute(
        select(
            func.count(Run.id),
            func.coalesce(func.sum(Run.spend_total_usd), 0.0),
            func.coalesce(func.avg(Run.reliability_score), 0.0),
            func.coalesce(func.sum(Run.chaos_events), 0),
            func.coalesce(func.sum(Run.error_count), 0),
        )
    ).one()
    high_risk_runs = sum(1 for run in runs if run.risk_score >= 50)
    active_runs = sum(1 for run in runs if run.status == "running")
    killed_runs = sum(1 for run in runs if run.status == "killed_by_budget")
    return {
        "metrics": {
            "total_runs": int(totals[0] or 0),
            "active_runs": active_runs,
            "total_spend_usd": round(float(totals[1] or 0.0), 6),
            "average_reliability_score": round(float(totals[2] or 0.0), 1),
            "chaos_events": int(totals[3] or 0),
            "errors": int(totals[4] or 0),
            "high_risk_runs": high_risk_runs,
            "kill_switch_saves": killed_runs,
        },
        "recent_runs": [serialize_run(run) for run in runs[:8]],
    }


# ---------------------------------------------------------------------------
# Run list, detail, events
# ---------------------------------------------------------------------------

@app.get(f"{settings.api_prefix}/runs")
def list_runs(
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    stmt = select(Run).order_by(desc(Run.created_at)).limit(limit)
    if status:
        stmt = select(Run).where(Run.status == status).order_by(desc(Run.created_at)).limit(limit)
    if search:
        stmt = select(Run).where(Run.agent_name.ilike(f"%{search}%")).order_by(desc(Run.created_at)).limit(limit)
    runs = list(db.scalars(stmt))
    return {"items": [serialize_run(run) for run in runs]}


@app.get(f"{settings.api_prefix}/runs/{{run_id}}")
def get_run(run_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    return {"run": serialize_run(_get_run_or_404(db, run_id))}


@app.get(f"{settings.api_prefix}/runs/{{run_id}}/events")
def get_run_events(
    run_id: str,
    limit: int = Query(default=200, ge=1, le=500),
    event_type: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _get_run_or_404(db, run_id)
    stmt = select(Event).where(Event.run_id == run_id)
    if event_type:
        stmt = stmt.where(Event.event_type == event_type)
    events = list(db.scalars(stmt.order_by(desc(Event.sequence)).limit(limit)))
    return {"items": [serialize_event(event) for event in reversed(events)]}


@app.delete(f"{settings.api_prefix}/runs/{{run_id}}")
def delete_run(run_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    run = _get_run_or_404(db, run_id)
    db.delete(run)
    db.commit()
    return {"status": "deleted", "run_id": run_id}


# ---------------------------------------------------------------------------
# Run comparison
# ---------------------------------------------------------------------------

@app.get(f"{settings.api_prefix}/runs/{{run_id}}/compare/{{other_run_id}}")
def compare_runs(run_id: str, other_run_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    run_a = serialize_run(_get_run_or_404(db, run_id))
    run_b = serialize_run(_get_run_or_404(db, other_run_id))

    metrics = ["spend_total_usd", "reliability_score", "risk_score", "event_count",
               "llm_calls", "tool_calls", "error_count", "chaos_events", "max_latency_ms"]
    deltas = {}
    for m in metrics:
        a_val = run_a.get(m, 0)
        b_val = run_b.get(m, 0)
        deltas[m] = {"a": a_val, "b": b_val, "delta": round(b_val - a_val, 6)}

    return {"run_a": run_a, "run_b": run_b, "deltas": deltas}


# ---------------------------------------------------------------------------
# Run export (JSON / CSV)
# ---------------------------------------------------------------------------

@app.get(f"{settings.api_prefix}/runs/{{run_id}}/export")
def export_run(
    run_id: str,
    format: str = Query(default="json", regex="^(json|csv)$"),
    db: Session = Depends(get_db),
):
    run = _get_run_or_404(db, run_id)
    events = list(db.scalars(
        select(Event).where(Event.run_id == run_id).order_by(Event.sequence)
    ))

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "sequence", "event_type", "phase", "level", "title",
            "prompt", "response", "tool_name", "provider", "model",
            "latency_ms", "cost_usd", "tokens_in", "tokens_out",
            "success", "pii_detected", "chaos_applied", "chaos_strategy",
            "risk_label", "created_at",
        ])
        for e in events:
            writer.writerow([
                e.sequence, e.event_type, e.phase, e.level, e.title,
                e.prompt, e.response, e.tool_name, e.provider, e.model,
                e.latency_ms, e.cost_usd, e.tokens_in, e.tokens_out,
                e.success, e.pii_detected, e.chaos_applied, e.chaos_strategy,
                e.risk_label, e.created_at.isoformat(),
            ])
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=cordon_run_{run_id}.csv"},
        )

    # JSON export
    export_data = {
        "run": serialize_run(run),
        "events": [serialize_event(e) for e in events],
        "exported_at": utcnow().isoformat(),
        "cordon_version": settings.version,
    }
    return export_data


# ---------------------------------------------------------------------------
# Analytics / Trends
# ---------------------------------------------------------------------------

@app.get(f"{settings.api_prefix}/analytics/trends")
def analytics_trends(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    from datetime import timedelta
    cutoff = utcnow() - timedelta(days=days)
    runs = list(db.scalars(
        select(Run).where(Run.created_at >= cutoff).order_by(Run.created_at)
    ))

    daily: dict[str, dict] = {}
    for run in runs:
        day = run.created_at.strftime("%Y-%m-%d")
        if day not in daily:
            daily[day] = {"date": day, "runs": 0, "spend": 0.0, "avg_reliability": 0.0, "errors": 0, "chaos_events": 0, "_reliability_sum": 0.0}
        daily[day]["runs"] += 1
        daily[day]["spend"] = round(daily[day]["spend"] + run.spend_total_usd, 6)
        daily[day]["errors"] += run.error_count
        daily[day]["chaos_events"] += run.chaos_events
        daily[day]["_reliability_sum"] += run.reliability_score

    trend_data = []
    for day_data in daily.values():
        if day_data["runs"] > 0:
            day_data["avg_reliability"] = round(day_data["_reliability_sum"] / day_data["runs"], 1)
        del day_data["_reliability_sum"]
        trend_data.append(day_data)

    # Model usage breakdown
    model_usage: dict[str, int] = {}
    for run in runs:
        key = f"{run.provider or 'unknown'}:{run.model or 'unknown'}"
        model_usage[key] = model_usage.get(key, 0) + 1

    # Status breakdown
    status_counts: dict[str, int] = {}
    for run in runs:
        status_counts[run.status] = status_counts.get(run.status, 0) + 1

    return {
        "period_days": days,
        "total_runs": len(runs),
        "trend": trend_data,
        "model_usage": model_usage,
        "status_breakdown": status_counts,
    }


# ---------------------------------------------------------------------------
# API Key management
# ---------------------------------------------------------------------------

@app.post(f"{settings.api_prefix}/api-keys")
def create_api_key(
    payload: ApiKeyCreate,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_optional_user_id),
) -> dict:
    raw_key, hashed_key = generate_api_key()
    key = ApiKey(
        user_id=user_id or "anonymous",
        name=payload.name,
        key_hash=hashed_key,
        key_prefix=raw_key[:8],
        created_at=utcnow(),
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    return {
        "id": key.id,
        "name": key.name,
        "key_prefix": key.key_prefix,
        "raw_key": raw_key,
        "created_at": key.created_at.isoformat(),
        "revoked": False,
    }


@app.get(f"{settings.api_prefix}/api-keys")
def list_api_keys(
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_optional_user_id),
) -> dict:
    uid = user_id or "anonymous"
    keys = list(db.scalars(
        select(ApiKey).where(ApiKey.user_id == uid).order_by(desc(ApiKey.created_at))
    ))
    return {
        "items": [
            {
                "id": k.id,
                "name": k.name,
                "key_prefix": k.key_prefix,
                "revoked": k.revoked,
                "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
                "created_at": k.created_at.isoformat(),
            }
            for k in keys
        ]
    }


@app.delete(f"{settings.api_prefix}/api-keys/{{key_id}}")
def revoke_api_key(
    key_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    key = db.get(ApiKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.revoked = True
    db.commit()
    return {"status": "revoked"}


# ---------------------------------------------------------------------------
# Alert rules
# ---------------------------------------------------------------------------

@app.post(f"{settings.api_prefix}/alert-rules")
def create_alert_rule(
    payload: AlertRuleCreate,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(get_optional_user_id),
) -> dict:
    rule = AlertRule(
        user_id=user_id,
        name=payload.name,
        metric=payload.metric,
        operator=payload.operator,
        threshold=payload.threshold,
        notify_type=payload.notify_type,
        notify_target=payload.notify_target,
        created_at=utcnow(),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {
        "id": rule.id,
        "name": rule.name,
        "metric": rule.metric,
        "operator": rule.operator,
        "threshold": rule.threshold,
        "enabled": rule.enabled,
        "notify_type": rule.notify_type,
        "notify_target": rule.notify_target,
        "created_at": rule.created_at.isoformat(),
    }


@app.get(f"{settings.api_prefix}/alert-rules")
def list_alert_rules(db: Session = Depends(get_db)) -> dict:
    rules = list(db.scalars(select(AlertRule).order_by(desc(AlertRule.created_at))))
    return {
        "items": [
            {
                "id": r.id,
                "name": r.name,
                "metric": r.metric,
                "operator": r.operator,
                "threshold": r.threshold,
                "enabled": r.enabled,
                "notify_type": r.notify_type,
                "notify_target": r.notify_target,
                "created_at": r.created_at.isoformat(),
            }
            for r in rules
        ]
    }


@app.delete(f"{settings.api_prefix}/alert-rules/{{rule_id}}")
def delete_alert_rule(rule_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    rule = db.get(AlertRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# WebSocket for live trace streaming
# ---------------------------------------------------------------------------

@app.websocket(f"{settings.api_prefix}/ws/runs/{{run_id}}/live")
async def websocket_live_trace(websocket: WebSocket, run_id: str):
    await manager.connect(run_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(run_id, websocket)


# ---------------------------------------------------------------------------
# Run replay (re-stream events for time-travel debugging)
# ---------------------------------------------------------------------------

@app.get(f"{settings.api_prefix}/runs/{{run_id}}/replay")
def replay_run(
    run_id: str,
    from_step: int = Query(default=1, ge=1),
    to_step: int | None = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    run = _get_run_or_404(db, run_id)
    stmt = select(Event).where(Event.run_id == run_id, Event.sequence >= from_step)
    if to_step:
        stmt = stmt.where(Event.sequence <= to_step)
    events = list(db.scalars(stmt.order_by(Event.sequence)))

    # Compute state at each step
    snapshots = []
    cumulative_spend = 0.0
    cumulative_errors = 0
    for e in events:
        cumulative_spend = round(cumulative_spend + e.cost_usd, 6)
        if not e.success or e.level == "error":
            cumulative_errors += 1
        snapshots.append({
            "step": e.sequence,
            "event": serialize_event(e),
            "state_at_step": {
                "cumulative_spend_usd": cumulative_spend,
                "cumulative_errors": cumulative_errors,
                "event_count": e.sequence,
            },
        })

    return {
        "run": serialize_run(run),
        "from_step": from_step,
        "to_step": to_step or run.event_count,
        "total_steps": len(snapshots),
        "snapshots": snapshots,
    }

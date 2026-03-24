from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import Base, engine, get_db
from backend.models import Event, Run
from backend.schemas import (
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
    redact_text,
    serialize_event,
    serialize_run,
    truncate_text,
    utcnow,
)


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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "environment": settings.environment}


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


@app.post(f"{settings.api_prefix}/runs/start", response_model=RunStartResponse)
def start_run(payload: RunStartRequest, db: Session = Depends(get_db)) -> RunStartResponse:
    budget = payload.budget or BudgetPolicy(
        limit_usd=settings.default_budget_limit_usd,
        max_steps=settings.default_max_steps,
        max_runtime_seconds=settings.default_runtime_limit_seconds,
    )
    chaos_profile = payload.chaos_profile or ChaosProfile()
    run = Run(
        id=uuid.uuid4().hex,
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
def ingest_event(payload: EventIngestRequest, db: Session = Depends(get_db)) -> EventIngestResponse:
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
        merged = run.metadata_json
        current = {}
        if merged:
            from backend.services import json_loads

            current = json_loads(merged, {})
        current.update(payload.metadata)
        run.metadata_json = json_dumps(current)
    run.completed_at = utcnow()
    _apply_run_scores(run)
    db.commit()
    db.refresh(run)
    return {"status": run.status, "run": serialize_run(run)}


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


@app.get(f"{settings.api_prefix}/runs")
def list_runs(
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    stmt = select(Run).order_by(desc(Run.created_at)).limit(limit)
    if status:
        stmt = select(Run).where(Run.status == status).order_by(desc(Run.created_at)).limit(limit)
    runs = list(db.scalars(stmt))
    return {"items": [serialize_run(run) for run in runs]}


@app.get(f"{settings.api_prefix}/runs/{{run_id}}")
def get_run(run_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    return {"run": serialize_run(_get_run_or_404(db, run_id))}


@app.get(f"{settings.api_prefix}/runs/{{run_id}}/events")
def get_run_events(
    run_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _get_run_or_404(db, run_id)
    events = list(
        db.scalars(
            select(Event)
            .where(Event.run_id == run_id)
            .order_by(desc(Event.sequence))
            .limit(limit)
        )
    )
    return {"items": [serialize_event(event) for event in reversed(events)]}

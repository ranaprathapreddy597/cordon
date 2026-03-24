# Cordon

Cordon is an agentic SRE and FinOps control plane for AI agents.

It helps teams:

- trace model and tool behavior
- inject chaos into agent workflows before production
- enforce budget and runtime policies
- inspect execution timelines and risk signals
- build toward a hosted enterprise reliability layer without changing the SDK contract

## What is in this repo

- `backend/`: FastAPI control plane with persistence, scoring, redaction, and dashboard APIs
- `frontend/`: Next.js control plane UI
- `sdk/`: Python SDK and CLI for local agent instrumentation
- `customer_agent.py`: demo agent that generates realistic telemetry

## Why this architecture

The repo is intentionally local-first:

- developers keep proprietary agent code on their machine
- the SDK streams structured telemetry to the control plane
- the control plane stores runs and events, applies policy logic, and computes reliability signals
- the frontend reads from the control plane API instead of talking to the database directly

This is the same shape you want long term. Later you can swap SQLite for Postgres, add Redis or Kafka, add auth, and add enterprise audit logs without breaking SDK adopters.

## Current product features

- Budget kill switch by spend, max steps, and runtime
- Prompt/output redaction for common secrets and PII
- Chaos profiles for tool failures, LLM outages, latency jitter, and prompt injection
- Reliability and risk scoring
- Recommendations generated from run behavior
- Live dashboard for run list, trace timeline, budget pressure, and run summaries
- CLI wrapper to run local Python scripts with policy controls

## Local development

### 1. Start the backend

```bash
python -m venv .venv
. .venv/Scripts/activate
pip install -r backend/requirements.txt
uvicorn backend.server:app --reload
```

The backend stores data in `backend/data/cordon.db` by default.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

By default the UI expects the backend at `http://localhost:8000`.

### 3. Run the demo agent

```bash
pip install -r sdk/requirements.txt
python customer_agent.py
```

Or use the CLI:

```bash
python -m sdk.cli doctor
python -m sdk.cli run customer_agent.py --agent-name "Support Agent" --chaos-enabled --tool-error-rate 0.2
```

## Environment variables

### Backend

- `CORDON_DATABASE_URL`: defaults to a local SQLite database
- `CORDON_CORS_ORIGINS`: comma-separated allowed origins
- `CORDON_DEFAULT_BUDGET_LIMIT_USD`
- `CORDON_DEFAULT_MAX_STEPS`
- `CORDON_DEFAULT_RUNTIME_LIMIT_SECONDS`
- `CORDON_ENABLE_REDACTION`

### Frontend

- `NEXT_PUBLIC_CORDON_API_URL`

### SDK / CLI

- `CORDON_BACKEND_URL`
- `CORDON_AGENT_NAME`
- `CORDON_PROVIDER`
- `CORDON_MODEL`
- `CORDON_BUDGET_LIMIT_USD`
- `CORDON_MAX_STEPS`
- `CORDON_MAX_RUNTIME_SECONDS`
- `CORDON_CHAOS_ENABLED`
- `CORDON_CHAOS_TOOL_ERROR_RATE`
- `CORDON_CHAOS_LLM_ERROR_RATE`
- `CORDON_CHAOS_LATENCY_JITTER_MS`
- `CORDON_CHAOS_PROMPT_INJECTION_RATE`

## Deploy path

This repo is ready for a pragmatic MVP deploy path:

1. Deploy `backend` to Railway, Render, Fly.io, or any container host.
2. Set `CORDON_DATABASE_URL` to a managed Postgres instance.
3. Deploy `frontend` to Vercel and point `NEXT_PUBLIC_CORDON_API_URL` to the backend URL.
4. Publish the SDK as a package once the API contract is stable.

## Recommended next milestones

1. Add authentication and organizations.
2. Add Postgres migrations and background jobs.
3. Add queue-based event ingestion for high-volume telemetry.
4. Add provider-native integrations for OpenAI, Anthropic, and LangGraph callbacks.
5. Add evaluation runners, replay, and compliance exports.

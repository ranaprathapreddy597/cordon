<p align="center">
  <strong>🛡️ Cordon</strong>
  <br />
  <em>The open-source reliability control plane for AI agents.</em>
  <br /><br />
  Trace every tool call · Inject chaos · Score reliability · Kill runaway spend
</p>

---

## What is Cordon?

Cordon is an **Agentic SRE & FinOps sandbox platform**. Instead of deploying AI agents directly to production and hoping for the best, developers connect their agents to Cordon first.

Cordon intercepts every LLM call, tool invocation, and decision — then injects simulated failures to stress-test the agent's error handling. It calculates a reliability score, tracks spend in real-time, and fires a kill switch if the agent exceeds its budget.

**No other platform combines chaos engineering + FinOps kill switch + agent tracing in one open-source tool.**

## Key Features

| Feature | Description |
|:---|:---|
| **FinOps Kill Switch** | Set spend, step, and runtime limits. Cordon auto-kills agents that exceed policy. |
| **Chaos Engineering** | Inject tool failures, LLM outages, latency jitter, and prompt injections. |
| **Execution Trace** | Full OODA-loop timeline showing every thought, tool call, and cost per step. |
| **PII Redaction** | Auto-detect and mask emails, phone numbers, credit cards, and secrets. |
| **Reliability Scoring** | Composite reliability and risk scores with actionable recommendations. |
| **Time-Travel Replay** | Rewind to any step and see the exact state at that point. |
| **Run Comparison** | Side-by-side diff of any two runs showing metric deltas. |
| **Alert Rules** | Custom thresholds for spend, reliability, errors, or latency. |
| **Compliance Export** | Export runs as JSON or CSV for audit trails and governance. |
| **API Key Auth** | Secure SDK-to-backend authentication with revocable API keys. |
| **Analytics Dashboard** | Trend charts, model usage breakdown, status distribution. |
| **OpenAI Auto-Patch** | Monkey-patches OpenAI/Anthropic SDKs — zero code changes. |
| **20+ API Endpoints** | Full REST API with WebSocket real-time event streaming. |

## Quick Start

### 1. Start the backend

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r backend/requirements.txt
uvicorn backend.server:app --reload
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Run the demo agent

```bash
pip install -r sdk/requirements.txt
python customer_agent.py
```

Open **http://localhost:3000** to see the dashboard.

### 4. Use the CLI

```bash
python -m sdk.cli doctor
python -m sdk.cli run customer_agent.py --agent-name "Support Agent" --chaos-enabled --tool-error-rate 0.2
```

## SDK Usage

### Simple (3 lines)

```python
import cordon
cordon.init(agent_name="My Agent", provider="openai", model="gpt-4.1-mini")
cordon.patch_openai()

# All OpenAI calls are now auto-traced, costed, and budget-protected
```

### Context Manager

```python
from sdk.cordon import CordonSession

with CordonSession(agent_name="My Bot", provider="openai", model="gpt-4.1-mini") as session:
    session.trace("Summarize this document", response="Summary generated.")
    session.record_tool_call("search", input_text="query", output_text="results")
```

### Decorator

```python
import cordon

session = cordon.init(agent_name="Pipeline")

@cordon.trace(session=session, title="Process Order")
def process_order(order_id: str) -> str:
    return f"Processed {order_id}"
```

## Architecture

```
Developer Machine                  Cordon Cloud
┌─────────────┐                   ┌──────────────────┐
│  AI Agent    │                   │  Next.js Frontend│
│  + Cordon SDK│──── REST API ───→│  (Vercel)        │
│              │                   ├──────────────────┤
│  pip install │                   │  FastAPI Backend │
│  cordon      │──── API Key  ───→│  (Render)        │
└─────────────┘                   ├──────────────────┤
                                  │  PostgreSQL      │
                                  │  (Supabase)      │
                                  └──────────────────┘
```

## Deploy (Free)

| Service | Platform | Cost |
|:---|:---|:---|
| Frontend | **Vercel** | Free |
| Backend | **Render** | Free |
| Database | **Supabase** | Free (500MB) |

### Steps

1. Push code to GitHub
2. **Frontend**: Import repo in [Vercel](https://vercel.com). Set root directory to `frontend`. Add env: `NEXT_PUBLIC_CORDON_API_URL=https://your-backend.onrender.com`
3. **Backend**: Import repo in [Render](https://render.com). Use the `render.yaml` blueprint, or manually set build command to `pip install -r backend/requirements.txt` and start command to `uvicorn backend.server:app --host 0.0.0.0 --port $PORT`
4. **Database**: Create a [Supabase](https://supabase.com) project. Copy the connection string to `CORDON_DATABASE_URL` in Render env vars

## Environment Variables

| Variable | Description | Default |
|:---|:---|:---|
| `CORDON_DATABASE_URL` | Database connection string | SQLite (local) |
| `CORDON_AUTH_MODE` | `open` or `supabase` | `open` |
| `CORDON_CORS_ORIGINS` | Allowed frontend origins | `localhost:3000` |
| `CORDON_ENABLE_REDACTION` | Auto-redact PII | `true` |
| `CORDON_API_KEY` | SDK authentication key | — |
| `CORDON_BUDGET_LIMIT_USD` | Default budget per run | `3.0` |
| `CORDON_CHAOS_ENABLED` | Enable chaos injection | `false` |

## Tech Stack

- **Frontend**: Next.js 16, Tailwind CSS 4, Recharts, Framer Motion
- **Backend**: Python, FastAPI, SQLAlchemy, WebSocket
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **SDK**: Python with auto-patching for OpenAI, Anthropic
- **Auth**: Supabase Auth (JWT + API keys)

## License

MIT

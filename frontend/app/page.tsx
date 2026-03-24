"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Shield,
  Sparkles,
  Timer,
  Wallet,
  Zap,
} from "lucide-react";

type MetricBlock = {
  total_runs: number;
  active_runs: number;
  total_spend_usd: number;
  average_reliability_score: number;
  chaos_events: number;
  errors: number;
  high_risk_runs: number;
  kill_switch_saves: number;
};

type RunSummary = {
  id: string;
  agent_name: string;
  environment: string;
  provider: string | null;
  model: string | null;
  status: string;
  budget_limit_usd: number;
  max_steps: number;
  spend_total_usd: number;
  event_count: number;
  llm_calls: number;
  tool_calls: number;
  error_count: number;
  chaos_events: number;
  pii_events: number;
  max_latency_ms: number;
  reliability_score: number;
  risk_score: number;
  kill_switch_reason: string | null;
  summary: string;
  recommendations: string[];
  tags: string[];
  created_at: string;
  completed_at: string | null;
};

type EventItem = {
  id: number;
  sequence: number;
  event_type: string;
  phase: string;
  level: string;
  title: string;
  prompt: string;
  response: string;
  tool_name: string | null;
  provider: string | null;
  model: string | null;
  latency_ms: number;
  cost_usd: number;
  tokens_in: number;
  tokens_out: number;
  success: boolean;
  pii_detected: boolean;
  chaos_applied: boolean;
  chaos_strategy: string | null;
  risk_label: string | null;
  created_at: string;
};

type OverviewPayload = {
  metrics: MetricBlock;
  recent_runs: RunSummary[];
};

const API_URL =
  process.env.NEXT_PUBLIC_CORDON_API_URL ?? "http://localhost:8000";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function classForStatus(status: string): string {
  if (status === "running") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  }
  if (status === "killed_by_budget") {
    return "border-rose-400/25 bg-rose-400/10 text-rose-300";
  }
  if (status === "failed") {
    return "border-orange-400/25 bg-orange-400/10 text-orange-300";
  }
  return "border-slate-400/20 bg-slate-400/10 text-slate-200";
}

function classForRisk(score: number): string {
  if (score >= 65) {
    return "text-rose-300";
  }
  if (score >= 35) {
    return "text-orange-300";
  }
  return "text-teal-300";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "In progress";
  }
  return new Date(value).toLocaleString();
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function Home() {
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchOverview = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/dashboard/overview`);
        if (!response.ok) {
          throw new Error(`Control plane returned ${response.status}`);
        }
        const data: OverviewPayload = await response.json();
        if (!isMounted) {
          return;
        }
        setOverview(data);
        setSelectedRunId((current) => current ?? data.recent_runs[0]?.id ?? null);
        setError(null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to reach the Cordon API.";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOverview();
    const interval = window.setInterval(fetchOverview, 5000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      setEvents([]);
      return;
    }

    let isMounted = true;
    const fetchRun = async () => {
      try {
        const [runResponse, eventsResponse] = await Promise.all([
          fetch(`${API_URL}/api/v1/runs/${selectedRunId}`),
          fetch(`${API_URL}/api/v1/runs/${selectedRunId}/events?limit=120`),
        ]);

        if (!runResponse.ok || !eventsResponse.ok) {
          throw new Error("Unable to load run details.");
        }

        const runPayload = (await runResponse.json()) as { run: RunSummary };
        const eventPayload = (await eventsResponse.json()) as { items: EventItem[] };

        if (!isMounted) {
          return;
        }

        setSelectedRun(runPayload.run);
        setEvents(eventPayload.items);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load run details.";
        setError(message);
      }
    };

    fetchRun();
    const interval = window.setInterval(fetchRun, 4000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [selectedRunId]);

  const spendRatio = useMemo(() => {
    if (!selectedRun || selectedRun.budget_limit_usd <= 0) {
      return 0;
    }
    return Math.min(
      (selectedRun.spend_total_usd / selectedRun.budget_limit_usd) * 100,
      100,
    );
  }, [selectedRun]);

  return (
    <main className="min-h-screen px-5 py-6 text-slate-50 md:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="panel-strong relative overflow-hidden rounded-[28px] px-6 py-7 md:px-8">
          <div className="absolute -right-20 top-0 h-60 w-60 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-orange-400/10 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.28em] text-slate-300">
                <Shield className="h-3.5 w-3.5 text-teal-300" />
                Agent Reliability Control Plane
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
                Cordon helps AI agents fail safely before they fail in public.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                Trace every tool call, inject chaos, score reliability, and kill
                runaway spend before it becomes a FinOps incident. Designed to run
                free on your laptop now and grow into a production control plane later.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 font-mono">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                  API Endpoint
                </div>
                <div className="mt-2 break-all text-xs text-teal-200">{API_URL}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                  Focus
                </div>
                <div className="mt-2 text-sm text-slate-100">
                  FinOps kill switch, chaos testing, trace visibility, and deploy-ready APIs.
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <section className="panel rounded-3xl border-rose-400/25 px-6 py-5 text-sm text-rose-200">
            Unable to sync with the backend: {error}. Start the FastAPI server on
            <span className="font-mono"> {API_URL}</span> and refresh the page.
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Activity className="h-5 w-5 text-teal-300" />}
            label="Active Runs"
            value={overview?.metrics.active_runs ?? 0}
            detail={`${overview?.metrics.total_runs ?? 0} total runs tracked`}
          />
          <MetricCard
            icon={<Wallet className="h-5 w-5 text-orange-300" />}
            label="Cloud Spend"
            value={currency.format(overview?.metrics.total_spend_usd ?? 0)}
            detail={`${overview?.metrics.kill_switch_saves ?? 0} kill-switch saves`}
          />
          <MetricCard
            icon={<Zap className="h-5 w-5 text-teal-300" />}
            label="Avg Reliability"
            value={formatPercent(overview?.metrics.average_reliability_score ?? 0)}
            detail={`${overview?.metrics.chaos_events ?? 0} chaos injections logged`}
          />
          <MetricCard
            icon={<AlertTriangle className="h-5 w-5 text-rose-300" />}
            label="High-Risk Runs"
            value={overview?.metrics.high_risk_runs ?? 0}
            detail={`${overview?.metrics.errors ?? 0} total errors observed`}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
          <div className="panel rounded-[28px] p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Recent Runs
                </div>
                <h2 className="mt-2 text-2xl font-semibold">Fleet Snapshot</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                Polling every 5s
              </div>
            </div>

            <div className="space-y-3">
              {(overview?.recent_runs ?? []).map((run) => {
                const selected = run.id === selectedRunId;
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-teal-300/40 bg-teal-300/10"
                        : "border-white/8 bg-slate-950/30 hover:border-white/16 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">{run.agent_name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                          {run.environment} · {run.provider ?? "custom"} · {run.model ?? "unknown"}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${classForStatus(
                          run.status,
                        )}`}
                      >
                        {run.status.replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <RunMiniMetric label="Spend" value={currency.format(run.spend_total_usd)} />
                      <RunMiniMetric label="Reliability" value={formatPercent(run.reliability_score)} />
                      <RunMiniMetric label="Risk" value={formatPercent(run.risk_score)} />
                    </div>
                  </button>
                );
              })}

              {!loading && (overview?.recent_runs.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-slate-950/35 px-4 py-6 text-sm text-slate-300">
                  No runs yet. Start the backend, then run the demo agent with
                  <span className="font-mono"> python customer_agent.py</span>.
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <section className="panel rounded-[28px] p-5 md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Run Details
                  </div>
                  <h2 className="mt-2 text-3xl font-semibold">
                    {selectedRun?.agent_name ?? "Select a run"}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {selectedRun?.summary ??
                      "Pick a run to inspect budget pressure, recommendations, and full execution traces."}
                  </p>
                </div>

                {selectedRun ? (
                  <div
                    className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] ${classForStatus(
                      selectedRun.status,
                    )}`}
                  >
                    {selectedRun.status.replaceAll("_", " ")}
                  </div>
                ) : null}
              </div>

              {selectedRun ? (
                <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <InsightCard
                      icon={<Cpu className="h-4 w-4 text-teal-300" />}
                      title="Reliability"
                      value={formatPercent(selectedRun.reliability_score)}
                      helper={`${selectedRun.llm_calls} LLM calls · ${selectedRun.tool_calls} tool calls`}
                    />
                    <InsightCard
                      icon={<AlertTriangle className={`h-4 w-4 ${classForRisk(selectedRun.risk_score)}`} />}
                      title="Risk"
                      value={formatPercent(selectedRun.risk_score)}
                      helper={`${selectedRun.error_count} errors · ${selectedRun.pii_events} PII flags`}
                    />
                    <InsightCard
                      icon={<Timer className="h-4 w-4 text-orange-300" />}
                      title="Tail Latency"
                      value={`${selectedRun.max_latency_ms} ms`}
                      helper={formatDate(selectedRun.completed_at)}
                    />
                    <InsightCard
                      icon={<Wallet className="h-4 w-4 text-orange-300" />}
                      title="Spend"
                      value={currency.format(selectedRun.spend_total_usd)}
                      helper={`Budget ${currency.format(selectedRun.budget_limit_usd)}`}
                    />
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-slate-400">
                      <span>Budget Pressure</span>
                      <span>{spendRatio.toFixed(0)}%</span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/8">
                      <div
                        className={`h-full rounded-full ${
                          spendRatio >= 85
                            ? "bg-rose-400"
                            : spendRatio >= 65
                              ? "bg-orange-400"
                              : "bg-teal-400"
                        }`}
                        style={{ width: `${spendRatio}%` }}
                      />
                    </div>
                    <div className="mt-5 text-xs uppercase tracking-[0.24em] text-slate-400">
                      Recommendations
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedRun.recommendations.map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3 text-sm leading-6 text-slate-200"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="panel rounded-[28px] p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <Sparkles className="h-4 w-4 text-teal-300" />
                  Deployment Notes
                </div>
                <div className="space-y-3 text-sm leading-7 text-slate-300">
                  <p>
                    Cordon is built as a local-first control plane. The agent stays
                    on the developer machine while the SDK streams structured telemetry
                    to the backend.
                  </p>
                  <p>
                    This lets you add Postgres, Redis, queues, or hosted auth later
                    without changing the SDK contract developers adopt today.
                  </p>
                  <p>
                    Current run tags:
                    <span className="ml-2 font-mono text-teal-200">
                      {selectedRun?.tags.join(", ") || "none"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="panel rounded-[28px] p-5 md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Live Trace
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold">Execution Timeline</h3>
                  </div>
                  <div className="rounded-full border border-teal-300/15 bg-teal-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-teal-200">
                    PII firewall on
                  </div>
                </div>
                <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-white/8 bg-slate-950/35 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm font-semibold text-slate-100">
                          {event.title}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          <span>#{event.sequence}</span>
                          <span>{event.event_type.replaceAll("_", " ")}</span>
                          <span>{new Date(event.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300">
                        {event.prompt ? (
                          <div>
                            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              Input
                            </span>
                            <p className="mt-1 whitespace-pre-wrap break-words">{event.prompt}</p>
                          </div>
                        ) : null}
                        {event.response ? (
                          <div>
                            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              Output
                            </span>
                            <p className="mt-1 whitespace-pre-wrap break-words">{event.response}</p>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          {event.phase}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          {event.latency_ms} ms
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          {currency.format(event.cost_usd)}
                        </span>
                        {event.chaos_applied ? (
                          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-orange-200">
                            chaos
                          </span>
                        ) : null}
                        {event.pii_detected ? (
                          <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-rose-200">
                            pii redacted
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  {!selectedRunId ? (
                    <div className="rounded-2xl border border-dashed border-white/12 bg-slate-950/35 px-4 py-6 text-sm text-slate-300">
                      No run selected yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="panel metric-glow rounded-[24px] p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
          {label}
        </div>
        <div>{icon}</div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{detail}</div>
    </div>
  );
}

function InsightCard({
  icon,
  title,
  value,
  helper,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-200">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-4 text-2xl font-semibold">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function RunMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

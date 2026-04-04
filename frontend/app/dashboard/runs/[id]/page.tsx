"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Cpu,
  Download,
  GitCompare,
  Shield,
  Timer,
  Wallet,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_CORDON_API_URL ?? "http://localhost:8000";
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 });

type RunDetail = {
  id: string;
  agent_name: string;
  environment: string;
  provider: string | null;
  model: string | null;
  status: string;
  budget_limit_usd: number;
  max_steps: number;
  max_runtime_seconds: number;
  spend_total_usd: number;
  token_input_total: number;
  token_output_total: number;
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
  chaos_profile: Record<string, unknown>;
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

function classForStatus(s: string) {
  if (s === "running") return "tag-teal";
  if (s === "killed_by_budget") return "tag-rose";
  if (s === "failed") return "tag-orange";
  return "tag-slate";
}

function phaseColor(p: string) {
  if (p === "observe") return "border-l-blue-400";
  if (p === "orient") return "border-l-violet-400";
  if (p === "decide") return "border-l-teal-400";
  if (p === "act") return "border-l-orange-400";
  return "border-l-slate-400";
}

function eventTypeTag(t: string) {
  if (t === "llm_call") return "tag-teal";
  if (t === "tool_call") return "tag-violet";
  if (t === "chaos_injection") return "tag-orange";
  if (t === "error") return "tag-rose";
  if (t === "guardrail") return "tag-rose";
  return "tag-slate";
}

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const [run, setRun] = useState<RunDetail | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) return;
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [runRes, eventsRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/runs/${runId}`),
          fetch(`${API_URL}/api/v1/runs/${runId}/events?limit=200`),
        ]);
        if (!runRes.ok || !eventsRes.ok) return;
        const runData = await runRes.json();
        const eventsData = await eventsRes.json();
        if (!isMounted) return;
        setRun(runData.run);
        setEvents(eventsData.items);
      } catch {}
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [runId]);

  const spendRatio = useMemo(() => {
    if (!run || run.budget_limit_usd <= 0) return 0;
    return Math.min((run.spend_total_usd / run.budget_limit_usd) * 100, 100);
  }, [run]);

  const costPerStep = useMemo(() => {
    return events.map((e) => ({
      step: e.sequence,
      cost: e.cost_usd,
      latency: e.latency_ms,
      type: e.event_type,
    }));
  }, [events]);

  if (loading) {
    return <div className="text-slate-500 text-sm py-12 text-center">Loading run details...</div>;
  }

  if (!run) {
    return <div className="text-rose-400 text-sm py-12 text-center">Run not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/runs" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="h-5 w-5 text-slate-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{run.agent_name}</h1>
            <span className={`tag ${classForStatus(run.status)}`}>{run.status.replace(/_/g, " ")}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {run.provider ?? "custom"} · {run.model ?? "unknown"} · {run.environment} · {new Date(run.created_at).toLocaleString()}
          </div>
        </div>
        <button
          onClick={() => window.open(`${API_URL}/api/v1/runs/${runId}/export?format=json`, "_blank")}
          className="btn-secondary text-xs"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      {/* Summary */}
      {run.summary && (
        <div className="panel rounded-xl p-4 text-sm text-slate-300 leading-relaxed">
          {run.summary}
        </div>
      )}

      {/* Metric Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <Shield className="h-4 w-4 text-teal-400" />, label: "Reliability", value: `${run.reliability_score.toFixed(1)}%`, sub: `${run.llm_calls} LLM · ${run.tool_calls} tools` },
          { icon: <AlertTriangle className="h-4 w-4 text-rose-400" />, label: "Risk", value: `${run.risk_score.toFixed(1)}%`, sub: `${run.error_count} errors · ${run.pii_events} PII` },
          { icon: <Wallet className="h-4 w-4 text-orange-400" />, label: "Spend", value: currency.format(run.spend_total_usd), sub: `Budget: ${currency.format(run.budget_limit_usd)}` },
          { icon: <Timer className="h-4 w-4 text-violet-400" />, label: "Peak Latency", value: `${run.max_latency_ms}ms`, sub: `${run.event_count} total events` },
        ].map((m) => (
          <div key={m.label} className="panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">{m.icon}<span className="text-xs uppercase tracking-wider text-slate-400">{m.label}</span></div>
            <div className="text-2xl font-bold">{m.value}</div>
            <div className="text-xs text-slate-500 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Budget Pressure + Cost Chart */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Budget Pressure */}
        <div className="panel rounded-xl p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400 mb-3">
            <span>Budget Pressure</span>
            <span className="text-lg font-bold text-white">{spendRatio.toFixed(0)}%</span>
          </div>
          <div className="h-4 rounded-full bg-white/6 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                spendRatio >= 85 ? "bg-gradient-to-r from-rose-500 to-rose-400" :
                spendRatio >= 65 ? "bg-gradient-to-r from-orange-500 to-orange-400" :
                "bg-gradient-to-r from-teal-500 to-teal-400"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${spendRatio}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          {run.kill_switch_reason && (
            <div className="mt-3 tag tag-rose text-xs">
              Kill switch: {run.kill_switch_reason.replace(/_/g, " ")}
            </div>
          )}

          {/* Recommendations */}
          <div className="mt-5 text-xs uppercase tracking-wider text-slate-400 mb-3">Recommendations</div>
          <div className="space-y-2">
            {run.recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg border border-white/6 bg-white/2 p-3 text-sm text-slate-300 leading-relaxed">
                {rec}
              </div>
            ))}
          </div>
        </div>

        {/* Cost Per Step Chart */}
        <div className="panel rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Cost Distribution</div>
          <h3 className="text-lg font-semibold mb-4">Cost Per Step</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={costPerStep}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
              <XAxis dataKey="step" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0e1a2e", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 12, fontSize: 11 }}
                formatter={(value) => [`$${Number(value).toFixed(6)}`, "Cost"]}
              />
              <Bar dataKey="cost" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Execution Timeline */}
      <div className="panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Execution Trace</div>
            <h3 className="text-xl font-semibold mt-1">Timeline ({events.length} events)</h3>
          </div>
          <div className="tag tag-teal"><Clock className="h-3 w-3 mr-1" /> PII firewall on</div>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`rounded-lg border border-white/5 bg-white/2 p-3 cursor-pointer hover:bg-white/4 transition-all border-l-2 ${phaseColor(event.phase)}`}
              onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">#{event.sequence}</span>
                  <span className="text-sm font-semibold">{event.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`tag ${eventTypeTag(event.event_type)}`}>{event.event_type.replace(/_/g, " ")}</span>
                  <span className="text-[10px] text-slate-500">{event.latency_ms}ms</span>
                  <span className="text-[10px] text-slate-500">{currency.format(event.cost_usd)}</span>
                  {event.chaos_applied && <span className="tag tag-orange">chaos</span>}
                  {event.pii_detected && <span className="tag tag-rose">pii</span>}
                  {!event.success && <span className="tag tag-rose">error</span>}
                </div>
              </div>

              {expandedEvent === event.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-3 space-y-2 text-sm overflow-hidden"
                >
                  {event.prompt && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Input</div>
                      <pre className="text-xs text-slate-300 bg-black/20 rounded-lg p-3 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{event.prompt}</pre>
                    </div>
                  )}
                  {event.response && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Output</div>
                      <pre className="text-xs text-slate-300 bg-black/20 rounded-lg p-3 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{event.response}</pre>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Phase: {event.phase}</span>
                    <span>Tokens: {event.tokens_in}→{event.tokens_out}</span>
                    {event.tool_name && <span>Tool: {event.tool_name}</span>}
                    {event.provider && <span>Provider: {event.provider}</span>}
                    <span>{new Date(event.created_at).toLocaleTimeString()}</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

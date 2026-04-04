"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cpu,
  Shield,
  Sparkles,
  Timer,
  Wallet,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_CORDON_API_URL ?? "http://localhost:8000";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

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

type TrendItem = {
  date: string;
  runs: number;
  spend: number;
  avg_reliability: number;
  errors: number;
};

function classForStatus(status: string): string {
  if (status === "running") return "tag-teal";
  if (status === "killed_by_budget") return "tag-rose";
  if (status === "failed") return "tag-orange";
  return "tag-slate";
}

const PIE_COLORS = ["#2dd4bf", "#fb923c", "#fb7185", "#a78bfa", "#60a5fa"];

export default function DashboardOverview() {
  const [metrics, setMetrics] = useState<MetricBlock | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [overviewRes, trendsRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/dashboard/overview`),
          fetch(`${API_URL}/api/v1/analytics/trends?days=7`),
        ]);

        if (!overviewRes.ok) throw new Error(`Backend returned ${overviewRes.status}`);

        const overview = await overviewRes.json();
        const trendData = trendsRes.ok ? await trendsRes.json() : { trend: [], status_breakdown: {} };

        if (!isMounted) return;
        setMetrics(overview.metrics);
        setRecentRuns(overview.recent_runs);
        setTrends(trendData.trend || []);
        setStatusBreakdown(trendData.status_breakdown || {});
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Unable to reach Cordon API");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const statusPieData = useMemo(() => {
    return Object.entries(statusBreakdown).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
    }));
  }, [statusBreakdown]);

  if (error) {
    return (
      <div className="panel rounded-2xl p-6 border-rose-400/20 text-rose-200 text-sm">
        <AlertTriangle className="h-5 w-5 mb-2" />
        Unable to connect to the Cordon backend at <span className="font-mono">{API_URL}</span>.
        <br />Start the server with <span className="font-mono">uvicorn backend.server:app --reload</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium tracking-[0.2em] uppercase text-slate-500 mb-1">Control Plane</div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="tag tag-teal">
            <Activity className="h-3 w-3 mr-1.5" />
            Live · Polling 5s
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: <Activity className="h-5 w-5 text-teal-400" />, label: "Total Runs", value: metrics?.total_runs ?? 0, detail: `${metrics?.active_runs ?? 0} active now` },
          { icon: <Wallet className="h-5 w-5 text-orange-400" />, label: "Total Spend", value: currency.format(metrics?.total_spend_usd ?? 0), detail: `${metrics?.kill_switch_saves ?? 0} kill-switch saves` },
          { icon: <Zap className="h-5 w-5 text-teal-400" />, label: "Avg Reliability", value: `${(metrics?.average_reliability_score ?? 0).toFixed(1)}%`, detail: `${metrics?.chaos_events ?? 0} chaos injections` },
          { icon: <AlertTriangle className="h-5 w-5 text-rose-400" />, label: "High-Risk Runs", value: metrics?.high_risk_runs ?? 0, detail: `${metrics?.errors ?? 0} total errors` },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="panel metric-glow rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</div>
              {card.icon}
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight">{card.value}</div>
            <div className="mt-1.5 text-sm text-slate-400">{card.detail}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Spend Trend Chart */}
        <div className="panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">7-Day Trend</div>
              <h3 className="text-xl font-semibold mt-1">Spend & Reliability</h3>
            </div>
            <Sparkles className="h-4 w-4 text-teal-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="relGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0e1a2e", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
              />
              <Area type="monotone" dataKey="avg_reliability" stroke="#2dd4bf" fill="url(#relGrad)" strokeWidth={2} name="Reliability %" />
              <Area type="monotone" dataKey="runs" stroke="#fb923c" fill="url(#spendGrad)" strokeWidth={2} name="Runs" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="panel rounded-2xl p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-1">Run Status</div>
          <h3 className="text-xl font-semibold mb-4">Distribution</h3>
          {statusPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0e1a2e", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 12, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-slate-500">
              No data yet
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {statusPieData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {item.name} ({item.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="panel rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Latest Activity</div>
            <h3 className="text-xl font-semibold mt-1">Recent Runs</h3>
          </div>
          <Link href="/dashboard/runs" className="text-sm text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentRuns.length === 0 && !loading ? (
          <div className="rounded-xl border border-dashed border-white/8 p-8 text-center text-sm text-slate-400">
            No runs yet. Start the backend, then run <span className="font-mono text-teal-300">python customer_agent.py</span>
          </div>
        ) : (
          <div className="space-y-3">
            {recentRuns.map((run, i) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/dashboard/runs/${run.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/6 bg-white/2 hover:bg-white/4 hover:border-white/12 p-4 transition-all group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500/20 to-violet-500/20 flex items-center justify-center shrink-0">
                      <Cpu className="h-4 w-4 text-teal-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{run.agent_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {run.provider ?? "custom"} · {run.model ?? "unknown"} · {run.event_count} events
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden md:block">
                      <div className="text-sm font-medium">{run.reliability_score.toFixed(1)}%</div>
                      <div className="text-xs text-slate-500">{currency.format(run.spend_total_usd)}</div>
                    </div>
                    <span className={`tag ${classForStatus(run.status)}`}>
                      {run.status.replace(/_/g, " ")}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-teal-400 transition-colors" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

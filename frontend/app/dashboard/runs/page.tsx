"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  Download,
  Filter,
  Search,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_CORDON_API_URL ?? "http://localhost:8000";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

type RunSummary = {
  id: string;
  agent_name: string;
  environment: string;
  provider: string | null;
  model: string | null;
  status: string;
  spend_total_usd: number;
  event_count: number;
  error_count: number;
  chaos_events: number;
  reliability_score: number;
  risk_score: number;
  tags: string[];
  created_at: string;
  completed_at: string | null;
};

function classForStatus(s: string) {
  if (s === "running") return "tag-teal";
  if (s === "killed_by_budget") return "tag-rose";
  if (s === "failed") return "tag-orange";
  return "tag-slate";
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`${API_URL}/api/v1/runs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.items);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchRuns(); }, [statusFilter, search]);

  const deleteRun = async (runId: string) => {
    try {
      await fetch(`${API_URL}/api/v1/runs/${runId}`, { method: "DELETE" });
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch {}
  };

  const exportRun = (runId: string) => {
    window.open(`${API_URL}/api/v1/runs/${runId}/export?format=json`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium tracking-[0.2em] uppercase text-slate-500 mb-1">All Runs</div>
          <h1 className="text-3xl font-bold tracking-tight">Run History</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by agent name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/8 bg-white/3 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          {["", "running", "completed", "failed", "killed_by_budget"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`tag cursor-pointer ${
                statusFilter === s ? "tag-teal" : "tag-slate"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Runs Table */}
      <div className="space-y-2">
        {runs.map((run, i) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="panel rounded-xl hover:border-white/12 transition-all group"
          >
            <div className="flex items-center p-4 gap-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500/20 to-violet-500/20 flex items-center justify-center shrink-0">
                <Cpu className="h-4 w-4 text-teal-300" />
              </div>

              <div className="flex-1 min-w-0">
                <Link href={`/dashboard/runs/${run.id}`} className="font-semibold text-sm hover:text-teal-300 transition-colors truncate block">
                  {run.agent_name}
                </Link>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  {run.provider ?? "custom"} · {run.model ?? "unknown"} · {new Date(run.created_at).toLocaleString()}
                </div>
              </div>

              <div className="hidden lg:grid grid-cols-4 gap-6 text-center shrink-0">
                <div>
                  <div className="text-sm font-semibold">{run.reliability_score.toFixed(1)}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Reliability</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{run.risk_score.toFixed(1)}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Risk</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{currency.format(run.spend_total_usd)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Spend</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{run.event_count}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Events</div>
                </div>
              </div>

              <span className={`tag ${classForStatus(run.status)} shrink-0`}>
                {run.status.replace(/_/g, " ")}
              </span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => exportRun(run.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Export">
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                </button>
                <button onClick={() => deleteRun(run.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors" title="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-rose-400" />
                </button>
                <Link href={`/dashboard/runs/${run.id}`} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              </div>
            </div>
          </motion.div>
        ))}

        {!loading && runs.length === 0 && (
          <div className="panel rounded-xl p-12 text-center">
            <Cpu className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <div className="text-sm text-slate-400">No runs found. Run your agent with the Cordon SDK to see results here.</div>
          </div>
        )}
      </div>
    </div>
  );
}

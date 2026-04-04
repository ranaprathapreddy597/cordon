"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_CORDON_API_URL ?? "http://localhost:8000";
const PIE_COLORS = ["#2dd4bf", "#fb923c", "#a78bfa", "#60a5fa", "#fb7185"];

type TrendItem = { date: string; runs: number; spend: number; avg_reliability: number; errors: number; chaos_events: number; };

export default function AnalyticsPage() {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [modelUsage, setModelUsage] = useState<Record<string, number>>({});
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});
  const [totalRuns, setTotalRuns] = useState(0);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/analytics/trends?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        setTrends(data.trend || []);
        setModelUsage(data.model_usage || {});
        setStatusBreakdown(data.status_breakdown || {});
        setTotalRuns(data.total_runs || 0);
      })
      .catch(() => {});
  }, [days]);

  const modelPieData = Object.entries(modelUsage).map(([name, value]) => ({ name, value }));
  const statusPieData = Object.entries(statusBreakdown).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium tracking-[0.2em] uppercase text-slate-500 mb-1">Intelligence</div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`tag cursor-pointer ${days === d ? "tag-teal" : "tag-slate"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="panel rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Period Runs</div>
          <div className="text-3xl font-bold">{totalRuns}</div>
        </div>
        <div className="panel rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Total Spend</div>
          <div className="text-3xl font-bold">${trends.reduce((s, t) => s + t.spend, 0).toFixed(4)}</div>
        </div>
        <div className="panel rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Total Errors</div>
          <div className="text-3xl font-bold">{trends.reduce((s, t) => s + t.errors, 0)}</div>
        </div>
      </div>

      {/* Trend Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="panel rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-400" /> Runs & Reliability
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="relGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#0e1a2e", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="avg_reliability" stroke="#2dd4bf" fill="url(#relGrad2)" strokeWidth={2} name="Reliability %" />
              <Area type="monotone" dataKey="runs" stroke="#a78bfa" fill="transparent" strokeWidth={2} name="Runs" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-orange-400" /> Errors & Chaos Events
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#0e1a2e", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="errors" fill="#fb7185" radius={[4, 4, 0, 0]} name="Errors" />
              <Bar dataKey="chaos_events" fill="#fb923c" radius={[4, 4, 0, 0]} name="Chaos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="panel rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-4">Model Usage</h3>
          {modelPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={modelPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {modelPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0e1a2e", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2">
                {modelPieData.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {m.name} ({m.value})
                  </div>
                ))}
              </div>
            </>
          ) : <div className="text-sm text-slate-500 text-center py-12">No data</div>}
        </div>

        <div className="panel rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
          {statusPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {statusPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0e1a2e", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2">
                {statusPieData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {s.name} ({s.value})
                  </div>
                ))}
              </div>
            </>
          ) : <div className="text-sm text-slate-500 text-center py-12">No data</div>}
        </div>
      </div>
    </div>
  );
}

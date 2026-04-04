"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_CORDON_API_URL ?? "http://localhost:8000";

type AlertRule = {
  id: number;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  enabled: boolean;
  notify_type: string;
  notify_target: string;
  created_at: string;
};

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("spend");
  const [operator, setOperator] = useState("gt");
  const [threshold, setThreshold] = useState("");

  const fetchRules = () => {
    fetch(`${API_URL}/api/v1/alert-rules`)
      .then((r) => r.json())
      .then((data) => setRules(data.items || []))
      .catch(() => {});
  };

  useEffect(fetchRules, []);

  const createRule = async () => {
    if (!name || !threshold) return;
    try {
      await fetch(`${API_URL}/api/v1/alert-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, metric, operator, threshold: parseFloat(threshold) }),
      });
      setShowForm(false);
      setName("");
      setThreshold("");
      fetchRules();
    } catch {}
  };

  const deleteRule = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/v1/alert-rules/${id}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  };

  const operatorLabels: Record<string, string> = { gt: ">", lt: "<", gte: "≥", lte: "≤", eq: "=" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium tracking-[0.2em] uppercase text-slate-500 mb-1">Monitoring</div>
          <h1 className="text-3xl font-bold tracking-tight">Alert Rules</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
          <Plus className="h-4 w-4" /> New Rule
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="panel rounded-xl p-5 space-y-4">
          <h3 className="text-lg font-semibold">Create Alert Rule</h3>
          <div className="grid md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Rule name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-white/8 bg-white/3 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400/30"
            />
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="rounded-lg border border-white/8 bg-white/3 py-2.5 px-3 text-sm text-white focus:outline-none focus:border-teal-400/30"
            >
              <option value="spend">Spend ($)</option>
              <option value="reliability">Reliability (%)</option>
              <option value="risk">Risk (%)</option>
              <option value="errors">Errors</option>
              <option value="latency">Latency (ms)</option>
            </select>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="rounded-lg border border-white/8 bg-white/3 py-2.5 px-3 text-sm text-white focus:outline-none focus:border-teal-400/30"
            >
              <option value="gt">Greater than</option>
              <option value="lt">Less than</option>
              <option value="gte">Greater or equal</option>
              <option value="lte">Less or equal</option>
            </select>
            <input
              type="number"
              placeholder="Threshold"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="rounded-lg border border-white/8 bg-white/3 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400/30"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={createRule} className="btn-primary text-sm">Create Rule</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="panel rounded-xl p-4 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <div className="font-semibold text-sm">{rule.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  When <span className="text-slate-300">{rule.metric}</span>{" "}
                  <span className="text-orange-300">{operatorLabels[rule.operator]}</span>{" "}
                  <span className="text-white font-semibold">{rule.threshold}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`tag ${rule.enabled ? "tag-teal" : "tag-slate"}`}>{rule.enabled ? "Active" : "Disabled"}</span>
              <button
                onClick={() => deleteRule(rule.id)}
                className="p-1.5 rounded-lg hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-rose-400" />
              </button>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="panel rounded-xl p-12 text-center">
            <AlertTriangle className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <div className="text-sm text-slate-400">No alert rules configured yet.</div>
            <div className="text-xs text-slate-500 mt-1">Create rules to get notified when metrics exceed thresholds.</div>
          </div>
        )}
      </div>
    </div>
  );
}

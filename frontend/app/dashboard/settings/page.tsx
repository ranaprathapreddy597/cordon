"use client";

import { useEffect, useState } from "react";
import { Copy, Key, Plus, Trash2, CheckCircle2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_CORDON_API_URL ?? "http://localhost:8000";

type ApiKeyItem = {
  id: number;
  name: string;
  key_prefix: string;
  raw_key?: string;
  revoked: boolean;
  last_used_at: string | null;
  created_at: string;
};

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchKeys = () => {
    fetch(`${API_URL}/api/v1/api-keys`)
      .then((r) => r.json())
      .then((data) => setKeys(data.items || []))
      .catch(() => {});
  };

  useEffect(fetchKeys, []);

  const createKey = async () => {
    if (!newKeyName) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      setNewlyCreatedKey(data.raw_key);
      setShowForm(false);
      setNewKeyName("");
      fetchKeys();
    } catch {}
  };

  const revokeKey = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/v1/api-keys/${id}`, { method: "DELETE" });
      fetchKeys();
    } catch {}
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-medium tracking-[0.2em] uppercase text-slate-500 mb-1">Configuration</div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* API Keys Section */}
      <div className="panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Key className="h-5 w-5 text-teal-400" /> API Keys
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Use API keys to authenticate your SDK with the Cordon backend.
            </p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> New Key
          </button>
        </div>

        {/* Newly created key warning */}
        {newlyCreatedKey && (
          <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-4 mb-4">
            <div className="text-sm font-semibold text-teal-300 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> API Key Created
            </div>
            <div className="text-xs text-slate-400 mb-3">
              Copy this key now — you will not be able to see it again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-sm font-mono text-teal-200 break-all">
                {newlyCreatedKey}
              </code>
              <button
                onClick={() => copyKey(newlyCreatedKey)}
                className="btn-secondary text-xs shrink-0"
              >
                {copiedKey ? <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Key name (e.g., Production SDK)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 rounded-lg border border-white/8 bg-white/3 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400/30"
            />
            <button onClick={createKey} className="btn-primary text-sm">Create</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        )}

        {/* Keys list */}
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/2 p-3 group">
              <div className="flex items-center gap-3">
                <Key className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-sm font-medium">{key.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    {key.key_prefix}...
                    {key.last_used_at && <span> · Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {key.revoked ? (
                  <span className="tag tag-rose">Revoked</span>
                ) : (
                  <span className="tag tag-teal">Active</span>
                )}
                {!key.revoked && (
                  <button
                    onClick={() => revokeKey(key.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-rose-400" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {keys.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-8">
              No API keys yet. Create one to authenticate SDK requests.
            </div>
          )}
        </div>
      </div>

      {/* SDK Configuration Guide */}
      <div className="panel rounded-xl p-5">
        <h2 className="text-xl font-semibold mb-4">SDK Configuration</h2>
        <div className="code-block text-[13px]">
          <div className="comment"># Set your API key as an environment variable</div>
          <div><span className="keyword">export</span> CORDON_API_KEY=<span className="string">&quot;crd_your_key_here&quot;</span></div>
          <div><span className="keyword">export</span> CORDON_BACKEND_URL=<span className="string">&quot;{API_URL}&quot;</span></div>
          <br />
          <div className="comment"># Or pass it directly in code</div>
          <div><span className="keyword">import</span> cordon</div>
          <div>cordon.<span className="func">init</span>(</div>
          <div>    agent_name=<span className="string">&quot;My Agent&quot;</span>,</div>
          <div>    api_key=<span className="string">&quot;crd_your_key_here&quot;</span>,</div>
          <div>    provider=<span className="string">&quot;openai&quot;</span>,</div>
          <div>    model=<span className="string">&quot;gpt-4.1-mini&quot;</span>,</div>
          <div>)</div>
          <div>cordon.<span className="func">patch_openai</span>()</div>
        </div>
      </div>

      {/* Environment Variables Reference */}
      <div className="panel rounded-xl p-5">
        <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
        <div className="space-y-1">
          {[
            { name: "CORDON_API_KEY", desc: "API key for authenticated SDK requests" },
            { name: "CORDON_BACKEND_URL", desc: "Cordon backend URL (default: http://localhost:8000)" },
            { name: "CORDON_AGENT_NAME", desc: "Default agent name for runs" },
            { name: "CORDON_PROVIDER", desc: "LLM provider (openai, anthropic, google)" },
            { name: "CORDON_MODEL", desc: "Model name (gpt-4.1-mini, etc.)" },
            { name: "CORDON_BUDGET_LIMIT_USD", desc: "Max spend per run in USD" },
            { name: "CORDON_MAX_STEPS", desc: "Max events before kill switch fires" },
            { name: "CORDON_CHAOS_ENABLED", desc: "Enable chaos injection (true/false)" },
            { name: "CORDON_CHAOS_TOOL_ERROR_RATE", desc: "Probability of injecting tool failures (0-1)" },
            { name: "CORDON_CHAOS_PROMPT_INJECTION_RATE", desc: "Probability of injecting malicious prompts (0-1)" },
          ].map((env) => (
            <div key={env.name} className="flex items-start gap-3 py-2 border-b border-white/4 last:border-0">
              <code className="text-xs font-mono text-teal-300 bg-teal-400/5 px-2 py-0.5 rounded shrink-0">{env.name}</code>
              <span className="text-xs text-slate-400">{env.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

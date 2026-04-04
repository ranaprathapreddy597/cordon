"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Binary,
  BookOpen,
  Code2,
  Copy,
  GitBranch,
  Globe,
  Layers,
  Shield,
  Sparkles,
  Terminal,
  Timer,
  Wallet,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

import type { Easing } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as Easing },
  }),
};

export default function LandingPage() {
  const [copied, setCopied] = useState(false);

  const copyInstall = () => {
    navigator.clipboard.writeText("pip install cordon");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen">
      {/* --- Navigation --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#06090f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-teal-400" />
            <span className="text-lg font-bold tracking-tight">Cordon</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#sdk" className="hover:text-white transition-colors">SDK</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="btn-secondary text-sm">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* --- Hero --- */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-violet-500/6 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          className="mx-auto max-w-4xl text-center relative z-10"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/8 px-4 py-1.5 text-xs font-medium tracking-widest uppercase text-teal-300 mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            Open Source · Agentic SRE · FinOps
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent">
            Crash-test your AI agents before they crash your business
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Cordon is the open-source reliability control plane for AI agents.
            Trace every tool call, inject chaos, score reliability, and kill runaway
            spend — all before your agent touches production.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="btn-primary text-base px-7 py-3.5">
              Open Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button onClick={copyInstall} className="btn-secondary text-base px-6 py-3.5 font-mono">
              <Terminal className="h-4 w-4" />
              pip install cordon
              {copied ? (
                <span className="text-teal-400 text-xs ml-1">Copied!</span>
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-500 ml-1" />
              )}
            </button>
          </motion.div>

          {/* Stats bar */}
          <motion.div variants={fadeUp} custom={4} className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: "3 Lines", label: "To Integrate SDK" },
              { value: "$0", label: "Infrastructure Cost" },
              { value: "20+", label: "API Endpoints" },
              { value: "100%", label: "Open Source" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* --- Features Grid --- */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="text-xs font-medium tracking-[0.25em] uppercase text-teal-400 mb-4">Platform Features</div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Everything your agents need to fail safely</h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">No other platform combines chaos engineering, FinOps protection, and agent tracing in one open-source tool.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Wallet className="h-5 w-5" />, color: "text-orange-400", title: "FinOps Kill Switch", desc: "Set spend limits. Cordon auto-kills your agent the moment it exceeds budget — preventing $10K OpenAI bills overnight." },
              { icon: <Zap className="h-5 w-5" />, color: "text-rose-400", title: "Chaos Engineering", desc: "Inject fake API failures, network timeouts, and prompt injections to stress-test your agent's error handling." },
              { icon: <Activity className="h-5 w-5" />, color: "text-teal-400", title: "Execution Trace", desc: "Full OODA-loop timeline showing every thought, tool call, and decision your agent makes — with cost per step." },
              { icon: <Shield className="h-5 w-5" />, color: "text-violet-400", title: "PII Redaction", desc: "Automatic detection and masking of emails, phone numbers, credit cards, and secrets in prompts and responses." },
              { icon: <BarChart3 className="h-5 w-5" />, color: "text-blue-400", title: "Reliability Scoring", desc: "Every run gets a composite reliability score and risk assessment with actionable recommendations." },
              { icon: <Timer className="h-5 w-5" />, color: "text-orange-400", title: "Time-Travel Replay", desc: "Rewind to any step in your agent's execution. See the exact state, spend, and error count at each point." },
              { icon: <AlertTriangle className="h-5 w-5" />, color: "text-rose-400", title: "Alert Rules", desc: "Set custom thresholds for spend, reliability, errors, or latency. Get notified before problems escalate." },
              { icon: <Layers className="h-5 w-5" />, color: "text-teal-400", title: "Run Comparison", desc: "Side-by-side diff of any two runs. See exactly what changed between agent versions or configurations." },
              { icon: <Globe className="h-5 w-5" />, color: "text-violet-400", title: "Export & Compliance", desc: "Export runs as JSON or CSV for audit trails. SOC2-ready compliance logs for enterprise AI governance." },
            ].map((feature) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="panel rounded-2xl p-6 hover:border-white/15 transition-all group"
              >
                <div className={`${feature.color} mb-4`}>{feature.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- How It Works --- */}
      <section id="how-it-works" className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <div className="text-xs font-medium tracking-[0.25em] uppercase text-teal-400 mb-4">How It Works</div>
            <h2 className="text-4xl font-bold tracking-tight">Three lines. Full observability.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Install the SDK",
                desc: "Add Cordon to your project with pip install cordon. Works with any Python agent framework.",
                icon: <Code2 className="h-5 w-5 text-teal-400" />,
              },
              {
                step: "02",
                title: "Patch your LLM",
                desc: "Call cordon.patch_openai() to auto-trace all API calls. Zero code changes to your agent.",
                icon: <Binary className="h-5 w-5 text-violet-400" />,
              },
              {
                step: "03",
                title: "Watch the dashboard",
                desc: "See every event, cost, and reliability score in real-time on the Cordon web dashboard.",
                icon: <BarChart3 className="h-5 w-5 text-orange-400" />,
              },
            ].map((item) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: parseInt(item.step) * 0.1 }}
                className="relative"
              >
                <div className="text-6xl font-black text-white/5 absolute -top-4 -left-2">{item.step}</div>
                <div className="relative z-10 pt-8">
                  <div className="mb-3">{item.icon}</div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- SDK Code Example --- */}
      <section id="sdk" className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-medium tracking-[0.25em] uppercase text-teal-400 mb-4">Developer Experience</div>
              <h2 className="text-4xl font-bold tracking-tight mb-4">Two lines to instrument. Zero to maintain.</h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Cordon auto-patches OpenAI and Anthropic SDKs. Every call is traced, costed, and
                protected by your budget policy. If the agent goes rogue, the kill switch fires.
              </p>
              <div className="space-y-3 text-sm">
                {[
                  "Auto-patch OpenAI, Anthropic, and Google SDKs",
                  "@cordon.trace decorator for custom functions",
                  "Budget kill switch with 3 configurable limits",
                  "Chaos injection for resilience testing",
                  "API key auth for secure cloud deployments",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="code-block text-[13px]">
              <div className="text-slate-500 mb-3"># That&apos;s it. 3 lines. Full observability.</div>
              <div><span className="keyword">import</span> cordon</div>
              <div><span className="keyword">import</span> openai</div>
              <br />
              <div className="text-slate-500"># Initialize Cordon with your agent name</div>
              <div>cordon.<span className="func">init</span>(</div>
              <div>    <span className="string">agent_name</span>=<span className="string">&quot;Customer Support Bot&quot;</span>,</div>
              <div>    <span className="string">provider</span>=<span className="string">&quot;openai&quot;</span>,</div>
              <div>    <span className="string">model</span>=<span className="string">&quot;gpt-4.1-mini&quot;</span>,</div>
              <div>)</div>
              <br />
              <div className="text-slate-500"># Auto-trace ALL OpenAI calls</div>
              <div>cordon.<span className="func">patch_openai</span>()</div>
              <br />
              <div className="text-slate-500"># Your code stays exactly the same</div>
              <div>client = openai.<span className="func">OpenAI</span>()</div>
              <div>response = client.chat.completions.<span className="func">create</span>(</div>
              <div>    model=<span className="string">&quot;gpt-4.1-mini&quot;</span>,</div>
              <div>    messages=[&#123;<span className="string">&quot;role&quot;</span>: <span className="string">&quot;user&quot;</span>, <span className="string">&quot;content&quot;</span>: <span className="string">&quot;Hello&quot;</span>&#125;],</div>
              <div>)</div>
              <br />
              <div className="text-teal-400/70"># ✓ Traced  ✓ Costed  ✓ Budget-protected  ✓ PII-redacted</div>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA --- */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Stop hoping your agents work.
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-violet-400 bg-clip-text text-transparent">Start proving it.</span>
          </h2>
          <p className="text-slate-400 mb-10 max-w-lg mx-auto">
            Open source. Free forever. Built for the developers building the future.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="btn-primary text-base px-8 py-3.5">
              Launch Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/ranaprathapreddy597/cordon"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-base px-6 py-3.5"
            >
              <GitBranch className="h-4 w-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-teal-400" />
            <span className="font-semibold text-slate-300">Cordon</span>
            <span>· Agent Reliability Control Plane</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/ranaprathapreddy597/cordon" className="hover:text-white transition-colors">GitHub</a>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

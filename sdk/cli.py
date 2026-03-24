from __future__ import annotations

import argparse
import os
import subprocess
import sys

import requests


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run local agents under Cordon policy controls.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    doctor = subparsers.add_parser("doctor", help="Check backend connectivity.")
    doctor.add_argument("--backend-url", default=os.getenv("CORDON_BACKEND_URL", "http://localhost:8000"))

    run = subparsers.add_parser("run", help="Run a Python script under Cordon.")
    run.add_argument("target", help="Path to a Python script or module name when using --module.")
    run.add_argument("target_args", nargs=argparse.REMAINDER, help="Arguments forwarded to the target.")
    run.add_argument("--module", action="store_true", help="Execute the target as a Python module.")
    run.add_argument("--backend-url", default=os.getenv("CORDON_BACKEND_URL", "http://localhost:8000"))
    run.add_argument("--agent-name", default=os.getenv("CORDON_AGENT_NAME", "Cordon Agent"))
    run.add_argument("--provider", default=os.getenv("CORDON_PROVIDER"))
    run.add_argument("--model", default=os.getenv("CORDON_MODEL"))
    run.add_argument("--budget-limit-usd", type=float, default=float(os.getenv("CORDON_BUDGET_LIMIT_USD", "3.0")))
    run.add_argument("--max-steps", type=int, default=int(os.getenv("CORDON_MAX_STEPS", "200")))
    run.add_argument("--max-runtime-seconds", type=int, default=int(os.getenv("CORDON_MAX_RUNTIME_SECONDS", "900")))
    run.add_argument("--tags", default=os.getenv("CORDON_TAGS", ""))
    run.add_argument("--chaos-enabled", action="store_true")
    run.add_argument("--tool-error-rate", type=float, default=float(os.getenv("CORDON_CHAOS_TOOL_ERROR_RATE", "0.0")))
    run.add_argument("--llm-error-rate", type=float, default=float(os.getenv("CORDON_CHAOS_LLM_ERROR_RATE", "0.0")))
    run.add_argument("--latency-jitter-ms", type=int, default=int(os.getenv("CORDON_CHAOS_LATENCY_JITTER_MS", "0")))
    run.add_argument("--prompt-injection-rate", type=float, default=float(os.getenv("CORDON_CHAOS_PROMPT_INJECTION_RATE", "0.0")))
    return parser


def _command_doctor(args: argparse.Namespace) -> int:
    try:
        response = requests.get(f"{args.backend_url.rstrip('/')}/health", timeout=5)
        response.raise_for_status()
    except requests.RequestException as exc:
        print(f"Backend unavailable: {exc}")
        return 1

    payload = response.json()
    print(f"Connected to {payload['service']} ({payload['environment']})")
    return 0


def _command_run(args: argparse.Namespace) -> int:
    env = os.environ.copy()
    env["CORDON_BACKEND_URL"] = args.backend_url
    env["CORDON_AGENT_NAME"] = args.agent_name
    env["CORDON_BUDGET_LIMIT_USD"] = str(args.budget_limit_usd)
    env["CORDON_MAX_STEPS"] = str(args.max_steps)
    env["CORDON_MAX_RUNTIME_SECONDS"] = str(args.max_runtime_seconds)
    env["CORDON_TAGS"] = args.tags
    env["CORDON_CHAOS_ENABLED"] = "true" if args.chaos_enabled else env.get("CORDON_CHAOS_ENABLED", "false")
    env["CORDON_CHAOS_TOOL_ERROR_RATE"] = str(args.tool_error_rate)
    env["CORDON_CHAOS_LLM_ERROR_RATE"] = str(args.llm_error_rate)
    env["CORDON_CHAOS_LATENCY_JITTER_MS"] = str(args.latency_jitter_ms)
    env["CORDON_CHAOS_PROMPT_INJECTION_RATE"] = str(args.prompt_injection_rate)
    if args.provider:
        env["CORDON_PROVIDER"] = args.provider
    if args.model:
        env["CORDON_MODEL"] = args.model

    command = [sys.executable]
    if args.module:
        command.extend(["-m", args.target])
    else:
        command.append(args.target)
    command.extend(args.target_args)
    return subprocess.run(command, env=env, check=False).returncode


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    if args.command == "doctor":
        return _command_doctor(args)
    if args.command == "run":
        return _command_run(args)
    parser.error("Unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

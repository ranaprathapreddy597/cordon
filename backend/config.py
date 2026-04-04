from __future__ import annotations

import os
from pathlib import Path


def _default_database_url() -> str:
    data_dir = Path(__file__).resolve().parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{(data_dir / 'cordon.db').as_posix()}"


class Settings:
    app_name = "Cordon Control Plane"
    version = "1.0.0"
    api_prefix = "/api/v1"
    environment = os.getenv("CORDON_ENVIRONMENT", "development")
    database_url = os.getenv("CORDON_DATABASE_URL", _default_database_url())
    default_budget_limit_usd = float(os.getenv("CORDON_DEFAULT_BUDGET_LIMIT_USD", "3.0"))
    default_max_steps = int(os.getenv("CORDON_DEFAULT_MAX_STEPS", "200"))
    default_runtime_limit_seconds = int(os.getenv("CORDON_DEFAULT_RUNTIME_LIMIT_SECONDS", "900"))
    enable_redaction = os.getenv("CORDON_ENABLE_REDACTION", "true").lower() != "false"
    cors_origins = [
        origin.strip()
        for origin in os.getenv(
            "CORDON_CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001",
        ).split(",")
        if origin.strip()
    ]

    # Supabase configuration
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")

    # Auth mode: "supabase" for production, "open" for local dev without auth
    auth_mode = os.getenv("CORDON_AUTH_MODE", "open")


settings = Settings()

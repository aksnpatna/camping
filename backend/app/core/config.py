import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET_KEY = "dev-secret-key"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Camp Smart Australia API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://realestate_user:realestate_pass@localhost:15432/camping_db")
    LOCAL_LLM_URL: str = os.getenv("LOCAL_LLM_URL", "http://localhost:8002/v1")
    LOCAL_LLM_MODEL: str = os.getenv("LOCAL_LLM_MODEL", "qwen3:9b")

    # Email delivery transport.
    #   "smtp"   -> real delivery via the SMTP settings below
    #   "outbox" -> explicit dev/test mode: recorded for inspection, NOT delivered
    #   "none"   -> no transport configured; nothing leaves the process
    # Delivery status must never be reported as SENT unless transport is "smtp"
    # and the send actually succeeded.
    EMAIL_TRANSPORT: str = os.getenv("EMAIL_TRANSPORT", "none").strip().lower()
    SMTP_HOST: Optional[str] = os.getenv("SMTP_HOST", None)
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: Optional[str] = os.getenv("SMTP_USER", None)
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD", None)
    SMTP_FROM: str = os.getenv("SMTP_FROM", "alerts@smartcampingau.com")

    SECRET_KEY: str = os.getenv("SECRET_KEY", DEV_SECRET_KEY)
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").strip().lower()
    MAGIC_TOKEN_TTL_MINUTES: int = int(os.getenv("MAGIC_TOKEN_TTL_MINUTES", "30"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://smartcampingau.com")

    # Smartproxy / HTTP Proxy for data harvesting
    PROXY_URL: Optional[str] = os.getenv("PROXY_URL", None)

    # --- Security / abuse protection -------------------------------------
    # Admin credential for owner-only endpoints (analytics, campsite create).
    # Unset => those endpoints are closed to everyone (fail closed).
    ADMIN_KEY: Optional[str] = os.getenv("ADMIN_KEY", None)

    # Comma separated browser origins allowed by CORS. FRONTEND_URL is always
    # included. The browser normally talks to the same-origin /api proxy, so
    # this list can stay short.
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3021,http://127.0.0.1:3021"
    )

    # OpenAPI docs expose the full attack surface; off unless explicitly enabled.
    ENABLE_DOCS: bool = os.getenv("ENABLE_DOCS", "").strip().lower() in ("1", "true", "yes")

    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").strip().lower() not in ("0", "false", "no")
    # Per-client-IP ceiling across the whole API (requests per window).
    GLOBAL_RATE_LIMIT: int = int(os.getenv("GLOBAL_RATE_LIMIT", "120"))
    GLOBAL_RATE_WINDOW_SECONDS: int = int(os.getenv("GLOBAL_RATE_WINDOW_SECONDS", "60"))
    # Rejections inside the strike window before an IP is banned outright.
    BAN_STRIKE_THRESHOLD: int = int(os.getenv("BAN_STRIKE_THRESHOLD", "30"))
    BAN_STRIKE_WINDOW_SECONDS: int = int(os.getenv("BAN_STRIKE_WINDOW_SECONDS", "600"))
    BAN_DURATION_SECONDS: int = int(os.getenv("BAN_DURATION_SECONDS", "900"))
    MAX_BODY_BYTES: int = int(os.getenv("MAX_BODY_BYTES", "65536"))

    # Peers whose X-Forwarded-For / CF-Connecting-IP we believe (our own
    # reverse proxy / Docker network). Anyone else cannot spoof their address.
    TRUSTED_PROXY_CIDRS: str = os.getenv(
        "TRUSTED_PROXY_CIDRS",
        "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::1/128",
    )

    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "10"))

    @property
    def allowed_origins_list(self) -> list:
        origins = [o.strip().rstrip("/") for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        frontend = (self.FRONTEND_URL or "").strip().rstrip("/")
        if frontend in origins:
            origins.remove(frontend)
        if frontend:
            origins.insert(0, frontend)
        return origins

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT in ("production", "prod")

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")


settings = Settings()

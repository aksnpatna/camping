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
    SMTP_FROM: str = os.getenv("SMTP_FROM", "alerts@campsmart.au")

    SECRET_KEY: str = os.getenv("SECRET_KEY", DEV_SECRET_KEY)
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").strip().lower()
    MAGIC_TOKEN_TTL_MINUTES: int = int(os.getenv("MAGIC_TOKEN_TTL_MINUTES", "30"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://camping.akstest.win")

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")


settings = Settings()

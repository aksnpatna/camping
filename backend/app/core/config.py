import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Camp Smart Australia API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://realestate_user:realestate_pass@localhost:15432/camping_db")
    LOCAL_LLM_URL: str = os.getenv("LOCAL_LLM_URL", "http://localhost:8002/v1")
    LOCAL_LLM_MODEL: str = os.getenv("LOCAL_LLM_MODEL", "qwen3:9b")
    
    SMTP_HOST: Optional[str] = os.getenv("SMTP_HOST", None)
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: Optional[str] = os.getenv("SMTP_USER", None)
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD", None)
    SMTP_FROM: str = os.getenv("SMTP_FROM", "alerts@campsmart.au")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://camping.akstest.win")

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")

settings = Settings()



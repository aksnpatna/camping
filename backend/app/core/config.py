import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Camp Smart Australia API"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://realestate_user:realestate_pass@localhost:15432/camping_db")
    LOCAL_LLM_URL: str = os.getenv("LOCAL_LLM_URL", "http://localhost:8002/v1")
    LOCAL_LLM_MODEL: str = os.getenv("LOCAL_LLM_MODEL", "qwen3:9b")
    
    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")

settings = Settings()


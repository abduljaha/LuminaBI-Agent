import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "LuminaBI - Autonomous AI Data Intelligence"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "DEV_SECRET_KEY"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    DATABASE_URL: str = "sqlite:///./data_analyst.db"
    
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_MODEL: str = "nvidia/nemotron-3.5-lightning:free"
    
    MAX_AGENT_RETRIES: int = 2

    class Config:
        env_file = ".env"

settings = Settings()

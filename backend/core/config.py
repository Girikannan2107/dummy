import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "Intelligent Document Processing API"
    API_V1_STR: str = "/api/v1"
    UPLOAD_DIR: str = "uploads"
    
    # API Keys
    GEMINI_API_KEY: Optional[str] = None
    
    # Database Settings
    MONGO_URI: str = Field(default="mongodb://localhost:27017", validation_alias="MONGODB_URI")
    MONGO_DB_NAME: str = "industrial_ocr"

    @property
    def DB_NAME(self) -> str:
        return self.MONGO_DB_NAME

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

# Ensure the upload directory exists when the app starts
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/invoice_reconciliation"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    # Scoring weights
    amount_exact_weight: float = 0.4
    amount_close_weight: float = 0.2
    date_proximity_weight: float = 0.3
    text_similarity_weight: float = 0.3
    
    # Tolerances
    amount_tolerance_percent: float = 2.0
    date_proximity_days: int = 3
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
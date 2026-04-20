from pydantic_settings import BaseSettings
from typing import Optional
import ssl

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vedameet API"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "super_secret_key_change_in_production_1234567890"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Database – these will be overridden by Render environment variables
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = "root"
    MYSQL_SERVER: str = "localhost"
    MYSQL_PORT: str = "3306"
    MYSQL_DB: str = "vedameet"

    # SSL certificate path (only needed for Aiven / cloud MySQL)
    SSL_CA_PATH: Optional[str] = None

    REDIS_URL: str = "redis://localhost:6379/0"
    JANUS_API_URL: str = "http://localhost:8088/janus"

    @property
    def sync_database_url(self) -> str:
        """Sync URL – without SSL params (SSL will be handled via connect_args)"""
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_SERVER}:{self.MYSQL_PORT}/{self.MYSQL_DB}"

    @property
    def async_database_url(self) -> str:
        """Async URL – without SSL params"""
        return f"mysql+aiomysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_SERVER}:{self.MYSQL_PORT}/{self.MYSQL_DB}"

    @property
    def ssl_context(self) -> Optional[ssl.SSLContext]:
        """Returns an SSL context if SSL_CA_PATH is provided, else None"""
        if self.SSL_CA_PATH:
            ctx = ssl.create_default_context(cafile=self.SSL_CA_PATH)
            return ctx
        return None

    @property
    def connect_args(self) -> dict:
        """Returns connection arguments for SQLAlchemy engine (handles SSL)"""
        if self.ssl_context:
            return {"ssl": self.ssl_context}
        return {}

    class Config:
        env_file = ".env"

settings = Settings()

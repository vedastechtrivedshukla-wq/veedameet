from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vedameet API"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "super_secret_key_change_in_production_1234567890"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Database – these will be overridden by Render environment variables
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = "root"
    MYSQL_SERVER: str = "localhost"        # Override with Aiven host on Render
    MYSQL_PORT: str = "3306"
    MYSQL_DB: str = "vedameet"

    # SSL certificate path (only needed for Aiven / cloud MySQL)
    SSL_CA_PATH: Optional[str] = None      # Set to "./ca.pem" on Render

    REDIS_URL: str = "redis://localhost:6379/0"
    JANUS_API_URL: str = "http://localhost:8088/janus"

    @property
    def sync_database_url(self) -> str:
        """Returns connection URL with SSL if a CA certificate is provided."""
        base_url = f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_SERVER}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
        if self.SSL_CA_PATH:
            # Append SSL parameter (pymysql understands ?ssl_ca=...)
            return f"{base_url}?ssl_ca={self.SSL_CA_PATH}"
        return base_url

    @property
    def async_database_url(self) -> str:
        """Same for async driver (aiomysql)."""
        base_url = f"mysql+aiomysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_SERVER}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
        if self.SSL_CA_PATH:
            return f"{base_url}?ssl_ca={self.SSL_CA_PATH}"
        return base_url

    class Config:
        env_file = ".env"

settings = Settings()

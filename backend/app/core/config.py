from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vedameet API"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "super_secret_key_change_in_production_1234567890" # TODO: Load from env
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days for dev

    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = "root"
    MYSQL_SERVER: str = "localhost" # "mysql" in docker
    MYSQL_PORT: str = "3306"
    MYSQL_DB: str = "vedameet"

    REDIS_URL: str = "redis://localhost:6379/0" # "redis://redis:6379/0" in docker
    JANUS_API_URL: str = "http://localhost:8088/janus" # "http://janus:8088/janus" in docker

    @property
    def sync_database_url(self) -> str:
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_SERVER}:{self.MYSQL_PORT}/{self.MYSQL_DB}"
    
    @property
    def async_database_url(self) -> str:
        return f"mysql+aiomysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_SERVER}:{self.MYSQL_PORT}/{self.MYSQL_DB}"

    class Config:
        env_file = ".env"

settings = Settings()

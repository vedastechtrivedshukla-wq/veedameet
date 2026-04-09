from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

from app.routes import auth, meetings, websockets
from app.websockets.redis_manager import pubsub_manager

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import sqlalchemy
from app.database import engine, Base, settings
from app.models.user import User
from app.models.meeting import Meeting

@app.on_event("startup")
async def startup_event():
    print(f"--- Starting Vedameet API ---")
    print(f"Connecting to MySQL at {settings.MYSQL_SERVER}:{settings.MYSQL_PORT}...")
    
    # 1. Ensure the database itself exists (SQLAlchemy won't create it for us)
    try:
        # Create a temporary engine to connect to the server (not the specific DB)
        root_url = f"mysql+pymysql://{settings.MYSQL_USER}:{settings.MYSQL_PASSWORD}@{settings.MYSQL_SERVER}:{settings.MYSQL_PORT}"
        temp_engine = sqlalchemy.create_engine(root_url)
        with temp_engine.connect() as conn:
            conn.execute(sqlalchemy.text(f"CREATE DATABASE IF NOT EXISTS {settings.MYSQL_DB}"))
        temp_engine.dispose()
        print(f"Successfully ensured database '{settings.MYSQL_DB}' exists.")
    except Exception as e:
        print(f"Warning: Could not create database automatically: {e}")
        print("Continuing anyway, assuming it exists...")

    # 2. Create tables if they don't exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"CRITICAL ERROR during table creation: {e}")
    
    await pubsub_manager.connect()
    print("Redis connected. Startup complete.")

@app.on_event("shutdown")
async def shutdown_event():
    await pubsub_manager.disconnect()

@app.get("/")
async def root():
    return {"message": "Welcome to Vedameet API"}

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(meetings.router, prefix=f"{settings.API_V1_STR}/meetings", tags=["meetings"])
app.include_router(websockets.router, prefix="/ws", tags=["websockets"])

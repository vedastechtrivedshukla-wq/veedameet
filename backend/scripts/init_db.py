import asyncio
import sys
import os

# Add the parent directory to sys.path to allow importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base
from app.models.user import User
from app.models.meeting import Meeting, MeetingParticipant

async def init_db():
    print("Creating database tables...")
    async with engine.begin() as conn:
        # Import all models here to ensure they are registered with Base.metadata
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db())

import uuid
import random
import string
import os
import shutil
from datetime import datetime
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.meeting import Meeting, MeetingParticipant
from app.models.user import User
from app.api import deps
from app.schemas.meeting import MeetingCreate, MeetingResponse, MeetingParticipantResponse
from app.services.janus import janus_client

router = APIRouter()

def generate_meeting_id() -> str:
    """Generate a format like abc-defg-hij"""
    def r(n): return ''.join(random.choices(string.ascii_lowercase, k=n))
    return f"{r(3)}-{r(4)}-{r(3)}"

@router.post("/", response_model=MeetingResponse)
async def create_meeting(
    meeting_in: MeetingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Create new meeting session"""
    janus_room_id = None
    try:
        session_id = await janus_client.create_session()
        handle_id = await janus_client.attach_plugin(session_id)
        janus_room_id = await janus_client.create_room(session_id, handle_id)
        await janus_client.destroy_session(session_id)
    except Exception as e:
        print(f"Janus room creation failed: {e}")

    meeting = Meeting(
        title=meeting_in.title,
        host_id=current_user.id,
        meeting_id=generate_meeting_id(),
        janus_room_id=janus_room_id,
        is_active=True
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    
    # Reload with host relationship
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.host)).filter(Meeting.id == meeting.id)
    )
    return result.scalars().first()

@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Get meeting details by its short string ID."""
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.host)).filter(Meeting.meeting_id == meeting_id)
    )
    meeting = result.scalars().first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting

@router.put("/{meeting_id}/end", response_model=MeetingResponse)
async def end_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """End meeting (only host can do this)."""
    result = await db.execute(select(Meeting).filter(Meeting.meeting_id == meeting_id))
    meeting = result.scalars().first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if meeting.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    meeting.is_active = False
    await db.commit()
    await db.refresh(meeting)
    return meeting

@router.post("/{meeting_id}/recordings")
async def upload_recording(
    meeting_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """Upload a meeting recording."""
    # Create uploads directory if it doesn't exist
    upload_dir = os.path.join(os.getcwd(), "uploads", "recordings")
    os.makedirs(upload_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{meeting_id}_{timestamp}.webm"
    file_path = os.path.join(upload_dir, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save recording: {e}")
        
    return {"message": "Recording uploaded successfully", "filename": filename}


import uuid
import random
import string
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
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

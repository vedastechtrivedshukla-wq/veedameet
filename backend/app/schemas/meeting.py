from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.user import UserResponse

class MeetingBase(BaseModel):
    title: str

class MeetingCreate(MeetingBase):
    pass

class MeetingResponse(MeetingBase):
    id: int
    meeting_id: str
    janus_room_id: Optional[int] = None
    host_id: int
    is_active: bool
    created_at: datetime
    host: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class MeetingParticipantResponse(BaseModel):
    id: int
    meeting_id: int
    user_id: int
    role: str
    joined_at: datetime
    left_at: Optional[datetime] = None
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class AudioTrackResponse(BaseModel):
    id: int
    meeting_id: int
    user_id: int
    gcs_url: str
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

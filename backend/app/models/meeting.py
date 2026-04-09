from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(255), unique=True, index=True, nullable=False) # Short unique URL code (e.g. abc-defp-xyz)
    janus_room_id = Column(BigInteger, unique=True, index=True) # Numeric ID for Janus VideoRoom
    host_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    host = relationship("User")


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String(50), default="participant") # host, co-host, participant
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    left_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    meeting = relationship("Meeting")

import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.websockets.connection_manager import manager
from app.websockets.redis_manager import pubsub_manager
from app.core.config import settings
from app.core import security
from app.database import get_db
from app.models.user import User

router = APIRouter()

async def get_ws_user(token: str):
    """Decode the JWT token and fetch the real user from the DB."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return None

    # Open a short-lived DB session to fetch the user
    async for db in get_db():
        result = await db.execute(select(User).filter(User.id == user_id))
        user = result.scalars().first()
        if user:
            return {"id": user.id, "email": user.email, "name": user.full_name or user.email}
    return None

@router.websocket("/{meeting_id}")
async def meeting_websocket(websocket: WebSocket, meeting_id: str, token: str = None):
    # 1. Auth check — decode JWT and get real user
    user = await get_ws_user(token)
    if not user:
        await websocket.close(code=1008)
        return
        
    await manager.connect(websocket, meeting_id, user)
    
    # 2. Handle incoming client messages
    try:
        # A. Send the current participant list to the JUST JOINED user
        # This ensures they know about the host and others already in the room
        participants = manager.get_participants(meeting_id)
        # Filter out self-info to avoid redundancy
        others = [p for p in participants if p["id"] != user["id"]]
        
        await websocket.send_text(json.dumps({
            "event": "participant_list",
            "participants": others,
            "meeting_id": meeting_id
        }))

        # B. Notify all participants that this user has joined
        join_msg = {
            "event": "user_joined",
            "user_id": user["id"],
            "user_name": user["name"],
            "user_email": user["email"],
            "meeting_id": meeting_id,
        }
        await manager.broadcast_to_meeting(meeting_id, join_msg)

        while True:
            data = await websocket.receive_text()
            # Broadcast to everyone in the local dict
            parsed = json.loads(data)
            parsed["sender_id"] = user["id"]
            parsed["sender_name"] = user["name"]
            await manager.broadcast_to_meeting(meeting_id, parsed)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, meeting_id)
        leave_msg = {
            "event": "user_left",
            "user_id": user["id"],
            "user_name": user["name"],
            "meeting_id": meeting_id,
        }
        await manager.broadcast_to_meeting(meeting_id, leave_msg)

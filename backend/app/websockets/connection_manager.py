import json
from typing import Dict, List
from fastapi import WebSocket
from app.websockets.redis_manager import pubsub_manager

class ConnectionManager:
    def __init__(self):
        # meeting_id -> list of WebSockets connected to this instance
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, meeting_id: str):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []
        self.active_connections[meeting_id].append(websocket)
        
    def disconnect(self, websocket: WebSocket, meeting_id: str):
        if meeting_id in self.active_connections:
            if websocket in self.active_connections[meeting_id]:
                self.active_connections[meeting_id].remove(websocket)
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]
                
    async def broadcast_to_meeting(self, meeting_id: str, message: dict):
        """Send message to all local connections in the meeting."""
        if meeting_id in self.active_connections:
            data = json.dumps(message)
            for connection in self.active_connections[meeting_id]:
                try:
                    await connection.send_text(data)
                except Exception as e:
                    print(f"Failed to send WS message: {e}")

manager = ConnectionManager()

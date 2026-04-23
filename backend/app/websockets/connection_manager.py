import json
from typing import Dict, List, Any
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # meeting_id -> list of dicts: {"websocket": WebSocket, "user": dict}
        self.active_connections: Dict[str, List[Dict[str, Any]]] = {}
    
    async def connect(self, websocket: WebSocket, meeting_id: str, user_info: dict):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = []
        
        self.active_connections[meeting_id].append({
            "websocket": websocket,
            "user": user_info
        })
        
    def disconnect(self, websocket: WebSocket, meeting_id: str):
        if meeting_id in self.active_connections:
            self.active_connections[meeting_id] = [
                conn for conn in self.active_connections[meeting_id] 
                if conn["websocket"] != websocket
            ]
            if not self.active_connections[meeting_id]:
                del self.active_connections[meeting_id]

    def get_participants(self, meeting_id: str) -> List[dict]:
        """Returns a list of user info dicts for everyone currently in the meeting."""
        if meeting_id not in self.active_connections:
            return []
        return [conn["user"] for conn in self.active_connections[meeting_id]]
                
    async def broadcast_to_meeting(self, meeting_id: str, message: dict):
        """Send message to all local connections in the meeting."""
        if meeting_id in self.active_connections:
            data = json.dumps(message)
            for conn in self.active_connections[meeting_id]:
                try:
                    await conn["websocket"].send_text(data)
                except Exception as e:
                    print(f"Failed to send WS message: {e}")

manager = ConnectionManager()

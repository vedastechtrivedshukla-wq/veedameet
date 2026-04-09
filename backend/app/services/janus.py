import httpx
import random
import string
from app.core.config import settings

class JanusClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
    
    def _transaction_id(self):
        return ''.join(random.choices(string.ascii_letters + string.digits, k=12))

    async def create_session(self):
        async with httpx.AsyncClient() as client:
            payload = {
                "janus": "create",
                "transaction": self._transaction_id()
            }
            response = await client.post(self.base_url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["data"]["id"]

    async def attach_plugin(self, session_id: int, plugin: str = "janus.plugin.videoroom"):
        async with httpx.AsyncClient() as client:
            payload = {
                "janus": "attach",
                "plugin": plugin,
                "transaction": self._transaction_id()
            }
            response = await client.post(f"{self.base_url}/{session_id}", json=payload)
            response.raise_for_status()
            data = response.json()
            return data["data"]["id"]

    async def create_room(self, session_id: int, handle_id: int, room_id: int = None):
        async with httpx.AsyncClient() as client:
            body = {
                "request": "create",
                "room": room_id,
                "publishers": 10,
                "bitrate": 512000
            }
            if room_id is None:
                del body["room"]

            payload = {
                "janus": "message",
                "body": body,
                "transaction": self._transaction_id()
            }
            response = await client.post(f"{self.base_url}/{session_id}/{handle_id}", json=payload)
            response.raise_for_status()
            data = response.json()
            
            # The room ID is inside plugindata
            if "plugindata" in data and "data" in data["plugindata"]:
                return data["plugindata"]["data"].get("room")
            return None

    async def destroy_session(self, session_id: int):
        async with httpx.AsyncClient() as client:
            payload = {
                "janus": "destroy",
                "transaction": self._transaction_id()
            }
            # We fire and forget the destroy
            try:
                await client.post(f"{self.base_url}/{session_id}", json=payload)
            except Exception as e:
                print(f"Failed to destroy Janus session: {e}")

janus_client = JanusClient(settings.JANUS_API_URL)

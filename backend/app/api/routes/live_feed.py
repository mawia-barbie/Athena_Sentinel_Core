from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List
from app.core.security import decode_token
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, token: str = None):
        # optional token validation
        if token:
            payload = decode_token(token)
            if not payload:
                await websocket.close(code=4001)
                return
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for ws in list(self.active_connections):
            try:
                await ws.send_text(message)
            except Exception:
                self.disconnect(ws)

manager = ConnectionManager()

@router.websocket('/ws/threats')
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    await manager.connect(websocket, token)
    try:
        while True:
            # keep the connection open; clients may send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# helper to broadcast from other parts of server
async def broadcast_threat_event(event: dict):
    await manager.broadcast(json.dumps(event))

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from fastapi import WebSocket
from models import Incident, IncidentStatus, IncidentTier, AuditLog


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, payload: Dict[str, Any]):
        message = json.dumps({"type": event_type, "data": payload, "timestamp": datetime.now(timezone.utc).isoformat()})
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)


manager = ConnectionManager()

# In-memory stores
_incidents: Dict[str, Incident] = {}
_audit_logs: List[AuditLog] = []
_active_incident_id: Optional[str] = None


def save_incident(incident: Incident) -> Incident:
    global _active_incident_id
    _incidents[incident.id] = incident
    _active_incident_id = incident.id
    return incident


def get_incident(incident_id: str) -> Optional[Incident]:
    return _incidents.get(incident_id)


def get_active_incident() -> Optional[Incident]:
    if _active_incident_id and _active_incident_id in _incidents:
        return _incidents[_active_incident_id]
    if _incidents:
        # return newest
        return list(_incidents.values())[-1]
    return None


def get_all_incidents() -> List[Incident]:
    return list(_incidents.values())


def add_audit_log(
    incident_id: str,
    event_type: str,
    actor: str,
    result: str,
    requested_scope: Optional[str] = None,
    granted_scope: Optional[str] = None,
    tool_called: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    log_id = f"audit-{len(_audit_logs) + 1:04d}"
    entry = AuditLog(
        id=log_id,
        incident_id=incident_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        event_type=event_type,
        actor=actor,
        requested_scope=requested_scope,
        granted_scope=granted_scope,
        tool_called=tool_called,
        result=result,
        details=details or {},
    )
    _audit_logs.insert(0, entry)  # newest first
    return entry


def get_audit_logs(incident_id: Optional[str] = None) -> List[AuditLog]:
    if incident_id:
        return [log for log in _audit_logs if log.incident_id == incident_id]
    return _audit_logs


async def broadcast_state_change(event_type: str, data: Dict[str, Any]):
    await manager.broadcast(event_type, data)

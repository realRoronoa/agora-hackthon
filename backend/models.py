from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class IncidentTier(str, Enum):
    TIER_1_AUTO = "TIER_1_AUTO"
    TIER_2_VOICE = "TIER_2_VOICE"


class IncidentStatus(str, Enum):
    TRIGGERED = "TRIGGERED"
    TRIAGING = "TRIAGING"
    AUTO_HEALING = "AUTO_HEALING"
    AUTO_HEALED = "AUTO_HEALED"
    CALL_RINGING = "CALL_RINGING"
    CALL_IN_PROGRESS = "CALL_IN_PROGRESS"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    EXECUTED_SCOPED = "EXECUTED_SCOPED"
    RESOLVED = "RESOLVED"
    MANUAL_HANDOFF = "MANUAL_HANDOFF"
    FAILED = "FAILED"


class PermissionScope(str, Enum):
    FULL = "FULL"
    LIMITED = "LIMITED"
    NONE = "NONE"


class TriageResult(BaseModel):
    tier: IncidentTier
    blast_radius_score: int = Field(ge=0, le=100)
    summary: str
    recommended_action: str
    reason: str
    safe_limited_action: Optional[str] = None


class AuditLog(BaseModel):
    id: str
    incident_id: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    event_type: str
    actor: str
    requested_scope: Optional[str] = None
    granted_scope: Optional[str] = None
    tool_called: Optional[str] = None
    result: str
    details: Dict[str, Any] = Field(default_factory=dict)


class Incident(BaseModel):
    id: str
    title: str
    service: str
    repository: str
    commit_sha: str
    branch: str
    error_logs: str
    stack_trace: str
    tier: IncidentTier
    blast_radius_score: int = Field(ge=0, le=100)
    status: IncidentStatus
    triage_summary: str
    triage_reason: str
    channel_name: str
    agora_agent_id: Optional[str] = None
    mitigation_action: Optional[str] = None
    target_version: Optional[str] = None
    voice_approval_quote: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CallStartRequest(BaseModel):
    incident_id: str


class CallStartResponse(BaseModel):
    channel: str
    token: str
    uid: int = 1001
    app_id: str
    agent_id: Optional[str] = None
    demo_mode: bool = False
    greeting: str
    rtm_token: Optional[str] = None
    enable_rtm: bool = False


class HealthConfigResponse(BaseModel):
    demo_mode: bool
    agora_ready: bool
    llm_mode: str
    gemini_model: str
    tts_mode: str
    asr_mode: str
    public_tools_url_ready: bool
    github_mode: str


class ToolRollbackPayload(BaseModel):
    incident_id: str
    target_version: str
    approved_by_voice: str


class ToolLimitedMitigationPayload(BaseModel):
    incident_id: str
    action: str
    note: str


class ToolManualHandoffPayload(BaseModel):
    incident_id: str
    reason: str


class SimulateVoiceInputPayload(BaseModel):
    incident_id: str
    action: str  # "rollback", "limited", "handoff"
    spoken_text: str

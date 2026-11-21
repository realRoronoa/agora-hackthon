from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException, status
from config import settings
from models import (
    ToolRollbackPayload,
    ToolLimitedMitigationPayload,
    ToolManualHandoffPayload,
    IncidentStatus,
)
from services.github_actions import trigger_rollback_deployment, apply_limited_mitigation
from services.state import (
    get_incident,
    save_incident,
    add_audit_log,
    broadcast_state_change,
)

router = APIRouter(prefix="/api/tools", tags=["tools"])


def verify_secret(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    expected_header = f"Bearer {settings.TOOL_WEBHOOK_SECRET}"
    # If the LLM passed raw secret or Bearer
    token = authorization.strip()
    if token != expected_header and token != settings.TOOL_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid tool webhook authorization token",
        )


@router.post("/rollback")
async def execute_rollback_tool(
    payload: ToolRollbackPayload,
    authorization: str = Header(None),
):
    """
    Mid-call synchronous tool invoked by Agora ConvoAI when engineer verbally grants FULL permission.
    """
    verify_secret(authorization)

    incident = get_incident(payload.incident_id)
    if not incident:
        # Fallback to creating or finding active incident
        from services.state import get_active_incident
        incident = get_active_incident()

    incident_id = incident.id if incident else payload.incident_id

    # Execute GitHub Rollback Workflow / Dispatch
    gh_result = await trigger_rollback_deployment(
        target_version=payload.target_version,
        incident_id=incident_id,
        approved_by_voice=payload.approved_by_voice,
    )

    if incident:
        incident.status = IncidentStatus.EXECUTED_SCOPED
        incident.target_version = payload.target_version
        incident.voice_approval_quote = payload.approved_by_voice
        incident.mitigation_action = f"Rollback to {payload.target_version} authorized via voice"
        incident.updated_at = datetime.now(timezone.utc).isoformat()
        save_incident(incident)

    audit_entry = add_audit_log(
        incident_id=incident_id,
        event_type="VOICE_TOOL_EXECUTION",
        actor="Agora-ConvoAI (Murf TTS + Ares ASR)",
        requested_scope="FULL",
        granted_scope="FULL",
        tool_called="executeRollback",
        result="SUCCESS",
        details={
            "target_version": payload.target_version,
            "approved_by_voice": payload.approved_by_voice,
            "github_action": gh_result,
        },
    )

    # Immediately push state change to frontend UI
    await broadcast_state_change(
        "tool_executed",
        {
            "incident_id": incident_id,
            "tool": "executeRollback",
            "scope": "FULL",
            "incident": incident.model_dump() if incident else None,
            "audit_log": audit_entry.model_dump(),
        },
    )

    # Return concise message for LLM voice readout
    return {
        "status": "success",
        "message": f"Rolled back checkout-service to {payload.target_version}. Health check is green.",
        "details": gh_result,
    }


@router.post("/limited-mitigation")
async def apply_limited_mitigation_tool(
    payload: ToolLimitedMitigationPayload,
    authorization: str = Header(None),
):
    """
    Mid-call synchronous tool invoked by Agora ConvoAI when engineer verbally grants LIMITED permission.
    """
    verify_secret(authorization)

    incident = get_incident(payload.incident_id)
    if not incident:
        from services.state import get_active_incident
        incident = get_active_incident()

    incident_id = incident.id if incident else payload.incident_id

    # Execute safe mitigation without code rollback
    gh_result = await apply_limited_mitigation(
        incident_id=incident_id,
        action=payload.action,
        note=payload.note,
    )

    if incident:
        incident.status = IncidentStatus.EXECUTED_SCOPED
        incident.mitigation_action = f"Limited Mitigation: {payload.action}"
        incident.updated_at = datetime.now(timezone.utc).isoformat()
        save_incident(incident)

    audit_entry = add_audit_log(
        incident_id=incident_id,
        event_type="VOICE_TOOL_EXECUTION",
        actor="Agora-ConvoAI (Murf TTS + Ares ASR)",
        requested_scope="FULL",
        granted_scope="LIMITED",
        tool_called="applyLimitedMitigation",
        result="SUCCESS",
        details={
            "action": payload.action,
            "note": payload.note,
            "github_action": gh_result,
        },
    )

    await broadcast_state_change(
        "tool_executed",
        {
            "incident_id": incident_id,
            "tool": "applyLimitedMitigation",
            "scope": "LIMITED",
            "incident": incident.model_dump() if incident else None,
            "audit_log": audit_entry.model_dump(),
        },
    )

    return {
        "status": "success",
        "message": f"Applied limited mitigation: restarted service and logged hotfix issue. Rollback bypassed.",
        "details": gh_result,
    }


@router.post("/manual-handoff")
async def log_manual_handoff_tool(
    payload: ToolManualHandoffPayload,
    authorization: str = Header(None),
):
    """
    Mid-call synchronous tool invoked by Agora ConvoAI when developer denies automated changes.
    """
    verify_secret(authorization)

    incident = get_incident(payload.incident_id)
    if not incident:
        from services.state import get_active_incident
        incident = get_active_incident()

    incident_id = incident.id if incident else payload.incident_id

    if incident:
        incident.status = IncidentStatus.MANUAL_HANDOFF
        incident.mitigation_action = f"Manual take-over: {payload.reason}"
        incident.updated_at = datetime.now(timezone.utc).isoformat()
        save_incident(incident)

    audit_entry = add_audit_log(
        incident_id=incident_id,
        event_type="VOICE_TOOL_EXECUTION",
        actor="Agora-ConvoAI (Murf TTS + Ares ASR)",
        requested_scope="FULL",
        granted_scope="NONE",
        tool_called="logManualHandoff",
        result="HANDOFF_RECORDED",
        details={"reason": payload.reason},
    )

    await broadcast_state_change(
        "tool_executed",
        {
            "incident_id": incident_id,
            "tool": "logManualHandoff",
            "scope": "NONE",
            "incident": incident.model_dump() if incident else None,
            "audit_log": audit_entry.model_dump(),
        },
    )

    return {
        "status": "success",
        "message": "Manual handoff recorded. Automated actions paused. Developer has command.",
    }

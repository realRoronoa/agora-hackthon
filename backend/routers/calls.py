from fastapi import APIRouter, HTTPException
from config import settings
from models import (
    CallStartRequest,
    CallStartResponse,
    SimulateVoiceInputPayload,
    IncidentStatus,
)
from services.agora_agent import (
    generate_rtc_tokens,
    join_conversational_agent,
    leave_conversational_agent,
)
from services.state import (
    get_incident,
    get_active_incident,
    get_all_incidents,
    get_audit_logs,
    save_incident,
    add_audit_log,
    broadcast_state_change,
)
from routers.tools import (
    execute_rollback_tool,
    apply_limited_mitigation_tool,
    log_manual_handoff_tool,
)
from models import ToolRollbackPayload, ToolLimitedMitigationPayload, ToolManualHandoffPayload

router = APIRouter(prefix="/api", tags=["calls"])


@router.post("/calls/start", response_model=CallStartResponse)
async def start_voice_call(payload: CallStartRequest):
    """
    Connects developer browser to Agora RTC channel and spawns Agora Conversational AI Agent
    with Deepgram Nova-3 ASR, Google Gemini / Managed LLM, and Murf Falcon / Managed MiniMax TTS.
    """
    incident = get_incident(payload.incident_id)
    if not incident:
        incident = get_active_incident()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    channel_name = incident.channel_name or f"incident-{incident.id}"
    user_token, agent_token, rtm_token = generate_rtc_tokens(channel_name)

    # Spawn Agora Conversational AI Agent v2
    agent_info = await join_conversational_agent(incident, channel_name, agent_token)
    agent_id = agent_info.get("agent_id")

    incident.status = IncidentStatus.CALL_IN_PROGRESS
    incident.agora_agent_id = agent_id
    save_incident(incident)

    add_audit_log(
        incident_id=incident.id,
        event_type="CALL_ANSWERED",
        actor="Human-Developer",
        result=f"Developer joined RTC channel '{channel_name}' with UID 1001.",
        details={
            "agent_id": agent_id,
            "mode": agent_info.get("mode"),
            "llm_mode": settings.llm_mode,
            "tts_mode": settings.tts_mode,
            "enable_rtm": settings.ENABLE_RTM_TRANSCRIPTS,
        },
    )

    await broadcast_state_change(
        "call_started",
        {
            "incident_id": incident.id,
            "channel": channel_name,
            "agent_id": agent_id,
            "demo_mode": settings.DEMO_MODE or not settings.is_live_ready,
        },
    )

    greeting = (
        "Alert. NightWatch here. Production checkout just crashed after the latest deployment. "
        "Do I have full permission to roll back to v1.4.2, or only limited permission to restart the worker and log a hotfix issue?"
    )

    return CallStartResponse(
        channel=channel_name,
        token=user_token,
        uid=1001,
        app_id=settings.AGORA_APP_ID if settings.AGORA_APP_ID else "demo-app-id",
        agent_id=agent_id,
        demo_mode=settings.DEMO_MODE or not settings.is_live_ready,
        greeting=greeting,
        rtm_token=rtm_token,
        enable_rtm=settings.ENABLE_RTM_TRANSCRIPTS,
    )


@router.post("/calls/stop")
async def stop_voice_call(payload: CallStartRequest):
    """Terminates active Agora call and disconnects ConvoAI agent."""
    incident = get_incident(payload.incident_id)
    if not incident:
        incident = get_active_incident()

    agent_id = incident.agora_agent_id if incident and incident.agora_agent_id else "demo-agent-9999"
    leave_res = await leave_conversational_agent(agent_id)

    if incident:
        if incident.status == IncidentStatus.CALL_IN_PROGRESS:
            incident.status = IncidentStatus.AWAITING_APPROVAL
        save_incident(incident)

    add_audit_log(
        incident_id=incident.id if incident else "unknown",
        event_type="CALL_TERMINATED",
        actor="Human-Developer",
        result="Voice session closed.",
    )

    await broadcast_state_change(
        "call_stopped",
        {"incident_id": incident.id if incident else None, "agent_id": agent_id},
    )
    return {"status": "success", "agent_leave": leave_res}


@router.post("/calls/simulate-voice-input")
async def simulate_voice_input(payload: SimulateVoiceInputPayload):
    """
    Simulation fallback: allows developer to trigger voice approval actions in UI without speaking into a live mic.
    """
    auth_header = f"Bearer {settings.TOOL_WEBHOOK_SECRET}"
    if payload.action == "rollback":
        tool_req = ToolRollbackPayload(
            incident_id=payload.incident_id,
            target_version="v1.4.2",
            approved_by_voice=payload.spoken_text or "Yes, do full rollback to v1.4.2 right away.",
        )
        return await execute_rollback_tool(tool_req, authorization=auth_header)

    elif payload.action == "limited":
        tool_req = ToolLimitedMitigationPayload(
            incident_id=payload.incident_id,
            action="restart_service",
            note=payload.spoken_text or "Only restart the service worker and log a hotfix issue.",
        )
        return await apply_limited_mitigation_tool(tool_req, authorization=auth_header)

    elif payload.action == "handoff":
        tool_req = ToolManualHandoffPayload(
            incident_id=payload.incident_id,
            reason=payload.spoken_text or "Denied. I am opening my laptop and taking over.",
        )
        return await log_manual_handoff_tool(tool_req, authorization=auth_header)

    else:
        raise HTTPException(status_code=400, detail="Unknown voice input action")


@router.get("/incidents")
async def list_incidents():
    return {
        "active_incident": get_active_incident(),
        "all_incidents": get_all_incidents(),
    }


@router.get("/incidents/{incident_id}")
async def get_single_incident(incident_id: str):
    inc = get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc


@router.get("/audit")
async def list_audit_trail():
    return {"audit_logs": get_audit_logs()}


@router.get("/status")
async def system_status():
    return {
        "demo_mode": settings.DEMO_MODE,
        "is_live_ready": settings.is_live_ready,
        "public_base_url": settings.PUBLIC_BASE_URL,
        "llm_mode": settings.llm_mode,
        "gemini_model": settings.GEMINI_MODEL,
        "tts_mode": settings.tts_mode,
        "asr_mode": settings.asr_mode,
        "services": {
            "agora_rtc": bool(settings.AGORA_APP_ID and settings.AGORA_APP_CERTIFICATE),
            "agora_convo_ai": bool(settings.AGORA_CUSTOMER_ID and settings.AGORA_CUSTOMER_SECRET),
            "gemini_api": bool(settings.GEMINI_API_KEY),
            "murf_tts": bool(settings.MURF_API_KEY),
            "github_actions": bool(settings.GITHUB_TOKEN and settings.GITHUB_REPO),
            "rtm_transcripts": settings.ENABLE_RTM_TRANSCRIPTS,
        },
    }

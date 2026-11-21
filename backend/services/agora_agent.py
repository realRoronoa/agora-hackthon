import base64
import time
import uuid
import httpx
from typing import Dict, Any, Tuple, Optional
from config import settings
from models import Incident

try:
    from agora_token_builder import RtcTokenBuilder, RtmTokenBuilder
    HAS_TOKEN_BUILDER = True
except ImportError:
    HAS_TOKEN_BUILDER = False


def generate_rtc_tokens(channel_name: str) -> Tuple[str, str, Optional[str]]:
    """
    Generates Agora RTC and optional RTM tokens:
    - User browser UID: 1001
    - Agora AI Agent UID: 9999
    - Optional RTM Token for UID 1001 (if ENABLE_RTM_TRANSCRIPTS=true)
    """
    current_timestamp = int(time.time())
    privilege_expired_ts = current_timestamp + 3600  # 1 hour validity

    user_token = f"demo_rtc_token_user_1001_{channel_name}_{uuid.uuid4().hex[:8]}"
    agent_token = f"demo_rtc_token_agent_9999_{channel_name}_{uuid.uuid4().hex[:8]}"
    rtm_token = None

    if HAS_TOKEN_BUILDER and settings.AGORA_APP_ID and settings.AGORA_APP_CERTIFICATE:
        try:
            # Role_Publisher is integer 1
            user_token = RtcTokenBuilder.buildTokenWithUid(
                settings.AGORA_APP_ID,
                settings.AGORA_APP_CERTIFICATE,
                channel_name,
                1001,
                1,
                privilege_expired_ts,
            )
            agent_token = RtcTokenBuilder.buildTokenWithUid(
                settings.AGORA_APP_ID,
                settings.AGORA_APP_CERTIFICATE,
                channel_name,
                9999,
                1,
                privilege_expired_ts,
            )
            if settings.ENABLE_RTM_TRANSCRIPTS:
                rtm_token = RtmTokenBuilder.buildToken(
                    settings.AGORA_APP_ID,
                    settings.AGORA_APP_CERTIFICATE,
                    "1001",
                    1,
                    privilege_expired_ts,
                )
        except Exception as e:
            print(f"⚠️ Token builder warning: {e}")

    return user_token, agent_token, rtm_token


async def join_conversational_agent(incident: Incident, channel_name: str, agent_token: str) -> Dict[str, Any]:
    """
    Calls Agora Conversational AI Engine v2 /join API.
    POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{AGORA_APP_ID}/join
    Configured with Deepgram Nova-3 ASR, Google Gemini / Managed LLM, and Murf Falcon / Managed MiniMax TTS.
    """
    public_base = settings.PUBLIC_BASE_URL.rstrip("/")
    auth_credentials = f"{settings.AGORA_CUSTOMER_ID}:{settings.AGORA_CUSTOMER_SECRET}"
    basic_auth = base64.b64encode(auth_credentials.encode("utf-8")).decode("utf-8")

    # 1. Custom Tools (strictly alphanumeric camelCase names, NO underscores)
    tools = [
        {
            "type": "function",
            "function": {
                "name": "executeRollback",
                "description": "Execute a full production rollback. ONLY call after the developer explicitly grants FULL permission to roll back.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "incident_id": { "type": "string", "description": "The active incident ID." },
                        "target_version": { "type": "string", "description": "The stable release tag to restore, e.g. v1.4.2." },
                        "approved_by_voice": { "type": "string", "description": "Short quote of the developer's verbal approval." }
                    },
                    "required": ["incident_id", "target_version", "approved_by_voice"],
                    "additionalProperties": False
                }
            },
            "execution": { "mode": "sync" },
            "server": {
                "method": "POST",
                "url": f"{public_base}/api/tools/rollback",
                "headers": { "Authorization": "{{template_variables.tool_secret}}" },
                "body": {
                    "incident_id": "{{args.incident_id}}",
                    "target_version": "{{args.target_version}}",
                    "approved_by_voice": "{{args.approved_by_voice}}"
                },
                "timeout_ms": 10000
            }
        },
        {
            "type": "function",
            "function": {
                "name": "applyLimitedMitigation",
                "description": "Apply a safe limited mitigation (restart service and open a GitHub hotfix issue) WITHOUT rolling back code. Call when the developer grants LIMITED permission.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "incident_id": { "type": "string", "description": "The active incident ID." },
                        "action": { "type": "string", "description": "Either restart_service or disable_feature_flag." },
                        "note": { "type": "string", "description": "Summary of the developer's instruction for the hotfix issue." }
                    },
                    "required": ["incident_id", "action", "note"],
                    "additionalProperties": False
                }
            },
            "execution": { "mode": "sync" },
            "server": {
                "method": "POST",
                "url": f"{public_base}/api/tools/limited-mitigation",
                "headers": { "Authorization": "{{template_variables.tool_secret}}" },
                "body": {
                    "incident_id": "{{args.incident_id}}",
                    "action": "{{args.action}}",
                    "note": "{{args.note}}"
                },
                "timeout_ms": 10000
            }
        },
        {
            "type": "function",
            "function": {
                "name": "logManualHandoff",
                "description": "Record that the developer denied automated changes and will take over manually.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "incident_id": { "type": "string", "description": "The active incident ID." },
                        "reason": { "type": "string", "description": "Developer's stated reason." }
                    },
                    "required": ["incident_id", "reason"],
                    "additionalProperties": False
                }
            },
            "execution": { "mode": "sync" },
            "server": {
                "method": "POST",
                "url": f"{public_base}/api/tools/manual-handoff",
                "headers": { "Authorization": "{{template_variables.tool_secret}}" },
                "body": {
                    "incident_id": "{{args.incident_id}}",
                    "reason": "{{args.reason}}"
                },
                "timeout_ms": 10000
            }
        }
    ]

    system_prompt = (
        "You are NightWatch AI, an emergency on-call DevOps voice responder. "
        "State the incident failure brief in 2 sentences. "
        "Ask whether the human engineer grants FULL permission to roll back to the target version or LIMITED permission to restart the worker and open a hotfix issue. "
        "NEVER call a destructive rollback tool until explicitly granted full verbal permission. Keep responses concise and direct."
    )
    greeting_message = "Alert. NightWatch here. Production checkout just crashed after the latest deployment. Do I have full permission to roll back to v1.4.2, or only limited permission to restart the worker and log a hotfix issue?"
    failure_message = "Sorry, I hit a snag reaching the deployment server. Please check the console."

    # 2. LLM Configuration (Gemini Primary + Agora Managed Fallback)
    if settings.GEMINI_API_KEY and settings.GEMINI_AGORA_MODE == "openai_compat":
        llm_config = {
            "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            "api_key": settings.GEMINI_API_KEY,
            "style": "openai",
            "params": { "model": settings.GEMINI_MODEL },
            "system_messages": [{ "role": "system", "content": system_prompt }],
            "greeting_message": greeting_message,
            "failure_message": failure_message,
            "max_history": 16,
            "template_variables": { "tool_secret": f"Bearer {settings.TOOL_WEBHOOK_SECRET}" },
            "tools": tools,
        }
    elif settings.GEMINI_API_KEY and settings.GEMINI_AGORA_MODE == "native":
        llm_config = {
            "url": f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:streamGenerateContent?alt=sse&key={settings.GEMINI_API_KEY}",
            "style": "gemini",
            "ignore_empty": True,
            "params": { "model": settings.GEMINI_MODEL },
            "system_messages": [{ "role": "user", "parts": [{ "text": system_prompt }] }],
            "greeting_message": greeting_message,
            "failure_message": failure_message,
            "max_history": 16,
            "template_variables": { "tool_secret": f"Bearer {settings.TOOL_WEBHOOK_SECRET}" },
            "tools": tools,
        }
    else:
        # Fallback when GEMINI_API_KEY is empty or GEMINI_AGORA_MODE=managed (Agora Managed Mode - zero LLM key needed)
        llm_config = {
            "credential_mode": "managed",
            "vendor": "openai",
            "style": "openai",
            "url": "https://api.openai.com/v1/chat/completions",
            "params": { "model": "gpt-4o-mini" },
            "system_messages": [{ "role": "system", "content": system_prompt }],
            "greeting_message": greeting_message,
            "failure_message": failure_message,
            "max_history": 16,
            "template_variables": { "tool_secret": f"Bearer {settings.TOOL_WEBHOOK_SECRET}" },
            "tools": tools,
        }

    # 3. TTS Configuration (Murf Falcon Primary + Agora Managed MiniMax Fallback)
    if settings.MURF_API_KEY:
        tts_config = {
            "vendor": "murf",
            "params": {
                "api_key": settings.MURF_API_KEY,
                "base_url": "wss://global.api.murf.ai/v1/speech/stream-input",
                "voiceId": "Matthew",
                "locale": "en-US",
                "rate": 0,
                "pitch": 0,
                "model": "FALCON",
                "sample_rate": 24000
            }
        }
    else:
        tts_config = {
            "credential_mode": "managed",
            "vendor": "minimax",
            "params": {
                "url": "wss://api.minimax.io/ws/v1/t2a_v2",
                "model": "speech-2.6-turbo",
                "voice_setting": { "voice_id": "English_captivating_female1" }
            }
        }

    # 4. Advanced Features
    advanced_features = {
        "enable_tools": True,
    }
    if settings.ENABLE_RTM_TRANSCRIPTS:
        advanced_features["enable_rtm"] = True

    # 5. Full Payload
    properties: Dict[str, Any] = {
        "channel": channel_name,
        "token": agent_token,
        "agent_rtc_uid": "9999",
        "remote_rtc_uids": ["1001"],
        "enable_string_uid": False,
        "idle_timeout": 120,
        "advanced_features": advanced_features,
        "asr": {
            "credential_mode": "managed",
            "vendor": "deepgram",
            "params": {
                "url": "wss://api.deepgram.com/v1/listen",
                "model": "nova-3",
                "language": "en-US",
                "keyterm": "rollback"
            }
        },
        "llm": llm_config,
        "tts": tts_config,
    }

    if settings.ENABLE_RTM_TRANSCRIPTS:
        properties["parameters"] = {"data_channel": "rtm"}

    payload = {
        "name": f"nightwatch-incident-{incident.id}",
        "properties": properties,
    }

    # Demo mode simulation check
    if settings.DEMO_MODE or not settings.is_live_ready:
        return {
            "status": "success",
            "mode": "demo",
            "agent_id": f"demo-agent-{uuid.uuid4().hex[:6]}",
            "channel": channel_name,
            "message": "Demo mode: Simulated Agora ConvoAI agent ready to engage on RTC channel.",
        }

    join_url = f"https://api.agora.io/api/conversational-ai-agent/v2/projects/{settings.AGORA_APP_ID}/join"
    headers = {
        "Authorization": f"Basic {basic_auth}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(join_url, json=payload, headers=headers)
        if response.status_code in (200, 201):
            res_data = response.json()
            return {
                "status": "success",
                "mode": "live",
                "agent_id": res_data.get("agent_id", f"agora-agent-{uuid.uuid4().hex[:6]}"),
                "channel": channel_name,
                "raw": res_data,
            }
        else:
            # Verbose Error Logging per Agora v2 guidelines
            print(f"❌ [Agora ConvoAI /join Error] HTTP {response.status_code}")
            print(f"❌ [Agora ConvoAI /join Response Body] {response.text}")
            return {
                "status": "error",
                "mode": "fallback_demo",
                "status_code": response.status_code,
                "agent_id": f"fallback-agent-{uuid.uuid4().hex[:6]}",
                "error": response.text,
            }


async def leave_conversational_agent(agent_id: str) -> Dict[str, Any]:
    """
    Calls Agora Conversational AI Engine v2 /leave API.
    POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{AGORA_APP_ID}/agents/{agent_id}/leave
    """
    if settings.DEMO_MODE or not settings.is_live_ready or agent_id.startswith("demo-"):
        return {"status": "success", "mode": "demo", "message": f"Agent {agent_id} left simulated channel."}

    auth_credentials = f"{settings.AGORA_CUSTOMER_ID}:{settings.AGORA_CUSTOMER_SECRET}"
    basic_auth = base64.b64encode(auth_credentials.encode("utf-8")).decode("utf-8")
    leave_url = f"https://api.agora.io/api/conversational-ai-agent/v2/projects/{settings.AGORA_APP_ID}/agents/{agent_id}/leave"
    headers = {
        "Authorization": f"Basic {basic_auth}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(leave_url, headers=headers)
            if res.status_code not in (200, 204):
                print(f"❌ [Agora ConvoAI /leave Error] HTTP {res.status_code}: {res.text}")
            return {"status": "success", "mode": "live", "response": res.text}
    except Exception as e:
        print(f"❌ [Agora ConvoAI /leave Exception]: {e}")
        return {"status": "error", "error": str(e)}

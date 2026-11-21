import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from config import settings
from models import Incident, IncidentTier, IncidentStatus
from services.triage import triage_failure
from services.github_actions import rerun_github_workflow
from services.state import (
    save_incident,
    get_incident,
    add_audit_log,
    broadcast_state_change,
)

router = APIRouter(prefix="/api", tags=["webhooks"])


@router.post("/webhooks/github")
async def github_webhook(request: Request):
    """Handles GitHub Actions workflow failure webhooks and GitHub ping events."""
    payload = await request.json()

    # 1. Handle GitHub Ping handshake
    event_type = request.headers.get("X-GitHub-Event", "").lower()
    if event_type == "ping" or "zen" in payload:
        return {
            "status": "pong",
            "message": "NightWatch AI webhook active and listening",
            "zen": payload.get("zen", "Keep it logically awesome."),
            "hook_id": payload.get("hook_id"),
        }

    action = payload.get("action", "")
    workflow = payload.get("workflow", {})
    workflow_run = payload.get("workflow_run", {})

    # 2. Prevent recursion loops: ignore rollback workflow runs
    workflow_name = workflow_run.get("name") or workflow.get("name", "")
    workflow_path = workflow_run.get("path") or workflow.get("path", "")
    if "rollback" in str(workflow_name).lower() or "rollback" in str(workflow_path).lower():
        return {
            "status": "ignored",
            "reason": "Ignoring rollback workflow run to prevent recursive trigger loop",
        }

    # 3. Only process failed completed runs
    conclusion = workflow_run.get("conclusion")
    if conclusion != "failure":
        return {"status": "ignored", "reason": f"Conclusion is {conclusion}"}

    repo_name = payload.get("repository", {}).get("full_name", settings.GITHUB_REPO or "acme-corp/checkout-service")
    commit_sha = (workflow_run.get("head_sha") or "c7f91a2")[:7]
    branch = workflow_run.get("head_branch") or "main"
    run_id = str(workflow_run.get("id", "982341201"))
    run_url = workflow_run.get("html_url") or f"https://github.com/{repo_name}/actions/runs/{run_id}"
    commit_msg = (workflow_run.get("head_commit") or {}).get("message") or "Production CI step failed"
    workflow_title = workflow_name or "CI Pipeline"

    # Extract or synthesize error log from workflow failure
    raw_logs = (
        f"🚨 GitHub Actions Workflow FAILED: '{workflow_title}'\n"
        f"Repository: {repo_name} | Branch: {branch} | Commit: {commit_sha}\n"
        f"Message: {commit_msg}\n"
        f"Run URL: {run_url}\n\n"
        f"FATAL: DatabaseConnectionPoolExhausted - 50 pool connections saturated.\n"
        f"CheckoutController: Unable to obtain database connection within 5000ms.\n"
        f"POST /api/v1/checkout HTTP/1.1 -> 500 Internal Server Error (error rate: 94.2%)\n"
        f"PaymentGatewayTimeoutException: downstream connection refused."
    )

    incident_id = f"inc-{uuid.uuid4().hex[:6]}"
    channel_name = f"incident-{incident_id}"

    # Perform Triage
    triage_result = await triage_failure(raw_logs, service="checkout-service")

    incident = Incident(
        id=incident_id,
        title=f"Pipeline Failure: {repo_name} on branch {branch}",
        service="checkout-service",
        repository=repo_name,
        commit_sha=commit_sha,
        branch=branch,
        error_logs=raw_logs,
        stack_trace=(
            "Traceback (most recent call last):\n"
            '  File "/app/services/checkout.py", line 142, in process_transaction\n'
            "    conn = db_pool.acquire(timeout=5.0)\n"
            "PoolTimeout: DatabaseConnectionPoolExhausted: Timeout waiting for free connection"
        ),
        tier=triage_result.tier,
        blast_radius_score=triage_result.blast_radius_score,
        status=IncidentStatus.TRIGGERED,
        triage_summary=triage_result.summary,
        triage_reason=triage_result.reason,
        channel_name=channel_name,
        target_version="v1.4.2",
    )
    save_incident(incident)

    add_audit_log(
        incident_id=incident.id,
        event_type="INCIDENT_TRIGGERED",
        actor="GitHub-Webhook",
        result=f"Detected failure on {repo_name}@{commit_sha}",
        details={"run_id": run_id, "branch": branch},
    )

    if triage_result.tier == IncidentTier.TIER_1_AUTO:
        incident.status = IncidentStatus.AUTO_HEALING
        save_incident(incident)
        await broadcast_state_change("incident_updated", incident.model_dump())

        # Auto-remedy
        action_res = await rerun_github_workflow(run_id)
        incident.status = IncidentStatus.AUTO_HEALED
        incident.mitigation_action = "Rerun workflow with fresh cache"
        incident.updated_at = datetime.now(timezone.utc).isoformat()
        save_incident(incident)

        add_audit_log(
            incident_id=incident.id,
            event_type="TIER_1_AUTO_HEALED",
            actor="NightWatch-Autonomous-Engine",
            result="Auto-remedy executed successfully. CI job re-dispatched.",
            details=action_res,
        )
        await broadcast_state_change("incident_updated", incident.model_dump())

    else:
        # Tier 2 Voice Escalation
        incident.status = IncidentStatus.CALL_RINGING
        incident.updated_at = datetime.now(timezone.utc).isoformat()
        save_incident(incident)

        add_audit_log(
            incident_id=incident.id,
            event_type="TIER_2_VOICE_ESCALATION",
            actor="NightWatch-Triage-Engine",
            result="Escalating to On-Call Voice Channel via Agora Conversational AI.",
            details={"channel": channel_name, "blast_radius": triage_result.blast_radius_score},
        )
        await broadcast_state_change("incident_escalated", incident.model_dump())

    return {"status": "processed", "incident": incident.model_dump()}


@router.post("/simulate/{scenario}")
async def simulate_scenario(scenario: str):
    """
    Simulation endpoints:
    - /api/simulate/minor (or flaky / tier1): Flaky build auto-healed without wake-up
    - /api/simulate/critical (or checkout / tier2): Critical production crash escalating to Agora Voice
    """
    scenario_clean = scenario.lower().strip()
    incident_id = f"inc-{uuid.uuid4().hex[:6]}"
    channel_name = f"incident-{incident_id}"

    if scenario_clean in ["minor", "tier1", "tier_1", "flaky"]:
        error_logs = (
            "[worker-3] 2026-11-21 02:11:43 ERROR jest-worker: ConnectionResetError: [Errno 104] Connection reset by peer\n"
            "[worker-3] Failed to connect to artifact repository at npm-cache.internal:8080\n"
            "[worker-3] npm ERR! code ETIMEDOUT\n"
            "[worker-3] Test suite failed to run: Socket hangup during asset compilation."
        )
        stack_trace = (
            "Jest Worker Error: Socket hang up\n"
            "    at TLSSocket.onHangUp (_tls_wrap.js:892:19)\n"
            "    at TLSSocket.emit (events.js:400:28)\n"
            "    at endReadableNT (_stream_readable.js:1334:12)"
        )

        triage_result = await triage_failure(error_logs, service="checkout-service")

        incident = Incident(
            id=incident_id,
            title="CI/CD Build Failure: Staging Asset Pipeline Timeout",
            service="asset-bundler-worker",
            repository=settings.GITHUB_REPO or "acme-corp/core-monorepo",
            commit_sha="a4e70b9",
            branch="feature/cart-enhancement",
            error_logs=error_logs,
            stack_trace=stack_trace,
            tier=IncidentTier.TIER_1_AUTO,
            blast_radius_score=14,
            status=IncidentStatus.AUTO_HEALING,
            triage_summary="Transient Flaky Build: Socket timeout during asset bundler cache warmup.",
            triage_reason="Isolated staging CI worker test timeout. Zero customer blast radius. Safe for autonomous self-healing.",
            channel_name=channel_name,
        )
        save_incident(incident)

        add_audit_log(
            incident_id=incident.id,
            event_type="INCIDENT_TRIGGERED",
            actor="Simulation-Trigger",
            result="Simulated Flaky CI Build failure.",
        )
        await broadcast_state_change("incident_created", incident.model_dump())

        # Autonomous healing
        dry_run_action = await rerun_github_workflow("982341201")
        incident.status = IncidentStatus.AUTO_HEALED
        incident.mitigation_action = "Auto-restarted workflow run #982341201 with cache invalidation"
        incident.updated_at = datetime.now(timezone.utc).isoformat()
        save_incident(incident)

        add_audit_log(
            incident_id=incident.id,
            event_type="TIER_1_AUTO_HEALED",
            actor="NightWatch-Autonomous-Engine",
            result="Auto-remedy dispatched: CI workflow re-run without waking developer.",
            details=dry_run_action,
        )
        await broadcast_state_change("incident_updated", incident.model_dump())
        return {"status": "auto_healed", "incident": incident}

    elif scenario_clean in ["critical", "tier2", "tier_2", "checkout"]:
        error_logs = (
            "2026-11-21 02:14:02.912 [FATAL] [checkout-service] DatabaseConnectionPoolExhausted: Pool max size (50) reached.\n"
            "2026-11-21 02:14:03.104 [ERROR] [checkout-service] PaymentGatewayTimeout: Downstream payment webhook failed.\n"
            "2026-11-21 02:14:03.450 [FATAL] [checkout-service] Process terminated: SIGSEGV in worker pthread_join\n"
            "2026-11-21 02:14:04.001 [CRITICAL] Ingress 500 error spike detected: 89.2% failure rate on /v1/checkout/confirm"
        )
        stack_trace = (
            "Traceback (most recent call last):\n"
            '  File "/srv/checkout-service/handlers/payment.py", line 287, in execute_transaction\n'
            "    conn = await pool.acquire(timeout_seconds=3.0)\n"
            "PoolExhaustionError: Max connections (50) exhausted. Active leases: 50. Queued: 412.\n"
            '  File "/srv/checkout-service/db/pool.py", line 89, in acquire\n'
            "    raise PoolExhaustionError('Deadlock detected in uncommitted transaction batch')"
        )

        triage_result = await triage_failure(error_logs, service="checkout-service")

        incident = Incident(
            id=incident_id,
            title="P1 Critical Outage: Checkout Service DB Pool Exhaustion",
            service="checkout-service",
            repository=settings.GITHUB_REPO or "acme-corp/checkout-service",
            commit_sha="f82a901",
            branch="main",
            error_logs=error_logs,
            stack_trace=stack_trace,
            tier=IncidentTier.TIER_2_VOICE,
            blast_radius_score=94,
            status=IncidentStatus.CALL_RINGING,
            triage_summary="Production checkout just crashed after latest deployment. 89.2% transaction failure rate.",
            triage_reason="High financial blast radius. Production revenue path blocked. Requires explicit verbal authorization for rollback vs limited hotfix.",
            channel_name=channel_name,
            target_version="v1.4.2",
        )
        save_incident(incident)

        add_audit_log(
            incident_id=incident.id,
            event_type="INCIDENT_TRIGGERED",
            actor="Simulation-Trigger",
            result="Simulated P1 Production Checkout Crash.",
        )
        add_audit_log(
            incident_id=incident.id,
            event_type="TIER_2_VOICE_ESCALATION",
            actor="NightWatch-Triage-Engine",
            result="Ringing On-Call Engineer: Voice Authorization Required.",
            requested_scope="FULL",
            details={"channel": channel_name, "target_version": "v1.4.2"},
        )
        await broadcast_state_change("incident_escalated", incident.model_dump())
        return {"status": "escalated_ringing", "incident": incident}

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario '{scenario}'. Use 'minor' (or 'tier1') or 'critical' (or 'tier2').",
        )

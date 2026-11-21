import sys
import os
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from starlette.testclient import TestClient
from main import app
from config import settings

client = TestClient(app)

def run_tests():
    print("=====================================================")
    print("🚀 NIGHTWATCH AI - GEMINI & AGORA V2 VERIFICATION SUITE")
    print("=====================================================")

    # 1. Root & Health
    r = client.get("/")
    assert r.status_code == 200, f"Root check failed: {r.text}"
    print("✅ 1. Root and health check: PASSED (200 OK)")

    # 2. System Status
    r = client.get("/api/status")
    assert r.status_code == 200
    status_data = r.json()
    assert "demo_mode" in status_data
    print(f"✅ 2. Status check: PASSED (demo_mode={status_data['demo_mode']}, llm_mode={status_data['llm_mode']}, gemini_model={status_data['gemini_model']})")

    # 3. Live Diagnostics Endpoint GET /api/health/config
    r = client.get("/api/health/config")
    assert r.status_code == 200, f"Health config failed: {r.text}"
    hc = r.json()
    assert "demo_mode" in hc
    assert "agora_ready" in hc
    assert hc["llm_mode"] in ["gemini_openai_compat", "gemini_native", "agora_managed_openai"]
    assert hc["gemini_model"] == settings.GEMINI_MODEL
    assert hc["tts_mode"] in ["murf_falcon", "agora_managed_minimax"]
    assert hc["asr_mode"] == "agora_managed_deepgram_nova3"
    assert "public_tools_url_ready" in hc
    assert hc["github_mode"] in ["live", "dry_run"]
    print(f"✅ 3. Diagnostics GET /api/health/config: PASSED (LLM: {hc['llm_mode']}, Model: {hc['gemini_model']}, TTS: {hc['tts_mode']}, ASR: {hc['asr_mode']})")

    # 4. Simulate Tier 1 (Minor / Flaky Build)
    r = client.post("/api/simulate/minor")
    assert r.status_code == 200, f"Simulate minor failed: {r.text}"
    t1_data = r.json()
    assert t1_data["incident"]["tier"] == "TIER_1_AUTO"
    assert t1_data["incident"]["status"] == "AUTO_HEALED"
    assert t1_data["incident"]["blast_radius_score"] == 14
    print(f"✅ 4. Simulate Tier 1 (Flaky Build): PASSED (Auto-healed silently, blast radius={t1_data['incident']['blast_radius_score']})")

    # 5. Simulate Tier 2 (Critical / Prod Checkout Crash)
    r = client.post("/api/simulate/critical")
    assert r.status_code == 200, f"Simulate critical failed: {r.text}"
    t2_data = r.json()
    assert t2_data["incident"]["tier"] == "TIER_2_VOICE"
    assert t2_data["incident"]["status"] == "CALL_RINGING"
    assert t2_data["incident"]["blast_radius_score"] == 94
    incident_id = t2_data["incident"]["id"]
    print(f"✅ 5. Simulate Tier 2 (Prod Crash): PASSED (Ringing on-call voice channel, blast radius={t2_data['incident']['blast_radius_score']}, id={incident_id})")

    # 6. Start Agora Call (Agora v2 ConvoAI Engine + Deepgram Nova-3 + Gemini)
    r = client.post("/api/calls/start", json={"incident_id": incident_id})
    assert r.status_code == 200, f"Call start failed: {r.text}"
    call_data = r.json()
    assert call_data["channel"] == f"incident-{incident_id}"
    assert call_data["uid"] == 1001
    assert "token" in call_data
    print(f"✅ 6. Start Agora Voice Call: PASSED (Channel: {call_data['channel']}, User UID: 1001, Agent ID: {call_data.get('agent_id')})")

    # 7. Test Mid-Call Tool: executeRollback
    secret_header = {"Authorization": f"Bearer {settings.TOOL_WEBHOOK_SECRET}"}
    r = client.post(
        "/api/tools/rollback",
        headers=secret_header,
        json={
            "incident_id": incident_id,
            "target_version": "v1.4.2",
            "approved_by_voice": "Yes, grant full rollback permission to v1.4.2."
        }
    )
    assert r.status_code == 200, f"Rollback tool failed: {r.text}"
    rollback_res = r.json()
    assert rollback_res["status"] == "success"
    print(f"✅ 7. Mid-Call Tool 'executeRollback': PASSED ({rollback_res['message']})")

    # 8. Test Mid-Call Tool: applyLimitedMitigation
    r = client.post(
        "/api/tools/limited-mitigation",
        headers=secret_header,
        json={
            "incident_id": incident_id,
            "action": "restart_service",
            "note": "Restart worker and open hotfix issue"
        }
    )
    assert r.status_code == 200, f"Limited mitigation tool failed: {r.text}"
    mitigation_res = r.json()
    assert mitigation_res["status"] == "success"
    print(f"✅ 8. Mid-Call Tool 'applyLimitedMitigation': PASSED ({mitigation_res['message']})")

    # 9. Test Mid-Call Tool: logManualHandoff
    r = client.post(
        "/api/tools/manual-handoff",
        headers=secret_header,
        json={
            "incident_id": incident_id,
            "reason": "Developer manual takeover"
        }
    )
    assert r.status_code == 200, f"Manual handoff tool failed: {r.text}"
    print("✅ 9. Mid-Call Tool 'logManualHandoff': PASSED")

    # 10. Verify Permission Audit Ledger
    r = client.get("/api/audit")
    assert r.status_code == 200
    audit_data = r.json()
    logs = audit_data["audit_logs"]
    assert len(logs) >= 5
    print(f"✅ 10. Audit Trail Ledger: PASSED ({len(logs)} audit entries recorded)")

    print("\n🎉 ALL 10 TESTS PASSED CLEANLY WITH ZERO REGRESSIONS!")

if __name__ == "__main__":
    run_tests()

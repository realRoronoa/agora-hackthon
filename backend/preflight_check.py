import httpx
import json
from pathlib import Path

print("==============================================")
print("🔍 RUNNING 3 LIVE PRE-FLIGHT CHECKS")
print("==============================================")

# Read config from .env to get TOOL_WEBHOOK_SECRET and PUBLIC_BASE_URL
env_file = Path(__file__).resolve().parent.parent / ".env"
env_dict = {}
for line in env_file.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env_dict[k.strip()] = v.strip()

public_url = env_dict.get("PUBLIC_BASE_URL", "").rstrip("/")
tool_secret = env_dict.get("TOOL_WEBHOOK_SECRET", "")

# --- Check 1: Local Health & Config ---
print("\n[CHECK 1] Local Health & Config (GET http://localhost:8000/api/health/config):")
try:
    r1 = httpx.get("http://localhost:8000/api/health/config", timeout=5.0)
    print(f"Status: {r1.status_code}")
    cfg = r1.json()
    print(json.dumps(cfg, indent=2))
    assert r1.status_code == 200, f"Status code {r1.status_code}"
    assert cfg["demo_mode"] is False, "demo_mode is not False!"
    assert cfg["agora_ready"] is True, "agora_ready is not True!"
    assert cfg["public_tools_url_ready"] is True, "public_tools_url_ready is not True!"
    check1_pass = True
    print("--> Check 1: PASSED")
except Exception as e:
    check1_pass = False
    print(f"--> Check 1 FAILED: {e}")

# --- Check 2: Public Tunnel Tool Callback ---
print(f"\n[CHECK 2] Public Tunnel Tool Callback (POST {public_url}/api/tools/limited-mitigation):")
try:
    headers = {
        "Authorization": f"Bearer {tool_secret}",
        "Content-Type": "application/json",
    }
    payload = {
        "incident_id": "preflight-1",
        "action": "restart_service",
        "note": "public tunnel check",
    }
    r2 = httpx.post(f"{public_url}/api/tools/limited-mitigation", headers=headers, json=payload, timeout=15.0)
    print(f"Status: {r2.status_code}")
    content_type = r2.headers.get("content-type", "")
    print(f"Content-Type: {content_type}")
    body = r2.json()
    print(f"Response Body: {json.dumps(body, indent=2)}")
    assert r2.status_code == 200, f"Status code {r2.status_code}"
    assert body.get("status") == "success", "Response status is not success"
    check2_pass = True
    print("--> Check 2: PASSED")
except Exception as e:
    check2_pass = False
    print(f"--> Check 2 FAILED: {e}")

# --- Check 3: Frontend Live ---
print("\n[CHECK 3] Frontend Live (GET http://localhost:5173):")
try:
    r3 = httpx.get("http://localhost:5173", timeout=5.0)
    print(f"Status: {r3.status_code}")
    assert r3.status_code == 200, f"Status code {r3.status_code}"
    assert "<html" in r3.text.lower() or "<!doctype html>" in r3.text.lower(), "HTML tag missing"
    check3_pass = True
    print("--> Check 3: PASSED")
except Exception as e:
    check3_pass = False
    print(f"--> Check 3 FAILED: {e}")

print("\n==============================================")
print(f"PRE-FLIGHT SUMMARY: Check1={'PASS' if check1_pass else 'FAIL'} | Check2={'PASS' if check2_pass else 'FAIL'} | Check3={'PASS' if check3_pass else 'FAIL'}")
print("==============================================")

if not (check1_pass and check2_pass and check3_pass):
    exit(1)

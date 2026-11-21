# 🚨 NightWatch AI — Autonomous DevOps Voice Escalation & Incident Command Console

> **Hackathon MVP for "Build with Agora - BLR" (Agora + Google Gemini + Murf AI + AWS / DevOps)**  
> Built for zero-fatigue on-call operations: auto-heals flaky CI/CD builds silently, but rings the engineer at 2:14 AM via Agora Conversational AI voice when catastrophic production outages strike—requiring strict, verbal permission-scoped authorization before destructive rollbacks can execute.

---

## ⚡ Quick Start (Runnable in 60 Seconds)

NightWatch AI is built as a complete runnable monorepo with **zero placeholder logic**. It runs out-of-the-box in `DEMO_MODE=true` without requiring any API keys, and switches seamlessly to live Agora + Google Gemini + Murf AI + GitHub execution as soon as credentials are added to `.env`.

### 1. Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows PowerShell:
.\.venv\Scripts\activate
# On Linux / macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```
The FastAPI backend runs on `http://localhost:8000`.  
- Interactive API Docs: `http://localhost:8000/docs`  
- Live Diagnostics: `http://localhost:8000/api/health/config`
- WebSocket Live Event Stream: `ws://localhost:8000/ws/events`

### 2. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
The DevOps command console will be live at `http://localhost:5173`.

---

## 🚀 Live Testing & Demonstration Flow

Open `http://localhost:5173` and click the one-click simulation buttons in the top bar:

### Scenario A: Simulate Tier 1 (Flaky Build)
1. Click **"Simulate Tier 1 (Flaky Build)"**.
2. NightWatch AI triages the transient error logs (`ETIMEDOUT` / socket hangup in jest worker) via Google Gemini API (with deterministic fallback).
3. Evaluates Blast Radius: **14/100**.
4. Flags risk as `TIER_1_AUTO`.
5. Automatically invalidates cache and re-dispatches the GitHub Actions workflow run silently—**without waking the developer**.
6. The UI flips to `TIER 1: AUTO-HEALED` in real time.

### Scenario B: Simulate Tier 2 (Prod Checkout Crash)
1. Click **"Simulate Tier 2 (Prod Checkout Crash)"**.
2. NightWatch AI triages database connection pool exhaustion causing cascading 500 errors on `/v1/checkout`.
3. Evaluates Blast Radius: **94/100**.
4. Flags risk as `TIER_2_VOICE` (P1 Critical Outage).
5. The console rings immediately with a pulsing red banner: **`[02:14:02 AM] P1 PRODUCTION ESCALATION - RINGING`**.
6. Click **"Answer Call"**:
   - Joins Agora RTC channel (`UID: 1001`).
   - Spawns the Agora Conversational AI Agent (`UID: 9999`) powered by **Google Gemini 3.6 Flash**, **Deepgram Nova-3 ASR**, and **Murf AI Falcon TTS**.
   - Agent speaks: *"Alert. NightWatch here. Production checkout just crashed after the latest deployment. Do I have full permission to roll back to v1.4.2, or only limited permission to restart the worker and log a hotfix issue?"*
7. Grant permission either via your live microphone or using the quick simulation pills:
   - **Full Rollback (`executeRollback`)**: Developer grants verbal approval. The tool executes `POST /api/tools/rollback`, dispatches GitHub rollback workflow to tag `v1.4.2`, and updates the Permission Ledger in real time.
   - **Limited Scope (`applyLimitedMitigation`)**: Developer grants limited approval. Restarts the worker pod, logs hotfix issue `#142`, and bypasses destructive code rollback.
   - **Deny Scope (`logManualHandoff`)**: Developer takes over manually. Halts autonomous actions.

---

## 🎙️ Agora Conversational AI Engine v2 Integration

The voice agent is driven directly by Agora's Conversational AI Engine v2 REST API (`https://docs.agora.io/`):

- **Join Endpoint:** `POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{AGORA_APP_ID}/join`
- **Leave Endpoint:** `POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{AGORA_APP_ID}/agents/{agent_id}/leave`
- **Authentication:** `Authorization: Basic <base64(AGORA_CUSTOMER_ID + ":" + AGORA_CUSTOMER_SECRET)>`
- **Managed ASR:** **Deepgram Nova-3** (`wss://api.deepgram.com/v1/listen`, keyterm: `rollback` — zero extra STT key needed)
- **Primary LLM:** **Google Gemini 3.6 Flash** via OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`) or Native Gemini SSE format. If `GEMINI_API_KEY` is empty, automatically falls back to Agora Managed Mode.
- **Ultra-Low Latency TTS:** **Murf AI Falcon** (`wss://global.api.murf.ai/v1/speech/stream-input`, Voice: `Matthew`, 24kHz). If `MURF_API_KEY` is omitted, automatically falls back to Agora Managed MiniMax (`speech-2.6-turbo`).
- **Synchronous Mid-Call HTTPS Tools:**
  1. `executeRollback`: Called only when developer gives explicit verbal approval for rollback.
  2. `applyLimitedMitigation`: Restarts worker and files a GitHub hotfix issue without code changes.
  3. `logManualHandoff`: Halts automation when developer denies permission.

> *CRITICAL AGORA RULE:* Tool function names are strictly alphanumeric camelCase (`executeRollback`, `applyLimitedMitigation`, `logManualHandoff`) without underscores.

---

## 🔑 Environment Configuration (`.env`)

```env
DEMO_MODE=true
PUBLIC_BASE_URL=https://your-ngrok-url.ngrok-free.app
TOOL_WEBHOOK_SECRET=nightwatch-dev-secret-2026

# Agora Console (https://console.agora.io)
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
AGORA_CUSTOMER_ID=
AGORA_CUSTOMER_SECRET=

# Google Gemini API (https://aistudio.google.com/)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
GEMINI_AGORA_MODE=openai_compat

# Optional Agora RTM Transcripts
ENABLE_RTM_TRANSCRIPTS=false

# Murf AI (Optional - falls back to Agora Managed MiniMax if empty)
MURF_API_KEY=

# GitHub (Optional - falls back to safe dry run if empty)
GITHUB_TOKEN=
GITHUB_REPO=owner/repo
GITHUB_ROLLBACK_WORKFLOW=rollback.yml
```

### Start your HTTPS tunnel for tool callbacks:
```bash
ngrok http 8000
```
Copy the forwarding HTTPS URL into `PUBLIC_BASE_URL` in `.env` so Agora ConvoAI can call your synchronous tool webhook endpoints mid-call.

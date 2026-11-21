import json
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from config import settings
from models import HealthConfigResponse
from services.state import manager, get_active_incident, get_audit_logs, get_all_incidents
from routers import webhooks, calls, tools


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    print(f"🚀 NightWatch AI backend initialized. Mode: {'DEMO' if settings.DEMO_MODE else 'LIVE'}")
    print(f"🧠 LLM Engine: {settings.llm_mode} (Model: {settings.GEMINI_MODEL})")
    print(f"🎙️ TTS Engine: {settings.tts_mode}")
    print(f"👂 ASR Engine: {settings.asr_mode}")
    print(f"📡 Public Webhook Base: {settings.PUBLIC_BASE_URL}")
    yield
    # Shutdown actions
    print("🛑 NightWatch AI backend shutting down.")


app = FastAPI(
    title="NightWatch AI - DevOps Incident Command & Voice Escalator",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS configuration for local React / Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(webhooks.router)
app.include_router(calls.router)
app.include_router(tools.router)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


@app.get("/")
async def root():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {
        "app": "NightWatch AI",
        "description": "DevOps Incident Command Console & Autonomous Voice Escalator",
        "status": "online",
        "mode": "DEMO_MODE" if settings.DEMO_MODE else "LIVE_AGORA_MURF_GEMINI",
        "llm_mode": settings.llm_mode,
        "tts_mode": settings.tts_mode,
        "asr_mode": settings.asr_mode,
        "docs": "/docs",
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": "ok"}


@app.get("/api/health/config", response_model=HealthConfigResponse)
async def health_config():
    """
    Live diagnostics endpoint returning safe booleans & mode descriptors.
    Zero raw API keys are ever leaked.
    """
    return HealthConfigResponse(
        demo_mode=settings.DEMO_MODE,
        agora_ready=settings.agora_ready,
        llm_mode=settings.llm_mode,
        gemini_model=settings.GEMINI_MODEL,
        tts_mode=settings.tts_mode,
        asr_mode=settings.asr_mode,
        public_tools_url_ready=settings.public_tools_url_ready,
        github_mode=settings.github_mode,
    )


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    """
    Real-time bidirectional event stream for frontend command console.
    Pushes incident status changes, triage results, incoming voice calls, and audit logs.
    """
    await manager.connect(websocket)
    try:
        # Send initial snapshot upon connection
        initial_payload = {
            "type": "init",
            "data": {
                "active_incident": get_active_incident().model_dump() if get_active_incident() else None,
                "all_incidents": [inc.model_dump() for inc in get_all_incidents()],
                "audit_logs": [log.model_dump() for log in get_audit_logs()],
                "demo_mode": settings.DEMO_MODE,
                "is_live_ready": settings.is_live_ready,
                "health_config": {
                    "demo_mode": settings.DEMO_MODE,
                    "agora_ready": settings.agora_ready,
                    "llm_mode": settings.llm_mode,
                    "gemini_model": settings.GEMINI_MODEL,
                    "tts_mode": settings.tts_mode,
                    "asr_mode": settings.asr_mode,
                    "public_tools_url_ready": settings.public_tools_url_ready,
                    "github_mode": settings.github_mode,
                },
            },
        }
        await websocket.send_text(json.dumps(initial_payload))

        # Keep connection open and listen for client pings
        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
                if data.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# Catch-all route to serve SPA files / subpaths
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api") or full_path.startswith("ws") or full_path in ["docs", "openapi.json", "redoc"]:
        raise HTTPException(status_code=404, detail="Not Found")
    file_path = FRONTEND_DIST / full_path
    if file_path.is_file():
        return FileResponse(str(file_path))
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    raise HTTPException(status_code=404, detail="Not Found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

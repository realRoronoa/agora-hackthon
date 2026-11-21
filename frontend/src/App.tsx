import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Radio,
  Wifi,
  WifiOff,
  Cpu,
  Mic,
  Volume2,
  Globe,
  GitBranch,
} from "lucide-react";
import { IncidentFeed } from "./components/IncidentFeed";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { PermissionLedger, AuditLog } from "./components/PermissionLedger";
import { DemoControls } from "./components/DemoControls";

interface Incident {
  id: string;
  title: string;
  service: string;
  repository: string;
  commit_sha: string;
  branch: string;
  error_logs: string;
  stack_trace: string;
  tier: "TIER_1_AUTO" | "TIER_2_VOICE";
  blast_radius_score: number;
  status: string;
  triage_summary: string;
  triage_reason: string;
  channel_name: string;
  target_version?: string;
  mitigation_action?: string;
  voice_approval_quote?: string;
}

interface HealthConfig {
  demo_mode: boolean;
  agora_ready: boolean;
  llm_mode: string;
  gemini_model: string;
  tts_mode: string;
  asr_mode: string;
  public_tools_url_ready: boolean;
  github_mode: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [healthConfig, setHealthConfig] = useState<HealthConfig>({
    demo_mode: true,
    agora_ready: false,
    llm_mode: "gemini_openai_compat",
    gemini_model: "gemini-3.6-flash",
    tts_mode: "agora_managed_minimax",
    asr_mode: "agora_managed_deepgram_nova3",
    public_tools_url_ready: false,
    github_mode: "dry_run",
  });
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);

  // Initialize data and WebSocket connection
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const configRes = await fetch(`${API_BASE}/api/health/config`);
        if (configRes.ok) {
          const cfg = await configRes.json();
          setHealthConfig(cfg);
        }

        const incRes = await fetch(`${API_BASE}/api/incidents`);
        if (incRes.ok) {
          const incData = await incRes.json();
          if (incData.active_incident) {
            setActiveIncident(incData.active_incident);
          }
        }

        const auditRes = await fetch(`${API_BASE}/api/audit`);
        if (auditRes.ok) {
          const audData = await auditRes.json();
          setAuditLogs(audData.audit_logs || []);
        }
      } catch (err) {
        console.warn("Error fetching initial state", err);
      }
    };

    fetchInitialData();

    // WebSocket connection
    const connectWs = () => {
      let wsUrl = import.meta.env.VITE_WS_URL;
      if (!wsUrl) {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = API_BASE ? new URL(API_BASE).host : window.location.host;
        wsUrl = `${protocol}//${host}/ws/events`;
      }

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "init") {
            if (msg.data.active_incident) setActiveIncident(msg.data.active_incident);
            if (msg.data.audit_logs) setAuditLogs(msg.data.audit_logs);
            if (msg.data.health_config) setHealthConfig(msg.data.health_config);
          } else if (msg.type === "incident_created" || msg.type === "incident_escalated") {
            setActiveIncident(msg.data);
          } else if (msg.type === "incident_updated") {
            setActiveIncident(msg.data);
          } else if (msg.type === "tool_executed") {
            if (msg.data.incident) setActiveIncident(msg.data.incident);
            if (msg.data.audit_log) {
              setAuditLogs((prev) => [msg.data.audit_log, ...prev]);
            }
          }
        } catch (e) {
          console.error("WS message parse error", e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const handleSimulate = async (scenario: "minor" | "critical") => {
    const res = await fetch(`${API_BASE}/api/simulate/${scenario}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.incident) {
        setActiveIncident(data.incident);
      }
      const auditRes = await fetch(`${API_BASE}/api/audit`);
      if (auditRes.ok) {
        const aud = await auditRes.json();
        setAuditLogs(aud.audit_logs || []);
      }
    }
  };

  const handleCallStart = async (incidentId: string) => {
    const res = await fetch(`${API_BASE}/api/calls/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident_id: incidentId }),
    });
    if (!res.ok) throw new Error("Failed to start voice call");
    const data = await res.json();
    const auditRes = await fetch(`${API_BASE}/api/audit`);
    if (auditRes.ok) {
      const aud = await auditRes.json();
      setAuditLogs(aud.audit_logs || []);
    }
    return data;
  };

  const handleCallStop = async (incidentId: string) => {
    await fetch(`${API_BASE}/api/calls/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident_id: incidentId }),
    });
    const auditRes = await fetch(`${API_BASE}/api/audit`);
    if (auditRes.ok) {
      const aud = await auditRes.json();
      setAuditLogs(aud.audit_logs || []);
    }
  };

  const handleSimulateVoice = async (incidentId: string, action: string, text: string) => {
    const res = await fetch(`${API_BASE}/api/calls/simulate-voice-input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_id: incidentId,
        action,
        spoken_text: text,
      }),
    });
    if (res.ok) {
      const auditRes = await fetch(`${API_BASE}/api/audit`);
      if (auditRes.ok) {
        const aud = await auditRes.json();
        setAuditLogs(aud.audit_logs || []);
      }
    }
  };

  // Helper labels for pills
  const renderLlmLabel = () => {
    if (healthConfig.llm_mode === "gemini_openai_compat") return "Gemini 3.6 Flash";
    if (healthConfig.llm_mode === "gemini_native") return "Gemini 3.6 (Native)";
    return "Managed LLM";
  };

  const renderTtsLabel = () => {
    if (healthConfig.tts_mode === "murf_falcon") return "Murf Falcon TTS";
    return "MiniMax (Managed)";
  };

  return (
    <div className="min-h-screen bg-[#0B0D10] text-[#E2E8F0] flex flex-col font-sans selection:bg-red-500/30 selection:text-red-200">
      {/* Top DevOps Command Header */}
      <header className="border-b border-[#22262E] bg-[#0E1116] px-4 py-2 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-red-950/80 border border-red-700/60 flex items-center justify-center">
                <Shield className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm tracking-wider text-zinc-100">NIGHTWATCH AI</span>
                  <span className="text-[10px] font-mono text-zinc-500">Agora v2 • Gemini</span>
                </div>
                <p className="text-[10px] font-mono text-zinc-400 hidden sm:block">
                  DevOps Incident Command & Autonomous Voice Escalator
                </p>
              </div>
            </div>

            <div className="h-5 w-px bg-[#22262E] mx-1 hidden md:block" />

            {/* Active Channel Badge */}
            {activeIncident && (
              <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
                <Radio className="w-3 h-3 text-red-400" />
                <span>RTC: {activeIncident.channel_name}</span>
              </div>
            )}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <DemoControls onSimulate={handleSimulate} />

            {/* WebSocket Live Indicator */}
            <div
              className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded ${
                wsConnected ? "text-emerald-400 bg-emerald-950/30" : "text-zinc-500 bg-zinc-900"
              }`}
              title={wsConnected ? "WebSocket Live Connected" : "WebSocket Disconnected"}
            >
              {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden md:inline">{wsConnected ? "ONLINE" : "OFFLINE"}</span>
            </div>
          </div>
        </div>

        {/* Live Diagnostics Health Bar (Safe booleans & mode descriptors) */}
        <div className="flex items-center gap-2 overflow-x-auto text-[11px] font-mono py-0.5">
          {/* Demo Mode / Live Mode */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
              healthConfig.demo_mode
                ? "bg-amber-950/40 text-amber-300 border-amber-800/50"
                : "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${healthConfig.demo_mode ? "bg-amber-400" : "bg-emerald-400 animate-pulse"}`} />
            {healthConfig.demo_mode ? "DEMO MODE" : "LIVE MODE"}
          </span>

          {/* Agora RTC & ConvoAI Ready */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
              healthConfig.agora_ready
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                : "bg-zinc-900 text-zinc-400 border-zinc-800"
            }`}
            title="Agora App ID & Customer REST credentials"
          >
            <Radio className="w-3 h-3" />
            Agora: {healthConfig.agora_ready ? "Connected" : "Simulated"}
          </span>

          {/* LLM Engine */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
              healthConfig.llm_mode.includes("gemini")
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                : "bg-zinc-900 text-zinc-400 border-zinc-800"
            }`}
          >
            <Cpu className="w-3 h-3" />
            LLM: {renderLlmLabel()}
          </span>

          {/* TTS Engine */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
              healthConfig.tts_mode === "murf_falcon"
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                : "bg-zinc-900 text-zinc-400 border-zinc-800"
            }`}
          >
            <Volume2 className="w-3 h-3" />
            TTS: {renderTtsLabel()}
          </span>

          {/* ASR Engine */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-zinc-900 text-zinc-300 border-zinc-800">
            <Mic className="w-3 h-3 text-emerald-400" />
            ASR: Deepgram Nova-3
          </span>

          {/* Public Tools Tunnel */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
              healthConfig.public_tools_url_ready
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                : "bg-amber-950/30 text-amber-300/80 border-amber-900/40"
            }`}
            title="HTTPS URL for Agora mid-call tool webhook execution"
          >
            <Globe className="w-3 h-3" />
            Webhook: {healthConfig.public_tools_url_ready ? "HTTPS Live" : "Local/ngrok Pending"}
          </span>

          {/* GitHub Actions */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
              healthConfig.github_mode === "live"
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                : "bg-zinc-900 text-zinc-400 border-zinc-800"
            }`}
          >
            <GitBranch className="w-3 h-3" />
            GitHub: {healthConfig.github_mode === "live" ? "Live Dispatch" : "Dry Run Safe"}
          </span>
        </div>
      </header>

      {/* Main Split View Console */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1700px] w-full mx-auto overflow-hidden">
        {/* Left Column: CI/CD Incident Stream, Triage Reason, Stack Trace (7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-[500px]">
          <IncidentFeed incident={activeIncident} />
        </div>

        {/* Right Column: Active Voice Call Console + Permission Audit Ledger (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-full min-h-[500px]">
          <IncomingCallModal
            incident={activeIncident}
            onCallStart={handleCallStart}
            onCallStop={handleCallStop}
            onSimulateVoice={handleSimulateVoice}
            isDemoMode={healthConfig.demo_mode}
            ttsMode={healthConfig.tts_mode}
            llmMode={healthConfig.llm_mode}
          />
          <PermissionLedger logs={auditLogs} />
        </div>
      </main>
    </div>
  );
}

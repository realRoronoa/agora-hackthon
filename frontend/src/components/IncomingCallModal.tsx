import React, { useState } from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Radio,
  Bot,
  User,
  Volume2,
  RotateCcw,
  RefreshCw,
  HandMetal,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import { useAgoraCall } from "../hooks/useAgoraCall";

interface Incident {
  id: string;
  title: string;
  service: string;
  tier: "TIER_1_AUTO" | "TIER_2_VOICE";
  status: string;
  channel_name: string;
  target_version?: string;
  voice_approval_quote?: string;
}

interface IncomingCallModalProps {
  incident: Incident | null;
  onCallStart: (incidentId: string) => Promise<{
    channel: string;
    token: string;
    uid: number;
    app_id: string;
    demo_mode: boolean;
    enable_rtm?: boolean;
    rtm_token?: string | null;
  }>;
  onCallStop: (incidentId: string) => Promise<void>;
  onSimulateVoice: (incidentId: string, action: string, text: string) => Promise<void>;
  isDemoMode: boolean;
  ttsMode?: string;
  llmMode?: string;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incident,
  onCallStart,
  onCallStop,
  onSimulateVoice,
  isDemoMode,
  ttsMode = "murf_falcon",
  llmMode = "gemini_openai_compat",
}) => {
  const {
    inCall,
    isMuted,
    agentSpeaking,
    callDuration,
    transcripts,
    joinCall,
    leaveCall,
    toggleMute,
    addManualTranscript,
  } = useAgoraCall();

  const [connecting, setConnecting] = useState(false);
  const [selectedVoiceQuote, setSelectedVoiceQuote] = useState<string | null>(null);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswer = async () => {
    if (!incident) return;
    try {
      setConnecting(true);
      const res = await onCallStart(incident.id);
      await joinCall({
        appId: res.app_id,
        channel: res.channel,
        token: res.token,
        uid: res.uid || 1001,
        incidentId: incident.id,
        isDemoMode: res.demo_mode || isDemoMode,
        enableRtm: res.enable_rtm,
        rtmToken: res.rtm_token,
      });
    } catch (err) {
      console.error("Failed to answer call", err);
    } finally {
      setConnecting(false);
    }
  };

  const handleHangUp = async () => {
    if (!incident) return;
    await leaveCall();
    await onCallStop(incident.id);
  };

  const handleSimulateVoiceCommand = async (action: string, text: string) => {
    if (!incident) return;
    setSelectedVoiceQuote(text);
    addManualTranscript("user", text);
    await onSimulateVoice(incident.id, action, text);
    if (action === "rollback") {
      addManualTranscript("agent", "Confirmed. Executing full production rollback to v1.4.2 via GitHub Actions. Health checks green.");
    } else if (action === "limited") {
      addManualTranscript("agent", "Understood. Applied limited mitigation: restarted worker pod and opened hotfix issue #142.");
    } else {
      addManualTranscript("agent", "Manual handoff logged. Automated actions halted. Handing command over to you.");
    }
  };

  const isRinging = incident && incident.status === "CALL_RINGING" && !inCall;

  return (
    <div className="flex flex-col gap-3">
      {/* 2:14 AM Urgent Escalation Alert Banner */}
      {isRinging && (
        <div className="p-4 bg-red-950/50 border-2 border-red-600 rounded-lg animate-p1-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center animate-bounce">
                <PhoneCall className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold tracking-widest text-red-400 uppercase">
                    [02:14:02 AM] P1 PRODUCTION ESCALATION
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-600 text-white font-bold">
                    RINGING
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white mt-0.5 font-mono">
                  Incoming Voice Call: NightWatch AI (Agora ConvoAI + Deepgram + Gemini)
                </h4>
                <p className="text-xs text-red-200/80 font-mono mt-0.5">
                  Production checkout outage detected. Verbal authorization required for v1.4.2 rollback.
                </p>
              </div>
            </div>

            <button
              onClick={handleAnswer}
              disabled={connecting}
              className="px-5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg hover:shadow-emerald-500/40 transition-all duration-200 active:scale-95"
            >
              <PhoneCall className="w-4 h-4 fill-current" />
              <span>{connecting ? "Connecting..." : "Answer Call"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Active Call Console */}
      <div className="p-4 bg-[#12151A] border border-[#22262E] rounded-lg">
        {/* Console Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#22262E]">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${inCall ? "text-emerald-400 animate-pulse" : "text-zinc-600"}`} />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300">
              Agora Voice Command Console
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {inCall ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-red-950/40 border border-red-800/60 text-red-300">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>LIVE {formatTimer(callDuration)}</span>
              </div>
            ) : (
              <span className="text-zinc-500 text-[11px]">STANDBY</span>
            )}
          </div>
        </div>

        {/* Middle Voice Interaction Area */}
        <div className="py-4">
          {inCall ? (
            <div className="space-y-4">
              {/* Agent Persona & Live Waveform */}
              <div className="flex items-center justify-between p-3 bg-[#0B0D10] border border-[#22262E] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${agentSpeaking ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500" : "bg-zinc-800 text-zinc-400"}`}>
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-zinc-200">NightWatch Voice Responder</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                        {ttsMode === "murf_falcon" ? "Murf Falcon (Matthew)" : "MiniMax (Managed)"}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                        {llmMode.includes("gemini") ? "Google Gemini 3.6" : "Managed LLM"}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {agentSpeaking ? "Streaming audio to browser..." : "Listening on RTC channel..."}
                    </span>
                  </div>
                </div>

                {/* Animated Audio Waveform */}
                <div className="flex items-center gap-1 h-6 px-3">
                  <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-1" : "h-1"}`} />
                  <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-2" : "h-2"}`} />
                  <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-3" : "h-1"}`} />
                  <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-4" : "h-3"}`} />
                  <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-5" : "h-1"}`} />
                </div>
              </div>

              {/* Live Transcript / Speech History Box */}
              <div className="p-3 bg-[#0B0D10] border border-[#22262E] rounded-lg max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold mb-1 pb-1 border-b border-[#22262E]">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Call Transcript & Speech Stream</span>
                </div>
                {transcripts.map((t, i) => (
                  <div key={i} className={`p-2 rounded ${t.sender === "agent" ? "bg-zinc-900/60 border border-zinc-800/80" : "bg-emerald-950/30 border border-emerald-900/40"}`}>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-0.5">
                      <span className={t.sender === "agent" ? "text-zinc-300 font-semibold" : "text-emerald-400 font-semibold"}>
                        {t.sender === "agent" ? "🤖 NightWatch AI" : "👤 You (Developer)"}
                      </span>
                      <span>{t.time}</span>
                    </div>
                    <p className="text-zinc-200 leading-relaxed text-[11px]">{t.text}</p>
                  </div>
                ))}
              </div>

              {/* Developer Call Controls */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium border transition-colors ${isMuted ? "bg-amber-950/40 text-amber-400 border-amber-800/60" : "bg-zinc-800 text-zinc-200 border-zinc-700"}`}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
                  </button>
                  <span className="text-[11px] font-mono text-zinc-500">RTC UID: 1001</span>
                </div>

                <button
                  onClick={handleHangUp}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-mono font-semibold bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>Hang Up</span>
                </button>
              </div>

              {/* Fallback / Quick Voice Simulation Pills */}
              <div className="mt-3 pt-3 border-t border-[#22262E]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                    Simulated Verbal Responses (Demo Mode & Mic Fallback):
                  </span>
                  {selectedVoiceQuote && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Transcribed
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {/* Full Rollback Pill */}
                  <button
                    onClick={() =>
                      handleSimulateVoiceCommand(
                        "rollback",
                        "Yes, grant full permission. Roll back checkout-service to v1.4.2 immediately."
                      )
                    }
                    className="flex items-center justify-between p-2 rounded bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/40 hover:border-emerald-500 text-left text-xs font-mono transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-zinc-200">
                        <strong className="text-emerald-400">Full Scope:</strong> "Yes, roll back to v1.4.2"
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 group-hover:text-emerald-300 font-mono">executeRollback()</span>
                  </button>

                  {/* Limited Scope Pill */}
                  <button
                    onClick={() =>
                      handleSimulateVoiceCommand(
                        "limited",
                        "Only limited permission. Just restart the worker pod and log a hotfix issue."
                      )
                    }
                    className="flex items-center justify-between p-2 rounded bg-amber-950/30 hover:bg-amber-900/40 border border-amber-800/40 hover:border-amber-500 text-left text-xs font-mono transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-zinc-200">
                        <strong className="text-amber-400">Limited Scope:</strong> "Restart worker & open hotfix issue"
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 group-hover:text-amber-300 font-mono">applyLimitedMitigation()</span>
                  </button>

                  {/* Manual Handoff Pill */}
                  <button
                    onClick={() =>
                      handleSimulateVoiceCommand(
                        "handoff",
                        "No automated action. Denied. I am opening my terminal and taking over manually."
                      )
                    }
                    className="flex items-center justify-between p-2 rounded bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700 text-left text-xs font-mono transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <HandMetal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-zinc-300">
                        <strong className="text-zinc-200">Deny Scope:</strong> "Manual takeover, do not touch code"
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 font-mono">logManualHandoff()</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <PhoneCall className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-mono text-zinc-400">Voice channel idle.</p>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                On P1 escalation, Agora RTC channel connects with UID 1001 & AI Agent 9999.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

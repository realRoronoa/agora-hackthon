import React, { useState } from "react";
import {
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  Mic,
  MicOff,
  Radio,
  Bot,
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Volume2,
  RotateCcw,
  RefreshCw,
  HandMetal,
  CheckCircle,
  MessageSquare,
  Edit2,
  Check,
  Clock,
  Sparkles,
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
  onTriggerCall?: () => Promise<void>;
  isDemoMode: boolean;
  ttsMode?: string;
  llmMode?: string;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incident,
  onCallStart,
  onCallStop,
  onSimulateVoice,
  onTriggerCall,
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

  // Editable On-Call Developer Roster
  const [engineerName, setEngineerName] = useState("Aman Nautiyal (On-Call SRE)");
  const [engineerPhone, setEngineerPhone] = useState("+91 98XXX XXXXX");
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [tempName, setTempName] = useState(engineerName);
  const [tempPhone, setTempPhone] = useState(engineerPhone);

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

  const handleDecline = async () => {
    if (!incident) return;
    await onSimulateVoice(incident.id, "handoff", "Declined voice call. Taking over on terminal.");
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

  const saveRoster = () => {
    setEngineerName(tempName);
    setEngineerPhone(tempPhone);
    setIsEditingRoster(false);
  };

  const isRinging = incident && incident.status === "CALL_RINGING" && !inCall;

  return (
    <div className="flex flex-col gap-3">
      {/* Main Container Card: Phone Console */}
      <div className={`p-4 bg-[#12151A] border rounded-lg transition-all duration-300 ${
        isRinging
          ? "border-red-500 shadow-xl shadow-red-950/60 animate-p1-glow"
          : inCall
          ? "border-emerald-600/80 shadow-lg shadow-emerald-950/40"
          : "border-[#22262E]"
      }`}>
        {/* Console Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#22262E]">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${inCall ? "text-emerald-400 animate-pulse" : isRinging ? "text-red-400 animate-bounce" : "text-zinc-500"}`} />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
              Agora Voice Command Console
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {inCall ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-red-950/60 border border-red-700/80 text-red-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="font-bold">CALL IN PROGRESS {formatTimer(callDuration)}</span>
              </div>
            ) : isRinging ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600 text-white font-bold text-[11px] animate-pulse">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>INCOMING P1 CALL</span>
              </div>
            ) : (
              <span className="text-zinc-400 text-[11px] px-2 py-0.5 rounded bg-[#181C24] border border-zinc-800">
                DISPATCH STANDBY
              </span>
            )}
          </div>
        </div>

        {/* Console Body Area: 3 Distinct States */}
        <div className="pt-3">
          {/* ========================================================= */}
          {/* STATE 1: ACTIVE LIVE CALL (In-Call Experience)            */}
          {/* ========================================================= */}
          {inCall ? (
            <div className="space-y-3.5">
              {/* Agent Persona, Status & Live Waveform */}
              <div className="p-3 bg-[#0B0D10] border border-[#22262E] rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${agentSpeaking ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500 shadow-md shadow-emerald-500/20" : "bg-zinc-800 text-zinc-400"}`}>
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-zinc-100">NightWatch Voice Agent</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded">
                          Live Channel: Agora RTC + Murf Falcon
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 mt-0.5">
                        <span className="flex items-center gap-1 text-zinc-300">
                          <User className="w-3 h-3 text-zinc-500" /> {engineerName}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">{formatTimer(callDuration)}</span>
                        <span>•</span>
                        <span className="text-zinc-500">{agentSpeaking ? "AI Speaking..." : "Listening on mic..."}</span>
                      </div>
                    </div>
                  </div>

                  {/* Animated Audio Waveform */}
                  <div className="flex items-center gap-1 h-7 px-3 bg-[#12151A] rounded border border-zinc-800">
                    <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-1" : "h-1"}`} />
                    <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-2" : "h-3"}`} />
                    <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-3" : "h-1.5"}`} />
                    <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-4" : "h-4"}`} />
                    <span className={`w-1 bg-emerald-400 rounded-full transition-all ${agentSpeaking ? "wave-bar-5" : "h-2"}`} />
                  </div>
                </div>
              </div>

              {/* 3-Chip Quick Voice Prompt Cheat-Sheet (Always Visible Under Waveform) */}
              <div className="p-2.5 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider flex items-center gap-1 font-semibold">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Permission Choice Cheat-Sheet (Speak Or Click):
                  </span>
                  {selectedVoiceQuote && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Transcribed
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Chip 1: Full Scope */}
                  <button
                    onClick={() =>
                      handleSimulateVoiceCommand(
                        "rollback",
                        "Yes, grant full permission. Roll back checkout-service to v1.4.2 immediately."
                      )
                    }
                    className="flex flex-col p-2 rounded bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-800/50 hover:border-emerald-400 text-left transition-all group"
                  >
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Full Scope</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-300 mt-0.5 italic group-hover:text-white">
                      "Roll back to v1.4.2"
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 mt-1">executeRollback()</span>
                  </button>

                  {/* Chip 2: Limited Scope */}
                  <button
                    onClick={() =>
                      handleSimulateVoiceCommand(
                        "limited",
                        "Only limited permission. Just restart the worker pod and log a hotfix issue."
                      )
                    }
                    className="flex flex-col p-2 rounded bg-amber-950/30 hover:bg-amber-900/50 border border-amber-800/50 hover:border-amber-400 text-left transition-all group"
                  >
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Limited Scope</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-300 mt-0.5 italic group-hover:text-white">
                      "Restart service + hotfix"
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 mt-1">applyLimitedMitigation()</span>
                  </button>

                  {/* Chip 3: Deny Scope */}
                  <button
                    onClick={() =>
                      handleSimulateVoiceCommand(
                        "handoff",
                        "No automated action. Denied. I am opening my terminal and taking over manually."
                      )
                    }
                    className="flex flex-col p-2 rounded bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-700 hover:border-zinc-500 text-left transition-all group"
                  >
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-zinc-300">
                      <ShieldX className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Deny</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-300 mt-0.5 italic group-hover:text-white">
                      "Manual handoff"
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 mt-1">logManualHandoff()</span>
                  </button>
                </div>
              </div>

              {/* Live Transcript / Speech Stream Box */}
              <div className="p-3 bg-[#0B0D10] border border-[#22262E] rounded-lg max-h-40 overflow-y-auto space-y-2 font-mono text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold mb-1 pb-1 border-b border-[#22262E]">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Call Transcript & Speech Stream</span>
                </div>
                {transcripts.map((t, i) => (
                  <div key={i} className={`p-2 rounded ${t.sender === "agent" ? "bg-zinc-900/60 border border-zinc-800/80" : "bg-emerald-950/30 border border-emerald-900/40"}`}>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-0.5">
                      <span className={t.sender === "agent" ? "text-zinc-300 font-semibold" : "text-emerald-400 font-semibold"}>
                        {t.sender === "agent" ? "🤖 NightWatch AI" : `👤 ${engineerName}`}
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium border transition-colors ${
                      isMuted ? "bg-amber-950/40 text-amber-400 border-amber-800/60" : "bg-zinc-800 text-zinc-200 border-zinc-700"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
                  </button>
                  <span className="text-[11px] font-mono text-zinc-500">RTC UID: 1001</span>
                </div>

                <button
                  onClick={handleHangUp}
                  className="flex items-center gap-1.5 px-5 py-2 rounded text-xs font-mono font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/60 transition-all active:scale-95"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call</span>
                </button>
              </div>
            </div>
          ) : isRinging ? (
            /* ========================================================= */
            /* STATE 2: RINGING STATE (Realistic Incoming Phone Screen)  */
            /* ========================================================= */
            <div className="p-4 bg-gradient-to-b from-[#181114] to-[#0E1116] border border-red-800/60 rounded-lg space-y-4">
              {/* Caller Display */}
              <div className="flex flex-col items-center text-center py-2">
                {/* Pulsing Rings Phone Icon */}
                <div className="relative flex items-center justify-center my-3">
                  <div className="absolute w-20 h-20 rounded-full bg-red-600/20 animate-ping" />
                  <div className="absolute w-16 h-16 rounded-full bg-red-600/40 animate-pulse" />
                  <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center relative shadow-lg shadow-red-600/60">
                    <PhoneCall className="w-6 h-6 text-white animate-bounce" />
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-600 text-white uppercase tracking-widest mt-1">
                  P1 CRITICAL ESCALATION
                </span>
                <h3 className="text-base font-mono font-bold text-white mt-1.5">
                  NightWatch AI • 2:14 AM P1 Alert
                </h3>
                <p className="text-xs font-mono text-red-200 mt-1 max-w-sm">
                  Calling <span className="text-white font-semibold">{engineerName}</span> ({engineerPhone})
                </p>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                  Production Checkout Service Crashed (DatabaseConnectionPoolExhausted)
                </p>
              </div>

              {/* Incident Alert Details Pill */}
              <div className="p-2.5 bg-red-950/40 border border-red-900/60 rounded text-[11px] font-mono text-zinc-300 space-y-1">
                <div className="flex items-center justify-between text-red-400 font-semibold">
                  <span>Blast Radius: 94/100</span>
                  <span>Target Tag: v1.4.2</span>
                </div>
                <p className="text-zinc-400 text-[10px]">
                  Requires verbal authorization to roll back or execute scoped restart.
                </p>
              </div>

              {/* Large Answer & Decline Buttons */}
              <div className="flex items-center justify-center gap-4 pt-1">
                {/* Red Decline Button */}
                <button
                  onClick={handleDecline}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs font-bold border border-zinc-700 transition-all active:scale-95"
                >
                  <PhoneOff className="w-4 h-4 text-red-400" />
                  <span>Decline</span>
                </button>

                {/* Glowing Green Answer Call Button */}
                <button
                  onClick={handleAnswer}
                  disabled={connecting}
                  className="flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/50 hover:shadow-emerald-500/70 transition-all duration-200 active:scale-95 animate-pulse"
                >
                  <PhoneCall className="w-4 h-4 fill-current" />
                  <span>{connecting ? "Connecting RTC..." : "Answer Call"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* STATE 3: STANDBY STATE (On-Call Developer Roster Card)    */
            /* ========================================================= */
            <div className="space-y-3">
              {/* Roster Card */}
              <div className="p-3.5 bg-[#0B0D10] border border-[#22262E] rounded-lg space-y-3">
                {/* Roster Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider">
                      On-Call Developer Dispatch
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Shift Active (00:00 - 08:00 IST)
                  </span>
                </div>

                {/* Engineer Name & Phone Display / Edit */}
                {isEditingRoster ? (
                  <div className="space-y-2 p-2 bg-[#12151A] rounded border border-zinc-700">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 uppercase">Engineer Name & Role</label>
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="w-full bg-[#0B0D10] border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-200 mt-0.5 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 uppercase">On-Call Phone Number</label>
                      <input
                        type="text"
                        value={tempPhone}
                        onChange={(e) => setTempPhone(e.target.value)}
                        className="w-full bg-[#0B0D10] border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-200 mt-0.5 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsEditingRoster(false)}
                        className="px-2 py-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveRoster}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono bg-emerald-600 text-white rounded font-semibold"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#12151A] rounded border border-[#22262E] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-zinc-100">{engineerName}</span>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 mt-0.5 flex items-center gap-2">
                        <span>{engineerPhone}</span>
                        <span>•</span>
                        <span className="text-zinc-500">checkout-service (Primary)</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setTempName(engineerName);
                        setTempPhone(engineerPhone);
                        setIsEditingRoster(true);
                      }}
                      className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
                      title="Edit On-Call Contact Info"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Dispatch & Gateway Badges */}
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1 border-t border-[#1C2028]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Radio className="w-3 h-3" /> Agora RTC Live • SIP Gateway Ready
                  </span>
                  <span className="text-zinc-500">Tier 2 Voice Escalation</span>
                </div>
              </div>

              {/* Prominent Crimson Call Button */}
              <button
                onClick={onTriggerCall}
                className="w-full py-3 px-4 rounded-lg bg-red-950/70 hover:bg-red-900/90 text-red-200 border-2 border-red-700/80 hover:border-red-500 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg shadow-red-950/50 hover:shadow-red-950/80 transition-all duration-200 active:scale-98 group"
              >
                <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PhoneForwarded className="w-3.5 h-3.5 text-white" />
                </div>
                <span>Call On-Call Developer (P1 Escalation)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import {
  Terminal,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  GitBranch,
  Copy,
  Check,
  Activity,
  Layers,
} from "lucide-react";

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
}

interface IncidentFeedProps {
  incident: Incident | null;
}

export const IncidentFeed: React.FC<IncidentFeedProps> = ({ incident }) => {
  const [copied, setCopied] = useState(false);

  const copyLogs = () => {
    if (!incident) return;
    navigator.clipboard.writeText(`${incident.error_logs}\n\n${incident.stack_trace}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#12151A] border border-[#22262E] rounded-lg">
        <Activity className="w-10 h-10 text-zinc-600 mb-3 animate-pulse" />
        <h3 className="text-sm font-mono text-zinc-400 uppercase tracking-wider">Telemetry Standing By</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          No active pipeline failure detected. Trigger a simulation or send a GitHub Actions webhook to start autonomous triage.
        </p>
      </div>
    );
  }

  const isTier2 = incident.tier === "TIER_2_VOICE";
  const blastColor = incident.blast_radius_score > 70 ? "bg-red-500" : incident.blast_radius_score > 30 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Incident Header & Meta */}
      <div className="p-4 bg-[#12151A] border border-[#22262E] rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Risk Tier Badge */}
              {isTier2 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-950/60 text-red-400 border border-red-700/60">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  TIER 2: VOICE ESCALATION REQUIRED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-700/60">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  TIER 1: AUTO-HEALED
                </span>
              )}

              {/* Status Pill */}
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#181C24] text-zinc-400 border border-[#2A303C]">
                {incident.status.replace(/_/g, " ")}
              </span>

              {/* Target Version if rollback */}
              {incident.target_version && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Restore Target: <span className="text-emerald-400 font-semibold">{incident.target_version}</span>
                </span>
              )}
            </div>

            <h2 className="text-base font-semibold text-zinc-100 font-mono tracking-tight">{incident.title}</h2>
          </div>

          {/* Blast Radius Gauge */}
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Blast Radius</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                <div
                  className={`h-full ${blastColor} transition-all duration-500`}
                  style={{ width: `${incident.blast_radius_score}%` }}
                />
              </div>
              <span className={`text-xs font-mono font-bold ${incident.blast_radius_score > 70 ? "text-red-400" : "text-emerald-400"}`}>
                {incident.blast_radius_score}/100
              </span>
            </div>
          </div>
        </div>

        {/* Repository & Commit details */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#22262E] text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-200">{incident.service}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
            <span>{incident.repository}@{incident.branch}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitCommit className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-300 font-mono bg-zinc-800/80 px-1 rounded">{incident.commit_sha}</span>
          </div>
        </div>
      </div>

      {/* AI Triage Reasoning Card */}
      <div className={`p-4 rounded-lg border ${isTier2 ? "bg-red-950/20 border-red-900/40" : "bg-emerald-950/20 border-emerald-900/40"}`}>
        <div className="flex items-center gap-2 mb-2">
          {isTier2 ? (
            <ShieldAlert className="w-4 h-4 text-red-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
            AI Triage Engine Assessment
          </span>
        </div>
        <p className="text-xs text-zinc-200 font-mono leading-relaxed">{incident.triage_summary}</p>
        <div className="mt-2 text-[11px] text-zinc-400 font-mono leading-relaxed bg-[#0B0D10]/60 p-2.5 rounded border border-[#22262E]">
          <span className="text-zinc-300 font-semibold">Architectural Risk: </span>
          {incident.triage_reason}
        </div>
      </div>

      {/* Terminal Stack Trace Box */}
      <div className="flex-1 flex flex-col bg-[#0B0D10] border border-[#22262E] rounded-lg overflow-hidden shadow-inner">
        {/* Terminal Chrome Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#12151A] border-b border-[#22262E]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600/70" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 ml-2">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              <span>pipeline.stderr.log</span>
            </div>
          </div>
          <button
            onClick={copyLogs}
            className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copied" : "Copy Log"}</span>
          </button>
        </div>

        {/* Monospace Log Viewer */}
        <div className="p-3 font-mono text-[11px] text-zinc-300 overflow-y-auto leading-relaxed space-y-2 select-text max-h-[340px]">
          <div className="text-zinc-500">--- [STDERR STREAM BEGIN] ---</div>
          <pre className="whitespace-pre-wrap text-red-300/90 font-mono">
            {incident.error_logs}
          </pre>
          <div className="text-zinc-600 my-1">--- [CALL STACK DISCOVERY] ---</div>
          <pre className="whitespace-pre-wrap text-zinc-400 font-mono">
            {incident.stack_trace}
          </pre>
        </div>
      </div>
    </div>
  );
};

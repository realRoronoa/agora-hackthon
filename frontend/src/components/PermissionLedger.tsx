import React from "react";
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle,
  ExternalLink,
  Clock,
  Terminal,
} from "lucide-react";

export interface AuditLog {
  id: string;
  incident_id: string;
  timestamp: string;
  event_type: string;
  actor: string;
  requested_scope?: string;
  granted_scope?: string;
  tool_called?: string;
  result: string;
  details?: Record<string, any>;
}

interface PermissionLedgerProps {
  logs: AuditLog[];
}

export const PermissionLedger: React.FC<PermissionLedgerProps> = ({ logs }) => {
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const renderScopeBadge = (scope?: string) => {
    if (!scope) return <span className="text-zinc-500">—</span>;
    switch (scope.toUpperCase()) {
      case "FULL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-700/60">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            FULL
          </span>
        );
      case "LIMITED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 text-amber-400 border border-amber-700/60">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            LIMITED
          </span>
        );
      case "NONE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <ShieldX className="w-3 h-3 text-zinc-400" />
            DENIED
          </span>
        );
      default:
        return <span className="text-zinc-400 text-xs font-mono">{scope}</span>;
    }
  };

  return (
    <div className="flex flex-col bg-[#12151A] border border-[#22262E] rounded-lg overflow-hidden flex-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#151921] border-b border-[#22262E]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">
            Permission & Action Audit Ledger
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
          {logs.length} Recorded Events
        </span>
      </div>

      {/* Ledger Stream */}
      <div className="p-3 overflow-y-auto space-y-2.5 max-h-[380px] font-mono text-xs">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 font-mono text-xs">
            No audit ledger entries recorded yet.
          </div>
        ) : (
          logs.map((log) => {
            const isToolExecution = log.event_type === "VOICE_TOOL_EXECUTION";
            const isAutoHeal = log.event_type === "TIER_1_AUTO_HEALED";

            return (
              <div
                key={log.id}
                className={`p-3 rounded-lg border transition-all ${
                  isToolExecution
                    ? "bg-[#181C24] border-emerald-900/40"
                    : isAutoHeal
                    ? "bg-[#141A18] border-emerald-950/80"
                    : "bg-[#0E1116] border-[#22262E]"
                }`}
              >
                {/* Meta row */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span className="text-zinc-400">{formatTime(log.timestamp)}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-300 font-semibold">{log.actor}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    {log.event_type}
                  </span>
                </div>

                {/* Scope comparison if tool executed */}
                {log.tool_called && (
                  <div className="flex items-center gap-3 my-2 p-2 bg-[#0B0D10] border border-[#22262E] rounded text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 text-[10px] uppercase">Requested:</span>
                      {renderScopeBadge(log.requested_scope)}
                    </div>
                    <span className="text-zinc-600 font-bold">→</span>
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500 text-[10px] uppercase">Granted:</span>
                      {renderScopeBadge(log.granted_scope)}
                    </div>
                    <span className="text-zinc-600">•</span>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-300">
                      <Terminal className="w-3 h-3 text-zinc-400" />
                      <span>{log.tool_called}()</span>
                    </div>
                  </div>
                )}

                {/* Execution Result */}
                <div className="text-[11px] text-zinc-300 flex items-start gap-1.5 mt-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{log.result}</span>
                </div>

                {/* Details snippet */}
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-1.5 text-[10px] text-zinc-400 bg-black/40 p-1.5 rounded border border-zinc-800/60 overflow-x-auto">
                    {log.details.issue_url && (
                      <a
                        href={log.details.issue_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:underline flex items-center gap-1 mb-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Hotfix Ticket {log.details.issue_number || ""}</span>
                      </a>
                    )}
                    {log.details.target_version && (
                      <span className="text-emerald-400 mr-2">Target: {log.details.target_version}</span>
                    )}
                    {log.details.commit_hash && (
                      <span className="text-zinc-400 mr-2">Commit: {log.details.commit_hash}</span>
                    )}
                    {log.details.approved_by_voice && (
                      <span className="text-zinc-300 italic block mt-0.5">
                        Voice Quote: "{log.details.approved_by_voice}"
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

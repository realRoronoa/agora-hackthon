import React, { useState } from "react";
import { Zap, PhoneCall, Loader2 } from "lucide-react";

interface DemoControlsProps {
  onSimulate: (scenario: "minor" | "critical") => Promise<void>;
  disabled?: boolean;
}

export const DemoControls: React.FC<DemoControlsProps> = ({ onSimulate, disabled }) => {
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);

  const handleTrigger = async (scenario: "minor" | "critical") => {
    try {
      setLoadingScenario(scenario);
      await onSimulate(scenario);
    } finally {
      setLoadingScenario(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Tier 1 Auto-Heal Button */}
      <button
        onClick={() => handleTrigger("minor")}
        disabled={disabled || loadingScenario !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-md bg-[#13221C] hover:bg-[#1A3327] text-emerald-300 border border-emerald-700/60 hover:border-emerald-400 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
        title="Simulate Flaky CI Test - Autonomous Silent Self-Healing"
      >
        {loadingScenario === "minor" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        ) : (
          <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30" />
        )}
        <span>Simulate Tier 1: Auto-Heal</span>
      </button>

      {/* Tier 2 Critical Call Button */}
      <button
        onClick={() => handleTrigger("critical")}
        disabled={disabled || loadingScenario !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-md bg-red-950/70 hover:bg-red-900/80 text-red-200 border border-red-600 hover:border-red-400 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-red-950/80 shrink-0 animate-pulse"
        title="Trigger Critical Production Crash - Real-Time Agora Voice Call to On-Call Phone"
      >
        {loadingScenario === "critical" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
        ) : (
          <PhoneCall className="w-3.5 h-3.5 text-red-400 fill-red-400/20" />
        )}
        <span>Trigger Tier 2 & Call Developer</span>
      </button>
    </div>
  );
};

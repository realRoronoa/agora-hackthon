import React, { useState } from "react";
import { Zap, AlertTriangle, Loader2 } from "lucide-react";

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
      {/* Tier 1 Flaky Build Button */}
      <button
        onClick={() => handleTrigger("minor")}
        disabled={disabled || loadingScenario !== null}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-md bg-[#181C24] hover:bg-[#22262E] text-emerald-400 border border-emerald-900/50 hover:border-emerald-500/50 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        title="Simulate Flaky CI Test - Autonomous Self-Healing"
      >
        {loadingScenario === "minor" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
        ) : (
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
        )}
        <span>Simulate Tier 1 (Flaky Build)</span>
      </button>

      {/* Tier 2 Critical Crash Button */}
      <button
        onClick={() => handleTrigger("critical")}
        disabled={disabled || loadingScenario !== null}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-md bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-800/60 hover:border-red-500 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-red-950/50"
        title="Simulate Production Checkout Crash - Rings Phone via Agora Voice"
      >
        {loadingScenario === "critical" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
        )}
        <span>Simulate Tier 2 (Prod Checkout Crash)</span>
      </button>
    </div>
  );
};

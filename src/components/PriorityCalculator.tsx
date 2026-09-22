import React, { useState } from 'react';
import { Calculator } from 'lucide-react';

export const PriorityCalculator: React.FC = () => {
  const [severity, setSeverity] = useState<number>(7);
  const [hazardCategory, setHazardCategory] = useState<'pothole' | 'electric' | 'flooding' | 'water_leak' | 'garbage'>('electric');
  const [corroborations, setCorroborations] = useState<number>(6);
  const [daysOpen, setDaysOpen] = useState<number>(5);
  const [vulnerabilityIndex, setVulnerabilityIndex] = useState<number>(1.25);

  const hazardWeights: Record<string, { weight: number; label: string }> = {
    pothole: { weight: 1.3, label: 'Road/Traffic Hazard (1.3x)' },
    electric: { weight: 1.8, label: 'Immediate Electrocution Risk (1.8x)' },
    flooding: { weight: 1.6, label: 'Drainage / Structural Flooding (1.6x)' },
    water_leak: { weight: 1.2, label: 'Resource Loss / Erosion (1.2x)' },
    garbage: { weight: 1.0, label: 'Sanitation / Odor (1.0x)' },
  };

  const selectedHazard = hazardWeights[hazardCategory];
  const timeDecayFactor = 0.12; // 12% urgency acceleration per day open

  // Formula:
  // Base = severity * hazardWeight
  // Popularity/Corroboration = (1 + Math.log(1 + corroborations))
  // Time = (1 + daysOpen * timeDecayFactor)
  // Equity/Vulnerability = vulnerabilityIndex
  const baseScore = severity * selectedHazard.weight;
  const crowdMultiplier = 1 + Math.log(1 + corroborations);
  const timeMultiplier = 1 + daysOpen * timeDecayFactor;
  const rawScore = baseScore * crowdMultiplier * timeMultiplier * vulnerabilityIndex;
  const finalScore = Math.min(100, Math.round(rawScore * 10) / 10);

  const getTier = (score: number) => {
    if (score >= 70) return { label: 'CRITICAL PRIORITY', color: 'bg-red-500/10 text-red-700 border-red-200' };
    if (score >= 40) return { label: 'ELEVATED PRIORITY', color: 'bg-amber-500/10 text-amber-700 border-amber-200' };
    return { label: 'STANDARD PRIORITY', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' };
  };

  const tier = getTier(finalScore);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-stone-100 rounded-lg text-stone-800">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 text-lg">Priority Calculator</h3>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${tier.color}`}>
          {tier.label}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Sliders and Controls */}
        <div className="lg:col-span-7 space-y-5">
          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 mb-1.5">
              <span>Physical Severity Score</span>
              <span className="font-mono text-stone-900 font-semibold">{severity} / 10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />
            <div className="flex justify-between text-[11px] text-stone-400 mt-1">
              <span>Minor nuisance</span>
              <span>Severe danger</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Hazard Category
            </label>
            <select
              value={hazardCategory}
              onChange={(e) => setHazardCategory(e.target.value as any)}
              className="w-full text-xs bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
            >
              {Object.entries(hazardWeights).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 mb-1.5">
              <span>Corroborating Reports</span>
              <span className="font-mono text-stone-900 font-semibold">{corroborations} confirmations</span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              value={corroborations}
              onChange={(e) => setCorroborations(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 mb-1.5">
              <span>Days Open</span>
              <span className="font-mono text-stone-900 font-semibold">{daysOpen} days open</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={daysOpen}
              onChange={(e) => setDaysOpen(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 mb-1.5">
              <span>Ward Vulnerability Factor</span>
              <span className="font-mono text-stone-900 font-semibold">{vulnerabilityIndex.toFixed(2)}x factor</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.6"
              step="0.05"
              value={vulnerabilityIndex}
              onChange={(e) => setVulnerabilityIndex(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />
          </div>
        </div>

        {/* Calculation Inspection Panel */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-stone-50 border border-stone-200 rounded-xl p-5">
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
              Calculated Priority Score
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-5xl font-mono font-bold text-stone-900">{finalScore}</span>
              <span className="text-stone-400 text-sm font-mono">/ 100</span>
            </div>

            <div className="space-y-2 text-xs border-t border-stone-200 pt-3 text-stone-600">
              <div className="flex justify-between">
                <span>Base Hazard Score:</span>
                <span className="font-mono font-medium text-stone-900">
                  {severity} × {selectedHazard.weight} = {baseScore.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Corroboration Multiplier:</span>
                <span className="font-mono font-medium text-stone-900">× {crowdMultiplier.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Aging Acceleration:</span>
                <span className="font-mono font-medium text-stone-900">× {timeMultiplier.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ward Factor:</span>
                <span className="font-mono font-medium text-stone-900">× {vulnerabilityIndex.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

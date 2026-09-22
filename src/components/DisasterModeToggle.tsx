import React, { useState } from 'react';
import { Siren, Building2 } from 'lucide-react';

export const DisasterModeToggle: React.FC = () => {
  const [mode, setMode] = useState<'civic' | 'disaster'>('civic');

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-200">
        <div>
          <h3 className="font-semibold text-stone-900 text-lg">Civic &amp; Disaster Emergency Modes</h3>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 self-start sm:self-auto">
          <button
            onClick={() => setMode('civic')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'civic'
                ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Peacetime Civic Mode</span>
          </button>
          <button
            onClick={() => setMode('disaster')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'disaster'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-stone-500 hover:text-red-700'
            }`}
          >
            <Siren className="w-3.5 h-3.5" />
            <span>DisasterHelp Emergency Mode</span>
          </button>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Left: Peacetime Civic Mode */}
        <div className={`p-5 rounded-xl border transition-all ${
          mode === 'civic'
            ? 'border-stone-900 bg-stone-50/70 ring-1 ring-stone-900/10'
            : 'border-stone-200 bg-white opacity-60'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-stone-200 rounded-md text-stone-800">
              <Building2 className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-stone-900 text-sm">Peacetime Civic Intelligence Mode</h4>
          </div>
          <p className="text-xs text-stone-600 mb-4 leading-relaxed">
            Optimized for chronic infrastructure maintenance, municipal accountability, and ward committee resource tracking over weeks/months.
          </p>

          <div className="space-y-2.5 text-xs text-stone-700">
            <div className="flex justify-between pb-1.5 border-b border-stone-200/60">
              <span className="text-stone-500">Target Categories:</span>
              <span className="font-medium">Potholes, Streetlights, Drains, Waste</span>
            </div>
            <div className="flex justify-between pb-1.5 border-b border-stone-200/60">
              <span className="text-stone-500">Triage Latency SLA:</span>
              <span className="font-medium">24 – 72 hours</span>
            </div>
            <div className="flex justify-between pb-1.5 border-b border-stone-200/60">
              <span className="text-stone-500">Record Expiration (TTL):</span>
              <span className="font-medium">None (Permanent audit archive)</span>
            </div>
            <div className="flex justify-between pb-1.5 border-b border-stone-200/60">
              <span className="text-stone-500">Verification Cadence:</span>
              <span className="font-medium">Community Steward consensus</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Network Bandwidth Profile:</span>
              <span className="font-medium">Full high-res photo payloads</span>
            </div>
          </div>
        </div>

        {/* Right: DisasterHelp Emergency Mode */}
        <div className={`p-5 rounded-xl border transition-all ${
          mode === 'disaster'
            ? 'border-red-600 bg-red-50/50 ring-2 ring-red-500/20'
            : 'border-stone-200 bg-white opacity-60'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-red-100 text-red-700 rounded-md">
              <Siren className="w-4 h-4" />
            </div>
            <h4 className="font-semibold text-stone-900 text-sm">DisasterHelp Crisis Coordination Mode</h4>
          </div>
          <p className="text-xs text-stone-600 mb-4 leading-relaxed">
            Activated during severe urban floods, cyclones, or seismic events. Shifts from passive tickets to life-safety hazard and relief dispatch.
          </p>

          <div className="space-y-2.5 text-xs text-stone-700">
            <div className="flex justify-between pb-1.5 border-b border-stone-200/60">
              <span className="text-stone-500">Target Categories:</span>
              <span className="font-medium text-red-700">Submerged Bridges, Relief Shelters, Clean Water</span>
            </div>
            <div className="flex justify-between pb-1.5 border-b border-stone-200/60">
              <span className="text-stone-500">Triage Latency SLA:</span>
              <span className="font-medium text-red-700">Real-time / &lt; 15 minutes</span>
            </div>
            <div className="flex justify-between pb-1.5 border-b border-stone-200/60">
              <span className="text-stone-500">Record Expiration (TTL):</span>
              <span className="font-medium">Enforced 4-to-12 hour auto-expiry</span>
            </div>
            <div className="flex justify-between pb-1.5 border-b border-stone-200/60">
              <span className="text-stone-500">Provenance / Trust Tiers:</span>
              <span className="font-medium">Tier 1: Gov/NDMA, Tier 2: Red Cross/NGO, Tier 3: Crowd</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Network Bandwidth Profile:</span>
              <span className="font-medium">2G-degraded / IndexedDB offline sync</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

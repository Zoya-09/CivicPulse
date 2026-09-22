import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, RotateCcw, AlertOctagon, FileCheck, Wrench, ShieldX, Clock } from 'lucide-react';

export const StateLifecycleViewer: React.FC = () => {
  const [selectedState, setSelectedState] = useState<string>('Verified');

  const lifecycleStages = [
    {
      key: 'Reported',
      title: '1. Reported',
      role: 'Citizen / Reporter',
      desc: 'Raw submission ingested. EXIF stripped, GPS coordinates buffered. Duplicate proximity search completed in background.',
      badge: 'bg-stone-100 text-stone-700 border-stone-300'
    },
    {
      key: 'Under Review',
      title: '2. Under Review',
      role: 'Ward Steward / Auto-filter',
      desc: 'Automated pHash / spam heuristics pass. Placed in local steward triage queue. Neighbor notifications triggered.',
      badge: 'bg-sky-50 text-sky-700 border-sky-300'
    },
    {
      key: 'Verified',
      title: '3. Verified',
      role: 'Community Steward / NGO',
      desc: 'Ground truth confirmed. Priority Score computed deterministically. Added to public ward accountability ledger.',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-300'
    },
    {
      key: 'Assigned',
      title: '4. Assigned',
      role: 'Municipal Desk / RWA Team',
      desc: 'Dispatched to responsible agency or contractor. Public SLA countdown initiated based on priority tier.',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-300'
    },
    {
      key: 'In Progress',
      title: '5. In Progress',
      role: 'Field Crew / Contractor',
      desc: 'Work order executed on ground. Contractor uploads geotagged repair timestamped evidence.',
      badge: 'bg-amber-50 text-amber-700 border-amber-300'
    },
    {
      key: 'Resolved',
      title: '6. Resolved',
      role: 'Citizen Confirmation Quorum',
      desc: 'Marked fixed. 90-day recurrence surveillance watchdog activated. Original reporters notified to confirm.',
      badge: 'bg-green-50 text-green-700 border-green-300'
    },
  ];

  const edgeCases = [
    {
      name: 'Corroboration Linkage',
      desc: 'Duplicate reports are converted into supporting evidence for an existing incident instead of being discarded.',
      icon: FileCheck
    },
    {
      name: 'Transparent Rejection',
      desc: 'Never silently deleted. Must include a categorized justification (e.g., Private Property, Out of Jurisdiction).',
      icon: ShieldX
    },
    {
      name: '90-Day Recurrence Trigger',
      desc: 'If an issue re-appears within 15m inside 90 days, it automatically re-opens and flags contractor failure.',
      icon: RotateCcw
    }
  ];

  const currentStage = lifecycleStages.find(s => s.key === selectedState) || lifecycleStages[2];

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
        <div>
          <h3 className="font-semibold text-stone-900 text-lg">Ticket Lifecycle &amp; Workflow</h3>
        </div>
      </div>

      {/* Lifecycle Flow Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 my-6">
        {lifecycleStages.map((stage) => {
          const isActive = stage.key === selectedState;
          return (
            <button
              key={stage.key}
              onClick={() => setSelectedState(stage.key)}
              className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                  : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
              }`}
            >
              <div className="text-xs font-semibold">{stage.title}</div>
              <div className={`text-[10px] mt-2 font-medium ${isActive ? 'text-stone-300' : 'text-stone-500'}`}>
                {stage.role}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detailed Inspection */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-stone-500 uppercase tracking-wider">
            Active State Specification
          </span>
          <span className={`text-xs px-2.5 py-0.5 rounded font-semibold border ${currentStage.badge}`}>
            {currentStage.key}
          </span>
        </div>
        <h4 className="text-base font-semibold text-stone-900 mb-1">{currentStage.title}</h4>
        <p className="text-xs text-stone-600 leading-relaxed">{currentStage.desc}</p>
      </div>

      {/* Critical Edge Cases */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {edgeCases.map((edge) => {
          const Icon = edge.icon;
          return (
            <div key={edge.name} className="p-3.5 border border-stone-200 rounded-lg bg-white">
              <div className="flex items-center gap-2 mb-1.5 text-stone-900 font-semibold text-xs">
                <Icon className="w-4 h-4 text-stone-700" />
                <span>{edge.name}</span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                {edge.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

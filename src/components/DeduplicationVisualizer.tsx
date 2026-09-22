import React, { useState } from 'react';
import { Layers, GitMerge, MapPin, CheckCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

export const DeduplicationVisualizer: React.FC = () => {
  const [distanceMeters, setDistanceMeters] = useState<number>(18);
  const [timeDiffDays, setTimeDiffDays] = useState<number>(2);
  const [categoryMatch, setCategoryMatch] = useState<boolean>(true);
  const [pHashMatch, setPHashMatch] = useState<boolean>(false);

  // Thresholds
  const SPATIAL_THRESHOLD_METERS = 30;
  const TEMPORAL_THRESHOLD_DAYS = 7;

  const isSpatialMatch = distanceMeters <= SPATIAL_THRESHOLD_METERS;
  const isTemporalMatch = timeDiffDays <= TEMPORAL_THRESHOLD_DAYS;
  const isDuplicateCluster = isSpatialMatch && isTemporalMatch && categoryMatch;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-stone-100 rounded-lg text-stone-800">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 text-lg">Deduplication &amp; Corroboration Engine</h3>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
          isDuplicateCluster 
            ? 'bg-amber-500/10 text-amber-700 border-amber-200' 
            : 'bg-stone-100 text-stone-700 border-stone-300'
        }`}>
          {isDuplicateCluster ? 'CLUSTER CORROBORATION DETECTED' : 'INDEPENDENT NEW INCIDENT'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Controls */}
        <div className="lg:col-span-6 space-y-5">
          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 mb-1.5">
              <span>Spatial Distance to Nearest Active Incident</span>
              <span className="font-mono text-stone-900 font-semibold">{distanceMeters} meters</span>
            </div>
            <input
              type="range"
              min="2"
              max="80"
              value={distanceMeters}
              onChange={(e) => setDistanceMeters(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />
            <div className="flex justify-between text-[11px] text-stone-400 mt-1">
              <span>0m (Exact spot)</span>
              <span className="text-stone-700 font-medium">Threshold: 30m</span>
              <span>80m (Different block)</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-stone-700 mb-1.5">
              <span>Time Difference from Active Incident</span>
              <span className="font-mono text-stone-900 font-semibold">{timeDiffDays} days</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={timeDiffDays}
              onChange={(e) => setTimeDiffDays(Number(e.target.value))}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />
            <div className="flex justify-between text-[11px] text-stone-400 mt-1">
              <span>Same day</span>
              <span className="text-stone-700 font-medium">Threshold: 7 days</span>
              <span>20 days later</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => setCategoryMatch(!categoryMatch)}
              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                categoryMatch 
                  ? 'bg-stone-900 text-white border-stone-900' 
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <span>Category Match</span>
              <span>{categoryMatch ? 'MATCH' : 'DIFFERENT'}</span>
            </button>

            <button
              onClick={() => setPHashMatch(!pHashMatch)}
              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                pHashMatch 
                  ? 'bg-stone-900 text-white border-stone-900' 
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <span>Photo Similarity</span>
              <span>{pHashMatch ? 'EXACT PHOTO' : 'NEW PHOTO'}</span>
            </button>
          </div>
        </div>

        {/* Visualizer Flow Diagram */}
        <div className="lg:col-span-6 bg-stone-50 border border-stone-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
              Clustering Criteria Evaluation
            </div>

            <div className="space-y-3">
              <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                isSpatialMatch ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-stone-100 border-stone-200 text-stone-600'
              }`}>
                <span>Distance Check (≤30m)</span>
                <span className="font-semibold">{isSpatialMatch ? 'PASSED (≤30m)' : 'FAILED (>30m)'}</span>
              </div>

              <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                isTemporalMatch ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-stone-100 border-stone-200 text-stone-600'
              }`}>
                <span>Time Window (≤7 days)</span>
                <span className="font-semibold">{isTemporalMatch ? 'PASSED (≤7d)' : 'EXPIRED (>7d)'}</span>
              </div>

              <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                categoryMatch ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-stone-100 border-stone-200 text-stone-600'
              }`}>
                <span>Category Match</span>
                <span className="font-semibold">{categoryMatch ? 'IDENTICAL CATEGORY' : 'DISPARATE CATEGORY'}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-stone-200">
            {isDuplicateCluster ? (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Action: Corroborate Existing Incident</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Linked to active incident cluster. Increments corroboration count, refreshes status, and increases triage urgency.
                </p>
              </div>
            ) : (
              <div className="bg-stone-100 border border-stone-200 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-stone-900 font-semibold text-xs mb-1">
                  <CheckCircle className="w-4 h-4 text-stone-700" />
                  <span>Action: Create New Independent Incident</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Criteria not matched. Indexed as a distinct new incident report.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  X,
  MapPin,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
  ShieldCheck,
  Droplets,
  Zap,
  Trash2,
  ChevronRight,
  Flame
} from 'lucide-react';
import { IssueReportSample } from '../types/civic';
import { INDIAN_CITIES } from '../data/indianLocationsData';
import { CameraCapturePlaceholder, CapturedImageInfo } from './CameraCapturePlaceholder';
import { simulateSaveIncidentPhoto } from '../utils/civicMediaStorage';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newReport: IssueReportSample) => void;
  existingIncidents: IssueReportSample[];
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingIncidents = [],
}) => {
  const [step, setStep] = useState<number>(1);
  const [category, setCategory] = useState<IssueReportSample['category']>('pothole');
  const [selectedCityKey, setSelectedCityKey] = useState<string>('delhi');
  
  // City configuration
  const activeCity = useMemo(() => {
    return INDIAN_CITIES[selectedCityKey] || INDIAN_CITIES.delhi;
  }, [selectedCityKey]);

  // Landmarks for active city
  const cityLandmarks = useMemo(() => {
    return activeCity.landmarks && activeCity.landmarks.length > 0 ? activeCity.landmarks : [
      { name: 'Municipal Core Crossing', lat: (activeCity.bounds?.minLat ?? 28.61) + 0.01, lng: (activeCity.bounds?.minLng ?? 77.20) + 0.01, ward: 'Ward 1' }
    ];
  }, [activeCity]);

  const [selectedLocation, setSelectedLocation] = useState(cityLandmarks[0] || { name: 'City Center', lat: 28.6139, lng: 77.209, ward: 'Ward 1' });
  const [customAddress, setCustomAddress] = useState<string>('Near Metro Station Pillar 42, Outer Ring');
  const [title, setTitle] = useState<string>('Deep road surface crater near lane merging zone');
  const [description, setDescription] = useState<string>(
    'Vehicles and two-wheelers swerving dangerously during peak rush hour traffic to avoid asphalt cavity.'
  );
  const [severityScore, setSeverityScore] = useState<number>(8);
  const [reporterName, setReporterName] = useState<string>('R. Sharma (Citizen Reporter)');
  const [capturedImageInfo, setCapturedImageInfo] = useState<CapturedImageInfo | null>({
    dataUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
    source: 'verified_catalog',
    timestamp: new Date().toLocaleTimeString(),
    resolution: '1280x720 (Catalog)',
  });

  // When city changes, update selected location
  const handleCityChange = (newCityKey: string) => {
    setSelectedCityKey(newCityKey);
    const newCityConfig = INDIAN_CITIES[newCityKey] || INDIAN_CITIES.delhi;
    if (newCityConfig.landmarks && newCityConfig.landmarks.length > 0) {
      setSelectedLocation(newCityConfig.landmarks[0]);
    }
  };

  // Proximity check for deduplication & corroboration
  const nearbyMatches = useMemo(() => {
    if (!existingIncidents || !selectedLocation) return [];
    return (existingIncidents || [])
      .map((inc) => ({
        ...inc,
        distanceMeters: haversineMeters(
          selectedLocation.lat,
          selectedLocation.lng,
          inc.latitude,
          inc.longitude
        ),
      }))
      .filter((inc) => inc.distanceMeters <= 85)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [existingIncidents, selectedLocation]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isCorroboration = nearbyMatches.length > 0;
    const parentAnchor = isCorroboration ? nearbyMatches[0] : null;
    const reportId = `REP-${Math.floor(120 + Math.random() * 880)}`;

    let imagePreview: string | undefined = undefined;
    let imageStorageMetadata: IssueReportSample['imageStorageMetadata'] = undefined;

    if (capturedImageInfo) {
      const mediaRecord = simulateSaveIncidentPhoto(reportId, capturedImageInfo.dataUrl, {
        deviceSource: capturedImageInfo.source,
        resolution: capturedImageInfo.resolution,
      });
      imagePreview = capturedImageInfo.dataUrl;
      imageStorageMetadata = {
        storageBucket: mediaRecord.storageBucket,
        objectKey: mediaRecord.objectKey,
        fileSizeBytes: mediaRecord.fileSizeBytes,
        capturedAt: mediaRecord.capturedAt,
        deviceSource: mediaRecord.deviceSource,
        resolution: mediaRecord.resolution,
      };
    }

    const newReport: IssueReportSample = {
      id: reportId,
      title: title.trim() || 'Civic infrastructure report',
      category,
      city: activeCity.name.split('(')[0].trim(),
      state: activeCity.state,
      latitude: selectedLocation.lat + (Math.random() - 0.5) * 0.0003,
      longitude: selectedLocation.lng + (Math.random() - 0.5) * 0.0003,
      reportedAt: new Date().toISOString(),
      status: isCorroboration ? 'Corroborated' : 'Reported',
      upvotes: 1,
      parentClusterId: parentAnchor ? parentAnchor.id : undefined,
      severityScore,
      hazardWeight:
        category === 'streetlight'
          ? 1.8
          : category === 'drainage'
          ? 1.6
          : category === 'pothole'
          ? 1.4
          : category === 'water_leak'
          ? 1.2
          : 1.0,
      vulnerabilityFactor: 1.3,
      daysOpen: 0,
      address: customAddress?.trim()
        ? `${selectedLocation?.name || 'Locality'} (${customAddress.trim()})`
        : selectedLocation?.name || 'Municipal Locality',
      ward: selectedLocation?.ward || 'Municipal Ward',
      description,
      clusterLabel: parentAnchor?.clusterLabel || `${selectedLocation.name} Hotspot`,
      reportedBy: reporterName.trim() || 'Civic Volunteer',
      imagePreview,
      imageStorageMetadata,
    };

    onSubmit(newReport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-stone-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-stone-900 text-white rounded-xl shadow-xs">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base sm:text-lg">Report a Civic Hazard</h3>
              <p className="text-xs text-stone-500">
                Direct municipal ledger dispatch with automated spatial corroboration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* Step 1: Category Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
              1. Select Hazard Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'pothole', label: 'Pothole / Road Defect', icon: '🕳️', weight: '1.4x Hazard' },
                { id: 'drainage', label: 'Flooding / Drain Block', icon: '🌊', weight: '1.6x Hazard' },
                { id: 'streetlight', label: 'Streetlight / Live Wire', icon: '⚡', weight: '1.8x Hazard' },
                { id: 'water_leak', label: 'Water Pipeline Leak', icon: '💧', weight: '1.2x Hazard' },
                { id: 'garbage', label: 'Waste Overflow', icon: '🗑️', weight: '1.0x Hazard' },
              ].map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id as IssueReportSample['category'])}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    category === cat.id
                      ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                      : 'border-stone-200 bg-white hover:border-stone-300 text-stone-800'
                  }`}
                >
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className="text-xs font-bold leading-snug">{cat.label}</div>
                  <div className={`text-[10px] mt-0.5 ${category === cat.id ? 'text-stone-300' : 'text-stone-500'}`}>
                    {cat.weight}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Location Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                2. Indian City &amp; Ward Location
              </label>
              <span className="text-[11px] font-mono text-stone-500">
                {activeCity.name}
              </span>
            </div>

            {/* City Dropdown */}
            <div className="mb-2.5">
              <select
                id="modal-select-city"
                value={selectedCityKey}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full text-xs bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 font-medium text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-500"
              >
                <option value="delhi">Delhi NCR (NDMC / MCD)</option>
                <option value="mumbai">Mumbai (BMC / MCGM, Maharashtra)</option>
                <option value="bengaluru">Bengaluru (BBMP, Karnataka)</option>
                <option value="chennai">Chennai (GCC, Tamil Nadu)</option>
                <option value="hyderabad">Hyderabad (GHMC, Telangana)</option>
                <option value="kolkata">Kolkata (KMC, West Bengal)</option>
                <option value="ahmedabad">Ahmedabad (AMC, Gujarat)</option>
                <option value="lucknow">Lucknow (LMC, Uttar Pradesh)</option>
                <option value="jaipur">Jaipur (JMC, Rajasthan)</option>
                <option value="kochi">Kochi (KMC, Kerala)</option>
              </select>
            </div>

            {/* Preset City Landmark Hotspots */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              {cityLandmarks.map((loc, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setSelectedLocation(loc)}
                  className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
                    selectedLocation.name === loc.name
                      ? 'border-stone-900 bg-stone-50 text-stone-900 font-semibold ring-1 ring-stone-900'
                      : 'border-stone-200 hover:border-stone-300 text-stone-700'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span>{loc.name}</span>
                    {selectedLocation.name === loc.name && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </div>
                  <div className="text-[10.5px] text-stone-500 mt-0.5">{loc.ward}</div>
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Specific street address, gate, or crossing..."
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* Real-time Corroboration Engine Warning / Notice */}
          {nearbyMatches.length > 0 ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <h5 className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <span>Smart Corroboration Detected</span>
                  <span className="text-[10px] bg-emerald-200/60 font-mono px-1.5 py-0.2 rounded font-semibold text-emerald-800">
                    &Delta; {nearbyMatches[0].distanceMeters}m away
                  </span>
                </h5>
                <p className="mt-0.5 text-emerald-800 leading-relaxed text-[11.5px]">
                  <strong>{nearbyMatches.length} matching incident(s)</strong> already logged near {selectedLocation.name}. Your submission will be attached as <em>corroborating citizen evidence</em> to elevate this cluster’s priority score without creating duplicate work tickets!
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-stone-600 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-stone-400 shrink-0" />
              <span>No duplicate reports in this 70m radius. This will be registered as a new Primary Anchor ticket.</span>
            </div>
          )}

          {/* Step 3: Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Hazard Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Detailed Description &amp; Risk</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>
          </div>

          {/* Step 4: Severity Slider */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between text-xs font-medium text-stone-700 mb-1.5">
              <span className="font-semibold uppercase tracking-wider text-stone-600 text-[11px]">4. Observed Hazard Severity</span>
              <span className="font-bold text-stone-900 font-mono bg-white px-2.5 py-0.5 rounded border border-stone-200 text-xs shadow-2xs">
                {severityScore}/10 &bull; {severityScore >= 8 ? 'High/Emergency' : severityScore >= 5 ? 'Moderate' : 'Low Priority'}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={severityScore}
              onChange={(e) => setSeverityScore(Number(e.target.value))}
              className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>Minor Nuisance (1)</span>
              <span>Routine Maintenance (5)</span>
              <span>Critical Structural Hazard (10)</span>
            </div>
          </div>

          {/* Step 5: Field Photo Evidence (Camera API & Simulated Cloud Storage) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                5. Field Photo Evidence (Camera API)
              </label>
              <span className="text-[10.5px] text-stone-500 font-mono">
                Auto-Geotagged &bull; Simulated Media Bucket
              </span>
            </div>

            <CameraCapturePlaceholder
              onImageCaptured={(info) => setCapturedImageInfo(info)}
              currentImage={capturedImageInfo?.dataUrl}
              locationName={selectedLocation.name}
            />
          </div>

          {/* Reporter attribution */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Your Name / Citizen Handle</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-2"
            >
              <span>Submit Report to Ward Ledger</span>
              <ChevronRight className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

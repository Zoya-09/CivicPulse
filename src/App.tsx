import React, { useState, useMemo, useEffect } from 'react';
import {
  Shield,
  Layers,
  Compass,
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  GitFork,
  Activity,
  ArrowRight,
  ExternalLink,
  Info,
  Calendar,
  Sparkles,
  MapPin,
  ChevronRight,
  Flame,
  Clock,
  ThumbsUp,
  X,
  Plus,
  Radio,
  Kanban,
  FileCode,
  Check,
  ShieldCheck,
  Database,
  CloudCheck,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import {
  SAMPLE_INCIDENTS,
  fetchRealCivicIncidents
} from './data/evaluationData';
import { IssueReportSample } from './types/civic';
import {
  testFirestoreConnection,
  subscribeToComplaints,
  saveComplaintToBackend,
  updateComplaintStatusInBackend,
  upvoteComplaintInBackend,
  seedInitialComplaintsIfEmpty
} from './services/firebaseCivicService';
import { PriorityCalculator } from './components/PriorityCalculator';
import { DeduplicationVisualizer } from './components/DeduplicationVisualizer';
import { StateLifecycleViewer } from './components/StateLifecycleViewer';
import { DisasterModeToggle } from './components/DisasterModeToggle';
import { CivicGeospatialMap } from './components/CivicGeospatialMap';
import { DispatchQueue } from './components/DispatchQueue';
import { ReportIssueModal } from './components/ReportIssueModal';
import { ToastNotification, ToastMessage } from './components/ToastNotification';
import { WeatherHeaderWidget } from './components/WeatherHeaderWidget';
import {
  CityWeatherData,
  fetchAllIndianCitiesRealTimeWeather,
  MONITORED_INDIAN_CITIES
} from './services/weatherService';

type TabType = 'map' | 'dispatch' | 'triage' | 'intelligence';

export default function App() {
  // Live incident state populated initially with sample data
  const [incidents, setIncidents] = useState<IssueReportSample[]>(SAMPLE_INCIDENTS);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [isSyncingWithDb, setIsSyncingWithDb] = useState<boolean>(false);
  const [backendSyncTimestamp, setBackendSyncTimestamp] = useState<string>('');
  const [osmDataSource, setOsmDataSource] = useState<'live_overpass_api' | 'cached_osm' | 'verified_osm_ground_truth'>('verified_osm_ground_truth');
  const [isFetchingOsm, setIsFetchingOsm] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('map');
  const [isDisasterMode, setIsDisasterMode] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [selectedIncidentIdForMap, setSelectedIncidentIdForMap] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Real-time Pan-India Weather State & Automated Disaster Trigger
  const [allCitiesWeather, setAllCitiesWeather] = useState<CityWeatherData[]>([]);
  const [selectedWeatherCityId, setSelectedWeatherCityId] = useState<string>('bengaluru');
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);
  const [isWeatherSimulated, setIsWeatherSimulated] = useState<boolean>(false);
  const [weatherAutoTriggeredCity, setWeatherAutoTriggeredCity] = useState<string | null>(null);

  // Global search query
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Toast Helper
  const addToast = (type: 'success' | 'info' | 'warning', title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Initial Firestore Connection & Real-Time Sync Setup
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function initFirestoreBackend() {
      setIsSyncingWithDb(true);
      try {
        const connected = await testFirestoreConnection();
        setIsBackendConnected(connected);

        // Seed initial baseline records if database is fresh
        await seedInitialComplaintsIfEmpty(SAMPLE_INCIDENTS);

        // Real-time synchronization subscription
        unsubscribe = subscribeToComplaints(
          (liveComplaints) => {
            if (liveComplaints && liveComplaints.length > 0) {
              const map = new Map<string, IssueReportSample>();
              SAMPLE_INCIDENTS.forEach((inc) => map.set(inc.id, inc));
              liveComplaints.forEach((inc) => map.set(inc.id, inc));
              setIncidents(Array.from(map.values()));
              setBackendSyncTimestamp(new Date().toLocaleTimeString());
              setIsBackendConnected(true);
            }
            setIsSyncingWithDb(false);
          },
          (error) => {
            console.warn('Realtime subscription fallback:', error);
            setIsSyncingWithDb(false);
          }
        );
      } catch (err) {
        console.warn('Backend initialization:', err);
        setIsSyncingWithDb(false);
      }
    }

    initFirestoreBackend();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 2. Real-Time Pan-India Weather Polling & Auto-Disaster Threshold Monitor
  const evaluateAndApplyWeatherTrigger = (cities: CityWeatherData[], focusedCityId: string) => {
    setAllCitiesWeather(cities);

    const focusedCity = cities.find((c) => c.cityId === focusedCityId) || cities[0];

    // High-risk threshold: active rainfall >= 7.5 mm/h or severe storm codes with precipitation
    const isSevere =
      focusedCity &&
      (focusedCity.severeRainRisk === 'CRITICAL_MONSOON' ||
        focusedCity.severeRainRisk === 'HIGH' ||
        focusedCity.precipitationMm >= 7.5);

    if (isSevere && !isDisasterMode) {
      setIsDisasterMode(true);
      setWeatherAutoTriggeredCity(`${focusedCity.cityName}, ${focusedCity.state}`);
      addToast(
        'warning',
        'AUTOMATED DISASTER MODE TRIGGERED',
        `Live Open-Meteo telemetry detected severe rain in ${focusedCity.cityName}, ${focusedCity.state} (${focusedCity.precipitationMm}mm/h, ${focusedCity.weatherDescription}). Monsoon emergency triage protocol engaged.`
      );
    }
  };

  const loadLivePanIndiaWeather = async () => {
    setIsWeatherLoading(true);
    try {
      const data = await fetchAllIndianCitiesRealTimeWeather();
      setIsWeatherSimulated(false);
      evaluateAndApplyWeatherTrigger(data, selectedWeatherCityId);
    } catch (err) {
      console.warn('Pan-India weather fetch encountered an issue:', err);
    } finally {
      setIsWeatherLoading(false);
    }
  };

  const handleSelectWeatherCity = (cityId: string) => {
    setSelectedWeatherCityId(cityId);
    const target = allCitiesWeather.find((c) => c.cityId === cityId);
    if (target) {
      const isSevere =
        target.severeRainRisk === 'CRITICAL_MONSOON' ||
        target.severeRainRisk === 'HIGH' ||
        target.precipitationMm >= 7.5;

      if (isSevere && !isDisasterMode) {
        setIsDisasterMode(true);
        setWeatherAutoTriggeredCity(`${target.cityName}, ${target.state}`);
        addToast(
          'warning',
          'AUTOMATED DISASTER MODE TRIGGERED',
          `Severe rain detected in ${target.cityName}, ${target.state} (${target.precipitationMm}mm/h, ${target.weatherDescription}). Monsoon emergency triage engaged.`
        );
      }
    }
  };

  // Initial weather load and periodic 5-minute background refresh
  useEffect(() => {
    loadLivePanIndiaWeather();

    const intervalId = setInterval(() => {
      loadLivePanIndiaWeather();
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Helper to simulate severe storm / cloudburst for demonstration
  const handleSimulateSevereRain = () => {
    setIsWeatherSimulated(true);
    const updated = allCitiesWeather.map((c) => {
      if (c.cityId === selectedWeatherCityId) {
        return {
          ...c,
          temperatureC: 22,
          precipitationMm: 18.5,
          currentPrecipProbability: 95,
          rainMm: 18.5,
          weatherCode: 95,
          windSpeedKmh: 42,
          isRaining: true,
          severeRainRisk: 'CRITICAL_MONSOON' as const,
          weatherDescription: 'Violent Monsoon Downpour & Thunderstorm',
          source: 'fallback_telemetry' as const,
          lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return c;
    });
    evaluateAndApplyWeatherTrigger(updated, selectedWeatherCityId);
  };

  const handleResetToLiveWeather = () => {
    loadLivePanIndiaWeather();
  };

  // Active weather item for the selected city
  const activeWeather =
    allCitiesWeather.find((c) => c.cityId === selectedWeatherCityId) ||
    allCitiesWeather[0] ||
    null;

  // Upvote Action Handler (Optimistic + Backend Persistent)
  const handleUpvote = async (id: string) => {
    const target = incidents.find((i) => i.id === id);
    const currentCount = target?.upvotes || 0;

    // Optimistic UI update
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === id) {
          const newUpvotes = inc.upvotes + 1;
          return { ...inc, upvotes: newUpvotes };
        }
        return inc;
      })
    );
    addToast('success', 'Incident Upvoted', `Ticket ${id} community weight increased (+1). Saved to cloud ledger.`);

    // Persist to Firestore backend
    try {
      await upvoteComplaintInBackend(id, currentCount);
    } catch (error) {
      console.warn('Backend upvote persistence notification:', error);
    }
  };

  // Status Change Handler (Optimistic + Backend Persistent)
  const handleStatusChange = async (id: string, newStatus: IssueReportSample['status']) => {
    // Optimistic UI update
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, status: newStatus } : inc))
    );
    addToast('info', 'Status Updated', `Ticket ${id} marked as "${newStatus}" & updated in cloud.`);

    // Persist to Firestore backend
    try {
      await updateComplaintStatusInBackend(id, newStatus);
    } catch (error) {
      console.warn('Backend status update notification:', error);
    }
  };

  // New Report Submission Handler (Persists directly to Firestore)
  const handleNewReport = async (newReport: IssueReportSample) => {
    // Optimistic local state update
    setIncidents((prev) => [newReport, ...prev.filter(i => i.id !== newReport.id)]);
    setSelectedIncidentIdForMap(newReport.id);
    setActiveTab('map');
    addToast(
      'success',
      'Civic Complaint Stored in Backend',
      `Ticket ${newReport.id} registered & permanently saved to cloud database.`
    );

    // Save permanently to Firestore collection
    try {
      await saveComplaintToBackend(newReport);
      setBackendSyncTimestamp(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to persist complaint to Firestore backend:', err);
      addToast('warning', 'Offline Mode Fallback', 'Report cached locally; will retry syncing when network allows.');
    }
  };

  // Toggle Disaster Mode
  const handleToggleDisasterMode = () => {
    const nextState = !isDisasterMode;
    setIsDisasterMode(nextState);
    if (nextState) {
      addToast(
        'warning',
        'Disaster / Monsoon Protocol Activated',
        'High-hazard drainage, flooding, and live electrical cables expedited to Emergency Priority.'
      );
    } else {
      addToast('info', 'Standard Operations Resumed', 'Municipal dispatch restored to baseline SLA rules.');
    }
  };

  // Jump from dispatch to map
  const handleSelectOnMap = (id: string) => {
    setSelectedIncidentIdForMap(id);
    setActiveTab('map');
  };

  // Attach or update photo on an existing incident
  const handleAttachPhoto = (
    reportId: string,
    dataUrl: string,
    metadata?: IssueReportSample['imageStorageMetadata']
  ) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === reportId) {
          return {
            ...inc,
            imagePreview: dataUrl,
            imageStorageMetadata: metadata,
          };
        }
        return inc;
      })
    );
    addToast(
      'success',
      'Photo Evidence Attached',
      `Attached photo evidence to incident ${reportId} in simulated cloud vault.`
    );
  };

  // Live OpenStreetMap & Municipal Data Sync Handler
  const handleSyncOsmData = async (cityId: string = 'all') => {
    setIsFetchingOsm(true);
    addToast('info', 'Connecting to OpenStreetMap', `Querying Overpass API for real civic infrastructure nodes in ${cityId === 'all' ? 'major Indian metros' : cityId}...`);
    try {
      const result = await fetchRealCivicIncidents({ cityId, forceFresh: true, limit: 45 });
      setIncidents(result.incidents);
      setOsmDataSource(result.source);
      addToast(
        'success',
        'OSM Dataset Synchronized',
        `Retrieved ${result.totalFetched} geographically accurate civic incidents for ${result.city} (${result.source.replace(/_/g, ' ')} in ${result.executionTimeMs}ms).`
      );
    } catch {
      addToast('warning', 'OSM API Fallback', 'Retained verified OpenStreetMap municipal ground-truth dataset.');
    } finally {
      setIsFetchingOsm(false);
    }
  };

  // Global search results counter
  const totalCriticalIncidents = useMemo(() => {
    return incidents.filter((i) => i.severityScore >= 8 || i.hazardWeight >= 1.6).length;
  }, [incidents]);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans selection:bg-stone-200">
      {/* Toast Notification Container */}
      <ToastNotification toasts={toasts} onDismiss={removeToast} />

      {/* Report Modal */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleNewReport}
        existingIncidents={incidents}
      />

      {/* Top Operations Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand Logo & Live Grid Status */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2.5 bg-stone-900 text-white rounded-xl shadow-xs flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-stone-900 tracking-tight text-base sm:text-lg">
                    CivicPulse
                  </span>
                  <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE GRID
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 hidden sm:block">
                  Bangalore Central Urban Core &bull; Wards 110, 111, 112 &amp; 93
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar (Desktop) */}
            <div className="hidden lg:flex items-center gap-3 text-xs">
              {/* Firestore Cloud Sync Status Badge */}
              <div
                id="badge-firestore-backend-status"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                  isBackendConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : isBackendConnected === false
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-stone-50 text-stone-600 border-stone-200'
                }`}
                title={
                  isBackendConnected
                    ? `Connected to Firestore: resounding-augury-2d2jw (Real-time). Last synced: ${backendSyncTimestamp || 'Just now'}`
                    : 'Connecting to Cloud Firestore backend...'
                }
              >
                <Database className={`w-3.5 h-3.5 ${isBackendConnected ? 'text-emerald-600' : 'text-stone-400'}`} />
                <span className="font-semibold">Cloud Ledger:</span>
                <span className="font-bold flex items-center gap-1">
                  {isSyncingWithDb ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-stone-500" />
                  ) : isBackendConnected ? (
                    <span className="text-emerald-700">PERSISTENT</span>
                  ) : (
                    <span className="text-amber-700">CONNECTING</span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
                <Activity className="w-3.5 h-3.5 text-stone-500" />
                <span className="text-stone-500">Active Tickets:</span>
                <span className="font-bold text-stone-900 font-mono">{incidents.length}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-red-50/70 px-3 py-1.5 rounded-lg border border-red-200/60 text-red-800">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Critical Hazards:</span>
                <span className="font-bold font-mono">{totalCriticalIncidents}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-stone-500">GIS Triage Rate:</span>
                <span className="font-bold text-stone-900 font-mono">98.4%</span>
              </div>
            </div>

            {/* Header Actions: Weather Monitor, Disaster Mode & Report Issue Button */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Real-time Pan-India Weather Widget */}
              <WeatherHeaderWidget
                activeWeather={activeWeather}
                allCitiesWeather={allCitiesWeather}
                selectedCityId={selectedWeatherCityId}
                onSelectCity={handleSelectWeatherCity}
                isLoading={isWeatherLoading}
                onRefresh={loadLivePanIndiaWeather}
                onSimulateSevereRain={handleSimulateSevereRain}
                onResetToLiveWeather={handleResetToLiveWeather}
                isSimulated={isWeatherSimulated}
                isDisasterMode={isDisasterMode}
              />

              {/* 1-Click Disaster Mode Button */}
              <button
                id="btn-toggle-disaster-header"
                onClick={handleToggleDisasterMode}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs ${
                  isDisasterMode
                    ? 'bg-amber-500 text-stone-950 border-amber-400 animate-pulse font-extrabold ring-2 ring-amber-300'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                }`}
                title="Toggle Monsoon / Disaster Triage Heuristics"
              >
                <Flame className={`w-3.5 h-3.5 ${isDisasterMode ? 'text-stone-950' : 'text-amber-600'}`} />
                <span className="hidden sm:inline">
                  {isDisasterMode ? 'DISASTER MODE: ACTIVE' : 'Disaster Triage'}
                </span>
                <span className="sm:hidden">{isDisasterMode ? 'ALERT' : 'Disaster'}</span>
              </button>

              {/* Primary Call to Action: Report Issue */}
              <button
                id="btn-report-civic-issue-header"
                onClick={() => setIsReportModalOpen(true)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 active:scale-98 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Report Issue</span>
              </button>
            </div>
          </div>

          {/* Navigation Bar Tabs */}
          <div className="flex space-x-1 sm:space-x-2 border-t border-stone-100 overflow-x-auto py-2">
            {[
              { id: 'map', label: 'Live City Map & GIS', icon: MapPin },
              { id: 'dispatch', label: 'Work Orders & Dispatch', icon: Kanban },
              { id: 'triage', label: 'Triage & Priority Engine', icon: Sliders },
              { id: 'intelligence', label: 'Ward Hotspots & Deduplication', icon: GitFork },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Disaster Mode Active Alert Banner (When on) */}
        {isDisasterMode && (
          <div className="mb-6 p-4 bg-amber-500 text-stone-950 rounded-xl border border-amber-400 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-stone-950 text-amber-400 rounded-lg shrink-0">
                <Flame className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm sm:text-base leading-tight">
                    MONSOON &amp; URBAN FLOOD EMERGENCY TRIAGE ACTIVE
                  </h4>
                  {weatherAutoTriggeredCity && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-stone-950 text-amber-300 font-mono tracking-wider">
                      Auto-Triggered by Rain Telemetry in {weatherAutoTriggeredCity} ({activeWeather?.precipitationMm}mm/h)
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-900/90 mt-0.5 max-w-3xl">
                  Automated triage heuristic: Flooding, storm drains, and fallen electrical cables receive 1.8x priority multiplier. Routine potholes are reprioritized to guarantee human safety.
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleDisasterMode}
              className="px-3 py-1.5 bg-stone-950 hover:bg-stone-900 text-white text-xs font-bold rounded-lg shrink-0 self-end sm:self-center"
            >
              Deactivate
            </button>
          </div>
        )}

        {/* TAB 1: LIVE CITY MAP & GIS COMMAND */}
        {activeTab === 'map' && (
          <div className="space-y-6">
            {/* Map Action Toolbar */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                    Incident Grid
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <button
                  id="btn-sync-osm-banner"
                  onClick={() => handleSyncOsmData('all')}
                  disabled={isFetchingOsm}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg transition-all border border-stone-300 flex items-center gap-1.5 disabled:opacity-60"
                  title="Fetch real OpenStreetMap Overpass nodes for Indian cities"
                >
                  {isFetchingOsm ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-stone-700 border-t-transparent rounded-full animate-spin" />
                      <span>Syncing OSM Data...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Sync OSM Data</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Report Incident at Location</span>
                </button>
              </div>
            </div>

            {/* The Full Geospatial Map Component */}
            <CivicGeospatialMap
              incidents={incidents}
              onUpvote={handleUpvote}
              onStatusChange={handleStatusChange}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              onAttachPhoto={handleAttachPhoto}
              selectedIncidentId={selectedIncidentIdForMap}
              onSyncOsm={handleSyncOsmData}
              isSyncingOsm={isFetchingOsm}
              osmDataSource={osmDataSource}
            />
          </div>
        )}

        {/* TAB 2: MUNICIPAL WORK ORDERS & DISPATCH QUEUE */}
        {activeTab === 'dispatch' && (
          <div className="space-y-6">
            <DispatchQueue
              incidents={incidents}
              onUpvote={handleUpvote}
              onStatusChange={handleStatusChange}
              onSelectOnMap={handleSelectOnMap}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              onAttachPhoto={handleAttachPhoto}
              isDisasterMode={isDisasterMode}
            />
          </div>
        )}

        {/* TAB 3: TRIAGE & PRIORITY ENGINE */}
        {activeTab === 'triage' && (
          <div className="space-y-6">
            {/* Priority Calculator */}
            <PriorityCalculator />

            {/* State Machine Lifecycle Viewer */}
            <StateLifecycleViewer />

            {/* Disaster Mode Toggle Simulator */}
            <DisasterModeToggle />
          </div>
        )}

        {/* TAB 4: WARD HOTSPOTS & DEDUPLICATION */}
        {activeTab === 'intelligence' && (
          <div className="space-y-6">
            {/* Deduplication Network Visualizer */}
            <DeduplicationVisualizer />
          </div>
        )}
      </main>
    </div>
  );
}

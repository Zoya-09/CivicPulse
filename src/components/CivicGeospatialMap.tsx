import React, { useState, useMemo, useRef } from 'react';
import {
  MapPin,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Eye,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  FileCode,
  Flame,
  Grid,
  Info,
  Maximize2,
  ExternalLink,
  Filter,
  Droplets,
  Zap,
  Trash2,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Search,
  Camera,
  Database,
  X
} from 'lucide-react';
import { IssueReportSample } from '../types/civic';
import { SAMPLE_INCIDENTS } from '../data/evaluationData';
import { INDIAN_CITIES, PAN_INDIA_BOUNDS, IndianCityConfig } from '../data/indianLocationsData';
import { CameraCapturePlaceholder, CapturedImageInfo } from './CameraCapturePlaceholder';
import { PhotoEvidenceViewer } from './PhotoEvidenceViewer';
import { simulateSaveIncidentPhoto } from '../utils/civicMediaStorage';

// Haversine distance in meters
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

export interface ClusterGroup {
  id: string;
  name: string;
  centroidLat: number;
  centroidLng: number;
  reports: IssueReportSample[];
  primaryReport: IssueReportSample;
  dominantCategory: IssueReportSample['category'];
  maxSeverity: number;
  totalUpvotes: number;
  corroborationCount: number;
  maxDistanceMeters: number;
  wardName: string;
  cityName?: string;
  stateName?: string;
}

export type LayerViewMode = 'cluster' | 'heatmap';

interface CivicGeospatialMapProps {
  incidents?: IssueReportSample[];
  onUpvote?: (id: string) => void;
  onStatusChange?: (id: string, newStatus: IssueReportSample['status']) => void;
  onOpenReportModal?: () => void;
  onAttachPhoto?: (
    reportId: string,
    dataUrl: string,
    metadata?: IssueReportSample['imageStorageMetadata']
  ) => void;
  selectedIncidentId?: string | null;
  initialLayerMode?: LayerViewMode;
  onSyncOsm?: (cityId: string) => Promise<void>;
  isSyncingOsm?: boolean;
  osmDataSource?: 'live_overpass_api' | 'cached_osm' | 'verified_osm_ground_truth';
}

export const CivicGeospatialMap: React.FC<CivicGeospatialMapProps> = ({
  incidents = SAMPLE_INCIDENTS,
  onUpvote,
  onStatusChange,
  onOpenReportModal,
  onAttachPhoto,
  selectedIncidentId,
  initialLayerMode = 'cluster',
  onSyncOsm,
  isSyncingOsm = false,
  osmDataSource = 'verified_osm_ground_truth',
}) => {
  const [selectedCityId, setSelectedCityId] = useState<string>('all');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('All');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeStatus, setActiveStatus] = useState<string>('All');
  const [clusterThresholdMeters, setClusterThresholdMeters] = useState<number>(25000); // 25km for pan-india, auto-adjusts to 75m on city select
  const [layerMode, setLayerMode] = useState<LayerViewMode>(initialLayerMode);
  const [inspectorTab, setInspectorTab] = useState<'cluster' | 'origins'>('cluster');
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = normal, 1.4 = zoomed in, 2 = deep inspection
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [mapSearch, setMapSearch] = useState<string>('');
  const [attachPhotoTargetReport, setAttachPhotoTargetReport] = useState<IssueReportSample | null>(null);
  const [pendingCapturedInfo, setPendingCapturedInfo] = useState<CapturedImageInfo | null>(null);
  const [photoViewerReport, setPhotoViewerReport] = useState<IssueReportSample | null>(null);
  const [photoViewerClusterReports, setPhotoViewerClusterReports] = useState<IssueReportSample[]>([]);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState<boolean>(false);

  const openPhotoViewer = (rep: IssueReportSample, clusterReportsList?: IssueReportSample[]) => {
    setPhotoViewerReport(rep);
    const list = clusterReportsList && clusterReportsList.length > 0
      ? clusterReportsList
      : activeCluster
      ? activeCluster.reports
      : [rep];
    setPhotoViewerClusterReports(list);
    setIsPhotoViewerOpen(true);
  };
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Active City Configuration
  const activeCityConfig: IndianCityConfig = useMemo(() => {
    return INDIAN_CITIES[selectedCityId] || INDIAN_CITIES.all;
  }, [selectedCityId]);

  // Handle City Change
  const handleSelectCity = (cityKey: string) => {
    setSelectedCityId(cityKey);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedClusterId(null);
    setActiveReportId(null);
    // Adjust default clustering threshold depending on scope
    if (cityKey === 'all') {
      setClusterThresholdMeters(25000); // 25 km
    } else {
      setClusterThresholdMeters(75); // 75 meters for street-level urban cluster
    }
  };

  // Compute active bounds based on selected city or all India
  const currentBounds = useMemo(() => {
    return activeCityConfig.bounds || PAN_INDIA_BOUNDS;
  }, [activeCityConfig]);

  // Unique list of states from incidents
  const availableStates = useMemo(() => {
    const s = new Set<string>();
    incidents.forEach((i) => {
      if (i.state) s.add(i.state);
    });
    return Array.from(s).sort();
  }, [incidents]);

  // Filter incidents based on incoming state, city, category, status & search
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // City match
      let matchCity = true;
      if (selectedCityId !== 'all') {
        const cityObj = INDIAN_CITIES[selectedCityId];
        if (cityObj) {
          matchCity = Boolean(
            (inc.city && inc.city.toLowerCase() === cityObj.id.toLowerCase()) ||
            (inc.city && cityObj.name.toLowerCase().includes(inc.city.toLowerCase())) ||
            (inc.state && cityObj.state.toLowerCase().includes(inc.state.toLowerCase()))
          );
        }
      }

      // State filter match
      const matchState =
        selectedStateFilter === 'All' ||
        (inc.state && inc.state.toLowerCase() === selectedStateFilter.toLowerCase());

      const matchCat = activeCategory === 'All' || inc.category === activeCategory;
      const matchStatus = activeStatus === 'All' || inc.status === activeStatus;
      const matchSearch =
        mapSearch === '' ||
        inc.id.toLowerCase().includes(mapSearch.toLowerCase()) ||
        inc.title.toLowerCase().includes(mapSearch.toLowerCase()) ||
        (inc.address && inc.address.toLowerCase().includes(mapSearch.toLowerCase())) ||
        (inc.ward && inc.ward.toLowerCase().includes(mapSearch.toLowerCase())) ||
        (inc.city && inc.city.toLowerCase().includes(mapSearch.toLowerCase())) ||
        (inc.state && inc.state.toLowerCase().includes(mapSearch.toLowerCase()));

      return matchCity && matchState && matchCat && matchStatus && matchSearch;
    });
  }, [incidents, selectedCityId, selectedStateFilter, activeCategory, activeStatus, mapSearch]);

  // Spatial clustering algorithm simulating PostGIS ST_ClusterDBSCAN(geom, eps := clusterThresholdMeters)
  const clusters = useMemo(() => {
    const visited = new Set<string>();
    const clusterList: ClusterGroup[] = [];

    filteredIncidents.forEach((incident) => {
      if (visited.has(incident.id)) return;

      // Find all neighbors within clusterThresholdMeters
      const group: IssueReportSample[] = [incident];
      visited.add(incident.id);

      filteredIncidents.forEach((other) => {
        if (visited.has(other.id)) return;
        const dist = haversineMeters(
          incident.latitude,
          incident.longitude,
          other.latitude,
          other.longitude
        );

        // Same category or spatial proximity match within cluster threshold
        if (dist <= clusterThresholdMeters) {
          group.push(other);
          visited.add(other.id);
        }
      });

      // Calculate centroid
      const avgLat = group.reduce((acc, r) => acc + r.latitude, 0) / group.length;
      const avgLng = group.reduce((acc, r) => acc + r.longitude, 0) / group.length;

      // Find primary (either explicitly without parentClusterId or earliest reported)
      const primary = group.find((r) => !r.parentClusterId) || group[0];
      const maxSeverity = Math.max(...group.map((r) => r.severityScore));
      const totalUpvotes = group.reduce((acc, r) => acc + r.upvotes, 0);

      // Max internal distance between reports
      let maxDist = 0;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const d = haversineMeters(group[i].latitude, group[i].longitude, group[j].latitude, group[j].longitude);
          if (d > maxDist) maxDist = d;
        }
      }

      clusterList.push({
        id: `cluster-${primary.category}-${primary.id}`,
        name: primary.clusterLabel || `${primary.title.slice(0, 32)}...`,
        centroidLat: avgLat,
        centroidLng: avgLng,
        reports: group,
        primaryReport: primary,
        dominantCategory: primary.category,
        maxSeverity,
        totalUpvotes,
        corroborationCount: group.length - 1,
        maxDistanceMeters: maxDist,
        wardName: primary.ward || 'Central Municipal Ward',
      });
    });

    return clusterList;
  }, [filteredIncidents, clusterThresholdMeters]);

  // Selected cluster object
  const activeCluster = useMemo(() => {
    if (!selectedClusterId) return clusters[0] || null;
    return clusters.find((c) => c.id === selectedClusterId) || clusters[0] || null;
  }, [clusters, selectedClusterId]);

  // Spatial Concentration Analysis to identify where the highest concentration of reports originates
  const concentrationAnalysis = useMemo(() => {
    if (clusters.length === 0) {
      return {
        peakCluster: null as ClusterGroup | null,
        totalReports: 0,
        sortedClusters: [] as ClusterGroup[],
        peakRatio: 0,
        peakDensityPer100m: '0',
      };
    }

    const totalReports = filteredIncidents.length;
    // Sort clusters by number of reports descending, then by maxSeverity descending
    const sorted = [...clusters].sort((a, b) => {
      if (b.reports.length !== a.reports.length) {
        return b.reports.length - a.reports.length;
      }
      return b.maxSeverity - a.maxSeverity;
    });

    const peakCluster = sorted[0];
    const peakRatio = totalReports > 0 ? Math.round((peakCluster.reports.length / totalReports) * 100) : 0;
    const spreadRadius = Math.max(25, peakCluster.maxDistanceMeters || 35);
    const areaKm2 = Math.PI * Math.pow(spreadRadius / 1000, 2);
    const peakDensityPer100m = (peakCluster.reports.length / Math.max(0.005, areaKm2)).toFixed(0);

    return {
      peakCluster,
      totalReports,
      sortedClusters: sorted,
      peakRatio,
      peakDensityPer100m,
    };
  }, [clusters, filteredIncidents]);

  // Smoothly center and focus on a specific hotspot/origin
  const handleFocusOrigin = (cluster: ClusterGroup) => {
    setSelectedClusterId(cluster.id);
    setActiveReportId(null);
    setZoomLevel(1.5);
    const latSpan = currentBounds.maxLat - currentBounds.minLat;
    const lngSpan = currentBounds.maxLng - currentBounds.minLng;
    const yPct = ((currentBounds.maxLat - cluster.centroidLat) / latSpan) * 100;
    const xPct = ((cluster.centroidLng - currentBounds.minLng) / lngSpan) * 100;
    setPanOffset({
      x: Math.round((50 - xPct) * 0.75),
      y: Math.round((50 - yPct) * 0.75),
    });
  };

  // Sync with selectedIncidentId prop if passed
  React.useEffect(() => {
    if (!selectedIncidentId) return;
    const target = incidents.find((i) => i.id === selectedIncidentId);
    if (!target) return;
    // If the incident belongs to a specific city and we aren't viewing it, switch city or keep Pan-India
    if (target.city && selectedCityId !== 'all') {
      const matchedCityKey = Object.keys(INDIAN_CITIES).find(
        (k) =>
          k !== 'all' &&
          (INDIAN_CITIES[k].name.toLowerCase().includes(target.city!.toLowerCase()) ||
            target.city!.toLowerCase().includes(k))
      );
      if (matchedCityKey && matchedCityKey !== selectedCityId) {
        setSelectedCityId(matchedCityKey);
      }
    }
    setActiveReportId(target.id);
    const parent = clusters.find((c) => c.reports.some((r) => r.id === target.id));
    if (parent) {
      setSelectedClusterId(parent.id);
    }
  }, [selectedIncidentId, incidents, clusters, selectedCityId]);

  // Convert lat/lng to container % coordinates (0 to 100%)
  const projectToMap = (lat: number, lng: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return { x: 50, y: 50 };
    }
    const latSpan = Math.max(0.001, (currentBounds.maxLat ?? 28.7) - (currentBounds.minLat ?? 28.4));
    const lngSpan = Math.max(0.001, (currentBounds.maxLng ?? 77.4) - (currentBounds.minLng ?? 77.0));

    // Invert Y because latitude increases northward (upward)
    const rawY = (((currentBounds.maxLat ?? 28.7) - lat) / latSpan) * 100;
    const rawX = ((lng - (currentBounds.minLng ?? 77.0)) / lngSpan) * 100;

    // Constrain to visual bounds
    const yPct = Math.max(1, Math.min(99, isNaN(rawY) ? 50 : rawY));
    const xPct = Math.max(1, Math.min(99, isNaN(rawX) ? 50 : rawX));

    // Apply zoom & pan transformation
    const centerX = 50;
    const centerY = 50;
    const scaledX = centerX + (xPct - centerX) * (zoomLevel || 1) + (panOffset.x || 0);
    const scaledY = centerY + (yPct - centerY) * (zoomLevel || 1) + (panOffset.y || 0);

    return { x: isNaN(scaledX) ? 50 : scaledX, y: isNaN(scaledY) ? 50 : scaledY };
  };

  // Handle map mouse move to simulate coordinate readouts
  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const latSpan = currentBounds.maxLat - currentBounds.minLat;
    const lngSpan = currentBounds.maxLng - currentBounds.minLng;

    const calcLat = currentBounds.maxLat - y * latSpan;
    const calcLng = currentBounds.minLng + x * lngSpan;

    setHoverCoord({
      lat: Number(calcLat.toFixed(4)),
      lng: Number(calcLng.toFixed(4)),
      label: activeCityConfig.name,
    });
  };

  // Helper for category badge colors
  const getCategoryColor = (cat: IssueReportSample['category']) => {
    switch (cat) {
      case 'pothole':
        return {
          bg: 'bg-amber-500',
          text: 'text-amber-700',
          border: 'border-amber-300',
          lightBg: 'bg-amber-50',
          ring: 'ring-amber-400/40',
        };
      case 'drainage':
        return {
          bg: 'bg-blue-600',
          text: 'text-blue-700',
          border: 'border-blue-300',
          lightBg: 'bg-blue-50',
          ring: 'ring-blue-400/40',
        };
      case 'streetlight':
        return {
          bg: 'bg-purple-600',
          text: 'text-purple-700',
          border: 'border-purple-300',
          lightBg: 'bg-purple-50',
          ring: 'ring-purple-400/40',
        };
      case 'water_leak':
        return {
          bg: 'bg-cyan-600',
          text: 'text-cyan-700',
          border: 'border-cyan-300',
          lightBg: 'bg-cyan-50',
          ring: 'ring-cyan-400/40',
        };
      case 'garbage':
        return {
          bg: 'bg-emerald-600',
          text: 'text-emerald-700',
          border: 'border-emerald-300',
          lightBg: 'bg-emerald-50',
          ring: 'ring-emerald-400/40',
        };
      default:
        return {
          bg: 'bg-stone-600',
          text: 'text-stone-700',
          border: 'border-stone-300',
          lightBg: 'bg-stone-50',
          ring: 'ring-stone-400/40',
        };
    }
  };

  return (
    <div id="civic-geospatial-map-root" className="bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden">
      {/* Top Header & GIS Engine Meta */}
      <div className="p-4 sm:p-6 border-b border-stone-200 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-stone-900 text-white rounded-lg shadow-xs">
                <MapPin className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-lg tracking-tight">Civic Geospatial Map</h3>
              </div>
            </div>
          </div>

          {/* Layer Toggle Control */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Layer Toggle Control: Cluster view vs Density heat map */}
            <div className="inline-flex rounded-lg p-1 bg-stone-100 border border-stone-200 text-xs shadow-2xs" role="group" aria-label="Map Layer Toggle">
              <button
                id="btn-layer-cluster-view"
                onClick={() => setLayerMode('cluster')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  layerMode === 'cluster'
                    ? 'bg-white text-stone-900 shadow-xs ring-1 ring-stone-200'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
                title="Cluster view: Group incidents into discrete spatial clusters with report counts"
              >
                <Grid className="w-3.5 h-3.5 text-stone-700" />
                <span>Cluster view</span>
              </button>
              <button
                id="btn-layer-density-heatmap"
                onClick={() => setLayerMode('heatmap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                  layerMode === 'heatmap'
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-xs ring-1 ring-amber-400'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
                title="Density heat map: Visualize where the highest concentration of reports originates"
              >
                <Flame className={`w-3.5 h-3.5 ${layerMode === 'heatmap' ? 'text-stone-950 fill-amber-700' : 'text-amber-600'}`} />
                <span>Density heat map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Indian City / Scope Switcher & Location Quick-Jump */}
        <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-semibold text-stone-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              <span>Location / City:</span>
            </span>

            {/* City Selector Dropdown */}
            <select
              id="select-indian-city"
              value={selectedCityId}
              onChange={(e) => handleSelectCity(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-300 rounded-lg px-2.5 py-1.5 font-medium text-stone-900 focus:ring-1 focus:ring-stone-400 focus:outline-none"
            >
              <option value="all">🇮🇳 Pan-India (All States & Metros)</option>
              <option value="delhi">Delhi NCR (NDMC / MCD)</option>
              <option value="mumbai">Mumbai (BMC / MCGM, MH)</option>
              <option value="bengaluru">Bengaluru (BBMP, KA)</option>
              <option value="chennai">Chennai (GCC, TN)</option>
              <option value="hyderabad">Hyderabad (GHMC, TG)</option>
              <option value="kolkata">Kolkata (KMC, WB)</option>
              <option value="ahmedabad">Ahmedabad (AMC, GJ)</option>
              <option value="lucknow">Lucknow (LMC, UP)</option>
              <option value="jaipur">Jaipur (JMC, RJ)</option>
              <option value="kochi">Kochi (KMC, KL)</option>
            </select>

            {/* State Filter Dropdown */}
            <select
              id="select-indian-state"
              value={selectedStateFilter}
              onChange={(e) => setSelectedStateFilter(e.target.value)}
              className="text-xs bg-stone-50 border border-stone-300 rounded-lg px-2 py-1.5 font-medium text-stone-800 focus:ring-1 focus:ring-stone-400 focus:outline-none"
            >
              <option value="All">All States / UTs</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {/* Live OpenStreetMap (OSM) Sync Button */}
            {onSyncOsm && (
              <button
                id="btn-sync-osm-map"
                onClick={() => onSyncOsm(selectedCityId)}
                disabled={isSyncingOsm}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 shadow-2xs"
                title="Fetch real-world civic incident nodes from OpenStreetMap Overpass API"
              >
                {isSyncingOsm ? (
                  <>
                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Syncing OSM...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sync Live OSM</span>
                  </>
                )}
              </button>
            )}

            {/* OSM Ground Truth / Live Status Pill */}
            <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-[10.5px] border border-stone-200 font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${osmDataSource === 'live_overpass_api' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
              <span>
                {osmDataSource === 'live_overpass_api' ? 'OSM Overpass Live' : osmDataSource === 'cached_osm' ? 'OSM Cache' : 'OSM Geo-Dataset'}
              </span>
            </div>
          </div>

          {/* Quick Search across Indian addresses and landmarks */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
            <input
              id="input-map-location-search"
              type="text"
              placeholder="Search CP, Dadar, MG Rd, ward..."
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-3 py-1 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400 font-medium placeholder:text-stone-400"
            />
          </div>
        </div>

        {/* Filters Bar & Clustering Radius Slider */}
        <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Category Filter Pills */}
          <div className="md:col-span-6 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-stone-400 flex items-center gap-1 font-medium pr-1 text-[11px]">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {[
              { id: 'All', label: 'All Incidents' },
              { id: 'pothole', label: 'Potholes' },
              { id: 'drainage', label: 'Drainage & Floods' },
              { id: 'streetlight', label: 'Streetlights' },
              { id: 'water_leak', label: 'Water Leaks' },
              { id: 'garbage', label: 'Sanitation' },
            ].map((cat) => (
              <button
                key={cat.id}
                id={`filter-cat-${cat.id}`}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors font-medium ${
                  activeCategory === cat.id
                    ? 'bg-stone-900 text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <label htmlFor="select-status-filter" className="text-xs text-stone-500 font-medium whitespace-nowrap">Status:</label>
            <select
              id="select-status-filter"
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value)}
              className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-800 font-medium focus:ring-1 focus:ring-stone-400 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Verified">Verified Only</option>
              <option value="Corroborated">Corroborated</option>
              <option value="In Progress">In Progress</option>
              <option value="Assigned">Assigned</option>
              <option value="Reported">Reported</option>
            </select>
          </div>

          {/* Cluster Radius Slider */}
          <div className="md:col-span-3 flex items-center gap-2">
            <div className="flex flex-col w-full">
              <div className="flex justify-between text-[11px] font-medium text-stone-600">
                <span>Cluster Radius:</span>
                <span className="font-mono font-bold text-stone-900">
                  {selectedCityId === 'all'
                    ? `${(clusterThresholdMeters / 1000).toFixed(0)} km`
                    : `${clusterThresholdMeters} m`}
                </span>
              </div>
              <input
                id="slider-cluster-radius"
                type="range"
                min={selectedCityId === 'all' ? 5000 : 20}
                max={selectedCityId === 'all' ? 80000 : 200}
                step={selectedCityId === 'all' ? 2500 : 5}
                value={clusterThresholdMeters}
                onChange={(e) => setClusterThresholdMeters(Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Map Interface + Inspector Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left Side: Interactive Map Stage (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 relative bg-stone-100 border-b lg:border-b-0 lg:border-r border-stone-200 select-none overflow-hidden">
          {/* Map Controls Floating Toolbar */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur-xs border border-stone-300/80 rounded-lg p-1 shadow-sm">
            <button
              id="map-ctrl-zoom-in"
              title="Zoom In"
              onClick={() => setZoomLevel((z) => Math.min(2.2, z + 0.25))}
              className="p-1.5 hover:bg-stone-100 rounded text-stone-700 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              id="map-ctrl-zoom-out"
              title="Zoom Out"
              onClick={() => setZoomLevel((z) => Math.max(0.85, z - 0.25))}
              className="p-1.5 hover:bg-stone-100 rounded text-stone-700 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="h-px bg-stone-200 mx-1"></div>
            <button
              id="map-ctrl-reset-view"
              title="Reset Center & Pan"
              onClick={() => {
                setZoomLevel(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="p-1.5 hover:bg-stone-100 rounded text-stone-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Floating On-Canvas Layer Toggle Control Switcher */}
          <div className="absolute top-4 left-16 z-20 bg-white/95 backdrop-blur-xs border border-stone-300/80 rounded-lg p-1 shadow-sm flex items-center gap-1">
            <span className="text-[11px] font-bold text-stone-500 pl-1.5 pr-1 flex items-center gap-1 border-r border-stone-200">
              <Layers className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">Layer:</span>
            </span>
            <button
              id="map-canvas-layer-cluster"
              onClick={() => setLayerMode('cluster')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
                layerMode === 'cluster'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
              title="Switch to Cluster view"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Cluster view</span>
            </button>
            <button
              id="map-canvas-layer-heatmap"
              onClick={() => setLayerMode('heatmap')}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
                layerMode === 'heatmap'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
              title="Switch to Density heat map mode"
            >
              <Flame className="w-3.5 h-3.5 text-stone-900" />
              <span>Density heat map</span>
            </button>
          </div>

          {/* Quick Hotspot Select Pills at Top Center */}
          <div className="absolute top-4 right-4 z-20 hidden sm:flex items-center gap-1.5 bg-white/90 backdrop-blur-xs p-1.5 rounded-lg border border-stone-300/80 shadow-xs max-w-[70%] overflow-x-auto">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider pl-1.5 whitespace-nowrap">
              Hotspots:
            </span>
            {clusters.map((cluster) => (
              <button
                key={cluster.id}
                id={`quick-select-${cluster.id}`}
                onClick={() => {
                  setSelectedClusterId(cluster.id);
                  setActiveReportId(null);
                }}
                className={`text-[11px] px-2 py-1 rounded-md font-medium whitespace-nowrap transition-all ${
                  selectedClusterId === cluster.id
                    ? 'bg-stone-900 text-white font-semibold shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {cluster.dominantCategory} ({cluster.reports.length})
              </button>
            ))}
          </div>

          {/* Map Stage Container with SVG Geospatial Base & Elements */}
          <div
            ref={mapContainerRef}
            onMouseMove={handleMapMouseMove}
            className="w-full h-[540px] lg:h-[640px] relative overflow-hidden cursor-crosshair bg-stone-200/60"
          >
            {/* SVG Base GIS Layer */}
            <svg
              className="w-full h-full absolute inset-0 pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Grid pattern */}
                <pattern id="gis-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d6d3d1" strokeWidth="0.3" strokeDasharray="1,1" />
                </pattern>

                {/* Heatmap radial gradient for deck.gl mode */}
                <radialGradient id="heat-glow-critical" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.75" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heat-glow-high" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.7" />
                  <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Background Coordinate Grid */}
              <rect width="100" height="100" fill="url(#gis-grid)" />

              {/* Natural Physical Geography: Rivers, Seas, Lakes, Parks */}
              {activeCityConfig.naturalFeatures?.map((nat, idx) => (
                <g key={`nat-${idx}`}>
                  {nat.type === 'park' && nat.points && (
                    <polygon points={nat.points} className={nat.color} strokeWidth="0.4" />
                  )}
                  {(nat.type === 'river' || nat.type === 'sea') && nat.path && (
                    <path d={nat.path} className={nat.color} strokeWidth="1.8" fill="none" />
                  )}
                  {nat.labelX !== undefined && nat.labelY !== undefined && (
                    <text
                      x={nat.labelX}
                      y={nat.labelY}
                      className="fill-blue-700/60 text-[2.6px] font-sans font-medium select-none"
                    >
                      {nat.name}
                    </text>
                  )}
                </g>
              ))}

              {/* Municipal Administrative Wards / Regional Zones */}
              {activeCityConfig.wards?.map((w) => (
                <g key={w.id}>
                  <ellipse
                    cx={w.cx}
                    cy={w.cy}
                    rx={w.rx}
                    ry={w.ry}
                    className={w.color}
                    strokeWidth="0.4"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={w.cx - w.rx + 2}
                    y={w.cy - w.ry + 4}
                    className="fill-stone-400 text-[2.7px] font-mono tracking-wider select-none"
                  >
                    {w.name}
                  </text>
                </g>
              ))}

              {/* Major Road Arterials & Expressways */}
              {activeCityConfig.roads?.map((road, idx) => (
                <g key={`road-${idx}`}>
                  <path
                    d={road.path}
                    fill="none"
                    className={road.stroke}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <path
                    d={road.path}
                    fill="none"
                    stroke="#fafaf9"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                  />
                </g>
              ))}

              {/* In Pan-India mode: Display Major Metro Anchors with quick click-to-zoom */}
              {selectedCityId === 'all' &&
                activeCityConfig.landmarks?.map((lm) => {
                  const pt = projectToMap(lm.lat, lm.lng);
                  const matchedCityKey = Object.keys(INDIAN_CITIES).find(
                    (k) =>
                      k !== 'all' &&
                      (INDIAN_CITIES[k].name.toLowerCase().includes(lm.name.toLowerCase().split(' ')[0]) ||
                        lm.name.toLowerCase().includes(k))
                  );

                  return (
                    <g
                      key={`metro-hub-${lm.name}`}
                      className="cursor-pointer group"
                      onClick={() => {
                        if (matchedCityKey) handleSelectCity(matchedCityKey);
                      }}
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="1.8"
                        className="fill-white stroke-stone-800 group-hover:fill-amber-400 transition-colors"
                        strokeWidth="0.7"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="0.8"
                        className="fill-stone-800 group-hover:fill-stone-950"
                      />
                      <text
                        x={pt.x + 2.5}
                        y={pt.y + 0.8}
                        className="fill-stone-700 text-[2.5px] font-semibold font-sans tracking-tight group-hover:fill-stone-950 select-none"
                      >
                        {lm.name.split('(')[0].trim()}
                      </text>
                    </g>
                  );
                })}

              {/* In City Mode: Display Real Landmark Street Pins */}
              {selectedCityId !== 'all' &&
                activeCityConfig.landmarks?.slice(0, 4).map((lm, idx) => {
                  const pt = projectToMap(lm.lat, lm.lng);
                  return (
                    <g key={`lm-${idx}`}>
                      <circle cx={pt.x} cy={pt.y} r="1.2" className="fill-stone-400/50" />
                      <text
                        x={pt.x + 2}
                        y={pt.y + 0.6}
                        className="fill-stone-500 text-[2.3px] font-medium tracking-tight select-none"
                      >
                        {lm.name}
                      </text>
                    </g>
                  );
                })}

              {/* DENSITY HEAT MAP MODE VISUALIZER */}
              {layerMode === 'heatmap' && (
                <g id="density-heatmap-svg-layer">
                  {/* Micro-heat for all filtered individual reports */}
                  {filteredIncidents.map((report) => {
                    const pt = projectToMap(report.latitude, report.longitude);
                    return (
                      <circle
                        key={`micro-heat-${report.id}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={4.5}
                        fill="url(#heat-glow-high)"
                        opacity="0.6"
                      />
                    );
                  })}

                  {/* Density Cluster Heat Blooms with Iso-Contour Rings & Hexbins */}
                  {clusters.map((cluster) => {
                    const pt = projectToMap(cluster.centroidLat, cluster.centroidLng);
                    const isPeakOrigin = concentrationAnalysis.peakCluster?.id === cluster.id;
                    const count = cluster.reports.length;
                    const radius = Math.min(22, 7 + count * 3.4);

                    return (
                      <g key={`heatmap-cluster-${cluster.id}`}>
                        {/* Outer Soft Heat Gradient Bloom */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={radius * 1.6}
                          fill={isPeakOrigin ? 'url(#heat-glow-critical)' : 'url(#heat-glow-high)'}
                          opacity={isPeakOrigin ? 0.95 : 0.8}
                        />

                        {/* Core Density Blob */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={radius * 0.9}
                          fill={isPeakOrigin ? 'url(#heat-glow-critical)' : 'url(#heat-glow-high)'}
                          opacity={0.9}
                        />

                        {/* Iso-contour Rings (Spatial Kernel Density Lines) */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={radius * 0.75}
                          fill="none"
                          stroke={isPeakOrigin ? '#ef4444' : count >= 3 ? '#f97316' : '#3b82f6'}
                          strokeWidth="0.35"
                          strokeDasharray="1.5,1.5"
                          opacity="0.8"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={radius * 1.3}
                          fill="none"
                          stroke={isPeakOrigin ? '#dc2626' : '#f59e0b'}
                          strokeWidth="0.25"
                          strokeDasharray="2,2"
                          opacity="0.6"
                        />

                        {/* Hexbin Mesh Outline for PostGIS / deck.gl Analytics Aesthetic */}
                        <polygon
                          points={`${pt.x},${pt.y - radius * 0.65} ${pt.x + radius * 0.56},${pt.y - radius * 0.32} ${pt.x + radius * 0.56},${pt.y + radius * 0.32} ${pt.x},${pt.y + radius * 0.65} ${pt.x - radius * 0.56},${pt.y + radius * 0.32} ${pt.x - radius * 0.56},${pt.y - radius * 0.32}`}
                          fill={isPeakOrigin ? 'rgba(220, 38, 38, 0.22)' : 'rgba(245, 158, 11, 0.16)'}
                          stroke={isPeakOrigin ? '#b91c1c' : '#d97706'}
                          strokeWidth="0.4"
                        />
                      </g>
                    );
                  })}

                  {/* Dynamic Radar Pulse & Crosshair on HIGHEST CONCENTRATION ORIGIN */}
                  {concentrationAnalysis.peakCluster && (() => {
                    const peak = concentrationAnalysis.peakCluster;
                    const pt = projectToMap(peak.centroidLat, peak.centroidLng);
                    return (
                      <g id="peak-origin-radar-sweep" key="peak-origin-radar">
                        {/* Outer Sonar Wave Rings */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="18"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                          opacity="0.9"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="26"
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth="0.3"
                          strokeDasharray="3,2"
                          opacity="0.6"
                        />
                        {/* Epicenter Crosshair */}
                        <line x1={pt.x - 3.5} y1={pt.y} x2={pt.x + 3.5} y2={pt.y} stroke="#ffffff" strokeWidth="0.4" />
                        <line x1={pt.x} y1={pt.y - 3.5} x2={pt.x} y2={pt.y + 3.5} stroke="#ffffff" strokeWidth="0.4" />
                        <circle cx={pt.x} cy={pt.y} r="1.2" fill="#ef4444" stroke="#ffffff" strokeWidth="0.35" />
                      </g>
                    );
                  })()}
                </g>
              )}

              {/* Inter-cluster Corroboration Vectors (Spider-Legs connecting reports within selected cluster) */}
              {layerMode === 'cluster' &&
                activeCluster &&
                activeCluster.reports.map((report) => {
                  if (report.id === activeCluster.primaryReport.id) return null;
                  const p1 = projectToMap(activeCluster.primaryReport.latitude, activeCluster.primaryReport.longitude);
                  const p2 = projectToMap(report.latitude, report.longitude);

                  return (
                    <line
                      key={`vector-${report.id}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="#44403c"
                      strokeWidth="0.5"
                      strokeDasharray="1,1"
                      className="animate-pulse"
                    />
                  );
                })}
            </svg>

            {/* DENSITY HEAT MAP MODE: Highest Concentration Origin Beacon Pin */}
            {layerMode === 'heatmap' && concentrationAnalysis.peakCluster && (() => {
              const peak = concentrationAnalysis.peakCluster;
              const pos = projectToMap(peak.centroidLat, peak.centroidLng);
              return (
                <div
                  id="highest-concentration-origin-pin"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -100%)',
                  }}
                  onClick={() => {
                    setSelectedClusterId(peak.id);
                    setActiveReportId(null);
                    openPhotoViewer(peak.primaryReport, peak.reports);
                  }}
                  className="absolute z-25 cursor-pointer pointer-events-auto"
                >
                  <div className="flex flex-col items-center">
                    <div className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-full shadow-lg border-2 border-white flex items-center gap-1.5 whitespace-nowrap animate-bounce">
                      <Flame className="w-3.5 h-3.5 text-amber-200 fill-amber-300" />
                      <span>ORIGIN: HIGHEST CONCENTRATION ({peak.reports.length} Reports)</span>
                    </div>
                    <div className="w-2 h-2 bg-red-600 rotate-45 -mt-1 border-r border-b border-white"></div>
                  </div>
                </div>
              );
            })()}

            {/* Render Cluster Pins / Markers (Interactive in both Cluster view & Heatmap) */}
            {clusters.map((cluster) => {
              const pos = projectToMap(cluster.centroidLat, cluster.centroidLng);
              const isSelected = selectedClusterId === cluster.id;
              const isPeak = concentrationAnalysis.peakCluster?.id === cluster.id;
              const catColors = getCategoryColor(cluster.dominantCategory);
              const count = cluster.reports.length;

              // In heatmap mode, render a compact density pill; in cluster mode render Leaflet-style cluster bubble
              if (layerMode === 'heatmap') {
                return (
                  <div
                    key={cluster.id}
                    id={`heatmap-node-${cluster.id}`}
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onClick={() => {
                      setSelectedClusterId(cluster.id);
                      setActiveReportId(null);
                      openPhotoViewer(cluster.primaryReport, cluster.reports);
                    }}
                    className="absolute z-15 cursor-pointer group"
                  >
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-sm transition-all border ${
                        isSelected
                          ? 'bg-stone-900 text-white border-white ring-2 ring-amber-400 scale-110'
                          : isPeak
                          ? 'bg-red-600 text-white border-white hover:scale-105'
                          : 'bg-white/90 text-stone-800 border-stone-300 hover:bg-white hover:scale-105'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isPeak ? 'bg-amber-300' : catColors.bg}`} />
                      <span>{count} pts</span>
                    </div>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                      <div className="bg-stone-900 text-white text-[10.5px] py-1 px-2 rounded shadow-md whitespace-nowrap">
                        <strong>{cluster.name}</strong> &bull; {count} reports
                      </div>
                    </div>
                  </div>
                );
              }

              const clusterImageReport = cluster.reports.find((r) => !!r.imagePreview);
              const hasClusterImage = !!clusterImageReport;

              return (
                <div
                  key={cluster.id}
                  id={`marker-cluster-${cluster.id}`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onClick={() => {
                    setSelectedClusterId(cluster.id);
                    setActiveReportId(null);
                    openPhotoViewer(cluster.primaryReport, cluster.reports);
                  }}
                  className="absolute z-10 cursor-pointer group"
                >
                  {/* Outer Pulsing Ring for High Severity or Selected */}
                  <div
                    className={`absolute -inset-2 rounded-full transition-all duration-300 ${
                      isSelected
                        ? 'bg-stone-900/20 scale-125 animate-ping'
                        : cluster.maxSeverity >= 8
                        ? `${catColors.ring} animate-pulse scale-110`
                        : 'opacity-0 group-hover:opacity-100 group-hover:scale-105'
                    }`}
                  />

                  {/* Leaflet-style Cluster Marker Badge */}
                  <div
                    className={`relative flex items-center justify-center rounded-full transition-all shadow-md ${
                      isSelected
                        ? 'ring-3 ring-stone-900 scale-110'
                        : 'hover:scale-110'
                    } ${
                      count > 1
                        ? 'w-10 h-10 bg-stone-900 text-white font-bold border-2 border-white'
                        : `w-8 h-8 ${catColors.bg} text-white border-2 border-white`
                    }`}
                  >
                    {/* Camera Photo Attachment Indicator Badge */}
                    {hasClusterImage && (
                      <div
                        className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-blue-600 text-white border-2 border-white flex items-center justify-center shadow-xs z-20"
                        title="Field Photo Stored in Media Vault"
                      >
                        <Camera className="w-2.5 h-2.5" />
                      </div>
                    )}

                    {/* Category Glyph or Report Count Badge */}
                    {count > 1 ? (
                      <div className="flex flex-col items-center justify-center leading-none">
                        <span className="text-xs font-mono font-bold">{count}</span>
                        <span className="text-[8px] font-mono tracking-tight text-stone-300">pts</span>
                      </div>
                    ) : (
                      <MapPin className="w-4 h-4 text-white" />
                    )}

                    {/* Small Category Indicator Dot */}
                    {count > 1 && (
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ${catColors.bg} border-2 border-white`}
                        title={cluster.dominantCategory}
                      />
                    )}
                  </div>

                  {/* Hover Tooltip Card */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                    <div className="bg-stone-900 text-white text-[11px] py-1.5 px-2.5 rounded-md shadow-lg whitespace-nowrap border border-stone-700 min-w-[150px]">
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>{cluster.name}</span>
                        <span className="text-[10px] px-1 py-0.2 bg-stone-800 text-stone-300 rounded font-mono">
                          Sev: {cluster.maxSeverity}/10
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {count} report{count > 1 ? 's' : ''} &bull; {cluster.corroborationCount} corroborations &bull; {cluster.wardName}
                      </div>

                      {/* Photo preview in tooltip if attached */}
                      {hasClusterImage && clusterImageReport?.imagePreview && (
                        <div className="mt-2 pt-1.5 border-t border-stone-800 flex items-center gap-2">
                          <img
                            src={clusterImageReport.imagePreview}
                            alt="Field Evidence"
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 object-cover rounded border border-stone-700 shrink-0"
                          />
                          <div className="text-[10px] text-stone-300 leading-tight">
                            <div className="font-semibold text-emerald-400 flex items-center gap-1">
                              <Camera className="w-2.5 h-2.5" />
                              <span>Field Photo Attached</span>
                            </div>
                            <div className="text-[9px] text-stone-400 font-mono mt-0.5">
                              {clusterImageReport.imageStorageMetadata?.storageBucket ? 'Simulated S3 Vault' : 'Geo-Tagged Photo'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="w-2 h-2 bg-stone-900 rotate-45 -mt-1 border-r border-b border-stone-700"></div>
                  </div>
                </div>
              );
            })}

            {/* Individual Child Incident Pins (Visible in Cluster view when a cluster is selected) */}
            {layerMode === 'cluster' &&
              activeCluster &&
              activeCluster.reports.length > 1 &&
              activeCluster.reports.map((childReport) => {
                const childPos = projectToMap(childReport.latitude, childReport.longitude);
                const isChildActive = activeReportId === childReport.id;
                const isPrimary = childReport.id === activeCluster.primaryReport.id;
                const catColors = getCategoryColor(childReport.category);

                return (
                  <div
                    key={`child-pin-${childReport.id}`}
                    id={`child-pin-${childReport.id}`}
                    style={{
                      left: `${childPos.x}%`,
                      top: `${childPos.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveReportId(childReport.id);
                      openPhotoViewer(childReport, activeCluster.reports);
                    }}
                    className={`absolute z-20 cursor-pointer transition-transform ${
                      isChildActive ? 'scale-125 z-30' : 'hover:scale-115'
                    }`}
                    title={`${childReport.id}: ${childReport.title}`}
                  >
                    <div
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-xs flex items-center gap-1 border ${
                        isPrimary
                          ? 'bg-stone-900 text-white border-stone-800 ring-2 ring-emerald-400'
                          : 'bg-white text-stone-800 border-stone-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${catColors.bg}`} />
                      <span>{childReport.id}</span>
                      {childReport.imagePreview && (
                        <Camera className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                      )}
                      {isPrimary && <span className="text-[8px] text-emerald-400 font-sans">PRIMARY</span>}
                    </div>
                  </div>
                );
              })}

            {/* Density Heat Map Concentration HUD & Origin Bar */}
            {layerMode === 'heatmap' && (
              <div
                id="density-heatmap-hud"
                className="absolute bottom-12 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-md z-20 bg-stone-950/95 text-white backdrop-blur-md p-3 rounded-xl border border-stone-800 shadow-xl space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Flame className="w-4 h-4 fill-amber-400 text-amber-500 animate-pulse" />
                    <span>DENSITY HEAT MAP ACTIVE</span>
                  </div>
                  {concentrationAnalysis.peakCluster && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                      PEAK: {concentrationAnalysis.peakCluster.reports.length} REPORTS
                    </span>
                  )}
                </div>

                {/* Concentration Gradient Ramp */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                    <span>Low (1 pt)</span>
                    <span>Moderate (2-3)</span>
                    <span className="text-amber-300 font-bold">Highest Concentration (5+ pts)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-500 via-amber-400 via-orange-500 to-red-600 shadow-inner border border-stone-700/50" />
                </div>

                {/* Origin Summary Callout */}
                {concentrationAnalysis.peakCluster && (
                  <div className="text-[11px] text-stone-300 pt-1.5 border-t border-stone-800/80 flex items-center justify-between gap-2">
                    <div className="truncate pr-1">
                      <span className="text-stone-400">Origin:</span>{' '}
                      <strong className="text-white">{concentrationAnalysis.peakCluster.name}</strong>{' '}
                      <span className="text-stone-400 font-mono text-[10px]">
                        ({concentrationAnalysis.peakRatio}% volume)
                      </span>
                    </div>
                    <button
                      id="btn-focus-concentration-origin"
                      onClick={() => handleFocusOrigin(concentrationAnalysis.peakCluster!)}
                      className="text-[10.5px] bg-red-600 hover:bg-red-500 text-white font-bold px-2 py-0.5 rounded shadow-sm transition-all shrink-0 active:scale-95"
                    >
                      Focus Origin
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Live Cursor Coordinate Status Bar at Bottom Right */}
            <div className="absolute bottom-3 right-3 z-20 bg-stone-900/90 backdrop-blur-xs text-stone-200 text-[11px] font-mono px-3 py-1.5 rounded-md border border-stone-700 shadow-sm flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-stone-400" />
                <span>
                  {hoverCoord
                    ? `${hoverCoord.lat.toFixed(4)}°N, ${hoverCoord.lng.toFixed(4)}°E • ${hoverCoord.label || activeCityConfig.name}`
                    : `${((currentBounds.minLat + currentBounds.maxLat) / 2).toFixed(4)}°N, ${((currentBounds.minLng + currentBounds.maxLng) / 2).toFixed(4)}°E • ${activeCityConfig.name}`}
                </span>
              </div>
              <span className="text-stone-600">|</span>
              <span className="text-[10px] text-stone-400">EPSG:4326 (WGS84)</span>
            </div>

            {/* Map Scale Bar at Bottom Left */}
            <div className="absolute bottom-3 left-3 z-20 bg-white/90 backdrop-blur-xs text-stone-700 text-[10px] font-mono px-2 py-1 rounded border border-stone-300 shadow-xs flex flex-col items-center">
              <div className="w-16 h-1 bg-stone-800 mb-0.5"></div>
              <span>{selectedCityId === 'all' ? '500 km' : '100 meters'}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Grouped Reports Inspector Panel (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-stone-50/70 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto max-h-[640px]">
          {/* Inspector Mode Tab Switcher */}
          <div className="flex items-center justify-between mb-3 border-b border-stone-200 pb-2.5">
            <div className="inline-flex rounded-lg p-0.5 bg-stone-200/80 text-xs">
              <button
                id="tab-inspector-cluster"
                onClick={() => setInspectorTab('cluster')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  inspectorTab === 'cluster'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Hotspot Inspector
              </button>
              <button
                id="tab-inspector-origins"
                onClick={() => setInspectorTab('origins')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${
                  inspectorTab === 'origins'
                    ? 'bg-amber-500 text-stone-950 shadow-xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Flame className="w-3 h-3 text-stone-900" />
                <span>Concentration Origins</span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-stone-500">
              {layerMode === 'heatmap' ? '🔥 Heatmap active' : '📍 Cluster view'}
            </span>
          </div>

          {inspectorTab === 'origins' ? (
            /* CONCENTRATION ORIGINS BREAKDOWN: Visualizing where the highest concentration of reports originates */
            <div className="space-y-4">
              {/* Peak Origin Hero Callout */}
              {concentrationAnalysis.peakCluster ? (
                <div className="bg-gradient-to-br from-red-50 to-amber-50 border border-red-200 p-4 rounded-xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-red-600 text-white flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-200 fill-amber-300" />
                      HIGHEST CONCENTRATION ORIGIN
                    </span>
                    <span className="text-xs font-mono font-bold text-red-800">
                      {concentrationAnalysis.peakRatio}% of {selectedCityId === 'all' ? 'National' : 'Municipal'} Reports
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">
                      {concentrationAnalysis.peakCluster.name}
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {concentrationAnalysis.peakCluster.wardName} &bull; Centroid: {concentrationAnalysis.peakCluster.centroidLat.toFixed(4)}°N, {concentrationAnalysis.peakCluster.centroidLng.toFixed(4)}°E
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-red-200/60 text-center">
                    <div className="p-1.5 bg-white/80 rounded border border-red-100">
                      <div className="text-[10px] text-stone-500 font-medium">Clustered Reports</div>
                      <div className="text-base font-bold text-red-600">
                        {concentrationAnalysis.peakCluster.reports.length} pts
                      </div>
                    </div>
                    <div className="p-1.5 bg-white/80 rounded border border-red-100">
                      <div className="text-[10px] text-stone-500 font-medium">Hotspot Radius</div>
                      <div className="text-base font-bold text-stone-800">
                        {concentrationAnalysis.peakCluster.maxDistanceMeters || 45}m
                      </div>
                    </div>
                    <div className="p-1.5 bg-white/80 rounded border border-red-100">
                      <div className="text-[10px] text-stone-500 font-medium">Peak Hazard</div>
                      <div className="text-base font-bold text-amber-700">
                        {concentrationAnalysis.peakCluster.maxSeverity}/10
                      </div>
                    </div>
                  </div>

                  <button
                    id="btn-focus-origin-hero"
                    onClick={() => handleFocusOrigin(concentrationAnalysis.peakCluster!)}
                    className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Focus Highest Concentration Origin on Map</span>
                  </button>
                </div>
              ) : null}

              {/* Ranked Hotspot List: Where Reports Originate Across City */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-700 px-1">
                  <span>Report Concentration by Hotspot ({concentrationAnalysis.sortedClusters.length})</span>
                  <span className="text-[11px] text-stone-400 font-normal">Ranked by volume</span>
                </div>

                {concentrationAnalysis.sortedClusters.map((cluster, index) => {
                  const isPeak = index === 0;
                  const ratio = concentrationAnalysis.totalReports > 0
                    ? Math.round((cluster.reports.length / concentrationAnalysis.totalReports) * 100)
                    : 0;
                  const isSelected = selectedClusterId === cluster.id;

                  return (
                    <div
                      key={`origin-rank-${cluster.id}`}
                      id={`origin-item-${cluster.id}`}
                      onClick={() => {
                        setSelectedClusterId(cluster.id);
                        setActiveReportId(null);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white border-stone-900 shadow-sm ring-1 ring-stone-900'
                          : isPeak
                          ? 'bg-red-50/50 border-red-200 hover:border-red-300'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isPeak ? 'bg-red-600 text-white' : 'bg-stone-200 text-stone-700'
                          }`}>
                            #{index + 1}
                          </span>
                          <span className="font-bold text-xs text-stone-900 truncate max-w-[180px]">
                            {cluster.name}
                          </span>
                        </div>
                        <span className={`text-[11px] font-mono font-bold ${
                          isPeak ? 'text-red-600' : 'text-stone-700'
                        }`}>
                          {cluster.reports.length} reports ({ratio}%)
                        </span>
                      </div>

                      {/* Volume Ratio Bar */}
                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden my-2">
                        <div
                          className={`h-full rounded-full ${
                            isPeak ? 'bg-red-600' : index === 1 ? 'bg-amber-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.max(8, ratio)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10.5px] text-stone-500 pt-1">
                        <span>{cluster.wardName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">Sev: {cluster.maxSeverity}/10</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFocusOrigin(cluster);
                            }}
                            className="text-[10px] text-stone-700 hover:text-stone-950 font-semibold underline"
                          >
                            Focus
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeCluster ? (
            <div className="space-y-4">
              {/* Cluster Meta Header */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                    CLUSTER ID: {activeCluster.id}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    {activeCluster.reports.length} Grouped Reports
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-stone-900 text-sm leading-snug">
                    {activeCluster.name}
                  </h4>
                  <p className="text-xs text-stone-500 mt-1">
                    {activeCluster.wardName} &bull; Centroid: {activeCluster.centroidLat.toFixed(4)}°N, {activeCluster.centroidLng.toFixed(4)}°E
                  </p>
                </div>

                {/* Cluster Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 text-center">
                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                    <div className="text-[10px] font-medium text-stone-500">Max Severity</div>
                    <div className="text-base font-bold text-stone-900">{activeCluster.maxSeverity}/10</div>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                    <div className="text-[10px] font-medium text-stone-500">Community Upvotes</div>
                    <div className="text-base font-bold text-stone-900">{activeCluster.totalUpvotes}</div>
                  </div>
                  <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                    <div className="text-[10px] font-medium text-stone-500">Cluster Spread</div>
                    <div className="text-base font-bold text-stone-900">
                      {activeCluster.maxDistanceMeters > 0 ? `${activeCluster.maxDistanceMeters}m` : 'Single Pt'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Deduplication & Corroboration Notice */}
              <div className="p-3 bg-amber-500/10 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Non-Destructive Clustering:</strong> Reports within the {clusterThresholdMeters}m spatial radius are linked to the Primary Incident without deleting records or ignoring citizen contributions.
                </p>
              </div>

              {/* Grouped Reports List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-600 font-semibold px-1">
                  <span>Grouped Incident Reports ({activeCluster.reports.length})</span>
                  <span className="text-[11px] text-stone-400 font-normal">Click report to inspect</span>
                </div>

                {activeCluster.reports.map((report) => {
                  const isPrimary = report.id === activeCluster.primaryReport.id;
                  const isInspected = activeReportId === report.id;
                  const catColors = getCategoryColor(report.category);

                  // Distance from primary
                  const distFromPrimary = haversineMeters(
                    activeCluster.primaryReport.latitude,
                    activeCluster.primaryReport.longitude,
                    report.latitude,
                    report.longitude
                  );

                  return (
                    <div
                      key={report.id}
                      id={`report-item-${report.id}`}
                      onClick={() => setActiveReportId(report.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isInspected
                          ? 'bg-white border-stone-900 shadow-sm ring-1 ring-stone-900'
                          : isPrimary
                          ? 'bg-white border-stone-300 hover:border-stone-400 shadow-xs'
                          : 'bg-white/80 border-stone-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isPrimary ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'
                          }`}>
                            {report.id}
                          </span>
                          {isPrimary ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ANCHOR INCIDENT
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-stone-500">
                              &Delta; {distFromPrimary}m from anchor
                            </span>
                          )}
                        </div>

                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          report.status === 'Verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          report.status === 'In Progress' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          report.status === 'Corroborated' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-stone-100 text-stone-700'
                        }`}>
                          {report.status}
                        </span>
                      </div>

                      <h5 className="font-semibold text-stone-900 text-xs mb-1">
                        {report.title}
                      </h5>

                      {report.description && (
                        <p className="text-[11px] text-stone-600 leading-relaxed mb-2 line-clamp-2">
                          {report.description}
                        </p>
                      )}

                      {/* Field Photo Evidence with Simulated Storage */}
                      {report.imagePreview && (
                        <div className="mb-2.5">
                          <div className="relative rounded-lg overflow-hidden border border-stone-200 bg-stone-900 group/img shadow-2xs">
                            <img
                              src={report.imagePreview}
                              alt={`Field Evidence for ${report.id}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-32 sm:h-36 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPhotoViewer(report, activeCluster?.reports || [report]);
                              }}
                            />
                            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-stone-900/80 backdrop-blur-xs text-white text-[9.5px] font-mono rounded border border-white/10 shadow-xs">
                              <Camera className="w-2.5 h-2.5 text-emerald-400" />
                              <span>FIELD PHOTO EVIDENCE</span>
                            </div>
                            <div className="absolute top-2 right-2 flex items-center gap-1">
                              <button
                                id={`btn-update-photo-overlay-${report.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAttachPhotoTargetReport(report);
                                  setPendingCapturedInfo(null);
                                }}
                                className="px-1.5 py-1 bg-blue-600/90 hover:bg-blue-600 text-white rounded text-[9.5px] font-semibold flex items-center gap-1 transition-colors border border-white/20 shadow-xs"
                                title="Update Photo"
                              >
                                <Camera className="w-2.5 h-2.5" />
                                <span>Update</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPhotoViewer(report, activeCluster?.reports || [report]);
                                }}
                                className="p-1 bg-stone-900/80 hover:bg-stone-900 text-white rounded text-[10px] flex items-center gap-1 transition-colors border border-white/10"
                                title="Enlarge Photo"
                              >
                                <Maximize2 className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-stone-950/85 backdrop-blur-xs px-2.5 py-1 text-white text-[9.5px] font-mono flex items-center justify-between border-t border-white/10">
                              <span className="truncate max-w-[170px] text-stone-300">
                                {report.imageStorageMetadata?.objectKey || `incidents/${report.id}/capture.jpg`}
                              </span>
                              <span className="text-emerald-400 font-semibold shrink-0 flex items-center gap-1">
                                <Database className="w-2.5 h-2.5" />
                                <span>Simulated Vault</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* If no field photo attached yet, prominent Add Photo prompt */}
                      {!report.imagePreview && (
                        <div className="mb-2.5 p-2 bg-stone-50 border border-dashed border-stone-300 rounded-lg flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
                            <Camera className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>No photo evidence attached yet</span>
                          </div>
                          <button
                            id={`btn-inline-add-photo-${report.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAttachPhotoTargetReport(report);
                              setPendingCapturedInfo(null);
                            }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10.5px] rounded flex items-center gap-1 transition-all shadow-2xs shrink-0 active:scale-95"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Add Photo</span>
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10.5px] text-stone-500 pt-2 border-t border-stone-100">
                        <div className="flex flex-col max-w-[200px] truncate">
                          <span className="font-semibold text-stone-800 truncate" title={report.address || report.ward}>
                            📍 {report.city ? `${report.city}, ` : ''}{report.address || report.ward}
                          </span>
                          {report.state && (
                            <span className="text-[9.5px] text-stone-400 font-mono">
                              {report.state}{report.pincode ? ` • PIN: ${report.pincode}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-1 font-mono text-stone-600">
                            <span>Upvotes:</span>
                            <span className="font-bold text-stone-900">{report.upvotes}</span>
                          </span>
                          <span className="font-mono text-stone-400">|</span>
                          <span className="font-mono text-stone-600">{report.daysOpen}d open</span>
                        </div>
                      </div>

                      {/* Citizen Reporter Attribution & Interactive Actions */}
                      <div className="mt-2 pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                        {report.reportedBy && (
                          <div className="text-[10px] text-stone-500">
                            By: <strong className="text-stone-700">{report.reportedBy}</strong>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          {/* Add / Update Photo Button */}
                          <button
                            id={`btn-action-add-photo-${report.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAttachPhotoTargetReport(report);
                              setPendingCapturedInfo(null);
                            }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-semibold text-[10.5px] flex items-center gap-1 transition-all active:scale-95"
                            title="Add or update photo evidence with Camera API"
                          >
                            <Camera className="w-3 h-3 text-blue-600" />
                            <span>{report.imagePreview ? 'Update Photo' : 'Add Photo'}</span>
                          </button>

                          {onUpvote && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpvote(report.id);
                              }}
                              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded font-semibold text-[10.5px] flex items-center gap-1 transition-all active:scale-95"
                              title="Upvote / Corroborate"
                            >
                              <span>👍</span>
                              <span>+1 Upvote ({report.upvotes})</span>
                            </button>
                          )}

                          {onStatusChange && (
                            <select
                              value={report.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                onStatusChange(report.id, e.target.value as IssueReportSample['status'])
                              }
                              className="text-[10.5px] bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5 font-medium text-stone-800"
                            >
                              <option value="Reported">Reported</option>
                              <option value="Corroborated">Corroborated</option>
                              <option value="Assigned">Assigned</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-stone-400 space-y-2">
              <MapPin className="w-8 h-8 mx-auto text-stone-300" />
              <p className="text-xs">Select any hotspot on the map to view its grouped incidents</p>
            </div>
          )}

          {/* Cluster Status Footer */}
          <div className="pt-4 mt-4 border-t border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-stone-400" />
              <span>Active Clusters: {clusters.length}</span>
            </span>
            <span className="text-stone-600 font-medium">{incidents.length} total reports</span>
          </div>
        </div>
      </div>

      {/* Dedicated Photo Evidence Lightbox Viewer */}
      <PhotoEvidenceViewer
        isOpen={isPhotoViewerOpen}
        onClose={() => setIsPhotoViewerOpen(false)}
        report={photoViewerReport}
        clusterReports={photoViewerClusterReports}
        onAttachPhoto={(reportId, dataUrl, metadata) => {
          if (onAttachPhoto) {
            onAttachPhoto(reportId, dataUrl, metadata);
          }
          setPhotoViewerReport((prev) =>
            prev && prev.id === reportId
              ? { ...prev, imagePreview: dataUrl, imageStorageMetadata: metadata }
              : prev
          );
        }}
      />

      {/* Incident Add/Update Photo Modal */}
      {attachPhotoTargetReport && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            setAttachPhotoTargetReport(null);
            setPendingCapturedInfo(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 leading-tight">
                    Add Photo Evidence to Incident
                  </h4>
                  <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                    {attachPhotoTargetReport.id} &bull; {attachPhotoTargetReport.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAttachPhotoTargetReport(null);
                  setPendingCapturedInfo(null);
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200/80 text-xs flex items-center justify-between">
                <div>
                  <span className="text-stone-400 font-mono text-[10.5px]">Target Location:</span>
                  <p className="font-semibold text-stone-800 text-xs">
                    📍 {attachPhotoTargetReport.city ? `${attachPhotoTargetReport.city}, ` : ''}
                    {attachPhotoTargetReport.address || attachPhotoTargetReport.ward}
                  </p>
                </div>
                <span className="text-[10.5px] font-mono px-2 py-0.5 bg-white border border-stone-200 rounded text-stone-600">
                  {attachPhotoTargetReport.status}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                  Take Photo or Upload Evidence
                </label>
                <CameraCapturePlaceholder
                  onImageCaptured={(info) => setPendingCapturedInfo(info)}
                  currentImage={pendingCapturedInfo?.dataUrl || attachPhotoTargetReport.imagePreview}
                  locationName={attachPhotoTargetReport.address || attachPhotoTargetReport.ward}
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setAttachPhotoTargetReport(null);
                    setPendingCapturedInfo(null);
                  }}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-lg transition-colors"
                >
                  Cancel
                </button>

                <button
                  id="btn-save-incident-photo"
                  type="button"
                  disabled={!pendingCapturedInfo}
                  onClick={() => {
                    if (pendingCapturedInfo) {
                      const mediaRecord = simulateSaveIncidentPhoto(
                        attachPhotoTargetReport.id,
                        pendingCapturedInfo.dataUrl,
                        {
                          deviceSource: pendingCapturedInfo.source,
                          resolution: pendingCapturedInfo.resolution,
                        }
                      );
                      const metadata = {
                        storageBucket: mediaRecord.storageBucket,
                        objectKey: mediaRecord.objectKey,
                        fileSizeBytes: mediaRecord.fileSizeBytes,
                        capturedAt: mediaRecord.capturedAt,
                        deviceSource: mediaRecord.deviceSource,
                        resolution: mediaRecord.resolution,
                      };
                      if (onAttachPhoto) {
                        onAttachPhoto(
                          attachPhotoTargetReport.id,
                          pendingCapturedInfo.dataUrl,
                          metadata
                        );
                      }
                      setAttachPhotoTargetReport(null);
                      setPendingCapturedInfo(null);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Save Photo to Incident</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
